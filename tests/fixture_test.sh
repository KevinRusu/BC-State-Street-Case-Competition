#!/usr/bin/env bash
# Run notebook 02 on the small made-up fixture in tests/fixtures/small (same schema as the release; no row copied
# from data/) and compare what it finds with what the fixture was built to contain. Outputs go to run_fixture_*,
# never to outputs/. Runs: default config, rows shuffled, holding_date = settlement, a trace flag no key carries, and
# an edge copy of the fixture (built below in tests/runs/fixture_edge) with inputs the release does not contain.
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
# Edge fixture: a copy of tests/fixtures/small with the cases a schema-compatible file may hold and the release does
# not (built here, so the default fixture and its expected outcomes stay as they are).
python3 - <<'PY'
import csv, shutil
src, dst = 'tests/fixtures/small', 'tests/runs/fixture_edge'
shutil.rmtree(dst, ignore_errors=True)
shutil.copytree(src, dst)
def edit(table, change):
    path = f'{dst}/{table}.csv'
    with open(path, newline='') as stream:
        reader = csv.DictReader(stream)
        fields, rows = reader.fieldnames, list(reader)
    rows = change(rows, fields)
    with open(path, 'w', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, lineterminator='\n')
        writer.writeheader()
        writer.writerows(rows)
    return len(rows)
def add(*lines):
    return lambda rows, fields: rows + [dict(zip(fields, line.split(','))) for line in lines]
def set_field(match, field, value, then=None):
    def change(rows, fields):
        for row in rows:
            if all(row[k] == v for k, v in match.items()):
                row[field] = value
        return then(rows, fields) if then else rows
    return change
