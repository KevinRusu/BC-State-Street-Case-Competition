# Executive View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working "Executive view" page in the dashboard that answers the Chief Data Officer's three questions from
the scorecard, indicators, KPIs, dollar impact and stress test we already compute, with drill-down from a rule, an
account or an impact scenario to the records behind it and on to the Trace page.

**Architecture:**
- **Notebook:** section 12b writes one additive file, `outputs/02_account_outcomes.csv` (every unit that reaches an
  account and is not a plain pass), proved against the account scores by a CHECK.
- **Store:** `scripts/build_store.py` copies six more CSV files and the plain rule names; nothing is computed there.
- **Dashboard reads:** `dashboard/lib/executive-store.ts` (plain Node, read-only SQL) returns typed data;
  `dashboard/lib/executive.ts` holds every pure decision (formatting, result of an outcome, orders, trace targets,
  stress state). Pages only place what those two return.
- **Pages:** `/executive`, `/executive/rule`, `/executive/account`, `/executive/scenario`, all server components
  reading `searchParams`, as `dashboard/app/trace/page.tsx` does. One client component for the sortable list.

**Tech Stack:** Python 3.12, pandas, numpy, DuckDB (notebook and store); Next.js 16, React 19, TypeScript, Tailwind 4,
`@duckdb/node-api`, vitest, Playwright (dashboard). No new dependency.

**Spec:** `docs/superpowers/specs/2026-11-11-executive-view-design.md` (read it first; this plan does not repeat its
reasoning).

## Global Constraints

- **No commits:** the user commits. Each task ends with a checkpoint: its tests green and `git status` reviewed. Work
  on the branch `executive-view` (the controller creates it before Task 1).
- Never modify `data/`, `reference/`, `config/*.toml`, `tests/stress/cases.toml` or anything under `docs/checkins/`.
- The data is confidential: no record ID, account ID or data value in code, tests or docs. Tests name IDs of
  `tests/fixtures/small` only (they are made up). Nothing is deployed or sent to an outside service.
- No new check, score, weight, threshold or total: a page shows only values the store holds. Impact scenarios are
  never added up. Counts of different unit kinds are never added into one rule total.
- A blank stays a blank: "not priced", "not computed" or "not applicable", never 0, never `NaN`. `num()` in
  `dashboard/lib/store.ts` turns a blank into 0, so the new reads use `maybe()` (Task 4) for every score, share,
  dollar and count that can be blank.
- Every platform, domain, rule, test and account score is shown with its coverage and its confirmed-only score beside
  it. An account's per-domain scores have coverage only, and the sensitivity variants are shown as alternatives next
  to the main score (spec §5.2); the notebook is not changed for them.
- A unit is listed once: a `transaction_id` unit that `score_outcomes` lists on several accounts is one line with its
  accounts together (spec §4, §5.4). For every other unit kind each row is a unit.
- Notebook code only in `notebooks/deliverable.ipynb`, edited as `.ipynb` JSON (D-037). Every pre-existing
  `outputs/02_*` file must be byte-identical after Task 1, the run record (`02_run_info.csv`) aside.
- Dashboard: read `dashboard/AGENTS.md` first, then the relevant guide under `dashboard/node_modules/next/dist/docs/`
  before writing a page, a route or a client component. Every store read lives under `dashboard/lib/` with no
  Next.js import; pages go through `dashboard/lib/data.ts`.
- Colours: brand blue for links, selection and our framework; green, amber, red and grey for data health only
  (`dashboard/lib/status.ts` tones). Light and dark themes both.
- Page sizes and cut-offs are display constants in `dashboard/lib/executive.ts`: `PAGE_SIZE = 50`,
  `WORST_ACCOUNTS = 10`.
- `uv` for Python; `npm` only inside `dashboard/`. Stop `npm run dev` before `tests/store_test.sh` or
  `npm run test:e2e` (they build).
- **Models (user's rule):** Opus builds Tasks 1 to 4; Sonnet builds Tasks 5 to 9. The controller writes
  `docs/DECISIONS.md` and `docs/STATUS.md`.
- **Conditions of the approval (user, 11 Nov):**
  1. Task 1 (the notebook) goes first. Its gate is the full notebook run, `tests/fixture_test.sh` and the byte
     comparison of every existing `outputs/02_*` file. If all pass, the work continues to the page without waiting
     for the user; the commands and their output go in the final message. Stop and report only if a check fails, an
     existing output changes or something unexpected turns up. `tests/robustness_test.sh` and `tests/stress_test.sh`
     run in the background (one after the other: both run the notebook through `tests/run_notebook.sh`, which
     writes `tests/runs/executed.ipynb`, and the robustness test rewrites `outputs/02_*` while it runs, so nothing
     else may run the notebook, `tests/fixture_test.sh`, `tests/store_test.sh` or `scripts/build_store.py` on
     `outputs/` until they finish).
  2. Reviews: Opus reviews Tasks 1, 2, 3 and 4, one review each. Tasks 5 to 9 get one combined Opus review after
     Task 9, not one per task. The whole-branch review at the end stays.
  3. The controller counts the subagents it spawns and the fixes made after a review, and reports both.

## Review Focus

1. **A store built before this change** (no `severity`, `stress_*` or `account_outcomes`, or a table holding only a
   `note` column): each section says "rebuild the store" and the rest of the page still renders. Task 4 tests it.
2. **Blank numbers:** a proposed indicator, a scenario with nothing valued, an account with no score, a stress
   measure with no before-value. None may show as 0, `NaN` or an empty tile. Tasks 3 and 4 test it.
3. **Names and IDs in addresses:** scenario names contain `:` `/` and spaces, keys contain `/`, a domain contains a
   space. Every link must round-trip. Task 3 tests the link builders; Tasks 7 and 9 open such pages in the browser.
4. **Address parameters nobody typed carefully:** `page=0`, `page=999`, `page=abc`, `result=bogus`, an unknown rule,
   account or scenario, an empty account lookup. A clamped page or a plain "not found" page, never an error. Tasks 3,
   4 and 7 to 9 test it.
5. **Ties and odd accounts:** the worst-accounts cut falling inside a tie; an account missing from the account master
   (blank fund and share class); a `transaction_id` unit that reaches two accounts. Tasks 1 and 4 test them.

---

## File structure

| File | Responsibility |
|---|---|
| `notebooks/deliverable.ipynb` (cells of section 12b) | writes `02_account_outcomes.csv` and its CHECK |
| `tests/fixture_test.sh` | cases for the new file |
| `scripts/build_store.py` | `EXECUTIVE_TABLES`, plain rule names (`plain_text` kind `rule`) |
| `scripts/plain_language.json` | new `rules` block |
| `tests/store_test.sh`, `tests/test_plain_language.py` | store contracts, wording check |
| `tests/stress_fixture.py` | writes the made-up stress files into a fixture output folder |
| `tests/prepare_dashboard_fixture.py`, `tests/store_test.sh` | call it before building their store |
| `dashboard/lib/executive-types.ts` | every type below |
| `dashboard/lib/executive.ts` | pure logic: format, result, order, links, stress state, sparkline geometry |
| `dashboard/lib/executive-store.ts` | the four reads |
| `dashboard/lib/store.ts` | exports `connect`, `rows`, `text`, `hasTable`, `hasColumn` for the file above |
| `dashboard/lib/data.ts` | four loaders |
| `dashboard/app/executive/page.tsx` and `rule/`, `account/`, `scenario/` `page.tsx` | the four pages |
| `dashboard/components/executive/*.tsx` | one component per part (named in each task) |
| `dashboard/components/shell/app-sidebar.tsx` | live "Executive view" entry |
| `dashboard/tests/executive.test.ts`, `executive-store.test.ts` | vitest |
| `dashboard/e2e/executive.spec.ts` | Playwright |
| `dashboard/README.md` | the executive view section |

---

### Task 0 (controller): branch and baseline

- [ ] **Step 1:** `git switch -c executive-view`.
- [ ] **Step 2:** Baseline for Task 1's comparison. Run `/usr/bin/time -l tests/run_notebook.sh` (full data, about
  four minutes), note the elapsed time and "maximum resident set size", then
  `rm -rf tests/runs/exec_baseline && mkdir -p tests/runs/exec_baseline && cp outputs/02_*.csv tests/runs/exec_baseline/`.
- [ ] **Step 3:** `shasum -a 256 tests/stress/cases.toml` and keep the value (it must not change).

---

### Task 1: the notebook writes each account's records (Opus)

**Files:**
- Modify: `notebooks/deliverable.ipynb`, the three cells of section 12b (the markdown cell that starts
  `### 12b. Account scores`, the code cell that starts `# Section 12b. Account scores`, the CHECK cell after it)
