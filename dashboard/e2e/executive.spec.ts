import path from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import { test, expect, type Locator, type Page } from "@playwright/test";
import { DOMAIN_SCORE_TARGETS, PLATFORM_SCORE_TARGET, WORST_ACCOUNTS, accountHref, fmtBps, fmtCount, fmtNumber, fmtScore, fmtUsd, fmtUsdShort, ruleHref, scenarioHref, scoreTargetStatus } from "../lib/executive";

// The fixture's CSV files (made up, tests/fixtures/small); the page must show what they hold.
const FIXTURE = path.join(__dirname, "../../tests/runs/dashboard_browser_fixture");
const SHOTS = "../tests/runs/dashboard_browser/shots";
const runtimeErrors = new WeakMap<Page, string[]>();
const domainOrder = ["Accounts", "Securities", "Trades", "Corporate Actions", "Positions", "Prices", "NAV"];
const targetLabels = { ok: "Met target", warn: "Near target", bad: "Missed target" };

async function expectScoreTarget(card: Locator, score: string, minimum: number) {
  const { tone } = scoreTargetStatus(score ? Number(score) : null, minimum);
  await expect(card.getByText(`Target ${fmtScore(minimum)}`, { exact: true })).toBeVisible();
  await expect(card.getByText(tone ? targetLabels[tone] : "No score", { exact: true })).toBeVisible();
  const scoreLabel = score ? `Score ${score} on a scale of 0 to 100` : "No score";
  await expect(card.getByRole("img", { name: `${scoreLabel}, target ${fmtScore(minimum)}`, exact: true })).toBeVisible();
}

async function expandRankedPreview(section: Locator, rowId: string, total: number) {
  const rows = section.getByTestId(rowId);
  await expect(rows).toHaveCount(Math.min(5, total));
  if (total <= 5) {
    await expect(section.getByRole("button", { name: /^Show \d+ more$/ })).toHaveCount(0);
    return;
  }
  const firstLinks = await rows.getByRole("link").allTextContents();
  const toggle = section.getByRole("button", { name: `Show ${total - 5} more`, exact: true });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.press("Enter");
  await expect(rows).toHaveCount(total);
  expect((await rows.getByRole("link").allTextContents()).slice(0, firstLinks.length)).toEqual(firstLinks);
  await expect(section.getByRole("button", { name: "Show fewer", exact: true })).toHaveAttribute("aria-expanded", "true");
}

async function collapseRankedPreview(section: Locator, rowId: string, total: number) {
  if (total <= 5) return;
  await section.getByRole("button", { name: "Show fewer", exact: true }).press("Space");
  await expect(section.getByTestId(rowId)).toHaveCount(5);
  await expect(section.getByRole("button", { name: `Show ${total - 5} more`, exact: true })).toBeFocused();
}

async function csv(file: string): Promise<Record<string, string>[]> {
  const instance = await DuckDBInstance.create(":memory:");
  const con = await instance.connect();
  try {
    const result = await con.runAndReadAll("SELECT * FROM read_csv($1, all_varchar = true, header = true)", [
      path.join(FIXTURE, file),
    ]);
    return result.getRowObjectsJson() as Record<string, string>[];
  } finally {
    con.closeSync();
    instance.closeSync();
  }
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
  await page.addInitScript(() => sessionStorage.setItem("dfe-boot-seen", "1"));
  runtimeErrors.set(page, errors);
});

test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page)).toEqual([]);
});

