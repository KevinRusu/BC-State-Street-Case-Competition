#!/usr/bin/env bash
# T11: run the deliverable notebook as delivered, with every table's rows shuffled under several seeds, and with one threshold
# changed; compare outputs. Restores the default outputs at the end. Exit non-zero on any unexpected difference.
# The seeds are checked first: at least one of them must reverse the file order of the two REVERSED rows of an
# original whose two reversals differ in quantity (the case where a row-order-dependent R3 would move a number).
# Seed 7 alone was not enough: it flipped 2 such originals whose effects cancelled in the totals. Seed 3 flips all of
# them in the release, and moved the R3 sensitivity line on the code before the fix.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
W=tests/runs
mkdir -p "$W"
SEEDS="3 11 25"
uv run --quiet python - "$SEEDS" <<'PY'
import sys
base = open('config/reconciliation.toml').read()
assert 'shuffle_seed = 0' in base, 'config has no [robustness] shuffle_seed = 0 line'
for seed in sys.argv[1].split():
    open(f'tests/runs/config_shuffled_{seed}.toml', 'w').write(
        base.replace('shuffle_seed = 0', f'shuffle_seed = {seed}'))
assert 'spread_threshold = 0.005' in base and base.count('OMS_FRONT = 240') == 1
assert base.count('day_on_day_band = 0.05') == 1, 'config has no day_on_day_band = 0.05 line'
# Three live changes in one run: a price threshold, the FX day-on-day band, and one feed's processing-latency limit (D-065)
open('tests/runs/config_threshold.toml', 'w').write(base.replace('spread_threshold = 0.005', 'spread_threshold = 0.01')
                                                    .replace('day_on_day_band = 0.05', 'day_on_day_band = 0.10')
                                                    .replace('OMS_FRONT = 240', 'OMS_FRONT = 480'))
# A live weight change (spec §6): Prices weighs 2 instead of 1 in the main score. `[weights.nav_proximity]` also has a
# "Prices = 2" line, so the line to change is the one that reads "Prices = 1", and there is exactly one.
scorecard = open('config/scorecard.toml').read()
assert scorecard.count('Prices = 1\n') == 1, 'config/scorecard.toml has no single "Prices = 1" line'
open('tests/runs/scorecard_prices2.toml', 'w').write(scorecard.replace('Prices = 1\n', 'Prices = 2\n'))
PY
uv run --quiet python - "$SEEDS" <<'PY'
# Seed check: the same load and shuffle call as the notebook (DuckDB, all_varchar, fillna(''), sample(frac=1)).
import csv, sys, duckdb, pandas as pd
manifest = {row['table']: row for row in csv.DictReader(open('manifest.csv', newline=''))}
t = duckdb.connect().sql(f"SELECT * FROM read_csv('{manifest['transactions']['file']}', all_varchar=true, header=true)").df().fillna('')
def first_reversal(frame):
    rev = frame[frame['status'] == 'REVERSED']
    return rev.drop_duplicates('related_transaction_id').set_index('related_transaction_id')['transaction_id']
rev = t[t['status'] == 'REVERSED']
counts = rev['related_transaction_id'].value_counts()
two = rev[rev['related_transaction_id'].isin(counts[counts == 2].index)]
quantities = pd.to_numeric(two['quantity'], errors='coerce').fillna(float('inf'))   # blank counts as different
sensitive = quantities.groupby(two['related_transaction_id']).nunique()
sensitive = sensitive[sensitive > 1].index
base = first_reversal(t)
flips = {}
for seed in sys.argv[1].split():
    shuffled = first_reversal(t.sample(frac=1, random_state=int(seed)).reset_index(drop=True))
    flips[seed] = int((shuffled.loc[sensitive] != base.loc[sensitive]).sum())
print(f'seed check: {len(sensitive)} originals have two reversals with different quantities; reversed by seed: {flips}')
assert max(flips.values(), default=0) > 0, 'no seed reverses an order-sensitive pair of reversals; pick other seeds'
PY
run() {  # $1 = label, $2 = reconciliation config path or empty, $3 = scorecard config path or empty
  rm -rf "$W/run_$1"; mkdir -p "$W/run_$1"
  RECONCILIATION_CONFIG="$2" SCORECARD_CONFIG="${3:-config/scorecard.toml}" tests/run_notebook.sh | tail -1
  cp outputs/02_*.csv "$W/run_$1/"
}
run a ""
for seed in $SEEDS; do run "s$seed" "$W/config_shuffled_$seed.toml"; done
run c "$W/config_threshold.toml"
run w "" "$W/scorecard_prices2.toml"
status=0
uv run --quiet python - "$SEEDS" <<'PY' || status=$?
import glob, os, sys, numpy as np, pandas as pd
W = 'tests/runs'
seeds = sys.argv[1].split()
info = {k: pd.read_csv(f'{W}/run_{k}/02_run_info.csv').set_index('item')['value'] for k in ['a', 'c', 'w'] + [f's{s}' for s in seeds]}
assert str(info['a']['shuffle_seed']) == '0', 'the default run shuffled'
for seed in seeds:
    assert str(info[f's{seed}']['shuffle_seed']) == seed, f'the run for seed {seed} did not shuffle with it'

