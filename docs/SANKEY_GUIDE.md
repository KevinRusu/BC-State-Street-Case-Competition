# Anomaly flags and evidence status

This local, offline view answers **“What are we detecting, and how have we assessed the findings?”** Links describe classification and evidence assessment, never historical propagation or remediation. The companion UpSet can use the same findings to answer **“Which checks affect the same entities?”**

## Generate and open

From the repository root:

```powershell
uv run python scripts/build_sankey.py
Start-Process .\outputs\sankey\index.html
```

On another operating system, open `outputs/sankey/index.html` in a browser. No server, API key, network access or notebook execution is needed. The builder uses the existing Python dependencies. Default runtime is recorded in `metadata.json`; input checksums and row counts must match `manifest.csv`. Test copies need their own manifests.

Choose one population, an evidence status, and optionally a category. Reset returns to all assessed holdings flags. SVG and PNG export the current filters; PNG is three times the SVG dimensions. Exports preserve the title, subtitle, legend, snapshot, selected totals, filters and counting note. The generated output folder is ignored by Git and must remain private.

The source contains no verified reusable brand assets or official tokens. `web/visualization-theme.json` is an explicitly provisional State Street-inspired theme. It centralizes typography, spacing, category/status colors and number formatting for this view and the companion UpSet. `web/visualization.css` supplies shared layout styles. No external fonts, chart libraries or network resources are requested.

## Shared data contract

The canonical output is `outputs/sankey/findings.csv`, also exported as Parquet. Each finding has:

- `analysis_snapshot`, `population`, stable `entity_key`, `check_id`;
- `category`, `anomaly`, `status`;
- `assessment_reference`, `assessment_defaulted`;
- `source_table`, `source_file`, `source_sha256`, `raw_row_lineage`;
- `evidence_reference` and structured JSON `evidence`.

Uniqueness is **snapshot + population + entity key + check ID**. A repeated run or duplicate ingestion cannot add another instance. A contradictory classification for the same identity raises an error. One entity failing three checks contributes three flags and one distinct affected entity.

`metadata.json` supplies check definitions, eligibility/unevaluable counts, population denominators, input fingerprints, assessment provenance, row accounting and limitations. `aggregates.json` contains category/anomaly/status aggregates. The HTML contains only compact entity-membership indices, not raw business IDs. Those indices support exact distinct-entity unions after filtering.

For an UpSet, select **one** population, pivot the CSV/Parquet on `entity_key` and `check_id`, and use Boolean membership. Do not use flag counts as unique-entity intersection sizes. Entity keys, not browser-only integer indices, are the cross-view join contract.

## Populations and counting grains

| Population | One entity | Important distinction |
|---|---|---|
| Holdings | Account + security + normalized snapshot date | Universe is the union of valid book and custodian keys. Most checks concern book holdings. |
| Transaction rows | Input-file checksum + physical data-row number | Repeated transaction IDs remain separate physical rows. All recorded statuses are included unless a check narrows them. |
| Transaction ID cases | Transaction ID | Each duplicate group counts once; every member row is retained as evidence. It is not a pair count or duplicate-row count. |
| Pipeline ID cases | Pipeline transaction ID | One group case, separate from transaction groups. |
| Reversal-original cases | Original ID referenced by reversals | Multiple reversal rows count as one flagged original-ID case. |
| Corporate-action events | Unique action ID | Multiple questionable terms still produce only one event/check flag. |
| Preferred-quote opportunities | Security + date + vendor | Expected cases from observed preferred pairs crossed with observed price dates; missing quotes have no physical source row. |
| Vendor price rows | File checksum + physical price-row number | Not interchangeable with expected-quote cases. |
| FX rows | File checksum + physical FX-row number | Counts source observations. |

The UI never offers a combined-population unique-record KPI. Total flags, distinct affected entities, percentages, and tables all respect the selected homogeneous population. Percentages next to branches and in tooltips use **all flags remaining after the current filters** as their named denominator. Affected-entity coverage uses the full eligible entity population; filtering changes the affected union, not that population denominator.

## Detection and assessment provenance

All 25 requested checks are defined in `config/findings.json`; SQL implementations are in `scripts/findings.py`. No previously discussed counts or defective record IDs are embedded in detection code. Configurable reconstruction and gross-amount tolerances come from `config/exploration.toml`.

The builder parses literal assessment strings from the existing notebook's defect catalog without executing the notebook. It maps these to Confirmed defect / Unresolved hypothesis / Cleared flag. It also records the original assessment, exact notebook cell and notebook checksum. Existing labels are preserved; this visualization does not newly adjudicate causes or invent cleared examples.

The book/custodian disagreement check has no matching entry in that catalog. Its assessment therefore defaults to unresolved, and the UI reports how many selected flags are defaulted. If the corporate-action field-use matrix is absent, the terms check becomes **unavailable**, with no zero substituted. The table displays the reason. A schema or uniqueness failure stops generation instead of silently picking rows.

Important refinements and limits:

- Exact and date-normalized duplicates count ID groups, not the original catalog's physical member rows. Date normalization is permitted by the guide; the repeated ID is the flagged condition.
- Rebook-amount detection requires an unambiguous target and matching account/security. On the current release, 11 cross-account/security links that met the earlier amount test are excluded, giving 3,317 flags rather than the previously quoted 3,328. Additional missing/ambiguous target inputs are included in the check's unevaluable count. No “first copy wins” rule is used.
- Corporate-action terms use the notebook's `GUIDE_FIELD_USE` interpretation, which is explicitly unresolved. An event is counted once even if several unexpected fields are filled.
- The BOOKED-only reconstruction retains physical duplicates and raw negative signs, starts at zero, and applies no corporate actions. Invalid quantities, trade dates and transaction types make affected benchmark keys unevaluable. The result is a transparent benchmark disagreement, not proof of a bad book. The previously reviewed settlement-date and reversal scenarios are not used here.
- No-vendor coverage means a held security is absent from the entire price extract. It does not mean its execution price is missing. The preferred-quote check covers the observed date/vendor grid and does not establish that the fallback price is usable.
- A zero cleared count means no corresponding clearance assessment was supplied; it is not evidence that every flag is an error.
- Cause, loss, NAV impact, actual settlement, corporate-action application, detection history and remediation are not inferred.

## Validation

```powershell
uv run python -m unittest discover -s tests -p test_findings.py -v
```

The tests inject defects and legitimate look-alikes into a separate, schema-compatible synthetic fixture. They verify three checks on one transaction, duplicate-ingestion idempotency, conflicting-assessment rejection, group evidence lineage, normalization of legitimate slash dates, unchanged aggregates after shuffling, status/category count conservation, missing-assessment defaults and unavailable checks.

Browser inspection is optional for regeneration but required when changing presentation code. With Node.js and Playwright available:

```powershell
node tests/inspect_sankey.cjs 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
```

This checks every available population/category/status combination against the shared data, positive flow geometry, accessible focus highlighting, empty states, mobile page bounds, absence of network requests and actual SVG/PNG rendering. It writes presentation exports, desktop/mobile/event/empty screenshots and `browser-validation.json` into the private output folder. Playwright is only an optional browser-test dependency; opening and exporting the chart needs no Node tooling.
