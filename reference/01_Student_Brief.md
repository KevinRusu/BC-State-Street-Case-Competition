> Markdown copy of `etc/01_Student_Brief.pdf`, converted from the .docx on 15 Oct 2026 so Claude Code can read it easily. The PDF is the official version.

Boston College · Woods College of Advancing Studies

MS in Applied Analytics · MS in Applied Economics

**4th Annual Fall into BC Case Competition**

**Data Quality in a Front-to-Back Investment Platform**

*Catching defects early as data moves front to back*

Industry sponsor: State Street

Kickoff Wednesday, September 23, 2026 · Final presentations Friday, November 20, 2026

Full dataset release · Fall 2026

<table>
<tbody>
<tr class="odd">
<td><p><strong>The problem</strong></p>
<p>State Street holds $54.5 trillion in assets under custody and administration (31 March 2026), and by the firm's own account around 11.5% of the world's financial assets move through its systems every day. Millions of transactions cross those systems daily, from the trading desk to the fund's books. Somewhere in that flow, data breaks. A trade booked twice, a price that never updated, a corporate action applied to some accounts and not others — and by the time anyone notices, it has become a number an investor sees.</p>
<p>Your job: design a data quality architecture for a front-to-back investment platform and demonstrate it on the supplied synthetic data. Follow errors across office boundaries, show where they could be detected earlier, and connect your findings to decisions a platform leader can take.</p></td>
</tr>
</tbody>
</table>

# 1\. Why this matters

Data quality sounds like housekeeping until you look at what depends on it. A single trade record builds a position; the position gets valued; the valuation sets the net asset value\[1\] an investor is paid on. At platform volumes — millions of records a day — one bad record is never one bad number. It is every position, valuation and report downstream of it, and the further it travels before anyone notices, the more it costs to unwind.

An investment servicing platform moves data front to back. The front office decides and trades. The middle office prices positions and reconciles them. The back office keeps the ledger and strikes net asset value. A platform of this kind, spanning all three offices, is the setting this competition has in mind. Every boundary between those offices is a handoff, and data does not always survive a handoff intact.

Keeping data reliable as it moves between the front, middle and back office is the challenge. A duplicated transaction, an unresolved corporate action\[2\] or a stale price can affect many accounts before it reaches reconciliation. Your work should identify where controls belong and produce insights that can inform future platform data work. The dataset is a simplified synthetic teaching model, not a representation of State Street production systems.

That is the whole problem in one line: **the cost of a defect rises with the distance between where it enters and where it is found.** Most firms measure quality after the fact, control by control and office by office. Very few can follow one defect across the whole infrastructure and say where it entered, what it touched, and how early it could have been caught. That is what you will do.

**Why this is hard.** Nobody hands you a list of what is wrong. The data looks reasonable until you ask it the right question, and some of what looks wrong turns out to be perfectly legitimate. Telling those apart, and proving which is which, is the skill being tested.

# 2\. The question

**How early can a platform catch a data defect, and can you follow that defect across the infrastructure to prove it?**

Measurement is how you answer it, not the point of it. Your team produces three connected outputs.

  - **A data quality architecture.** Where quality is defined, measured, and enforced at each stage of the lifecycle and at each handoff between offices. This is conceptual work and it does not need data.

  - **A measurement framework by office.** KPIs that the front, middle, and back office each recognize as their own, rolling up to one executive view.

  - **Evidence on real-shaped data.** Defects found in a synthetic platform dataset, each one traced from where it entered to where it surfaced, with the earliest point it could have been caught and a case for why it matters.

**In concrete terms you build four things:** a control map, a traced data journey, a KPI framework by office, and a reproducible analysis of the supplied dataset. Sections 4 and 5 specify the work; Section 7 lists the deliverables. Working analytical code and one executive dashboard drill-down are required. A production platform or enterprise governance implementation is not.

## Your stakeholders, and what they get

Four stakeholders, and the rubric grades whether each of them can act on what you produce.

  - **Front office — the portfolio manager.** Needs positions that are right, accounts that are complete, and data that lands before decisions are made.

  - **Middle office — the pricing and reconciliation analysts.** Pricing needs to know which price is current and correct when vendors disagree. Reconciliation needs break counts, root causes, and settlement status.

  - **Back office — fund accounting.** Maintains the ledger, the crystallized view of what the middle office produced, and strikes NAV across share classes.

  - **The executive — the Chief Data Officer.** Needs the roll-up: where the platform is degrading, what it is costing, and what to fix first.

**What the sponsor takes away.** A measurement framework that could be lifted into a platform environment, and a defensible answer to where controls belong. Work that only demonstrates technique — a clever model with no owner, no threshold, and no case for why anyone should care — does not clear the bar.

# 3\. The platform data lifecycle

The architecture below is representative of a front-to-back investment platform. It is the shape of the dataset you will work with, and it is where your control map belongs. Note that accounts and securities are master data\[3\] that feed the flow rather than steps within it — a master-data defect contaminates everything downstream of it at once, which is part of why master data earns disproportionate attention.

