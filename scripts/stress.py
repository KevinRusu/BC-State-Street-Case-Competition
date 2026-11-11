"""Stress test helpers: draw a seeded sample of held equities and inject 100x snapshot prices on a copy of the data.

This file holds the pure functions (labels, date handling, eligible quotes, pool and sample draw, injected copy,
scoring); the deliverable notebook never imports it. Labels and sizes live in tests/stress/cases.toml (spec
docs/superpowers/specs/2026-11-11-stress-test-design.md).

Step by step:
1. load_labels reads the TOML labels file.
2. eligible_quotes keeps the snapshot quotes that could be scaled safely (readable, positive, in master currency).
3. build_pool lists the held equities the notebook already trusts (vendor check passed) with a second vendor.
4. draw_sample picks disjoint defect, lookalike and flip securities with a seeded generator.
5. edit_prices multiplies the chosen snapshot prices (and swaps vendor priorities for flips) and logs each change.
6. write_table and build_copy write the edited prices in the release's own format and a manifest pointing at the copy.
7. member_changes lists the register members that join or leave a line between the clean and the injected run.
8. score_cases gives each case its verdict line and level; unexplained and consequences sort the other member changes.
9. output_changes lists the other 02_*.csv rows that changed (numbers within 1e-9 count as equal).
10. score writes the run's provenance to 03_stress_run.csv, the edited cells to 03_stress_changes.csv and the register member changes to 03_stress_members.csv.
11. impact values each injection in USD and bps of fund net assets; rates, pick_showcase and
    deliverable_aggregates summarise; main runs the build and score commands.

Used by tests/test_stress.py: uv run python -m unittest tests.test_stress -v
"""
import csv
import datetime
import gzip
import hashlib
import io
import shutil
import argparse
import sys
import tempfile
import tomllib
from decimal import Decimal
from pathlib import Path

import numpy as np
import pandas as pd

ROLES = ['defect', 'lookalike', 'flip']


def load_labels(path: Path) -> dict:
    """Parse the labels TOML file."""
    with open(path, 'rb') as f:
        return tomllib.load(f)


def normalise_date(s: pd.Series) -> pd.Series:
    """Turn YYYY-MM-DD and DD/MM/YYYY text into YYYY-MM-DD text. Blanks stay blank; other values are unchanged."""
    iso = pd.to_datetime(s, format='%Y-%m-%d', errors='coerce')
    slash = pd.to_datetime(s, format='%d/%m/%Y', errors='coerce')
    return iso.fillna(slash).dt.strftime('%Y-%m-%d').fillna(s)


def eligible_quotes(prices: pd.DataFrame, securities: pd.DataFrame, as_of: str) -> pd.DataFrame:
    """Snapshot quotes with a readable price > 0 in the master currency, minus any (security, vendor) seen twice."""
    snap = prices[normalise_date(prices['price_date']) == as_of].copy()
    twice = snap.duplicated(['security_id', 'vendor'], keep=False)
    snap = snap[~twice]
    master = securities.drop_duplicates('security_id').set_index('security_id')['currency']
    snap['price_number'] = pd.to_numeric(snap['price'], errors='coerce')
    snap['priority'] = pd.to_numeric(snap['vendor_priority'], errors='coerce').astype(float)
    keep = (snap['price_number'] > 0) & (snap['currency'] == snap['security_id'].map(master))
    return snap[keep].reset_index(drop=True)


def build_pool(clean_dir: Path, tables: dict[str, pd.DataFrame], as_of: str) -> pd.DataFrame:
    """Held equities with a chosen vendor and a passed vendor check, plus the best other eligible vendor."""
    quality = pd.read_csv(Path(clean_dir) / '02_price_quality.csv', dtype=str, keep_default_na=False)
    securities = tables['securities']
    positions = tables['positions']
    held = set(positions.loc[normalise_date(positions['as_of_date']) == as_of, 'security_id'])
    duplicated = set(securities.loc[securities.duplicated('security_id', keep=False), 'security_id'])
    equities = set(securities.loc[securities['asset_class'] == 'EQUITY', 'security_id'])
    pool = quality[(quality['chosen_vendor'] != '') & (quality['vendor_check_result'] == 'pass')
                   & quality['security_id'].isin(held & equities - duplicated)]
    pool = pool[['security_id', 'chosen_vendor']].drop_duplicates('security_id')
    quotes = eligible_quotes(tables['prices'], securities, as_of)
    quotes = quotes.merge(pool, on='security_id')
    quotes = quotes[quotes['vendor'] != quotes['chosen_vendor']]
    best = (quotes.sort_values(['security_id', 'priority', 'vendor'])
            .drop_duplicates('security_id').set_index('security_id')['vendor'])
    pool['other_vendor'] = pool['security_id'].map(best).fillna('')
    return pool.sort_values('security_id').reset_index(drop=True)