- Test: `tests/fixture_test.sh` (the block that starts `# Account scores (section 12)`)

**Interfaces:**
- Consumes: in the 12b code cell, `ACCOUNT_TESTS`, `ACCOUNTS`, `UNIT_FRAMES`, `UNIT_INDEX`, `snapshot_rows`,
  `holder_units`, `outcomes` (with `test`, `unit`, `outcome`, `confirmed_only_outcome`, `line`), `OUTCOMES`,
  `account_test_rows`, `SCORECARD['tests']`, `kind_attribution`, `test_unit_codes`, `action_holder_codes`.
- Produces: `outputs/02_account_outcomes.csv`, columns in this order:
  `account_id, domain, rule, test, unit_kind, record_id, holding, security_id, outcome, confirmed_only_outcome, line`.
  One row per unit that reaches an account and whose outcome or confirmed-only outcome is not `pass`. Sorted by all
  columns in that order. Written with `index=False, lineterminator='\n'`.
  - `unit_kind`: the test's unit kind from `SCORECARD['tests'][test]['unit']`.
  - `record_id`: the unit's `record_id` in `UNIT_FRAMES[kind]` (for kind `security` the security ID, for `action` the
    action ID), so it equals `02_score_outcomes.csv` for the same unit.
  - `holding`: `''` for kinds `transaction row`, `transaction_id`, `position row`, `key`; for `security` the
    `position_id` of the account's snapshot row; for `action` the holder key as `account_id + '/' + security_id`.
  - `security_id`: `transaction row` the row's `security_id`; `position row` the position's; `key` the key's;
    `security` the security itself; `action` the holder key's security; `transaction_id` `''` (an ID can span rows).
  - `line`: the `line` of the unit's row in `outcomes` for that test; for an action with repeated rows, the line of
    the row that gave the worst main outcome (ties by line text).

- [ ] **Step 1: Write the failing fixture cases** in `tests/fixture_test.sh`, after the account-score expectations,
  on the `score` run:

```python
ao = read('score', '02_account_outcomes.csv')
oc = read('score', '02_score_outcomes.csv')
expect('account outcomes: columns',
       ['account_id', 'domain', 'rule', 'test', 'unit_kind', 'record_id', 'holding', 'security_id', 'outcome',
        'confirmed_only_outcome', 'line'], list(ao.columns))
expect('account outcomes: no plain pass row', False,
       ((ao['outcome'] == 'pass') & (ao['confirmed_only_outcome'] == 'pass')).any())
own = ['test', 'record_id', 'account_id', 'outcome', 'confirmed_only_outcome', 'line']
expect('account outcomes: every score outcome that names an account is there as an own unit (holding blank)',
       set(map(tuple, oc.loc[oc['account_id'] != '', own].values)),
       set(map(tuple, ao.loc[ao['holding'] == '', own].values)))
inherited = ao[ao['holding'] != '']
expect('account outcomes: inherited rows come only from security and action tests', True,
       set(inherited['unit_kind']) <= {'security', 'action'})
expect('account outcomes: FXACC1 inherits the unquoted FXSEC9 through its snapshot position FXSP9', True,
       ((inherited['account_id'] == 'FXACC1') & (inherited['record_id'] == 'FXSEC9')
        & (inherited['holding'] == 'FXSP9') & (inherited['security_id'] == 'FXSEC9')).any())
expect('account outcomes: an action reaches its holder key', True,
       ((inherited['unit_kind'] == 'action') & inherited['holding'].str.contains('/')).any())
expect('account outcomes: sorted', True, ao.equals(ao.sort_values(list(ao.columns)).reset_index(drop=True)))
```

  Before relying on the two named cases, look at the existing `score` and `quality` runs under `tests/runs/`: the
  FXSEC9 case stands if that run gives FXSEC9 a not-pass outcome on a `security` test and FXSP9 is FXACC1's snapshot
  position in it; otherwise take the equivalent made-up IDs from the `quality` run (it has failing vendor checks)
  and read that run instead. The action case stands if a listed action has a holder key (the `score` copy has a
  quarantined action with a holder); if not, add one made-up action where `fixture_score` is built. Say in the
  report which IDs the cases ended up using.

- [ ] **Step 2:** `tests/fixture_test.sh` → fails on the missing file.
- [ ] **Step 3: Implement** in the 12b code cell, after `account_test_rows` exists. Attach identities only to listed
  units: inside the existing per-test loop keep, for the rows where `(main != PASS) | (confirmed != PASS)`, the row
  locators needed to look up `record_id`, `holding`, `security_id` and `line`; build the frame after the loop. Do
  not widen `account_units`. No `log_rows` call (the row ledger stays as it is).
- [ ] **Step 4: Add the CHECK** in the CHECK cell: for every `(account_id, test)`, the file's row counts by result
  (confirmed fail = both outcomes `fail`; unresolved fail = `outcome` `fail` and confirmed-only not `fail`; cleared;
  not evaluable) equal `failed_confirmed`, `failed_unresolved`, `cleared`, `not_evaluable` of `account_test_rows`,
  and no pair with a non-zero count is missing from the file. `assert` with a message naming the first mismatch.
- [ ] **Step 5:** add to the 12b markdown cell one sentence: what `02_account_outcomes.csv` lists and that the CHECK
  ties it to the account scores.
- [ ] **Step 6:** `tests/fixture_test.sh` → all expectations pass, including the existing shuffle comparison (it
  covers every `02_*.csv`).
- [ ] **Step 7: Full data.** `/usr/bin/time -l tests/run_notebook.sh`, then:

```bash
for f in tests/runs/exec_baseline/02_*.csv; do n=$(basename "$f"); [ "$n" = 02_run_info.csv ] && continue; cmp -s "$f" "outputs/$n" || echo "DIFFERENT $n"; done
```

  Expected: no line printed. Report elapsed time and peak memory beside Task 0's; a rise above 10 % in either goes to
  the user before the task is called done.
- [ ] **Step 8: Checkpoint.** Report: rows in the new file by `unit_kind` and whether `holding` is filled (counts
  only, no IDs); the CHECK's result; time and memory.

---

### Task 2: the store copies the new tables and the plain rule names (Opus)

**Files:**
- Modify: `scripts/build_store.py` (docstring step 5, `SCORECARD_TABLES` area, `check_plain`, `plain_rows`, `main`)
- Modify: `scripts/plain_language.json` (new `rules` block)
- Create: `tests/stress_fixture.py` (made-up stress files)
- Modify: `tests/prepare_dashboard_fixture.py`, `tests/store_test.sh` (both call it before `build_store.py`)
- Test: `tests/store_test.sh`, `tests/test_plain_language.py`

**Interfaces:**
- Consumes: `outputs/02_account_outcomes.csv` (Task 1), `02_severity.csv`, `02_impact_detail.csv`,
  `03_stress_rates.csv`, `03_stress_impact.csv`, `03_stress_run.csv`; `load_scorecard_table`.
- Produces, in `build_store.py`:

```python
EXECUTIVE_TABLES = {   # table -> (CSV file, columns stored as DOUBLE); loaded with load_scorecard_table
    'severity': ('02_severity.csv', [
        'financial_rows', 'distinct_accounts', 'accounts_without_fund_mapping', 'affected_funds',
        'fund_wide_account_cohort', 'valued_rows', 'unknown_rows', 'valuation_coverage',
        'signed_delta_usd_valued_subset', 'gross_delta_usd_valued_subset', 'max_abs_fund_net_bps_valued_subset',
        'max_fund_gross_bps_valued_subset', 'funds_without_NAV_denominator', 'account_ids_in_extract',
        'account_share_of_extract']),
    'impact_detail': ('02_impact_detail.csv', ['delta_units', 'delta_usd']),
    'account_outcomes': ('02_account_outcomes.csv', []),
    'stress_rates': ('03_stress_rates.csv', ['cases', 'share', 'drawn', 'wanted']),
    'stress_impact': ('03_stress_impact.csv', ['signed_usd', 'gross_usd', 'fund_net_assets_usd', 'signed_bps',
                                               'gross_bps', 'before', 'after']),
    'stress_run': ('03_stress_run.csv', []),
}
```

  Store tables `severity`, `impact_detail`, `account_outcomes`, `stress_rates`, `stress_impact`, `stress_run` with
  their CSV's column names; a missing file gives the existing single-`note`-column table.
  `plain_text` gains rows `kind = 'rule'`, `key = <rule ID>`, `text = <plain name>`.
- `scripts/plain_language.json` `"rules"`: one short plain name per rule ID that appears as `rule` in the `[tests]`
  of the scorecard config (`SCORECARD_CONFIG`, default `config/scorecard.toml`). Names state what must hold, in a few
  words, like the check sentences already in that file (for example "Every trade names a known security"). The team
  reviews them.

