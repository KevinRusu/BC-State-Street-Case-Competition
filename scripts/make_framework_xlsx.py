"""Builds docs/Framework.xlsx: the simplified Check-in 1 framework, one tab per piece."""
import json, sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

F = json.load(open(__import__("os").path.join(__import__("os").path.dirname(__file__), "framework.json")))
OUT = sys.argv[1]
NAVY, PALE, GRID = "1F3A5F", "EEF2F6", "D5DAE1"
HFONT = Font(name="Arial", bold=True, color="FFFFFF", size=11)
BFONT = Font(name="Arial", size=10)
TFONT = Font(name="Arial", bold=True, size=14, color=NAVY)
NFONT = Font(name="Arial", italic=True, size=10, color="5A6270")
FILL = PatternFill("solid", fgColor=NAVY)
ALT = PatternFill("solid", fgColor=PALE)
BORDER = Border(bottom=Side(style="thin", color=GRID))
WRAP = Alignment(wrap_text=True, vertical="top")

wb = Workbook()
wb.remove(wb.active)

def tab(name, title, note, headers, rows, widths):
    ws = wb.create_sheet(name)
    ws["A1"] = title; ws["A1"].font = TFONT
    ws["A2"] = note; ws["A2"].font = NFONT
    for c, h in enumerate(headers, 1):
        cell = ws.cell(4, c, h); cell.font = HFONT; cell.fill = FILL; cell.alignment = WRAP
    for r, row in enumerate(rows, 5):
        for c, v in enumerate(row, 1):
            cell = ws.cell(r, c, v); cell.font = BFONT; cell.alignment = WRAP; cell.border = BORDER
            if (r - 5) % 2 == 1: cell.fill = ALT
    for i, w in enumerate(widths):
        ws.column_dimensions[chr(65 + i)].width = w
    ws.freeze_panes = "A5"
    return ws

# README
ws = wb.create_sheet("README")
lines = [
    ("Framework workbook (Check-in 1)", TFONT),
    ("Simplified version, 11 Oct 2026. Replaces the earlier spine workbook (kept in docs/archive/).", NFONT),
    ("", BFONT),
    ("What this is", Font(name="Arial", bold=True, size=11, color=NAVY)),
    ("One tab for each piece the brief asks for at Check-in 1. Plain words, no codes. The slides use exactly the same content.", BFONT),
    ("", BFONT),
    ("The framework in one sentence", Font(name="Arial", bold=True, size=11, color=NAVY)),
    ("Data moves through 5 stages and 3 offices; at each of the 6 handoffs we place a check with one owner, so a problem is caught where it enters instead of in the NAV.", BFONT),
    ("", BFONT),
    ("Tabs", Font(name="Arial", bold=True, size=11, color=NAVY)),
    ("1_Offices_Stages: who does what, and what must be true before data leaves each stage", BFONT),
    ("2_Handoffs: the 6 places where data moves from one stage to the next", BFONT),
    ("3_Checks: the 7 checks (control table): what each tests, what happens if it fails, who owns it", BFONT),
    ("4_Detection: for each type of problem, the earliest stage to catch it and the cost of missing it (core of Part One)", BFONT),
    ("5_Journey: one real trade and one real security followed through the tables", BFONT),
    ("6_KPIs: 7 numbers the offices track, each with formula, unit, owner, target and decision", BFONT),
    ("7_Promises: what each office can demand from the one before it (data contracts), plus the data we are missing", BFONT),
    ("8_Operating_Model: what happens after a problem is found, using our real example", BFONT),
    ("", BFONT),
    ("Counts", Font(name="Arial", bold=True, size=11, color=NAVY)),
    ("3 offices · 5 stages · 6 handoffs · 7 checks · 8 problem types · 7 KPIs · 6 promises · 4 missing data items", BFONT),
]
for i, (t, f) in enumerate(lines, 1):
    ws.cell(i, 1, t).font = f
    ws.cell(i, 1).alignment = Alignment(wrap_text=True, vertical="top")
ws.column_dimensions["A"].width = 120

