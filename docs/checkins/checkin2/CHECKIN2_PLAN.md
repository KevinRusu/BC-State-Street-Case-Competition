# Check-in 2 plan: the method gate (Mon 19 Oct 2026)

*Agreed 16 Oct 2026 · for the team building over the weekend · read with `docs/STATUS.md` and `docs/DECISIONS.md`; data conventions in `reference/02_Dataset_Guide.md`*

## 1. Why, and what success looks like

Check-in 2 is the method gate. We should leave it **cleared to build the full analysis**. Faculty will ask the three Working Guide questions:

1. Does the rebuild run on the full data?
2. How many breaks, classified how?
3. What did we assume about REVERSED, and what else could it mean?

From Check-in 1 feedback: tell a story, explain the data well, keep it simple.

**Success on Monday:** notebook 02 runs live on the full data. Every number has a denominator. Every treatment decision is shown with its alternative and its effect. One record is traced hop by hop with evidence.

**Non-goals for Monday:**

- the event-adjusted corporate-action scenario (final)
- the `src/` package and `run_all.py` (after Check-in 2)
- scores, KPIs, dashboard, timeliness
- the 869 float-noise quantities (noted, not analysed)
- full valuation and the price fallback waterfall

**Anti-goals** (a failure even if the code runs):

- a match rate that silently includes keys we know are suspect
- any silent repair (absolute values, blank = 0)
- any double offset
- hard-coded record IDs
- AI choosing a class
- forcing an unexplained break into a named class

## 2. Decisions agreed (16 Oct)

| Topic | Main chain | Shown beside it | Why |
|---|---|---|---|
| 42 keys whose trades net to zero, absent from both `positions` and `comparison_positions` | Own category: **only in rebuild, nets to zero**. Outside the match rate, inside the union total | Candidate **cleared flag** (a closed position is not reported) | The Guide: absence is not a confirmed zero; any zero convention must be justified |
| 45 conflicting duplicate pairs (90 rows) | Keys they touch are **not evaluable** | One-line sensitivity: keep first / keep second / drop both (3 keys or fewer of difference) | We can't know which copy is right; keep-first depends on row order |
| REVERSED | **R1: BOOKED-only** leads (the original stands; the REVERSED row only marks a status) | **R3: one offset per original**, on the 699 keys with a reversal. R2 = R3 in quantity but hides 35 keys, so it is dropped. R4 shown only as "what the book seems to do" | R1 is the Guide's shared benchmark; no double offsets |
| Negative quantities (655, all BUY) | **Raw sign kept**. Every key touched gets a **sign conflict** flag, even when it matches | Absolute value as a labelled sensitivity | "Raw first"; a match with the book is not proof, because the book carries the same sign |
| Blank quantities (2,819) | Key **not evaluable** | Blank-as-zero sensitivity (about +2,600 matches), which is evidence of the book's convention | Unknown never becomes zero; untestable never raises a score |
| Holding date | **Trade date** is the main version | Settlement-date version reported beside it (counts only) | `positions` is a trade-date book (87.7% match on settlement date) |
| Format | **Short deck (8 to 10 slides) + live notebook** | | Story on slides; the notebook proves the rebuild runs on the full data |
| Code home | **`notebooks/02_reconcile.ipynb`** | Moves into `src/` + `run_all.py` after Check-in 2 | Fastest path to a readable, runnable method for Monday |
| Break classification | **Two layers:** who disagrees, then an ordered cause rule. **One main class per key**; flags on top | | Totals add up; no double counting (brief §5) |
| Trace | A **negative-quantity BUY**, picked by a written rule | ACC4683357 / SEC460917 kept as a second trace for the final (100x price) | Confirmed status, every hop observable, independent evidence (`gross_amount`) |
| Checks run on full data | **NAV arithmetic** and **vendor scale and spread** | Coverage and freshness: proposed (coverage partly evidenced in notebook 01) | NAV arithmetic is required back-office work; scale ties to the 100x price defects |
| Corporate actions | **Supported** = the type's required terms are present and, for MERGER/SPINOFF, the target exists and is mastered | Extra terms and ex-date after effective date are flagged **unresolved**, not quarantined, pending faculty definitions | Keeps a usable supported set; the 31 mergers and 23 spin-offs are quarantined under any rule |
| Defect classes taken forward | **Four:** spin-off targets never set up · negative-quantity BUYs · duplicate trade copies counted · custodian missing 480 holdings | All 27 findings stay in a one-line register | Spread across master data, trade capture, pipeline and reconciliation; the final needs at least 3 traced |

