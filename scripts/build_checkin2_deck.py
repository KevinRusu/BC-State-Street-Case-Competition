"""Builds the Check-in 2 deck (docs/checkins/checkin2/Checkin2.pptx) and its speaker notes (SPEAKER_NOTES.md).

Step by step:
1. facts() reads every number and ID from notebook 02's outputs (outputs/02_*.csv), the open faculty questions from
   docs/STATUS.md and the register checksum from docs/FINDINGS.md. Nothing on a slide is typed in: rerun notebook 02,
   scripts/fig_trace_journey.py and scripts/fig_checkin2.py, then this script, and the deck follows the data.
2. One function per slide writes its title (the message, as a sentence), one visual (a figure, a small table or one
   big number), at most three bullets, and its speaker notes with the source file of each number.
3. The look follows the Check-in 1 slides built by scripts/build_slides.py: Arial, the deck's blue (#001AFF) for
   titles and table headers, thin grey lines between table rows, white space, text of 14 pt or more.
4. check_deck() reopens the saved file and fails if a slide breaks the deck rules (one visual, three bullets, small
   tables, 14 pt, no record IDs except the traced trade's), then prints the titles in order.

Run from the repo root: uv run python scripts/build_checkin2_deck.py
"""
import re
import sys
from pathlib import Path

import pandas as pd
from lxml import etree
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt

ROOT = Path(__file__).resolve().parent.parent
OUTPUTS, FIGURES = ROOT / "outputs", ROOT / "docs" / "figures"
OUT_DIR = ROOT / "docs" / "checkins" / "checkin2"
DECK, NOTES_MD = OUT_DIR / "Checkin2.pptx", OUT_DIR / "SPEAKER_NOTES.md"

BLUE = RGBColor(0x00, 0x1A, 0xFF)
INK = RGBColor(0x1A, 0x1A, 0x2E)
GREY = RGBColor(0x5F, 0x63, 0x68)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
LINE = "C9CCD6"
LEFT, WIDTH = Inches(0.6), Inches(12.13)
BODY_TOP = Inches(1.55)
MIN_PT = 14


