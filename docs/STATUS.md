# Status

Last updated: 2026-11-09 (Check-in 2 marked done and frozen; coordinated map palette and map-controlled trace steps; D-063, D-064)

*Overwrite this file when the state changes. Choices go in [DECISIONS.md](DECISIONS.md), numbers in
[FINDINGS.md](FINDINGS.md). Dates and deliverables: brief §7 and §8 (`reference/01_Student_Brief.md`).*

## Where we are

- **Dashboard review (9 Nov):** [PR #8](https://github.com/KevinRusu/BC-State-Street-Case-Competition/pull/8) is open for review from `codex/dashboard-compact-trace-layout` into `main`. It includes the compact trace workspace, bounded zoom, office alignment, map-controlled steps and coordinated styling; validation and store-rebuild instructions are in the PR description.

- **Map palette (9 Nov):** deeper blue-grey office backgrounds, a muted blue collective office outline, a navy group label and a stronger separate dashed external-source border. Both views share the light/dark palette; context boxes are less faded for readability. This refines the initial bright-blue grouping border at the user's request (D-064).

- **Office grouping and trace controls (9 Nov):** Accounts and Ledger NAV are vertically centred in their bands. Both map views show a blue "State Street Offices" outline and a stronger separate dashed boundary for independent sources. Traced boxes toggle their matching timeline steps, share state with the timeline headers and support keyboard activation; context-only boxes explain why they have no matching step (D-063).
  - **Validation:** rebuilt the full-data store using the existing analysis outputs and restarted the local app. Unit/store checks, the synthetic notebook/store-contract harness, the production browser suite, lint, type and documentation checks passed. Both views were visually reviewed in light/dark mode and their actual rendered palette checked; real-record map buttons were exercised locally.

- **Trace node spacing (9 Nov):** Transactions is anchored by its vertical centre at the front/middle office boundary, so the box stays balanced when trace labels change its height. Pipeline events and Corporate actions have larger gaps and remain within an expanded middle-office band; the lower bands move down together. The graph metadata still comes from the store builder (D-062).
  - **Validation:** rebuilt the local store and restarted the dashboard; all current-store examples passed the spacing, equal-overlap and desktop-fit checks. Unit/store and production browser suites, store contracts, lint, type and documentation checks passed. The store harness uses the existing Windows npm entry-point workaround described below.

- **Compact trace layout (9 Nov):** on branch `codex/dashboard-compact-trace-layout`. The example picker and map share the left column; the selected-record summary sits above an independently scrolling evidence timeline on the right. Desktop height follows the viewport; narrow screens stack the panels. Manual lookup is under "Find an ID" beside the picker. Both maps stop zooming out at their centred full-grid view and refit after resizing. Detection and reconciliation logic are unchanged (D-061).
  - **Validation:** full-data store rebuild using the existing analysis outputs; synthetic notebook/store contracts (including absent and foreign membership fallbacks); unit and production browser suites; lint, type and documentation checks passed. Every current-store example was also checked at laptop size. The Windows store harness needed its final npm commands run through npm's JavaScript entry point because the bundled Node launcher could not locate npm; those commands passed.

- **One deliverable notebook (8 Nov):** `notebooks/deliverable.ipynb` (D-060) is the code deliverable of brief §7: the former `02_reconcile.ipynb` with `03_error_severity.ipynb` folded in as section 11 (the run record is section 12). It writes every `outputs/02_*` file, now including `02_severity.csv`, `02_fund_impact.csv`, `02_impact_detail.csv`, `02_account_membership.csv` and `02_severity.png` / `.pdf` (formerly `03_*`). Nothing moved: register checksum `d7e752f55f0a` as before, and the severity files equal the former `03_*` files on the full data. The other notebooks sit in `notebooks/additional/` (`01_explore_tables`, `02_quantity_mismatches`, `checkin1_evidence`); none of them is needed to run the deliverable or the dashboard. `tests/run_notebook.sh` runs the deliverable by default and `tests/fixture_test.sh` runs the severity section under every fixture config.
  - **Team:** `git pull` then reopen the notebook under its new name; `tests/run_notebook.sh` rebuilds `outputs/`. Numbers on slides and in the catalog are unchanged.

- **Windows run path (7 Nov, merged 8 Nov as PR #6):** `.gitattributes` keeps `.sh` files on Unix line endings, `dashboard/package.json` requires Node 20.9 or newer, and the root README has a Windows setup block (winget, Git Bash for the `.sh` scripts) (D-059). First Windows run (8 Nov, while merging the notebooks): see "Windows first run" below.

- **Calm dashboard (6 Nov):** done and merged to `main` (PR #5; D-058). The Trace page has a story picker, a plain headline, one-line steps and a "Technical details" link; the map panel shows a stage overview and folded sections; the State Street logo and a short startup screen are in. Plain wording for every finding, stage and map place lives in `scripts/plain_language.json` and flows through the store. Design: `docs/superpowers/specs/2026-11-06-calm-dashboard-design.md`.
  - **Team:** review the wording in `scripts/plain_language.json`, one teammate per stage (as with the catalog).
  - **Kevin:** check the startup screen by hand (private window, macOS Reduce Motion, dark mode).
  - **Everyone:** run `npm ci` once in `dashboard/` (the lockfile adds `motion` for the startup screen; it is written with npm 10, so `npm ci` works on npm 10 and 11).
  - **Next brainstorms:** the summary assistant (piece 3), and how we hand in the dashboard (piece 4; see open question 7).

- **Dashboard trace (4 Nov):** known notebook-register examples now appear at their recorded map location and in the corresponding timeline step, with raw evidence fields where available. Confirmed findings are red and unresolved findings amber even when every record link exists. Link badges explicitly describe matching records; trace badges no longer show population-wide finding counts. This presents existing register examples, not a complete record-level rule engine or proof that unmarked records are valid (D-051).

- **Trace navigation (4 Nov, updated 6 Nov):** the search input and each timeline step's open or closed state reset for each record. The 4 Nov story list (with its "Show fewer") is gone: the story picker replaced it (D-058).

- **Dashboard functional tests (4 Nov):** automatic synthetic-fixture preparation, unit/store checks, and production-build Playwright workflows passed. Browser coverage includes trace finding visibility, story picker navigation, map interactions, search, display controls, and a narrow viewport. Testing exposed and fixed header overflow on narrow screens; run metadata now compacts visually while remaining available to assistive technology and the tooltip. Browser checks use a separate build and local port; run instructions are in `dashboard/README.md`, with reports under `tests/runs/dashboard_browser/` (D-052).

- **Check-in 1 (architecture):** done. Material frozen in `docs/checkins/checkin1/`.
  Feedback: tell a story rather than list results; the team that explains the data best with good visuals wins,
  ideally with an interactive dashboard or small app.
- **Check-in 2 (method gate):** done and presented (about 2 Nov). Material frozen in `docs/checkins/checkin2/`; tag
  `checkin2`. The code was done by then. `notebooks/deliverable.ipynb` (then named
  `02_reconcile.ipynb`, D-060) runs on the full
  data (all eleven tasks in `docs/checkins/checkin2/CHECKIN2_PLAN.md` §6b), with fixture and robustness tests in
  `tests/`. Clean-kernel run done 17 Oct (`tests/run_notebook.sh`, 49 s; register checksum unchanged, see
  FINDINGS.md). Denominators for the proposed coverage and freshness checks written (D-041). Negative BUYs (D-043):
  gross_amount confirms the size, not the side, so the trace, story, catalog entry 1 and figure 08 now state both
  readings (wrong sign / wrong type); the new rule `TXN_NEGATIVE_SIDE_EVIDENCE` writes `outputs/02_negative_partners.csv`
  and `02_sign_by_type.csv`. Record confirmed; correct value unresolved, leaning wrong sign. The team work is still
  open (below).
- **Method review (21 Oct):** the headline numbers were recounted from the raw files with separate SQL and all
  matched (C0, BOOKED-only, C7, three-way agreement, book vs custodian, NAV, corporate actions, duplicate pairs).
  Choices that had no written reason now do: removing copies (D-044, evidence in `outputs/02_duplicate_profile.csv`),
  dropping CANCELLED (D-045), the headline rate (D-046). Blank quantities turned out to be real trades whose size is
  still in the row; the book appears to drop their units (D-047, `outputs/02_blank_quantity.csv`, new rule
  `TXN_BLANK_QUANTITY_EVIDENCE`, catalog entry 2). Agreed: for Check-in 2 we show where the data is broken and how we
  treat it; we do not correct it.
- **Code review (23 Oct):** the deliverable notebook checked rule by rule against RULES.md, and bug-hunted with the deck and figure
  scripts. Fixed: the `sign_conflict` flag now covers negative rows of any status, and a blank-quantity rebook is not
  evaluable (D-048); R3 no longer subtracts a REVERSED row with nothing to offset (D-049); the wrong-sign holding is
  right for a negative SELL; the deck and figure scripts compute or assert their claims instead of typing them. The
  rebook line, two flag counts in `outputs/02_break_classes.csv` and one slide 7 speaker-note sentence moved; the
  headline numbers did not. Deck rebuilt. Review finding for later: 9 rules in RULES.md have no code yet and 5 are
  only partly coded (Job B below).

- **Error severity (30 Oct; merged into the deliverable 8 Nov):** section 11 of `notebooks/deliverable.ipynb` (formerly notebook 03, `03_error_severity.ipynb`; D-050, D-060) adds NAV sensitivity and distinct-account breadth using the register's detections. Run the notebook to rebuild `outputs/02_severity.csv` and its fund, record and account drill-downs plus the plot (`02_severity.png` / `.pdf`). Valuation coverage and scenario assumptions accompany each measure; unknown dollar effects remain visible. The severity chart uses lettered markers, an aligned scenario/value key, and separate unknown-impact cards. Dashboard integration and verified bond quote/quantity conventions remain future work.

- **Sankey / UpSet integration (30 Oct):** merged the locally available `Sankey-Anomaly-Breakdown` branch into `main`. Offline anomaly and overlap views are built with `scripts/build_sankey.py` and `scripts/build_upset.py`; usage and counting contracts are in [SANKEY_GUIDE.md](SANKEY_GUIDE.md) and [UPSET_GUIDE.md](UPSET_GUIDE.md). These views retain their existing benchmark and assessment provenance; they do not measure NAV impact. New guides live in `docs/` rather than frozen check-in material. Remote refresh was unavailable because this checkout lacks GitHub authentication.

## Code review (6 Nov): done

Job A (bugs in code that runs today; missing rules stay in Job B below). Each candidate was proved against the data or
the code before it was fixed, every fix has a test that failed on the old code, and a fresh reviewer pass followed.
What changed and why: D-056 (and D-054, D-055 for the dashboard decisions the README had proposed, D-057 for the
slide count). The register is unchanged on the full data; the Check-in decks were not rebuilt.

- **Fixed:** the trace marks every record a register line counts, not only its examples (a negative-quantity BUY that
  is not an example now shows red); the header badge warns when the store is older than the register; a corporate-action trace reaches prices and
  FX; blank key halves; legends and search hint; book/custodian rows on another date or with an unreadable date are set
  aside and counted, never joined; rebooks of a CANCELLED ID with two quantities, or of a blank-ID CANCELLED row;
  an unreadable USD rate; "not evaluable: other" now names its cause; the severity section (then notebook 03) under R3 and with an empty
  scenario (it never ran on anything but the full data; the fixture test now runs it); the literal-ID self-check;
  the map listed `POS_REBUILD_MATCHES` on the Trade check line (RULES.md §5 says Position check; RULES.md kept);
  `check_docs.py` (scans `dashboard/README.md`, checks rule IDs); RULES.md cites outputs and config keys instead of
  typed numbers; CLAUDE.md and README.md cover the dashboard.
- **Checked, not a bug:** the trace page's failure handling (only a missing store returns "not ok"); a fan-out label
  giving way to a finding label (D-051); vendor priority is fixed per vendor, so the global minimum is right; "held"
  means in our book; an unknown transaction type is visible as not evaluable; fractional-quantity backtest misses are
  rebooks that fit neither way; the NAV `reason` text cannot appear on a passing row (it is set only on the
  not-evaluable conditions).
- **Declined (scope):** currency-level findings stay off record traces (D-056).
- **For the team:** `scripts/findings.py` and `notebooks/additional/02_quantity_mismatches.ipynb` apply different rules from
  the deliverable notebook; the list is in [DETECTOR_DIFFERENCES.md](DETECTOR_DIFFERENCES.md). Decide, record in DECISIONS.md,
  then delete that file.
- **Left latent, noted:** the severity section (section 11 of the deliverable, then notebook 03) would fail if no
  scenario at all had records (not reachable with the register's findings today; since 8 Nov the fixture test runs
  the section under every fixture config, and none of them is empty).

## Next: toward Check-in 3 (week of 9 Nov)

- **Review the catalog draft** (six entries): one teammate per entry checks the prose and fills *Reviewed by* in
  `docs/DEFECT_CATALOG.md`. Still open from before Check-in 2.

- **Open the groups we have only counted** (agreed 21 Oct, for Check-in 3's quality checks). Each is a register line or
  an output row that nobody has looked inside yet:
  - break classes "Custodian differs from both the book and the trades", "Book and custodian agree on a quantity the
    trades do not explain" and "Book and custodian hold the opposite sign to the trades"
  - "Position with no contributing trade", and the keys not evaluable only in the rebuild
  - "Rebook changes the quantity but keeps the cancelled gross_amount": what the book did with them
  - "CANCELLED row linked to an ID that does not exist", "More than one REVERSED row per original", "settlement_date
    before trade_date"
  - the backtest misses on rows with no link (`outputs/02_blank_quantity.csv`, part "backtest")
  - the NAV fails and the vendor spread and scale flags
  - conflicting copies that differ only on fields that don't change a quantity (could become testable)

- Move the deliverable notebook's code into `src/` + `run_all.py` (D-012): one command rebuilds every number. Two steps, so each
  can be checked: (1) move what exists, and prove every output is unchanged; (2) add the rules RULES.md states but no
  code runs yet, one at a time, as entries in a rule table (rule id, testable and fail conditions, config key for the
  threshold). Not coded today: `ACC_NOT_OPEN_ON_TRADE_DATE`, `ACC_REQUIRED_FIELDS`, `SEC_IDENTIFIER_VALID`,
  `TXN_SECURITY_NOT_MASTERED`, `TXN_TIMESTAMPS_IN_ORDER`, `TXN_AFTER_CUTOFF`, `NAV_SHARE_CLASS_MAPPING`,
  `NAV_OPEN_ISSUES_BEFORE_RELEASE` (needs materiality), `CA_ALL_HOLDERS_ADJUSTED` (needs a posting log). Partly coded:
  `TXN_DUPLICATE` (same economics, new ID), `TXN_FIELDS_VALID` (T+2 in business days, amount tolerance, blank
  price), `TXN_CORRECTION_LINK` (same account and security), `FX_RATE_VALID` (uniqueness, rate > 0, day-on-day band),
  `PRC_QUOTE_ELIGIBLE` (coverage and freshness, D-041). Thresholds these need are not in the config yet (T+2 limit,
  feed latency, FX band, NAV materiality).
- Check-in 3 list (brief §8): full-data reconciliation, quality checks, scores with impact and coverage,
  sensitivity and stress tests, roadmap, working executive view, complete slide draft.
- Final (brief §5, §7): three defect traces and two cleared look-alikes; timeliness by feed and day; scores at
  account, domain and platform level with coverage; at least six indicators (three leading); stress test with one
  injected defect and one valid look-alike; executive dashboard with record-level drill-down plus wireframes for the
  three offices; event-adjusted corporate-action scenario (D-016); second trace on the 100x price (D-014).
- Final deck: new, in `docs/final/`, with speaker notes beside it. Suggested shape: Working Guide §8.

## Open questions for faculty

Record the answer here when we get it, then add a decision.

1. REVERSED: is there an explicit event-operation contract (one reversal per original)? (D-007)
2. Corporate-action date definitions: ex-date vs effective date. (D-016)
3. USD rate to USD is not exactly 1: data error or convention?
4. The book's duplicate and REVERSED conventions: intended or defects? (D-005, D-007)
5. May we use CSSF Circular 24/856 as an outside NAV-error reference? (`docs/RULES.md`, NAV materiality)
6. Which AI tools are approved for use with the data? Get it in writing.
7. Dashboard packaging: we built a local Next.js app (D-054). Is handing it in as a repo folder with run
   instructions acceptable?
8. A negative BUY: wrong sign or wrong type? Needs the order side or the cash direction. (D-043)

## Windows first run (8 Nov)

The repo ran end to end on Windows 11 for the first time while the notebooks were merged (D-060): PowerShell for `uv`
and `npm`, Git Bash (`C:\Program Files\Git\bin\bash.exe`) for the `.sh` scripts, as the README's Windows block says.
What worked, what did not, and what a Windows teammate should know:

- **Worked unchanged:** `tests/run_notebook.sh` (the deliverable in 96–97 s; from their new path,
  `notebooks/additional/01_explore_tables.ipynb` in 130 s, `02_quantity_mismatches` in 12 s, `checkin1_evidence` in
  18 s). With notebook 01's outputs present, the deliverable's reproduction checks fire ("settings equal to notebook 01:
  True; same data: True ... variants that differ: 0" and "join counts equal notebook 01"). `uv run python -m unittest
  discover tests` (45 tests), `tests/store_test.sh` (store contracts, the unit suite, `next build`) and
  `scripts/build_findings.py` (register checksum unchanged). `tests/robustness_test.sh` passed in 10.6 min with the
  `python3` workaround below, and its shuffle comparison now covers the four severity tables because they carry the
  `02_` prefix (D-060).
- **Notebook 03's `%run` (now gone):** `%run` splits its line on whitespace, so the absolute path it was given failed
  with `File '...\School\Fall' not found` because the checkout path has spaces. The merge removed the `%run` (D-060);
  nothing else in the repo uses one. The pre-merge baseline for the comparison in D-060 came from a throwaway copy of
  notebook 03 with the path quoted.
- **`python3` is the Microsoft Store stub:** `tests/fixture_test.sh` and `tests/robustness_test.sh` run their checks
  with `python3 - <<'PY'`; on Windows `python3` on PATH is the Store launcher, so both scripts stop at that line. They
  pass once a `python3` that runs the virtual environment's `python.exe` (its Windows `Scripts` folder) is first on PATH (fixture test: 41 checks, the severity
  section under every config). Fix to make: call `uv run --quiet python -` there, as `tests/run_notebook.sh` does.
- **`scripts/check_docs.py` reads files in the console code page:** `Path.read_text()` without an encoding is cp1252
  on Windows, so the curly quotes in `docs/SANKEY_GUIDE.md` and `docs/UPSET_GUIDE.md` raise `UnicodeDecodeError`. Run
  it as `uv run python -X utf8 scripts/check_docs.py` (passes), or add `encoding='utf-8'` to the script.
- **`scripts/build_store.py` while `npm run dev` is running:** the build completes (about 2 min) but the final swap,
  `os.replace(store.duckdb.building, store.duckdb)`, fails with `PermissionError: [WinError 5]`: Windows will not
  replace a file another process holds open, where macOS and Linux would. Stop the dev server, then rerun the script
  (it deletes a leftover `.building` file itself) or rename the finished `outputs/store.duckdb.building` into place.
  Worth knowing for whoever runs the dashboard: the store the dev server had open was built 6 Nov without a register
  (`store_info.member_source` = `examples`), so its Trace page shows example records only until the store is rebuilt.
- **Playwright's browser is not installed by `npm ci`:** every `npm run test:e2e` test fails with "Looks like
  Playwright was just installed" until `npx playwright install chromium` has run once on the computer (dashboard
  README), or `DASHBOARD_TEST_BROWSER` names an installed browser. With Edge
  (`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`) all 20 browser tests pass (33 s).
- **matplotlib outside a kernel:** the default backend is TkAgg, so the severity section's `plt.show()` opens a window
  and blocks when the cells run as a script. `tests/prepare_dashboard_fixture.py` now sets `MPLBACKEND=Agg`, as
  `tests/test_cross_platform.py` already did; nbconvert runs use the inline backend and are unaffected.
- **Line endings:** the working copies of `tests/*.sh` were CRLF (checked out before PR #6 added the `.gitattributes`
  rule; bash reads the `\r` as part of each command) and were rewritten with LF before the runs above; a fresh checkout
  gets LF. Under `core.autocrlf=true` the notebooks are CRLF in the working copy and LF in git; the outputs stay LF
  (`lineterminator='\n'`), as `tests/test_cross_platform.py` asserts.

## Housekeeping

- **AI log:** `AI_Logs/` is local and gitignored (D-039). Brief §10 requires the prompts and responses that shaped
  the work: every teammate exports their chats into it before the final.
- **Deferred minor items in the deliverable notebook** (from the build review; none changes a release count today):
  - the intro says notebook 01 checks assert when thresholds match; they also need the same data (D-018)
  - `import os` sits mid-cell in setup
  - the 3 "duplicate copies + REVERSED double offset" keys have no register line of their own (they are in
    `outputs/02_break_classes.csv`)

## Doc debt

Docs known to disagree with a higher source. Fix, then remove the line.

- `docs/figures/01_control_map.png` (`scripts/fig_control_map.py`) still shows the Check-in 1 bands; the dashboard map
  uses the office × stage grid (D-055). Redraw it for the final deck if the team wants one picture.
- `notebooks/additional/01_explore_tables.ipynb` mentions numbers "from PROJECT_SUMMARY section 5". That is history (the file
  was deleted 16 Oct); leave it.
- `notebooks/additional/01_explore_tables.ipynb` labels negative quantities "confirmed (sign contradicts gross_amount)" (also
  in `outputs/01_defect_log.csv`). D-043 says gross_amount confirms the size only. Reword when notebook 01 is next
  rerun.
- `docs/checkins/checkin2/DECK_BRIEF.md` §4–§5 walk through the old 10-slide deck (cover, slides 1–10, backups). The
  deck is now 7 slides (`scripts/build_checkin2_deck.py`); the numbers and §7 sources still hold.
- `docs/checkins/checkin2/STORY.md` cites register checksum `d43040c69f8c`; FINDINGS.md is now `d7e752f55f0a`.
  Spot-checked 22 Oct: the story's numbers are unchanged in the current outputs. Update its checksum line.
- `docs/checkins/checkin2/CHECKIN2_PLAN.md` §2, blank-quantity row: "blank-as-zero ... is evidence of the book's
  convention". D-047 refines this: the blanks are real trades and the book appears to drop their units.
- `docs/checkins/checkin2/CHECKIN2_PLAN.md` §2 (trace row: "independent evidence (`gross_amount`)") and §3.4 (hop 1:
  "`gross_amount` / price = +X") treat gross_amount as evidence of the sign. D-043 refines this; the plan stays as
  agreed.