- [ ] **Step 1: Failing contracts** in `tests/store_test.sh`, after the scorecard block:

```python
from build_store import EXECUTIVE_TABLES
for table, (file_name, numeric) in EXECUTIVE_TABLES.items():
    path = os.path.join(os.environ['RECONCILIATION_OUTPUTS'], file_name)   # stress files: tests/stress_fixture.py
    got = [r[0] for r in con.sql(f'DESCRIBE "{table}"').fetchall()]
    with open(path, newline='', encoding='utf-8') as stream:
        rows = list(csv.reader(stream))
    assert got == rows[0], f'{table}: columns differ from {file_name}'
    assert one(f'SELECT count(*) FROM "{table}"')[0] == len(rows) - 1, f'{table}: row count differs'
    types = dict((r[0], r[1]) for r in con.sql(f'DESCRIBE "{table}"').fetchall())
    assert all(types[c] == ('DOUBLE' if c in numeric else 'VARCHAR') for c in rows[0]), f'{table}: column types'
assert one("SELECT count(*) FROM severity WHERE gross_delta_usd_valued_subset IS NULL")[0] > 0, \
    'a scenario with nothing valued must stay NULL, not 0'
scored = {r[0] for r in con.sql("SELECT DISTINCT rule FROM scorecard WHERE level = 'rule'").fetchall()}
named = {r[0] for r in con.sql("SELECT key FROM plain_text WHERE kind = 'rule' AND coalesce(text, '') <> ''").fetchall()}
assert scored == named, f'plain rule names: missing {sorted(scored - named)}, unknown {sorted(named - scored)}'
print('executive tables OK')
```

  The script calls `uv run --quiet python tests/stress_fixture.py "$W"` after `tests/run_notebook.sh` and before
  `build_store.py`. And in the no-register block of the same script (no output file present): each of the six
  tables exists with the single column `note`.
