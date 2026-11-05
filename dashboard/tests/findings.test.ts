// When a line on the map carries a tag: pure logic, no store needed.
import { describe, expect, test } from "vitest";
import { tagShown, type Counts } from "@/lib/findings";

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
