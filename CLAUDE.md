# Instructions for Claude Code

## Start here

1. Read `docs/STATUS.md`: where we are, what's next, open questions.
2. Then read the home of whatever your task touches. Every kind of fact has exactly one home:

| What | Home |
|---|---|
| Requirements: scope, deliverables, check-ins, grading | `reference/01_Student_Brief.md` (the only statement of requirements) |
| How to treat the data: keys, joins, dates, rebuild, prices, ledger | `reference/02_Dataset_Guide.md` (read all of it before any join) |
| How to write a finding, trace or cleared flag | `reference/03_Student_Working_Guide.md` |
| Our choices and interpretations of the guides | `docs/DECISIONS.md` |
| Numbers and findings | `outputs/` (gitignored) and the generated `docs/FINDINGS.md` |
| Rules the code tests | `docs/RULES.md` |
| Thresholds and policy switches | `config/*.toml` |
| Code | `notebooks/*.ipynb` (the only source of their code) |

If two sources disagree, the higher one wins: brief > DECISIONS > config > code and outputs > other docs.
Note the loser under "Doc debt" in `docs/STATUS.md`.

Material in `docs/checkins/` records what we handed in at a check-in. It is history: read it for context, never
treat it as current, and don't edit it once that check-in is over.

## Rules for this repo

- The data is confidential. Never put it anywhere public.
- Never modify files in `data/` or `reference/`. Write results to `outputs/`.
- Read all CSVs as text first (DuckDB `all_varchar=true`), then convert types explicitly and keep the values that fail.
- Dates come as `YYYY-MM-DD` or `DD/MM/YYYY`. Settlement lag is counted in business days.
- Never hard-code defect record IDs. Thresholds go in a config file, not in the code.
- Detection must be rule-based and reproducible. AI can explain results, not find them (D-001).
- No version suffixes in file names (`_v2`, `_final`, `_old`); git keeps the history. Use `uv` for packages.
- The Markdown files in `reference/` are the working copies of the brief and guides; the PDF and Word originals
  live in `reference/official/` (gitignored).

## Keeping the docs true

- Never type a number into a doc by hand. Cite the `outputs/` file, or rerun `scripts/build_findings.py`.
- Never summarise `reference/` into another doc. Link to the section instead; only our interpretation goes in DECISIONS.
- Never keep decisions or progress notes only in a gitignored folder (e.g. a tool's workspace). Copy them into
  `docs/DECISIONS.md` or `docs/STATUS.md` before the task ends.
- Never generate a notebook from a hidden source file. Edit the `.ipynb` (D-037).

## Where new files go

- Check-in material (deck, plan, speaker notes): `docs/checkins/checkinN/`.
- Final hand-in (deck with speaker notes beside it as Markdown, report, AI log, declaration): `docs/final/`.
- Defect write-ups (seven questions, Working Guide §6): `docs/DEFECT_CATALOG.md`.
- Shared Python code: `src/`, once the same code is needed in two places (D-012).
- Figures: `docs/figures/`, built by a script in `scripts/`.
- A file that is superseded: move what's still true to its home, then delete it (git keeps it).

## Before you finish a task

- Results changed: rerun the notebook, then `uv run python scripts/build_findings.py`.
- You made a treatment or scope choice: append it to `docs/DECISIONS.md` (never rewrite old entries).
- The state changed (something done, started or blocked): update `docs/STATUS.md` and its date.
- New rule: `docs/RULES.md`. New threshold: `config/`.
- Run `uv run python scripts/check_docs.py` and the test for what you touched.

## Commands

```bash
uv sync                                      # set up the environment
tests/run_notebook.sh                        # run notebook 02 headless on the full data (~1 min); rebuilds outputs/
tests/fixture_test.sh                        # notebook 02 on the made-up fixture (~15 s)
tests/robustness_test.sh                     # shuffled rows + one threshold change (~5 min, ~4 GB RAM)
uv run python scripts/build_findings.py      # outputs/02_defect_register.csv -> docs/FINDINGS.md
uv run python scripts/check_docs.py          # broken paths in living docs, stale FINDINGS
```

## Check-ins

Plan each check-in strictly from the brief's "Bring this" list (brief §8). No extras.