def draw_sample(pool: pd.DataFrame, labels: dict) -> pd.DataFrame:
    """One row per case. Lookalikes are drawn first, then flips, then defects, all from the pool without repeats."""
    rng = np.random.default_rng(labels['seed'])
    remaining = pool.sort_values('security_id').reset_index(drop=True)
    rows = []
    with_other = int((remaining['other_vendor'] != '').sum())
    sizes = dict(labels['sizes'])
    if with_other < sizes['lookalike'] + sizes['flip']:  # scarce second vendors: split evenly, lookalike gets the odd one
        sizes['lookalike'] = (with_other + 1) // 2
        sizes['flip'] = with_other // 2
    for role in ['lookalike', 'flip', 'defect']:
        candidates = remaining if role == 'defect' else remaining[remaining['other_vendor'] != '']
        want = min(sizes[role], len(candidates))
        if want == 0:
            raise SystemExit(f"stress sample: no securities available for role '{role}'")
        picked = candidates.iloc[np.sort(rng.choice(len(candidates), size=want, replace=False))]
        remaining = remaining[~remaining['security_id'].isin(picked['security_id'])]
        for n, (_, r) in enumerate(picked.iterrows(), start=1):
            rows.append({'case': f'{role}-{n:02d}', 'role': role, 'security_id': r['security_id'],
                         'bad_vendor': r['chosen_vendor'] if role == 'defect' else r['other_vendor'],
                         'swap_with': r['chosen_vendor'] if role == 'flip' else ''})
    return pd.DataFrame(rows, columns=['case', 'role', 'security_id', 'bad_vendor', 'swap_with'])


CHANGE_COLUMNS = ['case', 'role', 'security_id', 'vendor', 'field', 'old', 'new']


def edit_prices(prices: pd.DataFrame, cases: pd.DataFrame, multiplier: str, as_of: str):
    """Multiply the bad vendor's snapshot price per case; flips also swap vendor_priority with swap_with.

    Returns (edited frame, field_changes). Only snapshot rows change; every value stays text.
    """
    edited = prices.copy()
    snap = normalise_date(edited['price_date']) == as_of
    log = []

    def rows_for(security_id, vendor):
        return edited.index[snap & (edited['security_id'] == security_id) & (edited['vendor'] == vendor)]

    for _, c in cases.iterrows():
        for i in rows_for(c['security_id'], c['bad_vendor']):
            old = edited.at[i, 'price']
            new = str(Decimal(old) * Decimal(multiplier))
            edited.at[i, 'price'] = new
            log.append([c['case'], c['role'], c['security_id'], c['bad_vendor'], 'price', old, new])
        if c['role'] == 'flip':
            for i in rows_for(c['security_id'], c['bad_vendor']):
                for j in rows_for(c['security_id'], c['swap_with']):
                    a, b = edited.at[i, 'vendor_priority'], edited.at[j, 'vendor_priority']
                    edited.at[i, 'vendor_priority'], edited.at[j, 'vendor_priority'] = b, a
                    log.append([c['case'], c['role'], c['security_id'], c['bad_vendor'],
                                'vendor_priority', a, b])
                    log.append([c['case'], c['role'], c['security_id'], c['swap_with'],
                                'vendor_priority', b, a])
    return edited, pd.DataFrame(log, columns=CHANGE_COLUMNS)


def write_table(frame: pd.DataFrame, path: Path, like: Path) -> None:
    """Write frame as CSV text in the format of the file `like` (gzip, line terminator, quoting)."""
    like = Path(like)
    opener = gzip.open if like.suffix == '.gz' else open
    with opener(like, 'rb') as f:
        head = f.read(65536)
    terminator = '\r\n' if b'\r\n' in head else '\n'
    quoting = csv.QUOTE_ALL if head.startswith(b'"') else csv.QUOTE_MINIMAL
    path = Path(path)
    if path.suffix == '.gz':
        # mtime=0 and no stored name keep the gzip bytes reproducible
        raw = open(path, 'wb')
        out = gzip.GzipFile(filename='', mode='wb', fileobj=raw, mtime=0)
        text = io.TextIOWrapper(out, encoding='utf-8', newline='')
    else:
        raw = out = None
        text = open(path, 'w', encoding='utf-8', newline='')
    try:
        writer = csv.writer(text, lineterminator=terminator, quoting=quoting)
        writer.writerow(frame.columns)
        writer.writerows(frame.itertuples(index=False, name=None))
    finally:
        text.close()
        if raw is not None:
            raw.close()


