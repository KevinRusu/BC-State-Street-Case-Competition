// The executive view's pure logic: formats, results, orders, links, stress state, sparkline geometry. Made-up inputs.
import { describe, expect, test } from "vitest";
import type { Indicator, IndicatorSeries, RuleScore, Scenario, SeriesPoint, Stress } from "@/lib/executive-types";
import {
  BLANK, DOMAIN_SCORE_TARGETS, PAGE_SIZE, PLATFORM_SCORE_TARGET, RESULTS, RESULT_TONE, RUN_FACTS, WORST_ACCOUNTS, accountHref, defaultRuleOrder, drawable,
  executiveHref, fmtBps, fmtCount, fmtNumber, fmtScore, fmtShare, fmtUsd, fmtUsdShort, fmtValue, impactTraceTarget, largestScenario, leadingBreaches,
  navImpactOrder, nearestIndex, noTraceReason, parsePage, parseResult, resultOf, ruleHref, rulePriorityRanks, scenarioHref, scenarioPriorityRanks, seriesAxis, sortRules, sparkline, splitScenarios,
  scoreTargetStatus, kpiAttainmentTone, stressState, traceHref, traceTarget,
} from "@/lib/executive";

const rule = (domain: string, id: string, score: number | null, coverage: number | null, extra: Partial<RuleScore> = {}): RuleScore => ({
  domain, rule: id, name: id, owner: "", whatItTests: "", onFail: "", tests: [], score, coverage, confirmedOnly: score,
  ...extra,
});

const scenario = (name: string, financialRows: number | null, grossUsd: number | null, distinctAccounts: number | null = 1): Scenario => ({
  scenario: name, interpretation: "", evidence: "", accountScope: "", financialRows, valuedRows: null, unknownRows: null,
  valuationCoverage: null, signedUsd: grossUsd, grossUsd, maxFundNetBps: null, distinctAccounts, affectedFunds: null,
});

const indicator = (id: string, type: string, status: string, breaches: number | null, firstBreach: string): Indicator => ({
  id, name: id, type, status, threshold: "", owner: "", refresh: "", inputsNeeded: "", value: null, unit: "", breaches,
  firstBreach, series: [], lookback: [],
});

const pt = (value: number | null, breach = false, threshold: number | null = null, start = "2026-07-01"): SeriesPoint =>
  ({ start, value, threshold, breach });
const ids = (rules: RuleScore[]) => rules.map((r) => `${r.domain}:${r.rule}`);
const names = (s: Scenario[]) => s.map((x) => x.scenario);

