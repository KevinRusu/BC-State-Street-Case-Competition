# Cheat sheet: the three offices

*Short version of [OFFICES.md](OFFICES.md). Numbers from register checksum `d7e752f55f0a`; sources at the bottom.*

**Flow:** front → middle → back. Fed from the side by the **account list**, the **security list**, and three
**independent sources** (custodian, price vendors, FX provider).

**Custodian ≠ "outside State Street".** It's the second, separately made record of the same holdings. It may be
another company or another part of the same one; it only works as a check if it's made independently.

## Front office: decide and trade

- **Who:** portfolio managers, traders
- **Receives:** account list, security list
- **Does:** sets up accounts, decides, creates the trade
- **Passes on:** trade records (account, security, BUY/SELL, quantity, price, amount, dates)
- **Owner:** Account onboarding lead
- **Goes wrong:**[^reg]
  - 655 BUYs with a negative quantity (our traced trade)
  - 2,819 blank quantities
  - 9,398 dates in the wrong format
  - 1,124 settle before they trade
  - 699 holdings on accounts never set up

## Middle office: book, value, check

- **Who:** trade operations, pricing, reconciliation
- **Receives:** trades, company event notices, custodian holdings, prices, FX rates
- **Does:** books trades before the deadline, keeps the security list, applies company events, keeps the official
  holdings list, compares it with the custodian, prices everything
- **Passes on:** holdings that are right, agreed and priced, plus open problems
- **Owners:** Security master · Trade operations · Corporate actions · Reconciliation · Pricing leads
- **Goes wrong:**[^reg]
  - 2,060 trades arrived twice[^dup]
  - 23 spin-offs whose new security was never set up → 1,118 holdings with no price[^cc]
  - 480 holdings the custodian doesn't have
  - 388 securities where vendors disagree by more than 0.5%
  - 1,080 prices in a currency with no FX rate

## Back office: books and NAV

- **Who:** fund accountants
- **Receives:** priced holdings by fund and share class
- **Does:** keeps the books, calculates NAV (price per fund share)
- **Passes on:** the NAV investors trade at; reports
- **Owner:** Fund accounting lead
- **Goes wrong:** 40 of 2,000 fund rows don't add up (net assets ÷ shares ≠ NAV)[^reg]

## What the next office needs (promises)

- **Middle from front:** account exists and is open · security is known · trade unique, complete, readable, settles in
  ≤ 2 business days, booked before deadline
- **Middle from independent sources:** one custodian record per holding per day · today's price for every holding · one FX rate
  per currency, US dollar = 1
- **Back from middle:** holdings = trades = custodian, priced today, no serious open problem
- **Investors from back:** one NAV per fund and class per day that adds up

## Quality checklist (8 dimensions)

- **Completeness:** blanks → blank quantities
- **Validity:** possible? → negative BUY
- **Conformity:** same format? → two date formats
- **Referential integrity:** does it exist? → unknown accounts, missing spin-off securities
- **Uniqueness:** only once? → duplicate copies
- **Timeliness:** on time? → deadline, today's price
- **Consistency:** do they agree? → official list vs custodian, NAV arithmetic
- **Accuracy:** matches a reference? → vendor prices

## Controls + insights

- **7 checks**, one per handoff, each with an owner and a response (reject / hold / flag)
- 6 stop bad data before it moves; 1 (position check) finds it afterwards
- **Catch it where it enters:** the negative BUY passed every later check
- **Agreement ≠ proof:** custodian copies the book's habits on 2,704 holdings[^cust]
- **Address-book mistakes spread widest:** one missing security = every holder unpriced
- **Name what's missing:** event log per account, settlement confirmation, cash and fees, "type of change" per trade

## If a judge asks…

- *"Who owns it?"* → two owners: the **problem** belongs to where it entered; the **check** belongs to the door where
  it should be stopped. They can differ (brief §4, operating model)
- *"Why is the check in middle if the error is in front?"* → middle is where trades are accepted
- *"Are owners real people?"* → no, roles; our design choice (brief §4)

[^reg]: `outputs/02_defect_register.csv` (the matching line for each count).
[^dup]: `outputs/02_duplicate_profile.csv`, first row (distinct transaction_ids).
[^cc]: `outputs/01_cross_check.csv`, rows "missing spin-off targets: …".
[^cust]: `outputs/02_trace.csv`, hop `custodian`.
