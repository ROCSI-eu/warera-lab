import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { installApiMocks, snapshotResponse } from "./fixtures.js";

test("@journey Player Lab summarizes twelve owned companies and their outputs without Economy requests", async ({
  page,
}) => {
  const api = await installApiMocks(page);
  api.largePortfolio = true;
  await page.goto("/?lab=player&player=player-1");

  const portfolio = page.getByRole("region", { name: "Owned-company overview" });
  await expect(portfolio.getByRole("heading", { name: "Owned-company overview" })).toBeVisible();
  await expect(portfolio.locator(".player-portfolio__card")).toHaveCount(12);
  await expect(
    portfolio.getByText("Company outputs are not player-owned inventory balances."),
  ).toBeVisible();
  await expect(portfolio.getByText("Company outputs", { exact: true })).toBeVisible();
  await expect(portfolio.getByText(/Steel Inc/).first()).toBeVisible();
  expect(api.apiRequestDetails.map((request) => request.pathname)).toEqual([
    "/api/players/snapshot",
  ]);
  expect(api.economyContextItemCodes).toEqual([]);
  expect(api.externalRequests).toEqual([]);
});

test("@a11y Player Lab portfolio with duplicate names fits 320px and preserves distinct identities", async ({
  page,
}) => {
  const api = await installApiMocks(page);
  api.duplicateCompanies = true;
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/?lab=player&player=player-1");

  const portfolio = page.getByRole("region", { name: "Owned-company overview" });
  await expect(portfolio.locator(".player-portfolio__card")).toHaveCount(2);
  await expect(portfolio.getByRole("heading", { name: "Iron Inc" })).toHaveCount(2);
  await expect(portfolio.locator(".player-portfolio__identifier")).toHaveCount(2);
  const ids = await portfolio.locator(".player-portfolio__identifier").allTextContents();
  expect(new Set(ids).size).toBe(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBe(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(api.economyContextItemCodes).toEqual([]);
});

test("@journey Player Lab portfolio shows missing geography, optional cues and zero-company snapshot honestly", async ({
  page,
}) => {
  const api = await installApiMocks(page);
  await page.route("**/api/players/snapshot", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          ...snapshotResponse,
          companies: [
            {
              ...snapshotResponse.companies[0],
              regionId: "region-missing",
              production: undefined,
              workerCount: undefined,
            },
          ],
          contextGaps: { countryIds: [], regionIds: ["region-missing"] },
        },
      }),
    });
  });
  await page.goto("/?lab=player&player=player-1");
  const portfolio = page.getByRole("region", { name: "Owned-company overview" });
  await expect(portfolio.getByText("Location unavailable")).toBeVisible();
  await expect(portfolio.getByText("Production not reported")).toHaveCount(0);
  await expect(portfolio.getByText("Workers not reported")).toHaveCount(0);

  await page.unroute("**/api/players/snapshot");
  await page.route("**/api/players/snapshot", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { ...snapshotResponse, companies: [] } }),
    });
  });
  await page.getByRole("button", { name: "Refresh snapshot" }).click();
  await expect(
    portfolio.getByText("No owned companies are listed in this public snapshot."),
  ).toBeVisible();
  await expect(portfolio.locator(".player-portfolio__card")).toHaveCount(0);
  expect(api.economyContextItemCodes).toEqual([]);
});