test("an outcome's result", () => {
  expect(resultOf("fail", "fail")).toBe("confirmed fail");
  expect(resultOf("fail", "pass")).toBe("unresolved fail");
  expect(resultOf("fail", "not evaluable")).toBe("unresolved fail");
  expect(resultOf("not evaluable", "not evaluable")).toBe("not evaluable");
  expect(resultOf("cleared", "cleared")).toBe("cleared");
  expect(resultOf("pass", "pass")).toBeNull();
});
test("blanks never become numbers", () => {
  expect(fmtScore(null)).toBe("–");
  expect(fmtUsd(null)).toBe("not priced");
  expect(fmtScore(0)).toBe("0.00");
  expect(fmtUsd(0)).toBe("$0");
});
test("a score is never rounded up", () => expect(fmtScore(99.999)).toBe("99.99"));
test("money", () => {
  expect(fmtUsd(2468013579.64)).toBe("$2,468,013,580");
  expect(fmtUsd(-12345.4)).toBe("−$12,345");
  expect(fmtUsdShort(372819046.3)).toBe("$372.8M");
  expect(fmtUsdShort(1234567890)).toBe("$1.2B");
  expect(fmtUsdShort(10400)).toBe("$10,400");
});
test("shares and basis points", () => {
  expect(fmtShare(0.4329)).toBe("43.2%");
  expect(fmtShare(1)).toBe("100.0%");
  expect(fmtBps(638.2914)).toBe("638.29 bps");
});
test("a number as stored: no rounding to whole units, no trailing zeros", () => {
  expect(fmtNumber(0.4)).toBe("0.4");
  expect(fmtNumber(-1234.5)).toBe("−1,234.5");
  expect(fmtNumber(12)).toBe("12");
  expect(fmtNumber(0.7286)).toBe("0.7286");
  expect(fmtNumber(1)).toBe("1");
  expect(fmtNumber(0.1 + 0.2)).toBe("0.3");
  expect(fmtNumber(null)).toBe("–");
  expect(fmtNumber(-0)).toBe("0");
  expect(fmtNumber(1234567.891)).toBe("1,234,567.891");
});
test("one blank mark, the en dash, used by the formatters", () => {
  expect(BLANK).toBe("–");
  expect(fmtScore(null)).toBe(BLANK);
  expect(fmtNumber(null)).toBe(BLANK);
});
test("a value that is not a finite number is a blank in every formatter", () => {
  for (const v of [NaN, Infinity, -Infinity]) {
    expect(fmtScore(v)).toBe(BLANK);
    expect(fmtShare(v)).toBe(BLANK);
    expect(fmtCount(v)).toBe(BLANK);
    expect(fmtNumber(v)).toBe(BLANK);
    expect(fmtBps(v)).toBe(BLANK);
    expect(fmtUsd(v)).toBe("not priced");
    expect(fmtUsdShort(v)).toBe("not priced");
  }
});
test("trace targets by unit kind", () => {
  expect(traceTarget("key", "A1/S1")).toEqual({ id: "A1/S1", note: "" });
  expect(traceTarget("price row", "S1 2026-07-10 V1")?.id).toBe("S1");
  expect(traceTarget("rate row", "EUR 2026-07-10 1.1")).toBeNull();
  expect(traceTarget("feed-day", "FEED 2026-07-10")).toBeNull();
  expect(noTraceReason("feed-day")).toContain("one feed on one day");
  expect(traceTarget("transaction row", "")).toBeNull();
});
test("links round-trip names with : / and spaces", () => {
  const name = "Reconciliation: rebuild is the odd one out: A/B test";
  expect(new URL(scenarioHref(name), "http://x").searchParams.get("name")).toBe(name);
  expect(new URL(ruleHref("Corporate actions", "CA_TERMS_COMPLETE"), "http://x").searchParams.get("domain")).toBe("Corporate actions");
  expect(new URL(traceHref("A1/S1"), "http://x").searchParams.get("id")).toBe("A1/S1");
  expect(executiveHref({ domain: "Trades" })).toBe("/executive?by=score&domain=Trades#fix-first");
});
test("page and result parameters are clamped, not trusted", () => {
  expect(parsePage("0", 5)).toBe(1);
  expect(parsePage("999", 5)).toBe(5);
  expect(parsePage("abc", 5)).toBe(1);
  expect(parsePage("2", 0)).toBe(1);
  expect(parseResult("bogus")).toBeUndefined();
  expect(parseResult("cleared")).toBe("cleared");
});

describe("constants", () => {
  test("display sizes, results in order and their tones", () => {
    expect(PAGE_SIZE).toBe(50);
    expect(WORST_ACCOUNTS).toBe(10);
    expect(RESULTS).toEqual(["confirmed fail", "unresolved fail", "not evaluable", "cleared"]);
    expect(RESULT_TONE).toEqual({ "confirmed fail": "bad", "unresolved fail": "warn", "not evaluable": "info", cleared: "ok" });
    expect(RUN_FACTS).toEqual(["seed", "sizes", "multiplier", "finished at", "labels sha256"]);
  });
});

describe("parsing the address", () => {
  test("a page is a whole number inside the range", () => {
    expect(parsePage("3", 5)).toBe(3);
    expect(parsePage("5", 5)).toBe(5);
    expect(parsePage(undefined, 5)).toBe(1);
    expect(parsePage("", 5)).toBe(1);
    expect(parsePage("2.5", 5)).toBe(1);
    expect(parsePage("-2", 5)).toBe(1);
    expect(parsePage("1e2", 5)).toBe(1);
    expect(parsePage("6", 5)).toBe(5);
    expect(parsePage("1", 0)).toBe(1);
  });
  test("every result parses to itself; anything else is undefined", () => {
    for (const r of RESULTS) expect(parseResult(r)).toBe(r);
    expect(parseResult(undefined)).toBeUndefined();
    expect(parseResult("")).toBeUndefined();
    expect(parseResult("Cleared")).toBeUndefined();
  });
});

