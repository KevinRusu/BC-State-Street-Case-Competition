"""Meaningful identity, conservation, look-alike and shuffled-fixture checks."""
import copy
import csv
import gzip
import hashlib
import json
from pathlib import Path
import random
import shutil
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_findings as report
from findings import STATUSES, aggregate, build_findings, deduplicate_findings


def example(**changes):
    base = {"analysis_snapshot":"2026-07-10","population":"holdings","entity_key":"same-holding","check_id":"missing_security","category":"master","status":STATUSES[0]}
    return {**base, **changes}


class FindingIdentityTests(unittest.TestCase):
    def test_reingesting_same_finding_is_idempotent(self):
        f = example()
        self.assertEqual(deduplicate_findings([f, dict(f)]), [f])

    def test_two_checks_are_two_flags_but_one_affected_entity(self):
        findings = [example(), example(check_id="no_vendor_coverage", category="pricing")]
        counts, entities = aggregate(findings + findings)
        self.assertEqual(sum(counts.values()), 2)
        self.assertEqual(len(entities["holdings"]), 1)

    def test_conflicting_status_on_same_finding_is_rejected(self):
        with self.assertRaises(ValueError):
            deduplicate_findings([example(),example(status=STATUSES[1])])

    def test_population_identity_is_not_combined(self):
        _, entities = aggregate([example(),example(population="transaction_rows")])
        self.assertEqual(len(entities),2)


