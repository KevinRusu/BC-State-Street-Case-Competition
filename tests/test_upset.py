import copy
import itertools
from pathlib import Path
import sys
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"))
from findings import STATUSES
from upset import build_cohorts, intersections, validate_against_findings


def finding(entity,check,status=STATUSES[0],population="holdings"):
    return {"analysis_snapshot":"2026-07-10","population":population,"entity_key":entity,"check_id":check,"category":"master","status":status,"assessment_defaulted":False}


def metadata(findings):
    populations={f["population"] for f in findings}
    return {"checks":[{"id":cid,"population":p,"category":"master","available":True} for p,cid in sorted({(f["population"],f["check_id"]) for f in findings})],"populations":{p:{"affected_entities":len({f["entity_key"] for f in findings if f["population"]==p}),"eligible_entities":10} for p in populations}}


class UpSetTests(unittest.TestCase):
    def setUp(self):
        self.findings=[finding("one","A"),finding("two","A"),finding("two","B",STATUSES[1]),finding("three","B")]
        self.metadata=metadata(self.findings)
        self.cohorts,_=build_cohorts(self.findings,self.metadata)

    def test_exclusive_combinations_include_single_and_multiple_flags(self):
        result=intersections(self.cohorts["holdings"],["A","B"])
        self.assertEqual((result["distinct"],result["flags"],result["multiple"]),(3,4,1))
        self.assertEqual({tuple(c["check_ids"]):c["count"] for c in result["intersections"]},{("A",):1,("B",):1,("A","B"):1})

    def test_status_filter_precedes_exact_intersection(self):
        result=intersections(self.cohorts["holdings"],["A","B"],[STATUSES[0]])
        self.assertEqual((result["distinct"],result["flags"],result["multiple"]),(3,3,0))
        self.assertEqual({tuple(c["check_ids"]):c["count"] for c in result["intersections"]},{("A",):2,("B",):1})

    def test_deselecting_check_merges_membership_cohorts(self):
        result=intersections(self.cohorts["holdings"],["A"])
        self.assertEqual(result["intersections"],[{"check_ids":["A"],"count":2,"size":1}])

    def test_repeated_ingestion_does_not_inflate_intersections(self):
        repeated,_=build_cohorts(self.findings+copy.deepcopy(self.findings),self.metadata)
        self.assertEqual(repeated,self.cohorts)

    def test_raw_row_identity_is_not_transaction_business_id(self):
        rows=[finding('["source-checksum","12"]',"A",population="transaction_rows"),finding('["source-checksum","13"]',"A",population="transaction_rows")]
        cohorts,_=build_cohorts(rows,metadata(rows))
        self.assertEqual(intersections(cohorts["transaction_rows"],["A"])["distinct"],2)

    def test_different_populations_never_merge(self):
        rows=self.findings+[finding("one","CASE",population="transaction_groups")]
        cohorts,_=build_cohorts(rows,metadata(rows))
        self.assertEqual(intersections(cohorts["holdings"],["A","B","CASE"])["distinct"],3)
        self.assertEqual(intersections(cohorts["transaction_groups"],["CASE"])["distinct"],1)

    def test_unknown_status_is_rejected(self):
        rows=[finding("one","A","Unknown")]
        with self.assertRaises(ValueError):build_cohorts(rows,metadata(rows))

    def test_no_check_or_no_status_yields_no_invented_passes(self):
        self.assertEqual(intersections(self.cohorts["holdings"],[])["distinct"],0)
        self.assertEqual(intersections(self.cohorts["holdings"],["A"],[])["distinct"],0)

    def test_preview_limit_does_not_change_full_counts(self):
        rows=[finding(str(i),"A") for i in range(30)]
        cohorts,_=build_cohorts(rows,metadata(rows),preview_limit=2)
        self.assertEqual(len(cohorts["holdings"][0]["examples"]),2)
        self.assertEqual(intersections(cohorts["holdings"],["A"])["distinct"],30)

    def test_independent_direct_membership_validation(self):
        cases=validate_against_findings(self.findings,self.metadata,self.cohorts)
        self.assertEqual(len(cases),16)
        self.assertTrue(any(c["checks"]==[] for c in cases))

    def test_conservation_for_all_check_subsets_and_status_filters(self):
        for size in range(3):
            for selected in itertools.combinations(["A","B"],size):
                for statuses in [STATUSES,[STATUSES[0]],[STATUSES[1]],[STATUSES[2]]]:
                    result=intersections(self.cohorts["holdings"],selected,statuses)
                    self.assertEqual(sum(c["count"] for c in result["intersections"]),result["distinct"])
                    self.assertEqual(sum(c["count"]*c["size"] for c in result["intersections"]),result["flags"])
                    self.assertEqual(sum(result["check_totals"].values()),result["flags"])


if __name__=="__main__":unittest.main()