**account master + security master → transactions and corporate actions → positions → pricing and reconciliation → ledger, NAV and share classes**

|                |                                                                                                                              |                 |                                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------- |
| **Stage**      | **What it holds**                                                                                                            | **Office**      | **What goes wrong here**                                                                                 |
| Accounts       | Who owns the assets: legal entity, domicile, base currency, account type, share class, custodian, open and close dates.      | Front and back  | Incomplete onboarding, closed accounts still transacting, missing base currency.                         |
| Securities     | The master record: CUSIP, ISIN, ticker, asset class, issuer, currency, exchange, maturity and coupon for bonds.              | Middle          | Invalid or colliding identifiers, duplicate masters, securities referenced in trades but never mastered. |
| Transactions   | Buy and sell records with status, correction links, trade dates and settlement dates. Corporate actions are held separately. | Front to middle | Duplicates, cancels with no matching original, nulls, settlement dates that violate convention.          |
| Positions      | Reported holdings by account, security and snapshot date, compared with a transaction-based benchmark and a second source.   | Middle          | Reported positions that do not equal the transaction history; corporate actions applied unevenly.        |
| NAV and ledger | Reported net assets, shares outstanding and NAV per share by fund and share class; no cash or accrual detail is supplied.    | Back            | Pricing errors flowing straight into NAV; share classes that will not reconcile to the fund.             |

The chain closes. Positions roll back up to the account, which is where the portfolio manager looks. A defect anywhere in the loop reaches them eventually — the only question is how expensive it is by the time it does.

# 4\. Part One — the architecture

Conceptual work, due at Check-in 1. Start it at kickoff: it needs no data, and a team that designs the framework first designs a better one. You may have the dataset in hand before the check-in — use it to make the architecture concrete, not to shrink it to what you happen to see. Everything in Sections 4 and 5 is required unless it is marked optional.

  - **Lifecycle and control map.** In practice this is one diagram and one table. The diagram shows the five stages in Section 3 — accounts, securities, transactions, positions, and NAV and ledger — against the three offices, with every handoff marked. The table has one row per control: what it checks, which stage it sits at, what happens when it fails, and which role owns it. For each stage, state what must be true for data to leave it clean, what control would establish that, and who owns it. Owners are roles, not named people, and they are your design decision: the data shows which system and which office touched a record, never who is accountable for it.

  - **End-to-end data journey.** Trace one concrete trade and one account or security master record through the supplied tables. Identify each join, transformation and handoff, and retain record identifiers as evidence. Separate directly observed links from inferred relationships. Where evidence stops, name the missing data contract and the control you would add; do not invent an event history. Bring an illustrative journey to Check-in 1 and substantiate it with actual records in the final submission.

  - **Detection-point model.** For each family of defect you anticipate — missing or invalid identifiers, duplicated transactions, records arriving late, stale or disputed prices, corporate actions applied unevenly, positions that do not match their history — name the earliest stage at which it could be detected, the evidence that detection would need, and the consequence of missing it until the next stage. This is the core of Part One.

  - **KPI framework by office.** Define the dimensions you will measure and turn them into KPIs the front, middle, and back office each recognize. For every metric: the formula, the unit, the owner, the target, and the decision it supports. Appendix A shows the level of specificity expected. Cover at least six quality dimensions and say why you excluded any obvious ones.

  - **Data contracts between offices.** What each office is entitled to expect from the one upstream, expressed as testable conditions rather than intentions, so a breach becomes a measurable event.

  - **Operating model and maturity path.** Who produces the scores, who consumes them, how often they refresh, and how a disputed score is resolved. Then what happens once a defect is found: who owns it, how it is ranked against everything else open, how it gets fixed and how it gets prevented from recurring. The five questions to answer are set out below. Keep it to a page — this round is weighted toward the architecture, and a clear loop beats a governance manual. Close with a sketch of how the capability matures from where a firm starts to where this framework could take it.

## The operating model — what happens after a defect is found

Detection is the beginning of the work, not the end of it. A platform that finds a defect and has no answer to what happens next has bought itself a list. Five questions, one short paragraph each. Keep this to a page: it is deliberately lightweight for this round, and the architecture is still where the weight sits.

|                |                                                                                                                                                                                        |                                                                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Question**   | **What to answer**                                                                                                                                                                     | **Where your own work supplies it**                                                                                                   |
| Ownership      | Who owns the defect, and is that the same person who owns the control that should have caught it? Name roles, not people.                                                              | The trace: the stage where the defect entered names the owner — the practical reason for tracing the journey earlier in this section. |
| Prioritization | Two hundred open defects, one team. What gets worked first, and what is the rule — exposure, blast radius, how many accounts are touched, how cheap the fix is?                        | The case you made for why each defect matters. A ranking with no measure behind it is a queue in the order things were noticed.       |
| Remediation    | Fixing the records already wrong, and fixing the thing that produced them. Say which of the two you are doing, because a corrected position with an uncorrected feed is back tomorrow. | Your defect catalog: for each class, the records affected and the stage that produced them.                                           |
| Prevention     | Moving the control upstream, to the earliest stage your detection-point model says the defect could have been caught — and what that control costs to run.                             | The detection-point model, tested against what you actually found.                                                                    |
| Accountability | How anyone knows this happened: what is tracked to closure, what gets reported to whom, and what the executive sees when something stays open too long.                                | The scorecard and the executive view. An open-exposure number that only goes up is the sign this loop is not running.                 |

