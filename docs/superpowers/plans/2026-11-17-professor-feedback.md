# Professor Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Executive view and the Data Map summary self-explanatory for a first-time viewer, without
changing any number.

**Architecture:** Wording changes and a one-line intro per section on `/executive`; the Data Map's three equal
summary cards become a two-level panel (real problems: confirmed, unresolved; false alarms ruled out: cleared, with
the cleared findings listed on demand). The grouping is a pure function in `lib/findings.ts` so it is unit-tested.

**Tech Stack:** Next.js 16.4.6, React, Tailwind, Vitest (node environment, pure functions only), Playwright on the
made-up browser fixture.

**Spec:** `docs/superpowers/specs/2026-11-17-professor-feedback-design.md`

## Global Constraints

- No data, check, score, store or notebook change. Counts come from the register exactly as today (`totals()`).
- Cleared findings must never be shown as defects or hidden; the word "cleared" stays visible in brackets.
- Status dots on map tags, the details panel and the Trace page are unchanged.
- Every example number in tests is invented (no figure from `outputs/` or `docs/FINDINGS.md`).
- Never commit or push: the user commits. Leave each task's changes in the working tree on branch
  `professor-feedback`.
- Work inside `dashboard/` with `npm`; read `dashboard/AGENTS.md` first (Next.js version notes).

## Review Focus

1. **No cleared findings:** the "False alarms ruled out" group still shows, with 0 and no "Show which" button
   (Task 1, unit test `summaryOf › no cleared lines`; component renders the button only when the list is non-empty).
2. **Phone width with the list open:** long finding text wraps inside the panel; no horizontal page scroll at 390 px
   (Task 1, e2e step).
3. **Keyboard:** the "Show which" button is reachable and toggles with Enter, with `aria-expanded` (Task 1, e2e step).
4. **Collapsed section:** the Data Integrity Status intro is visible while the section is still closed (Task 2, e2e).
5. **A register line with an unexpected status** (e.g. empty) is not counted in "Flagged by our checks"; the flagged
   total equals confirmed + unresolved + cleared (Task 1, unit test).

---

### Task 1: Data Map summary as a hierarchy

