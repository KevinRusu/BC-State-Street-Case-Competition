# Stress Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A script that injects 100x snapshot prices into a seeded random sample of real held equities on a copy of
the release, runs the unchanged deliverable notebook on the clean and the injected data, and scores every case against
the truth it planted, with rates, false positives on untouched securities, a money impact and a record-level showcase.

**Architecture:**
- **Labels:** `tests/stress/cases.toml` holds the seed, sizes, multiplier, role definitions and the line-to-level
  map. The detection code never reads it.
- **Logic:** `scripts/stress.py` holds pure functions (sample, edit, score, impact, write) and a small CLI with two
  subcommands: `build` (sample + copy) and `score` (compare + outputs).
- **Driver:** `tests/stress_test.sh` runs: clean deliverable run, `stress.py build`, injected run, `stress.py score`.
- **Report:** `scripts/build_findings.py` gains a generated "Stress test" section.

**Tech Stack:** Python 3.12, pandas, numpy, `tomllib`, `decimal`, `csv`, `gzip`, `hashlib`; bash; unittest.
No new dependency.

**Spec:** `docs/superpowers/specs/2026-11-11-stress-test-design.md` (read it first; this plan does not repeat its
reasoning).

## Global Constraints

- **No commits:** the user commits. Each task ends with a checkpoint (tests green, `git status` reviewed). One
  extra checkpoint before the first injected run: the user commits `tests/stress/cases.toml` (spec §5.6).
- Never modify `data/`, `reference/`, `notebooks/deliverable.ipynb` or `config/*.toml`. `outputs/02_*` must be
  byte-identical before and after this work (the stress runs write to `tests/runs/`).
- The copy lives only under `tests/runs/` (gitignored). The data is confidential.
- No record ID (security_id, account_id, …) in any versioned file. Picked IDs appear only in `outputs/03_stress_*.csv`,
  in `tests/runs/` and in the generated FINDINGS section, as the register's examples already do.
- Read every CSV as text (`dtype=str, keep_default_na=False`); dates through a `normalise_date` equal to the
  notebook's (YYYY-MM-DD and DD/MM/YYYY → YYYY-MM-DD).
- Multiplier exactly 100; the new price is `str(Decimal(old) * Decimal(multiplier))`.
- Sample: 30 defects, 30 look-alikes, 30 flips; seed in `cases.toml`; disjoint securities.
- Snapshot date and reporting currency come from the config the run uses (`[snapshot] as_of_date`,
  `[fx] reporting_currency`), never typed into `stress.py`.
- Exit code of `stress.py score`: non-zero only for a false positive on an untouched security or an unattributable
  member change, and only after every output is written.
- Run the unit suite with `uv run python -m unittest discover tests`.

## Review Focus

1. **Byte fidelity of the copy:** every untouched row of `prices` and all nine other tables must be byte-identical to
   `data/`, including line endings and quoting. Task 2 tests a no-edit round trip on the fixture's `prices.csv` and
   gzip round-trip equality.
2. **Row order:** shuffling `prices`, `positions` or the clean outputs must not change the draw. Task 1 tests it.
3. **A security with only one eligible quote, or whose chosen vendor is not VENDOR_A:** may carry a defect only; the
   "other vendor" is the eligible non-chosen quote with the lowest priority (VENDOR_C when B is missing). Task 1 tests
   both.
4. **Members with a non-security id kind** (transaction_id, account_id, currency, ledger_id, action_id, feed/day): a
   change there cannot be pinned on an injected security and must be reported as unattributable, never silently
   dropped. Task 3 tests it.
5. **Missing FX or fund net assets:** the impact must report "not valued" with the reason, not a zero or a crash.
   Task 4 tests it.

---

## File structure

