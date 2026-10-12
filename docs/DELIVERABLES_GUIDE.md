# Deliverables Guide: what we have for Check-in 1, and how to understand it

*State Street case · written 11 Oct 2026 · for everyone on the team, no finance or coding background needed*

If you only have 30 minutes before Monday, read in this order:

1. **Section 1** of this guide (the case in plain words): 5 minutes
2. **`docs/Explainer_Deck.pptx`** (the study deck, starts from zero): 15 minutes
3. **Section 4** of this guide (the faculty slides one by one, with what to say): 10 minutes

---

## 1. The case in plain words

### 1.1 The story

An investment fund is a pot of money from many investors. Every day the fund has to say what **one share of the fund is worth**. That price is the **NAV** (net asset value per share), and investors buy and sell at it.

To get to that price, data travels through three teams, like a parcel through three warehouses:

| Team | Nickname | What they do | Example |
|---|---|---|---|
| **Front office** | the deciders | Portfolio managers and traders decide what to buy and sell, and create the trade | "Buy 1,612 shares of company X" |
| **Middle office** | the checkers | Book the trade, price every holding, and check our records against the bank that holds the assets (the **custodian**) | "Our book says 2,028 shares. Does the custodian agree?" |
| **Back office** | the accountants | Keep the official books and calculate the NAV | "Fund is worth $40.8 million / 3.6 million shares = $11.35 per share" |

Every time data passes from one team to the next (a **handoff**), it can be **dropped, duplicated, delayed or changed**.

### 1.2 Why it matters (the chain reaction)

A tiny example with made-up numbers:

- A fund owns stocks worth $10,000 and has 1,000 shares outstanding. NAV = $10,000 / 1,000 = **$10.00**.
- A trade "buy 100 shares at $50" is accidentally booked **twice**.
- The fund now *thinks* it owns $5,000 more stock than it does. NAV = $15,000 / 1,000 = **$15.00**.
- An investor who buys today pays $15.00 for something worth $10.00.

One mistake at the front became a wrong position, then a wrong valuation, then a wrong NAV. **The later you catch it, the more it costs.** Industry shorthand: catching it at entry costs 1, later costs 10, after it reaches customers costs 100 (the "1-10-100 rule", an illustrative rule of thumb).

### 1.3 What the competition asks us to do

**Design a system that catches bad data as early as possible, then prove it on the data we were given.**

- **Part One (now, Check-in 1 on Monday 12 Oct):** the design. Where do checks sit, who owns them, what do we measure. No heavy coding needed.
- **Part Two (Check-ins 2 and 3, then the final in November):** the proof. Code that loads 1.4 million trades, finds real defects, traces them back to where they started, and shows a dashboard.

How the final is graded (brief section 9):

| What | Weight |
|---|---|
| Architecture (Part One, what we show Monday) | 25% |
| Detection and reconciliation (finding real defects) | 25% |
| Business insight and recommendations | 20% |
| KPIs by office | 10% |
| Dashboard and communication | 10% |
| Reproducibility and honesty | 10% |

Check-in 1 itself is **not graded**. It is a feedback session with faculty. A complete, consistent draft is the goal.

---

## 2. Every file, what it is, and when you use it

All files are in the repo folder `State_Street_Case_Student_Package`.

| File | What it is | Who it is for | When to use it |
|---|---|---|---|
| `docs/Checkin1_Pack.pptx` | **The slides we show faculty on Monday.** 10 core slides + appendix A1 to A7 | Faculty | Monday presentation |
| `docs/Explainer_Deck.pptx` | **Study deck** that explains everything from zero | The team | Read before Monday |
| `docs/DELIVERABLES_GUIDE.md` | This guide | The team | Start here |
| `docs/CHECKIN1_REPORT.md` and `.pdf` | Team report: State Street research, review of our spine, verified numbers, talk track, likely faculty questions | The team | Before Monday, and for Q&A prep |
| `docs/Spine_Checkin1_v0.3.xlsx` | **The spine**: our master workbook with every list and table (controls, KPIs, contracts, journey, operating model) | The team | Source of truth for all IDs and wording |
| `docs/Spine_Checkin1_Draft.xlsx` | The previous version (v0.2), kept untouched | The team | Only to compare |
| `notebooks/checkin1_evidence.ipynb` | Python notebook that re-checks every number we quote, on the full data | Whoever is asked "where does this number come from?" | Before Monday (optional), and at Check-in 2 |
| `docs/figures/*.png` | The 5 diagrams used in the slides | Slides and report | Already inside the slides |
| `docs/figures/src/` | Scripts that draw the diagrams | Whoever edits a diagram | Only if a label must change |
| `docs/OVERVIEW.md` and `docs/CHECKIN1_WORK_SPLIT.md` | Earlier team notes: full plan and the original weekend work split | The team | Background |
| `etc/01_Student_Brief.pdf` | **The official case.** If anything disagrees with it, the brief wins | Everyone | When in doubt |