**Files:**
- Modify: `dashboard/lib/findings.ts` (add `Summary`, `summaryOf`)
- Modify: `dashboard/components/map/summary-cards.tsx` (rebuild the panel)
- Test: `dashboard/tests/findings.test.ts`, `dashboard/e2e/dashboard.spec.ts` (test "the data map prioritizes the
  canvas…", lines 75–110, plus one new test)
- Docs: `dashboard/README.md` (the `/` page line, ~line 46), `docs/DECISIONS.md` (append D-075)

**Interfaces:**
- Produces, in `lib/findings.ts`:
  `export type Summary = Counts & { flagged: number; problems: number; clearedFindings: string[] };`
  `export function summaryOf(register: RegisterLine[]): Summary`
  - `flagged = confirmed + unresolved + cleared`; `problems = confirmed + unresolved`.
  - `clearedFindings`: the `plain` text of each cleared line, in register order, one entry per line (so its length
    equals `cleared`).
- `SummaryCards({ register })` keeps its name, props, place in `map-explorer.tsx` and the
  `<aside aria-label="Finding summary">` wrapper.

- [ ] **Step 1: Write the failing unit tests** in `tests/findings.test.ts`, with a helper building a `RegisterLine`
  from `(line, status, plain)` (other fields blank or 0):

```ts
describe("summaryOf", () => {
  test("groups confirmed and unresolved as problems and lists cleared findings in register order", () => {
    const s = summaryOf([
      reg(1, "confirmed", "A"), reg(2, "cleared", "Looks odd, fine"), reg(3, "unresolved", "B"),
      reg(4, "confirmed", "C"), reg(5, "cleared", "Second false alarm"),
    ]);
    expect(s).toMatchObject({ confirmed: 2, unresolved: 1, cleared: 2, problems: 3, flagged: 5 });
    expect(s.clearedFindings).toEqual(["Looks odd, fine", "Second false alarm"]);
  });
  test("no cleared lines", () => {
    const s = summaryOf([reg(1, "unresolved", "B")]);
    expect(s.cleared).toBe(0);
    expect(s.clearedFindings).toEqual([]);
  });
  test("a line with an unexpected status is not flagged", () => {
    expect(summaryOf([reg(1, "", "X"), reg(2, "confirmed", "A")]).flagged).toBe(1);
  });
  test("an empty register is all zeros", () => {
    expect(summaryOf([])).toEqual({ confirmed: 0, unresolved: 0, cleared: 0, problems: 0, flagged: 0, clearedFindings: [] });
  });
});
```

- [ ] **Step 2: Run them and see them fail**
  Run (in `dashboard/`): `npx vitest run tests/findings.test.ts`
  Expected: FAIL, `summaryOf` is not exported.

- [ ] **Step 3: Implement `summaryOf`** in `lib/findings.ts` on top of the existing `count()`.

- [ ] **Step 4: Run the unit tests** — same command. Expected: PASS.

- [ ] **Step 5: Rewrite the browser layout assertions first** (they fail until Step 6). In the existing test "the
  data map prioritizes the canvas and places the details underneath", replace the
  `["Confirmed", "Unresolved", "Cleared"]` block (lines 88–93) with: inside `summary`, the texts
  "Flagged by our checks", "Real problems", "Confirmed", "Unresolved", "False alarms ruled out" appear in that
  vertical order (each `y` greater than the one before) at the wide width. Add a new test
  `"the finding summary separates real problems from false alarms"`:
  - the flagged number equals the real-problems number plus the false-alarms number, and the real-problems number
    equals confirmed plus unresolved (read the numbers from the panel with `data-testid`s `summary-flagged`,
    `summary-problems`, `summary-confirmed`, `summary-unresolved`, `summary-cleared`);
  - the text "looked wrong, turned out fine (cleared)" is visible;
  - if the cleared number is above 0: focus the "Show which" button, press Enter, expect `aria-expanded="true"`,
    expect the list (`data-testid="summary-cleared-list"`) to have exactly that many `li`; then at
    `{ width: 390, height: 844 }` expect `document.documentElement.scrollWidth <= 391`; if it is 0, expect no
    "Show which" button.
  Run: `npm run test:e2e -- e2e/dashboard.spec.ts` — Expected: the two summary tests FAIL (new labels missing).

- [ ] **Step 6: Rebuild `components/map/summary-cards.tsx`** to the spec's layout, using `summaryOf`. Exact copy:

| Element | Text |
| --- | --- |
| Top line | `Flagged by our checks` + flagged |
| Group 1 title | `Real problems` + problems |
| Rows (red, amber dots via `REGISTER_STATUS`) | `Confirmed` / `the data proves it`; `Unresolved` / `fails a test, not yet proven` |
| Group 2 title (quieter style: muted text, no bold number size) | `False alarms ruled out` + cleared, green dot |
| Group 2 line | `looked wrong, turned out fine (cleared)` |
| Disclosure (only when `clearedFindings` is non-empty) | button `Show which` / `Hide list`; opens a `ul` of `clearedFindings` |

  Use `Collapsible` / `CollapsibleTrigger` / `CollapsibleContent` from `@/components/ui/collapsible` (as
  `app/executive/page.tsx` does), so the button carries `aria-expanded`. Long list text must wrap (`break-words`).
  Layout: one column at `@min-[52rem]` (beside the map, as today); between `@min-[22rem]` and `52rem` the two groups
  may sit side by side under the top line.

- [ ] **Step 7: Run the browser tests** — `npm run test:e2e -- e2e/dashboard.spec.ts`. Expected: PASS. Note in the
  report whether the fixture had cleared lines (so whether the disclosure branch ran).

- [ ] **Step 8: Docs.** `dashboard/README.md` line ~46: describe the summary as "real problems (confirmed,
  unresolved) and false alarms ruled out (cleared), with the cleared findings listed on demand". Append D-075 to
  `docs/DECISIONS.md` (controller writes it): professor feedback of 17 Nov; cleared means a ruled-out false alarm
  (RULES.md), so it sits beside real problems, not under confirmed; wording changes on `/executive`; no number
  changed.

