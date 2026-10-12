"""Fills the empty Check-in 1 slides of the team deck with editable PowerPoint tables.

Step by step:
1. Open the deck and find each empty slide by its title text.
2. Helper functions draw a table in the deck's own style: Arial, the deck's blue
   (#001AFF) for header rows, thin grey lines between rows, no shading tricks.
3. One function per slide writes its content (control table, stage exits,
   detection model, KPIs, data contracts, operating model and maturity path).
4. A new slide for the stage exits is inserted right after the control table.
5. Short speaker notes are added, and the deck is saved under the name given.
Everything stays editable in PowerPoint or Google Slides, because nothing is a picture.
"""
import copy, io, sys
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.oxml.ns import qn
from lxml import etree

SRC, OUT = sys.argv[1], sys.argv[2]
prs = Presentation(SRC)

BLUE = RGBColor(0x00, 0x1A, 0xFF)      # the blue used in the deck's own boxes
INK = RGBColor(0x1A, 0x1A, 0x1A)
GREY = RGBColor(0x5F, 0x63, 0x68)
LINE = "C9CCD6"                         # thin row separator
LEFT, WIDTH = Emu(600213), Emu(10991574)  # same left edge and width as the diagram on slide 11
LEAD_TOP, TABLE_TOP = Inches(2.02), Inches(2.42)

def find(title):
    """Return the slide whose title text box says `title`."""
    for s in prs.slides:
        for sh in s.shapes:
            if sh.has_text_frame and sh.text_frame.text.strip() == title:
                return s
    raise KeyError(title)

def text_box(slide, x, y, w, h, runs, size=12, color=INK, align=PP_ALIGN.LEFT):
    """Add a text box. `runs` is a list of (text, bold) pieces on one line."""
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame; tf.word_wrap = True
    tf.margin_left = tf.margin_right = 0
    p = tf.paragraphs[0]; p.alignment = align
    for t, bold in runs:
        r = p.add_run(); r.text = t
        r.font.name = "Arial"; r.font.size = Pt(size); r.font.bold = bold; r.font.color.rgb = color
    return tb

def set_border(cell, side, color=LINE, width=6350):
    """Draw one cell border (side = L, R, T or B) as a thin solid line."""
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
    # PowerPoint wants borders before the fill element, so move any fill to the end
    for f in tcPr.findall(qn("a:solidFill")) + tcPr.findall(qn("a:noFill")):
        tcPr.remove(f); tcPr.append(f)

def write(cell, lines, size=10, header=False):
    """Fill a cell. `lines` is a string or a list of (text, style) where style is 'b', 'g' or ''."""
    if isinstance(lines, str):
        lines = [(lines, "b" if header else "")]
    tf = cell.text_frame; tf.word_wrap = True
    cell.margin_left = cell.margin_right = Inches(0.07)
    cell.margin_top = cell.margin_bottom = Inches(0.035)
    cell.vertical_anchor = MSO_ANCHOR.MIDDLE
    for i, (t, style) in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        r = p.add_run(); r.text = t
        r.font.name = "Arial"; r.font.size = Pt(size - (1 if style == "g" else 0))
        r.font.bold = header or style == "b"
        r.font.color.rgb = RGBColor(255, 255, 255) if header else (GREY if style == "g" else INK)
    if header:
        cell.fill.solid(); cell.fill.fore_color.rgb = BLUE
    else:
        cell.fill.background()

