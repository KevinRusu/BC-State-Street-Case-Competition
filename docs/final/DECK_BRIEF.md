# Final deck: slide-by-slide brief

*Written 12 Nov for building the final deck in PowerPoint, by hand or with Claude in PowerPoint. The structure is
[PRESENTATION_OUTLINE.md](PRESENTATION_OUTLINE.md); this file fills each slide with a draft headline, what goes on
it, and the numbers. Headlines are drafts: rewrite them in your own words.*

*Every number comes from the run with register checksum `c4f264d9f5ed`, scorecard checksum `d5af528b2bbd` and stress
checksum `7a2c29dc765f` (top of [FINDINGS.md](../FINDINGS.md) and its sections). If a checksum there has changed, the
notebook was rerun: check the numbers again before presenting. The file behind each number is named next to it.*

## Instructions for Claude in PowerPoint

Paste this section along with the slides you want built.

- Audience: a Chief Data Officer and their team at State Street, plus Boston College faculty. Smart, busy, and they
  have **never seen our dataset**. Every term is explained the first time it appears.
- 14 slides, 15 minutes, every team member speaks. One message per slide. The headline is a full sentence that
  states the point; reading only the headlines tells the whole story.
- Use the deck's existing theme, fonts and colours. State Street and Boston College logos are already in the slide
  master; leave them where they are.
- **Do not add:** icons, stock photos, emoji, gradient blobs, three equal boxes in a row, or a different decorative
  layout per slide. No filler words ("robust", "seamless", "comprehensive", "leverage", "unlock", "journey" as a
  metaphor). Plain words, short sentences.
- Use only the numbers in this brief, exactly as written. Do not round them differently, add totals, or invent any
  number. Where the brief says "exposure", never write "loss".
- Prefer native PowerPoint shapes, tables and charts over pictures, so Morph can animate them.
- Put the "Say" notes into the speaker notes, not on the slide.

## Words to explain once