A good answer here is a page and a worked example: take one defect you found, and walk it through all five. A team that can do that has shown the thing this competition is about — that a data quality framework is an operating discipline, not a report.

**Definition of done.** A reader can identify the controls, owners, targets and failure responses at each stage, follow a record through the available evidence, and see which additional data contracts would be required in a production setting.

# 5\. Part Two — the demonstration

Everything below runs on the synthetic platform dataset described in Section 6. The dataset is deliberately imperfect. Nobody will tell you what is wrong with it.

**Depth beats breadth.** You are not expected to find everything in the data, and no prize goes to the longest list. A team that takes three defect classes, traces each one across the platform, and makes the case for why it matters will score better than a team that catalogs thirty and stops there.

  - **Profile and detect.** Work the dataset systematically and catalog what you find. For each defect class: how you detected it, how many records are affected, how confident you are, and how you distinguished it from a legitimate case that looks similar. Then choose the ones you take forward, and say why those.

  - **Position reconciliation.** Produce a signed transaction reconstruction and a settlement-date sensitivity under documented assumptions.\[4\] Investigate duplicate handling, statuses and related-transaction links; compare plausible reversal interpretations where the event semantics are unclear. Compare the reconstruction with reported positions and reconcile reported positions with comparison\_positions on the full union of keys. Report differing, one-sided and unevaluable positions separately. Assess corporate-action readiness and affected holdings; apply only supported adjustments in a separate scenario. Quarantine unsupported event terms or target mappings. A residual is not automatically a confirmed error — it is a break\[5\] to be explained.

  - **Price data quality.** Assess price coverage, freshness, vendor disagreement and unit or scale consistency as part of your wider data-quality analysis. Explain how unreliable price inputs could propagate downstream and who should investigate. A full pricing waterfall and valuation model are optional extensions, not separate graded requirements.

  - **Back-office integrity.** Test the internal consistency of net\_assets, shares\_outstanding and nav\_per\_share and explain the upstream controls fund accounting needs. A complete fund valuation or investment-value-to-NAV bridge is optional. Cash, accruals and complete quote-unit conventions are not supplied, so a valuation residual must not be labeled a proven NAV error.

  - **Timeliness.** Use event, received, booked, published and cutoff timestamps to measure feed latency, processing latency and cutoff adherence by feed and day. Report missing, unparseable and out-of-order timestamps separately. Publish each metric denominator; do not treat unavailable timestamps as timely records. These are historical measurements from a static extract, not live monitoring results.

  - **The case for why it matters.** For each defect class, quantify affected accounts, records, feeds or downstream outputs and explain who would act. Use a defensible exposure measure where available — accounts affected, notional at risk, or a NAV difference in basis points\[6\]; dollar valuation is optional. Distinguish exposure from realized loss and label assumptions. Missing or ambiguous inputs must remain visible. Avoid double-counting records affected by several defects.

  - **Detection-point analysis.** State where the evidence suggests each defect entered, where your analysis first detected it, and the earliest stage at which a proposed control could detect it. The files do not contain a historical issue-management log. Observed detection times, remediation costs and losses must not be invented; label counterfactual estimates and control simulations.

  - **Trace back to origin.** Take at least three defect classes and follow individual affected records back along the journey from where you found them to where they entered, showing the evidence at each step. Then run the same trace on at least two items your checks flagged that turn out to be legitimate, and show what cleared them. A flag you cannot trace is a finding you cannot defend in the room.

  - **Scorecard and indicators.** Produce scores at account, domain and platform level, with formulas, weights, aggregation rules and a sensitivity check. Define at least six indicators, including at least three leading indicators. Mark each as computed, simulated or proposed. At least three, including one leading indicator, must be computed from this release. Proposed indicators must identify the additional inputs needed. Report evaluable coverage beside scores so missing evidence cannot silently improve a result.

  - **Dashboard.** Provide wireframes — layout sketches showing what goes where, not working software — for the three office personas, and one functional executive view with a working drill-down to record-level evidence. A local packaged dashboard is sufficient; public hosting is not required. Do not publish the competition data through a public dashboard. Include run instructions and ensure displayed figures agree with your code outputs.

  - **Recommendations and roadmap.** What to build first, who owns it, what it costs, and what must be true before it scales. Tie each recommendation to a defect class and its exposure.

  - **Limitations.** False positives, false negatives, gaming risk, missing evidence, and uncertainty in your exposure estimates. Judges reward honesty here.

  - **Stress test and robustness.** On a copy of the data, inject at least one new defect and one valid look-alike case. Record the changed fields and expected outcomes, compare performance before and after, and report false positives and misses. Also show that shuffling input rows does not change aggregate results. Keep test labels separate from detection logic. Judges may rerun your code on schema-compatible test fixtures and ask any team member to change a threshold or vendor priority during Q\&A. No original data tables are withheld.

  - **Predictive risk indicator (optional).** A method for estimating which accounts or feeds are likely to fail next period, with one simple demonstrated baseline.

  - **AI-assisted monitoring (optional).** Anomaly detection on metric time series, automated threshold setting, or plain-language summaries of dashboard changes.