counts = {
    # Negative BUY whose gross_amount fits neither sign, on an account missing from accounts, with no pipeline record;
    # it sorts first, so it is the traced key. Then: one original reversed by one REVERSED row delivered twice, and
    # two REVERSED rows with no link (all on a key that is already not evaluable).
    'transactions': edit('transactions', add(
        'FXT30,FXACC0,FXSEC3,FXCUSIP03,BUY,2026-06-15,2026-06-17,-10,5.00,USD,20.00,BOOKED,,FIXTURE_OMS,2026-06-15 09:00:00,',
        'FXT31,FXACC2,FXSEC3,FXCUSIP03,BUY,2026-06-16,2026-06-18,15,5.00,USD,75.00,BOOKED,,FIXTURE_OMS,2026-06-16 09:00:00,',
        'FXT32,FXACC2,FXSEC3,FXCUSIP03,BUY,2026-06-16,2026-06-18,15,5.00,USD,75.00,REVERSED,FXT31,FIXTURE_OMS,2026-06-16 10:00:00,',
        'FXT32,FXACC2,FXSEC3,FXCUSIP03,BUY,2026-06-16,2026-06-18,15,5.00,USD,75.00,REVERSED,FXT31,FIXTURE_OMS,2026-06-16 10:00:00,',
        'FXT33,FXACC2,FXSEC3,FXCUSIP03,BUY,2026-06-17,2026-06-19,5,5.00,USD,25.00,REVERSED,,FIXTURE_OMS,2026-06-17 10:00:00,',
        'FXT34,FXACC2,FXSEC3,FXCUSIP03,BUY,2026-06-18,2026-06-22,5,5.00,USD,25.00,REVERSED,,FIXTURE_OMS,2026-06-18 10:00:00,',
        # Blank quantities: one whose size is in the row (50.00 / 5.00 = 10 units; book and custodian leave it out),
        # and one linked to another trade (held, never derived).
        'FXT40,FXACC1,FXSEC3,FXCUSIP03,BUY,2026-06-15,2026-06-17,20,5.00,USD,100.00,BOOKED,,FIXTURE_OMS,2026-06-15 09:00:00,',
        'FXT41,FXACC1,FXSEC3,FXCUSIP03,BUY,2026-06-16,2026-06-18,,5.00,USD,50.00,BOOKED,,FIXTURE_OMS,2026-06-16 09:00:00,',
        'FXT42,FXACC2,FXSEC2,FXCUSIP02,BUY,2026-06-16,2026-06-18,,10.00,EUR,100.00,BOOKED,FXT01,FIXTURE_OMS,2026-06-16 09:00:00,',
        # A CANCELLED trade delivered twice with two quantities (10 and 12), and its rebook: gross_amount 50.00 fits
        # the first copy only, so which copy the rebook is compared with must not depend on file order.
        'FXT60,FXACC2,FXSEC3,FXCUSIP03,BUY,2026-06-19,2026-06-23,10,5.00,USD,50.00,CANCELLED,,FIXTURE_OMS,2026-06-19 09:00:00,',
        'FXT60,FXACC2,FXSEC3,FXCUSIP03,BUY,2026-06-19,2026-06-23,12,5.00,USD,60.00,CANCELLED,,FIXTURE_OMS,2026-06-19 09:00:00,',
        'FXT61,FXACC2,FXSEC3,FXCUSIP03,BUY,2026-06-19,2026-06-23,8,5.00,USD,50.00,BOOKED,FXT60,FIXTURE_OMS,2026-06-19 10:00:00,')),
    # Book row dated DD/MM/YYYY (same snapshot), the traced key in the book, the blank-quantity key without its units,
    # and a row for an existing key on the day before the snapshot (outside the comparison, never joined to it).
    'positions': edit('positions', set_field({'position_id': 'FXP1'}, 'as_of_date', '10/07/2026',
                                             add('FXP8,FXACC0,FXSEC3,-10,1,2026-07-10,BOOK_OF_RECORD',
                                                 'FXP9,FXACC1,FXSEC3,20,2,2026-07-10,BOOK_OF_RECORD',
                                                 'FXP10,FXACC1,FXSEC2,999,2,2026-07-09,BOOK_OF_RECORD',
                                                 'FXP11,FXACC1,FXSEC2,999,2,not-a-date,BOOK_OF_RECORD'))),
    # The traced key at the custodian, a custodian row with quantity 0 (the custodian reports a flat position), the
    # blank-quantity key holding the same as the book, and a custodian row on the day before the snapshot.
    'comparison_positions': edit('comparison_positions', add('FXC8,FXACC0,FXSEC3,-10,2026-07-10,CUSTODIAN_FEED',
                                                             'FXC9,FXACC2,FXSEC2,0,2026-07-10,CUSTODIAN_FEED',
                                                             'FXC10,FXACC1,FXSEC3,20,2026-07-10,CUSTODIAN_FEED',
                                                             'FXC11,FXACC1,FXSEC2,999,2026-07-09,CUSTODIAN_FEED')),
    # USD rate on the snapshot is not 1 (the traced security is quoted in USD), and a USD rate that does not parse.
    'fx_rates': edit('fx_rates', set_field({'currency': 'USD', 'rate_date': '2026-07-10'}, 'rate_to_usd', '0.990000',
                                           add('USD,2026-07-08,n/a'))),
    # FXSEC1 on the snapshot: both quotes come from one vendor.
    'prices': edit('prices', set_field({'security_id': 'FXSEC1', 'price_date': '2026-07-10', 'vendor': 'FIXTURE_V2'},
                                       'vendor', 'FIXTURE_V1')),
    # The same fund + class + date written in the other date format, and a row with an unreadable date.
    'ledger_nav': edit('ledger_nav', add('FXL3,FXFUND1,A,1000000.00,10/07/2026,100000,10.000000',
                                         'FXL4,FXFUND1,C,200000.00,not-a-date,20000,10.000000')),
}
edit('manifest', lambda rows, fields: [{**row, 'rows': str(counts.get(row['table'], row['rows']))} for row in rows])
# R3 fixture: the edge fixture plus a negative BUY that is reversed by a negative REVERSED row (on a key only the
# trades hold). Under R3 the two rows cancel, so reading the sign as wrong must move the holding by 0.
dst, edge = 'tests/runs/fixture_r3', dst
shutil.rmtree(dst, ignore_errors=True)
shutil.copytree(edge, dst)
# Also, each on a key nothing else makes not evaluable: an R3 orphan (a REVERSED row pointing at an ID that does not
# exist), a REVERSED row with a blank quantity (the release's case), a CANCELLED row with a blank transaction_id (it
# must not turn every unlinked trade into its rebook), and a negative REVERSED row on the traced key that sorts first,
# so the trace follows a row the R3 chain offsets.
counts = {'transactions': edit('transactions', add(
    'FXT50,FXACC9,FXSEC3,FXCUSIP03,BUY,2026-06-22,2026-06-24,-10,5.00,USD,50.00,BOOKED,,FIXTURE_OMS,2026-06-22 09:00:00,',
    'FXT51,FXACC9,FXSEC3,FXCUSIP03,BUY,2026-06-22,2026-06-24,-10,5.00,USD,50.00,REVERSED,FXT50,FIXTURE_OMS,2026-06-22 10:00:00,',
    'FXT57,FXACC8,FXSEC3,FXCUSIP03,BUY,2026-06-22,2026-06-24,10,5.00,USD,50.00,BOOKED,,FIXTURE_OMS,2026-06-22 09:00:00,',
    'FXT58,FXACC8,FXSEC3,FXCUSIP03,BUY,2026-06-23,2026-06-25,5,5.00,USD,25.00,REVERSED,FXT98,FIXTURE_OMS,2026-06-23 10:00:00,',
    'FXT54,FXACC7,FXSEC3,FXCUSIP03,BUY,2026-06-22,2026-06-24,10,5.00,USD,50.00,BOOKED,,FIXTURE_OMS,2026-06-22 09:00:00,',
    'FXT55,FXACC7,FXSEC3,FXCUSIP03,BUY,2026-06-22,2026-06-24,,5.00,USD,50.00,REVERSED,FXT54,FIXTURE_OMS,2026-06-22 10:00:00,',
    ',FXACC7,FXSEC3,FXCUSIP03,BUY,2026-06-21,2026-06-23,3,5.00,USD,15.00,CANCELLED,,FIXTURE_OMS,2026-06-21 09:00:00,',
    'FXT29,FXACC0,FXSEC3,FXCUSIP03,BUY,2026-06-15,2026-06-17,-10,5.00,USD,50.00,REVERSED,FXT30,FIXTURE_OMS,2026-06-15 10:00:00,'))}
