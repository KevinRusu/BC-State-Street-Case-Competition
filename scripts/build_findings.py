"""Builds docs/FINDINGS.md from the deliverable notebook's defect register, so no finding is ever typed in by hand.

Step by step:
1. Read outputs/02_defect_register.csv (one line per finding) and outputs/02_run_info.csv (how the run was made).
2. Write a banner: generated, do not edit; the register's checksum (scripts/check_docs.py compares it with
   the current register to catch a stale FINDINGS.md); the run's config, seed, snapshot date and runtime.
3. One table per evidence status (confirmed, unresolved, cleared), in the register's own order.
4. A "Scorecard" section from outputs/02_scorecard.csv (platform and domain rows), 02_kpis.csv and 02_indicators.csv
   (each value with its unit and threshold); a missing file is named in the section instead. Three fixed notes say
   where the views count differently (they hold no number).
5. Fill the fact cards in docs/DEFECT_CATALOG.md. A card sits between `<!-- card: name | name -->` and
   `<!-- /card -->`, naming one or more register findings; everything between the markers is rewritten from the
   register (with its checksum, which scripts/check_docs.py also compares). The prose around the cards is not touched.

Run from the repo root after the deliverable notebook: uv run python scripts/build_findings.py
"""
import csv, hashlib, re, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REGISTER = ROOT / 'outputs' / '02_defect_register.csv'
RUN_INFO = ROOT / 'outputs' / '02_run_info.csv'
OUTPUTS = ROOT / 'outputs'
OUT = ROOT / 'docs' / 'FINDINGS.md'
CATALOG = ROOT / 'docs' / 'DEFECT_CATALOG.md'
CARD = re.compile(r'<!-- card: (.+?) -->\n.*?<!-- /card -->', re.S)
STATUSES = ['confirmed', 'unresolved', 'cleared']
COLUMNS = ['finding', 'stage', 'unit', 'affected', 'eligible', 'not evaluable', 'rule', 'examples']


def checksum(path):
    """The register's fingerprint, the same on Windows and Mac (scripts/check_docs.py uses this one too)."""
    return hashlib.sha256(path.read_bytes().replace(b'\r\n', b'\n')).hexdigest()[:12]


def cell(value):
    value = value.replace('|', '\\|').replace('\n', ' ')
    return f'{int(value):,}' if value.isdigit() else value


SCORECARD_FILES = ('02_scorecard.csv', '02_kpis.csv', '02_indicators.csv')


def scorecard_checksum(folder=OUTPUTS):
    """One fingerprint of the files the Scorecard section reads ('' when none exists); check_docs.py compares it."""
    digest, found = hashlib.sha256(), False
    for name in SCORECARD_FILES:
        path = folder / name
        if path.is_file():
            found = True
            digest.update(name.encode() + b'\0' + path.read_bytes().replace(b'\r\n', b'\n'))
    return digest.hexdigest()[:12] if found else ''


def read_output(folder, name):
    path = folder / name
    return list(csv.DictReader(path.open(newline='', encoding='utf-8'))) if path.is_file() else None


def scorecard_lines(folder=OUTPUTS):
    """The generated Scorecard section: platform and domain scores, the KPIs, the indicator headline values."""
    lines = ['', '## Scorecard', '',
             f'*From `outputs/02_scorecard.csv`, `02_kpis.csv` and `02_indicators.csv`. Rule and test rows, accounts, '
             'sensitivity and the look-back stay in the CSVs. Scores and coverage are on a 0-100 scale.*',
             '', f'- Scorecard checksum: `{scorecard_checksum(folder) or "none"}`']
    scorecard, kpis, indicators = (read_output(folder, n) for n in ('02_scorecard.csv', '02_kpis.csv',
                                                                   '02_indicators.csv'))
    for name, rows in (('02_scorecard.csv', scorecard), ('02_kpis.csv', kpis), ('02_indicators.csv', indicators)):
        if rows is None:
            lines += ['', f'`{name}` not found: rerun `notebooks/deliverable.ipynb`.']
    if scorecard is not None:
        lines += ['', '| Level | Domain | Score | Coverage | Confirmed-only score |', '|---|---|---|---|---|']
        lines += ['| ' + ' | '.join([r['level'].capitalize(), cell(r['domain']), r['score'], r['coverage'],
                                     r['confirmed_only_score']]) + ' |'
                  for r in scorecard if r['level'] in ('platform', 'domain')]
    if kpis is not None:
        lines += ['', '| KPI | Name | Value | Target | Met | Status |', '|---|---|---|---|---|---|']
        for r in kpis:
            value = f"{r['value']} {r['unit']}".strip() if r['value'] else 'not computed'
            lines.append('| ' + ' | '.join([r['n'], cell(r['kpi']), value, cell(r['target']), r['met'],
                                             r['status']]) + ' |')
    if indicators is not None:
        lines += ['', '| Indicator | Name | Status | Value | Threshold | Breaches | First breach |',
                  '|---|---|---|---|---|---|---|']
        lines += ['| ' + ' | '.join([r['id'], cell(r['indicator']), r['status'],
                                     f"{r['value']} {r.get('unit', '')}".strip() if r['value'] else '',
                                     cell(r.get('threshold', '')), r['breaches'], r['first_breach']]) + ' |'
                  for r in indicators]
    lines += ['', 'Where the views count differently:', '',
              '- KPI 1 reports trades on an unknown account separately (not evaluable), while the Accounts domain counts '
              'them as fails of `ACC.exists`.',
              '- I4 and KPI 5 count a flagged vendor quote that another vendor backs as not agreed (a strict reading), '
              'while `PRC.vendors` counts a backed quote as cleared.',
              '- The Corporate actions domain score, its confirmed-only score and I3 measure different things: a confirmed '
              'or unresolved finding on an action fails it in the domain score; only a confirmed finding fails it in the '
              'confirmed-only score; only quarantine fails it in I3.']
    return lines


