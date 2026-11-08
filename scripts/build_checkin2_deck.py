"""Builds the Check-in 2 deck (docs/checkins/checkin2/Checkin2.pptx) and its speaker notes (SPEAKER_NOTES.md).

Seven slides, one per item on the brief's Check-in 2 "Bring this" list (brief §8); the last item has two slides. No
cover and no question slide: the dashboard is shown live beside it.

Step by step:
1. facts() reads every number and ID from the deliverable notebook's outputs (outputs/02_*.csv) and the register
   checksum from docs/FINDINGS.md. Nothing on a slide is typed in: rerun the notebook, scripts/fig_trace_journey.py, then this
   script, and the deck follows the data.
2. One function per slide writes the deliverable as the header, the finding as one sentence under it, one exhibit (a
   native chart the team can edit, a small table or the trace figure), at most three short cards, and short speaker
   notes that end with the source file of each number.
3. The look: Arial, navy headers, the deck's blue (#001AFF) for numbers and what to look at, grey for the rest,
   tinted cards without borders, text of 14 pt or more.
4. check_deck() reopens the saved file and fails if a slide breaks the deck rules (one exhibit, short boxes, small
   tables, 14 pt, no record IDs except the traced trade's, no filler phrases), then prints the headers in order.

Run from the repo root: uv run python scripts/build_checkin2_deck.py
"""
import re
import sys
from pathlib import Path

import pandas as pd
from lxml import etree
from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_CHART_TYPE, XL_LABEL_POSITION, XL_TICK_LABEL_POSITION
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Inches, Pt

ROOT = Path(__file__).resolve().parent.parent
OUTPUTS, FIGURES = ROOT / "outputs", ROOT / "docs" / "figures"
OUT_DIR = ROOT / "docs" / "checkins" / "checkin2"
DECK, NOTES_MD = OUT_DIR / "Checkin2.pptx", OUT_DIR / "SPEAKER_NOTES.md"

BLUE = RGBColor(0x00, 0x1A, 0xFF)
INK = RGBColor(0x1A, 0x1A, 0x2E)
GREY = RGBColor(0x5F, 0x63, 0x68)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
NAVY = RGBColor(0x14, 0x1B, 0x4D)
TINT = RGBColor(0xEE, 0xF1, 0xFF)          # cards
PALE = RGBColor(0xF3, 0xF4, 0xF6)          # secondary cards
GREY_BAR = RGBColor(0xB8, 0xBC, 0xC8)
AMBER = RGBColor(0xE0, 0x8A, 0x00)         # held back
GREEN = RGBColor(0x1E, 0x7E, 0x34)
GREEN_TINT = RGBColor(0xE6, 0xF4, 0xEA)    # cleared
LINE = "C9CCD6"
LEFT, WIDTH = Inches(0.6), Inches(12.13)
BODY_TOP = Inches(1.75)
BODY_BOTTOM = Inches(6.8)
MIN_PT = 14
ITEMS = 6                                   # brief §8, Check-in 2 "Bring this"


# --------------------------------------------------------------------------------------------------- numbers
def read(name):
    path = OUTPUTS / name
    if not path.exists():
        sys.exit(f"{path} not found: run notebooks/deliverable.ipynb first (tests/run_notebook.sh)")
    return pd.read_csv(path, keep_default_na=False)


def n(x):
    """Whole number with thousands separators and a real minus sign."""
    return f"{int(round(float(x))):,}".replace("-", "−")


def signed(x):
    x = int(round(float(x)))
    return f"{x:+,}".replace("-", "−") if x else "0"


def pct(part, whole, digits=1):
    share = 100 * part / whole
    return f"<{10 ** -digits:g}%" if 0 < share < 10 ** -digits / 2 else f"{share:.{digits}f}%"


def quick_notes(say, points, asked, sources):
    """Speaker notes as quick notes: the one line to say, the key points, likely questions with short answers, and the
    source files of the numbers."""
    return "\n".join([f"SAY: {say}", "", "KEY POINTS"] + [f"- {p}" for p in points]
                     + ["", "IF ASKED"] + [f"- {q} → {a}" for q, a in asked] + ["", f"Sources: {sources}"])


