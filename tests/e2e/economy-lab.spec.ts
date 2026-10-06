import { readFileSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import {
  importPlannerWorkspace,
  installApiMocks,
  longOpaqueCountryId,
  productionSelect,
} from "./fixtures.js";

const releaseVersion = readFileSync(new URL("../../VERSION", import.meta.url), "utf8").trim();

test("@journey complete MVP flow preserves hypotheticals across refresh and failures", async ({
  page,
}) => {
  const state = await installApiMocks(page);
  await importPlannerWorkspace(page);

  await expect(page.getByRole("heading", { name: "Planner", exact: true })).toBeVisible();
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

  const refreshButton = page.getByRole("button", { name: "Refresh snapshot" });
  await expect(refreshButton).toBeVisible();
  const availableSkillPoints = page
    .locator(".metric-grid article")
    .filter({ hasText: "Available skill points" })
    .locator("strong");

  const snapshotFreshness = page
    .locator(".freshness-panel")
    .filter({ has: page.getByRole("heading", { name: "Snapshot freshness" }) });
  const contextFreshness = page
    .locator(".freshness-panel")
    .filter({ has: page.getByRole("heading", { name: "Economy context freshness" }) });
  const snapshotFreshnessBefore = await snapshotFreshness.locator(".freshness-summary").innerText();
  const contextFreshnessBefore = await contextFreshness.locator(".freshness-summary").innerText();
  const searchRequestsBefore = state.apiRequests.filter(
    (url) => new URL(url).pathname === "/api/players/search",
  ).length;

  state.snapshotRevision = 1;
  await refreshButton.click();
  await expect(page.getByText(/Scenario A\/B inputs were preserved/i)).toBeVisible();
  await expect(productionSelect(page)).toHaveValue("2");
  await expect(page.getByLabel(/Output price override/)).toHaveValue("12");
  await expect(availableSkillPoints).toHaveText("6");
  expect(await snapshotFreshness.locator(".freshness-summary").innerText()).not.toBe(
    snapshotFreshnessBefore,
  );
  expect(await contextFreshness.locator(".freshness-summary").innerText()).not.toBe(
    contextFreshnessBefore,
  );
  expect(
    state.apiRequests.filter((url) => new URL(url).pathname === "/api/players/search").length,
  ).toBe(searchRequestsBefore);

  state.snapshotMode = "rate-limit";
  await refreshButton.click();
  await expect(page.getByText(/rate limit reached/i)).toBeVisible();
  await expect(page.getByText(/Suggested retry: in about 60 seconds/i)).toBeVisible();
  await expect(availableSkillPoints).toHaveText("6");
  await expect(productionSelect(page)).toHaveValue("2");
  await expect(page.getByLabel(/Output price override/)).toHaveValue("12");

  state.snapshotMode = "ok";
  state.snapshotRevision = 2;
  state.economyContextMode = "unavailable";
  await refreshButton.click();
  await expect(page.getByText(/Economy context is temporarily unavailable/i)).toBeVisible();
  await expect(availableSkillPoints).toHaveText("6");
  await expect(productionSelect(page)).toHaveValue("2");
  await expect(page.getByLabel(/Output price override/)).toHaveValue("12");

  state.economyContextMode = "ok";
  state.staleSnapshot = true;
  await refreshButton.click();
  await expect(page.getByText(/Some imported values are stale/i)).toBeVisible();
  await expect(page.getByText("Stale").first()).toBeVisible();
  await expect(availableSkillPoints).toHaveText("7");
  await expect(productionSelect(page)).toHaveValue("2");

  state.searchMode = "empty";
  await page.getByLabel("WarEra player name").fill("Nobody");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("heading", { name: "0 matches" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Planner", exact: true })).toBeVisible();

  expect(state.apiRequests.length).toBeGreaterThan(0);
  expect(state.externalRequests).toEqual([]);
  for (const url of state.apiRequests) {
    expect(new URL(url).origin).toBe("http://127.0.0.1:4173");
  }
});

test("@journey refresh falls back safely when the selected company disappears", async ({
  page,
}) => {
  const state = await installApiMocks(page);
  state.duplicateCompanies = true;
  await page.setViewportSize({ width: 320, height: 800 });
  await importPlannerWorkspace(page);

  const companies = page.locator(".company-card").filter({ hasText: "Iron Inc" });
  await expect(companies).toHaveCount(2);
  await companies.nth(1).click();
  await expect(companies.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".company-detail")).toContainText("Cluj");

  await productionSelect(page).selectOption("2");
  await page.getByLabel(/Output price override/).fill("12");
  await expect(productionSelect(page)).toHaveValue("2");

  const refreshButton = page.getByRole("button", { name: "Refresh snapshot" });
  const overflowBeforeRefresh = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflowBeforeRefresh).toBe(0);

  state.snapshotRevision = 1;
  await refreshButton.focus();
  await expect(refreshButton).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByText(/Scenario A\/B inputs were preserved/i)).toBeVisible();
  await expect(companies.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".company-detail")).toContainText("Cluj");
  await expect(productionSelect(page)).toHaveValue("2");
  await expect(page.getByLabel(/Output price override/)).toHaveValue("12");

  state.snapshotRevision = 2;
  state.removedCompanyId = "company-duplicate-2";
  await refreshButton.click();

  await expect(page.getByText(/previously selected company is no longer available/i)).toBeVisible();
  await expect(page.getByText(/reset scenarios to its observed baseline/i)).toBeVisible();

  const remainingCompany = page.locator(".company-card").filter({ hasText: "Iron Inc" });
  await expect(remainingCompany).toHaveCount(1);
  await expect(remainingCompany).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".company-detail")).toContainText("Prahova");
  await expect(page.locator(".company-detail")).toContainText("24");
  await expect(page.locator(".company-detail")).toContainText("2");
  await expect(productionSelect(page)).toHaveValue("1");
  await expect(page.getByLabel(/Output price override/)).toHaveValue("");

  const upgradePanel = page
    .locator(".scenario-workspace .planner-panel")
    .filter({ has: page.getByRole("heading", { name: "Company upgrades" }) });
  await expect(upgradePanel).toContainText("Observed level 1");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test("@journey Company Lab restores player and company context through reload and browser history", async ({
  page,
}) => {
  const state = await installApiMocks(page);
  await page.setViewportSize({ width: 320, height: 800 });

  await page.goto("/?lab=company&player=player-1&company=company-1");

  const labNavigation = page.getByRole("navigation", { name: "WarEra Lab modules" });
  const companyLabLink = labNavigation.getByRole("link", { name: "Company Lab" });
  const economyLabLink = labNavigation.getByRole("link", { name: "Economy Lab" });
  const selectedCompany = page.getByRole("button", { name: /Planner Steel/ });

  await expect(companyLabLink).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Planner", exact: true })).toBeVisible();
  await expect(selectedCompany).toHaveAttribute("aria-pressed", "true");
  const overview = page.locator(".company-snapshot-overview");
  await expect(overview.getByRole("heading", { name: "Planner Steel" })).toBeVisible();
  await expect(overview).toContainText("Owned by Planner · Level 12");
  await expect(overview).toContainText("Prahova");
  await expect(overview).toContainText("Romania");
  await expect(overview).toContainText("Observed production");
  await expect(overview).toContainText("24");
  await expect(overview).toContainText("Workers");
  await expect(overview).toContainText("2");
  await expect(overview).toContainText("Automated Engine: level 1");
  await expect(overview.getByRole("heading", { name: "Snapshot freshness" })).toBeVisible();
  await expect(page).toHaveURL(/lab=company.*player=player-1.*company=company-1/);
  expect(state.apiRequests.some((url) => new URL(url).pathname === "/api/economy/context")).toBe(
    false,
  );

  state.apiRequests.length = 0;
  await page.reload();
  await expect(page.getByRole("heading", { name: "Planner", exact: true })).toBeVisible();
  await expect(selectedCompany).toHaveAttribute("aria-pressed", "true");
  expect(state.apiRequests.some((url) => new URL(url).pathname === "/api/players/snapshot")).toBe(
    true,
  );
  expect(state.apiRequests.some((url) => new URL(url).pathname === "/api/economy/context")).toBe(
    false,
  );

  await economyLabLink.click();
  await expect(page.getByRole("heading", { name: "Scenario workspace" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "WarEra Lab modules" }).getByRole("link", {
      name: "Economy Lab",
    }),
  ).toHaveAttribute("aria-current", "page");

  await page.goBack();
  await expect(
    page.getByRole("navigation", { name: "WarEra Lab modules" }).getByRole("link", {
      name: "Company Lab",
    }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: /Planner Steel/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);

  const accessibility = await new AxeBuilder({ page }).include(".company-lab-entry").analyze();
  expect(accessibility.violations).toEqual([]);

  await page.goForward();
  await expect(page.getByRole("heading", { name: "Scenario workspace" })).toBeVisible();
});

test("@journey invalid Company Lab links recover into usable player and company selection", async ({
  page,
}) => {
  const state = await installApiMocks(page);

  await page.goto("/?lab=company&player=player-1&company=missing-company");
  await expect(page.getByText(/company from this link is no longer available/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Planner Steel/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page).toHaveURL(/lab=company.*player=player-1.*company=company-1/);

  state.apiRequests.length = 0;
  await page.goto("/?lab=company&company=orphan-company");
  await expect(page.getByText(/company link also needs a player context/i)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Choose a player to establish company context" }),
  ).toBeVisible();
  expect(state.apiRequests.some((url) => new URL(url).pathname === "/api/players/snapshot")).toBe(
    false,
  );
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

  await expect(page.getByText(releaseVersion, { exact: true })).toBeVisible();

  const projectLinks = page.getByRole("navigation", { name: "Project links" });
  await expect(projectLinks.getByRole("link", { name: "GitHub repository" })).toHaveAttribute(
    "href",
    "https://github.com/ROCSI-eu/warera-lab",
  );
  await expect(projectLinks.getByRole("link", { name: "Changelog" })).toHaveAttribute(
    "href",
    "https://github.com/ROCSI-eu/warera-lab/blob/main/CHANGELOG.md",
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
  await expect(page.getByRole("heading", { name: "Planner", exact: true })).toBeVisible();

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

test("@journey nine-company portfolio stays compact and unambiguous at 320 px", async ({
  page,
}) => {
  const state = await installApiMocks(page);
  state.largePortfolio = true;
  await page.setViewportSize({ width: 320, height: 800 });
  await importPlannerWorkspace(page, "MihaiROCSI");

  const companies = page.locator(".company-card");
  await expect(companies).toHaveCount(9);

  const steelCompanies = companies.filter({ hasText: "Steel Inc" });
  await expect(steelCompanies).toHaveCount(2);
  await expect(steelCompanies.nth(0)).toContainText("steel · Algarve · Portugal");
  await expect(steelCompanies.nth(0)).toContainText("1 worker · Production 1.73");
  await expect(steelCompanies.nth(1)).toContainText("steel · Algarve · Portugal");
  await expect(steelCompanies.nth(1)).toContainText("0 workers · Production 4.99");
  await expect(steelCompanies.nth(0)).not.toContainText("ID ");
  await expect(steelCompanies.nth(1)).not.toContainText("ID ");

  const selectorBox = await page.locator(".company-list").boundingBox();
  expect(selectorBox).not.toBeNull();
  expect(selectorBox!.height).toBeLessThan(892.08);

  await expect(steelCompanies.nth(0).locator(".company-card__upgrades")).not.toBeVisible();
  await steelCompanies.nth(1).focus();
  await expect(steelCompanies.nth(1)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(steelCompanies.nth(0)).toHaveAttribute("aria-pressed", "false");
  await expect(steelCompanies.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".company-detail")).toContainText("4.99");
  await expect(page.locator(".company-detail")).toContainText("0");

  const storageControl = page
    .locator(".scenario-workspace .planner-control")
    .filter({ has: page.getByText("Storage", { exact: true }) });
  await expect(storageControl).toContainText("Observed level 2");

  const scenarioBox = await page.getByRole("heading", { name: "Scenario workspace" }).boundingBox();
  expect(scenarioBox).not.toBeNull();
  expect(scenarioBox!.y).toBeLessThan(4800);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);

  const accessibility = await new AxeBuilder({ page }).include(".company-list").analyze();
  expect(accessibility.violations).toEqual([]);
});

test("@journey shared scenario reloads without a live player lookup", async ({ page }) => {
  const state = await installApiMocks(page);
  await importPlannerWorkspace(page);
  await productionSelect(page).selectOption("2");
  await page.getByRole("button", { name: "Put scenario in URL" }).click();

  const sharedUrl = page.url();
  expect(sharedUrl).toContain("#wl=");
  expect(new URL(sharedUrl).search).toBe("");
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

  const mixedUrl = new URL(sharedUrl);
  mixedUrl.search = "?lab=company&player=player-1&company=company-1";
  state.apiRequests.length = 0;
  await page.goto(mixedUrl.toString());

  await expect(page.getByText(/Shared scenario imported from the URL/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Scenario workspace" })).toBeVisible();
  const mixedNavigation = page.getByRole("navigation", { name: "WarEra Lab modules" });
  await expect(mixedNavigation.getByRole("link", { name: "Economy Lab" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  const companyLabHref = await mixedNavigation
    .getByRole("link", { name: "Company Lab" })
    .getAttribute("href");
  expect(companyLabHref).not.toContain("player=");
  expect(companyLabHref).not.toContain("company=");
  expect(companyLabHref).not.toContain("#wl=");
  expect(new URL(page.url()).search).toBe("");
  expect(state.apiRequests).toEqual([]);
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

  await expectKeyboardFocusRing(page.getByRole("button", { name: "Refresh snapshot" }));
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

test("@visual release footer", async ({ page }) => {
  await page.goto("/");

  const footer = page.locator(".site-footer");
  await expect(footer).toContainText(releaseVersion);
  await expect(footer).toHaveScreenshot("release-footer.png");
});

test("@visual nine-company selector", async ({ page }) => {
  const state = await installApiMocks(page);
  state.largePortfolio = true;
  await importPlannerWorkspace(page, "MihaiROCSI");

  if (test.info().project.name === "visual-320") {
    const selectorBox = await page.locator(".company-list").boundingBox();
    expect(selectorBox).not.toBeNull();
    expect(selectorBox!.height).toBeLessThan(892.08);
  }

  const firstUpgradeSummary = page.locator(".company-card__upgrades").first();
  if ((page.viewportSize()?.width ?? 0) >= 1000) {
    await expect(firstUpgradeSummary).toBeVisible();
  } else {
    await expect(firstUpgradeSummary).not.toBeVisible();
  }

  const companiesPanel = page
    .locator(".workspace-panel")
    .filter({ has: page.getByRole("heading", { name: "Companies" }) });
  await expect(companiesPanel).toHaveScreenshot("company-selector-nine-companies.png");
});

test("@visual refresh snapshot control", async ({ page }) => {
  await installApiMocks(page);
  await importPlannerWorkspace(page);

  const workspaceHeader = page.locator(".workspace > .workspace-heading");
  await expect(workspaceHeader).toHaveScreenshot("refresh-snapshot-control.png");
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
    timeout: 15_000,
  });
});
