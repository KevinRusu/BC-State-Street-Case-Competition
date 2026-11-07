# Decisions

*Append-only. Add a new entry at the end; never rewrite an old one. If a decision changes, add a new entry and
mark the old one `Superseded by D-0xx`.*

Each entry says what we chose, why, what we chose it over, and where it was agreed. Counts inside an entry are as
they stood on the day of the decision; current numbers are in [FINDINGS.md](FINDINGS.md). Where a decision
interprets the Dataset Guide or Working Guide, it names the section; the guide itself stays the source.

Sources that no longer exist as files: *build log* = the Check-in 2 build ledger
(`.superpowers/sdd/CHECKIN2_PLAN/progress.md`, gitignored, deleted 16 Oct after its rulings were copied here).

---

## Standing choices

### D-001 · 9 Oct · Rules detect, AI only explains

- **Decision:** every finding comes from a deterministic rule in code. AI may draft explanations, summaries and
  hypotheses, and every number or ID it cites is checked against our outputs.
- **Why:** judges rerun the code and change thresholds live; an AI call is neither reproducible nor defensible as a
  control. Brief §10 and Working Guide §7 warn about AI over-flagging and silent repair.
- **Instead of:** an LLM or RAG agent as the detection engine.
- **Source:** `docs/checkins/checkin1/OVERVIEW.md` §11.

### D-002 · 12 Oct · Framework: 3 offices, 5 stages, 6 handoffs, 7 checks, 7 KPIs

- **Decision:** front, middle and back office; custodian and price vendors are outside sources, not offices.
  Stages: accounts → securities → transactions → positions → NAV and ledger. One owner per check. Seven KPIs roll
  up to one platform score shown next to its coverage. Six data contracts, one per handoff.
- **Why:** simple enough to explain in one slide; every check has one owner and one failure action.
- **Instead of:** the earlier "spine" workbook with ID codes and 20 controls.
- **Source:** `docs/checkins/checkin1/CHECKIN1_REPORT.md`; rules under each check in [RULES.md](RULES.md).

### D-003 · 15 Oct · Say "exposure", not "loss"

- **Decision:** money effects are called exposure (indicative), never loss.
- **Why:** the package README (Boundaries) forbids presenting investment-value differences as realised losses.
- **Source:** `docs/notes/PROJECT_SUMMARY.md` §5 (deleted 16 Oct; in git history).

---

## Check-in 2 plan (agreed 16 Oct)

Source for D-004 to D-016: `docs/checkins/checkin2/CHECKIN2_PLAN.md` §2.

### D-004 · Main rebuild chain = notebook 01's C7

- **Decision:** dedup → conflicting pairs not evaluable → drop CANCELLED → R1 → negatives kept raw → blanks not
  evaluable → trade-date cut-off. Notebook 02 must reproduce `outputs/01_rebuild_steps.csv` before anything new.
- **Why:** Dataset Guide §3 asks for the raw benchmark first, then each justified change with its effect.

### D-005 · Keys whose trades net to zero and that neither book nor custodian holds

- **Decision:** own category "only in rebuild, nets to zero": outside the match rate, inside the union total.
  Candidate cleared flag (a closed position is not reported). See D-024 for how it is cleared.
- **Why:** Dataset Guide §2/§5: absence is not a confirmed zero; any zero convention must be justified.

### D-006 · Conflicting duplicate pairs

- **Decision:** keys they touch are not evaluable. Sensitivity beside it: keep first / keep second / drop both.
- **Why:** we can't know which copy is right, and keep-first depends on row order.

### D-007 · REVERSED: R1 main, R3 beside it

- **Decision:** main chain uses **R1, BOOKED-only** (the original stands; the REVERSED row only marks a status).
  **R3, one offset per original**, is shown beside it on the keys with a reversal. R2 dropped (same quantity as R3
  but hides keys). R4 shown only as "what the book seems to do", never as a reading of ours.
- **Why:** R1 is the Guide's shared benchmark (Dataset Guide §3); no double offsets.
- **Instead of:** treating REVERSED as an offsetting trade in the main chain.

### D-008 · Negative trade quantities

- **Decision:** keep the raw sign. Every key touched gets a **sign conflict** flag, even when it matches.
  Absolute value only as a labelled sensitivity.
- **Why:** Dataset Guide §3: investigate, never just take the absolute value. A match with the book is not proof,
  because the book carries the same sign.

### D-009 · Blank trade quantities