def facts():
    """Every number and ID the deck shows, read from the outputs. Keys are named after what they mean."""
    f = {}
    ledger = read("02_row_ledger.csv").set_index("step")
    f["trade_rows"] = int(ledger.loc["load transactions", "rows out"])
    f["trade_rows_m"] = f"{f['trade_rows'] / 1e6:.2f}M"
    run = read("02_run_info.csv").set_index("item")["value"]
    f["runtime"] = f"{float(run['runtime_seconds']):.0f} s"
    f["snapshot"] = run["as_of_date"]

    t = read("02_three_way_summary.csv")
    three = t[t["comparison"] == "rebuild vs book vs custodian"].set_index("group or pattern")
    keys = three["keys"].astype(int)
    f["union"] = int(keys.sum())
    f["agree"] = int(keys["all three agree"])
    f["not_evaluable"] = int(keys[[p for p in keys.index if p.startswith("not evaluable")]].sum())
    f["not_evaluable_blank"] = int(keys["not evaluable: blank quantity"])
    f["testable"] = f["union"] - f["not_evaluable"]
    f["rate"] = pct(f["agree"], f["testable"])
    f["rebuild_odd"] = int(keys["rebuild is the odd one out"])
    f["custodian_odd"] = int(keys["custodian is the odd one out"])
    f["three_keys_all"] = int(keys.get("all three differ", 0))
    bvc = t[t["comparison"] == "book vs custodian"].set_index("group or pattern")["keys"].astype(int)
    f["bvc_only_book"], f["bvc_only_custodian"] = int(bvc["only in positions"]), int(bvc["only in comparison_positions"])
    f["bvc_matched"], f["bvc_different"] = int(bvc["matched"]), int(bvc["different"])
    no_cust = three.loc["rebuild + book, no custodian"]
    f["no_cust_keys"], f["no_cust_agree"] = int(no_cust["keys"]), int(float(no_cust["of which the two present agree"]))

    bc = read("02_break_classes.csv")
    bc["keys"] = bc["keys"].astype(int)
    breaks = bc[bc["is a break"] == "yes"]
    f["breaks"] = int(breaks["keys"].sum())
    by_cause = breaks.groupby("cause")["keys"].sum()
    f["cause"] = {c: int(v) for c, v in by_cause.items()}
    f["unexplained"] = f["cause"].get("unexplained", 0)
    agree_row = bc[bc["main_class"] == "all three agree"].iloc[0]
    f["agree_with_negative"] = int(agree_row["sign_conflict_keys"])
    f["break_rows"] = [(r["pattern"], r["cause"], int(r["keys"])) for _, r in breaks.iterrows()]

    w = read("02_waterfall.csv")
    w = w[w["compared with"] == "positions"].set_index("code")
    for code, name in [("C0", "raw"), ("BOOKED-only", "booked"), ("C7", "chain")]:
        f[f"diff_{name}"], f[f"union_{name}"] = int(w.loc[code, "different"]), int(w.loc[code, "keys in union"])
    f["settlement_delta"] = int(w.loc["C7s", "matched"]) - int(w.loc["C7", "matched"])

    s = read("02_sensitivities.csv")
    s = s[s["compared with"] == "positions"].set_index("alternative")
    s = s["matched vs main chain"].astype(int)
    pick = lambda prefix: int(s[[a for a in s.index if a.startswith(prefix)]].iloc[0])
    f["d_r3"], f["d_r4"] = pick("REVERSED: R3"), pick("REVERSED: R4")
    f["d_copies"], f["d_abs"] = pick("copies: both counted"), pick("negatives: absolute value")
    f["d_zero"] = pick("blanks: zero")

    dp = read("02_duplicate_profile.csv").set_index("measure")
    both = dp.loc["of the book positions holding a copy: transaction_count counts both copies"]
    f["copy_positions_counted"], f["copy_positions"] = int(both["count"]), int(both["out of"])
    f["copy_ids"] = int(dp.loc["repeated transaction_ids that are copies (exact or date format only)", "count"])
    f["publish_gap"] = f"{float(dp.loc['minutes between the two publishes: median', 'count']):.0f}"

    bq = read("02_blank_quantity.csv").set_index("measure")
    f["blank_rows"] = int(bq.loc["rows with a blank quantity", "count"])
    f["blank_derivable"] = int(bq.loc["derivable: whole number of units, no link to another trade", "count"])

    cc = read("01_cross_check.csv").set_index("check")["this notebook"]       # notebook 01
    f["spin_secs"] = int(cc["missing spin-off targets traded and held"])
    f["spin_trades"] = int(cc["missing spin-off targets: transaction rows"])
    f["spin_positions"] = int(cc["missing spin-off targets: position rows"])
    f["spin_prices"] = int(cc["missing spin-off targets: price rows"])

    reg = read("02_defect_register.csv").set_index("finding")
    f["status_counts"] = reg["status"].value_counts().to_dict()
    f["findings"] = len(reg)
    f["reg"] = {name: (int(r["affected"]), int(r["eligible"]), int(r["not evaluable"])) for name, r in reg.iterrows()}
    ex = reg.loc["ex_date after effective_date"]
    f["ex_after"] = (int(ex["affected"]), int(ex["population"]))

    tr = read("02_trace.csv")
    trace = {(r["hop"], r["field"]): r["value"] for _, r in tr.iterrows()}
    f["trace"] = trace
    import ast
    share_field = ("pipeline", "share of negative quantities by source_system")
    note = tr.set_index(["hop", "field"]).loc[share_field, "note"]
    f["share_negative"] = ast.literal_eval(trace[share_field])
    f["share_all"] = ast.literal_eval(re.search(r"\{.*?\}", note).group(0))
    f["trace_id"] = trace[("source", "transaction_id")]
    f["trace_type"] = trace[("source", "transaction_type")]
    f["trace_qty"] = n(trace[("source", "quantity")])
    f["trace_book"] = n(trace[("position", "quantity")])
    f["trace_custodian"] = n(trace[("custodian", "quantity")])
    f["trace_wrong_sign"] = n(trace[("position", "quantity under the wrong-sign reading")])
    f["trace_bps"] = f"{float(trace[('downstream', 'indicative exposure (bps of fund net assets)')]):.0f}"
    f["trace_source"] = trace[("source", "source_system")]
    f["trace_partners"] = int(trace[("source", "other records of this trade")])
    assert f["trace_book"] == f["trace_custodian"], "the trace's book and custodian differ: reword slide 3"

    partners = read("02_negative_partners.csv")
    f["partner_ids"] = partners["transaction_id"].nunique()
    f["partner_wrong_sign"] = partners.loc[partners["reading_supported"] == "wrong sign", "transaction_id"].nunique()
    # Slide 3 says every negative BUY with a second record supports the wrong-sign reading (D-043)
    assert set(partners["transaction_type"]) <= {"BUY"}, "a negative trade with a partner is not a BUY: reword slide 3"
    assert f["partner_wrong_sign"] == f["partner_ids"], "not every partner supports wrong sign: revisit D-043, slide 3"

    nav_check = read("02_nav_check.csv")
    nav = nav_check["result"].value_counts()
    f["nav_fail"], f["nav_rows"] = int(nav.get("fail", 0)), int(nav.sum())
    fund = nav_check[nav_check["fund_id"] == trace[("downstream", "fund_id")]]
    f["trace_fund"], f["trace_fund_rows"] = trace[("downstream", "fund_id")], len(fund)
    f["trace_fund_pass"] = int((fund["result"] == "pass").sum())
    vendor_check = read("02_vendor_check.csv").set_index("security_id")
    f["trace_spread"] = pct(float(vendor_check.loc[trace[("source", "security_id")], "spread"]), 1, 2)
    f["trace_vendors"] = int(vendor_check.loc[trace[("source", "security_id")], "vendors"])
    vendor = vendor_check["result"]
    f["vendor_spread"] = int((vendor == "spread above threshold").sum())
    f["vendor_scale"] = int((vendor == "scale flag (ratio near 100)").sum())
    f["vendor_not_comparable"] = int(vendor.str.contains("not evaluable").sum())
    f["vendor_evaluable"] = len(vendor) - f["vendor_not_comparable"]
    import tomllib
    with open(ROOT / "config" / "reconciliation.toml", "rb") as stream:
        prices = tomllib.load(stream)["prices"]
    f["spread_threshold"] = f"{100 * prices['spread_threshold']:g}%"

    ca = read("02_ca_readiness.csv")
    f["ca_events"] = len(ca)
    f["ca_supported"] = int((ca["verdict"] == "supported").sum())
    f["ca_quarantined"] = int((ca["verdict"] == "quarantined").sum())
    f["ca_types"] = ca.groupby(["action_type", "verdict", "reason codes"]).size().reset_index(name="events")

    side = read("02_reversed_side_view.csv")
    side.columns = ["main", "side", "keys"]
    side["keys"] = side["keys"].astype(int)
    f["r3_total"] = int(side["keys"].sum())
    f["r3_changed"] = int(side.loc[side["main"] != side["side"], "keys"].sum())

    findings_md = (ROOT / "docs" / "FINDINGS.md").read_text()
    f["checksum"] = re.search(r"Register checksum: `([0-9a-f]+)`", findings_md).group(1)
    return f


