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

/** Every line of the register, by status; the store test checks the map's placements add up to it. */
export const totals = (register: RegisterLine[]): Counts => count(register);

/** The summary beside the map: real problems (confirmed, unresolved) apart from false alarms ruled out (cleared). */
export type Summary = Counts & { flagged: number; problems: number; clearedFindings: string[] };

/** Every register line in the summary's two groups; the cleared findings in register order, one per line. */
export function summaryOf(register: RegisterLine[]): Summary {
  const counts = count(register);
  const problems = counts.confirmed + counts.unresolved;
  return {
    ...counts, problems, flagged: problems + counts.cleared,
    clearedFindings: register.filter((l) => l.status === "cleared").map((l) => l.plain),
  };
}

/**
 * Whether a line on the map carries a tag: only when it has findings or a key problem to show. Never during a
 * trace (record-specific finding tags are rendered separately) and never on a lookup.
 */
export const tagShown = (kind: EdgeKind, counts: Counts, issue: string, inTrace: boolean): boolean =>
  !inTrace && kind !== "lookup" && (counts.confirmed + counts.unresolved + counts.cleared > 0 || Boolean(issue));