def write_fixture(root, shuffle=False, with_terms=True):
    (root/"data").mkdir()
    (root/"config").mkdir()
    for name in ("findings.json","exploration.toml"):
        shutil.copyfile(ROOT/"config"/name,root/"config"/name)
    # The assessment notebook sits where config/findings.json says (notebooks/additional/ since D-060).
    notebook=json.loads((ROOT/"config/findings.json").read_text(encoding="utf-8"))["assessment_notebook"]
    nb=json.loads((ROOT/notebook).read_text(encoding="utf-8"))
    if not with_terms:
        nb["cells"]=[c for c in nb["cells"] if "GUIDE_FIELD_USE =" not in "".join(c.get("source",[]))]
    (root/notebook).parent.mkdir(parents=True)
    (root/notebook).write_text(json.dumps(nb),encoding="utf-8")
    columns={}
    for name in ["transactions","pipeline_events","positions","comparison_positions","accounts","securities","corporate_actions","prices","fx_rates"]:
        with gzip.open(ROOT/f"data/{name}.csv.gz","rt",encoding="utf-8",newline="") as stream:
            columns[name]=next(csv.reader(stream))
    def transaction(identifier, **kw):
        return dict(transaction_id=identifier,account_id="ACCOUNT_A",security_id="SEC_A",cusip="TEST",transaction_type="BUY",trade_date="2026-06-03",settlement_date="2026-06-04",quantity="10",price="5",currency="USD",gross_amount="50",status="BOOKED",related_transaction_id="",source_system="FIXTURE",event_timestamp="2026-06-03 10:00:00",settlement_note="") | kw
    tx=[transaction("NORMAL"),transaction("EXACT"),transaction("EXACT"),transaction("FORMAT"),transaction("FORMAT",trade_date="03/06/2026"),transaction("CONFLICT",quantity="6"),transaction("CONFLICT",quantity="7"),transaction("BAD",quantity="-3",settlement_date="2026-06-02",status="CANCELLED",related_transaction_id="ABSENT"),transaction("CANCELLED",quantity="4",gross_amount="20",status="CANCELLED"),transaction("REBOOK",quantity="8",gross_amount="20",related_transaction_id="CANCELLED"),transaction("REV_A",status="REVERSED",related_transaction_id="NORMAL"),transaction("REV_B",status="REVERSED",related_transaction_id="NORMAL"),transaction("ORPHAN",security_id="SEC_NEW",quantity="5"),transaction("BLANK",quantity="",settlement_date="")]
    def holding(identifier,account,security,quantity):
        return dict(position_id=identifier,account_id=account,security_id=security,quantity=quantity,transaction_count="1",as_of_date="2026-07-10",source="BOOK")
    records={
        "transactions":tx,
        "pipeline_events":[dict(transaction_id=t["transaction_id"],event_timestamp=t["event_timestamp"],received_timestamp="2026-06-03 10:01:00",booked_timestamp="2026-06-03 10:02:00",published_timestamp="2026-06-03 10:03:00",cutoff_timestamp="2026-06-03 18:00:00",source_system="FIXTURE",batch_id="BATCH") for t in tx],
        "positions":[holding("H1","ACCOUNT_A","SEC_A","99"),holding("H2","ACCOUNT_A","SEC_NEW","5"),holding("H3","ACCOUNT_MISSING","SEC_A","2")],
        "comparison_positions":[dict(comparison_id="C1",account_id="ACCOUNT_A",security_id="SEC_A",quantity="98",as_of_date="2026-07-10",source="CUSTODIAN"),dict(comparison_id="C2",account_id="ACCOUNT_A",security_id="SEC_NEW",quantity="5",as_of_date="2026-07-10",source="CUSTODIAN")],
        "accounts":[dict(account_id="ACCOUNT_A",fund_id="FUND",share_class="A")],
        "securities":[dict(security_id="SEC_A",currency="USD")],
        "corporate_actions":[dict(action_id="SPIN",security_id="SEC_A",action_type="SPINOFF",target_security_id="SEC_NEW",ex_date="2026-06-05",effective_date="2026-06-04",ratio="0.1",cash_rate="1"),dict(action_id="MERGE",security_id="SEC_A",action_type="MERGER",target_security_id="",ex_date="2026-06-04",effective_date="2026-06-05",ratio="2",cash_rate="")],
        "prices":[dict(security_id="SEC_A",price_date="2026-07-10",vendor="PREFERRED",price="5",currency="USD",price_timestamp="2026-07-10 12:00:00",vendor_priority="1"),dict(security_id="SEC_A",price_date="2026-07-09",vendor="SECOND",price="5",currency="NO_FX",price_timestamp="2026-07-09 12:00:00",vendor_priority="2")],
        "fx_rates":[dict(currency="USD",rate_date="2026-07-10",rate_to_usd="1.01")],
    }
    manifest=[]
    for name,rows in records.items():
        rows=copy.deepcopy(rows)
        if shuffle: random.Random(20).shuffle(rows)
        path=root/f"data/{name}.csv.gz"
        with gzip.open(path,"wt",encoding="utf-8",newline="") as stream:
            writer=csv.DictWriter(stream,fieldnames=columns[name],extrasaction="ignore")
            writer.writeheader();writer.writerows(rows)
        manifest.append(dict(table=name,file=f"data/{name}.csv.gz",rows=len(rows),columns=len(columns[name]),bytes=path.stat().st_size,sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
    with (root/"manifest.csv").open("w",encoding="utf-8",newline="") as stream:
        writer=csv.DictWriter(stream,fieldnames=list(manifest[0]));writer.writeheader();writer.writerows(manifest)


class EndToEndFixtureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory()
        cls.base=Path(cls.temp.name)
        cls.outputs=[]
        for name,shuffle,terms in [("ordered",False,True),("shuffled",True,True),("missing_terms",False,False)]:
            root=cls.base/name;root.mkdir();write_fixture(root,shuffle,terms)
            cls.outputs.append(build_findings(root,root/"outputs"))

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_shuffle_does_not_change_aggregate_findings(self):
        first,second=(aggregate(f)[0] for f,m in self.outputs[:2])
        self.assertEqual(first,second)

    def test_defect_and_legitimate_lookalike(self):
        findings,_=self.outputs[0]
        by_check={c:{json.loads(f["evidence"]).get("transaction_id") for f in findings if f["check_id"]==c} for c in ["negative_quantity","settlement_before_trade","broken_correction"]}
        for detected in by_check.values():
            self.assertIn("BAD",detected)
            self.assertNotIn("NORMAL",detected)
        # Accepted slash-format dates are not flagged as invalid transaction data.
        self.assertTrue(all("FORMAT" not in ids for ids in by_check.values()))

    def test_duplicate_group_is_one_case_with_two_evidence_rows(self):
        findings,_=self.outputs[0]
        for check in ["exact_duplicates","format_duplicates","conflicting_duplicates"]:
            cases=[f for f in findings if f["check_id"]==check]
            self.assertEqual(len(cases),1)
            self.assertEqual(len(json.loads(cases[0]["raw_row_lineage"])),2)

    def test_one_transaction_can_contribute_three_flags(self):
        findings,_=self.outputs[0]
        bad=[f for f in findings if json.loads(f["evidence"]).get("transaction_id")=="BAD"]
        self.assertEqual(len(bad),3)
        self.assertEqual(len({f["entity_key"] for f in bad}),1)

    def test_status_splits_and_category_links_conserve_counts(self):
        for findings,metadata in self.outputs:
            counts,entities=aggregate(findings)
            self.assertEqual(sum(counts.values()),len(findings))
            for c in metadata["checks"]:
                actual=sum(n for (p,cat,cid,s),n in counts.items() if cid==c["id"])
                if c["available"]: self.assertEqual(actual,c["flag_count"])
            for pop,m in metadata["populations"].items():
                self.assertEqual(m["affected_entities"],len(entities.get(pop,set())))

    def test_missing_assessment_defaults_to_unresolved(self):
        findings,_=self.outputs[0]
        cust=[f for f in findings if f["check_id"]=="custodian_disagreement"]
        self.assertTrue(cust)
        self.assertTrue(all(f["assessment_defaulted"] and f["status"]==STATUSES[1] for f in cust))

    def test_unsupported_terms_check_is_unavailable_not_zero(self):
        _,metadata=self.outputs[2]
        check=next(c for c in metadata["checks"] if c["id"]=="questionable_terms")
        self.assertFalse(check["available"])
        self.assertIsNone(check["flag_count"])


class StressSectionTests(unittest.TestCase):
    """docs/FINDINGS.md's generated Stress test section: read from the 03_stress_* outputs, never typed."""

    def write(self, root, name, header, rows):
        with (root / name).open("w", encoding="utf-8", newline="") as stream:
            writer = csv.writer(stream, lineterminator="\n")
            writer.writerow(header)
            writer.writerows(rows)

    def fill(self, root):
        self.write(root, "03_stress_rates.csv", ["role", "level", "cases", "share", "drawn", "wanted"],
                   [["defect", "caught", "29", "0.9667", "30", "30"], ["defect", "missed", "1", "0.0333", "30", "30"],
                    ["flip", "", "0", "", "0", "30"],
                    ["untouched", "false positive", "2", "", "", ""], ["untouched", "unattributable", "3", "", "", ""]])
        impact_head = ["case", "role", "security_id", "fund_id", "signed_usd", "gross_usd", "fund_net_assets_usd",
                       "signed_bps", "gross_bps", "not_valued_reason", "source", "measure", "before", "after"]
        self.write(root, "03_stress_impact.csv", impact_head,
                   [["defect-01", "defect", "SEC1", "", "100.0", "100.0", "", "", "", "no fund", "stress", "", "", ""],
                    ["defect-01", "defect", "SEC1", "FND1", "-40.0", "40.0", "1000", "-400.0", "400.0", "", "stress", "", "", ""],
                    ["defect-02", "defect", "SEC2", "FND2", "10.0", "10.0", "1000", "100.0", "100.0", "", "stress", "", "", ""],
                    ["flip-01", "flip", "SEC3", "FND3", "5.0", "5.0", "1000", "50.0", "50.0", "", "stress", "", "", ""],
                    ["look-01", "lookalike", "SEC4", "FND4", "0.0", "0.0", "1000", "0.0", "0.0", "", "stress", "", "", ""],
                    ["", "", "", "", "", "", "", "", "", "", "deliverable", "platform score", "81.6", "81.5"],
                    ["", "", "", "", "", "", "", "", "", "", "deliverable", "gross delta", "", "99.5"],
                    ["", "", "", "", "", "", "", "", "", "", "deliverable", "scale flag: gross_delta_usd_valued_subset",
                     "0", "574164563792.7428"]])
        self.write(root, "03_stress_cases.csv",
                   ["case", "role", "security_id", "bad_vendor", "swap_with", "verdict_line", "level", "joined", "left",
                    "consequences", "snapshot_quotes", "showcase"],
                   [["defect-01", "defect", "SEC1", "VENDOR_A", "", "Odd one out", "caught", "x", "", "",
                     "VENDOR_A=5.00; VENDOR_B=5.01; VENDOR_C=4.99", "True"],
                    ["defect-02", "defect", "SEC2", "VENDOR_B", "", "Odd one out", "caught", "x", "", "", "", "False"],
                    ["look-01", "lookalike", "SEC4", "VENDOR_B", "", "Backed", "cleared", "y", "", "",
                     "VENDOR_A=3.00; VENDOR_B=3.00", "True"]])
        self.write(root, "03_stress_changes.csv", ["case", "role", "security_id", "vendor", "field", "old", "new"],
                   [["defect-01", "defect", "SEC1", "VENDOR_A", "price", "5.00", "500.00"],
                    ["flip-01", "flip", "SEC3", "VENDOR_A", "price", "7.00", "700.00"],
                    ["flip-01", "flip", "SEC3", "VENDOR_A", "vendor_priority", "1", "2"],
                    ["flip-01", "flip", "SEC3", "VENDOR_B", "vendor_priority", "2", "1"],
                    ["defect-02", "defect", "SEC2", "VENDOR_B", "price", "9.00", "900.00"],
                    ["look-01", "lookalike", "SEC4", "VENDOR_B", "price", "3.00", "300.00"]])
        self.write(root, "03_stress_unexplained.csv", ["source", "scope", "kind", "finding", "record_id", "security_id",
                                                        "change", "file", "rows_changed", "detail"], [])
        self.write(root, "03_stress_run.csv", ["item", "value"],
                   [["config path", "config/reconciliation.toml"], ["labels sha256", "c768055d64f341b8a9f676d981844cf85a6ad19b2d23d2400fadd40d21958023"],
                    ["seed", "20261111"], ["finished at", "2026-11-11T10:00:00Z"]])

    def test_section_shows_rates_impact_and_showcase(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            self.fill(root)
            text = "\n".join(report.stress_lines(root))
        self.assertIn("## Stress test", text)
        for name in ("rates", "impact", "cases", "changes", "unexplained", "members"):
            self.assertIn(f"03_stress_{name}.csv", text)
        self.assertIn("| defect | caught | 29 | 96.7% |", text)
        self.assertIn("| flip | none drawn | 0 |", text)
        self.assertNotIn("| untouched |", text)
        self.assertIn("Unexplained changes: 2 on untouched securities (false positive), 3 unattributable.", text)
        self.assertIn("- Run: config `config/reconciliation.toml`, labels sha256 `c768055d64f3`, seed 20261111, "
                      "finished at 2026-11-11T10:00:00Z", text)
        self.assertIn("(defect: 1 case-fund rows not valued: no fund 1;", text)
        self.assertIn("(flip: 0 case-fund rows not valued;", text)
        self.assertIn("| scale flag: gross_delta_usd_valued_subset | 0.00 | 574,164,563,792.74 |", text)
        self.assertNotIn("574164563792", text)
        # Showcase shows the quotes the other vendors still hold, not the edited one.
        self.assertIn("500.00 | VENDOR_B=5.01; VENDOR_C=4.99 |", text)
        self.assertIn("300.00 | VENDOR_A=3.00 |", text)
        self.assertIn("none valued", text)
        # Defects: signed 100 - 40 + 10, gross 100 + 40 + 10; the largest fund is 400 bps.
        self.assertIn("| defect | 70.00 | 150.00 | 400.00 bps (FND1, SEC1) |", text)
        self.assertIn("| flip | 5.00 | 5.00 | 50.00 bps (FND3, SEC3) |", text)
        self.assertIn("| platform score | 81.6 | 81.5 |", text)
        # Showcase: the defect and the look-alike only, with the dollar effect summed over the case's rows.
        self.assertIn("| defect | SEC1 | VENDOR_A |", text)
        self.assertIn("| lookalike | SEC4 | VENDOR_B |", text)
        self.assertNotIn("SEC2 | VENDOR_B", text)
        self.assertIn("Odd one out", text)
        self.assertIn("price 5.00 → 500.00", text)
        self.assertIn("price 3.00 → 300.00", text)
        self.assertNotIn("9.00", text)
        self.assertIn("| 60.00 | 140.00 |", text)
        self.assertIn("| 0.00 | 0.00 |", text)

    def test_section_has_the_fixed_notes(self):
        with tempfile.TemporaryDirectory() as folder:
            text = "\n".join(report.stress_lines(Path(folder)))
        self.assertIn("The look-alike's backup quote is still wrong; it is valid for NAV only.", text)
        self.assertIn("The severity scale row values look-alikes too (neither vendor assumed correct), so it is an "
                      "upper bound.", text)
        self.assertIn("a genuine 1:100 reverse split would show as a position break, because the rebuild does not "
                      "apply corporate actions (D-016)", text)
        self.assertIn("A rerun with another config may draw a different sample; compare rates, not per-case rows, "
                      "across configs.", text)
        self.assertIn("The rates hold for the sample drawn: held equities whose vendor check passes on the snapshot; "
                      "they are not a general detection rate.", text)

    def test_missing_files_are_named(self):
        with tempfile.TemporaryDirectory() as folder:
            text = "\n".join(report.stress_lines(Path(folder)))
        self.assertIn("## Stress test", text)
        for name in ("rates", "impact", "cases", "changes", "run"):
            self.assertIn(f"`03_stress_{name}.csv` not found", text)

    def test_checksum_ignores_finish_time_but_not_results(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            self.assertEqual(report.stress_checksum(root), "")
            self.fill(root)
            before = report.stress_checksum(root)
            self.assertIn(f"Stress checksum: `{before}`", "\n".join(report.stress_lines(root)))
            self.write(root, "03_stress_run.csv", ["item", "value"],
                       [["config path", "config/reconciliation.toml"], ["labels sha256", "c768055d64f341b8a9f676d981844cf85a6ad19b2d23d2400fadd40d21958023"],
                        ["seed", "20261111"], ["finished at", "2027-01-01T00:00:00Z"]])
            self.assertEqual(report.stress_checksum(root), before)
            self.write(root, "03_stress_rates.csv", ["role"], [["defect"]])
            self.assertNotEqual(report.stress_checksum(root), before)

    def test_read_output_closes_the_file(self):
        import warnings
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            self.write(root, "a.csv", ["x"], [["1"]])
            with warnings.catch_warnings():
                warnings.simplefilter("error", ResourceWarning)
                self.assertEqual(report.read_output(root, "a.csv"), [{"x": "1"}])
                import gc
                gc.collect()


class ScorecardSectionTests(unittest.TestCase):
    """docs/FINDINGS.md's generated Scorecard section: read from the scorecard outputs, never typed."""

    def write(self, root, name, header, rows):
        with (root / name).open("w", encoding="utf-8", newline="") as stream:
            writer = csv.writer(stream, lineterminator="\n")
            writer.writerow(header)
            writer.writerows(rows)

    def test_missing_outputs_are_said_so(self):
        with tempfile.TemporaryDirectory() as folder:
            text = "\n".join(report.scorecard_lines(Path(folder)))
        self.assertIn("## Scorecard", text)
        self.assertIn("not found", text)

    def test_section_shows_scores_kpis_and_indicators(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            self.write(root, "02_scorecard.csv", ["level", "domain", "rule", "test", "score", "coverage", "confirmed_only_score"],
                       [["platform", "", "", "", "78.79", "99.83", "95.34"],
                        ["domain", "Trades", "", "", "90.10", "100.00", "88.00"],
                        ["rule", "Trades", "TXN_DUPLICATE", "", "50.00", "100.00", "50.00"]])
            self.write(root, "02_kpis.csv", ["n", "kpi", "unit", "target", "value", "met", "status"],
                       [["1", "Trades with a valid account", "%", "100%", "99.41", "no", "computed"],
                        ["6", "A proposed KPI", "%", "at least 95%", "", "", "proposed"]])
            self.write(root, "02_indicators.csv", ["id", "indicator", "status", "threshold", "value", "unit", "breaches",
                                                   "first_breach"],
                       [["I1", "Unmastered security rate", "computed", "any occurrence", "0.08", "% of trade rows", "30",
                         "2026-06-01"],
                        ["I2", "Booking latency", "computed", "above the feed's limit | or a doubling", "12", "minutes", "0", ""],
                        ["I8", "A proposed indicator", "proposed", "open past 2 days", "", "business days", "", ""]])
            text = "\n".join(report.scorecard_lines(root))
        self.assertIn("| Platform |  | 78.79 | 99.83 | 95.34 |", text)
        self.assertIn("| Domain | Trades | 90.10 | 100.00 | 88.00 |", text)
        self.assertNotIn("TXN_DUPLICATE", text)  # rules and tests stay in the CSV
        self.assertIn("| 1 | Trades with a valid account | 99.41 % | 100% | no | computed |", text)
        self.assertIn("| 6 | A proposed KPI | not computed | at least 95% |  | proposed |", text)
        # An indicator's value carries its unit, with its threshold beside it (a | in the text is escaped).
        self.assertIn("| I1 | Unmastered security rate | computed | 0.08 % of trade rows | any occurrence | 30 | 2026-06-01 |", text)
        self.assertIn("| I2 | Booking latency | computed | 12 minutes | above the feed's limit \\| or a doubling | 0 |  |", text)
        self.assertIn("| I8 | A proposed indicator | proposed |  | open past 2 days |  |  |", text)

    def test_section_says_what_differs_between_views(self):
        with tempfile.TemporaryDirectory() as folder:
            text = "\n".join(report.scorecard_lines(Path(folder)))
        # KPI 1 against ACC.exists (unknown accounts), I4 / KPI 5 against PRC.vendors (backed quotes), and the three
        # corporate-action numbers: generated sentences, no number in them.
        self.assertIn("KPI 1 reports trades on an unknown account separately (not evaluable), while the Accounts domain "
                      "counts them as fails of `ACC.exists`", text)
        self.assertIn("I4 and KPI 5 count a flagged vendor quote that another vendor backs as not agreed (a strict "
                      "reading), while `PRC.vendors` counts a backed quote as cleared", text)
        self.assertIn("Corporate actions domain awards partial credit for unresolved-only cases", text)
        self.assertIn("The confirmed-only score gives those cases full credit", text)
        self.assertIn("I3 measures readiness and treats quarantined actions as unready", text)

    def test_a_partial_set_names_the_missing_file(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            self.write(root, "02_kpis.csv", ["n", "kpi", "unit", "target", "value", "met", "status"], [])
            text = "\n".join(report.scorecard_lines(root))
        self.assertIn("`02_scorecard.csv` not found", text)
        self.assertIn("`02_indicators.csv` not found", text)


if __name__=="__main__":
    unittest.main()
