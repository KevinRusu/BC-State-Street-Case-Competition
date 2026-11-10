# Rules: the detailed rules under our 7 checks

Last updated: 2026-11-10 (quality checks, D-067)

*Built 12 Oct 2026 from the old spine workbook (`Spine_Checkin1_v0.3.xlsx`, in git history); rule gaps added 16 Oct (D-036 in `docs/DECISIONS.md`). Thresholds live in `config/*.toml`; which rules have run, and what they found, is in `docs/FINDINGS.md`.*

## How to read this file

- A **check** (or control) is one test at one handoff, with one owner. We explain 7 of them on the slides.
- A **rule** is one exact condition the code tests. Each check has several rules underneath. Faculty see the checks; the code runs the rules.
- **If it fails** says what happens to the record: **reject** (refuse it), **hold** (stop it until someone fixes it), **flag** (let it through but report it), **correct** (fix it automatically, and log the fix).
- The **suggested id** is the rule's name in the code, the config and the findings register.
- Thresholds marked as assumptions are our choices, not State Street numbers. Judges will change them live, so they must live in the config file, not in the code.

## 1. Account check

*Where: Accounts to Transactions · Owner: Account onboarding lead*

| Suggested id | What it tests | If it fails | Notes |
|---|---|---|---|
| `ACC_NOT_OPEN_ON_TRADE_DATE` | account_id exists in accounts, status = OPEN, open_date ≤ trade_date and (close_date blank or trade_date ≤ close_date) | hold | Hold the trade; route to onboarding |
| `ACC_REQUIRED_FIELDS` | Required fields populated and valid before an account can trade: fund_id, share_class, base_currency (ISO 4217), domicile (ISO 3166), custodian, open_date; close_date ≥ open_date; status consistent with close_date | reject | Account not activated until it passes |

## 2. Security check

*Where: Securities to Transactions · Owner: Security master lead*

| Suggested id | What it tests | If it fails | Notes |
|---|---|---|---|
| `SEC_IDENTIFIER_VALID` | security_id unique; CUSIP/ISIN well-formed and not shared by two security_ids; ISIN embeds the CUSIP; currency is ISO 4217; BOND rows have coupon, maturity and par | reject | Runs on every new or changed security record |
| `TXN_SECURITY_NOT_MASTERED` | Every transaction security_id exists in securities; trade cusip = master cusip; trade currency = security currency | hold | Hold the trade; ask security master to create or fix the record |

## 3. Trade check

*Where: Transactions · Owner: Trade operations lead*