# --------------------------------------------------------------------------------------------------- numbers
def read(name):
    path = OUTPUTS / name
    if not path.exists():
        sys.exit(f"{path} not found: run notebook 02 first (tests/run_notebook.sh)")
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

    w = read("02_waterfall.csv")
    w = w[w["compared with"] == "positions"].set_index("code")
    for code, name in [("C0", "raw"), ("BOOKED-only", "booked"), ("C7", "chain")]:
        f[f"diff_{name}"], f[f"union_{name}"] = int(w.loc[code, "different"]), int(w.loc[code, "keys in union"])
    f["settlement_delta"] = int(w.loc["C7s", "matched"]) - int(w.loc["C7", "matched"])
    f["extra_diff"] = f["diff_chain"] - f["diff_booked"]

    s = read("02_sensitivities.csv")
    s = s[s["compared with"] == "positions"].set_index("alternative")["matched vs main chain"].astype(int)
    f["sens"] = s.to_dict()
    pick = lambda prefix: int(s[[a for a in s.index if a.startswith(prefix)]].iloc[0])
    f["d_r3"], f["d_r4"] = pick("REVERSED: R3"), pick("REVERSED: R4")
    f["d_copies"], f["d_abs"] = pick("copies: both counted"), pick("negatives: absolute value")
    f["d_zero"], f["d_keep_first"] = pick("blanks: zero"), pick("conflicting pairs: keep_first")

    bq = read("02_blank_quantity.csv").set_index("measure")
    f["blank_rows"] = int(bq.loc["rows with a blank quantity", "count"])
    f["blank_derivable"] = int(bq.loc["derivable: whole number of units, no link to another trade", "count"])
    keyrow = bq.loc["keys with a blank row in the main chain: evaluable once blanks are derived"]
    f["blank_testable"], f["blank_keys"] = int(keyrow["count"]), int(keyrow["out of"])
    f["blank_match_book"] = int(bq.loc["derived rebuild equals the book", "count"])
    back = bq.loc["rows with a quantity: gross_amount / price gives it exactly"]
    f["backtest_exact"], f["backtest_rows"] = int(back["count"]), int(back["out of"])

    dp = read("02_duplicate_profile.csv").set_index("measure")
    both = dp.loc["of the book positions holding a copy: transaction_count counts both copies"]
    f["copy_positions_counted"], f["copy_positions"] = int(both["count"]), int(both["out of"])
    f["copy_ids"] = int(dp.loc["repeated transaction_ids that are copies (exact or date format only)", "count"])
    f["publish_gap"] = f"{float(dp.loc['minutes between the two publishes: median', 'count']):.0f}"

    reg = read("02_defect_register.csv").set_index("finding")
    line = lambda name: reg.loc[name]
    f["status_counts"] = reg["status"].value_counts().to_dict()
    f["findings"] = len(reg)
    f["reg"] = {name: (int(r["affected"]), int(r["eligible"]), int(r["not evaluable"])) for name, r in reg.iterrows()}
    f["ex_after"] = (int(line("ex_date after effective_date")["affected"]), int(line("ex_date after effective_date")["population"]))

    tr = read("02_trace.csv")
    trace = {(r["hop"], r["field"]): r["value"] for _, r in tr.iterrows()}
    f["trace_id"] = trace[("source", "transaction_id")]
    f["trace_type"] = trace[("source", "transaction_type")]
    f["trace_qty"] = n(trace[("source", "quantity")])
    f["trace_book"] = n(trace[("position", "quantity")])
    f["trace_custodian"] = n(trace[("custodian", "quantity")])
    f["trace_wrong_sign"] = n(trace[("position", "quantity under the wrong-sign reading")])
    f["trace_bps"] = f"{float(trace[('downstream', 'indicative exposure (bps of fund net assets)')]):.0f}"
    f["trace_source"] = trace[("source", "source_system")]
    f["trace_cust_same"] = trace[("custodian", "positions with a negative-quantity trade: custodian equals the book")]
    f["trace_partners"] = int(trace[("source", "other records of this trade")])

    partners = read("02_negative_partners.csv")
    f["partner_ids"] = partners["transaction_id"].nunique()
    f["partner_wrong_sign"] = partners.loc[partners["reading_supported"] == "wrong sign", "transaction_id"].nunique()
    # The trace note says every negative trade with a partner is a BUY and every partner supports wrong sign (D-043)
    assert set(partners["transaction_type"]) <= {"BUY"}, "a negative trade with a partner is not a BUY: reword slide 6"
    assert f["partner_wrong_sign"] == f["partner_ids"], "not every partner supports wrong sign: revisit D-043 and slide 6"

    nav = read("02_nav_check.csv")["result"].value_counts()
    f["nav_fail"], f["nav_rows"] = int(nav.get("fail", 0)), int(nav.sum())
    vendor_check = read("02_vendor_check.csv")
    vendor = vendor_check["result"]
    f["vendor_spread"] = int((vendor == "spread above threshold").sum())
    f["vendor_scale"] = int((vendor == "scale flag (ratio near 100)").sum())
    f["vendor_not_comparable"] = int(vendor.str.contains("not evaluable").sum())
    f["vendor_no_quote"] = int((vendor == "no quote (not evaluable)").sum())
    f["vendor_evaluable"] = len(vendor) - f["vendor_not_comparable"]
    per_count = vendor_check["vendors"].astype(int).value_counts().sort_index(ascending=False)
    words = {0: "none", 1: "one", 2: "two", 3: "three"}
    parts = [f"from {words.get(k, k)} on {n(c)}" for k, c in per_count.items()]
    parts[0] = parts[0].replace(" on ", " vendors on ", 1) + " securities"
    f["vendor_coverage"] = ", ".join(parts[:-1]) + (" and " if len(parts) > 1 else "") + parts[-1]
    f["vendor_not_comparable_text"] = (f"{n(f['vendor_no_quote'])} have no quote to compare"
                                       if f["vendor_not_comparable"] == f["vendor_no_quote"] else
                                       f"{n(f['vendor_not_comparable'])} can't be compared "
                                       f"({n(f['vendor_no_quote'])} have no quote at all)")
    import tomllib
    with open(ROOT / "config" / "reconciliation.toml", "rb") as stream:
        prices = tomllib.load(stream)["prices"]
    f["spread_threshold"] = f"{100 * prices['spread_threshold']:g}%"
    f["scale_band"] = f"{prices['scale_ratio_low']:g} to {prices['scale_ratio_high']:g}"

    ca = read("02_ca_readiness.csv")
    f["ca_events"] = len(ca)
    f["ca_supported"] = int((ca["verdict"] == "supported").sum())
    f["ca_quarantined"] = int((ca["verdict"] == "quarantined").sum())
    f["ca_types"] = (ca.groupby(["action_type", "verdict", "reason codes"])
                     .agg(events=("action_id", "size"), release=("what would release it", "first")).reset_index())
    f["ca_holders"] = {r["action_id"]: int(r["candidate holders"]) for _, r in ca.iterrows()}

    side = read("02_reversed_side_view.csv")
    side.columns = ["main", "side", "keys"]
    side["keys"] = side["keys"].astype(int)
    changed = side[side["main"] != side["side"]]
    f["r3_total"], f["r3_changed"] = int(side["keys"].sum()), int(changed["keys"].sum())
    f["r3_to_agree"] = int(changed.loc[changed["side"] == "all three agree", "keys"].sum())
    f["r3_to_ne"] = int(changed.loc[changed["side"].str.startswith("not evaluable"), "keys"].sum())
    breaks_ = {"rebuild is the odd one out", "book is the odd one out", "custodian is the odd one out", "all three differ"}
    f["r3_to_break"] = int(changed.loc[changed["side"].isin(breaks_) & ~changed["main"].isin(breaks_), "keys"].sum())
    f["r3_other"] = f["r3_changed"] - f["r3_to_agree"] - f["r3_to_ne"] - f["r3_to_break"]

    status = (ROOT / "docs" / "STATUS.md").read_text()
    block = status.split("## Open questions for faculty", 1)[1].split("\n## ", 1)[0]
    f["questions"] = re.findall(r"^\d+\. (.+)$", block, re.M)
    findings_md = (ROOT / "docs" / "FINDINGS.md").read_text()
    f["checksum"] = re.search(r"Register checksum: `([0-9a-f]+)`", findings_md).group(1)
    return f


# --------------------------------------------------------------------------------------------------- drawing
def style_run(run, size, color=INK, bold=False, italic=False):
    run.font.name = "Arial"; run.font.size = Pt(size); run.font.bold = bold; run.font.italic = italic
    run.font.color.rgb = color


def text_box(slide, x, y, w, h, text, size=18, color=INK, bold=False, align=PP_ALIGN.LEFT, name=None,
             anchor=MSO_ANCHOR.TOP):
    tb = slide.shapes.add_textbox(x, y, w, h)
    if name:
        tb.name = name
    tf = tb.text_frame; tf.word_wrap = True; tf.vertical_anchor = anchor
    tf.margin_left = tf.margin_right = 0
    p = tf.paragraphs[0]; p.alignment = align
    style_run(p.add_run(), size, color, bold)
    p.runs[0].text = text
    return tb


def add_runs(paragraph, parts, size):
    """`parts` is a string or a list of (text, style); style 'i' = italic grey (evidence marks), 'b' = bold."""
    for text, kind in ([(parts, "")] if isinstance(parts, str) else parts):
        style_run(paragraph.add_run(), size, GREY if kind == "i" else INK, bold=kind == "b", italic=kind == "i")
        paragraph.runs[-1].text = text