describe("formats", () => {
  test("a stored two-decimal score prints as stored, despite binary floating point", () => {
    expect(fmtScore(72.57)).toBe("72.57"); // 72.57 * 100 is 7256.999… in binary floating point
    expect(fmtScore(0.29)).toBe("0.29");
    expect(fmtScore(0.57)).toBe("0.57");
    expect(fmtScore(1.15)).toBe("1.15");
    expect(fmtScore(4.35)).toBe("4.35");
    expect(fmtScore(100)).toBe("100.00");
    expect(fmtScore(89.8)).toBe("89.80");
  });
  test("a score is truncated, never rounded", () => {
    expect(fmtScore(99.995)).toBe("99.99");
    expect(fmtScore(12.349)).toBe("12.34");
    expect(fmtScore(-1.329)).toBe("−1.32");
    expect(fmtScore(-0.004)).toBe("0.00");
  });
  test("counts carry thousands separators", () => {
    expect(fmtCount(6834)).toBe("6,834");
    expect(fmtCount(0)).toBe("0");
    expect(fmtCount(1234567)).toBe("1,234,567");
    expect(fmtCount(-1200)).toBe("−1,200");
    expect(fmtCount(null)).toBe("–");
  });
  test("money: whole dollars, a real minus sign, never a negative zero", () => {
    expect(fmtUsd(999.5)).toBe("$1,000");
    expect(fmtUsd(-0.4)).toBe("$0");
    expect(fmtUsd(-2468013579.64)).toBe("−$2,468,013,580");
  });
  test("short money switches unit at a million and a billion", () => {
    expect(fmtUsdShort(null)).toBe("not priced");
    expect(fmtUsdShort(0)).toBe("$0");
    expect(fmtUsdShort(999999.4)).toBe("$999,999");
    expect(fmtUsdShort(1000000)).toBe("$1.0M");
    expect(fmtUsdShort(-372819046.3)).toBe("−$372.8M");
    expect(fmtUsdShort(999960000)).toBe("$1.0B");
    expect(fmtUsdShort(1000000000)).toBe("$1.0B");
    expect(fmtUsdShort(-2500000000)).toBe("−$2.5B");
    expect(fmtUsdShort(1234567890123)).toBe("$1,234.6B");
  });
  test("a share is truncated, never rounded up: 100.0% only when complete", () => {
    expect(fmtShare(0.4321)).toBe("43.2%");
    expect(fmtShare(0.4329)).toBe("43.2%");
    expect(fmtShare(0.29)).toBe("29.0%");
    expect(fmtShare(0.57)).toBe("57.0%");
    expect(fmtShare(1)).toBe("100.0%");
    expect(fmtShare(0.9996)).toBe("99.9%");
    expect(fmtShare(0.99999)).toBe("99.9%");
    expect(fmtShare(0)).toBe("0.0%");
    expect(fmtShare(0.0004)).toBe("0.0%");
    expect(fmtShare(-0.0004)).toBe("0.0%");
  });
  test("a value with its unit: a percentage as a score, anything else as stored, a blank not computed", () => {
    expect(fmtValue(12.5, "minutes")).toBe("12.5");
    expect(fmtValue(57.129, "% of held securities")).toBe("57.12");
    expect(fmtValue(null, "minutes")).toBe("not computed");
    expect(fmtValue(null, "% of held securities")).toBe("not computed");
    expect(fmtValue(1234, "")).toBe("1,234");
  });
  test("shares and basis points: blanks and signs", () => {
    expect(fmtShare(null)).toBe("–");
    expect(fmtShare(0)).toBe("0.0%");
    expect(fmtShare(0.29)).toBe("29.0%");
    expect(fmtBps(null)).toBe("–");
    expect(fmtBps(0)).toBe("0.00 bps");
    expect(fmtBps(-12.3456)).toBe("−12.35 bps");
    expect(fmtBps(12345.678)).toBe("12,345.68 bps");
  });
});