- [ ] **Step 2:** in `tests/test_plain_language.py` add `test_every_scored_rule_has_a_plain_name` (the `rules` keys
  equal the rule IDs of `config/scorecard.toml`'s `[tests]`) and `test_a_missing_rule_name_fails_the_check`
  (`check_plain` raises `AssertionError` when one key is removed).
- [ ] **Step 3:** run both → fail.
- [ ] **Step 4: Implement.** `EXECUTIVE_TABLES` loaded in `main` right after the `SCORECARD_TABLES` loop, with the
  same printed line per table. `check_plain(plain, graph=GRAPH, scored_rules=None)`: when `scored_rules` is given,
  `set(plain['rules']) == scored_rules` or it asserts with the missing and unknown IDs; `main` passes the rule IDs
  read from the scorecard config. `plain_rows` appends the `rule` rows. Update docstring step 5.
- [ ] **Step 5: Fixture stress files.** `tests/stress_fixture.py` has `write(output: Path) -> None` and a
  `__main__` that takes the folder as its argument and refuses a folder outside `tests/runs`.
  `tests/prepare_dashboard_fixture.py` calls `write(output)` before `build_store.py` runs; `tests/store_test.sh`
  calls the script (Step 1). It writes into `output`: `03_stress_rates.csv` (header `role,level,cases,share,drawn,wanted`; the nine role/level rows and the
  two `untouched` rows, made-up counts), `03_stress_impact.csv` (header: `IMPACT_COLUMNS` from `scripts/stress.py`
  plus `source,measure,before,after`; one `source = deliverable` row `platform score` whose `before` is the platform
  score read from the fixture's `02_scorecard.csv` and whose `after` is made up, and one row
  `scale flag: gross_delta_usd_valued_subset (upper bound)` with a blank `before`), `03_stress_run.csv` (header
  `item,value`; rows `seed`, `sizes`, `multiplier`, `finished at`, `labels sha256`, `labels path` with a made-up
  absolute path). A comment says they are made up for the dashboard tests.
- [ ] **Step 6:** `tests/store_test.sh` and `uv run python -m unittest discover tests` → pass.
  `uv run python scripts/build_store.py` on the full outputs → prints the six new tables with row counts.
- [ ] **Step 7: Checkpoint.** `uv run python scripts/check_docs.py` passes.

---

### Task 3: pure view logic (Opus)

**Files:**
- Create: `dashboard/lib/executive-types.ts`, `dashboard/lib/executive.ts`
- Test: `dashboard/tests/executive.test.ts`

**Interfaces (Produces).** `dashboard/lib/executive-types.ts`:

```ts
export type Num = number | null;
export type ScoreTrio = { score: Num; coverage: Num; confirmedOnly: Num };
export type DomainScore = ScoreTrio & { domain: string; owner: string };
export type TestScore = ScoreTrio & {
  test: string; unitKind: string; population: Num; evaluable: Num; passed: Num;
  failedConfirmed: Num; failedUnresolved: Num; cleared: Num; notEvaluable: Num;
};
export type RuleScore = ScoreTrio & {
  domain: string; rule: string; name: string; owner: string; whatItTests: string; onFail: string; tests: TestScore[];
};
export type Result = "confirmed fail" | "unresolved fail" | "not evaluable" | "cleared";
export type OutcomeRecord = {
  domain: string; rule: string; test: string; unitKind: string; recordId: string;
  /** The accounts the unit names, sorted: several only for a transaction_id unit on a rule page. */
  accounts: string[];
  holding: string; securityId: string; result: Result; finding: string; plain: string;
};
export type RecordFilter = { result?: Result; finding?: string; domain?: string; page?: number };
export type RecordPage = {
  total: number; page: number; pages: number; counts: Record<Result, number>;
  findings: { finding: string; plain: string; rows: number }[]; domains: string[]; rows: OutcomeRecord[];
};
export type SeriesPoint = { start: string; value: Num; threshold: Num; breach: boolean };
export type IndicatorSeries = { key: string; period: string; points: SeriesPoint[] };
export type Lookback = {
  lagging: string; laggingKeys: Num; flaggedEarlier: Num; misses: Num; shareFlaggedEarlier: Num;
  earliestLeadDays: Num; medianLeadDays: Num; verdict: string;
};
export type Indicator = {
  id: string; name: string; type: string; status: string; threshold: string; owner: string; refresh: string;
  inputsNeeded: string; value: Num; unit: string; breaches: Num; firstBreach: string;
  series: IndicatorSeries[]; lookback: Lookback[];
};
export type Kpi = {
  n: string; office: string; kpi: string; formula: string; unit: string; owner: string; target: string;
  value: Num; met: string; status: string;
};
export type AccountScore = ScoreTrio & {
  accountId: string; inMaster: boolean; fundId: string; shareClass: string; rank: Num; navProximity: Num;
  weakestLink: Num; domains: { domain: string; score: Num; coverage: Num }[]; fundNavResult: string;
};
export type WorstAccounts = { rows: AccountScore[]; scored: number; tiedBeyond: number };
export type Scenario = {
  scenario: string; interpretation: string; evidence: string; accountScope: string; financialRows: Num;
  valuedRows: Num; unknownRows: Num; valuationCoverage: Num; signedUsd: Num; grossUsd: Num; maxFundNetBps: Num;
  distinctAccounts: Num; affectedFunds: Num;
};
export type ImpactRecord = {
  accountId: string; securityId: string; fundId: string; deltaUnits: Num; deltaUsd: Num; valuationReason: string;
  ledgerId: string;
};
export type ImpactPage = { total: number; page: number; pages: number; priced: number; notPriced: number; rows: ImpactRecord[] };
export type Sensitivity = {
  variant: string; level: string; name: string; score: Num; mainScore: Num; change: Num; worstN: Num;
  worstNKept: Num; tiesAtCutoff: Num; rankCorrelation: Num;
};
export type StressRate = { role: string; level: string; cases: Num; share: Num; drawn: Num; wanted: Num };
export type StressMeasure = { measure: string; before: Num; after: Num };
export type Stress = { rates: StressRate[]; measures: StressMeasure[]; run: Record<string, string> };
/** A part of the page whose table the store lacks (built before this change, or its CSV was missing). */
export type Part = "scorecard" | "indicators" | "kpis" | "accounts" | "impact" | "sensitivity" | "stress";
export type ExecutiveData = {
  platform: ScoreTrio | null; domains: DomainScore[]; rules: RuleScore[]; indicators: Indicator[]; kpis: Kpi[];
  worst: WorstAccounts; scenarios: Scenario[]; sensitivity: Sensitivity[]; stress: Stress | null; missing: Part[];
};
```

`dashboard/lib/executive.ts` (no imports beyond the types and `Tone` from `./status`):

```ts
export const PAGE_SIZE = 50;
export const WORST_ACCOUNTS = 10;
export const RESULTS: Result[];                                  // "confirmed fail", "unresolved fail", "not evaluable", "cleared"
export const RESULT_TONE: Record<Result, Tone>;                  // bad, warn, info, ok
export function resultOf(outcome: string, confirmedOnly: string): Result | null;
export function parseResult(value: string | undefined): Result | undefined;
export function parsePage(value: string | undefined, pages: number): number;   // 1..max(pages, 1)
export function fmtScore(v: Num): string;                        // "64.35"; null -> "–"
export function fmtShare(v: Num): string;                        // fraction 0..1 -> "43.2%"; null -> "–"
export function fmtCount(v: Num): string;                        // "4,321"; null -> "–"
export function fmtUsd(v: Num): string;                          // "$2,345,678,901"; negative "−$12,345"; null -> "not priced"
export function fmtUsdShort(v: Num): string;                     // "$123.5M", "$1.2B", below a million as fmtUsd
export function fmtBps(v: Num): string;                          // "321.45 bps"; null -> "–"
export function defaultRuleOrder(rules: RuleScore[]): RuleScore[];
export type RuleSort = "name" | "domain" | "score" | "coverage" | "confirmedOnly" | "owner";
export function sortRules(rules: RuleScore[], by: RuleSort, direction: "asc" | "desc"): RuleScore[];
export function splitScenarios(s: Scenario[]): { priced: Scenario[]; notPriced: Scenario[]; noRecords: Scenario[] };
export function largestScenario(s: Scenario[]): Scenario | null;
export function leadingBreaches(i: Indicator[]): { breaching: number; computed: number; earliest: string };
export function drawable(series: IndicatorSeries[]): IndicatorSeries[];
export function sparkline(points: SeriesPoint[], width: number, height: number): { path: string; marks: { x: number; y: number }[] } | null;
export function stressState(stress: Stress | null, platformScore: Num): "not run" | "older run" | "current";
export const RUN_FACTS: string[];                                // "seed", "sizes", "multiplier", "finished at", "labels sha256"
export function traceTarget(unitKind: string, recordId: string): { id: string; note: string } | null;
export function noTraceReason(unitKind: string): string;       // why traceTarget gave null for this kind
export function impactTraceTarget(r: ImpactRecord): string | null;
export function traceHref(id: string): string;                   // "/trace?id=…"
export function ruleHref(domain: string, rule: string, filter?: RecordFilter): string;
export function accountHref(id: string, filter?: RecordFilter): string;
export function scenarioHref(name: string, filter?: { priced?: "yes" | "no"; page?: number }): string;
export function executiveHref(q: { by?: "score" | "dollars"; domain?: string }): string;   // adds "#fix-first" when domain is set
```

Rules the signatures do not settle:
- `resultOf`: `fail`+`fail` → confirmed fail; `fail`+anything else → unresolved fail; `not evaluable` → not
  evaluable; `cleared` → cleared; anything else → `null`.
- `fmtScore` never rounds up: a stored `99.999` shows as `99.99` (truncate to two decimals, as the notebook does).
- `defaultRuleOrder`: score ascending with `null` last, then coverage ascending with `null` last, then domain, then
  rule ID. `sortRules` puts `null` last in both directions.
- `splitScenarios`: `noRecords` = `financialRows` is 0 or `null`, ordered by name; of the rest, priced =
  `grossUsd !== null`, ordered by `grossUsd` descending then name; not priced ordered by `distinctAccounts`
  descending (`null` last) then name. `largestScenario`: the first priced one with `grossUsd > 0`.
- `leadingBreaches`: over indicators with `type === "Leading"` and `status === "computed"`; breaching = `breaches > 0`;
  `earliest` = the smallest non-blank `firstBreach` among them, `""` when none.
- `drawable`: series with `period` `day` or `effective date` and at least two points with a value.
- `sparkline`: `null` for fewer than two valued points; a constant series is a flat line at mid height; points with
  a `null` value are skipped; `marks` are the breach points.
- `stressState`: `null` or no rates → "not run"; a `platform score` measure whose `before` is not `null` and differs
  from `platformScore` by 0.005 or more → "older run"; otherwise "current".
- `traceTarget`: the table in spec §4. `price row` → the first space-separated token, note "opens this price's
  security"; `rate row` and `feed-day` → `null`; a blank `recordId` → `null`; other kinds → the ID with an empty
  note. `noTraceReason`: `rate row` → "No single record to trace: a currency rate is shared by many records";
  `feed-day` → "No single record to trace: this is one feed on one day"; any other kind → "No record ID to trace".
- `impactTraceTarget`: `ledgerId`, else `accountId + "/" + securityId` when both are filled, else `null`.
- Link builders use `URLSearchParams`, leave out unset and default values (`page` 1), and keep parameter order
  fixed: rule `domain, rule, result, finding, page`; account `id, domain, result, finding, page`; scenario
  `name, priced, page`.

- [ ] **Step 1: Write the failing tests** in `dashboard/tests/executive.test.ts` (made-up inputs only). At least:

```ts
test("an outcome's result", () => {
  expect(resultOf("fail", "fail")).toBe("confirmed fail");
  expect(resultOf("fail", "pass")).toBe("unresolved fail");
  expect(resultOf("fail", "not evaluable")).toBe("unresolved fail");
  expect(resultOf("not evaluable", "not evaluable")).toBe("not evaluable");
  expect(resultOf("cleared", "cleared")).toBe("cleared");
  expect(resultOf("pass", "pass")).toBeNull();
});
test("blanks never become numbers", () => {
  expect(fmtScore(null)).toBe("–");
  expect(fmtUsd(null)).toBe("not priced");
  expect(fmtScore(0)).toBe("0.00");
  expect(fmtUsd(0)).toBe("$0");
});
test("a score is never rounded up", () => expect(fmtScore(99.999)).toBe("99.99"));
test("money", () => {
  expect(fmtUsd(2345678900.87)).toBe("$2,345,678,901");
  expect(fmtUsd(-12345.4)).toBe("−$12,345");
  expect(fmtUsdShort(123456789.1)).toBe("$123.5M");
  expect(fmtUsdShort(1234567890)).toBe("$1.2B");
  expect(fmtUsdShort(10400)).toBe("$10,400");
});
test("shares and basis points", () => {
  expect(fmtShare(0.4329)).toBe("43.2%");
  expect(fmtShare(1)).toBe("100.0%");
  expect(fmtBps(321.4567)).toBe("321.45 bps");
});
test("trace targets by unit kind", () => {
  expect(traceTarget("key", "A1/S1")).toEqual({ id: "A1/S1", note: "" });
  expect(traceTarget("price row", "S1 2026-07-10 V1")?.id).toBe("S1");
  expect(traceTarget("rate row", "EUR 2026-07-10 1.1")).toBeNull();
  expect(traceTarget("feed-day", "FEED 2026-07-10")).toBeNull();
  expect(noTraceReason("feed-day")).toContain("one feed on one day");
  expect(traceTarget("transaction row", "")).toBeNull();
});
test("links round-trip names with : / and spaces", () => {
  const name = "Reconciliation: rebuild is the odd one out: A/B test";
  expect(new URL(scenarioHref(name), "http://x").searchParams.get("name")).toBe(name);
  expect(new URL(ruleHref("Corporate actions", "CA_TERMS_COMPLETE"), "http://x").searchParams.get("domain")).toBe("Corporate actions");
  expect(new URL(traceHref("A1/S1"), "http://x").searchParams.get("id")).toBe("A1/S1");
  expect(executiveHref({ domain: "Trades" })).toBe("/executive?domain=Trades#fix-first");
});
test("page and result parameters are clamped, not trusted", () => {
  expect(parsePage("0", 5)).toBe(1);
  expect(parsePage("999", 5)).toBe(5);
  expect(parsePage("abc", 5)).toBe(1);
  expect(parsePage("2", 0)).toBe(1);
  expect(parseResult("bogus")).toBeUndefined();
  expect(parseResult("cleared")).toBe("cleared");
});
```

  Plus one test each for: `defaultRuleOrder` (a `null` score last; equal scores ordered by coverage),
  `splitScenarios` (a `null` gross with rows goes to `notPriced`; a zero gross stays priced; zero rows goes to
  `noRecords`), `largestScenario` (ignores a
  zero gross; `null` when nothing is priced), `leadingBreaches` (a proposed and a lagging indicator are not
  counted), `drawable` and `sparkline` (one point → `null`; constant series → flat path; `null` values skipped),
  `stressState` (the three states, and a blank `before` is "current"), `impactTraceTarget` (ledger first; blank
  security → `null`).
- [ ] **Step 2:** `cd dashboard && npm test -- executive.test` → fails (module missing).
- [ ] **Step 3: Implement** both files.
- [ ] **Step 4:** `npm test -- executive.test` → passes; `npm run lint` clean.
- [ ] **Step 5: Checkpoint.**

---

### Task 4: the reads (Opus)

**Files:**
- Create: `dashboard/lib/executive-store.ts`
- Modify: `dashboard/lib/store.ts` (export `connect`, `rows`, `text`, `hasTable`, `hasColumn`; update the header
  comment: reads live in this file and in `executive-store.ts`), `dashboard/lib/data.ts`
- Test: `dashboard/tests/executive-store.test.ts`

**Interfaces:**
- Consumes: Task 2's tables; Task 3's types, `resultOf`, `PAGE_SIZE`, `WORST_ACCOUNTS`, `RESULTS`.
- Produces, in `executive-store.ts`:

```ts
export const maybe: (v: unknown) => number | null;          // null, undefined, "" -> null; else Number(v)
export async function getExecutive(): Promise<ExecutiveData>;
export async function getRule(domain: string, rule: string, filter: RecordFilter):
  Promise<{ rule: RuleScore; records: RecordPage } | null>;                      // null: no such domain + rule
export async function getAccount(id: string, filter: RecordFilter):
  Promise<{ account: AccountScore; scored: number; records: RecordPage; inherited: boolean } | null>;
export async function getScenario(name: string, filter: { priced?: "yes" | "no"; page?: number }):
  Promise<{ scenario: Scenario; records: ImpactPage } | null>;
```

  and in `data.ts`: `loadExecutive()`, `loadRule(domain, rule, filter)`, `loadAccount(id, filter)`,
  `loadScenario(name, filter)`, each through the existing `load`.

Rules:
- Every value is a bound parameter; table names are literals in the file.
- A table counts as present when it exists **and** has its key column (`scorecard.level`, `indicators.id`,
  `kpis.n`, `scorecard_accounts.account_id`, `severity.scenario`, `scorecard_sensitivity.variant`,
  `stress_rates.role`, `account_outcomes.account_id`, `impact_detail.scenario`); otherwise its part goes into
  `missing` and its data is empty (`stress: null`).
- `RuleScore.name`: `plain_text` kind `rule`, the rule ID as fallback. `whatItTests`, `onFail`: `rule_catalog`.
  `tests`: the `test` rows of that domain and rule, in test ID order.
- Records for a rule: the units of `score_outcomes` for that domain and rule (`holding`, `securityId` empty). Rows
  with `unit_kind = 'transaction_id'` are grouped by `(test, record_id)` into one record whose `accounts` are the
  distinct non-blank account IDs, sorted (their outcomes and line are the same on every row); every other row is
  one record with zero or one account. All counts, filters and paging work on records, not rows. Records for an
  account: `account_outcomes` rows of that account when the table is present (`inherited: true`), else the
  `score_outcomes` rows carrying that account ID (`inherited: false`); `accounts` is that one ID. `plain`:
  `register.plain` joined on `register.finding = line`, the line itself as fallback.
- `RecordPage`: `counts` and `findings` are computed over the rule's or account's rows before the `result` and
  `finding` filters (so the chips keep their numbers); `domains` lists the domains present (account page); `total`
  is the filtered count; `pages = ceil(total / PAGE_SIZE)`; `page` clamped with `parsePage` semantics; order:
  result in `RESULTS` order, then `recordId`, then `test`, then `holding`.
- `getAccount`: `null` when the ID is not in `scorecard_accounts`. `scored` = accounts with a rank.
  `AccountScore.domains`: one entry per domain column pair present in the table (read the column names from
  `information_schema`, never a typed list), blank → `null`.
- `WorstAccounts`: the `WORST_ACCOUNTS` rows with the smallest rank; `tiedBeyond` = accounts with a rank beyond the
  cut whose score equals the last row's score.
- `getScenario`: records ordered by `abs(delta_usd)` descending with `NULL` last, then account, then security;
  `priced` / `notPriced` count rows with and without `delta_usd` before the filter.
- `Stress.measures`: `stress_impact` rows with `source = 'deliverable'`, in file order. `Stress.run`: every
  `stress_run` row whose `item` is in `RUN_FACTS`, with `labels sha256` cut to its first 12 characters; paths are
  never returned.
- Indicators come with their `indicator_series` (grouped by key and period, ordered by `start`) and their
  `indicator_lookback` rows (`leading = id`); `breach` is `breach = 'yes'`.

- [ ] **Step 1: Write the failing tests** in `dashboard/tests/executive-store.test.ts`. Expected values are read
  from the fixture's CSV files beside the store (`path.dirname(storePath())`) with DuckDB
  `read_csv(?, all_varchar = true)`, never typed. Tests:
  - `platform, domains and rules equal 02_scorecard.csv`: every platform, domain and rule row's score, coverage and
    confirmed-only score (as `Number`, blank as `null`).
  - `every test's listed records reconcile with its scorecard counts`: for each rule, fetch all pages of `getRule`
    and compare the per-test count of each `Result` with `failedConfirmed`, `failedUnresolved`, `notEvaluable`,
    `cleared` of that test.
  - `a transaction ID listed on two accounts is one record`: on a copy of the store, insert into `score_outcomes` a
    second row for an existing `transaction_id` unit with another fixture account ID; `getRule` for its rule returns
    the same `total` and `counts` as before the insert, and that record has both accounts, sorted.
  - `an account's records are the rows of 02_account_outcomes.csv`: for every scored account, `records.total`
    without a filter equals the file's row count for that account, and `inherited` is `true`.
  - `an inherited record carries its holding`: on a copy of the store, insert into `account_outcomes` one made-up
    row with `unit_kind = 'security'`, a `holding` and a `security_id` for a fixture account; `getAccount` lists it
    with that `holding`, and `total` grows by one.
  - `worst accounts are the lowest ranks, with the tie note`: ranks `1..n` in order; `tiedBeyond` equals a recount
    from `02_scorecard_accounts.csv`.
  - `an unpriced scenario stays null`: a scenario whose `gross_delta_usd_valued_subset` is blank in
    `02_severity.csv` has `grossUsd === null`; one with `0.0` has `0`.
  - `scenario records are ordered by absolute dollars, unpriced last`, and `priced + notPriced === total` unfiltered.
  - `a proposed indicator has no value` (`value === null`, `inputsNeeded` not empty) and `series are ordered by start`.
  - `stress: measures, rates and run facts, never a path`: `run` has no key containing `path`, `labels sha256` has
    12 characters, and `stressState(stress, platform.score)` is `"current"` on the fixture.
  - `unknown rule, account and scenario give null`; `page 999 is clamped to the last page`; `a bogus result filter
    is ignored` (pass `undefined` from `parseResult`).
  - `a store built before this change`: copy the store (`copyStore` pattern of `store.test.ts`), drop `severity`,
    `impact_detail`, `account_outcomes`, replace `stress_rates` by a table with only a `note` column, point
    `STORE_PATH` at the copy: `getExecutive()` resolves with `missing` containing `"impact"` and `"stress"`,
    `stress === null`, `scenarios` empty; `getAccount` on a fixture account resolves with `inherited === false` and
    the `score_outcomes` rows of that account.
- [ ] **Step 2:** `npm test -- executive-store.test` → fails.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** `npm test` (whole suite) → passes; `npm run lint` clean.
- [ ] **Step 5: Checkpoint.**

---

### Task 5: the page, parts 1 and 2 (Sonnet)

**Files:**
- Create: `dashboard/app/executive/page.tsx`; in `dashboard/components/executive/`: `score-trio.tsx`,
  `headline-tiles.tsx`, `domain-scores.tsx`, `indicator-cards.tsx`, `sparkline.tsx`, `kpi-table.tsx`,
  `worst-accounts.tsx`, `part-missing.tsx`
- Modify: `dashboard/components/shell/app-sidebar.tsx`
- Test: `dashboard/e2e/executive.spec.ts` (new; copy the `beforeEach` / `afterEach` of `dashboard.spec.ts`)

**Interfaces:**
- Consumes: `loadExecutive()`; Task 3's formatters, `largestScenario`, `leadingBreaches`, `drawable`, `sparkline`,
  `executiveHref`, `accountHref`, `scenarioHref`; `Dot`, `Pill`, `Section` from `components/common.tsx`.
- Produces: `<ScoreTrio trio={ScoreTrio} size?="lg" />` (score, "coverage …", "confirmed only …" always together;
  `data-testid="score"`, `"coverage"`, `"confirmed-only"` on the three values), reused by Tasks 6 to 9.
  `<PartMissing part={Part} />`: "This part needs a rebuilt store: uv run python scripts/build_store.py".
  Page sections carry `id="degrading"`, `id="fix-first"`, `id="trust"` and `<h2>` headings "Where is the platform
  degrading?", "What should we fix first?", "Can we trust these numbers?" (Tasks 6 and 7 fill the last two; this
  task renders their headings with an empty body).

