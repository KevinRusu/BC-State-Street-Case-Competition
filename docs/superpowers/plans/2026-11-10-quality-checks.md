# Quality Checks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run price coverage and freshness, sort the spread and scale flags into confirmed / unresolved / cleared,
and code the missing parts of `TXN_FIELDS_VALID`, `FX_RATE_VALID`, `TXN_DUPLICATE` and `TXN_CORRECTION_LINK`. The
result is 17 register lines appended at the end and one new output, `outputs/02_price_quality.csv`.

**Architecture:** two new sections in `notebooks/deliverable.ipynb`:
- **8b. Price data quality**, after section 8: builds `price_quality`, one row per held security, and writes
  `02_price_quality.csv`.
- **9c. Trade and FX field checks**, after 9b: builds `fx_check` (one row per rate) and `trade_checks` (one row per
  transaction row), plus `economic` (one row per transaction_id).

Section 10 appends the new register lines after the timeliness lines, in spec order. Thresholds come from new config
keys. `tests/fixture_test.sh` pins the behaviour on the default fixture and on a new **quality fixture** built
inline (a copy of `tests/fixtures/small` plus the cases below), so the existing edge-fixture expectations stay as
they are.

**Tech Stack:** Python 3.12 / pandas / numpy in Jupyter (headless via `tests/run_notebook.sh`), bash test drivers,
TOML config. No new dependency (no scipy: correction families are found by label propagation in pandas).

**Spec:** `docs/superpowers/specs/2026-11-10-quality-checks-design.md` (read it first; this plan does not repeat its
reasoning).

## Global Constraints

- **Code:** only in `notebooks/deliverable.ipynb`, edited as `.ipynb` JSON (D-037); no helper module; nothing in
  `notebooks/additional/`. Never touch `data/` or `reference/`.
- **Reading data:** all CSVs are text. Dates go through `normalise_date` / `to_day`, timestamps through `to_time`
  (section 2b); both formats `YYYY-MM-DD` and `DD/MM/YYYY`. Numbers go through `pd.to_numeric(..., errors='coerce')`;
  blank and unreadable stay apart.
