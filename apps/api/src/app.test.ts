import type {
  CountryContext,
  EconomyGameConfig,
  MarketPriceMap,
  PublicCompanySnapshot,
  PublicPlayerEconomySnapshot,
  RegionContext,
} from "@warera-lab/domain";
import type { CompanyIdsPage, WarEraAdapterResponse } from "@warera-lab/warera-api";
import { WarEraApiError } from "@warera-lab/warera-api";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "./app.js";
import type { EconomyWarEraClient } from "./economy-context-service.js";
import type { PublicWarEraClient } from "./player-service.js";

type TestWarEraClient = PublicWarEraClient & EconomyWarEraClient;

function adapter<T>(
  data: T,
  options: { state?: "miss" | "fresh" | "stale"; ageMs?: number; retrievedAt?: string } = {},
): WarEraAdapterResponse<T> {
  const state = options.state ?? "miss";
  return {
    data,
    retrievedAt: options.retrievedAt ?? "2026-10-01T12:00:00.000Z",
    rateLimit: {
      limit: 100,
      remaining: 80,
      resetSeconds: 60,
      policy: "100;w=60",
    },
    cache: {
      state,
      ageMs: options.ageMs ?? 0,
      ttlMs: 10_000,
      staleIfErrorMs: 0,
      coalesced: false,
    },
  };
}

const player: PublicPlayerEconomySnapshot = {
  id: "user-1",
  username: "Example",
  countryId: "country-1",
  level: 12,
  availableSkillPoints: 4,
  spentSkillPoints: 20,
  totalSkillPoints: 24,
  skills: {
    production: { level: 4, value: 22, total: 22 },
    entrepreneurship: { level: 3, value: 45, total: 45 },
    management: { level: 2, value: 8, total: 8 },
    companies: { level: 5, value: 7, total: 7 },
  },
};

const company: PublicCompanySnapshot = {
  id: "company-1",
  ownerId: "user-1",
  regionId: "region-1",
  itemCode: "steel",
  name: "Example Steel",
  production: 120,
  workerCount: 2,
  activeUpgradeLevels: { automatedEngine: 2 },
};

const region: RegionContext = {
  id: "region-1",
  code: "R1",
  name: "Region One",
  countryId: "country-2",
  countryCode: "C2",
  development: 4,
  baseDevelopment: 3,
  isCapital: false,
  isLinkedToCapital: true,
};

const playerCountry: CountryContext = {
  id: "country-1",
  code: "C1",
  name: "Country One",
};

const companyCountry: CountryContext = {
  id: "country-2",
  code: "C2",
  name: "Country Two",
};

const economyConfig: EconomyGameConfig = {
  skills: {
    production: {
      key: "production",
      levels: { 4: { level: 4, value: 22, totalCost: 10, unlockAtLevel: 1 } },
    },
    entrepreneurship: {
      key: "entrepreneurship",
      levels: { 3: { level: 3, value: 45, totalCost: 8, unlockAtLevel: 1 } },
    },
    management: {
      key: "management",
      levels: { 2: { level: 2, value: 8, totalCost: 5, unlockAtLevel: 1 } },
    },
    companies: {
      key: "companies",
      levels: { 5: { level: 5, value: 7, totalCost: 12, unlockAtLevel: 1 } },
    },
  },
  items: {
    steel: {
      code: "steel",
      type: "resource",
      rarity: "common",
      productionNeeds: { iron: 2 },
      isTradable: true,
    },
  },
  companyUpgrades: {
    automatedEngine: { key: "automatedEngine", levels: {} },
    storage: { key: "storage", levels: {} },
    breakRoom: { key: "breakRoom", levels: {} },
  },
  company: {},
  worker: {},
};

const marketPrices: MarketPriceMap = {
  steel: 10,
  iron: 2,
  unrelated: 99,
};

function client(overrides: Partial<TestWarEraClient> = {}): TestWarEraClient {
  return {
    search: vi.fn(async () => adapter({ userIds: ["user-1"] })),
    getPlayer: vi.fn(async () => adapter(player)),
    getCompanies: vi.fn(async () => adapter<CompanyIdsPage>({ itemIds: ["company-1"] })),
    getCompany: vi.fn(async () => adapter(company)),
    getRegions: vi.fn(async () => adapter({ "region-1": region })),
    getCountries: vi.fn(async () => adapter([playerCountry, companyCountry])),
    getEconomyGameConfig: vi.fn(async () => adapter(economyConfig)),
    getItemPrices: vi.fn(async () => adapter(marketPrices)),
    ...overrides,
  };
}

