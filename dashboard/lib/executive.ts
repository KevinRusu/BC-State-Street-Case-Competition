// The executive view's pure logic: number formats, a listed unit's result, list orders, link builders, the stress
// test's state and sparkline geometry. No I/O and no React: every number the page shows goes through here.
// Formats never use the machine's locale, and a blank (null) never becomes a number.
import type {
  ImpactRecord, Indicator, IndicatorSeries, Num, RecordFilter, Result, RuleScore, Scenario, SeriesPoint, Stress,
} from "./executive-types";
import type { Tone } from "./status";

/** Rows per page of a record list. */
export const PAGE_SIZE = 50;
/** Rows of the worst-accounts table. */
export const WORST_ACCOUNTS = 10;

/** The results of a listed unit, in the order a record list shows them. */
export const RESULTS: Result[] = ["confirmed fail", "unresolved fail", "not evaluable", "cleared"];

export const RESULT_TONE: Record<Result, Tone> = {
  "confirmed fail": "bad",
  "unresolved fail": "warn",
  "not evaluable": "info",
  cleared: "ok",
};

/** The run facts of `03_stress_run.csv` the page shows. Paths are never among them. */
export const RUN_FACTS: string[] = ["seed", "sizes", "multiplier", "finished at", "labels sha256"];

/** The one mark for a blank value on every executive page: the en dash. The formatters print it too. */
export const BLANK = "–";
const MINUS = "−"; // U+2212, the real minus sign

/**
 * A listed unit's result from its two outcome columns: a fail is confirmed only when the confirmed-only outcome
 * fails too. `null` for anything else (a plain pass is never listed).
 */
export function resultOf(outcome: string, confirmedOnly: string): Result | null {
  if (outcome === "fail") return confirmedOnly === "fail" ? "confirmed fail" : "unresolved fail";
  if (outcome === "not evaluable") return "not evaluable";
  if (outcome === "cleared") return "cleared";
  return null;
}

/** A `result` address parameter: one of `RESULTS` exactly, else undefined. */
export function parseResult(value: string | undefined): Result | undefined {
  return RESULTS.find((r) => r === value);
}

/** A `page` address parameter: a whole number in 1..max(pages, 1); anything else is 1, above the range the last page. */
export function parsePage(value: string | undefined, pages: number): number {
  const last = Math.max(Math.floor(pages), 1);
  if (value === undefined || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  if (page < 1) return 1;
  return Math.min(page, last);
}

// en-US formatters on absolute values; the sign is added by `signed` so a negative shows U+2212 and a value that
// prints as zero never shows a sign.
const nf = (min: number, max: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: min, maximumFractionDigits: max, useGrouping: true });
const WHOLE = nf(0, 0);
const ONE_DECIMAL = nf(1, 1);
const TWO_DECIMALS = nf(2, 2);

function signed(v: number, text: string): string {
  return v < 0 && /[1-9]/.test(text) ? MINUS + text : text;
}

/**
 * A blank for every formatter: null, and a value that is not a finite number (NaN, ±Infinity), which is never
 * printed. When it is false the value is a finite number.
 */
const isBlank = (v: Num): v is null => v === null || !Number.isFinite(v);

/**
 * A score, coverage or confirmed-only score as stored: two decimals, truncated toward zero and never rounded up
 * (the notebook rounds scores down). The small tolerance absorbs binary floating point, so a stored 72.57
 * (7256.999… hundredths) still prints "72.57".
 */
export function fmtScore(v: Num): string {
  if (isBlank(v)) return BLANK;
  const hundredths = Math.floor(Math.abs(v) * 100 + 1e-7);
  return signed(v, TWO_DECIMALS.format(hundredths / 100));
}

/**
 * A fraction 0..1 as a percentage with one decimal, truncated toward zero like a score and never rounded up:
 * 0.4329 → "43.2%", 0.9996 → "99.9%", so "100.0%" means complete. Same floating-point tolerance as `fmtScore`.
 */
export function fmtShare(v: Num): string {
  if (isBlank(v)) return BLANK;
  const tenthsOfPercent = Math.floor(Math.abs(v) * 1000 + 1e-7);
  return signed(v, ONE_DECIMAL.format(tenthsOfPercent / 10) + "%");
}

/** A count with thousands separators: "6,834". */
export function fmtCount(v: Num): string {
  if (isBlank(v)) return BLANK;
  return signed(v, WHOLE.format(Math.abs(v)));
}

const UP_TO_SIX = nf(0, 6);

/**
 * A number as stored, for a figure that is not a score, share, count or amount (a change in units, a correlation):
 * thousands separators, up to six decimals and no trailing zeros, so 0.4 stays "0.4" and never rounds to a whole unit.
 */
