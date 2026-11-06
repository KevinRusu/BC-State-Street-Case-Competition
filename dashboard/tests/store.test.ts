// Runs on a store built from tests/fixtures/small (STORE_PATH points at it): `npm test` builds it with
// tests/prepare_dashboard_fixture.py, and tests/store_test.sh builds its own. The fixture is made up, so its IDs can
// be named here.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { countsFor, totals, type Counts } from "@/lib/findings";
import { getDemoTraces, getMapData, getStoreInfo, registerState, storePath, traceRecord } from "@/lib/store";
import { locateFindings, traceTone } from "@/lib/trace-findings";
import type { MapData } from "@/lib/types";

let map: MapData;
beforeAll(async () => {
  expect(process.env.STORE_PATH, "run tests/store_test.sh from the repo root").toBeTruthy();
  map = await getMapData();
});

const hop = async (id: string, hopId: string) => {
  const trace = await traceRecord(id);
  if (!trace.found) throw new Error(`${id} not found`);
  return trace.hops.find((h) => h.id === hopId);
};

describe("map", () => {
  test("every table loaded with the manifest's row count", () => {
    expect(map.nodes).toHaveLength(10);
    for (const node of map.nodes) expect(node.rows, node.id).toBe(node.manifestRows);
  });

  test("the repeated FXT02 shows as repeated keys on the booking join", () => {
    expect(map.edges.find((e) => e.id === "booking")?.status).toBe("fan_out");
  });

  test("dates join in either format: the EUR rate on 10/07/2026 matches, 2026-07-09 has none", () => {
    const prices = map.health.find((h) => h.joinId === "price_fx" && h.side === "left")!;
    expect(prices.orphanKeys).toBe(1);
    expect(prices.sampleOrphans).toBe("EUR/2026-07-09");
  });

  test("every edge's rules exist in docs/RULES.md", () => {
    const known = new Set(map.catalog.map((r) => r.ruleId));
    for (const ruleId of [...map.nodes.flatMap((n) => n.rules), ...map.edges.flatMap((e) => e.rules)])
      expect(known.has(ruleId), ruleId).toBe(true);
  });

  test("every table sits in a known office row and stage column", () => {
    for (const node of map.nodes) {
      expect(map.offices.some((o) => o.id === node.office), node.id).toBe(true);
      expect(map.stages.some((s) => s.id === node.stage), node.id).toBe(true);
    }
  });

  test("every handoff check has an owner and an office", () => {
    for (const edge of map.edges.filter((e) => e.handoff !== null)) {
      expect(edge.owner, edge.id).not.toBe("");
      expect(edge.checkOffice, edge.id).not.toBe("");
    }
  });

  test("every register line is counted once on the map", () => {
    const sum: Counts = { confirmed: 0, unresolved: 0, cleared: 0 };
    const add = (c: Counts) => (Object.keys(sum) as (keyof Counts)[]).forEach((k) => (sum[k] += c[k]));
    for (const node of map.nodes) add(countsFor(map.register, "node", node.id));
    for (const edge of map.edges) add(countsFor(map.register, "edge", edge.id));
    expect(sum).toEqual(totals(map.register));
    expect(map.register.length).toBeGreaterThan(0);
  });

  test("comes-from chips come from the data", () => {
    expect(map.nodes.find((n) => n.id === "transactions")?.sources).toEqual([
      { label: "1 trade system", evidence: "data", column: "transactions.source_system", values: ["FIXTURE_OMS"], reason: "" },
    ]);
    expect(map.nodes.find((n) => n.id === "accounts")?.sources[0].values).toEqual([]);
  });
});

