# Timeliness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Code `TXN_TIMESTAMPS_IN_ORDER` and `TXN_AFTER_CUTOFF` from `pipeline_events`. Write feed latency, processing
latency, booking and publication cutoff adherence, and timestamp order, by feed and day with full denominators, to
`outputs/02_timeliness.csv`, plus seven register lines.

**Architecture:** a new section 9b in `notebooks/deliverable.ipynb` builds one row per transaction_id (`timing`) and
writes the per-measure × feed × day table (`timeliness`). Section 10 appends seven register lines at the **end** of
the register, so existing lines keep their order and the dashboard headlines don't change (D-058 picks the lowest
line). Limits come from a new `[timeliness]` config section. The fixture and robustness shell tests pin the behaviour.

**Tech Stack:** Python 3 / pandas / DuckDB in Jupyter (run headless by `tests/run_notebook.sh`), bash test drivers, TOML
config.

**Spec:** `docs/superpowers/specs/2026-11-10-timeliness-design.md`

## Global Constraints

- **Code:** code lives only in `notebooks/deliverable.ipynb`; edit the `.ipynb` (D-037), with no helper module.
- **No hard-coded IDs or thresholds:** no record ID in notebook code, and every threshold read from config.
- **Reading data:** CSVs are read as text; reuse `to_time` (section 2b) and `normalise_timestamp` (section 2), which
  accept `YYYY-MM-DD` and `DD/MM/YYYY`.
- **Register order:** existing register lines stay byte-identical and in the same order. The new lines go after the
  NAV line.
- **Denominators:** eligible + not evaluable = population on every output row and register line.
- **Not evaluable:** one reason per record per measure, in the order missing → unparseable → out of order. Missing =
  the raw text is blank (or there is no pipeline record); unparseable = not blank but `to_time` gives NaT.
- **Limits:** compared with the **daily median** per feed (brief App. B); a median equal to the limit is not above
  it. Cutoff: on time when ≤ cutoff.
- **Repeated IDs:** each field takes the worst case across copies: event earliest; received, booked and published
  latest; cutoff earliest. Blank in any copy → missing; otherwise unreadable in any copy → unparseable. (The spec
  says "later booked and later published"; extending that to every field is the same rule: never the flattering
  copy.)
- **Day:** the cutoff date, else the pipeline event date, else the transaction's `event_timestamp` date, else
  `unknown`. **Feed:** the pipeline `source_system`, else the transaction's, else `unknown`; the lowest value when
  copies differ.
- **No commits:** never commit or push; the user commits. Each task ends with a checkpoint, not a commit.

## Review Focus

1. **A timestamp in another format** (`2026-06-10T09:05:00`) is counted as unparseable, never dropped and never a
   crash. Test: Task 1, edge case FXT07.
2. **A blank cutoff** sends the record to its event date's row, and both cutoff measures are not evaluable (missing).
   Test: Task 1, edge case FXT10.
