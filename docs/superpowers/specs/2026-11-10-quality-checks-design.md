# Design: price data quality and the four partly coded rules (Check-in 3)

*Approved 10 Nov 2026 (after the builder check). Build plan: `docs/superpowers/plans/2026-11-10-quality-checks.md` (after approval).
Branch: `quality-checks` (created only after the plan is approved).*

## 1. Intent and why

STATUS.md "Next: toward Check-in 3", step 1, with the scope D-066 fixes: the last check session before Check-in 3.
After it no new checks are added; the scorecard (next session) reads these checks' pass, fail and not-evaluable counts.

- **Price data quality** (brief §5 "Price data quality": coverage, freshness, vendor disagreement, unit or scale
  consistency). Today `PRC_QUOTE_ELIGIBLE` has two register lines (no preferred-vendor price; no price at all) and
  `PRC_VENDOR_DISPERSION` counts spread and scale flags (section 8, `outputs/02_vendor_check.csv`), but nobody has
  looked inside those flags, and coverage and freshness are "proposed, not run" (RULES.md §6, D-041).
- **The four partly coded rules** (RULES.md §3 and §6): `TXN_FIELDS_VALID` (T+2 in business days, amount tolerance,
  blank price), `FX_RATE_VALID` (uniqueness, rate > 0, day-on-day band), `TXN_DUPLICATE` (same economics under a new
  ID), `TXN_CORRECTION_LINK` (same account and security).

The shape follows the timeliness session (`docs/superpowers/specs/2026-11-10-timeliness-design.md`): register lines
appended at the end, thresholds in `config/`, full denominators, TDD on the fixtures.

## 2. Goals, non-goals, anti-goals

**Goals**
- Coverage and freshness run with the D-041 denominators; the spread and scale flags sorted into confirmed,
  unresolved and cleared by a written rule.
- The four rules' missing parts coded.
- Every new check publishes fail (affected), eligible and not evaluable, which add to its population, as a register
  line. Pass = eligible − affected.
- One new output file, `outputs/02_price_quality.csv`, one row per held security, so any price result can be traced
  to its quotes.
- New thresholds in `config/reconciliation.toml`, set in this design before the distributions they judge were looked
  at.

**Non-goals**
- The rules RULES.md states with no code (D-066): `ACC_NOT_OPEN_ON_TRADE_DATE`, `ACC_REQUIRED_FIELDS`,
  `SEC_IDENTIFIER_VALID`, `TXN_SECURITY_NOT_MASTERED`, `NAV_SHARE_CLASS_MAPPING`, `NAV_OPEN_ISSUES_BEFORE_RELEASE`,
  `CA_ALL_HOLDERS_ADJUSTED`.
- The "groups we have only counted" deep dives (after Check-in 3), including what the book did with the economic
  duplicates.
- The scorecard, indicators, weights and App. B's week-over-week doubling (next session).
- The parts of `TXN_CORRECTION_LINK` that already have lines or wait on faculty: CANCELLED/REVERSED/BOOKED
  combinations and double offsets (REVERSED semantics, open question 1).
- Valuation or exposure of the price flags (advanced valuation is optional and last, D-066).
- Dashboard code changes.

**Anti-goals: a failure even if it runs**
- Any existing register line, or any number in an existing output, moving. `02_vendor_check.csv` stays
  byte-identical; new lines go after the timeliness lines.
- A missing quote or timestamp counted as covered or fresh; a missing date counted as settled on time.
- A threshold derived from this release's own distribution.
- Choosing a vendor because it matches the ledger or because it makes a number look better (Dataset Guide §4).
- A scale flag "corrected" by multiplying or dividing by 100 (quote basis is not explicit).
- Settlement lag counted in calendar days.
- A cleared line that hides the fact that its evidence sits in the same record.

## 3. Constraints

- Code lives only in `notebooks/deliverable.ipynb`, edited as `.ipynb` (D-037). `notebooks/additional/` is
  reference only.
- Read CSVs as text, convert explicitly, keep values that fail. Dates `YYYY-MM-DD` or `DD/MM/YYYY`: reuse
  `normalise_date`, `to_day`, `normalise_timestamp`.
- No hard-coded record IDs; detection rule-based (D-001); thresholds in `config/`.
- Register convention: eligible + not evaluable = population, asserted (D-027). Each line's members go to
  `02_finding_members.csv`; a plain sentence goes in `scripts/plain_language.json` for each.