Content, from spec §5.1 and §5.2:
- Page title `<h1>` "Executive view", `metadata.title` "Executive view". Missing store → `<StoreMissing>` as the
  other pages.
- Headline tiles (`data-testid="tile-platform"`, `"tile-impact"`, `"tile-leading"`): platform `ScoreTrio`; largest
  scenario: `fmtUsdShort(grossUsd)` with `title={fmtUsd(grossUsd)}`, its name linking to its scenario page, evidence
  status pill, `fmtShare(valuationCoverage)` "of rows priced", and the words "one scenario, not a total"; leading
  indicators: "`breaching` of `computed`" and "first breach `earliest`" (omitted when blank).
- Domains: a table, one row per domain (`data-testid="domain-row"`), domain name linking to
  `executiveHref({ domain })`, a bar whose width is the score (brand blue; the bar is not a health colour),
  `ScoreTrio`, owner.
- Indicators: one card per indicator (`data-testid="indicator-<id>"`): name, `type`, `status` pill (grey for
  proposed), `fmtCount`-free value shown as stored with its unit, threshold text, breaches, first breach, owner; a
  proposed one shows "Proposed: needs `inputsNeeded`" and no value; `drawable(series)` each as `<Sparkline>` with
  the key as label when it is not `all`; look-back rows as one sentence each: "`flaggedEarlier` of `laggingKeys`
  `lagging` flagged earlier, median lead `medianLeadDays` days: `verdict`", under the caption "A look-back on this
  release, not predictive accuracy."
