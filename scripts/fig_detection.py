import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle
import sys

OUT = sys.argv[1]
INK, NAVY = "#1B1F24", "#1F3A5F"
C1, C10, C100 = "#2A7F75", "#E3B04B", "#C0392B"   # catch early (x1), next stage (x10), later (x100)

import json
FW = json.load(open(__import__("os").path.join(__import__("os").path.dirname(__file__), "framework.json")))
stages = ["Accounts", "Securities", "Transactions", "Positions", "NAV and\nledger"]
rows = [(d["defect"], d["earliest"], d["check"], d["testable"], d["data"]) for d in FW["defects"]]
fig, ax = plt.subplots(figsize=(16, 8.4), dpi=150)
n = len(rows)
x0, cw = 4.6, 1.6            # first stage column x and column width
ax.set_xlim(0, x0 + 5 * cw + 5.6); ax.set_ylim(-1.3, n + 1.9); ax.axis("off")
ax.invert_yaxis()

ax.text(0, -1.0, "Detection-point model: where each type of problem can be caught first, and what it costs if it travels",
        fontsize=15, fontweight="bold", color=INK, va="center")
for j, s in enumerate(stages):
    ax.text(x0 + j * cw + cw / 2, 0.05, s, ha="center", va="center", fontsize=10, fontweight="bold", color=NAVY)
ax.text(0.05, 0.05, "Type of problem", fontsize=10.5, fontweight="bold", color=NAVY, va="center")
ax.text(x0 + 5 * cw + 0.2, 0.05, "Test-\nable?", fontsize=10, fontweight="bold", color=NAVY, va="center")
ax.text(x0 + 5 * cw + 1.05, 0.05, "First evidence in our data (notebook, 11 Oct)", fontsize=10, fontweight="bold", color=NAVY, va="center")

for i, (name, e, ctrl, test, ev) in enumerate(rows):
    y = i + 1
    if i % 2 == 0:
        ax.add_patch(Rectangle((0, y - 0.5), x0 + 5 * cw + 5.6, 1, facecolor="#F6F7F9", edgecolor="none", zorder=0))
    ax.text(0.05, y, name, fontsize=10.5, va="center", color=INK)
    for j in range(5):
        x = x0 + j * cw
        if j < e or (name.startswith("Account") and j == 1):   # account defects skip the securities stage
            continue
        d = j - e - (1 if name.startswith("Account") and j > 1 else 0)
        col, lab = (C1, "Corporate\naction check" if ctrl.startswith("Corporate") else ctrl.replace(" check", "\ncheck")) if d == 0 else ((C10, "x10") if d == 1 else (C100, "x100"))
        ax.add_patch(Rectangle((x + 0.05, y - 0.42), cw - 0.1, 0.84, facecolor=col, edgecolor="white",
                               alpha=1.0 if d == 0 else 0.85, zorder=1))
        ax.text(x + cw / 2, y, lab, ha="center", va="center", fontsize=9.5 if d == 0 else 10,
                color="white", fontweight="bold", zorder=2)
    tc = {"Yes": C1, "Partly": "#B07B12"}[test]
    ax.text(x0 + 5 * cw + 0.2, y, test, fontsize=10, va="center", color=tc, fontweight="bold")
    ax.text(x0 + 5 * cw + 1.05, y, ev, fontsize=9.8, va="center", color=INK)

ax.text(0, n + 1.25,
        "Read across a row: green = the earliest stage that can catch the problem, and the check we put there. Every stage it travels "
        "past without being caught multiplies the cost of fixing it (amber x10, red x100).\n"
        "The 1-10-100 multipliers are the illustrative 'rule of thumb' from Labovitz & Chang (1992), not measured State Street costs. "
        "'Partly' = fully testable only with data we do not have yet.",
        fontsize=9.3, color="#4A5260", va="center")
fig.savefig(OUT, bbox_inches="tight", facecolor="white")
print("saved", OUT)
