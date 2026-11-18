# Cloud Run Hosting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the dashboard on Google Cloud Run behind one shared password, deployed with one command that ships code
and data together and checks the live site, with local use unchanged.

**Architecture:** A small `dashboard/lib/hosting.ts` holds the password check and the version line; it only switches on
when `DASHBOARD_REQUIRE_PASSWORD=1`, which only the container sets. `dashboard/proxy.ts` and `lib/data.ts` both call
it. Everything else lives in `deploy/`: a Dockerfile built by Cloud Build from an allow-listed upload, a bash
`deploy.sh` driven by `config/hosting.toml`, and a live check that `tests/hosting_test.sh` also runs against a local
production server of the made-up fixture.

**Tech Stack:** Next.js 16.4.6 (`proxy.ts`, Node runtime), TypeScript, vitest, bash (macOS 3.2-compatible), Google Cloud
SDK (`gcloud`), Cloud Build, Artifact Registry, Secret Manager, Cloud Run, `uv` Python for reading TOML.

**Spec:** `docs/superpowers/specs/2026-11-17-cloud-run-hosting-design.md` (read it with this plan).

## Global Constraints

- **Never commit or push.** Leave every change in the working tree on branch `cloud-run-hosting`; the user commits.
- Local use is unchanged: with `DASHBOARD_REQUIRE_PASSWORD` unset there is no password check, and `npm run dev`,
  `npm start`, `npm test`, `npm run test:e2e`, `tests/store_test.sh` behave as before. `dashboard/package.json` scripts
  are not edited.
- The password check fails closed: `DASHBOARD_REQUIRE_PASSWORD=1` with an empty or unset `DASHBOARD_PASSWORD` refuses
  every request.
- Environment variables are read **at request time**, never inlined at build: the image is built without a password.
- The password never appears in git, a file, a log or command output, except printed once by `deploy.sh setup`. Tests
  use the made-up password `fixture-only-pass:word` (with a colon on purpose).
- Upload allow-list, exactly: `dashboard/**` except `node_modules/`, `.next*/`, `tsconfig.tsbuildinfo`, `test-results/`,
  `playwright-report/`; `outputs/store.duckdb`; `outputs/02_defect_register.csv`; `deploy/Dockerfile`;
  `deploy/cloudbuild.yaml`; `.gcloudignore`. Nothing from `data/`, `docs/`, `reference/`, `notebooks/`, `tests/`,
  `scripts/`, `src/`, `config/` or any other `outputs/` file.
- Every Google resource (upload bucket, Cloud Build, Artifact Registry, secret, service) is in the one `region` from
  `config/hosting.toml`.
- Cloud Run: max instances `1`, min instances `0`, start at memory `2Gi`, CPU `1`, container port `8080`.
- Never hard-code a record ID; never reuse a number seen in the data (made-up values only in tests and comments).
- Bash scripts start with `set -euo pipefail`, `cd` to the repo root themselves, and avoid bash-4 features
  (`mapfile`, associative arrays), because macOS ships bash 3.2.
