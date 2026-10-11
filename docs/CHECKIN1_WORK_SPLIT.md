# Check-in 1: How We Split the Work (5 people)

*State Street case · Check-in 1 (architecture) is **Monday 12 Oct** · Written Fri 9 Oct 2026*
*Background: see `docs/OVERVIEW.md` / `OVERVIEW.pdf`. Source of truth: `etc/01_Student_Brief.pdf`, §4.*

---

## In one minute

- We **don't** have to do Part One in order. Most of it can be done **in parallel** by five people.
- But first we spend **1–2 hours together** building the **spine**: a short set of shared lists everyone uses (Section 2 explains what that means).
- Then each of us owns **one piece** over the weekend (Section 5).
- **Sunday evening** we merge, check that everything lines up, and build the Check-in 1 pack.
- Check-in 1 is **not graded**. A complete, consistent draft beats one polished piece and four gaps.

---

## 1. What Check-in 1 needs (brief §4 and §8)

| # | Piece | What it is |
|---|---|---|
| 1 | **Control map** | 1 diagram: 5 stages × 3 offices (front / middle / back), every handoff marked |
| 2 | **Control table** | One row per control: what it checks, which stage, what happens when it fails, which role owns it |
| 3 | **Detection-point model** | For each defect type: the earliest stage it could be caught, the evidence needed, and the cost of missing it. **This is the core of Part One.** |
| 4 | **Data journey** | 1 real trade and 1 master record (an account or a security) followed through the tables, with record IDs. Links we saw in the data are kept separate from links we're guessing. |
| 5 | **KPI table** | Metrics per office: formula, unit, owner, target, and one sentence on the decision each one supports |
| 6 | **Data contracts** | What each office can expect from the one before it, written as testable conditions |
| 7 | **Operating model** | 1 page: who owns a defect, how it's prioritised, fixed and prevented, and who tracks it. Walked through with one example defect. |

---

## 2. What is the "spine"?

**The spine is a short set of shared lists that every piece of our work refers to.**
It's the common vocabulary of the project, written down once with an ID for every item:

- the **stages** of the platform (S1, S2, …) and the **feeds** that bring data into it (F1, F2, …)
- the **handoffs** between them (H1, H2, …)
- the **owner roles** (R1, R2, …)
- the **defect types** we expect (D1, D2, …)
- the **quality dimensions** we measure (Q1, Q2, …)

**Why "spine"?** Like a backbone, it's the one structure everything else attaches to. Each person's table (controls, contracts, KPIs, detection points) hangs off the same lists, so when we put the pieces together on Sunday they fit.

**What goes wrong without it.** Five people working alone will each invent their own version:

- One person splits the platform into 5 stages, another into 7.
- One writes "pricing team", another "Pricing lead", a third "middle office analyst".
- The control table catches "duplicate trades" but the detection model calls it "double bookings".
- Nobody notices that handoff "corporate actions → positions" has no contract.

On Sunday that means hours of renaming and arguing instead of checking.

**With the spine,** every row says exactly what it connects to, for example *"Control C04 sits on handoff H4, catches defect D2, enforces contract K03, is owned by R3 and is measured by KPI M05."* A gap or contradiction is then visible at a glance: if no control mentions D5, we have a hole.

**What it is not:** a finished design. It's a **starting agreement** that takes 1–2 hours. If someone needs a new item over the weekend (say, a 10th handoff), they propose it in the group chat, we agree, and it gets the next ID.

---

## 3. What depends on what

| Piece | Needs first | Parallel? |
|---|---|---|
| **Spine** | — | **Together, first** |
| Control map + control table | Spine | Yes |
| Detection-point model | Spine | Yes |
| Data journey | Spine (stages) + the data | Yes |
| KPI table | Spine (dimensions + roles) | Yes |
| Data contracts | Spine (handoff list) | Yes |
| Operating model | Spine + one defect from the detection model | Drafted in parallel, finished on Sunday |

**How the pieces connect:**

```
contract (K)  →  enforced by a  →  control (C)  →  placed at the earliest stage from the  →  detection point (D)
      ↑                                  ↓
journey gaps reveal              measured by a KPI (M)
missing contracts
```

---

## 4. Step 1: build the spine (all 5, 1–2 hours, Fri evening or Sat morning)

The spine lives in **one shared Google Sheet** (template: `docs/Spine_Template.xlsx`; upload it to Google Drive and open it as a Google Sheet). The lists below are a **starting proposal**. We go through them together, edit, and then mark them `agreed`.

### Naming rules

