# Calm Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dashboard readable by someone who has never seen our pipeline:
- a plain-language Trace page (headline, story picker, one-line steps)
- a layered map side panel
- a reviewed plain-wording file carried through the store
- the State Street logo
- a 2-second startup screen

**Architecture:** Plain wording lives in one hand-written JSON file. `scripts/build_store.py` copies it into
`outputs/store.duckdb` next to the register and map, and the dashboard reads it from there like every other fact.
Pure TypeScript helpers in `dashboard/lib/plain.ts` pick the headline, group stories and sum stages. The React
components only lay these out, with technical detail one click deeper. The startup screen is a client overlay built
with Motion; a pre-paint flag on `<html>` stops it from replaying or flashing.

**Tech Stack:** Python 3 + DuckDB (store builder), Next.js 16.4.2 / React 19.3 / Tailwind 4 / base-ui collapsible
(dashboard), vitest + Playwright, `motion@14.6.0`, Pillow (logo assets, already in `uv.lock`).

**Spec:** `docs/superpowers/specs/2026-11-06-calm-dashboard-design.md`. Read it before any task. Its "My calls"
section holds most of the decisions this plan applies.

## Global Constraints

- Branch `dashboard-calm-layout`. **No commits:** Kevin commits. Each task ends with a checkpoint listing the files to
  stage. New files under `dashboard/` need `git add -f` because `.git/info/exclude` hides them.
- Read `dashboard/AGENTS.md`. Before using an unfamiliar Next.js API (`next/image`, inline scripts in the root layout),
  read its guide in `dashboard/node_modules/next/dist/docs/`.
- The dashboard reads data only from the store (`scripts/build_store.py`). No finding wording or numbers are typed
  into React. Short UI labels (button text, section titles, step words) may live in code.
- D-001: nothing in this plan detects anything. Plain wording explains the register; it never adds or changes a
  status.
- Confirmed stays red (`bad`), unresolved stays amber (`warn`), cleared stays green (`ok`) everywhere (D-051).
- The "no finding" headline always carries: "Nothing in our register flags this record. That is not proof it is
  clean: some rules are not coded yet."
- Fixture IDs (`FXT…`, `FXSEC…`) may be named in dashboard tests. Release IDs never appear in code or tests (CLAUDE.md).
- `motion` is pinned exactly at `14.6.0` (`npm install --save-exact motion@14.6.0` inside `dashboard/`).
- Sidebar subtitle, exact text: "Prepared for State Street · Boston College case competition".
- Startup screen: about 2 s, once per browser session (sessionStorage key `dfe-boot-seen`), skipped by any click
  or key. Under `prefers-reduced-motion` it shows the static screen and fades out after 1.2 s. `role="status"`,
  text "Opening Data Flow Explorer", no focus trap.

## Review Focus

1. **A store built before this change** (no `plain` columns, no `plain_text` table) must still load. Findings fall
   back to their raw `finding` text and the page doesn't crash. Test in Task 2.
2. **A record whose only findings arrive through its account, security or holding** must lead with the lead-in
   ("Its security: …") and never read as a finding about the record itself. Tests in Task 2 (unit) and Task 3 (e2e,
   `FXT01`).
3. **A register stage the wording file doesn't list** (notebook 02 adds one) must still appear in the map overview
   and the picker, under its raw name, after the listed stages. The store build asserts listed stages for the
   current register, so this can only reach the dashboard through an older or hand-edited store. Test in Task 2.
4. **`sessionStorage` that throws** (private window, blocked site data) must not break the app. The startup screen
   shows, dismisses itself, and no page error is raised. e2e test in Task 6.
5. **A current record that is not one of the stories** (typed into search) must leave the picker on its placeholder
   ("Pick an example"), not on a wrong story. e2e test in Task 3.

---

### Task 1: Plain wording file into the store

**Files:**
- Create: `scripts/plain_language.json`
- Modify: `scripts/build_store.py` (`demo_traces` ~line 509, `main` ~548–630, the module docstring step 4)
- Modify: `scripts/check_docs.py` (new check, wired into `main`)
- Modify: `tests/store_test.sh` (new asserts in the Python block)
- Create: `tests/test_plain_language.py`

**Interfaces:**
- Produces: the store tables and columns that Task 2 reads:
  - `register.plain` (VARCHAR, never empty: wording or the raw `finding`)
  - `map_nodes.plain`, `map_edges.plain` (VARCHAR)
  - `demo_traces.stage` (VARCHAR)
  - `plain_text(kind VARCHAR, key VARCHAR, position BIGINT, text VARCHAR)`: `kind` is `status` (keys `confirmed`,
    `unresolved`, `cleared`, `none`), `lead_in` (key = an `id_kind`) or `stage` (key = stage name; `position` =
    flow order, from 1).
