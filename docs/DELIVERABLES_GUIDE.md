# Deliverables Guide: what we have for Check-in 1, and how to use it

*State Street case · 11 Oct 2026 · for the team, no finance or coding background needed*

## Start here (about 45 minutes)

1. **`CHECKIN1_REPORT.pdf`** (9 pages): the problem, our approach and what we found, in plain words. Read this first. **20 min**
2. **`Explainer_Deck.pptx`** (25 slides): the same story built up from zero, with simple examples. Use it if anything in the report is unclear. **15 min**
3. **Section 3 of this guide:** each faculty slide with one sentence to say. **10 min**

---

## 1. The three deliverables

| What | File | For whom | What it does |
|---|---|---|---|
| **Presentation** | `docs/Checkin1_Pack.pptx` | Faculty, Monday | 11 slides + appendix A1 to A5. The story in the brief's order |
| **Report** | `docs/pdfs/CHECKIN1_REPORT.pdf` (and `docs/CHECKIN1_REPORT.md`) | Faculty and the team | Explains the problem, our approach and our findings, with the diagrams |
| **Explanation slides** | `docs/Explainer_Deck.pptx` | The team | Teaches the business, the competition and our framework from zero, plus practice questions |

Supporting files:

| File | What it is |
|---|---|
| `docs/Framework.xlsx` | All our tables in one workbook, one tab per Check-in 1 piece. Same wording as the slides |
| `notebooks/checkin1_evidence.ipynb` | Re-checks every number on the full data (about 15 seconds). Some labels still say "spine", the name of our earlier workbook |
| `docs/figures/` | The 5 diagrams, plus the scripts that draw them (`figures/src/`) |
| `docs/RULES_DRAFT.md` | The detailed rules under each of the 7 checks. Starting point for the code at Check-in 2 |
| `docs/OVERVIEW.md` | Our earlier team plan. Check-in 1 parts are out of date; the Part Two plan still applies |
| `etc/01_Student_Brief.pdf` | The official case. If anything disagrees, the brief wins |

---

## 2. The whole story in 60 seconds

- **The business:** a fund publishes a price per share every day (the NAV). Data reaches it through **three offices**: the front office creates trades, the middle office books, values and checks them, and the back office keeps the books and calculates the NAV. The custodian and price vendors are **outside sources**, not offices.
- **The problem:** at every handoff, data can be dropped, duplicated, delayed or changed. One duplicate trade can turn a $10.00 NAV into $15.00. The later it is caught, the more it costs.
- **Our approach:** 5 stages, 6 handoffs, **one check at each handoff** with one owner and one response: 7 checks, 7 KPIs, 6 testable promises between offices.
- **Our main finding:** spin-offs created 15 new securities that were never set up in the security list. They were still traded (1,131 trades) and held (1,118 positions), and none has a price, so nobody can value them. A security check would have stopped those trades.

**Sentence to practise:** *"The security check sits where the security list feeds the trades. It holds any trade that uses an unknown security. The security master lead owns it, and we track it with the KPI 'trades with a valid account and security'."*

---

## 3. The faculty slides, one by one

| # | Slide | Say this | Suggested speaker | Time |
|---|---|---|---|---|
| 1 | Catch it where it enters | "The later a problem is found, the more it costs, so we check at the earliest point." | A | 0:30 |
| 2 | How a fund's data flows | "Three offices pass data along; at each handoff it can be dropped, duplicated, delayed or changed." | A | 1:30 |
| 3 | Control map | "Five stages, three offices, six handoffs, one check on each." | A | 1:30 |
| 4 | Seven checks | "Each check has one owner and a clear response when it fails." | B | 1:30 |
| 5 | Detection-point model | "For each problem: the earliest place to catch it, the evidence needed, and the cost of missing it." | B | 2:00 |
| 6 | Journey 1 | "This trade is clean: 2,028 shares in our book, our rebuild and at the custodian." | C | 1:30 |
| 7 | Journey 2 | "Holdings exist that nobody can value; a security check would have stopped them." | C | 2:00 |
| 8 | KPIs | "Every KPI has a formula, owner, target and the decision it supports." | D | 1:30 |
| 9 | Promises | "A promise is a test, so a breach becomes a measurable event." | E | 1:00 |
| 10 | Operating model | "Detection is the start; this is what happens after a problem is found." | E | 1:30 |
| 11 | Feedback | "These four questions change how we build Part Two." | A | 0:30 |

