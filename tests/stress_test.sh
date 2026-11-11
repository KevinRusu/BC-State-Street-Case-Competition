#!/usr/bin/env bash
# Stress test of the price scale rule (spec docs/superpowers/specs/2026-11-11-stress-test-design.md, §5.8): run the
# deliverable notebook as delivered on the clean data, draw a seeded sample of held equities, inject 100x snapshot
# prices (defects, look-alikes, priority flips) into a copy of the data in tests/runs/stress_data, run the notebook
# again on the copy, and score every case. Run outputs go to tests/runs/stress_clean and tests/runs/stress_injected,
# never to outputs/02_*; the scores go to $STRESS_OUTPUTS/03_stress_*.csv. Exit status is the score step's: non-zero
# on any change on an untouched security or any change no case explains (misses and partials are results, not failures).
# Honours RECONCILIATION_CONFIG, SCORECARD_CONFIG, RECONCILIATION_DATA (default manifest.csv) and STRESS_OUTPUTS
# (default outputs). Takes about 7 minutes on the full release (two deliverable runs).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
W=tests/runs
mkdir -p "$W"
CONFIG=${RECONCILIATION_CONFIG:-config/reconciliation.toml}
DATA=${RECONCILIATION_DATA:-manifest.csv}
STRESS_OUTPUTS=${STRESS_OUTPUTS:-outputs}
export RECONCILIATION_CONFIG="$CONFIG"
# A failed run must not leave the last run's scores behind for build_findings to render as current.
rm -f "$STRESS_OUTPUTS"/03_stress_*.csv
start=$(date +%s)
elapsed() { echo "  ($(( $(date +%s) - start ))s elapsed)"; }

echo "1/4 clean run of the deliverable -> $W/stress_clean"
rm -rf "$W/stress_clean"
RECONCILIATION_DATA="$DATA" RECONCILIATION_OUTPUTS="$W/stress_clean" tests/run_notebook.sh
elapsed

echo "2/4 draw the sample and build the injected copy -> $W/stress_data"
rm -rf "$W/stress_data"
uv run --quiet python scripts/stress.py build --manifest "$DATA" --clean "$W/stress_clean" --out "$W/stress_data" \
  --config "$CONFIG"
elapsed

echo "3/4 injected run of the deliverable -> $W/stress_injected"
rm -rf "$W/stress_injected"
RECONCILIATION_DATA="$W/stress_data/manifest.csv" RECONCILIATION_OUTPUTS="$W/stress_injected" tests/run_notebook.sh
elapsed

echo "4/4 score -> $STRESS_OUTPUTS/03_stress_*.csv"
status=0
uv run --quiet python scripts/stress.py score --clean "$W/stress_clean" --injected "$W/stress_injected" \
  --work "$W/stress_data" --outputs "$STRESS_OUTPUTS" --config "$CONFIG" \
  --manifest "$DATA" || status=$?
elapsed
echo "stress test finished with exit status $status in $(( $(date +%s) - start ))s"
exit $status
