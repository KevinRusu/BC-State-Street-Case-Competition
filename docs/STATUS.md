# Status

Last updated: 2026-10-21 (method review: D-044 to D-047; blank quantities added as catalog entry 2; deck storyboard drafted)

*Overwrite this file when the state changes. Choices go in [DECISIONS.md](DECISIONS.md), numbers in
[FINDINGS.md](FINDINGS.md). Dates and deliverables: brief §7 and §8 (`reference/01_Student_Brief.md`).*

## Where we are

- **Check-in 1 (architecture):** done. Material frozen in `docs/checkins/checkin1/`.
  Feedback: tell a story rather than list results; the team that explains the data best with good visuals wins,
  ideally with an interactive dashboard or small app.
- **Check-in 2 (method gate, week of 19 Oct):** the code is done. `notebooks/02_reconcile.ipynb` runs on the full
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

## Next: before Check-in 2

| Work | Where | Owner |
|---|---|---|
| Review the catalog draft (six entries now): one teammate per entry checks the prose and fills *Reviewed by* | `docs/DEFECT_CATALOG.md` | |
| Read the story before the dry run (one broken trade, end to end, with the detours and the cleared flag) | `docs/checkins/checkin2/STORY.md` | everyone |
| Deck, 8 to 10 slides, outline in CHECKIN2_PLAN §5; every number from an `outputs/02_*` file. Storyboard drafted 21 Oct; revise it for D-044 to D-047, then build it with a script in `scripts/` | `docs/checkins/checkin2/Checkin2.pptx` | |
| Dry run: each member explains one slide and one number | | |

## Next: after Check-in 2

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
8. A negative BUY: wrong sign or wrong type? Needs the order side or the cash direction. (D-043)

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
- `notebooks/01_explore_tables.ipynb` labels negative quantities "confirmed (sign contradicts gross_amount)" (also
  in `outputs/01_defect_log.csv`). D-043 says gross_amount confirms the size only. Reword when notebook 01 is next
  rerun.
- `docs/checkins/checkin2/CHECKIN2_PLAN.md` §2, blank-quantity row: "blank-as-zero ... is evidence of the book's
  convention". D-047 refines this: the blanks are real trades and the book appears to drop their units.
- `docs/checkins/checkin2/CHECKIN2_PLAN.md` §2 (trace row: "independent evidence (`gross_amount`)") and §3.4 (hop 1:
  "`gross_amount` / price = +X") treat gross_amount as evidence of the sign. D-043 refines this; the plan stays as
  agreed.