| File | Responsibility |
|---|---|
| `tests/stress/cases.toml` (create) | Labels: seed, sizes, multiplier, roles, line-to-level map, consequence kinds |
| `scripts/stress.py` (create) | All stress logic; CLI `build` and `score` |
| `tests/test_stress.py` (create) | Unit tests on small made-up frames |
| `tests/stress_test.sh` (create) | Driver: two deliverable runs around `build` and `score` |
| `scripts/build_findings.py` (modify) | `stress_lines()` appended to FINDINGS |
| `tests/test_findings.py` (modify) | Test for `stress_lines()` |
| `docs/DECISIONS.md`, `docs/STATUS.md`, `CLAUDE.md`, `README.md` (modify) | Controller writes these (Task 6) |

`stress.py` imports nothing from the notebook. The tests put `scripts/` on `sys.path` as `tests/test_findings.py`
does.

---

### Task 1: Labels file and the sample draw

**Files:**
- Create: `tests/stress/cases.toml`, `scripts/stress.py`, `tests/test_stress.py`

**Interfaces:**
- Produces:
  - `load_labels(path: Path) -> dict` (parsed TOML)
  - `normalise_date(s: pd.Series) -> pd.Series`
  - `eligible_quotes(prices: pd.DataFrame, securities: pd.DataFrame, as_of: str) -> pd.DataFrame`: snapshot rows
    whose price reads and is > 0 and whose currency equals the master currency, excluding any (security_id, vendor)
    that appears twice on the snapshot. Columns: the `prices` columns plus `price_number` and `priority` (float).
  - `draw_sample(pool: pd.DataFrame, labels: dict) -> pd.DataFrame`. `pool` has the columns `security_id`,
    `chosen_vendor`, `other_vendor` (blank when none). Returns one row per case: `case` (`defect-01` …),
    `role` (`defect` | `lookalike` | `flip`), `security_id`, `bad_vendor`, `swap_with` (blank unless flip).
  - `build_pool(clean_dir: Path, tables: dict[str, pd.DataFrame], as_of: str) -> pd.DataFrame`: equities held in
    `positions` on `as_of`, whose `02_price_quality.csv` row has a non-blank `chosen_vendor` and
    `vendor_check_result == 'pass'`. Adds `other_vendor` = the eligible non-chosen quote with the lowest `priority`
    (ties by vendor name). Securities duplicated in `securities` are left out.

- [ ] **Step 1: Write `tests/stress/cases.toml`**

```toml
# Stress test labels (spec docs/superpowers/specs/2026-11-11-stress-test-design.md §5.5-5.6).
# Read only by scripts/stress.py; the deliverable notebook never sees this file. No record IDs here.
seed = 20261111
multiplier = "100"

[sizes]
defect = 30
lookalike = 30
flip = 30

[roles]
defect = "the chosen vendor's snapshot quote x multiplier; truth: the quote our NAV uses is wrong"
lookalike = "the other vendor's snapshot quote x multiplier; truth: the quote our NAV uses is right"
flip = "as lookalike, and the other vendor swaps vendor_priority with the chosen vendor on the snapshot rows; truth: wrong"

[lines]
# section 8b split lines decide first; the raw section 8 lines only when 8b gives none
split = ["Scale flag: the chosen quote is the odd one out", "Scale flag: the chosen quote is backed by another vendor",
         "Spread flag: the chosen quote is the odd one out", "Spread flag: the chosen quote is backed by another vendor",
         "Spread or scale flag: no two vendors agree"]
raw = ["Vendor quotes on the snapshot date: scale flag (ratio near 100)",
       "Vendor quotes on the snapshot date: spread above threshold"]

[levels.wrong]       # defect and flip
caught = ["Scale flag: the chosen quote is the odd one out"]
partial = ["Spread flag: the chosen quote is the odd one out", "Spread or scale flag: no two vendors agree",
           "Vendor quotes on the snapshot date: scale flag (ratio near 100)",
           "Vendor quotes on the snapshot date: spread above threshold"]
# anything else, including a "backed" line, is missed

[levels.right]       # lookalike
cleared = ["Scale flag: the chosen quote is backed by another vendor",
           "Spread flag: the chosen quote is backed by another vendor"]
review = ["Spread flag: the chosen quote is the odd one out", "Spread or scale flag: no two vendors agree",
          "Vendor quotes on the snapshot date: scale flag (ratio near 100)",
          "Vendor quotes on the snapshot date: spread above threshold"]
false_positive = ["Scale flag: the chosen quote is the odd one out"]
# no price line at all counts as cleared ("not flagged")

[ignore]
# outputs the comparison skips: run metadata only
files = ["02_run_info.csv", "02_row_ledger.csv"]
```

