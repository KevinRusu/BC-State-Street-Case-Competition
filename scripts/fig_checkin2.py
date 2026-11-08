"""Draws the three new Check-in 2 charts from the deliverable notebook's outputs (no number is typed in here).

1. 09_waterfall.png: positions that differ from the book under the raw rows, the Guide's BOOKED-only benchmark and
   our chain (02_waterfall.csv, compared with positions).
2. 10_three_way.png: where the three sources disagree, one bar per group (02_three_way_summary.csv); the groups add up
   to the union minus the keys where all three agree, which is checked.
3. 11_sensitivities.png: how many more or fewer positions match the book when one step of our chain is swapped
   (02_sensitivities.csv, compared with positions).

Same look as figures 06 and 08: Arial, the deck's blue (#001AFF) for the bar the slide is about, grey for context,
a label on every bar, no grid. Run from the repo root after the deliverable notebook: uv run python scripts/fig_checkin2.py
"""
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

plt.rcParams["font.family"] = ["Arial", "DejaVu Sans"]
BLUE, GREY, INK, MUTED = "#001AFF", "#B8BCC6", "#1A1A2E", "#5F6368"
ROOT = Path(__file__).resolve().parent.parent
OUTPUTS, FIGURES = ROOT / "outputs", ROOT / "docs" / "figures"


def read(name):
    path = OUTPUTS / name
    if not path.exists():
        sys.exit(f"{path} not found: run notebooks/deliverable.ipynb first (tests/run_notebook.sh)")
    return pd.read_csv(path)


def bars(labels, values, highlight, value_text, fname, size=(11, 4.2), signed=False, fontsize=15):
    """Horizontal bars, first label on top. `highlight` = indexes drawn in blue; `value_text` = label per bar."""
    fig, ax = plt.subplots(figsize=size, dpi=200)
    y = list(range(len(labels)))[::-1]
    colors = [BLUE if i in highlight else GREY for i in range(len(labels))]
    ax.barh(y, values, color=colors, height=0.62)
    span = max(abs(v) for v in values) or 1
    for yi, v, text in zip(y, values, value_text):
        right = v >= 0
        ax.text(v + (span * 0.012 if right else -span * 0.012), yi, text, va="center",
                ha="left" if right else "right", fontsize=fontsize, color=INK)
    ax.set_yticks(y, labels, fontsize=fontsize, color=INK)
    ax.tick_params(axis="y", length=0)
    ax.set_xticks([])
    for side in ["top", "right", "bottom"]:
        ax.spines[side].set_visible(False)
    ax.spines["left"].set_color(MUTED)
    if signed:
        ax.axvline(0, color=MUTED, linewidth=1)
        ax.spines["left"].set_visible(False)
        low, high = min(min(values), 0), max(max(values), 0)
        ax.set_xlim(low - span * 0.22, high + span * 0.22)
    else:
        ax.set_xlim(0, span * 1.35)
    fig.tight_layout()
    fig.savefig(FIGURES / fname, facecolor="white")
    plt.close(fig)
    print("saved", fname)


# 1. Waterfall: three rebuilds against the book
w = read("02_waterfall.csv")
w = w[w["compared with"] == "positions"].set_index("code")
steps = [("C0", "Every row as delivered"), ("BOOKED-only", "Guide benchmark: BOOKED only"), ("C7", "Our chain")]
bars([label for _, label in steps], [int(w.loc[c, "different"]) for c, _ in steps], {2},
     [f"{int(w.loc[c, 'different']):,} of {int(w.loc[c, 'keys in union']):,}" for c, _ in steps], "09_waterfall.png",
     size=(11, 3.2))

# 2. Three-way: where the sources disagree
t = read("02_three_way_summary.csv")
t = t[t["comparison"] == "rebuild vs book vs custodian"].set_index("group or pattern")["keys"]
groups = [("Trades disagree with book + custodian", ["rebuild is the odd one out"]),
          ("Can't be tested", [p for p in t.index if p.startswith("not evaluable")]),
          ("Custodian disagrees with both", ["custodian is the odd one out"]),
          ("Held by only one or two sources", ["rebuild + book, no custodian", "book + custodian, no trades",
                                               "rebuild only, nets to zero", "rebuild only, nonzero"]),
          ("All three differ", ["all three differ"]),
          ("Book disagrees with both", ["book is the odd one out"])]
counts = [int(t.reindex(patterns).fillna(0).sum()) for _, patterns in groups]
covered = {p for _, patterns in groups for p in patterns} | {"all three agree"}
assert set(t.index) <= covered, f"patterns not drawn: {set(t.index) - covered}"
assert sum(counts) + int(t["all three agree"]) == int(t.sum()), "groups do not add up to the union"
# The book-only bar is drawn only when some key has that pattern (none in the release)
groups, counts = zip(*[(g, c) for g, c in zip(groups, counts) if c or g[0] != "Book disagrees with both"])
bars([label for label, _ in groups], counts, {0}, [f"{c:,}" for c in counts], "10_three_way.png", size=(8.6, 4.6),
     fontsize=16)

# 3. Sensitivities: change in matched positions against the book
s = read("02_sensitivities.csv")
s = s[s["compared with"] == "positions"]
PLAIN = {  # alternative as the notebook names it -> plain words (the step it swaps comes first)
    "copies: both counted, as the book does (sensitivity only)": "Copies: count both, as the book does",
    "conflicting pairs: keep_first": "Conflicting copies: keep the first",
    "conflicting pairs: keep_second": "Conflicting copies: keep the second",
    "conflicting pairs: drop_both": "Conflicting copies: drop both",
    "REVERSED: R2": "REVERSED: drop it and its original (R2)",
    "REVERSED: R3": "REVERSED: one offset per original (R3)",
    "REVERSED: R4 every REVERSED row offsets (double offset; evidence only)": "REVERSED: every row offsets (R4)",
    "negatives: absolute value (sensitivity only)": "Negative quantity: absolute value",
    "negatives: not_evaluable": "Negative quantity: can't be tested",
    "blanks: zero (sensitivity only)": "Blank quantity: count as zero",
    "blanks: derived from gross_amount / price (sensitivity only)": "Blank quantity: money ÷ price",
}
missing = set(s["alternative"]) - set(PLAIN)
assert not missing, f"no plain label for: {missing}"
deltas = [int(v) for v in s["matched vs main chain"]]
bars([PLAIN[a] for a in s["alternative"]], deltas, {i for i, d in enumerate(deltas) if abs(d) >= 1000},
     [f"{d:+,}".replace("-", "−") if d else "0" for d in deltas], "11_sensitivities.png", size=(10.5, 6.2), signed=True,
     fontsize=18)