| Word | Plain meaning |
|---|---|
| Front, middle, back office | Front: portfolio managers create trades. Middle: book trades, price holdings, check our records against the custodian. Back: fund accounting keeps the official books and calculates NAV. |
| Book (book of record) | The platform's own official list of what each account holds. |
| Custodian | The outside bank that holds the securities and keeps its own separate list. |
| Rebuild | We start each holding at zero and add up its trades. That gives what the holding *should* be. |
| Break | A holding where the versions don't agree. A difference to explain, not automatically a mistake. |
| Check | One test at one handoff between teams, with one owner. We have 7. |
| Rule | One exact condition the code tests. Each check has several rules. |
| Finding | One result line: **confirmed** (we can prove it's wrong), **unresolved** (something's off, but we can't yet prove which side) or **cleared** (looked wrong, proved fine). |
| NAV | Net asset value: what one share of a fund is worth. |
| Exposure | How much *could* be wrong if our reading is right. Not a loss. |
| Basis point (bp) | One hundredth of one percent. |

---

## Part 1: the problem and why it matters

### Slide 1: Title

- **On the slide:** team name; "Where data quality controls belong on a front-to-back investment platform" (or our
  own title); team members; date (20 November 2026). State Street and BC logos (larger on this slide).
- **One-line thesis under the title:** "Agreement isn't proof."
- **Morph:** the title becomes the small header on slide 2.

### Slide 2: Agenda

- **Headline:** "Three parts: the problem, the product, and how it works"
- **On the slide:** 1. The problem: a trade that passed every check. 2. Live demo: our dashboard. 3. How it works:
  checks, findings, proof, and what to fix first.
- **Morph:** this agenda shrinks into a thin strip at the top of later section slides; the highlight moves to the
  current part.

### Slide 3: One trade

- **Headline:** "This trade is wrong, and it passed every check on the platform"
- **On the slide:** one trade card, then its path across the offices:
  - Trade `TXN100052151`: a **BUY** of security `SEC961485` for account `ACC1014776`, sent by `OMS_FRONT` on
    2 June 2026, quantity **−1,995**. A BUY can't have a negative quantity.
  - Pipeline: received 10:09, booked 10:15, published 10:22, before the 18:00 cutoff. One pipeline record. Status
    BOOKED.
  - Book: the holding is −9,688. Custodian: also −9,688. **They match.**
  - It flows into fund `FND00317`. If the sign is wrong, the exposure is about **19 bps** of that fund's net assets.
- **Visual:** a horizontal path (trade capture → pipeline → book → custodian → NAV) with a green tick at every step.
  Build it from shapes so slide 14 can reuse it. `docs/figures/08_journey_negative_buy.png` is the reference.
- **Say:** the money on the row (gross amount ÷ price) confirms the size, 1,995 units. It can't tell us the
  direction. Either the sign is wrong (should be +1,995) or the type is wrong (should be a SELL). Either way the
  record is wrong, and nothing stopped it.
- **Numbers from:** `outputs/02_trace.csv` (every field above; exposure is the row "indicative exposure (bps of fund
  net assets)" = 19.4048, under the wrong-sign reading, 0 under the wrong-type reading).

### Slide 4: Not one trade, a class

- **Headline:** "It's not one trade, and the book and the custodian agree on the wrong number"
- **On the slide:**
  - **655** trades have a negative quantity. Out of **645** positions with such a trade that we can compare, the
    custodian equals the book on **641**.
  - Wider: book and custodian agree on **99.5%** of positions. But on **3,637** of those, the trades say something
    else. The causes:

    | Cause | Positions |
    |---|---|
    | Duplicate copies of a trade counted twice | 2,021 |
    | A quantity nothing explains | 717 |
    | Reversed trades subtracted twice | 680 |
    | Opposite sign to the trades | 216 |
    | Duplicates and reversals together | 3 |

- **Visual:** three bars per position: rebuilt, book, custodian. Book and custodian are equal; rebuilt stands
  apart.
- **Morph:** from slide 3, the trade card shrinks into one dot among many: one trade becomes a class.
- **Say:** the custodian match is the industry's safety net. Here it copies the book's habits, so it can't see the
  problem. That is our whole argument: agreement isn't proof.
- **Numbers from:** FINDINGS "Negative trade quantity" (655); `outputs/02_trace.csv` row "positions with a
  negative-quantity trade: custodian equals the book" (641 of 645); `outputs/02_three_way_summary.csv` (book vs
  custodian "matched" share 0.995011; "rebuild is the odd one out" 3,637); FINDINGS unresolved lines starting "Book
  and custodian ..." (the five causes, which add up to 3,637).

### Slide 5: Why it matters to State Street

- **Headline:** "Wrong holdings reach fund prices, and the usual safety net can't see them"
- **On the slide:**
  - Holdings feed NAV, the price every fund investor buys and sells at.
  - The negative-quantity trades touch **652** accounts in **358** funds. If their sign is wrong, the exposure we
    could value is **$415 million** gross, up to **958 bps** of one fund's net assets. That covers **64%** of the
    rows; the rest have no usable price.
  - Master data spreads further: **15** securities that were never set up sit under **1,118** holdings in **1,116**
    accounts and **446** funds, with no price at all.
  - Platform score: **88.50 out of 100**. Only **1** of our 6 measured KPIs meets its target.
- **Say:** this is exposure, not a loss. Scenarios overlap, so we never add them up. The custodian match alone
  scores 99.6%, which is why the problem stays hidden.
- **Numbers from:** `outputs/02_severity.csv`, scenario "Negative quantities: wrong-sign scenario"
  (distinct_accounts 652, affected_funds 358, gross_delta_usd_valued_subset 415,436,373, max_fund_gross_bps 957.6,
  valuation_coverage 0.635) and "Missing security master / spin-off target" (1,118 rows, 1,116 accounts, 446 funds,
  valued rows 0); FINDINGS scorecard (platform 88.50; KPI 2 is the only computed KPI met; KPI 4 = 99.60%).

### Slide 6: Our answer

- **Headline:** "Put the checks where the data enters, and give every office a score it owns"
- **On the slide:**
  - 7 checks at the handoffs between teams, each with an owner. 4 of the 7 sit *before* the book.
  - Every finding is confirmed, unresolved or cleared, with the record IDs behind it.
  - One dashboard: the executive roll-up, a drill-down to one record, and the map of where each check sits.
  - Our first recommendation: stop bad trades and missing master data at entry (slide 13).