export function fmtNumber(v: Num): string {
  if (isBlank(v)) return BLANK;
  return signed(v, UP_TO_SIX.format(Math.abs(v)));
}

/**
 * An indicator's or KPI's value for its unit: a percentage unit as a score (two decimals, truncated), any other unit
 * as stored (`fmtNumber`: a median in minutes or days is not a count). A blank is "not computed".
 */
export function fmtValue(v: Num, unit: string): string {
  if (isBlank(v)) return "not computed";
  return unit.startsWith("%") ? fmtScore(v) : fmtNumber(v);
}

/** Whole dollars with thousands separators: "$2,468,013,580", "−$12,345". A blank is unknown, not zero. */
export function fmtUsd(v: Num): string {
  if (isBlank(v)) return "not priced";
  return signed(v, "$" + WHOLE.format(Math.abs(v)));
}

/** Dollars shortened for a headline: one decimal with "M" from a million, "B" from a billion; below that as `fmtUsd`. */
export function fmtUsdShort(v: Num): string {
  if (isBlank(v)) return "not priced";
  const abs = Math.abs(v);
  // Decide the unit on the figure as printed, so 999,960,000 reads "$1.0B" and never "$1,000.0M".
  if (Math.round(abs / 1e5) >= 1e4) return signed(v, "$" + ONE_DECIMAL.format(abs / 1e9) + "B");
  if (Math.round(abs) >= 1e6) return signed(v, "$" + ONE_DECIMAL.format(abs / 1e6) + "M");
  return fmtUsd(v);
}

/** Basis points with two decimals: "638.29 bps". */
export function fmtBps(v: Num): string {
  if (isBlank(v)) return BLANK;
  return signed(v, TWO_DECIMALS.format(Math.abs(v)) + " bps");
}

const text = (a: string, b: string) => a.localeCompare(b, "en");

/** Ascending numbers with a blank last. */
function numberAsc(a: Num, b: Num): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  return a - b;
}

function defaultCompare(a: RuleScore, b: RuleScore): number {
  return numberAsc(a.score, b.score) || numberAsc(a.coverage, b.coverage) || text(a.domain, b.domain) || text(a.rule, b.rule);
}

/** The fix-first list's opening order: lowest score, then lowest coverage (blanks last), then domain and rule ID. */
export function defaultRuleOrder(rules: RuleScore[]): RuleScore[] {
  return [...rules].sort(defaultCompare);
}

/** Fixed ordinal priorities in the selected rule population; unscored rules are not ranked. */
export function rulePriorityRanks(rules: RuleScore[]): Map<RuleScore, number> {
  return new Map(defaultRuleOrder(rules).filter((r) => !isBlank(r.score)).map((r, index) => [r, index + 1]));
}

export type RuleSort = "name" | "domain" | "score" | "coverage" | "confirmedOnly" | "owner";

/**
 * The rule list sorted by one column. Text columns compare as text, the rest as numbers with a blank last in both
 * directions. Ties fall back to `defaultRuleOrder`'s comparison (not reversed), so the order is always fully set.
 */
export function sortRules(rules: RuleScore[], by: RuleSort, direction: "asc" | "desc"): RuleScore[] {
  const flip = direction === "desc" ? -1 : 1;
  const column = (a: RuleScore, b: RuleScore): number => {
    if (by === "name" || by === "domain" || by === "owner") return flip * text(a[by], b[by]);
    const x = a[by];
    const y = b[by];
    if (x === null || y === null) return numberAsc(x, y); // blank last whatever the direction
    return flip * (x - y);
  };
  return [...rules].sort((a, b) => column(a, b) || defaultCompare(a, b));
}

/**
 * The dollar list's three groups: priced (gross USD known), largest first; not priced (records but nothing valued:
 * unknown, not zero), most accounts first; no records in this run. Ties by name.
 */
export function splitScenarios(s: Scenario[]): { priced: Scenario[]; notPriced: Scenario[]; noRecords: Scenario[] } {
  const byName = (a: Scenario, b: Scenario) => text(a.scenario, b.scenario);
  const desc = (a: Num, b: Num) => numberAsc(a === null ? null : -a, b === null ? null : -b); // blank last
  const hasRecords = (x: Scenario) => x.financialRows !== null && x.financialRows !== 0;
  const withRecords = s.filter(hasRecords);
  return {
    priced: withRecords.filter((x) => x.grossUsd !== null).sort((a, b) => desc(a.grossUsd, b.grossUsd) || byName(a, b)),
    notPriced: withRecords
      .filter((x) => x.grossUsd === null)
      .sort((a, b) => desc(a.distinctAccounts, b.distinctAccounts) || byName(a, b)),
    noRecords: s.filter((x) => !hasRecords(x)).sort(byName),
  };
}