**Definition of done.** Another team can regenerate your reconciliation, data-quality checks, coverage measures, scores and exposure estimates on the full release. Every major conclusion has a record-level trace and an evidence status: confirmed, plausible but unresolved, or cleared. Full valuation is optional.

# 6\. The dataset

The full synthetic release contains 100,000 accounts, equity and bond records, and thirty weekday observation dates from 1 June to 10 July 2026. Ten tables are supplied once, in compressed CSV format. All students receive the same full release; no sample dataset is supplied. The account, currency and exchange attributes are synthetic and must not be assumed to describe exclusively US instruments.

|                       |           |                                                                                                                                                                                        |
| --------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Table**             | **Rows**  | **What it holds**                                                                                                                                                                      |
| accounts              | 100,000   | Account master: fund, share class, type, base currency, domicile, strategy, custodian, open and close dates, status.                                                                   |
| securities            | 6,012     | Synthetic equity and bond master with identifiers, asset class, currency, exchange, issuer country, coupon, maturity and par.                                                          |
| transactions          | 1,409,533 | Buys, sells, cancellations and reversals, with trade and settlement dates, price, quantity, status, source system, the link from a correction to its original, and an event timestamp. |
| corporate\_actions    | 200       | Separate issuer-event records with dates, ratios, cash terms and target references. These are not an account-level application log.                                                    |
| prices                | 539,970   | Daily prices from three vendors with a stated priority order, plus a price timestamp.                                                                                                  |
| positions             | 480,663   | Book-of-record positions at the final business day — the platform's own official record of what each account holds — with the count of transactions behind each.                       |
| comparison\_positions | 480,183   | An independent second position source from the custodian — the other side of your reconciliation.                                                                                      |
| pipeline\_events      | 1,409,533 | Per-transaction timestamps: event, received, booked, published, and the cutoff that applied, plus source system and batch id. This is what makes the data journey traceable.           |
| ledger\_nav           | 2,000     | Reported net assets, shares outstanding and NAV per share by fund and share class; see the Dataset Guide for valuation limitations.                                                    |
| fx\_rates             | 180       | Daily rates to USD for each currency in the data.                                                                                                                                      |

**Ten tables, not one file.** This is how a platform actually holds its data: separate tables in a database, joined on keys, each with its own grain. The tables must be joined deliberately. Read the companion Dataset Guide and data\_dictionary.csv before joining them. Intended keys are validation expectations, not guarantees of uniqueness or completeness. The package includes a manifest with row counts and checksums, plus a loading notebook that does not clean or solve the data.

Identifiers work as they do in practice: an internal security\_id is the primary key, and a CUSIP-style field is one matching attribute among several. It is synthetic, it is not always present, and it is not always right — you will not be handed one perfect identifier that solves every join.

  - **The complete dataset is released together.** You may create your own development sample, but report the sampling unit, seed, selection rule and limitations. Preserve linked transactions, pipeline records, securities, prices and relevant corporate actions. A row sample from each table independently will generally break the relationships. Required final aggregate results and runtime evidence must use the full release.

  - **The data is synthetic and intentionally imperfect.** Treat all supplied tables as observations to test, not as unquestionable ground truth. Keep raw inputs unchanged and record each transformation. An inconsistency may be a defect, a valid exception or insufficient evidence; your analysis must distinguish them.

  - **Some flags can be legitimate,** such as negative holdings, unchanged prices or an explicitly agreed settlement extension. None of those features alone proves correctness. Use supporting records and a stated rule to clear a flag. An unresolved flag is not a cleared false positive.

  - **Assessment rewards reproducible evidence,** defensible judgment and useful controls, not a target number of planted defects. Findings beyond any organizer reference checks receive equal consideration. You are not expected to reverse-engineer a generator or infer a hidden answer key.

## Optional public reference data

The synthetic set is the required spine. These public sources are optional and useful for validating rules against real reference data rather than invented values: SEC EDGAR Financial Statement Data Sets; GLEIF LEI open data, in golden copy or concatenated form; the ISO 4217 currency, ISO 3166 country, and ISO 10383 exchange code lists; and OpenFIGI for identifier mapping. Document anything you pull and when you pulled it.

