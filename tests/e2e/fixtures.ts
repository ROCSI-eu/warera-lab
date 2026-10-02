import type { Page } from "@playwright/test";

export interface MockApiState {
  searchMode: "ok" | "empty" | "rate-limit";
  snapshotMode: "ok" | "unavailable";
  staleSnapshot: boolean;
  duplicateCompanies: boolean;
  apiRequests: string[];
  externalRequests: string[];
}

const baseFreshness = {
  generatedAt: "2026-10-01T12:00:05.000Z",
  hasStaleData: false,
  sources: [
    {
      source: "search",
      retrievedAt: "2026-10-01T12:00:00.000Z",
      ageMs: 0,
      state: "live",
    },
  ],
};

export const longOpaqueCountryId = "6813b6d446e731854c7ac7b6";

const player = {
  id: "player-1",
  username: "Planner",
  countryId: "country-1",
  level: 12,
  availableSkillPoints: 5,
  spentSkillPoints: 20,
  totalSkillPoints: 25,
  skills: {
    production: { level: 1, value: 12, total: 12 },
    entrepreneurship: { level: 1, value: 35, total: 35 },
    management: { level: 1, value: 6, total: 6 },
    companies: { level: 1, value: 3, total: 3 },
  },
};

const company = {
  id: "company-1",
  ownerId: "player-1",
  regionId: "region-1",
  itemCode: "steel",
  name: "Planner Steel",
  production: 24,
  workerCount: 2,
  activeUpgradeLevels: {
    automatedEngine: 1,
    storage: 1,
    breakRoom: 1,
  },
};

const duplicateNameCompany = {
  ...company,
  id: "company-duplicate-2",
  regionId: "region-2",
  name: "Iron Inc",
  production: 31,
  workerCount: 4,
};

export const snapshotResponse = {
  player,
  companies: [company],
  regions: {
    "region-1": {
      id: "region-1",
      countryId: "country-1",
      countryCode: "RO",
      name: "Prahova",
    },
    "region-2": {
      id: "region-2",
      countryId: "country-1",
      countryCode: "RO",
      name: "Cluj",
    },
  },
  countries: {
    "country-1": {
      id: "country-1",
      code: "RO",
      name: "Romania",
    },
  },
  contextGaps: { regionIds: [], countryIds: [] },
  freshness: {
    generatedAt: "2026-10-01T12:00:06.000Z",
    hasStaleData: false,
    sources: [
      {
        source: "player",
        subjectId: "player-1",
        retrievedAt: "2026-10-01T12:00:01.000Z",
        ageMs: 0,
        state: "live",
      },
      {
        source: "company",
        subjectId: "company-1",
        retrievedAt: "2026-10-01T12:00:02.000Z",
        ageMs: 0,
        state: "live",
      },
    ],
  },
};

