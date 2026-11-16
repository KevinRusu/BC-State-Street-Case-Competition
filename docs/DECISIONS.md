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

### D-059 · 7 Nov · Running the dashboard on Windows: Unix line endings for `.sh`, Git Bash, Node 20.9

- **Decision:** `.gitattributes` keeps `*.sh` on Unix line endings (`eol=lf`). The `.sh` scripts stay bash and Windows
  users run them in Git Bash (it comes with Git for Windows). `dashboard/package.json` declares `engines.node` as
  `>=20.9.0`. The root README has a Windows setup block and `dashboard/README.md` lists `uv sync` and the Node version.
- **Why:** a Windows teammate could not run the repo from a fresh clone. Git for Windows converts text files to CRLF on
  checkout by default and bash cannot run a script with CRLF. The Node and Python code already worked on Windows
  (D-053; `package-lock.json` holds the Windows builds of DuckDB, Next, Tailwind and lightningcss). 20.9 is Next.js
  16's own minimum; an older Node fails with an unclear message.
- **Instead of:** porting `tests/run_notebook.sh` to Python now. Do that if Git Bash turns out not to work for the
  dashboard run path (`run_notebook.sh`, `build_store.py`, `npm run dev`). The other `tests/*.sh` are not on that
  path and stay bash.
- **Moves:** no register number, no detection, no code change. Not yet tried on Windows by us: the first Windows run
  of this branch is the test (STATUS, "Where we are").

### D-060 · 8 Nov · One deliverable notebook, `notebooks/deliverable.ipynb`; the other notebooks in `notebooks/additional/`

- **Decision:** `notebooks/02_reconcile.ipynb` is renamed `notebooks/deliverable.ipynb` (git keeps the history) and
  `notebooks/03_error_severity.ipynb` is folded into it as section 11 (Error severity), before the run record, which
  becomes section 12. The severity outputs are renamed `03_*` -> `02_*` (`02_severity.csv`, `02_fund_impact.csv`,
  `02_impact_detail.csv`, `02_account_membership.csv`, `02_severity.png` / `.pdf`), so `02_` is the prefix of
  everything the notebook writes. Notebook 03 is deleted. `01_explore_tables.ipynb`, `02_quantity_mismatches.ipynb` and
  `checkin1_evidence.ipynb` move to `notebooks/additional/`.
- **Why:** brief §7 asks for one code package that "loads the full release, reconstructs and reconciles positions,
  checks price inputs and ledger arithmetic, and regenerates scores and impact measures". The file a judge opens
  should say that it is the deliverable, and `notebooks/` should show one entry point. Notebook 03 was four cells
  that `%run` notebook 02 and used its variables: one computation in two files. On Windows that `%run` failed on a
  repo path with a space in it (`...\School\Fall 2026 Fall into ...`); the merged notebook has no `%run`.
- **Output prefix kept:** the 17 `02_*` files are read by `build_findings.py`, `build_store.py`, `check_docs.py`,
  the deck and figure scripts, every test and the frozen check-in docs; renaming them would touch about 35 files for
  no information. The severity files take the `02_` prefix so that the run record's `02_*.csv` glob and
  `tests/robustness_test.sh` cover them without a code change.
- **A folder, not deletion, for the other notebooks:** notebook 01 is a live cross-check (the deliverable reproduces
  `outputs/01_rebuild_steps.csv` and `01_cross_check.csv` when they exist, D-018; `scripts/findings.py` reads its
  text through `config/findings.json`); `02_quantity_mismatches` awaits the team's decision
  (`docs/DETECTOR_DIFFERENCES.md`); `checkin1_evidence` is cited by the frozen Check-in 1 docs. The folder is
  `additional/`, lowercase and without a space like every other path here (`check_docs.py` cannot check a path with
  a space). `load_data.ipynb` stays at the root beside `manifest.csv` (the provided loader).
- **Code changes, all cosmetic:** in the merged section the `to_csv` call writes Unix line endings like the rest of
  the notebook (`tests/test_cross_platform.py` asserts it), and comments and file names say `02_` and "section 2b".
  `checkin1_evidence.ipynb` finds the repo root by walking up to `manifest.csv` (it assumed `notebooks/` was its
  parent). `tests/prepare_dashboard_fixture.py` sets `MPLBACKEND=Agg` as `test_cross_platform.py` already did: the
  severity plot's `plt.show()` would open a Tk window when the cells run outside a kernel. `tests/fixture_test.sh`
  runs the severity section under every fixture config (before, only the R3 run executed notebook 03).
- **History:** D-012 and D-050 stand as written, with the old names. `docs/checkins/` keeps the names used at the
  time.
- **Moves:** no register number, no detection, no severity number: the register checksum is unchanged
  (`d7e752f55f0a`) and the `02_severity*` files equal the former `03_*` files on the full data (STATUS, 8 Nov).

### D-061 · 9 Nov · Keep the trace workspace in view and bound map zoom

- **Why:** the full-width record banner pushed the map and evidence down while leaving unused space on the right.
  Unbounded zoom-out also made the map too small to read.