**The main chain equals notebook 01's C7** (dedup → conflicts not evaluable → drop CANCELLED → R1 → negatives raw → blanks not evaluable → trade-date cut-off). Expected against `positions`:

- matched 473,944 · different 3,656
- not evaluable (in both) 2,679 · not evaluable (only in rebuild) 157
- only in rebuild, nets to zero 42 · only in `positions` 384
- keys in union 480,862

Notebook 02 must reproduce these from `outputs/01_rebuild_steps.csv` before doing anything new.

## 3. The work, in build order

### 3.1 Notebook 02 setup and the waterfall

- Load the ten tables as in notebook 01: DuckDB, `all_varchar=true`, explicit casts, failures kept. Read thresholds and policies from a new **`config/reconciliation.toml`** (stdlib `tomllib`, no new dependency).
- Keep a **row ledger** for every load, filter and join (rows in, rows out, why), shown as a table in the notebook.
- **Waterfall slide data:** raw benchmark (C0) → BOOKED-only (Guide benchmark) → our chain (C7). For each: matched, different, only-in-each-side, not evaluable, union, rate A, rate B.
- Add the four sensitivities from §2 as one compact table.
- **Assert** that the chain reproduces the C7 numbers above.

### 3.2 Three-way reconciliation (rebuild · book · custodian)

- **Step 1, book vs custodian alone:** full outer join of `positions` and `comparison_positions` on account + security + as_of_date. On all 480,183 keys in both: matched / different. Also 480 only in book, 0 only in custodian. This is independent of the rebuild, so rebuild-unevaluable keys still get a book-vs-custodian answer.
- **Step 2, add the rebuild as the third source:** union of all three key sets, with **one layer-1 pattern per key**:
  - all three agree
  - book is the odd one out
  - custodian is the odd one out
  - rebuild is the odd one out
  - all three differ
  - one-sided patterns:
    - book + custodian, no trades (about 384)
    - rebuild + book, no custodian (about 480)
    - rebuild only, nets to zero (about 42)
    - rebuild only, nonzero
  - not evaluable: conflict, blank, or both
  - Counts in brackets are notebook 01's. Under the chain they may shift slightly; report what the chain gives.
- **Check:** the pattern counts must add up exactly to the union. Agreement uses `quantity_match_tolerance` (1e-6).
- **Expectation to test, not assume:** the 01 sensitivities suggest the custodian shares the book's duplicate and REVERSED conventions. If so, those keys land in "rebuild is the odd one out", and that is unresolved, not confirmed.

### 3.3 Break classification (layer 2: cause)

- Rules are tested **in a fixed order**, and the first match sets the main class. Rules and order go in the config and are written before looking at the counts.
- Each rule is tested on the difference between the **odd source** and the rebuild. When book = custodian, that is one difference; when all three differ, test book and custodian separately and use the first rule either one meets.
- **Starting set:**
  1. **Book counts duplicate copies:** book − rebuild = signed quantity of the removed copies
  2. **Book double-offsets REVERSED:** book − rebuild = −Σ signed REVERSED quantities on the key
  3. **Both 1 and 2:** the difference equals their sum
  4. **Custodian on a settlement-date basis:** custodian = the settlement-date rebuild
  5. **Unexplained:** stays visible
- **Flags** (do not change the class):
  - sign conflict (negative-quantity BUY)
  - rebook keeps the old gross amount
- **R3 side view:** rerun only the 699 reversal keys under R3 and show how their pattern and class move.
- The builder may add a rule if a large unexplained group appears. Each new rule must be written down with its population and be testable.

### 3.4 The evidenced trace: one negative-quantity BUY

- **Selection rule** (in config, no IDs): among keys with a sign-conflict flag, present in all three sources and with no other flag, take the first by (account_id, security_id, transaction_id). If no key qualifies, drop the "no other flag" condition and say so.
- **Hops** (Working Guide §4 table, each marked *observed* or *inferred*):
  1. **Source:** the `transactions` row as delivered (BUY, quantity −X, `gross_amount` / price = +X, source_system)
  2. **Pipeline:** the `pipeline_events` row (timestamps, batch, cutoff). Do other negative quantities cluster in the same source or batch?
  3. **Position:** the book equals the raw rebuild with −X; the absolute-value version differs by 2X
  4. **Custodian:** does `comparison_positions` share the error or not?
  5. **Downstream:** the account's fund and share class in `ledger_nav`. Units misstated, plus an *indicative* exposure in bps of fund net assets, labelled as exposure, not loss, with the ledger-currency assumption stated.
