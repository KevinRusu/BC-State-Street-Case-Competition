import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle
import sys

OUT = sys.argv[1]
INK, NAVY = "#1B1F24", "#1F3A5F"
C1, C10, C100 = "#2A7F75", "#E3B04B", "#C0392B"   # catch early (x1), next stage (x10), later (x100)

stages = ["S1\nAccounts", "S2\nSecurities", "S3\nTransactions\n& CAs", "S4\nPositions\n& pricing", "S5\nNAV &\nledger"]
# defect, earliest stage index, control at earliest point, testable now?, evidence from our data (verified 11 Oct)
rows = [
    ("D1 Missing / colliding IDs, unmastered securities", 1, "C03", "Yes",    "15 unmastered secs in 1,131 trades, 0 prices"),
    ("D2 Duplicated transactions",                       2, "C05", "Yes",    "Check-in 2"),
    ("D3 Late records / cutoff misses",                  2, "C08", "Yes",    "Check-in 2"),
    ("D4 Stale / disputed prices and FX",                3, "C14", "Partly", "USD rate ≠ 1 on 30 of 30 days"),
    ("D5 Corporate actions incomplete or uneven",        2, "C11", "Partly", "23 of 23 spin-off targets unmastered"),
    ("D6 Positions ≠ their history",                     3, "C10", "Yes",    "Journey trade: rebuild = book = custodian"),
    ("D7 Incomplete onboarding / closed accts trading",  0, "C02", "Yes",    "Check-in 2"),
    ("D8 Cancels / reversals with no valid original",    2, "C07", "Partly", "Check-in 2 (needs K13)"),
    ("D9 NAV / share classes don't reconcile",           4, "C17", "Partly", "Journey NAV arithmetic holds"),
    ("D10 Invalid trade fields",                         2, "C06", "Yes",    "1,124 settle before trade; 9,398 slash dates"),
]

fig, ax = plt.subplots(figsize=(16, 8.4), dpi=150)
n = len(rows)
x0, cw = 5.2, 1.55            # first stage column x and column width
ax.set_xlim(0, x0 + 5 * cw + 5.6); ax.set_ylim(-1.3, n + 1.9); ax.axis("off")
ax.invert_yaxis()

ax.text(0, -1.0, "Detection-point model: where each defect family can be caught first, and what it costs to let it travel",
        fontsize=15, fontweight="bold", color=INK, va="center")
for j, s in enumerate(stages):
    ax.text(x0 + j * cw + cw / 2, 0.05, s, ha="center", va="center", fontsize=10, fontweight="bold", color=NAVY)
ax.text(0.05, 0.05, "Defect family", fontsize=10.5, fontweight="bold", color=NAVY, va="center")
ax.text(x0 + 5 * cw + 0.2, 0.05, "Test-\nable?", fontsize=10, fontweight="bold", color=NAVY, va="center")
ax.text(x0 + 5 * cw + 1.05, 0.05, "First evidence in our data (notebook, 11 Oct)", fontsize=10, fontweight="bold", color=NAVY, va="center")

for i, (name, e, ctrl, test, ev) in enumerate(rows):
    y = i + 1
    if i % 2 == 0:
        ax.add_patch(Rectangle((0, y - 0.5), x0 + 5 * cw + 5.6, 1, facecolor="#F6F7F9", edgecolor="none", zorder=0))
    ax.text(0.05, y, name, fontsize=10.5, va="center", color=INK)
    for j in range(5):
        x = x0 + j * cw
        if j < e or (name.startswith("D7") and j == 1):   # account defects skip the securities stage
            continue
        d = j - e - (1 if name.startswith("D7") and j > 1 else 0)
        col, lab = (C1, f"catch\n{ctrl}  x1") if d == 0 else ((C10, "x10") if d == 1 else (C100, "x100"))
        ax.add_patch(Rectangle((x + 0.05, y - 0.42), cw - 0.1, 0.84, facecolor=col, edgecolor="white",
                               alpha=1.0 if d == 0 else 0.85, zorder=1))
        ax.text(x + cw / 2, y, lab, ha="center", va="center", fontsize=9.5 if d == 0 else 10,
                color="white", fontweight="bold", zorder=2)
    tc = {"Yes": C1, "Partly": "#B07B12"}[test]
    ax.text(x0 + 5 * cw + 0.2, y, test, fontsize=10, va="center", color=tc, fontweight="bold")
    ax.text(x0 + 5 * cw + 1.05, y, ev, fontsize=9.8, va="center", color=INK)

ax.text(0, n + 1.25,
        "Read across a row: green = earliest stage that can catch the defect (control from the spine). Every stage it travels "
        "past without being caught multiplies the cost of fixing it (amber x10, red x100).\n"
        "The 1-10-100 multipliers are the illustrative 'rule of thumb' from Labovitz & Chang (1992), not measured State Street costs. "
        "'Partly' = testable only with a missing contract (K11 to K14).",
        fontsize=9.3, color="#4A5260", va="center")
fig.savefig(OUT, bbox_inches="tight", facecolor="white")
print("saved", OUT)