test("executive view shows the scorecard's own figures", async ({ page }) => {
  const platform = (await csv("02_scorecard.csv")).find((r) => r.level === "platform")!;
  await page.goto("/executive");
  await expect(page.getByRole("heading", { level: 1, name: "Executive view" })).toBeVisible();
  const priorityTabs = page.locator("#fix-first").getByRole("tab");
  await expect(priorityTabs).toHaveText(["By dollar impact", "By quality score"]);
  await expect(priorityTabs.first()).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("scenario-row").first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Executive Metrics", "Early Warning Signs (Leading Indicators)", "KPIs by Office", "Worst Accounts",
    "Fix Priority", "Data Integrity Status",
  ]);
  const metrics = page.getByRole("region", { name: "Executive Metrics", exact: true });
  await expect(metrics.getByRole("heading", { level: 3, name: "Domains" })).toBeVisible();
  await expect(metrics.getByTestId("tile-impact")).toBeVisible();
  await expect(metrics.getByTestId("tile-leading")).toBeVisible();
  const tile = metrics.getByTestId("tile-platform");
  await expect(tile.getByTestId("score")).toHaveText(platform.score);
  await expectScoreTarget(tile, platform.score, PLATFORM_SCORE_TARGET);
  const summary = tile.getByRole("button", { name: /Platform Score/ });
  await expect(summary).toHaveAttribute("aria-expanded", "false");
  await expect(tile.getByTestId("coverage")).toBeHidden();
  await summary.press("Enter");
  await expect(tile.getByTestId("coverage")).toContainText(platform.coverage);
  await expect(tile.getByTestId("confirmed-only")).toContainText(platform.confirmed_only_score);
  await expect(tile.getByText("Unresolved-only cases receive 50% credit", { exact: false })).toBeVisible();
  await summary.press("Space");
  await expect(tile.getByTestId("coverage")).toBeHidden();

  const domains = (await csv("02_scorecard.csv")).filter((r) => r.level === "domain");
  const cards = metrics.getByRole("region", { name: "Domains", exact: true }).getByTestId("domain-card");
  await expect(cards).toHaveCount(domains.length);
  await expect(cards.getByRole("link")).toHaveText(domainOrder);
  for (const d of domains) {
    const card = cards.filter({ has: page.getByRole("link", { name: new RegExp(`^${d.domain}$`, "i") }) });
    await expect(card.getByTestId("score")).toHaveText(d.score);
    await expectScoreTarget(card, d.score, DOMAIN_SCORE_TARGETS.get(d.domain)!);
  }
  const accounts = cards.first();
  const accountDetails = accounts.getByRole("button", { name: "Score details for Accounts" });
  await accountDetails.press("Enter");
  await expect(accounts.getByText("Confirmed-only score", { exact: true })).toBeVisible();
  await expect(accounts.getByText(domains[0].owner, { exact: true })).toBeVisible();
  await accountDetails.press("Space");
  await expect(accountDetails).toHaveAttribute("aria-expanded", "false");

  const rowWidths = await page.getByTestId("domain-top-row").evaluate((row) => {
    const box = row.getBoundingClientRect();
    const cards = Array.from(row.children, (card) => card.getBoundingClientRect());
    return { left: cards[0].left - box.left, right: box.right - cards.at(-1)!.right, width: cards[0].width };
  });
  const bottomWidths = await page.getByTestId("domain-bottom-row").getByTestId("domain-card")
    .evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().width));
  expect(rowWidths.left).toBeGreaterThan(0);
  expect(Math.abs(rowWidths.left - rowWidths.right)).toBeLessThan(1);
  expect(bottomWidths).toHaveLength(4);
  for (const width of bottomWidths) expect(Math.abs(width - rowWidths.width)).toBeLessThan(1);
  await page.screenshot({ path: `${SHOTS}/executive-light.png`, fullPage: true });
  await page.evaluate(() => localStorage.setItem("theme", "dark"));
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  await page.reload();
  await expect(page.getByTestId("tile-platform")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/executive-dark.png`, fullPage: true });
});

test("office KPI targets follow the unchanged domain targets and use matching attainment", async ({ page }) => {
  await page.goto("/executive");
  const kpis = await csv("02_kpis.csv");
  const links: Record<string, string> = { "1": "Accounts", "2": "Trades", "4": "Positions", "5": "Prices", "6": "NAV" };
  for (const kpi of kpis) {
    if (links[kpi.n]) expect(Number(kpi.target.match(/[0-9.]+/)![0])).toBe(DOMAIN_SCORE_TARGETS.get(links[kpi.n]));
    const value = Number(kpi.value);
    const threshold = Number(kpi.target.match(/[0-9.]+/)![0]);
    const close = kpi.target.startsWith("at most") ? value <= threshold * 1.05 : value >= threshold * 0.95;
    const expected = kpi.status !== "computed" || !kpi.met ? "Not assessed" : kpi.met === "yes" ? "Met target" : close ? "Near target" : "Missed target";
    await expect(page.getByTestId(`kpi-${kpi.n}`).getByTestId("target-attainment")).toHaveText(expected);
  }
  const nav = page.getByTestId("domain-card").filter({ has: page.getByRole("link", { name: "NAV", exact: true }) });
  await expect(nav.getByText("Target 99.50", { exact: true })).toBeVisible();
  await expect(page.getByTestId("kpi-6")).toContainText("at least 99.5%");
});

test("domain targets and attainment stay stacked and aligned at different widths", async ({ page }) => {
  await page.goto("/executive");
  for (const width of [1550, 1100, 760]) {
    await page.setViewportSize({ width, height: 1100 });
    await expect(page.getByTestId("domain-card")).toHaveCount(7);
    await expect(page.getByTestId("domain-card").first()).toBeVisible();
    const layout = await page.getByTestId("domain-card").evaluateAll((cards) => cards.map((card) => {
      const bounds = card.getBoundingClientRect();
      const target = card.querySelector('[data-testid="score-target-minimum"]')!.getBoundingClientRect();
      const badge = card.querySelector('[data-testid="target-attainment"]')!.getBoundingClientRect();
      const bar = card.querySelector('[data-testid="score-target-bar"]')!.getBoundingClientRect();
      return { top: bounds.top, height: bounds.height, targetOffset: target.top - bounds.top,
        targetBottom: target.bottom, badgeTop: badge.top, badgeBottom: badge.bottom, barTop: bar.top,
        badgeOffset: badge.top - bounds.top, barOffset: bar.top - bounds.top };
    }));
    for (const card of layout) {
      expect(card.badgeTop).toBeGreaterThan(card.targetBottom);
      expect(card.barTop).toBeGreaterThan(card.badgeBottom);
      expect(card.targetOffset).toBeCloseTo(layout[0].targetOffset, 0);
      expect(card.badgeOffset).toBeCloseTo(layout[0].badgeOffset, 0);
      expect(card.barOffset).toBeCloseTo(layout[0].barOffset, 0);
      for (const other of layout.filter((other) => Math.abs(other.top - card.top) < 1)) expect(other.height).toBeCloseTo(card.height, 0);
    }
  }
  await page.setViewportSize({ width: 1550, height: 1100 });
  await page.locator("#degrading").screenshot({ path: `${SHOTS}/domain-target-alignment.png` });
});

test("the executive metrics overview fits a desktop view and centers its figures", async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/executive");
    const overview = page.locator("#executive-metrics");
    await expect(overview.getByTestId("domain-card")).toHaveCount(7);
    await expect(overview.getByTestId("domain-card").last()).toBeVisible();
    const box = (await overview.boundingBox())!;
    const frame = (await page.getByTestId("page-frame").boundingBox())!;
    expect(box.height, `overview height at ${viewport.width}x${viewport.height}`).toBeLessThanOrEqual(frame.height - 16);
    await overview.scrollIntoViewIfNeeded();
    const centered = await overview.locator('[data-testid="headline-value"], [data-testid="domain-card"] > [data-testid="score"]').evaluateAll((values) => values.map((value) => {
      const card = value.closest('[data-testid="domain-card"], [data-testid^="tile-"]')!.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(value);
      const text = range.getBoundingClientRect();
      return Math.abs((text.left + text.right) / 2 - (card.left + card.right) / 2);
    }));
    expect(centered).toHaveLength(10);
    for (const offset of centered) expect(offset).toBeLessThanOrEqual(2);
    for (const id of ["I1", "I2", "I3", "I4"]) {
      const cell = overview.getByTestId(`trigger-${id}`);
      const code = (await cell.getByTestId("trigger-code").boundingBox())!;
      const name = (await cell.getByTestId("trigger-name").boundingBox())!;
      expect(Math.abs(code.y - name.y)).toBeLessThanOrEqual(1);
      expect(name.x).toBeGreaterThan(code.x + code.width);
    }
    await overview.screenshot({ path: `${SHOTS}/compact-metrics-${viewport.width}.png` });
  }
});

test("headline disclosures use the same historical indicator and impact results as the outputs", async ({ page }) => {
  const indicators = (await csv("02_indicators.csv")).filter((i) => i.type === "Leading" && i.status === "computed");
  const breaching = indicators.filter((i) => Number(i.breaches) > 0);
  const dates = (await csv("02_indicator_series.csv")).filter((s) => indicators.some((i) => i.id === s.id))
    .map((s) => s.start).filter(Boolean).sort();
  const scenario = (await csv("02_severity.csv")).filter((s) => Number(s.financial_rows) && Number(s.gross_delta_usd_valued_subset) > 0)
    .sort((a, b) => Number(b.gross_delta_usd_valued_subset) - Number(a.gross_delta_usd_valued_subset) || a.scenario.localeCompare(b.scenario, "en"))[0];
  await page.goto("/executive");
  const impact = page.getByTestId("tile-impact");
  const impactTrigger = impact.getByRole("button", { name: /Largest Impact Scenario/ });
  await expect(impactTrigger).toContainText(fmtUsdShort(Number(scenario.gross_delta_usd_valued_subset)));
  await expect(impactTrigger).toHaveAttribute("aria-expanded", "false");
  const coverage = impact.getByTestId("scenario-coverage");
  await expect(coverage).toBeVisible();
  await expect(coverage.getByTestId("scenario-priced")).toHaveText(`${fmtCount(Number(scenario.valued_rows))} priced`);
  await expect(coverage.getByTestId("scenario-unpriced")).toHaveText(`${fmtCount(Number(scenario.unknown_rows))} unpriced`);
  await expect(coverage.getByRole("img")).toHaveAttribute("aria-label", /Row coverage, not a share of financial exposure/);
  await impactTrigger.press("Enter");
  await expect(impact.getByText("Share of rows priced")).toBeVisible();
  await expect(impact.getByRole("link", { name: "View scenario details" })).toHaveAttribute("href", scenarioHref(scenario.scenario));
  await impactTrigger.press("Space");

  const leading = page.getByTestId("tile-leading");
  const leadingTrigger = leading.getByRole("button", { name: /^Early Warning Signs Triggered/ });
  await expect(leadingTrigger).toContainText(`${breaching.length} of ${indicators.length}`);
  await expect(leadingTrigger).toHaveAttribute("aria-expanded", "false");
  const matrix = leading.getByTestId("indicator-trigger-matrix");
  await expect(matrix).toBeVisible();
  await expect(matrix.getByText("Triggered", { exact: true })).toBeVisible();
  await expect(matrix.getByText("Not triggered", { exact: true })).toBeVisible();
  await expect(matrix.getByRole("img")).toHaveCount(4);
  for (const id of ["I1", "I2", "I3", "I4"]) {
    const indicator = indicators.find((item) => item.id === id);
    const count = indicator?.breaches;
    const state = count === undefined || count === null || count === "" ? "unavailable"
      : Number(count) > 0 ? "triggered" : "not-triggered";
    const cell = matrix.getByTestId(`trigger-${id}`);
    await expect(cell).toHaveAttribute("data-state", state);
    await expect(cell).toHaveAttribute("aria-label", new RegExp(`^L${id}:`));
  }
  await leadingTrigger.press("Enter");
  await expect(leading.getByRole("listitem")).toHaveCount(indicators.length);
  await expect(leading.getByRole("link", { name: "Pricing readiness", exact: true })).toHaveAttribute("href", "#indicator-I4");
  await expect(leading.getByRole("listitem").getByText("Recorded a breach", { exact: true })).toHaveCount(breaching.length);
  await expect(leading.getByText(dates[0], { exact: true })).toBeVisible();
  await expect(leading.getByText(dates.at(-1)!, { exact: true })).toBeVisible();
  await leading.getByRole("link", { name: indicators[0].indicator, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`#indicator-${indicators[0].id}$`));
});