def bullets(slide, x, y, w, h, items, size=18):
    """At most three bullets (checked in check_deck), each a string or a list of (text, style) parts."""
    tb = slide.shapes.add_textbox(x, y, w, h)
    tb.name = "Bullets"
    tf = tb.text_frame; tf.word_wrap = True
    tf.margin_left = tf.margin_right = 0
    for i, item in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.space_after = Pt(10)
        pPr = p._p.get_or_add_pPr()
        pPr.set("marL", str(Inches(0.28))); pPr.set("indent", str(-Inches(0.28)))
        clr = etree.SubElement(pPr, qn("a:buClr"))
        etree.SubElement(clr, qn("a:srgbClr"), val="001AFF")
        etree.SubElement(pPr, qn("a:buFont"), typeface="Arial")
        etree.SubElement(pPr, qn("a:buChar"), char="•")
        add_runs(p, item, size)
    return tb


def set_border(cell, side, color=LINE, width=6350):
    """One cell border (side L, R, T or B) as a thin solid line, or none (as in scripts/build_slides.py)."""
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
    """Blue header row, plain rows with a thin grey line under each, a blue line under the last (build_slides.py)."""
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
            cell.margin_left = cell.margin_right = Inches(0.1)
            cell.margin_top = cell.margin_bottom = Inches(0.05)
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            p = cell.text_frame.paragraphs[0]
            cell.text_frame.word_wrap = True
            style_run(p.add_run(), size, WHITE if i == 0 else INK, bold=i == 0)
            p.runs[0].text = str(value)
            if i == 0:
                cell.fill.solid(); cell.fill.fore_color.rgb = BLUE
                for side in "LRTB":
                    set_border(cell, side, color=None)
            else:
                cell.fill.background()
                for side in "LRT":
                    set_border(cell, side, color=None)
                last = i == len(rows)
                set_border(cell, "B", color="001AFF" if last else LINE, width=12700 if last else 6350)
    return shape


def picture(slide, name, left, top, width=None, height=None, shape_name="Figure"):
    pic = slide.shapes.add_picture(str(FIGURES / name), left, top, width=width, height=height)
    pic.name = shape_name
    return pic


class Deck:
    def __init__(self, facts_):
        self.f = facts_
        self.prs = Presentation()
        self.prs.slide_width, self.prs.slide_height = Inches(13.333), Inches(7.5)
        self.notes = []          # (label, title, notes) for SPEAKER_NOTES.md
        self.count = 0

    def slide(self, title, notes, label=None):
        s = self.prs.slides.add_slide(self.prs.slide_layouts[6])     # blank layout
        if label != "cover":
            self.count += 1
            label = label or str(self.count)
            text_box(s, LEFT, Inches(0.35), WIDTH, Inches(1.05), title, size=26, color=BLUE, bold=True, name="Title",
                     anchor=MSO_ANCHOR.TOP)
            text_box(s, LEFT, Inches(7.0), Inches(8), Inches(0.35), "Check-in 2 · method gate", size=14, color=GREY)
            text_box(s, Inches(11.73), Inches(7.0), Inches(1), Inches(0.35), label, size=14, color=GREY,
                     align=PP_ALIGN.RIGHT)
        s.notes_slide.notes_text_frame.text = notes
        self.notes.append((label, title, notes))
        return s

    def save(self):
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        self.prs.save(DECK)
        lines = ["# Check-in 2: speaker notes", "",
                 "*Generated by `scripts/build_checkin2_deck.py` with the deck; do not edit by hand (rerun the script). "
                 "About one minute per slide. Use your own words; the source file of each number is at the end of "
                 "each note.*", ""]
        for label, title, notes in self.notes:
            lines += [f"## Slide {label}: {title}", "", notes, ""]
        NOTES_MD.write_text("\n".join(lines))


# --------------------------------------------------------------------------------------------------- slides
def cover(d):
    f = d.f
    s = d.slide("Check-in 2: the method gate",
                "Cover. One sentence: today we show how we work the data, follow one broken trade through the "
                "platform, and ask to be cleared to build the full analysis. Every number on the slides is written "
                f"by a script from notebook 02's outputs (register checksum {f['checksum']}).", label="cover")
    text_box(s, LEFT, Inches(2.2), WIDTH, Inches(1.2), "Check-in 2: the method gate", size=44, color=BLUE, bold=True)
    text_box(s, LEFT, Inches(3.4), WIDTH, Inches(0.8), "One broken trade, from the trading desk to the fund",
             size=24, color=INK)
    text_box(s, LEFT, Inches(5.6), WIDTH, Inches(0.8),
             f"Full data, snapshot {f['snapshot']} · every number from notebook 02 · register checksum {f['checksum']}",
             size=14, color=GREY)


def s_answer(d):
    f = d.f
    s = d.slide(f"Our rebuild runs on all {f['trade_rows_m']} trades, and {f['rate']} of the positions we can test "
                "agree across all three sources",
                f"This is the answer first. We rebuilt every holding by adding up its trades from zero: BUY adds, SELL "
                f"subtracts. That ran on all {n(f['trade_rows'])} trade rows in {f['runtime']}, live in notebook 02.\n\n"
                f"Then we compared three sources for every position: our rebuild, the book of record (the platform's "
                f"own list of holdings) and the custodian (the outside bank that holds the securities). "
                f"{n(f['agree'])} of the {n(f['testable'])} positions we can test agree in all three: {f['rate']}.\n\n"
                f"We leave {n(f['not_evaluable'])} positions out of that rate on purpose: we can't test them, mostly "
                f"because one of their trades has a blank quantity ({n(f['not_evaluable_blank'])}). Unknown is not "
                f"wrong and not right, so it sits beside the rate, not inside it (D-046).\n\n"
                f"{n(f['breaks'])} positions disagree. We give each one cause; {n(f['unexplained'])} have no cause yet "
                f"and stay visible. And agreement is not proof: {n(f['agree_with_negative'])} agreeing positions "
                f"contain a negative BUY. That is the trade we follow on slide 6.\n\n"
                "Sources: 02_row_ledger.csv (load transactions), 02_run_info.csv (runtime), 02_three_way_summary.csv "
                "(all three agree; not evaluable rows), 02_break_classes.csv (is a break = yes; cause unexplained; "
                "sign_conflict_keys on all three agree).")
    text_box(s, LEFT, Inches(2.0), Inches(5.4), Inches(1.6), f["rate"], size=96, color=BLUE, bold=True, name="BigNumber")
    text_box(s, LEFT, Inches(3.75), Inches(5.2), Inches(1.4),
             f"{n(f['agree'])} of {n(f['testable'])} positions we can test: trades, book and custodian agree",
             size=18, color=GREY)
    bullets(s, Inches(6.5), Inches(2.1), Inches(6.2), Inches(4.5), [
        f"Rebuild: sum every trade per holding; runs on all {f['trade_rows_m']} rows in {f['runtime']}.",
        f"{n(f['not_evaluable'])} can't be tested, mostly a blank quantity.",
        f"{n(f['breaks'])} disagree; {n(f['unexplained'])} not yet explained.",
    ], size=20)