edit('manifest', lambda rows, fields: [{**row, 'rows': str(counts.get(row['table'], row['rows']))} for row in rows])
PY
python3 - <<'PY'
base = open('config/reconciliation.toml').read()
for old, new in [('reversed_main = "R1"', 'reversed_main = "R3"'), ('reversed_side = "R3"', 'reversed_side = "R1"')]:
    assert old in base, f'config has no line {old!r}'
    base = base.replace(old, new)
open('tests/runs/config_fixture_r3.toml', 'w').write(base)
PY
run() {  # $1 = label, $2 = config path or empty, $3 = notebook (default: notebook 02)
  rm -rf "$W/run_fixture_$1"
  RECONCILIATION_OUTPUTS="$W/run_fixture_$1" RECONCILIATION_CONFIG="$2" tests/run_notebook.sh ${3:-} | tail -1
}
run default ""
run shuffled "$W/config_fixture_shuffled.toml"
run settlement "$W/config_fixture_settlement.toml"
run notrace "$W/config_fixture_notrace.toml"
RECONCILIATION_DATA="$W/fixture_edge/manifest.csv" run edge ""
RECONCILIATION_DATA="$W/fixture_r3/manifest.csv" run r3 "$W/config_fixture_r3.toml" notebooks/03_error_severity.ipynb
RECONCILIATION_DATA="$W/fixture_r3/manifest.csv" run r3default ""
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
gross_note = trace.loc[trace['field'] == 'gross_amount / price', 'note'].str.cat()
expect('gross_amount fits the size -> trace says it confirms the size and states both readings', True,
       'confirms the size' in gross_note and 'wrong sign' in gross_note and 'wrong type' in gross_note)

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