3. **A trade with no pipeline record** still lands on a feed-day row (from the transaction's own feed and event date),
   missing on every measure. Test: Task 1, edge FIXTURE_OMS 2026-06-15.
4. **Copies that disagree on publication** use the later time and are counted in `copies_disagree`. Test: Task 1,
   edge case FXT02.
5. **A judge loosens one feed's limit live:** only that feed's processing flags may change, and none may switch from
   "no" to "yes". Test: Task 3.

---

### Before Task 1: save the baseline

- [ ] On branch `timeliness-checks` with the code unchanged, copy the current full-data outputs to the scratchpad. Task
  3 (robustness) and Task 4 both rebuild `outputs/`, so this must happen first:
  `mkdir -p "$SCRATCH/baseline" && cp outputs/02_*.csv "$SCRATCH/baseline/"`
  Then confirm the register checksum is `d7e752f55f0a`: `uv run python scripts/check_docs.py` reports no stale
  FINDINGS.

### Task 1: Timeliness measures (config, section 9b, `02_timeliness.csv`)

**Files:**
- Modify: `config/reconciliation.toml` (new `[timeliness]` section after `[nav]`)
- Modify: `notebooks/deliverable.ipynb`: setup cell (cell 2) reads the config; new markdown, code and check cells
  inserted after cell 40 (the end of section 9)
- Test: `tests/fixture_test.sh` (edge-fixture pipeline edits + expectations)

**Interfaces:**
- Produces (setup cell): `FEED_LATENCY_LIMITS: dict[str, float]` and `PROCESSING_LATENCY_LIMITS: dict[str, float]`,
  from `CONFIG['timeliness']['feed_latency_limit_minutes']` and `[...]['processing_latency_limit_minutes']`.
- Produces (section 9b):
  - `timing: pd.DataFrame`: one row per non-blank transaction_id. Columns:
    - identity: `transaction_id`, `source_system`, `day`, `pipeline_records` (int, 0 if none)
    - per field `event`, `received`, `booked`, `published`, `cutoff`: the worst-case Timestamp, plus
      `<field>_problem` ∈ {'', 'missing', 'unparseable'}
    - per measure: a result ∈ {'pass', 'fail', 'missing', 'unparseable', 'out of order'} for the cutoff and order
      measures; for the latencies, 'eligible' or a not-evaluable reason, plus the minutes column
      (`feed_latency_minutes`, `processing_latency_minutes`)
    - `copies_disagree_booking`, `copies_disagree_publication` (bool)
  - `TIMELINESS_MEASURES = ['feed_latency', 'processing_latency', 'booking_cutoff', 'publication_cutoff',
    'timestamp_order']`
  - `timeliness: pd.DataFrame`, written to `OUTPUTS / '02_timeliness.csv'` with `index=False, lineterminator='\n'`.
    Columns in this order:

    ```
    measure, source_system, day, population, eligible, pass, fail,
    not_evaluable_missing, not_evaluable_unparseable, not_evaluable_out_of_order,
    repeated_ids, copies_disagree,
    limit_minutes, median_minutes, p95_minutes, max_minutes, median_above_limit
    ```

  - Totals: `day='all'` rows per feed, and one `source_system='all', day='all'` row per measure.
  - Columns that don't apply to a measure are blank:
    - `pass` and `fail` for the latencies;
    - the latency columns for the other measures;
    - `copies_disagree` except for the two cutoffs;
    - `limit_minutes` and `median_above_limit` on every 'all' row.
  - `median_above_limit` ∈ {'yes', 'no', 'no limit for this feed', 'no eligible record'}.
  - Percentile: `Series.quantile(0.95)` (linear).
- Out-of-order definitions (per record; a check only applies when both timestamps are readable):
  - **feed latency:** received < event
  - **processing latency:** booked < received
  - **booking cutoff:** booked < event or booked < received
  - **publication cutoff:** published < event, received or booked
  - **timestamp order:**
    - fail: any readable pair among (event, received, booked, published) runs backwards;
    - pass: all four readable and non-decreasing;
    - otherwise not evaluable: missing if any of the four is missing, else unparseable.

- [ ] **Step 1: Add the config section** (the values are pinned by the spec; the comments carry the sources)

```toml
[timeliness]
# Compared with the DAILY MEDIAN per feed (brief App. B "median ... by feed; daily"); a median equal to the limit
# passes. Set before looking at this release's latencies. Team assumptions, not State Street SLAs.
[timeliness.feed_latency_limit_minutes]        # received - event; no guide gives a number (team assumption)
OMS_FRONT = 60
TRADE_CAPTURE = 60
CUSTODY_FEED = 60
[timeliness.processing_latency_limit_minutes]  # booked - received; brief App. B: "above four hours" (illustrative)
OMS_FRONT = 240
TRADE_CAPTURE = 240
CUSTODY_FEED = 240
```

- [ ] **Step 2: Write the failing fixture expectations.** In `tests/fixture_test.sh`'s edge-fixture Python block,
  edit `pipeline_events` before the manifest update and add its row count to `counts`. Use `set_field` where an ID
  is unique. For FXT02, change only the second of its two identical rows: a small `change(rows, fields)` that finds
  the second match. The edits:

| ID | Change | Case |
|---|---|---|
| FXT01 | `source_system=OMS_FRONT`, received `2026-06-02 10:00:00`, booked `2026-06-02 10:05:00`, published `2026-06-02 17:59:00` | feed latency 60 = limit; publication on time |
| FXT03 | `source_system=OMS_FRONT`, received `2026-06-03 10:01:00`, booked `2026-06-03 10:10:00` | feed latency 61 |
| FXT04 | `source_system=OMS_FRONT`, booked `2026-06-04 13:06:00` | processing 241 |
| FXT05 | event `05/06/2026 09:00:00` | DD/MM parsed |
| FXT06 | received `''` | missing |
| FXT07 | received `2026-06-10T09:05:00` | unparseable |
| FXT08 | booked `not-a-time` | unparseable |
| FXT09 | booked `2026-07-09 18:00:00` | on time at the boundary |
| FXT10 | cutoff `''` | missing; day from event |
| FXT13 | booked `2026-06-12 18:01:00` | booked late |
| FXT23 | published `2026-06-12 09:08:00` | published < booked |
| FXT02, second copy only | published `2026-06-10 17:00:00` | copies disagree; the later time wins |

  Then, in the expectations block, add the checks below (row lookup:
  `tl = read(run, '02_timeliness.csv').set_index(['measure', 'source_system', 'day'])`; compare as strings, the way
  `read` returns them). **Default run:**
  - `('booking_cutoff','all','all')` → population 17, eligible 13, pass 13, fail 0, not_evaluable_out_of_order 4
  - `('publication_cutoff','all','all')` → fail 17, pass 0
  - `('timestamp_order','all','all')` → fail 4, eligible 17
  - `('feed_latency','all','all')` → eligible 13, not_evaluable_out_of_order 4, median_minutes 5.0
  - `('processing_latency','all','all')` → eligible 17, median_minutes 5.0
  - every latency day row has `median_above_limit == 'no limit for this feed'`

  **Edge run:**
  - `('feed_latency','OMS_FRONT','2026-06-02')` → median_minutes 60.0, limit_minutes 60.0, median_above_limit 'no'
  - `('feed_latency','OMS_FRONT','2026-06-03')` → median_above_limit 'yes'
  - `('processing_latency','OMS_FRONT','2026-06-04')` → median_minutes 241.0, median_above_limit 'yes'
  - `('feed_latency','FIXTURE_OMS','2026-06-05')` → eligible 1
  - `('feed_latency','FIXTURE_OMS','2026-06-08')` → not_evaluable_missing 1
  - `('booking_cutoff','FIXTURE_OMS','2026-06-08')` → pass 1
  - `('processing_latency','FIXTURE_OMS','2026-06-09')` → not_evaluable_unparseable 1
  - `('booking_cutoff','FIXTURE_OMS','2026-06-09')` → not_evaluable_unparseable 1
  - `('feed_latency','FIXTURE_OMS','2026-06-10')` → not_evaluable_unparseable 1
  - `('booking_cutoff','FIXTURE_OMS','2026-07-09')` → pass 1, fail 0
  - `('booking_cutoff','FIXTURE_OMS','2026-06-12')` → pass 1, fail 1
  - `('publication_cutoff','FIXTURE_OMS','2026-06-12')` → fail 1, not_evaluable_out_of_order 1
  - `('publication_cutoff','OMS_FRONT','2026-06-02')` → pass 1
  - `('publication_cutoff','FIXTURE_OMS','2026-06-10')` → fail 2, pass 0, repeated_ids 1, copies_disagree 1
  - `('booking_cutoff','FIXTURE_OMS','2026-06-11')` → eligible 1, not_evaluable_missing 1,
    not_evaluable_out_of_order 4
  - `('booking_cutoff','FIXTURE_OMS','2026-06-15')` → population 2, not_evaluable_missing 2 (FXT30 and FXT40 have no
    pipeline record)
  - `('timestamp_order','FIXTURE_OMS','2026-06-12')` → fail 1

  **Identities on default and edge:**
  - every row: eligible + the three not-evaluable columns = population;
  - for cutoff and order rows, pass + fail = eligible;
  - each feed's `all` row = the sum of its day rows, and the platform row = the sum of the feeds, for population,
    eligible, pass, fail and the three not-evaluable columns.

- [ ] **Step 3: Run it to see it fail.**
  Run: `tests/fixture_test.sh`
  Expected: it stops with `FileNotFoundError ... 02_timeliness.csv` (or FAIL lines for the new expectations).

- [ ] **Step 4: Implement.**
  - **Setup cell:** read the two limit dicts.
  - **New markdown cell:** "## 9b. Timeliness: latency and cutoff by feed and day". State what the section measures
    (the five measures, the App. B median, late is late, denominators) and that it is historical, not monitoring.
  - **Code cell:** build `timing` by aggregating `pipeline_events` per ID; worst case per field via min/max on the
    parsed values, plus the problem flags from the raw text. Left-join from the union of transaction IDs; fall back
    to `transactions` for feed and event date. Derive the per-measure results, group, and write `timeliness`. Print
    the number of blank-ID transaction rows left out.
  - **Check cell:** assert the identities from Step 2. Also assert that `timing['transaction_id']` is unique and that
    its length equals the platform population.

- [ ] **Step 5: Run the tests to see them pass.**
  Run: `tests/fixture_test.sh`
  Expected: `fixture test passed: N expected outcomes observed`. Every earlier check still passes, and the shuffled
  run reports no difference in `02_timeliness.csv`.

- [ ] **Step 6: Checkpoint.** Tell the user Task 1 is ready to review and commit (the user commits).

---

### Task 2: Register lines, members and plain wording

**Files:**
- Modify: `notebooks/deliverable.ipynb`, section 10 code cell (cell 42 before Task 1's insert):
  - add `ID_UNIVERSE['transaction_id'] |= set(pipeline_events['transaction_id'])`
  - add `ID_UNIVERSE['feed/day']` = the `'<source_system> <day>'` strings of the day rows in `timeliness`
  - append seven `finding(...)` calls after the NAV line, under `# --- Timeliness (section 9b)`
- Modify: `scripts/plain_language.json` (`findings`: seven sentences)
- Test: `tests/fixture_test.sh`, `tests/test_plain_language.py` (existing)

**Interfaces:**
- Consumes: `timing`, `timeliness` (Task 1); `finding(name, status, rule, stage, unit, affected_ids, eligible,
  not_evaluable, population, id_kind, how)` (cell 42).
- Produces: the register lines below. All have stage `'pipeline'`.

| Line (exact name) | Status | Rule | Unit / id kind | Affected | Eligible / not evaluable |
|---|---|---|---|---|---|
| `Pipeline timestamp missing` | confirmed | `TXN_TIMESTAMPS_IN_ORDER` | transaction_ids / `transaction_id` | any of the five fields missing (incl. no pipeline record) | all IDs / 0 |
| `Pipeline timestamp unparseable` | confirmed | `TXN_TIMESTAMPS_IN_ORDER` | transaction_ids / `transaction_id` | any field unparseable | all IDs / 0 |
| `Pipeline timestamps out of order` | confirmed | `TXN_TIMESTAMPS_IN_ORDER` | transaction_ids / `transaction_id` | `timestamp_order == 'fail'` | the order measure's |
| `Feed latency: daily median above the feed's limit` | unresolved | `TXN_TIMESTAMPS_IN_ORDER` | feed-days / `feed/day` | day rows with 'yes' | rows with 'yes' or 'no' / the rest |
| `Processing latency: daily median above the feed's limit` | unresolved | `TXN_TIMESTAMPS_IN_ORDER` | feed-days / `feed/day` | same, processing | same |
| `Booked after cutoff` | confirmed | `TXN_AFTER_CUTOFF` | transaction_ids / `transaction_id` | `booking_cutoff == 'fail'` | the measure's |
| `Published after cutoff` | confirmed | `TXN_AFTER_CUTOFF` | transaction_ids / `transaction_id` | `publication_cutoff == 'fail'` | the measure's |

- [ ] **Step 1: Write the failing expectations** in `tests/fixture_test.sh`. Read the members with
  `m = read('edge', '02_finding_members.csv').groupby('finding')['record_id'].apply(set)` and the register with
  `register = read(run, '02_defect_register.csv').set_index('finding')`.

  **Edge run, members:**
  - `Pipeline timestamp missing` ⊇ {FXT06, FXT10, FXT30} and excludes FXT08
  - `Pipeline timestamp unparseable` == {FXT07, FXT08}
  - `Pipeline timestamps out of order` == {FXT11, FXT12, FXT21, FXT22, FXT23}
  - `Booked after cutoff` == {FXT13}
  - `Published after cutoff` ⊇ {FXT02, FXT13} and excludes FXT01 and FXT23
  - `Feed latency: daily median above the feed's limit` == {'OMS_FRONT 2026-06-03'}
  - `Processing latency: daily median above the feed's limit` == {'OMS_FRONT 2026-06-04'}

  **Statuses:** the two latency lines are 'unresolved' and the other five 'confirmed'.

  **Default run:**
  - `Pipeline timestamp unparseable` affected '0'
  - the latency lines: affected '0', eligible '0'

  **Order:** on both runs, the seven new lines are the last seven rows of the register.
- [ ] **Step 2: Run it to see it fail.**
  Run: `tests/fixture_test.sh`
  Expected: `KeyError: 'Pipeline timestamp missing'` or FAIL lines.
- [ ] **Step 3: Implement** the `ID_UNIVERSE` additions and the seven `finding(...)` calls, each with a "how
  detected" text that names section 9b and, for the latency lines, the limit's source. Add seven plain sentences to
  `scripts/plain_language.json`. They say what was observed, never the verdict (none of the words
  `tests/test_plain_language.py` bans). Example: "The trade was booked after that day's 18:00 cutoff, so it was
  carried to the next cycle." The 18:00 is a fact of the data; prefer "after that day's cutoff" so the sentence stays
  true if the cutoff differs.
- [ ] **Step 4: Run the tests to see them pass.**
  Run: `tests/fixture_test.sh && uv run python -m unittest tests.test_plain_language -v`
  Expected: `fixture test passed`, and the plain-language tests OK (the release-register test is skipped or passes
  only after Task 4 rebuilds outputs).
- [ ] **Step 5: Checkpoint** for the user to review and commit.

---

### Task 3: Robustness: a live limit change moves only its own check

**Files:**
- Modify: `tests/robustness_test.sh`. The first heredoc writes `config_threshold.toml`; the final comparison
  heredoc gets the new assertions.

**Interfaces:** consumes `02_timeliness.csv` columns (Task 1).

- [ ] **Step 1: Write the failing test.**
  - **Config:** in the threshold config, also replace `OMS_FRONT = 240` with `OMS_FRONT = 480`; assert the line
    exists, as for `spread_threshold`.
  - **Comparison:** load `run_a` and `run_c` `02_timeliness.csv`. Assert:
    - every row is identical, except the `limit_minutes` and `median_above_limit` columns of the
      `processing_latency` rows with `source_system == 'OMS_FRONT'`;
    - no OMS_FRONT processing day row goes from 'no' to 'yes';
    - the count of 'yes' in run c ≤ the count in run a.
  - **Print:** the 'yes' count before → after, as the spread rehearsal line does.
- [ ] **Step 2: Run it to see it fail** before Task 1 exists, or confirm it fails if the replacement string is
  absent. Since Tasks 1–2 are already in, run it and check that it executes the new assertions (the printed
  rehearsal line appears).
  Run: `tests/robustness_test.sh` (~5–10 min, ~4 GB RAM)
  Expected: the shuffle lines show `02_timeliness.csv: same` for seeds 3, 11 and 25, a printed
  `processing limit OMS_FRONT 240 -> 480: "yes" A -> C` line, and `robustness test passed`.
- [ ] **Step 3: Checkpoint** for the user.

---

### Task 4: Full-data run, register diff, findings

**Files:** `outputs/` (gitignored, regenerated), `docs/FINDINGS.md` (generated).

- [ ] **Step 1: The baseline** is the copy saved in "Before Task 1"; don't recopy it.
- [ ] **Step 2: Run.** `tests/run_notebook.sh`
  Expected: completes (~1.5 min) with no assertion error.
- [ ] **Step 3: Diff the register.** In Python, compare the baseline's register rows with the new file's first N rows:
  - they are byte-identical;
  - the new file has exactly 7 more rows, with the seven names in Task 2's order.
  - Every other `02_*.csv` in the baseline is unchanged, except `02_finding_members.csv` (only added rows) and
    `02_run_info.csv`.
- [ ] **Step 4: Check independently.** A DuckDB query on `data/pipeline_events.csv.gz` (all_varchar) must agree with
  `02_timeliness.csv`:
  - IDs with any blank `received_timestamp` = the platform feed-latency `not_evaluable_missing`. True on this release
    because no other field is blank, and a received earlier than its event is possible but would be out of order,
    not missing.
  - Distinct IDs whose max `booked_timestamp` > `cutoff_timestamp` = the platform booking-cutoff `fail`, adjusted for
    any out-of-order exclusions the query applies.

  Print both pairs.
- [ ] **Step 5: Rebuild the findings.** `uv run python scripts/build_findings.py`, then note the new checksum.
- [ ] **Step 6: Checkpoint.** Report the new checksum and the diff result to the user.

---

### Task 5: Docs, store and the full check suite

**Files:**
- Modify: `docs/DECISIONS.md`: append D-065 "10 Nov · Timeliness: measures, App. B median limits, denominators,
  repeats".
  - **Contents:** the spec's §5 decisions and §6 calls, plus the worst-case-per-field rule and register placement
    (end of the register, D-058 headlines).
  - **Interpretations:** feed latency is our interpretation, and we count transaction_ids, not rows (App. A).
  - **Out of scope:** week-over-week doubling, left to the scorecard session.
  - **Moves:** the new checksum, no existing line changed.
- Modify: `docs/RULES.md` §3:
  - `TXN_TIMESTAMPS_IN_ORDER` test text: received − event and booked − received, each as the daily median by feed
    within the feed's limit (brief App. B), with the keys
    `[timeliness] feed_latency_limit_minutes` / `processing_latency_limit_minutes`;
  - Notes on both rules: cite `outputs/02_timeliness.csv` and the register line names; no typed numbers;
  - "Missing data" table: the cutoff row is unchanged in meaning; add "(own step)" wording only if needed;
  - "Last updated" date.
- Modify: `docs/STATUS.md`:
  - a "Timeliness (10 Nov)" bullet under "Where we are": branch `timeliness-checks`, D-065, the new checksum;
  - remove `TXN_TIMESTAMPS_IN_ORDER` and `TXN_AFTER_CUTOFF` from the "Not coded today" list, and "feed latency" from
    "Thresholds these need";
  - "Last updated".
- Regenerate: `outputs/store.duckdb`.

- [ ] **Step 1: Edit the three docs** as above.
- [ ] **Step 2: Store and dashboard.**
  Run: `uv run python scripts/build_store.py && tests/store_test.sh && (cd dashboard && npm test && npm run test:e2e)`
  Expected: all pass. If the store or a dashboard test fails because of the new `feed/day` id kind, **stop and ask**
  (dashboard code is out of scope).
- [ ] **Step 3: Docs and unit checks.**
  Run: `uv run python scripts/check_docs.py && uv run python -m unittest discover tests`
  Expected: no problems; all tests OK (`test_release_register_is_fully_worded` now runs on the rebuilt outputs).
- [ ] **Step 4: Review.** Run superpowers:requesting-code-review on the branch diff. Fix the findings, then rerun
  the tests each fix touches.
- [ ] **Step 5: Checkpoint.** Summarise for the user: the files changed, the checksum move, and every test with its
  result. Don't commit.