| Suggested id | What it tests | If it fails | Notes |
|---|---|---|---|
| `TXN_DUPLICATE` | transaction_id unique; no second record with the same account + security + trade_date + type + quantity + price unless linked through related_transaction_id | hold | Exact duplicates rejected, economic duplicates held for review. Economic duplicates coded 10 Nov (D-067, section 9c): same account, security, trade date, type, quantity and price under another transaction_id that is not in the same correction family; all six fields must be present. Count: `outputs/02_defect_register.csv`, line "Same economics under a different transaction_id" (unresolved: a split child order is a real look-alike; an order or message ID would settle it) |
| `TXN_FIELDS_VALID` | Required fields not null; trade_date and settlement_date parse (ISO or DD/MM/YYYY, logged); settlement_date ≥ trade_date; lag ≤ 2 business days unless settlement_note = EXTENDED_SETTLEMENT_AGREED; quantity > 0; \|gross_amount − quantity × price\| ≤ `gross_amount_tolerance` (`config/reconciliation.toml`) | reject | T+2 limit and amount tolerance are team assumptions. Lag is counted in BUSINESS days (calendar days flag every Friday trade). Counts: `outputs/02_defect_register.csv` (lines "Blank settlement_date", "settlement_date before trade_date", "trade_date written as DD/MM/YYYY", "Blank trade quantity", "Negative trade quantity"). Coded 10 Nov (D-067, notebook section 9c): the lag limit and the extension note are `[tolerances] settlement_lag_limit_business_days` and `settlement_extension_note`; the amount check uses `|quantity|` (D-043) and `gross_amount_tolerance`. Where the copies of one transaction_id get different results, every copy is not evaluable on that line. Counts: `outputs/02_defect_register.csv`, lines "Blank or unreadable trade price", "gross_amount does not equal quantity x price", "Settlement later than T+2 with no agreed extension" (unresolved: T+2 is a team assumption) and "Settlement later than T+2 with an agreed extension" (cleared; named T+n from the config). US standard is T+1 since 28 May 2024 (SEC Rule 15c6-1): split the limit by market / asset class at Check-in 2 |
| `TXN_NEGATIVE_SIDE_EVIDENCE` | For a row failing quantity > 0: look for other records of the same trade (a row with the same transaction_id and another quantity; rows whose related_transaction_id points at it; the row it points at) and record each partner's type and quantity sign. Same type with a positive quantity supports "wrong sign"; the opposite type supports "wrong type" | hold | Added 17 Oct (D-043). gross_amount gives a trade's size, not its side, so it can't choose between the two readings. Correct a row only when a partner or the source's order side or cash direction shows the side; never take the absolute value. No threshold: partners match on exact IDs. Output: `outputs/02_negative_partners.csv` |
| `TXN_BLANK_QUANTITY_EVIDENCE` | For a row with a blank quantity: is the size still in the row? `gross_amount / price` within `derived_units_tolerance` of a whole number, price > 0 and no related_transaction_id. Side from transaction_type | hold | Added 21 Oct (D-047). Fails `TXN_FIELDS_VALID` either way; this rule says whether a correction can be proposed. The derived size is a proposal for the source to confirm, never booked silently; a linked row is held (a rebook can carry the cancelled gross_amount). Backtest on rows that have a quantity: `outputs/02_blank_quantity.csv` |
| `TXN_CORRECTION_LINK` | related_transaction_id points to an existing transaction, not to itself, with the same account and security; CANCELLED/REVERSED/BOOKED combinations follow the stated rule; no double offset | hold | REVERSED semantics unresolved until the data owner tells us what REVERSED means. Self-link and same-account-and-security parts coded 10 Nov (D-067, section 9c); a missing target is not evaluable here (the dangling CANCELLED links have their own line). Count: `outputs/02_defect_register.csv`, line "Correction link points to itself or to another account or security". The CANCELLED/REVERSED/BOOKED combinations and the double offset are covered by other lines |
| `TXN_ONE_REVERSAL_PER_ORIGINAL` | At most one REVERSED row points to each BOOKED original | hold | Added 16 Oct (Check-in 2 register). Counts: `outputs/02_defect_register.csv`, line "More than one REVERSED row per original" |
| `TXN_PIPELINE_ONE_TO_ONE` | Every transaction_id has exactly one pipeline_events record and every pipeline record has one transaction | hold | Added 16 Oct (Check-in 2 register). Counts: `outputs/02_defect_register.csv`, line "Repeated transaction_id in the pipeline" |
| `TXN_TIMESTAMPS_IN_ORDER` | event ≤ received ≤ booked ≤ published; all timestamps present and parseable; the daily median of received − event (feed latency) and of booked − received (processing latency) per feed within that feed's limit (`[timeliness] feed_latency_limit_minutes`, `processing_latency_limit_minutes` in `config/reconciliation.toml`; brief App. B judges the daily median by feed) | flag | Coded 10 Nov (D-065, notebook section 9b). Missing, unparseable and out-of-order timestamps reported separately, never as on time; a negative interval is out of order, not zero latency. Measures by feed and day: `outputs/02_timeliness.csv`. Counts: `outputs/02_defect_register.csv`, lines "Pipeline timestamp missing", "Pipeline timestamp unparseable", "Pipeline timestamps out of order", "Feed latency: daily median above the feed's limit" and "Processing latency: daily median above the feed's limit" (unresolved: the limits are team assumptions) |
| `TXN_AFTER_CUTOFF` | booked_timestamp and published_timestamp ≤ cutoff_timestamp; late trades carried to the next cycle with a flag | flag | Coded 10 Nov (D-065, notebook section 9b). Booking and publication judged separately, never merged; exactly at the cutoff is on time. Not evaluable: the step or the cutoff missing or unreadable, or the step stamped before an earlier one. One record per transaction_id (a repeated ID uses its latest time). By feed and day: `outputs/02_timeliness.csv`; counts: `outputs/02_defect_register.csv`, lines "Booked after cutoff" and "Published after cutoff" |

## 4. Corporate action check

*Where: Transactions · Owner: Corporate actions lead*

| Suggested id | What it tests | If it fails | Notes |
|---|---|---|---|
| `CA_TERMS_COMPLETE` | Before ex_date: action_type supported; required terms present AND only the terms the type needs (e.g. cash_rate only where cash is paid); target_security_id present AND mastered for MERGER / SPINOFF; date order valid for the type (definition still to agree with the data owner) | hold | Event quarantined until terms and target are complete. Extra terms and an ex_date after effective_date are flagged unresolved, not held, until the definitions are agreed (D-016). From the data (`outputs/02_defect_register.csv`, lines "ratio or cash_rate filled for an event type that does not use it" and "ex_date after effective_date"): cash_rate appears even on splits, and many events have ex_date after effective_date. Whether that is wrong depends on what effective_date means per type, so we must agree a definition first |
| `CA_ALL_HOLDERS_ADJUSTED` | After effective_date: every account holding the source security on ex_date shows the adjustment (needs a per-account posting log, which we do not have) | flag | Not testable yet: no posting log |