test("trend lines have axes, a limit line and a hover box for every point", async ({ page }) => {
  const indicators = (await csv("02_indicators.csv")).filter((i) => i.status === "computed");
  const series = (await csv("02_indicator_series.csv")).filter((s) => s.period === "day" || s.period === "effective date");
  const id = indicators.find((i) => series.filter((s) => s.id === i.id && s.value !== null).length >= 2)!.id;
  const unit = indicators.find((i) => i.id === id)!.unit;
  const key = series.find((s) => s.id === id && s.value !== null)!.key;
  const rows = series.filter((s) => s.id === id && s.key === key && s.value !== null);
  await page.goto("/executive");
  const card = page.getByTestId(`indicator-${id}`);
  const chart = card.getByRole("img").first();
  const tip = card.getByTestId("spark-tooltip");
  await expect(card.getByText(/^(Date \(one point per day\)|Effective date)$/).first()).toBeVisible();
  if (rows.some((r) => r.threshold !== null)) await expect(card.getByTestId("spark-limit").first()).toBeAttached();
  await expect(tip).toHaveCount(0);

  await chart.scrollIntoViewIfNeeded();
  const box = (await chart.boundingBox())!;
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await expect(tip).toContainText(rows[0].start);
  await expect(tip).toContainText(unit);
  await expect(tip).toContainText(rows[0].breach === "yes" ? "Breach" : "Within limit");
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2);
  await expect(tip).toContainText(rows.at(-1)!.start);
  await page.mouse.move(0, 0);
  await expect(tip).toHaveCount(0);

  await chart.focus();
  await chart.press("Home");
  await expect(tip).toContainText(rows[0].start);
  await chart.press("ArrowRight");
  await expect(tip).toContainText(rows[1].start);
});

