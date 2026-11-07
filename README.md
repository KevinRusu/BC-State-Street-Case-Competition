# State Street Case Competition — Team Workspace

4th Annual Fall into BC Case Competition. Competition materials and the original package README are in [reference/](reference/README.md).

> **Confidential data.** The dataset may not be shared through public repositories, dashboards or AI links. Keep this repo **private**: `data/` is committed, so making it public would expose the data, and deleting it afterwards would not remove it from git history.

## Setup

Requires [uv](https://docs.astral.sh/uv/) (`brew install uv`). Graphviz is needed only to rebuild the diagrams (`brew install graphviz`).
To run the dashboard you also need [Node.js](https://nodejs.org/) 20.9 or newer.

**Windows.** In PowerShell, install Git for Windows (it brings Git Bash), uv and Node.js LTS:

```powershell
winget install --id Git.Git
winget install --id astral-sh.uv
winget install --id OpenJS.NodeJS.LTS
```

Close and reopen the terminal afterwards. Run the `.sh` scripts (`tests/run_notebook.sh` and the other test scripts)
in Git Bash, for example `bash tests/run_notebook.sh`; every `uv` and `npm` command works in PowerShell too. If a
`.sh` script fails with `\r: command not found`, git checked it out with Windows line endings; run
`git checkout HEAD -- "tests/*.sh"` once (`.gitattributes` keeps `.sh` files on Unix line endings from now on).

To run the dashboard, follow [dashboard/README.md](dashboard/README.md#run-it) after `uv sync`.

```bash
uv sync                       # creates .venv with Python 3.12 + all dependencies
uv run nbstripout --install   # once per clone: strips notebook outputs when you commit
uv run jupyter lab            # or open a notebook in VS Code and pick the .venv kernel
```

Run notebooks in place in `notebooks/`. Your local file keeps its outputs; nbstripout removes them from what goes into Git, so data rows never reach the repo and diffs stay small. Keep one copy of each notebook (no executed duplicates).

Add a package with `uv add <name>` (or `uv add --dev <name>` for tooling), then commit `pyproject.toml` and `uv.lock` together.

## Layout

Where we are and what's next: [docs/STATUS.md](docs/STATUS.md). How agents should work in this repo: [CLAUDE.md](CLAUDE.md).

```
data/              raw competition data (.csv.gz): read-only, never write here
reference/         brief, dataset guide, working guide as Markdown (tracked)
  official/        original PDF and Word files (NOT committed, copy them in from the package)
config/            thresholds and rule settings (never hard-code these in code)
notebooks/         analysis and evidence notebooks (edit the .ipynb directly); 02_reconcile is the one that
                   writes the register; 03_error_severity adds NAV sensitivity and account breadth
dashboard/         local Next.js app over outputs/store.duckdb (see dashboard/README.md); never deploy it
web/               the offline Sankey and UpSet views (built by scripts/build_sankey.py, build_upset.py)
scripts/           build figures, the framework workbook and docs/FINDINGS.md; check the docs
                   (build_slides.py and add_journeys.py were one-off fillers for the Check-in 1 deck)
tests/             test scripts and a small made-up fixture (tests/runs/ is gitignored)
outputs/           results (gitignored, rebuildable from data/ + code)
src/               shared Python code (not yet: added when the code leaves the notebooks)
docs/
  STATUS.md        where we are, next steps, owners, open questions
  DECISIONS.md     every treatment and scope choice, append-only
  FINDINGS.md      one line per finding, generated from outputs/ (do not edit)
  RULES.md         the detailed rules under our 7 checks
  DEFECT_CATALOG.md the seven-question write-ups of the defect classes we take forward
  SANKEY_GUIDE.md, UPSET_GUIDE.md   how to build and read the Sankey and UpSet views
  Framework.xlsx   the Check-in 1 framework tables (built by scripts/make_framework_xlsx.py)
  figures/         generated diagrams (built by scripts/)
  checkins/        what we handed in at each check-in (checkin1/, checkin2/); history, not edited afterwards
  final/           the final hand-in
AI_Logs/           exported AI chats (gitignored; needed for the final hand-in)
load_data.ipynb    provided loader/integrity checker; must stay beside manifest.csv
manifest.csv       row counts and checksums for data/
data_dictionary.csv
```

To rebuild a figure, run its script with an output path, for example
`uv run python scripts/fig_detection.py docs/figures/03_detection_matrix.png`.

After rerunning notebook 02, regenerate the findings and check the docs:

```bash
uv run python scripts/build_findings.py
uv run python scripts/check_docs.py
```

## Tests

Run from the repo root. The notebook tests run the committed notebooks headless, without rebuilding them.

- `tests/fixture_test.sh` (~25 s): runs notebook 02 on the made-up data in `tests/fixtures/small/` under the default
  config, shuffled rows, `holding_date = "settlement"`, a trace flag no key carries and an edge copy of the fixture,
  then notebook 03 under the R3 reading, and checks the outcomes the fixture was built to contain.
- `tests/robustness_test.sh` (~5 min): runs the release with rows shuffled under several seeds and with one
  threshold changed, and checks that only what should move does. About 4 GB RAM per run; it leaves the default
  run in `outputs/`.
- `tests/store_test.sh`: builds the dashboard store from the fixture, checks its contracts, then runs the dashboard's
  unit tests and a production build. Inside `dashboard/`: `npm test` and `npm run test:e2e` (see its README).
- `uv run python -m unittest discover -s tests -p 'test_*.py'`: the Python unit tests (the Sankey findings builder
  and the docs checker).

## Anomaly Sankey

Run `uv run python scripts/build_sankey.py`, then open `outputs/sankey/index.html`
in a browser. The offline view provides population, category and evidence-status
filters, an accessible table, and SVG / high-resolution PNG export. It counts
flags within one population at a time; distinct affected entities are shown
separately. The same record-level findings CSV and Parquet can feed the companion
UpSet chart. Generated data and exports stay private under `outputs/`.

See [the Sankey guide](docs/SANKEY_GUIDE.md) for counting grains,
assessment provenance, limitations and validation commands.

## Anomaly overlap / UpSet

Run `uv run python scripts/build_upset.py`, then open `outputs/upset/index.html`.
This refreshes the shared findings and both charts. The UpSet groups unique
entities by exact selected-flag combinations, including single-flag records.
It provides check/status/population filters, record-evidence previews, an
all-combination table and CSV, plus SVG / high-resolution PNG export. Counted
populations remain separate; overlap is not presented as correlation or causation.

See [the UpSet guide](docs/UPSET_GUIDE.md) for counting and validation details.

## Working conventions

- **Never modify `data/`.** Derived tables go in `outputs/`.
- **No version suffixes in file names** (`_v2`, `_final`, `_Draft`); git keeps the history.
- **Excel, PowerPoint and Word files can't be merged.** Agree on one owner per file before editing, and pull before you start.
