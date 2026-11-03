# Check-in 2: brief for building the deck

*Written 26 Oct 2026 for the team building the Check-in 2 deck by hand. For each slide it gives the title to use, what
it means in plain words, what to show, the numbers, and what faculty may ask. The file behind every number is listed
in §7 at the bottom. All numbers come from the run whose checksum is `d7e752f55f0a` (top of
[FINDINGS.md](../../FINDINGS.md)); if that checksum has changed, the numbers need checking again.*

## 1. Words you need

Read this first. The rest of the brief uses these words, and so will faculty.

| Word | What it means |
|---|---|
| **Trade** | One row in the `transactions` table: someone bought (BUY) or sold (SELL) some units of a security. |
| **Holding** (or **position**) | How many units of one security one account owns on one day. |
| **Our recount** (the *rebuild*) | We start every holding at zero and add up its trades: a BUY adds, a SELL subtracts. That gives what the holding *should* be. |
| **Official list** (the *book*) | The `positions` table: the platform's own record of holdings. |
| **Custodian** | The `comparison_positions` table: the outside bank that holds the securities keeps its own separate list. |
| **Three-way check** | For every holding we compare our recount, the official list and the custodian. |
| **Break** | A holding where the three don't all agree. A break is a difference to explain. It is **not** automatically a mistake. |
| **Can't test** (*not evaluable*) | We can't check the holding, for example because one of its trades has no quantity. We count these separately: they're neither right nor wrong. |
| **Confirmed / unresolved / cleared** | The only three statuses a finding can have. *Confirmed*: we can prove it's wrong. *Unresolved*: something's off, but we can't yet prove who's wrong. *Cleared*: it looked wrong, but we proved it's fine. Analogies in [TEAM_GUIDE.md §4](TEAM_GUIDE.md#4-confirmed-unresolved-cleared). |
| **Exposure** | How much *could* be wrong if our reading is right. Never call it a "loss": nobody has lost money that we can show. |
| **Basis point (bp)** | One hundredth of one percent. 19 bp = 0.19%. |
| **Duplicate copy** | The same trade (same ID) arriving twice. We count it once. |
| **CANCELLED** | A trade that was cancelled. It doesn't count. |
| **REVERSED** | A row marked "reversed", pointing at an earlier trade. The data doesn't say whether it *undoes* that trade or is just a label. See slide 8. |
| **Corporate action** | Something a company does that changes holdings: a split, a dividend, a merger, a spin-off, a redemption (the company buys the security back). |
| **NAV** | Net asset value: what one share of a fund is worth. Fund value ÷ number of shares = price per share. |
| **Vendor** | A company that sells prices. Each security can have prices from up to three vendors. |

## 2. What tomorrow is for

- **The goal:** faculty agree that our way of working the data is sound, so we can build the full analysis. Nothing is
  graded tomorrow.