- KPIs: a table grouped by `office` with KPI, value and unit ("not computed" when `null`), target, met (a green or
  red dot with "yes" / "no"; a dash when blank), status, owner; the formula as the row's `title`.
- Worst accounts: `WorstAccounts.rows` with rank, account ID linking to `accountHref`, `ScoreTrio`, one column per
  domain score, fund NAV result; under it, when `tiedBeyond > 0`, "`tiedBeyond` more accounts share the last row's
  score"; a `<form method="get" action="/executive/account">` with `<input name="id" aria-label="Account ID">` and a
  "Open account" button.
- Sidebar: `PAGES` gains `{ href: "/executive", label: "Executive view", icon: LayoutDashboard, hint: "scores, cost,
  what to fix first" }` as its first entry; `LATER` keeps only "Monitoring"; the heading reads "Later".
- `<Sparkline>`: inline SVG from `sparkline(points, 120, 28)`, line in `currentColor` at muted strength, breach
  marks in the red tone, `role="img"` with an `aria-label` naming the indicator and its key. Load the `dataviz`
  skill before writing it.

- [ ] **Step 1: Write the failing browser tests** in `dashboard/e2e/executive.spec.ts`. A helper reads the fixture's
  CSVs from `tests/runs/dashboard_browser_fixture/` with `@duckdb/node-api` (`read_csv(?, all_varchar = true)`).

```ts
test("executive view shows the scorecard's own figures", async ({ page }) => {
  const platform = (await csv("02_scorecard.csv")).find((r) => r.level === "platform")!;
  await page.goto("/executive");
  await expect(page.getByRole("heading", { level: 1, name: "Executive view" })).toBeVisible();
  const tile = page.getByTestId("tile-platform");
  await expect(tile.getByTestId("score")).toHaveText(platform.score);
  await expect(tile.getByTestId("coverage")).toContainText(platform.coverage);
  await expect(tile.getByTestId("confirmed-only")).toContainText(platform.confirmed_only_score);
  const domains = (await csv("02_scorecard.csv")).filter((r) => r.level === "domain");
  await expect(page.getByTestId("domain-row")).toHaveCount(domains.length);
  for (const d of domains)
    await expect(page.getByTestId("domain-row").filter({ hasText: d.domain }).getByTestId("score")).toHaveText(d.score);
});
test("indicators, KPIs and worst accounts are listed, blanks stay blanks", async ({ page }) => {
  const indicators = await csv("02_indicators.csv");
  await page.goto("/executive");
  for (const i of indicators) await expect(page.getByTestId(`indicator-${i.id}`)).toBeVisible();
  const proposed = indicators.find((i) => i.status === "proposed")!;
  await expect(page.getByTestId(`indicator-${proposed.id}`)).toContainText("Proposed");
  await expect(page.getByText("not computed").first()).toBeVisible();          // KPI 7
  const worst = (await csv("02_scorecard_accounts.csv")).find((r) => r.rank === "1")!;
  await expect(page.getByRole("link", { name: worst.account_id })).toBeVisible();
  await expect(page.locator("main")).not.toContainText("NaN");
});
test("the sidebar opens the executive view", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Executive view/ }).click();
  await expect(page).toHaveURL(/\/executive$/);
  await expect(page.getByText("Coming at Check-in 3")).toHaveCount(0);
});
test("narrow screen: no sideways scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/executive");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
```

- [ ] **Step 2:** `cd dashboard && npm run test:e2e -- executive.spec` → fails (404).
- [ ] **Step 3: Implement** the page and components. Wide tables scroll inside their own container on a narrow
  screen (`overflow-x-auto`), the page does not.
- [ ] **Step 4:** `npm run test:e2e` (whole suite: the existing specs must still pass with the changed sidebar),
  `npm run lint`, `npx tsc --noEmit`.
- [ ] **Step 5: Checkpoint.** Start `npm run dev`, open `/executive` on the full store in light and dark mode and
  report what looks wrong; no data value goes into the report.

---

### Task 6: "What should we fix first?" (Sonnet)

**Files:**
- Create: `dashboard/components/executive/fix-first.tsx` (`"use client"`), `fix-first-rules.tsx`,
  `fix-first-scenarios.tsx`
- Modify: `dashboard/app/executive/page.tsx`
- Test: `dashboard/e2e/executive.spec.ts`

**Interfaces:**
- Consumes: `ExecutiveData.rules`, `.scenarios`, `.missing`; `defaultRuleOrder`, `sortRules`, `splitScenarios`,
  `executiveHref`, `ruleHref`, `scenarioHref`, formatters; the page's `searchParams` `by` and `domain`.
- Produces: `<FixFirst rules scenarios by domain impactMissing />`. The switch is two links
  (`role="tab"`, names "By quality score" and "By dollar impact", `aria-selected`) to `executiveHref({ by, domain })`.
  Rule rows `data-testid="rule-row"`, scenario rows `data-testid="scenario-row"`, the not-priced group under
  `<h3>` "Not priced: unknown, not zero".

Content, from spec §5.3:
- `by` other than `dollars` means score. `domain` filters the rule list; an active filter shows "Showing `domain`
  only" with a "Show all domains" link; an unknown domain shows the empty-list sentence "No scored rule in this
  domain".
- Rule columns: name (link to `ruleHref`) with the rule ID in small mono text, domain, `ScoreTrio` as three sortable
  columns (score, coverage, confirmed only), "What failed" (one line per test: "`unitKind`: `failedConfirmed`
  confirmed, `failedUnresolved` unresolved, `notEvaluable` not evaluable", zero parts left out; "nothing failed" when
  all are zero), owner, action on fail.
- Sortable headers are buttons with `aria-sort`; first click on another column sorts ascending, a second click
  flips. The list opens in `defaultRuleOrder`.
- Scenario columns: scenario (link to `scenarioHref`) with `interpretation` in small text, evidence status pill,
  gross USD, signed USD, largest fund effect (`fmtBps(maxFundNetBps)`), share priced, accounts, funds. Priced rows
  in `splitScenarios` order, then the not-priced group, then the group `<h3>` "No records in this run" (scenario
  name and interpretation only; each group is left out when empty). Sortable on the numeric columns within the
  priced group.
- Caption under the dollar list: "Indicative investment-value scenarios, not a verified NAV loss. Scenarios overlap
  and some are alternative readings of the same records: do not add them up."
- `impactMissing` (the `impact` part is in `missing`) → `<PartMissing>` in place of the dollar list.

- [ ] **Step 1: Failing browser tests:**

