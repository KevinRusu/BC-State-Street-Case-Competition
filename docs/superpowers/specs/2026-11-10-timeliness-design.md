# Design: timeliness measures from pipeline_events (Check-in 3)

*Approved 10 Nov 2026. Build plan: `docs/superpowers/plans/2026-11-10-timeliness.md`. Branch: `timeliness-checks`.*

## 1. Intent and why

Brief §5 (Timeliness bullet, `reference/01_Student_Brief.md`) requires feed latency, processing latency and cutoff
adherence, by feed and by day, from the event, received, booked, published and cutoff timestamps in `pipeline_events`.
Missing, unparseable and out-of-order timestamps are reported separately. Every metric publishes its denominator, and
an unavailable timestamp is never counted as timely. These are historical measures from a static extract, not live
monitoring. Check-in 3 (week of 9 Nov, brief §8) asks for "quality checks … with coverage".

Today `TXN_TIMESTAMPS_IN_ORDER` and `TXN_AFTER_CUTOFF` exist only in `docs/RULES.md` (§3, Trade check), with no code
and no latency limit in `config/`. The deliverable notebook (`notebooks/deliverable.ipynb`) uses the pipeline
timestamps only as duplicate evidence (section 2b).

## 2. Goals, non-goals, anti-goals

**Goals**
- The five measures below, for every feed × day plus feed and platform totals, with full denominators, in one output
  file.
- The two rules coded, with register lines that FINDINGS.md and the dashboard pick up automatically.
- Latency limits in `config/reconciliation.toml`, changeable live by a judge.

**Non-goals:** this session builds only what the brief's §5 Timeliness bullet asks for.
- Owned by the other session: price coverage and freshness, account and security master checks, the scorecard and
  indicators, dashboard code changes, the stress-test harness.
- Not built at all: batch-level cuts, any real-time framing, and App. B's "doubling week over week" threshold. That
  threshold is indicator work; the scorecard session can compute it from `02_timeliness.csv`.

**Anti-goals: these would make it a failure even if it ran**
- An unavailable or out-of-order timestamp counted as on time, or as zero latency (Dataset Guide §3).
- Limits derived from this release's own latency distribution. The limits are set before anyone looks at latency
  sizes.
- Any existing register line or existing output number moving.
- Picking the copy of a repeated record that makes the result look better.
- A limit applied to a different unit than the source states (App. B states a daily median by feed).

## 3. Constraints (from CLAUDE.md and the repo)

- Code lives only in `notebooks/deliverable.ipynb` (D-037). `src/` is used only once code is needed in two places
  (D-012).
- Thresholds go in `config/*.toml`; no hard-coded record IDs; read CSVs as text and convert explicitly. Dates may be
  `YYYY-MM-DD` or `DD/MM/YYYY`: reuse `to_time` / `normalise_timestamp`.
- Detection is rule-based (D-001). Register convention: eligible + not evaluable = population, asserted (D-027).
- Shuffled input rows must give identical outputs (`tests/robustness_test.sh`; the shuffled run in
  `tests/fixture_test.sh`).
- Register checksum today: `d7e752f55f0a`. It moves because lines are added on purpose; every existing line must stay
  byte-identical.
- The new register lines use a new id kind (feed/day), which the store treats as not traceable
  (`scripts/build_store.py` `TRACEABLE`). It needs a lead-in in `scripts/plain_language.json` if the store requires
  one. If the store or dashboard *code* would need changing, stop and ask: dashboard code is out of scope.
- Don't commit or push; the user commits.

## 4. Facts about the data (read-only profiling; latency sizes deliberately not looked at)

- **Feeds:** three (`source_system`): OMS_FRONT, TRADE_CAPTURE and CUSTODY_FEED.
- **Formats:** every timestamp is `YYYY-MM-DD HH:MM:SS`. Only `received_timestamp` has blanks (~1.3k, across all
  feeds).
- **Cutoff and day:** the cutoff is 18:00 on each of 30 days; events run 09:00–15:59. Event, receipt, `batch_id` date
  and cutoff always fall on the same calendar day.
- **Pipeline ↔ transactions:** the same ID set with the same multiplicity: 2,105 IDs appear twice in both tables, and
  there are no orphans. On IDs that appear once, the pipeline's `event_timestamp` and `source_system` equal the
  transaction's.
- **Repeated pairs** share feed, event, received, cutoff and batch. They differ in published only (1,960), booked and
  published (20), nothing (118), or one copy lacks received (7). These are the copies D-044 reads as a resend at the
  publish step.

## 5. What the user decided (9–10 Nov)

**Measures.** Each record (one transaction_id) is measured.

