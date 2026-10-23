# Data Flow Explorer (dashboard)

A local web app for the team: how the ten tables join, where the raw keys break, which checks watch each handoff,
and what happens to one record as it moves from capture to NAV. It is the first page of the final dashboard
(brief §5, Dashboard); the executive view and monitoring come later on the same foundation.

**Confidential data.** The app serves the raw tables. It listens on `127.0.0.1` only. Never deploy it or put
`outputs/store.duckdb` anywhere public.

## Run it

From the repo root:

```bash
tests/run_notebook.sh                     # notebook 02 -> outputs/02_*.csv (the register the app shows)
uv run python scripts/build_store.py      # data + register -> outputs/store.duckdb (~15 s, ~400 MB)
cd dashboard
npm install                               # once
npx next telemetry disable                # once: Next.js sends no usage data
npm run dev                               # http://127.0.0.1:3000
```

Rebuild the store after notebook 02 changes; the app picks up the new file on the next page load.
`npm run build && npm start` runs the production version (same address).

## How it works

```
data/*.csv.gz ──► scripts/build_store.py (Python, DuckDB) ──► outputs/store.duckdb ──► dashboard/ (Next.js, read-only)
outputs/02_defect_register.csv ───────┘
```

- **Python builds, Next.js only reads.** The app never detects a defect (D-001). Rule counts come from notebook
  02's register; join health describes the raw keys before the notebook's cleaning.
- **One graph definition**, at the top of `scripts/build_store.py`: the office bands and handoffs of the control map
  (`scripts/fig_control_map.py`), the joins of Dataset Guide §2, and the rules from `docs/RULES.md` on each one
  (checked against RULES.md at build time). The app draws whatever the store says.
- `lib/store.ts` holds every query (read-only, bound parameters). `lib/data.ts` is what pages call: it waits for a
  real request, so nothing from the store is prerendered or cached. `lib/status.ts` is the one place statuses get
  their meaning and colour.
- Pages: `/` (data map: click a table or an arrow) and `/trace?id=…` (follow one record; the story buttons come
  from `outputs/02_trace.csv` and the register's examples).
- Stack: Next.js 16 (App Router, Cache Components), React Flow (`@xyflow/react`), DuckDB (`@duckdb/node-api`, same
  version as the Python package so it reads the file), shadcn/ui on Tailwind. This Next.js version differs from
  older tutorials: read `AGENTS.md` before changing it.

## Test

`tests/store_test.sh` from the repo root: builds a store from the made-up fixture, checks its tables, runs the vitest
suite (`dashboard/tests/`), then `next build`. Stop `npm run dev` first (they share `.next`).

## To merge into the docs

This branch (`dashboard`) adds files only, so the Check-in 2 branch stays untouched. After Check-in 2 is tagged
and merged, move this text to its home and delete this section.

**`docs/DECISIONS.md`** (next free number; D-048 on 21 Oct):

> ### D-048 · 21 Oct · Dashboard: local Next.js app over a Python-built store
>
> - **Decision:** the dashboard is a Next.js app in `dashboard/`. It reads one DuckDB file, `outputs/store.duckdb`,
>   built by `scripts/build_store.py` from the data and notebook 02's register. Python detects; the app only reads
>   and draws. It listens on 127.0.0.1 only and is never deployed. `uv` for Python, `npm` only inside `dashboard/`.
>   First page: the data map and record trace; per-record flags, the executive view and monitoring come later.
> - **Why:** the brief wants one functional executive view with record-level drill-down, packaged locally, with
>   figures that agree with the code outputs (brief §5, §7); Check-in 1 feedback asked for interactive visuals.
>   One store file keeps the app's numbers tied to the register (same checksum as FINDINGS.md).
> - **Instead of:** Streamlit (one language, but less control over the look the final view needs), or a Python API
>   server beside the app (a second process to run for no gain while the data is static).

**`docs/STATUS.md`**, under "Next: after Check-in 2":

> - **Dashboard:** data map and record trace done on branch `dashboard` (`dashboard/README.md`). Next: a
>   record-level flag table written by notebook 02 / `src/` into the store (the trace only knows the register's
>   examples today), then the executive view and the three persona wireframes.

**`CLAUDE.md`**: under Commands add `uv run python scripts/build_store.py`, `cd dashboard && npm run dev` and
`tests/store_test.sh`; under "Where new files go" add "Dashboard (Next.js): `dashboard/`"; under the rules add
"never deploy the dashboard or publish `outputs/store.duckdb`".

**Root `.gitignore`**: nothing to add; `dashboard/.gitignore` covers `node_modules/` and `.next/`, and the store is
already ignored by `outputs/*` and `*.duckdb`.
