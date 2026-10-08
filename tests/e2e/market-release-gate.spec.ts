import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { installApiMocks } from "./fixtures.js";
import { installMarketMocks } from "./market-fixtures.js";

const horizontalOverflow = async (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const browserStorage = async (page: import("@playwright/test").Page) =>
  page.evaluate(async () => ({
    localStorage: Object.keys(window.localStorage),
    sessionStorage: Object.keys(window.sessionStorage),
    indexedDatabases: (await window.indexedDB.databases()).map((db) => db.name),
  }));

test("@journey Market navigation, direct item reload and back retain current-state URL context", async ({
  page,
}) => {
  const api = await installApiMocks(page);
  const market = await installMarketMocks(page);

  await page.goto("/");
  await page
    .getByRole("navigation", { name: "WarEra Lab modules" })
    .getByRole("link", { name: "Market Lab" })
    .click();
  await expect(page).toHaveURL(/\?lab=market$/);
  await expect(page.getByRole("heading", { name: "Choose an item" })).toBeVisible();

  await page.getByLabel("Filter items by code, type, or rarity").fill("steel");
  await page
    .getByRole("list", { name: "Browse current market items" })
    .getByRole("link", { name: /steel/i })
    .click();
  await expect(page).toHaveURL(/\?lab=market&item=steel$/);
  await expect(page.getByRole("heading", { name: "steel", exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "steel", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Choose an item" })).toBeVisible();
  expect(market.itemCodes).toContain("steel");
  expect(api.externalRequests).toEqual([]);
  expect(
    api.apiRequestDetails.every(
      ({ method, pathname, origin }) =>
        method === "POST" &&
        origin === new URL(page.url()).origin &&
        ["/api/market/overview", "/api/market/item"].includes(pathname),
    ),
  ).toBe(true);
});

test("@journey Market 429 recovery stays manual with no polling, history or browser persistence", async ({
  page,
}) => {
  const api = await installApiMocks(page);
  const market = await installMarketMocks(page);
  market.overviewMode = "rate-limit";
  market.itemMode = "rate-limit";
  await page.clock.install();
  await page.goto("/?lab=market&item=steel");
  await expect(
    page.getByRole("alert").filter({ hasText: "WarEra rate limit reached." }),
  ).toHaveCount(2);
  await expect(page.getByText(/Suggested retry: in about 45 seconds/i)).toHaveCount(2);

  const initialRequests = api.apiRequestDetails.length;
  // Vite's development StrictMode may re-run the initial read-only effects.
  expect(initialRequests).toBeGreaterThanOrEqual(2);
  await page.clock.fastForward(300_000);
  expect(api.apiRequestDetails).toHaveLength(initialRequests);
  expect(await browserStorage(page)).toEqual({
    localStorage: [],
    sessionStorage: [],
    indexedDatabases: [],
  });

  market.overviewMode = "ok";
  market.itemMode = "ok";
  market.recipeEconomicsMode = "positive";
  await page.getByRole("button", { name: "Refresh market" }).click();
  await expect(page.getByRole("heading", { name: "Current top orders" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Recipe-only current economics" })).toContainText(
    "Recipe-only implied spread",
  );
  expect(api.apiRequestDetails).toHaveLength(initialRequests + 2);
  // Market data was successfully fetched; storage must still remain untouched.
  expect(await browserStorage(page)).toEqual({
    localStorage: [],
    sessionStorage: [],
    indexedDatabases: [],
  });
  expect(api.externalRequests).toEqual([]);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
});

test("@journey Market empty orders differ from unavailable orders and absent configuration", async ({
  page,
}) => {
  await installApiMocks(page);
  const market = await installMarketMocks(page);
  market.itemMode = "empty-orders";
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/?lab=market&item=steel");
  await expect(page.getByText("No current buy orders were returned.")).toBeVisible();
  await expect(page.getByText("No current sell orders were returned.")).toBeVisible();
  await expect(page.getByText("Missing current prices: iron")).toBeVisible();
  expect(await horizontalOverflow(page)).toBe(0);

  market.itemMode = "missing-orders";
  await page.getByRole("button", { name: "Refresh market" }).click();
  await expect(
    page.getByText(/Current orders are temporarily unavailable for steel/),
  ).toBeVisible();
  await expect(page.getByText("No current buy orders were returned.")).toHaveCount(0);

  await page.goto("/?lab=market&item=missing");
  await expect(page.getByText(/absent from the normalized configuration/)).toBeVisible();
  await expect(page.getByText(/Missing item configuration: missing/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Recipe-only current economics" })).toContainText(
    "Recipe-only economics unavailable",
  );
  expect(await horizontalOverflow(page)).toBe(0);
});

test("@a11y keyboard item inspection, disclosures and Economy handoff work at 320px", async ({
  page,
}) => {
  const api = await installApiMocks(page);
  const market = await installMarketMocks(page);
  market.recipeEconomicsMode = "positive";
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/?lab=market&player=player-1&company=company-1");

  const filter = page.getByLabel("Filter items by code, type, or rarity");
  await filter.focus();
  await page.keyboard.press("Tab");
  const firstItem = page
    .getByRole("list", { name: "Browse current market items" })
    .getByRole("link")
    .first();
  await expect(firstItem).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/lab=market.*item=coal/);
  await expect(page.getByRole("heading", { name: "coal", exact: true })).toBeVisible();

  await page.goto("/?lab=market&item=steel&player=player-1&company=company-1");
  const recipeDetails = page.getByText("How is this recipe-only spread calculated?");
  await recipeDetails.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Recipe and price sources:")).toBeVisible();

  const handoff = page.getByRole("link", { name: "Continue to Economy Lab" });
  await handoff.focus();
  const hasVisibleFocus = await handoff.evaluate((element) => {
    const style = getComputedStyle(element);
    return style.outlineStyle !== "none" && style.outlineWidth !== "0px";
  });
  expect(hasVisibleFocus).toBe(true);
  // Scope to the Market module: the pre-existing shared footer has
  // WCAG 2.2 touch-target findings outside this focused release gate.
  const a11y = await new AxeBuilder({ page })
    .include(".market-lab")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(a11y.violations).toEqual([]);
  expect(await horizontalOverflow(page)).toBe(0);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Scenario workspace" })).toBeVisible();
  expect(api.externalRequests).toEqual([]);
});

test("@visual Market Lab loaded item, provenance and recipe economics", async ({ page }) => {
  await installApiMocks(page);
  const market = await installMarketMocks(page);
  market.recipeEconomicsMode = "positive";
  await page.goto("/?lab=market&item=steel&player=player-1&company=company-1");
  await expect(page.getByRole("heading", { name: "Current top orders" })).toBeVisible();
  await page.getByText("How is this recipe-only spread calculated?").click();
  await expect(page.getByText("Recipe and price sources:")).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

  if (test.info().project.name === "visual-reduced-motion") {
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(
      true,
    );
    const duration = await page
      .locator(".market-item-link")
      .first()
      .evaluate((element) => {
        const style = getComputedStyle(element);
        return [style.transitionDuration, style.animationDuration];
      });
    expect(duration).toEqual(["1e-05s", "1e-05s"]);
  }
  await expect(page).toHaveScreenshot("market-lab-loaded.png", { fullPage: true, timeout: 15_000 });
});

test("@visual Market Lab degraded current-state context", async ({ page }) => {
  await installApiMocks(page);
  const market = await installMarketMocks(page);
  market.overviewMode = "empty";
  market.itemMode = "missing-orders";
  await page.goto("/?lab=market&item=steel");
  await expect(page.getByText(/No current items were returned/)).toBeVisible();
  await expect(page.getByText(/Current orders are temporarily unavailable/)).toBeVisible();
  await expect(page.getByText(/Recipe-only economics unavailable/)).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  await expect(page).toHaveScreenshot("market-lab-degraded.png", {
    fullPage: true,
    timeout: 15_000,
  });
});
