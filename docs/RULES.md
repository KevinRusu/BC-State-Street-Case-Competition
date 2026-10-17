# Rules: the detailed rules under our 7 checks

Last updated: 2026-10-17

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
| `TXN_DUPLICATE` | transaction_id unique; no second record with the same account + security + trade_date + type + quantity + price unless linked through related_transaction_id | hold | Exact duplicates rejected, economic duplicates held for review |
| `TXN_FIELDS_VALID` | Required fields not null; trade_date and settlement_date parse (ISO or DD/MM/YYYY, logged); settlement_date ≥ trade_date; lag ≤ 2 business days unless settlement_note = EXTENDED_SETTLEMENT_AGREED; quantity > 0; \|gross_amount − quantity × price\| ≤ 0.01 | reject | T+2 limit and amount tolerance are team assumptions. Lag is counted in BUSINESS days (calendar days flag every Friday trade). Data: T+1 913,711 · T+2 490,054 · T+5 to T+7 2,957 (845 with agreed-extension note) · 1,124 settle before trade · 1,687 unparseable. US standard is T+1 since 28 May 2024 (SEC Rule 15c6-1): split the limit by market / asset class at Check-in 2 |
| `TXN_CORRECTION_LINK` | related_transaction_id points to an existing transaction, not to itself, with the same account and security; CANCELLED/REVERSED/BOOKED combinations follow the stated rule; no double offset | hold | REVERSED semantics unresolved until the data owner tells us what REVERSED means |
| `TXN_ONE_REVERSAL_PER_ORIGINAL` | At most one REVERSED row points to each BOOKED original | hold | Added 16 Oct (Check-in 2 register): 1,402 REVERSED rows, two per original (701 originals) |
| `TXN_PIPELINE_ONE_TO_ONE` | Every transaction_id has exactly one pipeline_events record and every pipeline record has one transaction | hold | Added 16 Oct (Check-in 2 register): 2,105 IDs repeated in both tables (4,210 pipeline rows) |
| `TXN_TIMESTAMPS_IN_ORDER` | event ≤ received ≤ booked ≤ published; all timestamps present and parseable; received − event within the feed's latency limit (per source_system) | flag | Missing / out-of-order timestamps reported separately, never as on time |
| `TXN_AFTER_CUTOFF` | booked_timestamp and published_timestamp ≤ cutoff_timestamp; late trades carried to the next cycle with a flag | flag |  |

## 4. Corporate action check

*Where: Transactions · Owner: Corporate actions lead*

| Suggested id | What it tests | If it fails | Notes |
|---|---|---|---|
| `CA_TERMS_COMPLETE` | Before ex_date: action_type supported; required terms present AND only the terms the type needs (e.g. cash_rate only where cash is paid); target_security_id present AND mastered for MERGER / SPINOFF; date order valid for the type (definition still to agree with the data owner) | hold | Event quarantined until terms and target are complete. From the data: all 200 events carry a cash_rate (even splits) and 87 of 200 have ex_date after effective_date. Whether that is wrong depends on what effective_date means per type, so we must agree a definition first |
| `CA_ALL_HOLDERS_ADJUSTED` | After effective_date: every account holding the source security on ex_date shows the adjustment (needs a per-account posting log, which we do not have) | flag | Not testable yet: no posting log |

## 5. Position check

*Where: Positions · Owner: Reconciliation lead*

| Suggested id | What it tests | If it fails | Notes |
|---|---|---|---|
| `POS_REBUILD_MATCHES` | Reported positions.quantity = signed sum of BOOKED trades (BUY +, SELL −, zero opening); positions.transaction_count = contributing trades; trade-date and settlement-date variants | flag |  |
| `POS_CUSTODIAN_BREAK` | Full outer join positions ↔ comparison_positions on account + security + as_of_date; differing, one-sided and unevaluable keys reported separately; breaks aged | flag |  |
| `POS_KEYS_MASTERED` | Every positions.account_id exists in accounts and every positions.security_id exists in securities | flag | Added 16 Oct (Check-in 2 register): 699 position rows on 195 unknown accounts; 1,118 on 15 unmastered securities (all spin-off targets) |

## 6. Price check

*Where: Positions · Owner: Pricing lead*

| Suggested id | What it tests | If it fails | Notes |
|---|---|---|---|
| `PRC_QUOTE_ELIGIBLE` | Every held security has a quote for the valuation date with price > 0, price currency = security currency, price_timestamp on price_date and before NAV cutoff; else fall back to next vendor_priority | correct | Correct = select next eligible vendor, logged |
| `PRC_VENDOR_DISPERSION` | (max − min) / mean across vendor quotes ≤ 0.5%; a ~100× ratio flags percent-of-par vs per-unit | flag | 0.5% from brief App. A (illustrative) |
| `FX_RATE_VALID` | Exactly one rate per currency per date; rate_to_usd > 0; USD = 1.000000; day-on-day move within band | hold | Added after journey found USD rate ≠ 1. Confirmed in the data: USD rate_to_usd ≠ 1 on 30 of 30 days (range 0.990 to 1.010) |
| `FX_RATE_COVERAGE` | Every currency used in prices has a rate in fx_rates for the price date | hold | Added 16 Oct (Check-in 2 register): currency XYZ on 1,080 price rows has no rate |

**Proposed, not run yet: coverage and freshness.** Both are parts of `PRC_QUOTE_ELIGIBLE`. Rule and denominator are
fixed here before running (D-041 in `docs/DECISIONS.md`); results go in the register once run.

| | Coverage | Freshness |
|---|---|---|
| Unit | One `positions` row on the snapshot date (`[snapshot] as_of_date`) | The quote chosen for one held security on the snapshot date |
| Denominator (eligible) | Every such row, including those on a security missing from `securities` | Chosen quotes with a readable `price_timestamp` |
| Pass | At least one quote for the security on the snapshot date with price > 0 and price currency = security currency; priority vendor first, then the next `vendor_priority` | `price_timestamp` falls on `price_date`, at or before the NAV cutoff time |
| Fail | No eligible quote from any vendor. A holding with no quote at all is a fail, not "not evaluable": the absence itself is the evidence | Timestamp after the cutoff or on a later day, or a quote from an earlier `price_date` |
| Not evaluable (reported apart) | A quote exists but cannot be judged: security missing from `securities` (no currency to compare) or an unreadable `price_date` | Missing or unreadable `price_timestamp`; never counted as fresh |
| Reported beside it | Rows priced only by a fallback vendor | Flat runs (same price on consecutive days): a look-alike, not stale by itself |
| Input still needed | none | The NAV cutoff time: not in the data. Goes in `config/reconciliation.toml` `[prices]` before the check runs, with the flat-run length |

## 7. NAV check

*Where: NAV and ledger · Owner: Fund accounting lead*

| Suggested id | What it tests | If it fails | Notes |
|---|---|---|---|
| `NAV_ARITHMETIC` | fund + share_class + as_of_date unique; shares_outstanding > 0; \|net_assets ÷ shares_outstanding − nav_per_share\| ≤ 0.000001 | hold | Do not publish NAV until it passes |
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