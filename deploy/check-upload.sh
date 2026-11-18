#!/usr/bin/env bash
# The upload allow-list, as a check: reads one path per line on stdin (relative to the repo root, as
# `gcloud meta list-files-for-upload` prints them), prints "not allowed: <path>" for every path outside the list and
# "missing: <path>" for each of the two data files the image needs, and exits 1 if anything was printed.
#
#   gcloud meta list-files-for-upload | deploy/check-upload.sh
#
# Allowed: dashboard/ (minus installed packages, builds, test output, local env and other generated files),
# outputs/store.duckdb, outputs/02_defect_register.csv, deploy/Dockerfile, deploy/Dockerfile.dockerignore,
# deploy/cloudbuild.yaml and .gcloudignore. The same list is written in .gcloudignore and deploy/Dockerfile.dockerignore;
# change all three together (tests/hosting_test.sh upload).
set -euo pipefail
cd "$(cd "$(dirname "$0")/.." && pwd)"

allowed() {
  case $1 in
    # No "." or ".." step anywhere, no absolute path, no empty step.
    /*|./*|../*|*/./*|*/../*|*/.|*/..|.|..|*//*) return 1 ;;
    .gcloudignore|deploy/Dockerfile|deploy/Dockerfile.dockerignore|deploy/cloudbuild.yaml) return 0 ;;
    outputs/store.duckdb|outputs/02_defect_register.csv) return 0 ;;
    # Generated or local files inside dashboard/: refused.
    dashboard/node_modules|dashboard/node_modules/*|*/node_modules/*) return 1 ;;
    dashboard/.next*) return 1 ;;
    dashboard/test-results|dashboard/test-results/*|dashboard/playwright-report|dashboard/playwright-report/*) return 1 ;;
    dashboard/coverage|dashboard/coverage/*|dashboard/out|dashboard/out/*|dashboard/build|dashboard/build/*) return 1 ;;
    dashboard/.vercel|dashboard/.vercel/*|dashboard/.pnp*|dashboard/.yarn|dashboard/.yarn/*) return 1 ;;
    dashboard/next-env.d.ts|*.tsbuildinfo|*.log|*.pem|*/.DS_Store|*/.env*) return 1 ;;
    dashboard/*) return 0 ;;
    *) return 1 ;;
  esac
}

bad=0
seen_store=0
seen_register=0
while IFS= read -r path || [ -n "$path" ]; do
  path=${path%$'\r'}
  [ -n "$path" ] || continue
  case $path in
    outputs/store.duckdb) seen_store=1 ;;
    outputs/02_defect_register.csv) seen_register=1 ;;
  esac
  if ! allowed "$path"; then
    echo "not allowed: $path"
    bad=1
  fi
done
[ "$seen_store" = 1 ] || { echo "missing: outputs/store.duckdb"; bad=1; }
[ "$seen_register" = 1 ] || { echo "missing: outputs/02_defect_register.csv"; bad=1; }

if [ "$bad" = 1 ]; then
  echo "upload refused: fix .gcloudignore (and deploy/Dockerfile.dockerignore) or build the missing files" >&2
  exit 1
fi
