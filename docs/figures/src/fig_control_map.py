import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Rectangle
import sys

OUT = sys.argv[1]
NAVY, TEAL, GREY, RED, AMBER, INK = "#1F3A5F", "#2A7F75", "#7D8797", "#C0392B", "#C98A10", "#1B1F24"
LANES = [("#F2F4F7", 8.0, 9.3, "External\nfeeds"),
         ("#E8F0F8", 5.95, 7.9, "Front office\nPMs & traders"),
         ("#EAF4F2", 3.3, 5.85, "Middle office\npricing & recon"),
         ("#FBF3E4", 1.25, 3.2, "Back office\nfund accounting"),
         ("#EEEAF6", 0.2, 1.15, "Executive")]

fig, ax = plt.subplots(figsize=(16, 8.6), dpi=150)
ax.set_xlim(0, 19); ax.set_ylim(0, 10); ax.axis("off")
for col, y0, y1, label in LANES:
    ax.add_patch(Rectangle((0.15, y0), 18.7, y1 - y0, facecolor=col, edgecolor="white", lw=2, zorder=0))
    ax.text(0.3, (y0 + y1) / 2, label, va="center", ha="left", fontsize=11, fontweight="bold", color=NAVY)
ax.text(9.5, 9.7, "Lifecycle and control map: 5 stages x 3 offices, every handoff (H) with its controls (C)",
        ha="center", fontsize=15, fontweight="bold", color=INK)

def box(x, y, w, h, text, fc="white", ec=NAVY, fs=10, ls="-", tc=INK, bold=True):
    ax.add_patch(FancyBboxPatch((x - w / 2, y - h / 2), w, h, boxstyle="round,pad=0.03,rounding_size=0.12",
                                facecolor=fc, edgecolor=ec, lw=1.8, linestyle=ls, zorder=3))
    ax.text(x, y, text, ha="center", va="center", fontsize=fs, fontweight="bold" if bold else "normal", color=tc, zorder=4)

def tag(x, y, text, ec=TEAL, tc=INK):
    ax.text(x, y, text, ha="center", va="center", fontsize=9, zorder=6, color=tc,
            bbox=dict(boxstyle="round,pad=0.25", fc="white", ec=ec, lw=1.3))

def arrow(p0, p1, color=TEAL, ls="-", rad=0.0):
    ax.annotate("", xy=p1, xytext=p0, zorder=2,
                arrowprops=dict(arrowstyle="-|>", color=color, lw=2.2, linestyle=ls, mutation_scale=18,
                                connectionstyle=f"arc3,rad={rad}", shrinkA=0, shrinkB=0))

# stages and feeds
box(3.4, 6.9, 2.0, 1.05, "S1 Accounts\n(master data)\nowner R1")
box(6.0, 4.3, 2.1, 1.05, "S2 Securities\n(master data)\nowner R2")
box(9.0, 5.9, 2.5, 1.8, "S3 Transactions\n& corporate actions\n(FO to MO)\nowners R3 R4 R5")
box(12.6, 4.2, 2.3, 1.1, "S4 Positions\n& reconciliation\nowner R8")
box(16.2, 2.2, 2.2, 1.1, "S5 NAV & ledger\n(share classes)\nowner R9")
box(12.6, 7.05, 1.9, 0.95, "PM position view\nH10 · C20\nneeds K10", fc="#FDF1F0", ec=RED, fs=9, tc=RED)
box(9.0, 8.65, 3.2, 0.85, "F4 OMS_FRONT · F5 TRADE_CAPTURE\nF6 CUSTODY_FEED", ec=GREY, fs=9)
box(14.6, 8.65, 1.9, 0.85, "F3 Custodian\npositions", ec=GREY, fs=9.5)
box(17.3, 8.65, 2.3, 0.85, "F1 Vendor prices A/B/C\nF2 FX rates", ec=GREY, fs=9.5)
box(9.5, 0.67, 9.0, 0.7, "R10 Chief Data Officer: platform score (M20), defect aging (M18), escalates P1 defects",
    ec=NAVY, fs=9.5)

# handoffs
arrow((4.4, 6.85), (7.75, 6.45));            tag(6.05, 6.95, "H1 · C01")
arrow((7.05, 4.4), (7.75, 5.25));            tag(6.75, 5.3, "H2 · C03 C04")
arrow((9.0, 8.22), (9.0, 6.8));              tag(9.0, 7.45, "H3 · C05 C06 C07 C08")
arrow((10.25, 5.25), (11.45, 4.35));         tag(10.75, 4.2, "H4 · C09 C10")
arrow((10.25, 6.3), (12.0, 4.75), color=AMBER, ls="--", rad=-0.35); tag(11.55, 5.9, "H5 · C11\n(C12 needs K11)", ec=AMBER)
arrow((12.6, 4.75), (12.6, 6.57), color=RED, ls="--")
arrow((14.6, 8.22), (13.6, 4.75), color=GREY); tag(14.25, 6.55, "H6 · C13", ec=GREY)
arrow((17.0, 8.22), (13.75, 4.3));          tag(15.75, 6.55, "H7 · C14 C15 C16")
arrow((13.4, 3.65), (15.3, 2.75));           tag(14.25, 3.0, "H8 · C17 C19")
ax.plot([3.4, 3.4, 15.0], [6.37, 1.95, 1.95], color=TEAL, lw=2.2, zorder=2)
arrow((14.9, 1.95), (15.1, 1.95));           tag(8.0, 1.95, "H9 · C02 C18 (fund + share-class mapping)")

# legend
y = 9.25
for x, c, ls, txt in [(1.0, TEAL, "-", "control testable in our data"), (5.2, AMBER, "--", "partly testable"),
                      (8.0, RED, "--", "needs a missing contract (K10 to K14)"), (12.6, GREY, "-", "external feed check")]:
    pass
ax.text(9.5, -0.15, "Solid teal = control testable in our data · amber dashed = partly testable (corporate-action "
         "application needs K11) · red dashed = needs a missing contract · grey = external feed. "
         "Control IDs match Spine v0.3 (C_Controls tab).", ha="center", va="top", fontsize=9.5, color=INK)
fig.savefig(OUT, bbox_inches="tight", facecolor="white")
print("saved", OUT)