def canonical(path):
    frame = pd.read_csv(path, dtype=str, keep_default_na=False)
    return frame.sort_values(list(frame.columns)).reset_index(drop=True)

def same(a, b):
    """Equal tables: text exactly; numbers within 1e-9 (summation order can move the last float digit). A numeric
    column may hold blanks (for example no quote -> no mean): the blanks must sit in the same rows."""
    if list(a.columns) != list(b.columns) or len(a) != len(b):
        return False
    for column in a.columns:
        x, y = pd.to_numeric(a[column], errors='coerce'), pd.to_numeric(b[column], errors='coerce')
        blank_a, blank_b = a[column] == '', b[column] == ''
        numeric = (x.notna() | blank_a).all() and (y.notna() | blank_b).all() and x.notna().any()
        if numeric:
            if not (blank_a == blank_b).all() or not np.allclose(x[~blank_a], y[~blank_b], rtol=1e-9, atol=1e-9):
                return False
        elif not (a[column] == b[column]).all():
            return False
    return True

ROW_ORDER_DEPENDENT = ['conflicting pairs: keep_first', 'conflicting pairs: keep_second']   # by definition
problems = []
for seed in seeds:
    for path in sorted(glob.glob(f'{W}/run_a/02_*.csv')):
        name = os.path.basename(path)
        if name in ('02_run_info.csv', '02_row_ledger.csv'):
            continue
        a, b = canonical(path), canonical(f'{W}/run_s{seed}/{name}')
        if name == '02_sensitivities.csv':
            a = a[~a['alternative'].isin(ROW_ORDER_DEPENDENT)].reset_index(drop=True)
            b = b[~b['alternative'].isin(ROW_ORDER_DEPENDENT)].reset_index(drop=True)
        ok = same(a, b)
        print(f'shuffle test seed {seed} {name}: {"same" if ok else "DIFFERENT"}')
        if not ok:
            problems.append(f'seed {seed}: {name}')
va = pd.read_csv(f'{W}/run_a/02_vendor_check.csv')['result'].value_counts()
vc = pd.read_csv(f'{W}/run_c/02_vendor_check.csv')['result'].value_counts()
print('threshold rehearsal: spread_threshold 0.005 -> 0.01: "spread above threshold"',
      int(va.get('spread above threshold', 0)), '->', int(vc.get('spread above threshold', 0)),
      '| pass', int(va.get('pass', 0)), '->', int(vc.get('pass', 0)))
assert vc.get('spread above threshold', 0) <= va.get('spread above threshold', 0), 'a looser threshold flagged more'
assert va.sum() == vc.sum(), 'held securities changed with a threshold'
ra = pd.read_csv(f'{W}/run_a/02_waterfall.csv'); rc = pd.read_csv(f'{W}/run_c/02_waterfall.csv')
assert ra.equals(rc), 'the reconciliation moved when only a price threshold changed'
# Timeliness: loosening OMS_FRONT's processing limit (240 -> 480 min) may only move that feed's processing limit and
# its "median above limit" flags, and never from "no" to "yes"; every count and median stays the same.
ta = pd.read_csv(f'{W}/run_a/02_timeliness.csv', dtype=str, keep_default_na=False)
tc = pd.read_csv(f'{W}/run_c/02_timeliness.csv', dtype=str, keep_default_na=False)
own = (ta['measure'] == 'processing_latency') & (ta['source_system'] == 'OMS_FRONT')
moving = ['limit_minutes', 'median_above_limit']
own_days = own & (ta['day'] != 'all')
assert set(ta.loc[own_days, 'limit_minutes']) == {'240.0'} and set(tc.loc[own_days, 'limit_minutes']) == {'480.0'}, \
    'the OMS_FRONT processing limit in the config did not reach 02_timeliness.csv'
assert ta.drop(columns=moving).equals(tc.drop(columns=moving)), 'a timeliness count or median moved with a limit'
assert ta[~own][moving].equals(tc[~own][moving]), 'another feed or measure moved with the OMS_FRONT processing limit'
assert not ((ta.loc[own, 'median_above_limit'] == 'no') & (tc.loc[own, 'median_above_limit'] == 'yes')).any(), \
    'a looser limit flagged a new feed-day'
