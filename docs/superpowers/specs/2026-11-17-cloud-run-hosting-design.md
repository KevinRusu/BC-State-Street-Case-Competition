# Hosting the dashboard on Google Cloud Run: design

Date: 17 Nov 2026. Branch: `cloud-run-hosting`.

## Intent

We have written approval to host the dashboard and its data on a public server (details in the DECISIONS entry this
work adds). Until now the brief (§5, Dashboard: "Do not publish the competition data through a public dashboard")
and our own rules kept it on `127.0.0.1`. The goal: judges and teammates open one link, type one shared password, and
get the dashboard exactly as it works locally: same pages, same numbers, same drill-down to the records.

Why Cloud Run (chosen in conversation, 17 Nov): the app runs live DuckDB queries on the server against a 386 MB file.
A container holding the app and the store runs it unchanged, ships code and data together as one version, and stays
inside Google's monthly free allowance at our traffic. It is also the way banks ship internal apps, which is the
learning value the user wants.

## Goals

- One link plus one shared password for judges and teammates; the dashboard behaves as it does locally.
- Code and data go live together, as one version tied to one git commit, with one command: `deploy/deploy.sh`.
- Every deploy is checked against the live site; a failed check says how to roll back.
- Cost is capped by design and free in practice (the monthly free allowance; no trial credit on this account).
- Local use (`npm run dev`, `npm start`, every test) is unchanged.
- A plain README tells the user and the team how to deploy, update, prepare for judging and take it down.

## Non-goals

- No automatic deploys on push (the store is not in git; code and data would drift apart).
- No custom domain, Cloudflare, uptime monitoring, load balancer or multi-region.
- No change to any check, score, query or number. No new dashboard feature beyond the version line.
- The local packaged dashboard stays the official deliverable (brief §5); hosting is a bonus.

## Anti-goals (a failure even if it works)

- Any file from `data/`, or any `outputs/` file other than the two the app needs, leaves the laptop. (Note: the
  store itself is a full copy of the ten raw tables and `/trace` shows raw rows; the approval must cover that.)
- Copies of the store land outside the chosen region: the build upload, the image and the service all stay in the one
  region in `config/hosting.toml` (regional Cloud Build, regional Artifact Registry), never the default US
  multi-region bucket.
- The `.duckdb` file is reachable by a URL, or any page is reachable without the password.
- The site runs without a password because a secret was missing (it must fail closed).
- The password appears in git, the deck, the report, a log or a test file.
- Local behaviour changes, or a number shown online differs from the outputs.

## Constraints found in the code

- `dashboard/lib/store.ts` finds the store via `STORE_PATH`, else `outputs/store.duckdb` relative to the parent of
  the working directory, and opens it read-only. It also reads `outputs/02_defect_register.csv` for the stale-store
  badge. So the container needs both files, at the same relative layout (`/app/dashboard` as working directory,
  `/app/outputs/…`).
- `npm start` binds `127.0.0.1`; the container must listen on `0.0.0.0` and Cloud Run's `$PORT`, set in the
  container's start command so `package.json` stays as it is.
- DuckDB is a native module. The lockfile already lists `@duckdb/node-bindings-linux-x64`, so a clean install on
  Linux (glibc, not Alpine) gets the right engine.
- Next.js 16: request interception is `proxy.ts` (formerly middleware). Read
  `dashboard/node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` and `dashboard/AGENTS.md` first.
- `npm run test:e2e` runs against the made-up fixture store, not the real data; it cannot be pointed at the live
  site. The live check is a separate script.
- `data/` is committed to git, so upload rules must be an allow-list, not a copy of `.gitignore`.

## Approaches considered

| | Chosen? | Trade-off |
|---|---|---|
| **Google Cloud Run**, one container with app + store | **Yes** | No query changes; code and data in one version; free allowance with no end date. Needs a card at signup; slow first load after idle (fixed for judging by keeping one copy on). |
| Vercel + MotherDuck | No | Push-to-deploy and preview links per PR, no card. But `store.ts` and the stale-store badge need rework, data ships separately from code, MotherDuck support for DuckDB 1.5.6 is unconfirmed, and the Hobby plan pauses the site for up to 30 days when a limit is hit. |
| Small VM (DigitalOcean via Student Pack) | No | Identical to local, but the most upkeep (patching, certificates, restarts) and nothing records how the server was built. |
| Supabase (Postgres) / AWS Fargate | No | Supabase: rewrite ~55 DuckDB queries, 500 MB free limit. AWS: App Runner closed to new customers; Fargate has no lasting free allowance (~$40–60/month after the 6-month credit). |