- [ ] **Step 2: Write the failing tests** in `tests/test_stress.py`, class `SampleTests`, on frames built in the test:
  - `test_eligible_quotes_drops_bad_and_duplicate`: rows with price `''`, `'abc'`, `'0'`, a foreign currency, and a
    (security, vendor) pair present twice are dropped; a `'10/07/2026'` price_date counts as the snapshot.
  - `test_build_pool_rules`: a bond, a security whose `vendor_check_result` is `'spread above threshold'`, one with
    a blank `chosen_vendor`, one not in `positions` and one duplicated in `securities` are all left out.
    `other_vendor` is `VENDOR_B` when A is chosen; it is `VENDOR_C` when B has no eligible quote; it is `''` when
    only one quote is eligible.
  - `test_draw_disjoint_and_sized`: on a pool of 200 securities (150 with an `other_vendor`), sizes are 30/30/30;
    no security appears twice; every lookalike and flip has an `other_vendor`; `swap_with` equals `chosen_vendor`
    for flips and is blank otherwise; `bad_vendor` is `chosen_vendor` for defects and `other_vendor` otherwise.
  - `test_draw_ignores_row_order`: the same pool shuffled with `sample(frac=1, random_state=5)` gives an identical
    result frame.
  - `test_draw_small_pool_takes_all`: a pool of 10 securities, 4 with an `other_vendor`, gives fewer than 30 per
    role, no repeats, and every lookalike or flip still has an `other_vendor`.
  - `test_draw_empty_role_raises`: a pool with no `other_vendor` at all raises `SystemExit` naming the role.

- [ ] **Step 3: Run them, expect failures**

Run: `uv run python -m unittest tests.test_stress -v`
Expected: FAIL / ERROR (`No module named 'stress'`)

- [ ] **Step 4: Implement the five functions in `scripts/stress.py`**

The draw:
1. Sort the pool by `security_id`, then `numpy.random.default_rng(seed)`.
2. Draw the lookalikes first from the securities with an `other_vendor`, then the flips from what remains of them,
   then the defects from the whole remaining pool.
3. Use `rng.choice(n, size=min(want, n), replace=False)` on positions in the sorted frame. Number the cases in
   security_id order within each role.

- [ ] **Step 5: Run the tests, expect PASS**

Run: `uv run python -m unittest tests.test_stress -v`
Expected: all `SampleTests` pass.

- [ ] **Step 6: Checkpoint:** suite green, `git status` shows only the three new files.

---

### Task 2: Edit the prices and build the copy

**Files:**
- Modify: `scripts/stress.py`, `tests/test_stress.py`