# --------------------------------------------------------------------------------------------------- drawing
def style_run(run, size, color=INK, bold=False, italic=False):
    run.font.name = "Arial"; run.font.size = Pt(size); run.font.bold = bold; run.font.italic = italic
    run.font.color.rgb = color


def add_runs(paragraph, parts, size, color=INK):
    """`parts` is a string or a list of (text, style); style 'b' = bold, 'a' = bold accent blue, 'i' = italic grey."""
    for text, kind in ([(parts, "")] if isinstance(parts, str) else parts):
        run = paragraph.add_run()
        style_run(run, size, BLUE if kind == "a" else GREY if kind == "i" else color,
                  bold=kind in ("b", "a"), italic=kind == "i")
        run.text = text


def fill_frame(tf, paragraphs, size, color=INK, space=6, align=PP_ALIGN.LEFT):
    """Write paragraphs (each a string or a list of parts) into a text frame."""
    for i, parts in enumerate(paragraphs):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.space_after = Pt(space)
        add_runs(p, parts, size, color)


def text_box(slide, x, y, w, h, text, size=18, color=INK, bold=False, align=PP_ALIGN.LEFT, name=None,
             anchor=MSO_ANCHOR.TOP):
    tb = slide.shapes.add_textbox(x, y, w, h)
    if name:
        tb.name = name
    tf = tb.text_frame; tf.word_wrap = True; tf.vertical_anchor = anchor
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    p = tf.paragraphs[0]; p.alignment = align
    style_run(p.add_run(), size, color, bold)
    p.runs[0].text = text
    return tb


def card(slide, x, y, w, h, heading, body, fill=TINT, heading_color=BLUE, size=16, big=None, name="Card"):
    """A tinted rounded box: a small bold heading, an optional big number, then short paragraphs."""
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, h)
    shape.name = "BigNumber" if big else name
    shape.adjustments[0] = 0.06
    shape.fill.solid(); shape.fill.fore_color.rgb = fill
    shape.line.fill.background()
    shape.shadow.inherit = False
    tf = shape.text_frame; tf.word_wrap = True; tf.vertical_anchor = MSO_ANCHOR.TOP
    tf.margin_left = tf.margin_right = Inches(0.22); tf.margin_top = tf.margin_bottom = Inches(0.16)
    paragraphs = ([[(heading, "")]] if heading else []) + ([[(big, "")]] if big else []) + body
    fill_frame(tf, paragraphs, size, space=5)
    first = 0
    if heading:
        style_run(tf.paragraphs[0].runs[0], 14, heading_color, bold=True)
        tf.paragraphs[0].runs[0].text = heading.upper()
        first = 1
    if big:
        style_run(tf.paragraphs[first].runs[0], 36, BLUE, bold=True)
    return shape


def stack(slide, x, w, cards, top=BODY_TOP, gap=Inches(0.2)):
    """Cards one under another in a column: each item is (height in inches, card keyword arguments)."""
    y = top
    for h, kw in cards:
        card(slide, x, y, w, Inches(h), **kw)
        y += Inches(h) + gap


def set_border(cell, side, color=LINE, width=6350):
    """One cell border (side L, R, T or B) as a thin solid line, or none."""
    tcPr = cell._tc.get_or_add_tcPr()
    tag = qn(f"a:ln{side}")
    for old in tcPr.findall(tag):
        tcPr.remove(old)
    ln = etree.SubElement(tcPr, tag, w=str(width), cap="flat", cmpd="sng", algn="ctr")
    if color is None:
        etree.SubElement(ln, qn("a:noFill"))
    else:
        sf = etree.SubElement(ln, qn("a:solidFill"))
        etree.SubElement(sf, qn("a:srgbClr"), val=color)
    etree.SubElement(ln, qn("a:prstDash"), val="solid")
    for f in tcPr.findall(qn("a:solidFill")) + tcPr.findall(qn("a:noFill")):
        tcPr.remove(f); tcPr.append(f)


def table(slide, header, rows, widths, top=BODY_TOP, size=16, row_h=0.62, head_h=0.5, left=LEFT, width=WIDTH):
    """Navy header row, plain rows with a thin grey line under each. A cell may be a list of parts."""
    scale = width / Inches(sum(widths))
    shape = slide.shapes.add_table(len(rows) + 1, len(header), left, top, width, Inches(head_h + row_h * len(rows)))
    tbl = shape.table
    tblPr = tbl._tbl.tblPr
    tblPr.set("firstRow", "0"); tblPr.set("bandRow", "0")
    style = tblPr.find(qn("a:tableStyleId"))
    if style is None:
        style = etree.SubElement(tblPr, qn("a:tableStyleId"))
    style.text = "{2D5ABB26-0587-4C30-8999-92F81FD0307C}"   # "No Style, No Grid"
    for j, w in enumerate(widths):
        tbl.columns[j].width = int(Inches(w) * scale)
    for i, values in enumerate([header] + rows):
        tbl.rows[i].height = Inches(head_h if i == 0 else row_h)
        for j, value in enumerate(values):
            cell = tbl.cell(i, j)
            cell.margin_left = cell.margin_right = Inches(0.12)
            cell.margin_top = cell.margin_bottom = Inches(0.05)
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            cell.text_frame.word_wrap = True
            p = cell.text_frame.paragraphs[0]
            if i == 0:
                add_runs(p, [(str(value), "b")], size, WHITE)
                cell.fill.solid(); cell.fill.fore_color.rgb = NAVY
                for side in "LRTB":
                    set_border(cell, side, color=None)
            else:
                add_runs(p, value if isinstance(value, list) else str(value), size)
                cell.fill.background()
                for side in "LRT":
                    set_border(cell, side, color=None)
                set_border(cell, "B", color=LINE)
    return shape