def s_waterfall(d):
    f = d.f
    s = d.slide("Cleaning the trades raises the differences with the book, because the book counts duplicate "
                "trade copies that we count once",
                f"How we got to our rebuild, step by step. Each bar counts positions where a rebuild differs from the "
                f"book of record. Every row as delivered: {n(f['diff_raw'])} of {n(f['union_raw'])}. The Guide's "
                f"shared benchmark, BOOKED rows only: {n(f['diff_booked'])} of {n(f['union_booked'])}. Our chain: "
                f"{n(f['diff_chain'])} of {n(f['union_chain'])}.\n\n"
                "Our chain is stricter than the benchmark in one main way: when the same trade arrives twice, we "
                f"count it once. {n(f['copy_ids'])} trades arrived twice; both copies came in together and were "
                f"published twice, a median {f['publish_gap']} minutes apart, which looks like a resend (inferred). "
                f"The book counts both copies on {n(f['copy_positions_counted'])} of {n(f['copy_positions'])} "
                f"positions that hold one. Counting both, as the book does, would add {n(f['d_copies'])} matches, "
                f"about the size of the {n(f['extra_diff'])} extra differences against the benchmark.\n\n"
                "So more differences here is not a worse rebuild: it shows a convention of the book that we question "
                "(D-044, faculty question 4).\n\n"
                "Sources: 02_waterfall.csv (C0, BOOKED-only, C7 vs positions: different, keys in union); "
                "02_duplicate_profile.csv; 02_sensitivities.csv (copies: both counted).")
    picture(s, "09_waterfall.png", LEFT, BODY_TOP + Inches(0.1), width=WIDTH)
    bullets(s, LEFT, Inches(5.35), WIDTH, Inches(1.5), [
        "Book of record: the platform's official list of what each account holds.",
        f"Counting both copies, as the book does, would add {n(f['d_copies'])} matches.",
    ])


def s_decisions(d):
    f = d.f
    blank = f"{n(f['blank_testable'])} of {n(f['blank_keys'])} become testable; {n(f['blank_match_book'])} match the book"
    s = d.slide("Where the data is unclear, we chose the cautious reading and measured the other one",
                "Every choice we made, with the other reading and its effect, measured by rerunning the whole chain "
                "with that one step swapped. The effect is the change in positions that match the book, out of "
                f"{n(f['union_chain'])}.\n\n"
                f"REVERSED: we keep the original and read REVERSED as a status (R1, the Guide's benchmark). Offsetting "
                f"each original once (R3) changes {signed(f['d_r3'])} matches; offsetting every REVERSED row (R4, what "
                f"the book seems to do) {signed(f['d_r4'])}, but that is a double offset, so we never use it.\n\n"
                f"Copies: we count a trade once; counting both {signed(f['d_copies'])}. Negative quantities: we keep "
                f"the sign and flag it; the absolute value {signed(f['d_abs'])}. Copies that disagree with each other "
                f"are not evaluable; keeping the first changes {signed(f['d_keep_first'])}.\n\n"
                f"Blank quantities: we can't test them. Counting a blank as zero adds {n(f['d_zero'])} matches, but "
                f"the money and price in the same row give the size: then {blank}. So the book seems to drop the "
                f"units of real trades (D-047). Settlement date instead of trade date: {signed(f['settlement_delta'])}.\n\n"
                "Sources: 02_sensitivities.csv (matched vs main chain, vs positions); 02_blank_quantity.csv "
                "(positions); 02_waterfall.csv (C7s minus C7 matched).")
    table(s, ["Where the data is unclear", "Our choice", "The other reading", f"Effect (of {n(f['union_chain'])})"], [
        ["REVERSED trade", "Original stands (R1)", "Offset each original once (R3)", f"{signed(f['d_r3'])} matched"],
        ["Same trade sent twice", "Count it once", "Count both, as the book does", f"{signed(f['d_copies'])} matched"],
        ["Negative BUY quantity", "Keep the sign, flag it", "Absolute value", f"{signed(f['d_abs'])} matched"],
        ["Blank quantity", "Can't be tested", "Size = money ÷ price", blank],
        ["Holding date", "Trade date", "Settlement date", f"{signed(f['settlement_delta'])} matched"],
    ], widths=[2.6, 2.6, 3.3, 3.6], size=16, row_h=0.58)
    bullets(s, LEFT, Inches(5.3), WIDTH, Inches(1.6), [
        "Not evaluable: we can't test it, so it never counts as a match.",
        "We never repair silently: no absolute values, no blank as zero.",
    ])


