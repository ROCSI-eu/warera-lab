import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { installApiMocks } from "./fixtures.js";
import { installMarketMocks } from "./market-fixtures.js";

test("@journey market overview item selection, search, URL reload and provenance remain independent of player import", async ({
  page,
}) => {
  const playerMocks = await installApiMocks(page);
  const market = await installMarketMocks(page);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/?lab=market");

  await expect(page.getByRole("heading", { name: "Current item overview" })).toBeVisible();
  await expect(page.getByRole("link", { name: /steel.*12.75/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /iron.*No current price/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Choose an item" })).toBeVisible();
  const filter = page.getByLabel("Filter items by code, type, or rarity");
  await filter.fill("raRE");
  await expect(
    page.getByRole("list", { name: "Browse current market items" }).getByRole("link"),
  ).toHaveCount(1);
  await filter.fill("");

  await page
    .getByRole("list", { name: "Browse current market items" })
    .getByRole("link", { name: /steel/i })
    .click();
  await expect(page).toHaveURL(/lab=market&item=steel/);
  await expect(page.getByRole("heading", { name: "steel", exact: true })).toBeVisible();
  await expect(page.getByText("Recipe quantity 2")).toBeVisible();
  await expect(page.getByText("Missing current prices: iron")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Current top orders" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Current buy orders" })).toContainText("11");
  await expect(page.getByRole("region", { name: "Current sell orders" })).toContainText("14");
  await expect(page.getByRole("heading", { name: "Selected item freshness" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "steel", exact: true })).toBeVisible();
  expect(market.itemCodes).toContain("steel");
  const forbidden = playerMocks.apiRequestDetails.filter(
    (request) =>
      request.pathname.startsWith("/api/players/") || request.pathname === "/api/economy/context",
  );
  expect(forbidden).toEqual([]);
  expect(playerMocks.externalRequests).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBe(0);
  await expect(page.locator("body")).not.toContainText("Gross margin");
});

test("@journey market partial, empty, unavailable and refreshed responses remain explicit", async ({
  page,
}) => {
  const playerMocks = await installApiMocks(page);
  const market = await installMarketMocks(page);
  market.overviewMode = "empty";
  market.itemMode = "missing-orders";
  await page.goto("/?lab=market&item=steel");
  await expect(page.getByText(/No current items were returned/)).toBeVisible();
  await expect(
    page.getByText(/Current orders are temporarily unavailable for steel/),
  ).toBeVisible();
  await expect(page.getByText("Missing current prices: iron")).toBeVisible();
  market.overviewMode = "error";
  market.itemMode = "error";
  await page.getByRole("button", { name: "Refresh market" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Market data is temporarily unavailable." }),
  ).toHaveCount(2);

  market.overviewMode = "ok";
  market.itemMode = "ok";
  await page.getByRole("button", { name: "Refresh market" }).click();
  await expect(page.getByRole("heading", { name: "Current top orders" })).toBeVisible();
  await expect(page.getByRole("link", { name: /iron.*No current price/i })).toBeVisible();
  await page.getByRole("link", { name: "Clear selection" }).click();
  await expect(page).toHaveURL(/\?lab=market$/);
  await expect(page.getByRole("heading", { name: "Choose an item" })).toBeVisible();
  expect(playerMocks.externalRequests).toEqual([]);
});

test("@journey Market Lab recipe-only economics shows exact formula and provenance without importing player context", async ({
  page,
}) => {
  const playerMocks = await installApiMocks(page);
  const market = await installMarketMocks(page);
  market.recipeEconomicsMode = "positive";
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/?lab=market&item=steel");

  const section = page.getByRole("region", { name: "Recipe-only current economics" });
  await expect(section).toBeVisible();
  await expect(section.getByText("Recipe input cost", { exact: true })).toBeVisible();
  await expect(section.getByText("Recipe-only implied spread", { exact: true })).toBeVisible();
  await expect(section).toContainText("8.75");
  await expect(section).toContainText("4");
  await expect(section).toContainText("not realized profit");
  await section.getByText("How is this recipe-only spread calculated?").click();
  await expect(section.getByText("market-margin-v1", { exact: true })).toBeVisible();
  await expect(section.getByText("Recipe and price sources:")).toBeVisible();
  const advanced = section.getByText("Advanced / exact calculation inputs and outputs");
  await advanced.click();
  await expect(section.locator("pre")).toContainText('"recipeInputCost"');
  await expect(section.locator("pre")).toContainText('"provenance": "derived"');
  expect(
    playerMocks.apiRequestDetails
      .map(({ pathname }) => pathname)
      .every((path) => path.startsWith("/api/market/")),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBe(0);
  expect(playerMocks.externalRequests).toEqual([]);

  market.recipeEconomicsMode = "negative";
  await page.getByRole("button", { name: "Refresh market" }).click();
  await expect(section).toContainText("negative spread");
  await expect(section).toContainText("-1");

  market.recipeEconomicsMode = "missing-price";
  await page.getByRole("button", { name: "Refresh market" }).click();
  await expect(section).toContainText("Recipe-only economics unavailable");
  await expect(section).toContainText("Missing price codes: iron");
  await expect(section.getByText("Recipe-only implied spread", { exact: true })).toHaveCount(0);
});

test("@a11y market item explorer at 320px has keyboard selection and no automated axe violations", async ({
  page,
}) => {
  await installApiMocks(page);
  await installMarketMocks(page);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/?lab=market&item=missing");
  await expect(page.getByText("Recipe details cannot be shown")).toBeVisible();
  const search = page.getByLabel("Filter items by code, type, or rarity");
  await search.focus();
  await expect(search).toBeFocused();
  await page.keyboard.press("Tab");
  const itemList = page.getByRole("list", { name: "Browse current market items" });
  await expect(itemList.getByRole("link").first()).toBeFocused();
  const violations = await new AxeBuilder({ page })
    .include(".market-lab")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(violations.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBe(0);
});
