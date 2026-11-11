"""Run the real reconciliation notebook and store builder on the small synthetic fixture only."""
import contextlib
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys

from IPython.core.interactiveshell import InteractiveShell

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "tests" / "runs" / "dashboard_fixture"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    output = args.output.resolve()
    if not output.is_relative_to(ROOT / "tests/runs"):
        parser.error("Fixture output must stay inside tests/runs")
    os.chdir(ROOT)
    output.mkdir(parents=True, exist_ok=True)
    os.environ.update({
        "RECONCILIATION_DATA": str(ROOT / "tests/fixtures/small/manifest.csv"),
        "RECONCILIATION_CONFIG": str(ROOT / "config/reconciliation.toml"),
        "RECONCILIATION_OUTPUTS": str(output),
        "STORE_PATH": str(output / "store.duckdb"),
        "MPLBACKEND": "Agg",   # the severity plot's plt.show() must not open a window outside a kernel
    })
    notebook = json.loads((ROOT / "notebooks/deliverable.ipynb").read_text(encoding="utf-8"))
    shell = InteractiveShell.instance()
    log_path = output / "notebook.log"
    try:
        with log_path.open("w", encoding="utf-8") as log, contextlib.redirect_stdout(log), contextlib.redirect_stderr(log):
            for cell in notebook["cells"]:
                if cell["cell_type"] != "code":
                    continue
                result = shell.run_cell("".join(cell["source"]), store_history=False)
                error = result.error_before_exec or result.error_in_exec
                if error:
                    raise error
    except BaseException:
        print(log_path.read_text(encoding="utf-8")[-8000:], file=sys.stderr)
        raise
    from stress_fixture import write as write_stress_files   # made up: the fixture has no stress run
    write_stress_files(output)
    subprocess.run([sys.executable, "-X", "utf8", str(ROOT / "scripts/build_store.py")], check=True)
    # Include additional genuine register examples so this tiny fixture exercises the expanded story list.
    # The production builder's first-example policy and finding counts remain unchanged.
    import duckdb
    with duckdb.connect(str(output / "store.duckdb")) as con:
        seen = {row[0] for row in con.execute("SELECT record_id FROM demo_traces").fetchall()}
        position = con.execute("SELECT coalesce(max(position), 0) FROM demo_traces").fetchone()[0]
        examples = con.execute("SELECT e.line, e.rule_id, e.finding, e.status, e.record_id, e.id_kind, r.stage "
                               "FROM register_examples e JOIN register r ON r.line = e.line "
                               "ORDER BY e.line, e.record_id").fetchall()
        supported = {"transaction_id", "account_id", "security_id", "account/security", "action_id", "ledger_id"}
        for line, rule, finding, status, record_id, id_kind, stage in examples:
            if id_kind not in supported or record_id in seen:
                continue
            position += 1
            con.execute("INSERT INTO demo_traces VALUES (?, ?, ?, ?, ?, ?)",
                        [position, record_id, finding, status, f"register line {line} ({rule})", stage])
            seen.add(record_id)
    print(f"Dashboard fixture ready: {output / 'store.duckdb'}")


if __name__ == "__main__":
    main()