- **No literal record IDs** in notebook code (section 6's self-check enforces it); every threshold from config.
- **Register:**
  - Existing lines stay byte-identical and in place.
  - New lines go after "Published after cutoff", in the order of spec §6.9.
  - Every line obeys eligible + not evaluable = population (asserted in cell "CHECK: every finding ...").
- **Float boundaries:** the FX move, the amount difference and the odd-vendor distances are rounded to
  `FLOAT_DECIMALS` (config, 9) before they are compared. This is so the spec's boundary look-alikes behave: a 5% move and a 0.01 difference must
  pass, and the equal distances in FXSEC16 (0.20 each) must tie and be broken by vendor name.
- **Order independence:**
  - Every pick sorts by values, never by file order.
  - The chosen quote sorts by `vendor_priority` (as a number), then `vendor`, then price.
  - Family labels are the minimum transaction_id in the family.
- **Repeated transaction_id on the row-based trade lines (spec §6.7):** a line's result is computed per row. If an
  ID's copies get more than one distinct result on that line, every copy becomes `not evaluable` on it.
- **Business days:** Monday–Friday, no holidays (`numpy.busday_count` / `numpy.busday_offset` with the default
  weekmask).
- **Config values** (pinned by the spec; key names fixed here):

  ```toml
  [tolerances]
  float_decimals = 9        # rounding before a threshold comparison; absorbs float noise only, judges nothing
  settlement_lag_limit_business_days = 2
  settlement_extension_note = "EXTENDED_SETTLEMENT_AGREED"
  [prices]
  nav_cutoff_time = "18:00:00"
  flat_run_dates = 3
  [fx]
  day_on_day_band = 0.05
  ```

- **No commits:** the user commits. Each task ends with a checkpoint (tests green, `git status` reviewed), not a
  commit.
- **Stop and ask the user** only when the spec's Phase B rules say so:
  - an existing line or existing output number moves;
  - the guides are ambiguous in a way that changes a count;
  - dashboard code would need changing;
  - a test fails that you cannot explain after investigating;
  - the build would deviate from this plan.

  Every other open question is answered with the recommended option and logged in the spec's §10 "Decisions taken
  without asking".

## Fixed names (later tasks and tests rely on them)

**Setup cell (cell 2) variables:** `LAG_LIMIT: int`, `EXTENSION_NOTE: str`, `NAV_CUTOFF_TIME: str`,
`FLAT_RUN_DATES: int`, `FX_BAND: float`, `FLOAT_DECIMALS: int`.

**`outputs/02_price_quality.csv`:**
- **Rows:** one per security in `vendor_check` (section 8's held set), sorted by `security_id`.
- **Columns, in this order:**

  ```
  security_id, mastered, master_currency, snapshot_position_rows, chosen_vendor, chosen_priority, chosen_price,
  chosen_timestamp, coverage, fallback_only, freshness, freshness_reason, fresh_fallback, flat_run_dates,
  vendor_check_result, flag_class, odd_vendor, dates_spread_flagged, dates_scale_flagged
  ```

- **Values:**

  | Column | Values |
  |---|---|
  | `mastered` | `True` / `False` |
  | `coverage` | `pass` / `fail` / `not evaluable` / `not held on the snapshot` |
  | `fallback_only`, `fresh_fallback` | `yes` / `no` / blank when not applicable |
  | `freshness` | `pass` / `fail` / `not evaluable` / blank (no chosen quote, or not held on the snapshot) |
  | `freshness_reason` | `after the NAV cutoff` / `stamped on another day` / `timestamp missing` / `timestamp unreadable` / blank |
  | `flag_class` | `chosen is odd` / `backed` / `no two agree` / `not evaluable: no chosen quote` / blank (not flagged) |
  | `odd_vendor` | the vendor farthest from the median of the snapshot's valid quotes (ties by vendor name); blank unless flagged |
  | `flat_run_dates` | integer, 0 when there is no chosen quote |

**Register lines** (exact names; `T+{LAG_LIMIT}` is formatted from config):

| # | Name | Status | Rule | Stage | Unit | Id kind |
|---|---|---|---|---|---|---|
| 1 | `Holding with no eligible quote on the snapshot date` | confirmed | `PRC_QUOTE_ELIGIBLE` | pricing | position rows | security_id |
| 2 | `Holding priced only by a fallback vendor on the snapshot date` | confirmed | `PRC_QUOTE_ELIGIBLE` | pricing | position rows | security_id |
| 3 | `Chosen quote stamped after the NAV cutoff` | unresolved | `PRC_QUOTE_ELIGIBLE` | pricing | securities | security_id |
| 4 | `Scale flag: the chosen quote is the odd one out` | confirmed | `PRC_VENDOR_DISPERSION` | pricing | securities | security_id |
| 5 | `Scale flag: the chosen quote is backed by another vendor` | cleared | `PRC_VENDOR_DISPERSION` | pricing | securities | security_id |
| 6 | `Spread flag: the chosen quote is the odd one out` | unresolved | `PRC_VENDOR_DISPERSION` | pricing | securities | security_id |
| 7 | `Spread flag: the chosen quote is backed by another vendor` | cleared | `PRC_VENDOR_DISPERSION` | pricing | securities | security_id |
| 8 | `Spread or scale flag: no two vendors agree` | unresolved | `PRC_VENDOR_DISPERSION` | pricing | securities | security_id |
| 9 | `FX rate repeated for a currency and date` | confirmed | `FX_RATE_VALID` | pricing | rate rows | currency |
| 10 | `FX rate not positive or unreadable` | confirmed | `FX_RATE_VALID` | pricing | rate rows | currency |
| 11 | `FX rate moves more than the band from the previous business day` | unresolved | `FX_RATE_VALID` | pricing | rate rows | currency |
| 12 | `Blank or unreadable trade price` | confirmed | `TXN_FIELDS_VALID` | trade capture | rows | transaction_id |
| 13 | `gross_amount does not equal quantity x price` | confirmed | `TXN_FIELDS_VALID` | trade capture | rows | transaction_id |
| 14 | `Settlement later than T+{LAG_LIMIT} with no agreed extension` | unresolved | `TXN_FIELDS_VALID` | trade capture | rows | transaction_id |
| 15 | `Settlement later than T+{LAG_LIMIT} with an agreed extension` | cleared | `TXN_FIELDS_VALID` | trade capture | rows | transaction_id |
| 16 | `Same economics under a different transaction_id` | unresolved | `TXN_DUPLICATE` | trade capture | transaction_ids | transaction_id |
| 17 | `Correction link points to itself or to another account or security` | confirmed | `TXN_CORRECTION_LINK` | trade capture | rows | transaction_id |

Lines 1 and 2 pass `affected=` (a row count) with security_id members, as the existing "Held security with no price
at all" line does. Line 2's population is the coverage passes only. Lines 4–5's population is the scale-flagged
securities and lines 6–7's the spread-flagged ones; line 8 covers both. On all of 4–8, not evaluable = the flagged
securities with no chosen quote.

**Quality fixture** (`tests/runs/fixture_quality`, built in `tests/fixture_test.sh` from `tests/fixtures/small`,
manifest row counts updated with the existing `edit` helper). It adds a third vendor, `FIXTURE_V3` (priority 3).
Timestamps are 17:00:00 on the price date unless the table says otherwise.

Securities and positions:
- **Securities:** FXSEC4–FXSEC18, `EQUITY USD`; FXSEC12 and FXSEC13 are `BOND USD`. FXSEC90 is **not** added.
- **Positions:** one row each for FXSEC4–FXSEC18 and FXSEC90 on `2026-07-10`, account FXACC1, quantity 10, count 1,
  ids `FXQP4` … `FXQP18`, `FXQP90`.

Prices:

| Security | Quotes | Case |
|---|---|---|
| FXSEC4 | 07-09 V1 10.00 | coverage fail (no snapshot quote) |
| FXSEC5 | 07-10 V1 blank; V2 10.00 | fallback-only |
| FXSEC90 | 07-10 V1 10.00 | not mastered, quoted: coverage not evaluable |
| FXSEC18 | `not-a-date` V1 10.00 | unreadable price_date only: coverage not evaluable |
| FXSEC6 | 07-10 V1 10.00 @ 18:00:00; V2 10.01 | fresh at the cutoff |
| FXSEC7 | 07-10 V1 10.00 @ 18:01:00; V2 10.01 | stale, fresh fallback |
| FXSEC8 | 07-10 V1 10.00 @ `2026-07-11 09:00:00`; V2 10.01 @ `2026-07-11 09:00:00` | stale (other day), no fresh fallback |
| FXSEC9 | 07-10 V1 10.00 @ blank; V2 10.01 | freshness not evaluable |
| FXSEC10 | V1 10.00 on 07-03, 07-06, 07-07, 07-08, 07-09, 07-10; V2 10.01 on 07-10 | flat run 6 across a weekend |
| FXSEC11 | V1 10.00 on 07-07, 07-09, 07-10; V2 10.01 on 07-10 | gap: run 2 |
| FXSEC12 | 07-10 V1 0.95, V2 95.00, V3 95.02 | scale, chosen is odd |
| FXSEC13 | 07-10 V1 95.00, V2 95.01, V3 0.9502 | scale, backed |
| FXSEC14 | 07-10 V1 10.20, V2 10.00, V3 10.01 | spread, chosen is odd |
| FXSEC15 | 07-10 V1 10.00, V2 10.01, V3 10.30 | spread, backed |
| FXSEC16 | 07-10 V1 10.00, V2 10.20, V3 10.40 | spread, no two agree |
| FXSEC17 | 07-10 V1 10.00 **EUR**, V2 10.30 **EUR** (master USD) | coverage fail; spread-flagged, no chosen quote |

FX rates added (the fixture already has USD 07-09 1.0, USD 07-10 1.0, EUR `10/07/2026` 1.1):

```
EUR,2026-07-09,1.100000
GBP,2026-07-09,1.250000
GBP,2026-07-09,1.260000
GBP,2026-07-10,1.250000
CHF,2026-07-09,abc
CHF,2026-07-10,0
CAD,2026-07-09,1.000000
CAD,2026-07-10,1.050000
JPY,2026-07-03,0.006400
JPY,2026-07-06,0.0067264
JPY,2026-07-08,0.006700
```

Transactions added. Columns are as in `transactions.csv`. Unless shown, `cusip` = `FXCUSIP0<n>` of the security,
currency USD (EUR for FXSEC2), source `FIXTURE_OMS`, event timestamp = trade date 09:00:00, no link, no note.

```
FXQ01 FXACC1 FXSEC3 BUY  2026-06-22 2026-06-24 10   (blank) 50.00  BOOKED
FXQ02 FXACC1 FXSEC1 BUY  2026-06-22 2026-06-24 10   10.00   100.01 BOOKED
FXQ03 FXACC1 FXSEC1 BUY  2026-06-23 2026-06-25 10   10.00   100.02 BOOKED
FXQ04 FXACC1 FXSEC2 BUY  2026-06-22 2026-06-24 -10  10.00   100.00 BOOKED
FXQ05 FXACC2 FXSEC1 BUY  2026-06-19 2026-06-23 1    20.00   20.00  BOOKED
FXQ06 FXACC2 FXSEC1 BUY  2026-06-19 2026-06-24 2    20.00   40.00  BOOKED
FXQ07 FXACC2 FXSEC1 BUY  2026-06-19 2026-06-24 3    20.00   60.00  BOOKED  note EXTENDED_SETTLEMENT_AGREED
FXQ08 FXACC2 FXSEC2 BUY  2026-06-22 24/06/2026 4    10.00   40.00  BOOKED
FXQ09 FXACC2 FXSEC3 BUY  2026-06-22 2026-06-24 15   5.00    75.00  BOOKED
FXQ10 FXACC2 FXSEC3 BUY  2026-06-22 2026-06-24 15.0 5.0     75.00  BOOKED
FXQ11 FXACC1 FXSEC3 BUY  2026-06-23 2026-06-25 7    5.00    35.00  CANCELLED
FXQ12 FXACC1 FXSEC3 BUY  2026-06-23 2026-06-25 7    5.00    35.00  BOOKED     rel FXQ11
FXQ13 FXACC1 FXSEC3 BUY  2026-06-24 2026-06-26 8    5.00    40.00  CANCELLED
FXQ14 FXACC1 FXSEC3 BUY  2026-06-24 2026-06-26 9    5.00    45.00  CANCELLED  rel FXQ13
FXQ15 FXACC1 FXSEC3 BUY  2026-06-24 2026-06-26 8    5.00    40.00  BOOKED     rel FXQ14
FXQ16 FXACC2 FXSEC1 SELL 2026-06-25 2026-06-29 1    20.00   20.00  REVERSED   rel FXT01
FXQ17 FXACC3 FXSEC3 BUY  2026-06-19 2026-06-24 6    5.00    30.00  BOOKED  note EXTENDED_SETTLEMENT_AGREED
FXQ17 FXACC3 FXSEC3 BUY  2026-06-19 2026-06-24 6    5.00    30.00  BOOKED  (no note)
FXQ18 FXACC3 FXSEC3 SELL 2026-06-25 2026-06-29 1    5.00    5.00   BOOKED     rel FXQ18
FXQ19 FXACC3 FXSEC3 SELL 2026-06-26 2026-06-30 2    5.00    10.00  BOOKED     rel FXQ99
FXQ20 FXACC1 FXSEC3 BUY  2026-06-26 2026-06-30 1    5.00    5.00   BOOKED
FXQ20 FXACC2 FXSEC3 BUY  2026-06-26 2026-06-30 1    (blank) 5.00   BOOKED     (fix round: copies disagree on price)
FXQ21 FXACC1 FXSEC3 SELL 2026-06-29 2026-07-01 1    5.00    5.00   BOOKED     rel FXQ20
```

No pipeline records are added: the new trades are "missing" for timeliness, which no quality expectation reads.
Positions FXQP* have no trades and no custodian row; their reconciliation results are not asserted.

**Runs added to `tests/fixture_test.sh`:**
- `RECONCILIATION_DATA="$W/fixture_quality/manifest.csv" run quality ""`
- the same data with `settlement_lag_limit_business_days = 3` (config written like the others):
  `run quality_lag3 "$W/config_fixture_lag3.toml"`

## Review Focus

The five failure modes a user would most likely hit that the spec's own cases don't pin; each has its test in the
owning task:

1. **A held security quoted only in a currency other than its master currency** (FXSEC17): coverage fail, never a
   pass; spread-flagged but `not evaluable: no chosen quote` on lines 6–8, and the per-flag identity still holds.
   Task 1 and Task 2.
2. **A quote whose `price_date` does not read** (FXSEC18): coverage not evaluable, never fail or pass, never
   dropped. Task 1.
3. **Two quotes from one vendor on the snapshot** (the edge fixture's FXSEC1): the chosen quote is the same whatever
   the row order (price 20.0). Task 1.
4. **A judge changes the T+2 limit live** (`quality_lag3`): the lag lines are renamed T+3, FXQ06 and FXQ07 move to
   pass, and nothing else in the register moves. Task 4.
5. **A correction link whose target's copies sit on different accounts** (FXQ21 → FXQ20): not evaluable, never a
   pass or a fail. Task 5.

---

### Before Task 1: branch and baseline

- [ ] `git switch -c quality-checks` (the spec and this plan are uncommitted on `main` and come along).
- [ ] Rebuild the outputs from the unchanged code and keep them as the baseline. Task 6 and Task 7 compare against
  it.

  ```bash
  tests/run_notebook.sh
  mkdir -p "$SCRATCH/baseline" && cp outputs/02_*.csv "$SCRATCH/baseline/"
  ```

  `$SCRATCH` is the session scratchpad directory. Then run `uv run python scripts/check_docs.py`. Expected: "docs
  check passed" (FINDINGS not stale, so the baseline register matches the committed checksum).
- [ ] Run `tests/fixture_test.sh` once. Expected: "fixture test passed". This is the green starting point.

### Task 1: Config, coverage, freshness, flat runs and `02_price_quality.csv` (lines 1–3)

**Files:**
- Modify: `config/reconciliation.toml` (keys under Global Constraints; comments cite the spec §5 sources)
- Modify: `notebooks/deliverable.ipynb`:
  - setup cell: read the six config values;
  - new markdown, code and check cells after section 8's check cell;
  - section 8's markdown: replace the "Proposed, not run for Check-in 2 ..." paragraph with one line pointing to 8b
    and 9c;
  - section 10's register cell: lines 1–3 after the timeliness lines
- Modify: `scripts/plain_language.json` (a sentence for each of lines 1–3)
- Test: `tests/fixture_test.sh` (quality fixture builder, the two new runs, expectations)

**Interfaces:**
- Consumes: from section 8, `quotes_all` (with `price_day`, `price_number`), `vendor_check`, `PRICE_CONFIG`; from
  section 2, `positions`, `securities`, `to_day`, `to_time`; from section 10, `finding(...)`.
- Produces: the setup variables; `price_quality: pd.DataFrame` with every column of the fixed list. Task 2 fills
  `flag_class`, `odd_vendor`, `dates_spread_flagged` and `dates_scale_flagged`; this task leaves them blank or 0.
  Also `CHOSEN: pd.DataFrame`, one row per security with a chosen quote (`security_id`, `vendor`, `priority`,
  `price_number`, `price_timestamp`), and `snapshot_rows: pd.DataFrame`, the `positions` rows whose `as_of_date`
  reads as `AS_OF_DATE`.

- [ ] **Step 1: Config.** Add the six keys with comments that say where each value comes from (spec §5) and that
  they were set before looking.
- [ ] **Step 2: Failing tests.** In `tests/fixture_test.sh`:
  - build the quality fixture (all of it: securities, positions, prices, FX, transactions; later tasks only add
    expectations), in its own block after the R3 fixture block;
  - write `config_fixture_lag3.toml`;
  - add the two runs;
  - add the expectations below, after the timeliness register expectations and before the results are printed.

  The existing `timeliness register {run}: the seven lines come last` expectation becomes "the seven lines follow
  the NAV line, in order":

  ```python
  names = register['finding'].tolist(); i = names.index(NAV_LINE)
  expect(..., TIMELINESS_LINES, names[i + 1:i + 8])
  ```

  Expectations:

```python
QUALITY_LINES = ['Holding with no eligible quote on the snapshot date',
                 'Holding priced only by a fallback vendor on the snapshot date',
                 'Chosen quote stamped after the NAV cutoff']   # extended by Tasks 2-5, in spec order
def line_counts(run, name):
    row = read(run, '02_defect_register.csv').set_index('finding').loc[name]
    return tuple(row[c] for c in ('affected', 'eligible', 'not evaluable', 'population'))
for run in ['default', 'quality']:
    names = read(run, '02_defect_register.csv')['finding'].tolist()
    expect(f'quality {run}: new lines follow the timeliness lines, in order', QUALITY_LINES,
           names[names.index('Published after cutoff') + 1:][:len(QUALITY_LINES)])
expect('quality default: every holding covered by the priority vendor, every chosen quote fresh',
       [('0', '7', '0', '7'), ('0', '7', '0', '7'), ('0', '3', '0', '3')],
       [line_counts('default', n) for n in QUALITY_LINES[:3]])
pq = read('default', '02_price_quality.csv').set_index('security_id')
expect('quality default: FXSEC1 chosen V1 20.0, fresh, run 1 (its 07-09 V1 price is blank)',
       ('FIXTURE_V1', '20.0', 'pass', 'pass', '1'),
       tuple(pq.loc['FXSEC1', c] for c in ['chosen_vendor', 'chosen_price', 'coverage', 'freshness', 'flat_run_dates']))
expect('quality: coverage fail = no snapshot quote and quotes only in another currency (2 rows); '
       'not evaluable = unmastered and unreadable price_date', ('2', '21', '2', '23'),
       line_counts('quality', QUALITY_LINES[0]))
members = read('quality', '02_finding_members.csv').groupby('finding')['record_id'].apply(set)
expect('quality: coverage fail members', {'FXSEC4', 'FXSEC17'}, members[QUALITY_LINES[0]])
expect('quality: fallback-only = FXSEC5; population = coverage passes only', ('1', '19', '0', '19'),
       line_counts('quality', QUALITY_LINES[1]))
expect('quality: stale = 18:01 and next-day stamps; 18:00 on time; blank stamp not evaluable', ('2', '14', '1', '15'),
       line_counts('quality', QUALITY_LINES[2]))
expect('quality: stale members', {'FXSEC7', 'FXSEC8'}, members[QUALITY_LINES[2]])
pq = read('quality', '02_price_quality.csv').set_index('security_id')
col = lambda c: {s: pq.loc[s, c] for s in pq.index}
expect('quality: fresh fallback yes for FXSEC7 (V2 at 17:00), no for FXSEC8 (V2 also next day)', ('yes', 'no'),
       (pq.loc['FXSEC7', 'fresh_fallback'], pq.loc['FXSEC8', 'fresh_fallback']))
expect('quality: freshness reasons', ('after the NAV cutoff', 'stamped on another day', 'timestamp missing'),
       tuple(pq.loc[s, 'freshness_reason'] for s in ['FXSEC7', 'FXSEC8', 'FXSEC9']))
expect('quality: flat run 6 across a weekend; a missing date breaks the run (2)', ('6', '2'),
       (pq.loc['FXSEC10', 'flat_run_dates'], pq.loc['FXSEC11', 'flat_run_dates']))
expect('quality: coverage results of the special cases',
       {'FXSEC4': 'fail', 'FXSEC5': 'pass', 'FXSEC17': 'fail', 'FXSEC18': 'not evaluable', 'FXSEC90': 'not evaluable'},
       {s: col('coverage')[s] for s in ['FXSEC4', 'FXSEC5', 'FXSEC17', 'FXSEC18', 'FXSEC90']})
edge_pq = read('edge', '02_price_quality.csv').set_index('security_id')
expect('edge: two V1 quotes on the snapshot -> chosen is the lower-sorting one, whatever the row order', '20.0',
       edge_pq.loc['FXSEC1', 'chosen_price'])
for run in ['default', 'quality']:
    pq = read(run, '02_price_quality.csv')
    held = pq[pq['coverage'] != 'not held on the snapshot']
    expect(f'quality {run}: coverage pass + fail + not evaluable rows = positions rows on the snapshot',
           line_counts(run, QUALITY_LINES[0])[3], str(held['snapshot_position_rows'].astype(int).sum()))
```

- [ ] **Step 3: Run `tests/fixture_test.sh` and watch it fail.** Expected: the quality expectations FAIL (no
  `02_price_quality.csv` yet, so the run's assertion block errors on the missing file). The notebook itself must
  still run green on the quality fixture; if an existing CHECK cell fails there, investigate before going on.
- [ ] **Step 4: Implement section 8b and lines 1–3,** following spec §6.2–§6.4 and the fixed names. Points the spec
  leaves open, settled here:
  - **Coverage not evaluable:** no chosen quote, and one of: the security is unmastered with a quote dated the
    snapshot; it has a quote whose non-blank `price_date` does not read; or it has a snapshot quote whose non-blank
    price does not read. Every other row with no chosen quote fails.
  - **Freshness:** read `price_timestamp` with `to_time`. Fail when its date ≠ the quote's `price_day`, or its time
    is after `NAV_CUTOFF_TIME`.
  - **Fresh fallback:** another eligible snapshot quote for the security passes the same freshness test.
  - **Flat run:** walk back from the snapshot one business day at a time (`numpy.busday_offset(..., -1)`). Count
    while the chosen vendor has a valid quote with a numerically equal price on that day; stop at the first business
    day without one. `price_quality` and the line-3 how-detected text report runs ≥ `FLAT_RUN_DATES`.
  - Write `02_price_quality.csv` with `index=False, lineterminator='\n'`.
  - **Check cell:** one row per `vendor_check` security; coverage counts add to the snapshot rows; freshness
    eligible + not evaluable = securities with a chosen quote held on the snapshot.
  - **Plain sentences:** they must pass `tests/test_plain_language.py` (no verdict words).
- [ ] **Step 5: Run `tests/fixture_test.sh`.** Expected: "fixture test passed". Then run
  `uv run python -m unittest tests/test_plain_language.py`. Expected: OK.
- [ ] **Step 6: Checkpoint.** `git status` shows only the four files above changed.

### Task 2: Inside the spread and scale flags (lines 4–8)

**Files:**
- Modify: `notebooks/deliverable.ipynb` (section 8b: fill the four look-inside columns; section 10: lines 4–8)
- Modify: `scripts/plain_language.json` (lines 4–8)
- Test: `tests/fixture_test.sh` (expectations only)

**Interfaces:**
- Consumes: `CHOSEN`, `price_quality`, `vendor_check`, `quotes_all`, `PRICE_CONFIG['spread_threshold']`,
  `PRICE_CONFIG['scale_ratio_low'/'scale_ratio_high']`.
- Produces: `agrees(x: float, y: float) -> bool`, which is |x − y| / ((x + y) / 2) ≤ `spread_threshold`. Also the
  filled look-inside columns.

- [ ] **Step 1: Failing tests.** Append lines 4–8 to `QUALITY_LINES`, then:

```python
LOOK = QUALITY_LINES[3:8]
expect('quality default: no flags -> five zero lines', [('0', '0', '0', '0')] * 5, [line_counts('default', n) for n in LOOK])
expect('quality: lines 4-8 counts',
       [('1', '2', '0', '2'), ('1', '2', '0', '2'), ('1', '3', '1', '4'), ('1', '3', '1', '4'), ('1', '5', '1', '6')],
       [line_counts('quality', n) for n in LOOK])
expect('quality: lines 4-8 members', [{'FXSEC12'}, {'FXSEC13'}, {'FXSEC14'}, {'FXSEC15'}, {'FXSEC16'}],
       [members[n] for n in LOOK])
pq = read('quality', '02_price_quality.csv').set_index('security_id')
expect('quality: classes and odd vendors',
       [('chosen is odd', 'FIXTURE_V1'), ('backed', 'FIXTURE_V3'), ('chosen is odd', 'FIXTURE_V1'),
        ('backed', 'FIXTURE_V3'), ('no two agree', 'FIXTURE_V1'), ('not evaluable: no chosen quote', 'FIXTURE_V1')],
       [(pq.loc[s, 'flag_class'], pq.loc[s, 'odd_vendor']) for s in
        ['FXSEC12', 'FXSEC13', 'FXSEC14', 'FXSEC15', 'FXSEC16', 'FXSEC17']])
for run in ['default', 'quality']:
    pq = read(run, '02_price_quality.csv')
    for flag, kind in [('scale flag (ratio near 100)', 'scale'), ('spread above threshold', 'spread')]:
        flagged = pq[pq['vendor_check_result'] == flag]
        expect(f'quality {run}: every {kind}-flagged security has one class', len(flagged),
               int(flagged['flag_class'].isin(['chosen is odd', 'backed', 'no two agree',
                                               'not evaluable: no chosen quote']).sum()))
pq = read('quality', '02_price_quality.csv').set_index('security_id')
expect('quality: dates flagged on the snapshot only (one date of quotes)', ('1', '1'),
       (pq.loc['FXSEC12', 'dates_scale_flagged'], pq.loc['FXSEC14', 'dates_spread_flagged']))
```

  The FXSEC16 odd vendor is FIXTURE_V1 because the median is 10.20, and V1 and V3 tie at 0.20, broken by vendor
  name. FXSEC17's is V1 by the same tie-break (median 10.15).

- [ ] **Step 2: Run `tests/fixture_test.sh` and watch it fail.** Expected: FAIL on the five new lines (not in the
  register).
- [ ] **Step 3: Implement** the classification of spec §6.5 for the `vendor_check` securities whose result is a
  spread or scale flag. On the snapshot date:
  - **backed:** some other vendor's valid quote `agrees` with the chosen price;
  - **chosen is odd:** not backed, and two other vendors' quotes agree with each other;
  - **no two agree:** otherwise.

  `dates_spread_flagged` / `dates_scale_flagged` count the readable price dates where the security's valid quotes
  (≥ 2 vendors, one currency) fall in the scale band, or else exceed the spread threshold: section 8's order,
  applied per date. Then lines 4–8 with `how detected` text:
  - name the odd vendors and the median dates flagged;
  - count the chosen quotes in a flat run;
  - on the cleared lines, say what would reopen them (spec §6.5).

  Section 8b's check cell asserts the per-flag identity.
- [ ] **Step 4: Run `tests/fixture_test.sh` and the plain-language test.** Expected: both pass.
- [ ] **Step 5: Checkpoint.**

### Task 3: FX checks (lines 9–11)

**Files:**
- Modify: `notebooks/deliverable.ipynb` (new section **9c. Trade and FX field checks** after 9b's check cell: its
  markdown and the FX cells; section 10: lines 9–11)
- Modify: `scripts/plain_language.json`
- Test: `tests/fixture_test.sh` (expectations only)

**Interfaces:**
- Consumes: `fx_rates`, `to_day`, `FX_BAND`.
- Produces: `fx_check: pd.DataFrame`, one row per `fx_rates` row: `currency`, `rate_day`, `rate_number`,
  `repeated: bool`, `unusable: bool`, `band_result` ∈ {`pass`, `fail`, `not evaluable`}.

- [ ] **Step 1: Failing tests.** Append lines 9–11 to `QUALITY_LINES`, then:

```python
FX = QUALITY_LINES[8:11]
expect('quality default FX: nothing repeated or unusable; band judges USD 07-10 only',
       [('0', '3', '0', '3'), ('0', '3', '0', '3'), ('0', '1', '2', '3')], [line_counts('default', n) for n in FX])
expect('quality FX: repeated GBP pair; CHF 0 and abc; JPY +5.1% Friday to Monday (CAD exactly 5% passes)',
       [('2', '14', '0', '14'), ('2', '14', '0', '14'), ('1', '4', '10', '14')], [line_counts('quality', n) for n in FX])
expect('quality FX members', [{'GBP'}, {'CHF'}, {'JPY'}], [members[n] for n in FX])
```

  Band eligible = USD 07-10, EUR `10/07/2026` (against EUR 07-09: the DD/MM date is parsed and compared), CAD 07-10
  (exactly 5%) and JPY 07-06. Not evaluable:
  - every first date: USD 07-09, EUR 07-09, CAD 07-09, JPY 07-03;
  - both GBP 07-09 rows (repeated) and GBP 07-10 (its previous day is repeated);
  - both CHF rows (unusable);
  - JPY 07-08 (no rate on 07-07).

- [ ] **Step 2: Run and watch it fail.** Expected: FAIL on lines 9–11.
- [ ] **Step 3: Implement** spec §6.6.
  - **Previous business day:** `numpy.busday_offset(rate_day, -1, roll='forward')`.
  - **Move:** `round(abs(rate / previous_rate - 1), FLOAT_DECIMALS) > FX_BAND` is a fail.
  - **Not evaluable:** this row is repeated or unusable; or the previous day has no row, more than one row, or an
    unusable rate.
  - **Populations:** line 9's population is the rows with a readable date and non-blank currency, so its not
    evaluable is those without; lines 10 and 11 cover all rows.
  - **Check cell:** each line's identity holds.
- [ ] **Step 4: Run the fixture and plain-language tests.** Expected: pass.
- [ ] **Step 5: Checkpoint.**

### Task 4: Trade field checks: blank price, amount, settlement lag (lines 12–15)

**Files:**
- Modify: `notebooks/deliverable.ipynb` (section 9c trade cells; section 10: lines 12–15)
- Modify: `scripts/plain_language.json` (four sentences; the lag names use the default T+2 wording)
- Test: `tests/fixture_test.sh` (expectations only)

**Interfaces:**
- Consumes: `trades` (with `trade_day`, `settlement_day`, `quantity_number`, `price_number`, `gross_number`),
  `GROSS_TOLERANCE`, `LAG_LIMIT`, `EXTENSION_NOTE`.
- Produces:
  - `trade_checks: pd.DataFrame` on `trades.index`, with columns:
    - `price_check` ∈ {`pass`, `fail`, `not evaluable`}
    - `amount` (same values)
    - `lag_business_days` (float, NaN when not computed)
    - `lag_class` ∈ {`pass`, `late`, `late with extension`, `not evaluable`}
  - `apply_copy_rule(results: pd.Series, ids: pd.Series) -> pd.Series`: every row of an ID whose copies hold more
    than one distinct value becomes `not evaluable`. Task 5 reuses it.

- [ ] **Step 1: Failing tests.** Append lines 12–15 (with `T+2`) to `QUALITY_LINES`, then:

```python
TRADE = QUALITY_LINES[11:15]
expect('quality default trades: all priced, all amounts fit, every lag T+2; FXT07 has no trade date',
       [('0', '18', '0', '18'), ('0', '18', '0', '18'), ('0', '17', '1', '18'), ('0', '17', '1', '18')],
       [line_counts('default', n) for n in TRADE])
expect('quality trades: blank price; 0.02 off (0.01 passes); T+3 without and with the note; FXQ17 copies disagree',
       [('1', '39', '2', '41'), ('1', '38', '3', '41'), ('1', '38', '3', '41'), ('1', '38', '3', '41')],
       [line_counts('quality', n) for n in TRADE])
expect('quality trade members', [{'FXQ01'}, {'FXQ03'}, {'FXQ06'}, {'FXQ07'}], [members[n] for n in TRADE])
expect('quality: FXQ17 on neither lag line', False,
       any('FXQ17' in members.get(n, set()) for n in TRADE[2:]))
lag3 = read('quality_lag3', '02_defect_register.csv').set_index('finding')
expect('quality_lag3: lines renamed T+3; FXQ06 and FXQ07 now pass (FXQ17's copies agree at T+3, so eligible is 40)', (('0', '40'), ('0', '40')),
       tuple((lag3.loc[n, 'affected'], lag3.loc[n, 'eligible']) for n in
             ['Settlement later than T+3 with no agreed extension', 'Settlement later than T+3 with an agreed extension']))
base = read('quality', '02_defect_register.csv').set_index('finding')
expect('quality_lag3: every other register line unchanged', True,
       base.drop(index=TRADE[2:]).equals(lag3.drop(index=[n.replace('T+2', 'T+3') for n in TRADE[2:]])))
```

  The quality fixture holds 41 rows. Lag not evaluable: FXT07 (blank trade date) and both FXQ17 rows. Amount not
  evaluable: FXQ01. FXQ04 (−10 × 10.00 = 100.00, absolute value) passes; FXQ08's `24/06/2026` reads, giving T+2.

- [ ] **Step 2: Run and watch it fail.**
- [ ] **Step 3: Implement** spec §6.7, rows 1–4.
  - **Price:** fail when the price is blank or does not read.
  - **Amount:** fail when `round(abs(gross − abs(quantity) × price), FLOAT_DECIMALS) > GROSS_TOLERANCE`; not evaluable when any
    of the three is blank or unreadable.
  - **Lag:** `numpy.busday_count(trade_day, settlement_day)`. Not evaluable when either date is missing or does not
    read, or settlement < trade. `late` = lag > `LAG_LIMIT` and note ≠ `EXTENSION_NOTE`; `late with extension` =
    lag > limit and note = `EXTENSION_NOTE`.
  - **Copies:** apply `apply_copy_rule` to each of the three result columns.
  - **Line text:** the line names and how-detected text format the limit from config.
- [ ] **Step 4: Run the fixture and plain-language tests.** Expected: pass.
- [ ] **Step 5: Checkpoint.**

### Task 5: Economic duplicates and correction links (lines 16–17)

**Files:**
- Modify: `notebooks/deliverable.ipynb` (section 9c; section 10: lines 16–17)
- Modify: `scripts/plain_language.json`
- Test: `tests/fixture_test.sh` (expectations only)

**Interfaces:**
- Consumes: `trades`, `apply_copy_rule`.
- Produces:
  - `family: pd.Series`, transaction_id → family label (the minimum ID reachable through `related_transaction_id`
    in either direction; an ID with no link is its own family);
  - `economic: pd.DataFrame`, one row per non-blank transaction_id, with `result` ∈ {`pass`, `fail`,
    `not evaluable`};
  - `trade_checks['link']` ∈ {`pass`, `fail`, `not evaluable`, `''`} (blank = no link).

- [ ] **Step 1: Failing tests.** Append lines 16–17 to `QUALITY_LINES`, then:

```python
DUP, LINK = QUALITY_LINES[15], QUALITY_LINES[16]
expect('quality default: linked reversals of FXT10 and FXT20 are one family -> no economic duplicate',
       ('0', '16', '1', '17'), line_counts('default', DUP))
expect('quality default: four links, all same account and security', ('0', '4', '0', '4'), line_counts('default', LINK))
expect('quality: FXQ09/FXQ10 match (15 vs 15.0, 5.00 vs 5.0); FXQ11/12 linked and FXQ13/15 chained are not; '
       'FXT07 and FXQ01 not evaluable', ('2', '36', '2', '38'), line_counts('quality', DUP))
expect('quality: economic duplicate members', {'FXQ09', 'FXQ10'}, members[DUP])
expect('quality: link to another account (FXQ16) and self-link (FXQ18) fail; missing target (FXQ19) and a target '
       'whose copies disagree on the account (FXQ21) are not evaluable', ('2', '9', '2', '11'), line_counts('quality', LINK))
expect('quality: correction-link members', {'FXQ16', 'FXQ18'}, members[LINK])
```

- [ ] **Step 2: Run and watch it fail.**
- [ ] **Step 3: Implement** spec §6.7, rows 5–6.
  - **Families:** build the link edges (ID, related ID) from non-blank links, then propagate the minimum label
    across the edges both ways until nothing changes.
  - **Duplicates:** a copy is evaluable when account, security, type, trade day, quantity number and price number
    are all present. Group the evaluable copies by those six values. An ID fails when its group holds another ID
    with a different family. An ID none of whose copies is evaluable is not evaluable.
  - **Links:**
    - fail when the link is the row's own ID, or when every copy of the target has a different (account,
      security) pair;
    - not evaluable when the target is absent, or its copies hold more than one (account, security) pair;
    - pass otherwise;
    - then `apply_copy_rule`.
- [ ] **Step 4: Run the fixture and plain-language tests.** Expected: pass. The section 10 check cell (examples
  exist in `ID_UNIVERSE`, eligible + not evaluable = population) passes on every run.
- [ ] **Step 5: Checkpoint.**

### Task 6: Robustness: shuffle and a live FX band change

**Files:**
- Modify: `tests/robustness_test.sh`

- [ ] **Step 1: Failing test.**
  - The threshold config also replaces `day_on_day_band = 0.05` with `day_on_day_band = 0.10` (assert the line
    exists, as the spread line does).
  - New comparisons between run `a` and run `c`:
    - **The FX band line:** affected in `c` ≤ affected in `a`; same eligible and population.
    - **The other register lines:** every line except the FX band line, lines 4–8, "Vendor quotes on the snapshot
      date: spread above threshold" and "... scale flag (ratio near 100)" is identical.
    - **`02_price_quality.csv`:** identical except `vendor_check_result`, `flag_class`, `odd_vendor` and
      `dates_spread_flagged`.

  The shuffle comparison already covers `02_price_quality.csv` (every `02_*.csv`).
- [ ] **Step 2: Run `tests/robustness_test.sh` in the background (~10 min, ~4 GB).** Expected: "robustness test
  passed". If a comparison fails, use superpowers:systematic-debugging. A difference you cannot explain means stop
  and ask.
- [ ] **Step 3: Checkpoint.**

### Task 7: Full data, independent recount, store and documents

**Files:**
- Modify: `docs/RULES.md`:
  - §3: `TXN_FIELDS_VALID`, `TXN_DUPLICATE` and `TXN_CORRECTION_LINK` notes become "Coded 10 Nov (D-067)", citing
    the lines and the config keys;
  - §6: `PRC_QUOTE_ELIGIBLE` and `FX_RATE_VALID` the same; the "Proposed, not run yet: coverage and freshness" table
    becomes "Run 10 Nov", with the NAV cutoff filled in;
  - `PRC_VENDOR_DISPERSION` notes cite lines 4–8.
- Modify: `docs/DECISIONS.md`: append D-067 (the session's choices: spec §5 and §8, citing the spec) and one D-entry
  per Phase B decision that is a treatment or scope choice.
- Modify: `docs/STATUS.md`: "Where we are" gains a quality-checks entry; "Next" step 1 is marked done; the date.
- Regenerated: `docs/FINDINGS.md`
- Modify: the spec's §10 (decisions taken without asking)

- [ ] **Step 1: Full run.** Run `tests/run_notebook.sh`. Expected: it finishes, and every CHECK cell passes.
- [ ] **Step 2: Compare with the baseline.**
  - **Register:** the first lines of `outputs/02_defect_register.csv` equal the baseline file line for line; the
    new lines follow, in `QUALITY_LINES` order.
  - **Unchanged outputs:** `02_vendor_check.csv` is byte-identical, and so is every other baseline `02_*.csv`
    except `02_defect_register.csv`, `02_finding_members.csv` (baseline members kept, new members added),
    `02_row_ledger.csv` and `02_run_info.csv`.
  - **Any other difference:** stop and ask.
- [ ] **Step 3: Independent recount.** A DuckDB query on `data/*.csv.gz` (read `all_varchar=true`) must agree with
  the register on four counts:
  - blank or unreadable trade price rows;
  - snapshot position rows with no quote on the snapshot date in the master currency from any vendor;
  - chosen (lowest-priority eligible) snapshot quotes stamped after 18:00;
  - rows with a business-day lag > 2 and no extension note.

  Put the query in the session summary, not in the repo.
- [ ] **Step 4: Findings, documents, store, dashboard.**
  - Run `uv run python scripts/build_findings.py` (the checksum moves only because lines were added; FINDINGS says
    so).
  - Write RULES, DECISIONS and STATUS as listed above.
  - Run `uv run python scripts/build_store.py`, then `tests/store_test.sh`.
  - Inside `dashboard/`, run `npm test` and `npm run test:e2e`.
  - If a dashboard test fails because of the new lines and only dashboard code could fix it, stop and ask.
- [ ] **Step 5: Final checks.**
  - Run `tests/fixture_test.sh`, `uv run python -m unittest discover tests` and
    `uv run python scripts/check_docs.py`.
  - Expected: all pass.
- [ ] **Step 6: Checkpoint.** `git diff main --stat` lists only the files this plan names, plus the spec and the
  plan.

## After the tasks (Phase B steps 4–7 of the session brief)

1. Run superpowers:requesting-code-review on the whole branch, then superpowers:receiving-code-review:
   - verify each finding before acting;
   - for each real one, write a failing test first, then the fix;
   - record the rejected ones and why.
2. Run superpowers:verification-before-completion, then repeat Task 7 Steps 1–5 if anything changed.
3. Add plain wording for every new line (done per task; `check_docs.py` confirms the release register is fully
   worded).
4. Write the session summary in `docs/superpowers/summaries/2026-11-10-quality-checks-summary.md` with the content
   the session brief lists:
   - link the spec, plan, D-numbers, RULES.md and `outputs/` files;
   - cite numbers from outputs or FINDINGS.md, never type them;
   - then run `check_docs.py`.
5. In chat: a short overview, the summary's path and a commit message. Do not commit.
