"""Draws the two simplified data journeys (one trade, one security) for the slides.

How it works, step by step:
1. Each journey is a list of steps. A step has: who handles it (tag), a title,
   two short lines of evidence, a check label and a status (ok / fail / warn / info /
   missed = the check passed but the record is wrong).
2. draw_journey() places the steps as boxes in one row, joins them with arrows,
   and adds notes underneath (where the evidence stops, what it means).
3. The figure is saved as a PNG in the folder given on the command line.
   The two Check-in 1 journeys are drawn only when this file is run; other scripts import draw_journey.
"""
import sys
import matplotlib
matplotlib.use("Agg")                       # draw to a file, no window
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

OUT = sys.argv[1] if len(sys.argv) > 1 else "."
plt.rcParams["font.family"] = ["Liberation Sans", "DejaVu Sans"]  # Arial look, DejaVu for ✓ ✗

BLUE, INK, GREY = "#001AFF", "#1A1A2E", "#6B7280"     # #001AFF is the blue used in the team deck
STATUS = {                                              # border colour, fill colour, pill colour, symbol
    "ok":   (BLUE,      "white",   "#1E8E3E", "✓"),
    "fail": ("#D93025", "#FDECEA", "#D93025", "✗"),
    "warn": ("#C77700", "#FFF6E5", "#C77700", "!"),
    "info": (BLUE,      "white",   GREY,      "•"),
    "missed": ("#D93025", "#FDECEA", "#1E8E3E", "✓"),   # the check passed, but the record is wrong
}

def draw_journey(steps, dashed_into, notes, takeaway, legend, fname):
    fig, ax = plt.subplots(figsize=(13, 5.0), dpi=200)
    ax.set_xlim(0, 13); ax.set_ylim(0, 5.0); ax.axis("off")

    n, left, right, gapw = len(steps), 0.25, 12.75, 0.38      # row of n boxes with gaps for arrows
    w = (right - left - gapw * (n - 1)) / n
    y0, h = 1.95, 2.05                                         # box bottom and height

    for i, s in enumerate(steps):
        x = left + i * (w + gapw)
        edge, fill, pill, sym = STATUS[s["status"]]
        # who handles this step, above the box
        ax.text(x + w / 2, y0 + h + 0.12, f"{i + 1}  ·  {s['tag'].upper()}", ha="center", va="bottom",
                fontsize=8.5, color=edge if s["status"] in ("fail", "missed") else GREY, fontweight="bold")
        # the box itself
        ax.add_patch(FancyBboxPatch((x, y0), w, h, boxstyle="round,pad=0,rounding_size=0.12",
                                    linewidth=2, edgecolor=edge, facecolor=fill))
        # step number in a circle, then the title
        ax.text(x + 0.14, y0 + h - 0.3, s["title"], ha="left", va="center", fontsize=10.5,
                color=INK, fontweight="bold")
        # two short lines of evidence
        ax.text(x + 0.14, y0 + h - 0.6, "\n".join(s["lines"]), ha="left", va="top",
                fontsize=9, color=INK, linespacing=1.5)
        # the check, as a coloured pill at the bottom
        ax.add_patch(FancyBboxPatch((x + 0.1, y0 + 0.12), w - 0.2, 0.38,
                                    boxstyle="round,pad=0,rounding_size=0.2", linewidth=0, facecolor=pill))
        ax.text(x + w / 2, y0 + 0.31, f"{sym}  {s['check']}", ha="center", va="center",
                fontsize=8.2, color="white", fontweight="bold")
        # arrow to the next box (dashed when the link is our reasoning, not seen in the data)
        if i < n - 1:
            ax.add_patch(FancyArrowPatch((x + w + 0.04, y0 + h / 2), (x + w + gapw - 0.04, y0 + h / 2),
                                         arrowstyle="-|>", mutation_scale=14, linewidth=1.8,
                                         color=BLUE, linestyle=(0, (1, 1.5)) if i in dashed_into else "-"))

    # notes underneath: (x position as share of width, width share, colour, bold heading, text)
    for fx, fw, col, head, text in notes:
        x, wd = left + fx * (right - left), fw * (right - left)
        ax.add_patch(FancyBboxPatch((x, 0.4), wd, 1.0, boxstyle="round,pad=0,rounding_size=0.1",
                                    linewidth=1.6, edgecolor=col, facecolor="white",
                                    linestyle="--" if col == "#D93025" else "-"))
        ax.text(x + 0.18, 1.25, head, ha="left", va="top", fontsize=10.5, color=col, fontweight="bold")
        ax.text(x + 0.18, 0.95, text, ha="left", va="top", fontsize=9.5, color=INK, linespacing=1.4)

    ax.text(left, 4.75, takeaway, ha="left", va="center", fontsize=12.5, color=BLUE, fontweight="bold")
    ax.text(left, 0.15, legend, ha="left", va="center", fontsize=8.5, color=GREY)
    fig.savefig(f"{OUT}/{fname}", bbox_inches="tight", pad_inches=0.08, facecolor="white")
    plt.close(fig)
    print("saved", fname)

