// Every read of outputs/store.duckdb lives here (read-only; all values bound as parameters).
// Plain Node: no Next.js imports, so the tests can call it directly. Pages go through lib/data.ts.
import fs from "node:fs";
import path from "node:path";
import { DuckDBInstance, type DuckDBConnection, type DuckDBValue } from "@duckdb/node-api";
import type {
  ColumnDoc, DemoTrace, Hop, HopStatus, JoinSide, MapData, MapEdge, MapNode, MapOffice, MapSource, MapStage,
  RegisterLine, RegisterMark, Row, RuleText, Status, StoreInfo, TraceResult,
} from "./types";

export class StoreMissingError extends Error {
  constructor(public readonly file: string) {
    super(`No store at ${file}. Build it from the repo root: uv run python scripts/build_store.py`);
  }
}

/** STORE_PATH if set, else ../outputs/store.duckdb seen from dashboard/. */
export function storePath(): string {
  return process.env.STORE_PATH
    ? path.resolve(process.env.STORE_PATH)
    : path.resolve(process.cwd(), "..", "outputs", "store.duckdb");
}

type Open = { file: string; mtimeMs: number; instance: DuckDBInstance };
const cache = globalThis as unknown as { __dataMapStore?: Promise<Open> };

/** One read-only instance per store file, reopened when the file is rebuilt; a fresh connection per call. */
async function connect(): Promise<DuckDBConnection> {
  const file = storePath();
  let mtimeMs: number;
  try {
    mtimeMs = fs.statSync(file).mtimeMs;
  } catch {
    throw new StoreMissingError(file);
  }
  const current = cache.__dataMapStore ? await cache.__dataMapStore.catch(() => undefined) : undefined;
  if (!current || current.file !== file || current.mtimeMs !== mtimeMs) {
    current?.instance.closeSync();
    cache.__dataMapStore = DuckDBInstance.create(file, { access_mode: "READ_ONLY" }).then((instance) => ({
      file, mtimeMs, instance,
    }));
  }
  return (await cache.__dataMapStore!).instance.connect();
}

type Raw = Record<string, unknown>;

async function rows(con: DuckDBConnection, sql: string, params: DuckDBValue[] = []): Promise<Raw[]> {
  const reader = await con.runAndReadAll(sql, params);
  return reader.getRowObjectsJson() as Raw[];
}

const num = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : Number(v));
const text = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const STATUS_ORDER: Status[] = ["orphans", "fan_out", "blank_keys", "ok", "info"];

function toInfo(r: Raw): StoreInfo {
  return {
    builtAt: text(r.built_at), snapshotDate: text(r.snapshot_date), manifest: text(r.manifest),
    manifestChecksum: text(r.manifest_checksum), registerChecksum: text(r.register_checksum),
    registerLines: num(r.register_lines),
  };
}

export async function getStoreInfo(): Promise<StoreInfo> {
  const con = await connect();
  try {
    return toInfo((await rows(con, "SELECT * FROM store_info"))[0]);
  } finally {
    con.closeSync();
  }
}

