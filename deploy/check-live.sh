#!/usr/bin/env bash
# The live check: asks a running dashboard (hosted or local) the questions a deploy must answer right, prints one
# PASS/FAIL line per check and exits 1 if any failed. deploy/deploy.sh runs it after every deploy; tests/hosting_test.sh
# runs it against a local production server of the made-up fixture.
#
#   EXPECT_COMMIT=<short commit> [DASHBOARD_PASSWORD=...] deploy/check-live.sh <url>
#
# Without DASHBOARD_PASSWORD it reads the password from Secret Manager, project and secret name from the config
# (deploy/read_config.py, as HOSTING_PROJECT and HOSTING_SECRET). The password is never printed and never put in a
# process argument list: the Authorization header is built with shell builtins and handed to curl on stdin.
# Paths go out as typed (--path-as-is), so the traversal cases reach the server.
set -euo pipefail
cd "$(cd "$(dirname "$0")/.." && pwd)"

URL=${1:?usage: EXPECT_COMMIT=<commit> deploy/check-live.sh <url>}
URL=${URL%/}
: "${EXPECT_COMMIT:?EXPECT_COMMIT is not set: the commit the live site should show}"
if [ -z "${DASHBOARD_PASSWORD:-}" ]; then
  config=$(uv run --quiet python deploy/read_config.py | sed 's/^/HOSTING_/') || exit 1
  eval "$config"
  DASHBOARD_PASSWORD=$(gcloud secrets versions access latest --secret "$HOSTING_SECRET" --project "$HOSTING_PROJECT")
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
FAILED=0

# fetch <with|without> <path>: status code on stdout; body and headers (CR stripped) in $TMP/body and $TMP/headers.
# The previous response files are removed first, so a failed request never leaves an earlier response to be read.
fetch() {
  local code
  rm -f "$TMP/body" "$TMP/raw" "$TMP/headers"
  if [ "$1" = with ]; then
    code=$(printf 'Authorization: Basic %s\n' "$(printf ':%s' "$DASHBOARD_PASSWORD" | base64 | tr -d '\n')" \
      | curl -s --path-as-is --max-time 60 -o "$TMP/body" -D "$TMP/raw" -w '%{http_code}' -H @- "$URL$2" || true)
  else
    code=$(curl -s --path-as-is --max-time 60 -o "$TMP/body" -D "$TMP/raw" -w '%{http_code}' "$URL$2" || true)
  fi
  touch "$TMP/body" "$TMP/raw"
  tr -d '\r' < "$TMP/raw" > "$TMP/headers"
  echo "${code:-000}"
}

check() { # check <ok: 0|1> <description>
  if [ "$1" = 1 ]; then echo "PASS  $2"; else echo "FAIL  $2"; FAILED=1; fi
}

status_is() { # status_is <code> <allowed codes...>
  local code=$1; shift
  for allowed in "$@"; do [ "$code" = "$allowed" ] && return 0; done
  return 1
}

for path in / /executive /trace; do
  code=$(fetch without "$path")
  check "$(status_is "$code" 401 && echo 1 || echo 0)" "$path without password: 401 (got $code)"
  code=$(fetch with "$path")
  check "$(status_is "$code" 200 && echo 1 || echo 0)" "$path with password: 200 (got $code)"
done

home_code=$(fetch with /)
home_ok=0; status_is "$home_code" 200 && home_ok=1
cp "$TMP/body" "$TMP/home_body"
shown=0
[ "$home_ok" = 1 ] && grep -qF ">live $EXPECT_COMMIT<" "$TMP/home_body" && shown=1
check "$shown" "/ with password: shows live commit $EXPECT_COMMIT (status $home_code)"
robots=0
[ "$home_ok" = 1 ] && grep -qix 'x-robots-tag: noindex, nofollow' "$TMP/headers" && robots=1
check "$robots" "/ with password: header X-Robots-Tag: noindex, nofollow (status $home_code)"

code=$(fetch without /favicon.ico)
check "$(status_is "$code" 401 && echo 1 || echo 0)" "/favicon.ico without password: 401 (got $code)"
asset=$(grep -o '/_next/static/[A-Za-z0-9_./%~-]*\.\(js\|css\)' "$TMP/home_body" | head -n 1 || true)
if [ -z "$asset" ]; then
  check 0 "a /_next/static/ file is linked from the home page"
else
  code=$(fetch without "$asset")
  check "$(status_is "$code" 401 && echo 1 || echo 0)" "a static file without password: 401 (got $code)"
  code=$(fetch with "$asset")
  check "$(status_is "$code" 200 && echo 1 || echo 0)" "a static file with password: 200 (got $code)"
fi

code=$(fetch without /robots.txt)
check "$(status_is "$code" 401 && echo 1 || echo 0)" "/robots.txt without password: 401 (got $code)"
code=$(fetch with /robots.txt)
disallow=0
status_is "$code" 200 && tr -d '\r' < "$TMP/body" | grep -qx 'Disallow: /' && disallow=1
check "$disallow" "/robots.txt with password: 200 with Disallow: / (got $code)"

# refused <with|without> <path> <allowed codes...>: prints "1 <what happened>" when the path is refused, else "0 ...".
# Google's front end tidies a raw /../ or /%2e%2e/ itself: it may answer 400, or redirect (302) to the tidied path on the
# same site (seen on the first deploy, 18 Nov). A redirect is followed once, only on this site, and the address it
# points to must be refused too; a redirect anywhere else fails.
refused() {
  local how=$1 path=$2 code location target code2; shift 2
  code=$(fetch "$how" "$path")
  case $code in
    301|302|307|308)
      location=$(grep -i '^location:' "$TMP/headers" | head -n 1 | sed 's/^[Ll][Oo][Cc][Aa][Tt][Ii][Oo][Nn]:[[:space:]]*//')
      case $location in
        "$URL"/*) target=${location#"$URL"} ;;
        /*) target=$location ;;
        *) echo "0 got $code to another site"; return ;;
      esac
      code2=$(fetch "$how" "$target")
      if status_is "$code2" "$@"; then echo "1 got $code to $target, then $code2"; else echo "0 got $code to $target, then $code2"; fi ;;
    *)
      if status_is "$code" "$@"; then echo "1 got $code"; else echo "0 got $code"; fi ;;
  esac
}

# The store and the register: never a 200 by any address. Google's front end may answer a raw /../ or /%2e%2e/ with 400
# before the request reaches the container, so 400 and 404 count as refused here too, with or without the password.
for path in /store.duckdb /outputs/store.duckdb /../outputs/store.duckdb /%2e%2e/outputs/store.duckdb \
  /_next/static/../../outputs/store.duckdb /outputs/02_defect_register.csv; do
  result=$(refused without "$path" 400 401 404)
  check "${result%% *}" "$path without password: 400, 401 or 404 (${result#* })"
  result=$(refused with "$path" 400 404)
  check "${result%% *}" "$path with password: 400 or 404 (${result#* })"
done

if [ "$FAILED" = 0 ]; then echo "live check: all passed"; else echo "live check: FAILED"; exit 1; fi