def bar_chart(slide, x, y, w, h, categories, values, colors, title=None, labels=None):
    """A native horizontal bar chart (editable in PowerPoint): first category on top, value labels at the bar ends,
    no axis or gridlines. `colors` gives one colour per bar; `labels` optionally replaces the value labels."""
    data = CategoryChartData()
    data.categories = categories
    data.add_series("value", values)
    frame = slide.shapes.add_chart(XL_CHART_TYPE.BAR_CLUSTERED, x, y, w, h, data)
    frame.name = "Chart"
    chart = frame.chart
    chart.has_legend = False
    chart.font.name = "Arial"; chart.font.size = Pt(14); chart.font.color.rgb = INK
    if title:
        chart.has_title = True
        chart.chart_title.text_frame.text = title
        style_run(chart.chart_title.text_frame.paragraphs[0].runs[0], 16, INK, bold=True)
    else:
        chart.has_title = False
    plot = chart.plots[0]
    plot.gap_width = 55
    plot.vary_by_categories = False
    series = plot.series[0]
    series.invert_if_negative = False
    for i, color in enumerate(colors):
        point = series.points[i]
        point.format.fill.solid(); point.format.fill.fore_color.rgb = color
        dPt = series._element.get_or_add_dPt_for_point(i)        # a negative bar keeps its colour too
        if dPt.find(qn("c:invertIfNegative")) is None:
            dPt.idx.addnext(etree.Element(qn("c:invertIfNegative"), val="0"))
    plot.has_data_labels = True
    dl = plot.data_labels
    dl.number_format = '+#,##0;"−"#,##0;0' if any(v < 0 for v in values) else '#,##0'
    dl.number_format_is_linked = False
    dl.position = XL_LABEL_POSITION.OUTSIDE_END
    dl.font.size = Pt(14); dl.font.color.rgb = INK
    if labels:
        for i, text in enumerate(labels):
            tf = series.points[i].data_label.text_frame
            tf.text = text
            style_run(tf.paragraphs[0].runs[0], 14, INK)
            series.points[i].data_label.position = XL_LABEL_POSITION.OUTSIDE_END
    cat = chart.category_axis
    cat.reverse_order = True
    cat.has_major_gridlines = False
    cat.format.line.color.rgb = RGBColor(0xB0, 0xB4, 0xC0)
    cat.tick_labels.font.size = Pt(14)
    cat.tick_label_position = XL_TICK_LABEL_POSITION.LOW
    val = chart.value_axis
    val.visible = False
    val.has_major_gridlines = False
    top = max(max(values), 0)
    low = min(min(values), 0)
    span = top - low
    val.maximum_scale = top + 0.28 * span          # room for the labels at the bar ends
    val.minimum_scale = low - (0.28 * span if low < 0 else 0)
    return frame


def picture(slide, name, left, top, width=None, height=None, shape_name="Figure"):
    pic = slide.shapes.add_picture(str(FIGURES / name), left, top, width=width, height=height)
    pic.name = shape_name
    return pic


class Deck:
    def __init__(self, facts_):
        self.f = facts_
        self.prs = Presentation()
        self.prs.slide_width, self.prs.slide_height = Inches(13.333), Inches(7.5)
        self.notes = []          # (number, deliverable, finding, notes) for SPEAKER_NOTES.md

    def slide(self, item, deliverable, finding, notes):
        """A slide for brief §8 item `item`: the deliverable as the header, the finding under it."""
        s = self.prs.slides.add_slide(self.prs.slide_layouts[6])     # blank layout
        number = len(self.notes) + 1
        text_box(s, LEFT, Inches(0.4), WIDTH, Inches(0.55), deliverable, size=28, color=NAVY, bold=True, name="Title")
        text_box(s, LEFT, Inches(1.0), WIDTH, Inches(0.5), finding, size=20, color=INK, name="Finding")
        text_box(s, LEFT, Inches(7.0), Inches(8), Inches(0.3), f"Check-in 2 · item {item} of {ITEMS}", size=14,
                 color=GREY)
        text_box(s, Inches(11.73), Inches(7.0), Inches(1), Inches(0.3), str(number), size=14, color=GREY,
                 align=PP_ALIGN.RIGHT)
        s.notes_slide.notes_text_frame.text = notes
        self.notes.append((number, deliverable, finding, notes))
        return s

    def save(self):
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        self.prs.save(DECK)
        lines = ["# Check-in 2: speaker notes", "",
                 "*Generated by `scripts/build_checkin2_deck.py` with the deck; do not edit by hand (rerun the script). "
                 "About a minute and a half per slide. Use your own words; the source file of each number is at the "
                 f"end of each note. Register checksum `{self.f['checksum']}`.*", ""]
        for number, deliverable, finding, notes in self.notes:
            lines += [f"## Slide {number}: {deliverable}", "", f"*{finding}*", "", notes, ""]
        NOTES_MD.write_text("\n".join(lines))


# --------------------------------------------------------------------------------------------------- slides
# Most slides: a wide exhibit on the left, cards on the right.
COL1_W, GAP = Inches(7.6), Inches(0.35)
COL2_X = LEFT + COL1_W + GAP
COL2_W = LEFT + WIDTH - COL2_X
CHART_H = BODY_BOTTOM - BODY_TOP


def s_reconciliation(d):
    f = d.f
    s = d.slide(1, "Position reconstruction and reconciliation",
                f"{n(f['agree'])} of {n(f['testable'])} testable holdings ({f['rate']}) agree in all three sources",
                quick_notes(
                    f"We rebuilt every holding from its trades and compared it with the book and the custodian: "
                    f"{f['rate']} of the holdings we can test agree in all three.",
                    [f"Recount: start at zero, a BUY adds, a SELL subtracts, up to the trade date. All "
                     f"{n(f['trade_rows'])} trade rows, in {f['runtime']}.",
                     "Three sources: our recount, the book (positions, the platform's own record) and the custodian "
                     "(comparison_positions, the outside bank's record).",
                     f"{n(f['not_evaluable'])} holdings can't be tested, {n(f['not_evaluable_blank'])} because a trade "
                     "has a blank quantity. They sit beside the rate, not inside it.",
                     f"Chart: the Guide's BOOKED-only version differs from the book on {n(f['diff_booked'])}, ours on "
                     f"{n(f['diff_chain'])}. The gap is duplicates: the book counts both copies on "
                     f"{n(f['copy_positions_counted'])} of {n(f['copy_positions'])} holdings with a copy; we count one.",
                     f"Lead-in to slide 3: {n(f['agree_with_negative'])} holdings that agree still contain a BUY with "
                     "a negative quantity. Agreement is not proof."],
                    [("Why are the can't-test holdings outside the rate?",
                      "Unknown is neither right nor wrong. Counting them either way would bias the rate."),
                     ("Why not use the BOOKED-only version, it matches the book better?",
                      "It matches because it also counts duplicate copies twice, the same as the book."),
                     ("Does it really run on everything?",
                      f"Yes, tests/run_notebook.sh rebuilds every output in about {f['runtime']}.")],
                    "02_row_ledger.csv, 02_run_info.csv, 02_three_way_summary.csv, 02_waterfall.csv (C0, BOOKED-only, "
                    "C7 vs positions), 02_duplicate_profile.csv, 02_break_classes.csv."))
    bar_chart(s, LEFT, BODY_TOP, COL1_W, CHART_H,
              ["Every trade as delivered", "BOOKED trades only (Guide's benchmark)", "Ours: duplicates counted once"],
              [f["diff_raw"], f["diff_booked"], f["diff_chain"]], [GREY_BAR, GREY_BAR, BLUE],
              title="Holdings that differ from the book",
              labels=[f"{n(f['diff_raw'])} of {n(f['union_raw'])}", f"{n(f['diff_booked'])} of {n(f['union_booked'])}",
                      f"{n(f['diff_chain'])} of {n(f['union_chain'])}"])
    stack(s, COL2_X, COL2_W, [
        (1.45, dict(heading="Trades rebuilt", big=f["trade_rows_m"], body=[f"every row, in {f['runtime']}"])),
        (1.6, dict(heading="Can't be tested", big=n(f["not_evaluable"]),
                    body=[f"holdings, {n(f['not_evaluable_blank'])} with a blank quantity"])),
        (1.6, dict(heading="Why ours differs more", fill=PALE, heading_color=GREY, size=15, body=[
            f"The book counts both copies of a duplicated trade ({n(f['copy_positions_counted'])} of "
            f"{n(f['copy_positions'])} holdings with a copy). We count it once."]))])


