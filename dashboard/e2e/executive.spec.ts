import path from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import { test, expect, type Page } from "@playwright/test";
import { WORST_ACCOUNTS, accountHref, fmtNumber, ruleHref, scenarioHref } from "../lib/executive";

// The fixture's CSV files (made up, tests/fixtures/small); the page must show what they hold.
const FIXTURE = path.join(__dirname, "../../tests/runs/dashboard_browser_fixture");
const SHOTS = "../tests/runs/dashboard_browser/shots";
const runtimeErrors = new WeakMap<Page, string[]>();

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
  const tile = page.getByTestId("tile-platform");
  await expect(tile.getByTestId("score")).toHaveText(platform.score);
  await expect(tile.getByTestId("coverage")).toContainText(platform.coverage);
  await expect(tile.getByTestId("confirmed-only")).toContainText(platform.confirmed_only_score);
  const domains = (await csv("02_scorecard.csv")).filter((r) => r.level === "domain");
  await expect(page.getByTestId("domain-row")).toHaveCount(domains.length);
  for (const d of domains)
    await expect(page.getByTestId("domain-row").filter({ hasText: d.domain }).getByTestId("score")).toHaveText(d.score);
  await page.screenshot({ path: `${SHOTS}/executive-light.png`, fullPage: true });
  await page.evaluate(() => localStorage.setItem("theme", "dark"));
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  await page.reload();
  await expect(page.getByTestId("tile-platform")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/executive-dark.png`, fullPage: true });
});

test("indicators, KPIs and worst accounts are listed, blanks stay blanks", async ({ page }) => {
  const indicators = await csv("02_indicators.csv");
  await page.goto("/executive");
  for (const i of indicators) await expect(page.getByTestId(`indicator-${i.id}`)).toBeVisible();
  const proposed = indicators.find((i) => i.status === "proposed")!;
  await expect(page.getByTestId(`indicator-${proposed.id}`)).toContainText("Proposed");
  await expect(page.getByText("not computed").first()).toBeVisible(); // KPI 7
  const accounts = await csv("02_scorecard_accounts.csv");
  const worst = accounts.find((r) => r.rank === "1")!;
  await expect(page.getByRole("link", { name: worst.account_id })).toBeVisible();
  await expect(page.locator("main")).not.toContainText("NaN");
  // Worst accounts sit under "Where is the platform degrading?", and each domain score comes with its coverage.
  await expect(page.locator("#degrading").getByTestId("worst-accounts")).toBeVisible();
  const shown = accounts.filter((a) => a.rank !== null && Number(a.rank) <= WORST_ACCOUNTS);
  const cell = shown.flatMap((a) => Object.keys(a)
    .filter((c) => c.endsWith(" coverage") && a[c] !== null && a[c] !== a[`${c.slice(0, -" coverage".length)} score`])
    .map((c) => ({ account: a.account_id, domain: c.slice(0, -" coverage".length), coverage: a[c] })))[0];
  expect(cell, "the fixture has a worst account whose domain coverage differs from its score").toBeDefined();
  const row = page.getByTestId("worst-account-row").filter({ has: page.getByRole("link", { name: cell.account, exact: true }) });
  await expect(row.locator(`[data-domain="${cell.domain}"]`)).toContainText(`coverage ${cell.coverage}`);
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
    await page.screenshot({ path: `${SHOTS}/${shot}.png`, fullPage: true });
  }
});

test("fix first: lowest score on top, and the switch shows dollars", async ({ page }) => {
  const rules = (await csv("02_scorecard.csv")).filter((r) => r.level === "rule");
  const lowest = Math.min(...rules.map((r) => Number(r.score)));
  await page.goto("/executive");
  await expect(page.getByTestId("rule-row")).toHaveCount(rules.length);
  await expect(page.getByTestId("rule-row").first().getByTestId("score")).toHaveText(lowest.toFixed(2));
  await page.locator("#fix-first").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/fix-first-score.png`, fullPage: true });
  await page.getByRole("tab", { name: "By dollar impact" }).click();
  await expect(page).toHaveURL(/by=dollars/);
  const severity = await csv("02_severity.csv");
  await expect(page.getByTestId("scenario-row")).toHaveCount(severity.length);
  const empty = severity.filter((r) => Number(r.financial_rows) === 0).length;
  const unknown = severity.filter((r) => Number(r.financial_rows) > 0 && r.gross_delta_usd_valued_subset === "").length;
  await expect(page.getByRole("heading", { name: "No records in this run" })).toHaveCount(empty ? 1 : 0);
  await expect(page.getByRole("heading", { name: "Not priced: unknown, not zero" })).toHaveCount(unknown ? 1 : 0);
  await expect(page.getByText("do not add them up")).toBeVisible();
  await page.locator("#fix-first").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/fix-first-dollars.png`, fullPage: true });
});

test("fix first: a domain filters the list, a header re-sorts it", async ({ page }) => {
  const rules = (await csv("02_scorecard.csv")).filter((r) => r.level === "rule");
  await page.goto("/executive");
  await page.getByTestId("domain-row").filter({ hasText: "Trades" }).getByRole("link", { name: "Trades" }).click();
  await expect(page).toHaveURL(/domain=Trades#fix-first/);
  await expect(page.getByTestId("rule-row")).toHaveCount(rules.filter((r) => r.domain === "Trades").length);
  await page.getByRole("link", { name: "Show all domains" }).click();
  // The reader stays at the list, not at the top of the page.
  await expect(page).toHaveURL(/\/executive#fix-first$/);
  await expect(page.getByTestId("rule-row")).toHaveCount(rules.length);
  await expect(page.locator("#fix-first")).toBeInViewport();
  await page.getByRole("button", { name: "Score" }).click();
  await page.getByRole("button", { name: "Score" }).click();
  const highest = Math.max(...rules.map((r) => Number(r.score)));
  await expect(page.getByTestId("rule-row").first().getByTestId("score")).toHaveText(highest.toFixed(2));
});

test("fix first: the rule, domain and owner headers sort too", async ({ page }) => {
  const rules = (await csv("02_scorecard.csv")).filter((r) => r.level === "rule");
  const text = (a: string, b: string) => a.localeCompare(b, "en");
  const list = page.locator("#fix-first");
  await page.goto("/executive");
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
  await page.goto("/executive");
  const lines = (r: Record<string, string>) => page.getByTestId("rule-row")
    .filter({ has: page.getByText(r.rule, { exact: true }) }).getByTestId("what-failed").locator("div");
  const ids = testsOf(several).map((t) => t.test).sort();
  await expect(lines(several)).toHaveCount(ids.length);
  expect((await lines(several).allTextContents()).map((l) => l.split(" · ")[0]).sort()).toEqual(ids);
  await expect(lines(one)).toHaveCount(1);
  await expect(lines(one)).not.toContainText(" · ");
});

test("drill-down: a rule lists its records and one opens in the trace", async ({ page }) => {
  const outcomes = (await csv("02_score_outcomes.csv")).filter((r) => r.rule === "TXN_ONE_REVERSAL_PER_ORIGINAL");
  await page.goto("/executive");
  await page.getByTestId("rule-row").first().getByRole("link").first().click();
  await expect(page).toHaveURL(/\/executive\/rule\?/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("TXN_ONE_REVERSAL_PER_ORIGINAL");
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
  await page.getByTestId("scenario-row").first().getByRole("link").first().click();
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
  const stress = page.getByTestId("stress");
  await expect(stress.getByText("Planted defects")).toBeVisible();
  const caught = rates.find((r) => r.role === "defect" && r.level === "caught")!;
  await expect(stress.getByRole("row", { name: /caught/ }).first()).toContainText(caught.cases);
  await expect(stress.getByText("none valued")).toBeVisible();
  await expect(stress).not.toContainText("/made/up"); // the fixture's labels path
  await expect(stress).not.toContainText("labels path");
  await expect(stress.getByText("older run")).toHaveCount(0);
  const sens = page.getByTestId("sensitivity");
  for (const name of ["NAV-weighted", "Weakest link", "Confirmed only"]) await expect(sens.getByText(name)).toBeVisible();
  await page.locator("#trust").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "../tests/runs/dashboard_browser/shots/trust.png", fullPage: true });
  await page.locator("#trust").screenshot({ path: "../tests/runs/dashboard_browser/shots/trust-section.png" });
  await page.addInitScript(() => localStorage.setItem("theme", "dark")); // runs after the beforeEach one
  await page.reload();
  await expect(page.getByTestId("stress")).toBeVisible();
  await page.locator("#trust").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "../tests/runs/dashboard_browser/shots/trust-dark.png", fullPage: true });
  await page.locator("#trust").screenshot({ path: "../tests/runs/dashboard_browser/shots/trust-section-dark.png" });
});