st_names = [s["stage"] for s in F["stages"]]
tab("1_Offices_Stages", "Offices and stages",
    "Three offices only. Outside sources (custodian, price vendors, FX) send us data; they are not offices.",
    ["Stage", "Office", "Tables in our data", "Data may move on only if..."],
    [[s["stage"], s["office"], s["table"], s["exit"]] for s in F["stages"]], [18, 34, 36, 70])
ws = wb["1_Offices_Stages"]
r = ws.max_row + 2
ws.cell(r, 1, "Offices").font = Font(name="Arial", bold=True, size=11, color=NAVY)
for i, o in enumerate(F["offices"]):
    ws.cell(r + 1 + i, 1, o["office"]).font = Font(name="Arial", bold=True, size=10)
    ws.cell(r + 1 + i, 2, o["who"]).font = BFONT
    ws.cell(r + 1 + i, 4, o["does"]).font = BFONT
r = r + 5
ws.cell(r, 1, "Outside sources").font = Font(name="Arial", bold=True, size=11, color=NAVY)
for i, o in enumerate(F["outside"]):
    ws.cell(r + 1 + i, 1, o["source"]).font = Font(name="Arial", bold=True, size=10)
    ws.cell(r + 1 + i, 4, o["gives"]).font = BFONT
ws.cell(r + 5, 1, F["reader"]).font = NFONT

tab("2_Handoffs", "The 6 handoffs", "A handoff is where data moves from one stage to the next. Each one has a check (tab 3) and a promise (tab 7).",
    ["#", "Handoff", "From", "To", "What must hold"],
    [[h["n"], h["plain"], h["from"], h["to"], h["what"]] for h in F["handoffs"]], [5, 34, 16, 16, 70])

tab("3_Checks", "The 7 checks (control table)", "One row per check. Preventive = stops bad data before it moves; detective = finds it afterwards.",
    ["#", "Check", "Where", "What it tests", "If it fails", "Preventive / detective", "Owner", "Office"],
    [[c["n"], c["check"], c["stage"], c["tests"], c["fail"], c["type"], c["owner"], c["office"]] for c in F["checks"]],
    [5, 22, 24, 60, 30, 14, 24, 16])

tab("4_Detection", "Detection-point model (core of Part One)",
    "For each type of problem: the earliest stage that can catch it, the evidence needed, and what happens if it slips to the next stage.",
    ["#", "Problem type", "Example", "Earliest stage to catch it", "Check there", "Evidence needed", "If missed", "Testable in our data?", "First evidence in our data"],
    [[d["n"], d["defect"], d["example"], st_names[d["earliest"]], d["check"], d["evidence"], d["missed"], d["testable"], d["data"]] for d in F["defects"]],
    [5, 26, 30, 16, 20, 34, 34, 12, 34])

