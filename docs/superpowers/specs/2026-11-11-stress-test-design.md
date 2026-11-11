# Design: stress test (Check-in 3, step 3)

*Approved 11 Nov 2026 (builder check done). Branch: `stress-test`. Build plan:
`docs/superpowers/plans/2026-11-11-stress-test.md`. Choices marked **(Claude's call)** were
made without the user; everything else the user decided in the 11 Nov brainstorm.*

## 1. Intent and why

Brief §5 "Stress test and robustness" (`reference/01_Student_Brief.md`): on a copy of the data, inject at least one new
defect and one valid look-alike case; record the changed fields and expected outcomes; compare performance before and
after; report false positives and misses; keep test labels separate from detection logic. The rubric's
"Reproducibility and honesty" row (brief §9) asks for "a defect and a valid control, with observed results". Brief §7
says to keep stress-test fixtures separate. Check-in 3 (brief §8) lists "sensitivity and stress tests".

The row-shuffle half of that bullet is done (`tests/robustness_test.sh`). This session adds the injection half.

Why inject rather than sample real records: misses and false positives can only be counted against a known truth, and
the release has none (that is what the checks are for). Injection plants records whose truth we know. The user wants
it realistic, so the cases go into a random sample of real securities, not a cleaned set, and the result is rates
("how our checks perform"), not a single yes/no.

The test must survive two Q&A moves the brief announces: "change a threshold or vendor priority" (§5) and "a small
assumption change during questions" (§7). The priority-flip case makes the vendor-priority move part of the test.

## 2. Goals, non-goals, anti-goals

**Goals**
- One script that draws a seeded random sample of real held equities, injects a 100x price into a copy of the
  release, runs the unchanged deliverable notebook on the copy and on the clean release, and scores every case against
  the truth it planted: caught / partial / missed for defects, cleared / sent to review / false positive for
  look-alikes, plus false positives on securities nobody touched.
- Rates the slides can quote, a money figure for the injected defects, and one defect and one look-alike shown at
  record level, all from a generated FINDINGS section.

**Non-goals**
- No new detection rule, no change to the deliverable notebook's logic or outputs (D-066).
- No dashboard change in this session; step 4 (executive view) may pick the results up **(Claude's call)**.
- No genuine reverse-split control (§5.3); one sentence in the limitations instead.
- No change to the deliverable's severity section.

**Anti-goals** (a failure even if the script runs)
- Labels or the scoring map written or edited after seeing the injected run without saying so in the report.
- Any security_id, account_id or other record ID typed into code, config or the labels file.
- The detection code reading the labels, or knowing it is under test.
- A summary that hides a changed membership nobody explained.

## 3. Constraints

- CLAUDE.md rules: never modify `data/` or `reference/`; the data is confidential, so the copy lives only under the
  gitignored `tests/runs/`; read CSVs as text; never hard-code defect record IDs; thresholds in `config/`; no version
  suffixes; `uv` for packages; numbers in docs come only from generated output.
- The deliverable notebook takes `RECONCILIATION_DATA` (another `manifest.csv`, files read relative to its folder),
  `RECONCILIATION_OUTPUTS` (another output folder), `RECONCILIATION_CONFIG` and `SCORECARD_CONFIG`. It checks each
  table's row and column counts against the manifest, not sha256.
- A full deliverable run takes several minutes; the stress test runs it twice (clean and injected).

## 4. Facts about the data and code that shape the design

Checked 11 Nov against the release, `notebooks/deliverable.ipynb` and `outputs/` (builder check confirmed):
- One snapshot date, `[snapshot] as_of_date = 2026-07-10`; every `positions` row is on it.
- On the snapshot date 5,970 securities have quotes from three vendors and 30 from two. `vendor_priority`:
  VENDOR_A = 1, VENDOR_B = 2, VENDOR_C = 3 on every row. Stamps on the snapshot date: A 17:00, B 18:00, C 19:00;
  `[prices] nav_cutoff_time` is 18:00 (exactly at the cutoff is on time), so every VENDOR_C quote is late.
- A quote is valid when its price reads and is above zero; the stamp does not affect validity or eligibility, only the
  freshness of the chosen quote. The chosen quote is the eligible quote with the lowest `vendor_priority` (section 8b).
  Nothing else reads `vendor_priority` across dates in a way a snapshot-only swap breaks; a swapped-in priority-1
  quote is not counted as a fallback.
- Section 8 judges all valid snapshot quotes together: **scale** when max/min is in `[prices] scale_ratio_low,
  scale_ratio_high` = [80, 125], else **spread** when (max − min) / mean > `spread_threshold`. Section 8b judges
  agreement pair by pair (`agrees()`: |x − y| / mean(x, y) within `spread_threshold`) and splits the flagged securities
  into "chosen quote is the odd one out" (scale: confirmed; spread: unresolved), "backed by another vendor" (cleared),
  or "no two vendors agree" (unresolved). The raw section 8 lines ("Vendor quotes on the snapshot date: …") stay
  unresolved for every flagged security.
- All 10 real scale flags today are bonds (4 odd one out, 6 backed). Among held securities that pass section 8: about
  3,650 equities and 1,950 bonds.
- Severity (section 11): `impact_price` values only equities with an FX rate whose section 8 result is `pass`. The scale
  and spread rows value an equity holding at quantity × (high − low quote) × FX ("neither vendor is assumed correct"),
  so for an injected equity the deliverable values the defect, the flip **and the look-alike** at about 99× the price.
  An injected security also loses its valuation in every other severity scenario, because its result is no longer
  `pass`. The deliverable has no "valued at the 100x price" figure anywhere; only the stress script measures that.
- KPI 5 / indicator I4 count a backed flagged quote as not agreed (strict reading); the scorecard's `PRC.vendors` test
  counts it as cleared.
- The register's "how detected" text carries counts (flat runs, odd-vendor counts, median flagged dates), so a change to
  a security's chosen price can change a line's text without changing its members.

## 5. What the user decided (11 Nov)

### 5.1 The rule under test

`PRC_VENDOR_DISPERSION`, through a 100x price on the snapshot date. Chosen over the account-close pair (invisible in
1.4M-row totals, little exposure), the settlement-lag pair (the defect only reaches "unresolved") and several rules
(more build than the brief asks). Reasons: a small base of real flags, so injected cases are visible; a real money
effect; defect and look-alike differ only in which vendor sent the bad quote, so the test shows whether the rule tells
them apart; one changed field per case; it ties to the 100x trace planned for the final (D-014).

### 5.2 The three roles

Each case multiplies one quote on the snapshot date by exactly 100 **(Claude's call: ratio 100, the middle of the
band; the new value written as a decimal string)**. The **planted truth** is what the scoring uses.

| Role | Change in `prices` (snapshot date, one security) | Planted truth |
|---|---|---|
| **Defect** | the chosen vendor's quote ×100 | the quote our NAV uses is wrong |
| **Look-alike** | another vendor's valid quote ×100 (the "other vendor" rule below) | the quote our NAV uses is right; a backup vendor is wrong |
| **Priority flip** | as the look-alike, **and** that vendor swaps `vendor_priority` with the chosen vendor on the security's snapshot-date rows | the quote our NAV uses is wrong (same bad quote as a look-alike; only the priority differs) |

**Other vendor (Claude's call):** the valid non-chosen quote with the lowest `vendor_priority`, so VENDOR_B whenever A
is chosen. In the brainstorm this was VENDOR_C; every C quote is late, so a flip onto C would also fail freshness and
differ from a defect in two ways. With B (on time) the flip and the look-alike differ only in priority. Where only C is
available the case still runs, and its freshness change is a listed consequence (§5.6). A security with only one valid
quote can carry a defect only.

### 5.3 What "valid look-alike" means here

"Valid for NAV": a backup vendor's 100x quote that our NAV does not use. That vendor's number is still wrong; the report
and slide say so and do not claim every record is correct. A genuine 1:100 reverse split (every record correct) was
dropped: no price rule looks at day-to-day moves, so "not flagged" would prove little, and since the rebuild does not
apply corporate actions (D-016) it would show as a position break, a false positive in another rule. That weakness
goes in the limitations as one sentence.

### 5.4 The sample (user: random, realistic, equities)

**Pool:** equities (`securities.asset_class = EQUITY`) held in `positions` on the snapshot date that have a chosen quote
and whose section 8 result in the clean run is `pass`. No other cleaning: a security may carry any other finding.
Excluding securities section 8 already flags **(Claude's call)** keeps one truth per security: on an already-flagged
security nobody knows which quote was right before we touched it.

**Draw (Claude's calls):** 30 defects, 30 look-alikes, 30 flips, on 90 different securities, drawn without replacement
with a seed kept in the labels file. Look-alikes and flips are drawn from pool securities that have a valid non-chosen
quote; defects from the whole pool. If a role's pool is smaller than 30, take all and say so. The draw is a sort on
security_id followed by a seeded sample, so it does not depend on row order. The picked IDs are written to the run's
outputs, never to a versioned file.

Equities only (user): a per-share price × quantity gives a defensible dollar figure; the deliverable refuses to value
bonds because their quote basis is unverified.

### 5.5 Scoring (user: three levels)

Each injected security's **verdict** comes from the register lines it newly joins (or leaves) between the clean and the
injected run, read from `02_finding_members.csv`. The most specific line decides: section 8b's split lines first; the
raw section 8 line only when 8b gives none; any other line after that.

| Role | Verdict levels |
|---|---|
| Defect, flip (chosen quote wrong) | **caught**: joins a confirmed line naming the chosen quote as wrong ("Scale flag: the chosen quote is the odd one out") · **partial**: flagged, but only on an unresolved line ("no two vendors agree", a spread "odd one out", the raw section 8 line alone) · **missed**: joins no price line |
| Look-alike (chosen quote right) | **cleared**: its 8b line is cleared ("backed by another vendor") · **sent to review**: its 8b line (or the raw line alone) is unresolved, a workload cost reported apart · **false positive**: joins a confirmed line naming the chosen quote as wrong |

Also a **false positive**: any security not injected that joins or leaves any register line, and any change to a line
whose members are not securities (transactions, accounts, currencies, ledger rows) that does not refer to an injected
security. Changes to an injected security outside the verdict lines (it leaves other severity valuations, a flat run
breaks, a freshness change in a C-only case) are listed as **consequences**, not scored.

The mapping from register line to level lives in the labels file, by finding name, and is committed before the first
injected run.

### 5.6 Labels, kept apart

`tests/stress/cases.toml` **(Claude's call on name and place)** holds: the seed, the sample sizes, the multiplier, the
role definitions, the line-to-level map (§5.5) and the list of expected consequences by kind. It holds no IDs. The
detection code never reads it; only the stress script's sample and compare steps do.

If the observed result differs from what the labels expect, the report shows it. If investigation shows a label was
wrong rather than the rule, the label is corrected in its own commit and the report names the correction. Labels are
never silently fitted to results.

### 5.7 What it reports

1. **Changed fields:** every edited cell: role, security, vendor, field, old → new (one row per cell: one per
   defect or look-alike, three per flip).
2. **Per case:** role, security, verdict level, the lines it joined and left, consequences.
3. **Rates per role:** caught / partial / missed; cleared / sent to review / false positive; with counts and the sample
   size. Plus false positives on untouched securities (expected: zero).
4. **Impact.** The stress script's own measure for defects and flips: Σ quantity × (injected chosen price − original
   chosen price) × FX to USD over the security's snapshot positions, signed and gross, per fund in bps of fund net assets
   (same fund net-assets definition as the deliverable's severity section). Look-alikes are zero by construction. We know
   the true price because we planted the error. Beside it, before and after from the deliverable's own outputs: Prices
   domain score, platform score, KPI 5 / I4, and the severity "Vendor quotes: scale flag" row, labelled as the
   deliverable's upper bound (it values look-alikes too, §4). These aggregates are reported as observed, not predicted.
5. **Showcase:** one caught defect and one cleared look-alike, each the case whose held value is closest to its role's
   median **(Claude's call)**, with the record-level trail (the four quotes before and after, the register lines, the
   dollar effect) for the slide.

Outputs **(Claude's call on names)**: `outputs/03_stress_changes.csv`, `03_stress_cases.csv`, `03_stress_rates.csv`,
`03_stress_unexplained.csv`, `03_stress_impact.csv`. `scripts/build_findings.py` adds a generated "Stress test"
section to `docs/FINDINGS.md`.

### 5.8 Where it lives and how it runs

`tests/stress_test.sh`, in the style of `tests/robustness_test.sh`:
1. Clean run of the deliverable into `tests/runs/stress_clean/` (`RECONCILIATION_OUTPUTS`) **(Claude's call: own
   baseline, not `outputs/`)**.
2. Draw the sample from the clean run and the release.
3. Build the copy in `tests/runs/stress_data/`: all ten tables copied **(Claude's call: the brief's literal "copy of the
   data"; about 85 MB, gitignored)**, `prices` rewritten with the edits, every other byte of every row as delivered
   (text in, text out), and a manifest with the same rows and columns and the new sha256 for `prices`.
4. Injected run into `tests/runs/stress_injected/` (one run carries all cases; they sit on different securities).
5. Score, write `outputs/03_stress_*.csv`, print the rates, and exit non-zero on any false positive on an untouched
   security or any unexplained change **(Claude's call)**. Misses, partials and review cases are results to report, not
   test failures.

It passes `RECONCILIATION_CONFIG` and `SCORECARD_CONFIG` through, so a Q&A threshold change can be rerun. It runs on
the full release; given another manifest it runs there if each role's pool is non-empty, and stops with a clear
message otherwise **(Claude's call)**.

### 5.9 Docs

- `docs/DECISIONS.md`: a new entry (D-070) with the choices above.
- `docs/STATUS.md`: step 3 done, with the validation and the rates' file.
- `docs/FINDINGS.md`: the generated section; the reverse-split limitation sentence.
- `CLAUDE.md` and README command lists: the new script and its runtime.

## 6. Tests

- Unit tests (Python, `uv run python -m unittest`) for the pure parts on small made-up frames: the pool and the seeded
  draw (row order does not change it; roles disjoint; a one-quote security is defect-only), the price edit (text in,
  text out, ×100 as a decimal string), the priority swap, the verdict from joined/left lines for each level, and the
  untouched-security false-positive check.
- The full script on the release: rates written, zero false positives on untouched securities, exit 0.
- A negative check, run once and recorded in STATUS: with a config whose scale band excludes 100, the ×100 quotes fall
  into section 8's spread test. Expected: defects and flips land on "Spread flag: the chosen quote is the odd one out"
  (unresolved), so they score **partial**, not caught; look-alikes on "Spread flag: … backed" (cleared). The rates move
  and the run shows the band matters.
- `tests/robustness_test.sh`, `tests/fixture_test.sh` and `check_docs.py` still pass; `outputs/02_*` are unchanged by
  this work.

## 7. Left to the builder

- The labels file format, and the exact finding names in the line-to-level map (read from the deliverable's code).
- How a member of a non-security line is tied to an injected security (by the security_id on the member record where
  it has one).
- Whether the shell script calls one Python helper in `scripts/` or `tests/`, and whether shared helpers with the
  robustness test move to `src/` (D-012: only once two places need the same code).
- The FINDINGS section's layout.

## 8. Decisions taken while building (11 Nov)

The controller's rulings during the subagent build; D-070 carries the ones a reader of the numbers needs.

- **No commits during the build:** the user commits. Reviews read working-tree diffs; the labels were frozen by
  recording the sha256 of `tests/stress/cases.toml` before the first injected run (value in D-070).
- **Scarce second vendors (Task 1):** when the securities with a second eligible vendor are fewer than look-alikes plus
  flips want, they are split evenly (look-alikes take the odd one); any empty role stops the run. The plan's
  small-pool test assumed look-alikes take all.
- **New register line (Task 3):** members of a line present in only one run keep their security attribution, so a new
  line's security members are scored like any other line's.
- **Blank `security_id` output rows (Task 4):** scoped `unattributable`, not `false positive` (`02_impact_detail.csv`
  has ledger rows with no security).
- **Rates rows (Task 4):** two untouched rows, `false positive` and `unattributable`, which together equal what fails
  the run; a role with no case drawn keeps a row (drawn 0 against wanted).
- **Not-valued reasons (Task 4):** `no chosen price`, `no injected price`, `unreadable quantity`, `no FX rate`,
  `no fund`, `no fund net assets`; every blank amount carries one.
- **FINDINGS (Task 6):** the section notes that the rates hold for the sample drawn. `scripts/build_findings.py`'s
  `read_output` now closes its file (eight ResourceWarnings in the test suite).
- **Changed fields in outputs (found in Task 6):** the first `score` wrote the register-member changes to
  `03_stress_changes.csv`; §5.7.1 wants the edited cells there. `03_stress_changes.csv` now holds the edited cells and
  a sixth file, `03_stress_members.csv`, keeps the member changes for audit. The full run was repeated; same rates.
- **Whole-branch review (Opus):** ready with fixes. One Important finding: the outputs recorded no provenance and old
  files survived a failed run. Now `tests/stress_test.sh` removes `outputs/03_stress_*` first, `score` writes a seventh
  file `03_stress_run.csv` (config, labels and manifest checksums, seed, sizes, multiplier, time), FINDINGS prints it
  as a "Run:" line, and `scripts/check_docs.py` flags a stress section older than its outputs (the finish time is left
  out of the checksum). Also fixed: number formatting, the untouched-count wording, a count of case-fund rows not
  valued, the other vendors' unedited quotes in the showcase (`snapshot_quotes` in `03_stress_cases.csv`), a note that
  another config may draw another sample. The full run was repeated; same rates. Left as known: the labels file calls
  `02_row_ledger.csv` "run metadata only" (frozen; see D-070).
- **Known limits, left after the review:** `03_stress_run.csv` records the labels file by absolute path and the stress checksum
  covers it, so a rerun on another machine makes FINDINGS look stale until `build_findings.py` runs (fix: a path
  relative to the repo); the work folders under `tests/runs/stress_*` are shared, so a
  second run (e.g. the negative check) overwrites the first run's intermediates; old `outputs/03_stress_*` survive a
  crash of the score step; files without a `security_id` column can only report aggregate changes.