test("the leading indicators stack beside booking alerts on wide screens", async ({ page }) => {
  await page.goto("/executive");
  const cardBox = async (id: string) => {
    const card = page.getByTestId(`indicator-${id}`);
    await expect(card).toBeVisible();
    return (await card.boundingBox())!;
  };
  const first = await cardBox("I1");
  const actions = await cardBox("I3");
  const pricing = await cardBox("I4");
  const booking = await cardBox("I2");
  expect(actions.x).toBeCloseTo(first.x, 0);
  expect(pricing.x).toBeCloseTo(first.x, 0);
  expect(actions.y).toBeGreaterThan(first.y + first.height);
  expect(pricing.y).toBeGreaterThan(actions.y + actions.height);
  expect(booking.y).toBeCloseTo(first.y, 0);
  expect(booking.x).toBeGreaterThan(first.x + first.width);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobilePricing = await cardBox("I4");
  const mobileBooking = await cardBox("I2");
  expect(mobileBooking.x).toBeCloseTo(mobilePricing.x, 0);
  expect(mobileBooking.y).toBeGreaterThan(mobilePricing.y + mobilePricing.height);
});

test("every executive section says what it is for", async ({ page }) => {
  await page.goto("/executive");
  const intros: [string, string][] = [
    ["executive-metrics", "How healthy our data is overall and in each data area, scored against its target."],
    ["leading-indicators", "Signals that move before a problem reaches client accounts or the reconciliation. A triggered sign means: act now, before it becomes a break."],
    ["office-kpis", "How each office (front, middle and back) is doing against its target."],
    ["worst-accounts", "The client accounts with the lowest data quality scores: where errors are most likely to reach a client."],
    ["fix-first", "Where repair work pays off most: the checks with the lowest scores, or the scenarios with the largest modeled NAV impact."],
    ["trust", "Can these numbers be trusted? The results of our stress test and our sensitivity check."],
  ];
  for (const [id, text] of intros) {
    const intro = page.locator(`#${id}-intro`);
    await expect(intro).toHaveText(text);
    await expect(intro).toBeVisible(); // the Data Integrity Status section is still closed here
    await expect(page.locator(`section#${id}`)).toHaveAttribute("aria-describedby", `${id}-intro`);
  }
});