def s_breaks(d):
    f = d.f
    rows = f["break_rows"]
    total = lambda cause, pattern=None: sum(v for p, c, v in rows if c == cause and (pattern is None or p == pattern))
    bars = [("Book and custodian count duplicates twice", total("book_counts_duplicate_copies"), True),
            ("Custodian differs from both", total("unexplained", "custodian is the odd one out"), False),
            ("Book and custodian agree, trades don't", total("unexplained", "rebuild is the odd one out"), False),
            ("Book and custodian subtract every REVERSED", total("book_double_offsets_reversed"), True),
            ("Opposite sign to the trades", total("sign_flipped_position"), True),
            ("Duplicates and REVERSED together", total("duplicates_and_reversed"), True),
            ("All three differ", total("unexplained", "all three differ"), False)]
    assert sum(v for _, v, _ in bars) == f["breaks"], "slide 2 bars do not add up to the breaks"
    named = sum(v for _, v, k in bars if k)
    assert f["breaks"] - named == f["unexplained"]
    s = d.slide(2, "First break classification",
                f"{n(f['breaks'])} breaks: {n(named)} have a named cause, {n(f['unexplained'])} have none yet",
                quick_notes(
                    f"{n(f['breaks'])} holdings don't agree in all three sources; each gets exactly one cause, and "
                    f"{n(f['unexplained'])} have no cause yet.",
                    ["A break is a difference to explain, not automatically an error.",
                     f"Step 1, who disagrees: our recount alone on {n(f['rebuild_odd'])}, the custodian alone on "
                     f"{n(f['custodian_odd'])}, all three on {n(f['three_keys_all'])}.",
                     "Step 2, why: a fixed list of causes in a fixed order, first fit wins. Written before we "
                     "counted, so every break has one cause and the bars add up.",
                     f"Largest named causes: duplicates counted twice ({n(bars[0][1])}) and every REVERSED row "
                     f"subtracted ({n(bars[3][1])}). Both are things the book and custodian do together.",
                     f"Book = custodian ≠ trades on {n(f['rebuild_odd'])}: the custodian repeats the book's "
                     "conventions, so their agreement is weak evidence."],
                    [("Why unresolved and not errors?",
                      "Counting duplicates twice and subtracting REVERSED rows may be deliberate conventions of the "
                      "book. That is our open question to you."),
                     (f"What is in the {n(f['custodian_odd'])} where the custodian differs?",
                      "Not opened yet. It is the first job after today."),
                     ("Does the order of the causes change the counts?",
                      f"Only where two causes fit. Here that is {n(bars[5][1])} holdings, duplicates and REVERSED "
                      "together, and they have their own bar.")],
                    "02_break_classes.csv (is a break = yes); 02_three_way_summary.csv."))
    bar_chart(s, LEFT, BODY_TOP, COL1_W, CHART_H, [b for b, _, _ in bars], [v for _, v, _ in bars],
              [BLUE if k else GREY_BAR for _, _, k in bars], title="Breaks by most likely cause")
    stack(s, COL2_X, COL2_W, [
        (2.25, dict(heading="How a cause is assigned", body=[
            "Fixed list, fixed order, first fit wins: one cause per break.",
            [("Blue: named cause. Grey: none yet.", "i")]])),
        (2.25, dict(heading="Book = custodian ≠ trades", big=n(f["rebuild_odd"]), body=[
            "holdings. The custodian repeats the book's conventions."]))])