# Edge fixture (built above): cases a schema-compatible file may hold.
trace = read('edge', '02_trace.csv')
value = lambda field: trace.loc[trace['field'] == field, 'value'].tolist()
expect('edge: traced key on an account missing from accounts, no pipeline record -> trace written', ['FXT30'],
       trace.loc[(trace['hop'] == 'source') & (trace['field'] == 'transaction_id'), 'value'].tolist())
expect('edge: trace says the account is not in accounts', True,
       bool(((trace['table'] == 'accounts') & (trace['value'] == 'not in accounts')).any()))
expect('edge: trace counts 0 pipeline records', ['0'], value('pipeline records for this transaction_id'))
expect('edge: gross_amount fits neither sign -> trace does not say gross_amount confirms the size', False,
       bool(trace.loc[trace['field'] == 'gross_amount / price', 'note'].str.contains('confirms the size').any()))
expect('edge: USD-quoted security -> no FX rate applied (20 units x 5.00)', ['100.0'], value('indicative exposure (USD)'))
register = read('edge', '02_defect_register.csv').set_index('finding')
line = lambda name, column: register[column].get(name)
expect('edge: negative quantities -> the register states how many fit gross_amount', True,
       'gross_amount fits the absolute value on 1 of 2' in str(line('Negative trade quantity', 'how detected')))
expect('edge: a REVERSED row delivered twice, and unlinked REVERSED rows -> not "more than one per original"', '4',
       line('More than one REVERSED row per original', 'affected'))
summary = read('edge', '02_three_way_summary.csv')
bvc = summary[summary['comparison'] == 'book vs custodian'].set_index('group or pattern')['keys']
expect('edge: book row dated DD/MM/YYYY -> still matched with the custodian', '0', bvc.get('only in positions'))
waterfall = read('edge', '02_waterfall.csv')
expect('edge: book row dated DD/MM/YYYY -> still matched with the rebuild', ['0'],
       waterfall.loc[(waterfall['code'] == 'C7') & (waterfall['compared with'] == 'positions'), 'only in reported table'].tolist())
nav = read('edge', '02_nav_check.csv').set_index('ledger_id')
expect('edge: same fund + class + date in two formats -> both rows repeated', ['FXL1', 'FXL3'],
       sorted(nav.index[nav['repeated key'] == 'True']))
expect('edge: unreadable as_of_date -> not evaluable', 'not evaluable', nav.loc['FXL4', 'result'])
vendor = read('edge', '02_vendor_check.csv').set_index('security_id')
expect('edge: two quotes from one vendor -> not evaluable, not a spread', True,
       'not evaluable' in vendor.loc['FXSEC1', 'result'])
expect('edge: the custodian reports a zero row -> closed positions not cleared', 'unresolved',
       line('Closed position not reported (trades net to zero, absent from book and custodian)', 'status'))
blank = read('edge', '02_blank_quantity.csv').set_index('measure')['count']
expect('edge: blank quantity with gross_amount / price = 10 units -> derivable; a linked blank -> held', ('1', '1'),
       (blank['derivable: whole number of units, no link to another trade'], blank['held: linked to another trade']))
expect('edge: book holds the key without the derived units -> "book leaves out the units"', ('1', 'FXACC1/FXSEC3'),
       (line('Book leaves out the units of trades with a blank quantity', 'affected'),
        line('Book leaves out the units of trades with a blank quantity', 'examples')))
ledger = read('edge', '02_row_ledger.csv').set_index('step')
set_aside = lambda step: int(ledger.loc[step, 'rows in']) - int(ledger.loc[step, 'rows out'])
expect('edge: book and custodian rows on another day, and a book row with an unreadable date -> set aside, counted',
       (1, 1, 1, 0), (set_aside('positions: rows dated another day set aside'),
                       set_aside('positions: rows with an unreadable as_of_date set aside'),
                       set_aside('comparison_positions: rows dated another day set aside'),
                       set_aside('comparison_positions: rows with an unreadable as_of_date set aside')))