describe("rule orders", () => {
  const rules = [
    rule("Trades", "R_B", null, 90),
    rule("Prices", "R_C", 50, 80),
    rule("Accounts", "R_D", 50, 60),
    rule("Accounts", "R_A", 50, null),
    rule("Trades", "R_E", 20, 99),
    rule("Prices", "R_F", 50, 60),
  ];

  test("default: lowest score first, a blank score last, ties by coverage, then domain and rule ID", () => {
    expect(ids(defaultRuleOrder(rules))).toEqual([
      "Trades:R_E", "Accounts:R_D", "Prices:R_F", "Prices:R_C", "Accounts:R_A", "Trades:R_B",
    ]);
  });
  test("the default order does not change its input", () => {
    const before = ids(rules);
    defaultRuleOrder(rules);
    expect(ids(rules)).toEqual(before);
  });
  test("ranks follow the selected order and filter, excluding missing selected values", () => {
    const ranks = rulePriorityRanks(defaultRuleOrder(rules));
    expect(ranks.get(rules[4])).toBe(1);
    expect(ranks.get(rules[2])).toBe(2);
    expect(ranks.get(rules[5])).toBe(3);
    expect(ranks.has(rules[0])).toBe(false);
    const resorted = sortRules(rules, "score", "desc");
    expect(rulePriorityRanks(resorted).get(resorted[0])).toBe(1);
    const coverageOrder = sortRules(rules, "coverage", "desc");
    const coverageRanks = rulePriorityRanks(coverageOrder, "coverage");
    expect(coverageRanks.get(rules[0])).toBe(2); // no score, but a known coverage
    expect(coverageRanks.has(rules[3])).toBe(false); // missing coverage
    const accounts = defaultRuleOrder(rules.filter((r) => r.domain === "Accounts"));
    expect([...rulePriorityRanks(accounts).values()]).toEqual([1, 2]);
    const alphabetic = sortRules(rules, "name", "asc");
    expect([...rulePriorityRanks(alphabetic, "name").keys()]).toEqual(alphabetic);
  });
  test("a blank number is last in both directions", () => {
    const asc = ids(sortRules(rules, "score", "asc"));
    const desc = ids(sortRules(rules, "score", "desc"));
    expect(asc.at(-1)).toBe("Trades:R_B");
    expect(desc.at(-1)).toBe("Trades:R_B");
    expect(desc[0]).toBe("Accounts:R_D");
    expect(ids(sortRules(rules, "coverage", "desc"))).toEqual([
      "Trades:R_E", "Trades:R_B", "Prices:R_C", "Accounts:R_D", "Prices:R_F", "Accounts:R_A",
    ]);
  });
  test("sorting by score ascending is the default order", () => {
    expect(ids(sortRules(rules, "score", "asc"))).toEqual(ids(defaultRuleOrder(rules)));
  });
  test("text columns sort as text; ties fall back to the default order", () => {
    const named = [
      rule("Securities", "POS_KEYS", 70, 50, { name: "keys mastered", owner: "b" }),
      rule("Accounts", "POS_KEYS", 90, 50, { name: "keys mastered", owner: "a" }),
      rule("Trades", "T1", 10, 50, { name: "Amount present", owner: "c" }),
    ];
    expect(ids(sortRules(named, "name", "asc"))).toEqual(["Trades:T1", "Securities:POS_KEYS", "Accounts:POS_KEYS"]);
    expect(ids(sortRules(named, "name", "desc"))).toEqual(["Securities:POS_KEYS", "Accounts:POS_KEYS", "Trades:T1"]);
    expect(ids(sortRules(named, "domain", "desc"))).toEqual(["Trades:T1", "Securities:POS_KEYS", "Accounts:POS_KEYS"]);
    expect(ids(sortRules(named, "owner", "asc"))).toEqual(["Accounts:POS_KEYS", "Securities:POS_KEYS", "Trades:T1"]);
  });
  test("confirmed-only sorts as a number", () => {
    const r = [rule("A", "X", 1, 1, { confirmedOnly: 9 }), rule("A", "Y", 1, 1, { confirmedOnly: 10 }), rule("A", "Z", 1, 1, { confirmedOnly: null })];
    expect(ids(sortRules(r, "confirmedOnly", "asc"))).toEqual(["A:X", "A:Y", "A:Z"]);
    expect(ids(sortRules(r, "confirmedOnly", "desc"))).toEqual(["A:Y", "A:X", "A:Z"]);
  });
});

