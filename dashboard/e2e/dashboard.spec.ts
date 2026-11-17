import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";

// The reviewed plain wording (scripts/plain_language.json), so tests expect the same sentences the store carries.
const plain = JSON.parse(fs.readFileSync(path.join(__dirname, "../../scripts/plain_language.json"), "utf8")) as {
  findings: Record<string, string>; lead_in: Record<string, string>; stages: { stage: string; label: string }[];
  nodes: Record<string, string>;
};

// These IDs belong only to tests/fixtures/small, never to the competition release.
const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
const picker = (page: Page) => page.getByRole("combobox", { name: "Pick an example" });
const stepHeader = (page: Page, hop: string) => page.locator(`#trace-step-${hop} button`).first();
const runtimeErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
  // Mark the startup screen as seen so it does not cover the page under test.
  await page.addInitScript(() => sessionStorage.setItem("dfe-boot-seen", "1"));
  // Page exceptions are checked after each workflow, including client-side navigation.
  runtimeErrors.set(page, errors);
});

test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page)).toEqual([]);
});

test("data map supports table details, lookup connections, and panel controls", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "How data moves through the platform" })).toBeVisible();
  const map = page.getByRole("region", { name: "Data map", exact: true });
  const before = await map.boundingBox();
  await node(page, "transactions").click();
  expect(await map.boundingBox()).toEqual(before);
  await page.getByRole("button", { name: "View details", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Transactions", exact: true })).toBeInViewport();
  await page.getByRole("button", { name: "Who owns this" }).click();
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

test("the transaction connections keep their findings clear of the table cards", async ({ page }) => {
  await page.goto("/");
  const badge = (id: string) => page.locator(`[data-edge-tag="${id}"]`);
  const accountCheck = badge("account_check");
  await expect(accountCheck).toBeVisible();
  await expect(badge("booking")).toBeVisible();
  await expect(badge("correction_link")).toBeVisible();
  const [accounts, transactions, pipeline, accountLabel, bookingLabel, correctionLabel] = await Promise.all([
    node(page, "accounts"), node(page, "transactions"), node(page, "pipeline_events"),
    accountCheck, badge("booking"), badge("correction_link"),
  ].map(async (locator) => (await locator.boundingBox())!));
  expect(accountLabel.y).toBeGreaterThan(accounts.y + accounts.height);
  expect(accountLabel.x + accountLabel.width).toBeLessThan(transactions.x);
  expect(correctionLabel.x + correctionLabel.width / 2).toBeCloseTo(transactions.x + transactions.width / 2, 0);
  expect(correctionLabel.y + correctionLabel.height).toBeLessThan(transactions.y);
  expect(bookingLabel.y).toBeGreaterThan(transactions.y + transactions.height);
  expect(bookingLabel.y + bookingLabel.height).toBeLessThan(pipeline.y);
  await accountCheck.click();
  await page.getByRole("button", { name: "View details", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Account check", exact: true })).toBeInViewport();
});

test("the data map prioritizes the canvas and places the details underneath", async ({ page }) => {
  await page.goto("/");
  const map = page.getByRole("region", { name: "Data map", exact: true });
  const summary = page.getByRole("complementary", { name: "Finding summary" });
  const details = page.getByRole("region", { name: "Map details" });
  await expect(map).toBeVisible();
  const [mapBox, summaryBox, detailsBox] = await Promise.all([
    map.boundingBox(), summary.boundingBox(), details.boundingBox(),
  ]);
  expect(mapBox!.width).toBeGreaterThan(summaryBox!.width * 4);
  expect(summaryBox!.x).toBeGreaterThan(mapBox!.x + mapBox!.width);
  expect(summaryBox!.y).toBeCloseTo(mapBox!.y, 0);
  expect(detailsBox!.y).toBeGreaterThan(mapBox!.y + mapBox!.height);
  const [confirmed, unresolved, cleared] = await Promise.all(
    ["Confirmed", "Unresolved", "Cleared"].map((title) => summary.getByText(title, { exact: true }).boundingBox()),
  );
  expect(unresolved!.x).toBeCloseTo(confirmed!.x, 0);
  expect(cleared!.x).toBeCloseTo(confirmed!.x, 0);
  expect(unresolved!.y).toBeGreaterThan(confirmed!.y);
  expect(cleared!.y).toBeGreaterThan(unresolved!.y);

  await page.setViewportSize({ width: 1280, height: 720 });
  await expect.poll(async () => {
    const box = (await map.boundingBox())!;
    return box.y + box.height;
  }).toBeLessThanOrEqual(720);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => (await summary.boundingBox())!.y - (await map.boundingBox())!.y)
    .toBeGreaterThan((await map.boundingBox())!.height);
  await page.getByRole("button", { name: "View details", exact: true }).click();
  await expect(details.getByRole("heading", { name: "How data moves, and where it breaks" })).toBeInViewport();
  await details.getByRole("button", { name: "Back to map" }).click();
  await expect(map).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
});

test("the map panel opens with the stages and folds the rest", async ({ page }) => {
  await page.goto("/");
  const panel = page.locator("[data-map-panel]");
  const stages = panel.locator("button[data-stage]");
  expect(await stages.count()).toBeGreaterThan(1);
  for (const stage of await stages.all()) await expect(stage).toBeVisible();
  const masterData = plain.stages.find((s) => s.stage === "master data")!.label;
  await expect(stages.first()).toContainText(masterData);
  // The other joins are folded away: their heading shows, their rows do not.
  await expect(panel.getByText("Other joins", { exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: /^booked/ })).not.toBeVisible();

  const tradeCapture = panel.locator('button[data-stage="trade capture"]');
  await expect(tradeCapture).toHaveAttribute("aria-expanded", "false");
  await tradeCapture.click();
  await expect(tradeCapture).toHaveAttribute("aria-expanded", "true");
  // The finding's own row (the stage row around it is an li too).
  const negative = panel.locator("li:not(:has(li))", { hasText: plain.findings["Negative trade quantity"] });
  await expect(negative).toBeVisible();
  await expect(negative.getByRole("link", { name: "Trace an example" })).toHaveAttribute("href", "/trace?id=FXT03");
  // From a finding below the map, show the selected table and return to its details.
  await page.setViewportSize({ width: 1550, height: 600 });
  await negative.getByRole("button", { name: "Show on map" }).scrollIntoViewIfNeeded();
  expect(await page.locator("[data-map-layout]").evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await negative.getByRole("button", { name: "Show on map" }).click();
  await expect(node(page, "transactions")).toBeInViewport();
  await page.getByRole("button", { name: "View details", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Transactions", exact: true })).toBeInViewport();
  // The place's plain sentence comes first, and what we found there starts open.
  await expect(panel.getByText(plain.nodes.transactions, { exact: true })).toBeVisible();
  await expect(panel.getByText(plain.findings["Negative trade quantity"], { exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Who owns this" })).toHaveAttribute("aria-expanded", "false");
});

test("every \"Trace an example\" opens a record the trace finds; a currency finding offers none", async ({ page }) => {
  await page.goto("/");
  const panel = page.locator("[data-map-panel]");
  for (const stage of await panel.locator("button[data-stage]").all()) await stage.click();
  // The fixture's FX finding lists a currency (EUR) as its example: the trace cannot open a currency.
  const currency = panel.locator("li:not(:has(li))", {
    hasText: plain.findings["Price with no FX rate for its currency on the price date"],
  });
  await expect(currency).toBeVisible();
  await expect(currency.getByRole("link", { name: "Trace an example" })).toHaveCount(0);
  const links = panel.getByRole("link", { name: "Trace an example" });
  expect(await links.count()).toBeGreaterThan(1);
  const hrefs = await links.evaluateAll((all) => all.map((a) => a.getAttribute("href") ?? ""));
  for (const href of new Set(hrefs)) {
    expect(href).not.toBe("/trace?id=EUR");
    await page.goto(href);
    await expect(page.locator("[data-headline-tone]"), href).toBeVisible();   // a found record, not "No record has the ID"
  }
});

test("each place opens with its folds reset", async ({ page }) => {
  await page.goto("/");
  const panel = page.locator("[data-map-panel]");
  const fold = (name: string) => panel.getByRole("button", { name });
  await node(page, "transactions").click();
  await fold("Raw key counts (technical)").click();
  await fold("What we found").click();
  await expect(fold("Raw key counts (technical)")).toHaveAttribute("aria-expanded", "true");
  await expect(fold("What we found")).toHaveAttribute("aria-expanded", "false");
  await node(page, "positions").click();
  await expect(panel.getByRole("heading", { name: "Positions (our book)", exact: true })).toBeVisible();
  await expect(fold("Raw key counts (technical)")).toHaveAttribute("aria-expanded", "false");
  await expect(fold("What we found")).toHaveAttribute("aria-expanded", "true");
});

test("confirmed quantity error is visible even when all record links exist", async ({ page }) => {
  await page.goto("/trace?id=FXT03");
  await expect(page.locator("[data-headline-tone]")).toHaveAttribute("data-headline-tone", "bad");
  const transaction = page.locator("#trace-step-transaction");
  await expect(transaction).toContainText(plain.findings["Negative trade quantity"]);
  await expect(transaction).toContainText("quantity = -50");
  await expect(transaction.getByText("found", { exact: true })).toHaveAttribute("title", "Linked records found");
  await expect(node(page, "transactions").locator("[data-trace-tone]")).toHaveAttribute("data-trace-tone", "bad");
  await expect(node(page, "ledger_nav").locator("[data-trace-tone]")).toHaveAttribute("data-trace-tone", "ok");
  await expect(page.getByText(/not a complete assessment/)).not.toBeVisible();
  await page.getByRole("button", { name: "Technical details", exact: true }).click();
  await expect(page.getByText(/not a complete assessment/)).toBeVisible();
});

test("legends and the search hint name every state and ID the pages can show", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "What the colours mean" }).click();
  await expect(page.getByText("Blank keys", { exact: true })).toBeVisible();
  await page.goto("/trace?id=FXT01");
  await page.getByRole("button", { name: "Technical details", exact: true }).click();
  await expect(page.locator("p", { hasText: "Record links:" })).toContainText("Not reached");
  await page.getByRole("button", { name: "Find an ID", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Record ID" })).toHaveAttribute("placeholder", /CMP…/);
});

test("unresolved findings stay amber rather than becoming confirmed", async ({ page }) => {
  await page.goto("/trace?id=FXT11");
  await expect(page.locator("[data-headline-tone]")).toHaveAttribute("data-headline-tone", "warn");
  await expect(node(page, "transactions").locator("[data-trace-tone]")).toHaveAttribute("data-trace-tone", "warn");
  await expect(page.getByText(plain.findings["More than one REVERSED row per original"], { exact: true }).first()).toBeVisible();
});

test("the story picker groups stories and navigates; draft and timeline reset per record", async ({ page }) => {
  await page.goto("/trace?id=FXT03");
  await expect(picker(page)).toHaveValue("FXT03");
  expect(await picker(page).locator("optgroup").count()).toBeGreaterThan(1);
  await expect(stepHeader(page, "transaction")).toHaveAttribute("aria-expanded", "true");
  await stepHeader(page, "transaction").click();
  await expect(stepHeader(page, "transaction")).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#trace-step-transaction")).not.toContainText("quantity = -50");
  await page.getByRole("button", { name: "Find an ID", exact: true }).click();
  await page.getByRole("textbox", { name: "Record ID" }).fill("UNSUBMITTED DRAFT");
  await picker(page).selectOption("FXT02");
  await expect(page.getByRole("textbox", { name: "Record ID" })).toHaveValue("FXT02");
  await expect(picker(page)).toHaveValue("FXT02");
  await picker(page).selectOption("FXT03");
  await expect(page.getByRole("textbox", { name: "Record ID" })).toHaveValue("FXT03");
  await expect(stepHeader(page, "transaction")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#trace-step-transaction")).toContainText("quantity = -50");
});

test("a record with no finding keeps the honesty caveat in its headline", async ({ page }) => {
  // FXT06 is a found trade that no register line counts (nor its account, security or key) in the fixture.
  await page.goto("/trace?id=FXT06");
  const headline = page.locator("[data-headline-tone]");
  await expect(headline).toBeVisible();
  await expect(headline).toContainText("not proof it is clean");
  // This store has the full member list, so the examples-only note stays away.
  await expect(page.locator("[data-examples-only]")).toHaveCount(0);
});

test("a padded ID in the URL still selects its story", async ({ page }) => {
  await page.goto("/trace?id=%20FXT03%20");
  await expect(picker(page)).toHaveValue("FXT03");
});

test("a typed record that is not a story leaves the picker on its placeholder", async ({ page }) => {
  await page.goto("/trace");
  // FXACC2/FXSEC1 is a found holding that no story points to (checked here so a fixture change cannot hide it).
  await expect(picker(page).locator('option[value="FXACC2/FXSEC1"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Find an ID", exact: true }).click();
  const input = page.getByRole("textbox", { name: "Record ID" });
  await input.fill("FXACC2/FXSEC1");
  await input.press("Enter");
  await expect(page.locator("#trace-step-position")).toBeVisible();
  await expect(picker(page)).toHaveValue("");
  expect(await picker(page).evaluate((select: HTMLSelectElement) => select.selectedOptions[0]?.text)).toBe("Pick an example");
});

test("a finding that reaches a trade through its security says so", async ({ page }) => {
  await page.goto("/trace?id=FXT01");
  const leadIn = plain.lead_in.security_id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await expect(page.getByText(new RegExp(`^${leadIn}`)).first()).toBeVisible();
});

test("search, holding keys, and unknown IDs work without treating missing evidence as a pass", async ({ page }) => {
  await page.goto("/trace");
  await page.getByRole("button", { name: "Find an ID", exact: true }).click();
  const input = page.getByRole("textbox", { name: "Record ID" });
  await input.fill("FXACC2/FXSEC1");
  await input.press("Enter");
  // A step with no finding starts closed; its raw rows are two clicks away.
  await stepHeader(page, "position").click();
  await page.locator("#trace-step-position").getByRole("button", { name: "Show the raw rows" }).click();
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

test("the State Street logo shows in the menu and moves to the top bar when the menu is hidden", async ({ page }) => {
  await page.goto("/");
  const sidebar = page.locator("aside").first(); // the Data Map also has a finding summary
  // getByRole skips display:none, so only the colour variant that suits the theme is ever counted.
  await expect(page.getByRole("img", { name: "State Street" })).toHaveCount(1);
  await expect(sidebar.getByRole("img", { name: "State Street" })).toBeVisible();
  await expect(page.locator("header").getByRole("img", { name: "State Street" })).toHaveCount(0);
  await expect(sidebar).toContainText("Prepared for State Street · Boston College case competition");
  await page.getByRole("button", { name: "Hide the menu" }).click();
  await expect(page.locator("header").getByRole("img", { name: "State Street" })).toBeVisible();
  await page.getByRole("button", { name: "Switch light or dark theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.getByRole("img", { name: "State Street" })).toHaveAttribute("src", /white/);
});

test("in dark mode with the menu open, only the menu shows the State Street logo", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Switch light or dark theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.getByRole("img", { name: "State Street" })).toHaveCount(1);
  await expect(page.locator("aside").first().getByRole("img", { name: "State Street" })).toBeVisible();
  await expect(page.locator("header").getByRole("img", { name: "State Street" })).toHaveCount(0);
});

test("the State Street logo stays visible in the top bar on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  // The menu counts as open but is hidden below the md breakpoint, so the top bar must carry the logo.
  await expect(page.getByRole("img", { name: "State Street" })).toHaveCount(1);
  await expect(page.locator("header").getByRole("img", { name: "State Street" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
});

test("the trace search and evidence remain usable on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/trace?id=FXT03");
  await page.getByRole("button", { name: "Find an ID", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Record ID" })).toBeVisible();
  await expect(picker(page)).toBeVisible();
  await expect(page.locator("#trace-step-transaction")).toContainText("quantity = -50");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
});

test("the startup screen plays once, skips on a key, and does not return", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const boot = page.locator("[data-boot-screen]");
  await expect(boot).toBeVisible();
  await expect(boot).toHaveAttribute("role", "status");
  await expect(boot).toContainText("Opening Data Flow Explorer");
  // The key listener exists once the screen has hydrated; the server HTML is visible before that.
  await expect(boot).toHaveAttribute("data-boot-ready", "");
  await page.keyboard.press("Escape");
  await expect(boot).toBeHidden({ timeout: 1_000 });
  await page.goto("/trace");
  await expect(page.getByRole("button", { name: "Find an ID", exact: true })).toBeVisible();
  await expect(boot).not.toBeVisible();
  expect(errors).toEqual([]);
  await context.close();
});

test("the startup screen survives blocked sessionStorage", async ({ browser }) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    // Only sessionStorage is blocked; the theme still lives in localStorage.
    const { getItem, setItem } = Storage.prototype;
    Storage.prototype.getItem = function (this: Storage, key: string) {
      if (this === window.sessionStorage) throw new DOMException("blocked", "SecurityError");
      return getItem.call(this, key);
    };
    Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
      if (this === window.sessionStorage) throw new DOMException("blocked", "SecurityError");
      return setItem.call(this, key, value);
    };
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const boot = page.locator("[data-boot-screen]");
  await expect(boot).toBeVisible();
  await expect(boot).toBeHidden({ timeout: 3_000 });
  await expect(page.getByRole("heading", { name: "How data moves through the platform" })).toBeVisible();
  expect(errors).toEqual([]);
  await context.close();
});