- **Morph:** a dashboard screenshot tile grows to fill the slide; switch to the browser.
- **Say:** "Let us show you."
- **Numbers from:** `scripts/framework.json` "checks" (7 checks; handoffs 1 to 4 are before the book).

---

## Part 2: live demo (about 4 minutes)

One divider slide ("Live demo"), then hidden backup screenshots of each step.

1. **Executive view:** platform and domain scores, KPIs by office, what to fix first. Point at the Corporate
   actions domain (score 36.50) and the custodian KPI.
2. **Drill into one rule:** negative trade quantity → its records.
3. **Trace a record:** `TXN100052151`, the slide 3 trade, end to end: trade, pipeline, book, custodian, fund.
4. **Data map:** where the trade check sits, at the first handoff, and who owns it.

Practise this exact path. Browser zoom about 125%, other tabs closed, fresh store.

---

## Part 3: how it works

### Slide 7: How we know

- **Headline:** "We rebuilt every holding from its trades and compared three versions"
- **On the slide:** **1,409,533** trade rows rebuilt into positions and compared with **480,663** book positions and
  the custodian. Result: all three agree on **98.1%**. The rebuild is the odd one out on **3,637**; the custodian on
  **1,886**; **2,791** can't be tested because a trade has no quantity (counted apart, never as right or wrong).
- **Visual:** the waterfall, `docs/figures/09_waterfall.png`, or a simple bar of the groups.
- **Say:** "can't test" is its own bucket. We never count missing data as passing.
- **Numbers from:** FINDINGS confirmed lines (eligible trade rows 1,409,533; positions 480,663);
  `outputs/02_three_way_summary.csv` (all three agree 0.980703; rebuild odd one out 3,637; custodian odd one out
  1,886; not evaluable blank quantity 2,791).

### Slide 8: Checks and rules

- **Headline:** "Seven checks, each with an owner, at the handoffs between teams"
- **On the slide:** a table:

  | # | Check | Where | Owner | If it fails |
  |---|---|---|---|---|
  | 1 | Account | Accounts → trades | Account onboarding lead | Hold |
  | 2 | Security | Securities → trades | Security master lead | Hold |
  | 3 | Trade | Trade capture | Trade operations lead | Reject or hold |
  | 4 | Corporate action | Before the ex-date | Corporate actions lead | Quarantine |
  | 5 | Position | Book vs trades vs custodian | Reconciliation lead | Flag a break |
  | 6 | Price | Holdings | Pricing lead | Next vendor, or flag |
  | 7 | NAV | Ledger | Fund accounting lead | Hold the NAV |

- **Say:** a check is what an office owns; a rule is the exact condition the code tests (several per check).
  Thresholds sit in a config file, so anyone can change one live.
- **Visual:** `docs/figures/01_control_map.png` beside the table, or the table alone.
- **Numbers from:** `scripts/framework.json` "checks"; [RULES.md](../RULES.md).

### Slide 9: Where defects enter vs where they're found

- **Headline:** "Most defects enter at capture or in master data, long before anyone looks"
- **On the slide:** the detection matrix: each defect class, the stage it entered, where it surfaced, the earliest
  check that could stop it.
- **Visual:** `docs/figures/03_detection_matrix.png`, or rebuilt as a table.
- **Say:** this is the architecture answer. A check after the book compares the error with a copy of itself.
- **Numbers from:** [DEFECT_CATALOG.md](../DEFECT_CATALOG.md).

### Slide 10: What we found

- **Headline:** "71 findings: 37 confirmed, 29 unresolved, 5 cleared"
- **On the slide:** three traced defects, one line each:
  1. **Negative-quantity BUY** (`TXN100052151`): entered at trade capture; book and custodian both carry it.
  2. **Spin-off target never set up** (`CA00005`): entered in master data; **23** corporate actions point at
     securities that don't exist, and **1,118** holdings sit on them with no price.
  3. **A price about 100 times off** (`SEC225708`): the vendors' quotes differ by a factor near 100, and the
     preferred vendor's quote, the one we would use, is the odd one out. **4** securities.