def s_trace(d):
    f = d.f
    qty = f["trace_qty"].lstrip("−")
    neg = f["reg"]["Negative trade quantity"]
    tp = lambda field: f["trace"][("pipeline", field)][11:16]            # HH:MM of a pipeline timestamp
    share = lambda system, of="negative": pct(f[f"share_{of}"][system], 1)
    s = d.slide(3, "One evidenced trace",
                f"A {f['trace_type']} of {f['trace_qty']} shares passes every check after trade entry",
                quick_notes(
                    f"One BUY of {f['trace_qty']} shares is wrong when it enters, and every later check passes because "
                    "each one compares it with a copy of the same mistake.",
                    [f"Front office, trade capture: {f['trace_id']}, {f['trace_type']} {f['trace_qty']} from "
                     f"{f['trace_source']}, status BOOKED. A quantity is never negative, so the record is confirmed "
                     "wrong (observed).",
                     f"Pipeline: received {tp('received_timestamp')}, booked {tp('booked_timestamp')}, published "
                     f"{tp('published_timestamp')}, cutoff {tp('cutoff_timestamp')}. On time; nothing changes the "
                     "sign.",
                     "Master data: account open, security known. Clean.",
                     f"Middle office, position: its four trades add up to {f['trace_book']}, and the book says "
                     f"{f['trace_book']}. The match hides the problem.",
                     f"Custodian: also {f['trace_book']}. On positions with a negative BUY, the custodian equals the "
                     f"book on {f['trace'][('custodian', 'positions with a negative-quantity trade: custodian equals the book')]}.",
                     f"Price: {f['trace_vendors']} vendors within {f['trace_spread']}, passes. Back office: NAV "
                     f"arithmetic passes on {f['trace_fund_pass']} of {f['trace_fund_rows']} rows of fund "
                     f"{f['trace_fund']}.",
                     f"Which field is wrong: money ÷ price = {qty} gives the size, not the side. Wrong sign (BUY "
                     f"+{qty}, our lean: all {f['partner_ids']} negative BUYs with a second record point that way) or "
                     f"wrong type (SELL {qty}, then the book is right).",
                     f"Exposure: about {f['trace_bps']} bp of fund net assets if the sign is wrong, 0 if the type is. "
                     "Exposure, not a loss.",
                     f"Fix: the trade check at capture rejects quantity ≤ 0. Owner: trade operations lead (middle "
                     f"office). It would flag {n(neg[0])} of {n(neg[1])} trades."],
                    [("Why this trade?", "A written rule picked it: the first holding with a negative BUY and no other "
                      "problem. Not chosen by hand."),
                     ("Is it one broken system?",
                      f"No. {f['trace_source']} sends {share(f['trace_source'])} of the negative quantities and "
                      f"{share(f['trace_source'], 'all')} of all trades; the other sources match their share too."),
                     ("Why not just drop the minus sign?",
                      "It might be a SELL. We correct a row only when its side is known."),
                     ("What does this trade have to settle it?",
                      "No second record, so its own data can't decide. It needs the order side or the cash direction "
                      "from the source." if f["trace_partners"] == 0 else
                      f"{f['trace_partners']} second records: see 02_trace.csv.")],
                    "02_trace.csv (all hops); 02_negative_partners.csv; 02_defect_register.csv (negative trade "
                    "quantity); 02_vendor_check.csv; 02_nav_check.csv; figure 08."))
    journey = picture(s, "08_journey_negative_buy.png", LEFT, BODY_TOP - Inches(0.1), width=WIDTH)
    crop = 0.3                     # the figure's own note boxes at the bottom: the cards below say the same, larger
    journey.crop_bottom = crop
    journey.height = int(journey.height * (1 - crop))
    w, gap = (WIDTH - 2 * Inches(0.3)) / 3, Inches(0.3)
    y, h = Inches(5.2), Inches(1.6)
    card(s, LEFT, y, w, h, "What it should say", [
        [("Wrong sign: ", "b"), (f"BUY +{qty} (our lean)", "")],
        [("Wrong type: ", "b"), (f"SELL {qty}", "")]], size=15)
    card(s, LEFT + w + gap, y, w, h, "Exposure", [
        f"About {f['trace_bps']} bp of fund net assets if the sign is wrong; 0 if the type is."], size=15)
    card(s, LEFT + 2 * (w + gap), y, w, h, "Control", [
        f"At trade capture, reject quantity ≤ 0. Owner: trade operations. Flags {n(neg[0])} trades."], size=15)


def s_checks(d):
    f = d.f
    r = f["reg"]
    cover, fresh = r["Held security with no price at all"], r["Preferred vendor has no valid price on a date"]
    usd = r["USD rate to USD is not 1"]
    # The notes say the holdings with no price are the spin-off securities never set up (notebook 01 cross-check)
    assert cover[0] == f["spin_positions"] and f["spin_prices"] == 0, "unpriced holdings are not the spin-off targets"
    ran, proposed = [("Ran", "a")], [("Proposed", "i")]
    s = d.slide(4, "Proposed checks for price data and ledger arithmetic",
                f"NAV arithmetic fails on {n(f['nav_fail'])} of {n(f['nav_rows'])} rows; {n(f['vendor_scale'])} "
                "securities are priced about 100× apart",
                quick_notes(
                    "The brief asks us to propose these checks. Three already ran on all the data, two are written "
                    "as rules with an early count, and we flag what they find, we don't fix it.",
                    [f"NAV arithmetic (back office, fund accounting lead): net assets ÷ shares outstanding = NAV per "
                     f"share. Fails on {n(f['nav_fail'])} of {n(f['nav_rows'])} rows. We can't tell yet which of the "
                     "three numbers is wrong.",
                     f"Vendor spread (middle office, pricing lead): on {n(f['vendor_spread'])} of "
                     f"{n(f['vendor_evaluable'])} securities the vendors differ by more than {f['spread_threshold']}.",
                     f"Scale: on {n(f['vendor_scale'])} securities one vendor is about 100× another, likely a "
                     "per-unit vs per-100 quote. Flagged, never fixed automatically.",
                     f"Coverage (proposed): {n(cover[0])} holdings sit on a security with no price at all. They are "
                     f"the {n(f['spin_secs'])} spin-off securities that were never set up (slide 5).",
                     f"Freshness (proposed): the first-choice vendor has no valid price on {n(fresh[0])} of "
                     f"{n(fresh[1])} security-days."],
                    [("Is a failed NAV row a NAV error?",
                      "Not proven. The data has no cash or accruals, so we call it a difference to investigate."),
                     ("Can you change a threshold?",
                      "Yes: spread_threshold in config/reconciliation.toml, then rerun the notebook (about a minute)."),
                     ("What about FX?", f"The USD to USD rate is not exactly 1 on {n(usd[0])} rows. Error or "
                      "convention is an open question to you.")],
                    "02_nav_check.csv; 02_vendor_check.csv; 02_defect_register.csv (held security with no price; "
                    "preferred vendor has no valid price; USD rate to USD); 01_cross_check.csv; "
                    "config/reconciliation.toml [prices]."))
    table(s, ["Check", "Status", "Result on all the data"], [
        ["NAV arithmetic: net assets ÷ shares = NAV per share", ran,
         f"Fails on {n(f['nav_fail'])} of {n(f['nav_rows'])} rows"],
        [f"Vendor prices differ by more than {f['spread_threshold']}", ran,
         f"{n(f['vendor_spread'])} of {n(f['vendor_evaluable'])} securities"],
        ["One vendor about 100× another (unit or scale)", ran, f"{n(f['vendor_scale'])} securities, flagged, not fixed"],
        ["Coverage: every holding has a price", proposed, f"{n(cover[0])} of {n(cover[1])} holdings have none"],
        ["Freshness: first-choice vendor has a valid price", proposed,
         f"Missing on {n(fresh[0])} of {n(fresh[1])} security-days"],
    ], widths=[5.4, 1.6, 5.1], size=16, row_h=0.62, head_h=0.5)
    card(s, LEFT, Inches(5.55), WIDTH, Inches(1.2), None, [
        [("Limits sit in config/reconciliation.toml: ", "b"),
         ("change one and rerun. A failed NAV row is not a proven NAV error: the data has no cash or accruals.", "")]],
        fill=PALE)


