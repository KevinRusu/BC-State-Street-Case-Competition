# Hosting the dashboard (Google Cloud Run)

The dashboard runs at a private Google Cloud Run address behind one shared password, for the judges and the team. It
is the same app and the same store you run locally (`dashboard/README.md`), packed into a container. The local
dashboard stays the official deliverable (brief §5) and the backup for the demo.

Why it is allowed and why this way: `docs/DECISIONS.md` (D-076). Design:
`docs/superpowers/specs/2026-11-17-cloud-run-hosting-design.md`.

**Who deploys:** only the project owner, from their Mac. Teammates keep sending pull requests; after a merge, the owner
deploys.

## What goes online, and what never does

| Goes into the container | Never leaves your laptop |
|---|---|
| `dashboard/` (the app's source; it is built inside the container) | `data/`, `docs/`, `reference/`, `notebooks/`, `tests/`, `scripts/`, `config/` |
| `outputs/store.duckdb` (all ten raw tables: the approval covers this) | every other file in `outputs/` |
| `outputs/02_defect_register.csv` (for the "out of date" badge) | your `node_modules/` and `.next/` folders |

`.gcloudignore` is the allow-list for the upload; `deploy/Dockerfile.dockerignore` is the same list for local Docker
builds. Before every upload, `deploy/deploy.sh` lists the files and stops if anything outside the list is there.

The password is checked twice: before any page runs (`dashboard/proxy.ts`) and again before any data is read
(`dashboard/lib/data.ts`). Inside the container the password is required; if it is missing, the site refuses everyone.
On your laptop nothing changes: no password, same commands as before.

## One-time setup

1. **Use a new Google Cloud project for the dashboard**, not the one Google AI Studio created. Console → project
   picker → New project. Note its **project ID**. Link it to your billing account (Billing → Account management →
   link the project).
2. **Budget alert:** Billing → Budgets & alerts → Create budget, about **$5**, scoped to **the new project only**, so AI
   Studio spending does not trigger it. An alert only emails you; it does not stop spending (the one-copy cap below
   does that).
3. **Log in on your Mac:** `gcloud auth login` (the tool is already installed).
4. **Fill in `config/hosting.toml`:** `project` (the ID from step 1) and `region` (the Google region nearest to you and
   the judges, e.g. `europe-west1` or `us-east1`). Every copy of the data stays in that region.
5. **Merge to `main`**, then run from the repo root:

   ```bash
   deploy/deploy.sh setup
   ```

   It switches on the Google services it needs, creates a private image repository (keeps the newest 2 images), a
   private upload bucket (deletes uploads after a day), and the password. **The password is printed once**: copy it
   into your password manager. It is stored only in Google Secret Manager. Running `setup` again is safe; it never
   changes an existing password.

## Updating the live site

`deploy/deploy.sh` always ships the code and the data together, from the commit you are on.

**After a code change** (e.g. a merged pull request):

```bash
git switch main && git pull
cd dashboard && npm ci && cd ..           # only if package.json or package-lock.json changed
deploy/deploy.sh
```

`npm ci` installs exactly what the lockfile says and never rewrites it; `npm install` can change
`package-lock.json`, and `deploy.sh` refuses to run on uncommitted changes.

**After a data change:**

```bash
tests/run_notebook.sh
uv run python scripts/build_store.py
tests/store_test.sh
deploy/deploy.sh
```

A deploy takes about 5–10 minutes, mostly uploading the store. What it does:

1. **Refuses to start** unless you are on `main`, with no uncommitted changes, logged in to `gcloud` with an account
   that can see the project, the store and the register exist, the store is not older than the register, and `setup`
   has been run. Each problem gets one line.
2. **Checks the upload list** against the allow-list.
3. **Builds** the container on Google's machines (Cloud Build) and stores it in the private repository.
4. **Deploys** it to Cloud Run: at most **1** running copy, **0** when idle. The old version keeps serving until the
   new one is ready.
5. **Checks the live site** (`deploy/check-live.sh`): every page asks for the password and opens with it; the page
   shows the commit you deployed; static files and the icon need the password too; the store and the register cannot
   be reached by any address; search engines are told not to list the site.
6. **Reports** the address, the live commit and the store's file time. If the check failed, it puts the previous
   version back and says so. On the very first deploy there is no previous version: it closes the site to everyone
   instead (removes public access), and the next `deploy/deploy.sh` opens it again.

The live version is shown in the header badge as `live <commit>`.

## Rolling back by hand

In every command below, `<project>` and `<region>` are the values in `config/hosting.toml`. Always pass `--project`:
your `gcloud` default project is probably the one AI Studio created, not the dashboard's.

```bash
gcloud run revisions list --service dashboard --region <region> --project <project>
gcloud run services update-traffic dashboard --region <region> --project <project> --to-revisions <revision-name>=100
```

The next `deploy/deploy.sh` sends traffic back to the newest version by itself.

## Sharing access

- Send the **link** in one message and the **password** in another. Never put the password in the deck, the report,
  the repo or a screenshot. The address is not written in the repo either.
- **Changing the password** (e.g. if it was forwarded): make a new one (e.g. five random words joined by `-`), store
  it, then deploy so the site picks it up. Never type the password into a command: it would stay in your shell
  history. `read -rs` asks for it without showing it; type it and press Enter.

  ```bash
  read -rs PW
  printf '%s' "$PW" | gcloud secrets versions add dashboard-password --project <project> --data-file=-
  unset PW
  deploy/deploy.sh
  ```

  Use `printf '%s'`, not `echo`: a trailing newline would become part of the password. Then switch the old password
  off: list the versions and disable the older one (the newest is the one in use).

  ```bash
  gcloud secrets versions list dashboard-password --project <project>
  gcloud secrets versions disable <old-version-number> --secret dashboard-password --project <project>
  ```

## Judging week

- **A few days before:** send the judges the link and the password and ask them to confirm it opens. Company networks
  sometimes block new `*.run.app` addresses or the browser's password box; better to know early.
- **On the day, pick one:**
  - **Warm it up by hand (free):** open the site yourself a few minutes before the demo. A judge who opens it cold at
    another time waits about 10–20 seconds once.
  - **Keep one copy always on (a few dollars for two or three days):** set `min_instances = 1` in
    `config/hosting.toml` and deploy the day before; set it back to `0` and deploy when judging ends.
- **Backup:** the local dashboard on the presenting laptop (`dashboard/README.md`, "Run it"), started before the demo.

## Costs

The billing account is a paid account (no free trial credit), so anything above Google's monthly free allowance is
charged to the card.

- **Normal use:** inside Cloud Run's free allowance (the app shuts down when idle).
- **Image storage:** each image is about 2 GB before compression and the repository keeps 2; that is a little over the
  free 0.5 GB, so cents a month.
- **The ceiling:** at most one running copy, so even a flood of requests cannot start more. Requests without the
  password are refused before any page or query runs.
- **The worst case:** one copy running nonstop all month at 1 vCPU / 2 GiB would cost roughly $50–60; the one-copy
  cap makes that the ceiling. The budget alert tells you long before.
- **Memory:** measured locally at about 120 MiB after opening the Data Map, the Executive view and the Trace page;
  `config/hosting.toml` starts at 2 GiB and is sized down after the first real deploy.

## Taking it down

Planned takedown date: **(to fill: after judging)**. Either delete the whole project (Console → IAM & Admin →
Settings → Shut down; stops all charges), or delete the parts:

```bash
gcloud run services delete dashboard --region <region> --project <project>
gcloud artifacts repositories delete dashboard --location <region> --project <project>
gcloud storage rm --recursive gs://<project>-dashboard-uploads --project <project>
gcloud storage rm --recursive gs://<project-number>-<region>-cloudbuild-logs --project <project>
gcloud secrets delete dashboard-password --project <project>
```

The second bucket holds Cloud Build's logs (`deploy/cloudbuild.yaml` keeps them in your project and region). The
project number is on the Console's project dashboard, or:
`gcloud projects describe <project> --format 'value(projectNumber)'`.

## When something goes wrong

- **The build fails with a permission error** (`PERMISSION_DENIED`, `does not have storage.objects.get
  access`, `artifactregistry...uploadArtifacts denied`, or a logs bucket it cannot create): in new projects Cloud Build
  runs as the Compute Engine default service account, and Google may not have given it the roles it needs. Give it the
  Cloud Build role, then run `deploy/deploy.sh` again:

  ```bash
  gcloud projects add-iam-policy-binding <project> --project <project> \
    --member serviceAccount:<project-number>-compute@developer.gserviceaccount.com \
    --role roles/cloudbuild.builds.builder
  ```

- **The build fails with a `buildx` or BuildKit error:** delete the two `env:` lines (`DOCKER_BUILDKIT=1`) from
  `deploy/cloudbuild.yaml` and the check for them in `tests/hosting_test.sh`, commit, and deploy again. The upload is
  already filtered by `.gcloudignore`, so the build does not need BuildKit for that.
- **Every request answers 403 (a Google error page, no password box):** an organisation policy on your Google
  account blocks public (`allUsers`) access to Cloud Run. It happens with school or company accounts; make the project
  under a personal account with no organisation, or ask the organisation's admin.
- **Setup stopped after printing the password** (e.g. the Compute Engine service account did not exist yet; it can
  take a minute after the first run): the password is already saved. Run `deploy/deploy.sh setup` again; it keeps the
  password and finishes the rest. If you did not copy the password, set a new one (Sharing access,
  Changing the password).
- **Setup says the secret exists, but the deploy fails on the secret:** the secret was created without a password in
  it. Add one with the steps in Changing the password, run `deploy/deploy.sh setup` again, then deploy.

## Notes for whoever changes this

- The build installs **npm 11.6.2** before `npm ci`: the lockfile is written by npm 11 (Node 24), and the npm 10 in the
  Node 22 image reads it as out of sync. If the lockfile's npm version changes, change it in `deploy/Dockerfile`.
- Tests: `tests/hosting_test.sh` (the upload allow-list, the password and live check against a local production server
  of the made-up fixture, the live check against a stand-in for Google's front end, and `deploy.sh`'s refusals and
  steps with `gcloud` replaced by a stub; it never calls Google).
