import { test, expect, type Page } from "@playwright/test";

// These IDs belong only to tests/fixtures/small, never to the competition release.
const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
const stories = (page: Page) => page.locator('a[href^="/trace?id="]');
const runtimeErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
  // Page exceptions are checked after each workflow, including client-side navigation.
  runtimeErrors.set(page, errors);
});

test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page)).toEqual([]);
});

test("data map supports table details, lookup connections, and panel controls", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "How data moves through the platform" })).toBeVisible();
  await node(page, "transactions").click();
  await expect(page.getByRole("heading", { name: "Transactions", exact: true })).toBeVisible();
  await expect(page.getByText("FIXTURE_OMS", { exact: true }).first()).toBeVisible();
  await expect(page.locator('.react-flow__edge[data-id="position_account"]')).toHaveCount(0);
  await page.getByRole("switch", { name: "Show lookups" }).click();
  await expect(page.locator('.react-flow__edge[data-id="position_account"]')).toHaveCount(1);
  await page.getByRole("switch", { name: "Show lookups" }).click();
  await expect(page.locator('.react-flow__edge[data-id="position_account"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Hide the panel" }).click();
  await expect(page.getByRole("heading", { name: "Transactions", exact: true })).not.toBeVisible();
  await page.getByRole("button", { name: "Show the panel" }).click();
  await expect(page.getByRole("heading", { name: "Transactions", exact: true })).toBeVisible();
});

test("confirmed quantity error is visible even when all record links exist", async ({ page }) => {
  await page.goto("/trace?id=FXT03");
  const transaction = page.locator("#trace-step-transaction");
  await expect(transaction).toContainText("Negative trade quantity");
  await expect(transaction).toContainText("quantity = -50");
  await expect(transaction).toContainText("Linked records found");
  await expect(node(page, "transactions").locator("[data-trace-tone]")).toHaveAttribute("data-trace-tone", "bad");
  await expect(node(page, "ledger_nav").locator("[data-trace-tone]")).toHaveAttribute("data-trace-tone", "ok");
  await expect(page.getByText(/not a complete assessment/)).toBeVisible();
});

test("unresolved findings stay amber rather than becoming confirmed", async ({ page }) => {
  await page.goto("/trace?id=FXT11");
  await expect(node(page, "transactions").locator("[data-trace-tone]")).toHaveAttribute("data-trace-tone", "warn");
  await expect(page.getByText("More than one REVERSED row per original", { exact: true }).last()).toBeVisible();
});

test("expanded stories survive selections, search draft resets, and timeline state resets per record", async ({ page }) => {
  await page.goto("/trace?id=FXT03");
  const initial = await stories(page).count();
  await page.getByRole("button", { name: /Show all \d+/ }).click();
  await expect(page.getByRole("button", { name: "Show fewer", exact: true })).toBeVisible();
  const expanded = await stories(page).count();
  expect(expanded).toBeGreaterThan(initial);
  const hrefs = await stories(page).evaluateAll((links) => links.map((link) => link.getAttribute("href")!));
  const choose = async (href: string) => {
    const id = new URL(href, "http://fixture").searchParams.get("id")!;
    await page.locator(`a[href="${href}"]`).click();
    await expect(page.getByRole("textbox", { name: "Record ID" })).toHaveValue(id);
    await expect(stories(page)).toHaveCount(expanded);
    await expect(page.getByRole("button", { name: "Show fewer", exact: true })).toHaveAttribute("aria-expanded", "true");
  };
  await page.locator("#trace-step-transaction button").first().click();
  await expect(page.locator("#trace-step-transaction table")).toHaveCount(0);
  await page.getByRole("textbox", { name: "Record ID" }).fill("UNSUBMITTED DRAFT");
  await choose(hrefs.find((href) => href.includes("FXT02"))!);
  await expect(page.locator("#trace-step-transaction table")).toBeVisible();
  for (const href of hrefs.slice(-3)) await choose(href);
  await page.getByRole("button", { name: "Show fewer", exact: true }).click();
  await expect(stories(page)).toHaveCount(initial);
  await page.locator(`a[href="${hrefs[0]}"]`).click();
  await expect(page.getByRole("textbox", { name: "Record ID" })).toHaveValue(new URL(hrefs[0], "http://fixture").searchParams.get("id")!);
  await expect(stories(page)).toHaveCount(initial);
});

test("search, holding keys, and unknown IDs work without treating missing evidence as a pass", async ({ page }) => {
  await page.goto("/trace");
  const input = page.getByRole("textbox", { name: "Record ID" });
  await input.fill("FXACC2/FXSEC1");
  await input.press("Enter");
  await expect(page.locator("#trace-step-position")).toContainText("FXP3");
  await input.fill("NO-SUCH-FIXTURE-ID");
  await page.getByRole("button", { name: "Trace", exact: true }).click();
  await expect(page.getByText(/No record has the ID/)).toBeVisible();
  await expect(page.locator("#trace-step-transaction")).toHaveCount(0);
});

test("theme and menu toggles remain usable", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Switch light or dark theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Switch light or dark theme" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByRole("button", { name: "Hide the menu" }).click();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).not.toBeVisible();
  await page.getByRole("button", { name: "Show the menu" }).click();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
});

test("the trace search and evidence remain usable on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/trace?id=FXT03");
  await expect(page.getByRole("textbox", { name: "Record ID" })).toBeVisible();
  await expect(page.locator("#trace-step-transaction")).toContainText("quantity = -50");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
});