/** The headline scenario: the priced one with the largest gross USD above zero. One scenario, never a total. */
export function largestScenario(s: Scenario[]): Scenario | null {
  return splitScenarios(s).priced.find((x) => x.grossUsd !== null && x.grossUsd > 0) ?? null;
}

/** Fund-relative triage only. The headline still selects the largest gross-USD scenario. */
export function navImpactOrder(scenarios: Scenario[]): Scenario[] {
  const magnitude = (value: Num): Num => isBlank(value) ? null : -Math.abs(value);
  return [...scenarios].sort((a, b) =>
    numberAsc(magnitude(a.maxFundNetBps), magnitude(b.maxFundNetBps))
    || numberAsc(magnitude(a.grossUsd), magnitude(b.grossUsd))
    || text(a.scenario, b.scenario));
}

/** Missing NAV impact remains unranked, not zero and not a low-risk assessment. */
export function scenarioPriorityRanks(scenarios: Scenario[]): Map<Scenario, number> {
  return new Map(navImpactOrder(scenarios).filter((s) => !isBlank(s.maxFundNetBps)).map((s, index) => [s, index + 1]));
}

/** Pilot minimums for the composite scores. Individual KPIs retain their own targets. */
export const DOMAIN_SCORE_TARGETS: ReadonlyMap<string, number> = new Map([
  ["Accounts", 99.50],
  ["Securities", 99.50],
  ["Trades", 98.00],
  ["Corporate actions", 95.00],
  ["Positions", 99.50],
  ["Prices", 99.00],
  ["NAV", 99.50],
]);

export const PLATFORM_SCORE_TARGET = 95;

/** Compare a score on the 0–100 scale with its minimum and allow a relative shortfall of up to 5% in amber. */
export function scoreTargetStatus(score: Num, minimum: Num): { target: Num; tone: "ok" | "warn" | "bad" | null } {
  const onScale = (value: Num): value is number =>
    value !== null && Number.isFinite(value) && value >= 0 && value <= 100;
  const target = onScale(minimum) ? minimum : null;
  if (!onScale(score) || target === null) return { target, tone: null };
  if (score >= target) return { target, tone: "ok" };
  return { target, tone: score + 1e-9 >= target * 0.95 ? "warn" : "bad" };
}

/** The published breach counts cover the reporting period. They do not describe the latest observation alone. */
export function leadingBreaches(indicators: Indicator[]) {
  const computed = indicators.filter((i) => i.type === "Leading" && i.status === "computed");
  const entries = computed.map((indicator) => ({
    indicator,
    recordedBreach: indicator.breaches !== null && indicator.breaches > 0,
  }));
  const dates = computed.flatMap((i) => i.series.flatMap((s) => s.points.map((p) => p.start))).filter(Boolean).sort();
  return {
    entries,
    breaching: entries.filter((entry) => entry.recordedBreach).length,
    computed: entries.length,
    start: dates[0] ?? "",
    end: dates.at(-1) ?? "",
  };
}

const valued = (points: SeriesPoint[]) => points.filter((p): p is SeriesPoint & { value: number } => p.value !== null);

/** The series that get a trend line: daily or effective-date ones with two valued points. Weekly rows hold medians. */
export function drawable(series: IndicatorSeries[]): IndicatorSeries[] {
  return series.filter((s) => (s.period === "day" || s.period === "effective date") && valued(s.points).length >= 2);
}

const coord = (n: number) => String(Math.round(n * 100) / 100);

/** A valued point of a trend line: where it sits in the box and what the hover box shows. */
export type SparkPoint = { x: number; y: number; start: string; value: number; threshold: Num; breach: boolean };

export type SparkLine = {
  path: string;
  marks: { x: number; y: number }[];
  points: SparkPoint[];
  /** The values at the bottom and top of the box (the y-axis labels). */
  low: number;
  high: number;
  /** One horizontal line per distinct threshold. */
  limits: { value: number; y: number }[];
};

/**
 * A trend line in a width × height box: the valued points spread evenly left to right. The vertical range runs from
 * the lowest to the highest of the values and the thresholds, so a limit is always in view and a small wiggle far from
 * it stays small (a constant series with no other limit sits at mid height). Blank values are skipped; `marks` are
 * the breach points. `null` when fewer than two points have a value.
 */