test("leading indicators, KPIs and worst accounts are listed, blanks stay blanks", async ({ page }) => {
  const indicators = await csv("02_indicators.csv");
  await page.goto("/executive");
  await expect(page.getByRole("heading", { level: 2, name: "Early Warning Signs (Leading Indicators)", exact: true })).toBeVisible();
  for (const i of indicators.filter((i) => i.type === "Leading")) {
    await expect(page.getByTestId(`indicator-${i.id}`)).toBeVisible();
  }
  for (const i of indicators.filter((i) => i.type === "Lagging")) {
    await expect(page.getByTestId(`indicator-${i.id}`)).toHaveCount(0);
  }
  const booking = indicators.find((i) => i.id === "I2")!;
  const bookingCard = page.getByTestId("indicator-I2");
  await expect(bookingCard.getByRole("heading", { name: "Pre-cutoff booking alerts" })).toBeVisible();
  await expect(bookingCard.getByText("trades above latency threshold (103 minutes)", { exact: true })).toBeVisible();
  const bookingDescription = bookingCard.getByText(`${booking.threshold}. Historical replay by feed and cutoff day.`, { exact: true });
  await expect(bookingDescription).toBeHidden();
  await bookingCard.getByRole("button", { name: /Indicator details/ }).press("Enter");
  await expect(bookingDescription).toBeVisible();
  await expect(bookingCard.getByText("Feed days with alerts")).toBeVisible();
  const pricingCard = page.getByTestId("indicator-I4");
  await expect(pricingCard.getByRole("heading", { name: "Pricing readiness", exact: true })).toBeVisible();
  await pricingCard.getByRole("button", { name: "Indicator details for Pricing readiness" }).press("Enter");
  await expect(pricingCard.getByText("What it measures")).toBeVisible();
  await expect(page.getByText("not computed").first()).toBeVisible(); // KPI 7
  const accounts = await csv("02_scorecard_accounts.csv");
  const worst = accounts.find((r) => r.rank === "1")!;
  await expect(page.getByRole("link", { name: worst.account_id })).toBeVisible();
  await expect(page.locator("main")).not.toContainText("NaN");
  await expect(page.getByRole("region", { name: "Worst Accounts", exact: true }).getByTestId("worst-accounts")).toBeVisible();
  const shown = accounts.filter((a) => a.rank !== null && Number(a.rank) <= WORST_ACCOUNTS);
  const list = page.getByTestId("worst-accounts");
  await expandRankedPreview(list, "worst-account-row", shown.length);
  const cell = shown.flatMap((a) => Object.keys(a)
    .filter((c) => c.endsWith(" coverage") && a[c] !== null && a[c] !== a[`${c.slice(0, -" coverage".length)} score`])
    .map((c) => ({ account: a.account_id, domain: c.slice(0, -" coverage".length), coverage: a[c] })))[0];
  expect(cell, "the fixture has a worst account whose domain coverage differs from its score").toBeDefined();
  const row = page.getByTestId("worst-account-row").filter({ has: page.getByRole("link", { name: cell.account, exact: true }) });
  await expect(row.locator(`[data-domain="${cell.domain}"]`)).toContainText(`coverage ${cell.coverage}`);
  await collapseRankedPreview(list, "worst-account-row", shown.length);
});

test("the sidebar opens the executive view", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Executive view/ }).click();
  await expect(page).toHaveURL(/\/executive$/);
  await expect(page.getByText("Coming at Check-in 3")).toHaveCount(0);
});

test("narrow screen: no page scrolls sideways", async ({ page }) => {
  // Every page sits in PageFrame, which scrolls on its own: the frame, not the document, must not be wider than it is.
  const rules = (await csv("02_scorecard.csv")).filter((r) => r.level === "rule");
  const rule = rules.sort((a, b) => (b.rule.length + b.domain.length) - (a.rule.length + a.domain.length))[0];
  const account = (await csv("02_scorecard_accounts.csv")).find((r) => r.rank === "1")!;
  const scenario = (await csv("02_severity.csv")).sort((a, b) => b.scenario.length - a.scenario.length)[0];
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [url, shot] of [
    ["/executive", "narrow-executive"],
    [ruleHref(rule.domain, rule.rule), "narrow-rule"],
    [accountHref(account.account_id), "narrow-account"],
    [scenarioHref(scenario.scenario), "narrow-scenario"],
  ]) {
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const frame = page.getByTestId("page-frame");
    const widths = await frame.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
    expect(widths.scroll, `${url} scrolls sideways`).toBeLessThanOrEqual(widths.client);
    if (url === "/executive") await expect(page.getByTestId("domain-card").getByRole("link")).toHaveText(domainOrder);
    await page.screenshot({ path: `${SHOTS}/${shot}.png`, fullPage: true });
  }
});