- Produces (Python, in `build_store.py`): `PLAIN: Path` and these functions:
  - `load_plain() -> dict`
  - `check_plain(plain: dict, graph: dict = GRAPH) -> None` (AssertionError on a gap)
  - `plain_finding(plain: dict, finding: str) -> str`
  - `unworded(plain: dict, register: list[dict]) -> list[str]`
  - `plain_rows(plain: dict) -> list[dict]`
- Produces (Python, in `check_docs.py`): `check_plain_language() -> list[str]`

**JSON shape** (`scripts/plain_language.json`):

```json
{
  "status":  {"confirmed": "…", "unresolved": "…", "cleared": "…", "none": "…"},
  "lead_in": {"transaction_id": "…", "account_id": "Its account: ", "security_id": "Its security: ",
              "account/security": "Its holding (account + security): ", "action_id": "…", "ledger_id": "…",
              "currency": "Its currency: "},
  "stages":  [{"stage": "worked example", "label": "…"}, {"stage": "master data", "label": "…"}, …],
  "findings": {"<exact register finding text>": "<one neutral sentence>", …},
  "nodes":   {"<GRAPH node id>": "<one sentence on what this table is>", …},
  "edges":   {"<GRAPH edge id>": "<one sentence on what this join or check does>", …}
}
```

**Stage order:** worked example, master data, trade capture, pipeline, corporate actions, positions, pricing, NAV.
This is the map's left-to-right flow. `worked example` is the stage `demo_traces` gives the evidenced Check-in 2 trace.

**Status phrases:**
- `confirmed`: "Confirmed: the data proves it."
- `unresolved`: "Unresolved: it looks wrong, but the data alone cannot prove it."
- `cleared`: "Cleared: it looked wrong, but it checks out."
- `none`: the sentence in Global Constraints.

**Wording rules** for each finding sentence. The team reviews these:
- Describe the problem itself, never "this record" or "some records".
- No column names (say "settlement date", not `settlement_date`). Explain any trade term in passing. At most 25
  words.
- Never say more than the status allows: an unresolved finding is "looks", "may" or "cannot tell", never "is wrong".
- Examples:
  - `Negative trade quantity` → "The trade records a negative number of units, which a trade quantity should never be."
  - `Book and custodian count duplicate copies as trades` → "The book and the custodian both count copied rows as
    extra trades."
  - `Held security with no price at all` → "We hold a security that no price vendor priced."
- **Node and edge sentences:** for the six handoff edges, start from `scripts/framework.json` `checks[].tests`,
  rewritten in the same plain style.

**Findings to word:**
- every finding in `outputs/02_defect_register.csv` (39)
- `Custodian differs from both the book and the trades (custodian on settlement-date basis)` (fixture)
- `Book differs from both the custodian and the trades (unexplained)` (settlement-config variant)

- [ ] **Step 1: Write the failing tests** in `tests/test_plain_language.py` (unittest, `sys.path` set up as in
  `tests/test_check_docs.py`):

```python
def test_every_graph_node_and_edge_is_worded(self):
    build_store.check_plain(build_store.load_plain())              # no AssertionError

def test_a_missing_node_fails_the_check(self):
    plain = build_store.load_plain(); del plain['nodes']['transactions']
    with self.assertRaises(AssertionError): build_store.check_plain(plain)

def test_a_stale_edge_entry_fails_the_check(self):
    plain = build_store.load_plain(); plain['edges']['no_such_edge'] = 'x'
    with self.assertRaises(AssertionError): build_store.check_plain(plain)

def test_an_unworded_finding_falls_back_to_its_register_text(self):
    plain = build_store.load_plain()
    self.assertEqual(build_store.plain_finding(plain, 'A finding nobody worded'), 'A finding nobody worded')
    self.assertEqual(build_store.unworded(plain, [{'finding': 'A finding nobody worded'},
                                                  {'finding': 'Negative trade quantity'}]),
                     ['A finding nobody worded'])

def test_status_phrases_and_stage_order_reach_the_store_rows(self):
    rows = build_store.plain_rows(build_store.load_plain())
    self.assertEqual({r['key'] for r in rows if r['kind'] == 'status'}, {'confirmed', 'unresolved', 'cleared', 'none'})
    stages = sorted((r for r in rows if r['kind'] == 'stage'), key=lambda r: r['position'])
    self.assertEqual([r['key'] for r in stages][:3], ['worked example', 'master data', 'trade capture'])
    self.assertIn('not proof it is clean', next(r['text'] for r in rows if r['key'] == 'none'))

def test_release_register_is_fully_worded(self):
    # skipped when outputs/ is not built on this machine
    register = ROOT / 'outputs' / '02_defect_register.csv'
    if not register.exists(): self.skipTest('outputs not built')
    self.assertEqual(check_docs.check_plain_language(), [])
```