rebook = 'Rebook changes the quantity but keeps the cancelled gross_amount'
expect('edge: rebook of a CANCELLED trade delivered with two quantities -> not evaluable, never flagged',
       (False, '1'), ('FXT61' in str(line(rebook, 'examples')), line(rebook, 'not evaluable')))
usd = 'USD rate to USD is not 1'
expect('edge: a USD rate that does not parse -> not evaluable, not "not 1"', ('1', '1'),
       (line(usd, 'affected'), line(usd, 'not evaluable')))
patterns = [*read('edge', '02_break_classes.csv')['pattern'], *read('r3', '02_break_classes.csv')['pattern'],
            *read('edge', '02_reversed_side_view.csv').iloc[:, :2].stack(), *read('r3', '02_reversed_side_view.csv').iloc[:, :2].stack(),
            *read('r3default', '02_reversed_side_view.csv').iloc[:, :2].stack()]
expect('edge and R3 runs: every not-evaluable key names its cause (no "not evaluable: other")', [],
       sorted({p for p in patterns if 'other' in p}))
expect('R3 main reading: an orphan REVERSED row on a clean key -> named as its cause', True,
       'not evaluable: REVERSED row with nothing to offset' in set(read('r3', '02_break_classes.csv')['pattern']))
side_view = read('r3default', '02_reversed_side_view.csv')
expect('R3 side view: a REVERSED row with a blank quantity on a clean key -> "blank quantity", from the side chain', True,
       'not evaluable: blank quantity' in set(side_view.iloc[:, 1]))
rebook_population = lambda run: read(run, '02_defect_register.csv').set_index('finding').loc[rebook, 'population']
expect('a CANCELLED row with a blank transaction_id -> no unlinked trade becomes its rebook',
       rebook_population('edge'), rebook_population('r3default'))
trace_r3 = read('r3', '02_trace.csv')
expect('R3 trace on a negative REVERSED row -> wrong-sign value uses what the chain used (+10 offset): 0 - 2 x 10',
       (['FXT29'], ['-20.0']),
       (trace_r3.loc[(trace_r3['hop'] == 'source') & (trace_r3['field'] == 'transaction_id'), 'value'].tolist(),
        trace_r3.loc[trace_r3['field'] == 'quantity under the wrong-sign reading', 'value'].tolist()))
impact = read('r3', '03_impact_detail.csv')
reversed_negative = impact[(impact['account_id'] == 'FXACC9') & impact['scenario'].str.contains('wrong-sign')]
expect('R3 run, notebook 03: a negative BUY and its negative reversal -> wrong-sign scenario moves 0 units', [0.0],
       reversed_negative['delta_units'].astype(float).tolist())
import json, re
cells = json.load(open('notebooks/02_reconcile.ipynb'))['cells']
pattern = re.search(r"re\.findall\(r'(.+?)', source_text\)", ''.join(''.join(c['source']) for c in cells)).group(1)
expect('literal-ID self-check covers every ID prefix in the release', [],
       [i for i in ['ACC1000001', 'SEC100001', 'TXN100000001', 'CA00001', 'FND00001', 'LDG000001', 'POS000000001',
                    'CMP000000001'] if not re.fullmatch(pattern, i)])
copies = read('default', '02_duplicate_profile.csv').set_index('measure')
expect('fixture book counts the copied SELL once -> profile says transaction_count counts each copy once',
       ('0', 'counts each copy once: 1'),
       (copies.loc['of the book positions holding a copy: transaction_count counts both copies', 'count'],
        copies.loc['of the book positions holding a copy: transaction_count counts both copies', 'note']))

width = max(len(r[0]) for r in results)
for what, expected, observed, ok in results:
    print(f"{'PASS' if ok else 'FAIL'}  {what:<{width}}  expected {expected!r}, observed {observed!r}")
assert all(r[3] for r in results), 'fixture outcomes differ from what the fixture was built to contain'
print(f'fixture test passed: {len(results)} expected outcomes observed')
PY