def s_three_way(d):
    f = d.f
    s = d.slide(f"On {n(f['rebuild_odd'])} positions the book and the custodian agree with each other, "
                "but not with the trades",
                f"Three sources for every position, {n(f['union'])} in all. {n(f['agree'])} agree in all three. "
                f"The chart shows the rest, by who disagrees.\n\n"
                f"The biggest group is the turning point of our story: on {n(f['rebuild_odd'])} positions the book "
                f"and the custodian hold the same number, and our trades say something else. Normally two sources "
                f"agreeing means we trust the number. Here the custodian seems to follow the book's own conventions, "
                f"counting duplicate copies and subtracting every REVERSED row, so its agreement is not independent. "
                f"Slide 5 shows which conventions.\n\n"
                f"The custodian is the odd one out on {n(f['custodian_odd'])}. Book against custodian alone: "
                f"{n(f['bvc_only_book'])} positions are in the book only, {n(f['bvc_only_custodian'])} at the custodian "
                f"only; for {n(f['no_cust_keys'])} of those our trades exist and agree with the book on "
                f"{n(f['no_cust_agree'])}, which points to a gap in the custodian's file (inferred).\n\n"
                "Sources: 02_three_way_summary.csv (rebuild vs book vs custodian patterns; book vs custodian rows).")
    picture(s, "10_three_way.png", LEFT, BODY_TOP + Inches(0.15), width=Inches(8.1))
    bullets(s, Inches(9.0), BODY_TOP + Inches(0.3), Inches(3.75), Inches(4.8), [
        "Custodian: the outside bank that holds the securities, our second opinion.",
        f"{n(f['agree'])} of {n(f['union'])} positions agree three ways.",
        f"{n(f['bvc_only_book'])} positions are in the book but not at the custodian.",
    ])


def s_breaks(d):
    f = d.f
    c = f["cause"]
    rows = [("Book counts duplicate copies", c.get("book_counts_duplicate_copies", 0)),
            ("Book subtracts every REVERSED row", c.get("book_double_offsets_reversed", 0)),
            ("Both of the above", c.get("duplicates_and_reversed", 0)),
            ("Opposite sign to the trades", c.get("sign_flipped_position", 0)),
            ("No rule fits: unexplained", c.get("unexplained", 0))]
    assert sum(v for _, v in rows) == f["breaks"], "the cause rows do not add up to the breaks"
    s = d.slide(f"Most breaks have a named cause; the {n(f['unexplained'])} we can't explain stay visible",
                f"A break is a difference that must be explained; it is not automatically an error. Each of the "
                f"{n(f['breaks'])} breaks gets exactly one cause. The rules are tested in a fixed order that we wrote "
                "in the config before counting, and the first rule that fits wins, so nothing is counted twice.\n\n"
                "The two big named causes are conventions the book and custodian seem to share: counting duplicate "
                "copies, and subtracting every REVERSED row. Whether these are defects or intended is a question for "
                "you (slide 10), so they are unresolved, not errors.\n\n"
                f"{n(f['unexplained'])} breaks fit no rule, mostly where the custodian disagrees with both the book and "
                f"the trades ({n(f['custodian_odd'])}). We show them rather than force them into a class; opening "
                "them is our first task after today.\n\n"
                f"Flags sit on top of the class: {n(f['agree_with_negative'])} positions that agree three ways still "
                "contain a negative BUY. That's where the next slide starts.\n\n"
                "Sources: 02_break_classes.csv (is a break = yes, keys by cause; sign_conflict_keys on all three "
                "agree).")
    table(s, ["Cause (first rule that fits)", "Positions", f"Share of {n(f['breaks'])} breaks"],
          [[name, n(v), pct(v, f["breaks"], 0)] for name, v in rows], widths=[6.5, 2.6, 3.0], size=16, row_h=0.55)
    bullets(s, LEFT, Inches(5.3), WIDTH, Inches(1.6), [
        "Each break gets one cause, from rules fixed before counting.",
        f"{n(f['agree_with_negative'])} positions that agree three ways still contain a negative BUY.",
    ])


def s_trace(d):
    f = d.f
    s = d.slide("A broken trade passes every check after the point where it entered",
                f"At Check-in 1 we followed a clean trade: it passed every check (small picture, top left). Today we "
                f"follow a broken one, {f['trace_id']}, picked by a written rule, not by hand.\n\n"
                f"Observed: it is a {f['trace_type']} of {f['trace_qty']} shares, sent by {f['trace_source']} and booked. "
                f"A quantity is never negative, so the record is wrong for sure. The money paid confirms the size but "
                f"not the side, so two readings fit: wrong sign (a BUY of the positive amount) or wrong type (a SELL). "
                f"We lean to wrong sign: of the {f['partner_ids']} negative BUYs that have a second record, all "
                f"{f['partner_wrong_sign']} support it. "
                + ("But this trade has none.\n\n" if f["trace_partners"] == 0 else
                   f"This trade has {f['trace_partners']}: see 02_trace.csv.\n\n") +
                f"The book holds {f['trace_book']} and so does the custodian, so every later check passes: the "
                f"reconciliation, the custodian, the price, the NAV arithmetic. If the sign is wrong the holding "
                f"should be {f['trace_wrong_sign']}: an exposure of about {f['trace_bps']} basis points of the fund's "
                "net assets. If the type is wrong, zero. Exposure, never a loss. The only place to stop it is at trade "
                "capture: reject a quantity that isn't above zero.\n\n"
                "Sources: 02_trace.csv (all hops); 02_negative_partners.csv; figures 06 and 08.")
    thumb_w = Inches(2.7)
    picture(s, "06_journey_trade_simple.png", LEFT, Inches(1.4), width=thumb_w, shape_name="Thumbnail")
    text_box(s, LEFT, Inches(2.48), Inches(3.3), Inches(0.3), "Check-in 1: the clean trade", size=14, color=GREY)
    bullets(s, Inches(3.75), Inches(1.4), Inches(9.0), Inches(1.4), [
        [("Observed: ", "i"), (f"{f['trace_type']} of {f['trace_qty']}, booked; book and custodian both hold "
                               f"{f['trace_book']}.", "")],
        [("Inferred: ", "i"), ("wrong sign (leaning) or wrong type.", "")],
        f"Exposure: ~{f['trace_bps']} bps if the sign is wrong, 0 if the type is; not a loss.",
    ], size=16)
    journey = picture(s, "08_journey_negative_buy.png", 0, Inches(2.85), height=Inches(4.1))
    journey.left = int((d.prs.slide_width - journey.width) / 2)          # centred, aspect ratio kept