describe("scenarios", () => {
  const all = [
    scenario("z empty", 0, null),
    scenario("a empty", null, null),
    scenario("unknown few", 5, null, 2),
    scenario("unknown many", 5, null, 9),
    scenario("unknown blank accounts", 5, null, null),
    scenario("priced zero", 5, 0),
    scenario("priced small", 5, 100),
    scenario("priced big", 5, 5000),
  ];

  test("split into priced, not priced and no records, each in its order", () => {
    const { priced, notPriced, noRecords } = splitScenarios(all);
    expect(names(priced)).toEqual(["priced big", "priced small", "priced zero"]);
    expect(names(notPriced)).toEqual(["unknown many", "unknown few", "unknown blank accounts"]);
    expect(names(noRecords)).toEqual(["a empty", "z empty"]);
  });
  test("equal gross dollars are ordered by name", () => {
    expect(names(splitScenarios([scenario("b", 1, 10), scenario("a", 1, 10)]).priced)).toEqual(["a", "b"]);
  });
  test("the largest priced scenario ignores a zero gross and is null when nothing is priced", () => {
    expect(largestScenario(all)?.scenario).toBe("priced big");
    expect(largestScenario([scenario("priced zero", 5, 0), scenario("unknown", 5, null)])).toBeNull();
    expect(largestScenario([])).toBeNull();
  });
  test("financial priority follows fund-relative NAV effect while the headline still follows gross dollars", () => {
    const highNav = { ...scenario("small-dollar high-NAV", 1, 10), maxFundNetBps: 75 };
    const highGross = { ...scenario("large-dollar low-NAV", 1, 9000), maxFundNetBps: 4 };
    const zero = { ...scenario("zero effect", 1, 0), maxFundNetBps: 0 };
    const unknown = scenario("NAV unknown", 1, 200);
    const input = [highGross, unknown, zero, highNav];
    expect(names(navImpactOrder(input))).toEqual([highNav.scenario, highGross.scenario, zero.scenario, unknown.scenario]);
    expect(largestScenario(input)).toBe(highGross);
    const ranks = scenarioPriorityRanks(navImpactOrder(input));
    expect(ranks.get(highNav)).toBe(1);
    expect(ranks.get(highGross)).toBe(2);
    expect(ranks.get(zero)).toBe(3);
    expect(ranks.has(unknown)).toBe(false);
    const grossOrder = splitScenarios(input).priced;
    const grossRanks = scenarioPriorityRanks(grossOrder, "grossUsd");
    expect(grossRanks.get(highGross)).toBe(1);
    expect(grossRanks.get(unknown)).toBe(2); // missing NAV does not prevent ranking known dollars
    expect(grossRanks.get(zero)).toBe(4);
    const ascendingRanks = scenarioPriorityRanks([...grossOrder].reverse(), "grossUsd");
    expect(ascendingRanks.get(zero)).toBe(1);
    expect(scenarioPriorityRanks([scenario("unpriced", 1, null, 20)], "distinctAccounts").size).toBe(0);
    expect(input[0]).toBe(highGross);
  });
  test("equal NAV impacts use gross USD then name as deterministic tie-breakers", () => {
    const a = { ...scenario("a", 1, 20), maxFundNetBps: 10 };
    const b = { ...scenario("b", 1, 20), maxFundNetBps: 10 };
    const c = { ...scenario("c", 1, 40), maxFundNetBps: 10 };
    expect(names(navImpactOrder([b, a, c]))).toEqual(["c", "a", "b"]);
  });
});

