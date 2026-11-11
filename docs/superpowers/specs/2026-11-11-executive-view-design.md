# Design: executive view (Check-in 3, step 4)

*Approved 11 Nov 2026 (builder check done), built and reviewed the same day (§8). Branch: `executive-view`. Build plan:
`docs/superpowers/plans/2026-11-11-executive-view.md`. Choices marked **(Claude's call)** were made without the user;
everything else the user decided in the 11 Nov brainstorm.*

## 1. Intent and why

Brief §5 "Dashboard" (`reference/01_Student_Brief.md`) asks for "one functional executive view with a working
drill-down to record-level evidence", run locally, with displayed figures that agree with the code outputs. Brief §2
names the reader: the Chief Data Officer, who "needs the roll-up: where the platform is degrading, what it is
costing, and what to fix first". Check-in 3 (brief §8) lists "working executive view".

The dashboard has no such page today. The sidebar shows "Executive view" as a disabled placeholder
(`dashboard/components/shell/app-sidebar.tsx`). The store already holds the scorecard, indicator and KPI tables
(D-069), and no dashboard file reads them. The stress test results (D-070) and the dollar impact (D-050) are not in
the store.

This session adds the page. It presents what the scorecard, the indicators, the KPIs, the severity section and the
stress test already produce. It adds no check, no score and no formula (D-066).

## 2. Goals, non-goals, anti-goals

**Goals**
- One page, "Executive view", that answers the Chief Data Officer's three questions top to bottom, and a fourth the
  judges will ask: can the numbers be trusted.
- A working drill-down on three paths, each ending on the existing Trace page for one record:
  - domain → rule → the records behind the rule → trace;
  - worst accounts (or any account ID) → the account's scores and records → trace;
  - impact scenario → its account and security keys with their dollar figure → trace.
- Every number on the pages is read from the store, which copies the notebook's and the stress script's CSV files. A
  test compares page text with those files.
- One additive notebook output so an account page can list every record behind an account's score (§5.6).

**Non-goals**
- No new detection rule, score, weight, threshold or combined urgency score (D-066; D-050's "no combined score"
  stays in force for the severity measures). The sort switch in §5.3 orders two existing lists; it does not merge
  them.
- No mapping from impact scenarios to rules, and no owner per scenario.
- No wireframes for the three office personas (the final, not Check-in 3; `docs/STATUS.md`).
- No "Monitoring" page, no AI summary.
- No change to the Data map or the Trace page beyond what a link into them needs.
- No per-fund impact table (`outputs/02_fund_impact.csv` stays out of the store).
- No slides or report text (the team owns them).

**Anti-goals** (a failure even if the page renders)
- A number on a page that differs from the CSV it came from, or a total the notebook never computed (for example a
  sum of impact scenarios, which overlap).
- A score shown without its coverage, or an unknown dollar amount shown as zero (D-050).
- A drill-down that lists records the score did not count, or omits records it did count.
- A record ID, account ID or any data value typed into code, tests or docs (tests use `tests/fixtures/small` only).
- The dashboard deciding what is a defect. It reads outcomes; it never recomputes them (D-001, D-054).
- Anything that publishes the data: no deploy, no external script, font or chart service that sends data out.

## 3. Constraints

- CLAUDE.md rules: never modify `data/` or `reference/`; the data is confidential; read CSVs as text; never hard-code
  record IDs; thresholds in `config/`; no version suffixes; `uv` for Python, `npm` only inside `dashboard/`; numbers
  in docs come only from generated output; the notebook's code lives only in the `.ipynb` (D-037).
- `dashboard/AGENTS.md`: this Next.js version differs from the one in memory. Read the relevant guide under
  `dashboard/node_modules/next/dist/docs/` before writing a page, a route or a client component.
- The dashboard reads only `outputs/store.duckdb`, written by `scripts/build_store.py` (D-054). Every read lives in
  plain Node under `dashboard/lib/` (no Next.js imports) and pages go through `dashboard/lib/data.ts`.
- Colours keep one job each (`dashboard/app/globals.css`): brand blue for our framework and for links and selection;
  green, amber, red and grey for data health only. Both light and dark themes.
- Pages must work on a store built before this change: a missing table or column gives a plain "rebuild the store"
  message for that section, never a crash (the pattern `hasTable` / `hasColumn` in `dashboard/lib/store.ts`).
- Wording follows the calm dashboard (D-058): plain sentences, the technical ID small beside the plain name.
- The stress labels `tests/stress/cases.toml` are frozen by checksum (D-070) and must not be edited.

## 4. Facts about the data and code that shape the design

Checked 11 Nov against `outputs/store.duckdb`, `notebooks/deliverable.ipynb`, `scripts/` and `tests/`.

- **Store tables that exist and are unused by the dashboard:** `scorecard` (levels platform, domain, rule, test),
  `score_outcomes`, `scorecard_accounts`, `scorecard_sensitivity`, `indicators`, `indicator_series`,
  `indicator_lookback`, `kpis`. `scripts/build_store.py` loads them with `load_scorecard_table` from
  `SCORECARD_TABLES`; a missing CSV gives a table with a single `note` column.
- **`score_outcomes` lists only units that are not a plain pass.** Columns: `test, domain, rule, unit_kind,
  record_id, account_id, outcome, confirmed_only_outcome, line`. `line` is the register finding that decided the
  unit; every value matches a `register.finding`. Passes are counted in `scorecard`, not listed.
- **Confirmed and unresolved fails** are told apart by the two outcome columns: `outcome = fail` with
  `confirmed_only_outcome = fail` is a confirmed fail; `outcome = fail` with any other confirmed-only outcome is an
  unresolved fail. With that split, the listed units of every test reconcile exactly with that test's
  `failed_confirmed`, `failed_unresolved`, `cleared` and `not_evaluable` in `scorecard`.
- **One unit can be listed on several rows.** A `transaction_id` unit gets one row per account its copies name
  (notebook section 12, `transaction_id_units`), and the scorecard counts it once. So for unit kind `transaction_id`
  a unit is a distinct `(test, record_id)`; for every other kind each row is one unit (a `transaction row` unit is a
  row, so two units can share a `record_id`). The full store has no transaction ID on two accounts today; the
  `quality` fixture run of `tests/fixture_test.sh` has one (found by the builder check, verified).
- **Counts exist at test level only.** In `scorecard`, the platform, domain and rule rows carry score, coverage and
  confirmed-only score (domain and rule rows also weight and owner); `population`, `evaluable`, `passed` and the fail
  counts are filled on test rows only. Some rules have tests that count different unit kinds (trade rows and
  transaction IDs, say), so their counts cannot be added into one rule total.
- **A rule can sit in two domains** (`POS_KEYS_MASTERED` in Accounts and Securities), so a rule is identified by
  domain and rule together.
- **Record IDs the Trace page opens** (`resolve` in `dashboard/lib/store.ts`): transaction, position, custodian
  position, account, security, ledger line, corporate action, fund, and an `ACC…/SEC…` key. Unit kinds in
  `score_outcomes` and how they map:

  | Unit kind | `record_id` holds | Trace link |
  |---|---|---|
  | transaction row, transaction_id | a transaction ID | that ID |
  | key | account ID `/` security ID | that key |
  | position row | a position ID | that ID |
  | security | a security ID | that ID |
  | action | a corporate action ID | that ID |
  | ledger row | a ledger ID | that ID |
  | price row | security ID, date and vendor, space-separated | the security ID (first token) |
  | rate row | currency, date and rate | none (D-056 keeps currency findings off traces) |
  | feed-day | a feed and a day | none (it is not one record) |

- **Account scores:** `scorecard_accounts` has one row per account ID seen anywhere, `rank` 1 = lowest score, ties
  by account ID, with a score and coverage per domain for six domains and `fund_nav_result` beside it. Many accounts
  share a score, so a "worst N" cut usually falls inside a tie.
- **Account records are only partly attributed today.** `score_outcomes.account_id` is filled for an account's own
  units (trades, keys, position rows). Units an account inherits through its holdings (a security's price results
  copied onto its snapshot position rows; a corporate action reaching its holder keys) are counted inside notebook
  section 12b (`account_units`, int-coded, passes included) and never written. So most accounts whose Prices or
  Corporate actions score is below 100 have no listed row for that domain. §5.6 closes this.
- **Dollar impact:** `outputs/02_severity.csv` has one row per scenario (`scenario, interpretation, evidence,
  account_scope`, then counts, `valuation_coverage`, signed and gross USD on the valued subset, the largest fund
  effect in bps). `outputs/02_impact_detail.csv` has one row per scenario and account/security key (`delta_units,
  delta_usd, valuation_reason`; the NAV scenario's rows carry a `ledger_id` and no security). Scenarios overlap and
  must not be summed; two scenarios can be alternative readings of the same records; a scenario with nothing valued
  has blank dollar columns (notebook section 11).
- **Stress test:** `tests/stress_test.sh` writes `outputs/03_stress_*.csv`. `03_stress_rates.csv` has the rates by
  role and level, plus two `untouched` rows. `03_stress_impact.csv` mixes per-case rows (`source = stress`) with
  six before/after rows of the deliverable's own measures (`source = deliverable`, columns `measure, before, after`).
  `03_stress_run.csv` is `item, value` and includes absolute paths on the computer that ran it. The small fixture
  produces no stress outputs (no held equity qualifies).
- **The stress comparison reads every `02_*.csv`** of the clean and the injected run (`output_changes` in
  `scripts/stress.py`). In a file with a `security_id` column, a changed row on an injected security is a
  consequence, on another security a false positive (the run then exits non-zero), with a blank security
  unattributable. A file without that column is an aggregate change and cannot fail the run.
- **The shuffle tests** (`tests/robustness_test.sh`, `tests/fixture_test.sh`) compare every `02_*.csv` across row
  orders after sorting, skipping only the run record and the row ledger. A new `02_*` file must not depend on row
  order.
- **Rule names:** `scorecard` carries rule IDs. `scripts/plain_language.json` words findings, map places, stages and
  statuses, not rules. `rule_catalog` has each rule's `test` and `on_fail` text from `docs/RULES.md`; every scored
  rule is in it.
- **Dashboard tests:** `npm test` on its own runs vitest on a store built from `tests/fixtures/small`
  (`tests/prepare_dashboard_fixture.py`, which runs the real notebook and `build_store.py`); `npm run test:e2e` runs
  Playwright on a production build over a second copy of that fixture store. `tests/store_test.sh` builds its own
  store from the same fixture, checks its contracts, then runs `npm test` on **that** store (`STORE_PATH` is set, so
  `prepare_dashboard_fixture.py` is skipped) and a production build. Anything the vitest suite needs must therefore
  be in both stores.
- **The small fixture has no inherited account unit** (no listed `security` or `action` unit) and no transaction ID
  on two accounts. Those cases exist only in the `score` and `quality` copies that `tests/fixture_test.sh` builds.
- **A scenario can have no records at all.** In the small fixture most `severity` rows have `financial_rows` 0 and
  blank dollar columns; the full data has none today.

## 5. What the user decided (11 Nov)

### 5.1 The page and its order

A new page at `/executive`, laid out top to bottom (the user chose this over a one-screen grid and over tabs):

1. **Headline tiles.**
   - Platform quality score, with its coverage and the confirmed-only score beside it.
   - Largest priced impact scenario: the scenario with the largest gross USD on its valued subset, its name, its
     evidence status and the share of its rows that was priced. The tile says it is one scenario, not a total.
   - Leading indicators breaching: how many computed leading indicators have at least one breach, out of how many
     computed leading indicators there are, and the earliest first-breach date.
2. **Where is the platform degrading?**
   - Domain scores: one row per domain with a bar for the score, the coverage, the confirmed-only score and the
     owner. Clicking a domain filters the fix-first list to that domain and scrolls to it.
   - Indicators: one card per indicator with its name, leading or lagging, computed or proposed, value and unit,
     threshold, breach count, first breach and owner. A proposed indicator shows what it still needs
     (`inputs_needed`), never a value. A leading indicator with a look-back row shows how many lagging keys it
     flagged earlier, the lead in days and the notebook's verdict, with the caption that this is a look-back, not
     predictive accuracy (brief App. B).
   - KPIs by office: the seven KPIs grouped by office with value, target, met or not, computed or proposed, and
     owner.
   - Worst accounts: the lowest-ranked accounts with score, coverage, confirmed-only score and the per-domain
     scores, plus a box to look up any account ID. Each account opens its account page (§5.5).
3. **What should we fix first?** One switch with two lists (§5.3).
4. **Can we trust these numbers?** The stress test and the sensitivity check (§5.7).

**(Claude's call)** The Data map stays the home page at `/`. "Executive view" becomes a live sidebar entry, listed
first. The placeholder heading "Coming at Check-in 3" becomes "Later", with "Monitoring" under it.

**(Claude's call)** An indicator whose daily or effective-date series has at least two points for a key gets a small
trend line per key (inline SVG, no chart library, breach points marked, the key named when it is not `all`). Weekly
rows are not drawn: their `numerator` and `denominator` hold medians, not counts.

**(Claude's call)** The worst-accounts table shows ten rows. When the last row's score is shared by accounts beyond
the cut, a line under the table says how many accounts share that score.

### 5.2 Scores always with coverage

Every platform, domain, rule, test and account score shows its coverage and its confirmed-only score beside it, as
brief §5 requires. Scores and coverage are shown as stored, with two decimals; the page never rounds a score again. A
blank score (a domain not applicable to an account) shows as a dash with "not applicable", never as 0 or 100.

**(Claude's call, after the builder check)** Two kinds of score exist in the outputs without all three values, and
the page shows what the outputs hold instead of changing the notebook: an account's per-domain scores come with
coverage only, and the sensitivity variants (NAV-weighted, weakest link, confirmed only) are shown as alternatives
next to the main score they vary, labelled as such, not as scores of their own.

### 5.3 "What to fix first": one switch, two lists

The user asked for both orders, by lowest score and by largest dollars. Dollars exist per impact scenario, not per
rule, and scenarios overlap, so the page keeps two lists behind one switch and merges nothing:

- **By quality score** (the default): the rule rows of `scorecard`. Columns: plain rule name with the rule ID small
  beside it, domain, score, coverage, confirmed-only score, what failed, owner, and the rule's on-fail action from
  `docs/RULES.md` (`rule_catalog.on_fail`). "What failed" is one short line per test of the rule, with that test's
  own counts and unit (for example "… trade rows: … confirmed, … unresolved"); counts of different units are never
  added into one rule total (§4). Opens sorted by lowest score; ties by lower coverage, then domain and rule ID.
  Each rule opens its rule page (§5.4).
- **By dollar impact:** the rows of `severity`. Columns: scenario, its interpretation in small text, evidence status,
  gross USD and signed USD on the valued subset, the largest fund effect in bps, the share priced, distinct accounts
  and affected funds. Opens sorted by largest gross USD. Scenarios that have records but nothing valued sit in their
  own group under the heading "Not priced: unknown, not zero", ordered by distinct accounts. **(Claude's call, after
  the builder check)** A scenario with no records at all (`financial_rows` 0) is neither priced nor unknown: it sits
  in a last group, "No records in this run". A caption states that these are
  indicative investment-value scenarios, not a verified NAV loss, and that scenarios overlap and must not be added
  up. Each scenario opens its scenario page (§5.5).

Clicking a column header re-sorts the list shown (the "what failed" column is not sortable). The switch and the domain filter live in the address
(`?by=score|dollars`, `?domain=`), so a view can be linked and tested.

### 5.4 Drill-down: the rule page

The user chose a page per rule over a side panel. `/executive/rule?domain=…&rule=…` shows:

- the plain rule name, rule ID, domain, owner, what the rule tests and its on-fail action (`rule_catalog`);
- score, coverage and confirmed-only score (the rule row);
- the rule's tests (the `test` rows of `scorecard` for that domain and rule), each with its unit kind, score,
  coverage and its counts: population, evaluable, passed, confirmed fails, unresolved fails, cleared, not evaluable;
- the records: every listed unit of that domain and rule, one line per unit. **(Claude's call, after the builder
  check)** A `transaction_id` unit that `score_outcomes` lists once per account (§4) is shown once, with its
  accounts side by side, so the lines and the filter counts equal what the tests counted. Columns: record, unit
  kind, test, result, the finding that decided it (the register's plain wording, the raw finding as fallback) and
  the account or accounts. Filters:
  result (confirmed fail, unresolved fail, cleared, not evaluable, each with the number of listed rows) and finding.
  Fifty rows per page, ordered confirmed fail, unresolved fail, not evaluable, cleared, then record ID. A line states
  that passed records are counted in the tests table above and not listed.
- per record, a "Trace" link by the table in §4. A price row links to its security and says so; a rate row and a
  feed-day have no link and say why.

A breadcrumb leads back: Executive view › domain › rule. An unknown domain and rule pair gives a plain "no such
rule in the scorecard" page.

### 5.5 Drill-down: the account page and the scenario page

**Account page**, `/executive/account?id=…` (the user chose list plus page over list only):

- account ID, whether it is in the account master, fund and share class, rank out of the number of scored accounts;
- score, coverage, confirmed-only score, and the two sensitivity scores (NAV-weighted, weakest link);
- one row per domain with score and coverage, so two accounts with the same score can be told apart (brief
  Appendix C); the fund's NAV result shown beside the scores with the sentence that it is not inside them;
- the records: every row of the new `account_outcomes` table for that account (§5.6), with the same columns,
  filters, order, paging and trace links as the rule page, plus a domain filter. An inherited row names the holding
  it came through.

An account ID that is not among the scored accounts gives a plain "not a scored account" page with the lookup box.
On a store without `account_outcomes`, the records fall back to the `score_outcomes` rows carrying that account ID,
with a notice that inherited records need a rebuilt store.

**Scenario page**, `/executive/scenario?name=…`:

- the scenario's row of `severity`: interpretation, evidence status, which accounts are counted (`account_scope`),
  rows, valued and unknown rows, the share priced, gross and signed USD, the largest fund effect in bps, distinct
  accounts and affected funds; the same caption as §5.3;
- the records: its rows of `impact_detail`. Columns: account, security, fund, change in units, change in USD (blank
  shows "not priced") and the valuation reason. Filter: priced or not priced. Ordered by largest absolute USD first,
  not priced last, then account and security. Fifty rows per page.
- per record, a "Trace" link: the ledger ID when the row has one, else the account/security key.

### 5.6 The notebook writes each account's records (user: "extend the notebook now")

The gap in §4 means an account page built on today's outputs would show a Prices or Corporate actions score with no
records behind it. The user chose to close it now instead of noting it on the page.

Section 12b of `notebooks/deliverable.ipynb` writes one new file, `outputs/02_account_outcomes.csv`: **one row per
unit that reaches an account and is not a plain pass**, own and inherited alike. It is the listed half of
`account_units`, with identities attached. Columns:

| Column | Content |
|---|---|
| `account_id` | the account the unit reaches |
| `domain`, `rule`, `test` | as in `02_score_outcomes.csv` |
| `unit_kind` | the test's unit kind |
| `record_id` | the scored unit's ID, exactly as `02_score_outcomes.csv` writes it for that kind |
| `holding` | blank for an own unit; for a unit inherited from a security, the account's snapshot position ID; for a unit inherited from a corporate action, the holder key (account ID `/` security ID) |
| `security_id` | the security of the unit or of the holding, when it has one |
| `outcome`, `confirmed_only_outcome` | as counted for the account |
| `line` | the register finding that decided the unit, as in `02_score_outcomes.csv`; when an action ID has several rows, the line of the row with the worst main outcome, ties by line text |

`security_id` by unit kind: a trade row's own security; a position row's; a key's; the security itself; a holder
key's security; blank for a `transaction_id` unit (an ID can span rows with different securities, and no trade
outcome depends on a price). A transaction ID on two accounts is one unit on each account here, as in the account
scores.

Rules for the change:

- **Additive only.** No score, count, rank or existing file changes: every pre-existing `outputs/02_*` file is
  byte-identical before and after, the run record aside. **(Claude's call)** No new row-ledger line, so the ledger is
  identical too.
- **A CHECK in the notebook** proves the file is what the score counted: for every account and test, the file's rows
  by outcome (confirmed fail, unresolved fail, cleared, not evaluable) equal that account's counts in
  `account_test_rows`. A mismatch stops the run.
- **Deterministic:** rows sorted by all identifying columns; the same content under any input row order.
- **Memory:** identities are attached only to the listed (not plain pass) units, after filtering. Peak memory and run
  time are measured before and after and reported; a material rise is brought to the user, not accepted silently.
- **`security_id` filled wherever the record has one**, so the stress comparison (§4) attributes a changed row to its
  security instead of calling it unattributable.
- The markdown cell of section 12b gains the sentence that describes the file. `tests/fixture_test.sh` gains cases
  for it (an own unit, a unit inherited through a security, one through a corporate action, a plain pass that is
  absent).

The store copies the file as `account_outcomes`. The stress test is rerun after the change, because its comparison
now sees one more file.

### 5.7 "Can we trust these numbers?"

- **Stress test.** The rates by role and level (cases, share, drawn against wanted), the two `untouched` counts
  (false positives and unattributable changes), the before/after rows of the deliverable's own measures, and the run
  facts: seed, sample sizes, multiplier, finish time and the short labels checksum. Fixed captions repeat what
  `docs/FINDINGS.md` says about reading the rates: they hold for the sample drawn, and the severity scale row is an
  upper bound. The absolute paths in `03_stress_run.csv` are never shown.
  - **(Claude's call)** When the stress outputs are missing, the section says the stress test has not been run and
    names the command (`tests/stress_test.sh`).
  - **(Claude's call)** When the stress file's "platform score" before-value differs from the scorecard's platform
    score, the section warns that the stress results come from an older run.
- **Sensitivity check.** For each variant (NAV-weighted, weakest link, confirmed only): the platform score and its
  change, and for accounts how many of the worst N stay in the worst N, the ties at the cut and the rank
  correlation. The per-domain rows sit in a folded section.

### 5.8 Store changes

`scripts/build_store.py` copies six more CSV files with the existing loader (text, with the listed columns as
DOUBLE; a missing file gives the same single-`note`-column table and a printed note). `account_outcomes` is the new
notebook output of §5.6:

| Table | File | Numeric columns |
|---|---|---|
| `severity` | `02_severity.csv` | every column after `account_scope` |
| `impact_detail` | `02_impact_detail.csv` | `delta_units`, `delta_usd` |
| `account_outcomes` | `02_account_outcomes.csv` | none |
| `stress_rates` | `03_stress_rates.csv` | `cases`, `share`, `drawn`, `wanted` |
| `stress_impact` | `03_stress_impact.csv` | `signed_usd`, `gross_usd`, `fund_net_assets_usd`, `signed_bps`, `gross_bps`, `before`, `after` |
| `stress_run` | `03_stress_run.csv` | none |

**(Claude's call)** Plain rule names: `scripts/plain_language.json` gains a `rules` block with a short plain name
for every scored rule (for example the name of the check in a few words), copied into `plain_text` as kind `rule`.
The build fails when a rule of `config/scorecard.toml` has no name. The team reviews the wording, as with the rest
of that file; the rule ID stays visible beside the name.

The module docstring of `build_store.py` and `tests/store_test.sh` describe and check the new tables: each exists
with its CSV's columns and row count, the numeric columns are DOUBLE, every scored rule has a plain name, and the
store still builds with none of the files present.

### 5.9 Displayed figures agree with code outputs

- Scores, coverage, shares and counts are shown as stored. USD shows whole dollars with thousands separators in
  tables; the headline tile may shorten it (millions or billions with one decimal) and keeps the full figure in a
  tooltip. Basis points show two decimals. One formatting module, unit-tested.
- A blank is "not priced", "not computed" or "not applicable" by context, never 0.
- Tests compare what a page shows with the CSV the store copied (§6).

### 5.10 Docs

- `dashboard/README.md`: a section on the executive view (what each part reads, the drill-down paths, what a blank
  means) and the test instructions.
- `docs/DECISIONS.md`: a new entry, appended by the controller, for the choices here (the page's shape, the switch
  instead of a combined rank, the new notebook output, the plain rule names) and what was left out.
- `docs/STATUS.md`: step 4 done, the date, and the follow-ups (the urgency ranking idea, the persona wireframes).
- `docs/FINDINGS.md` regenerated if the stress rerun changes it. No number is typed by hand anywhere.
- No change to `docs/RULES.md` or `config/` (no rule, no threshold).

## 6. Tests

- **Notebook:** `tests/run_notebook.sh` on the full data, then a byte comparison of every pre-existing `02_*` file
  with a copy taken before the change; `tests/fixture_test.sh` with the new cases; `tests/robustness_test.sh` (the
  new file is the same under shuffled rows and under the live weight change); `tests/stress_test.sh` (exit 0, no
  false positive, no unattributable change).
- **Store:** `tests/store_test.sh` with the contracts of §5.8.
- **Dashboard unit tests (vitest, fixture store):** the reads return what the CSV files hold; for every test, the
  listed units by result equal the scorecard's counts; an account's records are exactly its rows of
  `02_account_outcomes.csv` (that the file equals what the score counted is the notebook CHECK's job: the store
  holds no per-account test counts); the fix-first orders and the three scenario groups; the trace link per unit
  kind; the formatter; the stress "older run" and "not run" states; an older store without the new tables.
- **(Claude's call, after the builder check)** The small fixture stays as it is. The two cases it lacks are tested on
  a copy of the fixture store with made-up rows added (the `copyStore` pattern of `dashboard/tests/store.test.ts`):
  a transaction ID listed on two accounts (shown once, counts still equal the scorecard), and inherited rows in
  `account_outcomes` (listed with their holding). The proof that real inherited rows are right stays with the
  notebook CHECK and `tests/fixture_test.sh`.
- **Browser tests (Playwright, fixture store):** the page loads with its four parts; the platform score on the page
  equals the fixture's `02_scorecard.csv`; the switch changes the list; domain → rule → a record → a found trace;
  account lookup → account page → a found trace; scenario → scenario page → a found trace; the sidebar entry; a
  narrow viewport without sideways scrolling; no page error.
- **(Claude's call)** The fixture gets small made-up stress files, written by one helper that both
  `tests/prepare_dashboard_fixture.py` and `tests/store_test.sh` call (into the fixture's output folder, never into
  `outputs/`), so the stress section is tested with data in both stores; the "not run" state is tested on the view
  logic and on the store built with no output files.
- Before done: `uv run python scripts/build_store.py`, `tests/store_test.sh`, `npm test` and `npm run test:e2e` in
  `dashboard/`, `uv run python scripts/build_findings.py`, `uv run python scripts/check_docs.py`.

## 7. Left to the builder

- Component and file layout under `dashboard/app/executive/` and `dashboard/components/executive/`, and whether the
  new reads sit in `dashboard/lib/store.ts` or in a new file beside it that shares its connection.
- The exact look of tiles, bars, cards and trend lines, within §3's colour rule and the existing components
  (`dashboard/components/ui/`, `dashboard/components/common.tsx`).
- The plain rule names (short, plain, consistent with the wording file), for the team to review.
- How the notebook cell attaches identities to the listed account units, within §5.6.
- The made-up stress fixture's values.

## 8. Decisions taken while building

*Controller's rulings during the build of 11 Nov, in the order they were taken. The user approved the plan with three
conditions (notebook first with a byte-identical gate; one combined review for the five page-building tasks; counts
of subagents and post-review fixes), recorded in the plan's Global Constraints.*

- **No git worktree.** The branch `executive-view` was created in place: `outputs/` and `data/` are gitignored and a
  worktree would not have them. Nothing was committed by the controller or a subagent; task diffs were taken between
  working-tree snapshots.
- **Notebook gate (Task 1).** `tests/fixture_test.sh` passed with the new cases, the full run passed with every
  notebook check, and every pre-existing `outputs/02_*` file was byte-identical to a baseline taken from the unchanged
  notebook, the run record aside. The same comparison was repeated after the robustness test.
- **Peak memory.** The first run of the changed notebook peaked just under the plan's 10 % line above the baseline. A
  re-run of the unchanged notebook peaked within one percent of it, so the difference is run-to-run noise; the new
  code holds one array of row positions per unit kind and the listed rows. Work continued and both figures were
  reported to the user.
- **How identities are attached (Task 1).** `kind_attribution` and `action_holder_codes` also return each reaching
  row's position; inside the per-test loop the listed units keep their account code, outcome codes, row locator and
  unit position; record ID, holding, security and line are looked up after the loop. `account_units` is unchanged and
  no row-ledger line was added. The CHECK reads the written file back and compares, per account and test, its four
  result counts with `account_test_rows` through an outer join, so a missing and an extra pair both stop the run.
- **Fixture cases (Task 1).** On the `score` copy: FXACC1 inherits the unquoted FXSEC9 through its snapshot position
  FXSP9; the quarantined FXCA3 reaches FXACC3 through its holder key. No fixture row was added.
- **Long tests in the background.** `tests/robustness_test.sh` then `tests/stress_test.sh` ran as one chain after
  Task 2's review, while the dashboard tasks worked on the fixture. Both exited 0. The stress rates did not move; the
  new file appears in the stress comparison as a consequence on the injected securities only. The labels checksum is
  unchanged.
- **Plain rule names (Task 2).** One name per scored rule ID (a rule in two domains has one name). The review found
  the name of `TXN_TIMESTAMPS_IN_ORDER` claiming a per-trade latency limit; it and four incomplete names were
  reworded against `docs/RULES.md`. The build stops when a scored rule has no name or a name has no scored rule.
- **Made-up stress files (Task 2).** `tests/stress_fixture.py` writes them into a folder under `tests/runs` only
  (the guard is inside `write()`), with the headers the real writer produces (column lists imported from
  `scripts/stress.py`), a "platform score" before-value read from the fixture's own scorecard, one blank before-value
  and one per-case row so a reader that forgets to filter on `source` fails. `tests/store_test.sh` and
  `tests/prepare_dashboard_fixture.py` both call it. The missing-file note for the `03_stress_*` tables names
  `tests/stress_test.sh`.
- **Formatting (Task 3).** `fmtScore` and `fmtShare` cut and never round up, with an allowance for binary floating
  point, so "100.00" and "100.0%" appear only when complete. Every formatter prints a negative with the real minus
  sign and a blank as an en dash (money: "not priced"). `sortRules` falls back to the default order on ties.
- **Reads (Task 4).** All listed units of a rule or an account are loaded and then filtered and paged in Node, so one
  function decides a record's result; the largest rule and account on the full store load in well under a second
  (measured by the reviewer and again by the controller's full-store check). On an account page the domain filter
  applies before the counts; the rule page ignores a domain filter; findings are ordered by record count.
- **Component and type share a name.** The component is `ScoreTrio`; the type is imported under an alias where both
  are needed.
- **Full-store look (plan Task 5, Step 5) moved to the controller.** Page builders worked on the fixture and saved
  fixture screenshots. The controller compared the pages on the full store with the output files by script
  (`tests/runs/`, gitignored; it prints matches, counts and timings only): platform, domain and rule scores, the
  record counts of the largest rule, the lowest-ranked account, an account with inherited records and the largest
  scenario, trace links, no "NaN" text, no sideways overflow.
- **One page frame.** The rule page was first built without the executive page's container; `PageFrame` now gives
  all four pages the same one. The account lookup form and the scenario caption are each defined once.
- **Combined review of the five page tasks.** Three findings on the main page were fixed: an account's per-domain
  scores in the worst-accounts table now carry their coverage (the brief had said "one column per domain score"; the
  spec's §5.2 wins); the worst-accounts block moved into "Where is the platform degrading?" (§5.1); the narrow-screen
  test now measures the page frame, which is what scrolls.
- **Unit changes are shown as stored.** The full data has fractional unit changes, which a count formatter rounded;
  `fmtNumber` shows a number with up to six decimals and no trailing zeros, for the change in units and the rank
  correlation.
- **Other fixes of that round.** Drill-down links built by hand now use the link builders; a blank domain score
  draws no bar; one blank mark everywhere (`BLANK`, an en dash); the look-back sentence drops its median clause when
  there is none; the finding filter resets with the address; the formatters treat a non-finite value as a blank; the
  record order of a rule or account page has `rowid` as its last key, so a page cut is the same on every request.
- **Whole-branch review.** It confirmed every fix of the combined round and found one blocker: example figures in
  the plan had been copied from real outputs and had reached a test file and code comments (anti-goal, §2). They were
  replaced by invented values in the code, the tests and the plan, and a scan of the new code and tests against the
  output files found none left. Fixed with it:
  - indicator and KPI values that are not percentages, and the look-back's lead days, go through `fmtNumber`
    (`fmtValue` decides by unit), so a median is never rounded to a whole number;
  - an account with no score (no unit) gets the plain "Not a scored account" page (§5.5);
  - "computed" and "proposed" pills use the neutral tone (green is for data health, §3);
  - the Rule, Domain and Owner headers of the rule list sort too (§5.3);
  - a rule with several tests names the test on each "what failed" line; "Show all domains" keeps the reader at the
    list;
  - three tests were strengthened (the reconciliation also sums the four counts over the rule's tests; an account's
    records are compared by identity; one duplicated assertion removed).
- **Reviews as run.** One review each for Tasks 1 to 4 (Opus), one combined review for Tasks 5 to 9 (Opus), one
  whole-branch review (Opus), which also re-checked the combined round's fixes. The short re-review of the last
  fixes ran on Sonnet while the Opus usage limit was reached, then on Opus once the user had lifted it; both found
  every finding addressed and nothing broken by the fixes.
- **Final checks.** After the last fix: `tests/store_test.sh`, the Python unit tests, dashboard `npm test` (under the
  store test) and `npm run test:e2e`, lint, type check and `scripts/check_docs.py` pass; the full-store comparison
  matches on every point; every pre-existing `outputs/02_*` file is still byte-identical to the baseline; the stress
  labels checksum is unchanged.
- **Review notes kept, not fixed** (the whole-branch review judged each "can stay"):
  - Notebook: the CHECK proves counts per account and test, not that each row carries the right record ID (the
    fixture test and a full-data comparison of own rows with `02_score_outcomes.csv` cover identities); no fixture
    case for an action ID with several rows.
  - Store: the "blank stays NULL" contract in `tests/store_test.sh` names one column (the dashboard tests compare
    every stress and severity number with its CSV); the map wording for the security check still says "matching
    codes" (older text).
  - Reads and logic: the small fixture never reaches the worst-accounts cut or a second page, so the tie note and
    paging are proved on the full store by the controller's script, not by a permanent test; a store missing
    `score_outcomes` or `impact_detail` shows an empty list instead of "rebuild the store", and one missing
    `scorecard` shows "No such rule".
  - Pages: a second breadcrumb landmark beside the header's; the master pill sits inside the account heading; the
    switch uses tab roles without a tab panel; the result chips count listed records across a rule's tests ("All n"
    is the number of lines, not a rule total); scenario name and evidence headers do not sort; helpers and class
    strings repeated across the four pages (`one()`, the page-number check, section headings, chips, empty-state
    box); more browser tests for chips, paging and scenario sorting; the screenshot steps run inside the suite.
  - From the last re-review: the KPI and indicator cells decide whether to print the unit on `value === null`,
    while `fmtValue` also treats a non-finite value as blank, so such a value would print "not computed" followed
    by its unit (the store read never produces one from a numeric column).
