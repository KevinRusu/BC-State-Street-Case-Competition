# Professor feedback on the dashboard: design (short)

Date: 2026-11-17. Branch: `professor-feedback`. Size: a small change (wording and one panel layout; no data, check,
score or store change).

## Intent

Our professor read the dashboard as a first-time viewer and found three things hard to follow:

1. **Executive view:** "Leading indicators of what?" The sections need words that say what they are for.
2. **"Platform Repair Triage":** "triage" is too fancy a word.
3. **Data Map:** three equal boxes (confirmed, unresolved, cleared) are hard to follow. He suggested putting
   cleared under confirmed, reading "cleared" as "harder to confirm". In our register, cleared means *a flag we
   ruled out as a false alarm* (`docs/RULES.md`, "Evidence status for every finding"), so moving it under
   confirmed would count false alarms as proven defects. We keep his point (a hierarchy, cleared shown as a
   secondary group with its items on demand) with the meaning kept correct.

Goal: a first-time viewer understands each Executive view section and the Data Map summary without help.
Non-goals: no new number, check or score; the status dots on map tags, the details panel and the Trace page keep
their three statuses as they are. Anti-goal: anything that makes cleared flags look like defects, or hides them
(the brief rewards cleared flags, Working Guide §7, "Over-flagging").

## Approaches (picked: A)

- **A (picked):** a two-level hierarchy, "Real problems" (confirmed, unresolved) and "False alarms ruled out"
  (cleared), and a reply to the professor explaining what cleared means.
- B: cleared under confirmed, as suggested. Rejected: it misstates the numbers.
- C: keep the three boxes and only reword "Cleared". Rejected: it does not answer his point that the layout is hard
  to follow.

## The design

### 1. Executive view: one plain line under every section heading

`ExecutiveSection` in `dashboard/app/executive/page.tsx` gains an optional one-line `intro`, shown in muted text under
the heading (and under the collapsible heading too). Draft wording (the team may edit it):

| Section | Heading | Intro line |
| --- | --- | --- |
| Executive Metrics | unchanged | How healthy our data is overall and in each data area, scored against its target. |
| Leading Indicators | **Early Warning Signs (Leading Indicators)** | Signals that move *before* a problem reaches client accounts or the reconciliation. A triggered sign means: act now, before it becomes a break. |
| KPIs by Office | unchanged | How each office (front, middle and back) is doing against its target. |
| Worst Accounts | unchanged | The client accounts with the lowest data quality scores: where errors are most likely to reach a client. |
| Platform Repair Triage | **What to Fix First** | Where repair work pays off most: the checks with the lowest scores, or the problems with the largest dollar impact. |
| Data Integrity Status | unchanged | Can these numbers be trusted? The results of our stress test and our sensitivity check. |

The headline tile "Leading Indicators Triggered" becomes "Early Warning Signs Triggered" so the tile and its section
use the same words (our call).

### 2. "Triage" → "What to Fix First"

Covered by the table above. This is the Chief Data Officer's own question (brief §2) and the section's id
(`fix-first`) already.

### 3. Data Map summary: a hierarchy

`dashboard/components/map/summary-cards.tsx` is rebuilt; it stays in the same place beside the map and keeps its
`Finding summary` label.

```text
Flagged by our checks          N
┌ Real problems                N ┐
│ ● Confirmed  N  the data proves it         │
│ ● Unresolved N  fails a test, not yet proven│
└────────────────────────────────┘
┌ False alarms ruled out       N ┐   ← quieter style, green dot
│ looked wrong, turned out fine (cleared)     │
│ [Show which ▾]  → list of the cleared findings' names │
└────────────────────────────────┘
```

- Numbers are the same register counts as today (`totals()` in `lib/findings.ts`); "Flagged" and "Real problems" are
  sums of them shown on screen, not stored.
- The cleared list uses each register line's `finding` text. It opens on click or tap (a disclosure button), not on
  hover only, so it works with a keyboard and on a tablet during the demo (our call; the professor mentioned hover).
- The word "cleared" stays visible in brackets, so the panel matches the register, FINDINGS.md and the slides.

### 4. Around it

- Tests: update `e2e/dashboard.spec.ts` (summary layout) and `e2e/executive.spec.ts` (headings); add a check that the
  cleared list opens and shows the cleared findings.
- Docs: `dashboard/README.md` (section names and the summary), a D-075 entry in `docs/DECISIONS.md`, `docs/STATUS.md`.
- For the team: the slides need the same hierarchy and wording (teammates own the deck; a note in STATUS.md).
- A short reply to the professor, drafted for the user to send.

## Left to the builder

Exact styling of the two groups within the existing card look, and the layout at narrow widths (today the cards go
three across between the phone and desktop widths; the two groups may sit side by side there).
