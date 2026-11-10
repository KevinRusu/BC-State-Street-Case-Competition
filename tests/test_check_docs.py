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

    def test_a_stray_csv_without_a_finding_column_is_skipped(self):
        # tests/runs/*/02_defect_register.csv may hold anything a test wrote; the wording check must not crash on it.
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            stray = Path(tmp) / '02_defect_register.csv'
            stray.write_text('record_id,note\nX1,made up\n', encoding='utf-8')
            self.assertEqual(check_docs.register_findings(stray), set())
            stray.write_text('finding,status\nA,confirmed\n,unresolved\n', encoding='utf-8')
            self.assertEqual(check_docs.register_findings(stray), {'A'})

    def test_planned_lists_only_files_that_do_not_exist_yet(self):
        self.assertEqual([p for p in check_docs.PLANNED if (ROOT / p).exists()], [])

    def test_every_file_is_read_with_an_explicit_encoding(self):
        # Without one, Python uses the console code page (cp1252 on Windows) and the curly quotes in docs/ fail to
        # decode. -X warn_default_encoding flags each such read on any platform; -W error makes it fatal.
        import subprocess
        result = subprocess.run(
            [sys.executable, '-X', 'warn_default_encoding', '-W', 'error::EncodingWarning', 'scripts/check_docs.py'],
            cwd=ROOT, capture_output=True, text=True, encoding='utf-8')
        self.assertNotIn('EncodingWarning', result.stderr)


if __name__ == '__main__':
    unittest.main()
