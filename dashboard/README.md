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
- **One graph definition**, at the top of `scripts/build_store.py`: a grid of office rows and stage columns (D-049
  below), each table in the row of the office that handles it (the owner of its check, from `scripts/framework.json`)
  with a "comes from" chip (data chips read their values from the data at build time), the handoffs of the control
  map, the joins of Dataset Guide §2, and the rules from `docs/RULES.md` on each one. Build-time checks keep it
  consistent with RULES.md and framework.json and place every register line on exactly one table or line of the map,
  so the summary cards always add up to what the map shows. The app draws whatever the store says.
- `lib/store.ts` holds every query (read-only, bound parameters). `lib/data.ts` is what pages call: it waits for a
  real request, so nothing from the store is prerendered or cached. `lib/status.ts` is the one place statuses get
  their meaning and colour (one job per colour: brand blue `#001AFF` for our checks and selection, green / amber /
  red / grey for data health only; tokens in `app/globals.css`).
- Pages: `/` (data map: summary cards, the grid, and a panel listing the checks in flow order; click a table or an
  arrow) and `/trace?id=…` (follow one record: its steps as a timeline beside the map; the story buttons come from
  `outputs/02_trace.csv` and the register's examples). Two header buttons hide the menu and the panel.
- Stack: Next.js 16 (App Router, Cache Components), React Flow (`@xyflow/react`), DuckDB (`@duckdb/node-api`, same
  version as the Python package so it reads the file), shadcn/ui on Tailwind. This Next.js version differs from
  older tutorials: read `AGENTS.md` before changing it.

### Reading a trace

Link status describes whether expected records were found, not whether their values passed every control.
Known examples from notebook 02's register are overlaid at the map location assigned by the store builder and
on the corresponding timeline step. A confirmed negative-quantity finding can therefore make the transaction
red while its link badge still says "Linked records found". Raw evidence fields and the register reference appear
beside the finding. Downstream links are not marked invalid merely because an upstream record has a finding.

Trace badges count findings associated with this trace; the main data map retains population-wide counts.
This is an example-register view, not a complete record-level detector. "No register example matched" does not
certify a record as valid. New findings still require a notebook run followed by rebuilding the store.

The story list stays expanded while selecting different records. Use "Show fewer" to collapse it; selecting a
story still resets the search draft and individual timeline expansions for the newly selected record.

## Test

After `uv sync` in the repo root, run these commands inside `dashboard/`:

```bash
npm ci
npm test                         # prepares a synthetic fixture, then runs unit and store tests
npx playwright install chromium  # once per computer
npm run test:e2e                  # prepares the fixture, builds production, then runs browser workflows
npm run lint
```

The fixture comes from `tests/fixtures/small/`. Its real notebook outputs and database are generated under
`tests/runs/dashboard_fixture/` (unit tests) or `tests/runs/dashboard_browser_fixture/` (browser tests); the test story list includes additional examples from that register to exercise
the expanded list. Production data and `outputs/store.duckdb` are not changed.

Browser tests cover map details and lookups, panel/theme/menu controls, confirmed versus unresolved findings,
search and unknown IDs, expanded-list persistence, search/timeline reset, and a narrow viewport. Their production
server listens on `127.0.0.1:3100` and uses `.next-tests`, so it can run beside `npm run dev`. Results, failure
screenshots and traces stay in `tests/runs/dashboard_browser/`. A busy test port causes a failure rather than
reusing an unrelated server. Set `DASHBOARD_TEST_PORT` to use another port.

Optional runtime overrides: `DASHBOARD_TEST_PYTHON` selects an existing project Python environment instead of
`uv run`; `DASHBOARD_TEST_BROWSER` selects an installed Chromium-compatible browser instead of Playwright's
download. `npm test` also honors an explicitly supplied synthetic `STORE_PATH` for the existing shell harness.

The older Unix command `tests/store_test.sh` still checks store-building contracts and runs the unit suite plus
a normal production build. Stop `npm run dev` before that command, since its build uses the shared `.next` folder.

## To merge into the docs

This branch (`dashboard`) adds files only, so the Check-in 2 branch stays untouched. After Check-in 2 is tagged
and merged, move this text to its home and delete this section.

**`docs/DECISIONS.md`** (next free numbers: D-048 on 21 Oct, D-049 on 23 Oct):

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

> ### D-049 · 23 Oct · Dashboard data map: offices as rows, the flow as columns
>
> - **Decision:** the map is a grid. Rows are the offices (front, middle, back) plus a separate "Independent
>   sources" strip; columns are the flow (Address books, Transactions, Positions, NAV & ledger). A table sits in
>   the row of the office that handles it: the owner of its check (`scripts/framework.json`). Where its data
>   comes from is a chip on the box: solid when the data names the source (`transactions.source_system`,
>   `comparison_positions.source`, `prices.vendor`), dashed when it is our reasoning. Corporate actions moves to
>   the middle office. Colours have one job each: State Street blue `#001AFF` for our framework (check numbers,
>   selection), green/amber/red/grey for data health only, soft greys for the office rows.
> - **Why:** the old map mixed where a table sits with where its data comes from (Corporate actions sat in the
>   front office although its check belongs to the Corporate actions lead, middle office). Brief §4 asks for the
>   stages "against the three offices"; brief §3 says master data feeds the flow.
> - **Instead of:** the Check-in 1 bands with an outside column (still in `docs/figures/01_control_map.png`), or
>   master data in a strip above the offices.

**`docs/STATUS.md`**, under "Next: after Check-in 2":

> - **Dashboard:** data map and record trace done on branch `dashboard` (`dashboard/README.md`); the map is an
>   office × stage grid (D-049). Next: a record-level flag table written by notebook 02 / `src/` into the store (the
>   trace only knows the register's examples today), then the executive view and the three persona wireframes.

and under "Doc debt":

> - `docs/figures/01_control_map.png` (`scripts/fig_control_map.py`) still shows the Check-in 1 bands; the
>   dashboard map (D-049) uses the office × stage grid. Redraw it for the final deck if the team wants one picture.

**`CLAUDE.md`**: under Commands add `uv run python scripts/build_store.py`, `cd dashboard && npm run dev` and
`tests/store_test.sh`; under "Where new files go" add "Dashboard (Next.js): `dashboard/`"; under the rules add
"never deploy the dashboard or publish `outputs/store.duckdb`".

**Root `.gitignore`**: nothing to add; `dashboard/.gitignore` covers `node_modules/` and `.next/`, and the store is
already ignored by `outputs/*` and `*.duckdb`.
