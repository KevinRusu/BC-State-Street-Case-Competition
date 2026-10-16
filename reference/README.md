# State Street case competition — student package

4th Annual Fall into BC Case Competition · Industry sponsor: State Street.

## Start here

1. `01_Student_Brief.pdf` — the case, the deliverables and the rubric. This is the only statement of requirements.
2. `02_Dataset_Guide.pdf` — read before you join or transform any table.
3. `03_Student_Working_Guide.pdf` — optional advice on approach, week by week. Nothing in it is graded, and it contains no results for this dataset.

Editable Word copies of all three are included.

## Contents

- `data/` — ten complete tables, each supplied once as `.csv.gz`.
- `manifest.csv` — file names, row counts, column counts, sizes and SHA-256 checksums.
- `data_dictionary.csv` — every column, its intended type, meaning and caveats.
- `load_data.ipynb` — a loader and integrity checker. It does not clean the data or solve anything.

There is no sample dataset. Every team receives the same full release: 100,000 accounts, 1,409,533 transactions and 1,409,533 pipeline records. File verification confirms delivery, not that the data is correct.

## Load and verify

Extract the ZIP completely. Open `load_data.ipynb` in JupyterLab, Jupyter Notebook or a notebook-capable editor, select a Python 3 environment with pandas installed, and run the cells from top to bottom.

Keep the notebook beside `manifest.csv` and `data/`. If automatic discovery fails, set `ROOT` to the extracted `State_Street_Case_Student_Package` folder. The verification cell checks all ten files against the manifest.

The loader keeps every field as a string, including empty strings. Numeric and date conversion are part of your pipeline; keep the raw values and any parsing exceptions. ISO dates use YYYY-MM-DD; slash dates use DD/MM/YYYY for this case.

R users can load compressed CSV directly:

```r
accounts <- read.csv(gzfile("data/accounts.csv.gz"),
                     colClasses = "character", na.strings = character(),
                     check.names = FALSE)
```

The large tables exceed an Excel worksheet. Use code, a database such as DuckDB, or chunks if memory is limited. You may sample for development, keeping related records together, but final results must run on the full release.

## Boundaries

Cash and accrual detail, account-level corporate-action posting logs, issue-management logs and NAV correction histories are not included. Explain what their absence prevents you from proving. Do not invent missing records or present investment-value differences as realized losses.

## Confidentiality and AI

The data is synthetic and provided for this competition only. Do not redistribute it or expose it through public repositories, public dashboards or public AI links. Generative AI is permitted under the conditions in the brief, and you submit the conversation logs that shaped your work.
