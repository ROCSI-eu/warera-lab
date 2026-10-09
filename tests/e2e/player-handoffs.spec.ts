import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { installApiMocks, snapshotResponse } from "./fixtures.js";

test("@journey Player Lab linked company loads Company and Economy context, survives Back/reload", async ({
  page,
}) => {
  const api = await installApiMocks(page);
  await page.goto("/?lab=player&player=player-1");
  const portfolio = page.getByRole("region", { name: "Owned-company overview" });
  const inspect = portfolio.getByRole("link", { name: "Inspect Planner Steel in Company Lab" });
  await expect(inspect).toHaveAttribute("href", "/?lab=company&player=player-1&company=company-1");
  await inspect.click();
  await expect(page).toHaveURL("/?lab=company&player=player-1&company=company-1");
  await expect(
    page.getByRole("heading", { name: "Planner Steel", exact: true }).first(),
  ).toBeVisible();
  expect(api.economyContextItemCodes).toContain("steel");
  await page.goBack();
  await expect(page).toHaveURL("/?lab=player&player=player-1");
  await expect(portfolio.getByRole("heading", { name: "Planner Steel" })).toBeVisible();
  await page.reload();
  await expect(portfolio.getByRole("heading", { name: "Planner Steel" })).toBeVisible();

  const model = portfolio.getByRole("link", { name: "Model Planner Steel in Economy Lab" });
  await expect(model).toHaveAttribute("href", "/?lab=economy&player=player-1&company=company-1");
  await model.click();
  await expect(page).toHaveURL("/?lab=economy&player=player-1&company=company-1");
  await expect(page.getByRole("heading", { name: "Scenario workspace" })).toBeVisible();
  await expect(page.getByText(/Economy Lab reloaded the current public snapshot/)).toBeVisible();
  expect(api.economyContextItemCodes).toContain("steel");
  expect(api.externalRequests).toEqual([]);
});

test("@journey Player Lab duplicate-company market handoff fetches only selected output current-state", async ({
  page,
}) => {
  const api = await installApiMocks(page);
  api.duplicateCompanies = true;
  await page.goto("/?lab=player&player=player-1");
  const portfolio = page.getByRole("region", { name: "Owned-company overview" });
  const second = portfolio.getByRole("link", {
    name: /Inspect iron from Iron Inc \(Company .*\) in Market Lab/,
  });
  await expect(second).toHaveAttribute(
    "href",
    "/?lab=market&player=player-1&company=company-duplicate-2&item=iron",
  );
  await second.click();
  await expect(page).toHaveURL(
    "/?lab=market&player=player-1&company=company-duplicate-2&item=iron",
  );
  await expect(page.getByRole("heading", { name: "Market Lab", exact: true })).toBeVisible();
  await expect(page.getByText(/iron/i).first()).toBeVisible();
  expect(api.apiRequestDetails.filter((x) => x.pathname === "/api/players/snapshot")).toHaveLength(
    1,
  );
  expect(api.economyContextItemCodes).toEqual([]);
  await page.goBack();
  await expect(portfolio.getByRole("heading", { name: "Iron Inc" })).toHaveCount(2);
  expect(api.externalRequests).toEqual([]);
});

test("@a11y Player Lab zero-company handoffs and 320px links are usable", async ({ page }) => {
  const api = await installApiMocks(page);
  await page.route("**/api/players/snapshot", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { ...snapshotResponse, companies: [] } }),
    });
  });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/?lab=player&player=player-1");
  const next = page.getByRole("region", { name: "Continue exploring this player" });
  await expect(
    next.getByRole("link", { name: "Model this player's skills in Economy Lab" }),
  ).toHaveAttribute("href", "/?lab=economy&player=player-1");
  await expect(
    next.getByRole("link", { name: "Browse owned companies in Company Lab" }),
  ).toHaveAttribute("href", "/?lab=company&player=player-1");
  await expect(
    page
      .getByRole("region", { name: "Owned-company overview" })
      .getByText("No owned companies are listed"),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBe(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(api.economyContextItemCodes).toEqual([]);
});

test("@journey Player Lab removed company link safely falls back without misidentifying another", async ({
  page,
}) => {
  const api = await installApiMocks(page);
  api.duplicateCompanies = true;
  await page.goto("/?lab=player&player=player-1");
  const portfolio = page.getByRole("region", { name: "Owned-company overview" });
  const second = portfolio
    .getByRole("link", { name: /Inspect Iron Inc \(Company .*\) in Company Lab/ })
    .nth(1);
  const href = await second.getAttribute("href");
  expect(href).toBe("/?lab=company&player=player-1&company=company-duplicate-2");
  api.removedCompanyId = "company-duplicate-2";
  await second.click();
  await expect(page).toHaveURL("/?lab=company&player=player-1&company=company-duplicate-1");
  await expect(page.getByText(/company from this link is no longer available/i)).toBeVisible();
  expect(api.economyContextItemCodes).toContain("steel");
});
