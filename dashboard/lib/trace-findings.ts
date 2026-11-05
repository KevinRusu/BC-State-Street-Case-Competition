// Presentation of existing notebook register examples. This does not run new detection rules.
import { REGISTER_STATUS, HOP_STATUS } from "./status";
import type { Counts } from "./findings";
import type { Hop, HopStatus, RegisterMark, Row } from "./types";

export type TraceFindings = {
  nodes: Record<string, RegisterMark[]>;
  edges: Record<string, RegisterMark[]>;
  hops: Record<string, RegisterMark[]>;
};

/** Count finding entries once even if two of their example IDs appear in this trace. */
export function markCounts(marks: RegisterMark[]): Counts {
  const entries = new Map(marks.map((mark) => [mark.line, mark]));
  const count = (status: string) => [...entries.values()].filter((m) => m.status === status).length;
  return { confirmed: count("confirmed"), unresolved: count("unresolved"), cleared: count("cleared") };
}

export function findingSummary(marks: RegisterMark[]) {
  const counts = markCounts(marks);
  for (const status of ["confirmed", "unresolved", "cleared"] as const) {
    const n = counts[status];
    if (n) return { tone: REGISTER_STATUS[status], label: `${n} ${status} finding${n === 1 ? "" : "s"}` };
  }
  return null;
}

/** A cleared finding must never hide a missing link or repeated-key warning. */
export function traceTone(status: HopStatus, marks: RegisterMark[]) {
  const linkTone = HOP_STATUS[status].tone;
  const findingTone = findingSummary(marks)?.tone;
  if (linkTone === "bad" || findingTone === "bad") return "bad";
  if (linkTone === "warn" || findingTone === "warn") return "warn";
  return findingTone ?? linkTone;
}

export function matchesExample(row: Row, mark: RegisterMark): boolean {
  if (mark.idKind === "account/security") return `${row.account_id}/${row.security_id}` === mark.recordId;
  return row[mark.idKind] === mark.recordId;
}

/** Attach an example to its recorded location, and to the matching step when a table occurs twice. */
export function locateFindings(hops: Hop[], marks: RegisterMark[]): TraceFindings {
  const result: TraceFindings = { nodes: {}, edges: {}, hops: {} };
  const add = (group: Record<string, RegisterMark[]>, key: string, mark: RegisterMark) => {
    const list = group[key] ??= [];
    if (!list.some((m) => m.line === mark.line && m.recordId === mark.recordId)) list.push(mark);
  };
  for (const mark of marks) {
    const candidates = hops.filter((hop) => mark.mapKind === "node" ? hop.table === mark.mapId
      : mark.mapKind === "edge" && hop.edge === mark.mapId);
    const matched = candidates.filter((hop) => hop.rows.some((row) => matchesExample(row, mark)));
    // A single step still identifies the location when its row is missing or beyond the preview limit.
    const targets = matched.length ? matched : candidates.length === 1 ? candidates : [];
    for (const hop of targets) {
      add(result.hops, hop.id, mark);
      add(result.nodes, hop.table, mark);
      if (mark.mapKind === "edge") add(result.edges, mark.mapId, mark);
    }
  }
  return result;
}

const FIELDS: Record<string, string[]> = {
  transactions: ["transaction_type", "quantity", "trade_date", "settlement_date"],
  positions: ["quantity", "as_of_date"],
  ledger_nav: ["net_assets", "shares_outstanding", "nav_per_share"],
  prices: ["vendor", "price", "currency", "price_date"],
  fx_rates: ["currency", "rate_to_usd", "rate_date"],
  corporate_actions: ["action_type", "ratio", "target_security_id"],
};

/** Display raw evidence without deriving a corrected value or repeating the rule in the browser. */
export function exampleEvidence(hop: Hop, mark: RegisterMark): string[] {
  return hop.rows.filter((row) => matchesExample(row, mark)).slice(0, 3).map((row) =>
    (FIELDS[hop.table] ?? []).filter((field) => field in row)
      .map((field) => `${field} = ${row[field] === null || row[field] === "" ? "blank" : row[field]}`).join(" · "))
    .filter(Boolean);
}