def s_checks(d):
    f = d.f
    s = d.slide(f"The fund arithmetic fails on {n(f['nav_fail'])} of {n(f['nav_rows'])} rows, and "
                f"{n(f['vendor_scale'])} securities have vendor prices about 100 times apart",
                "The brief asks for proposed checks on price data and ledger arithmetic. We ran two of them on the "
                "full data and wrote the rest as rules with a denominator.\n\n"
                f"Ledger arithmetic: for every fund share class, net assets divided by shares outstanding must equal "
                f"the NAV per share, the price investors buy and sell at. It fails on {n(f['nav_fail'])} of "
                f"{n(f['nav_rows'])} rows. Which input is wrong we can't tell yet.\n\n"
                f"Vendor prices: on the snapshot date the held securities have quotes {f['vendor_coverage']}. "
                f"On {n(f['vendor_spread'])} of {n(f['vendor_evaluable'])} securities their prices differ by more than "
                f"{f['spread_threshold']}; {f['vendor_not_comparable_text']}. On {n(f['vendor_scale'])} the highest and lowest are "
                f"about 100 times apart (ratio {f['scale_band']}), the signature of a price per 100 against per unit. "
                "We flag it and never correct it automatically. Thresholds live in the config; judges can change them.\n\n"
                "Proposed, not run: coverage (does every holding have a price), freshness (is the price from the "
                "right day and time), FX rates (the USD rate is not exactly 1: question for you).\n\n"
                "Sources: 02_nav_check.csv (result); 02_vendor_check.csv (result); config/reconciliation.toml [prices].")
    table(s, ["Check", "Tested on", "Result", "Status"], [
        ["Fund arithmetic: net assets ÷ shares = NAV per share", f"{n(f['nav_rows'])} fund rows",
         f"{n(f['nav_fail'])} fail", "Run"],
        [f"Vendor prices differ by more than {f['spread_threshold']}", f"{n(f['vendor_evaluable'])} held securities",
         f"{n(f['vendor_spread'])} flagged", "Run"],
        ["Vendor prices about 100× apart", f"{n(f['vendor_evaluable'])} held securities",
         f"{n(f['vendor_scale'])} flagged", "Run"],
        ["Price coverage, freshness, FX rates", "Rule and denominator written", "–", "Proposed"],
    ], widths=[5.2, 3.2, 2.0, 1.7], size=16, row_h=0.6)
    bullets(s, LEFT, Inches(4.9), WIDTH, Inches(1.9), [
        "NAV: a fund's value per share.",
        "A 100× gap suggests per-100 against per-unit prices: flagged, never fixed.",
        "The price check passed our broken trade: it can't see wrong units.",
    ])


def s_catalog(d):
    f = d.f
    r = f["reg"]
    neg, blank = r["Negative trade quantity"], r["Book leaves out the units of trades with a blank quantity"]
    dup, spin = r["Book and custodian count duplicate copies as trades"], r["Corporate-action target security missing from securities"]
    cust, clear = r["Position in the book with no custodian record"], r[
        "Closed position not reported (trades net to zero, absent from book and custodian)"]
    s = d.slide("Five defect classes go forward, and one flag turned out to be fine",
                "The defect catalog: five classes with a full write-up (rule, where it entered, why it matters, the "
                "fix), spread across trade capture, the pipeline, master data and the custodian feed. Each names the "
                "check that would stop it and its owner.\n\n"
                f"Negative BUYs: {n(neg[0])} of {n(neg[1])} trade rows; the record is confirmed wrong, its correct value "
                f"is not. Blank quantities: the size is still in the row on {n(f['blank_derivable'])} of "
                f"{n(f['blank_rows'])}, and the book drops the units on {n(blank[0])} of {n(blank[1])} testable "
                f"positions. Duplicate copies: the book and custodian count them on {n(dup[0])} positions. Spin-off "
                f"targets: {n(spin[0])} of {n(spin[1])} new securities were never set up, then traded and held without "
                f"a price. Custodian gaps: {n(cust[0])} positions in the book have no custodian record.\n\n"
                f"The cleared flag: {n(clear[0])} positions whose trades net to zero and that neither source lists. Rule "
                "written before looking: a closed position isn't listed. Independent evidence: neither source stores "
                "a single zero-quantity row anywhere. What would reopen it: one zero row, or a later record.\n\n"
                f"The register behind it has {f['findings']} findings (backup B3).\n\n"
                "Sources: 02_defect_register.csv (the six lines named in the table and bullet); "
                "02_blank_quantity.csv; docs/DEFECT_CATALOG.md.")
    table(s, ["Defect", "Where it entered", "Status", "How many"], [
        ["Negative-quantity BUYs", "Trade capture", "Record confirmed; fix unknown", f"{n(neg[0])} of {n(neg[1])} trades"],
        ["Book drops the units of blank-quantity trades", "Trade capture", "Rows confirmed; book unresolved",
         f"{n(blank[0])} of {n(blank[1])} positions"],
        ["Duplicate copies counted by the book", "Pipeline (publish)", "Copies confirmed; count unresolved",
         f"{n(dup[0])} of {n(dup[1])} positions"],
        ["Spin-off targets never set up", "Master data", "Confirmed", f"{n(spin[0])} of {n(spin[1])} spin-offs"],
        ["Custodian missing holdings", "Custodian feed", "Unresolved", f"{n(cust[0])} of {n(cust[1])} positions"],
    ], widths=[4.1, 2.4, 3.3, 2.9], size=15, row_h=0.6)
    bullets(s, LEFT, Inches(5.4), WIDTH, Inches(1.4), [
        f"Cleared: {n(clear[0])} closed positions; neither source ever lists a zero holding, so their absence is normal.",
    ])