---

## 3. How all the pieces connect

### 3.1 The "spine" in one sentence

The spine is **one shared list of IDs** so that five people's work fits together. Instead of everyone inventing their own names, every item gets a short ID:

| Prefix | Means | How many | Example |
|---|---|---|---|
| **S** | Stage (a step in the data's life) | 5 | S2 = Securities master data |
| **F** | Feed (data coming from outside or a source system) | 6 | F3 = custodian positions |
| **H** | Handoff (data moving from one place to the next) | 10 | H2 = security master feeds the trades |
| **R** | Role (an owner, never a person's name) | 10 | R2 = Security master lead |
| **D** | Defect family (a type of thing that goes wrong) | 10 | D1 = missing or unknown security IDs |
| **Q** | Quality dimension (a way to measure "good data") | 8 used, 3 excluded | Q4 = Referential integrity |
| **C** | Control (a check placed somewhere) | 20 | C04 = trade reference-data gate |
| **K** | Contract (a promise between two teams) | 14 | K02 = every trade uses a security that exists in the master |
| **M** | KPI (a number we track) | 20 | M05 = unmastered reference rate |

### 3.2 One example that uses all of them

> Control **C04** sits on handoff **H2** (security master to trades). It catches defect **D1** (a trade uses a security we do not know). It enforces contract **K02**. It is owned by role **R2** (security master lead). Its success is measured by KPI **M05** (share of trades that use an unknown security, target 0%).

If you can explain that sentence, you understand the framework.

### 3.3 The chain of logic

```
CONTRACT (K)   "what the upstream team promises"
    enforced by
CONTROL (C)    "the check that tests the promise"
    placed at
DETECTION POINT "the earliest stage where the check can work"
    measured by
KPI (M)        "how often the promise is kept"
    owned by
ROLE (R)       "who fixes it when it breaks"
```

---

## 4. The faculty slides, one by one

For each slide: what it shows, how to read it, and one sentence you can say.

### Slide 1: Title "Catch it where it enters"
- **Shows:** our thesis and the size of the framework (5 stages, 10 handoffs, 20 controls, 14 contracts, 20 KPIs).
- **Say:** "The cost of a data defect grows with the distance between where it enters and where it is found, so we put checks at the earliest point."

### Slide 2: Control map
- **Shows:** the five stages as boxes, placed in the office that owns them (rows = front, middle, back office). Arrows are handoffs H1 to H10, each labelled with its controls.
- **How to read it:** follow the arrows from top left to bottom right. Teal arrow = we can test this control in our data. Amber dashed = partly. Red dashed = we would need data that does not exist yet.
- **Say:** "Every handoff has at least one control and one owner role."

### Slide 3: Each stage has an exit rule
- **Shows:** for each stage, the rule data must pass before it can move on, which controls check it, and who owns it. Right side: 20 controls, 13 preventive (stop bad data) and 7 detective (find it after).
- **Failure responses explained:** **Reject** = send it back. **Hold** = park it until fixed. **Flag** = let it pass but raise an alert. **Correct** = fix it automatically by a stated rule (for example, use the next price vendor).
- **Say:** "Most of our controls stop bad data before it moves, rather than finding it later."

### Slide 4: Detection-point model (the most important slide)
- **Shows:** one row per defect family. Green = the earliest stage that can catch it, with the control we put there. Amber (x10) and red (x100) = what it costs if it slips past.
- **How to read one row:** "D1 (unknown security) can be caught at S2, the security master, by control C03. If it slips to transactions it costs 10 times more, to positions and NAV 100 times more."
- **Say:** "This is the core of Part One: for each defect, the earliest place to catch it, the evidence needed, and the cost of missing it."

### Slide 5: Journey 1, one trade
- **Shows:** a real trade (`TXN100000380`) followed through 7 steps: the trade, its timestamps, the account and security records, the position, the custodian, the prices, and the fund NAV.
- **Key words:** **observed** = we saw the link in the data (matching IDs). **inferred** = our reasoning, not proven. **Gap** = where the data stops, so we name the missing contract.
- **Say:** "This trade is clean. Its position is 2,028 shares in our book, in our rebuild, and at the custodian."

### Slide 6: Journey 2, one security, and our big finding
- **Shows:** security `SEC937640` is used by 309 trades, 107 accounts, 94 funds. It had a **spin-off** (the company split off part of itself and gave shareholders shares of a new company). That new security `SEC204363` was **never created in our security master**, yet it was traded and held, and it has **no price**.
- **Across the whole file:** 15 such securities, 1,131 trades, 1,118 positions, 0 prices.
- **Say:** "Holdings exist that nobody can value. A gate at the security master would have stopped every one of those trades."

### Slide 7: KPIs by office
- **Shows:** 3 example KPIs for each office plus the Chief Data Officer. Each has a target, an owner and the **decision** it supports.
- **Leading vs lagging:** a **leading** KPI warns before damage (for example, trades on unknown securities). A **lagging** KPI confirms damage after (for example, breaks with the custodian).
- **Say:** "Every KPI has a formula, owner, target and a decision; without those it is just an observation."

### Slide 8: Data contracts
- **Shows:** 3 example contracts written as conditions a computer can test, and 5 **missing contracts**: data we would need in real life but do not have (for example a log of which accounts received a spin-off).
- **Say:** "A contract is not 'data should be accurate'; it is a test, so a breach becomes a measurable event."

### Slide 9: Operating model
- **Shows:** our worked defect (the unmastered spin-off target) walked through 5 questions: who owns it, how it is ranked, how it is fixed, how it is prevented, how anyone knows. Bottom: a 3-step maturity path (reactive, defined, preventive).
- **Say:** "Detection is the start, not the end; this is what happens after a defect is found."

### Slide 10: Where we want feedback
- **Shows:** 4 questions where the data is ambiguous and we want faculty direction.
- **Say:** "Each of these changes how we build Part Two, so we would like to agree them now."

### Appendix A1 to A7
Backup only. Show when asked. A1 State Street context · A2, A3 full control table · A4, A5 full KPI table · A6 how the 10 tables join · A7 every number checked against the data.

---

## 5. The spine workbook, tab by tab

Open `docs/Spine_Checkin1_v0.3.xlsx`. Beige tabs are the shared lists; other tabs are the work.

| Tab | What it holds | Role in the original split |
|---|---|---|
| `0_README` | How to use the workbook, naming rules, version history | Everyone |
| `Coverage` | Automatic checklist: green "OK" or red "GAP" for each requirement | Read only |
| `C_Controls` | The 20 controls (C01 to C20) | A, architect |
| `SX_StageExit` | The exit rule for each stage | A |
| `DP_Detection` | Detection-point model, one row per defect family | B, detection lead |
| `J_Journey` | The two journeys, hop by hop, with real IDs | C, data person |
| `M_KPIs` | The 20 KPIs (M01 to M20) | D, metrics lead |
| `K_Contracts` | The 14 contracts (K01 to K14) | E, contracts |
| `OM_OperatingModel` | The worked defect and the 5 questions, plus maturity path | E |
| `Change_Requests` | Proposed changes to the shared lists | Everyone proposes |
| `S_Stages`, `F_Feeds`, `H_Handoffs`, `R_Roles`, `D_Defects`, `Q_Dimensions`, `O_Offices` | The shared lists (the spine itself) | Spine owner |

Every cell changed in v0.3 has a note starting with **"v0.3:"**, so you can see what changed and why.

---

## 6. The evidence notebook, step by step

`notebooks/checkin1_evidence.ipynb` answers one question: **are the numbers on our slides true?** It reads the real data files with **DuckDB** (a small database that runs SQL directly on the `.csv.gz` files).

| Step | What it checks | In plain words |
|---|---|---|
| 1 | Load the 10 tables as text | Read files without changing anything |
| 2 | Row counts vs `manifest.csv` | Did every row arrive? |
| 3 | The journey trade | Is the trade unique, and does quantity x price = amount? |
| 4 | Pipeline timestamps | How many minutes between each step? |
| 5 | Account and security | Was the account open, is the security known? |
| 6 | Rebuild the position | Add buys, subtract sells, compare with our book and the custodian |
| 7 | Prices and FX | Do the 3 price vendors agree? Is the USD rate 1? |
| 8 | NAV arithmetic | net assets / shares = NAV per share? |
| 9 | Blast radius | How many trades, accounts, funds use this one security? |
| 10 | The spin-off target | Is it in the master? Is it held? Is it priced? |
| 11 | All corporate actions | Missing targets, date order, which terms are filled |
| 12 | Exposure | How many holdings sit in a security that had a spin-off |
| 13 | Settlement lag | How many business days between trade and settlement |
| 14 | Summary | Each spine claim next to what the data shows |

**To run it:** open it in VS Code or Jupyter from the repo folder, choose Python 3, run `pip install duckdb pandas` once, then "Run All". It takes about 15 seconds.

---

## 7. Our three findings so far (know these by heart)

1. **Unknown securities are traded and held anyway.** 15 securities that are not in the security master appear in 1,131 trades and 1,118 positions, and none has a price. All 15 are spin-off targets. This is our worked defect.
2. **Corporate-action dates and terms are inconsistent.** 87 of 200 events have their ex-date after their effective date, and all 200 carry a cash rate, even stock splits. We need a definition per event type before calling it an error.
3. **Settlement dates need care.** Most trades settle in 1 or 2 business days. 845 longer ones have an agreed-extension note (legitimate look-alikes), but 1,124 trades settle *before* they were traded, and 1,687 have a date we cannot read.

Always say **"exposure"**, not "loss". We count what could be affected; we have not proven money was lost.

---

## 8. Glossary

| Term | Plain meaning |
|---|---|
| **NAV** (net asset value per share) | What one share of the fund is worth today: (assets minus liabilities) / shares |
| **Position** | How many units of a security an account holds on a date |
| **Custodian** | The bank that physically holds the assets and keeps its own record of positions |
| **Reconciliation** | Comparing two records of the same thing (our book vs the custodian) |
| **Break** | A difference found by reconciliation. Needs an explanation; not automatically an error |
| **Master data** | Reference lists of *who* (accounts) and *what* (securities). One bad master record spreads everywhere |
| **Security** | Anything you can invest in: a stock (equity) or a bond |
| **CUSIP / ISIN** | Standard ID codes for a security (like a barcode) |
| **Corporate action** | Something the company does that changes what holders own: split, merger, spin-off, dividend, redemption |
| **Spin-off** | A company separates part of itself into a new company; shareholders receive shares of the new one |
| **Ex-date** | The cut-off date: own the stock before it to receive the corporate action |
| **Trade date / settlement date** | The day a deal is agreed / the day cash and securities actually change hands |
| **T+1, T+2** | Settlement 1 or 2 business days after the trade date. The US standard is T+1 since May 2024 |
| **Cutoff** | The deadline for data to be included in today's NAV |
| **Handoff** | Data moving from one stage or team to the next |
| **Control** | A check at a specific place, with an owner and a defined response when it fails |
| **Preventive / detective control** | Stops bad data before it moves / finds it afterwards |
| **Data contract** | A testable promise from one team to the next |
| **KPI** | A tracked number with formula, unit, owner, target and the decision it supports |
| **Leading / lagging indicator** | Warns before damage / confirms damage after |
| **Observed / inferred link** | Seen in the data (matching IDs) / our reasoning |
| **Look-alike** | Something that looks wrong but is legitimate (a short position, a flat price, an agreed late settlement) |
| **Exposure** | What could be affected (accounts, holdings, money at stake), not a proven loss |
| **IBOR / ABOR** | Investment view of holdings (front and middle office) / official accounting view (back office) |
| **Basis point (bp)** | 0.01%. 50 bp = 0.5% |

---

## 9. Before Monday: checklist

- [ ] Read this guide and flip through `Explainer_Deck.pptx`
- [ ] Agree who presents which slide (suggested split in `CHECKIN1_REPORT.md`, section 5)
- [ ] Mark the spine lists as `agreed` (spine v1)
- [ ] Each person can explain the sentence in section 3.2
- [ ] Each person knows the three findings in section 7
- [ ] Read the likely faculty questions (`CHECKIN1_REPORT.md`, section 6)
- [ ] Bring the four feedback questions (slide 10)