def table(slide, header, rows, widths, top=TABLE_TOP, size=10, row_h=0.42, head_h=0.34):
    """Draw a table: blue header row, then plain rows with a thin line under each."""
    scale = WIDTH / Inches(sum(widths))
    shape = slide.shapes.add_table(len(rows) + 1, len(header), LEFT, top, WIDTH,
                                   Inches(head_h + row_h * len(rows)))
    tbl = shape.table
    # switch off the built-in table style so only our formatting shows
    tblPr = tbl._tbl.tblPr
    tblPr.set("firstRow", "0"); tblPr.set("bandRow", "0")
    style = tblPr.find(qn("a:tableStyleId"))
    if style is None:
        style = etree.SubElement(tblPr, qn("a:tableStyleId"))
    style.text = "{2D5ABB26-0587-4C30-8999-92F81FD0307C}"   # "No Style, No Grid"
    for j, w in enumerate(widths):
        tbl.columns[j].width = int(Inches(w) * scale)
    tbl.rows[0].height = Inches(head_h)
    for j, h in enumerate(header):
        write(tbl.cell(0, j), h, size=size, header=True)
        for side in "LRTB":
            set_border(tbl.cell(0, j), side, color=None)
    for i, row in enumerate(rows, 1):
        tbl.rows[i].height = Inches(row_h)
        for j, val in enumerate(row):
            c = tbl.cell(i, j)
            write(c, val, size=size)
            for side in "LRT":
                set_border(c, side, color=None)
            set_border(c, "B", color="001AFF" if i == len(rows) else LINE,
                       width=12700 if i == len(rows) else 6350)
    return tbl

def notes(slide, text):
    slide.notes_slide.notes_text_frame.text = text

def clone_after(slide, title):
    """Make a new slide with the same layout, logo and title box, placed right after `slide`."""
    new = prs.slides.add_slide(slide.slide_layout)
    for ph in list(new.placeholders):
        ph._element.getparent().remove(ph._element)
    for shp in slide.shapes:
        if shp.shape_type == 13 and shp.width < Inches(4):          # the logo
            new.shapes.add_picture(io.BytesIO(shp.image.blob), shp.left, shp.top, shp.width, shp.height)
        elif shp.has_text_frame and shp.name.startswith("Google Shape"):    # the original title box only
            el = copy.deepcopy(shp._element)
            new.shapes._spTree.append(el)
    for shp in new.shapes:
        if shp.has_text_frame and shp.name.startswith("Google Shape"):
            run = shp.text_frame.paragraphs[0].runs[0]
            run.text = title
            for extra in shp.text_frame.paragraphs[0].runs[1:]:
                extra._r.getparent().remove(extra._r)
    ids = prs.slides._sldIdLst
    pos = list(ids).index(next(e for e in ids if prs.slides.get(int(e.get("id"))) is slide))
    el = ids[-1]; ids.remove(el); ids.insert(pos + 1, el)
    return new

# ---------------------------------------------------------------- 1. control table
s = find("Control map")
text_box(s, LEFT, LEAD_TOP, WIDTH, Inches(0.3),
         [("One check at each handoff. ", True),
          ("Each one has a single owner and a clear response when it fails.", False)])
table(s, ["#", "Check", "Where it sits", "What it tests", "If it fails", "Type", "Owner"],
      [["1", "Account check", "Accounts → Transactions",
        "The account exists, is open on the trade date and has a fund and share class",
        "Hold the trade, send it to onboarding", "Preventive", "Account onboarding lead"],
       ["2", "Security check", "Securities → Transactions",
        "The security is in the security list, and the trade's code and currency match it",
        "Hold the trade until the security is set up", "Preventive", "Security master lead"],
       ["3", "Trade check", "Transactions",
        "No duplicates, required fields filled, dates readable, settles within 2 business days (unless agreed), booked before cutoff",
        "Reject, or hold for review", "Preventive", "Trade operations lead"],
       ["4", "Corporate action check", "Transactions",
        "Before the ex-date: terms complete for the event type, and any new security already set up",
        "Quarantine the event until complete", "Preventive", "Corporate actions lead"],
       ["5", "Position check", "Positions",
        "Each holding equals the sum of its trades and matches the custodian; differences explained and aged",
        "Flag a break and work it", "Detective", "Reconciliation lead"],
       ["6", "Price check", "Positions",
        "Every holding has today's price, the vendors agree within 0.5%, one FX rate per currency",
        "Use the next vendor, or flag", "Preventive", "Pricing lead"],
       ["7", "NAV check", "NAV and ledger",
        "Net assets ÷ shares = NAV per share, every account maps to a fund, no serious open issue feeds it",
        "Hold the NAV until resolved", "Preventive", "Fund accounting lead"]],
      widths=[0.35, 1.55, 1.75, 4.0, 2.05, 0.95, 1.6], row_h=0.5)
