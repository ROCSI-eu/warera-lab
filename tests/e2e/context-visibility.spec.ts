import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { installApiMocks, snapshotResponse } from "./fixtures.js";

test("@journey #106 search completion and Player portfolio continuation are explicit", async ({
  page,
}) => {
  const api = await installApiMocks(page);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/?lab=player");
  await expect(page.locator(".active-context")).toHaveCount(0);

  await page.getByLabel("WarEra player name").fill("Planner");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("Search complete · 1 match found")).toBeVisible();
  await page.getByRole("button", { name: "View matching players" }).click();
  await expect(page.getByRole("heading", { name: "1 match" })).toBeFocused();

  await page.getByRole("button", { name: /Planner Level 12/ }).click();
  const summary = page.locator(".active-context");
  await expect(summary).toContainText("Public player snapshot loaded");
  await expect(page.getByText("Public snapshot imported: Planner")).toBeVisible();
  await summary.getByRole("button", { name: "View owned companies" }).click();
  await expect(page.getByRole("heading", { name: "Owned-company overview" })).toBeFocused();
  await expect(page).toHaveURL("/?lab=player&player=player-1");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBe(0);
  expect(api.externalRequests).toEqual([]);
});

test("@journey #106 retry after a search failure never reports prior matches as completed", async ({
  page,
}) => {
  const api = await installApiMocks(page);
  await page.goto("/?lab=player");
  await page.getByLabel("WarEra player name").fill("Planner");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("Search complete · 1 match found")).toBeVisible();
  await page.getByRole("button", { name: /Planner Level 12/ }).click();
  await expect(page.getByText("Public snapshot imported: Planner")).toBeVisible();

  api.searchMode = "rate-limit";
  await page.getByLabel("WarEra player name").fill("Another player");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(/rate limit reached/i);
  await expect(page.locator(".search-completion")).toHaveCount(0);
  await expect(page.locator(".search-results")).toHaveCount(0);
  await expect(page.locator(".active-context")).toContainText("Current player: Planner");

  api.searchMode = "empty";
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("Search complete · 0 matches found")).toBeVisible();
  await expect(page.getByRole("heading", { name: "0 matches" })).toBeVisible();
  await expect(page.locator(".active-context")).toContainText("Current player: Planner");
  expect(api.externalRequests).toEqual([]);
});

test("@journey #106 importing another result does not repeat a previous success on failure", async ({
  page,
}) => {
  const api = await installApiMocks(page);
  await page.route("**/api/players/search", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          query: "Planner",
          matches: [
            { id: "player-1", username: "Planner", countryId: "country-1", level: 12 },
            { id: "player-2", username: "Second Player", countryId: "country-1", level: 17 },
          ],
          truncated: false,
          freshness: { generatedAt: "2026-10-12T12:00:00.000Z", hasStaleData: false, sources: [] },
        },
      }),
    });
  });
  await page.goto("/?lab=player");
  await page.getByLabel("WarEra player name").fill("Planner");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("Search complete · 2 matches found")).toBeVisible();

  await page.getByRole("button", { name: /Planner Level 12/ }).click();
  await expect(page.getByText("Public snapshot imported: Planner")).toBeVisible();

  await page.route("**/api/players/snapshot", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "UPSTREAM_UNAVAILABLE",
          message: "WarEra is temporarily unavailable. Try again shortly.",
        },
      }),
    });
  });
  await page.getByRole("button", { name: /Second Player Level 17/ }).click();
  await expect(page.locator(".search-completion--success")).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText(/temporarily unavailable/i);
  await expect(page.locator(".search-completion--success")).toHaveCount(0);
  await expect(page.locator(".active-context")).toContainText("Current player: Planner");
  expect(api.externalRequests).toEqual([]);
});