- Shuffled rows give identical outputs: every pick (chosen quote, group member) breaks ties by sorted values, never
  by file order.
- New lines use existing id kinds only (`transaction_id`, `security_id`, `currency`), so the store and dashboard
  should need no code change. If they would, stop and ask.
- No commit or push; the user commits.

## 4. Facts about the data (read-only profiling, 10 Nov)

Looked at: formats, blanks, keys, uniqueness, and the inside of the existing spread and scale flags (whose
threshold is already fixed). Not looked at: price timestamp times against a cutoff, repeated prices across dates,
FX day-on-day moves. The settlement-lag spread was already shown at Check-in 1
(`docs/checkins/checkin1/CHECKIN1_REPORT.md`, settlement time row), so the T+2 limit is not a blind choice; it was
already in RULES.md before this session.

**Prices**
- Three vendors, one fixed `vendor_priority` each (VENDOR_A 1, VENDOR_B 2, VENDOR_C 3); 30 Monday–Friday dates
  ending on the snapshot (2026-07-10); every date and timestamp ISO; no blank or non-positive price; one quote per
  security, date and vendor.
- Every quote's currency equals its security's master currency; every `price_timestamp` falls on its `price_date`.
- On the snapshot, VENDOR_A lacks a quote for some securities that B and C quote (the existing "preferred vendor"
  line). The held securities with no quote at all are exactly the ones missing from `securities` (the existing
  "no price at all" line).

**Inside the existing flags** (snapshot date, `02_vendor_check.csv`)
- Spread flags: in most, VENDOR_A is the odd one out and B and C agree within the threshold. These securities are
  flagged on most of the 30 dates, not one: a persistent pattern.
- Scale flags: all bonds. One vendor quotes about 1/100 of the other two, which agree; any of the three vendors can
  be the odd one, VENDOR_A included. Each is flagged on only one or two dates: one-off events.

**FX**
- Six currencies with one rate each per date, all readable and positive; no rate for the currency `XYZ` (existing
  FX coverage line).

**Transactions**
- `price` is blank on some rows (new); quantity and settlement_date blanks already have lines; the other columns
  have no blanks. `settlement_note` is blank or `EXTENDED_SETTLEMENT_AGREED`.
- Links: every BOOKED and REVERSED `related_transaction_id` points to an existing ID; every linked CANCELLED row
  points to a missing one (existing line); no row links to itself.
- Same account, security, trade date, type, quantity and price under different IDs: thousands of groups. Many are
  linked rebooks or reversals; the rest are mostly two unlinked BOOKED rows. Every group shares one
  `event_timestamp` (minute precision) and one feed.

## 5. What the user decided (10 Nov)

