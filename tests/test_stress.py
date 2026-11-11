"""Tests for scripts/stress.py: the sample draw, the injected copy and the scoring."""
import contextlib
import gzip
import hashlib
import io
import sys
import tempfile
import unittest
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import stress  # noqa: E402

LABELS = stress.load_labels(ROOT / "tests" / "stress" / "cases.toml")
AS_OF = '2026-07-10'


def price(sec, vendor, p, cur='USD', date=AS_OF, prio='1'):
    return dict(security_id=sec, price_date=date, vendor=vendor, price=p, currency=cur,
                price_timestamp='', vendor_priority=prio)


def sec(sid, cls='EQUITY', cur='USD'):
    return dict(security_id=sid, asset_class=cls, currency=cur)


class SampleTests(unittest.TestCase):
    def test_eligible_quotes_drops_bad_and_duplicate(self):
        prices = pd.DataFrame([
            price('S1', 'A', '10'), price('S1', 'B', ''), price('S1', 'C', 'abc'), price('S1', 'D', '0'),
            price('S1', 'E', '10', cur='EUR'), price('S1', 'F', '10'), price('S1', 'F', '11'),
            price('S2', 'A', '5', date='10/07/2026'), price('S2', 'B', '5', date='2026-07-09'),
        ])
        out = stress.eligible_quotes(prices, pd.DataFrame([sec('S1'), sec('S2')]), AS_OF)
        self.assertEqual(sorted(zip(out['security_id'], out['vendor'])), [('S1', 'A'), ('S2', 'A')])
        self.assertEqual(out['price_number'].tolist(), [10.0, 5.0])
        self.assertEqual(out['priority'].dtype, float)

    def test_build_pool_rules(self):
        securities = pd.DataFrame([sec('OK1'), sec('OK2'), sec('OK3'), sec('BOND', 'BOND'), sec('SPREAD'),
                                   sec('BLANK'), sec('NOPOS'), sec('DUP'), sec('DUP')])
        held = ['OK1', 'OK2', 'OK3', 'BOND', 'SPREAD', 'BLANK', 'DUP']
        positions = pd.DataFrame([dict(position_id=str(i), security_id=s, as_of_date=AS_OF)
                                  for i, s in enumerate(held)])
        quality = pd.DataFrame([
            dict(security_id=s, chosen_vendor=v, vendor_check_result=r) for s, v, r in [
                ('OK1', 'A', 'pass'), ('OK2', 'A', 'pass'), ('OK3', 'A', 'pass'), ('BOND', 'A', 'pass'),
                ('SPREAD', 'A', 'spread above threshold'), ('BLANK', '', 'pass'), ('NOPOS', 'A', 'pass'),
                ('DUP', 'A', 'pass')]])
        prices = pd.DataFrame([
            price('OK1', 'A', '10', prio='1'), price('OK1', 'B', '10', prio='2'), price('OK1', 'C', '10', prio='3'),
            price('OK2', 'A', '10', prio='1'), price('OK2', 'B', '', prio='2'), price('OK2', 'C', '10', prio='3'),
            price('OK3', 'A', '10', prio='1'), price('OK3', 'B', '0', prio='2'),
        ])
        with tempfile.TemporaryDirectory() as d:
            quality.to_csv(Path(d) / '02_price_quality.csv', index=False)
            pool = stress.build_pool(Path(d), dict(securities=securities, positions=positions, prices=prices), AS_OF)
        self.assertEqual(pool['security_id'].tolist(), ['OK1', 'OK2', 'OK3'])
        self.assertEqual(pool['other_vendor'].tolist(), ['B', 'C', ''])
        self.assertEqual(pool['chosen_vendor'].tolist(), ['A', 'A', 'A'])

    @staticmethod
    def make_pool(n, with_other):
        return pd.DataFrame([dict(security_id=f'P{i:03d}', chosen_vendor='A',
                                  other_vendor='B' if i < with_other else '') for i in range(n)])

    def check_rows(self, out, pool):
        self.assertFalse(out['security_id'].duplicated().any())
        info = pool.set_index('security_id')
        for _, r in out.iterrows():
            chosen, other = info.loc[r['security_id'], ['chosen_vendor', 'other_vendor']]
            if r['role'] != 'defect':
                self.assertNotEqual(other, '')
            self.assertEqual(r['swap_with'], chosen if r['role'] == 'flip' else '')
            self.assertEqual(r['bad_vendor'], chosen if r['role'] == 'defect' else other)

    def test_draw_disjoint_and_sized(self):
        pool = self.make_pool(200, 150)
        out = stress.draw_sample(pool, LABELS)
        self.assertEqual(out['role'].value_counts().to_dict(), {'defect': 30, 'lookalike': 30, 'flip': 30})
        self.check_rows(out, pool)

    def test_draw_ignores_row_order(self):
        pool = self.make_pool(200, 150)
        pd.testing.assert_frame_equal(stress.draw_sample(pool, LABELS),
                                      stress.draw_sample(pool.sample(frac=1, random_state=5), LABELS))

    def test_draw_small_pool_takes_all(self):
        pool = self.make_pool(10, 4)
        out = stress.draw_sample(pool, LABELS)
        self.assertEqual(out['role'].value_counts().to_dict(), {'defect': 6, 'lookalike': 2, 'flip': 2})
        self.check_rows(out, pool)

    def test_draw_scarce_other_vendor_splits_evenly(self):
        pool = self.make_pool(100, 50)
        out = stress.draw_sample(pool, LABELS)
        counts = out['role'].value_counts().to_dict()
        self.assertEqual((counts['lookalike'], counts['flip']), (25, 25))
        self.check_rows(out, pool)

    def test_draw_odd_split_gives_lookalike_the_extra(self):
        out = stress.draw_sample(self.make_pool(10, 5), LABELS)
        counts = out['role'].value_counts().to_dict()
        self.assertEqual((counts['lookalike'], counts['flip']), (3, 2))

    def test_draw_empty_flip_raises(self):
        with self.assertRaises(SystemExit) as cm:
            stress.draw_sample(self.make_pool(10, 1), LABELS)
        self.assertIn('flip', str(cm.exception))

    def test_draw_empty_role_raises(self):
        with self.assertRaises(SystemExit) as cm:
            stress.draw_sample(self.make_pool(20, 0), LABELS)
        self.assertIn('lookalike', str(cm.exception))