describe("trace", () => {
  test("a negative quantity retains a successful row lookup and its confirmed finding location", async () => {
    const trace = await traceRecord("FXT03");
    if (!trace.found) throw new Error("FXT03 not found");
    const transaction = trace.hops.find((h) => h.id === "transaction")!;
    expect(transaction.status).toBe("ok");
    expect(trace.marks.find((m) => m.finding === "Negative trade quantity"))
      .toMatchObject({ recordId: "FXT03", idKind: "transaction_id", mapKind: "node", mapId: "transactions", status: "confirmed" });
    const located = locateFindings(trace.hops, trace.marks);
    expect(traceTone(transaction.status, located.nodes.transactions)).toBe("bad");
    expect(located.hops.transaction.some((m) => m.finding === "Negative trade quantity")).toBe(true);
  });

  test("a clean trade reaches the fund's ledger line", async () => {
    const nav = await hop("FXT01", "nav");
    expect(nav?.status).toBe("ok");
    expect(nav?.rows[0].ledger_id).toBe("FXL1");
  });

  test("a duplicated transaction_id fans out", async () => {
    expect((await hop("FXT02", "transaction"))?.status).toBe("fan_out");
    expect((await hop("FXT02", "pipeline"))?.status).toBe("fan_out");
  });

  test("an account + security key finds its position and custodian record", async () => {
    expect((await hop("FXACC2/FXSEC1", "position"))?.rows[0].position_id).toBe("FXP3");
    expect((await hop("FXACC2/FXSEC1", "custodian"))?.rows[0].comparison_id).toBe("FXC3");
  });

  test("an unknown ID is not found", async () => {
    expect((await traceRecord("NOPE123")).found).toBe(false);
  });

  test("a key with a blank half is not a key", async () => {
    for (const id of ["FXACC1/", "/FXSEC1", "/", "FXACC1/FXSEC1/x"]) expect((await traceRecord(id)).found, id).toBe(false);
  });

  test("a record the register counts but does not list as an example still carries its finding", async () => {
    // FXT22 is the fourth of four REVERSED rows on two originals; the register lists only three examples.
    const trace = await traceRecord("FXT22");
    if (!trace.found) throw new Error("FXT22 not found");
    expect(trace.marks.find((m) => m.finding === "More than one REVERSED row per original"))
      .toMatchObject({ recordId: "FXT22", idKind: "transaction_id", status: "unresolved" });
  });

  test("a corporate action's trace reaches the prices and FX of its source security", async () => {
    expect((await hop("FXCA2", "prices"))?.status).toBe("ok");
    expect((await hop("FXCA2", "fx"))?.status).not.toBe("not_reached");
  });

  test("a missing account breaks its link without erasing an existing transaction finding", async () => {
    const copy = path.join(path.dirname(storePath()), "store_missing_account.duckdb");
    fs.copyFileSync(storePath(), copy);
    const writer = await DuckDBInstance.create(copy);
    const con = await writer.connect();
    await con.run("DELETE FROM accounts WHERE account_id = 'FXACC1'");
    con.closeSync();
    writer.closeSync();
    const saved = process.env.STORE_PATH;
    process.env.STORE_PATH = copy;
    try {
      const trace = await traceRecord("FXT03");
      if (!trace.found) throw new Error("FXT03 not found");
      expect(trace.hops.find((h) => h.id === "account")?.status).toBe("missing");
      expect(trace.hops.find((h) => h.id === "nav")?.status).toBe("not_reached");
      expect(locateFindings(trace.hops, trace.marks).hops.transaction)
        .toEqual(expect.arrayContaining([expect.objectContaining({ finding: "Negative trade quantity", status: "confirmed" })]));
    } finally {
      process.env.STORE_PATH = saved;
    }
  });

  test("demo traces come from the outputs, not from the code", async () => {
    const demos = await getDemoTraces();
    for (const demo of demos) expect((await traceRecord(demo.recordId)).found, demo.recordId).toBe(true);
  });

  test("a register example named by the trade's security shows on the trade's trace", async () => {
    const trace = await traceRecord("FXT01");
    if (!trace.found) throw new Error("FXT01 not found");
    expect(trace.marks.map((m) => [m.ruleId, m.recordId])).toContainEqual(["PRC_QUOTE_ELIGIBLE", "FXSEC1"]);
  });

  test("the position and custodian steps stay on the snapshot date", async () => {
    // A copy of the store where FXACC1/FXSEC1 also has an older row in both position tables.
    const copy = path.join(path.dirname(storePath()), "store_two_dates.duckdb");
    fs.copyFileSync(storePath(), copy);
    const writer = await DuckDBInstance.create(copy);
    const con = await writer.connect();
    for (const [table, id] of [["positions", "position_id"], ["comparison_positions", "comparison_id"]]) {
      await con.run(`INSERT INTO ${table} SELECT * REPLACE (${id} || '_OLD' AS ${id}, '2026-07-09' AS as_of_date, ` +
        `'2026-07-09' AS as_of_date_norm) FROM ${table} WHERE account_id = 'FXACC1' AND security_id = 'FXSEC1'`);
    }
    con.closeSync();
    writer.closeSync();
    const saved = process.env.STORE_PATH;
    process.env.STORE_PATH = copy;
    try {
      expect((await hop("FXT01", "position"))?.status).toBe("ok");
      expect((await hop("FXT01", "custodian"))?.status).toBe("ok");
    } finally {
      process.env.STORE_PATH = saved;
    }
  });
});

