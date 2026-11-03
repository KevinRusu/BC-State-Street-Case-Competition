# Check-in 2 study guide

*Study notes to read before presenting Check-in 2. It assumes you know nothing yet. Every number comes from the run
with register checksum `d7e752f55f0a`. If the checksum at the top of [FINDINGS.md](../../FINDINGS.md) differs, the
notebook was rerun and some numbers here may be stale. A file name like `02_waterfall.csv` means
`outputs/02_waterfall.csv`. Numbers marked "(raw data)" were read straight from the data tables to make an example;
they are not in an output file. Frozen after Check-in 2.*

## Key words

- **Holding (key, position):** how many units of one security one account owns on the snapshot date, 10 July 2026.
  A key is the pair account_id + security_id.
- **Recount (rebuild, reconstruction):** our own count of a holding: start at 0, add every BUY, subtract every SELL.
- **Book of record (`positions`):** the platform's official list of holdings.
- **Custodian (`comparison_positions`):** the outside bank that keeps the securities; its file is a second,
  separately made list of the same holdings.
- **Break:** two records that should agree but don't.
- **Confirmed:** we can prove the record is wrong (it breaks a rule that is always true, or other evidence shows it).
- **Unresolved:** something is off, but the data can't prove who is wrong; we name the extra data that would.
- **Cleared:** it looked wrong, and a rule written beforehand plus evidence from a second place proves it is fine.
- **Exposure:** how much money or how big a share of a fund *could* be wrong. It is an estimate, never a loss
  (D-003 in [DECISIONS.md](../../DECISIONS.md)).

## What Check-in 2 asks for, and where it is in this guide