def build_copy(manifest_path: Path, cases: pd.DataFrame, labels: dict, as_of: str, out_dir: Path) -> pd.DataFrame:
    """Copy every table to out_dir/data/, rewrite prices with the edits, write out_dir/manifest.csv.

    Returns field_changes. Stops before writing anything if the release prices do not round-trip byte-identically.
    """
    manifest_path = Path(manifest_path)
    out_dir = Path(out_dir)
    manifest = pd.read_csv(manifest_path, dtype=str, keep_default_na=False)
    src = manifest_path.parent / manifest.loc[manifest['table'] == 'prices', 'file'].iloc[0]
    prices = pd.read_csv(src, dtype=str, keep_default_na=False)
    with tempfile.TemporaryDirectory() as tmp:
        probe = Path(tmp) / src.name
        write_table(prices, probe, src)
        same = (gzip.open(probe, 'rb').read() == gzip.open(src, 'rb').read()) if src.suffix == '.gz' \
            else probe.read_bytes() == src.read_bytes()
    if not same:
        raise SystemExit('stress copy: the prices file does not round-trip byte-identically; nothing written')
    edited, changes = edit_prices(prices, cases, labels['multiplier'], as_of)
    data_dir = out_dir / 'data'
    data_dir.mkdir(parents=True, exist_ok=True)
    new = manifest.copy()
    for i, r in manifest.iterrows():
        dest = data_dir / Path(r['file']).name
        if r['table'] == 'prices':
            write_table(edited, dest, src)
        else:
            shutil.copyfile(manifest_path.parent / r['file'], dest)
        new.at[i, 'file'] = f'data/{dest.name}'
        new.at[i, 'bytes'] = str(dest.stat().st_size)
        new.at[i, 'sha256'] = hashlib.sha256(dest.read_bytes()).hexdigest()
    new.to_csv(out_dir / 'manifest.csv', index=False, lineterminator='\n')
    return changes


def read_text(path: Path) -> pd.DataFrame:
    """A CSV read as text: every value a string, blanks as ''."""
    return pd.read_csv(path, dtype=str, keep_default_na=False)


def member_security(record_id: str, id_kind: str) -> str:
    """The security a register member refers to: the ID itself, the part after '/' for account/security, else ''."""
    if id_kind == 'security_id':
        return record_id
    if id_kind == 'account/security' and '/' in record_id:
        return record_id.split('/', 1)[1]
    return ''


MEMBER_CHANGE_COLUMNS = ['finding', 'id_kind', 'record_id', 'security_id', 'change']


def member_changes(clean_dir: Path, injected_dir: Path) -> pd.DataFrame:
    """Register members that join (only in the injected run) or leave (only in the clean run) a line.

    id_kind is the clean register's 'id kind'; a finding in only one register gets 'new line', and its security is
    read with the kind that register gives it.
    """
    kinds = {}
    for name in ['clean', 'injected']:
        folder = Path(clean_dir if name == 'clean' else injected_dir)
        register = read_text(folder / '02_defect_register.csv')
        kinds[name] = dict(zip(register['finding'], register['id kind']))
    clean = read_text(Path(clean_dir) / '02_finding_members.csv').drop_duplicates()
    injected = read_text(Path(injected_dir) / '02_finding_members.csv').drop_duplicates()
    both = clean.merge(injected, on=['finding', 'record_id'], how='outer', indicator=True)
    both = both[both['_merge'] != 'both'].copy()
    both['change'] = np.where(both['_merge'] == 'right_only', 'joined', 'left')
    kind = both['finding'].map(lambda f: kinds['clean'].get(f, kinds['injected'].get(f, '')))
    in_both = both['finding'].isin(kinds['clean'].keys() & kinds['injected'].keys())
    both['id_kind'] = kind.where(in_both, 'new line')
    both['security_id'] = [member_security(r, k) for r, k in zip(both['record_id'], kind)]
    both = both.sort_values(['finding', 'change', 'record_id']).reset_index(drop=True)
    return both[MEMBER_CHANGE_COLUMNS]


def verdict(joined: list[str], labels: dict) -> str:
    """The first split line the case joined (in the labels' order), else the first raw line, else ''."""
    for group in ['split', 'raw']:
        for line in labels['lines'][group]:
            if line in joined:
                return line
    return ''


def level_for(role: str, line: str, labels: dict) -> tuple[str, str]:
    """(verdict_line, level) for one case. Defect and flip: caught, partial or missed; lookalike: cleared, review or
    false_positive, with no price line counting as cleared ('not flagged')."""
    if role in ('defect', 'flip'):
        levels = labels['levels']['wrong']
        for level in ['caught', 'partial']:
            if line in levels[level]:
                return line, level
        return line, 'missed'
    if role == 'lookalike':
        if line == '':
            return 'not flagged', 'cleared'
        levels = labels['levels']['right']
        for level in ['cleared', 'review', 'false_positive']:
            if line in levels[level]:
                return line, level
        raise SystemExit(f"stress labels: line '{line}' has no level for a lookalike")
    raise SystemExit(f"stress score: unknown role '{role}'")