def s_catalog(d):
    f = d.f
    r = f["reg"]
    c = f["status_counts"]
    neg, blank = r["Negative trade quantity"], r["Book leaves out the units of trades with a blank quantity"]
    dup, spin = r["Book and custodian count duplicate copies as trades"], r["Corporate-action target security missing from securities"]
    cust, clear = r["Position in the book with no custodian record"], r[
        "Closed position not reported (trades net to zero, absent from book and custodian)"]
    s = d.slide(5, "Defect catalog",
                f"{f['findings']} findings: {c.get('confirmed', 0)} confirmed, {c.get('unresolved', 0)} unresolved, "
                f"{c.get('cleared', 0)} cleared. Five go forward",
                quick_notes(
                    f"{f['findings']} findings in the register; these five go forward because each enters at a "
                    "different point on the platform, and one flag was cleared.",
                    ["1. Negative BUYs. Front office: the row already had the minus sign when it arrived from the "
                     "source system. Caught by the trade check, owner trade operations lead (middle office). Observed.",
                     f"2. Blank quantities. Front office, same point: the quantity was blank on arrival. Real trades: "
                     f"the size follows from money ÷ price on {n(f['blank_derivable'])} of {n(f['blank_rows'])}. Same "
                     "check and owner. Observed.",
                     f"3. Duplicates. Middle office, booking pipeline: {n(f['copy_ids'])} trade IDs are received once "
                     f"in a batch, then published twice, a median {f['publish_gap']} minutes apart. Copies observed; "
                     "\"a resend\" is our reading. Trade check, trade operations lead.",
                     f"4. Spin-offs never set up. Middle office, security master: the event names a new security that "
                     f"was never added. It was still traded and held: {n(f['spin_secs'])} securities, "
                     f"{n(f['spin_trades'])} trades, {n(f['spin_positions'])} position rows, {n(f['spin_prices'])} "
                     "prices. Corporate action check, corporate actions lead. Observed.",
                     f"5. Missing at the custodian. Outside source: the custodian's feed into reconciliation. The "
                     f"trades back the book on {n(f['no_cust_agree'])} of {n(f['no_cust_keys'])}. Position check, "
                     "reconciliation lead. Inferred, so unresolved.",
                     f"Cleared: {n(clear[0])} holdings whose trades net to zero are in neither source. The rule was "
                     "written first (a closed holding is not listed); neither source ever lists a zero holding."],
                    [("Who owns a defect?",
                      "The stage where it entered. Items 1 and 2 enter in the front office, but the check that "
                      "catches them is middle office's trade check."),
                     ("What would reopen the cleared flag?", "A zero-quantity row in either source."),
                     ("What would settle 3 and 5?",
                      "A message ID or resend flag on each trade; the custodian confirming or denying each holding.")],
                    "02_defect_register.csv; 02_blank_quantity.csv; 02_duplicate_profile.csv; 01_cross_check.csv; "
                    "02_three_way_summary.csv; docs/DEFECT_CATALOG.md."))
    table(s, ["Problem", "How many", "Status", "Where it entered"], [
        ["BUYs with a negative quantity", f"{n(neg[0])} of {n(neg[1])} trades",
         "Confirmed; correct value unresolved", "Trade entry"],
        ["Trades with no quantity, left out by the book", f"{n(blank[0])} of {n(blank[1])} holdings",
         "Confirmed; effect unresolved", "Trade entry"],
        ["Duplicates counted twice by book and custodian", f"{n(dup[0])} holdings", "Unresolved", "Pipeline"],
        ["Spin-off securities never set up", f"{n(spin[0])} of {n(spin[1])} events", "Confirmed", "Security master"],
        ["Holdings missing at the custodian", f"{n(cust[0])} holdings", "Unresolved", "Custodian feed"],
    ], widths=[4.4, 2.7, 3.1, 2.0], size=15, row_h=0.58, head_h=0.48)
    card(s, LEFT, Inches(5.45), WIDTH, Inches(1.3), "Cleared: closed holdings", [
        f"{n(clear[0])} holdings whose trades net to zero are in neither source. Neither source ever lists a zero "
        "holding, so these are closed."], fill=GREEN_TINT, heading_color=GREEN)


def s_reversed(d):
    f = d.f
    bars = [("REVERSED: cancel the original once", f["d_r3"], BLUE),
            ("REVERSED: cancel at every REVERSED row", f["d_r4"], AMBER),
            ("Duplicates: count both copies", f["d_copies"], GREY_BAR),
            ("No quantity: count as zero", f["d_zero"], GREY_BAR),
            ("Negative quantity: drop the minus", f["d_abs"], GREY_BAR)]
    s = d.slide(6, "Treatment of ambiguous reversals",
                f"Reading REVERSED the other way changes {n(f['r3_changed'])} of the {n(f['r3_total'])} holdings "
                "that have one",
                quick_notes(
                    "The data doesn't say whether a REVERSED row undoes its trade. We read it as a label, then reran "
                    "everything with each alternative to see how much it matters.",
                    ["Our reading: REVERSED is a label, the original trade still counts. That is the Guide's "
                     "benchmark.",
                     f"Cancel the original once: {signed(f['d_r3'])} matches with the book. It changes "
                     f"{n(f['r3_changed'])} of the {n(f['r3_total'])} holdings that have a REVERSED row.",
                     f"Cancel at every REVERSED row: {signed(f['d_r4'])}. It looks like what the book does, but some "
                     "trades have two REVERSED rows and would be cancelled twice. Not used.",
                     f"Grey bars: counting both duplicate copies ({signed(f['d_copies'])}) and blanks as zero "
                     f"({signed(f['d_zero'])}) match more because they copy the book's habits.",
                     f"Settlement date instead of trade date: {signed(f['settlement_delta'])}. The book counts a "
                     "trade on its trade date."],
                    [("What would settle REVERSED?",
                      "A written rule for the event, for example one reversal per original. Open question to you."),
                     ("Why not take the reading that matches the book best?",
                      "The book is one of the sources we are testing, so matching it is not the test.")],
                    "02_sensitivities.csv (vs positions, matched vs main chain); 02_reversed_side_view.csv; "
                    "02_waterfall.csv (C7s vs C7 matched)."))
    bar_chart(s, LEFT, BODY_TOP, COL1_W, CHART_H, [b for b, _, _ in bars], [v for _, v, _ in bars],
              [c for _, _, c in bars], title=f"Change in holdings that match the book (of {n(f['union_chain'])})",
              labels=[signed(v) + (" (not used)" if c == AMBER else "") for _, v, c in bars])
    stack(s, COL2_X, COL2_W, [
        (1.6, dict(heading="Our reading", body=["REVERSED is a label: the original trade still counts."])),
        (1.6, dict(heading="Not used", heading_color=AMBER, body=[
            f"Cancelling at every REVERSED row ({signed(f['d_r4'])}): some trades would be cancelled twice."])),
        (1.45, dict(heading="Grey bars", fill=PALE, heading_color=GREY, size=15, body=[
            "Bigger gains come from copying the book's habits, not from a better reading."]))])


