# Calmer Trace page and map panel, State Street logo, startup screen (dashboard polish)

Design written 6 Nov 2026 from a brainstorm with Kevin. When plan mode ends, copy this file to
`docs/superpowers/specs/2026-11-06-calm-dashboard-design.md` on the new branch. Kevin commits it.

## Context and why

The dashboard (`dashboard/`, Next.js, D-054) is accurate but shows too much at once. Kevin: the Trace page "seems a
bit bloaty"; the map's right-hand panel should be cleaner and reveal more "click by click". The professor's guidance
for the final presentation applies here as well: *non-technical people should be able to follow; do not assume State Street
people know the data or pipeline as well as we do.* Check-in 1 feedback said the same: tell a story, with good visuals.

**Success:** someone from State Street who has never seen our pipeline opens a record or the map and understands
what is wrong, and how sure we are, without one of us explaining. Every technical detail that exists today is still
reachable, just one click deeper.

This is pieces 1 and 2 of four. Pieces 3 (a summary / AI explainer) and 4 (how we hand in the dashboard) come
later as separate brainstorms. Leave room for a summary area, but don't build one.

## Goals

- Trace page: a plain-language headline first, one compact story picker, steps as one-line rows with only the
  problem steps open, and technical material behind a "Technical details" link.
- Map side panel: a short overview (the seven register stages, one line each), folded sections, and a
  plain-sentence-first details view when a place on the map is clicked.
- Plain-English wording for every register finding, stage and map place, kept in one reviewed text file that
  flows through the store.
- The State Street logo at the top of the app, and a short startup screen before the dashboard. Kevin knows neither
  is required; they're there to make it feel like a finished product.

## Non-goals

- No change to the graph itself (Kevin likes it) or the map page's summary cards. The header gains only the small
  logo described below.
- No new detection, no new numbers, no change to notebook 02 or the register.
- No guided tour or step-by-step "Next" walkthrough (considered and turned down in favour of the calm list and
  the layered panel).
- No AI. No summary tab yet (piece 3).

## Anti-goals (would be a failure even if it works)

- Hiding or softening a finding: confirmed stays red, unresolved stays amber, cleared stays as today (D-051).
- Losing the honesty caveat. A record with no badge must never read as "clean".
- Typing numbers or wording into React code. Wording comes from the store; numbers come from the register.
- Plain wording that claims more than the register does (for example calling an unresolved finding an error).

## Constraints

- Dashboard data comes only from `outputs/store.duckdb`, written by `scripts/build_store.py` (CLAUDE.md).
- D-001: detection is rule-based. Plain wording is explanation, which is allowed.
- Read `dashboard/AGENTS.md` before writing Next.js code (non-standard Next.js version).
- Never deploy; the store holds raw data.
- Work on a new branch (Kevin asked). Branch: `dashboard-calm-layout` (`dashboard/…` is blocked by the existing `dashboard` branch). Kevin commits himself
  (memory: superpowers workflow). New files under `dashboard/` are hidden by `.git/info/exclude`, so add them with
  `git add -f` (memory: dashboard branch).

## What Kevin decided

### Trace page (chosen: "calm list", mockup B)

1. **Story picker.** One "Pick an example" control replaces the 34 story chips (`trace-view.tsx`, `STORY_PREVIEW`).
   It groups stories by register stage and shows each story's status dot and label. The ID search box stays
   beside it.
2. **Headline.** Directly under the picker: one or two plain sentences saying what is wrong with this record and
   how sure we are, in words ("confirmed wrong; the correct value is still open"), not rule codes.