text_box(s, LEFT, Inches(6.75), WIDTH, Inches(0.3),
         [("Preventive = stops bad data before it moves on. Detective = finds it afterwards. "
           "Owners are roles, not people.", False)], size=9, color=GREY)
notes(s, "This is the table that goes with the map on the slide before. Seven checks, one at each handoff, "
         "and each one has one owner. Most are preventive, so they stop bad data before it moves on. "
         "The position check is detective, because we only know a holding is wrong once we compare it with the custodian.")

# ---------------------------------------------------------------- 2. stage exits (new slide)
s2 = clone_after(s, "Leaving each stage clean")
text_box(s2, LEFT, LEAD_TOP, WIDTH, Inches(0.3),
         [("For each stage: ", True), ("what must be true before data moves on, which check makes sure of it, and who owns it.", False)])
table(s2, ["Stage", "Office", "Data may only leave this stage if...", "Made sure of by", "Owner"],
      [["Accounts", "Front office sets up, back office maps to funds",
        "every account has its required fields, valid open and close dates, and a fund and share class",
        "Account check", "Account onboarding lead"],
       ["Securities", "Middle office",
        "every security exists once, has valid codes and currency, and is set up before anyone trades it",
        "Security check", "Security master lead"],
       ["Transactions", "Front office creates, middle office books",
        "every trade is unique, valid and on time, and every corporate action is complete before its ex-date",
        "Trade check, corporate action check", "Trade operations lead, corporate actions lead"],
       ["Positions", "Middle office",
        "every holding equals its trades, matches the custodian and has a fresh price",
        "Position check, price check", "Reconciliation lead, pricing lead"],
       ["NAV and ledger", "Back office",
        "every fund's NAV adds up and no serious open problem feeds it",
        "NAV check", "Fund accounting lead"]],
      widths=[1.45, 2.2, 4.5, 1.85, 2.2], row_h=0.66)
notes(s2, "The brief also asks what has to be true for data to leave each stage clean. "
          "This is the same seven checks, seen from the stage side instead of the handoff side.")

# ---------------------------------------------------------------- 3. detection-point model
s = find("Detection-point model")
text_box(s, LEFT, LEAD_TOP, WIDTH, Inches(0.3),
         [("For each type of problem: ", True),
          ("the earliest place we can catch it, what we need to see, and what it costs if it slips one stage further.", False)])
D = [
    ("Account problems", "A closed account still trades", "Accounts", "Account check",
     "Required fields; open and close dates vs trade dates",
     "Holdings can't be tied to a fund, so they drop out of the NAV", "To measure at Check-in 2"),
    ("Missing or unknown IDs", "Security not in the list", "Securities", "Security check",
     "Security list vs the IDs used in trades and corporate actions",
     "Trades can't be priced, and every holder of that security is wrong at once",
     "15 unknown securities: 1,131 trades, 0 prices"),
    ("Duplicated trades", "Same trade booked twice", "Transactions", "Trade check",
     "Same trade ID twice, or same account, security, date, quantity and price",
     "Holding overstated, so the value and the NAV are overstated", "To measure at Check-in 2"),
    ("Late or invalid trades", "Misses cutoff, impossible dates", "Transactions", "Trade check",
     "Timestamps vs cutoff; trade and settlement dates",
     "Today's NAV misses the trade, settlement goes wrong",
     "1,124 settle before the trade date; 1,687 dates unreadable"),
    ("Uneven corporate actions", "Spin-off reaches some holders", "Transactions", "Corporate action check",
     "Event terms, new security set up, list of holders",
     "Some accounts right, others wrong; new shares can't be priced",
     "All 23 spin-off targets missing from the security list"),
    ("Positions vs their history", "Book and trades disagree", "Positions", "Position check",
     "Rebuild from trades vs our book vs the custodian",
     "PM trades on wrong holdings; NAV built on wrong quantities",
     "Journey trade: book = rebuild = custodian (2,028)"),
    ("Stale or disputed prices", "Old price, vendors disagree", "Positions", "Price check",
     "Price age, spread between vendors, FX rates",
     "A wrong value goes straight into the NAV", "USD rate never exactly 1 in 30 days"),
    ("NAV that doesn't add up", "Net assets ÷ shares ≠ NAV", "NAV and ledger", "NAV check",
     "Net assets, shares outstanding, NAV per share",
     "Investors buy and sell at the wrong price", "Journey fund adds up; full test at Check-in 2"),
]
table(s, ["Problem type", "Earliest stage", "Evidence needed", "If it slips to the next stage", "What we found in the data"],
      [[[(a, "b"), (b, "g")], [(c, "b"), (d, "g")], e, f, g] for a, b, c, d, e, f, g in D],
      widths=[2.25, 1.75, 2.75, 2.75, 2.5], row_h=0.5, size=9.5)