- **Say:** unresolved is honest, not weak: it means we can show something is off but the data can't say which side
  is wrong, and we name the data that would settle it.
- **Numbers from:** FINDINGS header (71, 37, 29, 5); FINDINGS lines "Corporate-action target security missing from
  securities" (23), "Position on a security_id missing from securities" (1,118), "Scale flag: the chosen quote is
  the odd one out" (4); catalog entries 1 and 4.
- **Open:** trace 3 (the 100× price) is not yet written up in the catalog; the team decides if it is the third trace.

### Slide 11: What looked wrong but wasn't

- **Headline:** "Two things that looked wrong, and why we cleared them"
- **On the slide:**
  1. **Closed positions (42):** the trades net to zero and neither the book nor the custodian lists them. Cleared:
     neither source stores a single zero row anywhere, so leaving closed positions out is their normal behaviour.
  2. **A price 100× off that is actually right (6 securities):** the chosen vendor's price looks far from one quote,
     but another vendor agrees with it, so the odd one out is the other quote.
- **Say:** clearing a flag needs a rule written before looking, independent evidence, and what would change our mind.
- **Numbers from:** FINDINGS "Cleared" lines "Closed position not reported" (42) and "Scale flag: the chosen quote is
  backed by another vendor" (6); catalog entry 6.
- **Open:** the team confirms the second clearance (the price one pairs with trace 3).

### Slide 12: Can you trust it, and what we can't prove

- **Headline:** "We planted errors and the checks found every one; here is what we still can't prove"
- **On the slide:**
  - Stress test: 100× prices planted in a copy of the data. **30 of 30** planted defects caught, **30 of 30** valid
    look-alikes left alone (no false alarm), **30 of 30** vendor-priority flips caught.
  - Shuffling the input rows changes no result. Thresholds live in config; change one and rerun.
  - What we can't prove: which reading is right for the negative quantities (sign or type), what the book did with
    blank quantities, and dollar values for holdings with no price. We name the data that would settle each.
- **Numbers from:** FINDINGS "Stress test" (defect caught 30/30; look-alike cleared 30/30; flip caught 30/30);
  `tests/robustness_test.sh`; catalog entries 1 and 2.

### Slide 13: What to fix first

- **Headline:** "Three controls to build first, earliest in the flow first"
- **On the slide:**

  | # | Fix | Owner | Why first | Depends on |
  |---|---|---|---|---|
  | 1 | Corporate action check before the ex-date: hold any event whose new security isn't set up | Corporate actions lead, with the security master lead | Already sits in held positions with no price; about 200 events a month, cheap to run | Security master set-up process |
  | 2 | Trade check at capture: reject non-positive quantities and repeated transaction IDs | Trade operations lead | The book and the custodian both copy these errors, so nothing later catches them | Source systems send an order side |
  | 3 | Position check against the trades, not only the custodian | Reconciliation lead | The custodian follows the book's habits, so a match proves little | Fixes 1 and 2 reduce the noise |

- **Say:** open problems are ranked by: will it reach a NAV, then how many accounts and funds, then how much money,
  then how cheap the fix. Anything open past 2 business days goes to management.
- **Numbers from:** `scripts/framework.json` "operating_model" (ranking, 2 business days, about 200 events a month).
- **Open:** costs are not estimated beyond "cheap to run". Add them or say so.

### Slide 14: Close

- **Headline:** "With the check at capture, this trade would have stopped on day one"
- **On the slide:** slide 3's path again; the trade check at capture lights up and the trade stops there. One line:
  the decision we ask for (build fix 1 and fix 2 first).
- **Morph:** the path from slide 3 returns; the first step changes from a green tick to a red stop.

---

## Appendix (not counted)

KPI table by office; wireframes for the three offices (to draw); scorecard by domain; reconciliation waterfall and
sensitivities (`docs/figures/09_waterfall.png`, `docs/figures/11_sensitivities.png`); full findings register;
reproducibility (run commands, runtime, row shuffle, threshold change); demo backup screenshots.