class CopyTests(unittest.TestCase):
    FIXTURE = ROOT / 'tests' / 'fixtures' / 'small'

    @staticmethod
    def read_text(path):
        return pd.read_csv(path, dtype=str, keep_default_na=False)

    def test_round_trip_is_byte_identical(self):
        src = self.FIXTURE / 'prices.csv'
        frame = self.read_text(src)
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / 'prices.csv'
            stress.write_table(frame, out, src)
            self.assertEqual(out.read_bytes(), src.read_bytes())
            gz_like = Path(d) / 'like.csv.gz'
            gz_like.write_bytes(gzip.compress(src.read_bytes()))
            gz_out = Path(d) / 'out.csv.gz'
            stress.write_table(frame, gz_out, gz_like)
            self.assertEqual(gzip.decompress(gz_out.read_bytes()), src.read_bytes())

    def test_round_trip_crlf_and_quotes(self):
        frame = pd.DataFrame([dict(a='x,y', b='2')])
        with tempfile.TemporaryDirectory() as d:
            like = Path(d) / 'like.csv'
            like.write_bytes(b'a,b\r\n"x,y",2\r\n')
            out = Path(d) / 'out.csv'
            stress.write_table(frame, out, like)
            self.assertEqual(out.read_bytes(), like.read_bytes())

    def prices(self):
        return pd.DataFrame([
            price('S1', 'A', '269.7542', prio='1'), price('S1', 'B', '270.0000', prio='2'),
            price('S1', 'A', '260.0000', date='2026-07-09', prio='1'),
            price('S2', 'A', '10.0000', date='10/07/2026', prio='1'), price('S2', 'B', '10.0100', prio='3'),
        ])

    @staticmethod
    def case(role, sec_id, bad, swap=''):
        return pd.DataFrame([dict(case=f'{role}-01', role=role, security_id=sec_id, bad_vendor=bad, swap_with=swap)])

    def test_edit_multiplies_snapshot_only(self):
        prices = self.prices()
        edited, changes = stress.edit_prices(prices, self.case('defect', 'S1', 'A'), '100', AS_OF)
        self.assertEqual(edited.loc[0, 'price'], '26975.4200')
        self.assertEqual(edited.loc[2, 'price'], '260.0000')
        expected = prices.copy()
        expected.loc[0, 'price'] = '26975.4200'
        self.assertTrue(edited.equals(expected))
        self.assertEqual(changes.columns.tolist(), ['case', 'role', 'security_id', 'vendor', 'field', 'old', 'new'])
        self.assertEqual(len(changes), 1)
        self.assertEqual(changes.iloc[0]['old'], '269.7542')

    def test_edit_matches_slash_dates(self):
        edited, _ = stress.edit_prices(self.prices(), self.case('lookalike', 'S2', 'A'), '100', AS_OF)
        self.assertEqual(edited.loc[3, 'price'], '1000.0000')

    def test_flip_swaps_priority_on_snapshot_rows(self):
        prices = self.prices()
        edited, changes = stress.edit_prices(prices, self.case('flip', 'S2', 'B', 'A'), '100', AS_OF)
        self.assertEqual(edited.loc[4, 'price'], '1001.0000')
        self.assertEqual(edited.loc[4, 'vendor_priority'], '1')
        self.assertEqual(edited.loc[3, 'vendor_priority'], '3')
        self.assertEqual(edited.loc[3, 'price'], '10.0000')
        self.assertEqual(len(changes), 3)
        self.assertEqual(sorted(changes['field']), ['price', 'vendor_priority', 'vendor_priority'])
        _, changes = stress.edit_prices(prices, self.case('defect', 'S1', 'A'), '100', AS_OF)
        self.assertEqual(len(changes), 1)

    def test_build_copy_manifest(self):
        cases = self.case('defect', 'FXSEC1', 'FIXTURE_V1')
        old = pd.read_csv(self.FIXTURE / 'manifest.csv', dtype=str, keep_default_na=False)
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / 'copy'
            changes = stress.build_copy(self.FIXTURE / 'manifest.csv', cases, LABELS, AS_OF, out)
            new = pd.read_csv(out / 'manifest.csv', dtype=str, keep_default_na=False)
            self.assertEqual(new['table'].tolist(), old['table'].tolist())
            for _, r in new.iterrows():
                self.assertTrue((out / r['file']).exists())
            self.assertEqual(new['rows'].tolist(), old['rows'].tolist())
            self.assertEqual(new['columns'].tolist(), old['columns'].tolist())
            row = new[new['table'] == 'prices'].iloc[0]
            data = (out / row['file']).read_bytes()
            self.assertEqual(hashlib.sha256(data).hexdigest(), row['sha256'])
            self.assertEqual(int(row['bytes']), len(data))
            a = (self.FIXTURE / 'prices.csv').read_text().splitlines()
            b = data.decode().splitlines()
            self.assertEqual(len(a), len(b))
            self.assertEqual(sum(x != y for x, y in zip(a, b)), 1)
            self.assertEqual(len(changes), 1)