- **What to bring:** the six items on the brief's list
  ([brief §8](../../../reference/01_Student_Brief.md#8-schedule-and-check-ins)). Slides 1–9 cover them one by one.
  Nothing else goes in: no dashboard, no scores, no KPIs.
- **Format:** 8 to 10 slides, plus the notebook running live on the laptop. Backup slides after the end don't count.
- **Feedback from Check-in 1:** tell one story, don't list results. Our story is one broken trade that gets past every
  check after the point where it entered (slide 5).
- **Faculty will ask three questions** ([Working Guide §9](../../../reference/03_Student_Working_Guide.md#9-check-in-preparation)).
  Our short answers:

| Their question | Our answer |
|---|---|
| Does your recount run on all the data? | Yes. All 1,409,533 trades, in about a minute. We can show it live. |
| How many breaks, sorted how? | 5,539 breaks, each given one most likely cause. 2,605 have no cause yet, and we show them instead of hiding them. |
| What did you assume about REVERSED, and what else could it mean? | We read it as a label (the Guide's standard reading). The other reading changes the result for only 5 of the 699 holdings that have one. |

## 3. Rules for every slide

1. **The title is the point of the slide**, written as a full sentence. Example: "The fund arithmetic fails on 40 of
   2,000 rows", not "NAV check".
2. **Every number comes with its "out of"**: "40 of 2,000", never just "40".
3. **Every finding has its status**: confirmed, unresolved or cleared.
4. **Say "break" or "difference", not "error"**, unless the finding is confirmed.
5. **Say "exposure", not "loss".**
6. **Say "we think" when it's our reading**, and "the data shows" when it's in the data.
7. **Big tables go in backup.** On the slide, show only what someone at the back of the room can read.

## 4. Slide by slide

### Cover

**Title:** Check-in 2: the method gate

**Say:** today we show how we work the data, follow one broken trade through the platform, and ask to be cleared to
build the full analysis.

---

### Slide 1 · The answer

**Title:** Our recount runs on all 1.41M trades, and 98.7% of the holdings we can test agree in all three sources

**In plain words:** we recounted every holding from its trades and compared it with the official list and the
custodian. Almost all of them agree. A few thousand we can't test, and we keep those out of the 98.7% on purpose.

**Show:** the 98.7% as one big number, with the "can't test" count beside it.

| Number | What it means |
|---|---|
| 1,409,533 | trades we read: every row, nothing skipped |
| about 1 minute | how long the whole recount takes |
| 471,583 of 478,026 (98.7%) | holdings where all three sources agree, out of the holdings we can test |
| 2,836 | holdings we can't test: 2,791 because a trade has no quantity, 39 because a trade arrived twice with different details, 6 for both reasons |
| 5,539 | breaks: holdings where the three don't all agree |
| 637 | holdings that agree but still contain a BUY with a negative quantity. Agreement is not proof (slide 5) |

**If they ask "why not 478,026 + 2,836 in the denominator?":** because a holding we can't test is neither right nor
wrong. Counting it as wrong would make us look worse for no reason; counting it as right would hide it. So it sits
next to the rate.

---

### Slide 2 · How we got there, step by step

**Title:** Cleaning the trades raises the differences with the official list, because the list counts duplicate
copies that we count once

**In plain words:** we cleaned the trades in steps (remove duplicate copies, drop cancelled trades, and so on). You'd
expect each step to bring us closer to the official list. One step does the opposite: when we remove the duplicate
copies, the differences go *up*. That's because the official list counts both copies. So the gap shows a habit of
the official list that we question, not a worse recount.

**Show:** figure `09_waterfall.png`.

| Version of the recount | Holdings that differ from the official list |
|---|---|
| Every trade as delivered, nothing cleaned | 5,880 of 480,870 |
| The Guide's standard version (only trades with status BOOKED) | 1,625 of 480,862 |
| Our cleaned version | 3,656 of 480,862 |

| Number | What it means |
|---|---|
| 2,060 | trade IDs that arrived twice. Both copies came in together and were sent on about 5 minutes apart: it looks like a resend (our reading) |
| 2,053 of 2,053 | holdings with a copy where the official list counts both copies |
| +2,032 | extra matches we'd get if we counted both copies too. That's about the size of the gap (2,031) between our version and the Guide's |

**Our cleaning steps, in order:** remove exact copies → set aside copies that disagree with each other → drop
CANCELLED trades → treat REVERSED as a label → keep negative quantities as they are, and flag them → set aside trades
with no quantity → count trades up to the trade date.

---

### Slide 3 · Comparing three sources

**Title:** On 3,637 holdings the official list and the custodian agree with each other, but not with the trades

**In plain words:** normally, if two sources agree, you trust that number. Here the custodian seems to copy the
official list's habits (counting duplicate copies twice, subtracting REVERSED rows). So when they agree, it doesn't
prove much: they may be making the same mistake.

**Show:** figure `10_three_way.png`.

| Who disagrees (480,862 holdings in total) | Holdings |
|---|---|
| Nobody: all three agree | 471,583 |
| Our recount is the odd one out (official list = custodian) | 3,637 |
| The custodian is the odd one out | 1,886 |
| All three differ | 16 |
| In our recount and the official list, missing at the custodian | 478 (the two agree on 475) |
| In the official list and at the custodian, but no trades behind them | 384 |
| Only in our recount, and the trades add up to zero (see slide 7, the cleared flag) | 42 |
| Can't test | 2,836 |

**Official list against custodian on their own** (no recount involved): 478,265 match, 1,918 differ, 480 are in the
official list only, 0 are at the custodian only.

---

### Slide 4 · Sorting the breaks

**Title:** Most breaks have a named cause; the 2,605 we can't explain yet stay visible

**In plain words:** for every break we ask two things. First, *who* disagrees. Then, *why*: we try a short list of
possible causes, always in the same order, and the first one that fits is the cause. The list and the order were
written down before we looked at the results. So each break gets exactly one cause and nothing is counted twice.
If no cause fits, we say "unexplained" rather than force one.

**Show:** a bar chart or a short table like this one.

| Most likely cause | Holdings | Status |
|---|---|---|
| The official list and custodian count duplicate copies twice | 2,030 | unresolved |
| The custodian differs from both, no cause yet | 1,886 | unresolved |
| The official list and custodian agree on a number the trades don't explain | 717 | unresolved |
| The official list and custodian subtract every REVERSED row | 683 | unresolved |
| The official list and custodian have the opposite sign (+ instead of −) to the trades | 218 | unresolved |
| Both of the first and fourth causes together | 3 | unresolved |
| All three differ, no cause | 2 | unresolved |
| **All breaks** | **5,539** | |

**Why "unresolved" and not "mistake":** counting copies twice and subtracting REVERSED rows may be deliberate house
rules of the official list. We're asking faculty (slide 10).

---

### Slide 5 · One broken trade, followed step by step

**Title:** A broken trade gets past every check after the point where it entered

**In plain words:** this is the heart of the story. A trade says someone *bought* −1,995 shares. You can't buy a
negative number of shares, so the record is certainly wrong. But the official list and the custodian both carry the
same wrong number, so every later check (our three-way check, prices, the fund arithmetic) sees nothing wrong. The
only place to catch it is when the trade is first entered.

**Show:** figure `08_journey_negative_buy.png`. Optionally, a small copy of `06_journey_trade_simple.png`: the clean
trade from Check-in 1, for contrast. The full story, step by step: [STORY.md](STORY.md).

| Step | What we found | Data or our reading? |
|---|---|---|
| How we picked it | Chosen by a written rule (the first holding with a negative BUY and no other problem), not by hand | rule |
| The trade | TXN100052151: a BUY of **−1,995** shares, sent by the trading system OMS_FRONT, status BOOKED | data |
| Its size | The money paid ÷ the price = 1,995 shares. So the money confirms *how many*, but not *buy or sell*: the money is positive on every trade, buy or sell | data |
| What it should be | Two possibilities: a BUY of +1,995 (the sign is wrong), or a SELL of 1,995 (the type is wrong). We lean toward the sign being wrong: the 5 other negative BUYs that have a second record all point that way. This one has no second record | our reading |
| Pipeline | Processed on time, before the daily cutoff; nothing along the way changes the sign | data |
| Official list | Holds −9,688, exactly what our recount gives, so the check **matches and hides the problem** | data |
| Custodian | Also −9,688. Across all holdings with a negative trade, the custodian matches the official list on 641 of 645 | data |
| What it could cost | If the sign is wrong, the holding should be −5,698: 3,990 shares wrong, about **19 bp** of the fund's value. If the type is wrong, the official list is right and nothing is wrong | our reading |
| Where to stop it | When the trade is entered: reject any quantity that isn't above zero. Owner: trade operations | proposal |

**Status:** the record is confirmed wrong; what it should say is unresolved (leaning toward the sign being wrong).
Exposure, not a loss.

---

### Slide 6 · Checks on prices and on the fund arithmetic

**Title:** The fund arithmetic fails on 40 of 2,000 rows, and 10 securities have vendor prices about 100 times apart

**In plain words:** the brief asks us to *propose* checks on prices and on the fund's arithmetic. We went further and
ran two of them on all the data. The other three are written as rules, ready to run.

**Show:** a table of the five checks: two marked "ran", three marked "proposed".

| Check | In plain words | Result |
|---|---|---|
| **Fund arithmetic** (ran) | Fund value ÷ number of shares should equal the price per share | Fails on 40 of 2,000 rows. We can't yet tell which of the three numbers is wrong |
| **Vendors disagree** (ran) | Do the vendors' prices for a security differ by more than 0.5%? | Yes on 388 of 6,000 securities; 15 have no price to compare |
| **Price 100 times off** (ran) | One vendor's price is about 100 times another's. Likely cause: one quotes per 100 units, the other per unit | 10 of 6,000 securities. We flag them, we never fix them automatically |
| **Coverage** (proposed) | Does every holding have a price? | Early sign: 1,118 holdings are on a security with no price at all |
| **Freshness** (proposed) | Is the price from the right day? | Early sign: the first-choice vendor has no usable price on 30 of 180,000 security-days |
| **Exchange rates** (proposed) | Are the currency rates sensible? | The US dollar to US dollar rate isn't exactly 1 on 30 rows: question for faculty |

**Say:** the limits (0.5%, the "about 100 times" band) are in a settings file, not in the code. A judge can change one
and rerun. Cash and accruals aren't in the data, so a failed fund-arithmetic row is never called a proven NAV error.

---

### Slide 7 · The defect catalog

**Title:** Five problem types go forward, and one flag turned out to be fine

**In plain words:** we found 39 problems in total. Five are worth taking forward, because each one shows a different
weak point on the platform (where trades are entered, the data pipeline, the master list of securities, the
custodian's feed). Each has a full write-up: how we found it, how many records, how sure we are, the fix and who owns
it. Full write-ups: [DEFECT_CATALOG.md](../../DEFECT_CATALOG.md).

| # | Problem | How many | Status | Where it entered |
|---|---|---|---|---|
| 1 | BUY trades with a negative quantity | 655 of 1,406,714 trades | confirmed wrong; correct value unresolved | trade entry |
| 2 | Trades with no quantity, which the official list leaves out | 2,819 trades. The size can still be worked out from the money and price on 2,802; the official list leaves out the shares on 2,756 of 2,778 holdings we can test | confirmed wrong; effect on holdings unresolved | trade entry |
| 3 | Duplicate copies counted as two trades | 2,021 holdings | unresolved (the copies themselves are confirmed) | data pipeline |
| 4 | New securities from spin-offs never set up | 23 of 23 | confirmed | master list of securities |
| 5 | Holdings missing at the custodian | 480 holdings in the official list, none at the custodian | unresolved | custodian's feed |
| 6 | **Cleared:** closed holdings not listed | 42 holdings whose trades add up to zero | cleared | — |

**The cleared flag, in plain words:** 42 holdings appear in our recount but in neither list. Alarming? No: everything
bought was sold again, so the holding is closed. We wrote the rule before looking ("a closed holding isn't listed"),
and checked it somewhere else: neither list ever shows a holding of zero. One zero holding in either list would
reopen it.

**Backup:** all 39 findings: 17 confirmed, 21 unresolved, 1 cleared.

---

### Slide 8 · When the data can mean two things

**Title:** Where the data is unclear, we chose the careful reading and measured the other one

**In plain words:** some data can be read two ways. Each time, we picked the careful reading, then reran the whole
recount with the other reading to see how much it changes. The number in the last column is how many more (or fewer)
holdings would match the official list, out of 480,862.

**Show:** figure `11_sensitivities.png`, or this table.

| What's unclear | What we did | The other option | Change in matches |
|---|---|---|---|
| **REVERSED rows** | Treat them as a label: the original trade still counts (the Guide's standard reading) | Let each REVERSED row cancel its original trade, once | +2 |
| | | Let *every* REVERSED row cancel (some trades have two, so they'd be cancelled twice: what the official list seems to do) | +681, but cancelling twice is wrong, so we **refuse** it |
| **Duplicate copies** | Count once | Count both, like the official list | +2,032 |
| **Copies that disagree** | Set them aside (can't test) | Keep the first one | +3 |
| **Negative quantities** | Keep the minus sign, flag the holding | Drop the minus sign | −638 |
| **No quantity** | Set aside (can't test) | Count it as zero | +2,611 |
| | | Work out the size from money ÷ price | 2,778 of 2,797 become testable, and **0** of them match the official list |
| **Which date counts** | The trade date | The settlement date | −59,970 |

**The REVERSED answer in one sentence:** the other reading changes the result for only 5 of the 699 holdings with a
REVERSED row, so our choice barely moves the numbers. What would settle it is a written rule saying what REVERSED
means: faculty question 1.

**Watch out for this one:** two options give many more matches (counting copies twice, counting a blank as zero).
That doesn't make them right. It shows that the official list does those things itself. And the last row of "no
quantity" shows these are real trades: the official list leaves out their shares.

**Why does the settlement date lose so many matches?** The official list counts a trade on the day it's made, not
the day the money and shares change hands. So the trade date is the right one to compare with.

---

### Slide 9 · Corporate actions we can't apply

**Title:** 118 of 200 corporate actions can be applied; 82 are held back because a detail we need is missing

**In plain words:** before counting, we wrote down which details each type of event needs. A split needs its ratio;
a merger needs to say which new security you get. If a detail is missing, we hold the event back instead of guessing.

**Show:** this table.

| Type of event | Can apply | Held back | What's missing |
|---|---|---|---|
| Cash dividend | 66 | 0 | |
| Split | 52 | 0 | |
| Merger | 0 | 31 | which new security holders receive |
| Redemption | 0 | 28 | a rule for what happens to the units that disappear |
| Spin-off | 0 | 23 | the new security was never set up in the master list |
| **Total** | **118** | **82** | |

**Also flagged, not held back:** 87 of 200 events have their ex-date (from that day, a new buyer no longer gets the
event) after their effective date (the day the change happens). Whether that's wrong depends on how the two dates are defined: faculty question 2.
And 141 of 200 carry a detail their type doesn't use.

**Say:** "held back" means we neither apply the event nor guess its details, and for each one we say what would let us
apply it. The holdings after corporate actions come in the final, kept apart from today's recount so nothing is
counted twice.

---

### Slide 10 · What we ask

**Title:** We ask to be cleared to build the full analysis, and for your view on 8 questions

**Show:** the questions, grouped by what each answer would change. Full wording: [STATUS.md, "Open questions for
faculty"](../../STATUS.md).

| Question | What the answer changes |
|---|---|
| 1. What does REVERSED mean, exactly? · 4. Are counting copies twice and subtracting REVERSED rows deliberate rules of the official list? | Two big break causes would become "explained" instead of problems |
| 8. Is a negative BUY a wrong sign or a wrong type? | Settles all 655 negative BUYs |
| 2. How are ex-date and effective date defined? | Settles the 87 flagged corporate actions |
| 3. Why isn't the USD rate exactly 1? · 5. May we use a published NAV-error threshold from a regulator? · 6. Which AI tools are we allowed to use with the data? · 7. How should we package the dashboard? | How we work |

**Next, after tomorrow:** look inside the groups we've only counted so far, such as the 2,605 unexplained breaks
(full list in [STATUS.md](../../STATUS.md), "Next: after Check-in 2"). Then scores, stress tests and the executive
dashboard for Check-in 3.

---

### Backup slides

- **B1 · Every alternative reading:** the full table behind slide 8.
- **B2 · REVERSED, both readings:** where the 699 holdings with a REVERSED row land under each reading (694 in the
  same place).
- **B3 · All 39 findings:** by status, each with its "out of" number ([FINDINGS.md](../../FINDINGS.md)).

## 5. Who presents what (fill in)

Everyone presents at least one slide and can explain one number. Give each person the catalog entry closest to their
slide to check in [DEFECT_CATALOG.md](../../DEFECT_CATALOG.md) (the blank *Reviewed by* line).

| Slide | Presenter | Catalog entry they check |
|---|---|---|
| 1–3 (recount and three-way check) | | |
| 4 (sorting the breaks) | | |
| 5 (the broken trade) | | 1 · negative BUYs |
| 6 (price and fund checks) | | |
| 7 (catalog) | | 2–6 |
| 8–9 (unclear cases) | | |
| 10 (the ask) | | |
| Running the notebook live | | |

## 6. Before you walk in

- [ ] Run `tests/run_notebook.sh` once. It must finish, and the checksum at the top of FINDINGS.md must still be
      `d7e752f55f0a`. If it isn't, the numbers in this brief need checking again.
- [ ] Every number on the slides matches this brief.
- [ ] Every slide title is a sentence; every number has its "out of"; every finding has its status.
- [ ] Have the notebook, STORY.md and DEFECT_CATALOG.md open on the laptop, in case they ask about one record.
- [ ] Be ready to change a limit live, for example the 0.5% vendor limit (`spread_threshold` in
      `config/reconciliation.toml`), then rerun the notebook.

## 7. Where each number comes from

For whoever checks the slides. All files are in `outputs/`; our decisions are in [DECISIONS.md](../../DECISIONS.md).

| Slide | Numbers | File (and the row or column to look at) | Decision |
|---|---|---|---|
| 1 | trades read | `02_row_ledger.csv`; `02_waterfall.csv` (C0, rows used) | |
| 1 | run time | `02_run_info.csv` (runtime_seconds) | |
| 1 | 98.7%, can't test | `02_three_way_summary.csv` (all three agree; the three "not evaluable" rows). Out of = 480,862 − 2,836 | D-046 |
| 1, 4 | breaks, causes, the 637 | `02_break_classes.csv` (is a break = yes; sign_conflict_keys on "all three agree") | D-013 |
| 2 | the three versions | `02_waterfall.csv` (C0, BOOKED-only, C7; compared with positions; different, keys in union) | D-004 |
| 2 | copies | `02_duplicate_profile.csv`; `02_sensitivities.csv` (C1, both counted, positions) | D-044 |
| 3 | who disagrees | `02_three_way_summary.csv` (rebuild vs book vs custodian; book vs custodian) | |
| 4 | causes table | `02_break_classes.csv`. Each cause = the "rebuild is the odd one out" row + the "all three differ" row with the same cause (e.g. copies 2,021 + 9) | D-013 |
| 5 | the trace | `02_trace.csv`; `02_negative_partners.csv`; `02_sign_by_type.csv` | D-025, D-043 |
| 6 | fund arithmetic | `02_nav_check.csv` (result) | D-019 |
| 6 | vendors | `02_vendor_check.csv` (result, vendors); limits in `config/reconciliation.toml` [prices] | D-015 |
| 6 | coverage, freshness, USD rate | [FINDINGS.md](../../FINDINGS.md) (held security with no price; preferred vendor has no valid price; USD rate to USD is not 1) | D-041 |
| 7 | catalog | `02_defect_register.csv` / [FINDINGS.md](../../FINDINGS.md); `02_blank_quantity.csv` | D-005, D-024, D-047 |
| 8 | alternatives | `02_sensitivities.csv` (compared with positions, "matched vs main chain"); `02_blank_quantity.csv` (positions); settlement date = C7s − C7 matched in `02_waterfall.csv` | D-007, D-021 |
| 8, B2 | REVERSED 5 of 699 | `02_reversed_side_view.csv` | D-007 |
| 9 | corporate actions | `02_ca_readiness.csv` (action_type, verdict, reason codes); `02_defect_register.csv` (ex_date after effective_date; ratio or cash_rate filled) | D-016, D-020 |
