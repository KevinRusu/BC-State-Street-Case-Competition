import { test, expect, type Page } from "@playwright/test";

const viewport = (page: Page) => page.locator(".react-flow__viewport").evaluate((el) => {
  const matrix = new DOMMatrix(getComputedStyle(el).transform);
  return { x: matrix.e, y: matrix.f, zoom: matrix.a };
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("theme", "light");
    sessionStorage.setItem("dfe-boot-seen", "1");
  });
});

for (const route of ["/", "/trace?id=FXT03"]) {
  test(`${route}: zoom-out stops at the centred default, including after resizing`, async ({ page }) => {
    await page.goto(route);
    const out = page.getByRole("button", { name: "Zoom Out", exact: true });
    const zoomIn = page.getByRole("button", { name: "Zoom In", exact: true });
    await expect(out).toBeDisabled();
    const home = await viewport(page);
    await zoomIn.click();
    await expect.poll(async () => (await viewport(page)).zoom).toBeGreaterThan(home.zoom);
    await expect(out).toBeEnabled();
    // Zoom around an off-centre cursor, then return to the floor using the buttons.
    const box = (await page.locator("[data-map-graph]").boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.3);
    await page.mouse.wheel(0, -300);
    await expect.poll(async () => (await viewport(page)).zoom).toBeGreaterThan(home.zoom * 1.2);
    for (let i = 0; i < 20 && !await out.isDisabled(); i++) await out.click();
    await expect(out).toBeDisabled();
    for (const key of ["x", "y", "zoom"] as const) {
      await expect.poll(async () => (await viewport(page))[key]).toBeCloseTo(home[key], 2);
    }
    await page.mouse.wheel(0, 2500);
    await expect.poll(async () => (await viewport(page)).zoom).toBeCloseTo(home.zoom, 4);
    await zoomIn.click();
    await page.getByRole("button", { name: "Fit View", exact: true }).click();
    await expect(out).toBeDisabled();
    await expect.poll(async () => (await viewport(page)).x).toBeCloseTo(home.x, 2);

    await page.setViewportSize({ width: 1280, height: 720 });
    await expect.poll(async () => (await viewport(page)).zoom).not.toBeCloseTo(home.zoom, 3);
    await expect(out).toBeDisabled();
    const graph = (await page.locator("[data-map-graph]").boundingBox())!;
    const top = (await page.locator('[data-id="anchor-top-left"]').boundingBox())!;
    const bottom = (await page.locator('[data-id="anchor-bottom-right"]').boundingBox())!;
    expect(top.x).toBeGreaterThanOrEqual(graph.x);
    expect(top.y).toBeGreaterThanOrEqual(graph.y);
    expect(bottom.x + bottom.width).toBeLessThanOrEqual(graph.x + graph.width);
    expect(bottom.y + bottom.height).toBeLessThanOrEqual(graph.y + graph.height);
    expect((top.x + bottom.x + bottom.width) / 2).toBeCloseTo(graph.x + graph.width / 2, 0);
    expect((top.y + bottom.y + bottom.height) / 2).toBeCloseTo(graph.y + graph.height / 2, 0);
  });
}

for (const size of [{ width: 1280, height: 720 }, { width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
  test(`trace picker, map, summary and steps fit at ${size.width} × ${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/trace?id=FXT03");
    const picker = page.getByRole("combobox", { name: "Pick an example" });
    await expect(picker).toHaveValue("FXT03");
    const ids = await picker.locator("option:not([disabled])").evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value));
    expect(ids.length).toBeGreaterThan(3);
    // Every available fixture story, including account/security keys and corporate actions.
    for (const id of ids) {
      await picker.selectOption(id);
      const summary = page.locator("[data-trace-summary]");
      await expect(summary).toContainText(id);
      const map = (await page.locator("[data-trace-map]").boundingBox())!;
      const details = (await summary.boundingBox())!;
      const steps = (await page.locator("[data-trace-steps]").boundingBox())!;
      expect(details.x, id).toBeGreaterThan(map.x + map.width);
      expect(details.y, id).toBeLessThan(map.y);
      expect(map.y + map.height, id).toBeLessThanOrEqual(size.height);
      expect(steps.height, id).toBeGreaterThan(200);
      expect(steps.y + steps.height, id).toBeLessThanOrEqual(size.height);
      expect(await page.locator("[data-trace-layout]").evaluate((el) => el.scrollHeight - el.clientHeight), id).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), id).toBeLessThanOrEqual(size.width);
    }
    await expect(page.getByRole("textbox", { name: "Record ID" })).not.toBeVisible();
  });
}

test("map selection scrolls the evidence pane while the map and record stay in place", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/trace?id=FXT03");
  const map = page.locator("[data-trace-map]");
  await expect(map).toBeVisible();
  const before = await map.boundingBox();
  await page.locator('.react-flow__node[data-id="ledger_nav"]').click();
  await expect.poll(() => page.locator("[data-trace-steps]").evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  expect(await map.boundingBox()).toEqual(before);
  await expect(page.getByRole("combobox", { name: "Pick an example" })).toBeInViewport();
  await expect(page.locator("[data-trace-summary]")).toBeInViewport();
  await page.getByRole("combobox", { name: "Pick an example" }).selectOption("FXT02");
  await expect(page.locator("[data-trace-summary]")).toContainText("FXT02");
  expect(await page.locator("[data-trace-steps]").evaluate((el) => el.scrollTop)).toBe(0);
  await page.getByRole("button", { name: "Technical details", exact: true }).click();
  await expect(page.getByRole("heading", { name: "The steps", exact: true })).toBeInViewport();
});