SCALE_RAW = 'Vendor quotes on the snapshot date: scale flag (ratio near 100)'
SCALE_ODD = 'Scale flag: the chosen quote is the odd one out'
SCALE_BACKED = 'Scale flag: the chosen quote is backed by another vendor'
NO_TWO = 'Spread or scale flag: no two vendors agree'
CUTOFF = 'Chosen quote stamped after the NAV cutoff'
POSITION = 'Position in the book with no custodian record'
TRADE = 'Negative trade quantity'
KINDS = {SCALE_RAW: 'security_id', SCALE_ODD: 'security_id', SCALE_BACKED: 'security_id', NO_TWO: 'security_id',
         CUTOFF: 'security_id', POSITION: 'account/security', TRADE: 'transaction_id'}
REGISTER_COLUMNS = ['finding', 'status', 'rule', 'stage', 'unit', 'affected', 'eligible', 'not evaluable',
                    'population', 'examples', 'id kind', 'how detected']


def write_run(folder, members):
    """A made-up register and members pair: every line in KINDS, members as (finding, record_id) pairs."""
    folder.mkdir(parents=True, exist_ok=True)
    frame = pd.DataFrame(members, columns=['finding', 'record_id'])
    register = pd.DataFrame([dict(finding=f, status='confirmed', rule='R', stage='s', unit='rows',
                                  affected=str(int((frame['finding'] == f).sum())), eligible='10',
                                  population='10', examples='', how_detected='made up', id_kind=k)
                             for f, k in KINDS.items()]).rename(columns={'id_kind': 'id kind',
                                                                         'how_detected': 'how detected'})
    register['not evaluable'] = '0'
    register[REGISTER_COLUMNS].to_csv(folder / '02_defect_register.csv', index=False)
    frame.to_csv(folder / '02_finding_members.csv', index=False)


def cases_frame(rows):
    return pd.DataFrame([dict(case=c, role=r, security_id=s, bad_vendor='B', swap_with='')
                         for c, r, s in rows], columns=['case', 'role', 'security_id', 'bad_vendor', 'swap_with'])