## The design

### Files (new home: `deploy/`)

```
deploy/README.md        how to deploy, update, prepare for judging, roll back, take down (for the user and team)
deploy/Dockerfile       the container
deploy/deploy.sh        the one command
deploy/check-live.sh    the live check (or .mjs; builder's call)
config/hosting.toml     project ID, region, service name, memory, CPU, max instances (policy lives in config/)
.gcloudignore           at the repo root (gcloud requires it there); an allow-list
```

### Container

- Node 20+ on Debian slim, runs as the non-root `node` user.
- Contents: `dashboard/` (installed with `npm ci`, built with `next build`), `outputs/store.duckdb`,
  `outputs/02_defect_register.csv`. Nothing else from `outputs/`, nothing from `data/`, `docs/`, `reference/`,
  `notebooks/`, `tests/`.
- Start: `next start -H 0.0.0.0 -p $PORT` with `NODE_ENV=production` and `NEXT_TELEMETRY_DISABLED=1`.
- Build arguments `DASHBOARD_COMMIT` (short git hash) and the store's build time become environment variables for the
  version line.
- Whether to use Next's `output: "standalone"` to shrink the image is the builder's call; if used it must not change
  local `npm start`.

### Password (shared, checked twice, fails closed)

- HTTP Basic authentication: the browser shows its own login box once; any username, the shared password.
- The password lives in Google Secret Manager and reaches the container as `DASHBOARD_PASSWORD`. Never in git.
- **Two checks:** `dashboard/proxy.ts` rejects requests without the right password before any page runs; and
  `lib/data.ts`'s `load()` checks the same header (via `headers()`) before any store read. A bug that skips one
  (as the 2025 Next.js middleware bypass did) does not open the data. Compare in constant time.
- **Fail closed:** the container sets `DASHBOARD_REQUIRE_PASSWORD=1`. With that set and no `DASHBOARD_PASSWORD`, every
  request is refused. Without `DASHBOARD_REQUIRE_PASSWORD` (local), there is no password check at all, so local use is
  unchanged.
- Responses carry `X-Robots-Tag: noindex, nofollow`; `robots.txt` disallows everything.

### Cloud Run settings (values in `config/hosting.toml`)

- Max instances **1** (cost ceiling: one copy nonstop at worst), min instances 0 (idle shuts down).
- Memory and CPU: start at 2 GiB / 1 vCPU, then **measure** on the full store (every page, the largest trace and
  rule pages) and set the smallest size with headroom. Record the measurement in the README.
- Region: the Google region closest to the user and judges (the user names it; it goes in the config).
- Public invoker (the password is the gate), default `run.app` address, no custom domain.

### `deploy/deploy.sh`

**Only the user deploys** (agreed in conversation), from macOS, so bash is fine and the Google project has one
account. Teammates keep sending pull requests; after merging, the user deploys. The README says so; it does not
document a Windows path or teammate roles.

1. **Refuse to start** unless: on `main`, working tree clean, `gcloud` logged in to the configured project, the store
   and register exist, the store is not older than `outputs/02_defect_register.csv`, the secret exists.
2. **Show what will upload** (`gcloud meta list-files-for-upload`) and stop if anything is outside the allow-list.
3. **Build and deploy:** build the image with Cloud Build into a private Artifact Registry repository, deploy it to
   Cloud Run with the settings from `config/hosting.toml`, the secret and the build arguments. The old version keeps
   serving until the new one is ready.