| Measure | Rule | Per record | Pass / fail | Source |
|---|---|---|---|---|
| Feed latency | `TXN_TIMESTAMPS_IN_ORDER` | received − event, in minutes | The daily **median** per feed vs the feed's limit; no per-record pass/fail | Our interpretation (no guide defines it): data dictionary "source-event time" → "platform receipt time"; RULES.md |
| Processing latency | `TXN_TIMESTAMPS_IN_ORDER` | booked − received, in minutes | The daily **median** per feed vs the feed's limit | Brief App. B: "Median booked time minus received time, by feed; daily … above four hours" |
| Booking cutoff (headline) | `TXN_AFTER_CUTOFF` | booked ≤ cutoff | Per record | Brief App. A "cutoff adherence" |
| Publication cutoff | `TXN_AFTER_CUTOFF` | published ≤ cutoff | Per record | Data dictionary: "compare booking and publication separately" |
| Timestamp order | `TXN_TIMESTAMPS_IN_ORDER` | event ≤ received ≤ booked ≤ published | Per record | Working Guide §3 |

**Limits.**
- **Config:** a `[timeliness]` section in `config/reconciliation.toml`, one key per feed for each latency, all three
  feeds equal at the start.
- **Feed latency:** 60 minutes, a team assumption.
- **Processing latency:** 240 minutes, from App. B (illustrative, not an SLA).
- **What is compared:** each feed × day's median against its feed's limit; above the limit = flagged. They are set
  before looking at the distribution, and a judge can change one feed live.

**Late is late.**
- A record booked or published after its cutoff is late for that measure ("carried to the next cycle", as Rule 22c-1
  treats a late order), even though it was eventually booked or published.
- Exactly at the cutoff is on time (≤, as RULES.md says).
- The two cutoff measures are never merged into one.

**Denominators, per measure, from its own fields.**
- **Rule:** a record is not evaluable for a measure only when that measure's own timestamps are missing, unparseable
  or out of order. A negative interval is out of order; it is never zero latency.
- **Example:** a blank received time removes the record from both latencies, but not from the cutoff measures.
- **Order and the cutoffs:** a cutoff measure counts a record as out of order only when *its own step* is out:
  - booking cutoff: booked comes before event or received;
  - publication cutoff: published comes before booked, received or event.

  A record where only event > received keeps both cutoff results. This satisfies RULES.md "Missing data": out-of-order
  timestamps are never counted as on time.

**Repeated records.**
- **Unit:** one transaction_id.
- **Which copy's time:** where the copies differ, take the later booked and the later published time. A blank or
  unreadable value in either copy makes that field not evaluable.
- **Reported beside it:** repeated IDs, and copies that disagree on the cutoff outcome.
- **Not a conflict with the brief:** App. A writes "rows", but App. A says "choose and justify your own dimensions";
  D-065 records that we count transaction_ids.

**Output.** `outputs/02_timeliness.csv` has:
- **Rows:** one per measure × feed × day, plus an "all days" row per feed and one platform row.
- **Columns:**
  - population and eligible
  - for the cutoff and order measures: pass and fail
  - not evaluable by reason: missing, unparseable, out of order
  - for the two latencies: median, 95th percentile and max in minutes, the limit, and "median above limit"
    (yes / no / no limit for this feed / no eligible record)
- **Totals:** recomputed from records, never summed from day rows (so medians are never re-summed).

**Register lines** (`outputs/02_defect_register.csv`, stage `pipeline`, members in `02_finding_members.csv`, plain
wording in `scripts/plain_language.json`):

