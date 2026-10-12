import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { installApiMocks } from "./fixtures.js";

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