class ScoreTests(unittest.TestCase):
    def changes(self, before, after):
        with tempfile.TemporaryDirectory() as d:
            write_run(Path(d) / 'clean', before)
            write_run(Path(d) / 'injected', after)
            return stress.member_changes(Path(d) / 'clean', Path(d) / 'injected')

    def test_member_changes_columns(self):
        out = self.changes([(CUTOFF, 'SECOLD')], [(CUTOFF, 'SECNEW'), (POSITION, 'ACCX/SECINJ')])
        self.assertEqual(out.columns.tolist(), ['finding', 'id_kind', 'record_id', 'security_id', 'change'])
        got = {(r['record_id'], r['security_id'], r['change'], r['id_kind']) for _, r in out.iterrows()}
        self.assertEqual(got, {('SECOLD', 'SECOLD', 'left', 'security_id'),
                               ('SECNEW', 'SECNEW', 'joined', 'security_id'),
                               ('ACCX/SECINJ', 'SECINJ', 'joined', 'account/security')})

    def test_verdict_levels_wrong(self):
        cases = cases_frame([('defect-01', 'defect', 'SECA'), ('defect-02', 'defect', 'SECB'),
                             ('flip-01', 'flip', 'SECC'), ('defect-03', 'defect', 'SECD')])
        changes = self.changes([], [(SCALE_RAW, 'SECA'), (SCALE_ODD, 'SECA'), (NO_TWO, 'SECB'),
                                    (SCALE_BACKED, 'SECC')])
        out = stress.score_cases(cases, changes, LABELS).set_index('case')
        self.assertEqual(out['level'].to_dict(), {'defect-01': 'caught', 'defect-02': 'partial',
                                                  'flip-01': 'missed', 'defect-03': 'missed'})
        self.assertEqual(out.loc['defect-01', 'verdict_line'], SCALE_ODD)
        self.assertEqual(out.loc['defect-02', 'verdict_line'], NO_TWO)
        self.assertEqual(set(out.loc['defect-01', 'joined'].split('; ')), {SCALE_RAW, SCALE_ODD})
        self.assertEqual(out.loc['defect-03', 'joined'], '')
        self.assertEqual(out.loc['defect-03', 'left'], '')

    def test_verdict_levels_right(self):
        cases = cases_frame([('lookalike-01', 'lookalike', 'SECA'), ('lookalike-02', 'lookalike', 'SECB'),
                             ('lookalike-03', 'lookalike', 'SECC'), ('lookalike-04', 'lookalike', 'SECD')])
        changes = self.changes([], [(SCALE_RAW, 'SECA'), (SCALE_BACKED, 'SECA'), (SCALE_RAW, 'SECB'),
                                    (SCALE_ODD, 'SECC')])
        out = stress.score_cases(cases, changes, LABELS).set_index('case')
        self.assertEqual(out['level'].to_dict(), {'lookalike-01': 'cleared', 'lookalike-02': 'review',
                                                  'lookalike-03': 'false_positive', 'lookalike-04': 'cleared'})
        self.assertEqual(out.loc['lookalike-01', 'verdict_line'], SCALE_BACKED)
        self.assertEqual(out.loc['lookalike-02', 'verdict_line'], SCALE_RAW)
        self.assertEqual(out.loc['lookalike-04', 'verdict_line'], 'not flagged')

    def test_left_line_is_listed(self):
        cases = cases_frame([('defect-01', 'defect', 'SECA')])
        out = stress.score_cases(cases, self.changes([(CUTOFF, 'SECA')], []), LABELS)
        self.assertEqual(out.loc[0, 'left'], CUTOFF)
        self.assertEqual(out.loc[0, 'level'], 'missed')

    def test_untouched_security_is_false_positive(self):
        cases = cases_frame([('defect-01', 'defect', 'SECINJ')])
        changes = self.changes([], [(CUTOFF, 'SECOTHER'), (SCALE_ODD, 'SECINJ')])
        out = stress.unexplained(cases, changes)
        self.assertEqual(out.columns.tolist(), ['kind', 'finding', 'record_id', 'security_id', 'change'])
        self.assertEqual(out[['kind', 'finding', 'security_id']].values.tolist(),
                         [['false positive', CUTOFF, 'SECOTHER']])

    def test_account_security_member_attributed(self):
        cases = cases_frame([('defect-01', 'defect', 'SECINJ')])
        changes = self.changes([], [(POSITION, 'ACCX/SECINJ'), (SCALE_ODD, 'SECINJ')])
        self.assertEqual(len(stress.unexplained(cases, changes)), 0)
        out = stress.consequences(cases, changes, LABELS)
        self.assertEqual(out[['finding', 'record_id', 'security_id']].values.tolist(),
                         [[POSITION, 'ACCX/SECINJ', 'SECINJ']])
        self.assertEqual(out['case'].tolist(), ['defect-01'])

    def test_non_security_member_unattributable(self):
        cases = cases_frame([('defect-01', 'defect', 'SECINJ')])
        out = stress.unexplained(cases, self.changes([], [(TRADE, 'TXNX1')]))
        self.assertEqual(out[['kind', 'record_id', 'security_id']].values.tolist(),
                         [['unattributable', 'TXNX1', '']])

    def test_output_changes_scopes(self):
        cases = cases_frame([('defect-01', 'defect', 'SECINJ')])
        quality = pd.DataFrame(dict(security_id=['SECINJ', 'SECU1', 'SECU2', 'SECU3'],
                                    chosen_price=['10.5', '20.25', '30.1', '1.000000000000'],
                                    flag_class=['', '', 'spread', '']))
        quality_after = quality.copy()
        quality_after['chosen_price'] = ['1050.0', '20.25', '30.1', '1.000000000001']  # last: 1e-12 noise
        quality_after['flag_class'] = ['scale', 'spread', 'spread', '']
        score = pd.DataFrame(dict(level=['platform', 'domain'], domain=['', 'Prices'], score=['81.62', '90.0']))
        score_after = score.copy()
        score_after['score'] = ['80.0', '90.0000000000001']
        ignored = pd.DataFrame(dict(item=['started'], value=['a']))
        with tempfile.TemporaryDirectory() as d:
            clean, injected = Path(d) / 'clean', Path(d) / 'injected'
            write_run(clean, [(CUTOFF, 'SECU9')])
            write_run(injected, [(CUTOFF, 'SECU9'), (SCALE_ODD, 'SECINJ')])
            for folder, q, s, i in [(clean, quality, score, 'a'), (injected, quality_after, score_after, 'b')]:
                q.to_csv(folder / '02_price_quality.csv', index=False)
                s.to_csv(folder / '02_scorecard.csv', index=False)
                ignored.assign(value=i).to_csv(folder / '02_run_info.csv', index=False)
            out = stress.output_changes(clean, injected, cases, LABELS)
        self.assertEqual(out.columns.tolist(), ['file', 'rows_changed', 'scope', 'detail'])
        rows = {(r['file'], r['scope']): r for _, r in out.iterrows()}
        self.assertEqual(set(rows), {('02_price_quality.csv', 'consequence'),
                                     ('02_price_quality.csv', 'false positive'),
                                     ('02_scorecard.csv', 'aggregate'),
                                     ('02_defect_register.csv', 'aggregate')})
        self.assertEqual(rows[('02_price_quality.csv', 'consequence')]['rows_changed'], 1)
        self.assertEqual(rows[('02_price_quality.csv', 'false positive')]['rows_changed'], 1)
        self.assertIn('SECU1', rows[('02_price_quality.csv', 'false positive')]['detail'])
        self.assertEqual(rows[('02_scorecard.csv', 'aggregate')]['rows_changed'], 1)
        self.assertEqual(rows[('02_defect_register.csv', 'aggregate')]['detail'], SCALE_ODD)

    def test_output_changes_float_noise_only(self):
        a = pd.DataFrame(dict(name=['x', 'y'], value=['0.30000000000000004', '7'], blank=['', '1']))
        b = pd.DataFrame(dict(name=['y', 'x'], value=['7.000000000001', '0.3'], blank=['1', '']))
        with tempfile.TemporaryDirectory() as d:
            clean, injected = Path(d) / 'clean', Path(d) / 'injected'
            write_run(clean, [])
            write_run(injected, [])
            a.to_csv(clean / '02_kpis.csv', index=False)
            b.to_csv(injected / '02_kpis.csv', index=False)
            out = stress.output_changes(clean, injected, cases_frame([]), LABELS)
        self.assertEqual(len(out), 0)


    def test_changed_rows_all_numeric(self):
        a = pd.DataFrame(dict(x=['1', '2.0000000000001', '', '5']))
        b = pd.DataFrame(dict(x=['2', '', '1.0', '6']))
        old, new = stress.changed_rows(a, b)
        self.assertEqual((old['x'].tolist(), new['x'].tolist()), (['5'], ['6']))


