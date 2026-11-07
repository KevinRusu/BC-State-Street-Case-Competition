// Plain-English helpers: pure functions over the wording the store carries (PlainText), no store or UI needed.
import type { Counts } from "./findings";
import type { Tone } from "./status";
import type { DemoTrace, PlainStatus, PlainText, RegisterLine, RegisterMark } from "./types";

/** The finding's sentence for the record being traced. A finding about a linked record (not the one searched for)
 * opens with a lead-in that says how it is linked. A finding with no wording shows the register's own text. */
export function findingText(mark: RegisterMark, query: string, plain: PlainText): string {
  const leadIn = mark.recordId !== query ? plain.leadIn[mark.idKind] ?? "" : "";
  return leadIn + (mark.plain || mark.finding);
}

export type Headline = { status: PlainStatus; text: string; phrase: string; more: number };

const STATUS_RANK: Record<string, number> = { confirmed: 0, unresolved: 1, cleared: 2 };
const rank = (status: string) => STATUS_RANK[status] ?? 3;

/** One sentence for a trace: the record's own findings first, then the worst status, then the earliest register line.
 * `more` counts the other register lines that mark it (two examples of one line are one finding). */
export function traceHeadline(query: string, marks: RegisterMark[], plain: PlainText): Headline {
  if (!marks.length) return { status: "none", text: plain.status.none, phrase: "", more: 0 };
  const [lead] = [...marks].sort((a, b) =>
    Number(b.recordId === query) - Number(a.recordId === query) || rank(a.status) - rank(b.status) || a.line - b.line);
  const status = lead.status as PlainStatus;
  return {
    status, text: findingText(lead, query, plain), phrase: plain.status[status] ?? "",
    more: new Set(marks.map((m) => m.line)).size - 1,
  };
}

/** What the finding badges cover on a store with no full member list (notebook 02 run before it wrote one). */
export const EXAMPLES_ONLY =
  "Finding badges show only the register's example IDs: this store has no full member list (rerun notebook 02, then rebuild the store).";

/** The note a no-finding headline needs on an examples-only store, where "nothing found" may only mean "not one of
 * the register's examples"; "" when the store marks every member or the record has a finding. */
export function examplesOnlyNote(marks: RegisterMark[], allMembers: boolean): string {
  return !allMembers && marks.length === 0 ? EXAMPLES_ONLY : "";
}

/** Groups in the flow's order (plain.stages); stages the wording does not know come last, in order of first
 * appearance, under their own name. Stages with nothing in them are skipped. */
function groupByStage<T>(items: T[], stageOf: (item: T) => string, plain: PlainText): { stage: string; label: string; items: T[] }[] {
  const known = new Map(plain.stages.map((s) => [s.stage, s.label]));
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const stage = stageOf(item);
    groups.set(stage, [...(groups.get(stage) ?? []), item]);
  }
  const order = [
    ...plain.stages.map((s) => s.stage).filter((s) => groups.has(s)),
    ...[...groups.keys()].filter((s) => !known.has(s)),
  ];
  return order.map((stage) => ({ stage, label: known.get(stage) ?? stage, items: groups.get(stage)! }));
}

export type StageLine = { stage: string; label: string; counts: Counts; lines: RegisterLine[] };

export function stageLines(register: RegisterLine[], plain: PlainText): StageLine[] {
  return groupByStage(register, (l) => l.stage, plain).map(({ stage, label, items }) => ({
    stage, label, lines: items,
    counts: {
      confirmed: items.filter((l) => l.status === "confirmed").length,
      unresolved: items.filter((l) => l.status === "unresolved").length,
      cleared: items.filter((l) => l.status === "cleared").length,
    },
  }));
}

export type StoryGroup = { stage: string; label: string; stories: DemoTrace[] };

export function storyGroups(demos: DemoTrace[], plain: PlainText): StoryGroup[] {
  return groupByStage(demos, (d) => d.stage, plain).map(({ stage, label, items }) => ({ stage, label, stories: items }));
}

/** The worst status in a set of counts as a tone: confirmed is bad, unresolved warns, cleared is ok, none is null. */
export function countsTone(counts: Counts): Tone | null {
  return counts.confirmed ? "bad" : counts.unresolved ? "warn" : counts.cleared ? "ok" : null;
}
