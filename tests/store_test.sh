#!/usr/bin/env bash
# Build the dashboard's store from the made-up fixture (tests/fixtures/small) and test it: the store's tables here,
# the trace logic with vitest in dashboard/, then a production build of the app (type check; reads no store).
# Everything goes to tests/runs/store_fixture, never to outputs/. Stop `npm run dev` first: the build shares
# dashboard/.next. Needs `npm install` in dashboard/ once.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
W=tests/runs/store_fixture
rm -rf "$W"
mkdir -p "$W"
export RECONCILIATION_DATA=tests/fixtures/small/manifest.csv
export RECONCILIATION_OUTPUTS=$W
export STORE_PATH=$W/store.duckdb          # relative on purpose: the builder and the app both start at the repo root

tests/run_notebook.sh                       # the deliverable notebook on the fixture: the register the store copies
uv run --quiet python tests/stress_fixture.py "$W"   # made-up stress files: the fixture has no stress run
uv run --quiet python scripts/build_store.py > "$W/build_store.log"
uv run --quiet python - <<'PY'
import os, duckdb
con = duckdb.connect(os.environ['STORE_PATH'], read_only=True)
def one(sql):
    return con.sql(sql).fetchone()
assert one("SELECT count(*) FROM map_nodes WHERE rows <> manifest_rows")[0] == 0, 'a table lost rows'
assert one("SELECT status, repeated_keys FROM join_health WHERE join_id = 'pipeline_txn' AND side = 'left'") == ('fan_out', 1)
assert one("SELECT orphan_keys, orphan_rows, sample_orphans FROM join_health "
           "WHERE join_id = 'price_fx' AND side = 'left'") == (1, 2, 'EUR/2026-07-09'), 'date normalisation'
assert one("SELECT count(*) FROM join_health WHERE join_id = 'book_custodian' AND status <> 'ok'")[0] == 0
assert one("SELECT count(*) FROM register")[0] > 0, 'no register copied'
assert one("SELECT count(*) FROM demo_traces")[0] > 0, 'no demo traces'
# The map's grid, who handles each table, where its data comes from, and one place per register line.
assert one("SELECT count(*) FROM map_offices")[0] == 4
assert one("SELECT count(*) FROM map_stages")[0] == 4
assert one("SELECT count(*) FROM map_nodes WHERE owner = '' OR place = ''")[0] == 0
assert one("SELECT place FROM map_nodes WHERE id = 'transactions'")[0] == 'Front + middle office · Transactions'
assert one("SELECT place FROM map_nodes WHERE id = 'prices'")[0] == 'Independent source · checked by the middle office'
assert one("SELECT office FROM map_nodes WHERE id = 'corporate_actions'")[0] == 'middle'
assert one("SELECT label, source_values FROM map_sources WHERE node_id = 'transactions'") == ('1 trade system', 'FIXTURE_OMS')
assert one("SELECT label, source_values FROM map_sources WHERE node_id = 'prices'") == ('2 price vendors', 'FIXTURE_V1; FIXTURE_V2')
assert one("SELECT label, source_values FROM map_sources WHERE node_id = 'comparison_positions'") == ('custodian feed', 'CUSTODIAN_FEED')
assert one("SELECT evidence, source_values FROM map_sources WHERE node_id = 'accounts'") == ('reasoning', '')
assert one("SELECT count(*) FROM map_edges WHERE handoff IS NOT NULL AND owner = ''")[0] == 0
assert one("SELECT count(*) FROM register WHERE map_id = ''")[0] == 0, 'a register line has no place on the map'
# "Trace an example" links only an ID the trace can open: never a currency (the fixture lists EUR as one).
assert one("SELECT count(*) FROM register WHERE id_kind = 'currency' AND examples <> ''")[0] > 0, 'fixture lost its currency example'
assert one("SELECT count(*) FROM register WHERE id_kind = 'currency' AND trace_example <> ''")[0] == 0, \
    'a currency finding links a trace'
assert one("SELECT trace_example FROM register WHERE finding = 'Negative trade quantity'")[0] == 'FXT03'
assert one("SELECT count(*) FROM rule_catalog WHERE contains(test || on_fail || note, '\\')")[0] == 0, \
    'a Markdown escape (\\|) split a rule cell'
import sys; sys.path.insert(0, 'scripts')
from build_store import source_label, table_cells
assert source_label('{n} trade system{s}', []) is None, 'a blank source column must drop the chip'
assert source_label('{n} trade system{s}', ['A', 'B']) == '2 trade systems'
assert source_label('custodian feed', ['CUSTODIAN_FEED']) == 'custodian feed'
assert table_cells(r' \|a − b\| ≤ 0.01 | reject | note ') == ['|a − b| ≤ 0.01', 'reject', 'note'], 'escaped pipes'
# The graph check refuses edits that would hide a finding, show the wrong owner or drop a line from the map.
import copy, build_store
def rejected(change):
    graph = copy.deepcopy(build_store.GRAPH)
    change({e['id']: e for e in graph['edges']})
    try:
        build_store.check_graph(build_store.rule_catalog(), build_store.load_framework(), graph)
    except AssertionError:
        return True
    return False