LEGEND = ("Solid arrow: we saw the link in the data (matching IDs).   "
          "Dashed arrow: our reasoning, the data cannot show it.   Red dashed box: where the evidence stops.")

if __name__ == "__main__":
    # Journey 1: one clean trade, TXN100000380
    trade = [
        dict(tag="Front office", title="The trade", status="ok", check="Trade check",
             lines=["BUY 1,612 shares", "Booked on time"]),
        dict(tag="Master data", title="Master records", status="ok", check="Account, security",
             lines=["Account is open", "Security is known"]),
        dict(tag="Middle office", title="The holding", status="ok", check="Position check",
             lines=["4 trades add up", "Our book: 2,028"]),
        dict(tag="Custodian", title="The custodian", status="ok", check="Position check",
             lines=["Custodian: 2,028", "Same: no break"]),
        dict(tag="Price vendors", title="The price", status="ok", check="Price check",
             lines=["3 vendors agree", "Within 0.44%"]),
        dict(tag="Back office", title="The fund's NAV", status="ok", check="NAV check",
             lines=["Net assets / shares", "= 11.35, it adds up"]),
    ]
    draw_journey(trade, dashed_into={4},
                 notes=[(0.0, 0.62, "#D93025", "Where the evidence stops",
                         "No proof the trade really settled, and no cash or fee data,\n"
                         "so we cannot show this holding inside the fund's net assets."),
                        (0.65, 0.35, BLUE, "What it shows",
                         "A clean trade passes every check\nfrom capture to NAV.")],
                 takeaway="Journey 1: one trade (TXN100000380), from the front office to the fund's NAV",
                 legend=LEGEND, fname="06_journey_trade_simple.png")

    # Journey 2: one security record, SEC937640, and the spin-off it triggered
    security = [
        dict(tag="Master data", title="The security", status="ok", check="Security check",
             lines=["SEC937640", "Set up correctly"]),
        dict(tag="Across offices", title="Widely used", status="info", check="Reach: 94 funds",
             lines=["309 trades", "Held in 94 funds"]),
        dict(tag="Corporate action", title="The spin-off", status="warn", check="Corporate action",
             lines=["11 Jun: holders get", "a new security"]),
        dict(tag="Master data", title="New security", status="fail", check="Security check",
             lines=["SEC204363 was", "never set up"]),
        dict(tag="Middle office", title="Still traded", status="fail", check="Nothing stopped it",
             lines=["64 trades", "63 holdings"]),
        dict(tag="Price vendors", title="No price", status="fail", check="Price check",
             lines=["0 prices", "Cannot be valued"]),
    ]
    draw_journey(security, dashed_into=set(),
                 notes=[(0.0, 0.31, "#D93025", "Where the evidence stops",
                         "No record of which accounts\nreceived the spin-off."),
                        (0.34, 0.31, "#D93025", "Across the whole file",
                         "15 new securities like this:\n1,131 trades, 1,118 holdings, 0 prices."),
                        (0.68, 0.32, BLUE, "The fix",
                         "A security check at the handoff\nwould have held all 1,131 trades.")],
                 takeaway="Journey 2: one security (SEC937640) and the spin-off it triggered",
                 legend=LEGEND, fname="07_journey_security_simple.png")