def s_corporate_actions(d):
    f = d.f
    why = {"MISSING_TARGET_SECURITY_ID": "no target security given",
           "NO_RATIO_CONVENTION": "no rule for the units that disappear",
           "TARGET_NOT_MASTERED": "target security not in the master"}
    names = {"CASH_DIVIDEND": "Cash dividend", "SPINOFF": "Spin-off"}
    types = f["ca_types"].sort_values(["verdict", "events"], ascending=[False, False])
    held = types[types["verdict"] != "supported"]
    assert set(held["reason codes"]) <= set(why), f"new hold-back reasons {set(held['reason codes']) - set(why)}"
    label = lambda t, v: f"{names.get(t, t.capitalize())}: {'can apply' if v == 'supported' else 'held back'}"
    by_type = lambda verdict, reasons=None: ", ".join(
        f"{names.get(t, t.capitalize()).lower()} {e}" + (f" ({reasons[rc]})" if reasons else "")
        for t, v, rc, e in zip(types["action_type"], types["verdict"], types["reason codes"], types["events"])
        if v == verdict)
    s = d.slide(6, "Treatment of unsupported corporate actions",
                f"{n(f['ca_supported'])} of {n(f['ca_events'])} corporate actions can be applied; "
                f"{n(f['ca_quarantined'])} are held back",
                quick_notes(
                    "Before counting, we wrote down the terms each event type needs. Events with all of them can be "
                    "applied; the rest are held back, not guessed.",
                    [f"Can apply: {by_type('supported')}.",
                     f"Held back: {by_type('quarantined', why)}.",
                     "The spin-offs are the same problem as catalog item 4: the new security was never set up in the "
                     "security master.",
                     f"Flagged, not held back: {n(f['ex_after'][0])} of {n(f['ex_after'][1])} have an ex-date after "
                     "the effective date. Whether that is wrong depends on how the two dates are defined.",
                     "Owner: corporate actions lead. The check runs before the ex-date and holds the event.",
                     "Applying the supported events is a separate scenario for the final, kept apart from today's "
                     "recount so nothing is counted twice."],
                    [("Why not guess the merger target?",
                      "A guess changes holdings with no evidence. Holding the event back can be undone."),
                     ("Does the data show which accounts were adjusted?",
                      "No. corporate_actions lists issuer events, not an application log per account."),
                     ("Ex-date after effective date?", "Open question to you: which definition the data uses.")],
                    "02_ca_readiness.csv (action_type, verdict, reason codes); 02_defect_register.csv (ex_date after "
                    "effective_date)."))
    bar_chart(s, LEFT, BODY_TOP, COL1_W, CHART_H, [label(t, v) for t, v in zip(types["action_type"], types["verdict"])],
              [int(e) for e in types["events"]], [BLUE if v == "supported" else AMBER for v in types["verdict"]],
              title=f"The {n(f['ca_events'])} corporate actions, by type")
    stack(s, COL2_X, COL2_W, [
        (2.45, dict(heading="What's missing", body=[
            [(f"{names.get(t, t.capitalize())}: ", "b"), (why[rc], "")]
            for t, rc in zip(held["action_type"], held["reason codes"])])),
        (2.1, dict(heading="Flagged, not held back", big=f"{n(f['ex_after'][0])} of {n(f['ex_after'][1])}", body=[
            "ex-date after effective date"], fill=PALE, heading_color=GREY))])


# --------------------------------------------------------------------------------------------------- checks
ID = re.compile(r"\b(?:ACC|SEC|TXN|CA0|LDG|FND|POS|CMP)\d+")
CARD_WORDS, FINDING_WORDS = 25, 18
FILLER = ["never hidden", "heart of", "turning point", "on purpose", "stay visible", "crucially", "importantly",
          "it's worth", "key takeaway"]


def shape_text(shape):
    if shape.has_text_frame:
        return list(shape.text_frame.paragraphs)
    if shape.has_table:
        return [p for row in shape.table.rows for cell in row.cells for p in cell.text_frame.paragraphs]
    return []


def check_deck(trace_id, path=DECK):
    """The deck rules: a header and a one-sentence finding on every slide; one main exhibit (a chart, table or figure);
    tables of at most 5 rows and 4 columns; text of 14 pt or more; cards of at most 25 words; no record IDs but the
    trace's; no filler phrases on the slides or in the notes."""
    prs = Presentation(path)
    problems, headers = [], []
    for number, s in enumerate(prs.slides, 1):
        named = {sh.name: sh for sh in s.shapes}
        header, finding = named.get("Title"), named.get("Finding")
        if not (header and finding):
            problems.append(f"slide {number}: no header or finding")
            continue
        headers.append(f"{header.text_frame.text} | {finding.text_frame.text}")
        if len(finding.text_frame.text.split()) > FINDING_WORDS:
            problems.append(f"slide {number}: finding has {len(finding.text_frame.text.split())} words")
        exhibits = [sh for sh in s.shapes if sh.has_table or sh.has_chart or sh.name == "Figure"]
        if len(exhibits) != 1:
            problems.append(f"slide {number}: {len(exhibits)} exhibits")
        text = [s.notes_slide.notes_text_frame.text]
        for sh in s.shapes:
            if sh.has_table and (len(sh.table.rows) - 1 > 5 or len(sh.table.columns) > 4):
                problems.append(f"slide {number}: table {len(sh.table.rows) - 1}x{len(sh.table.columns)}")
            for p in shape_text(sh):
                line = "".join(r.text for r in p.runs)
                text.append(line)
                for r in p.runs:
                    if r.font.size is not None and r.font.size.pt < MIN_PT:
                        problems.append(f"slide {number}: {r.font.size.pt} pt text {r.text[:30]!r}")
                for match in ID.findall(line):
                    if match != trace_id:
                        problems.append(f"slide {number}: record ID {match}")
            if sh.name in ("Card", "BigNumber") and len(sh.text_frame.text.split()) > CARD_WORDS:
                problems.append(f"slide {number}: {len(sh.text_frame.text.split())} words in a card")
        for phrase in FILLER:
            if phrase in " ".join(text).lower():
                problems.append(f"slide {number}: filler phrase {phrase!r}")
    return headers, problems


def main():
    f = facts()
    d = Deck(f)
    for build in [s_reconciliation, s_breaks, s_trace, s_checks, s_catalog, s_reversed, s_corporate_actions]:
        build(d)
    d.save()
    headers, problems = check_deck(f["trace_id"])
    for i, header in enumerate(headers, 1):
        print(f"{i}. {header}")
    if problems:
        print("\n".join(problems))
        sys.exit("deck check failed")
    print(f"wrote {DECK.relative_to(ROOT)} and {NOTES_MD.relative_to(ROOT)}: {len(headers)} slides, deck check passed")


if __name__ == "__main__":
    main()
