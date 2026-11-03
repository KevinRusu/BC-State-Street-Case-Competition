# Which anomaly flags occur together?

The Sankey counts individual flags. This UpSet counts **unique entities by their exact combination of selected flags**. The views share check definitions, source findings, evidence statuses, snapshots, and visual tokens. Co-occurrence is descriptive; it does not establish correlation or causation.

## Regenerate and open

From the repository root:

```powershell
uv run python scripts/build_upset.py
Start-Process .\outputs\upset\index.html
```

On another operating system, open `outputs/upset/index.html` in a browser. No web server, new Python dependency or network access is needed. The command regenerates the canonical findings under `outputs/sankey/`, refreshes the Sankey from those findings, and builds the UpSet. The standalone Sankey command refreshes only the Sankey; use this command when both views need to agree with a new run.

The raw files stay read-only. Generated charts, evidence previews, CSVs, screenshots and exports remain private and Git-ignored under `outputs/`. A changed raw release needs a deliberately verified manifest, as described in the Sankey guide.

## Read the chart

- The vertical bars count unique entities in **exclusive** combinations. A column with A and B filled means A and B are flagged and no other **selected** checks are flagged, after applying the status filter.
- The aligned dots identify the checks in that column. A single filled dot is a single-flag combination. Connected filled dots show multiple selected flags. Muted dots are not proof that a check passed.
- The horizontal bars count entities flagged by each individual selected check. An entity can contribute to several of these bars.
- The three summaries show all distinct entities with selected flags, their total selected flags, and the number with two or more selected flags.
- Changing selected checks can merge combinations. Filtering to Confirmed defect can turn a previously combined record into a single-flag record if its other flag was unresolved.

Percentages use **all entities with at least one currently selected flag** as their named denominator. The optional multiple-flag focus and display limit affect plotted combinations, not this denominator or the three summaries. The omission note separately reports records excluded by the focus and records/combinations hidden by the display limit.

The default is holdings, all three evidence statuses, and the first eight available checks (seven on the current holdings population). Choose another homogeneous population, apply a category preset or expand “Change checks.” Single-flag combinations are included by default. Order by count or combination size; choose All combinations to remove the display limit.

The count with **no selected flags** is shown only when the eligible population is known. It can include untested inputs, unavailable checks or flags outside the selection. It is not a pass count.

## Evidence drill-down and exports

Select a bar/matrix column, using a pointer or keyboard Enter/Space, or select “Inspect records” in the accessible table. The compact table shows up to 20 contributing entities in stable-key order, their selected memberships and evidence assessments. Each row links to a generated evidence page containing that entity's original source references, physical data-row numbers, observed fields and assessments before viewer filters. This deterministic preview is not a representative sample.

SVG and three-times-resolution PNG preserve the current chart, filters, selected check labels, title, subtitle, counting note, legend and omitted-count disclosures. Export all-combinations CSV contains every combination in the current focus, including those hidden by the display limit. It records selected check IDs and definitions, evidence statuses, population/unit, focus, ordering, display limit, combination membership indicators, record counts and named-denominator percentages.

Complete generated outputs:

| File | Purpose |
|---|---|
| `outputs/sankey/findings.csv` / `.parquet` | Canonical record/check findings, shared with the Sankey |
| `outputs/upset/cohorts.json` | Disjoint cohorts with identical full check/status membership and bounded evidence previews |
| `outputs/upset/memberships.csv` | Complete flagged-entity membership keys and original evidence statuses; one row per entity within its population |
| `outputs/upset/intersections.csv` | Default all-check/all-status exact combinations for every population |
| `outputs/upset/evidence/` | Private source-evidence pages for the preview entities |
| `outputs/upset/validation-cases.json` | Direct-record reference results for check/status selections |

The browser receives only precomputed membership cohorts and bounded previews. It does not load raw transactions, prices or holdings, or ship millions of unflagged records. Counts are never estimated from the previews. Projection of disjoint cohorts is exact, including when check selection or evidence status changes. Preview keys retain physical-row identity where business transaction IDs repeat.

## Population boundaries and missing evidence

The nine populations retain the Sankey's counting grains. Transaction-ID cases, pipeline-ID cases and reversal-original cases are **excluded from transaction-row intersections**. No validated conversion to transaction rows is supplied, so the viewer explains the exclusion and offers separate case-population views. It never infers a mapping based on row order or a shared-looking identifier.

Per-check unevaluable counts remain visible separately. They are not added to a unique unevaluable-entity total because their record-level overlaps are not supplied. A missing flag is never converted into a passed check. Unavailable checks are disabled and named with a reason. Missing membership coverage fails validation instead of producing estimated intersections.

Statuses are the same source assessments and unresolved defaults as the Sankey; the UpSet does not create new clearances or explanations. A Cleared flag filter can therefore have no results. The raw BOOKED-only benchmark and other source limitations remain applicable; see `SANKEY_GUIDE.md`.

The shared `web/visualization-theme.json` and `web/visualization.css` retain the same font, category/status mapping, spacing and number formatting. Mixed-category intersections use navy rather than an arbitrary category color; teal marks a selected combination. The palette remains explicitly provisional, not verified official branding.

## Validation

```powershell
uv run python -m unittest discover -s tests -p 'test_*.py' -v
```

Tests cover single-flag and combined entities, idempotent repeated findings, preserved physical-row identity, separate populations, status-first projection, merging combinations after deselecting checks, bounded previews with exact full counts, and conservation across check/status selections.

The builder independently projects the source findings directly by entity and compares those results to cohort projection. For populations with at most eight checks, it verifies every check subset under all statuses and each individual status. On the current release this covers 904 selections.

Optional visual and browser validation, using a local Node/Playwright installation:

```powershell
node tests/inspect_upset.cjs 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
```

This checks the independent projection references, actual population/category/status controls, sums including hidden combinations, individual check totals, weighted flag conservation, ordering, multiple-flag focus, deselection, bar/matrix alignment, keyboard tooltips and drill-down, source-evidence anchors, all-combination CSV, SVG/PNG rendering, empty states, mobile page bounds and absence of network requests. Screenshots and validation reports are saved privately under `outputs/upset/`.
