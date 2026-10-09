import { expect, test } from "@playwright/test";

import { installApiMocks } from "./fixtures.js";

test("@journey Player Lab accepts public player-only links without economy/market fetches", async ({
  page,
}) => {
  const api = await installApiMocks(page);
  await page.goto("/?lab=player&player=player-1");

  await expect(page.getByRole("link", { name: "Player Lab" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("heading", { name: "Planner", exact: true })).toBeVisible();
  await expect(page).toHaveURL("/?lab=player&player=player-1");
  expect(api.apiRequestDetails.map((request) => request.pathname)).toEqual([
    "/api/players/snapshot",
  ]);
  await expect(
    page
      .getByRole("navigation", { name: "WarEra Lab modules" })
      .getByRole("link", { name: "Company Lab" }),
  ).toHaveAttribute("href", "/?lab=company&player=player-1");

  await page.getByRole("button", { name: "Refresh snapshot" }).click();
  await expect(page.getByText("Public player snapshot refreshed.")).toBeVisible();
  expect(api.apiRequestDetails.map((request) => request.pathname)).toEqual([
    "/api/players/snapshot",
    "/api/players/snapshot",
  ]);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Planner", exact: true })).toBeVisible();
  await page
    .getByRole("navigation", { name: "WarEra Lab modules" })
    .getByRole("link", { name: "Economy Lab" })
    .click();
  await expect(page.getByRole("heading", { name: "Scenario workspace" })).toBeVisible();
  expect(api.economyContextItemCodes).toContain("steel");
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Planner", exact: true })).toBeVisible();
  expect(api.externalRequests).toEqual([]);
});

test("@journey Player Lab validates company focus and never silently selects a company", async ({
  page,
}) => {
  const api = await installApiMocks(page);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/?lab=player&player=player-1&company=missing-company");
  await expect(page.getByText(/company in this link is no longer listed/)).toBeVisible();
  await expect(page).toHaveURL("/?lab=player&player=player-1");
  await expect(page.getByText(/This link focuses the owned company/)).toHaveCount(0);
  expect(api.economyContextItemCodes).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBe(0);

  await page.goto("/?lab=player&player=player-1&company=company-1");
  await expect(page.getByText(/This link focuses the owned company Planner Steel/)).toBeVisible();
  await expect(page).toHaveURL("/?lab=player&player=player-1&company=company-1");
  await expect(
    page
      .getByRole("navigation", { name: "WarEra Lab modules" })
      .getByRole("link", { name: "Company Lab" }),
  ).toHaveAttribute("href", "/?lab=company&player=player-1&company=company-1");
  expect(api.economyContextItemCodes).toEqual([]);
});

test("@journey Player Lab search/import and failure recovery preserve public-only behavior", async ({
  page,
}) => {
  const api = await installApiMocks(page);
  await page.goto("/?lab=player");
  await expect(page.getByRole("heading", { name: "Start with a player" })).toBeVisible();
  await page.getByLabel("WarEra player name").fill("Planner");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("button", { name: /Planner Level 12/ }).click();
  await expect(page.getByRole("heading", { name: "Planner", exact: true })).toBeVisible();
  await expect(page).toHaveURL("/?lab=player&player=player-1");
  expect(api.economyContextItemCodes).toEqual([]);

  api.snapshotMode = "rate-limit";
  await page.getByRole("button", { name: "Refresh snapshot" }).click();
  await expect(page.getByRole("alert")).toContainText(/rate limit reached/i);
  await expect(page.getByRole("heading", { name: "Planner", exact: true })).toBeVisible();
  expect(api.externalRequests).toEqual([]);
});