- **IDs = prefix + number:** S1, F1, H1, R1, D1, Q1 for the spine lists. The long work lists get two digits so they sort correctly in the sheet: controls `C01`, contracts `K01`, KPIs `M01`.
- **IDs are never reused or renumbered.** A dropped item gets status `retired`; it is not deleted. Otherwise everyone's references break.
- **Owners are role IDs only** (e.g. `R7`), never people's names.
- **Offices:** `FO` front · `MO` middle · `BO` back · `EX` executive (Chief Data Officer) · `EXT` outside the platform.
- **Every spine row has a status:** `draft` → `agreed` → (`retired`).
- **The spine tabs are locked.** Only the spine owner edits them. Anyone can propose a change in the `Change_Requests` tab.

*Spine draft v0.2. Checked against brief §3–4, Dataset Guide §2 and the column headers and values of the ten tables.*

### Stages (S): exactly the five stages the brief names for the control map (§4)

| ID | Stage | Office | Tables |
|---|---|---|---|
| S1 | Accounts (master data) | FO + BO | `accounts` |
| S2 | Securities (master data) | MO | `securities` |
| S3 | Transactions & corporate actions | FO → MO | `transactions`, `corporate_actions`, `pipeline_events` |
| S4 | Positions (incl. reconciliation) | MO | `positions` |
| S5 | NAV & ledger (incl. share classes) | BO | `ledger_nav` |

### Feeds (F): data entering the platform from a source system or from outside

| ID | Feed | Office | Enters via | Evidence |
|---|---|---|---|---|
| F1 | Vendor prices (VENDOR_A/B/C, priority 1–3) | EXT → MO | H7 | `prices` |
| F2 | FX rates | EXT → MO | H7 | `fx_rates` |
| F3 | Custodian positions (3 custodians) | EXT → MO | H6 | `comparison_positions`, `accounts.custodian` |
| F4 | Trade feed `OMS_FRONT` | FO *(assumed from the label)* | H3 | `source_system` |
| F5 | Trade feed `TRADE_CAPTURE` | FO → MO *(assumed)* | H3 | `source_system` |
| F6 | Trade feed `CUSTODY_FEED` | EXT *(assumed)* | H3 | `source_system` |

F4–F6 are the three `source_system` values in `transactions` and `pipeline_events`. The brief asks for timeliness **"by feed and day"**, and these are the feeds. The data names the systems but **not which office owns them**, so the office column is our assumption (data dictionary: the source system is "not an accountable owner").

### Handoffs (H)

| ID | From → To | Evidence in the data |
|---|---|---|
| H1 | S1 → S3: account master feeds trades | `transactions.account_id` → `accounts` (status, open/close dates) |
| H2 | S2 → S3: security master feeds trades and corporate actions | `security_id`, `cusip`, `currency`; `corporate_actions.security_id` / `target_security_id` |
| H3 | F4–F6 → S3: trade capture (event → received → booked) | `pipeline_events`: event, received, booked timestamps, `batch_id` |
| H4 | S3 → S4: booked trades build positions (published by cutoff) | `published_timestamp` vs `cutoff_timestamp`; trades summed by account + security; `positions.transaction_count` |
| H5 | S3 → S4: corporate actions adjust positions | `corporate_actions` terms and dates. **No per-account posting log, so this is a missing contract.** |
| H6 | F3 ↔ S4: our book vs the custodian | `positions` ↔ `comparison_positions` on account + security + date |
| H7 | F1, F2 → S4/S5: prices and FX value positions | `prices` (vendor, priority, timestamp, currency), `fx_rates` |
| H8 | S4 → S5: positions roll up to the fund NAV | `positions.account_id` → `accounts.fund_id` + `share_class` → `ledger_nav` |
| H9 | S1 → S5: account master assigns fund and share class | `accounts.fund_id`, `share_class` ↔ `ledger_nav` |
| H10 | S4 → FO: positions shown back to the portfolio manager | `positions` ↔ `accounts`. **No record of what the PM saw or when, so this is a missing contract.** |

### Owner roles (R): roles, never people's names

| ID | Role | Office | Mainly owns |
|---|---|---|---|
| R1 | Account onboarding lead | FO + BO | S1, H1, H9 |
| R2 | Security master lead | MO | S2, H2 |
| R3 | Trade operations lead | FO → MO | S3 trades, H4 |
| R4 | Corporate actions lead | MO | S3 corporate actions, H5 |
| R5 | Platform operations lead | MO | Pipeline and cutoffs, H3 |
| R6 | Front office data lead | FO | Positions as the PM sees them, H10 |
| R7 | Pricing lead | MO | F1, F2, H7 |
| R8 | Reconciliation lead | MO | S4, F3, H6 |
| R9 | Fund accounting lead | BO | S5, H8 |
| R10 | Chief Data Officer | EX | Platform roll-up, prioritisation |

### Defect families (D)

D1–D6 are the brief's six families (§4). D7–D10 come from the brief's stage table (§3).

