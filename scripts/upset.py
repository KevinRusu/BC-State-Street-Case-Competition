"""Exclusive co-occurrence from the canonical record/check findings, never marginals."""
from __future__ import annotations

from collections import defaultdict
import hashlib
import itertools
import json

from findings import STATUSES, deduplicate_findings


def entity_anchor(population, entity_key):
    return "entity-" + hashlib.sha256(json.dumps([population, entity_key]).encode()).hexdigest()[:24]


def build_cohorts(findings, metadata, preview_limit=20):
    checks = {c["id"]: c for c in metadata["checks"]}
    by_entity = defaultdict(list)
    for f in deduplicate_findings(findings):
        if f["status"] not in STATUSES:
            raise ValueError(f"Unsupported status: {f['status']}")
        c = checks[f["check_id"]]
        if c["population"] != f["population"] or c["category"] != f["category"]:
            raise ValueError("Finding population/category disagrees with the shared check registry")
        by_entity[(f["population"], f["entity_key"])].append(f)
    grouped = defaultdict(list)
    for (population, entity_key), flags in by_entity.items():
        signature = tuple(sorted((f["check_id"],f["status"]) for f in flags))
        grouped[(population,signature)].append((entity_key,flags))
    populations = {p: [] for p in metadata["populations"]}
    for (population, signature), records in sorted(grouped.items()):
        records.sort(key=lambda record:record[0])
        examples = []
        for entity_key, flags in records[:preview_limit]:
            # The browser gets compact evidence previews, not the entire raw data.
            examples.append({"key":entity_key,"anchor":entity_anchor(population,entity_key),"members":[{"check_id":f["check_id"],"status":f["status"],"assessment_defaulted":f["assessment_defaulted"]} for f in sorted(flags,key=lambda f:f["check_id"])]})
        populations[population].append({"members":[{"check_id":cid,"status":s} for cid,s in signature],"count":len(records),"examples":examples})
    for pop, cohorts in populations.items():
        observed = sum(c["count"] for c in cohorts)
        if observed != metadata["populations"][pop]["affected_entities"]:
            raise ValueError(f"Affected entity reconciliation failed: {pop}")
    return populations, by_entity


def intersections(cohorts, selected_checks, statuses=STATUSES):
    """Each cohort is disjoint; projection merges cohorts, never duplicates entities."""
    selected, statuses = set(selected_checks), set(statuses)
    combinations = defaultdict(int)
    totals = {check:0 for check in selected}
    for cohort in cohorts:
        members = tuple(sorted({m["check_id"] for m in cohort["members"] if m["check_id"] in selected and m["status"] in statuses}))
        if not members:
            continue
        combinations[members] += cohort["count"]
        for member in members:
            totals[member] += cohort["count"]
    rows = [{"check_ids":list(checks),"count":n,"size":len(checks)} for checks,n in sorted(combinations.items(),key=lambda pair:(-pair[1],-len(pair[0]),pair[0]))]
    distinct = sum(row["count"] for row in rows)
    flags = sum(row["count"]*row["size"] for row in rows)
    multiple = sum(row["count"] for row in rows if row["size"]>=2)
    assert sum(totals.values()) == flags
    return {"intersections":rows,"distinct":distinct,"flags":flags,"multiple":multiple,"check_totals":totals}


def validate_against_findings(findings, metadata, cohorts):
    """Independent direct-record projection validates each population/status/check set."""
    unique = deduplicate_findings(findings)
    checks_by_pop = defaultdict(list)
    for c in metadata["checks"]:
        if c["available"]:
            checks_by_pop[c["population"]].append(c["id"])
    cases = []
    for population, checks in checks_by_pop.items():
        if len(checks)<=8:
            selections=[list(group) for size in range(len(checks)+1) for group in itertools.combinations(checks,size)]
        else:
            selections=[checks,[]]+[[c] for c in checks]+[checks[:i]+checks[i+1:] for i in range(len(checks))]
        for selected in selections:
            for statuses in [list(STATUSES), *[[s] for s in STATUSES]]:
                direct = defaultdict(set)
                for f in unique:
                    if f["population"]==population and f["check_id"] in selected and f["status"] in statuses:
                        direct[f["entity_key"]].add(f["check_id"])
                expected_combos=defaultdict(int)
                for members in direct.values():
                    expected_combos[tuple(sorted(members))]+=1
                actual=intersections(cohorts[population],selected,statuses)
                assert {tuple(r["check_ids"]):r["count"] for r in actual["intersections"]} == dict(expected_combos)
                assert actual["distinct"]==len(direct)
                assert actual["flags"]==sum(map(len,direct.values()))
                cases.append({"population":population,"checks":selected,"statuses":statuses,"distinct":actual["distinct"],"flags":actual["flags"],"multiple":actual["multiple"],"check_totals":actual["check_totals"],"intersections":actual["intersections"]})
    return cases