notes(s, "This is the core of Part One. The rows go in the order data flows, from accounts to the NAV. "
         "The last column is what we already see in the data. The big one is the second row: "
         "securities that were never set up, still traded, and with no price.")

# ---------------------------------------------------------------- 4. KPI framework by office
s = find("KPI framework by office")
text_box(s, LEFT, LEAD_TOP, WIDTH, Inches(0.3),
         [("Seven KPIs, two or three per office. ", True),
          ("Each has a formula, unit, owner, target and the decision it supports.", False)])
tbl = table(s, ["Office", "KPI", "Formula", "Unit", "Target", "Owner", "Dimension", "Decision it supports"],
      [["Front office", "Trades with a valid account and security",
        "Trades with an open account and a known security ÷ all trades", "%", "100%",
        "Trade operations lead", "Validity", "Hold failing trades; fix the account or security first"],
       ["", "Trades booked before cutoff", "Trades booked by cutoff ÷ trades with readable timestamps",
        "%", "≥ 99%", "Trade operations lead", "Timeliness", "Escalate a feed that misses cutoff two days in a row"],
       ["Middle office", "Duplicate trade rate", "Duplicate trades ÷ all trades", "%", "≤ 0.01%",
        "Trade operations lead", "Uniqueness", "Stop and fix the feed that sends duplicates"],
       ["", "Positions matching the custodian", "Holdings where our book = custodian ÷ holdings in both records",
        "%", "≥ 99.9%", "Reconciliation lead", "Consistency", "Staff the break queue; escalate breaks older than 3 days"],
       ["", "Holdings with a fresh, agreed price",
        "Held securities priced today with vendors within 0.5% ÷ held securities", "%", "≥ 99%",
        "Pricing lead", "Completeness", "Challenge the vendors before the NAV is struck"],
       ["Back office", "NAV rows that add up", "Share of fund rows where net assets ÷ shares = NAV",
        "%", "100%", "Fund accounting lead", "Accuracy", "Hold publication of any NAV that fails"],
       ["", "Funds released with no serious open issue",
        "Funds with no open break or price issue above threshold ÷ all funds", "%", "100%",
        "Fund accounting lead", "Consistency", "Hold or caveat the NAV of a fund with open issues"]],
      widths=[1.05, 1.85, 2.75, 0.5, 0.75, 1.45, 1.1, 2.55], row_h=0.5, size=9.5)
for a, b in [(1, 2), (3, 5), (6, 7)]:                     # one office label per group of rows
    tbl.cell(a, 0).merge(tbl.cell(b, 0))
    for r in tbl.cell(a, 0).text_frame.paragraphs:
        for run in r.runs: run.font.bold = True; run.font.color.rgb = BLUE
    tbl.cell(a, 0).vertical_anchor = MSO_ANCHOR.MIDDLE
    for j in range(8):                                    # stronger line between offices
        set_border(tbl.cell(b, j), "B", color="001AFF" if b == 7 else "8F95A3", width=9525)