Brief §8, "Bring this", has six items ([brief](../../../reference/01_Student_Brief.md#8-schedule-and-check-ins)):

| Brief item | Section here |
|---|---|
| Position reconstruction and reconciliation | 3, 4 |
| First break classification | 5 |
| One evidenced trace | 6 |
| Proposed checks for price data and ledger arithmetic | 7 |
| Defect catalog | 8 |
| Treatment of ambiguous reversals and unsupported corporate actions | 9 |

Sections 1 and 2 (the data and our code) are background you need to answer questions. Section 10 lists what we
ask faculty.

---

## 1. The data: ten tables

The release is ten separate tables joined on IDs, like a database. Row counts come from `02_row_ledger.csv` (every
table loaded with rows in = rows out). Column meanings: [data_dictionary.csv](../../../data_dictionary.csv).

### transactions (1,409,533 rows)

- **One row:** one trade record: a buy or a sell, or a record that cancels or reverses one.
- **Columns that matter:**
  - `transaction_id`: the trade's ID. It should be unique, but isn't always (section 3).
  - `account_id`, `security_id`: who traded what.
  - `transaction_type`: `BUY` or `SELL`.
  - `quantity`: number of units, always meant to be positive; BUY adds, SELL subtracts.
  - `price`, `gross_amount`: price per unit and the total money. `gross_amount` should equal quantity × price.
  - `status`: `BOOKED` (normal), `CANCELLED` (cancelled), `REVERSED` (marked as reversed; meaning unclear, section 9).
  - `related_transaction_id`: link to another trade, e.g. a rebook pointing at the trade it replaces.
  - `trade_date` (when agreed), `settlement_date` (when units and money are planned to change hands).
  - `source_system`: which system sent it: `OMS_FRONT`, `TRADE_CAPTURE` or `CUSTODY_FEED`.
- **Example (raw data):** TXN100410682 is a `SELL` of 1,730 units of SEC961485 at 87.7306, `gross_amount`
  151,773.94. Check: 1,730 × 87.7306 = 151,773.938, which rounds to 151,773.94.

### pipeline_events (1,409,533 rows)

- **One row:** the journey timestamps of one trade through the platform.
- **Columns that matter:** `transaction_id`, `event_timestamp` (trade happened), `received_timestamp`,
  `booked_timestamp`, `published_timestamp`, `cutoff_timestamp` (the day's deadline), `batch_id`.
- **Example (`02_trace.csv`):** TXN100052151 happened 09:44, was received 10:09, booked 10:15 and published 10:22;
  the cutoff was 18:00, so it was booked on time.
- Should be one row per trade, but 4,210 rows repeat a `transaction_id` (`02_defect_register.csv`).

### positions (480,663 rows)

- **One row:** the book of record's holding for one account and one security on the snapshot date.
- **Columns that matter:** `account_id`, `security_id`, `quantity`, `transaction_count` (how many trades the book says
  it counted), `as_of_date` (2026-07-10), `source` = `BOOK_OF_RECORD`.
- **Example (`02_trace.csv`):** POS224196289: ACC1014776 holds −9,688 units of SEC961485, built from 4 trades.
  A negative holding can be a legitimate short position (Dataset Guide §3).

### comparison_positions (480,183 rows)

- **One row:** the custodian's holding for one account and one security on the snapshot date.
- **Columns that matter:** `account_id`, `security_id`, `quantity`, `as_of_date`, `source` = `CUSTODIAN_FEED`. No
  `transaction_count`.
- **Example (`02_trace.csv`):** CMP245450976: the same holding, −9,688 units.
- It has 480,663 − 480,183 = 480 fewer rows than `positions`. These are exactly the 480 book holdings with no custodian
  record (`02_three_way_summary.csv`: "only in positions" 480, "only in comparison_positions" 0).

### accounts (100,000 rows)

- **One row:** one account.
- **Columns that matter:** `account_id`, `fund_id` and `share_class` (link the account to its fund in `ledger_nav`),
  `base_currency`, `status` (e.g. `OPEN`), `open_date`, `close_date`.
- **Example (`02_trace.csv`):** ACC1014776 belongs to fund FND00317, share class R, base currency JPY, `OPEN`.

### securities (6,012 rows)

- **One row:** one security (a share or a bond).
- **Columns that matter:** `security_id` (the real key), `asset_class` (`EQUITY` or `BOND`), `currency`. `cusip` and
  `isin` are only matching attributes; they can be missing or wrong (brief §6).
- **Example (raw data):** SEC961485 is an `EQUITY` in USD, listed on XNAS.
- 1,118 `positions` rows sit on a `security_id` that is not in this table (`02_defect_register.csv`).

### corporate_actions (200 rows)

- **One row:** one company event: `SPLIT`, `MERGER`, `SPINOFF`, `REDEMPTION` or `CASH_DIVIDEND`.
- **Columns that matter:** `security_id` (the security affected), `target_security_id` (the new security, for a
  merger or spin-off), `ex_date`, `effective_date`, `ratio` (units), `cash_rate` (cash per unit).
- It lists events, **not** which accounts received them (Dataset Guide §4).
- **Example (`02_ca_readiness.csv`):** CA00005 is a `SPINOFF` of SEC729531 with `ratio` 1.5: hold 100 units of the
  parent, receive 100 × 1.5 = 150 units of target SEC304911 and keep the 100. SEC304911 is not in `securities`.
- By type (`02_ca_readiness.csv`): 66 `CASH_DIVIDEND` + 52 `SPLIT` + 31 `MERGER` + 28 `REDEMPTION` + 23 `SPINOFF` = 200.

### prices (539,970 rows)

- **One row:** one vendor's price for one security on one day.
- **Columns that matter:** `security_id`, `price_date`, `vendor` (`VENDOR_A`, `VENDOR_B`, `VENDOR_C`), `price`,
  `currency`, `price_timestamp`, `vendor_priority` (1 = preferred).
- **Example (raw data):** SEC961485 on 2026-07-10: `VENDOR_A` 89.1807 (priority 1, 17:00), `VENDOR_B` 88.981 (18:00),
  `VENDOR_C` 89.2033 (19:00).

### fx_rates (180 rows)

- **One row:** one currency's rate to US dollars on one day. `rate_to_usd` = dollars per one unit of the currency.
- **Columns that matter:** `currency`, `rate_date`, `rate_to_usd`.
- **Example (raw data):** JPY on 2026-07-10 is 0.006747, so ¥1,000,000 × 0.006747 = $6,747.
- Six currencies on 2026-07-10 (raw data); 6 currencies × 30 days = 180 rows. The USD rate should be exactly 1, but on 2026-07-10 it is
  0.995917 (raw data); it is not 1 on 30 of 30 days (`02_defect_register.csv`).

### ledger_nav (2,000 rows)

- **One row:** one share class of one fund on the snapshot date.
- **Columns that matter:** `fund_id`, `share_class`, `net_assets` (fund value in USD), `shares_outstanding`,
  `nav_per_share` (price of one fund share). NAV = net asset value.
- **Rule it should obey:** `net_assets` ÷ `shares_outstanding` = `nav_per_share`.
- **Example (`02_nav_check.csv`):** LDG0000001 (FND00001, class A): 91,342,258.632702 ÷ 1,753,229.48 = 52.0994312;
  reported 52.099431. Passes.

---

## 2. How our code works

### The flow

1. **Data** in `data/`: never edited.
2. **Settings** in `config/reconciliation.toml`: every limit and treatment choice.
3. **Notebook** `notebooks/02_reconcile.ipynb`: runs every step, writes `outputs/02_*.csv`.
4. **Scripts** turn the outputs into [FINDINGS.md](../../FINDINGS.md), figures and the decks.

Rules find problems; AI never does (D-001).

### notebooks/02_reconcile.ipynb, section by section

| § | What it does |
|---|---|
| 1 | Loads the ten tables, every column as text, then converts types and keeps values that fail as findings |
| 2 | The recount: raw rows first, then one treatment at a time (C0 to C7, section 3 here) |
| 2b | The evidence behind two treatments: duplicate copies and blank quantities |
| 3 | Book against custodian on every key |
| 4 | Three sources: who disagrees (layer 1) |
| 5 | Why they disagree: cause rules (layer 2) |
| 6 | The evidenced trace |
| 7 | Ledger arithmetic |
| 8 | Vendor spread and scale |
| 9 | Corporate actions: supported or quarantined |
| 10 | Defect register: one line per finding |
| 11 | Run record: versions, runtime |

- Why text first: a date like `03/06/2026` or an ID like `00123` would be silently changed by automatic typing.
  Reading as text keeps the original, and a value that can't be converted becomes a finding instead of vanishing.
- The notebook stops itself if totals don't add up (e.g. the groups in section 4 must sum to the union of keys).
- Last full run: 63.8 s, Python 3.12.14, DuckDB 1.5.6 (`02_run_info.csv`).

### config/reconciliation.toml

| Block | What it holds | Example value |
|---|---|---|
| `[snapshot]` | the snapshot date | `as_of_date = "2026-07-10"` |
| `[policies]` | how the recount treats each kind of row | `reversed_main = "R1"`, `blanks = "not_evaluable"` |
| `[classification]` | the cause rules, in the order they are tried | `book_counts_duplicate_copies` first |
| `[trace]` | the rule that picks the traced trade | `flag = "sign_conflict"` |
| `[nav]` | NAV tolerance | `tolerance = 0.000001` |
| `[prices]` | vendor limits | `spread_threshold = 0.005`, `scale_ratio_low = 80`, `scale_ratio_high = 125` |
| `[corporate_actions]` | fields each event type needs | `MERGER` needs `ratio` and `target_security_id` |

- No number or record ID is typed into the code. Change a value here and rerun.
- **Worked example:** changing `spread_threshold` from 0.005 to 0.01 moved the vendor spread flags from 388 to 326
  securities and left the reconciliation unchanged (`02_vendor_check.csv` against
  `tests/runs/run_c/02_vendor_check.csv`).

### outputs/02_*.csv

| File | What it holds |
|---|---|
| `02_row_ledger.csv` | rows in and out of every load, step and join |
| `02_waterfall.csv` | recount vs book and vs custodian, one line per step C0 to C7 |
| `02_sensitivities.csv` | the same comparison with one step swapped for an alternative |
| `02_three_way_summary.csv` | recount vs book vs custodian: how many keys in each agree/disagree group |
| `02_break_classes.csv` | every break with its pattern and cause, plus flag counts |
| `02_reversed_side_view.csv` | R1 vs R3 result on each key with a REVERSED row |
| `02_duplicate_profile.csv` | evidence that duplicate copies are resends |
| `02_blank_quantity.csv` | evidence that blank-quantity rows are real trades |
| `02_negative_partners.csv`, `02_sign_by_type.csv` | evidence on the side of negative BUYs |
| `02_trace.csv` | the traced trade, one line per field per table |
| `02_nav_check.csv` | NAV arithmetic, one line per `ledger_nav` row |
| `02_vendor_check.csv` | vendor spread and scale, one line per security |
| `02_ca_readiness.csv` | each corporate action: supported or quarantined, and why |
| `02_defect_register.csv` | every finding: status, rule, affected, eligible, not evaluable, examples |
| `02_run_info.csv` | runtime, versions, config, seed |

### The scripts

| Script | What it does |
|---|---|
| `scripts/build_findings.py` | `02_defect_register.csv` → `docs/FINDINGS.md`, and fills the fact cards in `docs/DEFECT_CATALOG.md` |
| `scripts/check_docs.py` | fails if a doc points at a missing file or FINDINGS.md is older than the register |
| `scripts/build_checkin2_deck.py` | builds the 7-slide `Checkin2.pptx` and `SPEAKER_NOTES.md`, reading every number from the outputs |
| `scripts/fig_checkin2.py`, `scripts/fig_trace_journey.py` | draw the charts and the trace picture in `docs/figures/` |
| `scripts/build_store.py` | builds `outputs/store.duckdb` for the dashboard (not part of Check-in 2) |

### The tests in tests/

- **`tests/run_notebook.sh`:** runs notebook 02 on the full data in a fresh session, about a minute. Fails if any cell
  errors. This is the "can someone else rerun it" test.
- **`tests/fixture_test.sh`:** runs the notebook on a small made-up dataset (`tests/fixtures/small`, same columns,
  no real rows) where we planted each problem ourselves, and checks each result. Example: "a blank book quantity →
  not evaluable, never a break". It also runs with rows shuffled, with settlement-date holdings, with a trace flag no
  key has, and on an edge copy with cases the real data lacks.
- **`tests/robustness_test.sh`:** reruns on the full data with rows shuffled under seeds 3, 11 and 25; every total
  must stay the same. Then changes one limit (spread 0.005 → 0.01) and checks that only the vendor flags move.
  About 5 minutes, about 4 GB memory.
- **Worked example:** run_s3 (shuffled with seed 3) gives the same vendor result as run_a (rows as delivered):
  5,602 pass, 388 spread, 10 scale, 15 no quote (`tests/runs/run_a` and `run_s3`, `02_vendor_check.csv`).

### How we use AI

- Every finding comes from a written rule in the notebook. AI never decides what is a problem, because a judge must
  be able to rerun the code and get the same answer (D-001).
- We use an AI assistant to help write and review code and documents and to explain results in plain words. Every
  number it gives is checked against `outputs/`.
- Chat logs are kept in `AI_Logs/`, outside git, because they quote record IDs (D-039). The brief (§7, §10) requires
  them in the final hand-in.

---

## 3. Position reconstruction

### What it is

- Rebuild every holding from `transactions`: start at 0, add BUYs, subtract SELLs.
- **Example:** an account buys 100 and sells 30, so it holds 100 − 30 = 70.
- **Real example (`02_trace.csv`):** ACC1014776 / SEC961485 has four trades: BUY −1,995, SELL 1,730, SELL 1,050,
  SELL 4,913. Recount: −1,995 − 1,730 − 1,050 − 4,913 = −9,688.
- Starting at 0 is the Dataset Guide's convention (§3), not a claim that the accounts started empty.

### Which rows we count: the chain C0 to C7

Rows per step from `02_row_ledger.csv`. Each step is one written choice in `[policies]`.

| Step | What it does | Rows after | Change |
|---|---|---|---|
| C0 | every row, as delivered (raw benchmark) | 1,409,533 | |
| C1 | remove the second copy of exact duplicates | 1,407,473 | −2,060 |
| C2 | copies that disagree on a fact: key set aside as "not evaluable" | 1,407,473 | 0 |
| C3 | drop `status = CANCELLED` | 1,403,128 | −4,345 |
| C4 | REVERSED reading R1: drop `status = REVERSED` rows, the original still counts | 1,401,726 | −1,402 |
| C5 | negative quantities kept as they are, key flagged | 1,401,726 | 0 |
| C6 | blank quantities: key set aside as "not evaluable" | 1,401,726 | 0 |
| C7 | only trades with `trade_date` on or before 2026-07-10 | 1,401,726 | 0 |

Check: 1,409,533 − 2,060 − 4,345 − 1,402 = 1,401,726. Keys rebuilt at C7: 480,478 (`02_waterfall.csv`).

**C1, duplicate copies.**
- 2,060 IDs appear twice with identical rows: 2,032 exact pairs (4,064 rows ÷ 2) + 28 pairs that differ only in date
  format (56 rows ÷ 2) = 2,060 (`02_defect_register.csv`).
- Example (raw data): TXN100002453 is a SELL of 3,556 sent twice. Counting both would subtract 7,112; we subtract 3,556.
- Why we think it's a resend: all 2,060 pairs arrive in one batch at the same time, and the second is published later,
  median 5 minutes (`02_duplicate_profile.csv`). D-044.

**C2, conflicting copies.** 90 rows share an ID but differ on a fact. We can't know which copy is right, so their
keys are not tested (D-006).

**C3, CANCELLED.** A cancelled trade isn't held. The book agrees: its `transaction_count` equals the number of rows
that are not CANCELLED on every position (`02_duplicate_profile.csv`). A `BOOKED` row linked to a CANCELLED one is a
rebook and counts (D-045).

**C4, REVERSED.** Treated as a status label (R1, the Guide's "BOOKED-only" benchmark). Full treatment in section 9.

**C5, negative quantities.** 655 BUY rows have a negative quantity (`02_sign_by_type.csv`). We keep the sign as
delivered and flag the key `sign_conflict`. Taking the absolute value would be a silent repair (D-008).

**C6, blank quantities.** 2,819 rows (`02_blank_quantity.csv`). Unknown never becomes 0, so the key is not tested
(D-009). What we found:
- They look like real trades: 2,806 are `BOOKED`, all 2,819 have `gross_amount` above zero and were booked and
  published.
- The size is still in the row: `gross_amount ÷ price` is a whole number on 2,802 of 2,819.
- Example: `gross_amount` 50.00 and `price` 5.00 give 50.00 ÷ 5.00 = 10 units.
- The book appears to drop those units: with the derived sizes, 2,599 + 157 = 2,756 of 2,778 testable keys differ
  from the book in the way blank-as-zero predicts (`02_blank_quantity.csv`; D-047). Unresolved: the size is derived,
  not confirmed by the source.

**C7, trade date vs settlement date.**
- Main version: trade date. Beside it: settlement date (C7s), which uses 1,337,963 rows, 1,401,726 − 1,337,963 =
  63,763 fewer (`02_waterfall.csv`).
- C7s matches the book on 413,974 keys, C7 on 473,944. So the book behaves like a trade-date book (D-010).

### Open

- Correct sign of the 655 negative BUYs (section 6). Whether to fill in blank sizes once the source confirms them.

---

## 4. Position reconciliation

### What it is

- Put three numbers side by side for every key: our recount, the book, the custodian.
- Use the **full union** of keys: a key in any one source counts. A key missing from a source is reported as
  missing, never as 0.
- **Example:** book has A and B, custodian has B and C → union is A, B, C (3 keys). A is "only in book", C is "only at
  custodian".
- Union here: 480,862 keys (`02_row_ledger.csv`, three-way union).

### Book vs custodian (`02_three_way_summary.csv`)

| Group | Keys |
|---|---|
| same quantity | 478,265 |
| different quantity | 1,918 |
| only in `positions` | 480 |
| only in `comparison_positions` | 0 |

Check: 478,265 + 1,918 + 480 = 480,663 (= `positions` rows); 478,265 + 1,918 = 480,183 (= `comparison_positions` rows).

### Recount vs book, step by step (`02_waterfall.csv`, compared with positions)

| Version | Same as book | Different |
|---|---|---|
| C0 raw | 471,746 | 5,880 |
| BOOKED-only (Guide benchmark) | 476,014 | 1,625 |
| C7 our chain | 473,944 | 3,656 |

- BOOKED-only matches the book on 476,014 − 473,944 = 2,070 more keys than our chain, mostly because it keeps the
  duplicate copies and the book counts them too (section 5).

### Three-way result (`02_three_way_summary.csv`, `02_break_classes.csv`)

| Group | Keys |
|---|---|
| all three agree | 471,583 |
| breaks: all three present, numbers differ | 5,539 |
| one-sided: missing from one or two sources | 904 |
| not evaluable (blank quantity 2,791, conflicting copy 39, both 6) | 2,836 |
| **union** | **480,862** |

- Check: 471,583 + 5,539 + 904 + 2,836 = 480,862.
- One-sided: 478 recount + book, no custodian (475 of them agree) + 384 book + custodian, no trades (382 agree) + 42
  recount only, trades net to 0 = 904.
- **Headline:** keys we can test = 480,862 − 2,836 = 478,026. All three agree on 471,583 ÷ 478,026 = 98.65% (D-046).
  One-sided keys stay in the denominator as "not agreeing".
- **Agreement is not proof:** 637 of the agreeing keys contain a negative-quantity row (`02_break_classes.csv`,
  `sign_conflict_keys`). The trace in section 6 is one of them.

### Open

- Why the custodian lacks 480 holdings (catalog entry 5): the trades support the book on most, so likely a custodian
  feed gap.

---

## 5. First break classification

Two layers. Each break gets exactly one class, so the counts add up (D-013).

### Layer 1: who disagrees (`02_three_way_summary.csv`)

| Pattern | Keys | Meaning |
|---|---|---|
| recount is the odd one out | 3,637 | book = custodian ≠ recount |
| custodian is the odd one out | 1,886 | recount = book ≠ custodian |
| all three differ | 16 | |
| **total breaks** | **5,539** | |

- The book is never the odd one out on its own.
- Example: recount 70, book 100, custodian 100 → recount is the odd one out.

### Layer 2: likely cause

Cause rules are tried in the order written in `[classification]`; the first that fits sets the class.

| Order | Cause rule | Fits when | Keys (`02_break_classes.csv`) |
|---|---|---|---|
| 1 | `book_counts_duplicate_copies` | difference = the quantity of the copies we removed | 2,021 + 9 = 2,030 |
| 2 | `book_double_offsets_reversed` | difference = minus every REVERSED quantity on the key | 680 + 3 = 683 |
| 3 | `duplicates_and_reversed` | difference = rule 1 + rule 2 | 3 |
| 4 | `custodian_settlement_date_basis` | custodian = our settlement-date recount | 0 |
| 5 | `sign_flipped_position` | odd source = minus our recount | 216 + 2 = 218 |
| | unexplained | no rule fits | 1,886 + 717 + 2 = 2,605 |

- Check: 2,030 + 683 + 3 + 0 + 218 + 2,605 = 5,539. (In each "a + b", the first number is "recount is the odd one
  out" or "custodian is the odd one out"; the second is "all three differ".)
- 2,605 ÷ 5,539 = 47% have no cause yet. We show them rather than force a cause.
- **Example, rule 1:** trades BUY 500, SELL 200, and the SELL is sent twice. We count 500 − 200 = 300. The book counts
  500 − 200 − 200 = 100. Difference 100 − 300 = −200 = the copy's signed quantity.
- **Example, rule 2:** see the real key in section 9 (book −6,088 = every REVERSED row subtracted).
- **Example, rule 5:** recount 400, book −400.
- Flags are added on top and never change the class: `sign_conflict` (negative-quantity row on the key) and
  `rebook_old_gross` (a rebook that kept the cancelled trade's `gross_amount`).

### Likely cause, in words

- Recount odd, rules 1 to 3: the book and custodian follow a counting convention we don't (counting copies twice,
  subtracting REVERSED rows more than once). Defect or house rule? The data can't say: unresolved, faculty questions
  1 and 4.
- Custodian odd, 1,886 unexplained: points to the custodian's file; cause not found yet.

### Open

- Look inside the 2,605 unexplained breaks (first job after Check-in 2; [STATUS.md](../../STATUS.md)).

---

## 6. One evidenced trace

### What it is

- Follow one broken record through every table, showing the evidence at each step.
- Picked by a rule in `[trace]`, not by hand: the first key (sorted by `account_id`, `security_id`,
  `transaction_id`) with a `sign_conflict` flag, no other flag, and present in all three sources (D-025).

### The trade, step by step (all from `02_trace.csv`)

1. **`transactions`:** TXN100052151, ACC1014776 / SEC961485, `BUY`, `quantity` −1,995, `price` 88.5356,
   `gross_amount` 176,628.52, `status` `BOOKED`, `source_system` `OMS_FRONT`, `trade_date` 2026-06-02.
   - Size check: 176,628.52 ÷ 88.5356 = 1,994.99998 ≈ 1,995. So the size is right.
   - Side: `gross_amount` is positive on every BUY and every SELL (`02_sign_by_type.csv`), so it can't show the side.
   - Two readings fit: **wrong sign** (should be BUY +1,995) or **wrong type** (should be SELL 1,995).
   - No other record of this trade exists that could decide it.
   - Where it entered: already wrong as delivered by `OMS_FRONT` (inferred).
2. **`pipeline_events`:** event 09:44, received 10:09, booked 10:15, published 10:22, cutoff 18:00, batch B2026060210.
   Processed normally and on time. 5 negative-quantity records sit in that batch of 6,635.
3. **`positions`:** POS224196289, `quantity` −9,688, `transaction_count` 4. Our recount: −1,995 − 1,730 − 1,050 −
   4,913 = −9,688. Book = recount, so the reconciliation passes and hides the error.
4. **`comparison_positions`:** CMP245450976, −9,688. Custodian = book. On 641 of 645 keys with a negative-quantity
   trade, custodian = book, so a book-vs-custodian check can't catch it.
5. **Downstream:** `accounts`: fund FND00317, class R. `ledger_nav`: fund net assets 183,372,640.45 USD (4 share
   classes). Price used: 89.1807 USD (`VENDOR_A`, priority 1). FX: USD, so no rate applied.

### What it would be worth

- Wrong-sign reading: correct holding = +1,995 − 1,730 − 1,050 − 4,913 = −5,698. Units misstated = −5,698 − (−9,688) =
  3,990 = 2 × 1,995.
- Exposure = 3,990 × 89.1807 = 355,830.99 USD.
- As a share of the fund: 355,830.99 ÷ 183,372,640.45 × 10,000 = 19.40 basis points (one basis point = 0.01%).
- Wrong-type reading: a SELL of 1,995 moves the holding the same way, so the book is right and exposure is 0.
- We lean wrong sign: the 5 negative BUYs that have a second record all point to wrong sign
  (`02_negative_partners.csv`). This trade has none.

### Where to stop it

- At trade capture: rule `TXN_FIELDS_VALID` ([RULES.md](../../RULES.md) §3) rejects any `quantity` that isn't above
  zero. Owner: trade operations lead.

### Open

- The correct value needs the order side or cash direction from the source (faculty question 8).

---

## 7. Checks on price data and ledger arithmetic

### Ran on all the data

**Ledger arithmetic (`NAV_ARITHMETIC`, `02_nav_check.csv`)**
- Rule: |`net_assets` ÷ `shares_outstanding` − `nav_per_share`| ≤ 0.000001 (`[nav] tolerance`).
- Result: 40 of 2,000 rows fail, 1,960 pass.
- Failing example: LDG0000016 (FND00004, class Z): 28,579,346.5702 ÷ 1,270,130.9 = 22.501103; reported 22.565404;
  difference −0.064301, which is 28.5 basis points of `nav_per_share`.
- Failures range from 15.8 to 194.4 basis points (`02_nav_check.csv`, `residual (bps of nav_per_share)`).
- We can't tell which of the three fields is wrong. Cash and accruals aren't in the data, so it is never called a
  proven NAV error. On fail: hold the NAV. Owner: fund accounting.

**Vendor spread (`PRC_VENDOR_DISPERSION`, `02_vendor_check.csv`)**
- Rule: (highest − lowest) ÷ average of the vendors' prices on the snapshot date ≤ 0.5% (`spread_threshold`).
- Example: SEC277543: (45.2225 − 44.9887) ÷ 45.1424 = 0.518% → flagged.
- Result: 388 of 6,000 securities flagged.

**Vendor scale**
- Rule: highest ÷ lowest between 80 and 125, roughly a factor 100 (one vendor quotes per 100 units of face value,
  another per unit, or a unit error). Flag, never fix.
- Example: SEC857732 (`BOND`): 114.3101 ÷ 1.142619 = 100.04 → flagged.
- Result: 10 securities.
- Check: 5,602 pass + 388 spread + 10 scale + 15 no quote (not evaluable) = 6,015; eligible = 6,015 − 15 = 6,000.
- Owner: pricing lead.

### Proposed, rule written, not run yet ([RULES.md](../../RULES.md) §6, §7; D-041)

| Check | Rule | Related finding already in the register |
|---|---|---|
| Coverage (`PRC_QUOTE_ELIGIBLE`) | every holding has a price > 0 in the security's currency on the snapshot date, preferred vendor first | 1,118 holdings on a security with no price at all |
| Freshness (`PRC_QUOTE_ELIGIBLE`) | `price_timestamp` on `price_date` and before the NAV cutoff | preferred vendor has no valid price on 30 of 180,000 security-days (6,000 × 30) |
| FX rates (`FX_RATE_VALID`, `FX_RATE_COVERAGE`) | one rate > 0 per currency per day; USD exactly 1; every price currency has a rate | USD ≠ 1 on 30 of 30 days; 1,080 price rows in currency XYZ have no rate |
| Share classes (`NAV_SHARE_CLASS_MAPPING`) | every open account's `fund_id` + `share_class` exists in `ledger_nav` | none yet |
| Clean before release (`NAV_OPEN_ISSUES_BEFORE_RELEASE`) | no open issue above a materiality limit on holdings feeding the fund | none yet; needs a limit (faculty question 5) |

- Freshness can't run yet: the NAV cutoff time isn't in the data. It must go in `config/reconciliation.toml` first.
- "Related finding" numbers come from `02_defect_register.csv`; they are not the full check's result.

---

## 8. Defect catalog

### How it works

- Every rule that fails becomes one line in `02_defect_register.csv`, with status, rule, affected count, eligible
  count, not-evaluable count and example IDs. FINDINGS.md is generated from it.
- Eligible + not evaluable = population, always (D-027). Example: negative quantity: 1,406,714 eligible + 2,819 blank
  (can't test) = 1,409,533 rows.
- Total: 39 findings = 17 confirmed + 21 unresolved + 1 cleared ([FINDINGS.md](../../FINDINGS.md)).

### The six full write-ups ([DEFECT_CATALOG.md](../../DEFECT_CATALOG.md))

| # | Class | Status | Size (`02_defect_register.csv`) |
|---|---|---|---|
| 1 | Negative-quantity BUYs | record confirmed; correct value unresolved, leaning wrong sign | 655 of 1,406,714 rows |
| 2 | Blank quantities left out by the book | record confirmed; position effect unresolved | 2,819 rows; book drops units on 2,756 of 2,778 keys |
| 3 | Duplicate copies counted as trades | copies confirmed; counting them unresolved | copies 4,064 + 56 rows; counted on 2,021 keys |
| 4 | Spin-off targets never set up | confirmed | 23 of 23 events; 1,118 position rows with no security and no price |
| 5 | Custodian missing holdings | unresolved | 480 of 480,663 keys |
| 6 | Closed positions not reported | cleared | 42 keys |

### Confirmed (17): we can prove the record is wrong

- Example: a BUY of −1,995. A quantity is never negative, so the row itself proves it.
- Pipeline: exact copies 4,064 rows; date-format-only copies 56; repeated ID in `pipeline_events` 4,210.
- Trade capture: `trade_date` written DD/MM/YYYY 9,398; blank `settlement_date` 1,687; `settlement_date` before
  `trade_date` 1,124; negative quantity 655; blank quantity 2,819; CANCELLED row linked to an ID that doesn't exist 842.
- Master data: position on an account missing from `accounts` 699 rows; on a security missing from `securities`
  1,118 rows.
- Corporate actions: target security missing 23 events; MERGER without a target 31.
- Pricing: preferred vendor has no valid price 30 security-days; held security with no price 1,118 position rows;
  price with no FX rate 1,080 price rows.
- NAV: arithmetic fails 40 rows.

### Unresolved (21): something's off, can't prove who is wrong

- Example: book and custodian both say 100, our trades say 70. Either both count the same way on purpose, or both
  are wrong.
- Trades: copies that conflict 90 rows; more than one REVERSED row per original 1,402 rows; rebook keeps the cancelled
  `gross_amount` 3,333 rows.
- Corporate actions: REDEMPTION with no unit convention 28; `ratio` or `cash_rate` filled where unused 141;
  `ex_date` after `effective_date` 87.
- Pricing: USD rate not 1 on 30 days; vendor spread 388; vendor scale 10.
- Positions: book drops blank-quantity units 2,756 keys; book holding with no custodian record 480; holding with no
  trade behind it 384; recount vs book on the Guide's BOOKED-only benchmark differs on 1,625.
- The 8 break-class lines from section 5: 2,021 + 680 + 3 + 717 + 216 + 1,886 + 14 + 2 = 5,539. Here 14 = all three
  differ with a cause (9 + 3 + 2) and 2 = all three differ with no cause.

### Cleared (1): looked wrong, proved fine

- 42 keys appear only in our recount, and their trades net to 0. Example: buy 300, sell 300, hold 0.
- Why it's fine: neither `positions` nor `comparison_positions` stores a single zero-quantity row, so a closed holding
  is simply not listed (D-024).
- The rule was written before we looked. What would reopen it: one zero row in either source.

---

## 9. Treatment of ambiguous reversals and unsupported corporate actions

### REVERSED: four possible readings

A `REVERSED` row points (`related_transaction_id`) at an earlier trade. The data doesn't say whether it cancels that
trade or only marks it (Dataset Guide §3).

**Real example (raw data):** ACC6534055 / SEC619065.

| Row | Type | Quantity | Status | Points at |
|---|---|---|---|---|
| TXN100001074 | BUY | 1,008 | BOOKED | |
| TXN100001065 | BUY | 1,008 | REVERSED | TXN100001074 |
| TXN100001066 | BUY | 1,008 | REVERSED | TXN100001074 |
| TXN100026065 | BUY | 98 | BOOKED | |
| TXN100109518 | SELL | 2,075 | BOOKED | |
| TXN101173897 | SELL | 3,103 | BOOKED | |

| Reading | Rule | Holding |
|---|---|---|
| **R1 (ours)** | REVERSED is a status label; the original counts; REVERSED rows add nothing | 1,008 + 98 − 2,075 − 3,103 = −4,072 |
| R2 (dropped) | neither the original nor the REVERSED rows count | 98 − 2,075 − 3,103 = −5,080: same as R3, but a key whose only trades are reversed vanishes (D-007) |
| **R3 (shown beside)** | each original is cancelled once | −4,072 − 1,008 = −5,080 |
| R4 (refused) | every REVERSED row cancels | −5,080 − 1,008 = −6,088 |

- Book and custodian both hold −6,088 (raw data): they follow R4 and cancel the trade twice.
- Every reversed trade here has more than one REVERSED row: 1,402 of 1,402 rows (`02_defect_register.csv`).
  So R4 always double-cancels, which the Guide says to prevent. That is why we refuse it.
- **Does our choice matter?** Of the 699 keys with a REVERSED row, R1 and R3 give a different result on 5
  (`02_reversed_side_view.csv`: 1 + 3 + 1). Against the book, R3 adds 2 matches, removes 3 differences and makes 1
  more key not evaluable (`02_sensitivities.csv`).
- What would settle it: a written rule for what REVERSED means (faculty question 1).

### Corporate actions: supported or quarantined

- Before counting, `[corporate_actions]` in the config lists the fields each type needs (Dataset Guide §4):

| Type | Needs | Example |
|---|---|---|
| `SPLIT` | `ratio` (new units per old unit) | ratio 0.5: hold 100 → 100 × 0.5 = 50 |
| `CASH_DIVIDEND` | `cash_rate` (cash per unit) | 100 units × 1.32 = 132 in the security's currency |
| `MERGER` | `ratio` and a `target_security_id` that is in `securities` | ratio 1.5: 100 old → 150 target units |
| `SPINOFF` | `ratio` and a mastered target; parent stays | ratio 1.5: keep 100, receive 150 |
| `REDEMPTION` | `cash_rate` and a rule for how many units disappear | the Guide gives no such rule |

- **Result (`02_ca_readiness.csv`):**
  - Supported: 66 `CASH_DIVIDEND` + 52 `SPLIT` = 118.
  - Quarantined: 31 `MERGER` with no target (e.g. CA00002) + 28 `REDEMPTION` with no unit rule (e.g. CA00001) + 23
    `SPINOFF` whose target isn't in `securities` (e.g. CA00005) = 82.
  - Check: 118 + 82 = 200.
- Quarantined = not applied, and the missing field is never guessed. Each row of `02_ca_readiness.csv` says what would
  release it (e.g. "the target security set up in securities").
- Flagged, not quarantined: 87 events with `ex_date` after `effective_date` (depends on how the dates are defined,
  faculty question 2) and 141 with a `ratio` or `cash_rate` the type doesn't use.
- Today's recount uses trades only. The holdings after corporate actions come in the final, as a separate scenario,
  so no unit is counted twice (D-016).

---

## 10. Open questions for faculty

From [STATUS.md](../../STATUS.md), "Open questions for faculty", with what each answer would change.

| # | Question | What the answer changes |
|---|---|---|
| 1 | Is there a contract for REVERSED (one reversal per original)? | Settles R1 vs R3, and whether the 683 REVERSED breaks are defects |
| 2 | Corporate-action dates: what are ex-date and effective date? | Settles the 87 events with `ex_date` after `effective_date` |
| 3 | USD rate not exactly 1: data error or convention? | Confirms or clears the 30-day USD finding |
| 4 | Book counting copies and every REVERSED row: intended or defects? | Turns the 2,030 + 683 + 3 breaks into confirmed or cleared |
| 5 | May we use CSSF Circular 24/856 as an outside NAV-error limit? | Gives the materiality limit for the release check |
| 6 | Which AI tools are approved for use with the data? (in writing) | How we may keep using the assistant |
| 7 | Preferred dashboard packaging (e.g. zipped Streamlit app)? | How we hand in the dashboard |
| 8 | Negative BUY: wrong sign or wrong type? Needs order side or cash direction | Settles the correct value of the 655 rows and the 19.40 bps exposure |