describe("score targets", () => {
  test("the Executive View uses a 95 platform target and a 99.50 NAV domain target", () => {
    expect(PLATFORM_SCORE_TARGET).toBe(95);
    expect(DOMAIN_SCORE_TARGETS.get("NAV")).toBe(99.50);
  });

  test.each([
    [99, 98, 98, "ok"],
    [98, 98, 98, "ok"],
    [97, 98, 98, "warn"],
    [93.10, 98, 98, "warn"],
    [93.09, 98, 98, "bad"],
    [0, 95, 95, "bad"],
    [98, null, null, null],
    [null, 98, 98, null],
    [98, 101, null, null],
    [98, Number.NaN, null, null],
  ])("score %s with minimum %s has target %s and tone %s", (score, minimum, target, tone) => {
    expect(scoreTargetStatus(score, minimum)).toEqual({ target, tone });
  });
});

describe("KPI attainment aligned with domain rulings", () => {
  const sample = { target: "at least 99.5%", numerator: null, denominator: null, value: 98, met: "no", status: "computed" };
  test("NAV retains the domain target and its warning band", () => {
    expect(kpiAttainmentTone(sample)).toBe(scoreTargetStatus(98, DOMAIN_SCORE_TARGETS.get("NAV")!).tone);
    expect(kpiAttainmentTone(sample)).toBe("warn");
  });
  test.each([
    [{ value: 99.5, met: "yes" }, "ok"],
    [{ value: 90 }, "bad"],
    [{ value: null }, null],
    [{ status: "proposed" }, null],
    [{ met: "" }, null],
    [{ value: 0.0104, target: "at most 0.01%" }, "warn"],
    [{ value: 0.3, target: "at most 0.01%" }, "bad"],
    [{ value: 0, target: "at most 0.01%", met: "yes" }, "ok"],
  ])("ruling for %j is %s", (extra, tone) => {
    expect(kpiAttainmentTone({ ...sample, ...extra })).toBe(tone);
  });
  test("the warning boundary uses exact counts, not a rate rounded toward the bad side", () => {
    expect(kpiAttainmentTone({ ...sample, value: 94.52, numerator: 94525, denominator: 100000 })).toBe("warn");
    expect(kpiAttainmentTone({ ...sample, value: 94.52, numerator: 94524, denominator: 100000 })).toBe("bad");
  });
});

describe("leading indicators", () => {
  test("the headline and detail entries use historical breaches for computed leading indicators", () => {
    const list = [
      indicator("I1", "Leading", "computed", 3, "2026-07-02"),
      indicator("I2", "Leading", "computed", 0, ""),
      indicator("I3", "Leading", "computed", 1, "2026-06-20"),
      indicator("I4", "Leading", "computed", null, ""),
      indicator("I5", "Leading", "proposed", 4, "2026-01-01"),
      indicator("I6", "Lagging", "computed", 2, "2026-01-02"),
    ];
    list[0].series = [{ key: "all", period: "day", points: [
      { ...pt(1), start: "2026-06-01", breach: true },
      { ...pt(0), start: "2026-07-10", breach: false },
    ] }];
    list[4].series = [{ key: "all", period: "day", points: [{ ...pt(1), start: "2026-01-01" }] }];
    const summary = leadingBreaches(list);
    expect(summary).toMatchObject({ breaching: 2, computed: 4, start: "2026-06-01", end: "2026-07-10" });
    expect(summary.entries.map(({ indicator, recordedBreach }) => [indicator.id, recordedBreach])).toEqual([
      ["I1", true], ["I2", false], ["I3", true], ["I4", false],
    ]);
  });
  test("no series leaves the reporting dates unavailable", () => {
    expect(leadingBreaches([indicator("I1", "Leading", "computed", 0, "")]))
      .toMatchObject({ breaching: 0, computed: 1, start: "", end: "" });
    expect(leadingBreaches([])).toEqual({ entries: [], breaching: 0, computed: 0, start: "", end: "" });
  });
});

