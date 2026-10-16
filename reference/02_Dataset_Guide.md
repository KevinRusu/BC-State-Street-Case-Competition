> Markdown copy of `etc/02_Dataset_Guide.pdf`, converted from the .docx on 15 Oct 2026 so Claude Code can read it easily. The PDF is the official version.

Boston College · Woods College of Advancing Studies

4th Annual Fall into BC Case Competition · Industry sponsor: State Street

**Dataset Guide**

**Synthetic front-to-back investment platform data**

*Companion to the student brief*

<table>
<tbody>
<tr class="odd">
<td><p><strong>Read this first</strong></p>
<p>Use this guide to load the ten tables, understand their grains and apply the common case conventions. Your task is to test the data and design controls across the front, middle and back office. This guide specifies the exercise; it does not identify defective records or provide a solution.</p>
<p>The data is synthetic. It describes no real accounts, securities, funds or prices, and it is not a copy of any State Street system.</p></td>
</tr>
</tbody>
</table>

# 1\. Release contents

The data folder contains one compressed CSV per table. Each file includes a header. No separate sample or alternate-format copy is included; every student receives the same full release.

Intended grain is a contract to test, not a promise that raw keys are unique. manifest.csv records physical row counts, columns, file sizes and SHA-256 checksums. data\_dictionary.csv describes every column. Start with README and load\_data.ipynb.

|                       |           |                                     |
| --------------------- | --------- | ----------------------------------- |
| **Table**             | **Rows**  | **Intended grain**                  |
| transactions          | 1,409,533 | One transaction record              |
| pipeline\_events      | 1,409,533 | One transaction pipeline record     |
| positions             | 480,663   | Account, security and snapshot date |
| comparison\_positions | 480,183   | Account, security and snapshot date |
| accounts              | 100,000   | One account                         |
| securities            | 6,012     | One internal security record        |
| corporate\_actions    | 200       | One issuer event                    |
| prices                | 539,970   | Security, price date and vendor     |
| fx\_rates             | 180       | Currency and rate date              |
| ledger\_nav           | 2,000     | Fund, share class and snapshot date |

# 2\. Keys and joins

Do not join on row order. Preserve raw row numbers as ingestion lineage; they are not business keys. Duplicate IDs may cause many-to-many expansion. Report row counts and cardinality before and after each join. Missing references remain visible as exceptions rather than disappearing through inner joins.

Use security\_id as the intended internal identifier. CUSIP-style and ISIN-style strings are synthetic matching attributes, not guaranteed valid licensed identifiers. Do not assume check-digit validation establishes identity. Conflicting identifiers require a documented resolution or quarantine rule.

For position comparisons, include keys found in only one source. Do not silently turn an absent record into a confirmed zero holding. Report absence separately, then justify any zero convention used for a numerical difference.

|                                                          |                                                                    |                                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| **From**                                                 | **Join to**                                                        | **Expected relationship**                                        |
| transactions.account\_id                                 | accounts.account\_id                                               | Many to one                                                      |
| transactions.security\_id                                | securities.security\_id                                            | Many to one                                                      |
| pipeline\_events.transaction\_id                         | transactions.transaction\_id                                       | Intended one to one; validate first                              |
| transactions.related\_transaction\_id                    | transactions.transaction\_id                                       | Many to one where populated; validate the link and what it means |
| transactions by account\_id and security\_id             | positions by account\_id and security\_id                          | Many to one; aggregate trades before comparing                   |
| positions and comparison\_positions                      | account\_id, security\_id, as\_of\_date                            | Full outer comparison after grain checks                         |
| positions.account\_id                                    | accounts.account\_id                                               | Many to one; obtains fund and class                              |
| positions.security\_id                                   | prices.security\_id                                                | Select date and vendor before joining                            |
| prices.currency and price\_date                          | fx\_rates.currency and rate\_date                                  | Many to one after uniqueness checks                              |
| corporate\_actions.security\_id and target\_security\_id | securities.security\_id                                            | Validate source and applicable target                            |
| fund valuation aggregates                                | ledger\_nav summed over share classes by fund\_id and as\_of\_date | One to one at fund level                                         |

# 3\. Dates and transaction conventions

The valuation snapshot is 10 July 2026. The observation grid is thirty Monday-to-Friday dates beginning 1 June. This teaching calendar does not model market holidays. Parse ISO dates as YYYY-MM-DD and slash-separated dates as DD/MM/YYYY. Preserve raw strings and flag parsing failures; do not rely on ambiguous locale inference.

Treat timezone-naive timestamps as one common platform clock. They support elapsed-time comparisons within the extract, not claims about real-world timezone handling. A missing timestamp or negative duration is an exception, not zero latency. The cutoff\_timestamp is the relevant cutoff observation; distinguish booking from publication.

## The shared reconstruction benchmark

Use a zero opening balance before the observation window as the shared reconstruction benchmark. This is an explicit exercise convention, not evidence that real portfolios began empty. Quantity is intended as a nonnegative magnitude: BUY adds units and SELL subtracts them. Negative raw trade quantities must be investigated; do not silently take absolute values as a repair. Negative net holdings can represent shorts.