test("fix first: lowest score on top, and the switch shows dollars", async ({ page }) => {
  const rules = (await csv("02_scorecard.csv")).filter((r) => r.level === "rule");
  const lowest = Math.min(...rules.map((r) => Number(r.score)));
  await page.goto("/executive");
  await page.getByRole("tab", { name: "By quality score" }).click();
  await expect(page).toHaveURL(/by=score/);
  const list = page.locator("#fix-first");
  await expandRankedPreview(list, "rule-row", rules.length);
  await expect(page.getByTestId("rule-row").first().getByTestId("score")).toHaveText(lowest.toFixed(2));
  await expect(page.getByTestId("rule-row").first().getByTestId("priority-rank")).toHaveText("1");
  await collapseRankedPreview(list, "rule-row", rules.length);
  await page.locator("#fix-first").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/fix-first-score.png`, fullPage: true });
  await page.getByRole("tab", { name: "By dollar impact" }).click();
  await expect(page).toHaveURL(/by=dollars/);
  const severity = await csv("02_severity.csv");
  await expandRankedPreview(list, "scenario-row", severity.length);
  const priced = severity.filter((r) => Number(r.financial_rows) > 0 && r.gross_delta_usd_valued_subset !== "");
  const maxNav = Math.max(...priced.filter((r) => r.max_abs_fund_net_bps_valued_subset !== "").map((r) => Number(r.max_abs_fund_net_bps_valued_subset)));
  await expect(list.getByTestId("scenario-row").first().getByTestId("scenario-maxFundNetBps")).toHaveText(fmtBps(maxNav));
  await expect(list.getByTestId("scenario-row").first().getByTestId("priority-rank")).toHaveText("1");
  const headers = (await list.getByRole("table").first().getByRole("columnheader").allTextContents())
    .map((text) => text.replace(/\s*[▲▼]\s*$/, ""));
  expect(headers.slice(0, 5)).toEqual(["Rank", "Scenario", "Evidence", "NAV impact", "Gross USD"]);
  await list.getByRole("button", { name: "Gross USD", exact: true }).click();
  const firstByGross = list.getByTestId("scenario-row").first();
  await expect(firstByGross.getByTestId("scenario-grossUsd")).toHaveText(fmtUsd(Math.max(...priced.map((r) => Number(r.gross_delta_usd_valued_subset)))));
  await expect(firstByGross.getByTestId("priority-rank")).toHaveText("1");
  await expect(list.getByRole("table").first().getByTestId("priority-rank")).toHaveText(priced.map((_, index) => String(index + 1)));
  await expect(list.getByText(/^Ranked by Gross USD, highest first/)).toBeVisible();
  await list.getByRole("button", { name: "Gross USD", exact: true }).click();
  await expect(list.getByTestId("scenario-row").first().getByTestId("scenario-grossUsd")).toHaveText(fmtUsd(Math.min(...priced.map((r) => Number(r.gross_delta_usd_valued_subset)))));
  await expect(list.getByRole("table").first().getByTestId("priority-rank")).toHaveText(priced.map((_, index) => String(index + 1)));
  await list.getByRole("button", { name: "Rank", exact: true }).click();
  await expect(list.getByTestId("scenario-row").first().getByTestId("priority-rank")).toHaveText("1");
  const empty = severity.filter((r) => Number(r.financial_rows) === 0).length;
  const unknown = severity.filter((r) => Number(r.financial_rows) > 0 && r.gross_delta_usd_valued_subset === "").length;
  await expect(page.getByRole("heading", { name: "No records in this run" })).toHaveCount(empty ? 1 : 0);
  await expect(page.getByRole("heading", { name: "Not priced: unknown, not zero" })).toHaveCount(unknown ? 1 : 0);
  await expect(page.getByText("do not add them up")).toBeVisible();
  await collapseRankedPreview(list, "scenario-row", severity.length);
  await page.locator("#fix-first").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/fix-first-dollars.png`, fullPage: true });
});

