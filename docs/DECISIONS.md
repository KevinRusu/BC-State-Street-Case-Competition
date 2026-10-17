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