## 5. Position check

*Where: Positions · Owner: Reconciliation lead*

| Suggested id | What it tests | If it fails | Notes |
|---|---|---|---|
| `POS_REBUILD_MATCHES` | Reported positions.quantity = signed sum of BOOKED trades (BUY +, SELL −, zero opening); positions.transaction_count = contributing trades; trade-date and settlement-date variants | flag |  |
| `POS_CUSTODIAN_BREAK` | Full outer join positions ↔ comparison_positions on account + security + as_of_date; differing, one-sided and unevaluable keys reported separately; breaks aged | flag |  |
| `POS_KEYS_MASTERED` | Every positions.account_id exists in accounts and every positions.security_id exists in securities | flag | Added 16 Oct (Check-in 2 register). Counts: `outputs/02_defect_register.csv`, lines "Position on an account_id missing from accounts" and "Position on a security_id missing from securities" (the unmastered securities are spin-off targets) |

## 6. Price check

*Where: Positions · Owner: Pricing lead*

| Suggested id | What it tests | If it fails | Notes |
|---|---|---|---|
| `PRC_QUOTE_ELIGIBLE` | Every held security has a quote for the valuation date with price > 0, price currency = security currency, price_timestamp on price_date and before NAV cutoff; else fall back to next vendor_priority | correct | Correct = select next eligible vendor, logged. Coverage and freshness run 10 Nov (D-067, notebook section 8b); table below. Counts: `outputs/02_defect_register.csv`, lines "Holding with no eligible quote on the snapshot date", "Holding priced only by a fallback vendor on the snapshot date" and "Chosen quote stamped after the NAV cutoff" (unresolved: the cutoff is our reading of the pipeline cutoff); per security: `outputs/02_price_quality.csv` |
| `PRC_VENDOR_DISPERSION` | (max − min) / mean across vendor quotes ≤ `spread_threshold`; a ~100× ratio (`scale_ratio_low` to `scale_ratio_high`) flags percent-of-par vs per-unit | flag | Thresholds in `config/reconciliation.toml` [prices]; the spread comes from brief App. A (illustrative). Look inside the flags run 10 Nov (D-067, section 8b): for each flagged security, whether another vendor backs the chosen quote. Counts: `outputs/02_defect_register.csv`, lines "Scale flag: ..." and "Spread flag: ..." (chosen quote the odd one out, or backed by another vendor) and "Spread or scale flag: no two vendors agree"; odd vendor and dates flagged: `outputs/02_price_quality.csv` |
| `FX_RATE_VALID` | Exactly one rate per currency per date; rate_to_usd > 0; USD = 1.000000; day-on-day move within band | hold | Added after journey found USD rate ≠ 1. Confirmed in the data: `outputs/02_defect_register.csv`, line "USD rate to USD is not 1". Coded 10 Nov (D-067, notebook section 9c): the band is `[fx] day_on_day_band`, compared with the previous Monday-Friday date, and a gap makes the row not evaluable. Counts: lines "FX rate repeated for a currency and date", "FX rate not positive or unreadable" and "FX rate moves more than the band from the previous business day" (unresolved: a band is a team assumption) |
| `FX_RATE_COVERAGE` | Every currency used in prices has a rate in fx_rates for the price date | hold | Added 16 Oct (Check-in 2 register). Counts: `outputs/02_defect_register.csv`, line "Price with no FX rate for its currency on the price date" |

**Run 10 Nov (D-067): coverage and freshness.** Both are parts of `PRC_QUOTE_ELIGIBLE`. Rule and denominator were
fixed before running (D-041 in `docs/DECISIONS.md`); results are in the register lines and `outputs/02_price_quality.csv` named above.

| | Coverage | Freshness |
|---|---|---|
| Unit | One `positions` row on the snapshot date (`[snapshot] as_of_date`) | The quote chosen for one held security on the snapshot date |
| Denominator (eligible) | Every such row, including those on a security missing from `securities` | Chosen quotes with a readable `price_timestamp` |
| Pass | At least one quote for the security on the snapshot date with price > 0 and price currency = security currency; priority vendor first, then the next `vendor_priority` | `price_timestamp` falls on `price_date`, at or before the NAV cutoff time |
| Fail | No eligible quote from any vendor. A holding with no quote at all is a fail, not "not evaluable": the absence itself is the evidence | Timestamp after the cutoff or on a later day, or a quote from an earlier `price_date` |
| Not evaluable (reported apart) | A quote exists but cannot be judged: security missing from `securities` (no currency to compare) or an unreadable `price_date` | Missing or unreadable `price_timestamp`; never counted as fresh |
| Reported beside it | Rows priced only by a fallback vendor | Flat runs (same price on consecutive days): a look-alike, not stale by itself |
| Input still needed | none (done) | The NAV cutoff time is `[prices] nav_cutoff_time` in `config/reconciliation.toml`, set before the check ran, with the flat-run length `[prices] flat_run_dates`. Exactly at the cutoff is on time |

