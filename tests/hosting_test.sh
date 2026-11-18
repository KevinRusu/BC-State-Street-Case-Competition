#!/usr/bin/env bash
# Tests for hosting the dashboard (deploy/, design docs/superpowers/specs/2026-11-17-cloud-run-hosting-design.md).
# Four sections, each a function below: upload (what may leave the machine), live (deploy/check-live.sh against a
# stand-in for Google's front end), server (the password check, version line and live check on a local production
# server of the made-up fixture) and deploy (deploy.sh's refusals and steps, offline). Runs all four, or only those
# named: tests/hosting_test.sh server. Ports 3200 (server) and 3201 (live), dashboard/.next-hosting and its own fixture
# store in tests/runs/hosting/fixture, so it can run beside `npm run dev` (3000) and the e2e suite (3100). The password
# is made up: fixture-only-pass:word.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
W=tests/runs/hosting
PORT=3200
BASE=http://127.0.0.1:$PORT
LIVE_PORT=3201
PASSWORD=fixture-only-pass:word
SERVER_PID=""

fail() { echo "FAIL  $*"; exit 1; }
pass() { echo "PASS  $*"; }

# ---------------------------------------------------------------------------------------------------------------------
# upload: what gcloud may send to Google. deploy/check-upload.sh on made-up path lists, the two ignore files kept
# identical, the image rules in deploy/Dockerfile, then (when gcloud and the store are there) the real upload list.
UPLOAD_ALLOWED="dashboard/app/page.tsx
dashboard/package.json
outputs/store.duckdb
outputs/02_defect_register.csv
deploy/Dockerfile
deploy/Dockerfile.dockerignore
deploy/cloudbuild.yaml
.gcloudignore"

# check_upload <list>: runs deploy/check-upload.sh on the list; sets $out (its output) and $code (its exit code).
check_upload() {
  out=$(printf '%s\n' "$1" | deploy/check-upload.sh 2>&1) && code=0 || code=$?
}

