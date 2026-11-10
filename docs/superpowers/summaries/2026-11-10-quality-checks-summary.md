# Session summary: quality checks (10 Nov 2026)

*For teammates who were not in the session. Design: [spec](../specs/2026-11-10-quality-checks-design.md). Build
plan: [plan](../plans/2026-11-10-quality-checks.md). Decision: D-067 in [DECISIONS.md](../../DECISIONS.md). Rules:
[RULES.md](../../RULES.md) §3 and §6. Numbers: [FINDINGS.md](../../FINDINGS.md) and the `outputs/` files named below.
Branch `quality-checks`, not yet committed.*

## What the session set out to do

[STATUS.md](../../STATUS.md) "Next: toward Check-in 3", step 1, with the scope fixed by D-066: the last check session
before Check-in 3. After it, no new checks are added.

1. **Price data quality** (brief §5): coverage and freshness of the quote we would use for each holding, with the
   D-041 denominators. Also a look inside the vendor spread and scale flags, which were counted but never examined.
2. **The four partly coded rules:**
   - `TXN_FIELDS_VALID`: T+2 in business days, the amount check, blank price;
   - `FX_RATE_VALID`: uniqueness, rate > 0, the day-on-day band;
   - `TXN_DUPLICATE`: same economics under a new ID;
   - `TXN_CORRECTION_LINK`: same account and security.

Every check publishes fail, eligible and not evaluable, so next session's scorecard can read them.

Out of scope: the uncoded rules (D-066), the deep dives into groups we have only counted, the scorecard, and
dashboard code.

**How it was run:**
- **Design (interactive).** The user answered nine design questions plus one after the builder check (spec §5). A
  reviewer then read the spec as its builder would.
- **Build (autonomous):**
  - seven tasks, each built test-first and reviewed for spec compliance and quality;
  - a whole-branch review, then one fix wave and its re-review;
  - the full verification suite.

## What it found (where to look)

All counts are in `outputs/02_defect_register.csv`: the new lines follow "Published after cutoff". Per-holding price
detail is in `outputs/02_price_quality.csv`.

- **Coverage.** The holdings with no eligible quote are the ones on securities missing from `securities`; the line
  states its overlap with "Held security with no price at all". A second line counts holdings priced only by a
  fallback vendor.
- **Freshness.** With the 18:00 cutoff, see the register line "Chosen quote stamped after the NAV cutoff". Its
  how-detected text gives the fresh-fallback and flat-run counts.
- **Inside the vendor flags:**
  - Most spread flags are the priority vendor (VENDOR_A) disagreeing with two vendors that agree with each other,
    persistently across dates. That is unresolved, because priority is a preference, not proof of accuracy.
  - **Worth a trace.** The how-detected text of "Spread flag: the chosen quote is the odd one out" shows that almost
    all of those chosen quotes are also in a flat run. VENDOR_A's price stays the same for days while its timestamp
    looks fresh, while the other two vendors move. Freshness by timestamp alone cannot see this; the flat run and the
    vendor disagreement together can. It is a strong candidate for one of the final's defect traces.
  - Scale flags are one-day ~100× bond quotes. Where the quote we would use is the 1/100 one, the line is confirmed;
    where another vendor backs it, it is cleared.
  - The lines add up exactly to section 8's flag counts; the notebook asserts it.
- **FX.** Repeated rates, non-positive rates and moves above the 5% band: see the three FX lines.
- **Trades.** See the lines for blank price, the amount check, lag above T+2 with and without an agreed extension
  (the latter cleared), and correction links.
- **Economic duplicates.** Unresolved. Their how-detected text reports how many groups share one event minute and
  one feed. On this release that evidence does not tell resends from split orders apart (see the line).

## Files created

| File | What and why |
|---|---|
| `docs/superpowers/specs/2026-11-10-quality-checks-design.md` | The approved design: goals, anti-goals, data facts, the user's decisions (§5), calls (§8), choices taken during the build (§10) |
| `docs/superpowers/plans/2026-11-10-quality-checks.md` | The seven-task test-first plan, the fixed names, and the quality-fixture contents |
| `docs/superpowers/summaries/2026-11-10-quality-checks-summary.md` | This file |

## Files changed (`git diff main --stat`)

| File | What and why |
|---|---|
| `notebooks/deliverable.ipynb` | Code, in the notebook only (D-037). New section **8b** (coverage, fallback-only, freshness, flat runs, the look inside the flags; writes `02_price_quality.csv`) and section **9c** (FX checks, blank price, amount, lag, economic duplicates, correction links). Section 10 appends the new register lines and asserts their identities. Section 8's "proposed, not run" note now points to 8b and 9c |
| `config/reconciliation.toml` | New settings, written before the build looked at the data: `[tolerances] float_decimals`, `settlement_lag_limit_business_days`, `settlement_extension_note`; `[prices] nav_cutoff_time`, `flat_run_dates`; `[fx] day_on_day_band` |
| `scripts/plain_language.json` | A plain sentence for every new register line, which the dashboard shows |
| `tests/fixture_test.sh` | A new **quality fixture**, built inline from `tests/fixtures/small`, with every case in spec §7 plus five review-focus cases. Two new runs (`quality`, and `quality_lag3` with T+3 set live). Expectations for every new line. The old "timeliness lines come last" check now reads "follow the NAV line" |
| `tests/robustness_test.sh` | The threshold run also loosens the FX band. It asserts that only the FX band line can move (and only down), that every other register line outside the price-threshold lines is identical, and that `02_price_quality.csv` is identical outside four columns |
| `docs/RULES.md` | §3 and §6: the six rules are marked coded (D-067), with their register lines, output and config keys; the coverage and freshness table moves from "proposed" to "run" |
| `docs/DECISIONS.md` | D-067 appended |
| `docs/STATUS.md` | A "Quality checks (10 Nov)" entry with its validation; "Next" step 1 done |
| `docs/FINDINGS.md`, `docs/DEFECT_CATALOG.md` | Regenerated by `scripts/build_findings.py`; the catalog changes only in its checksum lines |
| `nate.ned` | **Not part of this session.** A teammate's one-line greeting that was already deleted in the working tree before the session started. Left alone; decide whether to restore it (`git restore nate.ned`) before you commit |