def s_corporate_actions(d):
    f = d.f
    release = {"": "–", "MISSING_TARGET_SECURITY_ID": "The resulting security named",
               "NO_RATIO_CONVENTION": "A rule for the units removed",
               "TARGET_NOT_MASTERED": "The new security set up"}
    types = f["ca_types"].sort_values(["verdict", "events"], ascending=[False, False])
    names = {"CASH_DIVIDEND": "Cash dividend", "SPINOFF": "Spin-off"}
    rows = [[names.get(t, t.capitalize()), n(e), "Applied" if v == "supported" else "Held back",
             release.get(rc, text or "–")]        # the notebook's own wording for any code without a short label
            for t, v, rc, e, text in types[["action_type", "verdict", "reason codes", "events", "release"]].itertuples(index=False)]
    s = d.slide(f"{n(f['ca_supported'])} of {n(f['ca_events'])} corporate actions can be applied; "
                f"{n(f['ca_quarantined'])} are held back because a term we need is missing",
                "Corporate actions are company events that change holdings: a split, a merger, a spin-off, a dividend, "
                "a redemption. For each type we wrote down the terms it needs before counting (the Guide's "
                "conventions).\n\n"
                f"{n(f['ca_supported'])} of {n(f['ca_events'])} events have every term they need. "
                f"{n(f['ca_quarantined'])} are held back: mergers name no resulting security, redemptions have no rule "
                "for the units that disappear, and spin-offs point to a new security that was never set up. Held back "
                "means we don't apply them and we don't guess; the table says what would release each one.\n\n"
                f"{n(f['ex_after'][0])} of {n(f['ex_after'][1])} events have an ex-date after their effective date. We "
                "flag them as unresolved rather than hold them back, because it depends on how the dates are defined: "
                "a question for you.\n\n"
                "The event-adjusted holdings come in the final, kept apart from the trade-only rebuild so nothing is "
                "counted twice.\n\n"
                "Sources: 02_ca_readiness.csv (action_type, verdict, reason codes); 02_defect_register.csv "
                "(ex_date after effective_date).")
    table(s, ["Event type", "Events", "Verdict", "What would release it"], rows,
          widths=[3.0, 1.6, 2.4, 5.1], size=16, row_h=0.52)
    bullets(s, LEFT, Inches(5.25), WIDTH, Inches(1.6), [
        "Corporate action: a company event (split, merger…) that changes holdings.",
        "Held back: not applied, not guessed, until the term arrives.",
        f"{n(f['ex_after'][0])} of {n(f['ex_after'][1])} have ex-date after effective date: flagged until dates are "
        "defined.",
    ])


def s_questions(d):
    f = d.f
    q = f["questions"]
    groups = [("The book's conventions", [1, 4], "Is there a REVERSED contract (one reversal per original)? "
               "Are duplicates and REVERSED rows counted on purpose?"),
              ("Negative BUYs", [8], "Wrong sign or wrong type? We need the order side or the cash direction."),
              ("Definitions", [2, 3], "Ex-date or effective date for corporate actions? Is a USD rate that isn't 1 an "
               "error?"),
              ("Ways of working", [5, 6, 7], "May we cite CSSF 24/856 for NAV materiality? Which AI tools are "
               "approved? How should we package the dashboard?")]
    covered = sorted(i for _, ids, _ in groups for i in ids)
    assert covered == list(range(1, len(q) + 1)), f"the slide groups questions {covered}, STATUS has {len(q)}"
    s = d.slide(f"We ask to be cleared to build the full analysis, and need your view on {len(q)} questions",
                "What we ask today: clear us to build the full analysis on this method.\n\n"
                "The questions, by topic. Each one changes a decision. If REVERSED has a contract, or the book's "
                "conventions are intended, two of our break causes become explained instead of defects. The order "
                "side or cash direction settles every negative BUY. The date definitions decide the "
                f"{n(f['ex_after'][0])} flagged corporate actions. The rest is how we work.\n\n"
                "What we know we haven't done yet, and will do next: open the groups we have only counted (the "
                "unexplained breaks, the positions with no trades, the rebooks that keep the old amount, the NAV "
                "fails and vendor flags); then scores with coverage, stress tests and the executive view for "
                "Check-in 3.\n\n"
                "Questions in full: docs/STATUS.md, 'Open questions for faculty' (numbers in brackets in the "
                "table's first column map to it).")
    table(s, ["Topic", "Question"], [[f"{t} ({', '.join(str(i) for i in ids)})", text] for t, ids, text in groups],
          widths=[3.4, 8.7], size=16, row_h=0.85)
    bullets(s, LEFT, Inches(5.7), WIDTH, Inches(1.0), [
        "Next, once cleared: open the groups we have only counted, then scores and stress tests.",
    ])


def b_sensitivities(d):
    f = d.f
    sens = f["sens"]
    # The title and notes name the moves above a thousand and say every REVERSED reading stays below it
    big = {a for a, v in sens.items() if abs(v) >= 1000}
    assert big == {a for a in sens if a.startswith(("copies: both counted", "blanks: zero"))}, \
        f"moves of a thousand or more are now {sorted(big)}: reword backup B1"
    assert all(abs(v) < 1000 for a, v in sens.items() if a.startswith("REVERSED")), "a REVERSED reading moves 1,000+: reword B1"
    s = d.slide("The two biggest moves both copy the book: counting copies twice and counting blanks as zero",
                f"Backup. All {len(sens)} alternative readings, each swapping one step of our chain. Only two move the "
                f"match with the book by more than a thousand positions: counting both copies of a trade "
                f"({signed(f['d_copies'])}) and counting a blank quantity as zero ({signed(f['d_zero'])}). Both copy "
                "what the book seems to do, so a better match there tells us how the book is built, not that the "
                "reading is right. Every REVERSED reading moves fewer than a thousand, so our REVERSED choice barely "
                "changes the result.\n\n"
                "Sources: 02_sensitivities.csv (compared with positions, matched vs main chain).", label="B1")
    height = Inches(5.2)
    picture(s, "11_sensitivities.png", LEFT, BODY_TOP + Inches(0.1), height=height)


