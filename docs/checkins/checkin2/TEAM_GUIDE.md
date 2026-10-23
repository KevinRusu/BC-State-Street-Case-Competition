# Team guide: Check-in 2 in plain words

*For teammates, before working on the Check-in 2 deck. About fifteen minutes. Read it first, then
[STORY.md](STORY.md) (one broken trade, end to end). Frozen after Check-in 2.*

*Every number here comes from the run whose register checksum is `b29e95bb9740`. If the checksum at the top of
[FINDINGS.md](../../FINDINGS.md) is different, the notebook has been rerun and some numbers below may be out of date.
Small markers like [^three] say which file each number comes from; the list is at the bottom. The requirements
themselves live in the brief: this guide links to it and puts it in our words, it does not replace it.*

## 1. The project in one page

- **The client's problem.** State Street moves huge amounts of investment data from the trading desk to the fund's
  books. Somewhere along the way, data breaks: a trade booked twice, a price that never updated.
- **The big idea.** A mistake costs more the further it travels before anyone catches it
  ([brief §1](../../../reference/01_Student_Brief.md#1-why-this-matters)).
- **The question we answer.** How early can the platform catch a data mistake, and can we prove where it came from?
- **The route the data takes** ([brief §3](../../../reference/01_Student_Brief.md#3-the-platform-data-lifecycle)):
  the "address books" of accounts and securities → trades → holdings → prices and checks → the fund's value (NAV).
- **The three offices that touch the data:**
  - **Front office:** makes the trades.
  - **Middle office:** keeps the official list of holdings, prices it and checks it.
  - **Back office:** keeps the accounts and works out what the fund is worth per share.
- **What we hand in at the end** ([brief §7](../../../reference/01_Student_Brief.md#7-what-you-submit)): the deck
  (the thing that matters most), a short report, a working dashboard, the code, and a team declaration with our AI
  chat logs.
- **How it's graded** ([brief §9](../../../reference/01_Student_Brief.md#9-how-judges-will-evaluate-your-work)):
  half the marks are for designing the checks and for finding and proving mistakes. The rest: business advice,
  measures for each office, the dashboard and communication, and whether someone else can rerun our work.
- **Where we are:** Check-in 1 done → **Check-in 2 now** → Check-in 3 (week of 9 Nov) → final (20 Nov). Dates in
  [brief §8](../../../reference/01_Student_Brief.md#8-schedule-and-check-ins).

## 2. What Check-in 2 asks for, and why

Check-ins are **not graded**. They are where faculty sign off on how we work the data. The goal is to **leave cleared
to build the full analysis**. We agreed on a short deck plus the notebook running live
([CHECKIN2_PLAN.md §2](CHECKIN2_PLAN.md#2-decisions-agreed-16-oct)).

The brief's "Bring this" list for Check-in 2
([brief §8](../../../reference/01_Student_Brief.md#8-schedule-and-check-ins)) has six items. In plain words:

| # | What it is, plainly | Why it matters | Status | Where it lives |
|---|---|---|---|---|
| 1 | **Recount and compare holdings.** Rebuild every holding from its trades, then compare with the official list and with the custodian's own, separately made record. | The core test: can the platform's official holdings be trusted? | Done | `outputs/02_waterfall.csv`, `outputs/02_three_way_summary.csv` |
| 2 | **First sorting of the disagreements.** Give every disagreement one most likely cause. | Turns a pile of disagreements into a short to-do list for the people who fix them. | Done | `outputs/02_break_classes.csv` |
| 3 | **One traced mistake.** Follow one broken trade step by step, from where it entered to the fund's value. | Proves we can walk a problem back to its source: the heart of the competition. | Done | [STORY.md](STORY.md), `outputs/02_trace.csv` |
| 4 | **Checks on prices and on the fund's arithmetic.** Do the price vendors agree? Does "fund value ÷ shares = price per share" hold? | Prices and the fund's value are what investors see and pay. | Two run, the rest proposed | `outputs/02_vendor_check.csv`, `outputs/02_nav_check.csv` |
| 5 | **Defect catalog.** Every problem found: how many records, how sure we are, the fix and who owns it. | The shared to-do list. | Six full write-ups, and a one-line register of every finding | [DEFECT_CATALOG.md](../../DEFECT_CATALOG.md), [FINDINGS.md](../../FINDINGS.md) |
| 6 | **How we handled the unclear cases.** What we assumed about "undo" records (REVERSED), and what we did with company events that are missing details. | Shows we didn't guess when the data was unclear, and that we know what else it could mean. | Done | [DECISIONS.md](../../DECISIONS.md), `outputs/02_ca_readiness.csv` |

**Not on the Check-in 2 list:** the dashboard, scores and KPIs, timeliness. They belong to Check-in 3 and the final.
The dashboard (on the git branch `dashboard`) is our own tool for now; keep it off the Check-in 2 slides.

**Still to do before the check-in:** see "Next: before Check-in 2" in [STATUS.md](../../STATUS.md). A draft deck and
its speaker notes already exist ([SPEAKER_NOTES.md](SPEAKER_NOTES.md)); use this guide to make the wording plainer.

## 3. How we get our findings, and where to look for more

### How findings are produced today

The direction is one way only: **rules find the problems, people (and AI) only explain them**
([D-001](../../DECISIONS.md)).

1. **Raw data:** the ten tables in `data/`. Nobody edits them.
2. **Rules and limits:** `config/reconciliation.toml`, for example "the price vendors may differ by at most 0.5%".
3. **The notebook** `notebooks/02_reconcile.ipynb` runs every check and writes the results to `outputs/02_*.csv`.
4. **The readable list:** `scripts/build_findings.py` turns the results into [FINDINGS.md](../../FINDINGS.md).
5. **The dashboard** (branch `dashboard`) reads a packed copy of the data and the results. It shows a map of the ten
   tables and how they connect (click a table or an arrow to see its checks and problem counts), and a page that
   follows one record through every step. It never finds anything itself.

### Where to look for new findings, best payoff first

1. **The groups we have only counted.** Each has a count, but nobody has looked inside yet (the full list is in
   [STATUS.md](../../STATUS.md), "Next: after Check-in 2"). The biggest:
   - the custodian disagrees with both the official list and our recount: 1,886 holdings[^classes]
   - the official list and the custodian agree on a number the trades don't explain: 717 holdings[^classes]
   - the official list and the custodian hold the opposite sign to the trades: 216 holdings[^classes]
   - holdings with no trade behind them: 384[^register]
   - rebooked trades that keep the old money amount: 3,337 trade rows[^register]
   - fund rows where the arithmetic fails: 40[^nav]; securities where the vendors disagree: 388, or differ by about
     100 times: 10[^vendor]
2. **A second traced mistake for the final:** a price 100 times too big ([D-014](../../DECISIONS.md)). The final
   needs three traced mistakes and two cleared flags
   ([brief §5](../../../reference/01_Student_Brief.md#5-part-two--the-demonstration)); we have one of each.
3. **Timeliness** (needed for the final, not started): the `pipeline_events` table has, for every trade, when it was
   received, booked and published, and the daily deadline. Late or out-of-order trades are a new family of findings.
4. **Price freshness and coverage:** the rules are written ([RULES.md](../../RULES.md) §6) but not run yet.
5. **Company events on hold:** `outputs/02_ca_readiness.csv` lists, for each event, how many accounts held the
   security. That's the "who is affected" number.

### Tools to look with

- The dashboard: the easiest way in.
- The `outputs/*.csv` result files open in Excel. Keep them on your own machine; the data is confidential.
- [data_dictionary.csv](../../../data_dictionary.csv): what each column means.
- Anything worth keeping must become a written rule in the notebook, not a one-off spreadsheet filter. That's how
  the judges can rerun it.

## 4. Confirmed, unresolved, cleared

Every finding gets exactly one of three statuses. The rules for them are in the
[Working Guide](../../../reference/03_Student_Working_Guide.md) §5 and §6. In our words:

### Confirmed: we can prove it's wrong

- It breaks a rule that is always true (a trade quantity is never negative), or evidence from somewhere else shows
  it is wrong.
- **Analogy:** your grocery receipt says you bought **minus 3 apples**. You don't need anyone's opinion: you can't
  buy a negative number of apples. The receipt itself proves the mistake.
- **Our example:** 655 BUY trades with a negative quantity.[^register]
- **The catch:** we know the record is wrong, but not yet what it should say. Should it be +3 apples, or "returned 3
  apples"? So the catalog says "record confirmed; correct value unresolved" ([D-043](../../DECISIONS.md)).

### Unresolved: something's off, but we can't prove who's wrong yet

- The numbers disagree or look suspicious, and the data we have can't settle it. We say what extra data would.
- **Analogy:** your checkbook and your bank statement both say **$500**, but your receipts add up to **$480**. Either
  both made the same mistake, or you lost a receipt. You can't tell until you see the bank's itemised list.
- **Our example:** on 2,021 holdings, the official list and the custodian both count duplicate copies of a trade as
  two real trades.[^register] A mistake, or their house rule? That's one of our questions for faculty.
- **Why it's fine:** judges read "unresolved, and here is what we would need" as a strength
  ([Working Guide](../../../reference/03_Student_Working_Guide.md) §5).

### Cleared: it looked wrong, but we proved it's fine

- It needs four things: a rule written **before** looking; evidence from a **different** place than the one that
  raised the alarm; a count of how many it cleared; and what would change our mind.
- **Analogy:** an old credit card vanished from your banking app. Alarming, until you remember you paid it off and
  closed it. You check: the app never lists a closed card anywhere. So its absence is normal.
- **Our example:** 42 holdings whose trades add up to zero (everything bought was sold again) and that neither the
  official list nor the custodian shows.[^register] The evidence: neither source ever lists a holding of zero
  ([D-024](../../DECISIONS.md)).

**Today's count:** 17 confirmed, 21 unresolved, 1 cleared.[^findings]

## 5. Turning the numbers into slides

### Rules of thumb

The [Working Guide](../../../reference/03_Student_Working_Guide.md) §8 lists the common mistakes. Ours, for this deck:

- **Answer first, method after.** The slide title is the takeaway, as a sentence.
- **One headline number** ([D-046](../../DECISIONS.md)). Every other rate goes in the backup slides, each saying what
  it is "out of".
- **One idea per slide.** If it needs a big table, it goes in the backup.
- **Always say "out of how many".** "5,539 disagreements" means nothing on its own; "about 1 in 100 holdings we can
  check" does.[^classes][^three]
- **Round for the room, exact in the notes.** The speaker notes carry the exact number and its source file.
- **Name who would act** (the trade operations lead, the pricing lead), not just the problem.

### Words to swap

| Instead of | Say |
|---|---|
| key, position | holding (what one account owns of one security) |
| rebuild, reconstruction | our recount from the trades |
| book of record, `positions` | the official holdings list |
| custodian, `comparison_positions` | the custodian's record: a second, independent list of the same holdings |
| break | a disagreement between two records |
| REVERSED, CANCELLED | an "undo" record, a cancelled trade |
| not evaluable | can't check: information is missing |
| corporate action, quarantined | company event (a split, a spin-off), on hold until the details arrive |
| NAV | the fund's price per share |
| basis points (bps) | hundredths of a percent |

### From data point to slide

| Data point | Say it like this | Show it like this |
|---|---|---|
| **The headline:** all three sources agree, out of the holdings we can check | "On about 99 in 100 holdings we can check, our recount, the official list and the custodian's record all agree."[^three] | One big number, with the 2,836 we can't check shown beside it, never folded in[^classes] |
| Who disagrees | "When they disagree, it's usually one record against the other two."[^three] | A 10 × 10 grid of squares, the odd ones coloured by who disagrees |
| Causes of the disagreements | "About half the disagreements have a known cause; the biggest is duplicate copies counted twice."[^classes] | Sorted horizontal bars, with "no cause yet" in grey and kept visible |
| The traced mistake | "One wrong trade passed every check after the point where it entered." | The journey picture `docs/figures/08_journey_negative_buy.png`: a tick at each step that should have been a cross |
| The cleared flag | "42 'missing' holdings were simply closed."[^register] | A before / after card: "looked wrong" → "proved fine" |
| The fund's arithmetic | "2 in 100 fund rows don't add up."[^nav] | A row of 50 small icons, 1 coloured |
| Company events | "About 6 in 10 events are safe to apply; the rest wait for missing details."[^ca] | Two buckets, with the reasons on the "on hold" side |
| The unclear cases | "Where the data was unclear, we chose the safe reading and showed the other one." | Two columns: "what we did" and "what else it could mean" |

### Material ready to reuse

- [STORY.md](STORY.md): the trace in plain words, with a word list at the end.
- [OFFICES.md](OFFICES.md): what the front, middle and back office each receive, do, pass on and own, what goes
  wrong at each, and the promises between them.
- `docs/figures/`: 06 is a clean trade, 08 is the broken trade, 09 to 11 are the draft deck's charts.
- [SPEAKER_NOTES.md](SPEAKER_NOTES.md): the draft deck's notes, with the source of every number.

---

[^three]: `outputs/02_three_way_summary.csv`, row "all three agree" (471,583 keys). Divided by the keys we can test
    (478,026: the 480,862 keys in the union minus the 2,836 not evaluable), that is 98.7%; "rebuild / custodian is the
    odd one out" rows for who disagrees.
[^classes]: `outputs/02_break_classes.csv`: classes "custodian is the odd one out: unexplained" (1,886), "rebuild is
    the odd one out: unexplained" (717), "rebuild is the odd one out: opposite sign to the trades" (216), "rebuild is
    the odd one out: counts duplicate copies" (2,021, the biggest cause); the three "unexplained" classes add up to
    2,605 of the 5,539 breaks, so about half have a cause; rows with `is a break` = yes add up to
    5,539, rows with `not evaluable` to 2,836.
[^register]: `outputs/02_defect_register.csv`, lines "Position with no contributing trade" (384), "Rebook changes the
    quantity but keeps the cancelled gross_amount" (3,337), "Negative trade quantity" (655), "Book and custodian count
    duplicate copies as trades" (2,021), "Closed position not reported" (42).
[^nav]: `outputs/02_nav_check.csv`: 40 rows with result `fail` out of 2,000.
[^vendor]: `outputs/02_vendor_check.csv`: result "spread above threshold" (388) and "scale flag (ratio near 100)" (10).
[^ca]: `outputs/02_ca_readiness.csv`: verdict `supported` on 118 of 200 events, `quarantined` on 82.
[^findings]: `docs/FINDINGS.md`, header line with the count by status (generated from
    `outputs/02_defect_register.csv`).