describe("trend lines", () => {
  const series = (key: string, period: string, points: SeriesPoint[]): IndicatorSeries => ({ key, period, points });

  test("only daily or effective-date series with two valued points are drawn", () => {
    const list = [
      series("all", "day", [pt(1), pt(2)]),
      series("all", "effective date", [pt(1), pt(null), pt(3)]),
      series("all", "week", [pt(1), pt(2)]),
      series("F1", "day", [pt(1), pt(null)]),
      series("F2", "day", [pt(1)]),
    ];
    expect(drawable(list).map((s) => `${s.key} ${s.period}`)).toEqual(["all day", "all effective date"]);
  });
  test("fewer than two valued points draws nothing", () => {
    expect(sparkline([pt(5)], 100, 20)).toBeNull();
    expect(sparkline([pt(5), pt(null)], 100, 20)).toBeNull();
    expect(sparkline([], 100, 20)).toBeNull();
  });
  test("a rising series spans the box, low at the bottom", () => {
    expect(sparkline([pt(0), pt(5), pt(10)], 100, 20)).toMatchObject({ path: "M0 20 L50 10 L100 0", marks: [], low: 0, high: 10, limits: [] });
  });
  test("a constant series is a flat line at mid height", () => {
    expect(sparkline([pt(7), pt(7), pt(7)], 120, 28)?.path).toBe("M0 14 L60 14 L120 14");
  });
  test("blank values are skipped and breach points are marked", () => {
    expect(sparkline([pt(0), pt(null, true), pt(10, true)], 100, 20)).toMatchObject({
      path: "M0 20 L100 0", marks: [{ x: 100, y: 0 }],
    });
  });
  test("coordinates are rounded to two decimals", () => {
    expect(sparkline([pt(0), pt(1), pt(2), pt(3)], 100, 30)?.path).toBe("M0 30 L33.33 20 L66.67 10 L100 0");
  });
  test("the range takes in a limit above the values, so a small wiggle stays small", () => {
    const line = sparkline([pt(10, false, 40), pt(20, false, 40)], 100, 30);
    expect(line).toMatchObject({ path: "M0 30 L100 20", low: 10, high: 40, limits: [{ value: 40, y: 0 }] });
  });
  test("the range takes in a limit below the values", () => {
    const line = sparkline([pt(5, true, 0), pt(10, true, 0)], 100, 20);
    expect(line).toMatchObject({ path: "M0 10 L100 0", low: 0, high: 10, limits: [{ value: 0, y: 20 }] });
  });
  test("each distinct limit is drawn once", () => {
    const line = sparkline([pt(2, false, 6), pt(4, false, 6), pt(8, true, 6)], 100, 30);
    expect(line?.limits).toEqual([{ value: 6, y: 10 }]);
  });
  test("every valued point carries what the hover box shows", () => {
    const line = sparkline([pt(3, false, 9, "2026-03-02"), pt(null), pt(12, true, 9, "2026-03-04")], 100, 30);
    expect(line?.points).toEqual([
      { x: 0, y: 30, start: "2026-03-02", value: 3, threshold: 9, breach: false },
      { x: 100, y: 0, start: "2026-03-04", value: 12, threshold: 9, breach: true },
    ]);
  });
  test("the hovered point is the nearest one to the pointer", () => {
    expect(nearestIndex(5, 0)).toBe(0);
    expect(nearestIndex(5, 0.3)).toBe(1);
    expect(nearestIndex(5, 0.4)).toBe(2);
    expect(nearestIndex(5, 1)).toBe(4);
    expect(nearestIndex(5, -0.2)).toBe(0);
    expect(nearestIndex(5, 1.3)).toBe(4);
  });
  test("the x-axis caption names the series period", () => {
    expect(seriesAxis("day")).toBe("Date (one point per day)");
    expect(seriesAxis("effective date")).toBe("Effective date");
    expect(seriesAxis("week")).toBe("Week starting");
  });
});

