import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { installApiMocks } from "./fixtures.js";

const horizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const browserStorage = (page: Page) =>
  page.evaluate(async () => ({
    localStorage: Object.keys(window.localStorage),
    sessionStorage: Object.keys(window.sessionStorage),
    indexedDatabases: (await window.indexedDB.databases()).map((database) => database.name),
  }));

test("@journey Player Lab stale and rate-limited snapshot stays usable without polling or persistence", async ({
  page,
}) => {
  const api = await installApiMocks(page);
  api.staleSnapshot = true;
  await page.clock.install();
  await page.goto("/?lab=player&player=player-1");
  await expect(page.getByRole("heading", { name: "Planner", exact: true })).toBeVisible();
  await expect(page.getByText(/Some public data is stale/)).toBeVisible();
  await expect(page.getByText("Contains stale data")).toBeVisible();
  await expect(page.getByText(/Company-to-output association may be stale/i).first()).toBeVisible();

  api.snapshotMode = "rate-limit";
  await page.getByRole("button", { name: "Refresh snapshot" }).click();
  await expect(page.getByRole("alert")).toContainText(/rate limit reached/i);
  await expect(page.getByRole("heading", { name: "Planner", exact: true })).toBeVisible();

  const before = api.apiRequestDetails.length;
  await page.clock.fastForward(300_000);
  expect(api.apiRequestDetails).toHaveLength(before);

  api.snapshotMode = "unavailable";
  await page.getByRole("button", { name: "Refresh snapshot" }).click();
  await expect(page.getByRole("alert")).toContainText(/temporarily unavailable/i);
  await expect(page.getByRole("heading", { name: "Planner", exact: true })).toBeVisible();

  api.snapshotMode = "ok";
  api.staleSnapshot = false;
  await page.getByRole("button", { name: "Refresh snapshot" }).click();
  await expect(page.getByText("Public player snapshot refreshed.")).toBeVisible();
  await expect(page.getByText(/Some public data is stale/)).toHaveCount(0);
  expect(
    api.apiRequestDetails.every(
      ({ method, pathname, origin }) =>
        method === "POST" &&
        pathname === "/api/players/snapshot" &&
        origin === new URL(page.url()).origin,
    ),
  ).toBe(true);
  expect(api.economyContextItemCodes).toEqual([]);
  expect(api.externalRequests).toEqual([]);
  expect(await browserStorage(page)).toEqual({
    localStorage: [],
    sessionStorage: [],
    indexedDatabases: [],
  });
});

test("@journey Player Lab handoffs discard portable scenario fragments and preserve exact company", async ({
  page,
}) => {
  const api = await installApiMocks(page);
  api.duplicateCompanies = true;
  await page.goto("/?lab=player&player=player-1#wl=not-a-player-state");
  const portfolio = page.getByRole("region", { name: "Owned-company overview" });
  const second = portfolio
    .getByRole("link", {
      name: /Model Iron Inc \(Company .*\) in Economy Lab/,
    })
    .nth(1);
  await expect(second).toHaveAttribute(
    "href",
    "/?lab=economy&player=player-1&company=company-duplicate-2",
  );
  const links = await page
    .locator(".player-lab a[href]")
    .evaluateAll((anchors) => anchors.map((anchor) => (anchor as HTMLAnchorElement).href));
  expect(links.every((href) => !href.includes("#wl="))).toBe(true);
  await second.click();
  await expect(page).toHaveURL("/?lab=economy&player=player-1&company=company-duplicate-2");
  await expect(page.getByRole("heading", { name: "Scenario workspace" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Planner", exact: true })).toBeVisible();
  expect(api.externalRequests).toEqual([]);
});

test("@a11y twelve-company Player Lab at 320px supports keyboard handoff, focus, and named links", async ({
  page,
}) => {
  const api = await installApiMocks(page);
  api.largePortfolio = true;
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/?lab=player&player=player-1");
  const portfolio = page.getByRole("region", { name: "Owned-company overview" });
  await expect(portfolio.locator(".player-portfolio__card")).toHaveCount(12);
  const first = portfolio
    .getByRole("link", { name: /Inspect Steel Inc .* in Company Lab/ })
    .first();
  await first.focus();
  await expect(first).toBeFocused();
  const focusVisible = await first.evaluate((link) => {
    const style = getComputedStyle(link);
    return style.outlineStyle !== "none" && style.outlineWidth !== "0px";
  });
  expect(focusVisible).toBe(true);
  await page.keyboard.press("Tab");
  await expect(
    portfolio.getByRole("link", { name: /Model Steel Inc .* in Economy Lab/ }).first(),
  ).toBeFocused();

  expect(await horizontalOverflow(page)).toBe(0);
  const skillNamesDoNotWrapMidWord = await page
    .locator(".player-profile__skills dt")
    .evaluateAll((names) =>
      names.every((name) => {
        const range = document.createRange();
        range.selectNodeContents(name);
        return range.getClientRects().length === 1;
      }),
    );
  expect(skillNamesDoNotWrapMidWord).toBe(true);
  const accessibility = await new AxeBuilder({ page })
    .include(".player-lab")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await first.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/lab=company&player=player-1&company=steel-algarve-1/);
  expect(api.externalRequests).toEqual([]);
});

test("@visual Player Lab public profile, outputs, and contextual handoffs", async ({ page }) => {
  await installApiMocks(page);
  await page.goto("/?lab=player&player=player-1");
  await expect(page.getByRole("heading", { name: "Planner", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Owned-company overview" })).toContainText(
    "Company outputs are not player-owned inventory balances.",
  );
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  if (test.info().project.name === "visual-reduced-motion") {
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(
      true,
    );
    const duration = await page
      .locator(".player-portfolio__actions a")
      .first()
      .evaluate((link) => {
        const style = getComputedStyle(link);
        return [style.transitionDuration, style.animationDuration];
      });
    expect(duration).toEqual(["1e-05s", "1e-05s"]);
  }
  await expect(page).toHaveScreenshot("player-lab-loaded.png", { fullPage: true, timeout: 15_000 });
});

test("@visual Player Lab upstream-unavailable state", async ({ page }) => {
  await installApiMocks(page);
  await page.route("**/api/players/snapshot", async (route) => {
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
  await page.goto("/?lab=player&player=player-1");
  await expect(page.getByText(/temporarily unavailable/i).first()).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  await expect(page).toHaveScreenshot("player-lab-unavailable.png", {
    fullPage: true,
    timeout: 15_000,
  });
});

test("@visual Player Lab realistic twelve-company and duplicate-name portfolio", async ({
  page,
}) => {
  const api = await installApiMocks(page);
  api.largePortfolio = true;
  await page.goto("/?lab=player&player=player-1");
  const portfolio = page.getByRole("region", { name: "Owned-company overview" });
  await expect(portfolio.locator(".player-portfolio__card")).toHaveCount(12);
  await expect(portfolio.locator(".player-portfolio__identifier").first()).toBeVisible();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  await expect(page).toHaveScreenshot("player-lab-twelve-companies.png", {
    fullPage: true,
    timeout: 15_000,
  });
});