text_box(s, LEFT, Inches(6.4), WIDTH, Inches(0.55),
         [("Six dimensions covered: validity, timeliness, uniqueness, consistency, completeness, accuracy. "
           "Not scored: precision (handled by the tolerances inside the checks, like the 0.5% vendor spread) and "
           "accessibility (can't be measured from a static extract). Records we can't test are reported separately "
           "and never raise a score. All seven roll up into one platform score, shown next to its coverage.", False)],
         size=9, color=GREY)
notes(s, "Each office gets numbers it recognises. Front office: are our trades valid and on time. "
         "Middle office: duplicates, breaks with the custodian, prices. Back office: does the NAV add up, and is it safe to release. "
         "The last column is the decision each number supports, which the brief asks for in one sentence per KPI.")

# ---------------------------------------------------------------- 5. data contracts
s = find("Data contracts between offices")
text_box(s, LEFT, LEAD_TOP, WIDTH, Inches(0.3),
         [("What each office can demand from the one before it, ", True),
          ("written as tests, so a breach is something we can count.", False)])
table(s, ["Handoff", "The promise (testable)", "It's a breach when", "Checked", "Enforced by"],
      [[[("Accounts → Trades", "b"), ("Onboarding → trade operations", "g")],
        "Every trade's account exists, is open on the trade date and has a fund and share class",
        "Any trade fails", "Every batch", "Account check"],
       [[("Securities → Trades", "b"), ("Security master → trade operations", "g")],
        "Every security on a trade or corporate action exists once in the security list, with the same code and currency",
        "Any trade or event fails", "Every batch", "Security check"],
       [[("Trades → Positions", "b"), ("Trade operations → reconciliation", "g")],
        "Every trade is unique and complete, has readable dates, settles within 2 business days (unless agreed) and is booked before cutoff",
        "Any trade fails; the feed is in breach above 0.5% of a batch", "Every batch", "Trade check"],
       [[("Corporate actions → Positions", "b"), ("Corporate actions → reconciliation", "g")],
        "Each event has complete terms for its type, a written meaning for each date, and any new security set up 2 business days before the ex-date",
        "Any incomplete event", "Every event", "Corporate action check"],
       [[("Custodian and vendors → Positions", "b"), ("Outside sources → middle office", "g")],
        "One custodian record per account and security each day; a price from today for every holding; one FX rate per currency, USD = 1",
        "Any missing record, price or rate", "Daily", "Position and price checks"],
       [[("Positions → NAV", "b"), ("Middle office → back office", "g")],
        "One NAV row per fund and share class per day, where net assets ÷ shares = NAV, with no serious open break feeding it",
        "Any fund row fails", "Daily", "NAV check"]],
      widths=[2.35, 4.6, 2.1, 1.05, 1.9], row_h=0.58, size=9.5)
text_box(s, LEFT, Inches(6.45), WIDTH, Inches(0.45),
         [("Promises we can't test yet, because the data is missing: ", True),
          ("which accounts received each corporate action, the custodian's confirmation that a trade settled, "
           "cash, fees and accruals per fund, and a clear type of change on each trade (new, cancel, reversal).", False)],
         size=9, color=GREY)
notes(s, "A promise only counts if a computer can test it. Each row names the check that enforces it, "
         "and the KPIs on the slide before measure how often it breaks. At the bottom are the promises we'd want in production "
         "but can't test with the data we were given.")

# ---------------------------------------------------------------- 6. operating model and maturity path
s = find("Operating model and maturity path")
text_box(s, LEFT, LEAD_TOP, WIDTH, Inches(0.3),
         [("Worked example: ", True),
          ("spin-off CA00093 created security SEC204363, which was never set up, yet it was traded and held with no price.", False)])
