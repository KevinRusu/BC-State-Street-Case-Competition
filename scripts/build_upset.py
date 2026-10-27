"""Regenerate the shared findings, Sankey companion, and offline UpSet view."""
from __future__ import annotations

import argparse
import csv
import html
import json
import os
from pathlib import Path
from urllib.parse import quote

from build_sankey import write_sankey
from findings import STATUSES, build_findings
from upset import build_cohorts, entity_anchor, intersections, validate_against_findings


def write_evidence(output, root, cohorts, by_entity, metadata):
    folder=output/"evidence"
    folder.mkdir(exist_ok=True)
    definitions={c["id"]:c for c in metadata["checks"]}
    for population, groups in cohorts.items():
        keys=sorted({example["key"] for group in groups for example in group["examples"]})
        sections=[]
        for key in keys:
            flags=by_entity[(population,key)]
            rows=[]
            for f in sorted(flags,key=lambda f:f["check_id"]):
                source=Path(os.path.relpath(root/f["source_file"],folder)).as_posix()
                fields=[definitions[f["check_id"]]["label"],f["status"],f["raw_row_lineage"],f["assessment_reference"],f["evidence"]]
                cells="".join("<td>"+html.escape(str(value))+"</td>" for value in fields)
                rows.append("<tr>"+cells+f'<td><a href="{html.escape(quote(source,safe="/:"))}">{html.escape(f["source_file"])}</a></td></tr>')
            sections.append(f'<section id="{entity_anchor(population,key)}"><h2>Stable entity key</h2><code>{html.escape(key)}</code><p>All supplied flags for this entity, before viewer filters. Source row numbers are 1-based data rows, excluding the CSV header.</p><div class="table-scroll"><table><thead><tr><th>Check</th><th>Evidence assessment</th><th>Raw rows</th><th>Assessment source</th><th>Observed fields</th><th>Raw source</th></tr></thead><tbody>{"".join(rows)}</tbody></table></div></section>')
        body=f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>UpSet record evidence</title><style>body{{font:14px Segoe UI,Arial,sans-serif;color:#173449;margin:28px}}a{{color:#0077A8}}section{{margin:32px 0;padding-top:20px;border-top:1px solid #CFDCE5}}code,td{{overflow-wrap:anywhere}}.table-scroll{{overflow:auto}}table{{border-collapse:collapse;width:100%;font-size:12px}}th,td{{text-align:left;vertical-align:top;padding:12px;border-bottom:1px solid #CFDCE5;min-width:120px}}th{{background:#EAF2F7}}h2{{font-size:16px}}section:target{{border-top:4px solid #00A6A6}}</style></head><body><a href="../index.html">Back to the UpSet chart</a><h1>{html.escape(metadata["populations"][population]["label"])} · evidence previews</h1><p>Private synthetic competition data. These are observed source references, not proof of a causal explanation.</p>{"".join(sections)}</body></html>'
        (folder/f"{population}.html").write_text(body,encoding="utf-8")


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output",type=Path,help="UpSet output directory (default outputs/upset)")
    args=parser.parse_args()
    root=Path(__file__).resolve().parents[1]
    output=args.output.resolve() if args.output else root/"outputs/upset"
    output.mkdir(parents=True,exist_ok=True)
    shared=root/"outputs/sankey"
    findings,metadata=build_findings(root,shared)
    write_sankey(root,shared,findings,metadata)
    cohorts,by_entity=build_cohorts(findings,metadata)
    validation=validate_against_findings(findings,metadata,cohorts)
    theme=json.loads((root/"web/visualization-theme.json").read_text(encoding="utf-8"))
    payload={**metadata,"theme":theme,"cohorts":cohorts,"preview_limit":20,
             "shared_findings_href":Path(os.path.relpath(shared/"findings.csv",output)).as_posix(),
             "sankey_href":Path(os.path.relpath(shared/"index.html",output)).as_posix()}
    encoded=json.dumps(payload,separators=(",",":"),ensure_ascii=False).replace("<","\\u003c")
    document=(root/"web/upset.html").read_text(encoding="utf-8")
    css=(root/"web/visualization.css").read_text(encoding="utf-8")+"\n"+(root/"web/upset.css").read_text(encoding="utf-8")
    document=document.replace("/*__CSS__*/",css).replace("__UPSET_DATA__",encoded)
    document=document.replace("/*__MODEL__*/",(root/"web/upset-model.js").read_text(encoding="utf-8"))
    document=document.replace("/*__JS__*/",(root/"web/upset.js").read_text(encoding="utf-8"))
    (output/"index.html").write_text(document,encoding="utf-8")
    (output/"cohorts.json").write_text(json.dumps(cohorts,indent=2),encoding="utf-8")
    (output/"validation-cases.json").write_text(json.dumps(validation,separators=(",",":")),encoding="utf-8")
    with (output/"memberships.csv").open("w",encoding="utf-8",newline="") as stream:
        writer=csv.writer(stream);writer.writerow(["analysis_snapshot","population","entity_key","check_ids","evidence_statuses"])
        for (pop,key),flags in sorted(by_entity.items()):
            ordered=sorted(flags,key=lambda f:f["check_id"])
            writer.writerow([metadata["analysis_snapshot"],pop,key,json.dumps([f["check_id"] for f in ordered]),json.dumps({f["check_id"]:f["status"] for f in ordered})])
    with (output/"intersections.csv").open("w",encoding="utf-8",newline="") as stream:
        writer=csv.writer(stream);writer.writerow(["snapshot","population","selected_check_ids","selected_statuses","combination_check_ids","combination_labels","combination_size","unique_entities","percent_of_population_entities_with_selected_flags"])
        for pop in metadata["populations"]:
            checks=[c["id"] for c in metadata["checks"] if c["population"]==pop and c["available"]]
            result=intersections(cohorts[pop],checks)
            for row in result["intersections"]:
                labels=[next(c["label"] for c in metadata["checks"] if c["id"]==cid) for cid in row["check_ids"]]
                writer.writerow([metadata["analysis_snapshot"],pop,json.dumps(checks),json.dumps(STATUSES),json.dumps(row["check_ids"]),json.dumps(labels),row["size"],row["count"],100*row["count"]/result["distinct"] if result["distinct"] else 0])
    write_evidence(output,root,cohorts,by_entity,metadata)
    for pop in metadata["populations"]:
        checks=[c["id"] for c in metadata["checks"] if c["population"]==pop and c["available"]]
        result=intersections(cohorts[pop],checks)
        print(f"{metadata['populations'][pop]['label']}: {result['distinct']:,} affected entities / {len(result['intersections'])} exact combinations / {result['multiple']:,} with multiple flags")
    print(f"Validated {len(validation)} selections against individual shared findings.")
    print(f"Open: {output/'index.html'}")


if __name__=="__main__":
    main()
