"""The doc scripts and the deliverable notebook give the same results on Windows and Mac.

Run from the repo root: uv run python -m unittest tests/test_cross_platform.py -v
"""
import contextlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_findings
import check_docs

# Hand-computed with `printf ... | shasum -a 256 | cut -c1-12`, not with the code under test.
REGISTER_LF = b"finding,status\nNegative trade quantity,confirmed\n"
REGISTER_CRLF = b"finding,status\r\nNegative trade quantity,confirmed\r\n"
CHANGED_LF = b"finding,status\nNegative trade quantity,cleared\n"
SUM_LF = "fe164c1e4cb2"
SUM_CHANGED = "9bceb7845fcf"


def write(folder, name, data):
    path = Path(folder) / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return path


class RegisterChecksumTests(unittest.TestCase):
    def test_a_register_saved_on_windows_has_the_mac_checksum(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(build_findings.checksum(write(tmp, "lf.csv", REGISTER_LF)), SUM_LF)
            self.assertEqual(build_findings.checksum(write(tmp, "crlf.csv", REGISTER_CRLF)), SUM_LF)

    def test_a_changed_register_still_gets_a_new_checksum(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(build_findings.checksum(write(tmp, "changed.csv", CHANGED_LF)), SUM_CHANGED)

    def test_docs_check_accepts_a_windows_register_built_into_mac_docs(self):
        with tempfile.TemporaryDirectory() as tmp:
            write(tmp, "outputs/02_defect_register.csv", REGISTER_CRLF)
            write(tmp, "docs/FINDINGS.md", f"- Register checksum: `{SUM_LF}` (built at commit `abc1234`)\n".encode())
            write(tmp, "docs/DEFECT_CATALOG.md", f"*Facts generated from the register (checksum `{SUM_LF}`)*\n".encode())
            saved, check_docs.ROOT = check_docs.ROOT, Path(tmp)
            try:
                self.assertEqual(check_docs.check_findings(), [])
            finally:
                check_docs.ROOT = saved

    def test_docs_check_still_flags_docs_built_from_an_older_register(self):
        with tempfile.TemporaryDirectory() as tmp:
            write(tmp, "outputs/02_defect_register.csv", CHANGED_LF)
            write(tmp, "docs/FINDINGS.md", f"- Register checksum: `{SUM_LF}` (built at commit `abc1234`)\n".encode())
            saved, check_docs.ROOT = check_docs.ROOT, Path(tmp)
            try:
                self.assertEqual(len(check_docs.check_findings()), 1)
            finally:
                check_docs.ROOT = saved


class NotebookLineEndingTests(unittest.TestCase):
    """Runs the deliverable notebook on the small made-up fixture (about 15 s) as if on Windows."""

    def test_notebook_outputs_use_unix_line_endings_on_windows(self):
        from IPython.core.interactiveshell import InteractiveShell

        notebook = json.loads((ROOT / "notebooks/deliverable.ipynb").read_text(encoding="utf-8"))
        with tempfile.TemporaryDirectory() as out:
            env = {
                "RECONCILIATION_DATA": str(ROOT / "tests/fixtures/small/manifest.csv"),
                "RECONCILIATION_CONFIG": str(ROOT / "config/reconciliation.toml"),
                "RECONCILIATION_OUTPUTS": out,
                "MPLBACKEND": "Agg",
            }
            saved_env = {k: os.environ.get(k) for k in env}
            saved_cwd, saved_linesep = os.getcwd(), os.linesep
            os.environ.update(env)
            os.chdir(ROOT)
            os.linesep = "\r\n"  # what pandas sees on Windows
            try:
                shell = InteractiveShell.instance()
                with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                    for cell in notebook["cells"]:
                        if cell["cell_type"] != "code":
                            continue
                        result = shell.run_cell("".join(cell["source"]), store_history=False)
                        if result.error_before_exec or result.error_in_exec:
                            raise result.error_before_exec or result.error_in_exec
            finally:
                os.linesep = saved_linesep
                os.chdir(saved_cwd)
                for k, v in saved_env.items():
                    if v is None:
                        os.environ.pop(k, None)
                    else:
                        os.environ[k] = v
            written = sorted(Path(out).glob("*.csv"))
            self.assertIn("02_defect_register.csv", [p.name for p in written])
            with_crlf = [p.name for p in written if b"\r\n" in p.read_bytes()]
            self.assertEqual(with_crlf, [])


if __name__ == "__main__":
    unittest.main()