## 7. NAV check

*Where: NAV and ledger · Owner: Fund accounting lead*

| Suggested id | What it tests | If it fails | Notes |
|---|---|---|---|
| `NAV_ARITHMETIC` | fund + share_class + as_of_date unique; shares_outstanding > 0; \|net_assets ÷ shares_outstanding − nav_per_share\| ≤ `[nav] tolerance` (`config/reconciliation.toml`) | hold | Do not publish NAV until it passes |
| `NAV_SHARE_CLASS_MAPPING` | Every OPEN account's fund_id + share_class exists in ledger_nav; every ledger_nav fund + class has at least one account | hold |  |
| `NAV_OPEN_ISSUES_BEFORE_RELEASE` | No unresolved break, price flag or quarantined corporate action above materiality on positions feeding the fund | hold | Materiality threshold TBD (external reference: CSSF 24/856) |

**Dropped:** the old "PM position view stamp" rule. We have no data on what the portfolio manager sees, so we cannot test it.

## Missing data: how each KPI treats records it cannot test

The general rule: a record we cannot test is **reported separately and never raises a score**. Otherwise a broken feed (where nothing can be tested) would look perfect.

| KPI | Treatment |
|---|---|
| Trades with a valid account and security | Unknown account or unreadable trade date reported separately; a blank security counts as a fail |
| Trades booked before cutoff | Missing, unreadable or out-of-order timestamps reported separately, never counted as on time |
| Duplicate trade rate | Rows with blank key fields reported separately |
| Positions matching the custodian | A holding on only one side is reported separately, never counted as agreed; untestable keys reported separately |
| Holdings with a fresh, agreed price | No quote at all reported separately; securities with quotes from a single vendor reported separately (nothing to compare) |
| NAV rows that add up | Missing or zero inputs reported separately |
| Funds released with no serious open issue | Unpriced holdings disclosed; a fund is left out if less than 95% of its holdings can be valued |
| Overall score | Untestable records lower the coverage figure; they never raise the score |

## Things that look wrong but may be fine (look-alikes)

Every rule needs a way to clear these, or we report false alarms:

- **Short positions:** a negative holding can be a real short sale, not an error.
- **Zero-opening rebuild:** we rebuild positions from zero because we have no opening balances, so a rebuild can dip below zero during the month and still end correct.
- **Agreed late settlement:** a trade settling after T+2 is fine if `settlement_note = EXTENDED_SETTLEMENT_AGREED`.
- **Flat prices:** a price that does not move for days can be a quiet security, not a stale feed.
- **Rebooked trades:** a BOOKED trade linked to a CANCELLED original is a correction, not a duplicate.
- **REVERSED is ambiguous:** it can mean "this trade is no longer active" or "this record offsets another one". We compute both readings and compare them until the data owner tells us which is right.

## Evidence status for every finding

- **Confirmed:** the data proves it (matching IDs, a failed test).
- **Unresolved:** it fails a test, but we lack the data to prove it is a real error (for example a suspected resend without a source message ID).
- **Cleared:** it looked wrong, but it is a look-alike from the list above.

## Materiality reference for the NAV check

We have no State Street threshold. As an outside reference only: Luxembourg CSSF Circular 24/856 uses 0.2%, 0.5% and 1% NAV error thresholds, depending on fund type.

## What every rule should state

A proposed shape for when the rules move out of the notebook into code (D-012). Today the thresholds sit in `config/reconciliation.toml` and the rule ids in the register.

```yaml
- id: ACC_NOT_OPEN_ON_TRADE_DATE      # the rule's name
  check: Account check                # which of the 7 checks it belongs to
  stage: transactions                 # which table it runs on
  test: trade_date outside [open_date, close_date] or account status != OPEN
  owner: Account onboarding lead      # who fixes it
  on_fail: hold                       # reject / hold / flag / correct
  threshold: 0                        # how many failures we accept (0 = none)
```

Line by line: `id` is a unique name so we can count results per rule; `check` and `owner` tie the rule back to the slides; `test` is the condition in plain words (the code turns it into SQL); `on_fail` is the response; `threshold` is the number judges might change live, which is why it sits in the config and not inside the code.