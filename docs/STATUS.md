# Status

Last updated: 2026-10-16 (repo restructure; Check-in 2 code done; Check-in 2 story written)

*Overwrite this file when the state changes. Choices go in [DECISIONS.md](DECISIONS.md), numbers in
[FINDINGS.md](FINDINGS.md). Dates and deliverables: brief §7 and §8 (`reference/01_Student_Brief.md`).*

## Where we are

- **Check-in 1 (architecture):** done. Material frozen in `docs/checkins/checkin1/`.
  Feedback: tell a story rather than list results; the team that explains the data best with good visuals wins,
  ideally with an interactive dashboard or small app.
- **Check-in 2 (method gate, week of 19 Oct):** the code is done. `notebooks/02_reconcile.ipynb` runs on the full
  data (all eleven tasks in `docs/checkins/checkin2/CHECKIN2_PLAN.md` §6b), with fixture and robustness tests in
  `tests/`. The team work is still open (below).

## Next: before Check-in 2

| Work | Where | Owner |
|---|---|---|
| Seven-question write-ups: the four classes in D-017 + the cleared flag in D-024 | `docs/DEFECT_CATALOG.md` | |
| Read the story before the dry run (one broken trade, end to end, with the detours and the cleared flag) | `docs/checkins/checkin2/STORY.md` | everyone |
| Deck, 8 to 10 slides, outline in CHECKIN2_PLAN §5; every number from an `outputs/02_*` file | `docs/checkins/checkin2/Checkin2.pptx` | |
| Clean-kernel full run, timed; regenerate FINDINGS | `notebooks/02_reconcile.ipynb` | |
| Dry run: each member explains one slide and one number | | |

## Next: after Check-in 2

- Tag the repo `checkin2`; `docs/checkins/checkin2/` becomes frozen.
- Move notebook 02's code into `src/` + `run_all.py` (D-012): one command rebuilds every number.
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
7. Preferred dashboard packaging (e.g. a zipped Streamlit app)?

## Housekeeping

- **AI log:** `AI_Logs/` is local and gitignored (D-039). Brief §10 requires the prompts and responses that shaped
  the work: every teammate exports their chats into it before the final.
- **Deferred minor items in notebook 02** (from the build review; none changes a release count today):
  - the NAV `reason` column can say "as_of_date unreadable" on a passing row (0 such rows)
  - the intro says notebook 01 checks assert when thresholds match; they also need the same data (D-018)
  - `import os` sits mid-cell in setup
  - the 3 "duplicate copies + REVERSED double offset" keys have no register line of their own (they are in
    `outputs/02_break_classes.csv`)
  - the R3 side view labels a key "not evaluable: other" when a REVERSED row has a blank quantity

## Doc debt

Docs known to disagree with a higher source. Fix, then remove the line.

- `notebooks/01_explore_tables.ipynb` mentions numbers "from PROJECT_SUMMARY section 5". That is history (the file
  was deleted 16 Oct); leave it.
