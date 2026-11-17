import { test, expect, type Page } from "@playwright/test";

const viewport = (page: Page) => page.locator(".react-flow__viewport").evaluate((el) => {
  const matrix = new DOMMatrix(getComputedStyle(el).transform);
  return { x: matrix.e, y: matrix.f, zoom: matrix.a };
});

async function expectOfficeLayout(page: Page) {
  const table = (id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
  const office = (id: string) => page.locator(`[data-office-id="${id}"]`);
  await expect(table("transactions")).toBeVisible();
  // The shared box's actual centre must follow the office boundary even when a trace adds a label.
  await expect.poll(async () => {
    const transaction = (await table("transactions").boundingBox())!;
    const front = (await office("front").boundingBox())!;
    const middle = (await office("middle").boundingBox())!;
    return Math.abs(transaction.y + transaction.height / 2 - (front.y + front.height + middle.y) / 2);
  }).toBeLessThan(0.75);
  for (const [id, layer] of [["accounts", "front"], ["ledger_nav", "back"]]) {
    await expect.poll(async () => {
      const node = (await table(id).boundingBox())!;
      const band = (await office(layer).boundingBox())!;
      return Math.abs(node.y + node.height / 2 - band.y - band.height / 2);
    }, id).toBeLessThan(0.75);
  }
  const transaction = (await table("transactions").boundingBox())!;
  const pipeline = (await table("pipeline_events").boundingBox())!;
  const corporate = (await table("corporate_actions").boundingBox())!;
  const { zoom } = await viewport(page);
  expect(pipeline.y - transaction.y - transaction.height).toBeGreaterThanOrEqual(20 * zoom);
  expect(corporate.y - pipeline.y - pipeline.height).toBeGreaterThanOrEqual(20 * zoom);
  for (const [id, layer] of [
    ["accounts", "front"], ["pipeline_events", "middle"], ["corporate_actions", "middle"],
    ["securities", "middle"], ["positions", "middle"], ["ledger_nav", "back"],
    ["comparison_positions", "independent"], ["prices", "independent"], ["fx_rates", "independent"],
  ]) {
    const node = (await table(id).boundingBox())!;
    const band = (await office(layer).boundingBox())!;
    expect(node.y, id).toBeGreaterThanOrEqual(band.y);
    expect(node.y + node.height, id).toBeLessThanOrEqual(band.y + band.height);
  }
}

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
    await page.goto("/trace");
    const picker = page.getByRole("combobox", { name: "Pick an example" });
    await expect(picker).toHaveValue("");
    const canvas = page.locator("[data-trace-map]");
    const rail = page.locator("[data-trace-details]");
    const summaryRegion = page.getByRole("region", { name: "Selected record" });
    const initialMap = await canvas.boundingBox();
    const initialPicker = await picker.boundingBox();
    const initialRail = await rail.boundingBox();
    const ids = await picker.locator("option:not([disabled])").evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value));
    expect(ids.length).toBeGreaterThan(3);
    // Every available fixture story, including account/security keys and corporate actions.
    for (const id of ids) {
      await picker.selectOption(id);
      const summary = page.locator("[data-trace-summary]");
      await expect(summary).toContainText(id);
      await expectOfficeLayout(page);
      const map = (await canvas.boundingBox())!;
      const railBox = (await rail.boundingBox())!;
      const details = (await summaryRegion.boundingBox())!;
      const steps = (await page.locator("[data-trace-steps]").boundingBox())!;
      expect(railBox.x, id).toBeGreaterThan(map.x + map.width);
      expect(railBox.width / (map.width + railBox.width), id).toBeCloseTo(0.25, 2);
      expect(details.x, id).toBeCloseTo(railBox.x, 0);
      expect(steps.x, id).toBeGreaterThanOrEqual(railBox.x);
      expect(steps.y, id).toBeGreaterThan(details.y + details.height);
      expect(steps.y, id).toBeLessThan(map.y + map.height);
      expect(steps.height, id).toBeGreaterThan(200);
      expect(steps.y + steps.height, id).toBeLessThanOrEqual(size.height);
      expect(map, id).toEqual(initialMap);
      expect(await picker.boundingBox(), id).toEqual(initialPicker);
      expect(railBox, id).toEqual(initialRail);
      expect(await page.locator("[data-trace-layout]").evaluate((el) => el.scrollHeight - el.clientHeight), id).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), id).toBeLessThanOrEqual(size.width);
    }
    await expect(page.getByRole("textbox", { name: "Record ID" })).not.toBeVisible();
  });
}

test("the data map keeps the shared transaction box balanced and all other boxes inside their office", async ({ page }) => {
  await page.goto("/");
  await expectOfficeLayout(page);
});

test("the trace example menu has matching text and background colours in both themes", async ({ page }) => {
  await page.goto("/trace");
  const picker = page.getByRole("combobox", { name: "Pick an example" });
  const option = picker.locator("optgroup option").first();
  const checkPalette = async (scheme: string, foreground: string, background: string) => {
    await expect(picker).toHaveCSS("color-scheme", scheme);
    await picker.click();
    await expect.poll(() => picker.evaluate((el) => el.matches(":open"))).toBe(true);
    await expect(option).toHaveCSS("color", foreground);
    await expect(option).toHaveCSS("background-color", background);
    await page.keyboard.press("Escape");
    await expect.poll(() => picker.evaluate((el) => el.matches(":open"))).toBe(false);
  };
  await checkPalette("light", "rgb(26, 26, 26)", "rgb(255, 255, 255)");
  await page.getByRole("button", { name: "Switch light or dark theme" }).click();
  await checkPalette("dark", "rgb(242, 243, 245)", "rgb(15, 17, 21)");
});

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