yes_a, yes_c = int((ta.loc[own, 'median_above_limit'] == 'yes').sum()), int((tc.loc[own, 'median_above_limit'] == 'yes').sum())
print(f'threshold rehearsal: processing limit OMS_FRONT 240 -> 480 min: "yes" feed-days {yes_a} -> {yes_c}')
assert yes_c <= yes_a
# FX band 0.05 -> 0.10: its register line may only flag fewer rows; every other line, outside the price-threshold,
# scale/spread and processing-limit lines that these rehearsals move, stays identical.
FX_LINE = 'FX rate moves more than the band from the previous business day'
MOVING_LINES = {FX_LINE,
                'Scale flag: the chosen quote is the odd one out', 'Scale flag: the chosen quote is backed by another vendor',
                'Spread flag: the chosen quote is the odd one out', 'Spread flag: the chosen quote is backed by another vendor',
                'Spread or scale flag: no two vendors agree',
                'Vendor quotes on the snapshot date: spread above threshold',
                'Vendor quotes on the snapshot date: scale flag (ratio near 100)',
                'Processing latency: daily median above the feed\'s limit'}
ga = pd.read_csv(f'{W}/run_a/02_defect_register.csv', dtype=str, keep_default_na=False).set_index('finding')
gc = pd.read_csv(f'{W}/run_c/02_defect_register.csv', dtype=str, keep_default_na=False).set_index('finding')
assert list(ga.index) == list(gc.index), 'the register lines or their order changed with a threshold'
fa, fc = ga.loc[FX_LINE], gc.loc[FX_LINE]
assert int(fc['affected']) <= int(fa['affected']), 'a wider FX band flagged more rate rows'
assert (fa['eligible'], fa['population']) == (fc['eligible'], fc['population']), 'the FX band moved the eligible set or population'
print(f'threshold rehearsal: fx day_on_day_band 0.05 -> 0.10: "{FX_LINE}" affected {fa["affected"]} -> {fc["affected"]}')
missing = [name for name in MOVING_LINES if name not in ga.index]
assert not missing, f'register lines expected by the robustness test are missing: {missing}'
keep = [name for name in ga.index if name not in MOVING_LINES]
assert ga.loc[keep].equals(gc.loc[keep]), 'a register line moved that the threshold changes do not explain: ' + \
    str([n for n in keep if not ga.loc[n].equals(gc.loc[n])])
pa = pd.read_csv(f'{W}/run_a/02_price_quality.csv', dtype=str, keep_default_na=False)
pc = pd.read_csv(f'{W}/run_c/02_price_quality.csv', dtype=str, keep_default_na=False)
price_moving = ['vendor_check_result', 'flag_class', 'odd_vendor', 'dates_spread_flagged']
assert list(pa.columns) == list(pc.columns) and (pa['security_id'] == pc['security_id']).all(), \
    '02_price_quality.csv changed shape with a threshold'
assert pa.drop(columns=price_moving).equals(pc.drop(columns=price_moving)), \
    '02_price_quality.csv moved in a column the spread threshold does not explain'
print(f'threshold rehearsal: other register lines ({len(keep)}) and 02_price_quality.csv columns outside {price_moving} identical')
# Live weight change (Prices 1 -> 2 in [weights.domains]): only platform rows, account scores and the sensitivity
# file may move (plus the changed weight's own echo in 02_scorecard.csv); every outcome, test, rule, domain, indicator and KPI output is byte-identical.
WEIGHT_MOVES = ('02_scorecard.csv', '02_scorecard_accounts.csv', '02_scorecard_sensitivity.csv', '02_run_info.csv', '02_row_ledger.csv')
assert str(info['w']['shuffle_seed']) == '0', 'the weight run shuffled'
names_a = sorted(os.path.basename(p) for p in glob.glob(f'{W}/run_a/02_*.csv'))
assert names_a == sorted(os.path.basename(p) for p in glob.glob(f'{W}/run_w/02_*.csv')), 'the weight run wrote other files'
assert {'02_score_outcomes.csv', '02_indicators.csv', '02_kpis.csv'} <= set(names_a), 'new outputs missing from the run'
for name in names_a:
    if name not in WEIGHT_MOVES:
        assert open(f'{W}/run_a/{name}', 'rb').read() == open(f'{W}/run_w/{name}', 'rb').read(), \
            f'{name} moved when only a domain weight changed'
def load(run, name):
    return pd.read_csv(f'{W}/run_{run}/{name}', dtype=str, keep_default_na=False)