journey = [
    ["Trade", 1, "The trade", "transactions", "TXN100000380: BUY 1,612 at 254.8034 USD, gross 410,743.08, trade 1 Jun, settle 2 Jun, BOOKED, OMS_FRONT", "Clean: quantity x price = gross, T+1, unique ID", "Observed", "Trade check"],
    ["Trade", 2, "Timestamps", "pipeline_events", "Received 09:24 (+21 min), booked 09:28, published 09:33, cutoff 18:00", "On time and in order", "Observed", "Trade check"],
    ["Trade", 3, "Account and security", "accounts, securities", "ACC6309061 open since 2017, fund FND00150 class A; SEC937640 USD equity", "Account open; security known; code and currency match", "Observed", "Account check; Security check"],
    ["Trade", 4, "The holding", "positions", "4 booked trades: +1,612 -4,034 +785 +3,665 = 2,028; book says 2,028", "Matches. Rebuild dips to -2,422 in June: a look-alike from the zero-opening rule, to clear", "Observed", "Position check"],
    ["Trade", 5, "The custodian", "comparison_positions", "Custodian says 2,028", "No break", "Observed", "Position check"],
    ["Trade", 6, "Price and FX", "prices, fx_rates", "10 Jul: 248.52 / 248.78 / 249.62; USD rate 0.995917", "Vendors within 0.44%; open question: USD rate is never exactly 1", "Observed", "Price check"],
    ["Trade", 7, "Fund NAV", "ledger_nav", "FND00150 class A: 40,777,112.07 / 3,594,046.98 = 11.345737", "NAV adds up; this position's share of the fund is inferred", "Inferred", "NAV check"],
    ["Trade", "Gap", "Where evidence stops", "", "", "No proof the trade settled; no cash or fees to rebuild net assets", "", "Missing: settlement confirmation; cash, fees and accruals"],
    ["Security", 1, "The security", "securities", "SEC937640: CUSIP HAQBJOMG7, USD equity, XNYS", "Complete and unique", "Observed", "Security check"],
    ["Security", 2, "Its reach", "transactions, positions", "309 trades, 107 accounts, 94 funds", "One record feeds 94 fund NAVs (blast radius)", "Observed", "Security check"],
    ["Security", 3, "Its spin-off", "corporate_actions", "CA00093 spin-off, ex 11 Jun, effective 18 Jun, new security SEC204363", "The new security was never set up in the security list", "Observed", "Corporate action check"],
    ["Security", 4, "The new security", "transactions, positions, comparison_positions, prices", "SEC204363: 64 trades, 63 positions, 63 at the custodian, 0 prices", "Held but cannot be valued", "Observed", "Security check (would have held the trades)"],
    ["Security", "Gap", "Where evidence stops", "", "", "No record of which accounts received the spin-off", "", "Missing: corporate action log per account"],
]
tab("5_Journey", "Data journey: one trade and one security", "Observed = we saw the link in the data (matching IDs). Inferred = our reasoning. Gap = where the data stops.",
    ["Journey", "Step", "What", "Table", "Real record IDs and values", "What it shows", "Observed / inferred", "Check that applies"],
    journey, [10, 6, 20, 24, 50, 46, 12, 30])

ws = tab("6_KPIs", "KPIs by office", "Each KPI: formula with its denominator, unit, owner, target, and the decision it supports. Missing or untestable records are reported separately and never raise a score.",
    ["#", "Office", "KPI", "Formula", "Unit", "Target", "Owner", "Quality dimension", "Leading / lagging", "Decision it supports"],
    [[k["n"], k["office"], k["kpi"], k["formula"], k["unit"], k["target"], k["owner"], k["dimension"], k["kind"], k["decision"]] for k in F["kpis"]],
    [5, 16, 30, 50, 6, 20, 22, 14, 12, 42])
ws.cell(ws.max_row + 2, 1, "Dimensions covered: validity, timeliness, uniqueness, consistency, completeness, accuracy (6). " + F["excluded_dimensions"]).font = NFONT
ws.cell(ws.max_row + 1, 1, F["rollup"]).font = NFONT

ws = tab("7_Promises", "Promises between offices (data contracts)", "Each promise is a condition a computer can test, so a breach becomes a measurable event.",
    ["#", "Handoff", "The promise", "Breach =", "Checked", "Enforced by", "Measured by"],
    [[p["n"], p["handoff"], p["promise"], p["breach"], p["checked"], p["check"], p["kpi"]] for p in F["promises"]],
    [5, 28, 64, 26, 12, 24, 36])
r = ws.max_row + 2
ws.cell(r, 1, "Missing data (where evidence stops: we name it instead of guessing)").font = Font(name="Arial", bold=True, size=11, color=NAVY)
for i, m in enumerate(F["missing"]):
    ws.cell(r + 1 + i, 2, m["what"]).font = Font(name="Arial", bold=True, size=10)
    ws.cell(r + 1 + i, 3, m["why"]).font = BFONT

ws = tab("8_Operating_Model", "Operating model: what happens after a problem is found",
    "Worked example: spin-off CA00093 created SEC204363, which was never set up, yet is traded and held with no price. File-wide: 15 such securities, 1,118 positions, 1,131 trades, 0 prices.",
    ["Question", "Our answer"], [[o["q"], o["a"]] for o in F["operating_model"]] + [["Scores", F["scores"]]] + [[m["step"], m["text"]] for m in F["maturity"]],
    [18, 110])

wb.save(OUT)
print("saved", OUT)