test("fix first: a domain filters the list, a header re-sorts it", async ({ page }) => {
  const rules = (await csv("02_scorecard.csv")).filter((r) => r.level === "rule");
  await page.goto("/executive");
  await page.getByTestId("domain-card").getByRole("link", { name: "Trades", exact: true }).click();
  await expect(page).toHaveURL(/domain=Trades#fix-first/);
  const filteredCount = Math.min(5, rules.filter((r) => r.domain === "Trades").length);
  await expect(page.getByTestId("rule-row")).toHaveCount(filteredCount);
  await expect(page.locator("#fix-first").getByTestId("priority-rank")).toHaveText(Array.from({ length: filteredCount }, (_, index) => String(index + 1)));
  await page.getByRole("link", { name: "Show all domains" }).click();
  // The reader stays at the list, not at the top of the page.
  await expect(page).toHaveURL(/\/executive\?by=score#fix-first$/);
  await expect(page.getByTestId("rule-row")).toHaveCount(Math.min(5, rules.length));
  await expect(page.locator("#fix-first")).toBeInViewport();
  const list = page.locator("#fix-first");
  const scoreSort = list.getByRole("button", { name: "Score", exact: true });
  await expandRankedPreview(list, "rule-row", rules.length);
  await scoreSort.click();
  await scoreSort.click();
  const highest = Math.max(...rules.map((r) => Number(r.score)));
  await expect(page.getByTestId("rule-row").first().getByTestId("score")).toHaveText(highest.toFixed(2));
  const first = list.getByTestId("rule-row").first();
  await expect(first.getByTestId("priority-rank")).toHaveText("1");
  await expect(list.getByTestId("priority-rank")).toHaveText(rules.map((_, index) => String(index + 1)));
  await expect(list.getByText(/^Ranked by quality score, highest first/)).toBeVisible();
  await list.getByRole("button", { name: "Rank", exact: true }).click();
  await expect(list.getByTestId("rule-row").first().getByTestId("priority-rank")).toHaveText("1");
});

test("fix first: the rule, domain and owner headers sort too", async ({ page }) => {
  const rules = (await csv("02_scorecard.csv")).filter((r) => r.level === "rule");
  const text = (a: string, b: string) => a.localeCompare(b, "en");
  const list = page.locator("#fix-first");
  await page.goto("/executive?by=score");
  const header = (name: string) => list.getByRole("button", { name, exact: true });
  await header("Domain").click();
  await expect(list.getByRole("columnheader", { name: "Domain" })).toHaveAttribute("aria-sort", "ascending");
  await expect(page.getByTestId("rule-row").first().getByTestId("rule-domain"))
    .toHaveText([...new Set(rules.map((r) => r.domain))].sort(text)[0]);
  await header("Domain").click();
  await expect(page.getByTestId("rule-row").first().getByTestId("rule-domain"))
    .toHaveText([...new Set(rules.map((r) => r.domain))].sort(text).at(-1)!);
  await header("Owner").click();
  await expect(list.getByRole("columnheader", { name: "Owner" })).toHaveAttribute("aria-sort", "ascending");
  await expect(page.getByTestId("rule-row").first().getByTestId("rule-owner"))
    .toHaveText(rules.map((r) => r.owner).sort(text)[0]);
  await header("Rule").click();
  await expect(list.getByRole("columnheader", { name: "Rule" })).toHaveAttribute("aria-sort", "ascending");
  await expect(list.getByRole("columnheader", { name: "Owner" })).toHaveAttribute("aria-sort", "none");
});

test("fix first: a rule with several tests names the test on each what-failed line", async ({ page }) => {
  const tests = (await csv("02_scorecard.csv")).filter((r) => r.level === "test");
  const testsOf = (r: Record<string, string>) => tests.filter((t) => t.domain === r.domain && t.rule === r.rule);
  const rules = (await csv("02_scorecard.csv")).filter((r) => r.level === "rule");
  const unique = rules.filter((r) => rules.filter((x) => x.rule === r.rule).length === 1); // a rule ID in one domain
  const several = unique.find((r) => testsOf(r).length > 1)!;
  const one = unique.find((r) => testsOf(r).length === 1)!;
  expect(several && one, "the fixture has a rule with several tests and one with one").toBeTruthy();
  await page.goto("/executive?by=score");
  await expandRankedPreview(page.locator("#fix-first"), "rule-row", rules.length);
  const lines = (r: Record<string, string>) => page.getByTestId("rule-row")
    .filter({ has: page.getByText(r.rule, { exact: true }) }).getByTestId("what-failed").locator("div");
  const ids = testsOf(several).map((t) => t.test).sort();
  await expect(lines(several)).toHaveCount(ids.length);
  expect((await lines(several).allTextContents()).map((l) => l.split(" · ")[0]).sort()).toEqual(ids);
  await expect(lines(one)).toHaveCount(1);
  await expect(lines(one)).not.toContainText(" · ");
});

test("drill-down: a rule lists its records and one opens in the trace", async ({ page }) => {
  const rule = "TXN_ONE_REVERSAL_PER_ORIGINAL";
  const outcomes = (await csv("02_score_outcomes.csv")).filter((r) => r.rule === rule);
  const rules = (await csv("02_scorecard.csv")).filter((r) => r.level === "rule");
  await page.goto("/executive?by=score");
  await expandRankedPreview(page.locator("#fix-first"), "rule-row", rules.length);
  const row = page.getByTestId("rule-row").filter({ has: page.getByText(rule, { exact: true }) });
  await row.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/executive\/rule\?/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(rule);
  await expect(page.getByTestId("record-row")).toHaveCount(outcomes.length);
  await page.screenshot({ path: "../tests/runs/dashboard_browser/shots/rule-page.png", fullPage: true });
  await page.addInitScript(() => localStorage.setItem("theme", "dark")); // runs after the beforeEach "light"
  await page.reload();
  await expect(page.getByTestId("record-row").first()).toBeVisible();
  await page.screenshot({ path: "../tests/runs/dashboard_browser/shots/rule-page-dark.png", fullPage: true });
  await page.getByTestId("record-row").first().getByRole("link", { name: /^Trace / }).click();
  await expect(page).toHaveURL(/\/trace\?id=/);
  await expect(page.getByText("No record has the ID")).toHaveCount(0);
  await expect(page.locator("[id^='trace-step-']").first()).toBeVisible();
});

test("rule page: result chips filter, a rate row has no trace link, bad addresses are calm", async ({ page }) => {
  await page.goto("/executive/rule?domain=Prices&rule=FX_RATE_VALID");
  await expect(page.getByText("No single record to trace").first()).toBeVisible();
  await page.goto("/executive/rule?domain=Positions&rule=POS_REBUILD_MATCHES&result=bogus&page=999");
  await expect(page.getByTestId("record-row").first()).toBeVisible();
  await page.goto("/executive/rule?domain=Nowhere&rule=NOPE");
  await expect(page.getByRole("heading", { name: "No such rule in the scorecard" })).toBeVisible();
});

test("drill-down: account lookup shows its scores and records, and one opens in the trace", async ({ page }) => {
  const worst = (await csv("02_scorecard_accounts.csv")).find((r) => r.rank === "1")!;
  const records = (await csv("02_account_outcomes.csv")).filter((r) => r.account_id === worst.account_id);
  await page.goto("/executive");
  await page.getByLabel("Account ID").fill(worst.account_id);
  await page.getByRole("button", { name: "Open account" }).click();
  await expect(page).toHaveURL(/\/executive\/account\?id=/);
  await expect(page.getByTestId("score").first()).toHaveText(worst.score);
  await expect(page.getByTestId("record-row")).toHaveCount(Math.min(records.length, 50));
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible(); // the streamed page, not its skeleton
  await expect(page.getByTestId("record-row").first()).toBeVisible();
  await page.screenshot({ path: "../tests/runs/dashboard_browser/shots/account-page.png", fullPage: true });
  await page.getByTestId("record-row").first().getByRole("link", { name: /^Trace / }).click();
  await expect(page.locator("[id^='trace-step-']").first()).toBeVisible();
});

test("records: the finding select follows the address", async ({ page }) => {
  const worst = (await csv("02_scorecard_accounts.csv")).find((r) => r.rank === "1")!;
  await page.goto(accountHref(worst.account_id));
  const select = page.getByLabel("Finding");
  const option = select.locator("option").nth(1);
  const finding = (await option.getAttribute("value"))!;
  await select.selectOption(finding);
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/finding=/);
  const domain = await page.getByTestId("record-row").first().getByTestId("record-domain").textContent();
  // A domain chip drops the finding filter: the select must show "All findings" again, not the old choice.
  await page.getByRole("navigation", { name: "Filter by domain" }).getByRole("link", { name: domain!, exact: true }).click();
  await expect(page).not.toHaveURL(/finding=/);
  await expect(select).toHaveValue("");
});

test("account page: an unknown or empty ID is calm", async ({ page }) => {
  await page.goto("/executive/account?id=NOT-AN-ACCOUNT");
  await expect(page.getByRole("heading", { name: "Not a scored account" })).toBeVisible();
  await page.goto("/executive/account");
  await expect(page.getByRole("heading", { name: "Not a scored account" })).toBeVisible();
});

test("drill-down: a scenario lists its keys with dollars, and one opens in the trace", async ({ page }) => {
  const severity = await csv("02_severity.csv");
  const top = severity.filter((r) => r.gross_delta_usd_valued_subset !== "")
    .sort((a, b) => Number(b.gross_delta_usd_valued_subset) - Number(a.gross_delta_usd_valued_subset))[0];
  const detail = (await csv("02_impact_detail.csv")).filter((r) => r.scenario === top.scenario);
  await page.goto("/executive?by=dollars");
  const first = page.getByTestId("scenario-row").first();
  const description = first.getByRole("button", { name: `Description for ${top.scenario}`, exact: true });
  await expect(first.getByText(top.interpretation, { exact: true })).toBeHidden();
  await description.press("Enter");
  await expect(first.getByText(top.interpretation, { exact: true })).toBeVisible();
  await description.press("Space");
  await expect(first.getByText(top.interpretation, { exact: true })).toBeHidden();
  await first.getByRole("link").click();
  await expect(page.getByRole("heading", { level: 1, name: top.scenario })).toBeVisible();
  await expect(page.getByTestId("impact-row")).toHaveCount(detail.length);
  // A change in units as stored, never rounded to whole units.
  const units = (v: string | null) => fmtNumber(v === null || v === "" ? null : Number(v));
  expect((await page.getByTestId("delta-units").allTextContents()).sort())
    .toEqual(detail.map((r) => units(r.delta_units)).sort());
  await page.screenshot({ path: "../tests/runs/dashboard_browser/shots/scenario-page.png", fullPage: true });
  await page.getByTestId("impact-row").first().getByRole("link", { name: /^Trace/ }).click();
  await expect(page.locator("[id^='trace-step-']").first()).toBeVisible();
  await page.goto("/executive/scenario?name=No%20such%20scenario");
  await expect(page.getByRole("heading", { name: "No such impact scenario" })).toBeVisible();
});

test("trust: stress rates, before and after, and the sensitivity variants", async ({ page }) => {
  const rates = await csv("03_stress_rates.csv");
  await page.goto("/executive");
  const disclosure = page.getByRole("button", { name: "Data Integrity Status", exact: true });
  const stress = page.getByTestId("stress");
  const sens = page.getByTestId("sensitivity");
  await expect(disclosure).toHaveAttribute("aria-expanded", "false");
  await expect(stress).toBeHidden();
  await expect(sens).toBeHidden();
  await disclosure.press("Enter");
  await expect(disclosure).toHaveAttribute("aria-expanded", "true");
  await expect(stress.getByText("Planted defects")).toBeVisible();
  const caught = rates.find((r) => r.role === "defect" && r.level === "caught")!;
  await expect(stress.getByRole("row", { name: /caught/ }).first()).toContainText(caught.cases);
  await expect(stress.getByText("none valued")).toBeVisible();
  await expect(stress).not.toContainText("/made/up"); // the fixture's labels path
  await expect(stress).not.toContainText("labels path");
  await expect(stress.getByText("older run")).toHaveCount(0);
  for (const name of ["NAV-weighted", "Weakest link", "Confirmed only"]) await expect(sens.getByText(name)).toBeVisible();
  await page.locator("#trust").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "../tests/runs/dashboard_browser/shots/trust.png", fullPage: true });
  await page.locator("#trust").screenshot({ path: "../tests/runs/dashboard_browser/shots/trust-section.png" });
  await disclosure.press("Space");
  await expect(disclosure).toHaveAttribute("aria-expanded", "false");
  await expect(stress).toBeHidden();
  await disclosure.click();
  await expect(stress).toBeVisible();
  await page.addInitScript(() => localStorage.setItem("theme", "dark")); // runs after the beforeEach one
  await page.reload();
  await expect(disclosure).toHaveAttribute("aria-expanded", "false");
  await disclosure.click();
  await expect(stress).toBeVisible();
  await page.locator("#trust").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "../tests/runs/dashboard_browser/shots/trust-dark.png", fullPage: true });
  await page.locator("#trust").screenshot({ path: "../tests/runs/dashboard_browser/shots/trust-section-dark.png" });
});
