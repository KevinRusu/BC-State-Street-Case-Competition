# Project summary: where we are and what comes next

*State Street case, BC Fall into BC Case Competition · written 15 Oct 2026, after Check-in 1 · start here when you open the project in Claude Code*

---

## 1. The competition in short

- **The question:** how should a fund platform catch bad data early, before it reaches the fund's daily price (the NAV)?
- **Part One (architecture):** where the checks sit, who owns them, what we measure. Done for Check-in 1.
- **Part Two (demonstration):** code that runs on the full data, finds real problems, traces them back to where they started, scores data quality and shows it in a dashboard.
- **Dates:**
  - Check-in 2: week of 19 Oct (method gate)
  - Check-in 3: week of 9 Nov (everything coherent, full slide draft)
  - Report, dashboard, code and slides due: week of 16 Nov
  - Final presentation: Fri 20 Nov (15 min talk + 10 min questions, everyone speaks)
- **Rubric:** architecture 25% · detection and reconciliation 25% · business insight 20% · KPIs 10% · dashboard 10% · reproducibility 10%.
- **Source of truth:** `reference/01_Student_Brief.md`. If anything here disagrees with the brief, the brief wins.

## 2. Feedback from Check-in 1

- We presented and are on a good track.
- For the final, **tell a story**. Don't just list results.
- The team that **explains the data best** and has **good visuals** wins, ideally an **interactive dashboard or small app**.
- The brief already requires one working executive view with **drill-down to record-level evidence**, plus wireframes for the three offices.

## 3. What we built for Check-in 1 (files)

| File | What it is |
|---|---|
| `docs/presentations/State_Street_Presentation.pptx` | The deck we presented (slides 11 to 19 are the architecture) |
| `docs/notes/PRESENTATION_NOTES.md` | Simple talking points for slides 11 to 19 |
| `docs/checkin1/CHECKIN1_REPORT.md` + `docs/checkin1/CHECKIN1_REPORT.pdf` | 9-page report: problem, approach, findings |
| `docs/Framework.xlsx` | All framework tables, one tab each |
| `docs/notes/RULES_DRAFT.md` | **The detailed rules under each check. Starting point for the code.** |
| `docs/notes/DELIVERABLES_GUIDE.md` | Glossary, likely faculty questions, findings |
| `docs/checkin1/Checkin1_Pack.pptx`, `docs/presentations/Explainer_Deck.pptx` | Earlier faculty deck and the study deck that explains the business from zero |
| `docs/notes/OVERVIEW.md` | Earlier team plan; Part Two ideas still useful, Check-in 1 parts are out of date |
| `notebooks/checkin1_evidence.ipynb` | DuckDB notebook that re-checks every number we quoted |
| `docs/figures/` + `scripts/` | Diagrams and the scripts that draw them (`framework.json` holds the framework content) |

## 4. Our framework (keep it simple)

- **3 offices:** front (creates trades), middle (books, prices, reconciles), back (books and NAV). Custodian and price vendors are outside sources, not offices.
- **5 stages:** accounts → securities → transactions → positions → NAV and ledger.
- **6 handoffs, 7 checks**, one owner each:

| # | Check | Owner | If it fails |
|---|---|---|---|
| 1 | Account check | Account onboarding lead | Hold the trade |
| 2 | Security check | Security master lead | Hold until the security is set up |
| 3 | Trade check | Trade operations lead | Reject or hold |
| 4 | Corporate action check | Corporate actions lead | Quarantine the event |
| 5 | Position check | Reconciliation lead | Flag a break and work it |
| 6 | Price check | Pricing lead | Next vendor, or flag |
| 7 | NAV check | Fund accounting lead | Hold the NAV |

- **7 KPIs** (2 front, 3 middle, 2 back office), rolling up to one platform score shown next to its coverage.
- **6 data contracts:** the promise at each handoff. The check enforces it, the KPI counts how often it breaks.
- **Operating model:** worked through the spin-off example (owner, priority, fix, prevention, accountability).
- **Rule we stick to:** rules detect, AI only explains. Judges will rerun the code and change thresholds live.

## 5. What we found so far (all verified in the notebook)

- **Main finding:** spin-offs created new securities that were never set up in the security list.
  - All 23 spin-off targets are missing from the security list.
  - 15 of them are still traded and held: **1,131 trades, 1,118 positions, 0 prices**.
  - Worked example: spin-off `CA00093` on `SEC937640` created `SEC204363` (64 trades, 63 positions, custodian agrees, no price).