| Question | Decision |
|---|---|
| NAV cutoff for freshness | **18:00**, the data's own cutoff (`pipeline_events.cutoff_timestamp` is 18:00 every day; brief App. B ties missing it to a stale NAV). Exactly 18:00 is on time |
| Flat-run length | **3** consecutive business dates with an identical price from the chosen vendor, ending on the snapshot |
| FX day-on-day band | **5%**: \|rate / rate on the previous business day − 1\| above 0.05 is flagged |
| Settlement lag limit | **Flat T+2** in business days (Mon–Fri, no holidays, as the Dataset Guide's calendar states) |
| Lag above T+2 | Two lines. No agreed extension = **unresolved** (T+2 is a team assumption). `EXTENDED_SETTLEMENT_AGREED` = **cleared** look-alike on the Dataset Guide's wording; it says the note sits in the same row and would reopen if a counterparty confirmation showed no agreement |
| Economic duplicates | **Unresolved** (RULES.md: held for review; split child orders are a real look-alike). Shared minute and feed go in the how-detected text as supporting evidence; an order or message ID would settle it |
| Inside the vendor flags | Chosen quote backed by another vendor = **cleared**. Chosen quote is the odd one while the other two agree: scale = **confirmed**, spread = **unresolved**. No two vendors agree = **unresolved** |
| Coverage publication | **New lines with the overlap stated**: coverage and fallback-only holdings, both confirmed; the old lines untouched |
| Publishing for the scorecard | **Register lines + `outputs/02_price_quality.csv`**; no extra check-results table |
| Repeated IDs on the trade lines | **Rows; copies that disagree on a line are all not evaluable on it** (after the builder check) |

## 6. Design

### 6.1 Config (`config/reconciliation.toml`), written before the build looks at the data

```toml
[tolerances]
settlement_lag_limit_business_days = 2          # flat T+2, team assumption (RULES.md TXN_FIELDS_VALID)
settlement_extension_note = "EXTENDED_SETTLEMENT_AGREED"   # the note that clears a longer lag

[prices]
nav_cutoff_time = "18:00:00"   # the data's own cutoff (pipeline_events.cutoff_timestamp); at the cutoff = on time
flat_run_dates = 3             # identical chosen price on this many consecutive business dates = flat run (look-alike)

[fx]
day_on_day_band = 0.05         # |rate / previous business day's rate - 1| above this is flagged
```

The amount check uses the existing `gross_amount_tolerance` (0.01). Key names are the builder's choice; the values
are not.

### 6.2 The chosen quote (shared by coverage, freshness and the look-inside)

For each held security (distinct `security_id` in `positions` on `[snapshot] as_of_date`), the quotes whose
`price_date` reads as the snapshot date. A quote is **eligible** if its price reads and is > 0 and its currency
equals the security's master currency. The **chosen quote** is the eligible quote with the lowest
`vendor_priority`; ties are broken by sorted vendor name, then price. The **priority vendor** is the lowest
`vendor_priority` in the file (as the existing "preferred vendor" line uses).

### 6.3 Coverage (`PRC_QUOTE_ELIGIBLE`, D-041)

Unit: one `positions` row on the snapshot date.

| Result | Rule |
|---|---|
| pass | its security has a chosen quote |
| fail | no eligible quote from any vendor, including a security with no quote at all (the absence is the evidence, D-041) |
| not evaluable | a quote exists on the snapshot date but cannot be judged: the security is missing from `securities` (no currency to compare), or its only quotes have an unreadable `price_date` or price |

Reported beside it, as its own line: rows whose chosen quote is not from the priority vendor (fallback-only). Its
population is the coverage passes only (rows with a chosen quote); rows with no chosen quote are line 1's, never a
pass here (RULES.md "Missing data": a record we cannot test never raises a score).

### 6.4 Freshness (`PRC_QUOTE_ELIGIBLE`, D-041)

Unit: the chosen quote of one held security (securities with no chosen quote are coverage's business, not here).

| Result | Rule |
|---|---|
| pass | `price_timestamp` falls on `price_date`, at or before `nav_cutoff_time` |
| fail | after the cutoff, or on a different day from `price_date` |
| not evaluable | `price_timestamp` blank or unreadable; never counted as fresh |

Reported beside it (how-detected text and `02_price_quality.csv`, not as lines):
- **Fresh fallback available:** a failing chosen quote where another eligible quote on the snapshot is fresh. D-041
  judges the chosen quote and does not re-pick; this count shows what a freshness-aware waterfall would rescue.
- **Flat runs:** chosen quotes whose vendor gave the identical price on `flat_run_dates` consecutive business dates
  ending on the snapshot. A look-alike, not stale by itself (D-041); a missing date in the run breaks the run.

### 6.5 Inside the spread and scale flags (`PRC_VENDOR_DISPERSION`)

For every security whose `02_vendor_check.csv` result is "spread above threshold" or "scale flag (ratio near 100)"
(the existing section 8 logic, unchanged), on the snapshot date:

- **Backed:** another vendor's valid quote is within `spread_threshold` of the chosen quote, measured as
  \|x − y\| / mean(x, y).
- **Chosen is odd:** not backed, and two other vendors' quotes are within `spread_threshold` of each other.
- **No two agree:** neither (including a security with only two vendors that disagree).

| Line | Flag | Class | Status |
|---|---|---|---|
| a | scale | chosen is odd | confirmed: a ~100x gap against two vendors that agree; the chosen price is on another basis. Never auto-corrected |
| b | scale | backed | cleared: the price we would use is corroborated; the outlier vendor is logged for the vendor owner |
| c | spread | chosen is odd | unresolved: priority is preference, not accuracy (Dataset Guide §4) |
| d | spread | backed | cleared, as b |
| e | spread or scale | no two agree | unresolved |

Population for a, b: the scale-flagged securities; c, d: the spread-flagged securities; e: both. The held set is
section 8's (`02_vendor_check.csv` rows), so 8b and section 8 always line up. A flagged security with no chosen
quote (missing from `securities`, or no quote in its master currency; none on the full data today) is **not
evaluable** on its flag's lines, so each flag's count = the affected of its lines + its not evaluable. Reported beside, in the how-detected text and
`02_price_quality.csv`: the odd vendor, the number of dates (out of those present) on which the security is spread-
or scale-flagged, and whether the chosen quote is in a flat run. The cleared lines say what would reopen them: the
backing vendor shown not to be independent of the chosen one, or a stated quote basis that contradicts it.

### 6.6 FX (`FX_RATE_VALID`)

Unit: one `fx_rates` row. Rate dates in either format.

| Line | Fail | Not evaluable | Status |
|---|---|---|---|
| FX rate repeated for a currency and date | the (currency, rate date) has more than one row | rate date unreadable or currency blank | confirmed |
| FX rate not positive or unreadable | `rate_to_usd` blank, unreadable or ≤ 0 | none | confirmed |
| FX rate moves more than the band from the previous business day | \|rate / previous rate − 1\| > `day_on_day_band` | first date of a currency; the previous Mon–Fri date has no single usable rate; this row's rate or date unusable; this row is repeated | unresolved: a band is a team assumption and a real market can move |

Every currency is in the band check, USD included (its own "not 1" line stays). "Previous business day" is the
previous Monday–Friday date, not the previous row; a gap makes the row not evaluable rather than compared across the
gap.

### 6.7 Trades (`TXN_FIELDS_VALID`, `TXN_DUPLICATE`, `TXN_CORRECTION_LINK`)

Unit: transaction rows, like the existing `TXN_FIELDS_VALID` lines (repeated IDs count per row), except the economic
duplicate line, which counts transaction_ids. **Copies that disagree** (user, 10 Nov): where the copies of one
transaction_id get different results on a line, every copy is not evaluable on that line, as the main policy
`conflicting_pairs = "not_evaluable"` treats conflicting pairs. One trade therefore never sits on both the cleared and
the unresolved lag line, and never passes because a kinder copy was picked. The correction-link line follows the
same rule.

| Line | Population | Fail | Not evaluable | Status |
|---|---|---|---|---|
| Blank or unreadable trade price | all rows | `price` blank or not a number (how-detected gives each count) | none | confirmed |
| gross_amount does not equal quantity × price | all rows | \|gross − \|quantity\| × price\| > `gross_amount_tolerance` (absolute quantity: gross carries the size, not the side, D-043) | quantity, price or gross blank or unreadable | confirmed (the row's own arithmetic fails; which field is wrong is unknown). How-detected states the overlap with the rebook line |
| Settlement later than T+2 with no agreed extension | all rows | business-day lag > limit and note ≠ the extension note | either date blank or unreadable, or settlement before trade (its own line) | unresolved |
| Settlement later than T+2 with an agreed extension | same | lag > limit and note = the extension note | same | cleared |
| Same economics under a different transaction_id | distinct transaction_ids | the ID shares account, security, trade date, type, quantity and price with another ID it is not linked to | trade date, quantity or price blank or unreadable on every copy | unresolved |
| Correction link points to itself or to another account or security | rows with a `related_transaction_id` | the link is the row's own ID, or every copy of the target has a different account or security | the target ID does not exist (the dangling CANCELLED links, already their own line), or the target's copies disagree on account or security | confirmed |

- **Business-day lag:** `numpy.busday_count(trade day, settlement day)` on a Mon–Fri week: Friday to Tuesday is 2.
- **"Linked" for duplicates:** the two IDs belong to one correction family: connected through any chain of
  `related_transaction_id` links, in either direction (a direct link and a shared target are the simplest cases).
  An ID counts if it has at least one partner outside its family. Copies of the same ID are never economic duplicates (the
  existing lines own them). All statuses take part; a repeated ID matches if any of its copies does. Quantity and
  price compare as numbers, trade date after normalisation.

### 6.8 Output `outputs/02_price_quality.csv`

One row per held security: mastered, position rows, master currency, chosen vendor and priority, chosen price and
timestamp, coverage result, fallback-only, freshness result and reason, fresh fallback available, flat-run length,
the section 8 result, the look-inside class and odd vendor, dates spread-flagged, dates scale-flagged. Column names
and order are the builder's.

### 6.9 Register lines (appended after the timeliness lines, in this order)

| # | Line (wording is the builder's) | Rule | Stage | Unit | Id kind | Status |
|---|---|---|---|---|---|---|
| 1 | Holding with no eligible quote on the snapshot date | `PRC_QUOTE_ELIGIBLE` | pricing | position rows | security_id | confirmed |
| 2 | Holding priced only by a fallback vendor on the snapshot date | `PRC_QUOTE_ELIGIBLE` | pricing | position rows | security_id | confirmed |
| 3 | Chosen quote stamped after the NAV cutoff | `PRC_QUOTE_ELIGIBLE` | pricing | securities | security_id | unresolved (the cutoff is our reading) |
| 4–8 | The five look-inside lines a–e (6.5) | `PRC_VENDOR_DISPERSION` | pricing | securities | security_id | as 6.5 |
| 9–11 | The three FX lines (6.6) | `FX_RATE_VALID` | pricing | rate rows | currency | as 6.6 |
| 12–17 | The six trade lines (6.7) | as 6.7 | trade capture | rows / transaction_ids | transaction_id | as 6.7 |

Coverage line 1 states its overlap with "Held security with no price at all"; line 2 with "Preferred vendor has no
valid price on a date".

### 6.10 Placement

- New section **8b. Price data quality** after section 8 (coverage, freshness, look-inside, `02_price_quality.csv`).
- New section **9c. Trade and FX field checks** after 9b.
- Sections 10–12 keep their numbers. Section 8's closing note ("Proposed, not run for Check-in 2 ...") is updated to
  point at 8b; section 8's code and output do not change.

## 7. What the tests must show

**Fixtures:** the default fixture (`tests/fixtures/small`) keeps its current results on every existing line; new
expectations are computed by hand from its files. The edge fixture (built in `tests/fixture_test.sh`) adds these
cases, each on its own security, currency or trade:

| Area | Case | Expected |
|---|---|---|
| coverage | held security quoted only on an earlier date | coverage fail |
| coverage | priority vendor's snapshot price blank, second vendor fine | fallback-only; coverage pass |
| coverage | security missing from `securities` with a snapshot quote | coverage not evaluable |
| freshness | chosen timestamp 18:00:00 exactly | fresh (boundary look-alike) |
| freshness | chosen timestamp 18:01, second vendor at 17:00 | stale; fresh fallback available |
| freshness | chosen timestamp on the next day | stale |
| freshness | chosen timestamp blank | not evaluable |
| freshness | chosen price identical from Friday 3 July to the snapshot (six business dates, across a weekend) | flat run of 6; still fresh |
| freshness | chosen price identical on 7, 9 and 10 July, no quote on 8 July | run of 2: a missing business date breaks the run |
| look-inside | priority vendor at 1/100 of two agreeing vendors | scale, chosen is odd (confirmed) |
| look-inside | third vendor at 1/100 | scale, backed (cleared) |
| look-inside | priority vendor 2% off two agreeing vendors | spread, chosen is odd (unresolved) |
| look-inside | three vendors each 2% apart | no two agree (unresolved) |
| FX | a currency and date with two rows | repeated; both not evaluable for the band |
| FX | rate 0, rate `abc` | not positive or unreadable |
| FX | move of exactly 5% | not flagged (boundary) |
| FX | move of 5.1% from Friday to Monday | flagged (Friday is the previous business day) |
| FX | rate date written `DD/MM/YYYY` | parsed and compared |
| trades | blank price | blank-price line; amount not evaluable |
| trades | gross off by exactly 0.01; by 0.02 | pass (boundary); fail |
| trades | negative quantity with gross = \|q\| × price | amount pass |
| trades | trade Friday, settles Tuesday | T+2: pass (calendar days would say 4) |
| trades | trade Friday, settles Wednesday, no note; same with the note | unresolved line; cleared line |
| trades | settlement written `DD/MM/YYYY` | parsed |
| trades | two unlinked IDs, same economics | both in the economic-duplicate line |
| trades | a rebook linked to its cancelled original, same economics | not flagged (look-alike) |
| trades | link to an ID on another account | correction-link fail |
| trades | one ID, two copies: one with the extension note, one without, both T+3 | both rows not evaluable on both lag lines |

**Identities on every run:** eligible + not evaluable = population on every new line; coverage pass + fail + not
evaluable = position rows on the snapshot; for each flag, the affected of its look-inside lines plus their not
evaluable = that flag's count in `02_vendor_check.csv`; lines 14 and 15 never share a member.

**Shuffle and threshold** (`tests/robustness_test.sh`):
- Shuffled rows: `02_price_quality.csv` and the register are identical.
- The threshold run also loosens `day_on_day_band` (0.05 → 0.10): only the FX band line moves, and only down. The
  existing `spread_threshold` change may move lines 4–8 and the price-quality file; the reconciliation stays
  unchanged, as today.

**Full data:**
- The new register equals the old one plus the new lines; every old line byte-identical and in place.
- `02_vendor_check.csv` byte-identical.
- An independent DuckDB recount on the raw files agrees with the notebook for: blank price, coverage fail, chosen
  quotes after 18:00, and lag above T+2 without the note.

## 8. Calls I made (the user should check these)

1. **Freshness status unresolved:** the 18:00 NAV cutoff is our reading of the pipeline cutoff, not a stated NAV
   strike time.
2. **Flat runs and fresh-fallback counts are reported beside freshness**, not as lines (D-041 says "reported
   beside").
3. **"Backed" uses the existing `spread_threshold`** between the chosen quote and one other vendor; no new
   threshold.
4. **FX band includes USD**; "previous business day" is the previous Mon–Fri date, and a gap makes the row not
   evaluable.
5. **Economic duplicates:** all statuses compared; "linked" = direct link either way or a shared target; numbers
   compared as numbers; unit transaction_ids; a blank quantity or price is not evaluable, never "the same".
6. **Correction link:** only the self-link and same-account-and-security parts; a missing target is not evaluable
   here (it already has its own line for CANCELLED rows).
7. **Amount check uses \|quantity\|**, as the existing negative-quantity line does (D-043).
8. **Extension note value in config**, so a judge can see it is a policy choice.
9. **"Linked" = one correction family** (any chain of links), not only a direct link or shared target (builder
   check).
10. **Look-inside lines use section 8's held set**; a flagged security with no chosen quote is not evaluable there
    (builder check).
11. **Fallback-only population = coverage passes only** (builder check).

## 9. Left to the builder

- Line wording, how-detected text and plain sentences (must pass `tests/test_plain_language.py`).
- Column names and order in `02_price_quality.csv`.
- Config key names.
- How the cells are split; the edge-fixture layout.

## 10. Decisions taken without asking (Phase B)

*Filled during the build: question, options, choice.*

Task 1 (coverage, freshness, flat runs):

- **Which securities get a chosen quote?** Only those held on the snapshot / all of section 8's held set. Chose
  **section 8's held set**, so the look-inside (Task 2) has a chosen quote for every flagged security. Coverage and
  freshness still judge only securities held on the snapshot; the others show "not held on the snapshot" and a blank
  freshness.
- **Two eligible quotes equal on priority, vendor and price?** Keep file order / add a value tie-break. Chose
  **`price_timestamp` as a last sort key**, so the pick never depends on row order.
- **Freshness reason when a stamp is both on another day and after the cutoff?** Chose **"stamped on another day"**
  first: it is the stronger fact. Either way the quote fails.
- **Flat run across currencies?** Any valid quote with the same number / the same number in the same currency. Chose
  **same currency**: 10.00 USD and 10.00 EUR are not the same price.

Task 2 (inside the spread and scale flags):

- **Which securities get `dates_spread_flagged` / `dates_scale_flagged`?** Only the flagged ones / every held security.
  Chose **every held security** in section 8's set: a security that passes on the snapshot but is flagged on other dates
  is worth seeing, and the count costs one groupby either way.
- **Odd vendor for a flagged security with no chosen quote?** Blank / from the snapshot's valid quotes. Chose **from
  section 8's valid snapshot quotes** (any currency), as the brief expects for FXSEC17: it is the vendor the flag is
  about, whether or not a quote was chosen.
- **Round the agreement ratio to `float_decimals`?** The shared context lists only the FX move, the amount difference
  and the odd-vendor distances. Chose **no rounding**, as section 8 compares its spread unrounded; `agrees` is the
  brief's formula as written.
- **Two quotes from one vendor on the snapshot?** "Another vendor" excludes every quote of the chosen vendor, and "two
  other vendors agree" needs two different vendor names, neither the chosen one.
- **What do the how-detected medians cover?** The line's affected securities: the median of their dates flagged (line
  8 adds scale and spread dates, which never fall on the same date), next to the median number of readable price dates
  with a valid quote. That denominator is computed in the notebook (`DATES_QUOTED`), not written to
  `02_price_quality.csv`, whose columns are fixed.

Task 3 (FX):

- **Previous business day for a weekend rate date?** The spec's rule is Monday to Friday. Chose
  `busday_offset(day, -1, roll='forward')`, so a Saturday row looks back to Friday; none exists in the data.
- **Which rows are "rate unusable" for the band?** Blank, unreadable, zero or negative (the same test as line 10). A
  repeated row is never judged, and neither is a row whose previous day has no row, two or more rows, or an
  unusable rate.
- **Does `fx_check` carry helper columns?** Kept to the six fixed columns; the cell and the register recompute
  "date and currency readable" from `rate_day` and `currency`.
- **Line 9 not evaluable?** Rows with an unreadable date or a blank currency; lines 10 and 11 cover all rows.

Task 4 (trade fields):

- **Lag-3 expectation in the brief (38 eligible) or 40?** Under T+3 both copies of FXQ17 (lag 3) pass on each lag line,
  so they agree and the copy rule does not apply. Chose **40** (41 minus FXT07 with no trade date); the brief's 38 was
  written as if FXQ17 stayed not evaluable. Test changed to match.
- **Settlement before trade?** Not evaluable on the lag lines (spec: its own line), lag value kept in `lag_business_days`.
- **Blank transaction_id and the copy rule?** Blank IDs name no trade, so their rows are never grouped as copies.
- **Price line?** Fails on blank or unreadable only; a zero or negative price that reads is not a fail here.
- **Price not evaluable?** Only through copies: the price line has no not-evaluable case of its own, but when the copies
  of one transaction_id disagree (one blank, one priced) every copy is not evaluable, as on every row-based trade line
  (§6.7). The quality fixture's second FXQ20 copy has a blank price to show it.

Task 5 (economic duplicates and correction links):

- **Does a link target that does not exist join a family?** Only existing IDs / every link target. Chose **every link
  target**: two trades that both claim to correct the same missing ID are one correction family ("a shared target"),
  so they are never economic duplicates of each other. `family` therefore also labels missing targets.
- **Target's copies disagree on account or security and none of them matches the row?** Not evaluable / fail. Chose
  **fail**: whichever copy is right, the link points to another account or security. Not evaluable is kept for the case
  where one of the disagreeing copies matches (FXQ21).
- **Blank account_id or security_id on the linked row or on a target copy?** Chose **not evaluable**: a blank is
  unknown, not different. The full data has none; the economic duplicate check likewise needs all six fields present.
- **Copy rule on the link line when one copy of an ID has a link and another does not?** Chose to run
  `apply_copy_rule` **over the linked rows only**: the unlinked copy stays blank (outside the line's population), so the
  population stays "rows with a related_transaction_id".
- **Economic duplicates when account, security or type is blank?** Compare anyway / not evaluable. Chose **not
  evaluable**: the check needs account, security and type present as well as trade date, quantity and price (all six
  fields). A blank is unknown, not "the same".
- **Link target with a blank copy?** A target with any copy whose account or security is blank makes the link **not
  evaluable**, checked before "no copy matches", so a blank can never turn into a fail.
- **Link rows with a blank transaction_id?** Chose **outside the link population**: a row with no ID names no trade, so
  it cannot be copied, matched or counted by ID (the same reasoning as the copy rule in Task 4).
- **Speed on the full data:** `Series.isin` against the 1.4M IDs (pandas' sort-based path above a million values) took
  about 4 s per call; `map` and `reindex` are used instead. The section 9c cell takes about 6 s on the full
  transactions (timed on its own, outside the notebook).

## 11. Follow-on

After approval: superpowers:writing-plans writes the plan. After the plan is approved: `git switch -c
quality-checks`, then the build (TDD), review, and CLAUDE.md "Before you finish a task" in full: D-067 onward in
DECISIONS.md; RULES.md §3 and §6 updated (rules coded, coverage and freshness moved from "proposed" to run, outputs
and lines cited); the config keys; STATUS.md; plain wording; a session summary in `docs/superpowers/summaries/`.
