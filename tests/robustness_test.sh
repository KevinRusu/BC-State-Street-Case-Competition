#!/usr/bin/env bash
# T11: run the deliverable notebook as delivered, with every table's rows shuffled under several seeds, and with one threshold
# changed; compare outputs. Restores the default outputs at the end. Exit non-zero on any unexpected difference.
# The seeds are checked first: at least one of them must reverse the file order of the two REVERSED rows of an
# original whose two reversals differ in quantity (the case where a row-order-dependent R3 would move a number).
# Seed 7 alone was not enough: it flipped 2 such originals whose effects cancelled in the totals. Seed 3 flips all of
# them in the release, and moved the R3 sensitivity line on the code before the fix.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
W=tests/runs
mkdir -p "$W"
SEEDS="3 11 25"
python3 - "$SEEDS" <<'PY'
import sys
base = open('config/reconciliation.toml').read()
assert 'shuffle_seed = 0' in base, 'config has no [robustness] shuffle_seed = 0 line'
for seed in sys.argv[1].split():
    open(f'tests/runs/config_shuffled_{seed}.toml', 'w').write(
        base.replace('shuffle_seed = 0', f'shuffle_seed = {seed}'))
assert 'spread_threshold = 0.005' in base and base.count('OMS_FRONT = 240') == 1
# Two live changes in one run: a price threshold, and one feed's processing-latency limit (D-065)
open('tests/runs/config_threshold.toml', 'w').write(base.replace('spread_threshold = 0.005', 'spread_threshold = 0.01')
                                                    .replace('OMS_FRONT = 240', 'OMS_FRONT = 480'))
PY
uv run --quiet python - "$SEEDS" <<'PY'
# Seed check: the same load and shuffle call as the notebook (DuckDB, all_varchar, fillna(''), sample(frac=1)).
import csv, sys, duckdb, pandas as pd
manifest = {row['table']: row for row in csv.DictReader(open('manifest.csv', newline=''))}
t = duckdb.connect().sql(f"SELECT * FROM read_csv('{manifest['transactions']['file']}', all_varchar=true, header=true)").df().fillna('')
def first_reversal(frame):
    rev = frame[frame['status'] == 'REVERSED']
    return rev.drop_duplicates('related_transaction_id').set_index('related_transaction_id')['transaction_id']
rev = t[t['status'] == 'REVERSED']
counts = rev['related_transaction_id'].value_counts()
two = rev[rev['related_transaction_id'].isin(counts[counts == 2].index)]
quantities = pd.to_numeric(two['quantity'], errors='coerce').fillna(float('inf'))   # blank counts as different
sensitive = quantities.groupby(two['related_transaction_id']).nunique()
sensitive = sensitive[sensitive > 1].index
base = first_reversal(t)
flips = {}
for seed in sys.argv[1].split():
    shuffled = first_reversal(t.sample(frac=1, random_state=int(seed)).reset_index(drop=True))
    flips[seed] = int((shuffled.loc[sensitive] != base.loc[sensitive]).sum())
print(f'seed check: {len(sensitive)} originals have two reversals with different quantities; reversed by seed: {flips}')
assert max(flips.values(), default=0) > 0, 'no seed reverses an order-sensitive pair of reversals; pick other seeds'
PY
run() {  # $1 = label, $2 = config path or empty
  rm -rf "$W/run_$1"; mkdir -p "$W/run_$1"
  RECONCILIATION_CONFIG="$2" tests/run_notebook.sh | tail -1
  cp outputs/02_*.csv "$W/run_$1/"
}
run a ""
for seed in $SEEDS; do run "s$seed" "$W/config_shuffled_$seed.toml"; done
run c "$W/config_threshold.toml"
status=0
uv run --quiet python - "$SEEDS" <<'PY' || status=$?
import glob, os, sys, numpy as np, pandas as pd
W = 'tests/runs'
seeds = sys.argv[1].split()
info = {k: pd.read_csv(f'{W}/run_{k}/02_run_info.csv').set_index('item')['value'] for k in ['a', 'c'] + [f's{s}' for s in seeds]}
assert str(info['a']['shuffle_seed']) == '0', 'the default run shuffled'
for seed in seeds:
    assert str(info[f's{seed}']['shuffle_seed']) == seed, f'the run for seed {seed} did not shuffle with it'

def canonical(path):
    frame = pd.read_csv(path, dtype=str, keep_default_na=False)
    return frame.sort_values(list(frame.columns)).reset_index(drop=True)