describe("stress state", () => {
  const stress = (before: number | null, rates = 1): Stress => ({
    rates: Array.from({ length: rates }, () => ({ role: "defect", level: "all", cases: 1, share: 1, drawn: 1, wanted: 1 })),
    measures: [{ measure: "other", before: 1, after: 1 }, { measure: "platform score", before, after: 80 }],
    run: {},
  });

  test("no stress outputs, or no rates, is not run", () => {
    expect(stressState(null, 89.82)).toBe("not run");
    expect(stressState(stress(89.82, 0), 89.82)).toBe("not run");
  });
  test("a platform score before injection that differs from the scorecard is an older run", () => {
    expect(stressState(stress(88.5), 89.82)).toBe("older run");
    expect(stressState(stress(89.81), 89.82)).toBe("older run");
  });
  test("the same score, a blank before or no such measure is current", () => {
    expect(stressState(stress(89.82), 89.82)).toBe("current");
    expect(stressState(stress(null), 89.82)).toBe("current");
    expect(stressState({ ...stress(1), measures: [] }, 89.82)).toBe("current");
  });
});

describe("trace links", () => {
  test("ID kinds trace their ID; a price row traces its security and says so", () => {
    for (const kind of ["transaction row", "transaction_id", "position row", "security", "action", "ledger row"]) {
      expect(traceTarget(kind, "X1")).toEqual({ id: "X1", note: "" });
    }
    expect(traceTarget("price row", "S1 2026-07-10 V1")).toEqual({ id: "S1", note: "opens this price's security" });
  });
  test("each untraceable kind says why", () => {
    expect(noTraceReason("rate row")).toBe("No single record to trace: a currency rate is shared by many records");
    expect(noTraceReason("feed-day")).toBe("No single record to trace: this is one feed on one day");
    expect(noTraceReason("key")).toBe("No record ID to trace");
  });
  test("an impact row traces its ledger line first, else its account/security key", () => {
    const row = { accountId: "A1", securityId: "S1", fundId: "F1", deltaUnits: 1, deltaUsd: 1, valuationReason: "", ledgerId: "" };
    expect(impactTraceTarget({ ...row, ledgerId: "L1" })).toBe("L1");
    expect(impactTraceTarget(row)).toBe("A1/S1");
    expect(impactTraceTarget({ ...row, securityId: "" })).toBeNull();
    expect(impactTraceTarget({ ...row, accountId: "" })).toBeNull();
  });
});

describe("link builders", () => {
  test("parameters in a fixed order, defaults and unset values left out", () => {
    expect(traceHref("A1/S1")).toBe("/trace?id=A1%2FS1");
    expect(ruleHref("Trades", "R1")).toBe("/executive/rule?domain=Trades&rule=R1");
    expect(ruleHref("Trades", "R1", { page: 1 })).toBe("/executive/rule?domain=Trades&rule=R1");
    expect(ruleHref("Trades", "R1", { page: 3, finding: "F", result: "cleared" }))
      .toBe("/executive/rule?domain=Trades&rule=R1&result=cleared&finding=F&page=3");
    expect(accountHref("A1")).toBe("/executive/account?id=A1");
    expect(accountHref("A1", { page: 2, result: "confirmed fail", domain: "Prices", finding: "F" }))
      .toBe("/executive/account?id=A1&domain=Prices&result=confirmed+fail&finding=F&page=2");
    expect(scenarioHref("S", { page: 2, priced: "no" })).toBe("/executive/scenario?name=S&priced=no&page=2");
    expect(scenarioHref("S", { page: 1 })).toBe("/executive/scenario?name=S");
  });
  test("the executive page defaults to dollars, with explicit score and domain links", () => {
    expect(executiveHref({})).toBe("/executive");
    expect(executiveHref({ by: "score" })).toBe("/executive?by=score");
    expect(executiveHref({ by: "dollars" })).toBe("/executive?by=dollars");
    expect(executiveHref({ by: "dollars", domain: "Corporate actions" })).toBe("/executive?by=dollars&domain=Corporate+actions#fix-first");
  });
});