- [ ] **Step 2: Run them to see them fail**
  - Run: `uv run python -m unittest tests/test_plain_language.py -v`
  - Expected: FAIL. `build_store` has no attribute `load_plain`.

- [ ] **Step 3: Write `scripts/plain_language.json`.** Use the shape, stage order, status phrases and wording rules
  above. Generate the list of finding keys from the registers; don't retype them:
  `uv run python -c "import csv,glob; print(sorted({r['finding'] for f in ['outputs/02_defect_register.csv', *glob.glob('tests/runs/*/02_defect_register.csv')] for r in csv.DictReader(open(f))}))"`

- [ ] **Step 4: Implement the five functions in `scripts/build_store.py`** and wire them into `main`:
  - `check_plain`:
    - asserts the `nodes` keys equal the GRAPH node ids and the `edges` keys equal the GRAPH edge ids
    - asserts `status` has exactly the four keys
    - asserts `lead_in` covers `TRACEABLE | {'currency'}`
    - asserts every `stages` entry has `stage` and `label`
  - `main` calls `check_plain(load_plain())` right after `check_graph`.
  - After `read_register()`, assert that every register `stage` is in `plain['stages']`. Print
    `  plain wording missing for: [...]` when `unworded()` returns anything, then fall back.
  - Add a `plain` column to the `register`, `map_nodes` and `map_edges` rows and their column lists. Write the
    `plain_text` table with explicit columns, so a build with no register still creates it.
  - `demo_traces(register)` adds `stage`: `'worked example'` for the `02_trace.csv` record, `line['stage']` for the
    others. Add `'stage'` to its column list.
  - Update the docstring's step 4 to mention the wording file.

- [ ] **Step 5: Implement `check_plain_language()` in `scripts/check_docs.py`** and add it to `main`'s `problems`.
  - Returns one problem per release-register finding with no wording, worded as:
    `scripts/plain_language.json has no wording for "<finding>"`.
  - Prints `note: unused wording for "<finding>"` for findings that match no finding in the release register or any
    register under `tests/runs/`. Those are warnings, not problems.
  - Returns `[]`, with a note, when `outputs/` isn't built.

- [ ] **Step 6: Add store asserts to `tests/store_test.sh`** (main Python block). Every register line has a `plain`
  value; the `Negative trade quantity` line's `plain` differs from its finding text; `map_nodes` and `map_edges` have
  no empty `plain`; `plain_text` has 4 `status` rows; `demo_traces` has no empty `stage`. In the no-register block,
  assert `plain_text` still has its `status` rows.

- [ ] **Step 7: Run the checks**
  - `uv run python -m unittest tests/test_plain_language.py tests/test_check_docs.py -v`: all PASS.
  - `uv run python scripts/build_store.py`: no "plain wording missing" line.
  - `tests/store_test.sh`: ends with `next build OK`.
  - `uv run python scripts/check_docs.py`: `docs check passed`.

- [ ] **Step 8: Checkpoint for Kevin.**
  - Stage: `scripts/plain_language.json`, `scripts/build_store.py`, `scripts/check_docs.py`, `tests/store_test.sh`,
    `tests/test_plain_language.py`.
  - Ask the team to review the wording, one teammate per stage.

---

### Task 2: Dashboard reads the wording; pure helpers

**Files:**
- Modify: `dashboard/lib/types.ts`, `dashboard/lib/store.ts`, `dashboard/lib/status.ts`
- Create: `dashboard/lib/plain.ts`
- Create: `dashboard/tests/plain.test.ts`
- Modify: `dashboard/tests/store.test.ts`

**Interfaces:**
- Consumes: Task 1's store tables and columns.
- Produces (`types.ts`):
  - `export type PlainStatus = "confirmed" | "unresolved" | "cleared" | "none"`
  - `export type PlainText = { status: Record<PlainStatus, string>; leadIn: Record<string, string>; stages: { stage: string; label: string }[] }`
  - `plain: string` added to `RegisterLine`, `RegisterMark`, `MapNode` and `MapEdge`
  - `stage: string` added to `DemoTrace`
  - `plain: PlainText` added to `MapData`
- Produces (`status.ts`):
  - `export type Tone`
  - a `short` label on each `HOP_STATUS` entry: ok `found`, fan_out `more than expected`, missing `missing`,
    info `for context`, not_reached `not reached`
