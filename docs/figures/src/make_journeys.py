"""Writes two Graphviz files: journey of trade TXN100000380 and of security SEC937640."""
import subprocess, sys
out = sys.argv[1]

def node(nid, hop, table, lines, ctrl, color="#2A7F75", fill="white"):
    body = "".join(f'<tr><td align="left">{l}</td></tr>' for l in lines)
    return (f'{nid} [label=<<table border="1" cellborder="0" cellpadding="3" bgcolor="{fill}" color="{color}">'
            f'<tr><td bgcolor="{color}"><font color="white"><b>{hop}</b></font></td></tr>'
            f'<tr><td><b>{table}</b></td></tr>{body}'
            f'<tr><td align="left"><font color="#1F3A5F"><b>Control: {ctrl}</b></font></td></tr></table>>];')

def gap(nid, title, lines):
    body = "<br/>".join(lines)
    return (f'{nid} [shape=box, style="rounded,dashed", color="#C0392B", fontcolor="#C0392B", penwidth=1.6, '
            f'label=<<b>{title}</b><br/>{body}>];')

HEAD = ('digraph j {{ graph [splines=true, outputorder=edgesfirst, fontname="Helvetica", labelloc=t, fontsize=20, nodesep=0.6, ranksep=0.55, pad=0.25, '
        'label=<<b>{t}</b><br/><font point-size="13">{s}</font>>];\n'
        'node [shape=plaintext, fontname="Helvetica", fontsize=13]; edge [color="#2A7F75", penwidth=2, fontname="Helvetica", fontsize=12];\n')

trade = HEAD.format(t="Journey 1: one trade, TXN100000380, from capture to NAV",
                    s="solid arrow = observed key match in the data · dashed = inferred · red box = where evidence stops (missing contract)")
trade += "\n".join([
    node("t1", "1 Source (S3)", "transactions", ["TXN100000380 · BOOKED · OMS_FRONT", "BUY 1,612 @ 254.8034 USD",
         "gross 410,743.08 = qty x price", "trade 2026-06-01 · settle 06-02 (T+1)"], "C05 C06"),
    node("t2", "2 Pipeline (H3)", "pipeline_events", ["batch B2026060109", "received 09:24 (+21 min)", "booked 09:28 (+4 min)",
         "published 09:33 · cutoff 18:00"], "C08 C09"),
    node("t3", "3 Master data (H1, H2)", "accounts + securities", ["ACC6309061 · OPEN since 2017-08-30", "fund FND00150 · class A · base EUR",
         "SEC937640 · USD equity · XNYS", "CUSIP and currency match master"], "C01 C04"),
    node("t4", "4 Position (H4)", "positions vs rebuild", ["POS497440414 · qty 2,028 · count 4", "+1,612 -4,034 +785 +3,665 = 2,028",
         "running total dips to -2,422", "(zero-opening look-alike, to clear)"], "C10"),
    node("t5", "5 Custodian (H6)", "comparison_positions", ["CMP498061294 · qty 2,028", "book = custodian: no break"], "C13"),
    node("t6", "6 Valuation (H7)", "prices + fx_rates", ["10 Jul: A 248.52 · B 248.78 · C 249.62", "vendor spread 0.44% (&lt; 0.5%)",
         '<font color="#C0392B">USD rate_to_usd 0.995917 (≠ 1: flag)</font>'], "C14 C15 C16", color="#C98A10"),
    node("t7", "7 Downstream (H8)", "ledger_nav", ["LDG0000597 · FND00150 class A", "40,777,112.07 / 3,594,046.98", "= NAV 11.345737 (holds)"], "C17 C19"),
    gap("g1", "Gap → K12", ["settlement_date is scheduled only:", "no proof the trade settled"]),
    gap("g2", "Gap → K14", ["no cash, accruals, fees or", "account allocation: cannot show", "this position inside net_assets"]),
    "t1 -> t2 [label=\"transaction_id\"]; t2 -> t3 [label=\"account_id,\\nsecurity_id\"]; t3 -> t4 [label=\"account +\\nsecurity\"];",
    "t4 -> t5 [label=\"full outer\\njoin\"]; t5 -> t6 [label=\"security_id\\n+ date\"]; t6 -> t7 [label=\"fund_id +\\nshare_class\", style=dashed];",
    "t5 -> g1 [style=dashed, color=\"#C0392B\"]; t7 -> g2 [style=dashed, color=\"#C0392B\"];",
    "__POS_T__",
    "}"])