def move_to_lookup(edges):
    edges['price_check']['rules'].remove('PRC_QUOTE_ELIGIBLE')
    edges['price_security']['rules'].append('PRC_QUOTE_ELIGIBLE')
assert not rejected(lambda edges: None)
assert rejected(move_to_lookup), 'a finding counted on a hidden lookup line'
assert rejected(lambda edges: edges['nav_check'].update(check='Account check')), 'check does not match its handoff'
assert rejected(lambda edges: edges['account_check'].update(to_handle='tpo')), 'unknown handle'
assert rejected(lambda edges: edges['booking'].update(tag_at=5)), 'tag outside its line'
def wrong_section(edges):
    edges['position_check']['rules'].remove('POS_CUSTODIAN_BREAK')
    edges['price_check']['rules'].append('POS_CUSTODIAN_BREAK')
assert rejected(wrong_section), "a handoff carries a rule from another check's section of docs/RULES.md"
# Every record a register line counts is in the store, not only its two or three examples (the trace reads them all).
assert one("SELECT count(*) FROM register_members")[0] > one("SELECT count(*) FROM register_examples")[0]
assert one("SELECT count(*) FROM register_examples e ANTI JOIN register_members m USING (line, record_id)")[0] == 0
assert one("SELECT count(*) FROM register_members WHERE line = (SELECT line FROM register "
           "WHERE finding = 'More than one REVERSED row per original')")[0] == 4
assert one("SELECT member_source FROM store_info")[0] == 'members'
assert not os.path.isabs(one("SELECT register_path FROM store_info")[0]), 'a store copied elsewhere must still find it'
# Plain wording (scripts/plain_language.json): every line, place and demo carries it; status phrases sit in plain_text.
assert one("SELECT count(*) FROM register WHERE coalesce(plain, '') = ''")[0] == 0, 'a register line has no plain text'
assert one("SELECT plain <> finding FROM register WHERE finding = 'Negative trade quantity'")[0], 'finding not worded'
assert one("SELECT count(*) FROM map_nodes WHERE coalesce(plain, '') = ''")[0] == 0
assert one("SELECT count(*) FROM map_edges WHERE coalesce(plain, '') = ''")[0] == 0
assert one("SELECT count(*) FROM plain_text WHERE kind = 'status'")[0] == 4
assert one("SELECT count(*) FROM demo_traces WHERE coalesce(stage, '') = ''")[0] == 0, 'a demo trace has no stage'
padded = duckdb.connect()
padded.sql("CREATE TABLE t AS SELECT * FROM (VALUES ('  '), ('OMS '), ('OMS'), (NULL)) v(c)")
assert build_store.distinct_values(padded, 't', 'c') == ['OMS'], 'blank and padded source labels'
# The scorecard tables (D-069): each exists with its CSV's row count and column names; counts and scores are numbers.
import csv
from build_store import SCORECARD_TABLES
for table, (file_name, numeric) in SCORECARD_TABLES.items():
    with open(os.path.join(os.environ['RECONCILIATION_OUTPUTS'], file_name), newline='', encoding='utf-8') as stream:
        rows = list(csv.reader(stream))
    header = rows[0]
    got = [r[0] for r in con.sql(f'DESCRIBE "{table}"').fetchall()]
    assert got == header, f'{table}: columns {got} differ from {file_name}'
    assert one(f'SELECT count(*) FROM "{table}"')[0] == len(rows) - 1, f'{table}: row count differs from {file_name}'
    types = dict((r[0], r[1]) for r in con.sql(f'DESCRIBE "{table}"').fetchall())
    assert all(types[c] == 'DOUBLE' for c in numeric), f'{table}: a count or score column is not DOUBLE'
    assert all(types[c] == 'VARCHAR' for c in header if c not in numeric), f'{table}: a text column is not VARCHAR'