# 7\. What you submit

Five items, all required. Limits are ceilings, not targets.

**The deck is the one that matters most.** It is what the judges sit through, and distilling nine weeks of work into fifteen minutes is itself part of the test. Everything else supports it: the report carries the detail, the code package carries the proof, and the deck points at both. Put whatever will not fit into a long appendix and refer to it.

|                                   |                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Component**                     | **Requirement**                                                                                                                                                                                                                                                                                                                                                                           |
| Written report                    | Maximum 8 pages excluding appendices, opening with a one-page executive summary that doubles as your executive one-pager. Covers Part One and Part Two, with formulas, the defect catalog, the indicator catalog, and enough method detail to reproduce your numbers. Supporting tables go in appendices, which are not counted and not required.                                         |
| Dashboard                         | Wireframes for the three office personas, plus one functional executive view with a working drill-down. Submit a local package with run instructions or a restricted-access hosted link; do not publish the dataset.                                                                                                                                                                      |
| Code and data package             | Executable code that loads the full release, reconstructs and reconciles positions, checks price inputs and ledger arithmetic, and regenerates scores and impact measures. Include environment versions, seeds, run commands, runtime and input/output checks. Keep stress-test fixtures separate. Do not hard-code defective record IDs. A full pricing or valuation engine is optional. |
| Slide deck — the primary artefact | 12 to 15 slides for a Chief Data Officer and their leadership team. Distillation is the skill being graded: say the thing, show the evidence, move on. Reference the report for detail rather than crowding the slide, and use a backup appendix freely — it is not counted. Due at the same time as the report.                                                                          |
| Team declaration and AI log       | Names, programs, and a short statement of each member's contribution. Disclose any generative AI tools you used and how you used them, and submit the conversation logs — exported chat history, or the prompts and responses that shaped your work — as a file alongside the code.                                                                                                       |

Final presentation: 15 minutes plus 10 minutes of questions. Every team member should speak and be able to explain the submitted analysis. Expect a record-level trace and a small assumption change during questions.

# 8\. Schedule and check-ins

Nine weeks from kickoff to final presentations, with three faculty check-ins.

|                                                     |                                                              |
| --------------------------------------------------- | ------------------------------------------------------------ |
| **Milestone**                                       | **When**                                                     |
| Kickoff and sponsor Q\&A                            | Wednesday, September 23                                      |
| Team registration closes                            | Week of Monday, September 28                                 |
| Check-in 1 with BC team (Dr. Fulton and Dr. Sharma) | Week of Monday, October 5                                    |
| Dataset released, in full                           | Week of Monday, October 5, or earlier                        |
| Check-in 2 with BC team (Dr. Fulton and Dr. Sharma) | Week of Monday, October 19                                   |
| Sponsor office hours (optional)                     | TBD                                                          |
| Check-in 3 with BC team (Dr. Fulton and Dr. Sharma) | Week of Monday, November 9                                   |
| Report, dashboard, code package, and slides due     | Week of Monday, November 16, before the presentation session |
| Final presentations and judging                     | Friday, November 20                                          |

*Exact days and times will be confirmed by the organizing team after scheduling approvals. Treat the weeks as fixed and the days as provisional.*

Check-ins are formative and are not graded. They are where the competition is won: a team that skips them forfeits exactly the feedback the rubric rewards. Come with work in hand.

|                                 |                                                                                                                                                |                                                                                                                                                                                                                                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Check-in**                    | **Purpose**                                                                                                                                    | **Bring this**                                                                                                                                                                                                                                                                            |
| 1 — architecture                | Review the architecture and detection-point model. An illustrative trace is acceptable at this stage; ground it in actual data when available. | Your lifecycle and control map; your end-to-end journey trace for a trade and one master-data record; the detection-point model; a draft KPI table by office giving metric, unit, owner, and target; your draft data contracts; and one sentence per KPI naming the decision it supports. |
| 2 — method gate                 | Sign-off on how you are working the data. You should leave cleared to build the full analysis.                                                 | Position reconstruction and reconciliation; first break classification; one evidenced trace; proposed checks for price data and ledger arithmetic; defect catalog; treatment of ambiguous reversals and unsupported corporate actions.                                                    |
| 3 — coherence and communication | Confirm Part One and Part Two agree, the recommendations are defensible, and the slides are clean, with a full week of runway.                 | Full-data reconciliation, quality checks, scores, impact and coverage; sensitivity and stress tests; roadmap; working executive view; complete slide draft. Advanced valuation is optional.                                                                                               |

# 9\. How judges will evaluate your work

The rubric totals 100%. Architecture and detection each carry 25%. Judges include State Street data leaders and Boston College faculty. Expect questions about formulas, assumptions, record-level evidence and the decisions your framework supports. Pricing and valuation have no separate weight; advanced valuation earns credit only where it strengthens the criteria below.

