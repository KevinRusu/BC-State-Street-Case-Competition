// When a line on the map carries a tag: pure logic, no store needed.
import { describe, expect, test } from "vitest";
import { summaryOf, tagShown, type Counts } from "@/lib/findings";
import type { RegisterLine } from "@/lib/types";

const none: Counts = { confirmed: 0, unresolved: 0, cleared: 0 };
const some: Counts = { confirmed: 1, unresolved: 0, cleared: 0 };

describe("tagShown", () => {
  test("a line with findings or a key problem carries a tag", () => {
    expect(tagShown("handoff", some, "", false)).toBe(true);
    expect(tagShown("flow", none, "30 unmatched", false)).toBe(true);
    expect(tagShown("handoff", none, "", false)).toBe(false);
  });

  test("population-wide finding tags are hidden while tracing a record", () => {
    expect(tagShown("handoff", some, "30 unmatched", true)).toBe(false);
  });

  test("lookups never carry a tag", () => {
    expect(tagShown("lookup", some, "15 unmatched", false)).toBe(false);
  });
});

// A made-up register line: only the line number, status and plain wording matter to the summary.
const reg = (line: number, status: string, plain: string): RegisterLine => ({
  line, ruleId: "", finding: plain, status, stage: "", unit: "", affected: 0, eligible: 0, notEvaluable: 0,
  examples: "", idKind: "", mapKind: "", mapId: "", traceExample: "", plain,
});

describe("summaryOf", () => {
  test("groups confirmed and unresolved as problems and lists cleared findings in register order", () => {
    const s = summaryOf([
      reg(1, "confirmed", "A"), reg(2, "cleared", "Looks odd, fine"), reg(3, "unresolved", "B"),
      reg(4, "confirmed", "C"), reg(5, "cleared", "Second false alarm"),
    ]);
    expect(s).toMatchObject({ confirmed: 2, unresolved: 1, cleared: 2, problems: 3, flagged: 5 });
    expect(s.clearedFindings).toEqual(["Looks odd, fine", "Second false alarm"]);
  });

  test("no cleared lines", () => {
    const s = summaryOf([reg(1, "unresolved", "B")]);
    expect(s.cleared).toBe(0);
    expect(s.clearedFindings).toEqual([]);
  });

  test("a line with an unexpected status is not flagged", () => {
    expect(summaryOf([reg(1, "", "X"), reg(2, "confirmed", "A")]).flagged).toBe(1);
  });

  test("an empty register is all zeros", () => {
    expect(summaryOf([])).toEqual({
      confirmed: 0, unresolved: 0, cleared: 0, problems: 0, flagged: 0, clearedFindings: [],
    });
  });
});