table(s, ["Question", "Our answer"],
      [[[("Scores", "b")], "Produced every day after cutoff by one script and read by each owner the next morning. "
                  "A disputed score is re-run from the written rules with the evidence, never edited by hand."],
       [[("Ownership", "b")], "The corporate actions lead, because the problem entered when the spin-off was set up. "
                     "The security master lead creates the missing security; fund accounting is told for every fund affected."],
       [[("Prioritization", "b")], "Rank by: does it reach a NAV, then how many accounts and funds, then how much money, then how cheap the fix is. "
                          "This one goes first, because it already sits in held positions."],
       [[("Remediation", "b")], "Both: set up the security and correct the holdings already wrong, and change the event intake "
                       "so incomplete events are quarantined. Otherwise it is back with the next spin-off."],
       [[("Prevention", "b")], "Run the corporate action check 2 business days before the ex-date, with an automatic request "
                      "to set up any new security. About 200 events a month, so it is cheap to run."],
       [[("Accountability", "b")], "One ticket per problem with owner, age and exposure, shown on the scorecard. Anything open past "
                          "2 business days goes to management, and fund accounting holds or caveats the NAV."]],
      widths=[1.6, 10.4], row_h=0.4, size=9.5, top=Inches(2.4))
# maturity path, drawn like the step boxes on slide 3: filled box for today, outlined boxes after it
steps = [("1  Reactive", "Problems found after the fact, office by office, in spreadsheets. Nobody owns them.", "Where the data puts us today"),
         ("2  Defined", "Written checks with owners and targets at every handoff, a daily scorecard, problems ticketed.", "What our framework sets up"),
         ("3  Preventive", "Checks sit at the earliest stage and stop bad data before it moves, tested with injected errors.", "Where it can take the firm")]
y, h, gap = Inches(5.55), Inches(0.78), Inches(0.45)
w = int((WIDTH - 2 * gap) / 3)
text_box(s, LEFT, Inches(5.18), WIDTH, Inches(0.3), [("Maturity path", True)], size=12, color=BLUE)
for i, (head, body, label) in enumerate(steps):
    x = LEFT + i * (w + gap)
    box = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, w, h)
    box.line.color.rgb = BLUE; box.line.width = Pt(1.5)
    if i == 0:
        box.fill.solid(); box.fill.fore_color.rgb = BLUE
    else:
        box.fill.background()
    st = box._element.find(qn("p:style"))          # drop the theme style (it adds a shadow)
    if st is not None: box._element.remove(st)
    tf = box.text_frame; tf.vertical_anchor = MSO_ANCHOR.TOP
    tf.margin_top = Inches(0.08); tf.word_wrap = True
    tf.margin_left = tf.margin_right = Inches(0.1)
    fg = RGBColor(255, 255, 255) if i == 0 else INK
    for k, (t, b, sz) in enumerate([(head, True, 11), (body, False, 9.5)]):
        p = tf.paragraphs[0] if k == 0 else tf.add_paragraph()
        p.alignment = PP_ALIGN.LEFT
        r = p.add_run(); r.text = t
        r.font.name = "Arial"; r.font.size = Pt(sz); r.font.bold = b; r.font.color.rgb = fg
    text_box(s, x, y + h + Inches(0.04), w, Inches(0.25), [(label, False)], size=9, color=GREY, align=PP_ALIGN.CENTER)
    if i < 2:
        arrow = s.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, x + w + Inches(0.1), y + h / 2 - Inches(0.1),
                                   gap - Inches(0.2), Inches(0.2))
        arrow.fill.solid(); arrow.fill.fore_color.rgb = BLUE; arrow.line.fill.background()
        st = arrow._element.find(qn("p:style"))
        if st is not None: arrow._element.remove(st)
notes(s, "The brief asks for one worked example walked through all five questions, so we use the spin-off. "
         "The first row answers who makes the scores and how disputes are settled. "
         "At the bottom: today the data looks reactive, since nothing stopped those trades. Our framework gets the firm to step two, "
         "and moving checks to the earliest stage gets it to step three.")

prs.save(OUT)
print("saved", OUT, "slides:", len(prs.slides))
