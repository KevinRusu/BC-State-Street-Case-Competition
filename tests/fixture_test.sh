#!/usr/bin/env bash
# Run notebook 02 on the small made-up fixture in tests/fixtures/small (same schema as the release; no row copied
# from data/) and compare what it finds with what the fixture was built to contain. Outputs go to run_fixture_*,
# never to outputs/. Runs: default config, rows shuffled, holding_date = settlement, and a trace flag no key carries.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
W=tests/runs
mkdir -p "$W"
export RECONCILIATION_DATA=tests/fixtures/small/manifest.csv
python3 - <<'PY'
base = open('config/reconciliation.toml').read()
W = 'tests/runs'
for name, old, new in [('shuffled', 'shuffle_seed = 0', 'shuffle_seed = 3'),
                       ('settlement', 'holding_date = "trade"', 'holding_date = "settlement"'),
                       ('notrace', 'flag = "sign_conflict"', 'flag = "rebook_old_gross"')]:
    assert old in base, f'config has no line {old!r}'
    open(f'{W}/config_fixture_{name}.toml', 'w').write(base.replace(old, new))
PY
run() {  # $1 = label, $2 = config path or empty
  rm -rf "$W/run_fixture_$1"
  RECONCILIATION_OUTPUTS="$W/run_fixture_$1" RECONCILIATION_CONFIG="$2" tests/run_notebook.sh | tail -1
}
run default ""
run shuffled "$W/config_fixture_shuffled.toml"
run settlement "$W/config_fixture_settlement.toml"
run notrace "$W/config_fixture_notrace.toml"
uv run --quiet python - <<'PY'
import glob, os, pandas as pd
W = 'tests/runs'
read = lambda run, name: pd.read_csv(f'{W}/run_fixture_{run}/{name}', dtype=str, keep_default_na=False)
results = []
def expect(what, expected, observed):
    results.append((what, expected, observed, expected == observed))

# Fixture case -> expected outcome (default config: trade date, R1 main, R3 side view)
classes = read('default', '02_break_classes.csv').set_index('main_class')['keys'].astype(int)
expect('blank book quantity -> not evaluable, never a break',
       1, int(classes.get('not evaluable: unreadable book quantity', 0)))
expect('blank trade date in the main chain -> not evaluable', 1, int(classes.get('not evaluable: unreadable date', 0)))
expect('custodian on settlement-date basis -> its cause class', 1,
       int(classes.get('custodian is the odd one out: custodian on settlement-date basis', 0)))
side = read('default', '02_reversed_side_view.csv')
side.columns = ['main', 'side', 'keys']
agree = side[(side['main'] == 'rebuild is the odd one out') & (side['side'] == 'all three agree')]['keys'].astype(int).sum()
expect('two reversals per original, in both file orders -> R3 offsets with the lowest ID, so both keys agree under R3',
       2, int(agree))
ca = read('default', '02_ca_readiness.csv').set_index('action_type')
expect('blank trade date before the ex-date -> holder key not evaluable (split)',
       ('1', '1'), (ca.loc['SPLIT', 'candidate holders'], ca.loc['SPLIT', 'holder keys not evaluable']))
register = read('default', '02_defect_register.csv').set_index('finding')
expect('EUR price on a date with no EUR rate (EUR rate dated DD/MM/YYYY on the other date) -> 2 rows',
       '2', register.loc['Price with no FX rate for its currency on the price date', 'affected'])
expect('blank price from the preferred vendor -> preferred vendor has no valid price (1 security-date)',
       '1', register.loc['Preferred vendor has no valid price on a date', 'affected'])
breaks = (read('default', '02_break_classes.csv').query("`is a break` == 'yes'")['keys'].astype(int).sum())
class_lines = register[register['rule'].str.startswith('POS_') & register['how detected'].str.contains('section 5')]
expect('break keys = sum of the break-class register lines', int(breaks), int(class_lines['affected'].astype(int).sum()))
trace = read('default', '02_trace.csv')
traced = trace[(trace['hop'] == 'source') & (trace['field'] == 'quantity')]['value'].tolist()
expect('trace picks the negative-quantity BUY present in all three sources', ['-50'], traced)

# Shuffled rows -> the same outputs (the conflicting-pair keep_first / keep_second lines aside: none in the fixture)
changed = []
for path in sorted(glob.glob(f'{W}/run_fixture_default/02_*.csv')):
    name = os.path.basename(path)
    if name in ('02_run_info.csv', '02_row_ledger.csv'):
        continue
    a, b = read('default', name), read('shuffled', name)
    a, b = (f.sort_values(list(f.columns)).reset_index(drop=True) for f in (a, b))
    if not a.equals(b):
        changed.append(name)
expect('rows shuffled (seed 3) -> same outputs', [], changed)

# holding_date = settlement -> the run finishes and C7 is the settlement-date version
waterfall = read('settlement', '02_waterfall.csv')
expect('settlement run: C7 line is the settlement-date cut-off', True,
       bool(waterfall.loc[waterfall['code'] == 'C7', 'variant'].str.startswith('settlement').all()))
expect('settlement run: the other line is the trade-date one (C7t)', True, bool((waterfall['code'] == 'C7t').any()))
ca_s = read('settlement', '02_ca_readiness.csv').set_index('action_type')
expect('settlement run: holders still use the trade-date rebuild', ('1', '1'),
       (ca_s.loc['SPLIT', 'candidate holders'], ca_s.loc['SPLIT', 'holder keys not evaluable']))

# No key carries the trace flag -> the run finishes and writes an empty trace
expect('no trace candidate -> empty 02_trace.csv, no crash', 0, len(read('notrace', '02_trace.csv')))

width = max(len(r[0]) for r in results)
for what, expected, observed, ok in results:
    print(f"{'PASS' if ok else 'FAIL'}  {what:<{width}}  expected {expected!r}, observed {observed!r}")
assert all(r[3] for r in results), 'fixture outcomes differ from what the fixture was built to contain'
print(f'fixture test passed: {len(results)} expected outcomes observed')
PY
