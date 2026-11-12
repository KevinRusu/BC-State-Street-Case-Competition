# Final presentation: outline

*Agreed 12 Nov, before the 13 Nov test run. Replaces the 30 Oct loose draft (in git history). Change it after every
dry run; git keeps the history. The wording on the slides is ours: this file gives the point of each slide, not its
text.*

*Draft content for every slide, with the numbers and their sources: [DECK_BRIEF.md](DECK_BRIEF.md). Logos (State
Street, Boston College) go in the slide master. No numbers are typed here (CLAUDE.md). Each slide names the file its evidence comes from. Read every number from
[FINDINGS.md](../FINDINGS.md) or the dashboard, never from memory.*

## The format

- 15 minutes, then 10 minutes of questions. 12 to 15 slides, plus a backup appendix that does not count
  ([brief §7](../../reference/01_Student_Brief.md#7-what-you-submit)).
- Audience: a Chief Data Officer and their leadership team. Judges are State Street data leaders and BC faculty
  ([brief §9](../../reference/01_Student_Brief.md#9-how-judges-will-evaluate-your-work)). Assume they have never seen
  the dataset.
- Every member speaks. Expect a live record-level trace and an assumption change during Q&A.
- The order: intro slides, then the live dashboard, then the technical slides.

## The thesis

**Agreement isn't proof.** A defect that enters early (at trade capture, or in the account and security master data)
passes every later check, because each later check compares it with something that carries the same mistake. Even
the book and the custodian agree on it. So the controls have to sit where the data enters.

Every slide supports this sentence or is cut.

## What the jury should leave with

Impressed by the dashboard, and clear on what we solved and why it matters. Rubric weight sits on architecture and
detection (25% each), so the dashboard shows them live and the technical slides explain them.

## Slides

| # | Part | Point of the slide (the headline says this as a full sentence) | Evidence from | Time |
|---|---|---|---|---|
| 1 | Intro | Title and the thesis in one line | | 0:20 |
| 2 | | Agenda: the problem, the product, how it works | | 0:15 |
| 3 | | One BUY with a negative quantity was booked, published on time and passed every later check | [STORY.md](../checkins/checkin2/STORY.md), `docs/figures/08_journey_negative_buy.png`, [catalog](../DEFECT_CATALOG.md) | 1:00 |
| 4 | | It is not one trade but a class, and the book and the custodian agree on the wrong quantity | FINDINGS, lines where "Book and custodian" agree; `docs/figures/10_three_way.png` | 0:50 |
| 5 | | Why it matters to State Street: wrong positions reach NAV and client reports, and the custodian match cannot see them | Scorecard KPI 4 and the position lines in FINDINGS; impact from the executive view (one scenario, never a total) | 0:50 |
| 6 | | Our answer: checks where data enters, scored per office, in one dashboard, and the first fix we recommend (the Working Guide §8 says answer before method). "Let us show you." | | 0:45 |
| — | Demo | Executive view → drill into one rule → trace one record end to end → data map, where the check sits | Dashboard; backup screenshots on hidden slides | ~4:00 |
| 7 | Technical | How we know: every position rebuilt from the trades and compared three ways (rebuilt, book, custodian) | `docs/figures/09_waterfall.png`, `outputs/02_three_way_summary.csv` | 0:50 |
| 8 | | Checks and rules: 7 checks at the handoffs, each with an owner; rules underneath; reject, hold or flag | [RULES.md](../RULES.md) "How to read this file", `docs/figures/01_control_map.png` | 0:50 |
| 9 | | Where defects enter vs where they are found (the detection model) | `docs/figures/03_detection_matrix.png`, catalog | 0:50 |
| 10 | | What we found: confirmed, unresolved and cleared; the three traces in one line each | FINDINGS counts, catalog | 0:50 |
| 11 | | What looked wrong but wasn't: two clearances and what cleared them | FINDINGS "Cleared" | 0:30 |
| 12 | | Can you trust it, and what we can't prove: stress test, row shuffle, threshold change, limits | FINDINGS "Stress test", `tests/robustness_test.sh`, catalog | 0:40 |
| 13 | | What to fix first: three recommendations, each with owner, cost and dependency | Roadmap (still to write) | 0:50 |
| 14 | | Close: back to the one trade, and the check that now stops it | Slide 3's journey | 0:20 |

### Words to define once (slide 8)

From [RULES.md](../RULES.md): a **check** is one test at one handoff with one owner; a **rule** is an exact condition
the code tests, several per check; a **finding** is one result line, confirmed, unresolved or cleared; a **defect** is
a confirmed problem. Say these in plain words once; the jury is new to the data.

## Demo

- Fixed click path, rehearsed: Executive view, then one rule, then Trace a record, then Data map. Use the record
  from slide 3 so the demo and the story meet.
- Run locally with a fresh store (`uv run python scripts/build_store.py`), browser zoom about 125%, other tabs closed,
  notifications off.
- Backup: screenshots of each step on hidden slides right after the demo divider. If the dashboard fails, unhide and
  carry on.
- KPIs by office show live in the executive view; their full table goes in the appendix.

## Morph transitions

Morph animates objects that appear on two consecutive slides. Use it where the **same object changes** (a zoom, a
move, a highlight), not as decoration. Keep each to about 0.7 to 1 second.

How to set one up:

1. Build slide A. Duplicate it (right-click the thumbnail, Duplicate Slide).
2. On the copy, move, resize or recolour the objects. Add or delete what you need.
3. Select the copy, Transitions tab, Morph. Effect Options: Objects (default), or Words for text.
4. Name the objects that must pair up the same on both slides, starting with `!!` (Home, Arrange, Selection Pane),
   e.g. `!!trade`. PowerPoint then always matches them.

Where we use it:

| From → to | What morphs |
|---|---|
| 1 → 2 | The title shrinks into the header; the agenda appears |
| Every section start | A small agenda strip at the top; the highlight slides to the current part |
| 3 → 4 | The one trade's card shrinks to a dot among many dots: one trade becomes a class |
| 4 → 5 | The book and custodian bars slide together (they agree); the rebuilt bar stays apart |
| 6 → demo divider | The dashboard tile grows to fill the slide, then switch to the browser |
| 9 → 14 | The journey diagram from slide 3 returns; the check at trade capture lights up and the trade stops there |

Limits to know:

- Pictures (the PNG figures) only move, resize or fade. To morph the inside of a diagram, rebuild it from native
  PowerPoint shapes.
- Groups morph as one object. Ungroup if parts must move separately.
- Morph needs PowerPoint 2019 or Microsoft 365. Present from our own laptop; Google Slides and older versions drop it.

## Writing the slides (so they don't read as generated)

- Write all 14 headlines first, as full sentences, before any design. Reading only the headlines must tell the story.
- One message per slide. Cut whatever does not support the headline.
- Evidence beats adjectives: a record ID, a figure, a count from FINDINGS. Avoid "robust", "seamless",
  "comprehensive", "leverage".
- Avoid three equal boxes with icons, the same layout on every slide, stock photos, and slides that list topics
  instead of making a point.
- Use the judges' words: break, custodian, book of record, NAV. Read every line aloud; if you would not say it, cut it.

## Backup appendix (not counted)

- KPI table by office (formula, unit, owner, target, decision supported)
- Wireframes for the front, middle and back office (required deliverable; still to draw)
- Reconciliation waterfall and sensitivities (`docs/figures/09_waterfall.png`, `docs/figures/11_sensitivities.png`)
- Full findings register ([FINDINGS.md](../FINDINGS.md)) and [defect catalog](../DEFECT_CATALOG.md)
- Price checks, NAV arithmetic, corporate-action quarantine
- Reproducibility: run commands, runtime, row-shuffle and threshold tests
- Demo backup screenshots

## Q&A prep

- Practise a live trace on a record the judges pick, not one we chose.
- Practise one config change on the spot (a threshold or vendor priority) and say what moved.
- Each member can answer "where does this number come from?" for their slide.
- Recommendations are ours; the checks only detect (D-001). Keep the two apart in answers.

## Open

- Speakers per slide (every member speaks).
- The three recommendations and the roadmap behind slide 13.
- Which two clearances for slide 11.
