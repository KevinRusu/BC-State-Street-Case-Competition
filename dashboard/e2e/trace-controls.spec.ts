import { test, expect, type Page } from "@playwright/test";

const mapButton = (page: Page, label: string) => page.locator("[data-trace-map]").getByRole("button", { name: `${label} steps`, exact: true });
const step = (page: Page, id: string) => page.locator(`#trace-step-${id}-toggle`);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("theme", "light");
    sessionStorage.setItem("dfe-boot-seen", "1");
  });
});

test("every traced box toggles its matching evidence steps", async ({ page }) => {
  await page.goto("/trace?id=FXT03");
  await expect(mapButton(page, "Transactions")).toBeEnabled();
  const buttons = page.locator("[data-trace-map] button[aria-controls]");
  expect(await buttons.count()).toBeGreaterThan(5);
  for (const button of await buttons.all()) {
    const panels = (await button.getAttribute("aria-controls"))!.split(" ");
    for (let click = 0; click < 2; click++) {
      const open = (await button.getAttribute("aria-expanded")) !== "true";
      await button.click();
      await expect(button).toHaveAttribute("aria-expanded", String(open));
      for (const id of panels) {
        await expect(page.locator(`#${id.replace(/-details$/, "-toggle")}`)).toHaveAttribute("aria-expanded", String(open));
        await expect(page.locator(`#${id}`)).toHaveJSProperty("hidden", !open);
      }
    }
  }
});

test("map, keyboard and timeline toggles stay in sync and reset for the next record", async ({ page }) => {
  await page.goto("/trace?id=FXT03");
  const transaction = mapButton(page, "Transactions");
  await expect(transaction).toHaveAttribute("aria-expanded", "true");
  await transaction.click();
  await expect(step(page, "transaction")).toHaveAttribute("aria-expanded", "false");
  await step(page, "transaction").click();
  await expect(transaction).toHaveAttribute("aria-expanded", "true");
  await transaction.focus();
  await transaction.press("Space");
  await expect(step(page, "transaction")).toHaveAttribute("aria-expanded", "false");
  await transaction.press("Enter");
  await expect(step(page, "transaction")).toHaveAttribute("aria-expanded", "true");
  await transaction.click();
  const picker = page.getByRole("combobox", { name: "Pick an example" });
  await picker.selectOption("FXT02");
  await expect(page.locator("[data-trace-summary]")).toContainText("FXT02");
  await picker.selectOption("FXT03");
  await expect(transaction).toHaveAttribute("aria-expanded", "true");
  await expect(step(page, "transaction")).toHaveAttribute("aria-expanded", "true");
});

test("a box with several matching steps opens and closes them as a group", async ({ page }) => {
  await page.goto("/trace?id=FXT11");
  const transactions = mapButton(page, "Transactions");
  await expect(transactions).toBeEnabled();
  const panels = (await transactions.getAttribute("aria-controls"))!.split(" ");
  expect(panels.length).toBeGreaterThan(1);
  if (await transactions.getAttribute("aria-expanded") === "true") await transactions.click();
  await transactions.click();
  for (const id of panels) await expect(page.locator(`#${id}`)).toHaveJSProperty("hidden", false);
  await transactions.click();
  for (const id of panels) await expect(page.locator(`#${id}`)).toHaveJSProperty("hidden", true);
});

test("context-only boxes explain that they are outside the record's trace", async ({ page }) => {
  await page.goto("/trace?id=FXACC1");
  const pipeline = mapButton(page, "Pipeline events");
  await expect(pipeline).toBeDisabled();
  await expect(pipeline).toHaveAttribute("title", "Not part of this record's trace");
  await expect(mapButton(page, "Accounts")).toBeEnabled();
});

test("a map box can open its evidence on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/trace?id=FXT03");
  const ledger = mapButton(page, "Ledger NAV");
  await expect(ledger).toHaveAttribute("aria-expanded", "false");
  await ledger.click();
  const panel = page.locator(`#${await ledger.getAttribute("aria-controls")}`);
  await expect(panel).toHaveJSProperty("hidden", false);
  await expect(panel.getByRole("button", { name: "Show the raw rows" })).toBeInViewport();
});

for (const route of ["/", "/trace?id=FXT03"]) {
  test(`${route}: offices and external sources have distinct, coordinated boundaries in both themes`, async ({ page }) => {
    await page.goto(route);
    const group = page.locator("[data-office-group]");
    await expect(group).toContainText("State Street Offices");
    const external = page.locator('[data-office-id="independent"]');
    const check = async () => {
      await expect(group).toHaveCSS("border-top-width", "2px");
      await expect(external).toHaveCSS("border-top-style", "dashed");
      await expect(external).toHaveCSS("border-top-width", "2px");
      const offices = (await group.boundingBox())!;
      const sources = (await external.boundingBox())!;
      expect(offices.y + offices.height).toBeLessThan(sources.y);
    };
    await expect(group).toHaveCSS("border-top-color", "rgb(107, 127, 172)");
    await check();
    await page.getByRole("button", { name: "Switch light or dark theme" }).click();
    await expect(external).toHaveCSS("border-top-color", "rgb(130, 146, 170)");
    await expect(group).toHaveCSS("border-top-color", "rgb(104, 126, 168)");
    await check();
  });
}