test_upload() {
  local out code bad path
  [ -x deploy/check-upload.sh ] || fail "upload: deploy/check-upload.sh not found (or not executable)"

  check_upload "$UPLOAD_ALLOWED"
  [ "$code" = 0 ] || { echo "$out"; fail "upload: the allowed list should pass (exit $code)"; }
  pass "upload: the allowed list passes"

  for bad in data/accounts.csv.gz outputs/02_trace.csv dashboard/node_modules/next/x.js dashboard/.next/server/x.js \
      docs/STATUS.md config/hosting.toml dashboard/.next-hosting/server/x.js dashboard/.next-tests/x.js \
      dashboard/tsconfig.tsbuildinfo dashboard/test-results/x.png dashboard/playwright-report/index.html \
      dashboard/next-env.d.ts dashboard/.env.local dashboard/lib/.DS_Store outputs/store.duckdb.wal \
      tests/runs/hosting/fixture/store.duckdb reference/01_Student_Brief.md notebooks/x.ipynb scripts/x.py src/x.py \
      deploy/check-live.sh .git/config README.md dashboardx/x.ts dashboard/../data/accounts.csv.gz; do
    check_upload "$UPLOAD_ALLOWED
$bad"
    [ "$code" = 1 ] || fail "upload: $bad should be refused (exit $code)"
    printf '%s\n' "$out" | grep -qxF "not allowed: $bad" || { echo "$out"; fail "upload: $bad not printed"; }
  done
  pass "upload: every path outside the allow-list refused and printed"

  for path in outputs/store.duckdb outputs/02_defect_register.csv; do
    check_upload "$(printf '%s\n' "$UPLOAD_ALLOWED" | grep -vxF "$path")"
    [ "$code" = 1 ] || fail "upload: a list without $path should fail (exit $code)"
    printf '%s\n' "$out" | grep -qF "missing: $path" || { echo "$out"; fail "upload: missing $path not printed"; }
  done
  pass "upload: a list without the store or the register fails"

  cmp -s .gcloudignore deploy/Dockerfile.dockerignore \
    || fail "upload: .gcloudignore and deploy/Dockerfile.dockerignore differ (they must hold the same allow-list)"
  pass "upload: .gcloudignore and deploy/Dockerfile.dockerignore are identical"

  grep -qE '^FROM node:22\.[0-9]+\.[0-9]+-bookworm-slim AS run$' deploy/Dockerfile \
    || fail "upload: the run stage is not a pinned node:22.x.y-bookworm-slim"
  grep -qxF 'USER node' deploy/Dockerfile || fail "upload: the image does not run as node"
  grep -qF 'DASHBOARD_REQUIRE_PASSWORD=1' deploy/Dockerfile || fail "upload: the image does not require the password"
  if grep -v '^#' deploy/Dockerfile | grep -qF 'DASHBOARD_PASSWORD'; then
    fail "upload: deploy/Dockerfile sets DASHBOARD_PASSWORD"
  fi
  grep -qF 'rm -rf .next/cache' deploy/Dockerfile || fail "upload: deploy/Dockerfile keeps the build cache in the image"
  grep -qF 'DOCKER_BUILDKIT=1' deploy/cloudbuild.yaml || fail "upload: cloudbuild.yaml does not set DOCKER_BUILDKIT=1"
  grep -qx 'timeout: 1800s' deploy/cloudbuild.yaml || fail "upload: cloudbuild.yaml has no 1800s timeout"
  grep -qx '  defaultLogsBucketBehavior: REGIONAL_USER_OWNED_BUCKET' deploy/cloudbuild.yaml \
    || fail "upload: cloudbuild.yaml does not keep the build logs in a regional bucket of the project"
  pass "upload: image and build rules (pinned glibc base, user node, password required, none baked in, no build cache, BuildKit, timeout, regional logs)"

  if ! command -v gcloud > /dev/null; then
    echo "upload: gcloud not installed; skipping the real upload list"
  elif [ ! -f outputs/store.duckdb ] || [ ! -f outputs/02_defect_register.csv ]; then
    echo "upload: outputs/store.duckdb or outputs/02_defect_register.csv not built; skipping the real upload list"
  else
    mkdir -p "$W"
    gcloud meta list-files-for-upload > "$W/upload_list.txt" || fail "upload: gcloud meta list-files-for-upload"
    deploy/check-upload.sh < "$W/upload_list.txt" || fail "upload: the real upload list breaks the allow-list"
    pass "upload: the real upload list ($(wc -l < "$W/upload_list.txt" | tr -d ' ') files) is inside the allow-list"
  fi
}

# ---------------------------------------------------------------------------------------------------------------------
# live: deploy/check-live.sh against a stand-in for Google's front end (a few lines of Python), so the cases a local
# Next server never shows are tested too. The stand-in answers a raw /../ or /%2e%2e/ with 400 before any password
# check, as Google's front end may; otherwise it behaves like the hosted app. FAKE_MODE breaks one thing at a time.
write_front_end() { # write_front_end <file>
  cat > "$1" <<'PY'
import base64, os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MODE = os.environ["FAKE_MODE"]
GOOD = "Basic " + base64.b64encode((":" + os.environ["FAKE_PASSWORD"]).encode()).decode()
ASSET = "/_next/static/chunks/made-up.js"


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def answer(self, code, body=b"", headers=()):
        self.send_response(code)
        for key, value in headers:
            self.send_header(key, value)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path
        if ".." in path or "%2e%2e" in path.lower():
            return self.answer(400)
        if MODE == "page_400" and path == "/executive" and self.headers.get("Authorization") != GOOD:
            return self.answer(400)
        if MODE == "leak" and path == "/outputs/02_defect_register.csv":
            return self.answer(200, b"made,up\n")
        if self.headers.get("Authorization") != GOOD:
            return self.answer(401, headers=[("WWW-Authenticate", 'Basic realm="dashboard"')])
        if path in ("/", "/executive", "/trace"):
            page = '<html><span class="live-commit">live abc1234</span><script src="%s"></script></html>' % ASSET
            return self.answer(200, page.encode(), [("Content-Type", "text/html"), ("X-Robots-Tag", "noindex, nofollow")])
        if path == ASSET:
            return self.answer(200, b"made-up")
        if path == "/robots.txt":
            return self.answer(200, b"User-agent: *\nDisallow: /\n")
        return self.answer(404)


ThreadingHTTPServer(("127.0.0.1", int(os.environ["FAKE_PORT"])), Handler).serve_forever()
PY
}