Use BOOKED-only as one transparent reconstruction benchmark, then investigate related\_transaction\_id and status transitions. A BOOKED replacement linked to a CANCELLED original can represent a valid rebook. REVERSED may describe an inactive transaction state or an offsetting event; the extract does not supply an explicit event-operation field. Compare plausible interpretations, prevent double offsets, and identify what additional contract would resolve the ambiguity. Neither a populated link nor a status label proves the entire record correct.

Trade-date holdings include eligible trades through the snapshot. A settlement-date variant includes trades with scheduled settlement\_date through the snapshot. That date is not an actual settlement confirmation. Report differences between the variants; explain any extended settlement note before calling a lag an error. Settlement timing thresholds are team assumptions under the synthetic calendar, not legal claims.

Show a raw benchmark and the effect of each justified transformation, including exact and conflicting duplicates. Do not back-solve opening balances from closing positions and present that circular calculation as an independent reconciliation.

# 4\. Corporate actions and price data

corporate\_actions records issuer events, not which accounts received them. Analyze source and target identity, chronology, event terms and candidate holders. Keep trade-only reconstruction separate from event-adjusted scenarios so a quantity movement is not counted twice.

For supported split scenarios, define ratio as post-event units per pre-event unit. For supported merger scenarios it is target units per source unit; for spin-offs it is additional target units per source unit while the parent remains. cash\_rate is a cash amount per eligible source unit in the source security currency. These are teaching conventions. A redemption needs sufficient terms to determine extinguished units and cash treatment. Missing targets, ambiguous eligibility or incomplete terms must be quarantined, not invented. Showing the failed contract and the evidence you would need earns credit; a verified application rate cannot be inferred from an event list alone.

## Prices and FX

Quote basis and quantity denomination are not explicit in the schema. Check relative price scale across vendors and dates for the same security before attributing a difference to a unit error. Bond quotes may use percent-of-par conventions, but valuation also requires knowing whether quantity denotes face amount or instrument units. A full valuation is optional. If undertaken, state and test your quote and quantity assumptions; do not silently impose a universal multiplier.

Lower vendor\_priority denotes the nominal preference, not verified accuracy. Assess missingness, freshness and disagreement. A complete fallback waterfall is optional. Preserve currency conflicts and unresolved quote units as visible exceptions. Do not choose a vendor solely because it matches the ledger.

rate\_to\_usd means USD per one unit of the stated currency. Multiply local investment value by the accepted rate for the valuation date. Validate the rates as inputs. Report coverage and the impact of any rate repair rather than silently changing the raw file.

## Ledger comparison

Required back-office work includes checking net\_assets divided by shares\_outstanding against nav\_per\_share and documenting missing or invalid inputs. Full fund valuation is optional. If performed, use USD as the reporting convention, state the ledger-currency assumption, aggregate net\_assets across classes and never sum nav\_per\_share. Distinguish signed investment value from gross absolute exposure and disclose unpriced holdings.

Cash, receivables, payables, fees, accrued interest and a full accounting ledger are not supplied. The residual is therefore an investigation measure, not proof of a NAV misstatement. Share-class allocation is optional.

# 5\. Evidence and reproducibility

Keep three evidence statuses: confirmed defect, unresolved hypothesis and cleared flag. State the rule, record IDs, affected population, supporting joins and uncertainty. Never treat a high reconciliation match rate as proof that the remaining differences all have one cause.

Required traces cover at least three defect classes and two flags cleared with evidence. If an event cannot be evaluated, identify the exact missing fields or contract. Do not turn an unsupported hypothesis into a measured loss or a demonstrated historical defect escape.

Static timestamps support historical latency and cutoff measures. The extract does not contain issue creation, remediation, first-attempt processing, detection or NAV version histories. Such operational indicators must be proposed or tested on labeled simulations. Always state the eligible denominator and separately report missing and unevaluable observations.

## Using the full release

Python users can read .csv.gz files directly with pandas; the loading notebook reads all fields as strings so identifiers and ambiguous dates are preserved. Convert fields explicitly in your own pipeline. The transaction tables are larger than a single Excel worksheet; use code, a database or a query engine, and process in chunks if memory is limited.

You may sample accounts or another justified unit during development. Keep associated records and reference data, retain a fixed seed, and explain sampling bias. Complete the final required aggregates on the full dataset. Include hardware, elapsed runtime and environment versions with the submission.

## Tests that support your claims

Keep raw data read-only. Test join cardinality, row accounting and denominator coverage. Run your code after shuffling input rows. In a separate test copy, inject a defect and a legitimate look-alike; record expected and observed outcomes. Do not hard-code record IDs or let labels leak into detection logic. Include a clean command that regenerates all reported outputs.

AI assistance is permitted subject to the student brief. Include material prompts, corrections and validation decisions. The quality of your evidence and your ability to explain and adapt the analysis matter; the number of prompts does not.

# 6\. Short glossary

  - **Master data** describes accounts and securities shared across processes.

  - **A corporate action** is an issuer event affecting holdings or cash entitlements.

  - **A break** is a difference between records expected to agree.

  - **Net assets** are assets less liabilities; NAV per share divides net assets by shares outstanding.

  - **One basis point** is 0.01 percent.

  - **Trade date and scheduled settlement date** describe different stages and do not establish actual settlement completion.