```ts
test("fix first: lowest score on top, and the switch shows dollars", async ({ page }) => {
  const rules = (await csv("02_scorecard.csv")).filter((r) => r.level === "rule");
  const lowest = Math.min(...rules.map((r) => Number(r.score)));
  await page.goto("/executive");
  await expect(page.getByTestId("rule-row")).toHaveCount(rules.length);
  await expect(page.getByTestId("rule-row").first().getByTestId("score")).toHaveText(lowest.toFixed(2));
  await page.getByRole("tab", { name: "By dollar impact" }).click();
  await expect(page).toHaveURL(/by=dollars/);
  const severity = await csv("02_severity.csv");
  await expect(page.getByTestId("scenario-row")).toHaveCount(severity.length);
  const empty = severity.filter((r) => Number(r.financial_rows) === 0).length;
  const unknown = severity.filter((r) => Number(r.financial_rows) > 0 && r.gross_delta_usd_valued_subset === "").length;
  await expect(page.getByRole("heading", { name: "No records in this run" })).toHaveCount(empty ? 1 : 0);
  await expect(page.getByRole("heading", { name: "Not priced: unknown, not zero" })).toHaveCount(unknown ? 1 : 0);
  await expect(page.getByText("do not add them up")).toBeVisible();
});
test("fix first: a domain filters the list, a header re-sorts it", async ({ page }) => {
  const rules = (await csv("02_scorecard.csv")).filter((r) => r.level === "rule");
  await page.goto("/executive");
  await page.getByTestId("domain-row").filter({ hasText: "Trades" }).getByRole("link", { name: "Trades" }).click();
  await expect(page).toHaveURL(/domain=Trades#fix-first/);
  await expect(page.getByTestId("rule-row")).toHaveCount(rules.filter((r) => r.domain === "Trades").length);
  await page.getByRole("link", { name: "Show all domains" }).click();
  await page.getByRole("button", { name: "Score" }).click();
  await page.getByRole("button", { name: "Score" }).click();
  const highest = Math.max(...rules.map((r) => Number(r.score)));
  await expect(page.getByTestId("rule-row").first().getByTestId("score")).toHaveText(highest.toFixed(2));
});
```

- [ ] **Step 2:** run → fail. **Step 3:** implement. **Step 4:** `npm run test:e2e`, `npm run lint`,
  `npx tsc --noEmit`. **Step 5: Checkpoint.**

---

### Task 7: the rule page and the shared record table (Sonnet)

**Files:**
- Create: `dashboard/app/executive/rule/page.tsx`; `dashboard/components/executive/records-table.tsx`,
  `result-chips.tsx`, `pager.tsx`, `crumbs.tsx`, `tests-table.tsx`
- Test: `dashboard/e2e/executive.spec.ts`

**Interfaces:**
- Consumes: `loadRule(domain, rule, filter)`; `parseResult`, `parsePage`, `ruleHref`, `traceTarget`, `traceHref`,
  `RESULT_TONE`, `RESULTS`, `ScoreTrio`.
- Produces (reused by Task 8):
  - `<RecordsTable page={RecordPage} hrefFor={(f: RecordFilter) => string} filter={RecordFilter} showDomain?: boolean />`:
    result chips, the finding select, the table, the pager. Rows `data-testid="record-row"`; the trace link's
    accessible name is "Trace `recordId`".
  - `<Pager page pages hrefFor={(page: number) => string} />`: "Previous" / "Next" links and "rows a–b of total".
  - `<Crumbs items={{ label: string; href?: string }[]} />`.

Content, from spec §5.4:
- `searchParams`: `domain`, `rule`, `result`, `finding`, `page`. `loadRule` returning `null` → `<h1>` "No such rule
  in the scorecard" with a link back to `/executive`.
- Header: `<Crumbs>` Executive view › domain (to `executiveHref({ domain })`) › rule name; `<h1>` the plain name with
  the rule ID in mono; owner; "What it tests" and "Action on fail" from `RuleScore`; `ScoreTrio`.
- `<TestsTable tests={TestScore[]} />`: test ID, unit kind, `ScoreTrio`, population, evaluable, passed, confirmed
  fails, unresolved fails, cleared, not evaluable (`fmtCount`).
- Result chips: "All `n`" plus one per `Result` with `counts[result]`, coloured by `RESULT_TONE`, each a link
  keeping the finding filter and resetting the page. Finding filter: a `<form method="get">` with hidden fields for
  the other parameters and a `<select name="finding">` listing `findings` (plain text, with row counts) and "All
  findings".
- Record columns: record (mono), unit kind, test, result pill, finding (`plain`, with the raw `finding` as
  `title`), accounts (each linking to `accountHref`; a dash when none), trace. Trace cell: `traceTarget` → a link
  "Trace" (and its `note` in small text when not empty); `null` → the text of `noTraceReason(unitKind)`.
- Under the table: "Passed records are counted in the tests above and not listed."
- No records at all (a rule with nothing failing): "Every unit of this rule passed."

- [ ] **Step 1: Failing browser tests:**

```ts
test("drill-down: a rule lists its records and one opens in the trace", async ({ page }) => {
  const outcomes = (await csv("02_score_outcomes.csv")).filter((r) => r.rule === "TXN_ONE_REVERSAL_PER_ORIGINAL");
  await page.goto("/executive");
  await page.getByTestId("rule-row").first().getByRole("link").first().click();
  await expect(page).toHaveURL(/\/executive\/rule\?/);
  await expect(page.getByText("TXN_ONE_REVERSAL_PER_ORIGINAL")).toBeVisible();
  await expect(page.getByTestId("record-row")).toHaveCount(outcomes.length);
  await page.getByTestId("record-row").first().getByRole("link", { name: /^Trace / }).click();
  await expect(page).toHaveURL(/\/trace\?id=/);
  await expect(page.getByText("No record found")).toHaveCount(0);
  await expect(page.locator("[id^='trace-step-']").first()).toBeVisible();
});
test("rule page: result chips filter, a rate row has no trace link, bad addresses are calm", async ({ page }) => {
  await page.goto("/executive/rule?domain=Prices&rule=FX_RATE_VALID");
  await expect(page.getByText("No single record to trace")).toBeVisible();
  await page.goto("/executive/rule?domain=Positions&rule=POS_REBUILD_MATCHES&result=bogus&page=999");
  await expect(page.getByTestId("record-row").first()).toBeVisible();
  await page.goto("/executive/rule?domain=Nowhere&rule=NOPE");
  await expect(page.getByRole("heading", { name: "No such rule in the scorecard" })).toBeVisible();
});
```

  (The first rule row of the fixture is `TXN_ONE_REVERSAL_PER_ORIGINAL`, its lowest score; if the fixture changes,
  derive the rule from the CSV as Task 6's test does. Check the trace page's "not found" wording in
  `components/trace/trace-view.tsx` and use its actual text.)
- [ ] **Step 2:** run → fail. **Step 3:** implement. **Step 4:** `npm run test:e2e`, `npm run lint`,
  `npx tsc --noEmit`. **Step 5: Checkpoint.**

---

### Task 8: the account page and the scenario page (Sonnet)

**Files:**
- Create: `dashboard/app/executive/account/page.tsx`, `dashboard/app/executive/scenario/page.tsx`;
  `dashboard/components/executive/impact-table.tsx`
- Test: `dashboard/e2e/executive.spec.ts`

**Interfaces:**
- Consumes: `loadAccount`, `loadScenario`; `<RecordsTable>`, `<Pager>`, `<Crumbs>`, `<ScoreTrio>`; `accountHref`,
  `scenarioHref`, `impactTraceTarget`, `traceHref`, formatters.
- Produces: the two pages.

Content, from spec §5.5:
- **Account.** `searchParams`: `id`, `domain`, `result`, `finding`, `page`. A blank `id` or `loadAccount` → `null`:
  `<h1>` "Not a scored account" with the lookup form of Task 5. Otherwise: `<Crumbs>` Executive view › Account;
  `<h1>` the account ID (mono); "in the account master" or "not in the account master" (red pill); fund and share
  class (a dash when blank); "rank `rank` of `scored`"; `ScoreTrio`; "NAV-weighted `navProximity`" and "weakest link
  `weakestLink`"; a table of `domains` (score and coverage; "not applicable" when both are `null`); "Fund NAV
  result: `fundNavResult`" with "shown beside the score, never inside it"; a "Trace this account" link;
  `<RecordsTable showDomain>` with an extra "Through holding" column (`holding`, linking to its trace) and a domain
  chip row. `inherited === false` → the notice "Records an account inherits through its holdings need a rebuilt
  store."
- **Scenario.** `searchParams`: `name`, `priced`, `page`. `null` → `<h1>` "No such impact scenario". Otherwise:
  `<Crumbs>` Executive view › Impact scenario; `<h1>` the scenario name; interpretation; evidence pill; account
  scope; a facts grid (rows, valued rows, unknown rows, share priced, gross USD, signed USD, largest fund effect,
  accounts, funds); the caption of Task 6; chips "All", "Priced `priced`", "Not priced `notPriced`";
  `<ImpactTable rows={ImpactRecord[]} />` with account (link to `accountHref`), security, fund, change in units,
  change in USD (`fmtUsd`), valuation reason, trace (`impactTraceTarget` → link, else a dash); `<Pager>`. Rows
  `data-testid="impact-row"`.

