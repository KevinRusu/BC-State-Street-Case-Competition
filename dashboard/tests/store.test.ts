// Runs on the store that tests/store_test.sh builds from tests/fixtures/small (STORE_PATH points at it).
// The fixture is made up, so its IDs can be named here.
import fs from "node:fs";
import path from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { countsFor, totals, type Counts } from "@/lib/findings";
import { getDemoTraces, getMapData, getStoreInfo, storePath, traceRecord } from "@/lib/store";
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
