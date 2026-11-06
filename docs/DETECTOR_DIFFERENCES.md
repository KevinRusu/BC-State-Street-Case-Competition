# Detector differences (for the team to decide)

*Written 6 Nov during the Job A code review. This is a list of differences, not a ruling. Once the team decides,
record the outcome in DECISIONS.md and delete this file.*

Three pieces of code detect defects independently:

| Code | Feeds | Author |
|---|---|---|
| `notebooks/02_reconcile.ipynb` | the register (`outputs/02_defect_register.csv`), FINDINGS.md, the dashboard, the deck | team (the reference) |
| `scripts/findings.py` (with `config/findings.json`) | the Sankey and UpSet views (`scripts/build_sankey.py`, `build_upset.py`) | Sankey branch, 27 Oct |
| `notebooks/02_quantity_mismatches.ipynb` | `outputs/02_quantity_mismatches/` (study examples) | Sankey branch, 27 Oct |

When two of them count the same thing differently, the charts and the register can disagree on screen.

## `scripts/findings.py` vs notebook 02

| Topic | Notebook 02 | findings.py | Question for the team |
|---|---|---|---|
| Book vs custodian | equal within `quantity_match_tolerance` (config) | exact `b.q <> c.q`, no tolerance | Use the config tolerance? |
| Trade rebuild | removes duplicate copies, drops CANCELLED, handles REVERSED by policy (D-044, D-045, D-007) | raw BOOKED-only benchmark that keeps duplicate rows (it says so in its description) | Is a separate raw benchmark wanted, or should it read notebook 02's chain? |
| Price with no FX rate | looks the rate up per currency **and price date**; USD needs no rate | checks only that the currency appears in `fx_rates` on **any** date | Use the date-aware lookup? |
| More than one REVERSED row per original | counts distinct IDs | counts rows, so a REVERSED row delivered twice counts twice | Count IDs? |
| USD rate not 1 | an unreadable rate counts as a defect (review item P3: latent) | an unreadable rate is not evaluable | findings.py is the better rule here |
| Finding statuses | its own register (`confirmed` / `unresolved` / `cleared`) | read from notebook 01's text (`assessment_notebook`); notebook 01 still labels negative quantities "sign contradicts gross_amount", which D-043 retired | Read statuses from notebook 02's register? |
| Snapshot settings | `config/reconciliation.toml` | `config/exploration.toml` (`as_of_date` and tolerances are repeated) | One config for both? |

## `notebooks/02_quantity_mismatches.ipynb` vs notebook 02

| Topic | Notebook 02 | 02_quantity_mismatches | Question for the team |
|---|---|---|---|
| Reading CSVs | DuckDB `all_varchar` for every table (CLAUDE.md rule) | `csv`/pandas as text for most tables; DuckDB only for transactions | Switch to DuckDB? |
| Quantities | float, compared within the config tolerance | Python `Decimal`, exact comparison, no tolerance | Which comparison do we present? |
| Trade benchmark | the main rebuild chain | raw BOOKED trades from a hard-coded `WINDOW_START`, duplicates kept; a negative quantity blocks the key | Move the window start to config? |
| Settlement benchmark | `custodian_settlement_date_basis` cause rule | its own scheduled-settlement benchmark | Same idea, two implementations |
| Sampling | none | fixed `SEED` (study examples only) | Fine as-is; note it in config? |
| Name | – | its `02_` prefix collides with notebook 02 | Rename? |
| Docs | in RULES.md, DECISIONS.md and tests | not mentioned in any living doc or test | Keep (and document) or delete? |