def card(names, by_name, register_sum):
    """One fact card: a table with one line per named finding, then how each was detected."""
    missing = [n for n in names if n not in by_name]
    if missing:
        raise SystemExit(f'DEFECT_CATALOG.md names findings not in the register: {missing}')
    lines = [f"<!-- card: {' | '.join(names)} -->",
             f'*Facts generated from the register (checksum `{register_sum}`) by `scripts/build_findings.py`; '
             'do not edit between the markers.*', '',
             '| Register line | Status | Rule | Affected | Out of (eligible) | Not evaluable | Examples |',
             '|---|---|---|---|---|---|---|']
    for n in names:
        r = by_name[n]
        lines.append('| ' + ' | '.join([cell(n), f"**{r['status']}**", cell(r['rule']),
                                         f"{cell(r['affected'])} {r['unit']}", cell(r['eligible']),
                                         cell(r['not evaluable']), cell(r['examples'])]) + ' |')
    lines.append('')
    lines += [f"- *How detected ({cell(n)}):* {cell(by_name[n]['how detected'])}" for n in names]
    return '\n'.join(lines + ['<!-- /card -->'])


def fill_catalog(rows, register_sum):
    if not CATALOG.exists():
        print(f'note: {CATALOG.relative_to(ROOT)} not found; no cards filled')
        return
    by_name = {r['finding']: r for r in rows}
    text = CATALOG.read_text()
    new, count = CARD.subn(lambda m: card([n.strip() for n in m.group(1).split('|')], by_name, register_sum), text)
    CATALOG.write_text(new)
    print(f'filled {count} cards in {CATALOG.relative_to(ROOT)}')


def main():
    rows = list(csv.DictReader(REGISTER.open(newline='')))
    info = {r['item']: r['value'] for r in csv.DictReader(RUN_INFO.open(newline=''))}
    unknown = {r['status'] for r in rows} - set(STATUSES)
    if unknown:
        raise SystemExit(f'unknown status in the register: {sorted(unknown)}')
    commit = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], cwd=ROOT,
                            capture_output=True, text=True).stdout.strip()

    lines = [
        '# Findings',
        '',
        '*Generated by `scripts/build_findings.py` from `outputs/02_defect_register.csv`. Do not edit: rerun',
        '`notebooks/deliverable.ipynb`, then the script. Full write-ups of the classes we take forward are in',
        '`docs/DEFECT_CATALOG.md`.*',
        '',
        f'- Register checksum: `{checksum(REGISTER)}` (built at commit `{commit}`)',
        f"- Run: config `{info.get('config', '?')}`, snapshot {info.get('as_of_date', '?')}, "
        f"shuffle seed {info.get('shuffle_seed', '?')}, {info.get('runtime_seconds', '?')} s",
        f'- {len(rows)} findings: '
        + ', '.join(f"{sum(r['status'] == s for r in rows)} {s}" for s in STATUSES),
        '- Denominators: eligible + not evaluable = population (D-027 in `docs/DECISIONS.md`).',
    ]
    for status in STATUSES:
        group = [r for r in rows if r['status'] == status]
        if not group:
            continue
        lines += ['', f'## {status.capitalize()} ({len(group)})', '',
                  '| ' + ' | '.join(COLUMNS) + ' |', '|' + '---|' * len(COLUMNS)]
        lines += ['| ' + ' | '.join(cell(r[c]) for c in COLUMNS) + ' |' for r in group]
    lines += scorecard_lines()
    OUT.write_text('\n'.join(lines) + '\n')
    print(f'wrote {OUT.relative_to(ROOT)}: {len(rows)} findings')
    fill_catalog(rows, checksum(REGISTER))


if __name__ == '__main__':
    main()
