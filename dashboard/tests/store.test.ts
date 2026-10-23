// Runs on the store that tests/store_test.sh builds from tests/fixtures/small (STORE_PATH points at it).
// The fixture is made up, so its IDs can be named here.
import { beforeAll, describe, expect, test } from "vitest";
import { getDemoTraces, getMapData, traceRecord } from "@/lib/store";
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
});
