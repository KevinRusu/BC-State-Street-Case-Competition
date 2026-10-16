# Instructions for Claude Code

Read `docs/notes/PROJECT_SUMMARY.md` first: it explains the case, what is done, and what comes next.
Before any join or data transformation, follow `reference/02_Dataset_Guide.md` (summarised in section 7b of the summary). `reference/03_Student_Working_Guide.md` has advice on traces, clearing flags and writing findings.

## Rules for this repo

- The data is confidential. Never put it anywhere public.
- Never modify files in `data/`. Write results to `outputs/`.
- Read all CSVs as text first (DuckDB `all_varchar=true`), then convert types explicitly and keep the values that fail.
- Dates come as `YYYY-MM-DD` or `DD/MM/YYYY`. Settlement lag is counted in business days.
- Never hard-code defect record IDs. Thresholds go in a config file, not in the code.
- Detection must be rule-based and reproducible. AI can explain results, not find them.
- No version suffixes in file names. Use `uv` for packages.
- The brief is the only statement of requirements. Read the Markdown copies in `reference/`. The official PDFs and Word files live in `reference/official/` (not committed; get them from the competition package).