|                                           |            |                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Criterion**                             | **Weight** | **Evidence, and what strong work looks like**                                                                                                                                                                                                                                                                                                                                                                        |
| Architecture, journey and detection model | 25%        | Part One. The control map covers the lifecycle and the office boundaries. The data journey is traced end to end through the ecosystem, not described stage by stage. The detection-point model is specific about evidence and consequence. Data contracts are testable, not aspirational. The operating model is answered, briefly, so a defect has an owner and a route to closure.                                 |
| Detection and reconciliation              | 25%        | Defect catalog, signed transaction reconstruction and position reconciliation. Quantity, status, linkage and duplicates handled under evidenced assumptions. Supported corporate actions separated from quarantined events. Three defect traces and two justified clearances; missing evidence and false positives handled honestly. Price-input and ledger-arithmetic checks form part of the wider detection work. |
| Business insight and recommendations      | 20%        | Recommendations connect evidenced defects to affected accounts, downstream outputs and operational decisions. Priorities, owners, costs and dependencies are clear. Dollar exposure or advanced valuation is optional; unsupported monetary claims earn no credit.                                                                                                                                                   |
| KPI framework by office                   | 10%        | Front, middle and back office each get metrics they would recognize as their own, with formula, unit, owner, target, and the decision supported. The executive roll-up is coherent with the parts.                                                                                                                                                                                                                   |
| Dashboard and communication               | 10%        | The prototype works. Each office persona sees what they need quickly. The report is clear, well organized, and honest about limitations.                                                                                                                                                                                                                                                                             |
| Reproducibility and honesty               | 10%        | A clean run reproduces full-data figures. Assumptions and missing evidence are explicit. Stress tests include a defect and a valid control, with observed results. Row-order robustness, contribution statements and material AI logs are supplied. Team members can explain and modify their work.                                                                                                                  |
| Total                                     | 100%       |                                                                                                                                                                                                                                                                                                                                                                                                                      |

# 10\. Rules and expectations

  - **Teams of three to five students** enrolled in the MSAA or MSAE program. Cross-program teams are encouraged.

  - **Attend the three check-ins.** They are not graded, but they are how faculty keep your work on track.

  - **All work must be original.** Cite every external source, framework, and dataset.

  - **Generative AI is permitted** for research, coding and drafting. Submit the prompts and responses that materially shaped the work, including important corrections and validation decisions. Synthetic competition data may be used only in university-approved tools and settings that comply with competition confidentiality requirements. Local tools are acceptable. Do not upload confidential sponsor communications, production data or client data. You remain accountable for every claim and line of code; prompt count is not graded.

  - **The dataset is synthetic and provided for this competition only.** Do not redistribute it or expose it through public repositories, public dashboards or public AI links. Keep any organizer-only material separate from your submission.

  - **Do not contact State Street employees** outside the channels the competition provides.

  - **Sponsor-supplied confidential materials remain protected** and must not be pasted into external AI tools. The synthetic teaching dataset is governed by the specific AI and sharing conditions above. If a tool cannot meet those conditions, use a local workflow or ask the organizing team.

  - **Label estimated and assumed values clearly.** Do not fabricate benchmarks, regulations, platform capabilities, or results.

# 11\. Prizes

|                  |           |
| ---------------- | --------- |
| **Place**        | **Award** |
| Winner           | $2,000    |
| First runner-up  | $1,000    |
| Second runner-up | $500      |

Awarded at the final presentation session on Friday, November 20.

# Appendix A — Illustrative KPI rows by office

*This is the level of specificity expected, not a set of metrics to adopt. Owners are role names, not people. Choose and justify your own dimensions, formulas, and targets — a metric with no owner and no target is an observation, not a KPI. These are illustrative targets, not sponsor SLAs or verified industry benchmarks. Label each metric as computed, simulated or proposed; formula denominators must identify the eligible population and missing-data treatment.*

