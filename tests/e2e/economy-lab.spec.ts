import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { importPlannerWorkspace, installApiMocks, productionSelect } from "./fixtures.js";

test("@journey complete MVP flow preserves hypotheticals across refresh and failures", async ({
  page,
}) => {
  const state = await installApiMocks(page);
  await importPlannerWorkspace(page);

  await expect(page.getByRole("heading", { name: "Planner" })).toBeVisible();
  await expect(page.getByText("Observed snapshot")).toBeVisible();
  await expect(page.getByText("Current snapshot").first()).toBeVisible();

  const production = productionSelect(page);
  await production.selectOption("2");
  await page.getByLabel(/Output price override/).fill("12");

  await expect(
    page.locator(".comparison-list").filter({ hasText: "Skill · production" }),
  ).toContainText("1 → 2");
  await expect(page.getByLabel("Derived output changes")).toContainText("Gross margin Δ");

  await page.getByText("How is this calculated?").click();
  await expect(page.locator("dd").filter({ hasText: "fnv1a-testcfg-123" })).toBeVisible();
  await expect(page.locator("dd").filter({ hasText: "skill-planner-v1" })).toBeVisible();

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