- Next.js 16: request interception is `dashboard/proxy.ts` with a named `proxy` export; it runs on the Node runtime
  (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`, "Runtime"). Read
  `dashboard/AGENTS.md` before touching `dashboard/`.

## Review Focus

1. **Env inlined at build time:** a single `next build` made without any password env, then started with
   `DASHBOARD_REQUIRE_PASSWORD=1`, must still demand the password. Test: Task 2's `tests/hosting_test.sh` builds once
   and starts the same build three ways.
2. **Odd passwords and broken headers:** a password containing `:`; a username containing nothing; a header that is not
   `Basic`, or not valid base64, must give `denied`, never throw. Tests: Task 1.
3. **Encoded or traversal paths to the store:** `/../outputs/store.duckdb` sent as-is, `%2e%2e` forms and
   `/_next/static/../../outputs/store.duckdb` must never return the file. Test: Task 2's live check, run in Task 2.
4. **First deploy, no previous revision:** `deploy.sh` must not crash when there is nothing to roll back to; it says so.
   Test: Task 4 (`previous_revision` on an empty value).
5. **Run from another folder:** `deploy/deploy.sh` and `deploy/check-live.sh` started from `dashboard/` or with a path
   containing a space work the same. Test: Task 4's refusal test runs the script from `dashboard/`.

---

### Task 1: Password check and version line (`lib/hosting.ts`)

**Files:**
- Create: `dashboard/lib/hosting.ts`
- Test: `dashboard/tests/hosting.test.ts`

**Interfaces:**
- Produces:
  - `type HostingEnv = { DASHBOARD_REQUIRE_PASSWORD?: string; DASHBOARD_PASSWORD?: string; DASHBOARD_COMMIT?: string }`
  - `authorize(header: string | null, env?: HostingEnv): "open" | "ok" | "denied"` (default `env` = `process.env`)
  - `class UnauthorizedError extends Error`
  - `assertAuthorized(header: string | null, env?: HostingEnv): void` (throws `UnauthorizedError` on `"denied"`)
  - `liveCommit(env?: HostingEnv): string | null` (trimmed `DASHBOARD_COMMIT`, or `null` when unset or blank)
  - `const AUTH_CHALLENGE = 'Basic realm="Dashboard", charset="UTF-8"'`
  - `const NO_INDEX = "noindex, nofollow"`
- Plain Node only (no `next/*` imports), like `lib/store.ts`, so vitest calls it directly.

- [ ] **Step 1: Write the failing tests** in `dashboard/tests/hosting.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { authorize, assertAuthorized, liveCommit, UnauthorizedError } from "@/lib/hosting";

const basic = (user: string, pass: string) => "Basic " + Buffer.from(`${user}:${pass}`, "utf8").toString("base64");
const on = { DASHBOARD_REQUIRE_PASSWORD: "1", DASHBOARD_PASSWORD: "fixture-only-pass:word" };

describe("authorize", () => {
  it("is open when the password is not required", () => {
    expect(authorize(null, {})).toBe("open");
    expect(authorize(basic("x", "anything"), { DASHBOARD_PASSWORD: "fixture-only-pass:word" })).toBe("open");
  });
  it("accepts the password with any user name, including none", () => {
    expect(authorize(basic("judge", "fixture-only-pass:word"), on)).toBe("ok");
    expect(authorize(basic("", "fixture-only-pass:word"), on)).toBe("ok");
  });
  it("denies a missing, wrong, truncated or longer password", () => {
    for (const h of [null, "", basic("judge", "wrong"), basic("judge", "fixture-only-pass"),
      basic("judge", "fixture-only-pass:word!")]) expect(authorize(h, on)).toBe("denied");
  });
  it("denies headers that are not Basic or not base64, without throwing", () => {
    for (const h of ["Bearer abc", "Basic", "Basic ###", "Basic " + Buffer.from("no-colon").toString("base64")])
      expect(authorize(h, on)).toBe("denied");
  });
  it("fails closed when required but no password is set", () => {
    expect(authorize(basic("judge", ""), { DASHBOARD_REQUIRE_PASSWORD: "1" })).toBe("denied");
    expect(authorize(basic("judge", ""), { DASHBOARD_REQUIRE_PASSWORD: "1", DASHBOARD_PASSWORD: "" })).toBe("denied");
  });
});

describe("assertAuthorized", () => {
  it("throws UnauthorizedError only when denied", () => {
    expect(() => assertAuthorized(null, {})).not.toThrow();
    expect(() => assertAuthorized(basic("j", "fixture-only-pass:word"), on)).not.toThrow();
    expect(() => assertAuthorized(null, on)).toThrow(UnauthorizedError);
  });
});

describe("liveCommit", () => {
  it("is the trimmed commit, or null when not hosted", () => {
    expect(liveCommit({ DASHBOARD_COMMIT: " abc1234 " })).toBe("abc1234");
    expect(liveCommit({ DASHBOARD_COMMIT: "" })).toBeNull();
    expect(liveCommit({})).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd dashboard && npm test -- tests/hosting.test.ts`
Expected: FAIL, cannot resolve `@/lib/hosting`.

- [ ] **Step 3: Implement `dashboard/lib/hosting.ts`**

Required only when `DASHBOARD_REQUIRE_PASSWORD === "1"`. Decode the base64 after `Basic `, split at the **first** colon
(the password may contain colons), compare the password with `crypto.timingSafeEqual` on the SHA-256 digests of both
strings (equal length, no length leak). Any decode problem is `"denied"`.

- [ ] **Step 4: Run to verify they pass, and the whole unit suite**

Run: `cd dashboard && npm test`
Expected: all tests PASS, including the existing ones.

- [ ] **Step 5: Stop for the user to commit** (do not run `git commit`).

---

### Task 2: Wire the checks in, robots, version line, live check, local hosting test

**Files:**
- Create: `dashboard/proxy.ts`, `dashboard/app/robots.ts`, `deploy/check-live.sh`, `tests/hosting_test.sh`
- Modify: `dashboard/lib/data.ts` (`load()`), `dashboard/components/shell/store-badge.tsx`

**Interfaces:**
- Consumes: Task 1's `authorize`, `assertAuthorized`, `liveCommit`, `AUTH_CHALLENGE`, `NO_INDEX`.
- Produces:
  - `export function proxy(request: NextRequest): NextResponse` in `dashboard/proxy.ts`, no `matcher` (every path,
    including `/_next/*`, `/robots.txt` and `public/` files). `"denied"` → status 401, header `WWW-Authenticate:
    AUTH_CHALLENGE`, body `Password required`. Otherwise `NextResponse.next()`; when `authorize` returned `"ok"`, add
    `X-Robots-Tag: NO_INDEX`.
  - In `load()`, right after `await connection()`: `assertAuthorized((await headers()).get("authorization"))`
    (`headers` from `next/headers`), before any store read.
  - `dashboard/app/robots.ts`: default export returning `{ rules: { userAgent: "*", disallow: "/" } }`.
  - Store badge: when `liveCommit()` is not null, add `<span data-testid="live-commit">live {commit}</span>` beside the
    store time (visible from `sm`). Nothing new when null.
  - `deploy/check-live.sh <url>`: env `EXPECT_COMMIT` (required), `DASHBOARD_PASSWORD` (if unset, read with
    `gcloud secrets versions access latest --secret "$SECRET" --project "$PROJECT"`, values from Task 4's config
    reader; Task 2 only needs the env path). Prints one line per check, `PASS`/`FAIL`, exits 1 if any failed. Never
    prints the password. Uses `curl -s --path-as-is`.
  - `tests/hosting_test.sh`: sections `upload` (filled in Task 3), `server` (here), `deploy` (Task 4); runs all.

The live check's cases (exact):

| Request | Without password | With password |
|---|---|---|
| `/`, `/executive`, `/trace` | 401 | 200 |
| `/` body | — | contains `data-testid="live-commit"` and `$EXPECT_COMMIT` |
| `/` headers | — | `X-Robots-Tag: noindex, nofollow` |
| `/robots.txt` | 401 | 200, body contains `Disallow: /` |
| `/store.duckdb`, `/outputs/store.duckdb`, `/../outputs/store.duckdb`, `/%2e%2e/outputs/store.duckdb`, `/_next/static/../../outputs/store.duckdb`, `/outputs/02_defect_register.csv` | 401 | 400 or 404 |

- [ ] **Step 1: Write `deploy/check-live.sh`** with the cases above.

- [ ] **Step 2: Write the `server` section of `tests/hosting_test.sh`**

Prepare the browser fixture store (`node -e` importing `prepareFixture, browserFixtureStore` from
`dashboard/scripts/test-fixture.mjs`, as `scripts/test-server.mjs` does), run **one** `next build` with
`DASHBOARD_DIST_DIR=.next-hosting` and no `DASHBOARD_*` password env, then start that same build three times on
`127.0.0.1:3200` with `STORE_PATH` set to the fixture, stopping each before the next:

1. `DASHBOARD_REQUIRE_PASSWORD=1 DASHBOARD_PASSWORD=fixture-only-pass:word DASHBOARD_COMMIT=abc1234`: run
   `EXPECT_COMMIT=abc1234 DASHBOARD_PASSWORD=fixture-only-pass:word deploy/check-live.sh http://127.0.0.1:3200` →
   exit 0.
2. `DASHBOARD_REQUIRE_PASSWORD=1` and no password: `/` with `fixture-only-pass:word` and with an empty password both
   → 401 (fails closed).
3. No `DASHBOARD_*` env: `/` without a password → 200 and body has no `live-commit` (local unchanged).

Wait for readiness by polling with `curl` (up to 60 s); kill the server on exit with `trap`.

- [ ] **Step 3: Run to verify it fails**

Run: `tests/hosting_test.sh`
Expected: FAIL in case 1 (`/` answers 200 without a password: there is no proxy yet).

- [ ] **Step 4: Add `proxy.ts`, the `load()` check, `robots.ts` and the badge span**

- [ ] **Step 5: Run to verify it passes, then the existing suites**

Run: `tests/hosting_test.sh && (cd dashboard && npm test && npm run test:e2e) && tests/store_test.sh`
Expected: all PASS. The e2e and store tests prove local behaviour is unchanged.

- [ ] **Step 6: Stop for the user to commit.**

---

### Task 3: Container and upload allow-list

**Files:**
- Create: `deploy/Dockerfile`, `deploy/cloudbuild.yaml`, `.gcloudignore`, `deploy/check-upload.sh`
- Modify: `tests/hosting_test.sh` (section `upload`)

**Interfaces:**
- Produces:
  - `deploy/Dockerfile`, build context = repo root. Base `node:22-bookworm-slim` (glibc; pin the exact tag), two
    stages. Build stage: `npm ci` and `next build` in `/app/dashboard` with `NEXT_TELEMETRY_DISABLED=1`. Run stage:
    the built `/app/dashboard`, plus `outputs/store.duckdb` and `outputs/02_defect_register.csv` copied to
    `/app/outputs/`; `ARG DASHBOARD_COMMIT` → `ENV DASHBOARD_COMMIT`; `ENV DASHBOARD_REQUIRE_PASSWORD=1
    NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080`; `USER node`; working dir `/app/dashboard`; start
    `node node_modules/next/dist/bin/next start -H 0.0.0.0 -p $PORT` (shell form so `$PORT` expands). Whether to prune
    dev dependencies in the run stage is the builder's call; `next start` must still work.
  - `deploy/cloudbuild.yaml`: one `docker build -f deploy/Dockerfile --build-arg DASHBOARD_COMMIT=$_COMMIT -t $_IMAGE .`
    step and `images: [$_IMAGE]`; substitutions `_IMAGE`, `_COMMIT`.
  - `.gcloudignore`: the allow-list from Global Constraints, written as "ignore everything (`/*`), then re-include".
  - `deploy/check-upload.sh`: reads one path per line on stdin, prints every path outside the allow-list, exits 1 if
    any; exits 1 too if `outputs/store.duckdb` or `outputs/02_defect_register.csv` is missing from the list.

- [ ] **Step 1: Write the `upload` section of `tests/hosting_test.sh`**

Pipe made-up lists into `deploy/check-upload.sh`:
- allowed: `dashboard/app/page.tsx`, `dashboard/package.json`, `outputs/store.duckdb`,
  `outputs/02_defect_register.csv`, `deploy/Dockerfile`, `deploy/cloudbuild.yaml`, `.gcloudignore` → exit 0.
- that list plus, one at a time, `data/accounts.csv.gz`, `outputs/02_trace.csv`, `dashboard/node_modules/next/x.js`,
  `dashboard/.next/server/x.js`, `docs/STATUS.md`, `config/hosting.toml` → exit 1 and the bad path printed.
- the allowed list without `outputs/store.duckdb` → exit 1.
- If `gcloud` is installed: `gcloud meta list-files-for-upload` from the repo root piped into `deploy/check-upload.sh`
  → exit 0 (needs `outputs/store.duckdb` built; skip with a printed note if it is absent). If `gcloud` is missing,
  print a note and skip.

- [ ] **Step 2: Run to verify it fails**

Run: `tests/hosting_test.sh`
Expected: FAIL, `deploy/check-upload.sh` not found.

- [ ] **Step 3: Write `deploy/check-upload.sh`, `.gcloudignore`, `deploy/Dockerfile`, `deploy/cloudbuild.yaml`**

- [ ] **Step 4: Run to verify it passes**

Run: `tests/hosting_test.sh`
Expected: PASS, including the real `gcloud meta list-files-for-upload` list.

- [ ] **Step 5: Local container check (only if `docker info` succeeds; otherwise say it was skipped)**

Run from the repo root: `docker build -f deploy/Dockerfile --build-arg DASHBOARD_COMMIT=abc1234 -t dashboard-local .`
then `docker run --rm -d -p 3300:8080 -e DASHBOARD_PASSWORD=fixture-only-pass:word --name dashboard-local
dashboard-local`, then `EXPECT_COMMIT=abc1234 DASHBOARD_PASSWORD=fixture-only-pass:word deploy/check-live.sh
http://127.0.0.1:3300`, then `docker stop dashboard-local`.
Expected: check-live exits 0. Note the container's memory use from `docker stats --no-stream` after opening `/`,
`/executive` and `/trace` once; report it (it feeds Task 6's sizing).

- [ ] **Step 6: Stop for the user to commit.**

---

### Task 4: `deploy.sh` and its config

**Files:**
- Create: `config/hosting.toml`, `deploy/read_config.py`, `deploy/deploy.sh`
- Modify: `tests/hosting_test.sh` (section `deploy`), `deploy/check-live.sh` (read `SECRET`/`PROJECT` via the config
  reader when `DASHBOARD_PASSWORD` is unset)

**Interfaces:**
- Consumes: `deploy/check-upload.sh`, `deploy/check-live.sh`, `deploy/cloudbuild.yaml` (Tasks 2–3).
- Produces:
  - `config/hosting.toml`:
    ```toml
    # Hosting on Google Cloud Run (deploy/deploy.sh; design docs/superpowers/specs/2026-11-17-cloud-run-hosting-design.md).
    [google]
    project = ""            # the dashboard's own project ID (not the AI Studio project)
    region = ""             # every resource lives here
    [service]
    name = "dashboard"
    memory = "2Gi"          # measured in Task 6; change here
    cpu = 1
    max_instances = 1       # the cost ceiling
    min_instances = 0       # judging week: see deploy/README.md
    concurrency = 80
    [registry]
    repository = "dashboard"
    keep_images = 2
    [secret]
    name = "dashboard-password"
    ```
  - `deploy/read_config.py`: prints `PROJECT REGION SERVICE MEMORY CPU MAX_INSTANCES MIN_INSTANCES CONCURRENCY
    REPOSITORY KEEP_IMAGES SECRET BUCKET` as `KEY=<shlex-quoted value>` lines for `eval`; `BUCKET` is
    `<project>-dashboard-uploads`; exits 1 with "fill in config/hosting.toml: project and region" when either is empty.
    Run as `uv run --quiet python deploy/read_config.py`.
  - `deploy/deploy.sh` (no argument = deploy) and `deploy/deploy.sh setup`. Shell function
    `previous_revision` returns the serving revision name or an empty string.

**`setup` does, in order** (each step skips cleanly if the thing already exists):
enable `run`, `cloudbuild`, `artifactregistry`, `secretmanager` APIs; create the Docker repository `REPOSITORY` in
`REGION` with a cleanup policy keeping the newest `KEEP_IMAGES` images; create bucket `gs://BUCKET` in `REGION` with
uniform access, public access prevention enforced and a lifecycle rule deleting objects older than 1 day; if the secret
does not exist, generate a password of five random lowercase words of 4–8 letters from `/usr/share/dict/words`
(Python `secrets`), joined by `-`, create the secret with user-managed replication in `REGION` from stdin, print the
password once with "share it in a separate message from the link; it is not saved anywhere else"; grant the Cloud Run
runtime service account (the project's default compute account) `roles/secretmanager.secretAccessor` on that secret.

**Deploy does, in order:**
1. Refuse, with one plain line each, unless: current branch `main`; `git status --porcelain` empty; `gcloud config get
   account` non-empty; `outputs/store.duckdb` and `outputs/02_defect_register.csv` exist; the store is not older than
   the register (`-ot`); the secret exists.
2. `gcloud meta list-files-for-upload | deploy/check-upload.sh`, stop on failure.
3. `COMMIT=$(git rev-parse --short HEAD)`, `IMAGE=REGION-docker.pkg.dev/PROJECT/REPOSITORY/SERVICE:COMMIT`,
   `PREV=$(previous_revision)`.
4. `gcloud builds submit . --region REGION --config deploy/cloudbuild.yaml --substitutions _IMAGE=…,_COMMIT=…
   --gcs-source-staging-dir gs://BUCKET/source`.
5. `gcloud run deploy SERVICE --image IMAGE --region REGION --memory … --cpu … --max-instances … --min-instances …
   --concurrency … --port 8080 --allow-unauthenticated --set-secrets DASHBOARD_PASSWORD=SECRET:latest`.
6. `URL` from `gcloud run services describe … --format 'value(status.url)'`; `EXPECT_COMMIT=$COMMIT
   deploy/check-live.sh "$URL"`.
7. On a failed live check: print "The live check failed." and, if `PREV` is non-empty, `gcloud run services
   update-traffic SERVICE --region REGION --to-revisions PREV=100`; if empty, "This was the first deploy: there is no
   earlier version. Fix and deploy again, or delete the service (deploy/README.md, Taking it down)." Exit 1.
8. On success print the URL, the commit and the store's file time.

- [ ] **Step 1: Write the `deploy` section of `tests/hosting_test.sh`** (offline; no `gcloud` call may run)

- with `project = ""` (the committed config): `cd dashboard && ../deploy/deploy.sh` → exit 1, output contains
  `fill in config/hosting.toml`.
- with a temporary config (env `HOSTING_CONFIG` pointing to a made-up TOML with project `made-up-project`, region
  `made-up-region`) on a branch other than `main` → exit 1, output contains `main`. (`read_config.py` reads
  `HOSTING_CONFIG` if set, else `config/hosting.toml`.)
- source `deploy/deploy.sh` functions with `gcloud` replaced by a shell function that prints nothing:
  `previous_revision` → empty string, no error (Review Focus 4). Make this possible by guarding the main body with
  `if [ "${BASH_SOURCE[0]}" = "$0" ]`.

- [ ] **Step 2: Run to verify it fails**

Run: `tests/hosting_test.sh`
Expected: FAIL, `deploy/deploy.sh` not found.

- [ ] **Step 3: Write `config/hosting.toml`, `deploy/read_config.py`, `deploy/deploy.sh`; update `check-live.sh`**

- [ ] **Step 4: Run to verify it passes**

Run: `tests/hosting_test.sh`
Expected: PASS (all three sections).

- [ ] **Step 5: Stop for the user to commit.**

---

### Task 5: Docs and rules (controller writes these: they carry the conversation's reasons)

**Files:**
- Create: `deploy/README.md`
- Modify: `CLAUDE.md` (lines 27, 35, Commands, "Where new files go", "Before you finish a task"), `README.md` (lines 5
  and 73), `dashboard/README.md` (lines 7–8), `docs/DECISIONS.md` (append D-076), `docs/STATUS.md`

- [ ] **Step 1: Write `deploy/README.md`** with the sections the spec lists under "Docs and rules": what is hosted and
  why; one-time setup (new separate project, not the AI Studio one; link it to "My Billing Account"; budget alert at
  about $5 scoped to the new project only; `gcloud auth login`; fill `config/hosting.toml`; `deploy/deploy.sh setup`);
  updating after a code change and after a data change (the command sequences agreed on 17 Nov); what `deploy.sh`
  checks and does; rollback; sharing access and changing the password (`gcloud secrets versions add`, then deploy);
  judging week (link a few days early; min instances 1 vs. warming by hand, each with its cost; the local dashboard is
  the demo fallback); costs (paid account, no trial credit; free allowance; the cap); taking it down (delete service,
  images, bucket, secret, or the whole project) with the date.
- [ ] **Step 2: Update `CLAUDE.md`, `README.md`, `dashboard/README.md`** as the spec says.
- [ ] **Step 3: Append D-076 to `docs/DECISIONS.md`**; leave the approver and date as the one marked gap
  `(approver and date: to fill from the email)` if the user has not given them yet.
- [ ] **Step 4: Update `docs/STATUS.md`** (date, state, and the Doc-debt line: brief §5 vs. D-076).
- [ ] **Step 5: Verify**

Run: `uv run python scripts/check_docs.py`
Expected: exit 0.

- [ ] **Step 6: Stop for the user to commit.**

---

### Task 6: Go live (with the user; after the branch is merged to `main`)

Needs from the user: project ID, region, and the user's `gcloud auth login` and billing link.

- [ ] **Step 1:** User fills `config/hosting.toml` (`project`, `region`), merges to `main`, rebuilds the store if the
  outputs changed (`uv run python scripts/build_store.py`).
- [ ] **Step 2:** `deploy/deploy.sh setup`. Expected: APIs enabled, repository, bucket and secret created, password
  printed once.
- [ ] **Step 3:** `deploy/deploy.sh`. Expected: the live check prints all `PASS`, then the URL and commit.
- [ ] **Step 4:** In a real browser: open the URL, enter the password, click through the Data Map, the Executive view
  (including one rule, one account and one scenario drill-down) and the Trace page. Expected: no password prompt
  after the first, pages identical to local.
- [ ] **Step 5:** Size it: Cloud Run → service → Metrics, memory utilisation after Step 4. If peak is under 50% of
  `2Gi`, try `1Gi` in `config/hosting.toml`, deploy, repeat Step 4. Record the measurement and the chosen size in
  `deploy/README.md`.
- [ ] **Step 6:** Update `docs/STATUS.md`: hosted since <date>, takedown date. Neither the URL nor the password goes
  in the repo; the user shares the link and, separately, the password with judges and teammates.