# 02_scorecard.csv: the platform row's score, coverage and confirmed-only score move, and the changed domain's own
# `weight` column echoes the new input (Prices 1 -> 2); every other cell is identical (a domain's score, coverage and
# counts do not depend on domain weights).
sa, sw = load('a', '02_scorecard.csv'), load('w', '02_scorecard.csv')
assert list(sa.columns) == list(sw.columns) and (sa['level'] == sw['level']).all(), '02_scorecard.csv changed shape'
plat = sa['level'] == 'platform'
prices = (sa['level'] == 'domain') & (sa['domain'] == 'Prices')
assert plat.sum() == 1 and prices.sum() == 1
assert (sa.loc[prices, 'weight'].values == ['1']).all() and (sw.loc[prices, 'weight'].values == ['2']).all(), \
    'the Prices domain weight did not reach 02_scorecard.csv'
assert sa[~plat & ~prices].equals(sw[~plat & ~prices]), '02_scorecard.csv: a row moved that the Prices weight does not explain'
assert sa.loc[prices].drop(columns=['weight']).equals(sw.loc[prices].drop(columns=['weight'])), \
    'the Prices domain row moved outside its weight column'
assert (sa.loc[plat, 'score'].values != sw.loc[plat, 'score'].values).all(), 'the weight change did not move the platform score'
assert sa.loc[plat].drop(columns=['score', 'coverage', 'confirmed_only_score']).equals(
    sw.loc[plat].drop(columns=['score', 'coverage', 'confirmed_only_score'])), 'the platform row moved outside its score columns'
# 02_scorecard_accounts.csv: identity, every per-domain column, the two variants that do not use the main domain
# weights (nav_proximity has its own, weakest_link has none) and fund_nav_result are identical. Only the main score,
# its coverage, the confirmed-only score (all rolled up with the main domain weights) and the rank may move.
aa, aw = load('a', '02_scorecard_accounts.csv'), load('w', '02_scorecard_accounts.csv')
assert list(aa.columns) == list(aw.columns), '02_scorecard_accounts.csv changed columns'
assert sorted(aa['account_id']) == sorted(aw['account_id']), '02_scorecard_accounts.csv changed accounts'
aa, aw = aa.set_index('account_id').sort_index(), aw.set_index('account_id').sort_index()
MAIN_WEIGHTED = ['rank', 'score', 'coverage', 'confirmed_only_score']
fixed = [c for c in aa.columns if c not in MAIN_WEIGHTED]
assert any(c.endswith(' score') for c in fixed) and 'fund_nav_result' in fixed and 'score_nav_proximity' in fixed
assert aa[fixed].equals(aw[fixed]), 'accounts: a column moved that the Prices weight does not explain: ' + \
    str([c for c in fixed if not aa[c].equals(aw[c])])
assert (aa['score'] != aw['score']).any(), 'the weight change moved no account score'
# 02_scorecard_sensitivity.csv: nav_proximity and weakest_link scores never use the main domain weights, so they are
# identical in every row; domain rows are identical in every column; the platform main_score moves, and with it the
# change column and the confirmed_only variant's platform score.
va, vw = load('a', '02_scorecard_sensitivity.csv'), load('w', '02_scorecard_sensitivity.csv')
assert list(va.columns) == list(vw.columns) and (va[['variant', 'level', 'name']] == vw[['variant', 'level', 'name']]).all().all(), \
    '02_scorecard_sensitivity.csv changed shape'
own = va['variant'].isin(['nav_proximity', 'weakest_link'])
assert (va.loc[own, 'score'] == vw.loc[own, 'score']).all(), 'a variant score moved that does not use the main domain weights'
dom = va['level'] == 'domain'
assert va[dom].equals(vw[dom]), 'a sensitivity domain row moved with a domain weight'
vp = va['level'] == 'platform'
assert (va.loc[vp, 'main_score'].values != vw.loc[vp, 'main_score'].values).all(), 'the platform main_score did not move'
assert va.loc[vp & (va['variant'] == 'confirmed_only'), 'score'].values[0] != vw.loc[vp & (va['variant'] == 'confirmed_only'), 'score'].values[0], \
    'the confirmed-only platform score did not move with the domain weight'
print(f'weight rehearsal: Prices 1 -> 2: platform score {sa.loc[plat, "score"].values[0]} -> {sw.loc[plat, "score"].values[0]}; '
      f'{len(names_a) - len(WEIGHT_MOVES)} other outputs byte-identical; account scores moved for '
      f'{int((aa["score"] != aw["score"]).sum())} of {len(aa)} accounts')
assert not problems, f'outputs changed under shuffling: {problems}'
print(f'robustness test passed: rows shuffled with seeds {", ".join(seeds)} give the same outputs; '
      'a threshold change moves only its own check')
PY
run a "" > /dev/null   # leave the default outputs in place, also when a comparison failed
exit $status