- **Control that would catch it:** `TXN_FIELDS_VALID` (quantity > 0; |gross_amount − quantity × price| ≤ 0.01) at trade capture, owned by the Trade operations lead, on fail: reject.

### 3.5 Price and ledger checks

- **Run on full data:**
  - **NAV arithmetic** on all 2,000 `ledger_nav` rows:
    - fund + class + date unique
    - shares_outstanding > 0
    - |net_assets / shares_outstanding − nav_per_share| ≤ tolerance
    - Set the tolerance from the stored precision of `nav_per_share` and state it in the config before running.
    - Report missing, zero and unparseable inputs separately. Never sum nav_per_share. A residual is "to investigate".
  - **Vendor scale and spread** for held securities on 10 July:
    - spread (max − min) / mean ≤ 0.5%
    - a separate **scale flag** when the max/min ratio falls in a band around 100 (band in config)
    - Single-quote and no-quote securities reported apart; currency conflicts kept visible.
- **Proposed (rule + threshold + denominator, not run):** holding coverage with vendor fallback, freshness (timestamp vs price_date and cutoff, flat runs as look-alikes), FX validity (USD ≠ 1 stays open with faculty). Rule ids from `docs/RULES.md` §6 and §7.

### 3.6 Corporate actions: supported vs quarantined

- **Write the required-terms table per `action_type` into the config before counting** (Guide ratio conventions: split = post per pre; merger = target per source; spin-off = extra target per source; dividend = cash_rate; redemption needs terms for extinguished units and cash).
- **One readiness row per event:**
  - type
  - required terms present
  - target present / mastered
  - extra terms (flag)
  - ex-date after effective date (flag)
  - verdict: supported or quarantined, with a reason code
  - **candidate holders:** accounts holding the source security in the trade-date rebuild just before ex_date
- **For each quarantine reason:** the missing contract and the evidence that would release it.
- The event-adjusted scenario waits for the final. It must stay separate from the trade-only rebuild.

### 3.7 Defect catalog

- **Register:** all 27 notebook 01 findings plus the new Check-in 2 ones (break classes, NAV, vendor scale), one line each:
  - name, status (confirmed / unresolved / cleared)
  - rule
  - affected / eligible / not evaluable
  - stage
  - 2 or 3 example IDs produced by the code (first by sort order, never typed in)
- **Rule gaps are fixed as they come up.** Part One is not revised before starting. When a finding has no rule in `docs/RULES.md`, write "gap" in its rule column and add the rule to `docs/RULES.md` then, under one of the existing seven checks. Likely gaps:
  - position keys missing from the account or security master
  - a price currency with no FX rate
  - more than one REVERSED row per original
  - `pipeline_events` not one-to-one with `transactions`
- **Full seven-question write-ups** (Working Guide §6) for the four classes taken forward, plus the 42 zero-net keys as the first **cleared-flag candidate**:
  - **Rule:** a key whose trades net to zero within tolerance and that neither book nor custodian reports is a closed position.
  - **Independent evidence:** the custodian's matching absence, and whether `positions` ever stores a zero-quantity row.
  - **What would change our mind:** zero rows stored elsewhere in `positions`.

## 4. Files

| File | What |
|---|---|
| `notebooks/02_reconcile.ipynb` | Sections 3.1 to 3.7, top to bottom, run live |
| `config/reconciliation.toml` | Snapshot date, tolerances, policy switches (conflicts, REVERSED main/side reading, negatives, blanks), cause-rule order, NAV tolerance, spread threshold, scale band, CA required terms, trace selection rule |
| `outputs/02_waterfall.csv`, `02_sensitivities.csv`, `02_three_way_summary.csv`, `02_break_classes.csv`, `02_trace.csv`, `02_nav_check.csv`, `02_vendor_check.csv`, `02_ca_readiness.csv`, `02_defect_register.csv` | Results (gitignored; rebuilt by the notebook) |
| `docs/DEFECT_CATALOG.md` | The five full write-ups; carried forward to the final |
| `docs/checkins/checkin2/Checkin2.pptx` | The deck, in the style of `docs/checkins/checkin1/State_Street_Presentation.pptx`; every number copied from an `outputs/02_*` file |

Reuse: notebook 01's loading and date-parsing pattern and its §9 chain logic; rule ids and wording from `docs/RULES.md`.

## 5. Deck outline (8 to 10 slides, answer first)

