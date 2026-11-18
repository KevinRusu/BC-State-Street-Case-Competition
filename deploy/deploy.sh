#!/usr/bin/env bash
# One command for hosting the dashboard on Google Cloud Run (design docs/superpowers/specs/2026-11-17-cloud-run-hosting-design.md).
#
#   deploy/deploy.sh setup   once: APIs, image repository, upload bucket, password secret (the password is printed once)
#   deploy/deploy.sh         each deploy: checks, build, deploy, live check, roll back on a failed check
#
# Settings come from config/hosting.toml (read by deploy/read_config.py). Sourcing this file defines the functions only,
# so tests/hosting_test.sh can replace the readiness checks and gcloud.
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

STORE_FILE=outputs/store.duckdb
REGISTER_FILE=outputs/02_defect_register.csv

load_config() {
  local cfg
  cfg=$(uv run --quiet python deploy/read_config.py) || exit 1
  eval "$cfg"
}

not_visible_message() {
  echo "Your gcloud account cannot see project $PROJECT: check config/hosting.toml or gcloud auth login."
}

# Readiness checks: small so the tests can replace them.
current_branch() { git rev-parse --abbrev-ref HEAD; }
tree_is_clean() { [ -z "$(git status --porcelain)" ]; }
gcloud_account() { gcloud config get account 2>/dev/null || true; }
project_visible() { gcloud projects describe "$PROJECT" > /dev/null 2>&1; }
secret_exists() { gcloud secrets describe "$SECRET" --project "$PROJECT" > /dev/null 2>&1; }

# The serving revision's name, or an empty string when nothing serves (first deploy).
previous_revision() {
  gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT" \
    --format 'value(status.traffic[0].revisionName)' 2> /dev/null || true
}

