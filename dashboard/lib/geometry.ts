// The map's lines: a cubic Bézier whose ends leave and enter along their handle's side.
export type Point = { x: number; y: number };
export type End = Point & { position: "top" | "right" | "bottom" | "left" };

const OUT = { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] } as const;

/** The SVG path from source to target, and the point a fraction `t` (0-1) along it, for placing a tag. */
export function curve(source: End, target: End): { path: string; at: (t: number) => Point } {
  // Ends on the same side (top → top) would bulge far over the grid; keep those a low arch.
  const pull = Math.max(22, 0.42 * Math.hypot(target.x - source.x, target.y - source.y));
  const reach = source.position === target.position ? Math.min(60, pull) : pull;
  const c1 = { x: source.x + OUT[source.position][0] * reach, y: source.y + OUT[source.position][1] * reach };
  const c2 = { x: target.x + OUT[target.position][0] * reach, y: target.y + OUT[target.position][1] * reach };
  const path = `M${source.x},${source.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${target.x},${target.y}`;
  const at = (t: number): Point => {
    const u = 1 - t;
    const mix = (a: number, b: number, c: number, d: number) => u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
    return { x: mix(source.x, c1.x, c2.x, target.x), y: mix(source.y, c1.y, c2.y, target.y) };
  };
  return { path, at };
}
