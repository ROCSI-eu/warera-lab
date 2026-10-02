import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import {
  importPlannerWorkspace,
  installApiMocks,
  longOpaqueCountryId,
  productionSelect,
} from "./fixtures.js";

test("@journey complete MVP flow preserves hypotheticals across refresh and failures", async ({
  page,
}) => {
  const state = await installApiMocks(page);
  await importPlannerWorkspace(page);

  await expect(page.getByRole("heading", { name: "Planner" })).toBeVisible();
  await expect(page.getByText("Observed snapshot")).toBeVisible();
  await expect(page.getByText("Current snapshot").first()).toBeVisible();
  await expect(page.getByText(/View source details/).first()).toBeVisible();
  await expect(page.locator(".freshness-list").first()).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Export JSON" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy share link" })).toBeVisible();
  await expect(page.getByLabel("JSON export")).not.toBeVisible();

  const production = productionSelect(page);
  await production.selectOption("2");
  await page.getByLabel(/Output price override/).fill("12");

  await expect(
    page.locator(".comparison-list").filter({ hasText: "Skill · production" }),
  ).toContainText("1 → 2");
  await expect(page.getByLabel("Derived output changes")).toContainText("Gross margin Δ");

  await page.getByText("How is this calculated?").click();
  await expect(page.getByText(/Production level 2/)).toBeVisible();
  await expect(page.getByText(/steel · quantity 1/)).toBeVisible();
  await expect(page.locator("dd").filter({ hasText: "fnv1a-testcfg-123" })).toBeVisible();
  await expect(page.locator("dd").filter({ hasText: "skill-planner-v1" })).toBeVisible();
  await expect(page.locator(".calculation-details .raw-details")).not.toHaveAttribute("open", "");

  await page.locator(".transfer-advanced > summary").click();
  const exportedJson = await page.getByLabel("JSON export").inputValue();
  expect(exportedJson).toContain('"production":2');
  expect(exportedJson).not.toContain("player-1");
  expect(exportedJson).not.toContain('"username":"Planner"');

  await page.getByRole("button", { name: "Put scenario in URL" }).click();
  await expect(page).toHaveURL(/#wl=/);

  // Re-importing the same live workspace refreshes the observed baseline/context
  // without silently discarding Scenario A/B hypotheticals.
  await page.getByLabel("WarEra player name").fill("Planner");
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("button", { name: /Planner Level 12/ }).click();
  await expect(productionSelect(page)).toHaveValue("2");

  state.searchMode = "rate-limit";
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByText(/rate limit reached/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Planner" })).toBeVisible();
  await expect(productionSelect(page)).toHaveValue("2");

  state.searchMode = "ok";
  state.snapshotMode = "unavailable";
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("button", { name: /Planner Level 12/ }).click();
  await expect(page.getByText(/temporarily unavailable/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Planner" })).toBeVisible();
  await expect(productionSelect(page)).toHaveValue("2");

  state.snapshotMode = "ok";
  state.staleSnapshot = true;
  await page.getByRole("button", { name: /Planner Level 12/ }).click();
  await expect(page.getByText(/Some imported values are stale/i)).toBeVisible();
  await expect(page.getByText("Stale").first()).toBeVisible();
  await expect(productionSelect(page)).toHaveValue("2");

  state.searchMode = "empty";
  await page.getByLabel("WarEra player name").fill("Nobody");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("heading", { name: "0 matches" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Planner" })).toBeVisible();

  expect(state.apiRequests.length).toBeGreaterThan(0);
  expect(state.externalRequests).toEqual([]);
  for (const url of state.apiRequests) {
    expect(new URL(url).origin).toBe("http://127.0.0.1:4173");
  }
});

test("@journey public shell prioritizes search and exposes project context", async ({ page }) => {
  await page.goto("/");

  const searchHeading = page.getByRole("heading", { name: "Find a player" });
  await expect(searchHeading).toBeVisible();

  const viewport = page.viewportSize();
  const searchBox = await searchHeading.boundingBox();
  expect(viewport).not.toBeNull();
  expect(searchBox).not.toBeNull();
  expect(searchBox!.y).toBeLessThan(viewport!.height);

  if (viewport!.width >= 1000) {
    expect(searchBox!.y).toBeLessThan(620);
  }

  const projectLinks = page.getByRole("navigation", { name: "Project links" });
  await expect(projectLinks.getByRole("link", { name: "GitHub repository" })).toHaveAttribute(
    "href",
    "https://github.com/ROCSI-eu/warera-lab",
  );
  await expect(projectLinks.getByRole("link", { name: "ROCSI website" })).toHaveAttribute(
    "href",
    "https://rocsi.eu/",
  );
  await expect(projectLinks.getByRole("link", { name: "AGPL-3.0 license" })).toHaveAttribute(
    "href",
    "https://github.com/ROCSI-eu/warera-lab/blob/main/LICENSE",
  );
  await expect(projectLinks.getByRole("link", { name: "Notices" })).toHaveAttribute(
    "href",
    "https://github.com/ROCSI-eu/warera-lab/blob/main/NOTICE.md",
  );
  await expect(
    page.getByText(/Not affiliated with, endorsed by, sponsored by, or operated by WarEra/i),
  ).toBeVisible();
});

test("@journey player search hides opaque IDs and fits exact 320 px before and after import", async ({
  page,
}) => {
  await installApiMocks(page);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");

  await page.getByLabel("WarEra player name").fill("Planner");
  const searchButton = page.getByRole("button", { name: "Search" });
  await searchButton.click();

  const resultButton = page.getByRole("button", { name: /Planner Level 12/ });
  await expect(resultButton).toBeVisible();
  await expect(resultButton).not.toContainText(longOpaqueCountryId);
  await expect(resultButton).not.toContainText(/country/i);

  const searchOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(searchOverflow).toBe(0);

  await searchButton.focus();
  await page.keyboard.press("Tab");
  await expect(resultButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Planner" })).toBeVisible();

  const loadedOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(loadedOverflow).toBe(0);
});

test("@journey duplicate company names remain unambiguous before and after selection", async ({
  page,
}) => {
  const state = await installApiMocks(page);
  state.duplicateCompanies = true;
  await importPlannerWorkspace(page);

  const companies = page.locator(".company-card").filter({ hasText: "Iron Inc" });
  await expect(companies).toHaveCount(2);
  await expect(companies.nth(0)).toContainText("Prahova · Romania");
  await expect(companies.nth(0)).toContainText("2 workers · Production 24");
  await expect(companies.nth(1)).toContainText("Cluj · Romania");
  await expect(companies.nth(1)).toContainText("4 workers · Production 31");
  await expect(companies.nth(0)).not.toContainText("ID ");
  await expect(companies.nth(1)).not.toContainText("ID ");

  await companies.nth(1).click();
  await expect(companies.nth(0)).toHaveAttribute("aria-pressed", "false");
  await expect(companies.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".company-detail")).toContainText("Cluj");
  await expect(page.locator(".company-detail")).toContainText("31");
  await expect(page.locator(".company-detail")).toContainText("4");

  await page.setViewportSize({ width: 320, height: 800 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("@journey shared scenario reloads without a live player lookup", async ({ page }) => {
  const state = await installApiMocks(page);
  await importPlannerWorkspace(page);
  await productionSelect(page).selectOption("2");
  await page.getByRole("button", { name: "Put scenario in URL" }).click();

  const sharedUrl = page.url();
  expect(sharedUrl).toContain("#wl=");
  state.apiRequests.length = 0;
  await page.reload();

  await expect(page.getByText(/Shared scenario imported from the URL/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Scenario workspace" })).toBeVisible();
  await expect(
    page.getByText(/Live player\/company context is not attached/i).first(),
  ).toBeVisible();
  expect(state.apiRequests).toEqual([]);

  await page.locator(".transfer-advanced > summary").click();
  const json = await page.getByLabel("JSON export").inputValue();
  expect(json).toContain('"production":2');
  expect(json).not.toContain("player-1");
});

test("@a11y integrated workspace has no automated axe violations and visible keyboard focus", async ({
  page,
}) => {
  await installApiMocks(page);
  await importPlannerWorkspace(page);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);

  async function expectKeyboardFocusRing(locator: ReturnType<typeof page.locator>) {
    await locator.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(locator).toBeFocused();
    expect(
      await locator.evaluate((element) => {
        const style = getComputedStyle(element);
        return style.outlineStyle !== "none" && style.outlineWidth !== "0px";
      }),
    ).toBe(true);
  }

  await expectKeyboardFocusRing(page.getByRole("button", { name: "Scenario B" }));
  await expectKeyboardFocusRing(page.getByLabel("Comparison pair"));
  await page.locator(".scenario-import-details > summary").click();
  await expectKeyboardFocusRing(page.getByLabel("Import scenario JSON"));

  await expect(page.getByText("observed").first()).toBeVisible();
  await expect(page.getByText("derived").first()).toBeVisible();
  await expect(page.getByText("Live").first()).toBeVisible();
});

test("@a11y invalid share and empty states remain understandable", async ({ page }) => {
  const state = await installApiMocks(page);
  state.searchMode = "empty";
  await page.goto("/#wl=%E0%A4%A");
  await expect(page.getByText(/share fragment is malformed/i)).toBeVisible();

  await page.getByLabel("WarEra player name").fill("Nobody");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("heading", { name: "0 matches" })).toBeVisible();
  await expect(page.getByText(/Economy Lab starts with an imported snapshot/i)).toBeVisible();
});

test("@visual representative loaded Economy Lab", async ({ page }) => {
  await installApiMocks(page);
  await importPlannerWorkspace(page);
  await productionSelect(page).selectOption("2");
  await page.getByLabel(/Output price override/).fill("12");
  await page.getByText("How is this calculated?").click();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  const reduced = await page.evaluate(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  if (test.info().project.name === "visual-reduced-motion") {
    expect(reduced).toBe(true);
  }

  await expect(page).toHaveScreenshot("economy-lab-release-candidate.png", {
    fullPage: true,
  });
});