def score_cases(cases: pd.DataFrame, changes: pd.DataFrame, labels: dict) -> pd.DataFrame:
    """cases plus verdict_line, level and the lines each security joined and left ('; '-separated)."""
    out = cases.copy()
    rows = []
    for _, c in cases.iterrows():
        own = changes[changes['security_id'] == c['security_id']]
        joined = list(dict.fromkeys(own.loc[own['change'] == 'joined', 'finding']))
        left = list(dict.fromkeys(own.loc[own['change'] == 'left', 'finding']))
        line, level = level_for(c['role'], verdict(joined, labels), labels)
        rows.append((line, level, '; '.join(joined), '; '.join(left)))
    scored = pd.DataFrame(rows, columns=['verdict_line', 'level', 'joined', 'left'], index=cases.index)
    return pd.concat([out, scored], axis=1)


UNEXPLAINED_COLUMNS = ['kind', 'finding', 'record_id', 'security_id', 'change']


def unexplained(cases: pd.DataFrame, changes: pd.DataFrame) -> pd.DataFrame:
    """Member changes no injection explains: untouched securities ('false positive') and records with no security
    ('unattributable')."""
    injected = set(cases['security_id'])
    out = changes[~changes['security_id'].isin(injected)].copy()
    out['kind'] = np.where(out['security_id'] == '', 'unattributable', 'false positive')
    return out[UNEXPLAINED_COLUMNS].reset_index(drop=True)


def consequences(cases: pd.DataFrame, changes: pd.DataFrame, labels: dict) -> pd.DataFrame:
    """Injected-security member changes outside the split and raw price lines: reported, not scored."""
    price_lines = set(labels['lines']['split']) | set(labels['lines']['raw'])
    own = changes[changes['security_id'].isin(set(cases['security_id'])) & ~changes['finding'].isin(price_lines)]
    out = own.merge(cases[['case', 'role', 'security_id']], on='security_id', how='left')
    return out[['case', 'role'] + MEMBER_CHANGE_COLUMNS].reset_index(drop=True)


TOLERANCE = 1e-9   # as same() in tests/robustness_test.sh: summation order can move the last float digit


def numeric_columns(a: pd.DataFrame, b: pd.DataFrame) -> list[str]:
    """Columns that hold only numbers or blanks in both frames, and at least one number (same() in
    tests/robustness_test.sh)."""
    both = pd.concat([a, b], ignore_index=True)
    out = []
    for column in both.columns:
        x = pd.to_numeric(both[column], errors='coerce')
        if (x.notna() | (both[column] == '')).all() and x.notna().any():
            out.append(column)
    return out


