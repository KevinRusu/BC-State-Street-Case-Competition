"""Draws Journey 3: the traced negative-quantity BUY, as the mirror of Check-in 1's clean trade (figure 06).

How it works, step by step:
1. Read the trace that the deliverable notebook wrote (outputs/02_trace.csv). Every ID and number on the figure comes from it,
   or from the price and NAV checks for the security and fund the trace names (02_vendor_check.csv, 02_nav_check.csv).
2. Fill the same six boxes as figure 06. The first box fails (our trade check would reject the row); the later
   boxes use the "missed" status: their check passed, but the record is wrong.
3. Draw with draw_journey() from make_journeys_simple.py and save the PNG in the folder given on the command line.

Run from the repo root after the deliverable notebook: uv run python scripts/fig_trace_journey.py docs/figures
"""
import csv
import sys
from pathlib import Path

import make_journeys_simple as mjs
import matplotlib.pyplot as plt

# Arial has the same letter widths as Liberation Sans (figure 06); DejaVu stays last for the tick and cross
plt.rcParams["font.family"] = ["Liberation Sans", "Arial", "DejaVu Sans"]

ROOT = Path(__file__).resolve().parent.parent
OUTPUTS = ROOT / "outputs"


def read_csv(name):
    path = OUTPUTS / name
    if not path.exists():
        sys.exit(f"{path} not found: run notebooks/deliverable.ipynb first (tests/run_notebook.sh)")
    with open(path, newline="") as f:
        return list(csv.DictReader(f))


def num(text):
    """Format a quantity from the CSV as a whole number with a thousands separator and a real minus sign."""
    return f"{float(text):,.0f}".replace("-", "−")


trace = {(r["hop"], r["table"], r["field"]): r["value"] for r in read_csv("02_trace.csv")}


def t(hop, table, field):
    key = (hop, table, field)
    if key not in trace:
        sys.exit(f"02_trace.csv has no row {key}: the trace layout changed, update this script")
    return trace[key]


security_id = t("source", "transactions", "security_id")
fund_id = t("downstream", "accounts", "fund_id")

snapshot = {r["item"]: r["value"] for r in read_csv("02_run_info.csv")}["as_of_date"]
vendor = [r for r in read_csv("02_vendor_check.csv") if r["security_id"] == security_id]
nav = [r for r in read_csv("02_nav_check.csv") if r["fund_id"] == fund_id and r["as_of_day"][:10] == snapshot]
if len(vendor) != 1 or not nav:
    sys.exit(f"no vendor check row for {security_id} or no NAV rows for {fund_id} on {snapshot}")
vendor = vendor[0]

# The boxes after the first say "the check passed, but the record is wrong". Stop if the traced key no longer fits.
story = {"the book equals our rebuild": t("position", "rebuild (main chain)", "book equals the raw rebuild") == "True",
         "the custodian equals the book": t("custodian", "comparison_positions", "custodian equals the book") == "True",
         "the vendor check passed": vendor["result"] == "pass",
         "the security is in securities": t("downstream", "securities", "asset_class") != "not in securities"}
broken = [claim for claim, holds in story.items() if not holds]
if broken:
    sys.exit(f"the traced key no longer fits figure 08 ({', '.join(broken)} is false): redraw the story")

quantity = t("source", "transactions", "quantity")
implied = t("source", "transactions", "gross_amount / price")
book = t("position", "positions", "quantity")
custodian = t("custodian", "comparison_positions", "quantity")
bps = float(t("downstream", "derived", "indicative exposure (bps of fund net assets)"))
results = {r["result"] for r in nav}
nav_result = "does not add up" if "fail" in results else "can't be checked" if "not evaluable" in results else "adds up"

steps = [
    dict(tag="Front office", title="The trade", status="fail", check="Trade check",
         lines=[f"{t('source', 'transactions', 'transaction_type')} {num(quantity)} shares",
                f"Amount: size {num(implied)}",
                f"Still {t('source', 'transactions', 'status')}"]),
    dict(tag="Master data", title="Master records", status="ok", check="Account, security",
         lines=[f"Account is {t('downstream', 'accounts', 'status').lower()}", "Security is known"]),
    dict(tag="Middle office", title="The holding", status="missed", check="Position check",
         lines=[f"{t('position', 'positions', 'transaction_count')} trades add up",
                f"Our book: {num(book)}", "Match hides it"]),
    dict(tag="Custodian", title="The custodian", status="missed", check="Position check",
         lines=[f"Custodian: {num(custodian)}", "Same: no break", "Same error"]),
    dict(tag="Price vendors", title="The price", status="missed", check="Price check",
         lines=[f"{vendor['vendors']} vendors agree", f"Within {float(vendor['spread']):.2%}",
                "Units are wrong"]),
    dict(tag="Back office", title="The fund's NAV", status="missed", check="NAV check",
         lines=[f"NAV {nav_result}", f"Sign wrong: ~{bps:.0f} bps", "Type wrong: 0 bps"]),
]

mjs.OUT = sys.argv[1] if len(sys.argv) > 1 else "."
mjs.draw_journey(
    steps, dashed_into={3, 4},
    notes=[(0.0, 0.62, "#D93025", "Where the evidence stops",
            "No valuation in the data: the exposure is our estimate (units\n"
            "off × price), not a loss. Nothing shows how the sign got in."),
           (0.65, 0.35, mjs.BLUE, "What it shows",
            "A broken trade passes every check\nafter the point where it entered.")],
    takeaway=f"Journey 3: a broken trade ({t('source', 'transactions', 'transaction_id')}), "
             "from the front office to the fund's NAV",
    legend=("Solid arrow: we saw the link in the data.   Dashed arrow: our reasoning.   "
            "Red box with a green tick: the check passed, but the record is wrong."),
    fname="08_journey_negative_buy.png")