About 15 minutes. Appendix slides (only if asked): A1 State Street context · A2 what must be true before data leaves each stage · A3 the 7 KPIs in full · A4 how the 10 tables join · A5 every number checked.

Words for slides 6 and 7: **observed** = we saw the link in the data (matching IDs); **inferred** = our reasoning; **missing data** = where the evidence stops.

---

## 4. Questions faculty may ask

1. **"Why does Transactions sit across the front and middle office?"** Trades are created in the front office but booked and checked in the middle office.
2. **"How can a security be held if it was never set up?"** Nothing stopped it. A security check where the security list feeds the trades would have held all 1,131 trades.
3. **"How do you tell a duplicate from two real identical trades?"** Same trade ID first; then same account, security, date, quantity and price. Without a source message ID we cannot prove a resend, so those stay "unresolved".
4. **"Isn't a negative running position an error?"** Not by itself. The rebuild starts from zero, and negatives can be short positions. The custodian agrees with the final 2,028.
5. **"Why count settlement in business days?"** A Friday trade settling Monday is T+1. Calendar days would flag hundreds of thousands of valid trades.
6. **"Who owns a problem?"** The stage where it entered names the owner. For the spin-off: the corporate actions lead.
7. **"Why only 7 checks?"** One per handoff keeps ownership clear. Each check has detailed rules underneath.
8. **"What is material for a NAV?"** We have no sponsor threshold; as an outside reference only, Luxembourg CSSF 24/856 uses 0.2%, 0.5% and 1% by fund type.
9. **"Why not let AI find the problems?"** Judges will rerun our code and change thresholds live, which needs fixed rules. AI can summarise on top.

The explanation slides (part 5) have six practice questions with answers in the speaker notes.

---

## 5. Our three findings (know these by heart)

1. **Unknown securities are traded and held:** 15 securities, 1,131 trades, 1,118 positions, 0 prices. All are new securities from spin-offs.
2. **Corporate-action dates are inconsistent:** 87 of 200 events have the ex-date after the effective date.
3. **Settlement dates need care:** 1,124 trades settle before they were traded and 1,687 dates cannot be read. 845 long settlements have an agreed note, which is fine.

Always say **"exposure"**, not "loss".

---

## 6. Glossary

| Term | Plain meaning |
|---|---|
| **NAV** | What one share of the fund is worth today: (assets minus liabilities) / shares |
| **Position (holding)** | How many units of a security an account holds |
| **Custodian** | The bank that holds the assets and keeps its own record |
| **Reconciliation / break** | Comparing two records of the same thing / a difference between them (needs an explanation, not automatically an error) |
| **Master data** | The reference lists of who (accounts) and what (securities) everything else looks up |
| **Corporate action** | A company event that changes what holders own: split, merger, spin-off, dividend, redemption |
| **Spin-off** | A company separates part of itself into a new company; holders get shares of the new one |
| **Ex-date** | Own the stock before this day to receive the corporate action |
| **Trade date / settlement date** | The day a deal is agreed / the day cash and shares change hands |
| **T+1, T+2** | Settlement 1 or 2 business days after the trade |
| **Cutoff** | The deadline for data to count in today's NAV |
| **Handoff** | Data moving from one stage to the next |
| **Check** | A test at a handoff, with an owner and a response when it fails |
| **Preventive / detective** | Stops bad data before it moves / finds it afterwards |
| **Promise (data contract)** | A testable condition one office can demand from the one before it |
| **KPI** | A tracked number with formula, unit, owner, target and decision |
| **Leading / lagging** | Warns before damage / confirms damage after |
| **Look-alike** | Looks wrong but is legitimate (a short position, an agreed late settlement) |
| **Exposure** | What could be affected, not a proven loss |

---

## 7. Housekeeping

- **GitHub:** rename the repo to `BC-State-Street-Case-Competition` (Settings, Repository name), then run `git remote set-url origin https://github.com/KevinRusu/BC-State-Street-Case-Competition.git`. Keep it **private**: the data is committed.
- **AI log:** the brief requires the AI conversations that shaped the work. Export this chat into an `ai_log/` folder.
- **Tools:** Claude Cowork for slides, reports and research; Claude Code in VS Code for the Part Two code.

## 8. Before Monday: checklist

- [ ] Read the report, then flip through the explanation slides
- [ ] Agree who presents which slide (section 3)
- [ ] Everyone can say the practice sentence (section 2)
- [ ] Everyone knows the three findings (section 5)
- [ ] Read the likely questions (section 4)