assert one("SELECT count(*) FROM scorecard WHERE level = 'platform'")[0] == 1
assert one("SELECT count(*) FROM kpis")[0] == 7
# Fixed columns: an indicator's unit is text right after its value; the sensitivity tie count is a number right after
# worst_n_kept, filled on the accounts rows only.
described = lambda t: [(r[0], r[1]) for r in con.sql(f'DESCRIBE "{t}"').fetchall()]
names = [c for c, _ in described('indicators')]
assert names[names.index('value') + 1] == 'unit' and dict(described('indicators'))['unit'] == 'VARCHAR'
assert one("SELECT count(*) FROM indicators WHERE coalesce(unit, '') = ''")[0] == 0, 'an indicator without a unit'
names = [c for c, _ in described('scorecard_sensitivity')]
assert names[names.index('worst_n_kept') + 1] == 'ties_at_cutoff'
assert dict(described('scorecard_sensitivity'))['ties_at_cutoff'] == 'DOUBLE'
assert one("SELECT count(*) FROM scorecard_sensitivity WHERE (level = 'accounts') <> (ties_at_cutoff IS NOT NULL)")[0] == 0
print('scorecard tables OK')
# The executive view's tables: dollar impact, each account's records and the stress test (its files here are made up
# by tests/stress_fixture.py). Each has its CSV's columns and rows; the listed columns are numbers, a blank stays NULL.
from build_store import EXECUTIVE_TABLES
for table, (file_name, numeric) in EXECUTIVE_TABLES.items():
    path = os.path.join(os.environ['RECONCILIATION_OUTPUTS'], file_name)   # stress files: tests/stress_fixture.py
    got = [r[0] for r in con.sql(f'DESCRIBE "{table}"').fetchall()]
    with open(path, newline='', encoding='utf-8') as stream:
        rows = list(csv.reader(stream))
    assert got == rows[0], f'{table}: columns differ from {file_name}'
    assert one(f'SELECT count(*) FROM "{table}"')[0] == len(rows) - 1, f'{table}: row count differs'
    types = dict((r[0], r[1]) for r in con.sql(f'DESCRIBE "{table}"').fetchall())
    assert all(types[c] == ('DOUBLE' if c in numeric else 'VARCHAR') for c in rows[0]), f'{table}: column types'
assert one("SELECT count(*) FROM severity WHERE gross_delta_usd_valued_subset IS NULL")[0] > 0, \
    'a scenario with nothing valued must stay NULL, not 0'
scored = {r[0] for r in con.sql("SELECT DISTINCT rule FROM scorecard WHERE level = 'rule'").fetchall()}
named = {r[0] for r in con.sql("SELECT key FROM plain_text WHERE kind = 'rule' AND coalesce(text, '') <> ''").fetchall()}
assert scored == named, f'plain rule names: missing {sorted(scored - named)}, unknown {sorted(named - scored)}'
print('executive tables OK')
print('store checks OK')
PY
# Without a register the store still builds: the map simply has no counts.
E=tests/runs/store_noregister
rm -rf "$E" && mkdir -p "$E"
RECONCILIATION_OUTPUTS=$E STORE_PATH=$PWD/$E/store.duckdb uv run --quiet python scripts/build_store.py > "$E/build_store.log"
grep -q 'map without rule counts' "$E/build_store.log"
uv run --quiet python -c "
import duckdb
c = duckdb.connect('$E/store.duckdb', read_only=True)
n = lambda t: c.sql(f'SELECT count(*) FROM {t}').fetchone()[0]
assert n('register') == 0 and n('map_offices') == 4 and n('map_sources') > 0 and n('map_edges') > 0
assert c.sql(\"SELECT count(*) FROM plain_text WHERE kind = 'status'\").fetchone()[0] == 4, 'plain_text without a register'
for t in ['severity', 'impact_detail', 'account_outcomes', 'stress_rates', 'stress_impact', 'stress_run']:
    assert [r[0] for r in c.sql(f'DESCRIBE {t}').fetchall()] == ['note'], f'{t}: a missing file must give the note table'
print('no-register build OK')"
# A register without its member list (an older notebook run), and a member list from another run: the store falls
# back to the register's examples and says so, rather than failing or claiming every record is marked.
for case in missing foreign; do
  E=tests/runs/store_members_$case
  rm -rf "$E" && mkdir -p "$E"
  cp "$W/02_defect_register.csv" "$W/02_trace.csv" "$E/"
  [ "$case" = foreign ] && printf 'finding,record_id\nA finding from another run,TXN0\n' > "$E/02_finding_members.csv"
  RECONCILIATION_OUTPUTS=$E STORE_PATH=$PWD/$E/store.duckdb uv run --quiet python scripts/build_store.py > "$E/build_store.log"
  uv run --quiet python -c "
import duckdb
c = duckdb.connect('$E/store.duckdb', read_only=True)
one = lambda sql: c.sql(sql).fetchone()[0]
assert one('SELECT member_source FROM store_info') == 'examples', '$case: should fall back to examples'
assert one('SELECT count(*) FROM register_members') == one('SELECT count(*) FROM register_examples')
print('member list $case: falls back to examples OK')"
done
(cd dashboard && npm test --silent && npm run build --silent > "../$W/next_build.log" && echo 'next build OK')
