import { describe, expect, test } from "vitest";
import { exampleEvidence, findingSummary, locateFindings, markCounts, traceTone } from "@/lib/trace-findings";
import type { Hop, RegisterMark } from "@/lib/types";

const hop = (overrides: Partial<Hop> = {}): Hop => ({
  id: "transaction", title: "Transaction", table: "transactions", edge: null,
  via: "transaction_id", expected: "one", total: 1, columns: ["transaction_id", "quantity"],
  rows: [{ transaction_id: "TEST-TRADE", transaction_type: "BUY", quantity: "-12" }],
  status: "ok", note: "", ...overrides,
});
const mark = (overrides: Partial<RegisterMark> = {}): RegisterMark => ({
  line: 1, ruleId: "TXN_FIELDS_VALID", finding: "Negative trade quantity", status: "confirmed",
  recordId: "TEST-TRADE", idKind: "transaction_id", mapKind: "node", mapId: "transactions",
  plain: "A trade has a negative quantity.", ...overrides,
});

describe("record links and findings", () => {
  test("a matched transaction with a confirmed finding is red without claiming its links are broken", () => {
    const transaction = hop();
    const nav = hop({ id: "nav", table: "ledger_nav", edge: "nav_check", rows: [{ ledger_id: "TEST-NAV" }] });
    const located = locateFindings([transaction, nav], [mark()]);
    expect(transaction.status).toBe("ok");
    expect(traceTone(transaction.status, located.nodes.transactions)).toBe("bad");
    expect(located.hops.transaction.map((m) => m.finding)).toEqual(["Negative trade quantity"]);
    expect(located.nodes.ledger_nav).toBeUndefined();
    expect(located.edges.nav_check).toBeUndefined();
    expect(exampleEvidence(transaction, mark())).toEqual(["transaction_type = BUY · quantity = -12"]);
  });

  test("a finding is not attached to a different transaction merely because it uses the same table", () => {
    const original = hop();
    const linked = hop({ id: "linked", edge: "correction_link", rows: [{ transaction_id: "TEST-OTHER" }] });
    const located = locateFindings([original, linked], [mark()]);
    expect(located.hops.transaction).toHaveLength(1);
    expect(located.hops.linked).toBeUndefined();
    expect(exampleEvidence(linked, mark())).toEqual([]);
  });

  test("an edge finding appears at the specified connection and its step, without coloring unrelated steps", () => {
    const prices = hop({ id: "prices", table: "prices", edge: "price_check", rows: [{ security_id: "TEST-SEC" }] });
    const finding = mark({ mapKind: "edge", mapId: "price_check", idKind: "security_id", recordId: "TEST-SEC", status: "unresolved" });
    const located = locateFindings([hop(), prices], [finding]);
    expect(located.edges.price_check).toEqual([finding]);
    expect(located.nodes.prices).toEqual([finding]);
    expect(located.nodes.transactions).toBeUndefined();
    expect(traceTone(prices.status, located.edges.price_check)).toBe("warn");
  });

  test("a missing row or preview limit does not erase a known finding's unambiguous location", () => {
    const missing = hop({ rows: [], total: 0, status: "missing" });
    expect(locateFindings([missing], [mark()]).hops.transaction).toEqual([mark()]);
    expect(exampleEvidence(missing, mark())).toEqual([]);
  });

  test("cleared findings do not mask broken links, and uncertainty is not promoted to confirmed", () => {
    expect(traceTone("missing", [mark({ status: "cleared" })])).toBe("bad");
    expect(traceTone("fan_out", [mark({ status: "cleared" })])).toBe("warn");
    expect(traceTone("ok", [mark({ status: "unresolved" })])).toBe("warn");
    expect(findingSummary([mark({ status: "unresolved" })])?.label).toBe("1 unresolved finding");
    expect(findingSummary([])).toBeNull();
  });

  test("multiple examples of one finding are counted once; global finding counts are not used", () => {
    expect(markCounts([mark(), mark({ recordId: "TEST-OTHER" }), mark({ line: 2, status: "cleared" })]))
      .toEqual({ confirmed: 1, unresolved: 0, cleared: 1 });
  });

  test("blank evidence remains blank and no corrected value is invented", () => {
    expect(exampleEvidence(hop({ rows: [{ transaction_id: "TEST-TRADE", quantity: "" }] }), mark()))
      .toEqual(["quantity = blank"]);
  });

  test("a finding without a mapped location is not guessed onto an unrelated step", () => {
    expect(locateFindings([hop()], [mark({ mapKind: "", mapId: "" })]))
      .toEqual({ nodes: {}, edges: {}, hops: {} });
  });
});
