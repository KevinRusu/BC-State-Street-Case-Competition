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

```
data/              raw competition data (.csv.gz): read-only, never write here
reference/         brief, dataset guide, working guide as Markdown (tracked)
  official/        original PDF and Word files (NOT committed, copy them in from the package)
config/            thresholds and rule settings (never hard-code these in code)
src/               shared Python code (add once the same code appears in two notebooks)
scripts/           scripts that build figures, the framework workbook and slides
notebooks/         analysis and evidence notebooks
outputs/           intermediate results (gitignored, rebuildable from data/ + code)
docs/
  notes/           project summary, rules draft, deliverables guide, team notes
  checkin1/        Check-in 1 report (md + pdf) and the faculty deck
  presentations/   main presentation and explainer deck
  figures/         generated charts (built by scripts/)
  Framework.xlsx
load_data.ipynb    provided loader/integrity checker; must stay beside manifest.csv
manifest.csv       row counts and checksums for data/
data_dictionary.csv
```

To rebuild a figure, run its script with an output path, for example
`uv run python scripts/fig_detection.py docs/figures/03_detection_matrix.png`.

## Anomaly Sankey

Run `uv run python scripts/build_sankey.py`, then open `outputs/sankey/index.html`
in a browser. The offline view provides population, category and evidence-status
filters, an accessible table, and SVG / high-resolution PNG export. It counts
flags within one population at a time; distinct affected entities are shown
separately. The same record-level findings CSV and Parquet can feed the companion
UpSet chart. Generated data and exports stay private under `outputs/`.

See [the Sankey guide](docs/notes/SANKEY_GUIDE.md) for counting grains,
assessment provenance, limitations and validation commands.

## Anomaly overlap / UpSet

Run `uv run python scripts/build_upset.py`, then open `outputs/upset/index.html`.
This refreshes the shared findings and both charts. The UpSet groups unique
entities by exact selected-flag combinations, including single-flag records.
It provides check/status/population filters, record-evidence previews, an
all-combination table and CSV, plus SVG / high-resolution PNG export. Counted
populations remain separate; overlap is not presented as correlation or causation.

See [the UpSet guide](docs/notes/UPSET_GUIDE.md) for counting and validation details.

## Working conventions

- **Never modify `data/`.** Derived tables go in `outputs/`.
- **No version suffixes in file names** (`_v2`, `_final`, `_Draft`); git keeps the history.
- **Excel, PowerPoint and Word files can't be merged.** Agree on one owner per file before editing, and pull before you start.