describe("WarEra Lab API", () => {
  it("returns a no-store health response", async () => {
    const response = await createApp({ wareraClient: client() }).request("/api/health");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      service: "warera-lab-api",
    });
  });

  it("searches players through a JSON body and returns a minimal canonical match", async () => {
    const wareraClient = client();
    const app = createApp({
      wareraClient,
      now: () => new Date("2026-10-01T12:00:05.000Z"),
    });

    const response = await app.request("/api/players/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "  Example  " }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(wareraClient.search).toHaveBeenCalledWith("Example");
    await expect(response.json()).resolves.toEqual({
      data: {
        query: "Example",
        matches: [
          {
            id: "user-1",
            username: "Example",
            countryId: "country-1",
            level: 12,
          },
        ],
        truncated: false,
        freshness: {
          generatedAt: "2026-10-01T12:00:05.000Z",
          hasStaleData: false,
          sources: [
            {
              source: "search",
              retrievedAt: "2026-10-01T12:00:00.000Z",
              ageMs: 0,
              state: "live",
            },
            {
              source: "player",
              subjectId: "user-1",
              retrievedAt: "2026-10-01T12:00:00.000Z",
              ageMs: 0,
              state: "live",
            },
          ],
        },
      },
    });
  });

  it("returns a normalized economy snapshot with only relevant region/country context", async () => {
    const wareraClient = client({
      getRegions: vi.fn(async () =>
        adapter(
          {
            "region-1": region,
            "region-unrelated": { ...region, id: "region-unrelated", name: "Unrelated" },
          },
          { state: "fresh", ageMs: 2_000 },
        ),
      ),
      getCountries: vi.fn(async () =>
        adapter([
          playerCountry,
          companyCountry,
          { id: "country-unrelated", code: "CU", name: "Unrelated" },
        ]),
      ),
    });
    const app = createApp({
      wareraClient,
      now: () => new Date("2026-10-01T12:00:05.000Z"),
    });

    const response = await app.request("/api/players/snapshot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "user-1" }),
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toMatchObject({
      data: {
        player: { id: "user-1", username: "Example" },
        companies: [{ id: "company-1", itemCode: "steel", regionId: "region-1" }],
        regions: { "region-1": { id: "region-1", name: "Region One" } },
        countries: {
          "country-1": { id: "country-1", name: "Country One" },
          "country-2": { id: "country-2", name: "Country Two" },
        },
        contextGaps: { regionIds: [], countryIds: [] },
        freshness: { hasStaleData: false },
      },
    });
    expect(JSON.stringify(body)).not.toContain("country-unrelated");
    expect(JSON.stringify(body)).not.toContain("region-unrelated");
    expect(JSON.stringify(body)).not.toContain("rateLimit");
  });

  it("maps a missing player to a stable 404 response", async () => {
    const app = createApp({
      wareraClient: client({
        getPlayer: vi.fn(async () => {
          throw new WarEraApiError("Not found", { kind: "http", status: 404 });
        }),
      }),
    });

    const response = await app.request("/api/players/snapshot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "missing" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "PLAYER_NOT_FOUND",
        message: "The requested WarEra player was not found.",
      },
    });
  });

  it("maps upstream rate limiting to a retryable service response", async () => {
    const app = createApp({
      wareraClient: client({
        search: vi.fn(async () => {
          throw new WarEraApiError("reserve", {
            kind: "rate-limited",
            status: 429,
            retryAfterSeconds: 17,
          });
        }),
      }),
    });

    const response = await app.request("/api/players/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "Example" }),
    });

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("17");
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UPSTREAM_RATE_LIMITED",
        message: "WarEra is temporarily rate-limited. Please retry shortly.",
        retryAfterSeconds: 17,
      },
    });
  });

  it("maps upstream unavailability to a stable 503 response", async () => {
    const app = createApp({
      wareraClient: client({
        search: vi.fn(async () => {
          throw new WarEraApiError("network detail", { kind: "upstream" });
        }),
      }),
    });

    const response = await app.request("/api/players/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "Example" }),
    });

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: "UPSTREAM_UNAVAILABLE",
        message: "WarEra is temporarily unavailable. Please retry shortly.",
      },
    });
    expect(JSON.stringify(body)).not.toContain("network detail");
  });

  it("maps an invalid upstream payload to a safe 502 response", async () => {
    const app = createApp({
      wareraClient: client({
        getPlayer: vi.fn(async () => {
          throw new WarEraApiError("schema detail that should not leak", {
            kind: "invalid-response",
          });
        }),
      }),
    });

    const response = await app.request("/api/players/snapshot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "user-1" }),
    });

    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: "UPSTREAM_INVALID_RESPONSE",
        message: "WarEra returned data that could not be safely validated.",
      },
    });
    expect(JSON.stringify(body)).not.toContain("schema detail");
  });

  it("returns only the selected item configuration and relevant market prices", async () => {
    const app = createApp({
      wareraClient: client(),
      now: () => new Date("2026-10-01T12:00:05.000Z"),
    });

    const response = await app.request("/api/economy/context", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemCode: "steel" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toMatchObject({
      data: {
        itemCode: "steel",
        item: { code: "steel", productionNeeds: { iron: 2 } },
        marketPrices: { steel: 10, iron: 2 },
        contextGaps: { itemCodes: [], marketPriceItemCodes: [] },
        freshness: { hasStaleData: false },
      },
    });
    expect(JSON.stringify(body)).not.toContain("unrelated");
  });

  it("reports missing item configuration and market references without inventing values", async () => {
    const app = createApp({ wareraClient: client() });

    const response = await app.request("/api/economy/context", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemCode: "missing-item" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      data: {
        itemCode: "missing-item",
        marketPrices: {},
        contextGaps: {
          itemCodes: ["missing-item"],
          marketPriceItemCodes: ["missing-item"],
        },
      },
    });
    expect(body.data.item).toBeUndefined();
  });

  it("rejects invalid JSON/body input before calling WarEra", async () => {
    const wareraClient = client();
    const app = createApp({ wareraClient });

    const response = await app.request("/api/players/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "x" }),
    });

    expect(response.status).toBe(400);
    expect(wareraClient.search).not.toHaveBeenCalled();
  });
});
