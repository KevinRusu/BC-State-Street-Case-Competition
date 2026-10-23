// Register lines counted by status. Each line counts on the one map element build_store.py placed it on.
import type { EdgeKind, RegisterLine } from "./types";

export type Counts = { confirmed: number; unresolved: number; cleared: number };

function count(lines: RegisterLine[]): Counts {
  const by = (status: string) => lines.filter((l) => l.status === status).length;
  return { confirmed: by("confirmed"), unresolved: by("unresolved"), cleared: by("cleared") };
}

/** The findings that count on one table ("node") or one line ("edge") of the map. */
export const countsFor = (register: RegisterLine[], kind: "node" | "edge", id: string): Counts =>
  count(register.filter((l) => l.mapKind === kind && l.mapId === id));

/** Every line of the register, by status: what the summary cards show. */
export const totals = (register: RegisterLine[]): Counts => count(register);

/**
 * Whether a line on the map carries a tag: only when it has findings or a key problem to show. Never during a
 * trace (the trace shows check numbers only) and never on a lookup (context lines; no finding counts on them).
 */
export const tagShown = (kind: EdgeKind, counts: Counts, issue: string, inTrace: boolean): boolean =>
  !inTrace && kind !== "lookup" && (counts.confirmed + counts.unresolved + counts.cleared > 0 || Boolean(issue));
