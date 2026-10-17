# State Street Case Competition — Team Workspace

4th Annual Fall into BC Case Competition. Competition materials and the original package README are in [reference/](reference/README.md).

> **Confidential data.** The dataset may not be shared through public repositories, dashboards or AI links. Keep this repo **private**: `data/` is committed, so making it public would expose the data, and deleting it afterwards would not remove it from git history.

## Setup

Requires [uv](https://docs.astral.sh/uv/) (`brew install uv`). Graphviz is needed only to rebuild the diagrams (`brew install graphviz`).

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
notebooks/         analysis and evidence notebooks (edit the .ipynb directly)
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
  Framework.xlsx   the Check-in 1 framework tables (built by scripts/make_framework_xlsx.py)
  figures/         generated diagrams (built by scripts/)
  checkins/        what we handed in at each check-in (checkin1/, checkin2/); history, not edited afterwards
  final/           the final hand-in, once we start it
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

## Tests for notebook 02

Run from the repo root. Both run the committed notebook headless, without rebuilding it.

- `tests/fixture_test.sh` (~15 s): runs the notebook on the made-up data in `tests/fixtures/small/` under the default
  config, shuffled rows, `holding_date = "settlement"` and a trace flag no key carries, and checks the outcomes the
  fixture was built to contain.
- `tests/robustness_test.sh` (~5 min): runs the release with rows shuffled under several seeds and with one
  threshold changed, and checks that only what should move does. About 4 GB RAM per run; it leaves the default
  run in `outputs/`.

## Working conventions

- **Never modify `data/`.** Derived tables go in `outputs/`.
- **No version suffixes in file names** (`_v2`, `_final`, `_Draft`); git keeps the history.
- **Excel, PowerPoint and Word files can't be merged.** Agree on one owner per file before editing, and pull before you start.