# live_case <mode>: starts the stand-in in that mode, runs the live check against it; sets $out and $code.
live_case() {
  local i
  (FAKE_MODE=$1 FAKE_PASSWORD=$PASSWORD FAKE_PORT=$LIVE_PORT exec "$LIVE_PY" "$LIVE_TMP/front_end.py") \
    > "$LIVE_TMP/front_end_$1.log" 2>&1 &
  SERVER_PID=$!
  for i in $(seq 30); do
    kill -0 "$SERVER_PID" 2>/dev/null || { cat "$LIVE_TMP/front_end_$1.log"; fail "live: the stand-in exited"; }
    [ "$(curl -s --max-time 5 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$LIVE_PORT/" || true)" != 000 ] && break
    sleep 0.2
  done
  out=$(EXPECT_COMMIT=abc1234 DASHBOARD_PASSWORD="$PASSWORD" deploy/check-live.sh "http://127.0.0.1:$LIVE_PORT" 2>&1) \
    && code=0 || code=$?
  stop_server
}

test_live() {
  local out code
  if [ "$(curl -s --max-time 5 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$LIVE_PORT/" || true)" != 000 ]; then
    fail "live: something already answers on port $LIVE_PORT; stop it first"
  fi
  LIVE_TMP=$(mktemp -d)
  LIVE_PY=$(uv run --quiet python -c 'import sys; print(sys.executable)')
  write_front_end "$LIVE_TMP/front_end.py"

  live_case front_end_400
  [ "$code" = 0 ] || { echo "$out"; fail "live: a front end that answers 400 to raw traversals should pass (exit $code)"; }
  printf '%s\n' "$out" | grep -qxF 'PASS  /../outputs/store.duckdb without password: 400, 401 or 404 (got 400)' \
    || { echo "$out"; fail "live: the traversal probe without the password did not accept 400"; }
  pass "live: 400 from the front end on /../ and /%2e%2e/ counts as refused, with and without the password"

  live_case page_400
  [ "$code" = 1 ] || { echo "$out"; fail "live: a page answering 400 without the password should fail (exit $code)"; }
  printf '%s\n' "$out" | grep -qxF 'FAIL  /executive without password: 401 (got 400)' \
    || { echo "$out"; fail "live: the page check is not strict 401"; }
  pass "live: a page without the password must still answer exactly 401"

  live_case leak
  [ "$code" = 1 ] || { echo "$out"; fail "live: a register served without the password should fail (exit $code)"; }
  printf '%s\n' "$out" | grep -qF 'FAIL  /outputs/02_defect_register.csv without password' \
    || { echo "$out"; fail "live: the register leak was not reported"; }
  pass "live: the register served without the password fails the check"
  rm -rf "$LIVE_TMP"
}

# ---------------------------------------------------------------------------------------------------------------------
# server: one `next build` with no password env, started three ways. Proves the env is read at request time.
stop_server() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
    SERVER_PID=""
  fi
}
trap stop_server EXIT
trap 'exit 130' INT TERM

# start_server <log name> [VAR=value ...]: the build in dashboard/.next-hosting on $PORT, with only the given
# DASHBOARD_* variables; waits up to 60 s for it to answer.
start_server() {
  local log="$W/server_$1.log"; shift
  (cd dashboard && exec env -u DASHBOARD_REQUIRE_PASSWORD -u DASHBOARD_PASSWORD -u DASHBOARD_COMMIT \
    DASHBOARD_DIST_DIR=.next-hosting NEXT_TELEMETRY_DISABLED=1 STORE_PATH="$STORE" "$@" \
    node node_modules/next/dist/bin/next start -H 127.0.0.1 -p "$PORT") > "$log" 2>&1 &
  SERVER_PID=$!
  local i
  for i in $(seq 60); do
    kill -0 "$SERVER_PID" 2>/dev/null || { tail -20 "$log"; fail "server: next start exited (log $log)"; }
    [ "$(curl -s --max-time 5 -o /dev/null -w '%{http_code}' "$BASE/robots.txt" || true)" != 000 ] && return 0
    sleep 1
  done
  fail "server: not answering on $BASE after 60 s (log $log)"
}