| Line | Unit | Status | Rule |
|---|---|---|---|
| Pipeline timestamp missing | transaction_id | confirmed | `TXN_TIMESTAMPS_IN_ORDER` |
| Pipeline timestamp unparseable | transaction_id | confirmed | `TXN_TIMESTAMPS_IN_ORDER` |
| Pipeline timestamps out of order | transaction_id | confirmed | `TXN_TIMESTAMPS_IN_ORDER` |
| Feed latency: daily median above the feed's limit | feed-day | unresolved (the limit is our assumption) | `TXN_TIMESTAMPS_IN_ORDER` |
| Processing latency: daily median above the feed's limit | feed-day | unresolved | `TXN_TIMESTAMPS_IN_ORDER` |
| Booked after cutoff | transaction_id | confirmed (the data's own cutoff) | `TXN_AFTER_CUTOFF` |
| Published after cutoff | transaction_id | confirmed | `TXN_AFTER_CUTOFF` |

For the two feed-day lines, the population is the feed-days present:
- **eligible:** the feed-day has at least one eligible record and the feed has a limit;
- **not evaluable:** everything else.

## 6. Calls I made (the user should check these)

1. **Population:** distinct non-blank transaction_ids in `transactions` ∪ `pipeline_events`.
   - A trade with no pipeline record is "missing" on every measure, and counted in the missing line.
   - Feed = the pipeline's `source_system`, else the transaction's.
   - Rows with a blank ID are counted and printed, not measured.
2. **Day:** the cutoff date. If the cutoff is unreadable, the event date; if both are, "unknown".
3. **One not-evaluable reason per record per measure,** in the order missing → unparseable → out of order, so the
   reason columns add up.
4. **The register lines:**
   - **Missing and unparseable:** any of the five timestamps, cutoff included; the population is every ID.
   - **Out of order:** any two *readable* timestamps among event, received, booked and published that run backwards.
     The eligible records are those with at least two readable. The order measure in the output uses the same
     definition, so a record with one blank can still show a backward pair. This replaces "needs all four readable".
5. **A feed with no configured limit** (e.g. a fixture feed): the median flag is "no limit for this feed", never a
   pass. The feed-day is not evaluable on the latency lines.
6. **Placement:** a new notebook section **9b. Timeliness** before the register (section 10), so sections 10–12 keep
   their numbers (section 2b is the precedent).
7. **Zero-count lines:** kept in the register (unparseable = 0 on the release, for example) to show the check ran.
8. **Robustness:**
   - The existing threshold run also loosens one feed's processing limit; no extra run is added.
   - Expected: that feed's "median above limit" count can only fall, and every count and median stays equal.
   - The shuffle comparison already covers every `02_*.csv`.

*Amended during the build (10 Nov), after the final review:*
- *Call 4 (order measure): eligible = all four readable, or a backward pair among the readable ones; a record
  with a missing or unreadable step and no backward pair is not evaluable, never a pass (brief §5: unavailable
  timestamps are never timely). D-065.*
- *Repeated records: latencies and order are judged copy by copy (longest interval; a backward pair in any copy
  counts), so an in-order copy cannot hide an out-of-order one; the cutoffs keep the later booked and published
  time. D-065.*

## 7. What the tests must show

*Amended during the build (10 Nov): two default-fixture records were made timely so the dashboard's browser tests keep a trade with no finding (FXT06) and one with only an unresolved finding (FXT11). FXT06 and FXT11 are published at 17:00, and FXT11 is received at 10:05 and booked at 10:10. The default run therefore expects 3 out of order, 15 published late and 2 on time; the table below is as approved.*

**Default fixture** (`tests/fixtures/small`, unchanged): every record is booked at 09:10 and published at 19:00
against an 18:00 cutoff. Four records have event 10:00 > received 09:05, so booked 09:10 is also before their event.
Feed `FIXTURE_OMS` has no limit.

| Measure | Expected |
|---|---|
| Publication cutoff | late on every record (19:00 is after 18:00) |
| Booking cutoff | late on none; the 4 are not evaluable (out of order: booked before event) |
| Order | 4 out of order |
| Feed latency | the 4 not evaluable (out of order) |
| Processing latency | all evaluable, 5 minutes each |
| Median flag | "no limit for this feed" on every row |

**Edge fixture** (built in `tests/fixture_test.sh` by editing existing pipeline rows; some feeds set to OMS_FRONT so
the limits apply; the builder lays the cases out over separate feed-days):

| Case | Expected |
|---|---|
| received blank | missing for both latencies; both cutoff measures still evaluated |
| booked = `not-a-time` | unparseable |
| event written `DD/MM/YYYY HH:MM:SS` | parsed and evaluated (look-alike) |
| an OMS_FRONT feed-day whose feed-latency median is exactly 60 min | not above the limit (boundary look-alike) |
| an OMS_FRONT feed-day whose feed-latency median is 61 min | above the limit |
| an OMS_FRONT feed-day whose processing median is 241 min | above the limit |
| booked 18:00:00 exactly | on time (boundary look-alike) |
| booked 18:01 | booked after cutoff |
| published 17:59 | publication on time |
| published < booked | out of order; not evaluable for publication cutoff only |
| FXT02's two copies with different published times | counted once, with the later time |
| FXT30 (no pipeline record) | missing on every measure |

**Identities on every run:**
- eligible + not evaluable = population on every row
- a feed's "all days" counts = the sum of its day rows
- platform counts = the sum of the feeds

**Shuffle and threshold:**
- **Shuffled rows:** `02_timeliness.csv` is identical.
- **Threshold change:** only that feed's processing "median above limit" flags move.

**Full data:**
- The new register equals the old one plus the seven new lines.
- The platform counts agree with a separate DuckDB query on the raw file: missing received, and booked > cutoff.

## 8. Left to the builder

- Column names and order in `02_timeliness.csv`.
- The wording of the register lines and the "how detected" text.
- The plain sentences; they must pass `tests/test_plain_language.py`.
- How the cells are split.
- The feed-day member ID format (e.g. `OMS_FRONT 2026-06-01`).
- The edge-fixture layout.

## 9. Follow-on (after approval of this design)

**Branch first:** before any file changes, create and switch to a new branch from `main` with
`git switch -c timeliness-checks`. Every change in this session (spec, plan, notebook, config, tests, docs) lands on
it. Nothing is committed or pushed; the user commits and opens the PR.

The design is saved to `docs/superpowers/specs/`. Then superpowers:writing-plans writes the TDD plan. After the build:
- **Full run and findings:** `tests/run_notebook.sh`, then `scripts/build_findings.py`, and the checksum change
  explained.
- **D-065** in DECISIONS.
- **RULES.md:**
  - both rules move to coded;
  - the latency clause becomes "daily median by feed within the feed's limit (App. B)", with the processing limit
    added;
  - cite the output, the register lines and the config keys.
- **STATUS:** updated.
- **Store and dashboard:** `scripts/build_store.py`, `tests/store_test.sh`, then the dashboard `npm test` and
  `npm run test:e2e`.
- **Final checks:** `scripts/check_docs.py`, then a review with superpowers:requesting-code-review.