def b_r3(d):
    f = d.f
    s = d.slide(f"Reading REVERSED the other way (R3) changes the outcome of {n(f['r3_changed'])} of the "
                f"{n(f['r3_total'])} positions with a reversal",
                f"Backup. Our main reading (R1) keeps the original trade and treats REVERSED as a status. The other "
                f"reading (R3) offsets each original once. We reran the {n(f['r3_total'])} positions that have a "
                f"REVERSED row under R3: {n(f['r3_total'] - f['r3_changed'])} land in the same place. The rest move a "
                "little either way. So the choice matters little for the numbers; what it needs is a contract that "
                "says what REVERSED means (question 1).\n\n"
                "Sources: 02_reversed_side_view.csv.", label="B2")
    rows = [["lands in the same place", n(f["r3_total"] - f["r3_changed"])],
            ["now agrees three ways", n(f["r3_to_agree"])],
            ["now becomes a break", n(f["r3_to_break"])],
            ["now can't be tested", n(f["r3_to_ne"])]]
    if f["r3_other"]:
        rows.append(["moves to another pattern", n(f["r3_other"])])
    table(s, ["Under R3, the position…", f"Positions (of {n(f['r3_total'])})"], rows, widths=[7.0, 5.1], size=18,
          row_h=0.65)


def b_register(d):
    f = d.f
    c = f["status_counts"]
    s = d.slide(f"The register holds {f['findings']} findings: {c.get('confirmed', 0)} confirmed, "
                f"{c.get('unresolved', 0)} unresolved, {c.get('cleared', 0)} cleared",
                "Backup. Every finding is one line in the register, with its rule, where it entered, how many records "
                "it affects out of how many we could test, and example IDs produced by the code. The five classes on "
                "slide 8 are the ones with a full write-up.\n\n"
                "Sources: 02_defect_register.csv (status); docs/FINDINGS.md.", label="B3")
    table(s, ["Status", "Findings", "What it means"], [
        ["Confirmed", n(c.get("confirmed", 0)), "The data proves it: a failed test, matching IDs"],
        ["Unresolved", n(c.get("unresolved", 0)), "It fails a test, but we can't yet prove it is an error"],
        ["Cleared", n(c.get("cleared", 0)), "It looked wrong; a stated rule and independent evidence show it's fine"],
    ], widths=[2.4, 1.8, 7.9], size=18, row_h=0.7)


# --------------------------------------------------------------------------------------------------- checks
ID = re.compile(r"\b(?:ACC|SEC|TXN|CA0|LDG|FND|POS|CMP)\d+")


def shape_text(shape):
    if shape.has_text_frame:
        return [(p, shape.text_frame) for p in shape.text_frame.paragraphs]
    if shape.has_table:
        return [(p, None) for row in shape.table.rows for cell in row.cells for p in cell.text_frame.paragraphs]
    return []


WORDS = []        # (slide, words in its bullets), printed by main()


def check_deck(trace_id):
    prs = Presentation(DECK)
    problems, titles = [], []
    for number, s in enumerate(prs.slides):
        names = [sh.name for sh in s.shapes]
        title = next((sh.text_frame.text for sh in s.shapes if sh.name == "Title"), None)
        if number == 0:
            continue                                                       # the cover
        titles.append(title)
        if not title:
            problems.append(f"slide {number}: no title")
        visuals = [sh for sh in s.shapes if sh.has_table or sh.name in ("Figure", "BigNumber")]
        if len(visuals) != 1:
            problems.append(f"slide {number}: {len(visuals)} visuals")
        for sh in s.shapes:
            if sh.has_table and (len(sh.table.rows) - 1 > 5 or len(sh.table.columns) > 4):
                problems.append(f"slide {number}: table {len(sh.table.rows) - 1}x{len(sh.table.columns)}")
            for p, _ in shape_text(sh):
                for r in p.runs:
                    if r.font.size is not None and r.font.size.pt < MIN_PT:
                        problems.append(f"slide {number}: {r.font.size.pt} pt text {r.text[:30]!r}")
                for match in ID.findall("".join(r.text for r in p.runs)):
                    if match != trace_id:
                        problems.append(f"slide {number}: record ID {match}")
        body = [sh for sh in s.shapes if sh.name == "Bullets"]
        if body:
            paragraphs = [p for p in body[0].text_frame.paragraphs if p.text.strip()]
            words = sum(len(p.text.split()) for p in paragraphs)
            if len(paragraphs) > 3:
                problems.append(f"slide {number}: {len(paragraphs)} bullets")
            WORDS.append((number, words))
            if words > 35:
                problems.append(f"slide {number}: {words} words in the bullets")
        if "Thumbnail" in names and number != 6:
            problems.append(f"slide {number}: unexpected thumbnail")
    return titles, problems


def main():
    f = facts()
    d = Deck(f)
    for build in [cover, s_answer, s_waterfall, s_decisions, s_three_way, s_breaks, s_trace, s_checks, s_catalog,
                  s_corporate_actions, s_questions, b_sensitivities, b_r3, b_register]:
        build(d)
    d.save()
    titles, problems = check_deck(f["trace_id"])
    for i, title in enumerate(titles, 1):
        print(f"{i:>2}. {title}")
    if problems:
        print("\n".join(problems))
        sys.exit("deck check failed")
    print("words in the bullets per slide:", ", ".join(f"{s}: {w}" for s, w in WORDS))
    print(f"wrote {DECK.relative_to(ROOT)} and {NOTES_MD.relative_to(ROOT)}: {len(titles)} slides, deck check passed")


if __name__ == "__main__":
    main()