<table>
<tbody>
<tr class="odd">
<td><strong>Office</strong></td>
<td><strong>Metric</strong></td>
<td><strong>Formula</strong></td>
<td><strong>Unit</strong></td>
<td><strong>Owner</strong></td>
<td><strong>Target</strong></td>
</tr>
<tr class="even">
<td>Front</td>
<td><strong>Position agreement</strong></td>
<td><p><br /><span class="math display">$$100\  \times \ \frac{\text{keys\ within\ tolerance}}{\text{comparable\ keys}}$$</span><br /></p>
<p><em>Report one-sided keys separately.</em></p></td>
<td>%</td>
<td>Front office data lead</td>
<td>≥ 99.9%</td>
</tr>
<tr class="odd">
<td>Front</td>
<td><strong>Account completeness</strong></td>
<td><br /><span class="math display">$$100\  \times \ \frac{accounts\ passing\ required - field\ rules}{\text{accounts\ tested}}$$</span><br /></td>
<td>%</td>
<td>Account onboarding</td>
<td>≥ 99.5%</td>
</tr>
<tr class="even">
<td>Front</td>
<td><strong>Cutoff adherence</strong></td>
<td><p><br /><span class="math display">$$100\  \times \ \frac{\text{eligible\ rows\ booked\ by\ cutoff}}{\text{eligible\ rows}}$$</span><br /></p>
<p><em>Disclose unknown timestamps separately.</em></p></td>
<td>%</td>
<td>Platform operations</td>
<td>≥ 99%</td>
</tr>
<tr class="odd">
<td>Middle</td>
<td><strong>Primary price coverage</strong></td>
<td><br /><span class="math display">$$100\  \times \ \frac{\text{held\ securities\ with\ an\ eligible\ primary\ quote}}{\text{held\ securities\ requiring\ a\ quote}}$$</span><br /></td>
<td>%</td>
<td>Pricing lead</td>
<td>≥ 95%</td>
</tr>
<tr class="even">
<td>Middle</td>
<td><strong>Price staleness</strong></td>
<td><p><br /><span class="math display">$$100\  \times \ \frac{\text{selected\ quotes\ older\ than\ the\ limit}}{\text{selected\ quotes}}$$</span><br /></p>
<p><em>Report missing quotes separately.</em></p></td>
<td>%</td>
<td>Pricing lead</td>
<td>≤ 1%</td>
</tr>
<tr class="odd">
<td>Middle</td>
<td><strong>Vendor dispersion</strong></td>
<td><br /><span class="math display">$$100\  \times \ \frac{maximum\  - \ minimum}{|mean\ of\ comparable\ positive\ quotes|}$$</span><br /></td>
<td>%</td>
<td>Pricing lead</td>
<td>≤ 0.5%</td>
</tr>
<tr class="even">
<td>Middle</td>
<td><strong>Break rate</strong></td>
<td><p><br /><span class="math display">$$100\  \times \ \frac{mismatched\ or\ one - sided\ keys}{\text{union\ of\ position\ keys}}$$</span><br /></p>
<p><em>Report unevaluable keys.</em></p></td>
<td>%</td>
<td>Reconciliation lead</td>
<td>≤ 0.1%</td>
</tr>
<tr class="odd">
<td>Middle</td>
<td><strong>Settlement exceptions</strong></td>
<td><br /><span class="math display">$$100\  \times \ \frac{\text{eligible\ trades\ breaching\ a\ declared\ rule}}{\text{eligible\ trades\ tested}}$$</span><br /></td>
<td>%</td>
<td>Reconciliation lead</td>
<td>≤ 0.5%</td>
</tr>
<tr class="even">
<td>Back</td>
<td><strong>Valuation residual</strong></td>
<td><p><br /><span class="math display">$$10,000\  \times \ \frac{investment\ value\  - \ reported\ net\ assets}{|reported\ net\ assets|}$$</span><br /></p>
<p><em>Not a proven NAV error.</em></p></td>
<td>bps</td>
<td>Fund accounting</td>
<td>Investigate material gaps</td>
</tr>
<tr class="odd">
<td>Back</td>
<td><strong>Ledger arithmetic</strong></td>
<td><br /><span class="math display">$$100\  \times \ \frac{rows\ where\ net\ assets\  \div \ shares\  = \ NAV\ per\ share}{\text{evaluable\ rows}}$$</span><br /></td>
<td>%</td>
<td>Fund accounting</td>
<td>≥ 99.9%</td>
</tr>
<tr class="even">
<td>Executive</td>
<td><strong>Simulated escape rate</strong></td>
<td><br /><span class="math display">$$100\  \times \ \frac{test\ defects\ missed\ upstream,\ caught\ downstream}{\text{labeled\ defects\ tested}}$$</span><br /></td>
<td>%</td>
<td>Chief Data Officer</td>
<td>≤ 5% in tests</td>
</tr>
<tr class="odd">
<td>Executive</td>
<td><strong>Detection distance</strong></td>
<td><p><br /><span class="math display"><em>s</em><em>t</em><em>a</em><em>g</em><em>e</em> <em>d</em><em>e</em><em>t</em><em>e</em><em>c</em><em>t</em><em>e</em><em>d</em> − <em>e</em><em>a</em><em>r</em><em>l</em><em>i</em><em>e</em><em>s</em><em>t</em> <em>f</em><em>e</em><em>a</em><em>s</em><em>i</em><em>b</em><em>l</em><em>e</em> <em>s</em><em>t</em><em>a</em><em>g</em><em>e</em></span><br /></p>
<p><em>From your analysis; not historical lag.</em></p></td>
<td>stages</td>
<td>Chief Data Officer</td>
<td>≤ 1</td>
</tr>
<tr class="even">
<td>Executive</td>
<td><strong>First-pass yield</strong></td>
<td><p><br /><span class="math display">$$100\  \times \ \frac{\text{records\ passing\ first\ attempt}}{\text{records\ attempted}}$$</span><br /></p>
<p><em>Proposed: needs an attempt log.</em></p></td>
<td>%</td>
<td>Chief Data Officer</td>
<td>≥ 99%</td>
</tr>
<tr class="odd">
<td>Executive</td>
<td><strong>Unresolved exposure</strong></td>
<td><br /><span class="math display"><em>Σ</em> |<em>v</em><em>a</em><em>l</em><em>u</em><em>e</em><em>d</em> <em>e</em><em>x</em><em>p</em><em>o</em><em>s</em><em>u</em><em>r</em><em>e</em> <em>o</em><em>f</em> <em>d</em><em>i</em><em>s</em><em>t</em><em>i</em><em>n</em><em>c</em><em>t</em> <em>u</em><em>n</em><em>r</em><em>e</em><em>s</em><em>o</em><em>l</em><em>v</em><em>e</em><em>d</em> <em>p</em><em>o</em><em>s</em><em>i</em><em>t</em><em>i</em><em>o</em><em>n</em><em>s</em>|</span><br /></td>
<td>USD</td>
<td>Chief Data Officer</td>
<td>Risk-based review</td>
</tr>
</tbody>
</table>