status() { # status <path> [curl args...]: the status code only
  local path=$1; shift
  curl -s --max-time 60 --path-as-is -o /dev/null -w '%{http_code}' "$@" "$BASE$path" || true
}

test_server() {
  mkdir -p "$W"
  if [ "$(curl -s --max-time 60 -o /dev/null -w '%{http_code}' "$BASE/" || true)" != 000 ]; then
    fail "server: something already answers on port $PORT; stop it first"
  fi
  STORE="$PWD/$W/fixture/store.duckdb"
  echo "server: preparing the made-up fixture store in $W/fixture"
  (cd dashboard && STORE="$STORE" node --input-type=module -e \
    'import { prepareFixture } from "./scripts/test-fixture.mjs"; prepareFixture(process.env.STORE);')
  echo "server: building once into dashboard/.next-hosting (log $W/next_build.log)"
  (cd dashboard && env -u DASHBOARD_REQUIRE_PASSWORD -u DASHBOARD_PASSWORD -u DASHBOARD_COMMIT \
    DASHBOARD_DIST_DIR=.next-hosting NEXT_TELEMETRY_DISABLED=1 STORE_PATH="$STORE" \
    node node_modules/next/dist/bin/next build) > "$W/next_build.log" 2>&1 \
    || { tail -40 "$W/next_build.log"; fail "server: next build"; }

  echo "server 1/3: password required and set, commit abc1234: the live check"
  start_server hosted DASHBOARD_REQUIRE_PASSWORD=1 DASHBOARD_PASSWORD="$PASSWORD" DASHBOARD_COMMIT=abc1234
  EXPECT_COMMIT=abc1234 DASHBOARD_PASSWORD="$PASSWORD" deploy/check-live.sh "$BASE" \
    || fail "server 1/3: the live check failed"
  stop_server

  echo "server 2/3: password required but not set: every request refused"
  start_server no_password DASHBOARD_REQUIRE_PASSWORD=1
  code=$(status / -u ":$PASSWORD")
  [ "$code" = 401 ] || fail "server 2/3: / with the test password should be 401 (got $code)"
  pass "server 2/3: / with the test password: 401"
  code=$(status / -u ":")
  [ "$code" = 401 ] || fail "server 2/3: / with an empty password should be 401 (got $code)"
  pass "server 2/3: / with an empty password: 401"
  stop_server

  echo "server 3/3: no DASHBOARD_* env (local): open, no version line"
  start_server local
  code=$(curl -s --max-time 60 -o "$W/local_body.html" -w '%{http_code}' "$BASE/" || true)
  [ "$code" = 200 ] || fail "server 3/3: / without a password should be 200 (got $code)"
  pass "server 3/3: / without a password: 200"
  if grep -qF 'live-commit' "$W/local_body.html"; then fail "server 3/3: / shows a live commit locally"; fi
  pass "server 3/3: / shows no live commit"
  stop_server
  rm -f "$W/local_body.html"
}

