"""Made-up stress-test files for the dashboard tests: 03_stress_rates.csv, 03_stress_impact.csv, 03_stress_run.csv.

The small fixture (tests/fixtures/small) has no held equity the stress test could draw, so tests/stress_test.sh
produces nothing for it. These files copy the shape of what scripts/stress.py writes (its column lists, roles and
levels are imported, so they cannot drift), so the store and the dashboard's stress section are tested with data.

Every value here is MADE UP for the dashboard tests: counts, shares, amounts, seed, checksum, time and path. The one
exception is the "platform score" before-value, read from the 02_scorecard.csv of the folder written to, so the
stress section sees a run that matches the scorecard.

Called by tests/store_test.sh and tests/prepare_dashboard_fixture.py, after the notebook and before build_store.py:
    uv run python tests/stress_fixture.py tests/runs/<folder>
"""
import csv
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts'))
from stress import IMPACT_COLUMNS, LEVELS, ROLES  # noqa: E402

# Made up: cases wanted (all drawn) per role, and the cases at each level, in LEVELS order.
SIZES = {'defect': 4, 'lookalike': 3, 'flip': 2}
CASES = {'defect': [3, 1, 0], 'lookalike': [2, 1, 0], 'flip': [2, 0, 0]}


def write_csv(path: Path, header: list, rows: list) -> None:
    with path.open('w', newline='', encoding='utf-8') as stream:
        writer = csv.writer(stream, lineterminator='\n')
        writer.writerow(header)
        writer.writerows(rows)


def platform_score(output: Path) -> str:
    """The platform score of the notebook run in `output` (02_scorecard.csv), as the text the file holds."""
    with (output / '02_scorecard.csv').open(newline='', encoding='utf-8') as stream:
        scores = [r['score'] for r in csv.DictReader(stream) if r['level'] == 'platform']
    assert len(scores) == 1, f'{output / "02_scorecard.csv"}: expected one platform row, found {len(scores)}'
    return scores[0]


def write(output: Path) -> None:
    """Write the three made-up stress files into `output`, a folder under tests/runs that already holds the notebook's
    02_scorecard.csv. Any other folder is refused, so made-up files never reach outputs/."""
    output = Path(output).resolve()
    if not output.is_relative_to(ROOT / 'tests' / 'runs'):
        raise ValueError(f'refusing to write made-up stress files outside tests/runs: {output}')
    rates = [[role, level, n, n / SIZES[role], SIZES[role], SIZES[role]]
             for role in ROLES for level, n in zip(LEVELS[role], CASES[role])]
    rates += [['untouched', 'false positive', 0, '', '', ''], ['untouched', 'unattributable', 0, '', '', '']]
    write_csv(output / '03_stress_rates.csv', ['role', 'level', 'cases', 'share', 'drawn', 'wanted'], rates)

    blank = dict.fromkeys(IMPACT_COLUMNS, '')
    impact = [  # one per-case row (fixture IDs), then two of the deliverable's own before/after measures
        dict(blank, case=1, role='defect', security_id='FXSEC1', fund_id='FXFUND1', signed_usd=1500.0,
             gross_usd=1500.0, fund_net_assets_usd=1000000.0, signed_bps=15.0, gross_bps=15.0, source='stress'),
        dict(blank, source='deliverable', measure='platform score', before=platform_score(output), after=88.5),
        dict(blank, source='deliverable', measure='scale flag: gross_delta_usd_valued_subset (upper bound)',
             before='', after=1500.0),
    ]
    header = IMPACT_COLUMNS + ['source', 'measure', 'before', 'after']
    write_csv(output / '03_stress_impact.csv', header, [[r.get(c, '') for c in header] for r in impact])

    run = [('labels path', '/made/up/for/the/dashboard/tests/cases.toml'), ('labels sha256', '0123456789abcdef' * 4),
           ('seed', 12345), ('sizes', ', '.join(f'{k} {v}' for k, v in SIZES.items())), ('multiplier', 100),
           ('finished at', '2026-01-01T00:00:00Z')]
    write_csv(output / '03_stress_run.csv', ['item', 'value'], run)


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(f'usage: {sys.argv[0]} <folder under tests/runs>')
    try:
        write(Path(sys.argv[1]))
    except ValueError as refusal:
        sys.exit(str(refusal))


if __name__ == '__main__':
    main()