| ID | Defect family | Typical stage |
|---|---|---|
| D1 | Missing / invalid / colliding identifiers, duplicate masters, securities traded but never mastered | S2 → S3 |
| D2 | Duplicated transactions | S3 |
| D3 | Late records / cutoff misses | S3 → S4 |
| D4 | Stale or disputed prices (incl. unit or scale errors) | F1 → S4/S5 |
| D5 | Corporate actions applied unevenly | S3 → S4 |
| D6 | Positions that don't match their history | S4 |
| D7 | Incomplete onboarding / closed accounts still trading | S1 → S3 |
| D8 | Cancels or reversals with no valid original | S3 |
| D9 | NAV and share classes that don't reconcile | S5 |
| D10 | Invalid trade fields (nulls, settlement-date convention breaches, signs, amount ≠ quantity × price) | S3 |

### Quality dimensions (Q): we need at least 6, and must say why we left any out

Q1 Completeness · Q2 Uniqueness · Q3 Validity · Q4 Referential integrity · Q5 Consistency · Q6 Timeliness · Q7 Conformity · Q8 Accuracy

### How the meeting runs

1. Naming rules (5 min).
2. Go through one spine tab at a time, about 10 minutes each. Agree, edit, or note the question in `Change_Requests` and move on.
3. Mark everything `agreed`. That's **spine v1**, and it's now frozen. Later changes go through `Change_Requests`.
4. Assign people to roles A–E (Section 5) and show each person their tab in the sheet.

---

## 5. Step 2: who does what (Sat – Sun afternoon)

| Person | Role | Owns | Deliverable for Monday |
|---|---|---|---|
| **A** | **Architect / integrator** | Control map + control table | 1 diagram + control table. Runs the Sunday merge and builds the Check-in 1 pack. |
| **B** | **Detection lead** | Detection-point model | One row per defect family D1–D10 |
| **C** | **Data person** | Data journey | 1 trade + 1 master record traced through the tables with real IDs, and a list of where the evidence stops |
| **D** | **Metrics lead** | KPI table | ≥ 2 KPIs per office + executive roll-up, covering ≥ 6 dimensions |
| **E** | **Contracts & operating model** | Data contracts + operating model | One testable contract per handoff H1–H10, plus the 1-page operating model with one worked defect |

**Who should take which role:**
- **B, the detection-point model:** our most structured thinker. Faculty will push on it hardest.
- **C, the data journey:** whoever is most comfortable with Python/SQL. It needs a few DuckDB queries.
- **A, the architect:** whoever is best at diagrams and keeping the big picture.
- **E:** whoever likes rules and process. Contracts and the operating model are both about "who promises what, and what happens when it breaks".
- **D:** whoever likes numbers and definitions.

**Who must talk to whom over the weekend.** These pairs share the most and should check in with each other once on Saturday:

| Pair | Why |
|---|---|
| **A ↔ E** | Every contract (E) should be enforced by a control (A) |
| **A ↔ B** | Every detection point (B) needs a control (A) at that stage |
| **C → E** | Every gap in the journey (C) becomes a missing contract (E) |
| **D ↔ E** | Every contract (E) should be measurable by a KPI (D) |
| **B → E** | B gives E one defect to use as the operating model's worked example |

---

## 6. What each person produces (templates)

### A: Control map + control table

**Diagram:** columns = stages S1–S5, rows (swimlanes) = front / middle / back office, the feeds F1–F6 drawn as inputs, an arrow for each handoff H1–H10, and a control symbol on each arrow. Tools: Excalidraw, draw.io, or Mermaid.

**Control table**

| ID | Control | What it checks | Stage | Handoff | Catches | On failure | Owner |
|---|---|---|---|---|---|---|---|
| C01 | Account status gate | Account exists and is OPEN on trade date | S3 | H1 | D7 | Hold trade; route to onboarding | R1 |
| C02 | … | | | | | reject / hold / flag / correct | |

Also, **for each stage, write one line:** *"Data may leave S_ only if ___; established by control C__; owned by R_."*

### B: Detection-point model