**Interfaces:**
- Consumes: `draw_sample` output (Task 1).
- Produces:
  - `edit_prices(prices: pd.DataFrame, cases: pd.DataFrame, multiplier: str, as_of: str) -> tuple[pd.DataFrame,
    pd.DataFrame]`. Returns the edited frame (same columns, order and rows; text values) and `field_changes` with
    columns `case, role, security_id, vendor, field, old, new`. A flip produces three change rows: the price, and
    `vendor_priority` on both swapped vendors. The edit touches only snapshot rows.
  - `write_table(frame: pd.DataFrame, path: Path, like: Path) -> None`: write the frame back in the format of
    `like` (gzip if `like` ends in `.gz`; line terminator and quoting detected from `like`'s first bytes).
  - `build_copy(manifest_path: Path, cases: pd.DataFrame, labels: dict, as_of: str, out_dir: Path) -> pd.DataFrame`:
    copies every manifest file into `out_dir/data/`, rewrites `prices`, writes `out_dir/manifest.csv` (same columns;
    `prices` keeps its rows and columns but gets the new sha256 and bytes) and returns `field_changes`.

- [ ] **Step 1: Write the failing tests**, class `CopyTests`:
  - `test_round_trip_is_byte_identical`: read `tests/fixtures/small/prices.csv` as text, `write_table` it with no
    edit to a temp file `like` the original: bytes equal. The same through gzip: the decompressed bytes are equal.
  - `test_edit_multiplies_snapshot_only`: price `'269.7542'` on the snapshot → `'26975.4200'`; the same security's
    row on another date is unchanged; every other cell of the frame is unchanged (`frame.equals`).
  - `test_flip_swaps_priority_on_snapshot_rows`: the bad vendor's priority becomes the chosen vendor's old value and
    vice versa on the snapshot rows only; `field_changes` has exactly 3 rows for the flip and 1 for a defect.
  - `test_build_copy_manifest`: on the small fixture with a hand-made one-row `cases` frame (a defect on a fixture
    security): the copy has every manifest table; `prices` in the copy differs from the original in exactly one
    line; the new manifest's `rows` and `columns` equal the old; its `sha256` matches the new file.

- [ ] **Step 2: Run, expect failures**

Run: `uv run python -m unittest tests.test_stress -v`
Expected: FAIL / ERROR on the `CopyTests`.

- [ ] **Step 3: Implement the three functions**

Use `csv.writer` with the detected line terminator. If a no-edit round trip of the release's `prices` is not
byte-identical, `build_copy` raises `SystemExit` before writing anything.

- [ ] **Step 4: Run, expect PASS**

Run: `uv run python -m unittest tests.test_stress -v`
Expected: all `SampleTests` and `CopyTests` pass.

- [ ] **Step 5: Checkpoint**

---

### Task 3: Score the cases and find false positives

**Files:**
- Modify: `scripts/stress.py`, `tests/test_stress.py`

**Interfaces:**
- Consumes: `cases` (Task 1), labels (Task 1).
- Produces:
  - `member_changes(clean_dir: Path, injected_dir: Path) -> pd.DataFrame` with columns
    `finding, id_kind, record_id, security_id, change`:
    - `change` is `joined` or `left`.
    - `security_id` comes from the record (`security_id` kind: the ID itself; `account/security` kind: the part
      after `/`; any other kind: blank).
    - `id_kind` comes from the clean register's `id kind` column. A finding present in only one register gets
      `id_kind = 'new line'`.
  - `score_cases(cases: pd.DataFrame, changes: pd.DataFrame, labels: dict) -> pd.DataFrame`: `cases` plus
    `verdict_line`, `level`, `joined`, `left` (lines separated by `; `).
  - `unexplained(cases: pd.DataFrame, changes: pd.DataFrame) -> pd.DataFrame` with columns
    `kind, finding, record_id, security_id, change`:
    - `kind = 'false positive'` when the security is not injected.
    - `kind = 'unattributable'` when `security_id` is blank.
    - Injected-security changes outside the verdict lines are not listed here; they go to `consequences`.
  - `consequences(cases, changes, labels) -> pd.DataFrame`: injected-security changes outside the `split` and `raw`
    lines.
  - `output_changes(clean_dir: Path, injected_dir: Path, cases: pd.DataFrame, labels: dict) -> pd.DataFrame` with
    columns `file, rows_changed, scope, detail`:
    - Covers every `02_*.csv` except `02_defect_register.csv`, `02_finding_members.csv` and `[ignore] files`.
    - Rows are compared after a canonical sort, with the float tolerance of `tests/robustness_test.sh` (`same`:
      1e-9).
    - For files with a `security_id` column: changed rows of injected securities get `scope = 'consequence'`, those
      of other securities `scope = 'false positive'`.
    - Files without one get `scope = 'aggregate'`.
    - Register rows whose counts or text changed get `scope = 'aggregate'` with the finding name in `detail`.

- [ ] **Step 1: Write the failing tests**, class `ScoreTests`, with two hand-written register and members pairs in
  a temp dir:
  - `test_verdict_levels_wrong`:
    - a defect that joins the raw scale line and "Scale flag: the chosen quote is the odd one out" is `caught`, with
      that 8b line as `verdict_line`;
    - one that joins only "Spread or scale flag: no two vendors agree" is `partial`;
    - one that joins only "Scale flag: the chosen quote is backed by another vendor" is `missed`;
    - one that joins nothing is `missed`.
  - `test_verdict_levels_right`:
    - a lookalike that joins the raw scale line and the scale "backed" line is `cleared`;
    - one that joins the raw scale line alone is `review`;
    - one that joins "Scale flag: the chosen quote is the odd one out" is `false_positive`;
    - one that joins nothing is `cleared`, with `verdict_line = 'not flagged'`.
  - `test_untouched_security_is_false_positive`: a non-injected security joining "Chosen quote stamped after the
    NAV cutoff" appears in `unexplained` with `kind = 'false positive'`.
  - `test_account_security_member_attributed`: `ACCX/SECINJ` joining a position line, where SECINJ is injected,
    goes to `consequences`, not `unexplained`.
  - `test_non_security_member_unattributable`: a transaction_id joining any line → `kind = 'unattributable'`.
  - `test_output_changes_scopes`: a `02_price_quality.csv` pair where the injected and one untouched row change
    yields one `consequence` and one `false positive`; a `02_scorecard.csv` pair yields `aggregate`; float noise of
    1e-12 is not a change.

- [ ] **Step 2: Run, expect failures.** Command as in Task 1.

- [ ] **Step 3: Implement the five functions.** Verdict precedence (spec §5.5): the first joined line found in
  `split`, else in `raw`, else blank. Level lookup in `levels.wrong` (defect, flip) or `levels.right` (lookalike).

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Checkpoint**

---

### Task 4: Impact, rates, showcase, outputs and the CLI

**Files:**
- Modify: `scripts/stress.py`, `tests/test_stress.py`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces:
  - `impact(cases, field_changes, tables, clean_dir, as_of, reporting_currency) -> pd.DataFrame` with columns
    `case, role, security_id, fund_id, signed_usd, gross_usd, fund_net_assets_usd, signed_bps, gross_bps,
    not_valued_reason`:
    - one row per (case, fund);
    - Σ quantity × (new chosen price − `02_price_quality.chosen_price`) × FX over the security's snapshot positions;
    - lookalikes zero;
    - FX: snapshot `fx_rates` (dates normalised, unique positive `rate_to_usd`), 1.0 for the reporting currency;
    - fund via unique `accounts.account_id`;
    - fund net assets as the deliverable's severity section: Σ snapshot `ledger_nav.net_assets` per fund, NaN when a
      (fund, share_class) repeats, a value is blank or the sum ≤ 0;
    - `not_valued_reason` is one of `no FX rate`, `no fund`, `no fund net assets`, else blank.
  - `deliverable_aggregates(clean_dir, injected_dir) -> pd.DataFrame` with columns `measure, before, after`:
    - platform score and Prices domain score (`02_scorecard.csv`);
    - KPI 5 value (`02_kpis.csv`, `n == '5'`);
    - I4 value (`02_indicators.csv`, `id == 'I4'`);
    - the severity row `Vendor quotes: scale flag (ratio near 100)`: `financial_rows` and
      `gross_delta_usd_valued_subset`.
  - `rates(scored: pd.DataFrame, unexplained: pd.DataFrame) -> pd.DataFrame` with columns
    `role, level, cases, share`, plus one row `role = 'untouched', level = 'false positive'`.
  - `pick_showcase(scored, impact, pool_values) -> pd.Series[bool]`: per role defect and lookalike, the `caught`
    (resp. `cleared`) case whose held value is closest to that role's median held value, ties by security_id. Held
    value = Σ |quantity| × chosen price × FX.
  - CLI:
    - `uv run python scripts/stress.py build --manifest M --clean DIR --out DIR --config C`: draws, writes
      `cases.csv`, `field_changes.csv` and the copy into `--out`; `score --work` reads those two files back.
    - `uv run python scripts/stress.py score --clean DIR --injected DIR --work DIR --outputs DIR --config C`:
      writes into `--outputs` (default `outputs`) `03_stress_changes.csv`, `03_stress_cases.csv` (scored cases plus
      `showcase`), `03_stress_rates.csv`, `03_stress_unexplained.csv` (unexplained plus output false positives
      plus aggregate rows, with a `scope` column) and `03_stress_impact.csv` (impact rows, then the
      `deliverable_aggregates` rows with `source = 'deliverable'`).
    - `score` prints the rates and exits 1 when `unexplained` has any row of kind `false positive` or
      `unattributable`.

- [ ] **Step 1: Write the failing tests**, class `ImpactTests`:
  - `test_impact_defect`: 2 positions of quantity 10 and −4 at chosen price 5.00 → new 500.00, USD: `signed_usd`
    = 6 × 495 = 2970, `gross_usd` = 14 × 495 = 6930; bps against a fund net assets of 1e7 = 2.97 and 6.93.
  - `test_impact_lookalike_zero`.
  - `test_impact_not_valued`: an EUR security with no snapshot EUR rate gives `not_valued_reason = 'no FX rate'`
    and NaN amounts. A fund with a repeated share class gives `no fund net assets`.
  - `test_rates_shares`: 30 defects, 27 caught and 3 partial → shares 0.9 and 0.1.
  - `test_showcase_median`: among 3 caught defects valued 10, 20, 90 the one valued 20 is picked.
  - `test_score_exit_code`: the CLI on the Task 3 temp dirs exits 0 with no false positive and 1 with one, and the
    five files exist in both cases.

- [ ] **Step 2: Run, expect failures.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, expect PASS.** The whole suite: `uv run python -m unittest discover tests`.
- [ ] **Step 5: Checkpoint.** Ask the user to commit `tests/stress/cases.toml` (and the code so far) before Task 5's
  first injected run; the labels are frozen from here (spec §5.6).

---

### Task 5: The driver and the full runs

**Files:**
- Create: `tests/stress_test.sh`

**Interfaces:**
- Consumes: the CLI (Task 4); `tests/run_notebook.sh`.
- Produces:
  - `tests/stress_test.sh`, honouring `RECONCILIATION_CONFIG`, `SCORECARD_CONFIG`, `RECONCILIATION_DATA` (default
    `manifest.csv`) and `STRESS_OUTPUTS` (default `outputs`).
  - Steps:
    1. Clean run with `RECONCILIATION_OUTPUTS=tests/runs/stress_clean`.
    2. `stress.py build --out tests/runs/stress_data`.
    3. Injected run with `RECONCILIATION_DATA=tests/runs/stress_data/manifest.csv` and
       `RECONCILIATION_OUTPUTS=tests/runs/stress_injected`.
    4. `stress.py score`.
  - It prints elapsed time, and its exit status is `score`'s.

- [ ] **Step 1: Write `tests/stress_test.sh`** (`set -euo pipefail`, `cd "$(git rev-parse --show-toplevel)"`, header
  comment in the style of `tests/robustness_test.sh` naming the spec).
- [ ] **Step 2: Plumbing run on the small fixture**

Run: `RECONCILIATION_DATA=tests/fixtures/small/manifest.csv STRESS_OUTPUTS=tests/runs/stress_fixture tests/stress_test.sh`
Expected: either it completes, or it stops at `build` with the `SystemExit` naming an empty role. Either outcome is
fine; record which in the report.

- [ ] **Step 3: Record the baseline**

Run: `shasum outputs/02_*.csv > tests/runs/outputs_before.sha`

- [ ] **Step 4: Full run**

Run: `tests/stress_test.sh`
Expected:
- exit 0;
- `outputs/03_stress_*.csv` exist;
- the rates print;
- `03_stress_unexplained.csv` has no `false positive` or `unattributable` row.

If anything else happens, stop: do not edit the labels. Report the observed rows to the controller (spec §5.6).

- [ ] **Step 5: Negative check**

Write `tests/runs/config_noscale.toml`, a copy of `config/reconciliation.toml` with `scale_ratio_low = 150` and
`scale_ratio_high = 200`.

Run: `RECONCILIATION_CONFIG=tests/runs/config_noscale.toml STRESS_OUTPUTS=tests/runs/stress_negative tests/stress_test.sh`
Expected:
- defects and flips score `partial` on "Spread flag: the chosen quote is the odd one out";
- lookalikes score `cleared` on "Spread flag: the chosen quote is backed by another vendor";
- no `caught`.

Keep the rates for STATUS.

- [ ] **Step 6: Outputs untouched**

Run: `shasum -c tests/runs/outputs_before.sha`
Expected: every line OK.

- [ ] **Step 7: Checkpoint**

---

### Task 6: FINDINGS section and docs

**Files:**
- Modify: `scripts/build_findings.py`, `tests/test_findings.py`; controller: `docs/DECISIONS.md`, `docs/STATUS.md`,
  `CLAUDE.md`, `README.md`

**Interfaces:**
- Produces:
  - `stress_lines(folder: Path = OUTPUTS) -> list[str]`, appended after `scorecard_lines()` in `main()`.
  - The section opens with `## Stress test`, then:
    - a source line naming the five `03_stress_*` files;
    - the rates table (role, level, cases, share);
    - the untouched false-positive count;
    - the impact totals for defects and flips (signed and gross USD; the largest fund bps);
    - the deliverable aggregates before → after;
    - the two showcase cases: security, bad vendor, quotes before → after from `03_stress_changes.csv`, verdict line,
      dollar effect.
  - Fixed notes, holding no number:
    - "The look-alike's backup quote is still wrong; it is valid for NAV only."
    - "The severity scale row values look-alikes too (neither vendor assumed correct), so it is an upper bound."
    - The reverse-split limitation: "a genuine 1:100 reverse split would show as a position break, because the rebuild
      does not apply corporate actions (D-016)".
  - A missing file is named instead of failing, as `scorecard_lines` does.

- [ ] **Step 1: Write the failing test** `test_stress_lines`:
  - with a temp folder holding small `03_stress_rates.csv`, `03_stress_impact.csv`, `03_stress_cases.csv` and
    `03_stress_changes.csv`, the output contains `## Stress test`, the share of `caught`, and the reverse-split note;
  - with an empty folder, it names `03_stress_rates.csv` as not found.
- [ ] **Step 2: Run, expect FAIL.** `uv run python -m unittest tests.test_findings -v`
- [ ] **Step 3: Implement `stress_lines`.**
- [ ] **Step 4: Run, expect PASS**, then `uv run python scripts/build_findings.py` and read the new section.
- [ ] **Step 5 (controller):** write the docs:
  - D-070 in `docs/DECISIONS.md` (the spec's choices plus any building decision);
  - `docs/STATUS.md`: step 3 done, with the validation, the negative check's rates and the date;
  - the command in `CLAUDE.md` and `README.md` (with the measured runtime);
  - append "Decisions taken while building" to the spec.
- [ ] **Step 6: Final verification**
  - Run: `uv run python -m unittest discover tests`. Expected: all tests pass.
  - Run: `uv run python scripts/check_docs.py`. Expected: "docs check passed".
  - Run: `tests/fixture_test.sh`. Expected: pass.
  - `tests/robustness_test.sh` needn't rerun: the deliverable and config are unchanged, and Task 5 Step 6 proves
    `outputs/02_*` are untouched.
- [ ] **Step 7: Checkpoint.** In chat: a short overview, and a commit message for the user. Do not commit.