- [ ] **Step 9: Lint and unit suite** — `npm run lint && npm test`. Expected: both pass. Stop; the user commits.

### Task 2: Executive view wording

**Files:**
- Modify: `dashboard/app/executive/page.tsx` (`ExecutiveSection`, lines 30–60; section titles, lines 74–103)
- Modify: `dashboard/components/executive/headline-tiles.tsx:95`
- Test: `dashboard/e2e/executive.spec.ts` (lines 74–77, 148, 221, plus one new test)
- Docs: `dashboard/README.md` (lines ~138, 149, 172), `docs/STATUS.md`

**Interfaces:**
- `ExecutiveSection({ id, title, intro, collapsible, children })` gains `intro: string` (required, every section
  has one). Renders `<p id={`${id}-intro`} className="text-sm text-muted-foreground">` right after the `h2`, outside
  `CollapsibleContent` so it shows while a section is closed; the `section` gets `aria-describedby={`${id}-intro`}`.
- Section ids stay the same (`leading-indicators`, `fix-first`, …) so links and anchors keep working.

- [ ] **Step 1: Update the browser tests first.** In `executive.spec.ts`: the `h2` list becomes
  `"Executive Metrics", "Early Warning Signs (Leading Indicators)", "KPIs by Office", "Worst Accounts",
  "What to Fix First", "Data Integrity Status"`; line 148's regex becomes `/^Early Warning Signs Triggered/`; line
  221's heading name becomes `"Early Warning Signs (Leading Indicators)"`. Add test
  `"every executive section says what it is for"`: for each section, the intro text in the table below is visible
  on page load, including Data Integrity Status before it is opened.
  Run: `npm run test:e2e -- e2e/executive.spec.ts` — Expected: FAIL on the new names and intros.

- [ ] **Step 2: Implement.** Titles and intros (exact copy from the spec):

| id | Title | Intro |
| --- | --- | --- |
| `executive-metrics` | Executive Metrics | How healthy our data is overall and in each data area, scored against its target. |
| `leading-indicators` | Early Warning Signs (Leading Indicators) | Signals that move before a problem reaches client accounts or the reconciliation. A triggered sign means: act now, before it becomes a break. |
| `office-kpis` | KPIs by Office | How each office (front, middle and back) is doing against its target. |
| `worst-accounts` | Worst Accounts | The client accounts with the lowest data quality scores: where errors are most likely to reach a client. |
| `fix-first` | What to Fix First | Where repair work pays off most: the checks with the lowest scores, or the problems with the largest dollar impact. |
| `trust` | Data Integrity Status | Can these numbers be trusted? The results of our stress test and our sensitivity check. |

  Tile title in `headline-tiles.tsx`: `Early Warning Signs Triggered`.

- [ ] **Step 3: Run** `npm run test:e2e -- e2e/executive.spec.ts` — Expected: PASS.

- [ ] **Step 4: Docs.** README: rename the two headings and the tile line, and add one sentence that each section
  opens with a line saying what it is for. `docs/STATUS.md` (controller writes it): new top entry dated 17 Nov —
  what changed, and **for the team: make the same changes in the slides** (the hierarchy on the Data Map slide and
  the two renamed headings).

- [ ] **Step 5: Full checks** (from the repo root unless noted):
  `tests/store_test.sh`; in `dashboard/`: `npm run lint`, `npm test`, `npm run test:e2e`;
  `uv run python scripts/check_docs.py`. Expected: all pass. No `build_store.py` run is needed (store unchanged).
  Stop; the user commits.
