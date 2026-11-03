"""Record-level findings shared by the Sankey and a future UpSet view.

Raw inputs are immutable. Evidence assessments are extracted (not executed) from
the notebook's defect catalog. Every count comes from a deduplicated findings set.
"""
from __future__ import annotations

import ast
import csv
import gzip
import hashlib
import json
from pathlib import Path
import time
import tomllib

import duckdb

STATUSES = ("Confirmed defect", "Unresolved hypothesis", "Cleared flag")
IDENTITY = ("analysis_snapshot", "population", "entity_key", "check_id")
POPULATIONS = {
    "holdings": ("Holdings", "holding keys", "Account + security + normalized snapshot date; union of book and custodian keys."),
    "transaction_rows": ("Transaction rows", "source transaction rows", "Physical CSV rows, including all statuses and repeated IDs. Key: file checksum + 1-based data row."),
    "transaction_groups": ("Transaction ID cases", "transaction ID cases", "One case per nonblank transaction ID. Duplicate copies are evidence, not additional cases."),
    "pipeline_groups": ("Pipeline ID cases", "pipeline ID cases", "One case per nonblank transaction ID in pipeline_events."),
    "reversal_groups": ("Reversal-original cases", "original-ID cases", "One case per populated original ID referenced by REVERSED rows."),
    "issuer_events": ("Corporate-action events", "issuer events", "One event per unique action_id."),
    "quote_opportunities": ("Preferred-quote opportunities", "security / date / vendor cases", "Observed preferred security/vendor pairs crossed with all observed price dates. Not price rows."),
    "price_rows": ("Vendor price rows", "source price rows", "Physical source price rows; key includes file checksum and data row."),
    "fx_rows": ("FX rows", "source FX rows", "Physical source FX rows; key includes file checksum and data row."),
}


def literal_notebook_metadata(path):
    """Read assessment strings and the event-term matrix without executing a notebook."""
    notebook = json.loads(path.read_text(encoding="utf-8"))
    assessments, field_use = {}, None
    for index, cell in enumerate(notebook["cells"]):
        if cell["cell_type"] != "code":
            continue
        tree = ast.parse("".join(cell["source"]))
        for node in ast.walk(tree):
            if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "GUIDE_FIELD_USE" for t in node.targets):
                if isinstance(node.value, ast.Call) and node.value.args:
                    field_use = ast.literal_eval(node.value.args[0])
            if not isinstance(node, ast.Dict):
                continue
            values = {k.value: v for k, v in zip(node.keys, node.values) if isinstance(k, ast.Constant)}
            if all(isinstance(values.get(k), ast.Constant) for k in ("defect", "evidence status")):
                assessments[values["defect"].value] = {
                    "original": values["evidence status"].value,
                    "reference": f"notebooks/{path.name}#cell-{index} ({cell.get('id', 'no-cell-id')})",
                }
    return assessments, field_use


def assessment_for(check, assessments):
    source = assessments.get(check.get("assessment"))
    if source:
        original = source["original"]
        if original.lower().startswith("confirmed"):
            status = STATUSES[0]
        elif original.lower().startswith("cleared"):
            status = STATUSES[2]
        else:
            status = STATUSES[1]
        return status, False, source["reference"], original
    return STATUSES[1], True, "No matching assessment in notebook defect catalog", "Missing assessment; defaulted to unresolved"


def deduplicate_findings(findings):
    """Idempotent ingestion; contradictory classifications fail instead of picking a winner."""
    unique = {}
    for item in findings:
        key = tuple(item[k] for k in IDENTITY)
        previous = unique.get(key)
        if previous is not None and previous != item:
            raise ValueError(f"Conflicting finding identity: {key}")
        unique[key] = item
    return [unique[k] for k in sorted(unique)]


def aggregate(findings):
    counts = {}
    entities = {}
    for f in deduplicate_findings(findings):
        key = (f["population"], f["category"], f["check_id"], f["status"])
        counts[key] = counts.get(key, 0) + 1
        entities.setdefault(f["population"], set()).add(f["entity_key"])
    return counts, entities


