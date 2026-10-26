#!/usr/bin/env bash
# Execute notebooks/02_reconcile.ipynb headless as committed (no rebuild); exit non-zero if any cell raised.
# Honours RECONCILIATION_CONFIG / RECONCILIATION_DATA / RECONCILIATION_OUTPUTS (see the notebook's first cell).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
W=tests/runs
mkdir -p $W
start=$(date +%s)
uv run --quiet jupyter nbconvert --to notebook --execute --allow-errors notebooks/02_reconcile.ipynb \
  --output-dir $W --output executed.ipynb --ExecutePreprocessor.timeout=1800 > $W/nbconvert.log 2>&1
uv run --quiet python - "$(( $(date +%s) - start ))" <<'PY'
import json, sys
nb = json.load(open('tests/runs/executed.ipynb'))
for c in nb['cells']:
    for o in c.get('outputs', []):
        if o.get('output_type') == 'error':
            print('FAILED CELL:', ''.join(c['source'])[:400])
            print(o['ename'], ':', o['evalue'][:2000])
            sys.exit(1)
print(f'notebook executed OK in {sys.argv[1]}s')
PY