# Appendix B — Illustrative indicator rows

*Define the calculation, refresh cadence, threshold, owner and decision for every indicator. A leading indicator signals a later risk; it does not establish predictive accuracy without a time-ordered test. Historical timestamps support retrospective analysis. Remediation and restatement indicators require additional logs and must be labeled proposed.*

|                            |          |                                                                                                                                       |                                                |                                                                                          |
| -------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Indicator**              | **Type** | **Calculation and refresh**                                                                                                           | **Threshold**                                  | **What it predicts or confirms**                                                         |
| Unmastered security rate   | Leading  | Transactions referencing a security absent from the master ÷ transactions; daily                                                      | Any occurrence                                 | Positions that cannot be priced, and a NAV gap at the next valuation                     |
| Corporate action readiness | Leading  | Actions with sufficient terms and resolved references ÷ actions assessed; by effective date. Eligibility is not proof of application. | Below 100% after effective date                | Potentially blocked position adjustments; application confirmation needs an event ledger |
| Booking latency            | Leading  | Median booked time minus received time, by feed; daily                                                                                | Above four hours, or a doubling week over week | Records missing the valuation cutoff, producing a stale NAV                              |
| Position break count       | Lagging  | Differing and one-sided keys in the stated comparison at the snapshot; report unsupported cases separately                            | Any break above materiality                    | Confirms a disagreement requiring investigation; does not alone prove a defect           |
| NAV restatement rate       | Lagging  | Proposed only: corrected struck NAVs ÷ struck NAVs; monthly. Requires a versioned NAV and correction log not supplied here.           | Any                                            | Confirms a defect reached the investor, the most expensive discovery point               |

# Appendix C — Ideas worth exploring

Judges reward teams that connect disciplines many institutions still run separately. These are optional lenses, not extra deliverables: data observability, where freshness, volume, schema, and distribution signals become automated inputs to your indicators; data contracts as the source of testable expectations between offices; metadata-driven scoring, where scores configure themselves from a catalog rather than hand-coded rules; data product thinking, where each dataset carries a published quality SLA and a visible score; and knowledge graphs, where relationships among accounts, securities, and positions let you propagate a score and estimate the blast radius of a single bad record.

# Appendix D — Pressure-test your design

Every one of these is answerable from the required deliverables. If you cannot answer one, you have found a gap. A position breaks by 400 shares — how do you tell a genuine error from a trade that has not settled yet, and how long does that take? Which of your leading indicators would have fired before the largest defect you found, and how do you know? If two accounts both score 85, do they have the same problems, and if not, what does the score hide? Your pricing rule picks one vendor over another — what is that choice worth in basis points across the book, and who signs off on it? Which of your indicators could an operations team game, and what would that look like in the numbers? Your checks flag 120 positions: pick one, walk it back to where it entered, and say what evidence at each step convinces a skeptical reviewer the flag is real — and what would have cleared it instead. You found a defect at the NAV stage: where should it have been caught, what would that control have cost, and would you build it? And the one every executive asks — what do they do differently on Monday morning because of what the dashboard showed on Friday?

1.  Net asset value (NAV): the value of a fund's assets minus its liabilities, divided by shares outstanding. It is the price at which investors buy and sell the fund, so an error that reaches it reaches them.

2.  Corporate action: an event at the issuer that changes what a holder owns — a stock split, a merger, a spin-off, a bond redemption, a dividend. Every affected account has to be adjusted, and adjusting some but not all is a classic defect.

3.  Master data: the reference records a business keeps about the things it deals in — here, who the accounts are and what the securities are. It is shared by every process downstream, which is why one bad master record contaminates many results at once.

4.  Trade date is when the deal is struck; settlement date is when the securities and cash are scheduled to change hands. A position can legitimately differ between the two depending on which convention is used.

5.  Break: a difference between two records of the same thing that should agree. Reconciliation is the work of explaining every break.

6.  Basis point (bp): one hundredth of a percent. A 1 bp error on a $10 billion fund is $1 million.