describe("store freshness", () => {
  test("the store built from the current register says so, and its marks come from the full member list", async () => {
    const info = await getStoreInfo();
    expect(info.registerState).toBe("current");
    expect(info.memberSource).toBe("members");
  });

  test("a store from before this check (no register path) is checked against the register beside it", async () => {
    const copy = path.join(path.dirname(storePath()), "store_no_register_path.duckdb");
    fs.copyFileSync(storePath(), copy);
    const writer = await DuckDBInstance.create(copy);
    const con = await writer.connect();
    await con.run("ALTER TABLE store_info DROP COLUMN register_path");   // as the builder wrote it before 6 Nov
    await con.run("ALTER TABLE store_info DROP COLUMN member_source");
    con.closeSync();
    writer.closeSync();
    const saved = process.env.STORE_PATH;
    process.env.STORE_PATH = copy;
    try {
      const info = await getStoreInfo();
      expect(info.registerState).toBe("current");
      expect(info.memberSource).toBe("examples");   // no member_source column: an older store marks examples only
    } finally {
      process.env.STORE_PATH = saved;
    }
  });

  test("a register rewritten after the build makes the store stale; a deleted one makes it unknown", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "register-"));
    const file = path.join(dir, "02_defect_register.csv");
    fs.writeFileSync(file, "finding\nA\n");
    const built = registerState("", file).checksum;
    expect(registerState(built, file).state).toBe("current");
    fs.writeFileSync(file, "finding\nB\n");
    expect(registerState(built, file).state).toBe("stale");
    fs.rmSync(file);
    expect(registerState(built, file).state).toBe("missing");
  });

  test("a register written on Windows (CRLF) has the same checksum as its Mac copy (D-053)", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "register-"));
    const mac = path.join(dir, "mac.csv"), windows = path.join(dir, "windows.csv");
    fs.writeFileSync(mac, "finding,status\nA,confirmed\n");
    fs.writeFileSync(windows, "finding,status\r\nA,confirmed\r\n");
    const built = registerState("", mac).checksum;
    expect(registerState(built, windows).state).toBe("current");
  });
});

describe("store file", () => {
  test("a relative STORE_PATH starts at the repo root, as in scripts/build_store.py", () => {
    const saved = process.env.STORE_PATH;
    process.env.STORE_PATH = "outputs/alt.duckdb";
    try {
      expect(storePath()).toBe(path.resolve(process.cwd(), "..", "outputs", "alt.duckdb"));
    } finally {
      process.env.STORE_PATH = saved;
    }
  });

  test("a rebuilt store opens once for requests that arrive together, and a request in flight still works", async () => {
    await getStoreInfo();
    const create = vi.spyOn(DuckDBInstance, "create");
    try {
      const inFlight = traceRecord("FXT01"); // connects to the instance open now
      const later = new Date(Date.now() + 60_000); // what a rebuild does to the file
      fs.utimesSync(storePath(), later, later);
      const [trace] = await Promise.all([inFlight, getStoreInfo(), getMapData(), getDemoTraces()]);
      expect(trace.found).toBe(true);
      expect(create).toHaveBeenCalledTimes(1);
    } finally {
      create.mockRestore();
    }
  });
});
