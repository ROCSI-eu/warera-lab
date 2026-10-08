import { expect, test } from "@playwright/test";

import { installApiMocks } from "./fixtures.js";
import { installMarketMocks } from "./market-fixtures.js";

test("@journey company output item carries explicit Market context and verified Economy return, with history", async ({
  page,
}) => {
  const api = await installApiMocks(page);
  const market = await installMarketMocks(page);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/?lab=company&player=player-1&company=company-1");
  await expect(page.getByRole("heading", { name: "Planner Steel" })).toBeVisible();

  const handoff = page.getByRole("link", { name: "Inspect steel in Market Lab" });
  await expect(handoff).toHaveAttribute(
    "href",
    "/?lab=market&player=player-1&company=company-1&item=steel",
  );
  const snapshotCountBefore = api.apiRequestDetails.filter(
    (x) => x.pathname === "/api/players/snapshot",
  ).length;
  await handoff.click();
  await expect(page.getByRole("heading", { name: "Market Lab", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "steel", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/lab=market.*player=player-1.*company=company-1.*item=steel/);
  expect(api.apiRequestDetails.filter((x) => x.pathname === "/api/players/snapshot")).toHaveLength(
    snapshotCountBefore,
  );
  expect(market.itemCodes).toContain("steel");

  const continueAction = page.getByRole("region", { name: "Continue in Economy Lab" });
  await expect(continueAction).toContainText("not inserted into, or used to overwrite");
  await expect(continueAction).toContainText("reload and verify the live public context");
  const link = continueAction.getByRole("link", { name: "Continue to Economy Lab" });
  await expect(link).toHaveAttribute("href", "/?lab=economy&player=player-1&company=company-1");
  await link.click();
  await expect(page.getByRole("heading", { name: "Scenario workspace" })).toBeVisible();
  await expect(page).toHaveURL(/\?lab=economy&player=player-1&company=company-1$/);
  expect(api.economyContextItemCodes).toContain("steel");
  expect(
    api.apiRequestDetails.filter((x) => x.pathname === "/api/players/snapshot").length,
  ).toBeGreaterThan(snapshotCountBefore);

  await page.goBack();
  await expect(page.getByRole("heading", { name: "Market Lab", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "steel", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Planner Steel" })).toBeVisible();
  expect(api.externalRequests).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBe(0);
});

test("@journey standalone and malformed Market identity use recoverable Economy entry without adopting item data", async ({
  page,
}) => {
  const api = await installApiMocks(page);
  await installMarketMocks(page);
  await page.goto("/?lab=market&item=steel");
  await expect(page.getByRole("heading", { name: "steel", exact: true })).toBeVisible();
  const handoff = page.getByRole("link", { name: "Find a player in Economy Lab" });
  await expect(handoff).toHaveAttribute("href", "/?lab=economy");
  await expect(page.getByRole("region", { name: "Continue in Economy Lab" })).toContainText(
    "not inserted into, or used to overwrite",
  );
  expect(api.apiRequestDetails.every((x) => x.pathname.startsWith("/api/market/"))).toBe(true);
  await handoff.click();
  await expect(page).toHaveURL("/?lab=economy", { timeout: 15_000 });
  await expect(page.getByRole("searchbox", { name: "WarEra player name" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("heading", { name: "Scenario workspace" })).toHaveCount(0);
  expect(api.apiRequestDetails.filter((x) => x.pathname === "/api/players/snapshot")).toHaveLength(
    0,
  );

  await page.goto("/?lab=market&player=%20&company=ghost&item=steel");
  await expect(page.getByText(/player context in this link is invalid/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Find a player in Economy Lab" })).toHaveAttribute(
    "href",
    "/?lab=economy",
  );
  expect(api.externalRequests).toEqual([]);
});

test("@journey Market identity links revalidate missing company instead of treating inspected item as a scenario", async ({
  page,
}) => {
  const api = await installApiMocks(page);
  await installMarketMocks(page);
  await page.goto("/?lab=market&player=player-1&company=missing-company&item=coal");
  await expect(page.getByRole("heading", { name: "coal", exact: true })).toBeVisible();
  const handoff = page.getByRole("link", { name: "Continue to Economy Lab" });
  await expect(handoff).toHaveAttribute(
    "href",
    "/?lab=economy&player=player-1&company=missing-company",
  );
  expect(api.apiRequestDetails.filter((x) => x.pathname === "/api/players/snapshot")).toHaveLength(
    0,
  );
  await handoff.click();

  await expect(page.getByText(/company from this link is no longer available/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Scenario workspace" })).toBeVisible();
  await expect(page).toHaveURL(/\?lab=economy&player=player-1&company=company-1$/);
  expect(api.economyContextItemCodes).toContain("steel");
  expect(api.economyContextItemCodes).not.toContain("coal");
  await page.goBack();
  await expect(page.getByRole("heading", { name: "coal", exact: true })).toBeVisible();

  await page.goto("/?lab=market&player=player-1&item=iron");
  await expect(page.getByRole("link", { name: "Continue to Economy Lab" })).toHaveAttribute(
    "href",
    "/?lab=economy&player=player-1",
  );
  await expect(page.getByRole("region", { name: "Continue in Economy Lab" })).toContainText(
    "select a company",
  );
  expect(api.externalRequests).toEqual([]);
});

test("@journey Market-to-Economy recovery link survives selected item upstream failure", async ({
  page,
}) => {
  const api = await installApiMocks(page);
  const market = await installMarketMocks(page);
  market.itemMode = "error";
  await page.goto("/?lab=market&item=steel&player=player-1&company=company-1");

  await expect(page.getByText("Current item context is unavailable.")).toBeVisible();
  const handoff = page.getByRole("region", { name: "Continue in Economy Lab" });
  await expect(handoff).toContainText("reload and verify");
  await handoff.getByRole("link", { name: "Continue to Economy Lab" }).click();
  await expect(page.getByRole("heading", { name: "Scenario workspace" })).toBeVisible();
  await expect(page).toHaveURL("/?lab=economy&player=player-1&company=company-1");
  expect(api.economyContextItemCodes).toContain("steel");
  expect(api.externalRequests).toEqual([]);
});
