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
export STORE_PATH=$PWD/$W/store.duckdb

tests/run_notebook.sh                       # notebook 02 on the fixture: the register the store copies
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
print('store checks OK')
PY
(cd dashboard && npm test --silent && npm run build --silent > "../$W/next_build.log" && echo 'next build OK')