export async function getMapData(): Promise<MapData> {
  const con = await connect();
  try {
    const placement = await rows(con, "SELECT rule_id, target_kind, target_id FROM rule_placement");
    const rulesOf = (kind: string, id: string) =>
      placement.filter((p) => p.target_kind === kind && p.target_id === id).map((p) => text(p.rule_id));

    const health: JoinSide[] = (await rows(con, "SELECT * FROM join_health")).map((r) => ({
      edgeId: text(r.edge_id), joinId: text(r.join_id), joinLabel: text(r.join_label),
      side: text(r.side) as JoinSide["side"], table: text(r.table_name), keys: text(r.keys), filter: text(r.filter),
      required: Boolean(r.required), uniqueExpected: Boolean(r.unique_expected),
      observedCardinality: text(r.observed_cardinality), status: text(r.status) as Status, rows: num(r.rows),
      blankKeyRows: num(r.blank_key_rows), distinctKeys: num(r.distinct_keys), maxRowsPerKey: num(r.max_rows_per_key),
      repeatedKeys: num(r.repeated_keys), orphanKeys: num(r.orphan_keys), orphanRows: num(r.orphan_rows),
      sampleOrphans: text(r.sample_orphans), sampleRepeated: text(r.sample_repeated),
    }));
    const worst = (edgeId: string): Status =>
      health.filter((h) => h.edgeId === edgeId)
        .map((h) => h.status)
        .sort((a, b) => STATUS_ORDER.indexOf(a) - STATUS_ORDER.indexOf(b))[0] ?? "info";

    const offices: MapOffice[] = (await rows(con, "SELECT * FROM map_offices")).map((r) => ({
      id: text(r.id), label: text(r.label), kind: text(r.kind) as MapOffice["kind"],
      x: num(r.x), y: num(r.y), w: num(r.w), h: num(r.h),
    }));
    const stages: MapStage[] = (await rows(con, "SELECT * FROM map_stages")).map((r) => ({
      id: text(r.id), label: text(r.label), note: text(r.note), x: num(r.x), w: num(r.w),
    }));
    const sources = await rows(con, "SELECT * FROM map_sources ORDER BY node_id, position");
    const sourcesOf = (id: string): MapSource[] => sources.filter((s) => s.node_id === id).map((s) => ({
      label: text(s.label), evidence: text(s.evidence) as MapSource["evidence"], column: text(s.column_ref),
      values: text(s.source_values).split("; ").filter(Boolean), reason: text(s.reason),
    }));
    const nodes: MapNode[] = (await rows(con, "SELECT * FROM map_nodes")).map((r) => ({
      id: text(r.id), label: text(r.label), office: text(r.office), stage: text(r.stage), place: text(r.place),
      check: text(r.check), owner: text(r.owner), checkOffice: text(r.check_office), x: num(r.x), y: num(r.y),
      grain: text(r.grain), note: text(r.note), rows: num(r.rows), manifestRows: num(r.manifest_rows),
      columns: num(r.columns), unreadableDates: text(r.unreadable_dates), rules: rulesOf("node", text(r.id)),
      sources: sourcesOf(text(r.id)),
    }));
    const edges: MapEdge[] = (await rows(con, "SELECT * FROM map_edges")).map((r) => ({
      id: text(r.id), source: text(r.source), target: text(r.target), kind: text(r.kind) as MapEdge["kind"],
      handoff: r.handoff === null ? null : num(r.handoff), label: text(r.label), expected: text(r.expected),
      inferred: Boolean(r.inferred), status: worst(text(r.id)), rules: rulesOf("edge", text(r.id)),
      check: text(r.check), owner: text(r.owner), checkOffice: text(r.check_office),
      fromHandle: text(r.from_handle), toHandle: text(r.to_handle), tagAt: num(r.tag_at),
      tagSide: text(r.tag_side) as MapEdge["tagSide"],
    }));
    const register: RegisterLine[] = (await rows(con, "SELECT * FROM register ORDER BY line")).map((r) => ({
      line: num(r.line), ruleId: text(r.rule_id), finding: text(r.finding), status: text(r.status),
      stage: text(r.stage), unit: text(r.unit), affected: num(r.affected), eligible: num(r.eligible),
      notEvaluable: num(r.not_evaluable), examples: text(r.examples), idKind: text(r.id_kind),
      mapKind: text(r.map_kind) as RegisterLine["mapKind"], mapId: text(r.map_id),
    }));
    const catalog: RuleText[] = (await rows(con, "SELECT * FROM rule_catalog")).map((r) => ({
      ruleId: text(r.rule_id), section: text(r.section), test: text(r.test), onFail: text(r.on_fail), note: text(r.note),
    }));
    const columns: ColumnDoc[] = (await rows(con, "SELECT * FROM column_dictionary")).map((r) => ({
      table: text(r.table_name), column: text(r.column_name), intendedType: text(r.intended_type),
      description: text(r.description),
    }));
    const info = toInfo((await rows(con, "SELECT * FROM store_info"))[0]);
    return { info, offices, stages, nodes, edges, health, register, catalog, columns };
  } finally {
    con.closeSync();
  }
}