def same(a, b):
    """Equal tables: text exactly; numbers within 1e-9 (summation order can move the last float digit). A numeric
    column may hold blanks (for example no quote -> no mean): the blanks must sit in the same rows."""
    if list(a.columns) != list(b.columns) or len(a) != len(b):
        return False
    for column in a.columns:
        x, y = pd.to_numeric(a[column], errors='coerce'), pd.to_numeric(b[column], errors='coerce')
        blank_a, blank_b = a[column] == '', b[column] == ''
        numeric = (x.notna() | blank_a).all() and (y.notna() | blank_b).all() and x.notna().any()
        if numeric:
            if not (blank_a == blank_b).all() or not np.allclose(x[~blank_a], y[~blank_b], rtol=1e-9, atol=1e-9):
                return False
        elif not (a[column] == b[column]).all():
            return False
    return True

ROW_ORDER_DEPENDENT = ['conflicting pairs: keep_first', 'conflicting pairs: keep_second']   # by definition
problems = []
for seed in seeds:
    for path in sorted(glob.glob(f'{W}/run_a/02_*.csv')):
        name = os.path.basename(path)
        if name in ('02_run_info.csv', '02_row_ledger.csv'):
            continue
        a, b = canonical(path), canonical(f'{W}/run_s{seed}/{name}')
        if name == '02_sensitivities.csv':
            a = a[~a['alternative'].isin(ROW_ORDER_DEPENDENT)].reset_index(drop=True)
            b = b[~b['alternative'].isin(ROW_ORDER_DEPENDENT)].reset_index(drop=True)
        ok = same(a, b)
        print(f'shuffle test seed {seed} {name}: {"same" if ok else "DIFFERENT"}')
        if not ok:
            problems.append(f'seed {seed}: {name}')
va = pd.read_csv(f'{W}/run_a/02_vendor_check.csv')['result'].value_counts()
vc = pd.read_csv(f'{W}/run_c/02_vendor_check.csv')['result'].value_counts()
print('threshold rehearsal: spread_threshold 0.005 -> 0.01: "spread above threshold"',
      int(va.get('spread above threshold', 0)), '->', int(vc.get('spread above threshold', 0)),
      '| pass', int(va.get('pass', 0)), '->', int(vc.get('pass', 0)))
assert vc.get('spread above threshold', 0) <= va.get('spread above threshold', 0), 'a looser threshold flagged more'
assert va.sum() == vc.sum(), 'held securities changed with a threshold'
ra = pd.read_csv(f'{W}/run_a/02_waterfall.csv'); rc = pd.read_csv(f'{W}/run_c/02_waterfall.csv')
assert ra.equals(rc), 'the reconciliation moved when only a price threshold changed'
# Timeliness: loosening OMS_FRONT's processing limit (240 -> 480 min) may only move that feed's processing limit and
# its "median above limit" flags, and never from "no" to "yes"; every count and median stays the same.
ta = pd.read_csv(f'{W}/run_a/02_timeliness.csv', dtype=str, keep_default_na=False)
tc = pd.read_csv(f'{W}/run_c/02_timeliness.csv', dtype=str, keep_default_na=False)
own = (ta['measure'] == 'processing_latency') & (ta['source_system'] == 'OMS_FRONT')
moving = ['limit_minutes', 'median_above_limit']
own_days = own & (ta['day'] != 'all')
assert set(ta.loc[own_days, 'limit_minutes']) == {'240.0'} and set(tc.loc[own_days, 'limit_minutes']) == {'480.0'}, \
    'the OMS_FRONT processing limit in the config did not reach 02_timeliness.csv'
assert ta.drop(columns=moving).equals(tc.drop(columns=moving)), 'a timeliness count or median moved with a limit'
assert ta[~own][moving].equals(tc[~own][moving]), 'another feed or measure moved with the OMS_FRONT processing limit'
assert not ((ta.loc[own, 'median_above_limit'] == 'no') & (tc.loc[own, 'median_above_limit'] == 'yes')).any(), \
    'a looser limit flagged a new feed-day'
yes_a, yes_c = int((ta.loc[own, 'median_above_limit'] == 'yes').sum()), int((tc.loc[own, 'median_above_limit'] == 'yes').sum())
print(f'threshold rehearsal: processing limit OMS_FRONT 240 -> 480 min: "yes" feed-days {yes_a} -> {yes_c}')
assert yes_c <= yes_a
assert not problems, f'outputs changed under shuffling: {problems}'
print(f'robustness test passed: rows shuffled with seeds {", ".join(seeds)} give the same outputs; '
      'a threshold change moves only its own check')
PY
run a "" > /dev/null   # leave the default outputs in place, also when a comparison failed
exit $status