# ---------------------------------------------------------------------------------------------------------------------
setup_main() {
  local tmp number account password acct
  load_config
  acct=$(gcloud_account)
  [ -n "$acct" ] || { echo "No gcloud account: run gcloud auth login first."; exit 1; }
  project_visible || { not_visible_message; exit 1; }
  tmp=$(mktemp -d)
  SETUP_TMP=$tmp # a global: the EXIT trap runs after this function has returned
  trap 'rm -rf "${SETUP_TMP:-}"' EXIT

  # compute: Cloud Run and Cloud Build run as the Compute Engine default service account, which exists only once the
  # Compute Engine API is on; the secret binding at the end of setup needs it.
  echo "setup: enabling the APIs"
  gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
    secretmanager.googleapis.com compute.googleapis.com --project "$PROJECT"

  if gcloud artifacts repositories describe "$REPOSITORY" --location "$REGION" --project "$PROJECT" > /dev/null 2>&1; then
    echo "setup: repository $REPOSITORY exists"
  else
    echo "setup: creating repository $REPOSITORY in $REGION"
    gcloud artifacts repositories create "$REPOSITORY" --repository-format docker --location "$REGION" \
      --project "$PROJECT"
  fi
  cat > "$tmp/cleanup.json" <<JSON
[
  {"name": "keep-newest", "action": {"type": "Keep"}, "mostRecentVersions": {"keepCount": $KEEP_IMAGES}},
  {"name": "delete-the-rest", "action": {"type": "Delete"}, "condition": {"tagState": "any"}}
]
JSON
  gcloud artifacts repositories set-cleanup-policies "$REPOSITORY" --location "$REGION" --project "$PROJECT" \
    --policy "$tmp/cleanup.json" --no-dry-run

  if gcloud storage buckets describe "gs://$BUCKET" --project "$PROJECT" > /dev/null 2>&1; then
    echo "setup: bucket gs://$BUCKET exists"
  else
    echo "setup: creating bucket gs://$BUCKET in $REGION"
    gcloud storage buckets create "gs://$BUCKET" --location "$REGION" --project "$PROJECT" \
      --uniform-bucket-level-access --public-access-prevention
  fi
  printf '{"rule": [{"action": {"type": "Delete"}, "condition": {"age": 1}}]}\n' > "$tmp/lifecycle.json"
  gcloud storage buckets update "gs://$BUCKET" --project "$PROJECT" --lifecycle-file "$tmp/lifecycle.json"

  if secret_exists; then
    echo "setup: secret $SECRET exists (the password is unchanged)"
  else
    echo "setup: creating secret $SECRET"
    password=$(uv run --quiet python -c '
import re, secrets
words = [w for w in open("/usr/share/dict/words").read().split() if re.fullmatch(r"[a-z]{4,8}", w)]
print("-".join(secrets.choice(words) for _ in range(5)))')
    printf '%s' "$password" | gcloud secrets create "$SECRET" --project "$PROJECT" \
      --replication-policy user-managed --locations "$REGION" --data-file -
    echo
    echo "The dashboard password (share it in a separate message from the link; it is not saved anywhere else):"
    echo "  $password"
    echo
  fi

  number=$(gcloud projects describe "$PROJECT" --format 'value(projectNumber)')
  account="$number-compute@developer.gserviceaccount.com"
  gcloud secrets add-iam-policy-binding "$SECRET" --project "$PROJECT" \
    --member "serviceAccount:$account" --role roles/secretmanager.secretAccessor > /dev/null
  rm -rf "$tmp"
  echo "setup: done. Next: deploy/deploy.sh"
}

# The live check; a function so the tests can replace it.
live_check() { EXPECT_COMMIT=$2 deploy/check-live.sh "$1"; }

# ---------------------------------------------------------------------------------------------------------------------
deploy_main() {
  local problems="" commit image prev url acct
  load_config

  refuse() { problems="$problems$1"$'\n'; }
  [ "$(current_branch)" = main ] || refuse "Not on the main branch: switch to main (git switch main)."
  tree_is_clean || refuse "There are uncommitted changes: commit or stash them first."
  acct=$(gcloud_account)
  [ -n "$acct" ] || refuse "No gcloud account: run gcloud auth login."
  [ -f "$STORE_FILE" ] || refuse "outputs/store.duckdb is missing: run uv run python scripts/build_store.py."
  [ -f "$REGISTER_FILE" ] || refuse "outputs/02_defect_register.csv is missing: run tests/run_notebook.sh."
  if [ -f "$STORE_FILE" ] && [ -f "$REGISTER_FILE" ] && [ "$STORE_FILE" -ot "$REGISTER_FILE" ]; then
    refuse "outputs/store.duckdb is older than outputs/02_defect_register.csv: run uv run python scripts/build_store.py."
  fi
  # The project and the secret only with an account: without one both would fail for the same reason.
  if [ -n "$acct" ]; then
    if ! project_visible; then
      refuse "$(not_visible_message)"
    elif ! secret_exists; then
      refuse "The secret $SECRET does not exist: run deploy/deploy.sh setup first."
    fi
  fi
  if [ -n "$problems" ]; then
    printf '%s' "$problems"
    echo "Not deploying."
    exit 1
  fi

  gcloud meta list-files-for-upload | deploy/check-upload.sh || { echo "The upload list breaks the allow-list. Not deploying."; exit 1; }

  commit=$(git rev-parse --short HEAD)
  image="$REGION-docker.pkg.dev/$PROJECT/$REPOSITORY/$SERVICE:$commit"
  prev=$(previous_revision)

  gcloud builds submit . --project "$PROJECT" --region "$REGION" --config deploy/cloudbuild.yaml \
    --substitutions "_IMAGE=$image,_COMMIT=$commit" --gcs-source-staging-dir "gs://$BUCKET/source"

  gcloud run deploy "$SERVICE" --project "$PROJECT" --image "$image" --region "$REGION" --memory "$MEMORY" \
    --cpu "$CPU" --max-instances "$MAX_INSTANCES" --min-instances "$MIN_INSTANCES" --concurrency "$CONCURRENCY" \
    --port 8080 --allow-unauthenticated --set-secrets "DASHBOARD_PASSWORD=$SECRET:latest"

  # After a rollback traffic is pinned to a named revision; a new revision gets none until it is sent back to latest.
  gcloud run services update-traffic "$SERVICE" --project "$PROJECT" --region "$REGION" --to-latest

  url=$(gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format 'value(status.url)')
  if ! live_check "$url" "$commit"; then
    echo "The live check failed."
    if [ -n "$prev" ]; then
      gcloud run services update-traffic "$SERVICE" --project "$PROJECT" --region "$REGION" --to-revisions "$prev=100"
      echo "Traffic is back on the earlier version ($prev)."
    else
      # The first deploy: no earlier version to go back to, so close the site rather than leave a failed one public.
      echo "This was the first deploy: there is no earlier version to go back to."
      if gcloud run services remove-iam-policy-binding "$SERVICE" --region "$REGION" --project "$PROJECT" \
          --member allUsers --role roles/run.invoker > /dev/null; then
        echo "The site is now closed to everyone (no public access). The next deploy/deploy.sh opens it again."
      else
        echo "Could not close the site: delete the service (deploy/README.md, Taking it down)."
      fi
    fi
    exit 1
  fi

  echo
  echo "Live: $url"
  echo "Commit: $commit"
  echo "Store file time: $(date -r "$STORE_FILE" '+%Y-%m-%d %H:%M')"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  case "${1:-deploy}" in
    setup) setup_main ;;
    deploy) deploy_main ;;
    *) echo "usage: deploy/deploy.sh [setup]" >&2; exit 2 ;;
  esac
fi
