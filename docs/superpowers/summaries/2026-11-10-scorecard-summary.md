# Session summary: scorecard and indicators (10 Nov 2026)

*For teammates who were not in the session. Design: [spec](../specs/2026-11-10-scorecard-design.md) (user decisions
§5, building decisions §8). Build plan: [plan](../plans/2026-11-10-scorecard.md). Decision: D-069 in
[DECISIONS.md](../../DECISIONS.md). Rules: [RULES.md](../../RULES.md) §1, §2 and "Scores". Numbers:
[FINDINGS.md](../../FINDINGS.md) (generated scorecard section) and the `outputs/` files named below. Branch `scorecard`,
not yet committed.*

## What the session set out to do

[STATUS.md](../../STATUS.md) "Next: toward Check-in 3", step 2, from brief §5 "Scorecard and indicators": scores at
account, domain and platform level with formulas, weights, aggregation rules and a sensitivity check, coverage beside
every score, and at least six indicators (three leading), each marked computed, simulated or proposed. The user also
chose to code the two rules behind KPI 1 (a narrow exception to D-066), so the Check-in 1 KPIs get real values.

Out of scope: the urgency ranking of defects (waits for the executive view), dashboard pages, new checks beyond KPI 1's
two rules, a predictive model.

**How it was run:** an interactive design (the user answered every design question as multiple choice, plus three
after the builder check and one on KPI 1), then an autonomous build: ten tasks, each test-first with a fresh builder
and a fresh reviewer (Opus on the risky tasks, Sonnet on the mechanical ones, by the user's choice), a whole-branch
review on Opus, one fix wave and its re-review, and the full verification suite.

## What it built (where to look)

- **Two rules behind KPI 1** (notebook section 9c): `TXN_SECURITY_NOT_MASTERED` (existence, cusip, currency) and
  `ACC_NOT_OPEN_ON_TRADE_DATE` (existence, open on the trade date judged by the dates; a trade on an account closed
  later is a cleared look-alike). Eight lines at the end of `outputs/02_defect_register.csv`.
- **Scores** (section 12): every register line maps to one test of one rule in one of the seven check domains
  (`config/scorecard.toml`). `outputs/02_scorecard.csv` has platform, domain, rule and test rows with score, coverage
  and the confirmed-only bound; `outputs/02_scorecard_accounts.csv` one row per account with its per-domain breakdown
  and its fund's NAV result beside it; `outputs/02_score_outcomes.csv` the records behind every non-passing unit.
- **Sensitivity:** `outputs/02_scorecard_sensitivity.csv` (NAV-proximity weights, weakest link, confirmed-only; how
  many of the worst accounts stay worst, rank correlation, and the ties at the cut-off).
- **Indicators:** `outputs/02_indicators.csv` (catalog with unit, threshold, owner, decision and a gaming note),
  `outputs/02_indicator_series.csv` (daily and week-over-week series), `outputs/02_indicator_lookback.csv`
  (retrospective look-back: shared keys flagged earlier, misses, leads).
- **KPIs:** `outputs/02_kpis.csv` (six computed, KPI 7 proposed).
- **Store and docs:** eight new store tables; a generated scorecard section in FINDINGS.md with its own freshness
  checksum that `check_docs.py` verifies.

## What the team should know for the slides

Read every number from FINDINGS.md. Three things need care:

- **Corporate actions scores zero** because every action carries a finding and unresolved findings count as fails
  (the user's rule). Its confirmed-only score shows how much of that is open questions; I3 (readiness) measures only
  quarantine. FINDINGS says this beside the numbers.
- **The look-back:** the price and unmastered-security indicators flagged most lagging problems weeks earlier (shared
  keys, not just timing). The booking-latency indicator never fired, so it shows "no lead: all missed". The
  corporate-action pair is near complete by construction and is not evidence of predictive reach.
- **KPI 1 and the Accounts domain differ on trades on unknown accounts:** KPI 1 reports them separately (RULES.md
  "Missing data"), the Accounts domain counts them as fails.

## Rulings taken during the build (each in the ledger with its cost if wrong; the important ones are in spec §8)

1. Task 3's aggregation takes an optional group column so account scores reuse the same arithmetic (no second
   implementation).
2. The outcome check counts distinct units, not file rows (a trade ID on two accounts is written twice).
3. The account file is written with every column from the start; Task 5 fills the variant columns.
4. Existing notebook cell ids are never changed.
5. The summary-line check (a summary's records equal its breakdown lines') was built in Task 2; no other task owned it.
6. A corporate-action holder takes its action's own outcomes (main and confirmed-only), so account and domain views
   agree. This supersedes the spec's first wording.
7. An account with no records in a test or domain leaves it out (not applicable, not zero coverage).
8. I4's threshold sits in the indicator config and is asserted equal to KPI 5's target.
9. The corporate-action look-back caveat (near complete by construction) is written into the notebook and spec.
10. The weight-change robustness run may change the Prices row's weight cell (it echoes the input).
11. The longer full-run time is accepted and listed as doc debt in STATUS.
12. Spec §8 is the record of building decisions; D-069 holds the treatment and scope choices.
13. KPI 1 keeps unknown accounts as reported separately (RULES.md); the difference is stated where readers see it.
14. The fix wave also took the review's fix-before-merge minors and three clarifying sentences for judges.

**Parked (other data only, no effect on this release):** the "Held security with no price at all" line would let
off-snapshot positions into price coverage; the I2 look-back sentence compares the earliest late day only, not per
feed; the I3 printed line counts action rows, not distinct actions.

## Verification

Every existing register line is byte-identical and first; every pre-existing `02_*` output is identical except the
members file, the row ledger and the run record. Passed: `tests/run_notebook.sh`, `tests/fixture_test.sh` (new score
fixture), `tests/robustness_test.sh` (three shuffles, the threshold run, and a new live domain-weight run),
`tests/store_test.sh`, dashboard `npm test` and `npm run test:e2e`, the Python unit tests and `check_docs.py`. An
independent DuckDB recount on the raw files matches the KPI 1 rule lines and KPI 1's numerator.
