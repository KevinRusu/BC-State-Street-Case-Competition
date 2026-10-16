> Markdown copy of `etc/03_Student_Working_Guide.pdf`, converted from the .docx on 15 Oct 2026 so Claude Code can read it easily. The PDF is the official version.

Boston College · Woods College of Advancing Studies

4th Annual Fall into BC Case Competition · Industry sponsor: State Street

**Working Guide**

**How to approach the case, week by week**

*Optional help · Companion to the student brief*

<table>
<tbody>
<tr class="odd">
<td><p><strong>What this is, and what it is not</strong></p>
<p>This guide is optional. It collects the advice faculty give at check-ins, so every team gets it at the start rather than some teams getting it late. Nothing in it is graded, and nothing in it tells you what is wrong with the data.</p>
<p>The brief is the only statement of requirements. Where this guide and the brief differ, the brief wins.</p></td>
</tr>
</tbody>
</table>

# **1. The first two weeks: architecture before data**

Teams that open the data first tend to design an architecture around whatever they happened to find. Teams that design first find more, because they know what they are looking for. A workable order:

  - > **Draw the platform on one page.** Five stages from Section 3 of the brief across three offices. Mark every handoff with an arrow. Each arrow is a place data can be dropped, duplicated, delayed or changed — those are your candidate control points.

  - > **For each handoff, write the contract.** One sentence each: what the downstream office is entitled to expect. Then turn it into a test someone could run: a condition, a denominator, a threshold.

  - > **Build the control table.** One row per control: what it checks, where it sits, what happens when it fails (reject, hold, flag, correct), and which role owns it.

  - > **Only then, write the detection-point model.** For each family of defect you would expect on a platform like this, where is the earliest stage it could be caught, and what evidence would that need?

*A control-table row looks like this. It is a format example, not a control you must use:*

| **Control**         | **Checks**                           | **Stage**    | **On failure**                      | **Owner**               |
| ------------------- | ------------------------------------ | ------------ | ----------------------------------- | ----------------------- |
| Account status gate | An account is open on the trade date | Transactions | Hold the trade; route to onboarding | Account onboarding lead |

# **2. Getting the data in**

  - > **Keep a row ledger from day one.** Every load, filter and join: rows in, rows out, and why. When a join changes a row count you did not expect, stop — that is usually a finding, not a bug.

  - > **Read everything as text first.** Convert types explicitly and keep what failed to convert. A parser that quietly guesses is how analyses go wrong without anyone noticing.

  - > **If memory is tight, query rather than load.** DuckDB reads .csv.gz files directly with SQL and handles tables far larger than memory; pandas with chunks works too. Excel will not hold the large tables.

  - > **Sample by account, not by row.** If you develop on a subset, keep every record linked to the accounts you chose — their trades, pipeline records, positions, and the securities and prices they touch. Fix the seed and write down the rule. Run the final numbers on everything.

  - > **Never edit the raw files.** Build cleaned views alongside them. The raw data is your evidence.

# **3. Profiling without drowning**

Standard data-quality dimensions give you a checklist that works on any table. Run it systematically, then spend your time on what matters. These are questions, not answers:

| **Dimension**         | **Questions to ask of every table**                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Completeness          | Which required fields are blank, and does blank mean unknown, not applicable, or a failure?                                  |
| Uniqueness            | Is the intended key actually unique? If two records describe the same thing, which one is real?                              |
| Validity              | Are values in the allowed range, format and code list? Are signs and scales plausible?                                       |
| Referential integrity | Does every reference point at something that exists? What happens to the orphans in your joins?                              |
| Consistency           | Do two sources that should agree actually agree? Does a record agree with itself across its own fields?                      |
| Timeliness            | Did it arrive and get processed in time? Are the timestamps in the order the process implies?                                |
| Conformity            | Is the same field written the same way throughout, across every source and every day?                                        |
| Accuracy              | Where there is an independent reference — another vendor, another source, the transaction history — does the value match it? |

**Then choose.** The brief rewards three defect classes traced properly over thirty listed. Pick the ones with the widest blast radius or the clearest story, and say why you picked them.

# **4. How to build a trace**

A trace is a record's journey told with evidence. Pick one affected record and follow it hop by hop. At each hop, show the actual fields that prove the link, and say what a control there would have seen. A useful layout:

| **Hop**    | **Record and key fields**        | **What the evidence shows**                                   | **Control that would have caught it** |
| ---------- | -------------------------------- | ------------------------------------------------------------- | ------------------------------------- |
| Source     | The transaction row as delivered | What was sent, by which system, when                          | Capture-time validation               |
| Pipeline   | The matching pipeline record     | When it was received, booked, published; against which cutoff | Timeliness gate                       |
| Position   | The position it contributed to   | How it moved the holding; what the history says it should be  | Rebuild-and-compare                   |
| Downstream | Valuation, NAV or report touched | What changed as a result                                      | Pre-strike check                      |