def changed_rows(a: pd.DataFrame, b: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """(rows of a with no partner in b, rows of b with no partner in a). Same columns assumed.

    Two rows are partners when their text columns are equal and their numeric columns agree within TOLERANCE with
    blanks in the same places. Exact-text partners are paired first (as a multiset), then the rest by tolerance.
    """
    columns = list(a.columns)
    if a.empty or b.empty:
        return a.copy(), b.copy()
    x = a.assign(_n=a.groupby(columns, sort=False).cumcount())
    y = b.assign(_n=b.groupby(columns, sort=False).cumcount())
    both = x.merge(y, on=columns + ['_n'], how='outer', indicator=True)
    old = both.loc[both['_merge'] == 'left_only', columns].reset_index(drop=True)
    new = both.loc[both['_merge'] == 'right_only', columns].reset_index(drop=True)
    numeric = numeric_columns(a, b)
    if old.empty or new.empty or not numeric:
        return old, new
    text = [c for c in columns if c not in numeric]
    old_values = old[numeric].apply(pd.to_numeric).to_numpy(float)
    new_values = new[numeric].apply(pd.to_numeric).to_numpy(float)

    def keys(frame):   # itertuples on a frame with no columns yields nothing, hence the explicit empty keys
        return list(frame[text].itertuples(index=False, name=None)) if text else [()] * len(frame)

    old_keys = keys(old)
    new_by_key = {}
    for j, key in enumerate(keys(new)):
        new_by_key.setdefault(key, []).append(j)
    used_old = np.zeros(len(old), bool)
    used_new = np.zeros(len(new), bool)
    for i, key in enumerate(old_keys):
        candidates = np.array(new_by_key.get(key, []), dtype=int)
        free = candidates[~used_new[candidates]]
        if not len(free):
            continue
        u, v = old_values[i], new_values[free]
        same_blanks = (np.isnan(u) == np.isnan(v)).all(axis=1)
        close = (np.isnan(v) | np.isclose(u, v, rtol=TOLERANCE, atol=TOLERANCE)).all(axis=1)
        ok = same_blanks & close
        if ok.any():
            used_old[i] = True
            used_new[free[np.argmax(ok)]] = True
    return old[~used_old].reset_index(drop=True), new[~used_new].reset_index(drop=True)


OUTPUT_CHANGE_COLUMNS = ['file', 'rows_changed', 'scope', 'detail']


def output_changes(clean_dir: Path, injected_dir: Path, cases: pd.DataFrame, labels: dict) -> pd.DataFrame:
    """Rows of the deliverable's 02_*.csv outputs that differ between the clean and the injected run.

    Files with a security_id column: changed rows of injected securities are a 'consequence', of any other security a
    'false positive' (a blank security_id is 'unattributable'). Other files, and each register line whose counts or text changed, are 'aggregate'.
    rows_changed counts a changed row once (the larger of the old and new row counts).
    """
    clean_dir, injected_dir = Path(clean_dir), Path(injected_dir)
    injected = set(cases['security_id'])
    skip = {'02_finding_members.csv', *labels['ignore']['files']}
    names = sorted({p.name for d in (clean_dir, injected_dir) for p in d.glob('02_*.csv')} - skip)
    rows = []
    for name in names:
        a_path, b_path = clean_dir / name, injected_dir / name
        if not (a_path.exists() and b_path.exists()):
            only = a_path if a_path.exists() else b_path
            where = 'clean' if only == a_path else 'injected'
            rows.append([name, len(read_text(only)), 'aggregate', f'only in the {where} run'])
            continue
        a, b = read_text(a_path), read_text(b_path)
        if list(a.columns) != list(b.columns):
            rows.append([name, max(len(a), len(b)), 'aggregate', 'columns differ'])
            continue
        old, new = changed_rows(a, b)
        if old.empty and new.empty:
            continue
        if name == '02_defect_register.csv':
            order = list(dict.fromkeys(list(a['finding']) + list(b['finding'])))
            changed = set(old['finding']) | set(new['finding'])
            rows += [[name, 1, 'aggregate', f] for f in order if f in changed]
        elif 'security_id' in a.columns:
            for scope, keep in [('consequence', lambda x: x['security_id'].isin(injected)),
                                ('unattributable', lambda x: x['security_id'] == ''),
                                ('false positive', lambda x: ~x['security_id'].isin(injected)
                                 & (x['security_id'] != ''))]:
                o, n = old[keep(old)], new[keep(new)]
                if len(o) or len(n):
                    securities = ', '.join(sorted(set(o['security_id']) | set(n['security_id'])))
                    rows.append([name, max(len(o), len(n)), scope,
                                 f'{len(o)} old rows, {len(n)} new rows; securities: {securities}'])
        else:
            rows.append([name, max(len(old), len(new)), 'aggregate', f'{len(old)} old rows, {len(new)} new rows'])
    return pd.DataFrame(rows, columns=OUTPUT_CHANGE_COLUMNS)


def snapshot(frame: pd.DataFrame, column: str, as_of: str) -> pd.DataFrame:
    """Rows of frame whose date column, normalised, is the snapshot date."""
    return frame[normalise_date(frame[column]) == as_of]


def fx_table(fx_rates: pd.DataFrame, as_of: str, reporting_currency: str) -> pd.Series:
    """Snapshot rate to USD by currency: dates normalised, currencies that repeat dropped, rate > 0; the reporting
    currency is 1.0."""
    snap = snapshot(fx_rates, 'rate_date', as_of)
    snap = snap[~snap.duplicated('currency', keep=False)]
    rate = pd.to_numeric(snap['rate_to_usd'], errors='coerce')
    out = pd.Series(rate.to_numpy(float), index=snap['currency'].to_numpy())[rate.to_numpy() > 0]
    out[reporting_currency] = 1.0
    return out


def fund_net_assets(ledger_nav: pd.DataFrame, as_of: str) -> pd.Series:
    """Snapshot net assets per fund as in the deliverable's severity section (notebook section 11): a fund with a
    repeated (fund, share class) or an unreadable value is NaN, otherwise the sum; a sum <= 0 is NaN."""
    snap = snapshot(ledger_nav, 'as_of_date', as_of).copy()
    snap['na'] = pd.to_numeric(snap['net_assets'], errors='coerce')
    snap['bad'] = snap.duplicated(['fund_id', 'share_class'], keep=False) | snap['na'].isna()
    total = snap.groupby('fund_id')['na'].sum()
    total[snap.groupby('fund_id')['bad'].any()] = np.nan
    return total.where(total > 0)


def valued_positions(tables: dict[str, pd.DataFrame], quality: pd.DataFrame, as_of: str,
                     reporting_currency: str) -> pd.DataFrame:
    """Snapshot positions with fund_id, numeric quantity, the clean chosen price and the FX rate to USD."""
    pos = snapshot(tables['positions'], 'as_of_date', as_of)[['account_id', 'security_id', 'quantity']].copy()
    pos['quantity'] = pd.to_numeric(pos['quantity'], errors='coerce')
    accounts = tables['accounts'].drop_duplicates('account_id', keep=False).set_index('account_id')['fund_id']
    pos['fund_id'] = pos['account_id'].map(accounts).fillna('')
    q = quality.drop_duplicates('security_id').set_index('security_id')
    pos['chosen_price'] = pd.to_numeric(pos['security_id'].map(q['chosen_price']), errors='coerce')
    pos['fx'] = pos['security_id'].map(q['master_currency']).map(fx_table(tables['fx_rates'], as_of,
                                                                         reporting_currency))
    return pos


IMPACT_COLUMNS = ['case', 'role', 'security_id', 'fund_id', 'signed_usd', 'gross_usd', 'fund_net_assets_usd',
                  'signed_bps', 'gross_bps', 'not_valued_reason']


def impact(cases: pd.DataFrame, field_changes: pd.DataFrame, tables: dict[str, pd.DataFrame], clean_dir: Path,
           as_of: str, reporting_currency: str) -> pd.DataFrame:
    """Dollar effect per (case, fund): sum of quantity x (injected - clean chosen price) x FX, signed and gross, and
    in bps of the fund's net assets. Look-alikes are zero. Where a value is missing the amount or bps is NaN and
    not_valued_reason says why (every NaN amount has a reason)."""
    quality = read_text(Path(clean_dir) / '02_price_quality.csv')
    pos = valued_positions(tables, quality, as_of, reporting_currency)
    net = fund_net_assets(tables['ledger_nav'], as_of)
    moved = field_changes[field_changes['field'] == 'price'].drop_duplicates('case').set_index('case')['new']
    rows = []
    for _, c in cases.iterrows():
        mine = pos[pos['security_id'] == c['security_id']]
        new_price = pd.to_numeric(moved.get(c['case'], np.nan), errors='coerce')
        for fund, g in mine.groupby('fund_id', sort=True):
            delta = 0.0 if c['role'] == 'lookalike' else new_price - g['chosen_price']
            usd = delta * g['fx']
            signed = (g['quantity'] * usd).sum(min_count=1)
            gross = (g['quantity'].abs() * usd.abs()).sum(min_count=1)
            na = net.get(fund, np.nan) if fund != '' else np.nan
            lookalike = c['role'] == 'lookalike'
            if not lookalike and pd.isna(new_price):
                reason = 'no injected price'
            elif not lookalike and mine['chosen_price'].isna().any():
                reason = 'no chosen price'
            elif not lookalike and mine['fx'].isna().any():
                reason = 'no FX rate'
            elif not lookalike and mine['quantity'].isna().any():
                reason = 'unreadable quantity'
            elif fund == '':
                reason = 'no fund'
            elif pd.isna(na):
                reason = 'no fund net assets'
            else:
                reason = ''
            if reason in ('no injected price', 'no chosen price', 'no FX rate', 'unreadable quantity'):
                signed, gross = np.nan, np.nan
            rows.append([c['case'], c['role'], c['security_id'], fund, signed, gross, na,
                         signed / na * 1e4 if reason == '' else np.nan,
                         gross / na * 1e4 if reason == '' else np.nan, reason])
    return pd.DataFrame(rows, columns=IMPACT_COLUMNS)


def first_value(path: Path, column: str, **where) -> str:
    """The `column` value of the first row of a CSV matching every column == value in `where`; '' when the file or
    row is missing."""
    path = Path(path)
    if not path.exists():
        return ''
    frame = read_text(path)
    for k, v in where.items():
        frame = frame[frame[k] == v]
    return frame[column].iloc[0] if len(frame) else ''


SCALE_SEVERITY = 'Vendor quotes: scale flag (ratio near 100)'


def deliverable_aggregates(clean_dir: Path, injected_dir: Path) -> pd.DataFrame:
    """Before and after (text) of the deliverable's own aggregates, read from its 02_*.csv outputs."""
    reads = [('platform score', '02_scorecard.csv', 'score', dict(level='platform')),
             ('Prices domain score', '02_scorecard.csv', 'score', dict(level='domain', domain='Prices')),
             ('KPI 5 value', '02_kpis.csv', 'value', dict(n='5')),
             ('I4 value', '02_indicators.csv', 'value', dict(id='I4')),
             ('scale flag: financial_rows (upper bound)', '02_severity.csv', 'financial_rows',
              dict(scenario=SCALE_SEVERITY)),
             ('scale flag: gross_delta_usd_valued_subset (upper bound)', '02_severity.csv',
              'gross_delta_usd_valued_subset', dict(scenario=SCALE_SEVERITY))]
    rows = [[m, first_value(Path(clean_dir) / f, col, **w), first_value(Path(injected_dir) / f, col, **w)]
            for m, f, col, w in reads]
    return pd.DataFrame(rows, columns=['measure', 'before', 'after'])


LEVELS = {'defect': ['caught', 'partial', 'missed'], 'flip': ['caught', 'partial', 'missed'],
          'lookalike': ['cleared', 'review', 'false_positive']}


def rates(scored: pd.DataFrame, flagged: pd.DataFrame, wanted: dict | None = None) -> pd.DataFrame:
    """Cases per role and level with their share of the role's drawn cases, the drawn count and the wanted size.

    A role with no drawn case keeps one row (drawn 0) when its wanted size is known. `flagged` has a `scope` column:
    the rows scoped 'false positive' and 'unattributable' (member and output changes together) are counted in the
    two untouched rows, so they add up to what makes the score command fail. Each untouched row counts one member
    change or one changed output file, not securities.
    """
    rows = []
    for role in ROLES:
        mine = scored[scored['role'] == role]
        size = (wanted or {}).get(role, '')
        if mine.empty:
            if role in (wanted or {}):
                rows.append([role, '', 0, np.nan, 0, size])
            continue
        for level in LEVELS[role]:
            n = int((mine['level'] == level).sum())
            rows.append([role, level, n, n / len(mine), len(mine), size])
    for scope in ['false positive', 'unattributable']:
        rows.append(['untouched', scope, int((flagged['scope'] == scope).sum()), np.nan, '', ''])
    return pd.DataFrame(rows, columns=['role', 'level', 'cases', 'share', 'drawn', 'wanted'])


def held_values(tables: dict[str, pd.DataFrame], clean_dir: Path, as_of: str, reporting_currency: str) -> pd.Series:
    """Held value per security: sum of |quantity| x chosen price x FX over its snapshot positions."""
    quality = read_text(Path(clean_dir) / '02_price_quality.csv')
    pos = valued_positions(tables, quality, as_of, reporting_currency)
    return (pos['quantity'].abs() * pos['chosen_price'] * pos['fx']).groupby(pos['security_id']).sum(min_count=1)


def pick_showcase(scored: pd.DataFrame, impact: pd.DataFrame, pool_values: pd.Series) -> pd.Series:
    """True for one caught defect and one cleared look-alike: the case whose held value is closest to the median held
    value of its role's cases, ties by security_id. pool_values is the held value per security_id (`impact` is
    accepted for the interface; the held value does not come from it)."""
    flag = pd.Series(False, index=scored.index)
    for role, level in [('defect', 'caught'), ('lookalike', 'cleared')]:
        mine = scored[scored['role'] == role]
        value = mine['security_id'].map(pool_values).astype(float)
        median = value.median()
        candidates = mine[(mine['level'] == level) & value.notna()]
        if candidates.empty:
            continue
        order = pd.DataFrame({'gap': (value[candidates.index] - median).abs(),
                              'sec': candidates['security_id']}).sort_values(['gap', 'sec'])
        flag[order.index[0]] = True
    return flag


def snapshot_quotes(cases: pd.DataFrame, field_changes: pd.DataFrame, prices: pd.DataFrame, as_of: str) -> pd.Series:
    """Per case, the security's snapshot quotes before injection as 'VENDOR=price' pairs joined by '; ': the injected
    copy's prices with the logged old values put back."""
    snap = snapshot(prices, 'price_date', as_of)
    out = []
    for _, c in cases.iterrows():
        old = field_changes[(field_changes['case'] == c['case']) & (field_changes['field'] == 'price')]
        old = dict(zip(old['vendor'], old['old']))
        mine = snap[snap['security_id'] == c['security_id']].sort_values(['vendor', 'price'])
        out.append('; '.join(f"{v}={old.get(v, p)}" for v, p in zip(mine['vendor'], mine['price'])))
    return pd.Series(out, index=cases.index, dtype=object)


def sha256_of(path: Path) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def run_record(args, labels: dict, work: Path) -> pd.DataFrame:
    """Provenance of a score run (item, value): config, labels, manifest, seed, sizes, multiplier, finish time."""
    manifest = Path(args.manifest) if args.manifest else work / 'manifest.csv'
    rows = [('config path', args.config), ('config sha256', sha256_of(args.config)),
            ('labels path', args.labels), ('labels sha256', sha256_of(args.labels)),
            ('manifest path', manifest), ('manifest sha256', sha256_of(manifest)),
            ('seed', labels['seed']), ('sizes', ', '.join(f'{k} {v}' for k, v in labels['sizes'].items())),
            ('multiplier', labels['multiplier']),
            ('finished at', datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'))]
    return pd.DataFrame([(k, str(v)) for k, v in rows], columns=['item', 'value'])


def load_tables(manifest_path: Path) -> dict[str, pd.DataFrame]:
    """Every table of a release manifest, read as text."""
    manifest_path = Path(manifest_path)
    manifest = read_text(manifest_path)
    return {r['table']: read_text(manifest_path.parent / r['file']) for _, r in manifest.iterrows()}


def read_config(path: Path) -> tuple[str, str]:
    """(snapshot as_of_date, reporting currency) from the reconciliation config."""
    with open(path, 'rb') as f:
        cfg = tomllib.load(f)
    return cfg['snapshot']['as_of_date'], cfg['fx']['reporting_currency']


DEFAULT_LABELS = Path(__file__).resolve().parents[1] / 'tests' / 'stress' / 'cases.toml'


def build(args) -> int:
    labels = load_labels(args.labels)
    as_of, _ = read_config(args.config)
    tables = load_tables(args.manifest)
    cases = draw_sample(build_pool(args.clean, tables, as_of), labels)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    changes = build_copy(args.manifest, cases, labels, as_of, out)
    cases.to_csv(out / 'cases.csv', index=False)
    changes.to_csv(out / 'field_changes.csv', index=False)
    for role in ROLES:
        drawn, wanted = int((cases['role'] == role).sum()), labels['sizes'][role]
        note = '' if drawn == wanted else '  (pool smaller than wanted: took all that could be drawn)'
        print(f'{role}: drew {drawn} of {wanted} wanted{note}')
    print(f'{len(changes)} field changes; copy in {out}')
    return 0


def score(args) -> int:
    labels = load_labels(args.labels)
    as_of, currency = read_config(args.config)
    work, outputs = Path(args.work), Path(args.outputs)
    outputs.mkdir(parents=True, exist_ok=True)
    cases, field_changes = read_text(work / 'cases.csv'), read_text(work / 'field_changes.csv')
    tables = load_tables(work / 'manifest.csv')
    changes = member_changes(args.clean, args.injected)
    scored = score_cases(cases, changes, labels)
    cons = consequences(cases, changes, labels)
    scored['consequences'] = [
        '; '.join(f"{r['finding']} ({r['change']})" for _, r in cons[cons['case'] == c].iterrows())
        for c in scored['case']]
    imp = impact(cases, field_changes, tables, args.clean, as_of, currency)
    scored['snapshot_quotes'] = snapshot_quotes(scored, field_changes, tables['prices'], as_of)
    scored['showcase'] = pick_showcase(scored, imp, held_values(tables, args.clean, as_of, currency))
    members = unexplained(cases, changes)
    members = members.assign(scope=members['kind'], source='members')
    other = output_changes(args.clean, args.injected, cases, labels)
    other = other.assign(source='outputs')
    bad = pd.concat([members, other], ignore_index=True)
    columns = ['source', 'scope', 'kind', 'finding', 'record_id', 'security_id', 'change', 'file', 'rows_changed',
               'detail']
    bad = bad.reindex(columns=columns).fillna('')
    rate = rates(scored, bad, labels['sizes'])
    aggregates = deliverable_aggregates(args.clean, args.injected).assign(source='deliverable')
    field_changes.to_csv(outputs / '03_stress_changes.csv', index=False)
    changes.to_csv(outputs / '03_stress_members.csv', index=False)
    scored.to_csv(outputs / '03_stress_cases.csv', index=False)
    rate.to_csv(outputs / '03_stress_rates.csv', index=False)
    bad.to_csv(outputs / '03_stress_unexplained.csv', index=False)
    pd.concat([imp.assign(source='stress'), aggregates], ignore_index=True).to_csv(
        outputs / '03_stress_impact.csv', index=False)
    run_record(args, labels, work).to_csv(outputs / '03_stress_run.csv', index=False)
    print(rate.to_string(index=False))
    failing = bad[bad['scope'].isin(['false positive', 'unattributable'])]
    if len(failing):
        print(f'{len(failing)} unexplained change(s) on untouched or unattributable records; see '
              f'{outputs / "03_stress_unexplained.csv"}')
    return 1 if len(failing) else 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = parser.add_subparsers(dest='command', required=True)
    b = sub.add_parser('build', help='draw the sample and write the injected copy')
    b.add_argument('--manifest', required=True)
    b.add_argument('--clean', required=True)
    b.add_argument('--out', required=True)
    b.add_argument('--config', required=True)
    b.add_argument('--labels', default=str(DEFAULT_LABELS))
    b.set_defaults(func=build)
    s = sub.add_parser('score', help='compare the clean and injected runs and write outputs/03_stress_*.csv')
    s.add_argument('--clean', required=True)
    s.add_argument('--injected', required=True)
    s.add_argument('--work', required=True)
    s.add_argument('--outputs', default='outputs')
    s.add_argument('--config', required=True)
    s.add_argument('--manifest', default='', help='the release manifest the clean run used (provenance only)')
    s.add_argument('--labels', default=str(DEFAULT_LABELS))
    s.set_defaults(func=score)
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == '__main__':
    sys.exit(main())