- Produces (`plain.ts`):
  - `findingText(mark: RegisterMark, query: string, plain: PlainText): string`: the lead-in for `mark.idKind`
    when `mark.recordId !== query`, then `mark.plain || mark.finding`
  - `export type Headline = { status: PlainStatus; text: string; phrase: string; more: number }`
  - `traceHeadline(query: string, marks: RegisterMark[], plain: PlainText): Headline`
  - `export type StageLine = { stage: string; label: string; counts: Counts; lines: RegisterLine[] }`
  - `stageLines(register: RegisterLine[], plain: PlainText): StageLine[]`
  - `export type StoryGroup = { stage: string; label: string; stories: DemoTrace[] }`
  - `storyGroups(demos: DemoTrace[], plain: PlainText): StoryGroup[]`
  - `countsTone(counts: Counts): Tone | null` returns `bad` if any confirmed, else `warn` if any unresolved, else
    `ok` if any cleared, else `null`

**Headline rule:**
- The lead mark is the first one after sorting by: direct (`recordId === query`) before indirect, then confirmed <
  unresolved < cleared, then the lowest `line`.
- `text = findingText(lead)`, `phrase = plain.status[lead.status]`, and `more` = distinct `line`s minus 1.
- With no marks: `{ status: "none", text: plain.status.none, phrase: "", more: 0 }`.

**Grouping rule** (`stageLines` and `storyGroups`):
- Groups follow `plain.stages` order and skip stages that have nothing in them.
- Stages missing from `plain.stages` come after, labelled with their raw name, in order of first appearance.

- [ ] **Step 1: Write failing unit tests** in `dashboard/tests/plain.test.ts`. They are pure, with hand-built marks
  and a hand-built `PlainText`:
  - `"a record's own confirmed finding leads the headline over an indirect one"`: two marks, one indirect
    confirmed at line 1 and one direct unresolved at line 5. `headline.text` is the direct one's plain sentence,
    `status` is `"unresolved"`, `more` is 1.
  - `"an indirect-only finding carries its lead-in"`: one mark with `recordId: "SEC1"`, `idKind: "security_id"`,
    and query `"TXN1"`. `text` starts with `plain.leadIn.security_id`.
  - `"no marks keep the honesty caveat"`: `traceHeadline("TXN1", [], plain).text === plain.status.none`.
  - `"two examples of one line count as one finding"`: two marks on the same `line` give `more === 0`.
  - `"a finding with no wording shows its register text"`: `mark.plain === ""` → `findingText` returns `mark.finding`.
  - `"stages follow the flow and an unknown stage comes last under its own name"`: register lines on `positions`,
    `master data` and `"new stage"` give labels in the order master data, positions, `"new stage"`.
  - `"stage counts and tone come from the register statuses"`: 1 confirmed + 2 unresolved → `counts` is
    `{confirmed: 1, unresolved: 2, cleared: 0}` and `countsTone` is `"bad"`.
  - `"stories group by stage with the worked example first"`.
- [ ] **Step 2: Add a failing store test** to `dashboard/tests/store.test.ts` under `describe("store freshness")`:
  - `"a store from before the plain wording still loads, with register text as its wording"`
  - Copy the fixture store as the existing "no register path" test does. Drop `register.plain`, `map_nodes.plain`
    and `map_edges.plain`, then `DROP TABLE plain_text`.
  - `getMapData()` resolves, and every `register[i].plain === register[i].finding`.
  - `traceRecord("FXT03")` resolves, with `marks[0].plain === marks[0].finding`.
- [ ] **Step 3: Add a store test:**
  - `"the fixture store carries wording, stage order and story stages"`
  - `map.plain.status.none` contains `"not proof it is clean"`.
  - `map.plain.stages[0].stage === "worked example"`.
  - The `Negative trade quantity` register line's `plain` differs from its `finding`.
  - Every `getDemoTraces()` item has a non-empty `stage`.
- [ ] **Step 4: Run them to see them fail**
  - Run, inside `dashboard/`: `npm test`
  - Expected: FAIL. `@/lib/plain` doesn't exist, and `plain` is undefined.
- [ ] **Step 5: Implement.**
  - `store.ts` adds a `hasColumn(con, table, column): Promise<boolean>` helper (via `information_schema.columns`)
    and a `hasTable` check like the existing `register_members` check.
  - `getMapData` reads `plain_text` into `PlainText`. An older store gets empty phrases and an empty `stages` list.
  - Every `plain` field falls back:
    - register and marks: `text(r.plain) || text(r.finding)`
    - nodes and edges: `text(r.plain)`
  - The marks query selects `r.plain` only when the column exists.
  - `getDemoTraces` reads `stage` (`""` when absent).
  - Then implement `plain.ts`, reusing `Counts` from `lib/findings.ts`.
- [ ] **Step 6: Run the checks**
  - Inside `dashboard/`: `npm test` passes.
  - `npx tsc --noEmit` is clean. The UI still compiles, because the new fields are only added.
- [ ] **Step 7: Checkpoint for Kevin.**
  - Stage: `dashboard/lib/types.ts`, `store.ts`, `status.ts`, `plain.ts` (`-f`), `dashboard/tests/plain.test.ts`
    (`-f`), `dashboard/tests/store.test.ts`.

