# State Street Case Competition — Team Workspace

4th Annual Fall into BC Case Competition. Competition materials and the original package README are in [etc/](etc/README.md).

> **Confidential data.** The dataset may not be shared through public repositories, dashboards or AI links. Keep this repo **private**: `data/` is committed, so making it public would expose the data, and deleting it afterwards would not remove it from git history.

## Setup

Requires [uv](https://docs.astral.sh/uv/) (`brew install uv`). Graphviz is needed only to rebuild the diagrams (`brew install graphviz`).

```bash
uv sync                       # creates .venv with Python 3.12 + all dependencies
uv run jupyter lab            # or open a notebook in VS Code and pick the .venv kernel
```

Add a package with `uv add <name>` (or `uv add --dev <name>` for tooling), then commit `pyproject.toml` and `uv.lock` together.

## Layout

```
data/            raw competition data (.csv.gz) — read-only, never write here
etc/             competition brief, dataset guide, working guide
notebooks/       analysis and evidence notebooks
docs/            deliverables: reports, spine workbook, check-in decks
  figures/       generated charts
    src/         scripts that produce them
outputs/         intermediate results (gitignored — rebuildable from data/ + code)
load_data.ipynb  provided loader/integrity checker; must stay beside manifest.csv
manifest.csv     row counts and checksums for data/
data_dictionary.csv
```

Add a `src/` folder for shared Python once the same code shows up in more than one notebook.

## Working conventions

- **Never modify `data/`.** Derived tables go in `outputs/`.
- **No version suffixes in file names** (`_v2`, `_final`, `_Draft`); git keeps the history.
- **Excel, PowerPoint and Word files can't be merged.** Agree on one owner per file before editing, and pull before you start.
