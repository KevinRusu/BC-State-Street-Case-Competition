# Presentation notes: slides 11 to 19

*For `State_Street_Presentation.pptx`. About 1 minute per slide. Use your own words.*

**Our main idea (say it more than once):**

- Find a data problem where it starts.
- The later you find it, the more it costs.

---

## Slide 11: Platform Data Lifecycle

- Data moves through 5 steps: accounts, securities, trades, holdings, fund price (NAV).
- 3 teams handle it: front office, middle office, back office.
- The custodian (the bank that holds the assets) and price vendors are outside companies, not teams.
- The numbers 1 to 7 are our checks.
- Each check sits where data passes from one step to the next.

## Slide 12: Control Table

- One row for each of the 7 checks.
- Each row says: what the check tests, where it sits, what happens if it fails, who is responsible.
- Most checks stop bad data before it moves on.
- One check (positions) finds problems afterwards, by comparing our numbers with the custodian's.
- We name job roles as owners, not people.
- If asked "why only 7 checks?": one check per handoff makes it clear who is responsible.

## Slide 13: 5 Stages

- Same 7 checks, but seen from each step.
- For each step: what must be true before data can move on, and who makes sure of it.
- Example: a security can only be traded once it is properly set up.

## Slide 14: Data journey 1 (one trade)

- We followed one real trade through all the tables.
- We linked the tables using matching IDs.
- The trade is clean: every check passes.
- Our records and the custodian both say 2,028 shares.
- Where our data ends: we can't prove the trade really settled, and we have no cash or fee data.

## Slide 15: Data journey 2 (one security)

- One security is used by 94 funds, so one mistake would hit all 94.
- A company event (a spin-off) created a new security.
- That new security was never set up in our list.
- It was still traded 64 times and held in 63 accounts.
- It has no price, so nobody can value it.
- In the whole dataset: 15 securities like this, 1,131 trades, no prices.
- Key sentence: "A security check would have stopped all 1,131 trades."

## Slide 16: Detection-point Model

- This is the most important slide of the brief.
- For each type of problem, we show:
  - the earliest step where we can catch it
  - what information we need to catch it
  - what goes wrong if we miss it
- Rows go in the same order as the data flows.
- Numbers to mention if asked:
  - 1,124 trades settle before the trade date (impossible)
  - 1,687 dates can't be read
  - 23 new securities from spin-offs were never set up

## Slide 17: KPI Framework by Office

- 7 numbers we track, 2 or 3 for each team.
- Each one has a formula, a target, an owner, and a decision it helps make.
- They cover 6 types of data quality (for example: correct, on time, no duplicates).
- Records we can't check are listed separately. They never make the score look better.

## Slide 18: Data Contracts between Offices

- A contract is a promise between two teams about the data they pass on.
- Each promise is written so a computer can test it.
- Simple way to explain it:
  - the contract is the promise
  - the check tests the promise
  - the KPI counts how often the promise is broken
- Some promises can't be tested yet, because the data is missing.

## Slide 19: Operating Model and Maturity path

- We use one example: the spin-off security from slide 15.
- Who owns it: the corporate actions lead, because that is where the problem started.
- Why it comes first: it already affects real holdings and the fund price.
- How to fix it: correct the wrong holdings, and also fix the process so it doesn't happen again.
- Maturity path (3 steps):
  - Today: problems are found too late (nothing stopped these trades)
  - Next: clear checks and owners (our framework)
  - Goal: stop bad data before it moves on

---

## Words to remember

- Say "exposure" (what could be affected), not "loss".
- "Observed" means we saw it in the data. "Inferred" means it is our reasoning.