test("@journey #106 company and Economy deep links expose exact selected context and keep URL", async ({
  page,
}) => {
  const api = await installApiMocks(page);
  api.duplicateCompanies = true;
  await page.goto("/?lab=company&player=player-1&company=company-duplicate-2");
  const summary = page.locator(".active-context");
  await expect(summary).toContainText(/Iron Inc \(Company .*\)/);
  await summary.getByRole("button", { name: "Inspect company" }).click();
  await expect(page.getByRole("heading", { name: "Iron Inc" }).last()).toBeFocused();
  await expect(page).toHaveURL("/?lab=company&player=player-1&company=company-duplicate-2");

  await page.goto("/?lab=economy&player=player-1&company=company-duplicate-2");
  await expect(summary).toContainText(/Iron Inc \(Company .*\)/);
  await summary.getByRole("button", { name: "Open scenario workspace" }).click();
  await expect(page.getByRole("heading", { name: "Scenario workspace" })).toBeFocused();
  await expect(page).toHaveURL("/?lab=economy&player=player-1&company=company-duplicate-2");
  expect(api.externalRequests).toEqual([]);
});

test("@journey #106 Economy context summary detaches retained scenario on failed company switch", async ({
  page,
}) => {
  const api = await installApiMocks(page);
  api.duplicateCompanies = true;
  await page.goto("/?lab=economy&player=player-1&company=company-1");

  const summary = page.locator(".active-context");
  await expect(summary).toContainText(/Iron Inc \(Company .*1\)/);
  await expect(summary.getByRole("button", { name: "Open scenario workspace" })).toBeVisible();

  api.economyContextMode = "unavailable";
  await page.locator(".company-card").filter({ hasText: "Iron Inc" }).last().click();
  await expect(summary).toContainText(/Iron Inc \(Company .*\)/);
  await expect(summary).toContainText("A scenario from a different company");
  await expect(summary.getByRole("button", { name: "Open scenario workspace" })).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText(/temporarily unavailable/i);
  await expect(page).toHaveURL(/company=company-duplicate-2/);

  api.economyContextMode = "ok";
  await page.locator(".company-card").filter({ hasText: "Iron Inc" }).first().click();
  await expect(summary.getByRole("button", { name: "Open scenario workspace" })).toBeVisible();
  await expect(summary).not.toContainText("different company");
  expect(api.externalRequests).toEqual([]);
});

test("@journey #106 Economy retains live-derived origin after last company is removed", async ({
  page,
}) => {
  const api = await installApiMocks(page);
  await page.goto("/?lab=economy&player=player-1&company=company-1");

  const summary = page.locator(".active-context");
  await expect(summary).toContainText("Company · Planner Steel");
  await expect(summary.getByRole("button", { name: "Open scenario workspace" })).toBeVisible();

  await page.route("**/api/players/snapshot", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { ...snapshotResponse, companies: [] },
      }),
    });
  });
  await page.getByRole("button", { name: "Refresh snapshot" }).click();
  await expect(summary).toContainText("previously live-derived scenario");
  await expect(summary).toContainText("detached from its former live company context");
  await expect(summary).not.toContainText("Portable what-if scenario");
  await expect(summary).not.toContainText("Company · Planner Steel");
  await expect(summary.getByRole("button", { name: "Open scenario workspace" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Scenario workspace" })).toBeVisible();
  await expect(page).toHaveURL("/?lab=economy&player=player-1");
  expect(api.externalRequests).toEqual([]);
});

test("@a11y #106 Market selected item is discoverable at 390/320 with truthful linked IDs", async ({
  page,
}) => {
  const api = await installApiMocks(page);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/?lab=market&player=player-1&company=company-duplicate-2&item=iron");
    const summary = page.locator(".active-context");
    await expect(summary).toContainText("Item requested: iron");
    await expect(summary).toContainText("not verified by Market Lab");
    await expect(summary).not.toContainText("Iron Inc");
    await summary.getByRole("button", { name: "Inspect selected item" }).click();
    await expect(page.getByRole("heading", { name: "iron", exact: true })).toBeFocused();
    await expect(page).toHaveURL(
      "/?lab=market&player=player-1&company=company-duplicate-2&item=iron",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.goto("/?lab=market&item=steel");
  await expect(page.locator(".active-context")).not.toContainText("Linked player ID");
  expect(api.externalRequests).toEqual([]);
});
