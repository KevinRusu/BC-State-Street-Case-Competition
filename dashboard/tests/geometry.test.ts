// The map's curves: pure geometry, no store needed.
import { describe, expect, test } from "vitest";
import { curve } from "@/lib/geometry";

describe("curve", () => {
  test("a curve starts and ends on its handles", () => {
    const c = curve({ x: 0, y: 0, position: "right" }, { x: 100, y: 50, position: "left" });
    expect(c.at(0)).toEqual({ x: 0, y: 0 });
    expect(c.at(1)).toEqual({ x: 100, y: 50 });
    expect(c.path.startsWith("M0,0")).toBe(true);
  });

  test("a line leaving and entering on the same side stays a low arch", () => {
    const c = curve({ x: 0, y: 100, position: "top" }, { x: 600, y: 100, position: "top" });
    const highest = Math.min(...Array.from({ length: 21 }, (_, i) => c.at(i / 20).y));
    expect(highest).toBeGreaterThanOrEqual(40);
  });

  test("control points leave along the handle's side", () => {
    const c = curve({ x: 0, y: 0, position: "bottom" }, { x: 0, y: 200, position: "top" });
    expect(c.at(0.1).y).toBeGreaterThan(0);
    expect(Math.abs(c.at(0.1).x)).toBeLessThan(1);
  });
});