export const economyContextResponse = {
  itemCode: "steel",
  configRevision: "fnv1a-testcfg-123",
  item: {
    code: "steel",
    type: "resource",
    rarity: "common",
    productionNeeds: { iron: 2, coal: 1 },
    isTradable: true,
  },
  skills: {
    production: {
      key: "production",
      levels: {
        1: { level: 1, value: 12, totalCost: 1, unlockAtLevel: 1 },
        2: { level: 2, value: 16, totalCost: 3, unlockAtLevel: 5 },
      },
    },
    entrepreneurship: {
      key: "entrepreneurship",
      levels: {
        1: { level: 1, value: 35, totalCost: 2, unlockAtLevel: 1 },
        2: { level: 2, value: 42, totalCost: 5, unlockAtLevel: 8 },
      },
    },
    management: {
      key: "management",
      levels: {
        1: { level: 1, value: 6, totalCost: 1, unlockAtLevel: 1 },
        2: { level: 2, value: 9, totalCost: 4, unlockAtLevel: 7 },
      },
    },
    companies: {
      key: "companies",
      levels: {
        1: { level: 1, value: 3, totalCost: 2, unlockAtLevel: 1 },
        2: { level: 2, value: 4, totalCost: 5, unlockAtLevel: 9 },
      },
    },
  },
  companyUpgrades: {
    automatedEngine: {
      key: "automatedEngine",
      canDowngrade: true,
      levels: {
        1: { level: 1, steelCost: 10, constructionPointsCost: 5, stats: { dailyProd: 24 } },
        2: { level: 2, steelCost: 25, constructionPointsCost: 10, stats: { dailyProd: 40 } },
      },
    },
    storage: {
      key: "storage",
      canDowngrade: true,
      levels: {
        1: { level: 1, steelCost: 20, constructionPointsCost: 8, stats: { maxProduction: 200 } },
        2: { level: 2, steelCost: 35, constructionPointsCost: 14, stats: { maxProduction: 350 } },
      },
    },
    breakRoom: {
      key: "breakRoom",
      canDowngrade: false,
      levels: {
        1: { level: 1, steelCost: 15, stats: { maxWorkers: 2, dailyHires: 1 } },
        2: { level: 2, steelCost: 30, stats: { maxWorkers: 4, dailyHires: 2 } },
      },
    },
  },
  marketPrices: { steel: 10, iron: 2, coal: 3 },
  contextGaps: { itemCodes: [], marketPriceItemCodes: [] },
  freshness: {
    generatedAt: "2026-10-01T12:00:07.000Z",
    hasStaleData: false,
    sources: [
      {
        source: "gameConfig",
        retrievedAt: "2026-10-01T12:00:03.000Z",
        ageMs: 0,
        state: "live",
      },
      {
        source: "marketPrices",
        retrievedAt: "2026-10-01T12:00:04.000Z",
        ageMs: 0,
        state: "live",
      },
    ],
  },
};

export async function installApiMocks(page: Page): Promise<MockApiState> {
  const state: MockApiState = {
    searchMode: "ok",
    snapshotMode: "ok",
    staleSnapshot: false,
    duplicateCompanies: false,
    apiRequests: [],
    externalRequests: [],
  };

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) state.apiRequests.push(request.url());
    if (url.hostname !== "127.0.0.1") state.externalRequests.push(request.url());
  });

  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname === "/api/players/search") {
      if (state.searchMode === "rate-limit") {
        await route.fulfill({
          status: 429,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "UPSTREAM_RATE_LIMITED",
              message: "WarEra rate limit reached. Try again shortly.",
              retryAfterSeconds: 60,
            },
          }),
        });
        return;
      }

      const matches =
        state.searchMode === "empty"
          ? []
          : [
              {
                id: player.id,
                username: player.username,
                countryId: longOpaqueCountryId,
                level: 12,
              },
            ];

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            query: state.searchMode === "empty" ? "Nobody" : "Planner",
            matches,
            truncated: false,
            freshness: baseFreshness,
          },
        }),
      });
      return;
    }

    if (url.pathname === "/api/players/snapshot") {
      if (state.snapshotMode === "unavailable") {
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
        return;
      }

      const response = structuredClone(snapshotResponse);
      if (state.duplicateCompanies) {
        response.companies = [
          { ...company, id: "company-duplicate-1", name: "Iron Inc" },
          duplicateNameCompany,
        ];
      }
      if (state.staleSnapshot) {
        response.freshness.hasStaleData = true;
        response.freshness.sources[0]!.state = "stale";
        response.freshness.sources[0]!.ageMs = 180_000;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: response }),
      });
      return;
    }

    if (url.pathname === "/api/economy/context") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: economyContextResponse }),
      });
      return;
    }

    await route.fulfill({ status: 404, body: "not found" });
  });

  return state;
}

export async function importPlannerWorkspace(page: Page) {
  await page.goto("/");
  await page.getByLabel("WarEra player name").fill("Planner");
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("button", { name: /Planner Level 12/ }).click();
  await page.getByRole("heading", { name: "Scenario workspace" }).waitFor();
}

export function productionSelect(page: Page) {
  return page
    .locator("label.planner-control")
    .filter({ has: page.getByText("Production", { exact: true }) })
    .locator("select");
}