- **Corporate actions:** 87 of 200 have the ex-date after the effective date; all 200 carry a `cash_rate`, even splits.
- **Settlement dates:** 1,124 trades settle before the trade date; 1,687 dates can't be read. 845 long settlements have an agreed-extension note, so those are fine.
- **Settlement lag** (business days): T+1 913,711 · T+2 490,054 · T+5 to T+7 2,957.
- **FX:** the USD rate is never exactly 1 (0.990 to 1.010). Data error or convention: still open.
- **Clean example:** trade `TXN100000380`: our book, our rebuild and the custodian all say 2,028 shares.
- Say **exposure**, not loss.

## 6. The data

| Table | Rows |
|---|---|
| transactions | 1,409,533 |
| pipeline_events | 1,409,533 |
| positions | 480,663 |
| comparison_positions (custodian) | 480,183 |
| prices | 539,970 |
| accounts | 100,000 |
| securities | 6,012 |
| ledger_nav | 2,000 |
| corporate_actions | 200 |
| fx_rates | 180 |

How we load it (see the notebook):

- DuckDB reads the `.csv.gz` files directly: `read_csv('data/x.csv.gz', all_varchar=true)`. Everything is read as text first.
- Dates come in two formats: `COALESCE(TRY_STRPTIME(d,'%Y-%m-%d'), TRY_STRPTIME(d,'%d/%m/%Y'))`. Keep the dates that fail; don't drop them.
- Count settlement lag in **business days**, not calendar days.
- Rebuild positions from **zero**: BUY adds, SELL subtracts. A negative running total can be a short, not an error.

Missing from the data (we must say what this stops us proving):

- which accounts received each corporate action
- proof that a trade settled
- cash, fees and accruals
- an issue log and NAV correction history

## 7. Check-in 2: what to bring (week of 19 Oct)

From the brief, "method gate":

1. **Position reconstruction and reconciliation:** rebuild positions from trades (trade-date and settlement-date versions), compare with `positions`, then compare `positions` with `comparison_positions` on the full set of keys. Report differing, one-sided and untestable keys separately.
2. **First break classification:** sort the differences into types.
3. **One evidenced trace:** one problem followed record by record back to where it entered.
4. **Proposed checks for price data and ledger arithmetic:** coverage, freshness, vendor spread, scale; `net_assets / shares = nav_per_share`.
5. **Defect catalog:** for each problem type, how it was found, how many records, how confident, and how we told it apart from a look-alike.
6. **How we treat** ambiguous REVERSED trades (show both readings) and unsupported corporate actions (quarantine them, apply only supported ones in a separate scenario).

## 7b. Rules from the Dataset Guide and Working Guide (read before coding)

The brief says *what* to deliver. These two guides say *how*. Read `reference/02_Dataset_Guide.md` in full before any join.

**Dataset Guide: the conventions everyone must use**

- **Snapshot date:** 10 July 2026. 30 weekdays from 1 June; no holidays in this calendar.
- **Joins:** never join on row order. Count rows before and after every join. Keep orphans visible (no silent inner joins). `security_id` is the real key; CUSIP and ISIN are only matching attributes.
- **Position rebuild benchmark:**
  - start from zero before 1 June
  - BUY adds, SELL subtracts
  - BOOKED trades only as the first, transparent version
- **Negative quantities on trades:** investigate them; never just take the absolute value.
- **Negative holdings:** can be shorts.
- **CANCELLED → BOOKED link:** can be a valid rebook.
- **REVERSED:** can mean "inactive" or "offsetting trade". Show both readings and avoid double offsets.
- **Two versions:** trade-date and settlement-date holdings. Settlement date is a plan, not proof of settlement.
- **Show each step's effect:** raw benchmark first, then each justified change (for example removing exact duplicates) with its impact.
- **Never back-solve opening balances from closing positions.**
- **Custodian comparison:** full outer join on account + security + date. A missing record is reported as missing, not as zero.
- **Corporate actions:** they say nothing about which accounts received them. Keep trade-only and event-adjusted versions separate.
  - Ratio meaning: split = new units per old unit; merger = target units per source unit; spin-off = extra target units per source unit.
  - Incomplete events are quarantined, not guessed.
- **Prices:**
  - check scale across vendors before calling something a unit error
  - lower `vendor_priority` = preferred, not proven accurate
  - never pick a vendor because it matches the ledger
  - `rate_to_usd` = USD per one unit of currency