3. **Map.** The whole trail lights up at once, as today.
4. **Steps.** Each step is one line: number, title, coloured dot, and a short word ("found", "missing", "more than
   expected", "for context", "not reached"). Steps that carry a finding open by default and show the finding in
   plain words plus a "Show the raw rows" link. All other steps open on click.
5. **Technical details.** Rule IDs, register line numbers, the "via" record, the colour legend, the rows-touched
   count and the long caveat all move behind one "Technical details" link. Nothing is deleted.

### Map side panel (chosen: "layered panel", mockup A)

1. **Nothing selected:**
   - A title and one line on how to read the map.
   - The seven register stages in flow order (trade capture, pipeline, master data, corporate actions, positions,
     pricing, NAV), one line each. Each line has a dot in its worst status colour and counts such as
     "6 confirmed · 2 open".
   - Folded sections: "All checks", "Other joins", "Register rules not on the map" (only when there are any),
     "What the colours mean", and the note.
2. **A node or edge clicked:**
   - Its place, its name, and one plain sentence on what it does.
   - One line of finding counts.
   - Folded sections: "What we found" (each finding in plain words, its status, and a "Trace an example" link to
     `/trace?id=…`), "Who owns this" (today's ownership block), "Raw key counts (technical)" (today's side cards and
     metrics) and "Columns" (today's column list).

### State Street logo

- Kevin supplied the logo as a PNG pasted into the chat: 738×201, blue on white, no transparency. Its session copy
  is `/private/tmp/claude-501/-Users-oansen-code-projects-State-Street-Case-Competition-State-Street-Case-Student-Package/9470b172-c3bf-47f2-aaed-509641369205/images/1.png`.
- It goes at the top of the app: the sidebar header, replacing the placeholder `Workflow` icon in
  `components/shell/app-sidebar.tsx`.

### Startup screen (chosen: "A · Logo reveal")

- On a white screen (dark in dark mode), the logo settles in.
- "Data Flow Explorer" and a subtitle follow, and a thin State Street blue bar fills.
- Then it fades into the dashboard. About 2 seconds.
- Library: **Motion** (formerly Framer Motion), `motion@14.6.0`, pinned exact, imported from `motion/react`. It
  supports React 18 and 19 (checked on npm); 14.6.0 is the newest release more than two weeks old. Its
  `AnimatePresence` handles the fade out.

### Plain wording

- One text file, read by `build_store.py` into the store. Claude drafts it; the team reviews it (one teammate checks
  each stage's lines, as with the catalog).
- Contents:
  - one plain sentence per register finding
  - a plain label per stage
  - one plain sentence per map node and edge. For the six handoff checks, start from `scripts/framework.json`
    `checks[].tests`.
  - the status phrases (confirmed / unresolved / cleared / no finding)

## My calls (Kevin to check while reading)

- **Stage overview, not "start here".** The mockup showed "Start here: 3 checks need attention". The register has
  findings in all seven stages, so a "start here" list would name all of them. The stage overview replaces it.
- **Wording file.** `scripts/plain_language.json`, next to `scripts/framework.json` (which already holds the map's
  hand-written text). It's keyed by the register's exact `finding` text, by node/edge id, and by stage name.
  - **Coverage (data-dependent texts).** Notebook 02 builds some finding texts from patterns, so the fixture and
    config-variant registers produce texts the release register doesn't. Builds with no register also have to pass.
  - **Missing wording.** `build_store.py` falls back to the raw `finding` text and prints a warning listing the
    unworded findings. It never fails the build over wording. Nodes, edges and stages are fixed by the map and
    framework, so for those it asserts full coverage.
  - **Release check.** `scripts/check_docs.py` fails when `outputs/02_defect_register.csv` (the full-data register)
    has a finding with no wording, and warns about entries that match no finding there.
  - **Variant findings.** Word the known fixture and config-variant findings too, so the tests show plain text.
- **One neutral sentence per finding, plus a lead-in for how it reaches the record.**
  - Each sentence describes the problem itself, not a population or one record. For example: "The book and the
    custodian count duplicate copies as trades." That way it reads correctly on the map panel and in a trace.
  - When a mark reaches the trace through another record (`mark.recordId !== trace.query`, today's "via"), the
    headline and the step prefix it with a lead-in chosen by the line's `id_kind`: "Its account: …",
    "Its security: …", "Its holding (account + security): …". The lead-ins live in the wording file.
  - The headline picks the record's own findings before indirect ones. An indirect finding never reads as being
    about the record itself.
- **Logo asset.**
  - Copy Kevin's PNG into a new `dashboard/public/` folder.
  - Make one transparent version (white turned see-through, edges kept smooth) and one white version for dark
    mode, using a short one-off Pillow script.
  - Light mode shows the blue logo and dark mode the white one, both through `next/image`.
- **Logo wording and placement.**
  - The sidebar header shows the logo, then "Data Flow Explorer", then "Prepared for State Street · Boston College
    case competition". That replaces "team MVP · local only"; the confidentiality footer stays.
  - The wording avoids presenting this as a State Street product. The brief says the data is a synthetic teaching
    model, not State Street's systems.
  - When the sidebar is hidden, a small logo appears in the top bar, so the logo is always visible.
  - Kevin hasn't confirmed the subtitle wording.
- **Startup screen behaviour.**
  - Plays once per browser session (`sessionStorage`, inside try/catch). A click or any key skips it.
  - Under `prefers-reduced-motion` it shows no movement (a plain short fade or nothing).
  - The dashboard renders underneath straight away, so its data loads in parallel. The bar is timed decoration and
    claims no real progress.
  - No flash of the dashboard before the overlay: the overlay renders on the server, and a tiny inline script sets a
    flag on `<html>` before first paint when the session has already seen it (the way `next-themes` avoids a theme
    flash). CSS then hides the overlay.
  - The overlay has `role="status"` and the text "Opening Data Flow Explorer", and it doesn't trap focus.
- **Tests and the startup screen.** The e2e setup marks the screen as seen (`page.addInitScript`) so existing tests
  aren't blocked. One new e2e test checks that the screen appears on a fresh session, that a key skips it, and that
  it doesn't return on the next page.
- **Commits.** Kevin commits. The build creates the branch, writes the files (including the spec copy) and stops
  there. It does not commit, but notes which new `dashboard/` files need `git add -f`.
- **Store changes.**
  - `register` (or a side table) gains a `plain` column.
  - `map_nodes` and `map_edges` gain `plain`.
  - `demo_traces` gains `stage`, taken from the register line it came from; the evidenced Check-in 2 trace goes in
    its own group at the top.
  - The status phrases go in a small table.
- **Headline composition** (fixed rules only):
  - With findings: the plain sentence of the most severe mark. Direct findings come before indirect ones, then
    confirmed > unresolved > cleared, and ties go to the lowest register line. After it comes that status's phrase,
    then "and N more findings" when there are others.
  - With no marks: the "no finding" phrase, which keeps the honesty caveat ("Nothing in our register flags this
    record. That is not proof it is clean: some rules are not coded yet.").
  - A record that isn't found keeps today's not-found card.
- **Evidence in an open step.** The finding's plain sentence, then the existing `exampleEvidence(...)` strings under
  a small "Evidence" label. No record-specific prose generator: it would need a template per finding with
  values filled in, and that belongs with piece 3.
- **Picker control.** A native `<select>` grouped with `<optgroup>`, or a shadcn popover list, whichever is
  simplest and accessible in this Next.js version. It navigates to `/trace?id=…` as the chips do now.
- **The "only steps with findings open" default** replaces today's rule (`open` when 1–5 rows). Steps with a
  `missing` status but no finding stay closed but keep their red/amber dot and short word.
- **Stage line click** (map panel) expands in place to list that stage's findings, each linking to its map place
  (selects the node or edge) and to its example trace.

## Left to the builder

- Component structure, styling within the existing design tokens, exact copy of short UI labels.
- Whether the folded sections use the existing `components/ui/collapsible.tsx` (expected) or something else.
- How the store contracts in `tests/store_test.sh` / `tests/store.test.ts` cover the new columns.

## Critical files

- `dashboard/components/trace/trace-view.tsx`: picker, headline, Technical details (`TraceSummary`)
- `dashboard/components/trace/timeline-step.tsx`: one-line steps, default open rule, plain finding + evidence
- `dashboard/components/map/details-panel.tsx`: `Overview`, `NodeDetails`, `EdgeDetails` layering
- `dashboard/lib/store.ts`, `lib/types.ts`, `lib/data.ts`: read the new columns and tables
- `dashboard/lib/trace-findings.ts`: reuse `markCounts`, `locateFindings`, `exampleEvidence`, `traceTone`
- `dashboard/lib/findings.ts`: reuse `countsFor` for stage and place counts
- `scripts/build_store.py`: `demo_traces()` (line ~509), map node/edge writing (~584), new wording load + asserts
- `scripts/plain_language.json` (new)
- `dashboard/components/shell/app-sidebar.tsx`, `dashboard/app/layout.tsx`: logo, top-bar logo, startup overlay
  and its pre-paint flag
- `dashboard/components/shell/boot-screen.tsx` (new), `dashboard/public/` (new: the logo files),
  `dashboard/package.json` (`motion@14.6.0`)
- `dashboard/e2e/dashboard.spec.ts`: update the story-chip, legend and map-panel tests to the new layout
  while keeping their guarantees (confirmed red, unresolved amber, every state named in a legend, narrow screen)

## Verification

1. `uv run python scripts/build_store.py`: the build passes on the full data with no wording warnings. Remove one
   finding's wording once by hand: the build warns and falls back, and `check_docs.py` fails. Remove one node's
   wording: the build fails.
   `tests/fixture_test.sh` and `tests/store_test.sh` (no-register and examples-only builds) still pass.
2. Trace `TXN100002453`: its holding-level finding reads "Its holding (account + security): …", and the headline
   leads with its own duplicate finding.
2. `tests/store_test.sh`, then inside `dashboard/`: `npm test` and `npm run test:e2e`.
3. `cd dashboard && npm run dev`. Open `/trace?id=TXN100004247` (negative quantity, confirmed) and check:
   - the headline is plain and says "confirmed"
   - only the finding step is open
   - Technical details shows the rule ID and line
   - an unresolved story (for example a positions finding) stays amber
   - a record with no finding shows the caveat
4. Map page: the opening view fits one screen; the stage counts add up to the register's status counts; clicking
   Trade check shows its plain sentence first and its raw key counts only after unfolding.
5. Narrow viewport: picker and headline usable (the existing narrow-screen e2e test).
6. Startup screen:
   - In a fresh private window it plays once (about 2 s) and fades into the map with no flash of the dashboard.
   - A key or click skips it.
   - Reloading or moving to another page doesn't replay it.
   - With reduced motion switched on in macOS settings, it doesn't animate.
   - The logo reads well in light and dark mode, and when the sidebar is collapsed.
7. Docs: `docs/DECISIONS.md` new entry (calm layout + plain wording file + headline rules), `docs/STATUS.md`,
   `dashboard/README.md`, then `uv run python scripts/check_docs.py`.
