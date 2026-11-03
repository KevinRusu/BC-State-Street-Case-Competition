# Status

Last updated: 2026-10-30 (severity analysis added; D-050)

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
- **Code review (23 Oct):** notebook 02 checked rule by rule against RULES.md, and bug-hunted with the deck and figure
  scripts. Fixed: the `sign_conflict` flag now covers negative rows of any status, and a blank-quantity rebook is not
  evaluable (D-048); R3 no longer subtracts a REVERSED row with nothing to offset (D-049); the wrong-sign holding is
  right for a negative SELL; the deck and figure scripts compute or assert their claims instead of typing them. The
  rebook line, two flag counts in `outputs/02_break_classes.csv` and one slide 7 speaker-note sentence moved; the
  headline numbers did not. Deck rebuilt. Review finding for later: 10 rules in RULES.md have no code yet and 5 are
  only partly coded (Job B below).

- **Error severity (30 Oct):** `notebooks/03_error_severity.ipynb` adds NAV sensitivity and distinct-account breadth using notebook 02's existing detections (D-050). Run the notebook to rebuild `outputs/03_severity.csv` and its fund, record and account drill-downs plus plot. Valuation coverage and scenario assumptions accompany each measure; unknown dollar effects remain visible. The severity chart now uses lettered markers, an aligned scenario/value key, and separate unknown-impact cards; PNG and PDF exports are available in `outputs/`. Dashboard integration and verified bond quote/quantity conventions remain future work.

- **Sankey / UpSet integration (30 Oct):** merged the locally available `Sankey-Anomaly-Breakdown` branch into `main`. Offline anomaly and overlap views are built with `scripts/build_sankey.py` and `scripts/build_upset.py`; usage and counting contracts are in [SANKEY_GUIDE.md](SANKEY_GUIDE.md) and [UPSET_GUIDE.md](UPSET_GUIDE.md). These views retain their existing benchmark and assessment provenance; they do not measure NAV impact. New guides live in `docs/` rather than frozen check-in material. Remote refresh was unavailable because this checkout lacks GitHub authentication.

## Next: before Check-in 2

| Work | Where | Owner |
|---|---|---|
| Review the catalog draft (six entries now): one teammate per entry checks the prose and fills *Reviewed by* | `docs/DEFECT_CATALOG.md` | |
| Read the team guide first: the project, the six Check-in 2 items, the three statuses and how to put the numbers on slides, in plain words | `docs/checkins/checkin2/TEAM_GUIDE.md` | everyone |
| Read the story before the dry run (one broken trade, end to end, with the detours and the cleared flag) | `docs/checkins/checkin2/STORY.md` | everyone |
| **Deck (27 Oct, replaces both earlier decks)**: 7 slides, one per brief §8 item (the last item has two), for 8–10 minutes beside the live dashboard. No cover, no question slide. Each slide: the deliverable as the header, the finding in one sentence, one chart or table, short cards; short speaker notes beside it. Rebuild after a notebook rerun: `uv run python scripts/build_checkin2_deck.py` (a rerun overwrites hand edits) | `docs/checkins/checkin2/Checkin2.pptx`, `SPEAKER_NOTES.md` | team |
| **Study guide (27 Oct)**: every Check-in 2 item, the ten tables, the code and tests explained from zero, with one worked example per idea and the source file of every number | `docs/checkins/checkin2/STUDY_GUIDE.md` | everyone |
| **Next: dry run.** Each member explains one slide and one number, using DECK_BRIEF.md §4 | | |

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
- Move notebook 02's code into `src/` + `run_all.py` (D-012): one command rebuilds every number. Two steps, so each
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
- `docs/checkins/checkin2/DECK_BRIEF.md` §4–§5 walk through the old 10-slide deck (cover, slides 1–10, backups). The
  deck is now 7 slides (`scripts/build_checkin2_deck.py`); the numbers and §7 sources still hold.
- `docs/checkins/checkin2/STORY.md` cites register checksum `d43040c69f8c`; FINDINGS.md is now `d7e752f55f0a`.
  Spot-checked 22 Oct: the story's numbers are unchanged in the current outputs. Update its checksum line.
- `docs/checkins/checkin2/CHECKIN2_PLAN.md` §2, blank-quantity row: "blank-as-zero ... is evidence of the book's
  convention". D-047 refines this: the blanks are real trades and the book appears to drop their units.
- `docs/checkins/checkin2/CHECKIN2_PLAN.md` §2 (trace row: "independent evidence (`gross_amount`)") and §3.4 (hop 1:
  "`gross_amount` / price = +X") treat gross_amount as evidence of the sign. D-043 refines this; the plan stays as
  agreed.
