// The plain-English helpers: pure logic over hand-built marks, lines and wording. No store needed.
import { describe, expect, test } from "vitest";
import { EXAMPLES_ONLY, countsTone, examplesOnlyNote, findingText, stageLines, storyGroups, traceHeadline } from "@/lib/plain";
import type { DemoTrace, PlainText, RegisterLine, RegisterMark } from "@/lib/types";

const plain: PlainText = {
  status: {
    confirmed: "has a confirmed problem",
    unresolved: "has an open question",
    cleared: "was checked and is fine",
    none: "nothing found, which is not proof it is clean",
  },
  leadIn: { security_id: "Its security: ", transaction_id: "A linked trade: " },
  stages: [
    { stage: "worked example", label: "Worked example" },
    { stage: "master data", label: "Master data" },
    { stage: "positions", label: "Positions" },
  ],
};

const mark = (over: Partial<RegisterMark>): RegisterMark => ({
  line: 1, ruleId: "R1", finding: "Raw finding", plain: "Plain sentence.", status: "confirmed", recordId: "TXN1",
  idKind: "transaction_id", mapKind: "node", mapId: "transactions", ...over,
});

const line = (over: Partial<RegisterLine>): RegisterLine => ({
  line: 1, ruleId: "R1", finding: "Raw finding", plain: "Plain sentence.", status: "confirmed", stage: "positions",
  unit: "rows", affected: 1, eligible: 10, notEvaluable: 0, examples: "", idKind: "transaction_id",
  mapKind: "node", mapId: "positions", traceExample: "", ...over,
});

const demo = (over: Partial<DemoTrace>): DemoTrace => ({
  position: 1, recordId: "X1", label: "A story", status: "confirmed", source: "", stage: "positions", ...over,
});

describe("traceHeadline", () => {
  test("a record's own finding leads the headline over an indirect one", () => {
    const indirect = mark({ line: 1, status: "confirmed", recordId: "SEC1", idKind: "security_id", plain: "Indirect sentence." });
    const direct = mark({ line: 5, status: "unresolved", recordId: "TXN1", plain: "Direct sentence." });
    const headline = traceHeadline("TXN1", [indirect, direct], plain);
    expect(headline.text).toBe("Direct sentence.");
    expect(headline.status).toBe("unresolved");
    expect(headline.phrase).toBe(plain.status.unresolved);
    expect(headline.more).toBe(1);
  });

  test("among direct findings the worst status leads, then the lowest line", () => {
    const cleared = mark({ line: 1, status: "cleared", plain: "Cleared one." });
    const open = mark({ line: 2, status: "unresolved", plain: "Open one." });
    const confirmed = mark({ line: 9, status: "confirmed", plain: "Confirmed late." });
    const confirmedEarly = mark({ line: 7, status: "confirmed", plain: "Confirmed early." });
    expect(traceHeadline("TXN1", [cleared, open, confirmed, confirmedEarly], plain).text).toBe("Confirmed early.");
  });

  test("an indirect-only finding carries its lead-in", () => {
    const only = mark({ recordId: "SEC1", idKind: "security_id" });
    const headline = traceHeadline("TXN1", [only], plain);
    expect(headline.text.startsWith(plain.leadIn.security_id)).toBe(true);
    expect(headline.text).toBe(plain.leadIn.security_id + "Plain sentence.");
  });

  test("no marks keep the honesty caveat", () => {
    expect(traceHeadline("TXN1", [], plain)).toEqual({ status: "none", text: plain.status.none, phrase: "", more: 0 });
  });

  test("on an examples-only store a record with no finding says the badges cover only the examples", () => {
    expect(examplesOnlyNote([], false)).toBe(EXAMPLES_ONLY);
    expect(EXAMPLES_ONLY).toContain("only the register's example IDs");
    expect(examplesOnlyNote([], true)).toBe("");                    // full member list: the headline is true as is
    expect(examplesOnlyNote([mark({})], false)).toBe("");           // a finding shows: the headline names it
  });

  test("two examples of one line count as one finding", () => {
    const a = mark({ line: 3, recordId: "TXN1" });
    const b = mark({ line: 3, recordId: "TXN1" });
    expect(traceHeadline("TXN1", [a, b], plain).more).toBe(0);
  });
});

describe("findingText", () => {
  test("a finding with no wording shows its register text", () => {
    expect(findingText(mark({ plain: "" }), "TXN1", plain)).toBe("Raw finding");
  });

  test("a direct finding has no lead-in", () => {
    expect(findingText(mark({}), "TXN1", plain)).toBe("Plain sentence.");
  });

  test("an indirect finding with no lead-in for its kind starts with the sentence", () => {
    expect(findingText(mark({ recordId: "X", idKind: "unheard_of" }), "TXN1", plain)).toBe("Plain sentence.");
  });
});

describe("stageLines", () => {
  test("stages follow the flow and an unknown stage comes last under its own name", () => {
    const lines = [
      line({ line: 1, stage: "positions" }),
      line({ line: 2, stage: "master data" }),
      line({ line: 3, stage: "new stage" }),
    ];
    expect(stageLines(lines, plain).map((g) => g.label)).toEqual(["Master data", "Positions", "new stage"]);
  });

  test("stage counts and tone come from the register statuses", () => {
    const lines = [
      line({ line: 1, status: "confirmed" }),
      line({ line: 2, status: "unresolved" }),
      line({ line: 3, status: "unresolved" }),
    ];
    const [group] = stageLines(lines, plain);
    expect(group.counts).toEqual({ confirmed: 1, unresolved: 2, cleared: 0 });
    expect(group.lines).toHaveLength(3);
    expect(countsTone(group.counts)).toBe("bad");
  });

  test("unknown stages keep their order of first appearance", () => {
    const lines = [line({ stage: "zeta" }), line({ stage: "alpha" }), line({ stage: "zeta" })];
    expect(stageLines(lines, plain).map((g) => g.stage)).toEqual(["zeta", "alpha"]);
  });
});

describe("storyGroups", () => {
  test("stories group by stage with the worked example first", () => {
    const demos = [
      demo({ position: 1, recordId: "A", stage: "positions" }),
      demo({ position: 2, recordId: "B", stage: "worked example" }),
      demo({ position: 3, recordId: "C", stage: "positions" }),
    ];
    const groups = storyGroups(demos, plain);
    expect(groups.map((g) => g.label)).toEqual(["Worked example", "Positions"]);
    expect(groups[1].stories.map((s) => s.recordId)).toEqual(["A", "C"]);
  });
});

describe("countsTone", () => {
  test("worst status sets the tone; no findings has none", () => {
    expect(countsTone({ confirmed: 0, unresolved: 1, cleared: 4 })).toBe("warn");
    expect(countsTone({ confirmed: 0, unresolved: 0, cleared: 4 })).toBe("ok");
    expect(countsTone({ confirmed: 0, unresolved: 0, cleared: 0 })).toBeNull();
  });
});