def sql_string(value):
    return "'" + str(value).replace("'", "''") + "'"


def day(column):
    return f"COALESCE(TRY_STRPTIME({column}, '%Y-%m-%d'), TRY_STRPTIME({column}, '%d/%m/%Y'))::DATE"


def decimal(column):
    return f"TRY_CAST({column} AS DECIMAL(38,10))"


def key(*columns):
    return "to_json(list_value(" + ",".join(f"CAST({v} AS VARCHAR)" for v in columns) + "))"


class FindingBuilder:
    def __init__(self, root, output):
        self.root, self.output = Path(root), Path(output)
        self.output.mkdir(parents=True, exist_ok=True)
        self.started = time.perf_counter()
        self.registry = json.loads((self.root / "config/findings.json").read_text(encoding="utf-8"))
        self.config = tomllib.loads((self.root / "config/exploration.toml").read_text(encoding="utf-8"))
        self.snapshot = self.config["snapshot"]["as_of_date"]
        self.tolerance = self.config["reconstruction"]["quantity_match_tolerance"]
        self.gross_tolerance = self.config["reconstruction"]["gross_amount_tolerance"]
        self.assessments, self.field_use = literal_notebook_metadata(self.root / self.registry["assessment_notebook"])
        self.c = duckdb.connect()
        self.c.execute("SET threads=1")  # CSV lineage is assigned at the physical source scan.
        self.c.execute("SET memory_limit='768MB'")
        self.c.execute(f"SET temp_directory={sql_string((self.output / '.scratch').as_posix())}")
        self.findings, self.checks, self.inputs, self.populations = [], [], {}, {}

    def scalar(self, sql):
        return self.c.sql(sql).fetchone()[0]

    def load(self):
        with (self.root / "manifest.csv").open(encoding="utf-8", newline="") as stream:
            inventory = {r["table"]: r for r in csv.DictReader(stream)}
        names = ["transactions", "pipeline_events", "positions", "comparison_positions", "accounts", "securities", "corporate_actions", "prices", "fx_rates"]
        for name in names:
            row = inventory[name]
            path = self.root / row["file"]
            with path.open("rb") as stream:
                checksum = hashlib.file_digest(stream, "sha256").hexdigest()
            if checksum != row["sha256"]:
                raise ValueError(f"{name}: checksum does not match manifest; use a separate manifest for test fixtures")
            with gzip.open(path, "rt", encoding="utf-8", newline="") as stream:
                columns = next(csv.reader(stream))
            keep_blanks = "[" + ",".join(map(sql_string, columns)) + "]"
            self.c.execute(f"CREATE TEMP TABLE {name} AS SELECT row_number() OVER () AS raw_row_number, * FROM read_csv({sql_string(path.as_posix())}, header=true, all_varchar=true, force_not_null={keep_blanks})")
            count = self.scalar(f"SELECT count(*) FROM {name}")
            if count != int(row["rows"]):
                raise ValueError(f"{name}: manifest row count failed")
            self.inputs[name] = {"file": row["file"], "sha256": checksum, "rows": count, "columns": columns}
        self.c.execute(f"CREATE TEMP VIEW tx AS SELECT *, {day('trade_date')} AS trade_day, {day('settlement_date')} AS settlement_day, {decimal('quantity')} AS q, {decimal('price')} AS p, {decimal('gross_amount')} AS gross FROM transactions")
        for source, alias in [("positions", "book"), ("comparison_positions", "custodian")]:
            self.c.execute(f"CREATE TEMP VIEW {alias}_all AS SELECT *, {day('as_of_date')} AS snapshot_day, {decimal('quantity')} AS q FROM {source}")
            self.c.execute(f"CREATE TEMP TABLE {alias} AS SELECT * FROM {alias}_all WHERE trim(account_id)<>'' AND trim(security_id)<>'' AND snapshot_day=DATE {sql_string(self.snapshot)}")
        # A business key never silently selects an arbitrary master or holding copy.
        for source, columns in [("accounts", "account_id"), ("securities", "security_id"), ("corporate_actions", "action_id"), ("book", "account_id,security_id,snapshot_day"), ("custodian", "account_id,security_id,snapshot_day")]:
            if self.scalar(f"SELECT count(*) FROM (SELECT {columns} FROM {source} GROUP BY {columns} HAVING count(*)>1)"):
                raise ValueError(f"{source}: repeated business keys; resolve or quarantine before building findings")
        self.c.execute("CREATE TEMP TABLE holding_keys AS SELECT account_id,security_id,snapshot_day FROM book UNION SELECT account_id,security_id,snapshot_day FROM custodian")
        counts = {
            "holdings": "SELECT count(*) FROM holding_keys",
            "transaction_rows": "SELECT count(*) FROM tx",
            "transaction_groups": "SELECT count(DISTINCT transaction_id) FROM tx WHERE trim(transaction_id)<>''",
            "pipeline_groups": "SELECT count(DISTINCT transaction_id) FROM pipeline_events WHERE trim(transaction_id)<>''",
            "reversal_groups": "SELECT count(DISTINCT related_transaction_id) FROM tx WHERE status='REVERSED' AND trim(related_transaction_id)<>''",
            "issuer_events": "SELECT count(*) FROM corporate_actions",
            "price_rows": "SELECT count(*) FROM prices",
            "fx_rows": "SELECT count(*) FROM fx_rates",
        }
        for name, query in counts.items():
            label, unit, grain = POPULATIONS[name]
            self.populations[name] = {"id": name, "label": label, "unit": unit, "grain": grain, "eligible_entities": self.scalar(query)}

    def add(self, check_id, query, *, eligible=None, unevaluable=0, unavailable=None):
        check = dict(next(c for c in self.registry["checks"] if c["id"] == check_id))
        status, defaulted, assessment_ref, original = assessment_for(check, self.assessments)
        check.update(status=status, assessment_defaulted=defaulted, assessment_reference=assessment_ref, original_assessment=original, available=not unavailable, unavailable_reason=unavailable, eligible_entities=eligible if eligible is not None else self.populations[check["population"]]["eligible_entities"], unevaluable_entities=unevaluable)
        if unavailable:
            check["flag_count"] = None
            self.checks.append(check)
            return
        before = len(self.findings)
        cursor = self.c.sql(query)
        fields = [c[0] for c in cursor.description]
        for values in cursor.fetchall():
            evidence = dict(zip(fields, values))
            entity_key = evidence.pop("entity_key")
            source_table = evidence.pop("source_table")
            raw_rows = evidence.pop("raw_rows")
            source = self.inputs[source_table]
            if isinstance(raw_rows, str):
                raw_rows = json.loads(raw_rows)
            self.findings.append({
                "analysis_snapshot": self.snapshot, "population": check["population"],
                "entity_key": entity_key, "check_id": check_id, "category": check["category"],
                "anomaly": check["label"], "status": status, "assessment_defaulted": defaulted,
                "assessment_reference": assessment_ref, "source_table": source_table,
                "source_file": source["file"], "source_sha256": source["sha256"],
                "raw_row_lineage": json.dumps(raw_rows),
                "evidence_reference": (f"{source['file']}#data-rows=" + ",".join(map(str, raw_rows))) if raw_rows else f"{source['file']}#expected-grid-case={entity_key}",
                "evidence": json.dumps(evidence, default=str, sort_keys=True),
            })
        check["flag_count"] = len(self.findings) - before
        self.checks.append(check)

    def row_select(self, table, alias, population):
        checksum = self.inputs[table]["sha256"]
        entity = key(sql_string(checksum), f"{alias}.raw_row_number")
        return f"{entity} AS entity_key, {sql_string(table)} AS source_table, list_value({alias}.raw_row_number) AS raw_rows"

    def holding_select(self):
        return f"{key('b.account_id', 'b.security_id', 'b.snapshot_day')} AS entity_key, 'positions' AS source_table, list_value(b.raw_row_number) AS raw_rows"

    def detect(self):
        h = self.holding_select()
        book_count = self.scalar("SELECT count(*) FROM book")
        self.add("missing_account", f"SELECT {h}, b.account_id FROM book b WHERE NOT EXISTS(SELECT 1 FROM accounts a WHERE a.account_id=b.account_id)", eligible=book_count)
        self.add("missing_security", f"SELECT {h}, b.security_id FROM book b WHERE NOT EXISTS(SELECT 1 FROM securities s WHERE s.security_id=b.security_id)", eligible=book_count)
        self.add("no_vendor_coverage", f"SELECT {h}, b.security_id FROM book b WHERE NOT EXISTS(SELECT 1 FROM prices p WHERE p.security_id=b.security_id)", eligible=book_count)

        # Only repeated ID groups need full-row signature comparisons.
        columns = self.inputs["transactions"]["columns"]
        normalized = []
        for col in columns:
            if col in ("trade_date", "settlement_date"):
                expr = f"COALESCE(strftime({day(col)}, '%Y-%m-%d'),{col})"
            elif col == "event_timestamp":
                expr = f"COALESCE(strftime({day('substr(event_timestamp,1,10)')}, '%Y-%m-%d'),substr(event_timestamp,1,10)) || substr(event_timestamp,11)"
            else:
                expr = col
            normalized.append(f"{col}:={expr}")
        raw_signature = "to_json(struct_pack(" + ",".join(f"{c}:={c}" for c in columns) + "))"
        norm_signature = "to_json(struct_pack(" + ",".join(normalized) + "))"
        self.c.execute(f"CREATE TEMP TABLE duplicate_cases AS SELECT transaction_id,count(*) AS copies,count(DISTINCT {raw_signature}) AS raw_variants,count(DISTINCT {norm_signature}) AS normalized_variants,list(raw_row_number ORDER BY raw_row_number) AS raw_rows FROM tx WHERE trim(transaction_id)<>'' AND transaction_id IN(SELECT transaction_id FROM tx GROUP BY transaction_id HAVING count(*)>1) GROUP BY transaction_id")
        for check, predicate in [("exact_duplicates", "raw_variants=1"), ("format_duplicates", "raw_variants>1 AND normalized_variants=1"), ("conflicting_duplicates", "normalized_variants>1")]:
            self.add(check, f"SELECT {key('transaction_id')} AS entity_key,'transactions' AS source_table,raw_rows,copies,raw_variants,normalized_variants FROM duplicate_cases WHERE {predicate}")
        self.add("pipeline_duplicates", f"SELECT {key('transaction_id')} AS entity_key,'pipeline_events' AS source_table,list(raw_row_number ORDER BY raw_row_number) AS raw_rows,count(*) AS copies FROM pipeline_events WHERE trim(transaction_id)<>'' GROUP BY transaction_id HAVING count(*)>1")

        t = self.row_select("transactions", "t", "transaction_rows")
        for check, condition in [("missing_quantity", "trim(t.quantity)=''"), ("negative_quantity", "t.q<0"), ("missing_settlement", "trim(t.settlement_date)=''"), ("settlement_before_trade", "t.settlement_day<t.trade_day"), ("broken_correction", "t.status='CANCELLED' AND trim(t.related_transaction_id)<>'' AND NOT EXISTS(SELECT 1 FROM tx original WHERE original.transaction_id=t.related_transaction_id)")]:
            unevaluable = 0
            if check == "negative_quantity":
                unevaluable = self.scalar("SELECT count(*) FROM tx WHERE q IS NULL")
            elif check == "settlement_before_trade":
                unevaluable = self.scalar("SELECT count(*) FROM tx WHERE settlement_day IS NULL OR trade_day IS NULL")
            self.add(check, f"SELECT {t},t.transaction_id,t.quantity,t.trade_date,t.settlement_date,t.status,t.related_transaction_id FROM tx t WHERE {condition}", unevaluable=unevaluable)
        self.add("multiple_reversals", f"SELECT {key('related_transaction_id')} AS entity_key,'transactions' AS source_table,list(raw_row_number ORDER BY raw_row_number) AS raw_rows,count(*) AS reversal_rows FROM tx WHERE status='REVERSED' AND trim(related_transaction_id)<>'' GROUP BY related_transaction_id HAVING count(*)>1")

        # Resolve a link only when every normalized full-row target copy agrees.
        self.c.execute(f"CREATE TEMP TABLE correction_targets AS SELECT transaction_id,min(status) AS target_status,min(q) AS target_q,min(p) AS target_p,min(account_id) AS target_account,min(security_id) AS target_security,count(DISTINCT {norm_signature}) AS variants FROM tx WHERE transaction_id IN(SELECT related_transaction_id FROM tx WHERE trim(related_transaction_id)<>'') GROUP BY transaction_id")
        rebook_base = "FROM tx t JOIN correction_targets o ON o.transaction_id=t.related_transaction_id WHERE t.status='BOOKED' AND o.target_status='CANCELLED'"
        rebook_bad = self.scalar(f"SELECT count(*) {rebook_base} AND (o.variants<>1 OR t.q IS NULL OR o.target_q IS NULL OR t.gross IS NULL OR o.target_p IS NULL OR t.account_id<>o.target_account OR t.security_id<>o.target_security)")
        self.add("rebook_amount", f"SELECT {t},t.transaction_id,t.related_transaction_id,t.quantity,t.gross_amount,o.target_q,o.target_p {rebook_base} AND o.variants=1 AND t.account_id=o.target_account AND t.security_id=o.target_security AND t.q<>o.target_q AND abs(t.gross-o.target_q*o.target_p)<={self.gross_tolerance}", unevaluable=rebook_bad)

        a = f"{key('a.action_id')} AS entity_key,'corporate_actions' AS source_table,list_value(a.raw_row_number) AS raw_rows"
        self.add("unmastered_spinoff", f"SELECT {a},a.action_id,a.target_security_id FROM corporate_actions a WHERE action_type='SPINOFF' AND trim(target_security_id)<>'' AND NOT EXISTS(SELECT 1 FROM securities s WHERE s.security_id=a.target_security_id)")
        self.add("missing_merger_target", f"SELECT {a},a.action_id FROM corporate_actions a WHERE action_type='MERGER' AND trim(target_security_id)=''")
        if self.field_use is None:
            self.add("questionable_terms", "", unavailable="Notebook GUIDE_FIELD_USE matrix is missing; no substitute terms invented.")
        else:
            conditions = [f"(a.action_type={sql_string(kind)} AND trim(a.{field})<>'')" for field, types in self.field_use.items() for kind, usage in types.items() if usage == "not expected"]
            self.add("questionable_terms", f"SELECT {a},a.action_id,a.action_type,a.ratio,a.cash_rate,a.target_security_id FROM corporate_actions a WHERE " + " OR ".join(conditions))
        self.add("questionable_chronology", f"SELECT {a},a.action_id,a.ex_date,a.effective_date FROM corporate_actions a WHERE {day('a.ex_date')}>{day('a.effective_date')}", unevaluable=self.scalar(f"SELECT count(*) FROM corporate_actions WHERE {day('ex_date')} IS NULL OR {day('effective_date')} IS NULL"))

        self.c.execute(f"CREATE TEMP TABLE price_dates AS SELECT DISTINCT {day('price_date')} AS price_day FROM prices WHERE {day('price_date')} IS NOT NULL")
        self.c.execute("CREATE TEMP TABLE preferred_pairs AS SELECT DISTINCT security_id,vendor FROM prices WHERE TRY_CAST(vendor_priority AS INTEGER)=(SELECT min(TRY_CAST(vendor_priority AS INTEGER)) FROM prices) AND trim(security_id)<>'' AND trim(vendor)<>''")
        self.c.execute("CREATE TEMP VIEW quote_opportunities AS SELECT * FROM preferred_pairs CROSS JOIN price_dates")
        label, unit, grain = POPULATIONS["quote_opportunities"]
        self.populations["quote_opportunities"] = {"id":"quote_opportunities", "label":label,"unit":unit,"grain":grain,"eligible_entities": self.scalar("SELECT count(*) FROM quote_opportunities")}
        self.add("preferred_quote_missing", f"SELECT {key('o.security_id','o.price_day','o.vendor')} AS entity_key,'prices' AS source_table,[]::BIGINT[] AS raw_rows,o.security_id,o.price_day,o.vendor FROM quote_opportunities o WHERE NOT EXISTS(SELECT 1 FROM prices p WHERE p.security_id=o.security_id AND p.vendor=o.vendor AND {day('p.price_date')}=o.price_day)")
        pr = self.row_select("prices", "p", "price_rows")
        self.add("no_fx_currency", f"SELECT {pr},p.security_id,p.currency,p.price_date FROM prices p WHERE trim(p.currency)<>'' AND NOT EXISTS(SELECT 1 FROM fx_rates f WHERE f.currency=p.currency)", unevaluable=self.scalar("SELECT count(*) FROM prices WHERE trim(currency)=''") )
        fx = self.row_select("fx_rates", "f", "fx_rows")
        self.add("usd_not_one", f"SELECT {fx},f.currency,f.rate_date,f.rate_to_usd FROM fx_rates f WHERE currency='USD' AND {decimal('rate_to_usd')}<>1", unevaluable=self.scalar(f"SELECT count(*) FROM fx_rates WHERE currency='USD' AND {decimal('rate_to_usd')} IS NULL"))

        join = "FROM book b JOIN custodian c USING(account_id,security_id,snapshot_day)"
        unevaluable = self.scalar(f"SELECT count(*) {join} WHERE b.q IS NULL OR c.q IS NULL")
        self.add("custodian_disagreement", f"SELECT {h},b.quantity AS book_quantity,c.quantity AS custodian_quantity,c.raw_row_number AS custodian_raw_row {join} WHERE b.q<>c.q", unevaluable=unevaluable)
        self.add("book_only", f"SELECT {h},b.quantity FROM book b WHERE NOT EXISTS(SELECT 1 FROM custodian c WHERE b.account_id=c.account_id AND b.security_id=c.security_id AND b.snapshot_day=c.snapshot_day)", eligible=book_count)

        # Benchmark, not a repaired book: preserve duplicates and negative signs.
        self.c.execute(f"CREATE TEMP TABLE booked_rebuild AS SELECT account_id,security_id,sum(CASE transaction_type WHEN 'BUY' THEN q WHEN 'SELL' THEN -q END) AS rebuilt_quantity,bool_or(q IS NULL OR transaction_type NOT IN('BUY','SELL') OR trade_day IS NULL) AS unevaluable,count(*) AS contributing_rows FROM tx WHERE status='BOOKED' AND (trade_day<=DATE {sql_string(self.snapshot)} OR trade_day IS NULL) GROUP BY account_id,security_id")
        rjoin = "FROM book b JOIN booked_rebuild r USING(account_id,security_id)"
        bad_rebuild = self.scalar(f"SELECT count(*) {rjoin} WHERE r.unevaluable OR b.q IS NULL")
        self.add("rebuild_disagreement", f"SELECT {h},b.quantity,r.rebuilt_quantity,r.contributing_rows {rjoin} WHERE NOT r.unevaluable AND b.q IS NOT NULL AND abs(b.q-r.rebuilt_quantity)>{self.tolerance}", eligible=book_count, unevaluable=bad_rebuild)
        self.add("no_booked_trades", f"SELECT {h},b.quantity,b.transaction_count FROM book b WHERE NOT EXISTS(SELECT 1 FROM booked_rebuild r WHERE r.account_id=b.account_id AND r.security_id=b.security_id)", eligible=book_count)

    def finish(self):
        self.findings = deduplicate_findings(self.findings)
        counts, affected = aggregate(self.findings)
        if {c["id"] for c in self.checks} != {c["id"] for c in self.registry["checks"]}:
            raise AssertionError("Taxonomy checks are missing")
        for check in self.checks:
            if check["available"]:
                actual = sum(n for (p, cat, cid, s), n in counts.items() if cid == check["id"])
                assert actual == check["flag_count"], f"Duplicate result rows within {check['id']}"
        audit = {}
        for source, alias in [("positions", "book"), ("comparison_positions", "custodian")]:
            audit[source] = {
                "raw_rows": self.inputs[source]["rows"],
                "invalid_key_rows": self.scalar(f"SELECT count(*) FROM {alias}_all WHERE trim(account_id)='' OR trim(security_id)='' OR snapshot_day IS NULL"),
                "outside_snapshot_rows": self.scalar(f"SELECT count(*) FROM {alias}_all WHERE trim(account_id)<>'' AND trim(security_id)<>'' AND snapshot_day<>DATE {sql_string(self.snapshot)}"),
                "snapshot_valid_key_rows": self.scalar(f"SELECT count(*) FROM {alias}"),
            }
            a = audit[source]
            assert a["raw_rows"] == a["invalid_key_rows"] + a["outside_snapshot_rows"] + a["snapshot_valid_key_rows"]
        for name, pop in self.populations.items():
            pop["affected_entities"] = len(affected.get(name, set()))
            pop["flag_count"] = sum(n for (p, *_), n in counts.items() if p == name)
        path = self.output / "findings.csv"
        with path.open("w", newline="", encoding="utf-8") as stream:
            writer = csv.DictWriter(stream, fieldnames=list(self.findings[0]) if self.findings else [*IDENTITY,"category","status"])
            writer.writeheader()
            writer.writerows(self.findings)
        # Columnar output supports efficient joins in the companion UpSet analysis.
        self.c.execute(f"COPY (SELECT * FROM read_csv({sql_string(path.as_posix())},all_varchar=true)) TO {sql_string((self.output / 'findings.parquet').as_posix())} (FORMAT PARQUET)")
        metadata = {
            "analysis_snapshot": self.snapshot, "runtime_seconds": round(time.perf_counter()-self.started,2),
            "duckdb_version": duckdb.__version__, "categories": self.registry["categories"],
            "checks": sorted(self.checks, key=lambda c: next(i for i,x in enumerate(self.registry["checks"]) if x["id"]==c["id"])),
            "populations": self.populations, "inputs": self.inputs, "row_accounting": audit,
            "finding_identity": list(IDENTITY), "status_order": list(STATUSES),
            "assessment_source_sha256": hashlib.sha256((self.root/self.registry["assessment_notebook"]).read_bytes()).hexdigest(),
            "limitations": [
                "Classification and evidence assessment only. Links do not represent historical propagation or remediation.",
                "Statuses preserve the notebook's assessments. They are not newly adjudicated causal conclusions; zero cleared findings does not mean all hypotheses are defects.",
                "Missing assessments default to Unresolved hypothesis. The custodian-disagreement check currently has no matching assessment in notebook 01.",
                "Physical-row populations preserve repeated IDs. Case populations count ID groups once; their raw_row_lineage lists all physical evidence rows.",
                "The raw BOOKED-only benchmark retains duplicate rows and negative quantities; it does not apply corporate actions or infer opening balances.",
                "Issuer-event terms follow the notebook's explicitly unresolved field-use interpretation. Each event/check is counted once, even if multiple fields trigger.",
                "Expected preferred quotes use the observed vendor/date grid; securities without any price rows are handled by the separate holding-coverage check.",
                "No vendor pricing coverage means absent throughout the extract; it is not a full quote-freshness or valuation-eligibility test.",
            ],
        }
        (self.output / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
        summary = [{"population":p,"category":cat,"check_id":cid,"status":s,"flags":n} for (p,cat,cid,s),n in sorted(counts.items())]
        (self.output / "aggregates.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
        self.c.close()
        return self.findings, metadata


def build_findings(root, output):
    builder = FindingBuilder(root, output)
    builder.load()
    builder.detect()
    return builder.finish()
