// The one place that says what each status means and which colour token shows it (tokens: app/globals.css).
import type { HopStatus, Status } from "./types";

export type Tone = "ok" | "warn" | "bad" | "info";

export const TONE_VAR: Record<Tone, string> = {
  ok: "var(--status-ok)",
  warn: "var(--status-warn)",
  bad: "var(--status-bad)",
  info: "var(--status-info)",
};

export const JOIN_STATUS: Record<Status, { tone: Tone; label: string; meaning: string }> = {
  orphans: { tone: "bad", label: "Unmatched keys", meaning: "keys that must find a partner on the other side do not" },
  fan_out: { tone: "warn", label: "Repeated keys", meaning: "a key that should appear once appears more than once" },
  blank_keys: { tone: "warn", label: "Blank keys", meaning: "rows with a blank key cannot join at all" },
  ok: { tone: "ok", label: "Joins cleanly", meaning: "every required key matches and unique keys are unique" },
  info: { tone: "info", label: "Context only", meaning: "a scenario link with no key contract to test" },
};

export const HOP_STATUS: Record<HopStatus, { tone: Tone; label: string; short: string }> = {
  ok: { tone: "ok", label: "Linked records found", short: "found" },
  fan_out: { tone: "warn", label: "More rows than expected", short: "more than expected" },
  missing: { tone: "bad", label: "Trail breaks here", short: "missing" },
  info: { tone: "info", label: "Context", short: "for context" },
  not_reached: { tone: "info", label: "Not reached", short: "not reached" },
};

export const REGISTER_STATUS: Record<string, Tone> = { confirmed: "bad", unresolved: "warn", cleared: "ok" };

// The same tones when they colour text: amber and grey get darker values so text stays readable (4.5:1).
const TONE_TEXT_VAR: Record<Tone, string> = {
  ok: "var(--status-ok)",
  warn: "var(--status-warn-text)",
  bad: "var(--status-bad)",
  info: "var(--muted-foreground)",
};

export const toneColor = (tone: Tone) => TONE_VAR[tone];
export const toneText = (tone: Tone) => TONE_TEXT_VAR[tone];

const HOP_ORDER: HopStatus[] = ["missing", "fan_out", "ok", "info", "not_reached"];
export const worstHop = (statuses: HopStatus[]): HopStatus =>
  [...statuses].sort((a, b) => HOP_ORDER.indexOf(a) - HOP_ORDER.indexOf(b))[0] ?? "info";

export const fmt = (n: number) => n.toLocaleString("en-US");