- **Ledger:** test `net_assets / shares_outstanding = nav_per_share`. Never sum `nav_per_share`. A residual is something to investigate, not a proven NAV error.
- **Evidence statuses:** confirmed, unresolved, cleared. Always give the denominator, and report missing or untestable records separately.
- **Tests:** keep the data read-only; shuffle rows and get the same totals; inject one defect and one look-alike in a test copy; never hard-code record IDs; one command regenerates everything.

**Working Guide: practical advice**

- **Row ledger:** for every load, filter and join, write down rows in, rows out, and why. An unexpected change is usually a finding.
- **Sampling:** sample by account (keep all linked records), fix the seed, run final numbers on everything.
- **Profile each table** on 8 dimensions: completeness, uniqueness, validity, referential integrity, consistency, timeliness, conformity, accuracy. Then pick the 3 defect classes with the clearest story.
- **A trace:** hop by hop (source → pipeline → position → downstream), showing the actual fields and which control would have caught it. Say what is observed and what is inferred.
- **Clearing a flag** needs:
  - a rule written before looking
  - evidence from a *different* field or table
  - the number of records cleared
  - what would change your mind
- **Every finding answers 7 questions:**
  1. name and status
  2. rule
  3. population (affected / eligible / not evaluable)
  4. 2 or 3 example IDs
  5. where it entered
  6. why it matters
  7. what would fix it
- **AI warnings:** AI gets interpretation wrong, silently repairs data, over-flags and invents context. Check row counts yourself and keep a log that shows where you corrected the AI.
- **Check-in 2 questions to be ready for:**
  - Does the rebuild run on the full data?
  - How many breaks, classified how?
  - What did we assume about REVERSED, and what else could it mean?
- **Final deck shape** (fits "tell a story"): answer first → platform and controls → 2 or 3 traced defects + 1 cleared flag → KPIs and executive view → operating model and roadmap → limits → the decision we ask for.

## 8. Later in Part Two (for Check-in 3 and the final)

- Three defect traces and two "looked wrong but is fine" traces
- Timeliness metrics by feed and day
- Scores at account, domain and platform level, with coverage and a sensitivity check
- At least 6 indicators (3 leading), marked computed, simulated or proposed
- Stress test: inject one new defect and one valid look-alike; show that shuffling rows changes nothing
- Executive dashboard with drill-down, plus wireframes for the three offices
- Recommendations and roadmap, limitations
- Final package: 8-page report, code package, 12 to 15 slides, team declaration and **AI log** (export the chats)

## 9. Suggested way to build it

*A suggestion, not a decision: agree it as a team.*

```
config/rules.yaml      thresholds and rules (from docs/notes/RULES_DRAFT.md), so judges can change them
src/load.py            read the ten tables into DuckDB views, check row counts
src/checks/            one file per check (accounts, securities, trades, positions, prices, nav)
src/reconcile.py       position rebuild and custodian comparison
src/scores.py          KPIs and the platform score
outputs/               results (gitignored, rebuilt by the code)
app/                   the dashboard (Streamlit is easy to learn in Python)
run_all.py             one command that rebuilds everything
```

- One command should rebuild every number.
- **Never hard-code record IDs of defects.** The checks must find them.
- Keep stress-test data separate from the real data.

**The story for the final:** a spin-off happens → nobody sets up the new security → trades and holdings pile up → it can't be priced → the NAV is at risk. Our checks would have caught it at the first handoff. The dashboard lets the audience click from the platform score down to those exact records.

## 10. Working rules

- **Confidential data:** keep the repo private; no public dashboards or public AI links.
- **Never change anything in `data/`.** Results go in `outputs/`.
- **No version suffixes** in file names (`_v2`, `_final`): git keeps the history.
- Use `uv` for Python (`uv sync`, `uv run`, `uv add <package>`).

## 11. Small things still open

- Rename the GitHub repo from "Jane-Street" to `BC-State-Street-Case-Competition`, then update the remote: `git remote set-url origin https://github.com/KevinRusu/BC-State-Street-Case-Competition.git`
- Commit `docs/notes/PRESENTATION_NOTES.md`, this file and `CLAUDE.md`.
- Export this Cowork chat into an `ai_log/` folder (the brief requires the AI logs).
- Note the faculty answers to our four questions: REVERSED meaning, using CSSF 24/856 as a NAV threshold reference, the USD rate, and the corporate-action date definitions.