Say plainly which links you observed in the data and which you inferred. Where the evidence runs out, name the data you would need — that is a finding about the platform's contracts, and it earns credit.

# **5. Clearing a flag**

Some things that look wrong are legitimate. Clearing a flag well is worth as much as confirming a defect, and it is harder. A clearance needs:

  - > **A stated rule,** written before you look at the result.

  - > **Independent evidence,** from a different field or table than the one that raised the flag. A record cannot vouch for itself.

  - > **The population it applies to,** and how many records it cleared. Then check that the rule did not clear something it should not have.

  - > **What would change your mind.** The data that, if it existed, would reopen the question.

An item you cannot confirm or clear is unresolved. Say so. Judges read “unresolved, and here is what we would need” as a strength.

# **6. Writing a finding**

Every finding in your catalog should answer the same seven questions. If one is missing, the finding is not finished.

| **Field**         | **What to write**                                                               |
| ----------------- | ------------------------------------------------------------------------------- |
| Name and status   | A plain name, and confirmed, unresolved or cleared                              |
| Rule              | The exact test, including thresholds and what counts as eligible                |
| Population        | Records affected, out of how many eligible, and how many could not be evaluated |
| Example records   | Two or three identifiers someone else can look up                               |
| Where it entered  | The stage and handoff, with the evidence                                        |
| Why it matters    | Who is affected downstream and a defensible measure of how much                 |
| What would fix it | The control, where it sits, and who owns it                                     |

# **7. Using AI well**

AI is permitted, and we assume every team will use it. That changes what the competition measures. An AI tool can write profiling code, draft an architecture and produce a plausible list of findings quickly. What it cannot do is stand in the room for you, and it is not reliable on exactly the calls this case turns on.

## **Where AI tends to go wrong on this kind of data**

  - > **Interpretation.** Whether a pattern is a defect or a legitimate case is a judgment. AI tools make that call confidently and sometimes reverse it when asked again.

  - > **Silent repair.** Tools coerce types, drop rows in joins and fill blanks without saying so. Check row counts yourself.

  - > **Over-flagging.** A long list looks thorough. The brief penalises false positives and rewards cleared flags.

  - > **Invented context.** Benchmarks, regulations and platform behaviour that are not in the data or the brief. Label anything you did not derive.

## **What you will be asked in the room**

The brief says judges may ask any team member to walk a record back to where it entered, change a threshold or vendor priority and rerun, or run your code on a test file with the same schema. Prepare for that. Every member should be able to explain every number on your slides, and to say where the AI was wrong and how you caught it.

## **Keeping the AI log**

Export your chat histories as you go rather than reconstructing them at the end. Keep the prompts that shaped the work, the answers you rejected, and the checks you ran on the answers you kept. A log that shows you correcting the tool is worth more than one that shows you accepting it.

# **8. The deck**

The deck is the primary deliverable. Fifteen minutes goes quickly; most teams try to show everything and land nothing. One spine that works, among many:

| **Slides** | **Section**                   | **What it has to do**                                                     |
| ---------- | ----------------------------- | ------------------------------------------------------------------------- |
| 1–2        | The answer                    | Your main recommendation and why, before any method                       |
| 3–4        | The platform and its controls | The control map and where your architecture says defects should be caught |
| 5–8        | The evidence                  | Two or three traced defects and one cleared flag, record by record        |
| 9–10       | Measurement                   | KPIs by office and the executive view, with real values                   |
| 11–12      | What happens next             | The operating model and a roadmap with owners                             |
| 13         | Limits                        | What you could not prove, and what data would settle it                   |
| 14–15      | Close                         | The decision you are asking for, and backup slides after                  |

**Common mistakes:** method before answer; tables too dense to read at the back of the room; totals without denominators; a dashboard screenshot instead of a demonstration; and no slide that says what the executive should do differently.

# **9. Check-in preparation**

Check-ins are not graded, and they are the best feedback you will get. Bring work, not intentions. Before each one, make sure you can answer:

  - > **Check-in 1:** Where does each control sit, who owns it, and which defect family does it catch earliest? Can you show one record's journey through the tables?

  - > **Check-in 2:** Does your reconstruction run on the full data? How many breaks, classified how? What did you assume about reversals, and what else could it mean?

  - > **Check-in 3:** Do Part One and Part Two agree? If a judge changes one threshold, does your code rerun and your slide still hold?