export function sparkline(points: SeriesPoint[], width: number, height: number): SparkLine | null {
  const shown = valued(points);
  if (shown.length < 2) return null;
  const thresholds = [...new Set(shown.map((p) => p.threshold).filter((t): t is number => t !== null))].sort((a, b) => a - b);
  const range = [...shown.map((p) => p.value), ...thresholds];
  const low = Math.min(...range);
  const high = Math.max(...range);
  const span = high - low;
  const y = (v: number) => Number(coord(span === 0 ? height / 2 : height - ((v - low) / span) * height));
  const xy: SparkPoint[] = shown.map((p, i) => ({
    x: Number(coord((i / (shown.length - 1)) * width)), y: y(p.value),
    start: p.start, value: p.value, threshold: p.threshold, breach: p.breach,
  }));
  const path = xy.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
  return {
    path, points: xy, low, high,
    marks: xy.filter((p) => p.breach).map(({ x, y }) => ({ x, y })),
    limits: thresholds.map((value) => ({ value, y: y(value) })),
  };
}

/** The point nearest a pointer at `fraction` of the way across a line of `count` evenly spread points. */
export function nearestIndex(count: number, fraction: number): number {
  return Math.min(count - 1, Math.max(0, Math.round(fraction * (count - 1))));
}

/** The x-axis caption of a trend line, from its series period. */
export function seriesAxis(period: string): string {
  if (period === "day") return "Date (one point per day)";
  if (period === "effective date") return "Effective date";
  if (period === "week") return "Week starting";
  return period.charAt(0).toUpperCase() + period.slice(1);
}

/**
 * Whether the stress results describe these outputs: "not run" without rates; "older run" when the stress file's
 * platform score before injection differs from the scorecard's by 0.005 or more; "current" otherwise.
 */
export function stressState(stress: Stress | null, platformScore: Num): "not run" | "older run" | "current" {
  if (stress === null || stress.rates.length === 0) return "not run";
  const before = stress.measures.find((m) => m.measure === "platform score")?.before ?? null;
  if (before !== null && platformScore !== null && Math.abs(before - platformScore) >= 0.005) return "older run";
  return "current";
}

/**
 * The record the Trace page opens for a listed unit (spec §4). A price row opens its security (the first
 * space-separated token); a rate row, a feed-day and a blank ID have none (see `noTraceReason`).
 */
export function traceTarget(unitKind: string, recordId: string): { id: string; note: string } | null {
  if (recordId.trim() === "" || unitKind === "rate row" || unitKind === "feed-day") return null;
  if (unitKind === "price row") return { id: recordId.trim().split(/\s+/)[0], note: "opens this price's security" };
  return { id: recordId, note: "" };
}

/** Why `traceTarget` gave no link for this unit kind. */
export function noTraceReason(unitKind: string): string {
  if (unitKind === "rate row") return "No single record to trace: a currency rate is shared by many records";
  if (unitKind === "feed-day") return "No single record to trace: this is one feed on one day";
  return "No record ID to trace";
}

/** The record the Trace page opens for an impact row: its ledger line, else its account/security key. */
export function impactTraceTarget(r: ImpactRecord): string | null {
  if (r.ledgerId !== "") return r.ledgerId;
  if (r.accountId !== "" && r.securityId !== "") return `${r.accountId}/${r.securityId}`;
  return null;
}

/** A path with its parameters in the given order, leaving out unset values and page 1. */
function href(path: string, params: [string, string | number | undefined][]): string {
  const q = new URLSearchParams();
  for (const [key, value] of params) {
    if (value === undefined || value === "" || (key === "page" && value === 1)) continue;
    q.append(key, String(value));
  }
  const query = q.toString();
  return query ? `${path}?${query}` : path;
}

export function traceHref(id: string): string {
  return href("/trace", [["id", id]]);
}

export function ruleHref(domain: string, rule: string, filter?: RecordFilter): string {
  return href("/executive/rule", [
    ["domain", domain], ["rule", rule], ["result", filter?.result], ["finding", filter?.finding], ["page", filter?.page],
  ]);
}

export function accountHref(id: string, filter?: RecordFilter): string {
  return href("/executive/account", [
    ["id", id], ["domain", filter?.domain], ["result", filter?.result], ["finding", filter?.finding],
    ["page", filter?.page],
  ]);
}

export function scenarioHref(name: string, filter?: { priced?: "yes" | "no"; page?: number }): string {
  return href("/executive/scenario", [["name", name], ["priced", filter?.priced], ["page", filter?.page]]);
}

/** The executive page; score is the default order and is left out. A domain filter jumps to the fix-first list. */
export function executiveHref(q: { by?: "score" | "dollars"; domain?: string }): string {
  const base = href("/executive", [["by", q.by === "dollars" ? "dollars" : undefined], ["domain", q.domain]]);
  return q.domain ? `${base}#fix-first` : base;
}