| Defect | Earliest stage to detect | Evidence needed (fields/tables) | If missed until next stage… | Control | Testable in this dataset? |
|---|---|---|---|---|---|
| D2 Duplicated transaction | S3 at capture | `transaction_id` uniqueness; same account + security + date + qty + price | Position overstated, so valuation and NAV wrong | C__ | Yes / partly / no (what's missing) |
| D4 Stale price | At price intake (H7), before positions are valued | `price_timestamp` age; spread across the 3 vendors | Wrong valuation goes straight into NAV | C__ | |
| … one row per D1–D10 | | | | | |

### C: Data journey

Trace **one trade** and **one master record** (an account or a security). For each hop:

| Hop | Table & key fields (real IDs) | What the evidence shows | Observed or inferred? | Control that would catch a problem here |
|---|---|---|---|---|
| Source | `transactions` | | | |
| Pipeline | `pipeline_events` | | | |
| Master data | `accounts` / `securities` | | | |
| Position | `positions`, `comparison_positions` | | | |
| Downstream | `ledger_nav` (fund_id + share_class) | | | |
| **Gap** | — | Where the evidence stops | — | **→ hand to E as a missing contract** |

A starter DuckDB query is in `OVERVIEW.md` §8. Use **LEFT JOINs** so missing links show up instead of vanishing. **Don't go deeper into the data than this before Monday.** The full data work starts after Check-in 1.

### D: KPI table

| ID | Office | KPI | Formula (incl. denominator) | Unit | Owner | Target | Dim. | Decision it supports | Status |
|---|---|---|---|---|---|---|---|---|---|
| M01 | FO | Account completeness | 100 × accounts passing required-field rules ÷ accounts tested | % | R1 | ≥ 99.5% | Q1 | Block onboarding sign-off until fixed | Computed |
| M02 | … | | | | | | | | |

- At least 2 per office (front, middle, back) plus an executive roll-up for the Chief Data Officer.
- Cover **≥ 6 dimensions**, and write one line on why any obvious dimension is excluded.
- Status means computed (from our data), simulated (on test data) or proposed (needs data we don't have).
- Report missing and unevaluable records **separately**, so they never make a score look better.
- Appendix A of the brief shows the level of detail expected. Use it for format, but don't copy its metrics.

### E: Data contracts + operating model

**Contracts.** One per handoff, written so a computer could test it:

| ID | Handoff | Contract (testable condition) | Measured as | Breach = | Checked |
|---|---|---|---|---|---|
| K01 | H1 | Every transaction's `account_id` exists in `accounts` and is OPEN on `trade_date` | % passing | any failing row | daily |
| K02 | … | | | | |

> ❌ "Data should be accurate" → ✅ "≥ 99.9% of rows have a parseable `trade_date` ≤ `settlement_date`"

Add the **missing contracts** C finds in the journey, the data we'd need but don't have. Example: a per-account log of which corporate actions were applied.

**Operating model (1 page).** Take one defect from B and answer each question in a short paragraph:

| Question | Our answer |
|---|---|
| **Ownership:** who owns the defect, and is that the same role that owns the control that should have caught it? | |
| **Prioritisation:** with 200 open defects, what gets worked first, and by what rule (accounts touched, exposure, cost to fix)? | |
| **Remediation:** fix the wrong records, fix the thing that produced them, or both? | |
| **Prevention:** which control moves upstream, and what does it cost to run? | |
| **Accountability:** what's tracked to closure, who sees it, and what happens when it stays open too long? | |

End with a 3-step **maturity path**: where a firm starts, what comes next, and where this framework takes it.

---

## 7. Step 3: the Sunday merge (all 5, about 2 hours)

A leads. Go through this checklist:

- [ ] Every defect family D1–D10 has at least one control **at its earliest stage**
- [ ] Every handoff H1–H10 has a contract
- [ ] Every contract is enforced by a control or measured by a KPI
- [ ] Every owner in every table is a role from the R list (no names, no blanks)
- [ ] The KPI table covers ≥ 6 dimensions, with exclusions explained
- [ ] The journey's gaps are listed as missing contracts
- [ ] The operating model is finished, with one worked defect
- [ ] **Everyone can explain everyone else's part.** Faculty may ask anyone.

Then A puts together the **Check-in 1 pack** (5–8 slides or one doc) in this order: control map → control table → detection-point model → journey → KPIs → contracts → operating model. Each of us presents our own piece.

---

## 8. Timeline

| When | What | Who |
|---|---|---|
| **Fri evening / Sat morning** | Build the spine (Section 4); assign roles A–E | All 5 |
| **Saturday** | Own pieces; quick pair check-ins (A↔E, A↔B, C→E, D↔E, B→E) | Each person |
| **Sunday afternoon** | Finish own pieces; spine changes agreed in the group chat | Each person |
| **Sunday evening** | Merge checklist + pack (Section 7) | All 5 |
| **Mon 12 Oct** | Check-in 1 | All 5 |

---

## 9. Rules of thumb

- **Architecture before data.** C only needs one real trade and one real master record for Monday.
- **Never edit the raw files** in `data/`.
- **Roles, not names**, for every owner.
- **Testable, not aspirational.** If a computer can't check it, rewrite it.
- **Don't publish the data.** No public repos, public dashboards or public AI share links.
- **Keep AI chat logs** as you go. We have to submit them.
