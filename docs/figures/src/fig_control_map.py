"""Simple control map: 3 office rows, 5 stages, 6 numbered handoffs, one check on each."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Rectangle, Circle
import sys

OUT = sys.argv[1]
NAVY, TEAL, GREY, INK = "#1F3A5F", "#2A7F75", "#7D8797", "#1B1F24"
fig, ax = plt.subplots(figsize=(16, 8), dpi=150)
ax.set_xlim(0, 16); ax.set_ylim(0, 8); ax.axis("off")

lanes = [("Front office", "decide and trade", 5.35, 7.35, "#E8F0F8"),
         ("Middle office", "book, value, check", 2.95, 5.25, "#EAF4F2"),
         ("Back office", "books and NAV", 0.75, 2.85, "#FBF3E4")]
for name, sub, y0, y1, col in lanes:
    ax.add_patch(Rectangle((0.15, y0), 13.2, y1 - y0, facecolor=col, edgecolor="white", lw=2, zorder=0))
    ax.text(0.35, (y0 + y1) / 2 + 0.15, name, fontsize=14, fontweight="bold", color=NAVY, va="center")
    ax.text(0.35, (y0 + y1) / 2 - 0.25, sub, fontsize=11, color=GREY, va="center")

def box(x, y, w, h, title, sub, fc="white", ec=NAVY):
    ax.add_patch(FancyBboxPatch((x - w / 2, y - h / 2), w, h, boxstyle="round,pad=0.03,rounding_size=0.12",
                                facecolor=fc, edgecolor=ec, lw=2, zorder=3))
    ax.text(x, y + (0.35 if h > 1.2 else 0.17), title, ha="center", va="center", fontsize=13, fontweight="bold", color=INK, zorder=4)
    ax.text(x, y + (-0.05 if h > 1.2 else -0.25), sub, ha="center", va="center", fontsize=10, color=GREY, zorder=4)

def handoff(p0, p1, n, label, lx, ly, color=TEAL, rad=0.0):
    ax.annotate("", xy=p1, xytext=p0, zorder=2, arrowprops=dict(arrowstyle="-|>", color=color, lw=2.6,
                mutation_scale=20, connectionstyle=f"arc3,rad={rad}", shrinkA=0, shrinkB=0))
    ax.add_patch(Circle((lx, ly), 0.22, facecolor=color, edgecolor="white", lw=1.5, zorder=6))
    ax.text(lx, ly, str(n), ha="center", va="center", fontsize=11, fontweight="bold", color="white", zorder=7)
    ax.text(lx + 0.3, ly, label, ha="left", va="center", fontsize=10.5, color=INK, zorder=7,
            bbox=dict(boxstyle="round,pad=0.2", fc="white", ec="none", alpha=0.9))

ax.text(8.0, 7.75, "Control map: data moves through 5 stages and 3 offices; every handoff has one check",
        ha="center", fontsize=15, fontweight="bold", color=INK)

# stages
box(3.8, 6.35, 2.1, 1.0, "Accounts", "who the clients are")
box(3.8, 4.1, 2.1, 1.0, "Securities", "what can be traded")
box(7.0, 5.3, 2.3, 1.6, "Transactions", "trades + corporate actions")
ax.text(7.0, 4.82, "created in front office,\nbooked in middle office", ha="center", va="center", fontsize=9, color=GREY, style="italic", zorder=5)
box(10.4, 4.1, 2.2, 1.0, "Positions", "what each account holds")
box(12.0, 1.8, 2.2, 1.0, "NAV and ledger", "official books, fund price")

# outside sources (right edge, not an office)
ax.add_patch(Rectangle((13.55, 0.75), 2.3, 6.6, facecolor="#F2F4F7", edgecolor="white", lw=2, zorder=0))
ax.text(14.7, 7.0, "Outside sources", ha="center", fontsize=12, fontweight="bold", color=GREY)
box(14.7, 5.3, 1.9, 0.9, "Custodian", "its own holdings")
box(14.7, 3.9, 1.9, 0.9, "Price vendors", "and FX rates")
# handoffs with their check
handoff((4.85, 6.2), (5.85, 5.75), 1, "Account check", 5.0, 6.75)
handoff((4.85, 4.25), (5.85, 4.85), 2, "Security check", 4.95, 3.75)
handoff((8.15, 5.0), (9.3, 4.4), 3, "Trade check", 7.55, 4.1)
handoff((8.15, 5.75), (10.0, 4.6), 4, "Corporate action check", 8.9, 6.3, rad=-0.3)
ax.annotate("", xy=(11.5, 4.3), xytext=(13.75, 5.2), zorder=2, arrowprops=dict(arrowstyle="-|>", color=GREY, lw=2.6, mutation_scale=20, shrinkA=0, shrinkB=0))
handoff((13.75, 3.9), (11.5, 4.0), 5, "Position check\nPrice check", 11.75, 5.75, color=GREY)
handoff((10.6, 3.6), (11.6, 2.3), 6, "NAV check", 11.95, 3.0)

ax.text(8.0, 0.35, "Each numbered arrow is a handoff (data moving to the next stage). The check on it stops or flags bad data there. "
        "Owners and failure responses are on the next slide.", ha="center", fontsize=10.5, color=INK)
fig.savefig(OUT, bbox_inches="tight", facecolor="white")
print("saved", OUT)