4. **Check live** (`deploy/check-live.sh`, below). On failure: say so, print the one rollback command with the
   previous revision name filled in. (Automatic rollback is the builder's call; printing the command is the minimum.)
5. **Report:** the link, the live commit, the store build time.

A one-time setup (enable the APIs, create the Artifact Registry repository with a "keep the latest 2 images" cleanup
policy, a 1-day delete rule on the Cloud Build upload bucket, create the secret from a generated five-word password)
is either a `deploy/deploy.sh setup` mode or a separate script; builder's call. The password is printed once for the
user to share, never written to a file.

### Live check (`deploy/check-live.sh`)

Reads the password from Secret Manager at run time (never stored). Fails the deploy if any of:

- Without the password: `/`, `/executive`, `/trace` do not answer 401.
- With the password: `/`, `/executive`, `/trace` do not answer 200, or the page does not show the deployed commit.
- With or without the password: `/store.duckdb`, `/outputs/store.duckdb`, `/../outputs/store.duckdb`,
  `/outputs/02_defect_register.csv` and URL-encoded variants answer anything other than 401/404.
- `robots.txt` does not disallow everything, or the `X-Robots-Tag` header is missing.

It never hard-codes a record ID (repo rule): any ID it needs comes from the live page itself.

### Version line

The footer (or the existing store badge in `components/shell/store-badge.tsx`) shows "Live version: `<commit>` · store
built `<time>`" when `DASHBOARD_COMMIT` is set. Locally it shows nothing new.

### Docs and rules

- **`deploy/README.md`** (new, for the user and teammates): what is hosted and why; one-time setup with the user's
  steps (account, trial, project, budget alert at ~$5, `gcloud` install and login); updating after a code change and
  after a data change (the exact command sequences agreed in conversation); what `deploy.sh` checks and does; rollback;
  sharing access (link in one message, password in another, never in the deck, repo or report; changing the
  password); judging-week routine (send judges the link a few days early so they can confirm it opens on their own
  network, since corporate networks sometimes block new `*.run.app` addresses or the browser login box; either min
  instances 1 from the day before until judging ends, then back to 0, or warming it up by hand before the demo, with
  the cost of each; **the local packaged dashboard is the stated fallback for
  the demo**, ready on the presenting laptop); costs and the trial ending (upgrade or let it stop); takedown (delete the service,
  images and upload bucket, or the whole project) with a date.
- **`CLAUDE.md`:** replace "Never deploy the dashboard or put `outputs/store.duckdb` anywhere public" with: deploy only
  with `deploy/deploy.sh`, which uploads only the app, the store and the register behind the shared password; never put
  `data/` or other outputs anywhere public. Keep "The data is confidential" with a pointer to the new DECISIONS entry.
  Add `deploy/deploy.sh` to Commands, `deploy/` to "Where new files go", and to "Before you finish a task": "If the
  live site should show this change, run `deploy/deploy.sh`."
- **`README.md`** (lines 5 and 73) and **`dashboard/README.md`** (lines 7–8): same correction, linking to
  `deploy/README.md`.
- **`docs/DECISIONS.md`:** new entry D-076 (never rewriting D-0xx entries that said "never deployed"): the approval
  (who, date, what it covers, where the email is kept), that it amends brief §5 for us, the platform choice and why,
  the password, the cap, the allow-list, and the takedown date.
- **`docs/STATUS.md`:** the new state, and "Doc debt": brief §5 says no public dashboard; D-076 records the approval.
- `uv run python scripts/check_docs.py` must pass.

### Tests

- Unit tests (dashboard `npm test`) for the password check: correct, wrong, missing header; required-but-unset fails
  closed; not required means no check.
- Existing suites still pass unchanged: `npm test`, `npm run test:e2e`, `tests/store_test.sh`.
- The live check is run by `deploy.sh` and can be run alone.
- A local container run (`docker run` with a test password) is the builder's call if Docker is available; Cloud Build
  is enough otherwise.

## What the user still has to give

Settled 17 Nov: the approval covers **everything**, including the record-level raw data, with no limit on where it
is stored (user, 17 Nov). The project lives under the user's **personal Google account**, which already has a Google
AI Studio account and is logged in to Google Cloud. Because of that, the README tells the user to create a **new,
separate project** for the dashboard (not the project AI Studio made): its secret, billing alert and takedown then
touch nothing else, and deleting it at the end is safe. The billing account is already a **paid account** (charges since 28 Oct 2026,
from the user's AI Studio project), so the $300 trial is not available: the site runs on the monthly free allowance
from day one, and anything above it is billed (the one-instance cap still bounds it). The README therefore gives the
judging-week choice with its cost: keep one copy always on (a few dollars for two or three days) or open the site
yourself a few minutes before the demo so it is warm (free; a judge opening it cold waits ~10–20 s once). The budget
alert is scoped to the new project only.

1. **Approval details** for D-076: who approved and the date (and where the email is kept).
2. **Google Cloud project ID** and **region** (nearest to the user and judges), after creating the account, trial,
   project and budget alert, and logging in with `gcloud`.
3. **Takedown date** (after judging).

## Left to the builder

Standalone output or not; `.sh` versus `.mjs` for the live check; one setup mode or a separate script; automatic
rollback or printed command; exact image base tag; how `deploy.sh` reads `config/hosting.toml` (e.g. a short
`uv run python` call); where the version line sits.