def snap_row(**kw):
    return kw


class ImpactTests(unittest.TestCase):
    """impact, rates, showcase and the score command."""

    def tables(self, accounts=None, ledger=None, fx=None, positions=None):
        accounts = accounts or [('ACC1', 'F1', 'A'), ('ACC2', 'F1', 'A')]
        ledger = ledger or [('L1', 'F1', 'A', '10000000.00')]
        fx = fx or [('EUR', AS_OF, '2.000000')]
        positions = positions or [('ACC1', 'SECD', '10'), ('ACC2', 'SECD', '-4'), ('ACC1', 'SECL', '7')]
        return dict(
            accounts=pd.DataFrame([dict(account_id=a, fund_id=f, share_class=c) for a, f, c in accounts]),
            ledger_nav=pd.DataFrame([dict(ledger_id=i, fund_id=f, share_class=c, net_assets=n, as_of_date=AS_OF)
                                     for i, f, c, n in ledger]),
            fx_rates=pd.DataFrame([dict(currency=c, rate_date=d, rate_to_usd=r) for c, d, r in fx]),
            positions=pd.DataFrame([dict(account_id=a, security_id=s, quantity=q, as_of_date=AS_OF)
                                    for a, s, q in positions]))

    @staticmethod
    def quality(d, rows):
        pd.DataFrame([dict(security_id=s, chosen_price=p, master_currency=c) for s, p, c in rows]).to_csv(
            Path(d) / '02_price_quality.csv', index=False)

    @staticmethod
    def changes(rows):
        return pd.DataFrame([dict(case=c, role=r, security_id=s, vendor='V', field='price', old=o, new=n)
                             for c, r, s, o, n in rows],
                            columns=['case', 'role', 'security_id', 'vendor', 'field', 'old', 'new'])

    def run_impact(self, tables, quality, cases, changes):
        with tempfile.TemporaryDirectory() as d:
            self.quality(d, quality)
            return stress.impact(cases, changes, tables, Path(d), AS_OF, 'USD')

    def test_impact_defect(self):
        cases = cases_frame([('defect-01', 'defect', 'SECD')])
        out = self.run_impact(self.tables(), [('SECD', '5.00', 'USD')], cases,
                              self.changes([('defect-01', 'defect', 'SECD', '5.00', '500.00')]))
        self.assertEqual(out.columns.tolist(), ['case', 'role', 'security_id', 'fund_id', 'signed_usd', 'gross_usd',
                                                'fund_net_assets_usd', 'signed_bps', 'gross_bps',
                                                'not_valued_reason'])
        self.assertEqual(len(out), 1)
        r = out.iloc[0]
        self.assertAlmostEqual(r['signed_usd'], 2970.0)
        self.assertAlmostEqual(r['gross_usd'], 6930.0)
        self.assertAlmostEqual(r['fund_net_assets_usd'], 1e7)
        self.assertAlmostEqual(r['signed_bps'], 2.97)
        self.assertAlmostEqual(r['gross_bps'], 6.93)
        self.assertEqual(r['not_valued_reason'], '')
        self.assertEqual(r['fund_id'], 'F1')

    def test_impact_fx_and_two_funds(self):
        tables = self.tables(accounts=[('ACC1', 'F1', 'A'), ('ACC2', 'F2', 'A')],
                             ledger=[('L1', 'F1', 'A', '1000'), ('L2', 'F2', 'A', '2000')])
        cases = cases_frame([('defect-01', 'defect', 'SECD')])
        out = self.run_impact(tables, [('SECD', '5.00', 'EUR')], cases,
                              self.changes([('defect-01', 'defect', 'SECD', '5.00', '500.00')])).set_index('fund_id')
        self.assertAlmostEqual(out.loc['F1', 'signed_usd'], 10 * 495 * 2)
        self.assertAlmostEqual(out.loc['F2', 'signed_usd'], -4 * 495 * 2)
        self.assertAlmostEqual(out.loc['F2', 'gross_usd'], 4 * 495 * 2)

    def test_impact_lookalike_zero(self):
        cases = cases_frame([('lookalike-01', 'lookalike', 'SECL')])
        out = self.run_impact(self.tables(), [('SECL', '5.00', 'USD')], cases,
                              self.changes([('lookalike-01', 'lookalike', 'SECL', '5.00', '500.00')]))
        r = out.iloc[0]
        self.assertEqual((r['signed_usd'], r['gross_usd'], r['signed_bps'], r['gross_bps']), (0, 0, 0, 0))

    def test_impact_not_valued(self):
        tables = self.tables(accounts=[('ACC1', 'F1', 'A'), ('ACC2', 'F2', 'A'), ('ACC9', 'F2', 'A')],
                             ledger=[('L1', 'F1', 'A', '1000'), ('L2', 'F2', 'A', '2000'), ('L3', 'F2', 'A', '5')])
        cases = cases_frame([('defect-01', 'defect', 'SECD')])
        changes = self.changes([('defect-01', 'defect', 'SECD', '5.00', '500.00')])
        out = self.run_impact(tables, [('SECD', '5.00', 'EUR')], cases, changes)
        self.assertTrue((out['not_valued_reason'] != 'no FX rate').all())
        no_rate = self.run_impact(self.tables(fx=[('EUR', '2026-07-09', '2')]), [('SECD', '5.00', 'EUR')], cases,
                                  changes)
        self.assertEqual(no_rate['not_valued_reason'].tolist(), ['no FX rate'])
        self.assertTrue(no_rate['signed_usd'].isna().all() and no_rate['gross_usd'].isna().all())
        repeated = self.run_impact(tables, [('SECD', '5.00', 'USD')], cases, changes).set_index('fund_id')
        self.assertEqual(repeated.loc['F2', 'not_valued_reason'], 'no fund net assets')
        self.assertTrue(pd.isna(repeated.loc['F2', 'signed_bps']))
        self.assertAlmostEqual(repeated.loc['F2', 'signed_usd'], -4 * 495)
        self.assertEqual(repeated.loc['F1', 'not_valued_reason'], '')
        nofund = self.run_impact(self.tables(accounts=[('ACC1', 'F1', 'A')]), [('SECD', '5.00', 'USD')], cases,
                                 changes).set_index('fund_id')
        self.assertEqual(nofund.loc['', 'not_valued_reason'], 'no fund')

    def test_fund_net_assets_rules(self):
        ledger = pd.DataFrame([dict(fund_id=f, share_class=c, net_assets=n, as_of_date=d) for f, c, n, d in [
            ('OK', 'A', '10', AS_OF), ('OK', 'B', '5', AS_OF), ('OLD', 'A', '99', '2026-07-09'),
            ('DUP', 'A', '1', AS_OF), ('DUP', 'A', '1', AS_OF), ('BLANK', 'A', '', AS_OF), ('BLANK', 'B', '3', AS_OF),
            ('NEG', 'A', '-4', AS_OF), ('SLASH', 'A', '7', '10/07/2026')]])
        out = stress.fund_net_assets(ledger, AS_OF)
        self.assertEqual(out['OK'], 15.0)
        self.assertEqual(out['SLASH'], 7.0)
        for fund in ['DUP', 'BLANK', 'NEG']:
            self.assertTrue(pd.isna(out[fund]), fund)
        self.assertNotIn('OLD', out.index)

    @staticmethod
    def bad(*scopes):
        return pd.DataFrame({'scope': list(scopes)}, columns=['scope'])

    def test_rates_shares(self):
        rows = [(f'defect-{i:02d}', 'defect', 'caught' if i <= 27 else 'partial') for i in range(1, 31)]
        scored = pd.DataFrame([dict(case=c, role=r, level=l) for c, r, l in rows])
        out = stress.rates(scored, self.bad())
        self.assertEqual(out.columns.tolist()[:4], ['role', 'level', 'cases', 'share'])
        got = {(r['role'], r['level']): (r['cases'], r['share']) for _, r in out.iterrows()}
        self.assertEqual(got[('defect', 'caught')], (27, 0.9))
        self.assertAlmostEqual(got[('defect', 'partial')][1], 0.1)
        self.assertEqual(got[('defect', 'missed')][0], 0)
        self.assertEqual(got[('untouched', 'false positive')][0], 0)
        self.assertEqual(got[('untouched', 'unattributable')][0], 0)

    def test_rates_untouched_counts_every_failing_row(self):
        scored = pd.DataFrame([dict(case='defect-01', role='defect', level='caught')])
        bad = self.bad('false positive', 'false positive', 'unattributable', 'aggregate', 'consequence')
        out = stress.rates(scored, bad, wanted={'defect': 30})
        got = {(r['role'], r['level']): r['cases'] for _, r in out.iterrows()}
        self.assertEqual(got[('untouched', 'false positive')], 2)
        self.assertEqual(got[('untouched', 'unattributable')], 1)
        d = out[out['role'] == 'defect']
        self.assertEqual(set(d['drawn']), {1})
        self.assertEqual(set(d['wanted']), {30})

    def test_rates_keeps_empty_role(self):
        scored = pd.DataFrame([dict(case='defect-01', role='defect', level='caught')])
        out = stress.rates(scored, self.bad(), wanted={'defect': 30, 'flip': 30})
        flip = out[out['role'] == 'flip']
        self.assertEqual(len(flip), 1)
        self.assertEqual((flip.iloc[0]['drawn'], flip.iloc[0]['wanted'], flip.iloc[0]['cases']), (0, 30, 0))

    def test_impact_reasons_for_every_nan(self):
        cases = cases_frame([('defect-01', 'defect', 'SECD')])
        good = self.changes([('defect-01', 'defect', 'SECD', '5.00', '500.00')])
        none = self.changes([])
        r = self.run_impact(self.tables(), [('SECD', '5.00', 'USD')], cases, none)
        self.assertEqual(r['not_valued_reason'].tolist(), ['no injected price'])
        self.assertTrue(r[['signed_usd', 'gross_usd', 'signed_bps', 'gross_bps']].isna().all().all())
        r = self.run_impact(self.tables(), [('SECD', '', 'USD')], cases, good)
        self.assertEqual(r['not_valued_reason'].tolist(), ['no chosen price'])
        self.assertTrue(r['signed_usd'].isna().all())
        tables = self.tables(positions=[('ACC1', 'SECD', '10'), ('ACC2', 'SECD', 'abc')])
        r = self.run_impact(tables, [('SECD', '5.00', 'USD')], cases, good)
        self.assertEqual(r['not_valued_reason'].tolist(), ['unreadable quantity'])
        self.assertTrue(r[['signed_usd', 'gross_usd', 'signed_bps']].isna().all().all())

    def test_every_nan_amount_has_a_reason(self):
        cases = cases_frame([('defect-01', 'defect', 'SECD'), ('lookalike-01', 'lookalike', 'SECL')])
        r = self.run_impact(self.tables(), [('SECD', '5.00', 'USD'), ('SECL', '5.00', 'USD')], cases,
                            self.changes([('defect-01', 'defect', 'SECD', '5.00', '500.00')]))
        self.assertTrue(((r['not_valued_reason'] != '') | r['signed_usd'].notna()).all())

    def test_showcase_median(self):
        scored = pd.DataFrame([dict(case=f'defect-0{i}', role='defect', security_id=s, level='caught')
                               for i, s in enumerate(['S10', 'S20', 'S90'], start=1)]
                              + [dict(case='lookalike-01', role='lookalike', security_id='L1', level='cleared'),
                                 dict(case='lookalike-02', role='lookalike', security_id='L2', level='cleared'),
                                 dict(case='lookalike-03', role='lookalike', security_id='L3', level='review'),
                                 dict(case='flip-01', role='flip', security_id='F1', level='caught')])
        values = pd.Series({'S10': 10, 'S20': 20, 'S90': 90, 'L1': 5, 'L2': 5, 'L3': 5, 'F1': 1.0})
        out = stress.pick_showcase(scored, pd.DataFrame(), values)
        self.assertEqual(scored.loc[out, 'case'].tolist(), ['defect-02', 'lookalike-01'])

    def test_output_changes_blank_security_unattributable(self):
        cases = cases_frame([('defect-01', 'defect', 'SECINJ')])
        before = pd.DataFrame(dict(security_id=['', 'SECINJ'], ledger_id=['L1', 'L2'], amount=['1', '2']))
        after = pd.DataFrame(dict(security_id=['', 'SECINJ'], ledger_id=['L1', 'L2'], amount=['9', '3']))
        with tempfile.TemporaryDirectory() as d:
            clean, injected = Path(d) / 'clean', Path(d) / 'injected'
            write_run(clean, [])
            write_run(injected, [])
            before.to_csv(clean / '02_impact_detail.csv', index=False)
            after.to_csv(injected / '02_impact_detail.csv', index=False)
            out = stress.output_changes(clean, injected, cases, LABELS)
        self.assertEqual(sorted(out['scope']), ['consequence', 'unattributable'])

    # the score command

    def make_runs(self, d, injected_members):
        d = Path(d)
        clean, injected, work, outputs = d / 'clean', d / 'injected', d / 'work', d / 'outputs'
        write_run(clean, [])
        write_run(injected, injected_members)
        self.quality(clean, [('FXSEC1', '5.00', 'USD')])
        self.quality(injected, [('FXSEC1', '500.00', 'USD')])
        fixture = CopyTests.FIXTURE
        cases = cases_frame([('defect-01', 'defect', 'FXSEC1')])
        cases['bad_vendor'] = 'FIXTURE_V1'
        stress.build_copy(fixture / 'manifest.csv', cases, LABELS, AS_OF, work)
        cases.to_csv(work / 'cases.csv', index=False)
        pd.DataFrame([dict(case='defect-01', role='defect', security_id='FXSEC1', vendor='FIXTURE_V1',
                           field='price', old='5.00', new='500.00')]).to_csv(work / 'field_changes.csv', index=False)
        return clean, injected, work, outputs

    def run_score(self, injected_members):
        with tempfile.TemporaryDirectory() as d:
            clean, injected, work, outputs = self.make_runs(d, injected_members)
            with contextlib.redirect_stdout(io.StringIO()):
                code = stress.main(['score', '--clean', str(clean), '--injected', str(injected),
                                    '--work', str(work), '--outputs', str(outputs),
                                    '--config', str(ROOT / 'config' / 'reconciliation.toml')])
            names = sorted(p.name for p in outputs.glob('03_stress_*.csv'))
            cases = pd.read_csv(outputs / '03_stress_cases.csv', dtype=str, keep_default_na=False)
            impact = pd.read_csv(outputs / '03_stress_impact.csv', dtype=str, keep_default_na=False)
            rates = pd.read_csv(outputs / '03_stress_rates.csv', dtype=str, keep_default_na=False)
        return code, names, cases, impact, rates

    FILES = ['03_stress_cases.csv', '03_stress_changes.csv', '03_stress_impact.csv', '03_stress_members.csv',
             '03_stress_rates.csv', '03_stress_run.csv', '03_stress_unexplained.csv']

    def test_snapshot_quotes_show_pre_injection_prices(self):
        cases = cases_frame([('defect-01', 'defect', 'S1')])
        prices = pd.DataFrame([dict(security_id='S1', vendor='B', price='500.00', price_date=AS_OF),
                               dict(security_id='S1', vendor='A', price='5.01', price_date=AS_OF),
                               dict(security_id='S1', vendor='A', price='9.99', price_date='2020-01-01'),
                               dict(security_id='S2', vendor='C', price='1', price_date=AS_OF)])
        changes = pd.DataFrame([dict(case='defect-01', role='defect', security_id='S1', vendor='B', field='price',
                                     old='5.00', new='500.00')])
        out = stress.snapshot_quotes(cases, changes, prices, AS_OF)
        self.assertEqual(out.iloc[0], 'A=5.01; B=5.00')

    def test_score_writes_run_record_and_snapshot_quotes(self):
        with tempfile.TemporaryDirectory() as d:
            clean, injected, work, outputs = self.make_runs(d, [(SCALE_ODD, 'FXSEC1')])
            config = ROOT / 'config' / 'reconciliation.toml'
            with contextlib.redirect_stdout(io.StringIO()):
                stress.main(['score', '--clean', str(clean), '--injected', str(injected), '--work', str(work),
                             '--outputs', str(outputs), '--config', str(config)])
            run = pd.read_csv(outputs / '03_stress_run.csv', dtype=str, keep_default_na=False)
            cases = pd.read_csv(outputs / '03_stress_cases.csv', dtype=str, keep_default_na=False)
        info = dict(zip(run['item'], run['value']))
        self.assertEqual(list(run.columns), ['item', 'value'])
        for item in ('config path', 'config sha256', 'labels path', 'labels sha256', 'manifest path', 'seed', 'sizes',
                     'multiplier', 'finished at'):
            self.assertTrue(info.get(item), item)
        self.assertEqual(info['config sha256'], hashlib.sha256(config.read_bytes()).hexdigest())
        self.assertRegex(info['finished at'], r'^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$')
        self.assertIn('snapshot_quotes', cases.columns)
        self.assertIn('FIXTURE_V1=5.00', cases.loc[0, 'snapshot_quotes'])
        self.assertNotIn('500.00', cases.loc[0, 'snapshot_quotes'])

    def test_score_writes_field_changes_and_members(self):
        with tempfile.TemporaryDirectory() as d:
            clean, injected, work, outputs = self.make_runs(d, [(SCALE_ODD, 'FXSEC1')])
            with contextlib.redirect_stdout(io.StringIO()):
                stress.main(['score', '--clean', str(clean), '--injected', str(injected),
                             '--work', str(work), '--outputs', str(outputs),
                             '--config', str(ROOT / 'config' / 'reconciliation.toml')])
            changes = pd.read_csv(outputs / '03_stress_changes.csv', dtype=str, keep_default_na=False)
            members = pd.read_csv(outputs / '03_stress_members.csv', dtype=str, keep_default_na=False)
        self.assertEqual(list(changes.columns), stress.CHANGE_COLUMNS)
        self.assertEqual(changes.loc[0, 'new'], '500.00')
        self.assertEqual(list(members.columns), ['finding', 'id_kind', 'record_id', 'security_id', 'change'])

    def test_score_exit_code(self):
        code, names, cases, impact, rates = self.run_score([(SCALE_ODD, 'FXSEC1')])
        self.assertEqual((code, names), (0, self.FILES))
        self.assertEqual(cases.loc[0, 'level'], 'caught')
        self.assertEqual(cases.loc[0, 'showcase'], 'True')
        self.assertIn('source', impact.columns)
        self.assertIn('deliverable', set(impact['source']))
        self.assertIn('wanted', rates.columns)
        code, names, *_ = self.run_score([(SCALE_ODD, 'FXSEC1'), (CUTOFF, 'SECOTHER')])
        self.assertEqual((code, names), (1, self.FILES))
        code, names, *_ = self.run_score([(SCALE_ODD, 'FXSEC1'), (TRADE, 'TXNX1')])
        self.assertEqual((code, names), (1, self.FILES))

    def test_score_output_false_positive_in_rates(self):
        with tempfile.TemporaryDirectory() as d:
            clean, injected, work, outputs = self.make_runs(d, [(SCALE_ODD, 'FXSEC1')])
            quality = pd.read_csv(clean / '02_price_quality.csv', dtype=str, keep_default_na=False)
            other = quality.assign(security_id='SECOTHER', chosen_price='7.00')
            pd.concat([quality, other]).to_csv(clean / '02_price_quality.csv', index=False)
            pd.concat([pd.read_csv(injected / '02_price_quality.csv', dtype=str, keep_default_na=False),
                       other.assign(chosen_price='8.00')]).to_csv(injected / '02_price_quality.csv', index=False)
            with contextlib.redirect_stdout(io.StringIO()):
                code = stress.main(['score', '--clean', str(clean), '--injected', str(injected),
                                    '--work', str(work), '--outputs', str(outputs),
                                    '--config', str(ROOT / 'config' / 'reconciliation.toml')])
            rates = pd.read_csv(outputs / '03_stress_rates.csv', dtype=str, keep_default_na=False)
        self.assertEqual(code, 1)
        row = rates[(rates['role'] == 'untouched') & (rates['level'] == 'false positive')].iloc[0]
        self.assertEqual(row['cases'], '1')


if __name__ == '__main__':
    unittest.main()