---

### Task 3: Trace page — picker, headline, one-line steps, Technical details

**Files:**
- Modify: `dashboard/components/trace/trace-view.tsx`, `dashboard/components/trace/timeline-step.tsx`
- Modify: `dashboard/e2e/dashboard.spec.ts`

**Interfaces:**
- Consumes: from Task 2, `traceHeadline`, `findingText`, `storyGroups`, `HOP_STATUS[s].short` and `map.plain`.
- Produces: `TimelineStep` props become
  `{ hop: Hop; findings: RegisterMark[]; step: number; place: string; last: boolean; query: string; plain: PlainText }`.

**Layout, top to bottom:**
1. The title row. It keeps today's heading and search box (`aria-label="Record ID"`, unchanged placeholder).
2. **Story picker:**
   - A native `<select>` with label "Pick an example" (`aria-label`), one `<optgroup label={group.label}>` per
     `StoryGroup`, and option text `"{label} · {recordId}"`.
   - A first disabled option "Pick an example" is selected whenever `query` isn't a story ID.
   - On change it goes to `/trace?id=…` via `router.push` in a transition, like `TraceSearch`.
   - It replaces the chips, `STORY_PREVIEW` and the `allStories` state.
3. **Headline card** (only when `trace.found`):
   - The record ID in mono with its kind.
   - `headline.text` as a sentence in the tone of `headline.status`, using `REGISTER_STATUS`; `none` uses `info`.
   - `headline.phrase`, then `" and {more} more finding(s)"` when `more > 0`.
   - The trail pill stays: "Trail breaks at: …" or "Required record links found".
4. **"Technical details"** (`Collapsible`, closed by default, trigger text exactly "Technical details") holds
   everything else that `TraceSummary` shows today, unchanged: the more-rows pill, the finding-count pills, the
   steps and rows-touched count, the register lines with rule ID, line and via, the "Record links:" legend, and
   both caveat paragraphs.
5. The map and steps grid, unchanged apart from the step rows.

**Step row (`TimelineStep`):**
- The header is one line: the step number ring (unchanged colours), `hop.title`, the coloured dot, and
  `HOP_STATUS[hop.status].short`. The full `HOP_STATUS` label goes in its `title` attribute.
- `open` starts as `findings.length > 0`. Clicking the header toggles it.
- Open content, in order: `place` · `via` · `note` · "{n} rows, {expected}". Then each finding as
  `RegisterStatus` + `findingText(...)`, with its `exampleEvidence` lines under a small "Evidence" label. Then a
  "Show the raw rows" button that toggles today's table, closed by default.
- Keep `id="trace-step-{hop.id}"` and `data-hop-table`.

- [ ] **Step 1: Update the e2e tests to the new layout first.** They should fail on the old page:
  - **"confirmed quantity error…" (FXT03):**
    - `#trace-step-transaction` contains the plain sentence for `Negative trade quantity` (read it from
      `scripts/plain_language.json` at the top of the spec with `fs`) and `quantity = -50`.
    - The step's short word is `found`.
    - The node tone checks are unchanged.
    - After clicking "Technical details", `/not a complete assessment/` is visible.
  - **"legends…":** on `/trace?id=FXT01`, click "Technical details" before the "Record links:" check. The map half
    of this test moves to Task 4.
  - **Replace "expanded stories survive…" with "the story picker groups stories and navigates; draft and timeline
    reset per record":**
    - Options sit inside `optgroup`s (count > 1).
    - `selectOption` for the FXT02 story sets the Record ID box to `FXT02`.
    - A typed but unsubmitted draft is gone after choosing.
    - A step closed by hand on FXT03 is open again on return.
  - **New "a typed record that is not a story leaves the picker on its placeholder" (Review Focus 5):** search
    `FXACC2/FXSEC1`; the picker's value is `""` and its selected text is "Pick an example".
  - **New "a finding that reaches a trade through its security says so" (Review Focus 2):** `/trace?id=FXT01`;
    the page shows text starting with the `security_id` lead-in from `scripts/plain_language.json`.
  - **"narrow screen" test:** unchanged. It must still pass, and the picker must be visible at width 390.
- [ ] **Step 2: Run them to see them fail**
  - Run, inside `dashboard/`: `npm run test:e2e`
  - Expected: the updated and new trace tests FAIL. The others PASS.
- [ ] **Step 3: Implement `trace-view.tsx` and `timeline-step.tsx`** as laid out above.
- [ ] **Step 4: Run the checks**
  - Inside `dashboard/`: `npm test && npm run test:e2e && npm run lint`, all PASS.