- **Decision:** the key is not evaluable. Blank-as-zero only as a sensitivity (evidence of the book's convention).
- **Why:** unknown never becomes zero; untestable never raises a score.

### D-010 · Holding date: trade date is the main version

- **Decision:** trade-date holdings lead; the settlement-date version is reported beside it (counts only).
- **Why:** `positions` behaves as a trade-date book. Dataset Guide §3: settlement date is a plan, not proof.

### D-011 · Check-in 2 format: short deck (8 to 10 slides) + live notebook

- **Why:** story on the slides; the notebook proves the rebuild runs on the full data.

### D-012 · Code home: `notebooks/02_reconcile.ipynb` for now

- **Decision:** the code lives in notebook 02 until after Check-in 2, then moves into `src/` + `run_all.py`.
- **Why:** fastest path to a readable, runnable method for the method gate.

### D-013 · Break classification: two layers, one main class per key

- **Decision:** layer 1 = who disagrees (pattern); layer 2 = an ordered cause rule, first match wins. Flags sit on
  top and never change the class. Unexplained breaks stay visible, never forced into a class.
- **Why:** totals add up with no double counting (brief §5).

### D-014 · The evidenced trace: a negative-quantity BUY, picked by a written rule

- **Decision:** selection rule in config, no IDs typed in. The 100x price case is kept as a second trace for the final.
- **Why:** confirmed status, every hop observable, independent evidence (`gross_amount`).

### D-015 · Checks run on full data for Check-in 2: NAV arithmetic and vendor scale and spread

- **Decision:** coverage and freshness stay proposed (rule, threshold and denominator written, not run).
- **Why:** NAV arithmetic is required back-office work; scale ties to the 100x price defects.

### D-016 · Corporate actions: supported vs quarantined

- **Decision:** supported = the type's required terms are present and, for MERGER/SPINOFF, the target exists and
  is mastered. Extra terms and ex-date after effective date are flagged **unresolved**, not quarantined, pending
  faculty definitions. Trade-only and event-adjusted versions stay separate (event-adjusted waits for the final).
- **Why:** Dataset Guide §4: incomplete events are quarantined, not guessed.

### D-017 · Four defect classes taken forward

- **Decision:** spin-off targets never set up · negative-quantity BUYs · duplicate trade copies counted ·
  custodian missing holdings. Every other finding stays as one line in the register.
- **Why:** spread across master data, trade capture, pipeline and reconciliation; the final needs at least 3 traced.

---

## Check-in 2 build rulings (16 Oct)

Made while building notebook 02 and fixing review findings. Source: *build log*, unless stated.

### D-018 · Checks against notebook 01's numbers assert only when settings and data match

- **Decision:** always-on checks are invariants (groups add up). Comparisons with notebook 01 assert only when the
  config tolerance and as-of date equal `config/exploration.toml` and the same data is loaded; otherwise they report.
- **Why:** a live threshold change, or a judge's fixture, must never halt the notebook.

### D-019 · NAV tolerance = 0.000001

- **Decision:** one unit of `nav_per_share`'s stored sixth decimal. `net_assets` is USD (data dictionary).
- **Why:** rounding alone gives up to 0.0000005, so a looser tolerance would hide real residuals.

### D-020 · REDEMPTION events are quarantined (reason `NO_RATIO_CONVENTION`)

- **Why:** Dataset Guide §4 defines ratio for split, merger and spin-off only; extinguished units can't be
  determined without inventing a convention.

### D-021 · Sensitivities swap one step in the full main chain

- **Decision:** each sensitivity changes exactly one step of D-004 and keeps the rest, so its numbers differ from
  notebook 01's partial chains.

### D-022 · Not evaluable takes precedence over presence patterns

- **Decision:** a key that is not evaluable is counted there, not in a one-sided pattern. An unreadable book or
  custodian quantity also makes a key not evaluable, never a break.

### D-023 · Extra cause rule `sign_flipped_position`, last in the order

- **Decision:** the odd source equals minus the rebuild. Added after the first run left a large group of
  rebuild-odd keys with visible sign flips; last in the order so it never takes keys from the planned rules.
- **Why:** CHECKIN2_PLAN §3.3 allows a new rule if written down, ordered and counted.

### D-024 · The zero-net keys are "cleared" by rule

- **Decision:** status set by code, not by hand. The basis is that **both** book and custodian store zero
  zero-quantity rows anywhere, so their silence on a closed position is their normal convention.
- **Instead of:** "the custodian is also absent", which held by construction of the pattern and proved nothing.

### D-025 · Trace selection: "no other flag"

- **Decision:** no flag other than `sign_conflict`, and the key is evaluable in all three sources. If no key
  qualifies, drop the condition and say so.

### D-026 · R3 "first reversal" per original

- **Decision:** among the rows still in the chain after the first three steps, the earliest `event_timestamp`
  (both date formats; unreadable last), then earliest `trade_date`, then lowest `transaction_id`; remaining raw
  columns break any tie. `pipeline_events.booked_timestamp` is not used (not one-to-one with transactions). If the
  chosen reversal has a blank quantity, the key is not evaluable under R3.

### D-027 · Register denominators

- **Decision:** eligible never includes a not-evaluable record; eligible + not evaluable = population (asserted).
  For three-way lines, population = keys in the union.
- **Why:** Dataset Guide §5 and Working Guide §6: always give the denominator, report untestable records apart.

### D-028 · Every break class maps to exactly one register line (asserted)

- **Decision:** rebuild-odd lines per cause, custodian-odd lines per cause, all-three-differ split into "a cause
  rule fits" and "no cause rule fits", plus a fallback line. Lines are named by pattern and cause.

### D-029 · FX coverage convention

- **Decision:** checked per (currency, price date), both date formats; a usable rate is readable and > 0. Prices in
  the reporting currency (`[fx] reporting_currency` in config, USD) need no rate. Unreadable price date or blank
  currency = not evaluable. The preferred-vendor finding counts only valid quotes (price > 0). The trace's exposure
  uses the same convention; any other currency needs exactly one readable rate > 0 on the snapshot date, else the
  exposure is "not stated".
- **Why:** Dataset Guide §4: `rate_to_usd` = USD per one unit of currency.

### D-030 · Settlement-date run mapping

- **Decision:** with `holding_date = "settlement"`, our chain is compared with notebook 01's settlement-date chain
  by meaning, not code. Candidate holders for corporate actions always use the trade-date rows. A trade with an
  unreadable trade date marks its holder key not evaluable.

### D-031 · Test switches and the shuffle test

- **Decision:** the notebook reads optional `RECONCILIATION_CONFIG`, `RECONCILIATION_DATA` and
  `RECONCILIATION_OUTPUTS` paths. The shuffle test runs the whole notebook under `[robustness] shuffle_seed`,
  using seeds that are checked to reverse an order-sensitive pair of reversals.
- **Instead of:** refactoring the pipeline into functions for testing.
- **Why:** tests every output end to end and lets judges flip it live. Tests: `tests/fixture_test.sh`,
  `tests/robustness_test.sh`.
- **Rehearsal on 16 Oct:** spread threshold 0.005 → 0.01 moved "spread above threshold" from 388 to 326
  securities; the reconciliation did not move.

### D-032 · `sign_conflict` keeps the plan's definition

- **Decision:** every key with a negative quantity, even when it matches. The trace claims "the sign contradicts
  `gross_amount`" only when `gross_amount` fits |quantity|. Register line name: "Negative trade quantity", with
  trade types and the fit count computed.

### D-033 · The trace never stops on a missing lookup

- **Decision:** no pipeline record, or an account not in `accounts`, is written as an observed hop line, and the
  bps of fund net assets is then not stated. Ties among pipeline records and price quotes are ordered by their own
  fields, never by file order.

### D-034 · Robustness conventions

- **Decision:** `as_of_date` of positions and custodian is normalised before every join; the NAV repeated-key check
  uses the normalised date (unreadable = not evaluable); vendor dispersion counts vendors (one vendor = not
  evaluable); "more than one REVERSED per original" counts distinct REVERSED `transaction_id`s per linked original.

### D-035 · No caching between notebook sections

- **Why:** measured runtime gain was 0.1 s, not worth a hidden dependency between sections.

### D-036 · Four rule gaps added to the rules

- **Decision:** `TXN_ONE_REVERSAL_PER_ORIGINAL`, `TXN_PIPELINE_ONE_TO_ONE`, `POS_KEYS_MASTERED`, `FX_RATE_COVERAGE`
  added under the existing checks in [RULES.md](RULES.md).
- **Why:** CHECKIN2_PLAN §3.7: a finding without a rule gets one, under one of the seven checks.

---

## Repo and ways of working

### D-037 · 16 Oct · Notebooks are the only source of their code

- **Decision:** edit `notebooks/*.ipynb` directly. No hidden source file generates a notebook.
- **Supersedes:** the build-log ruling that generated notebook 02 from `nb02.src`; that file had fallen behind the
  committed notebook and was deleted with `.superpowers/`.

### D-038 · 16 Oct · One home per kind of fact

- **Decision:** requirements in `reference/`; choices here; numbers in `outputs/` and the generated
  [FINDINGS.md](FINDINGS.md); state in [STATUS.md](STATUS.md); thresholds in `config/`; rules in
  [RULES.md](RULES.md). Check-in material is frozen in `docs/checkins/checkinN/`. Other docs link, never copy.
- **Why:** PROJECT_SUMMARY and three other notes repeated the same facts and drifted apart.
- **Instead of:** one long summary file, which went stale within a day.
- **Source:** `CLAUDE.md`.

### D-039 · 16 Oct · AI chat logs stay out of git

- **Decision:** `AI_Logs/` is gitignored (commit ad2cbe5). The logs are collected for the final hand-in.
- **Why:** the logs quote record IDs (flagged in the Check-in 2 build review); keeping them out of the repo limits
  where data appears. Brief §10 still requires submitting the prompts and responses that shaped the work.

### D-040 · 16 Oct · Check-in 2 story: follow one broken trade

- **Decision:** the findings are told as one story, `docs/checkins/checkin2/STORY.md`, for teammates before the dry
  run. Spine: the D-025 trace, shown as the mirror of Check-in 1's clean trade (figure 08 beside figure 06): a broken
  trade gets through every check after the point where it entered. The other three D-017 classes are short detours
  (one count, one example, "not yet traced"); the D-024 cleared flag is the ending. Every number cites its
  `outputs/` file in a footnote. Frozen after Check-in 2; the final gets a new story in `docs/final/`.
- **Story vs catalog:** the story tells, `docs/DEFECT_CATALOG.md` proves. The story links to the catalog for rule,
  population and fix and never restates them.
- **Spin-off link:** the register's three spin-off lines are not linked in any output. The story shows the link
  observed for the register's example securities (each is a spin-off target in `02_ca_readiness.csv`) and calls the
  link for all affected positions inferred, to be traced for the final.
- **Why:** Check-in 1 feedback (tell a story); Working Guide §7 (any member may be asked to walk a record back).
- **Instead of:** a stage-by-stage tour of the classes, or an "agreement isn't proof" framing (kept as the story's
  turning point at the custodian step).
- **Figure:** `scripts/fig_trace_journey.py` draws `docs/figures/08_journey_negative_buy.png` from the trace,
  vendor and NAV outputs; no IDs or numbers in the code.

### D-041 · 17 Oct · Denominators for the proposed coverage and freshness checks

- **Decision:** coverage counts `positions` rows on the snapshot date; freshness counts the chosen quote per held
  security. A holding with no quote at all **fails** coverage (the absence is the evidence); "not evaluable" is kept
  for quotes that exist but can't be judged (unmastered security, unreadable date or timestamp). The NAV cutoff time
  is not in the data, so freshness names it as an input still needed, to go in `config/reconciliation.toml` before
  the check runs. Table under the price check in [RULES.md](RULES.md).
- **Why:** CHECKIN2_PLAN §3.5 asks for rule, threshold and denominator for each proposed check; Dataset Guide §5
  asks for the eligible denominator with missing and unevaluable records apart. Counting no-quote holdings as
  failures keeps coverage consistent with the confirmed "Held security with no price at all" register line.
- **Instead of:** treating unpriced holdings on unmastered securities as not evaluable, which would raise coverage
  by hiding the spin-off targets that were never set up.

### D-042 · 17 Oct · Defect catalog: generated fact cards, hand-written judgement

- **Decision:** each entry in [DEFECT_CATALOG.md](DEFECT_CATALOG.md) has a fact card (name, status, rule id,
  affected / eligible / not evaluable, examples, how detected) that `scripts/build_findings.py` fills from the
  register between `<!-- card: … -->` markers; `scripts/check_docs.py` fails when a card's checksum is older than
  the register. Rule, where it entered, why it matters and the fix are prose, with footnotes for any number. Each
  entry names a teammate reviewer. Order follows the story's route.
- **Why:** no typed numbers in the facts (CLAUDE.md) and a catalog that can't go stale silently, while the
  judgement stays readable.
- **Instead of:** the bare seven-row Working Guide table per class, or seven headed sections per class.
- **Corrects D-040:** the spin-off link is **observed** for all affected positions, not only the examples:
  `outputs/01_cross_check.csv` shows the 1,118 position rows sit on 15 securities, all missing spin-off targets
  (1,131 trades, 0 prices). STORY.md is corrected.

### D-043 · 17 Oct · Negative BUYs: gross_amount confirms the size, not the side (refines D-032)

- **Decision:** the trace and the docs no longer say `gross_amount / price` "contradicts the sign". gross_amount is
  positive on every BUY and every SELL (`outputs/02_sign_by_type.csv`), so it confirms a trade's **size** but not its
  side. Two readings fit a negative BUY: **wrong sign** (it should be BUY +q; the book is off by 2q) and **wrong type**
  (it should be SELL q; the book is right). The trace states both, with the exposure under each (the D-014 trace's
  ~19 bps under wrong sign, 0 under wrong type). Status: the **record** stays confirmed, because a quantity is never
  negative (Dataset Guide §3) and `TXN_FIELDS_VALID` rejects it under both readings. The **correct value** is
  unresolved, leaning wrong sign: the new rule `TXN_NEGATIVE_SIDE_EVIDENCE` ([RULES.md](RULES.md) §3) finds the
  partner records of each negative row, and every partner found is a BUY with a positive quantity
  (`outputs/02_negative_partners.csv`; counts in the register's "how detected"). The custodian is not counted as
  evidence for either reading: it equals the book on these positions, but it also follows the book's duplicate and
  REVERSED conventions (trace, custodian hop). Remediation corrects a row only when a partner record or the source's
  order side or cash direction shows its side, holds the rest, and never takes the absolute value.
- **Why:** the old claim read size as direction. Working Guide §5 asks for the evidence to match the claim, and a
  confirmed record with an unproven correction are two different statements.
- **Instead of:** keeping "contradicts the sign" (overstated), or downgrading the line to unresolved (the record is
  wrong under both readings).
- **Refines:** D-032 (the trace claim) and the "independent evidence (`gross_amount`)" in D-014 and CHECKIN2_PLAN §2:
  gross_amount is independent evidence of the size only. Faculty question added in STATUS.md.

### D-044 · 21 Oct · Exact and date-format-only copies are removed before the rebuild (C1)

- **Decision:** a second row with the same `transaction_id` that equals the first once both date formats are
  normalised is removed (C1). Copies that still differ stay under D-006 (their keys are not evaluable).
- **Why:** they look like one trade delivered twice, not two trades. `outputs/02_duplicate_profile.csv`: every pair
  has two pipeline records, received at the same time in one batch, and the second is published later, mostly within
  minutes *(observed)*. Our reading is a resend at the publish step *(inferred)*; the data has no delivery-attempt or
  message ID to prove it, and it is synthetic. A trade happens once, so counting it twice overstates the holding
  (`TXN_DUPLICATE`, [RULES.md](RULES.md) §3).
- **The other side, stated:** the book counts both copies. Its own `transaction_count` includes both on every position
  that holds one (same file), and book and custodian agree on the copy-inflated quantity (register line "Book and
  custodian count duplicate copies as trades"). So the copies are confirmed, but whether counting them is a defect or
  the platform's convention stays unresolved (faculty question 4 in STATUS).
- **Instead of:** keeping the copies, as the Guide's BOOKED-only benchmark does. Effect: `outputs/02_waterfall.csv`,
  C0 to C1 and the BOOKED-only line (Dataset Guide §3: show the effect of each transformation, "including exact and
  conflicting duplicates").
- **Source:** team review of the method, 21 Oct (no written reason existed for C1 before; D-004 only listed it).

### D-045 · 21 Oct · CANCELLED rows do not count (C3)

- **Decision:** a CANCELLED row adds nothing to a holding. A BOOKED row linked to a CANCELLED original is a rebook
  and counts (Dataset Guide §3).
- **Why:** a cancelled trade is not a holding, and the Guide's BOOKED-only benchmark drops it too. The book agrees:
  its `transaction_count` equals the number of rows that are not CANCELLED on every position it holds
  (`outputs/02_duplicate_profile.csv`).
- **Instead of:** counting them (the C0 raw benchmark in the waterfall). CANCELLED rows linked to an ID that does not
  exist stay uncounted; what that link means is unresolved (register line "CANCELLED row linked to an ID that does not
  exist").

### D-046 · 21 Oct · The headline rate: three-way agreement on the positions we can test

- **Decision:** the one headline number is the keys where rebuild, book and custodian agree, divided by the keys in
  the union minus the not-evaluable keys (`outputs/02_three_way_summary.csv`). The not-evaluable count is shown beside
  it, never inside it. Flags inside the agreement are stated with it (`sign_conflict_keys` on "all three agree" in
  `outputs/02_break_classes.csv`). Rates A and B stay on the waterfall, each named with its denominator.
- **Why:** the same denominator as the register (D-027; Dataset Guide §5: eligible apart from unevaluable). One-sided
  keys stay in the denominator, as not agreeing. Avoids the plan's anti-goal of a rate that silently includes
  suspect keys.
- **Instead of:** rate A (leaves out one-sided keys, so it flatters), rate B or three-way over the whole union
  (counts "unknown" as "wrong").

### D-047 · 21 Oct · Blank quantities are real trades with the quantity missing (refines D-009)

- **Decision:** the main chain is unchanged: a key with a blank quantity is not evaluable. Beside it, a sensitivity
  derives the size as `gross_amount / price` where that is within `derived_units_tolerance` of a whole number and the
  row has no `related_transaction_id` (a rebook can carry the cancelled trade's gross_amount); the side comes from
  BUY/SELL. New rule `TXN_BLANK_QUANTITY_EVIDENCE` ([RULES.md](RULES.md) §3), new register line "Book leaves out the
  units of trades with a blank quantity" (**unresolved**), new catalog entry 2.
- **Why:** `outputs/02_blank_quantity.csv`. The rows look like real trades: BOOKED, money moved, booked and published,
  and counted in the book's `transaction_count`. The backtest of `gross_amount / price` on rows that do have a
  quantity gives it exactly on nearly all of them; most misses are linked rows. With the derived sizes, no testable key
  matches the book, and the book equals the blank-as-zero rebuild. So D-009's "blank-as-zero is evidence of the
  book's convention" now reads: the book appears to drop the units of real trades.
- **Why not in the main chain:** the size is derived from the row itself, not confirmed by the source. Filling it in
  is a correction, and corrections belong to remediation once the source confirms (Dataset Guide §3: no silent
  repair). Check-in 2 shows where the data is broken; it does not correct it (team, 21 Oct).
- **Instead of:** "a blank means the trade never happened or was cancelled" (contradicted by the status, the money,
  the pipeline and the book's own count), or blank-as-zero.

### D-048 · 23 Oct · Code review fixes: the sign_conflict flag and blank-quantity rebooks (refines D-008, D-032)

- **Decision:** (1) `sign_conflict` is set on every key that has a negative-quantity row of **any** status, as D-008
  and D-032 state; before, only rows still in the main chain were looked at, so a negative row that was CANCELLED or
  REVERSED left its key unflagged. The sizes used for the wrong-sign holding still come from the main chain, because
  only those rows move the rebuilt quantity. (2) A rebook whose own quantity or whose cancelled original's quantity is
  blank is **not evaluable** for "Rebook changes the quantity but keeps the cancelled gross_amount" and for the
  `rebook_old_gross` flag; before, a blank counted as a "new quantity".
- **Why:** the Check-in 2 code review (23 Oct). A blank is unknown, not a different number (D-009, D-027). Effect,
  against the outputs before the fix: `outputs/02_break_classes.csv` (`sign_conflict_keys` on "all three agree",
  `rebook_old_gross_keys` on the blank-quantity pattern) and the rebook line in `outputs/02_defect_register.csv`;
  nothing else moved.
- **Also:** the wrong-sign holding is now the rebuild minus twice what the rebuild used for the negative rows, which
  is right for a negative SELL too (the release has only negative BUYs, so no number moved).

### D-049 · 23 Oct · R3: a REVERSED row with nothing to offset makes its key not evaluable (refines D-026)

- **Decision:** under R3, a REVERSED row whose BOOKED original is not among the rows still in the chain (no link, or
  a link to an ID that is not there) counts 0 and marks its key not evaluable.
- **Why:** R3 means one offset per original; with no original there is nothing to offset, and subtracting the row
  anyway would invent a movement (Dataset Guide §3: prevent double offsets; §2: missing references stay visible).
  Every REVERSED row in the release links to a BOOKED original, so no number moved; the case is tested on made-up
  rows in notebook 02.
- **Instead of:** treating an unlinked REVERSED row as its own original and subtracting it (the code before 23 Oct).


### D-050 · 30 Oct · Error severity: NAV sensitivity and distinct accounts

- **Decision:** notebook `notebooks/03_error_severity.ipynb` reuses notebook 02's detections and adds separate financial and account-breadth measures. Financial scenarios use alternative minus current investment value in USD, aggregated within each fund before division by that fund's snapshot net assets. Report signed and gross differences, valuation coverage, unmapped accounts, and missing denominators. Never add basis points across funds or add overlapping scenarios.
- **Scope:** cataloged holding errors and cleared flags, existing reconciliation break classes, vendor dispersion flags, and NAV arithmetic failures. Negative quantities show wrong-sign and wrong-type readings separately. Blank quantities retain the existing derived-units sensitivity. Missing custody confirmation is not a zero holding. Missing-master and unpriced holdings may be the same affected population.
- **Valuation:** monetize only EQUITY with a unique security master, an unambiguous eligible positive snapshot quote in master currency, and unique positive FX; USD requires no conversion. Holding scenarios exclude existing vendor dispersion flags. Vendor scenarios show high-minus-low quote differences instead of choosing a correct vendor. Quotes must have a timestamp on the snapshot date; NAV-cutoff eligibility is not established because the cutoff contract is absent. Bonds remain unvalued until quote and quantity basis are verified. No NAV materiality threshold is introduced.
- **Interpretation:** investment-value sensitivities omit cash, accruals and other ledger components; they are indicative NAV exposure, not proven NAV misstatement or loss. NAV arithmetic has a separate dollar-equivalent inconsistency assuming net assets and shares are authoritative; it does not establish which input is wrong.
- **Accounts:** count distinct directly implicated account IDs, including IDs absent from the account master. NAV arithmetic counts the mapped fund/share-class account cohort instead. Report the broader mapped fund-wide account cohort separately as potential downstream reach, not measured investor harm. Do not call account counts investor counts.
- **Why:** the user requested prioritization on NAV impact and account breadth. The brief §5 and Dataset Guide §§2, 4–5 require visible uncertainty and no double counting. Unknown dollars remain blank rather than zero. No combined score or regulatory severity bands are implied.
- **Outputs:** `outputs/03_severity.csv`, `outputs/03_fund_impact.csv`, `outputs/03_impact_detail.csv`, `outputs/03_account_membership.csv`, and `outputs/03_severity.png`. The notebook includes offset, unknown-value, orphan-preservation, row-accounting, and shuffled-detail aggregation checks. This phase does not change dashboard pages or detection rules.

### D-051 · 4 Nov · A successful trace join does not establish record validity

- **Decision:** retain record-link status separately from notebook finding status. Trace maps and timeline steps overlay existing register examples using the location assigned by the Python store builder. Confirmed findings are red, unresolved findings amber, and cleared findings green; a cleared finding cannot hide a missing or repeated link. Matching transaction fields are displayed as raw evidence without deriving a correction.
- **Scope:** only examples already associated with the traced record, its account, security, or holding key are shown. Trace badges count those finding entries, not population-wide counts. No matched example is not an all-clear. A finding at one step does not automatically invalidate downstream records or prove a NAV impact.
- **Why:** the trace previously displayed a known negative-quantity example as green at every step because the rows existed. The summary listed the finding, but the map and timeline presented only join success. The two signals now remain visible together. Full record-level finding membership remains future work; detection stays in Python.

### D-052 · 4 Nov · Dashboard functional tests use isolated synthetic stores and a production build

- **Decision:** `npm test` prepares the existing small fixture before running unit/store tests, unless an explicit synthetic store was supplied by the existing shell harness. `npm run test:e2e` prepares its own fixture and runs Playwright against a production build on a separate loopback port and build directory. Unit and browser stores are separate so concurrent runs cannot overwrite each other's database.
- **Fixture scope:** execute the actual reconciliation notebook and store builder. Add remaining supported example IDs from that fixture's register to the test story list so expansion can be exercised on a small dataset. This changes only test navigation examples, not production detection rules, finding counts, or source tables. Logs and reports stay under `tests/runs/`.
- **Why:** the previous dashboard tests required manual fixture preparation and did not exercise browser state. The new workflows cover the reported finding-color and story-collapse regressions, plus map interactions, search, display controls, and narrow-screen layout. The browser runner builds production code without replacing the running dashboard's build or data store.

### D-053 · 5 Nov · Outputs and the register checksum are the same on Windows and Mac

- **Decision:** notebook 02 writes every CSV in `outputs/` with Unix line endings (`lineterminator='\n'`), whatever the operating system. The register checksum ignores line endings (`\r\n` counts as `\n`), and `scripts/check_docs.py` reuses the one `checksum()` in `scripts/build_findings.py` instead of keeping its own copy.
- **Why:** pandas ends lines with the operating system's own separator, so a register built on Windows had a different checksum (`c5a4eaf54a7f` instead of `d7e752f55f0a`) for identical content. PR #3 then committed that checksum into the docs, and `scripts/check_docs.py` failed on Mac. Normalising in the checksum as well covers registers built before this change.
- **Test:** `tests/test_cross_platform.py` runs notebook 02 on the small fixture as if on Windows and checks that no output CSV contains `\r\n`, and that a Windows and a Mac copy of a register get the same checksum.

### D-054 · 6 Nov (decided 21 Oct) · Dashboard: local Next.js app over a Python-built store

- **Decision:** the dashboard is a Next.js app in `dashboard/`. It reads one DuckDB file, `outputs/store.duckdb`, built by
  `scripts/build_store.py` from the data and notebook 02's outputs. Python detects; the app only reads and draws. It
  listens on 127.0.0.1 only and is never deployed. `uv` for Python, `npm` only inside `dashboard/`.
- **Why:** the brief wants one functional executive view with record-level drill-down, packaged locally, with figures
  that agree with the code outputs (brief §5, §7); Check-in 1 feedback asked for interactive visuals. One store file
  keeps the app's numbers tied to the register (same checksum as FINDINGS.md).
- **Instead of:** Streamlit (one language, but less control over the look the final view needs), or a Python API server
  beside the app (a second process for no gain while the data is static).
- **Note:** proposed in `dashboard/README.md` as "D-048"; that number went to the code-review fixes, so it is recorded
  here. The README's proposal section is removed.

### D-055 · 6 Nov (decided 23 Oct) · Dashboard data map: offices as rows, the flow as columns

- **Decision:** the map is a grid. Rows are the offices (front, middle, back) plus a separate "Independent sources"
  strip; columns are the flow (Address books, Transactions, Positions, NAV & ledger). A table sits in the row of the
  office that handles it: the owner of its check (`scripts/framework.json`). Where its data comes from is a chip on the
  box: solid when the data names the source, dashed when it is our reasoning. Colours have one job each: blue for our
  framework (check numbers, selection), green/amber/red/grey for data health only.
- **Why:** the old map mixed where a table sits with where its data comes from. Brief §4 asks for the stages "against
  the three offices"; brief §3 says master data feeds the flow.
- **Instead of:** the Check-in 1 bands with an outside column (still in `docs/figures/01_control_map.png`).
- **Note:** proposed in `dashboard/README.md` as "D-049" (taken by R3); recorded here.

### D-056 · 6 Nov · Code review (Job A): latent pipeline fixes, record-level trace findings, stale-store warning

- **Decision (notebook 02):**
  - Book and custodian rows are compared on the snapshot date only. A row dated another day, or with an unreadable
    date, is set aside, never joined on account + security; the two counts are separate lines in `02_row_ledger.csv`
    and printed. No register line: none exists on this release, and a new line would change the register.
  - A CANCELLED ID delivered with two different quantities gives its rebook no quantity to compare: not evaluable
    (as D-048 treats a blank), never the first copy in file order. A CANCELLED row with a blank transaction_id is no
    row's original (otherwise every unlinked trade became its rebook).
  - An unreadable USD rate is not evaluable, not "not 1".
  - A key the chain cannot rebuild always names its cause: a new cause "REVERSED row with nothing to offset" (R3
    orphans, D-049), and the side view takes its causes from its own chain.
  - The trace's wrong-sign value uses what the rebuild used for the traced row (`quantity_used`), as section 6c does,
    and asserts the chain holds exactly one row for that ID.
  - Notebook 02 also writes `outputs/02_finding_members.csv`: every ID each register line counts, not only its examples.
- **Decision (notebook 03):** the wrong-sign scenario uses `quantity_used` (it doubled `signed_quantity`, wrong under
  R3). A scenario with no affected records counts 0 rows instead of failing its own check, and the chart plots only
  the scenarios a run produced. The fixture test now runs notebook 03 (R3 config).
- **Decision (dashboard):**
  - The trace marks every record a register line counts (`register_members` in the store), not only the 2–3 examples
    (completes D-051's future work). A record with no badge is still not proven valid: uncoded rules (Job B) find
    nothing.
  - The header badge warns when the register on disk differs from the one the store copied ("out of date"), or
    says "unverified" when that register is gone. The store records the register path relative to the repo root;
    an older store is checked against the register beside it. The builder reuses the one checksum in
    `scripts/build_findings.py` and the dashboard reads `\r\n` as `\n` too, so a register built on Windows is not
    reported as out of date (D-053).
  - The builder uses the member list only if it belongs to the register (same findings, members exactly for the
    lines that affect something); otherwise it falls back to the examples, records `member_source`, and the trace
    text says that only examples are marked.
  - A corporate-action trace follows its source security to prices and FX.
  - `ACC…/` or `/` is not a key.
  - The map check now also tests rule sections on handoff lines. It found `POS_REBUILD_MATCHES` listed on the Trade
    check line although RULES.md §5 files it under the Position check; RULES.md wins (it ranks above code), so the
    line no longer lists it. The rule still counts on the positions table.
- **Not changed:** currency-level findings (FX coverage, USD rate) stay off record traces: they name a currency, not a
  record (D-051 scope).
- **Moves:** no register number (checksum unchanged on the full data). Outputs that changed: one label in
  `02_reversed_side_view.csv` ("not evaluable: other" → "not evaluable: blank quantity"), four lines in
  `02_row_ledger.csv` (rows set aside per position table: 0 on this release), the new `02_finding_members.csv`. The Check-in 2 deck reads only the side view's totals, which are
  unchanged; the decks were not rebuilt.

### D-057 · 6 Nov · The Check-in 2 deck has 7 slides (refines D-011)

- **Decision:** the deck handed in is 7 slides, one per brief §8 item (STATUS, 27 Oct), not the 8 to 10 of D-011.
- **Why:** records what was handed in; D-011 stays as the plan of 16 Oct.

### D-058 · 6 Nov · Dashboard for a non-technical reader: calm layout, plain wording file, logo and startup screen

- **Decision:** the dashboard shows plain words first and keeps every technical detail one click deeper; all its
  wording comes from `scripts/plain_language.json` through the store; it carries the State Street logo and a short
  startup screen.
- **Why:** the professor's guidance and Check-in 1 feedback say a reader who has never seen our pipeline must be able
  to follow. The dashboard was accurate but showed too much at once. Design:
  `docs/superpowers/specs/2026-11-06-calm-dashboard-design.md`.
- **Layout.** Everything technical stays, one click deeper.
  - Trace page: a native `<select>` story picker (grouped by stage) replaces the story chips; a plain headline sits
    under it; steps are one-line rows and only steps that carry a finding open by default; rule IDs, register lines,
    the "via" record, the legend, rows touched and the long caveat sit behind "Technical details".
  - Map panel: with nothing selected, a stage overview in map order (master data, trade capture, pipeline, corporate
    actions, positions, pricing, NAV), one line each with counts; folded sections for the rest. "Worked example" is
    not an overview stage: it only groups the Check-in 2 trace in the story picker.
    With a place selected, its plain sentence and finding counts come first; "What we found", "Who owns this", "Raw
    key counts (technical)" and "Columns" fold below.
  - The graph, the summary cards and every colour meaning (D-051, D-055) are unchanged. Confirmed stays red,
    unresolved amber, cleared as before.
- **Plain wording file.** `scripts/plain_language.json` holds one neutral sentence per register finding (keyed by the
  register's exact `finding` text), a label per stage, a sentence per map node and edge, the status phrases and the
  lead-ins. `scripts/build_store.py` carries it into the store (`plain` columns, a status-phrase table, `stage` on
  `demo_traces`); React code contains no wording. Coverage:
  - Nodes, edges and stages are fixed by the map, so the build asserts every one has wording and fails if not.
  - A finding without wording falls back to the register text and the build prints a warning listing them; wording
    never fails a build, because the fixture and config-variant registers hold finding texts the release register
    does not (variant findings are worded too).
  - `scripts/check_docs.py` fails when the full-data register has a finding with no wording, and notes unused
    wording (wording that matches no known register).
  - An old store (built before the wording) still loads: findings fall back to register text, an empty headline
    shows a rebuild message, and an empty story stage is grouped as "Other examples".
- **Headline rule (fixed, no AI, D-001).** The record's own findings come before indirect ones (those that reach it
  through another record), then confirmed > unresolved > cleared, then the lowest register line. The headline is that
  finding's plain sentence, then the status phrase, then "and N more findings" when there are others. No marks:
  the "none" phrase, which keeps the honesty caveat (a record with no badge is not proven valid). An indirect finding
  gets a lead-in chosen by the line's `id_kind` ("Its account: ", "Its security: ", "Its holding (account +
  security): " and so on) so it never reads as about the record itself.
- **Wording of unresolved findings.** A cause is never stated as fact: sentences say "matches what we get if..." or
  "would fit". The cleared sentence says only what was observed. This keeps the wording from claiming more than the
  register does (D-043, D-047). Every finding sentence must read true whether its line is confirmed, unresolved or
  cleared (the closed-position line can be either of the last two): the status phrase beside it carries the verdict,
  so a sentence never says "expected", "seems" or "may be harmless" (`tests/test_plain_language.py`). Check
  sentences on map lines state requirements ("must"), not outcomes.
- **"Trace an example" opens only what the trace can open.** `build_store.py` writes `trace_example` on each register
  line: its first example when the line's `id_kind` is traceable, else blank (a currency such as an FX finding's
  example cannot be traced), and the map panel links only that. On a store without the full member list, a record with
  no finding shows the examples-only note under its headline, not only under "Technical details", because there "no
  finding" may only mean "not one of the register's examples".
- **Subtitle.** "Prepared for State Street · Boston College case competition". It avoids presenting this as a State
  Street product: the brief says the data is a synthetic teaching model. Kevin has not confirmed the wording.
- **Logo.** Kevin's PNG is turned into a transparent blue and a white version by `scripts/build_logo.py` (the
  source sits in `dashboard/brand/`, the output in `dashboard/public/brand/`). The header logo is shown whenever the
  sidebar is not actually on screen (also below the `md` breakpoint), so exactly one logo is always visible.
- **Startup screen.** A Motion 14.6.0 (pinned) logo reveal of about 2 seconds, once per browser session
  (`sessionStorage` key `dfe-boot-seen`); a key or click skips it; reduced motion removes the movement. It is
  decoration: the dashboard loads underneath from the start and the bar claims no real progress. `BOOT_KEY` and the
  pre-paint script live in `boot-flag.ts` because a server layout cannot read a string exported from a "use client"
  file.
- **Story picker has no status dot.** A native select cannot colour options reliably, and it is the simplest
  accessible control. Status shows on the record's headline.
- **Known limit.** The map's check edges (for example Trade check) show 0 findings because `build_store.py` places
  those findings on tables; the panel says so. Changing placement is out of scope.
- **Rejected.**
  - A guided walkthrough with "Next" steps: the calm list and layered panel give the same reading order without
    forcing a path.
  - A map tour: same reason.
  - Startup screens that show the preflight checks or a story: they would imply real progress or pick one finding
    over the rest.
- **Moves:** no register number, no detection, no change to notebook 02 (D-001 holds). Pieces 3 (summary assistant)
  and 4 (how the dashboard is handed in) are separate brainstorms.
