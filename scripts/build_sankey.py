"""Regenerate private findings and a self-contained offline presentation view."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from findings import build_findings


def browser_payload(findings, metadata, theme):
    # Only membership indices, never business identifiers, enter the browser file.
    # Unique-entity unions remain exact under combined category/status filters.
    keys = {}
    for population in metadata["populations"]:
        entities = sorted({f["entity_key"] for f in findings if f["population"] == population})
        keys[population] = {entity: i for i, entity in enumerate(entities)}
    groups = {}
    for f in findings:
        group = (f["population"], f["check_id"], f["status"])
        groups.setdefault(group, []).append(keys[f["population"]][f["entity_key"]])
    return {**metadata, "theme":theme, "groups":[{"population":p,"check_id":cid,"status":s,"entities":sorted(ids)} for (p,cid,s),ids in sorted(groups.items())]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, help="Output directory (default: outputs/sankey)")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    output = args.output.resolve() if args.output else root / "outputs/sankey"
    findings, metadata = build_findings(root, output)
    theme = json.loads((root / "web/visualization-theme.json").read_text(encoding="utf-8"))
    payload = browser_payload(findings, metadata, theme)
    encoded = json.dumps(payload, separators=(",",":"), ensure_ascii=False).replace("<", "\\u003c")
    html = (root / "web/sankey.html").read_text(encoding="utf-8")
    html = html.replace("/*__CSS__*/", (root / "web/visualization.css").read_text(encoding="utf-8"))
    html = html.replace("/*__JS__*/", (root / "web/sankey.js").read_text(encoding="utf-8"))
    html = html.replace("__FINDINGS_DATA__", encoded)
    (output / "index.html").write_text(html, encoding="utf-8")
    print(f"Built {len(findings):,} flags across {len(metadata['populations'])} separate populations.")
    for pop in metadata["populations"].values():
        print(f"  {pop['label']}: {pop['flag_count']:,} flags / {pop['affected_entities']:,} affected {pop['unit']}")
    print(f"Open: {output / 'index.html'}")
    print("Presentation exports: use the SVG and PNG buttons, or tests/inspect_sankey.cjs.")


if __name__ == "__main__":
    main()