- [ ] **Step 5: Look at it.**
  - Run `npm run dev` and open `/trace?id=` with a confirmed, an unresolved and a no-finding record from the
    release picker.
  - Check: the headline is plain, only the finding steps are open, and Technical details shows the rule ID and line.
  - Also open the Check-in 2 duplicate story (`TXN100002453`): its holding-level finding reads
    "Its holding (account + security): …", and the headline leads with its own duplicate finding. This is a manual check only; release IDs
    stay out of tests.
- [ ] **Step 6: Checkpoint for Kevin.**
  - Stage: `dashboard/components/trace/*.tsx`, `dashboard/e2e/dashboard.spec.ts`.

---

### Task 4: Map side panel — stage overview and layered details

**Files:**
- Modify: `dashboard/components/map/details-panel.tsx`
- Modify: `dashboard/e2e/dashboard.spec.ts`

**Interfaces:**
- Consumes: from Task 2, `stageLines`, `countsTone`, `map.plain`, `node.plain` and `edge.plain`. Also `countsFor`
  and `Collapsible`.
- Produces: an internal `Fold({ title, children, defaultOpen? })`: a `Collapsible` whose trigger is the existing
  uppercase section style plus a chevron.

**Overview** (nothing selected):
- The heading "How data moves, and where it breaks".
- One line: "Follow left to right. Blue numbers are our checks. Click anything for details."
- One button per `StageLine`. Each shows a `Dot` in `countsTone` and the stage label, plus counts on the right
  ("6 confirmed · 2 unresolved · 1 cleared", leaving out zero parts).
- Clicking a stage expands it in place (`aria-expanded`) to list its lines. Each line shows `RegisterStatus` and its
  `plain` text, then two links:
  - "Show on map": `onSelect({ kind: line.mapKind, id: line.mapId })`
  - "Trace an example": `/trace?id={first example}`, shown only when `line.examples` has one