- **Layout:** on desktop the example picker and map fill the left column; the selected-record summary starts the
  right column above the steps. The evidence pane scrolls independently, and clicking a map place scrolls that pane
  without moving the map. Expanded technical details have their own bounded summary area. Narrow screens stack
  the panels and retain page scrolling. Manual ID lookup remains available under "Find an ID" beside the picker.
- **Zoom:** both maps derive their minimum zoom from the whole office/stage grid and the available container size.
  Returning to this minimum recentres the map; Fit View and a container resize restore the same default view.
  Panning is available while zoomed in. These are presentation changes; no rules, counts or treatment changed.
- **Checks:** browser coverage exercises the zoom floor, off-centre wheel zoom, Fit View, resizing, every synthetic
  example at desktop viewport sizes, and map-to-evidence navigation without page scrolling. Existing lookup,
  finding-status, picker, mobile and startup checks remain in the suite.

### D-062 · 9 Nov · Space trace boxes and balance shared-office placement

- **Why:** trace status labels increase node height. Top-left placement left Transactions touching Pipeline events,
  with Corporate actions nearby; it also put more of Transactions in the middle office than in the front office.
- **Decision:** the graph definition in `scripts/build_store.py` now carries a vertical anchor for each node.
  Transactions uses its centre at the midpoint between the front and middle bands, so changing its rendered height
  preserves equal overlap. Other boxes keep top-left anchors, including when reading a store made before this field.
  Pipeline events and Corporate actions have larger gaps within a taller middle-office band; back-office and
  independent-source positions move down together. Office ownership, controls and findings do not change.
- **Check:** browser assertions measure the rendered gaps, the shared box's centre and office containment on the
  main map and across the fixture stories. This covers both shorter ordinary boxes and taller trace boxes.

### D-063 · 9 Nov · Centre office boxes, distinguish external sources and toggle trace evidence from the map

- **Placement:** Accounts and Ledger NAV use centre anchors at the vertical midpoint of their office bands, in
  both map views and at every trace-label height. The existing shared-office anchor for Transactions remains.
- **Grouping:** a labelled outline in State Street blue (`#001AFF`) encloses the three office bands. Independent
  sources stay outside it with a thicker dashed border and more contrast in both themes. Both views use the shared
  grid component, so these boundaries stay consistent.
- **Interaction:** traced map boxes and timeline headers share expansion state. A box toggles all its matching
  steps together (any open means close the group; otherwise open it), then scrolls the evidence into view. The
  buttons support keyboard activation and expose their expansion state and controlled panels. Context-only boxes
  without a matching step are disabled and labelled as outside the trace. Selecting another record restores the
  usual default: steps with findings open, other steps closed. Raw-row details stay behind their existing toggle.
- **Scope:** no joins, controls, counts or data treatment change.

### D-064 · 9 Nov · A quieter office palette, with readable context

- **Refines D-063:** after reviewing the bright-blue outline, the user prioritised readability and a coordinated
  State Street-inspired scheme and explicitly allowed the border colour to change. The office grouping and the
  external-source boundary remain; the office outline now uses a muted blue rather than the vivid brand blue.
- **Decision:** use slightly deeper blue-grey office fills, a darker navy office-group label and a slate dashed
  external-source border in light mode, with coordinated navy bands and lighter labels in dark mode. These colours
  live in `dashboard/app/globals.css` and both views read the same tokens. Context boxes are less faded so their
  labels remain legible. Finding colours and the blue control numbers keep their existing meanings.
- **Validation:** review both map views in light and dark themes, verify the rendered colours rather than only
  the stylesheet, and retain the functional and geometry checks from D-063.

### D-065 · 10 Nov · Timeliness: five measures by feed and day, App. B median limits, own-field denominators

