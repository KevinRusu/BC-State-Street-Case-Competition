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


if __name__=="__main__":
    unittest.main()