- Then `Fold`s: "All checks" (today's flow-order `JoinRow`s), "Other joins", "Register rules not on the map" (only
  if there are any), "What the colours mean" (today's legend), and the `Note`.

**Node and edge details:**
- Today's place, title and id lines, then `node.plain` / `edge.plain` as a normal-size sentence.
- One counts line from `countsFor`.
- Then `Fold`s:
  - "What we found": the register lines on this place, same row format as above; omitted when there are none
  - "Who owns this": today's `Ownership` for nodes; owner, office and route for edges
  - "Raw key counts (technical)": node Rows metrics; edge Expected plus the `SideCard`s
  - "Rules (technical)": today's `RulesList`
  - "Columns": node only, as today
- All folds start closed except "What we found".

- [ ] **Step 1: Update and add e2e tests** (they should fail on the old panel):
  - **"data map supports table details…":** after clicking the `transactions` node, open "Who owns this" before
    expecting `FIXTURE_OMS`. The rest is unchanged.
  - **"legends…" map half:** open "What the colours mean", then expect `Blank keys`.
  - **New "the map panel opens with the stages and folds the rest":**
    - On `/`, a button per stage is visible, the first labelled with the `master data` label from
      `scripts/plain_language.json`.
    - The text `Other joins` is visible, but no `JoinRow` button for `booked` is.
    - Clicking the trade capture stage reveals its lines. Clicking its "Show on map" link shows the `Transactions`
      heading.
- [ ] **Step 2: Run them to see them fail**
  - Run, inside `dashboard/`: `npm run test:e2e`
  - Expected: the three map tests FAIL.
- [ ] **Step 3: Implement `details-panel.tsx`** as laid out above.
- [ ] **Step 4: Run the checks**
  - Inside `dashboard/`: `npm test && npm run test:e2e && npm run lint`, all PASS.
- [ ] **Step 5: Look at it** on the release store:
  - the opening view fits on one laptop screen
  - the stage counts add up to the summary cards' totals
  - clicking Trade check shows its sentence first
- [ ] **Step 6: Checkpoint for Kevin.**
  - Stage: `dashboard/components/map/details-panel.tsx`, `dashboard/e2e/dashboard.spec.ts`.

---

### Task 5: State Street logo

**Files:**
- Create: `dashboard/brand/state-street-logo-source.png`, a copy of Kevin's PNG from
  `/private/tmp/claude-501/-Users-oansen-code-projects-State-Street-Case-Competition-State-Street-Case-Student-Package/9470b172-c3bf-47f2-aaed-509641369205/images/1.png`.
  The `brand/` folder is not served.
- Create: `scripts/build_logo.py`, `tests/test_build_logo.py`
- Create (generated): `dashboard/public/brand/state-street-blue.png`, `dashboard/public/brand/state-street-white.png`
- Create: `dashboard/components/shell/brand-logo.tsx`
- Modify: `dashboard/components/shell/app-sidebar.tsx`, `dashboard/app/layout.tsx`, `dashboard/e2e/dashboard.spec.ts`

**Interfaces:**
- Produces:
  - `scripts/build_logo.py`: `make_logo(source: Path, color: tuple[int, int, int]) -> PIL.Image.Image` (RGBA).
    `main()` writes both PNGs.
  - `brand-logo.tsx`: `BrandLogo({ className }: { className?: string })`, which renders the blue image with
    `dark:hidden` and the white one with `hidden dark:block` via `next/image`, `alt="State Street"`.
  - `HeaderLogo()`: a client component that renders `BrandLogo` only when `useShell().menuOpen` is false.

**Algorithm** (the source is pure white plus the brand blue `#001aff` plus anti-aliased edges): for each pixel,
`alpha = 255 - R` (red is 255 on white and 0 on the blue), and the output pixel is `(*color, alpha)`. Blue variant:
`color=(0, 26, 255)`. White variant: `color=(255, 255, 255)`.

- [ ] **Step 1: Write the failing test** `tests/test_build_logo.py`:
  - `make_logo(SOURCE, (0, 26, 255))` keeps the source size.
  - Pixel `(0, 0)` has alpha 0.
  - The most common opaque pixel is `(0, 26, 255, 255)`.
  - The white variant's most common opaque pixel is `(255, 255, 255, 255)`.
- [ ] **Step 2: Run it to see it fail**
  - Run: `uv run python -m unittest tests/test_build_logo.py -v`
  - Expected: FAIL (no module `build_logo`).
- [ ] **Step 3: Build the logo files**
  - Copy the source PNG in, then implement `scripts/build_logo.py`.
  - Run `uv run python scripts/build_logo.py`; it writes both PNGs.
  - Rerun the test: PASS.
- [ ] **Step 4: Add an e2e test:** "the State Street logo shows in the menu and moves to the top bar when the menu
  is hidden".
  - `getByRole("img", { name: "State Street" })` is visible in the sidebar.
  - After "Hide the menu", one is visible in the `header`.
  - In dark theme, the visible one has `src` containing `white`.
- [ ] **Step 5: Implement the sidebar and header.**
  - `app-sidebar.tsx`: the header shows `BrandLogo` (about 22 px high), then "Data Flow Explorer" (semibold), then
    the exact subtitle from Global Constraints. Remove the `Workflow` icon block.
  - `layout.tsx`: put `<HeaderLogo />` right after `<MenuToggle />`.
- [ ] **Step 6: Run the checks**
  - Inside `dashboard/`: `npm run test:e2e && npm run lint`, PASS.
  - By eye: the logo looks right in light and dark mode.
- [ ] **Step 7: Checkpoint for Kevin.**
  - Stage `-f`: `dashboard/brand/`, `dashboard/public/brand/`, `dashboard/components/shell/brand-logo.tsx`.
  - Stage normally: `scripts/build_logo.py`, `tests/test_build_logo.py`, `app-sidebar.tsx`, `layout.tsx`,
    `e2e/dashboard.spec.ts`.

---

### Task 6: Startup screen

**Files:**
- Modify: `dashboard/package.json`, `package-lock.json` (`npm install --save-exact motion@14.6.0`)
- Create: `dashboard/components/shell/boot-screen.tsx`
- Modify: `dashboard/app/layout.tsx`, `dashboard/app/globals.css`, `dashboard/e2e/dashboard.spec.ts`

**Interfaces:**
- Consumes: `BrandLogo` from Task 5.
- Produces (in `boot-screen.tsx`):
  - `export const BOOT_KEY = "dfe-boot-seen"`
  - `export const BOOT_FLAG_SCRIPT: string`: inline JS that sets `document.documentElement.dataset.booted = "1"`
    when `sessionStorage.getItem(BOOT_KEY)`, inside try/catch
  - `export function BootScreen(): JSX.Element`

**Behaviour:**
- **Server render:** the overlay renders on the server (`data-boot-screen`, `fixed inset-0 z-50 bg-background`).
  `globals.css` adds `html[data-booted] [data-boot-screen] { display: none; }`. `layout.tsx` puts `BOOT_FLAG_SCRIPT`
  in `<head>` so it runs before first paint. Read the Next 16 docs for the supported way to put an inline script in
  the root layout.
- **On mount:**
  - If `dataset.booted` is set, render nothing.
  - Otherwise play the animation:
    - 0–0.3 s: logo opacity 0→1 and y 10→0
    - 0.35–0.6 s: "Data Flow Explorer" and the subtitle fade in
    - 0.5–1.6 s: a thin `bg-brand` bar fills 0→100%
    - at 2.0 s: exit, a 300 ms opacity fade through `AnimatePresence`
- **Click or any `keydown`:** exit straight away.
- **On exit:** set `sessionStorage[BOOT_KEY] = "1"` (try/catch) and set `dataset.booted`, so client navigation never
  shows it again.
- **Reduced motion (`useReducedMotion()`):** no movement and no bar animation; static content, then exit at 1.2 s.
- **Content:** `BrandLogo`, "Data Flow Explorer", the Global Constraints subtitle, `role="status"`, and the
  visually-hidden text "Opening Data Flow Explorer". No focus trap.

- [ ] **Step 1: Write the e2e tests first.**
  - In `beforeEach`, add `await page.addInitScript(() => sessionStorage.setItem("dfe-boot-seen", "1"))` so the
    existing tests skip the screen.
  - New test "the startup screen plays once, skips on a key, and does not return":
    - Use a fresh `browser.newContext()` and page.
    - Visit `/`; `[data-boot-screen]` is visible.
    - Press `Escape`; it becomes hidden within 1 s.
    - Visit `/trace`; it isn't visible.
    - Close the context.
  - New test "the startup screen survives blocked sessionStorage" (Review Focus 4):
    - Use a fresh context with an init script that makes `sessionStorage.getItem` and `setItem` throw.
    - Visit `/`; the screen hides by itself within 3 s.
    - The heading "How data moves through the platform" is visible.
    - No `pageerror`.
- [ ] **Step 2: Run them to see them fail**
  - Run, inside `dashboard/`: `npm run test:e2e`
  - Expected: the two new tests FAIL (no `[data-boot-screen]`).
- [ ] **Step 3: Install and implement.** Run `npm install --save-exact motion@14.6.0`, then write
  `boot-screen.tsx`, the CSS rule and the layout changes.
- [ ] **Step 4: Run the checks**
  - Inside `dashboard/`: `npm test && npm run test:e2e && npm run lint && npm run build`, all PASS.
- [ ] **Step 5: Check it by hand.**
  - In a fresh private window, it plays once with no flash of the dashboard before it.
  - Reloading doesn't replay it.
  - With macOS Reduce Motion on, it doesn't animate.
  - In dark mode it shows the white logo on a dark background.
- [ ] **Step 6: Checkpoint for Kevin.**
  - Stage: `dashboard/package.json`, `package-lock.json`, `boot-screen.tsx` (`-f`), `layout.tsx`, `globals.css`,
    `e2e/dashboard.spec.ts`.

---

### Task 7: Docs and full verification

**Files:**
- Modify: `docs/DECISIONS.md`: append `D-058 · 6 Nov · Dashboard for a non-technical reader: calm layout, plain
  wording file, logo and startup screen`. Never edit old entries.
- Modify: `docs/STATUS.md`: the date line, plus a "Where we are" bullet.
- Modify: `dashboard/README.md`: the wording file, how to rebuild the logo, the startup screen and its session key.
- Modify: the spec's "Verification" if anything changed while building.

**What D-058 records:**
- The layout choices: the calm list, the layered panel, everything technical one click deeper.
- The wording file and how coverage works: fallback with a warning in the build, a check in `check_docs.py`, asserts
  for nodes and edges.
- The headline rule: direct before indirect, then by status, then by line.
- The lead-ins.
- Why "unresolved" sentences say "looks" or "may".
- The subtitle wording, which avoids presenting this as a State Street product (brief: synthetic data).
- That the startup screen is decoration and claims no progress.
- Rejected options: the guided walkthrough, the map tour, and the preflight and story startup screens.

**STATUS.md bullet:**
- Calm layout done on branch `dashboard-calm-layout`.
- The team should review the wording in `scripts/plain_language.json`, one teammate per stage.
- Next brainstorms: the summary assistant (piece 3) and how we hand in the dashboard (piece 4).

- [ ] **Step 1: Write the three docs.**
- [ ] **Step 2: Run the full check list** from the repo root:
  - `uv run python scripts/build_store.py` (release store, no wording warnings)
  - `tests/store_test.sh`
  - `uv run python -m unittest tests/test_plain_language.py tests/test_build_logo.py tests/test_check_docs.py -v`
  - inside `dashboard/`: `npm test`, `npm run test:e2e`, `npm run lint`
  - `uv run python scripts/check_docs.py`

  Expected: every command passes. `check_docs` prints `docs check passed`.
- [ ] **Step 3: Check the spec's Verification by hand.** Do the "remove one wording entry" checks:
  - First copy `scripts/plain_language.json` to the scratchpad.
  - Delete one finding entry: the build warns and falls back, and `check_docs.py` fails.
  - Delete one node entry: the build fails.
  - Restore the file from the copy, then rebuild the store.
- [ ] **Step 4: Checkpoint for Kevin.**
  - Stage the three docs, plus `docs/superpowers/specs/…` and `docs/superpowers/plans/…`.
  - Hand over: what changed, the wording for the team to review, and the next two brainstorms.
