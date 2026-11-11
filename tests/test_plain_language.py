"""scripts/plain_language.json: the plain wording the dashboard shows, carried into the store by scripts/build_store.py.

Every map node and edge, status and lead-in must be worded, and every rule the scorecard scores (config/scorecard.toml)
named; an unworded finding falls back to its register text; the release register (outputs/, when built here) must be
fully worded (scripts/check_docs.py).

Run: uv run python -m unittest tests/test_plain_language.py -v
"""
import sys
import tomllib
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts'))
import build_store  # noqa: E402
import check_docs  # noqa: E402


def scorecard_rules():
    """The rule IDs the scorecard scores: the `rule` of every test in config/scorecard.toml."""
    with (ROOT / 'config' / 'scorecard.toml').open('rb') as stream:
        return {test['rule'] for test in tomllib.load(stream)['tests'].values()}


class PlainLanguage(unittest.TestCase):
    def test_every_graph_node_and_edge_is_worded(self):
        build_store.check_plain(build_store.load_plain())  # no AssertionError

    def test_a_missing_node_fails_the_check(self):
        plain = build_store.load_plain()
        del plain['nodes']['transactions']
        with self.assertRaises(AssertionError):
            build_store.check_plain(plain)

    def test_a_stale_edge_entry_fails_the_check(self):
        plain = build_store.load_plain()
        plain['edges']['no_such_edge'] = 'x'
        with self.assertRaises(AssertionError):
            build_store.check_plain(plain)

    def test_every_scored_rule_has_a_plain_name(self):
        plain = build_store.load_plain()
        self.assertEqual(set(plain['rules']), scorecard_rules())
        build_store.check_plain(plain, scored_rules=scorecard_rules())  # no AssertionError
        self.assertEqual({r['key'] for r in build_store.plain_rows(plain) if r['kind'] == 'rule'}, scorecard_rules())

    def test_a_missing_rule_name_fails_the_check(self):
        plain = build_store.load_plain()
        del plain['rules']['NAV_ARITHMETIC']
        with self.assertRaises(AssertionError):
            build_store.check_plain(plain, scored_rules=scorecard_rules())

    def test_a_name_for_an_unscored_rule_fails_the_check(self):
        plain = build_store.load_plain()
        plain['rules']['NO_SUCH_RULE'] = 'x'
        with self.assertRaises(AssertionError):
            build_store.check_plain(plain, scored_rules=scorecard_rules())

    def test_an_unworded_finding_falls_back_to_its_register_text(self):
        plain = build_store.load_plain()
        self.assertEqual(build_store.plain_finding(plain, 'A finding nobody worded'), 'A finding nobody worded')
        self.assertEqual(build_store.unworded(plain, [{'finding': 'A finding nobody worded'},
                                                      {'finding': 'Negative trade quantity'}]),
                         ['A finding nobody worded'])

    def test_status_phrases_and_stage_order_reach_the_store_rows(self):
        rows = build_store.plain_rows(build_store.load_plain())
        self.assertEqual({r['key'] for r in rows if r['kind'] == 'status'}, {'confirmed', 'unresolved', 'cleared', 'none'})
        stages = sorted((r for r in rows if r['kind'] == 'stage'), key=lambda r: r['position'])
        self.assertEqual([r['key'] for r in stages][:3], ['worked example', 'master data', 'trade capture'])
        self.assertIn('not proof it is clean', next(r['text'] for r in rows if r['key'] == 'none'))

    def test_finding_sentences_leave_the_verdict_to_the_status_phrase(self):
        # A sentence shows beside its line's status phrase (confirmed, unresolved or cleared), so it must read true
        # under any of them: what was found, never whether it is a real problem.
        verdicts = ('expected', 'seems', 'harmless', 'is fine', 'checks out', 'still unclear', 'unconfirmed',
                    'error or', 'cannot apply or judge')
        for finding, sentence in build_store.load_plain()['findings'].items():
            for word in verdicts:
                self.assertNotIn(word, sentence.lower(), f'{finding}: {word!r} decides the status')

    def test_check_sentences_state_requirements_not_outcomes(self):
        edges = build_store.load_plain()['edges']
        self.assertNotIn('is explained', edges['position_check'])
        self.assertNotIn('no serious open problem feeds', edges['nav_check'])

    def test_release_register_is_fully_worded(self):
        # skipped when outputs/ is not built on this machine
        register = ROOT / 'outputs' / '02_defect_register.csv'
        if not register.exists():
            self.skipTest('outputs not built')
        self.assertEqual(check_docs.check_plain_language(), [])


if __name__ == '__main__':
    unittest.main()
