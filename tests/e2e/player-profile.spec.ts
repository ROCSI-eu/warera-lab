import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { installApiMocks, snapshotResponse } from "./fixtures.js";

test("@journey Player Lab presents observed economic profile without fetching context", async ({
  page,
}) => {
  const api = await installApiMocks(page);
  await page.goto("/?lab=player&player=player-1");
  const profile = page.locator(".player-profile");

  await expect(page.getByRole("heading", { name: "Planner", exact: true })).toBeVisible();
  await expect(profile.getByText("Romania", { exact: true })).toBeVisible();
  await expect(profile.getByText("Player level")).toBeVisible();
  await expect(profile.getByText("Listed owned companies")).toBeVisible();
  await expect(profile.getByText("Observed economy skills")).toBeVisible();
  await expect(profile.getByText("Production", { exact: true })).toBeVisible();
  await expect(profile.getByText("Entrepreneurship", { exact: true })).toBeVisible();
  await expect(profile.getByText("Management", { exact: true })).toBeVisible();
  await expect(profile.getByText("Reported value 12 · Total 12")).toBeVisible();
  await expect(profile.getByText("View source details (2)")).toBeVisible();
  await expect(profile.locator(".freshness-list")).not.toBeVisible();
  expect(api.apiRequestDetails.map((request) => request.pathname)).toEqual([
    "/api/players/snapshot",
  ]);
  await expect(profile.getByText("Company count reflects this public snapshot")).toBeVisible();

  await page.getByRole("button", { name: "Refresh snapshot" }).click();
  await expect(page.getByText("Public player snapshot refreshed.")).toBeVisible();
  expect(api.economyContextItemCodes).toEqual([]);
  expect(api.externalRequests).toEqual([]);
});

test("@a11y Player Lab missing-country, zero-company and stale-data profile remains accessible at 320px", async ({
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
          countries: {},
          companies: [],
          contextGaps: { countryIds: ["country-1"], regionIds: ["missing-region"] },
          freshness: {
            ...snapshotResponse.freshness,
            hasStaleData: true,
            sources: snapshotResponse.freshness.sources.map((source, index) => ({
              ...source,
              state: index === 0 ? "stale" : "cached",
            })),
          },
        },
      }),
    });
  });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/?lab=player&player=player-1");
  const profile = page.locator(".player-profile");
  await expect(profile.getByText("Country unavailable")).toBeVisible();
  await expect(profile.getByText("No owned companies are listed")).toBeVisible();
  await expect(profile.getByText(/Some geographic context is unavailable/)).toBeVisible();
  await expect(profile.getByText("Contains stale data")).toBeVisible();
  await expect(profile.getByText("1 cached · 1 stale")).toBeVisible();
  await expect(profile.getByText("View source details (2)")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBe(0);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  expect(api.apiRequestDetails.map((request) => request.pathname)).toEqual([
    "/api/players/snapshot",
  ]);
});