# ---------------------------------------------------------------------------------------------------------------------
# deploy: deploy/deploy.sh's refusals, offline. No test runs a real gcloud: every subshell that could reach it defines a
# gcloud function that stops the test. The readiness checks are small functions deploy.sh lets the test override.
test_deploy() {
  local out code tmp pw order
  [ -x deploy/deploy.sh ] || fail "deploy: deploy/deploy.sh not found (or not executable)"
  [ -x deploy/read_config.py ] || [ -f deploy/read_config.py ] || fail "deploy: deploy/read_config.py not found"
  mkdir -p "$W"
  tmp=$(mktemp -d)

  # An empty project: refused before anything else, started from dashboard/ (cwd must not matter).
  printf '[google]\nproject = ""\nregion = ""\n' > "$tmp/empty.toml"
  out=$(cd dashboard && HOSTING_CONFIG="$tmp/empty.toml" ../deploy/deploy.sh 2>&1) && code=0 || code=$?
  [ "$code" = 1 ] || { echo "$out"; fail "deploy: an empty project should exit 1 (got $code)"; }
  printf '%s\n' "$out" | grep -qF 'fill in config/hosting.toml' || { echo "$out"; fail "deploy: empty project message"; }
  pass "deploy: empty project and region refused"

  printf '[google]\nproject = "made-up-project"\nregion = "made-up-region"\n[service]\nname = "dashboard"\n' > "$tmp/made_up.toml"
  # The config reader: the made-up values, the bucket name derived from the project.
  out=$(HOSTING_CONFIG="$tmp/made_up.toml" uv run --quiet python deploy/read_config.py) || fail "deploy: read_config.py"
  printf '%s\n' "$out" | grep -qxF 'BUCKET=made-up-project-dashboard-uploads' || { echo "$out"; fail "deploy: BUCKET not derived"; }
  pass "deploy: the config reader derives the bucket"

  # refuse_case <description> <expected text> <override code>: the deploy body with all checks passing except the override.
  refuse_case() {
    out=$(
      export HOSTING_CONFIG="$tmp/made_up.toml"
      # shellcheck disable=SC1091
      source deploy/deploy.sh
      gcloud() { echo "a real gcloud ran: $*"; exit 99; }
      current_branch() { echo main; }
      tree_is_clean() { return 0; }
      gcloud_account() { echo someone@example.com; }
      project_visible() { return 0; }
      secret_exists() { return 0; }
      STORE_FILE=$tmp/store.duckdb; REGISTER_FILE=$tmp/register.csv
      touch "$REGISTER_FILE"; sleep 1; touch "$STORE_FILE"
      eval "$3"
      deploy_main 2>&1
    ) && code=0 || code=$?
    [ "$code" = 1 ] || { echo "$out"; fail "deploy: $1 should exit 1 (got $code)"; }
    printf '%s\n' "$out" | grep -qF -- "$2" || { echo "$out"; fail "deploy: $1: expected '$2'"; }
    printf '%s\n' "$out" | grep -qF 'a real gcloud ran' && { echo "$out"; fail "deploy: $1 reached gcloud"; }
    pass "deploy: $1"
  }
  refuse_case "a branch other than main is refused" "main" 'current_branch() { echo feature/x; }'
  refuse_case "a dirty tree is refused" "uncommitted" 'tree_is_clean() { return 1; }'
  refuse_case "no gcloud account is refused" "gcloud auth login" 'gcloud_account() { echo; }'
  refuse_case "a missing store is refused" "outputs/store.duckdb" 'rm -f "$STORE_FILE"'
  refuse_case "a missing register is refused" "outputs/02_defect_register.csv" 'rm -f "$REGISTER_FILE"'
  refuse_case "a store older than the register is refused" "older" 'touch "$REGISTER_FILE"; touch -t 200001010000 "$STORE_FILE"'
  refuse_case "a missing secret is refused" "setup" 'secret_exists() { return 1; }'
  refuse_case "a project the account cannot see is refused" "cannot see project made-up-project" \
    'project_visible() { return 1; }; secret_exists() { echo "secret checked" >&2; return 1; }'
  printf '%s\n' "$out" | grep -qF 'secret checked' && { echo "$out"; fail "deploy: the secret was checked in a project the account cannot see"; }

  # previous_revision with a gcloud that prints nothing: an empty string, no error.
  out=$(
    export HOSTING_CONFIG="$tmp/made_up.toml"
    source deploy/deploy.sh
    gcloud() { return 0; }
    SERVICE=dashboard; REGION=made-up-region; PROJECT=made-up-project
    set -e
    r=$(previous_revision)
    printf '[%s]' "$r"
  ) || fail "deploy: previous_revision errored with an empty gcloud"
  [ "$out" = "[]" ] || fail "deploy: previous_revision should be empty (got $out)"
  pass "deploy: previous_revision is empty when nothing serves, no error"

  # A stubbed gcloud that records its arguments (never a real one). Shared by the setup and deploy-sequence tests.
  stub_gcloud() {
    gcloud() {
      echo "$*" >> "$CALLS"
      case "$*" in
        "meta list-files-for-upload") printf '%s\n' "$UPLOAD_ALLOWED" ;;
        "config get account") echo someone@example.com ;;
        "projects describe"*) echo 123456789 ;;
        "secrets describe"*) return 1 ;;
        "run services describe"*) echo https://made-up.example ;;
        "run services remove-iam-policy-binding"*) [ -z "${FAIL_CLOSE:-}" ] || return 1 ;;
      esac
      return 0
    }
  }

  # setup: exits 0, prints the password once, leaves no temp directory.
  mkdir -p "$tmp/tmpdir"
  out=$(
    export HOSTING_CONFIG="$tmp/made_up.toml" TMPDIR="$tmp/tmpdir" CALLS="$tmp/setup_calls"
    source deploy/deploy.sh
    stub_gcloud
    setup_main 2>&1
  ) && code=0 || code=$?
  [ "$code" = 0 ] || { echo "$out"; fail "deploy: setup with a stubbed gcloud should exit 0 (got $code)"; }
  [ "$(printf '%s\n' "$out" | grep -cE '^  [a-z]+(-[a-z]+){4}$')" = 1 ] || { echo "$out"; fail "deploy: setup should print the password exactly once"; }
  [ -z "$(find "$tmp/tmpdir" -mindepth 1 -type d)" ] || fail "deploy: setup left a temp directory behind"
  grep -qx 'secrets create dashboard-password .*' "$tmp/setup_calls" || fail "deploy: setup did not create the secret"
  grep -qE '^services enable .*compute\.googleapis\.com' "$tmp/setup_calls" \
    || fail "deploy: setup does not enable compute.googleapis.com (the default service account it binds)"
  pw=$(printf '%s\n' "$out" | grep -E '^  [a-z]+(-[a-z]+){4}$' | tr -d ' ')
  grep -q -- '--data-file -' "$tmp/setup_calls" && ! grep -qF -- "$pw" "$tmp/setup_calls" \
    || fail "deploy: the password reached a gcloud argument"
  pass "deploy: setup exits 0, enables compute, prints the password once, leaves no temp directory"

  # setup with a project the account cannot see: refused before any change.
  out=$(
    export HOSTING_CONFIG="$tmp/made_up.toml" CALLS="$tmp/setup_hidden_calls"
    source deploy/deploy.sh
    stub_gcloud
    project_visible() { return 1; }
    setup_main 2>&1
  ) && code=0 || code=$?
  [ "$code" = 1 ] || { echo "$out"; fail "deploy: setup with a hidden project should exit 1 (got $code)"; }
  printf '%s\n' "$out" | grep -qF 'cannot see project made-up-project' || { echo "$out"; fail "deploy: setup hidden project message"; }
  if grep -qvx 'config get account' "$tmp/setup_hidden_calls"; then
    cat "$tmp/setup_hidden_calls"; fail "deploy: setup called gcloud beyond the account check for a hidden project"
  fi
  pass "deploy: setup refuses a project the account cannot see, before any change"

  # the deploy sequence: traffic goes back to latest after run deploy and before the live check.
  out=$(
    export HOSTING_CONFIG="$tmp/made_up.toml" CALLS="$tmp/deploy_calls"
    source deploy/deploy.sh
    stub_gcloud
    current_branch() { echo main; }
    tree_is_clean() { return 0; }
    secret_exists() { return 0; }
    STORE_FILE=$tmp/store.duckdb; REGISTER_FILE=$tmp/register.csv
    touch "$REGISTER_FILE"; sleep 1; touch "$STORE_FILE"
    live_check() { echo "live_check $*" >> "$CALLS"; return 0; }
    deploy_main 2>&1
  ) && code=0 || code=$?
  [ "$code" = 0 ] || { echo "$out"; fail "deploy: the stubbed deploy sequence should exit 0 (got $code)"; }
  order=$(grep -nE '^(run deploy|run services update-traffic .*--to-latest$|live_check)' "$tmp/deploy_calls" | sed -E 's/^[0-9]+://; s/^(run deploy|run services update-traffic|live_check).*/\1/' | tr '\n' ',')
  [ "$order" = "run deploy,run services update-traffic,live_check," ] || { cat "$tmp/deploy_calls"; fail "deploy: order was $order"; }
  pass "deploy: traffic is sent to the latest revision after run deploy and before the live check"

  # failed_deploy <calls file> <previous revision> [FAIL_CLOSE=1]: the stubbed deploy with a live check that fails.
  failed_deploy() {
    out=$(
      export HOSTING_CONFIG="$tmp/made_up.toml" CALLS="$1" FAIL_CLOSE="${3:-}"
      PREV_FIXTURE=$2
      source deploy/deploy.sh
      stub_gcloud
      current_branch() { echo main; }
      tree_is_clean() { return 0; }
      secret_exists() { return 0; }
      previous_revision() { printf '%s' "$PREV_FIXTURE"; }
      STORE_FILE=$tmp/store.duckdb; REGISTER_FILE=$tmp/register.csv
      live_check() { echo "live_check $*" >> "$CALLS"; return 1; }
      deploy_main 2>&1
    ) && code=0 || code=$?
  }
  close_call='run services remove-iam-policy-binding dashboard --region made-up-region --project made-up-project --member allUsers --role roles/run.invoker'

  # The first deploy fails its live check: no earlier revision, so public access is removed after the check.
  failed_deploy "$tmp/first_calls" ""
  [ "$code" = 1 ] || { echo "$out"; fail "deploy: a failed first deploy should exit 1 (got $code)"; }
  order=$(grep -nE '^(live_check|run services remove-iam-policy-binding)' "$tmp/first_calls" | sed -E 's/^[0-9]+://; s/^(live_check|run services remove-iam-policy-binding).*/\1/' | tr '\n' ',')
  [ "$order" = "live_check,run services remove-iam-policy-binding," ] || { cat "$tmp/first_calls"; fail "deploy: first-deploy order was $order"; }
  grep -qxF "$close_call" "$tmp/first_calls" || { cat "$tmp/first_calls"; fail "deploy: the failed first deploy did not remove allUsers"; }
  grep -qF -- '--to-revisions' "$tmp/first_calls" && { cat "$tmp/first_calls"; fail "deploy: a first deploy has no revision to roll back to"; }
  printf '%s\n' "$out" | grep -qF 'closed to everyone' && printf '%s\n' "$out" | grep -qF 'next deploy/deploy.sh opens it again' \
    || { echo "$out"; fail "deploy: the failed first deploy did not say the site is closed"; }
  pass "deploy: a failed first deploy removes public access and says so"

  # ... and when removing it fails too, the output says to delete the service.
  failed_deploy "$tmp/first_fail_calls" "" 1
  [ "$code" = 1 ] || { echo "$out"; fail "deploy: a failed close should exit 1 (got $code)"; }
  printf '%s\n' "$out" | grep -qF 'Could not close the site' || { echo "$out"; fail "deploy: a failed close was not reported"; }
  pass "deploy: a failed close is reported with the takedown pointer"

  # A later deploy fails its live check: traffic goes back to the earlier revision; public access is untouched.
  failed_deploy "$tmp/rollback_calls" made-up-revision-00007
  [ "$code" = 1 ] || { echo "$out"; fail "deploy: a failed later deploy should exit 1 (got $code)"; }
  grep -qxF 'run services update-traffic dashboard --project made-up-project --region made-up-region --to-revisions made-up-revision-00007=100' \
    "$tmp/rollback_calls" || { cat "$tmp/rollback_calls"; fail "deploy: the failed deploy did not roll back"; }
  grep -qF 'remove-iam-policy-binding' "$tmp/rollback_calls" && { cat "$tmp/rollback_calls"; fail "deploy: a rollback should not remove public access"; }
  pass "deploy: a failed later deploy rolls back and leaves public access alone"
  rm -rf "$tmp"
}

# ---------------------------------------------------------------------------------------------------------------------
for section in ${*:-upload live server deploy}; do
  case $section in
    upload|live|server|deploy) "test_$section" ;;
    *) echo "unknown section: $section (upload, live, server, deploy)" >&2; exit 2 ;;
  esac
done
echo "hosting tests OK"