## New rules, thresholds, outputs and register lines

- **Rules coded:** `PRC_QUOTE_ELIGIBLE` (coverage, fallback-only, freshness), the look inside
  `PRC_VENDOR_DISPERSION`, `FX_RATE_VALID`, the rest of `TXN_FIELDS_VALID`, `TXN_DUPLICATE` (economic) and
  `TXN_CORRECTION_LINK` (self-link, other account or security). RULES.md has the wording.
- **Thresholds:** the six config keys above. The values are the user's decisions in spec §5.
- **New output:** `outputs/02_price_quality.csv`, one row per held security. `outputs/02_vendor_check.csv` is unchanged.
- **New register lines:** the names, statuses, rules and units are in the plan's "Fixed names" table, and the counts
  are in `outputs/02_defect_register.csv` and FINDINGS.md. Every existing line is byte-identical and still first.

## Review findings

**Fixed** (each with a failing test first):
- **Task 2:**
  - the per-flag identity check could never fail; it now checks the register against section 8;
  - counting dates flagged across several days was untested; a multi-date fixture case was added.
- **Task 4:** the price line's copy rule clashed with an assert that said "never not evaluable", a latent crash. The
  copy rule stays, as the spec requires, and a fixture row shows it.
- **Task 7:** result counts had been typed into D-067 and STATUS (against CLAUDE.md), and the robustness wording
  overstated what ran. Reworded.
- **Whole-branch review:**
  - the cleared lag line did not say its only evidence is the note in the same row, or what would reopen it (spec §2
    anti-goal, §5 decision);
  - the economic-duplicate line lacked the shared minute and feed evidence (spec §5);
  - the blank-price wording disagreed with its count;
  - an assert was added that the two lag lines never share a member;
  - D-067 wrongly called a correct business-day roll a limit.

**Rejected** (with the reason):
- "The odd-vendor tie-break is untested": fixture case FXSEC16 is exactly that tie.
- "The T+3 run is not shown": `fixture_test.sh` runs it and asserts on it.
- "The quality fixture has no DD/MM/YYYY FX date": it inherits EUR `10/07/2026` from the default fixture, and the band
  test compares it.
- "Lag line names should not follow the config": kept by design. A live T+n change shows the raw line name on the
  dashboard; D-067 lists this as a known limit.

**Rulings made during the build** (D-067 keeps them):
- the plan's T+3 expectation was corrected: the copy rule keeps agreeing copies evaluable;
- the price line keeps the copy rule;
- the robustness comparison also excludes the processing-latency line, whose limit that run loosens;
- three Task 5 choices are logged in spec §10.

**Deferred minors** (left on purpose, none changes a count on the release):
- some branches have no fixture case: settlement before trade, a target whose copies disagree with none matching,
  "0 of N groups share a minute", a blank currency;
- a tautological assert in the FX check cell, and one duplicated helper name;
- exact float equality in the flat-run match, and a rate of `inf` reading as usable;
- the FX-band and processing rehearsals move nothing on the release, so they show no leakage but not that the band
  bites (the fixture tests the band).

## Test results

All run fresh on the final code (10 Nov), after the whole-branch fix wave:

| Command | Result |
|---|---|
| `tests/run_notebook.sh` (full data) | executed OK |
| Baseline comparison (outputs before this branch vs now) | every existing register row byte-identical and first; every other baseline `02_*` output identical, except the register, `02_finding_members.csv` (every baseline line kept, new members added) and `02_run_info.csv`; one new file, `02_price_quality.csv` |
| Independent DuckDB recount on the raw files (blank price, coverage fail, chosen quotes after 18:00, lag above T+2 with no note) | agrees with the register |
| `tests/fixture_test.sh` | passed (default, edge, R3, quality and quality-at-T+3 runs) |
| `tests/robustness_test.sh` | passed: three shuffles give identical outputs; the live threshold run (spread threshold, FX band, one feed's processing limit) moves only its own lines |
| `uv run python scripts/build_findings.py` | FINDINGS.md regenerated (new checksum there) |
| `uv run python scripts/build_store.py`, then `tests/store_test.sh` | passed, including `next build` |
| `dashboard`: `npm test`, `npm run test:e2e` | passed |
| `uv run python -m unittest discover tests` | OK |
| `uv run python scripts/check_docs.py` | passed |

## What is left

- **The user commits** this branch and opens the PR. Decide about `nate.ned` first.
- **Next session (STATUS "Next" step 2):** the scorecard and indicators. It reads the new register lines (pass =
  eligible − affected, not evaluable apart) and `02_price_quality.csv`. It also picks up App. B's week-over-week
  doubling, left by the timeliness session.
- **Then:** the stress test, the executive view, and after Check-in 3 the traces and cleared look-alikes. Candidates
  from this session are the scale flag whose chosen quote is the 1/100 one (the "100× price" trace, D-014) and the
  cleared lag line.