export async function getDemoTraces(): Promise<DemoTrace[]> {
  const con = await connect();
  try {
    return (await rows(con, "SELECT * FROM demo_traces ORDER BY position")).map((r) => ({
      position: num(r.position), recordId: text(r.record_id), label: text(r.label), status: text(r.status),
      source: text(r.source),
    }));
  } finally {
    con.closeSync();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Record trace: find what the ID is, then walk the joins from it. Each hop shows the raw rows (as text) it matched.

const ROW_LIMIT = 50;
// Only these tables are ever named in SQL; the record ID and keys are always bound parameters.
const TABLES = new Set([
  "transactions", "pipeline_events", "positions", "comparison_positions", "accounts", "securities",
  "corporate_actions", "prices", "fx_rates", "ledger_nav",
]);

type HopSpec = {
  id: string;
  title: string;
  table: string;
  edge: string | null;
  via: string;
  expected: Hop["expected"];
  where: string;
  params: string[];
  missingNote?: string;
};

function statusFor(expected: Hop["expected"], total: number): HopStatus {
  if (expected === "any") return "info";
  if (total === 0) return "missing";
  return expected === "one" && total > 1 ? "fan_out" : "ok";
}

async function displayColumns(con: DuckDBConnection, table: string): Promise<string[]> {
  const found = await rows(con,
    "SELECT column_name FROM information_schema.columns WHERE table_name = $1 " +
    "AND NOT ends_with(column_name, '_norm') ORDER BY ordinal_position", [table]);
  return found.map((r) => text(r.column_name));
}

async function runHop(con: DuckDBConnection, spec: HopSpec): Promise<Hop> {
  if (!TABLES.has(spec.table)) throw new Error(`unknown table ${spec.table}`);
  const columns = await displayColumns(con, spec.table);
  const select = columns.map((c) => `"${c}"`).join(", ");
  const total = num((await rows(con, `SELECT count(*) AS n FROM ${spec.table} WHERE ${spec.where}`, spec.params))[0].n);
  const data = await rows(con,
    `SELECT ${select} FROM ${spec.table} WHERE ${spec.where} ORDER BY source_row LIMIT ${ROW_LIMIT}`, spec.params);
  const status = statusFor(spec.expected, total);
  return {
    id: spec.id, title: spec.title, table: spec.table, edge: spec.edge, via: spec.via, expected: spec.expected,
    total, columns, rows: data.map((r) => Object.fromEntries(columns.map((c) => [c, r[c] === null ? null : text(r[c])]))),
    status, note: status === "missing" ? spec.missingNote ?? "" : "",
  };
}

function notReached(id: string, title: string, table: string, edge: string | null, note: string): Hop {
  return { id, title, table, edge, via: "", expected: "one", total: 0, columns: [], rows: [], status: "not_reached", note };
}

async function exists(con: DuckDBConnection, table: string, column: string, value: string): Promise<boolean> {
  if (!TABLES.has(table)) throw new Error(`unknown table ${table}`);
  return (await rows(con, `SELECT 1 FROM ${table} WHERE "${column}" = $1 LIMIT 1`, [value])).length > 0;
}

type Start = {
  kind: string; txn?: string; position?: string; custodian?: string; account?: string; security?: string;
  ledger?: string; fund?: string; action?: string;
};

async function resolve(con: DuckDBConnection, id: string): Promise<Start | null> {
  if (id.includes("/")) {
    const [account, security] = id.split("/").map((s) => s.trim());
    for (const table of ["positions", "comparison_positions", "transactions"]) {
      if ((await rows(con, `SELECT 1 FROM ${table} WHERE account_id = $1 AND security_id = $2 LIMIT 1`, [account, security])).length)
        return { kind: "account + security key", account, security };
    }
    return null;
  }
  if (await exists(con, "transactions", "transaction_id", id)) return { kind: "transaction", txn: id };
  if (await exists(con, "positions", "position_id", id)) return { kind: "position", position: id };
  if (await exists(con, "comparison_positions", "comparison_id", id)) return { kind: "custodian position", custodian: id };
  if (await exists(con, "accounts", "account_id", id)) return { kind: "account", account: id };
  for (const table of ["positions", "transactions", "comparison_positions"]) {
    if (await exists(con, table, "account_id", id)) return { kind: "account (missing from accounts)", account: id };
  }
  if (await exists(con, "securities", "security_id", id)) return { kind: "security", security: id };
  for (const table of ["positions", "transactions", "prices"]) {
    if (await exists(con, table, "security_id", id)) return { kind: "security (missing from securities)", security: id };
  }
  if (await exists(con, "ledger_nav", "ledger_id", id)) return { kind: "ledger line", ledger: id };
  if (await exists(con, "corporate_actions", "action_id", id)) return { kind: "corporate action", action: id };
  if ((await exists(con, "ledger_nav", "fund_id", id)) || (await exists(con, "accounts", "fund_id", id)))
    return { kind: "fund", fund: id };
  return null;
}

export async function traceRecord(query: string): Promise<TraceResult> {
  const id = query.trim();
  if (!id) return { found: false, query: id };
  const con = await connect();
  try {
    const snapshot = text((await rows(con, "SELECT snapshot_date FROM store_info"))[0].snapshot_date);
    const start = await resolve(con, id);
    if (!start) return { found: false, query: id };
    const hops: Hop[] = [];
    const add = async (spec: HopSpec) => {
      const hop = await runHop(con, spec);
      hops.push(hop);
      return hop;
    };
    let { account, security } = start;
    let fromTrade = false;

    // 1. The record itself.
    if (start.txn) {
      fromTrade = true;
      const trade = await add({ id: "transaction", title: "Transaction", table: "transactions", edge: null,
        via: `transaction_id = ${id}`, expected: "one", where: "transaction_id = $1", params: [id] });
      account = trade.rows[0]?.account_id ?? undefined;
      security = trade.rows[0]?.security_id ?? undefined;
      if (trade.total > 1) trade.note = `${trade.total} rows share this transaction_id (see the register's duplicate findings)`;
      await add({ id: "pipeline", title: "Pipeline event", table: "pipeline_events", edge: "booking",
        via: "pipeline_events.transaction_id", expected: "one", where: "transaction_id = $1", params: [id],
        missingNote: "no pipeline record: the trade has no timestamps" });
      const related = trade.rows[0]?.related_transaction_id;
      if (related) {
        await add({ id: "linked", title: "Transaction it points to", table: "transactions", edge: "correction_link",
          via: `related_transaction_id = ${related}`, expected: "one", where: "transaction_id = $1", params: [related],
          missingNote: "related_transaction_id points to an ID that does not exist" });
      }
      const pointing = await runHop(con, { id: "pointing", title: "Rows that point to it", table: "transactions",
        edge: "correction_link", via: `related_transaction_id = ${id}`, expected: "any",
        where: "related_transaction_id = $1", params: [id] });
      if (pointing.total) hops.push(pointing);
    } else if (start.position) {
      const position = await add({ id: "position", title: "Position (our book)", table: "positions", edge: null,
        via: `position_id = ${id}`, expected: "one", where: "position_id = $1", params: [id] });
      account = position.rows[0]?.account_id ?? undefined;
      security = position.rows[0]?.security_id ?? undefined;
    } else if (start.custodian) {
      const custodian = await add({ id: "custodian", title: "Custodian position", table: "comparison_positions",
        edge: null, via: `comparison_id = ${id}`, expected: "one", where: "comparison_id = $1", params: [id] });
      account = custodian.rows[0]?.account_id ?? undefined;
      security = custodian.rows[0]?.security_id ?? undefined;
    } else if (start.ledger) {
      const line = await add({ id: "ledger", title: "Ledger NAV line", table: "ledger_nav", edge: null,
        via: `ledger_id = ${id}`, expected: "one", where: "ledger_id = $1", params: [id] });
      const fund = line.rows[0]?.fund_id ?? "", shareClass = line.rows[0]?.share_class ?? "";
      await add({ id: "class_accounts", title: "Accounts in this fund + share class", table: "accounts",
        edge: "class_mapping", via: `fund_id = ${fund}, share_class = ${shareClass}`, expected: "one_or_more",
        where: "fund_id = $1 AND share_class = $2", params: [fund, shareClass],
        missingNote: "no account maps to this fund + share class" });
    } else if (start.fund) {
      await add({ id: "ledger", title: "Ledger NAV lines of this fund", table: "ledger_nav", edge: null,
        via: `fund_id = ${id}`, expected: "one_or_more", where: "fund_id = $1", params: [id] });
      await add({ id: "fund_accounts", title: "Accounts in this fund", table: "accounts", edge: "class_mapping",
        via: `fund_id = ${id}`, expected: "one_or_more", where: "fund_id = $1", params: [id],
        missingNote: "no account belongs to this fund" });
    } else if (start.action) {
      const action = await add({ id: "action", title: "Corporate action", table: "corporate_actions", edge: null,
        via: `action_id = ${id}`, expected: "one", where: "action_id = $1", params: [id] });
      const source = action.rows[0]?.security_id ?? "", target = action.rows[0]?.target_security_id ?? "";
      await add({ id: "source_security", title: "Source security", table: "securities", edge: "ca_securities",
        via: `security_id = ${source}`, expected: "one", where: "security_id = $1", params: [source],
        missingNote: "source security not in securities" });
      if (target) {
        await add({ id: "target_security", title: "Target security", table: "securities", edge: "ca_securities",
          via: `target_security_id = ${target}`, expected: "one", where: "security_id = $1", params: [target],
          missingNote: "target security not in securities: the event cannot be applied" });
      }
      await add({ id: "holders", title: "Candidate holders (positions in the source security)", table: "positions",
        edge: "ca_check", via: `security_id = ${source}`, expected: "any", where: "security_id = $1", params: [source] });
    }

    // 2. Master data, holdings, prices and NAV from the account and security the record names.
    let accountRow: Row | undefined;
    if (account) {
      const acc = await add({ id: "account", title: "Account", table: "accounts",
        edge: fromTrade ? "account_check" : "position_account", via: `account_id = ${account}`, expected: "one",
        where: "account_id = $1", params: [account], missingNote: "account_id not in accounts" });
      accountRow = acc.rows[0];
    }
    if (security) {
      await add({ id: "security", title: "Security", table: "securities",
        edge: fromTrade ? "security_check" : "position_security", via: `security_id = ${security}`, expected: "one",
        where: "security_id = $1", params: [security], missingNote: "security_id not in securities" });
    }
    if (account && security) {
      if (!fromTrade) {
        await add({ id: "key_trades", title: "Trades on this account + security", table: "transactions",
          edge: "trade_check", via: `account_id = ${account}, security_id = ${security}`, expected: "any",
          where: "account_id = $1 AND security_id = $2", params: [account, security] });
      }
      if (!start.position) {
        await add({ id: "position", title: "Position (our book)", table: "positions", edge: "trade_check",
          via: `account_id = ${account}, security_id = ${security}`, expected: "one",
          where: "account_id = $1 AND security_id = $2", params: [account, security],
          missingNote: "no position in the book for this account + security" });
      }
      if (!start.custodian) {
        await add({ id: "custodian", title: "Custodian position", table: "comparison_positions", edge: "position_check",
          via: `account_id = ${account}, security_id = ${security}`, expected: "one",
          where: "account_id = $1 AND security_id = $2", params: [account, security],
          missingNote: "the custodian reports nothing for this account + security" });
      }
    } else if (account) {
      await add({ id: "account_positions", title: "Positions of this account", table: "positions",
        edge: "position_account", via: `account_id = ${account}`, expected: "any", where: "account_id = $1", params: [account] });
      await add({ id: "account_trades", title: "Trades of this account", table: "transactions", edge: "account_check",
        via: `account_id = ${account}`, expected: "any", where: "account_id = $1", params: [account] });
    } else if (security && !start.action) {
      await add({ id: "security_positions", title: "Positions in this security", table: "positions",
        edge: "position_security", via: `security_id = ${security}`, expected: "any", where: "security_id = $1", params: [security] });
    }
    if (security) {
      const prices = await add({ id: "prices", title: "Prices on the snapshot date", table: "prices", edge: "price_check",
        via: `security_id = ${security}, price_date = ${snapshot}`, expected: "one_or_more",
        where: "security_id = $1 AND price_date_norm = $2", params: [security, snapshot],
        missingNote: "no vendor price on the snapshot date: the holding cannot be valued" });
      if (prices.total) {
        const fx = await add({ id: "fx", title: "FX rates for those prices", table: "fx_rates", edge: "fx_lookup",
          via: `currency + rate_date = ${snapshot}`, expected: "one_or_more",
          where: "(currency, rate_date_norm) IN (SELECT currency, price_date_norm FROM prices " +
                 "WHERE security_id = $1 AND price_date_norm = $2)", params: [security, snapshot] });
        const perCurrency = await rows(con,
          "SELECT p.currency, count(f.currency) AS n FROM (SELECT DISTINCT currency, price_date_norm FROM prices " +
          "WHERE security_id = $1 AND price_date_norm = $2) p LEFT JOIN fx_rates f " +
          "ON f.currency = p.currency AND f.rate_date_norm = p.price_date_norm GROUP BY p.currency ORDER BY 1",
          [security, snapshot]);
        const missing = perCurrency.filter((r) => num(r.n) === 0).map((r) => text(r.currency));
        const repeated = perCurrency.filter((r) => num(r.n) > 1).map((r) => text(r.currency));
        fx.status = missing.length ? "missing" : repeated.length ? "fan_out" : "ok";
        fx.note = missing.length ? `no rate for ${missing.join(", ")} on ${snapshot}`
          : repeated.length ? `more than one rate for ${repeated.join(", ")}` : "";
      } else {
        hops.push(notReached("fx", "FX rates for those prices", "fx_rates", "fx_lookup", "no price to convert"));
      }
      if (!start.action) {
        await add({ id: "corporate_actions", title: "Corporate actions on this security", table: "corporate_actions",
          edge: "ca_check", via: `security_id or target_security_id = ${security}`, expected: "any",
          where: "security_id = $1 OR target_security_id = $1", params: [security] });
      }
    }
    if (account) {
      if (accountRow) {
        const fund = accountRow.fund_id ?? "", shareClass = accountRow.share_class ?? "";
        await add({ id: "nav", title: "Ledger NAV on the snapshot date", table: "ledger_nav", edge: "nav_check",
          via: `fund_id = ${fund}, share_class = ${shareClass}, as_of_date = ${snapshot}`, expected: "one",
          where: "fund_id = $1 AND share_class = $2 AND as_of_date_norm = $3", params: [fund, shareClass, snapshot],
          missingNote: "no ledger line for this fund + share class on the snapshot date" });
      } else {
        hops.push(notReached("nav", "Ledger NAV on the snapshot date", "ledger_nav", "nav_check",
          "the account is not in accounts, so there is no fund or share class to roll up to"));
      }
    }

    // 3. Where this record (or its account + security key) is an example in notebook 02's register.
    const ids = [id, ...(account && security ? [`${account}/${security}`] : [])];
    const marks: RegisterMark[] = (await rows(con,
      "SELECT DISTINCT line, rule_id, finding, status, record_id FROM register_examples " +
      `WHERE record_id IN (${ids.map((_, i) => `$${i + 1}`).join(", ")}) ORDER BY line`, ids)).map((r) => ({
      line: num(r.line), ruleId: text(r.rule_id), finding: text(r.finding), status: text(r.status),
      recordId: text(r.record_id),
    }));
    const summary = [account && `account ${account}`, security && `security ${security}`].filter(Boolean).join(" · ");
    return { found: true, query: id, kind: start.kind, summary, hops, marks };
  } finally {
    con.closeSync();
  }
}