- **Decision:** section 9b of `notebooks/deliverable.ipynb` codes `TXN_TIMESTAMPS_IN_ORDER` and `TXN_AFTER_CUTOFF`
  ([RULES.md](RULES.md) §3) and writes `outputs/02_timeliness.csv`: one row per measure × feed (`source_system`) ×
  day, plus each feed's total and the platform. Design: `docs/superpowers/specs/2026-11-10-timeliness-design.md`.
  - **Measures.** Feed latency = received − event; processing latency = booked − received (brief App. B "booking
    latency"); booking cutoff = booked ≤ cutoff (the headline, App. A "cutoff adherence"); publication cutoff =
    published ≤ cutoff, shown beside it and never merged (the data dictionary: "compare booking and publication
    separately"); timestamp order = event ≤ received ≤ booked ≤ published (Working Guide §3). Feed latency is **our
    interpretation**: no guide names its pair; the data dictionary calls event the source-event time and received the
    platform receipt time.
  - **Limits.** `[timeliness] feed_latency_limit_minutes` and `processing_latency_limit_minutes` in
    `config/reconciliation.toml`, one key per feed, all three equal at the start (feed 60, processing 240 minutes).
    They are compared with the **daily median per feed**, as App. B states its threshold ("median … by feed; daily …
    above four hours"); records are measured, not failed one by one. A median equal to the limit is not above it.
    Both limits are team assumptions set before looking at this release's latencies; 240 is App. B's illustrative
    four hours. App. B's "or a doubling week over week" is left to the scorecard session (indicator work).
  - **Late is late.** A record booked or published after its cutoff fails that measure (carried to the next cycle, as
    SEC Rule 22c-1 treats a late order), even though it was booked or published in the end. Exactly at the cutoff is
    on time (≤).
  - **Denominators, per measure from its own fields.** A record is not evaluable for a measure only when that
    measure's own timestamps are missing (blank, or no pipeline record), unparseable, or out of order; one reason per
    record, in that order. A negative interval is out of order, never zero latency (Dataset Guide §3). A cutoff
    measure is out of order only when its own step comes before an earlier step (booked before event or received;
    published before any earlier step), so a record whose only problem is event > received keeps both cutoff results
    and RULES.md "Missing data" holds (never counted as on time). The order measure fails on any backward pair among
    readable timestamps and passes only when all four are readable and in order. Eligible + not evaluable =
    population, asserted on every row (D-027).
  - **Repeated records.** One record per transaction_id, as the rebuild counts a trade once (D-044). Where pipeline
    copies differ, the cutoff checks use the latest booked and published time and the earliest cutoff; the latencies
    and the timestamp order are judged copy by copy (the longest interval counts, and a backward pair in any copy
    counts, so an in-order copy cannot hide an out-of-order one). A blank or unreadable value in any copy makes that
    field missing or unparseable. A repeated ID never gets the copy that looks better. Repeated IDs and
    copies that disagree on a cutoff outcome are counted beside (`repeated_ids`, `copies_disagree`). App. A writes
    "rows", but it asks teams to choose their own dimensions: we count transaction_ids.
  - **Population, feed and day.** Every non-blank transaction_id in `transactions` or `pipeline_events`; a trade with
    no pipeline record is missing on every measure. Feed = the pipeline's `source_system`, else the transaction's.
    Day = the cutoff date, else the event date. A feed with no configured limit gets "no limit for this feed" and its
    feed-days are not evaluable on the latency lines, never a pass. A record with no readable date lands on day
    "unknown", which gets "no day" (it is not a day, so no daily median is judged).
  - **Register.** Seven lines appended **after every existing line**, so existing lines keep their order and the
    dashboard headline (which takes a record's lowest line, D-058) does not change for records that already had one:
    missing, unparseable and out-of-order timestamps (confirmed); booked and published after cutoff (confirmed,
    against the data's own cutoff); feed and processing latency medians above the limit (unresolved, counted in
    feed-days, id kind `feed/day`, not traceable to one record, because the limit is our assumption, not an SLA).
- **Why:** brief §5 Timeliness asks for feed latency, processing latency and cutoff adherence by feed and day, with
  missing, unparseable and out-of-order timestamps reported separately, every denominator published, and unavailable
  timestamps never treated as timely. Check-in 3 asks for quality checks with coverage.
- **Instead of:** a per-record pass/fail against the latency limit (App. B states a median); one combined "on time"
  (hides which step was late); a strict rule that any out-of-order pair voids both cutoffs (drops records for an
  unrelated pair); the earliest copy of a repeated record (flatters the result); limits taken from this release's own
  percentiles (tunes the test to the data).
- **Moves:** every existing register line and every other `02_*` output is unchanged on the full data; the register
  gains seven lines (new checksum in FINDINGS.md), `02_finding_members.csv` gains their members, and
  `02_row_ledger.csv` gains one line for section 9b. Runtime: the section groups only repeated IDs (a groupby over
  every ID cost about 30 s per table on the release, about a minute for the two tables).
- **Order needs all four timestamps to pass (refines the spec's "at least two readable").** A record with a
  missing or unreadable step and no backward pair among the rest is not evaluable on the order measure, never a
  pass: passing it would count an unavailable timestamp as in order, which brief §5 and RULES.md "Missing data"
  rule out. A backward pair among the readable ones still fails it.
- **Test fixture:** in `tests/fixtures/small/pipeline_events.csv` (manifest checksum updated), FXT06 and FXT11 are
  now timely: published 17:00, and FXT11 received 10:05, booked 10:10. Their old times (published 19:00 after an
  18:00 cutoff; FXT11 received before its event) were arbitrary values from before timeliness was coded. They
  gave every fixture trade a confirmed finding, and the dashboard's browser tests need one trade with no
  finding (FXT06) and one with only an unresolved finding (FXT11). The other records keep their late
  publication, so both outcomes stay tested.

### D-066 · 10 Nov · No new checks after the quality-check session: depth over breadth

- **Decision:** one more check session runs before Check-in 3: price data quality (`PRC_QUOTE_ELIGIBLE`: coverage
  and freshness with the D-041 denominators, and a look inside the vendor-spread and scale flags) and the four
  partly coded rules (`TXN_FIELDS_VALID`, `FX_RATE_VALID`, `TXN_DUPLICATE`, `TXN_CORRECTION_LINK`). After it we add
  no new checks. The rules [RULES.md](RULES.md) states with no code (`ACC_NOT_OPEN_ON_TRADE_DATE`,
  `ACC_REQUIRED_FIELDS`, `SEC_IDENTIFIER_VALID`, `TXN_SECURITY_NOT_MASTERED`, `NAV_SHARE_CLASS_MAPPING`,
  `NAV_OPEN_ISSUES_BEFORE_RELEASE`, `CA_ALL_HOLDERS_ADJUSTED`) stay in RULES.md as proposed controls for Part One and
  are not coded. The remaining code work, in order: scorecard and indicators; stress test (one injected defect and
  one valid look-alike); executive view; then, after Check-in 3, the groups we have only counted, opened into the
  three defect traces and two cleared look-alikes.
- **Why:** brief §5 "depth beats breadth": a team that traces three defect classes and makes the case for why they
  matter scores better than one that catalogs thirty. Once price quality is in, every area §5 names has a check;
  what is still missing is required work that is not detection (scores with coverage, the stress test, traces, the
  executive view) and the story that ties them together. Two of the uncoded rules also lack inputs (a materiality
  threshold, a posting log).
- **Instead of:** coding every rule RULES.md states (step 2 of the `src/` move in STATUS, now limited to the four
  partly coded rules above); opening the counted groups before the scorecard (the scorecard is due at Check-in 3 and
  reads the checks' pass rates and coverage; the traces are due at the final).
- **Moves:** nothing; a scope choice.

### D-067 · 10 Nov · Quality checks: price coverage and freshness, a look inside the vendor flags, FX, trade fields, economic duplicates, correction links

Design: `docs/superpowers/specs/2026-11-10-quality-checks-design.md` (user decisions in §5, calls in §8, choices taken
during the build in §10); plan: `docs/superpowers/plans/2026-11-10-quality-checks.md`.

- **Decision:** sections 8b (price data quality) and 9c (trade and FX field checks) of `notebooks/deliverable.ipynb`
  code `PRC_QUOTE_ELIGIBLE` (coverage, fallback-only, freshness), the look inside `PRC_VENDOR_DISPERSION`,
  `FX_RATE_VALID`, the rest of `TXN_FIELDS_VALID` (blank price, amount, lag), `TXN_DUPLICATE` (same economics under a
  different transaction_id) and `TXN_CORRECTION_LINK` (self-link, other account or security). The register gains new
  lines after "Published after cutoff" (listed in `outputs/02_defect_register.csv`; new checksum in FINDINGS.md) and `outputs/02_price_quality.csv` has one row
  per held security (columns in the notebook; `02_vendor_check.csv` is unchanged). Settings in
  `config/reconciliation.toml`: `[tolerances] settlement_lag_limit_business_days`, `settlement_extension_note`,
  `float_decimals`; `[prices] nav_cutoff_time`, `flat_run_dates`; `[fx] day_on_day_band`. They were written before the
  build looked at the data.
- **Why (the user's decisions, spec §5):** the NAV cutoff is the data's own pipeline cutoff, and a quote exactly at it
  is on time; the lag limit is a flat T+2 in Monday-Friday business days; the FX band applies to every currency
  including USD; flat runs and fresh fallbacks are reported beside freshness, not as lines (D-041). Coverage and
  fallback-only are new confirmed lines that state their overlap with the old ones; the old lines are untouched. Lag
  above T+2 without an agreed extension is unresolved, with the agreed extension it is cleared (look-alike); economic
  duplicates are unresolved because a split child order is a real look-alike. In the vendor flags, a chosen quote
  backed by another vendor is cleared; the chosen quote as the odd one is confirmed for scale and unresolved for
  spread (priority is preference, not accuracy, Dataset Guide §4); no two vendors agreeing is unresolved. Everything
  is published as register lines plus the one price file; there is no separate check-results table.
- **Copies that disagree:** the row-based trade lines count rows. Where the copies of one transaction_id get different
  results on a line, every copy is not evaluable on it, the same way the main policy treats conflicting pairs
  (`conflicting_pairs = "not_evaluable"`). A kinder copy is never picked.
- **Instead of:** a per-line pick of the best copy (flatters the result); re-picking the vendor by freshness (D-041
  judges the chosen quote; the count of fresh fallbacks shows what that would rescue); a hard-coded 18:00, 5% or T+2
  (they are settings a judge may change live; the fixture test runs T+3 live); comparing floats unrounded (a 5% move
  or a 0.01 difference must pass, so these are rounded to `float_decimals` first, which absorbs float noise only);
  new thresholds for "backed" (it reuses `spread_threshold`).
- **Moves:** nothing existing. On the full data every existing register line is byte-identical and still first, every
  other baseline `02_*` output is byte-identical except `02_finding_members.csv` (baseline members kept, new members
  added) and the run record's runtime; the register checksum moved only because lines were added. Plain wording for
  every new line is in `scripts/plain_language.json`.
- **Build-level rulings, kept for the record:** (1) in the lag-3 fixture, at T+3 both copies of FXQ17 pass and agree,
  so the copy rule keeps them evaluable (spec §6.7); the plan's expectation was corrected. (2) The
  price line keeps the copy rule, so it can have a not-evaluable count when copies disagree on blank versus priced
  (a fixture row shows it). (3) The robustness rehearsal also excludes "Processing latency: daily median above the
  feed's limit" from its identical-lines comparison, because the rehearsal loosens that limit (an existing
  rehearsal); the timeliness assertions still cover it. (4) Task 5's three choices are in spec §10: duplicates need
  account, security and type present; a link target with any blank copy is not evaluable, checked before "no copy
  matches"; link rows with a blank transaction_id are outside the link population.
- **Known limits:** the FX band and processing-latency rehearsals move no lines on the release, so they show no
  leakage but do not show the band biting (the fixture tests the band). The flat-run price match is exact; the
  walk-back to the previous business day rolls forward from the snapshot date (a choice: from a weekend date it gives the
  Friday first); the median used to find the odd vendor counts a vendor's duplicate quotes twice; the lag line names
  follow `LAG_LIMIT`, so a live T+n change shows the raw line name on the dashboard, because
  `scripts/plain_language.json` holds wording for T+2 only and the store falls back to the register name. None changes
  a count on the release.

### D-068 · 10 Nov · Fixes from the whole-branch review of the quality checks (D-067)

The Phase B review of branch `quality-checks` found six issues; the user chose each fix (10 Nov). Fixture cases for
each are in `tests/fixture_test.sh` (quality fixture, and FXT58 in the R3 fixture).

- **Decision:** (1) **Correction link to a missing ID:** a row that is not CANCELLED whose `related_transaction_id`
  names no transaction now fails on the correction-link line, renamed "Correction link points to itself, to a missing
  ID, or to another account or security" (still confirmed). A CANCELLED row with a missing target stays not evaluable
  there, because "CANCELLED row linked to an ID that does not exist" already counts it. (2) **Non-finite numbers:** one
  helper, `to_number`, parses trade quantity, price and gross amount (section 1), quote prices (section 8) and FX rates
  (section 9c); `inf` and `nan` read as unreadable, never as a value. The amount check is written so a difference that
  is not a number never passes. (3) **Odd vendor:** on a backed line it is never the chosen vendor (the vendors that
  disagree with the chosen quote come first); on a "chosen is odd" line it is the chosen vendor; otherwise any vendor;
  then the farthest from the median, ties by vendor name. (4) **Blank master currency:** treated as no currency, so a
  quoted security mastered with a blank currency is not evaluable for coverage (as an unmastered one is) and a quote
  with a blank currency can never match it. A blank quote price stays a coverage fail. (5) **Lag line names:**
  "Settlement later than the lag limit with no agreed extension" and "… with an agreed extension"; the how-detected
  text states the live T+n. (6) A fixture case for an FX rate dated DD/MM/YYYY.
- **Why:** RULES.md says the link must point to an existing transaction, and only CANCELLED rows were checked for it.
  CLAUDE.md says unreadable values are kept and reported, but `pd.to_numeric` reads `inf` as a number. The cleared
  backed line said "the odd vendor is logged for the vendor owner" while naming the vendor we price from. A blank
  currency is unknown, as a missing security is, and D-041 keeps the absence of a price as the evidence of a fail.
  Stable lag names keep the plain wording and the docs true when a judge changes the limit live.
- **Instead of:** a separate line for BOOKED and REVERSED links to a missing ID, or recording the gap only; filtering
  non-finite values inside the new checks only, or in every number parse of the notebook; keeping the T+n names.
- **Moves:** on the full data no count moves and the first 47 register lines are byte-identical. Three line names
  change (FINDINGS.md), finding members are identical apart from those names, and the how-detected text changes on
  the five vendor-flag lines, the two lag lines and the link line. In `outputs/02_price_quality.csv` only
  `odd_vendor` moves: on 19 backed spread-flagged securities the chosen vendor was named as the odd one, and now none
  is. The release has no `inf` or `nan` text, no BOOKED or REVERSED link to a missing ID and no blank master currency.
  D-067's known limit on the lag line names no longer applies.

### D-069 · 10 Nov · Scorecard and indicators: scores with coverage, a sensitivity check, eight indicators, a look-back, the seven KPIs with values, and the two rules behind KPI 1

Design: `docs/superpowers/specs/2026-11-10-scorecard-design.md` (user decisions in §5, choices taken during the build
in §8); plan: `docs/superpowers/plans/2026-11-10-scorecard.md`.

- **Decision:** a new section 12 of `notebooks/deliverable.ipynb` (the run record is now section 13) scores every rule,
  domain, account and the platform, with coverage and a confirmed-only bound beside every score; runs a sensitivity
  check; computes eight indicators with daily and weekly series, a retrospective look-back for the leading ones, and
  the seven Check-in 1 KPIs with values. Outputs: `outputs/02_score_outcomes.csv`, `02_scorecard.csv`,
  `02_scorecard_accounts.csv`, `02_scorecard_sensitivity.csv`, `02_indicators.csv`, `02_indicator_series.csv`,
  `02_indicator_lookback.csv`, `02_kpis.csv`. Weights, the register-line mapping, the indicator catalog and the KPI
  targets live in a new `config/scorecard.toml` (read through `SCORECARD_CONFIG`). Section 9c also codes the two rules
  behind KPI 1, `TXN_SECURITY_NOT_MASTERED` and `ACC_NOT_OPEN_ON_TRADE_DATE`, as eight register lines at the end.
- **Why (the user's decisions, spec §5):** domains are the seven check areas, each with its D-002 owner. A rule is
  split into tests that each count one unit kind; a rule scores the average of its tests, a domain the weighted average
  of its rules, the platform the weighted average of its domains, all weights equal to start. Confirmed and unresolved
  findings both fail, cleared passes, and the confirmed-only score is reported beside as the best case. An account
  scores its own records plus problems it inherits through what it holds; its fund's NAV result is shown beside it,
  not in it. The sensitivity check varies the weights (NAV-proximity, a team assumption set before looking), the
  aggregation (weakest link) and the evidence rule (confirmed-only). The look-back claims a lead only on shared keys
  and lists the misses; it is retrospective, not predictive accuracy (brief App. B).
- **Supersedes in part:**
  - **D-002**'s "seven KPIs roll up to one platform score": the platform score rolls up from rules and domains, because
    the rules cover more of our checks than the KPIs; the KPIs are the office view beside it
    (`scripts/framework.json` `rollup` updated).
  - **D-050**'s "no combined score" is scoped to the severity measures (dollars and account counts: different units,
    unknown values). The quality scores combine pass rates, one unit, always beside their coverage, as brief §5
    requires.
  - **D-066**: the two rules behind KPI 1 are coded, a narrow exception, so six of the seven KPIs have values and the
    Accounts and Securities domains have real tests. KPI 7 stays proposed: it needs `NAV_OPEN_ISSUES_BEFORE_RELEASE`
    and a materiality threshold (open question 5). The other uncoded rules stay proposed controls.
- **Building rulings:** spec §8 is the record of every decision taken while building (as D-067 did with its spec
  §10); DECISIONS holds the treatment and scope choices. The ones a reader of the numbers needs: scores are rounded down to two decimals, so a score with any failure
  never prints 100.00 (the spec first said one decimal); an account's status is its status at extract time and the
  dates decide whether it was open, so a trade on an account closed later is a cleared look-alike line; a
  corporate-action holder takes its action's own outcomes, so the account and domain views agree; a summary register
  line is never scored and is checked against the union of its breakdown lines; only units that are not a plain pass
  are written to `02_score_outcomes.csv` (passes are counted). Where every corporate action is quarantined or flagged
  (`outputs/02_ca_readiness.csv` shows it for this release), the corporate-action look-back share is near complete by
  construction and is not evidence of predictive reach.
- **Instead of:** an urgency ranking of defects (it waits for the executive view and needs its own decision, because it
  mixes dollars, accounts and fix cost); exposure-based weights (unknown dollars would drift into the score); a dashboard
  page now (step 4); a predictive model (optional in brief §5).
- **Moves:** every existing register line is byte-identical and still first; the eight KPI 1 lines are appended at the end
  (names in `outputs/02_defect_register.csv`; new checksum in FINDINGS.md). Every other pre-existing `02_*` output is
  byte-identical except `02_finding_members.csv` (the new lines' members added), `02_row_ledger.csv` (lines for
  section 12) and the run record. Section 8b's quote logic became a function of the price date (`quote_rule`) for the
  price indicator; `02_price_quality.csv` is unchanged. The store gains eight tables; FINDINGS.md gains a generated
  scorecard section. Robustness: three shuffles give identical outputs, and a live domain-weight change moves only
  the platform, account and sensitivity-platform scores (`tests/robustness_test.sh`).

### D-070 · 11 Nov · Stress test: 100x prices injected into a random sample of held equities, scored against the planted truth

Design: `docs/superpowers/specs/2026-11-11-stress-test-design.md` (user decisions in §5, choices taken during the build
in §8); plan: `docs/superpowers/plans/2026-11-11-stress-test.md`.

- **Decision:** `tests/stress_test.sh` runs the deliverable notebook unchanged on the release and on a copy of it
  (under the gitignored `tests/runs/`) in which `scripts/stress.py` multiplies one snapshot quote by 100 for each case
  of a seeded random sample of held equities: **defects** (the chosen vendor's quote), **look-alikes** (another vendor's
  quote; the chosen quote stays right) and **priority flips** (as a look-alike, with that vendor swapped to preferred).
  Sample sizes, seed, multiplier and the map from register line to verdict level live in `tests/stress/cases.toml`,
  which the detection code never reads. Each case is scored against the truth we planted: caught / partial / missed for
  defects and flips, cleared / sent to review / false positive for look-alikes, plus false positives on securities
  nobody touched. Outputs: `outputs/03_stress_changes.csv`, `03_stress_cases.csv`, `03_stress_rates.csv`,
  `03_stress_unexplained.csv`, `03_stress_impact.csv`, `03_stress_members.csv` (every register-member change, for
  audit) and `03_stress_run.csv` (config, labels checksum, seed, time; old outputs are removed before a run); the numbers are in the generated "Stress test" section of FINDINGS.md.
- **Why (the user's decisions, spec §5):** the rule under test is `PRC_VENDOR_DISPERSION`, because a 100x price has a
  small base of real flags (one injected case is visible), a real money effect, and a look-alike that differs from the
  defect only in which vendor sent the bad quote. Misses and false positives can only be counted against a known
  truth, so we inject rather than sample real records; to stay realistic the cases go into a random sample, not a
  cleaned set, and the result is rates. Equities only: their quote basis supports a dollar figure (the deliverable
  values no bond). Three-level scoring keeps "confirmed" apart from "someone must look". The look-alike is "valid for
  NAV" only: the backup vendor's quote is still wrong.
- **Building rulings:**
  - VENDOR_B, not VENDOR_C, carries the look-alike and flip quote: every C quote is stamped after the 18:00 cutoff, so
    a flip onto C would also fail freshness.
  - The pool leaves out securities section 8 already flags (no known truth there); when securities with a second
    vendor are scarce, look-alikes and flips split them evenly, and an empty role stops the run.
  - The labels were frozen before the first injected run by recording their sha256
    (`c768055d64f341b8a9f676d981844cf85a6ad19b2d23d2400fadd40d21958023`), not by a commit mid-build.
  - The run exits non-zero only on a false positive on an untouched security or a change that cannot be tied to an
    injected security; misses, partials and review cases are results.
  - Output files without a `security_id` column (for example `02_scorecard_accounts.csv`, `02_account_membership.csv`)
    are reported as aggregate changes and cannot fail the run by themselves; the member-level check covers every
    register line. The 11 Nov run was checked by hand on both: every changed account holds an injected security.
  - The impact is the stress script's own measure (quantity × (injected − original chosen price) × FX, per fund, in bps
    of the deliverable's fund net assets); the deliverable's severity "scale flag" row is shown beside it as an upper
    bound, because it values look-alikes too.
- **Read the rates as:** detection on the sample drawn (held equities whose vendor check passes on the snapshot), not a
  general detection rate.
  The pool comes from the clean run, so a rerun with another threshold may draw other securities: compare rates, not
  per-case rows, across configs. Each run records its config, labels checksum and seed in `03_stress_run.csv`.
- **Known label slip:** `tests/stress/cases.toml` skips `02_row_ledger.csv` as "run metadata only"; it is the row
  accounting, and one of its rows moves in the injected run. It has no `security_id`, so it could only ever be an
  aggregate change and cannot affect the result. The labels are frozen, so the comment is left as it is; a correction
  would go in its own commit, named in this entry.
- **Negative check:** with a scale band that excludes 100 (`scale_ratio_low` 150, `scale_ratio_high` 200, in a copy
  of the config under `tests/runs/`), the 100x quotes fall into the spread test, defects and flips score partial and
  look-alikes stay cleared, so the band setting matters (result in STATUS).
- **Limitation:** a genuine 1:100 reverse split (every record correct) would show as a position break, because the
  rebuild does not apply corporate actions (D-016); it was not built.
- **Instead of:** three hand-picked clean securities (unrealistic, no rates); a genuine reverse-split control; changing
  the deliverable's severity section to value scale flags (a possible later job); a dashboard page now (step 4).
- **Moves:** nothing in `outputs/02_*`, the deliverable notebook or the config (checksums identical before and after).

### D-071 · 11 Nov · Executive view: one page for the Chief Data Officer's three questions, with drill-down to the records, and one new notebook output behind the account page

Design: `docs/superpowers/specs/2026-11-11-executive-view-design.md` (user decisions in §5, choices taken during the
build in §8); plan: `docs/superpowers/plans/2026-11-11-executive-view.md`.

- **Decision:** the dashboard gains an "Executive view" at `/executive` (brief §5 Dashboard: "one functional executive
  view with a working drill-down to record-level evidence"). It presents what the deliverable and the stress test
  already compute and adds no check, score or formula (D-066):
  - **Top to bottom, the three questions brief §2 gives the Chief Data Officer, plus one:** headline tiles (platform
    score with coverage and confirmed-only score; the largest priced impact scenario; leading indicators breaching);
    "Where is the platform degrading?" (domain scores, the eight indicators, the seven KPIs by office, the worst
    accounts); "What should we fix first?"; "Can we trust these numbers?" (stress test and sensitivity check).
  - **"Fix first" is one switch with two lists, never one merged rank:** the scored rules by lowest quality score, or
    the impact scenarios by largest dollars, with a separate group for scenarios that have records but nothing valued
    ("Not priced: unknown, not zero") and one for scenarios with no records.
  - **Three drill-down paths, each ending on the existing Trace page:** a rule opens its tests and every listed unit;
    an account (from the worst-accounts list or a lookup) opens its scores by domain and every record behind them; an
    impact scenario opens its account and security keys with their dollar figure.
  - **One additive notebook output:** section 12b of `notebooks/deliverable.ipynb` writes
    `outputs/02_account_outcomes.csv`, one row per unit that reaches an account and is not a plain pass, own and
    inherited through holdings alike, and a CHECK ties its counts per account and test to the account scores.
  - **The store copies six more files** (`severity`, `impact_detail`, `account_outcomes`, `stress_rates`,
    `stress_impact`, `stress_run`) and a plain name for every scored rule (`scripts/plain_language.json`, block
    `rules`).
- **Why (the user's decisions, spec §5):**
  - A page that reads top to bottom tells the story (Check-in 1 feedback) better than a one-screen grid or tabs.
  - The user wanted both orders, by lowest score and by largest dollars. Dollars exist per impact scenario, not per
    rule, and scenarios overlap, so a merged order would need a new scenario-to-rule mapping and a rule for
    overlapping scenarios. A switch keeps both orders and invents nothing.
  - A page per rule (not a side panel) has room for the records and its own address for the presentation.
  - Accounts get a page of their own because brief App. C asks whether two accounts with the same score have the same
    problems; the per-domain scores answer it.
  - The account page would otherwise show a Prices or Corporate actions score with no records behind it: those units
    were counted inside the notebook and never written. The user chose to write them now rather than say so on the
    page.
- **Interpretations a reader of the page needs:**
  - **D-050's "no combined score" stands.** The switch orders two existing lists; the "largest impact scenario" tile
    is one scenario, not a total; scenarios are never added up. The urgency ranking discussed on 10 Nov (exposure,
    accounts touched, fix cost in one rank) is not built; it would need its own entry.
  - **Fail counts are shown per test, never as a rule total:** a rule can have tests that count different units
    (trade rows and transaction IDs), so their counts cannot be added. The rule list shows one line per test.
  - **A unit is listed once on a rule page.** `outputs/02_score_outcomes.csv` lists a transaction ID once per account
    its copies name, and the scorecard counts it once; the rule page folds those rows into one record with its
    accounts side by side, so the lists equal what the tests counted. On an account page the same ID is one unit of
    each account, as in the account scores.
  - **Scores always come with coverage and the confirmed-only score** (brief §5), with two exceptions the outputs
    impose: an account's per-domain scores have coverage only, and the sensitivity variants are shown as alternatives
    beside the main score.
  - **A blank stays a blank:** "not priced", "not computed", "not applicable"; never 0 (D-050). Scores and shares are
    cut, never rounded up, so "100" always means complete.
  - **Trace links:** a price row opens its security; an FX rate row and a feed-day have no single record to trace
    (D-056 keeps currency findings off traces).
  - **The stress section** shows the rates, the changes on untouched securities, the deliverable's own measures
    before and after, and the run's seed, sizes, multiplier, finish time and short labels checksum; never a file
    path. It says so when the stress test has not been run, and warns when its "before" platform score differs from
    the scorecard's (an older run).
- **Building rulings:** spec §8 is the record. The ones that change what a reader sees: the page lives at `/executive`
  and is first in the sidebar while the Data map stays the home page; the worst-accounts list shows ten rows with a
  note when the cut falls inside a tie; indicators with a daily or effective-date series get a small trend line; the
  plain rule names are our wording and wait for the team's review.
- **Instead of:** a combined urgency rank; a scenario-to-rule mapping to give every rule a dollar column; noting the
  inherited-records gap on the page without closing it; a richer test fixture (the two cases the small fixture lacks
  are tested on a copy of the fixture store); a per-fund impact table; the three office wireframes (the final).
- **Moves:** nothing that existed. Every pre-existing `outputs/02_*` file is byte-identical before and after, the run
  record aside; the register and scorecard checksums in FINDINGS.md are unchanged; the stress rates are unchanged on
  the rerun (the new file appears there only as a consequence on the injected securities). New:
  `outputs/02_account_outcomes.csv`, the six store tables, the four pages under `dashboard/app/executive/`.
- **Reviewed:** one review per task for the notebook, the store, the view logic and the reads; one combined review
  for the five page tasks; a whole-branch review. Every finding rated Important was fixed, among them: an account's
  per-domain scores shown without coverage; fractional unit changes rounded to whole units (now shown as stored);
  one plain rule name that claimed more than its rule checks; and example figures copied from real outputs into a
  test file, code comments and the plan (replaced by invented values). The notes kept unfixed are listed in spec §8.

### D-072 · 12 Nov · Executive view trend charts: axes, a threshold line and a hover box; the range includes the threshold

- **Decision:** each indicator chart on the executive view shows its unit, the values at the bottom and top of its
  range, the first and last dates with the series period ("Date (one point per day)" or "Effective date"), and a
  dashed line at each threshold. Hovering over a chart, or focusing it and using the arrow keys, shows the nearest
  point's date, value, threshold and whether it breached. The vertical range runs from the lowest to the highest of
  the values and the thresholds.
- **Why:** the charts had no axes and stretched every line to fill its box, so a one-unit wiggle looked like a large
  swing and a red dot gave no reason. With the threshold inside the range, the distance to the limit is visible: a
  series far below its limit draws as a nearly flat line, and a series that breaches throughout sits on the wrong side
  of the dashed line. The data comes unchanged from `indicator_series`.

### D-073 · 16 Nov · Half-credit for unresolved scorecard cases

- **Decision:** the main score gives one point to a pass or a cleared case, half a point to an unresolved-only
  failure, and zero to a confirmed failure. Within a test, a confirmed failure takes precedence over an unresolved
  one. Divide the earned points by evaluable units and apply the existing test, rule and domain weights.
- **Why:** an unresolved finding identifies an exception for review. Half-credit reflects that uncertainty in the
  headline score while the confirmed and unresolved counts still show the work to investigate.
- **Rerun:** `config/scorecard.toml` sets the credit. The notebook uses it for both the platform and account rollups and
  records it in the run metadata. Coverage, the confirmed-only comparison and the KPI calculations retain their
  existing definitions.