1. **The answer:** the rebuild runs on all 1.41M trades; X% of comparable keys agree three ways; N breaks in K classes; the biggest cause is Y.
2. **Waterfall:** raw → BOOKED-only → our chain, with denominators.
3. **Our decisions:** the §2 table, cut to its main rows, with alternatives and effects.
4. **Three-way reconciliation:** who disagrees, with the union denominator.
5. **Break classes:** counts per class, unexplained shown.
6. **The trace:** the negative BUY, hop by hop, observed vs inferred.
7. **Price and ledger checks:** two run, the rest proposed.
8. **Corporate actions:** supported vs quarantined, reason codes, the missing contracts.
9. **Defect catalog:** the four classes taken forward (with where each entered and the control that would fix it, from the write-ups) and the cleared-flag candidate.
10. **Questions for faculty:**
    - the REVERSED contract (an explicit event-operation field, one reversal per original)
    - corporate-action date definitions
    - the USD rate
    - the book's duplicate and REVERSED conventions

Backup: full sensitivities, R3 side view, register.

## 6. Weekend schedule (owners: team to fill)

| When | Work | Owner |
|---|---|---|
| Sat 17 | 3.1 waterfall + C7 reproduced · 3.2 three-way · start 3.3 | |
| Sat 17 | 3.5 NAV + vendor checks · 3.6 CA readiness (independent of the rebuild) | |
| Sun 18 | Finish 3.3 · 3.4 trace · 3.7 register and write-ups | |
| Sun 18 evening | Deck from `outputs/02_*` · clean-kernel full run, timed | |
| Mon 19 morning | Dry run: each member explains one slide and one number | |

If time runs short, cut in this order: the R3 side view, the cleared-flag write-up, then the vendor check. Never cut the waterfall, the three-way, the classification or the trace.

## 6b. Tasks for `superpowers:executing-plans` (code deliverables only)

Run inline, one task at a time. A task is done only when its check passes. If a check fails, stop and look before changing anything.

| # | Task | Check before moving on |
|---|---|---|
| T1 | `config/reconciliation.toml` + notebook 02 skeleton: load the ten tables as text, explicit casts, row ledger | Row counts equal the manifest for all ten tables |
| T2 | Rebuild chain, waterfall and the four sensitivities (§3.1) | Reproduces `01_rebuild_steps.csv` exactly: C0 471,746 / 5,880 · BOOKED-only 476,014 / 1,625 · C7 473,944 / 3,656 |
| T3 | Book vs custodian on the full outer join (§3.2 step 1) | 480,183 in both · 480 only in book · 0 only in custodian |
| T4 | Three-way layer-1 patterns (§3.2 step 2) | Pattern counts add up exactly to the union |
| T5 | Cause rules, flags, R3 side view (§3.3) | Classes add up to the union; the unexplained count is shown |
| T6 | Trace selection and hop tables (§3.4) | Record picked by the config rule; no literal IDs in the notebook source |
| T7 | NAV arithmetic (§3.5) | pass + fail + not evaluable = 2,000 |
| T8 | Vendor scale and spread (§3.5) | Evaluated + single-quote + no-quote = held securities |
| T9 | Corporate-action readiness (§3.6) | 200 events; at least the 31 mergers and 23 spin-offs quarantined |
| T10 | Defect register (§3.7) | Example IDs come from outputs only; every finding has a status and denominators |
| T11 | Clean-kernel full run, shuffle test, one threshold rehearsal | Same numbers after shuffling; runtime and versions recorded |

Not part of this run (team work): `docs/DEFECT_CATALOG.md` write-ups, the deck, the dry run.

## 7. How we verify it

- Restart the kernel and *Run All* on the full data. Record runtime, hardware and package versions.
- The C7 numbers in §2 match `outputs/01_rebuild_steps.csv` exactly.
- The layer-1 patterns and the layer-2 classes each **add up exactly to the union** (asserted in the notebook).
- **Shuffle test:** rerun the chain and the classification on shuffled `transactions` rows; identical counts (one cell).
- **Threshold rehearsal:** change one config value (spread threshold or quantity tolerance), rerun, and explain the move. Judges may do this live.
- No record IDs in code: search the notebook source for literal `ACC`/`SEC`/`TXN`/`CA0` IDs. Example IDs come only from outputs.
- Every number on the deck traces to an `outputs/02_*` file.

## 8. Left to the builder

- Exact cell layout of the notebook and the output column names.
- The vendor scale band and NAV tolerance values (stated in the config, with the reasoning, before running).
- Extra cause rules, if a large unexplained group appears: written down, ordered and counted.
- The indicative bps measure in the trace (optional; units misstated is the minimum).
- Chart style for the deck (use the dataviz guidance).
