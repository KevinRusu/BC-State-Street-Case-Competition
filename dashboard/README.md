# Data Flow Explorer (dashboard)

A local web app for the team: how the ten tables join, where the raw keys break, which checks watch each handoff,
and what happens to one record as it moves from capture to NAV. It is the first page of the final dashboard
(brief §5, Dashboard); the [executive view](#executive-view) is on the same foundation; monitoring comes later.

**Confidential data.** The app serves the raw tables. Locally it listens on `127.0.0.1` only. The only hosted copy is
the one `deploy/deploy.sh` ships, behind a shared password ([deploy/README.md](../deploy/README.md), D-076); never put
`outputs/store.duckdb` anywhere else.

## Run it

You need uv and Node.js 20.9 or newer (Windows setup: the root [README](../README.md#setup)). From the repo root:

```bash
uv sync                                   # once: Python environment (the store builder and the notebook need it)
tests/run_notebook.sh                     # the deliverable notebook -> outputs/02_*.csv (the register the app shows)
uv run python scripts/build_store.py      # data + register -> outputs/store.duckdb (~15 s, ~400 MB)
cd dashboard
npm install                               # first time, and after any pull that changes package.json or package-lock.json
npx next telemetry disable                # once: Next.js sends no usage data
npm run dev                               # http://127.0.0.1:3000
```

Rebuild the store after the deliverable notebook changes; the app picks up the new file on the next page load.
`npm run build && npm start` runs the production version (same address).

## How it works

```
data/*.csv.gz ──► scripts/build_store.py (Python, DuckDB) ──► outputs/store.duckdb ──► dashboard/ (Next.js, read-only)
outputs/02_defect_register.csv ───────┘
```

- **Python builds, Next.js only reads.** The app never detects a defect (D-001). Rule counts come from notebook
  02's register; join health describes the raw keys before the notebook's cleaning.
- **One graph definition**, at the top of `scripts/build_store.py`: a grid of office rows and stage columns (D-055
  in `docs/DECISIONS.md`), each table in the row of the office that handles it (the owner of its check, from `scripts/framework.json`)
  with a "comes from" chip (data chips read their values from the data at build time), the handoffs of the control
  map, the joins of Dataset Guide §2, and the rules from `docs/RULES.md` on each one. Build-time checks keep it
  consistent with RULES.md and framework.json and place every register line on exactly one table or line of the map,
  so the summary cards always add up to what the map shows. The app draws whatever the store says.
- `lib/store.ts` holds every query (read-only, bound parameters). `lib/data.ts` is what pages call: it waits for a
  real request, so nothing from the store is prerendered or cached. `lib/status.ts` is the one place statuses get
  their meaning and colour (one job per colour: brand blue `#001AFF` for our checks and selection, green / amber /
  red / grey for data health only; tokens in `app/globals.css`).
- Pages: `/` shows the Data Map with the finding summary stacked to the right on wide screens and the details below.
  The summary splits what our checks flagged into real problems (confirmed, unresolved) and false alarms ruled out
  (cleared); **Show which** lists the cleared findings (D-075).
  Select a table or connection and use **View details** when you want to move to its information below. **Back to map**
  returns to the canvas. The header buttons toggle
  the menu and the details. `/trace?id=…` follows a record in a timeline beside its map, with examples from
  `outputs/02_trace.csv` and the register.
- **Calm layout (D-058).** The map panel starts as a stage overview (one line per stage, in map order) with folded
  sections; clicking a place shows its plain sentence and finding counts first, then "What we found", "Who owns
  this", "Raw key counts (technical)" and "Columns". The Trace page shows a plain headline, a numbered timeline (only
  steps with a finding open by default) and a "Technical details" link for rule IDs, register lines and the caveat.
- Stack: Next.js 16 (App Router, Cache Components), React Flow (`@xyflow/react`), DuckDB (`@duckdb/node-api`, same
  version as the Python package so it reads the file), shadcn/ui on Tailwind. This Next.js version differs from
  older tutorials: read `AGENTS.md` before changing it.

### Plain wording

Every sentence a reader sees about a finding, a stage or a map place comes from one reviewed file,
`scripts/plain_language.json`: findings (keyed by the register's exact `finding` text), `stages`, `nodes`, `edges`,
the `status` phrases and the `lead_in` prefixes for findings that reach a record through another record.
`scripts/build_store.py` loads it into the store, so no wording lives in React code. Edit the file, then rebuild the
store (`uv run python scripts/build_store.py`).

- A finding with no wording falls back to the register's text and the build prints a warning listing it. A node,
  edge or stage with no wording fails the build.
- `uv run python scripts/check_docs.py` fails when a finding in the full-data register has no wording.
- A store built before the wording existed still loads: findings show the register text and the headline asks for a
  rebuild.
- Unresolved findings say what the data "matches" or what "would fit", never the cause as fact.

### Logo and startup screen

- The logo comes from the supplied PNG in `dashboard/brand/state-street-logo-source.png`. To remake the transparent
  blue and white versions in `dashboard/public/brand/`, run `uv run python scripts/build_logo.py` from the repo root.
  The header and sidebar pick the blue one in light mode and the white one in dark mode; one logo is always on screen,
  in the top bar when the sidebar is hidden.
- The startup screen (`components/shell/boot-screen.tsx`, Motion 14.6.0) is a logo reveal of about 2 seconds. It is
  decoration: the dashboard loads underneath and the bar claims no real progress. It plays once per browser session;
  the session key is `dfe-boot-seen` in `sessionStorage` (`components/shell/boot-flag.ts` also holds the pre-paint
  script that stops a flash on later page loads). A click or any key skips it, and reduced-motion settings remove the
  movement. To see it again, open a private window or clear that key in the browser's storage panel.
- The browser tests mark the screen as seen so they are not blocked; one test checks that it plays, skips and does
  not return.

### Reading a trace

Link status describes whether expected records were found, not whether their values passed every control.
Every register line that counts the traced record, its account, its security or their key is overlaid at the map
location assigned by the store builder and on the corresponding timeline step. The full list of records behind
each line comes from `outputs/02_finding_members.csv` (D-056), not only the line's examples. A confirmed
negative-quantity finding therefore makes the transaction red while its link badge still says "Linked records
found". Raw evidence fields and the register reference appear beside the finding. Downstream links are not marked
invalid merely because an upstream record has a finding.

Trace badges count findings associated with this trace; the main data map retains population-wide counts. A record
with no badge is still not certified valid: rules that are not coded yet find nothing, and currency-level findings
(FX coverage, the USD rate) name no record. New findings still require a notebook run followed by rebuilding the
store; the header badge says "out of date" when the register on disk has changed since the store was built.

Choosing another example from the picker resets the search draft and the timeline expansions for the newly selected
record. The headline shows the record's own findings before indirect ones; everything technical is behind "Technical
details".

The desktop trace workspace puts the picker above the map in the left three-quarters of the workspace. The record
summary and numbered steps sit on the right and scroll independently. The map and picker stay in place when a
different example loads. Selecting a traced box jumps within the steps pane. Manual lookup is folded under
"Find an ID" beside the picker. On narrow screens the panels stack and the page scrolls.

Both maps stop zooming out at the centred whole-grid view. Zoom in to pan around; Fit View restores the default.
Resizing the window or toggling a menu/panel recomputes the fit and its zoom-out limit.

Transactions is centred across the front/middle office boundary, including when trace labels change its height.
Pipeline events and Corporate actions have clear vertical gaps and stay fully inside the middle-office band.
The store's graph definition carries the positions and vertical anchors (D-062); rebuild the store after changing them.

Accounts and Ledger NAV are centred within their office bands. Both views group the offices inside a labelled
muted blue outline and distinguish independent sources with a stronger dashed boundary (D-063, D-064).
Office fills and the outline use a coordinated blue-grey palette in both themes; context boxes remain readable
while the finding colours keep their usual meanings. The palette tokens live in `app/globals.css`.
In a record trace, click a traced map box to open or close its matching steps; multiple steps at one box toggle as
a group. Map buttons and timeline headers share expansion state, including keyboard activation. Context-only boxes
have no matching step and are disabled. Changing records restores the normal finding-based default expansions.

## Executive view

`/executive` shows the platform's state using the deliverable outputs loaded into the store. Every section opens
with one plain line saying what it is for; the line shows even while a section is closed (D-075).

**Executive Metrics.** The three headline cards and the Domains subsection form one group. Each headline
card opens to reveal its supporting details.

- Platform score, with coverage, the confirmed-only comparison and the credit applied to unresolved-only cases in its details, from `scorecard`
  (`outputs/02_scorecard.csv`). The bar marks the platform target of 95.00.
- Largest impact scenario: the priced scenario with the largest gross dollar figure, with its share of rows priced
  and its evidence status, from `severity` (`outputs/02_severity.csv`). It is one scenario, never a total.
- Early Warning Signs Triggered shows how many computed leading indicators triggered during the reporting period.
  The pre-cutoff booking indicator replays trade-level alerts and plots the daily count for each feed.
  Open the card for the dates and the indicator list. The count comes from `indicators` and the dates come from
  `indicator_series`.

- Domains: a compact card per domain on a common 0–100 scale. Coverage, confirmed-only score and owner are in its
  details. A domain's name opens the triage list filtered to that domain. The bars mark the minimum targets, using
  the pilot defaults when the scorecard has no targets, including 99.50 for NAV. The platform and domain tags and bars use green when the
  score meets its target, amber when it is up to 5% below the target, and red when it is more than 5% below.
  KPI targets are in the KPI table.

**Early Warning Signs (Leading Indicators)**

- Three shorter cards stack beside pre-cutoff booking alerts when space allows.
  Pricing readiness is the Executive View label for fresh, agreed price coverage. The booking alert threshold
  and replay description are in Indicator details. Each chart shows its unit,
  the values at the top and bottom of its range, the first and last dates, and a dashed line at the threshold. The
  range always includes the threshold, so a line far from its limit looks flat (D-072). Hover over a chart, or focus
  it and use the arrow keys, to see a point's date, value, limit and whether it breached. The details contain the
  thresholds, recorded breaches, owner, look-back, or inputs needed. Sources are `indicators`, `indicator_series` and
  `indicator_lookback` (`outputs/02_indicators.csv`, `outputs/02_indicator_series.csv`,
  `outputs/02_indicator_lookback.csv`).

**KPIs by Office**

- From `kpis` (`outputs/02_kpis.csv`). Hover over a row for its formula.

**Worst Accounts**

- The five lowest-ranked accounts by default, with their score, coverage and confirmed-only score, and each domain's
  score with its coverage under it (an account's domain scores have no confirmed-only score), from
  `scorecard_accounts` (`outputs/02_scorecard_accounts.csv`). Expand the list for the rest of the loaded ranking.
  A lookup opens any account by its ID.

**What to Fix First**

- Rules and impact scenarios, ranked by score or by dollars (the switch is the `by` address parameter). Each view
  shows five rows with a control for revealing the rest. Scenario descriptions open on demand. A rule shows
  its plain name from `scripts/plain_language.json` (here and on the rule page); its units come from
  `score_outcomes` (`outputs/02_score_outcomes.csv`). Scenarios come from `severity` and their keys from
  `impact_detail` (`outputs/02_impact_detail.csv`).

**Data Integrity Status**

Select the section heading to open the stress test and sensitivity results. The section starts collapsed.

- Stress test: the planted-defect, look-alike and priority-flip rates, the before and after measures and the run
  facts, from `stress_rates`, `stress_impact` and `stress_run` (`outputs/03_stress_rates.csv`,
  `outputs/03_stress_impact.csv`, `outputs/03_stress_run.csv`). The rates hold only for the sample drawn. This part
  needs `tests/stress_test.sh` to have been run, then a rebuilt store; without it the page says the test has not
  been run. If the run's platform score before injection differs from the current scorecard's, the page says the
  results come from an older run.
- Sensitivity: the platform score under the alternative weightings, shown beside the main score (never instead of
  it), from `scorecard_sensitivity` (`outputs/02_scorecard_sensitivity.csv`). The per-domain rows are folded under
  "By domain".

**Drill-down paths.** Three, each ending in the record trace:

1. A rule row opens every unit of the rule that is not a plain pass (failed, cleared or not evaluable), with a
   "Trace" link per unit that has a record to trace.
2. A scenario row opens its keys with their dollars; a key with a record to trace (its ledger line, else its account
   and security) has a "Trace" link, and a key with neither shows a dash.
3. A worst-account row (or the account lookup, by account ID) opens the account page with the account's units, its
   own and those it inherits through its holdings, from `account_outcomes` (`outputs/02_account_outcomes.csv`), and
   the same Trace links.

**Blanks.** A part whose table the store lacks shows a note asking for a rebuilt store
(`uv run python scripts/build_store.py`); the rest of the page still renders. In a cell:

- A dash means the value is blank in the output: unknown, never zero.
- "not priced" means no dollar figure exists for that item.
- "not computed" means a KPI's or an indicator's inputs were not available, so it has no value.
- "not applicable" means the measure does not apply to that row.

**Do not add scenarios up.** Impact scenarios overlap (one security can sit in several), so their dollars are
alternatives, not parts of a total, and units of different kinds are never added into one rule total.

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
`tests/runs/dashboard_fixture/` (unit tests) or `tests/runs/dashboard_browser_fixture/` (browser tests); the story
picker there lists the fixture trace and the first traceable example of each register line. Production data and
`outputs/store.duckdb` are not changed.

Browser tests also cover the executive view (its figures against the fixture's own CSV files, the three
drill-downs, and the stress and sensitivity part over made-up stress files from `tests/stress_fixture.py`).

Browser tests cover map details and lookups, panel/theme/menu controls, confirmed versus unresolved findings (and
the headline's tone), the no-finding caveat, every "Trace an example" link, search and unknown IDs, the story picker,
search/timeline reset, the logo in light and dark mode, the startup screen (plays once, skips on a key, survives
blocked storage), the logo and folded ID lookup on a narrow viewport, the map zoom floor and recentring after
resizing, every fixture story's desktop layout, node spacing and office alignment, map-to-step toggles (including
groups, keyboard activation and expansion reset), map-to-evidence scrolling, and the office/source boundaries in
both themes. Their production
server listens on `127.0.0.1:3100` and uses `.next-tests`, so it can run beside `npm run dev`. Results, failure
screenshots and traces stay in `tests/runs/dashboard_browser/`. A busy test port causes a failure rather than
reusing an unrelated server. Set `DASHBOARD_TEST_PORT` to use another port.

Optional runtime overrides: `DASHBOARD_TEST_PYTHON` selects an existing project Python environment instead of
`uv run`; `DASHBOARD_TEST_BROWSER` selects an installed Chromium-compatible browser instead of Playwright's
download. `npm test` also honors an explicitly supplied synthetic `STORE_PATH` for the existing shell harness.

The older Unix command `tests/store_test.sh` still checks store-building contracts and runs the unit suite plus
a normal production build. Stop `npm run dev` before that command, since its build uses the shared `.next` folder.
