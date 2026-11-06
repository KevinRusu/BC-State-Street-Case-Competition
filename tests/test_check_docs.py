"""scripts/check_docs.py: rule IDs named in a living doc must exist in docs/RULES.md; the dashboard README is checked.

Run: uv run python -m unittest tests/test_check_docs.py -v
"""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts'))
import check_docs  # noqa: E402


class CheckDocs(unittest.TestCase):
    def test_unknown_rule_id_is_reported(self):
        known = {'TXN_FIELDS_VALID', 'POS_REBUILD_MATCHES'}
        text = 'See `TXN_FIELDS_VALID`, POS_REBUILD_MATCHES and TXN_MADE_UP (added); config key quantity_match_tolerance.'
        self.assertEqual(check_docs.unknown_rule_ids(text, known), ['TXN_MADE_UP'])

    def test_rules_md_ids_are_read_from_its_tables(self):
        self.assertLessEqual({'TXN_FIELDS_VALID', 'POS_REBUILD_MATCHES', 'NAV_ARITHMETIC'}, check_docs.rule_ids())

    def test_dashboard_readme_is_a_living_doc(self):
        self.assertIn(ROOT / 'dashboard' / 'README.md', set(check_docs.living_docs()))

    def test_store_checksum_matches_findings_checksum_across_line_endings(self):
        # The dashboard store and docs/FINDINGS.md must name a Windows-built register the same way (D-053).
        import tempfile, build_store, build_findings
        with tempfile.TemporaryDirectory() as tmp:
            mac, windows = Path(tmp) / 'mac.csv', Path(tmp) / 'windows.csv'
            mac.write_bytes(b'finding\nA\n')
            windows.write_bytes(b'finding\r\nA\r\n')
            self.assertEqual(build_store.checksum(windows), build_findings.checksum(mac))

    def test_planned_lists_only_files_that_do_not_exist_yet(self):
        self.assertEqual([p for p in check_docs.PLANNED if (ROOT / p).exists()], [])


if __name__ == '__main__':
    unittest.main()