- [ ] **Step 1: Failing browser tests:**

```ts
test("drill-down: account lookup shows its scores and records, and one opens in the trace", async ({ page }) => {
  const worst = (await csv("02_scorecard_accounts.csv")).find((r) => r.rank === "1")!;
  const records = (await csv("02_account_outcomes.csv")).filter((r) => r.account_id === worst.account_id);
  await page.goto("/executive");
  await page.getByLabel("Account ID").fill(worst.account_id);
  await page.getByRole("button", { name: "Open account" }).click();
  await expect(page).toHaveURL(/\/executive\/account\?id=/);
  await expect(page.getByTestId("score").first()).toHaveText(worst.score);
  await expect(page.getByTestId("record-row")).toHaveCount(Math.min(records.length, 50));
  await page.getByTestId("record-row").first().getByRole("link", { name: /^Trace / }).click();
  await expect(page.locator("[id^='trace-step-']").first()).toBeVisible();
});
test("account page: an unknown or empty ID is calm", async ({ page }) => {
  await page.goto("/executive/account?id=NOT-AN-ACCOUNT");
  await expect(page.getByRole("heading", { name: "Not a scored account" })).toBeVisible();
  await page.goto("/executive/account");
  await expect(page.getByRole("heading", { name: "Not a scored account" })).toBeVisible();
});
test("drill-down: a scenario lists its keys with dollars, and one opens in the trace", async ({ page }) => {
  const severity = await csv("02_severity.csv");
  const top = severity.filter((r) => r.gross_delta_usd_valued_subset !== "")
    .sort((a, b) => Number(b.gross_delta_usd_valued_subset) - Number(a.gross_delta_usd_valued_subset))[0];
  const detail = (await csv("02_impact_detail.csv")).filter((r) => r.scenario === top.scenario);
  await page.goto("/executive?by=dollars");
  await page.getByTestId("scenario-row").first().getByRole("link").first().click();
  await expect(page.getByRole("heading", { level: 1, name: top.scenario })).toBeVisible();
  await expect(page.getByTestId("impact-row")).toHaveCount(detail.length);
  await page.getByTestId("impact-row").first().getByRole("link", { name: /^Trace/ }).click();
  await expect(page.locator("[id^='trace-step-']").first()).toBeVisible();
  await page.goto("/executive/scenario?name=No%20such%20scenario");
  await expect(page.getByRole("heading", { name: "No such impact scenario" })).toBeVisible();
});
```

- [ ] **Step 2:** run → fail. **Step 3:** implement. **Step 4:** `npm run test:e2e`, `npm run lint`,
  `npx tsc --noEmit`. **Step 5: Checkpoint.**

---

### Task 9: "Can we trust these numbers?" and the README (Sonnet)

**Files:**
- Create: `dashboard/components/executive/trust-section.tsx`
- Modify: `dashboard/app/executive/page.tsx`, `dashboard/README.md`
- Test: `dashboard/e2e/executive.spec.ts`

**Interfaces:**
- Consumes: `ExecutiveData.stress`, `.sensitivity`, `.platform`, `.missing`; `stressState`, `RUN_FACTS`, formatters.
- Produces: `<TrustSection stress sensitivity platformScore missing />`; blocks `data-testid="stress"` and
  `data-testid="sensitivity"`.

Content, from spec §5.7:
- **Stress.** State "not run": "The stress test has not been run on these outputs. Run tests/stress_test.sh, then
  rebuild the store." State "older run": the same block as "current" under an amber notice "These stress results
  come from an older run: its platform score before injection differs from the scorecard's." Block: a table per
  role (`defect`, `lookalike`, `flip`, shown as "Planted defects", "Valid look-alikes", "Priority flips") with level,
  cases, `fmtShare(share)` and "drawn `drawn` of `wanted`"; the two `untouched` rows as "Changes on untouched
  securities (false positives): `cases`" and "Changes no case explains: `cases`"; the measures table (measure,
  before, after; a `null` shows "none valued"); the run facts as one line; captions: "The rates hold for the sample
  drawn (held equities whose vendor check passes on the snapshot); they are not a general detection rate." and "The
  severity scale row values look-alikes too, so it is an upper bound."
- **Sensitivity.** A table, one row per variant ("NAV-weighted", "Weakest link", "Confirmed only" for
  `nav_proximity`, `weakest_link`, `confirmed_only`): platform score, change against the main score (signed, two
  decimals), "worst `worstN` accounts kept: `worstNKept`", ties at the cut, rank correlation (as stored). The domain
  rows inside `<Collapsible>` "By domain" (`components/ui/collapsible.tsx`).
- `dashboard/README.md`: a section "Executive view" after "Reading a trace": what each part reads (store table and
  the CSV behind it), the three drill-down paths, what a dash, "not priced", "not computed" and "not applicable"
  mean, that scenarios must not be added up, and that the page needs `tests/stress_test.sh` for its stress part. No
  number typed.

- [ ] **Step 1: Failing browser test:**

```ts
test("trust: stress rates, before and after, and the sensitivity variants", async ({ page }) => {
  const rates = await csv("03_stress_rates.csv");
  await page.goto("/executive");
  const stress = page.getByTestId("stress");
  await expect(stress.getByText("Planted defects")).toBeVisible();
  const caught = rates.find((r) => r.role === "defect" && r.level === "caught")!;
  await expect(stress.getByRole("row", { name: /caught/ }).first()).toContainText(caught.cases);
  await expect(stress.getByText("none valued")).toBeVisible();
  await expect(stress).not.toContainText("/Users/");
  await expect(stress.getByText("older run")).toHaveCount(0);
  const sens = page.getByTestId("sensitivity");
  for (const name of ["NAV-weighted", "Weakest link", "Confirmed only"]) await expect(sens.getByText(name)).toBeVisible();
});
```

  The "not run" and "older run" branches are decided by `stressState`, tested in Task 3; they get no browser test.
- [ ] **Step 2:** run → fail. **Step 3:** implement. **Step 4:** `npm run test:e2e`, `npm run lint`,
  `npx tsc --noEmit`, `uv run python scripts/check_docs.py` (it scans `dashboard/README.md`).
  **Step 5: Checkpoint.**

---

### Task 10: full verification, whole-branch review, decision docs (Opus review; controller writes the docs)

- [ ] **Step 1: Long checks** (stop `npm run dev` first), in this order, each must pass:

```bash
tests/run_notebook.sh
uv run python scripts/build_findings.py
tests/fixture_test.sh
tests/robustness_test.sh          # about 25 minutes, about 9 GB RAM
tests/stress_test.sh              # about 7 minutes; exit 0, no false positive, no unattributable change
uv run python scripts/build_findings.py
uv run python scripts/build_store.py
tests/store_test.sh
(cd dashboard && npm test && npm run test:e2e && npm run lint)
uv run python -m unittest discover tests
uv run python scripts/check_docs.py
shasum -a 256 tests/stress/cases.toml     # equals Task 0's value
```

  After the second `build_findings.py`, `git diff docs/FINDINGS.md`: the register and scorecard sections and the
  stress rates table must be unchanged. Any other difference in the stress section is reported with its cause (the
  new file can only add consequence rows on injected securities, and the run's finish time moves).
- [ ] **Step 2: Displayed figures on the full store.** With `npm run dev` on the rebuilt store, compare the platform
  tile, each domain row and three rule rows with `docs/FINDINGS.md`'s scorecard table and `outputs/02_scorecard.csv`,
  and one account page's record count with `outputs/02_account_outcomes.csv`. Report matches, not values.
- [ ] **Step 3: Whole-branch review** (superpowers:requesting-code-review, Opus): the diff of `executive-view`
  against `main`, the spec and this plan. Fix what it finds, re-run the checks the fixes touch, and record the
  rulings in spec §8.
- [ ] **Step 4 (controller): docs.**
  - `docs/DECISIONS.md`: append the next D-number entry (spec §5.10 lists its content); never edit an older entry.
  - `docs/STATUS.md`: step 4 done, the date line, the validation list, the follow-ups (urgency ranking idea, persona
    wireframes, team review of the plain rule names).
  - Spec header: "Approved … built …"; spec §8 complete.
  - `uv run python scripts/check_docs.py` once more.
- [ ] **Step 5:** stop the mockup server (`.superpowers/brainstorm/`), then hand over: what changed, which choices
  were Claude's, and the commit suggestion (the user commits).