sec = HEAD.format(t="Journey 2: one master record, security SEC937640, and the spin-off it triggered",
                  s="one master record feeds 309 trades, 107 accounts and 94 fund NAVs · the spin-off target was never mastered but is held anyway")
sec += "\n".join([
    node("s1", "1 Master data (S2)", "securities", ["SEC937640 · CUSIP HAQBJOMG7", "ISIN USHAQBJOMG73 (embeds CUSIP)", "USD equity · XNYS · issuer GB"], "C03"),
    node("s2", "2 Used in trades (H2)", "transactions", ["309 trades", "107 accounts"], "C04"),
    node("s3", "3 Held (S4)", "positions", ["107 positions on 10 Jul", "in 94 different funds", "= blast radius of 1 record"], "C13"),
    node("s4", "4 Valued (H7)", "prices", ["3 vendors daily", "spread 0.44% on 10 Jul"], "C15"),
    node("s5", "5 Corporate action (H5)", "corporate_actions", ["CA00093 · SPINOFF", "ex 2026-06-11 · effective 06-18", "ratio 1.0 · cash_rate 1.0532",
         "target SEC204363"], "C11", color="#C98A10"),
    node("s6", "6 Target (S2 → S4)", "SEC204363", ['<font color="#C0392B"><b>NOT in securities</b></font>', "64 trades · 63 book positions",
         "63 custodian positions (agree)", '<font color="#C0392B"><b>0 price quotes: cannot be valued</b></font>'], "none fired", color="#C0392B", fill="#FDF1F0"),
    gap("g3", "Gap → K11", ["no per-account posting log:", "cannot prove who received", "the spin-off, or should have"]),
    gap("g4", "File-wide (notebook step 10)", ["all 23 spin-off targets unmastered", "15 held: 1,118 positions,", "1,131 trades, 0 prices"]),
    "s1 -> s2 [label=\"security_id\"]; s2 -> s3 [label=\"account +\\nsecurity\"]; s3 -> s4 [label=\"security_id\\n+ date\"];",
    "s1 -> s5 [label=\"security_id\", constraint=false];  s5 -> s6 [label=\"target_security_id\\n(no match in master)\", color=\"#C0392B\"];",
    "s6 -> g3 [style=dashed, color=\"#C0392B\"]; s6 -> g4 [style=dashed, color=\"#C0392B\"];",
    "__POS_S__",
    "}"])

X, Y = 385, 240
def pos(m): return " ".join(f'{k} [pos="{c*X},{-r*Y}!"];' for k, (c, r) in m.items())
trade = trade.replace("__POS_T__", pos({"t1":(0,0),"t2":(1,0),"t3":(2,0),"t4":(3,0),"t5":(3,1),"t6":(2,1),"t7":(1,1),"g2":(0,1),"g1":(3,1.62)}))
sec = sec.replace("__POS_S__", pos({"s1":(0,0),"s2":(1,0),"s3":(2,0),"s4":(3,0),"s5":(0,1),"s6":(1,1),"g3":(2,1),"g4":(3,1)}))
for name, src in [("04_journey_trade", trade), ("05_journey_security", sec)]:
    open(f"{name}.dot", "w").write(src)
    subprocess.run(["dot", "-Kneato", "-n2", "-Tpng", "-Gdpi=150", f"{name}.dot", "-o", f"{out}/{name}.png"], check=True)
    print("ok", name)
