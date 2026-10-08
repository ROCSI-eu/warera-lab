import type {
  CountryContext,
  EconomyGameConfig,
  MarketOrderBook,
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
import type { MarketWarEraClient } from "./market-context-service.js";
import type { PublicWarEraClient } from "./player-service.js";

type TestWarEraClient = PublicWarEraClient & EconomyWarEraClient & MarketWarEraClient;

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
    iron: {
      code: "iron",
      type: "resource",
      rarity: "common",
      productionNeeds: {},
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

const steelItem = economyConfig.items.steel;
if (steelItem === undefined) throw new Error("Test fixture must contain steel");

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
    getTopOrders: vi.fn(async () =>
      adapter<MarketOrderBook>({
        buyOrders: [
          {
            id: "buy-1",
            ownerId: "seller-1",
            itemCode: "steel",
            quantity: 3,
            price: 9,
            type: "buy",
          },
        ],
        sellOrders: [
          {
            id: "sell-1",
            ownerId: "seller-2",
            itemCode: "steel",
            quantity: 4,
            price: 11,
            type: "sell",
          },
        ],
      }),
    ),
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
        configRevision: expect.stringMatching(/^fnv1a-[0-9a-f]{8}-[0-9a-f]+$/),
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

  it("rejects Economy context item codes that cannot be serialized in scenario documents", async () => {
    const wareraClient = client();
    const app = createApp({ wareraClient });

    const response = await app.request("/api/economy/context", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemCode: "x".repeat(65) }),
    });

    expect(response.status).toBe(400);
    expect(wareraClient.getEconomyGameConfig).not.toHaveBeenCalled();
    expect(wareraClient.getItemPrices).not.toHaveBeenCalled();
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

  it("returns a compact sorted Market catalogue with explicit price/config gaps and no orders", async () => {
    const wareraClient = client({
      getItemPrices: vi.fn(async () =>
        adapter({ steel: 0, unrelated: 42 }, { state: "fresh", ageMs: 900 }),
      ),
    });
    const response = await createApp({
      wareraClient,
      now: () => new Date("2026-10-01T12:00:05.000Z"),
    }).request("/api/market/overview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({
      data: {
        items: [
          { code: "iron", type: "resource", rarity: "common", isTradable: true },
          { code: "steel", type: "resource", rarity: "common", isTradable: true, currentPrice: 0 },
        ],
        contextGaps: {
          itemCodes: ["unrelated"],
          marketPriceItemCodes: ["iron"],
        },
        freshness: {
          generatedAt: "2026-10-01T12:00:05.000Z",
          hasStaleData: false,
          sources: [
            {
              source: "gameConfig",
              retrievedAt: "2026-10-01T12:00:00.000Z",
              ageMs: 0,
              state: "live",
            },
            {
              source: "marketPrices",
              retrievedAt: "2026-10-01T12:00:00.000Z",
              ageMs: 900,
              state: "cached",
            },
          ],
        },
      },
    });
    expect(wareraClient.getTopOrders).not.toHaveBeenCalled();
    expect(JSON.stringify(body)).not.toContain("skills");
    expect(JSON.stringify(body)).not.toContain("companyUpgrades");
    expect(JSON.stringify(body)).not.toContain("rateLimit");
  });

  it("inspects selected-item recipe, relevant prices and bounded normalized orders", async () => {
    const buys = Array.from({ length: 14 }, (_, index) => ({
      id: "buy-" + index,
      ownerId: "user-" + index,
      itemCode: "steel",
      quantity: 2,
      price: index,
      type: "buy" as const,
    }));
    const sells = Array.from({ length: 13 }, (_, index) => ({
      id: "sell-" + index,
      ownerId: "user-" + index,
      itemCode: "steel",
      quantity: 4,
      price: index + 5,
      type: "sell" as const,
    }));
    const wareraClient = client({
      getTopOrders: vi.fn(async () =>
        adapter<MarketOrderBook>(
          {
            buyOrders: [
              ...buys,
              {
                id: "wrong",
                ownerId: "other",
                itemCode: "iron",
                quantity: 1,
                price: 2,
                type: "buy",
              },
            ],
            sellOrders: sells,
          },
          { state: "stale", ageMs: 5_000 },
        ),
      ),
    });
    const response = await createApp({
      wareraClient,
      now: () => new Date("2026-10-01T12:00:05.000Z"),
    }).request("/api/market/item", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemCode: " steel " }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(wareraClient.getTopOrders).toHaveBeenCalledWith("steel", 10);
    expect(body.data).toMatchObject({
      itemCode: "steel",
      item: { code: "steel", productionNeeds: { iron: 2 } },
      marketPrices: { steel: 10, iron: 2 },
      contextGaps: { itemCodes: [], marketPriceItemCodes: [], orderBookItemCodes: [] },
      freshness: { hasStaleData: true },
    });
    expect(body.data.topOrders.buyOrders).toHaveLength(10);
    expect(body.data.topOrders.sellOrders).toHaveLength(10);
    expect(body.data.topOrders.buyOrders[0]).toMatchObject({
      id: "buy-0",
      ownerId: "user-0",
      type: "buy",
    });
    expect(body.data.freshness.sources.map((source: { source: string }) => source.source)).toEqual([
      "gameConfig",
      "marketPrices",
      "marketOrders",
    ]);
    expect(body.data.freshness.sources[2]).toMatchObject({
      source: "marketOrders",
      subjectId: "steel",
      state: "stale",
      ageMs: 5_000,
    });
    expect(JSON.stringify(body)).not.toContain("unrelated");
    expect(JSON.stringify(body)).not.toContain("rateLimit");
  });

  it("represents missing selected Market item configuration and price without inventing data", async () => {
    const wareraClient = client();
    const response = await createApp({ wareraClient }).request("/api/market/item", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemCode: "missing-item" }),
    });
    const { data } = await response.json();

    expect(response.status).toBe(200);
    expect(data.item).toBeUndefined();
    expect(data.topOrders).toBeUndefined();
    expect(data.marketPrices).toEqual({});
    expect(data.contextGaps).toEqual({
      itemCodes: ["missing-item"],
      marketPriceItemCodes: ["missing-item"],
      orderBookItemCodes: [],
    });
    expect(data.freshness.sources).toHaveLength(2);
    expect(wareraClient.getTopOrders).not.toHaveBeenCalled();
  });

  it("treats prototype-shaped item codes as data, not inherited configuration or price values", async () => {
    const wareraClient = client({
      getEconomyGameConfig: vi.fn(async () =>
        adapter({
          ...economyConfig,
          items: Object.fromEntries([
            ["__proto__", { ...steelItem, code: "__proto__", productionNeeds: {} }],
          ]),
        }),
      ),
      getItemPrices: vi.fn(async () => adapter(Object.fromEntries([["__proto__", 3]]))),
    });
    const response = await createApp({ wareraClient }).request("/api/market/item", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemCode: "__proto__" }),
    });
    const { data } = await response.json();
    expect(response.status).toBe(200);
    expect(data.marketPrices).toEqual({ ["__proto__"]: 3 });
    expect(data.item).toMatchObject({ code: "__proto__" });
    expect(data.contextGaps).toEqual({
      itemCodes: [],
      marketPriceItemCodes: [],
      orderBookItemCodes: [],
    });
  });

  it("reports absent recipe-input configuration and missing input prices", async () => {
    const wareraClient = client({
      getEconomyGameConfig: vi.fn(async () =>
        adapter({
          ...economyConfig,
          items: { steel: steelItem },
        }),
      ),
      getItemPrices: vi.fn(async () => adapter({ steel: 10 })),
    });
    const response = await createApp({ wareraClient }).request("/api/market/item", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemCode: "steel" }),
    });
    const { data } = await response.json();

    expect(response.status).toBe(200);
    expect(data.item.productionNeeds).toEqual({ iron: 2 });
    expect(data.marketPrices).toEqual({ steel: 10 });
    expect(data.contextGaps).toEqual({
      itemCodes: ["iron"],
      marketPriceItemCodes: ["iron"],
      orderBookItemCodes: [],
    });
  });

  it("does not request orders for an explicitly non-tradable item", async () => {
    const wareraClient = client({
      getEconomyGameConfig: vi.fn(async () =>
        adapter({
          ...economyConfig,
          items: {
            ...economyConfig.items,
            steel: { ...steelItem, isTradable: false },
          },
        }),
      ),
    });
    const response = await createApp({ wareraClient }).request("/api/market/item", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemCode: "steel" }),
    });
    const { data } = await response.json();

    expect(response.status).toBe(200);
    expect(data.topOrders).toBeUndefined();
    expect(data.contextGaps.orderBookItemCodes).toEqual([]);
    expect(wareraClient.getTopOrders).not.toHaveBeenCalled();
  });

  it("degrades only optional Market orders on upstream failure and reports the gap", async () => {
    const wareraClient = client({
      getTopOrders: vi.fn(async () => {
        throw new WarEraApiError("private upstream details", { kind: "upstream" });
      }),
    });
    const response = await createApp({ wareraClient }).request("/api/market/item", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemCode: "steel" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      item: { code: "steel" },
      marketPrices: { steel: 10, iron: 2 },
      contextGaps: { itemCodes: [], marketPriceItemCodes: [], orderBookItemCodes: ["steel"] },
    });
    expect(body.data.topOrders).toBeUndefined();
    expect(body.data.freshness.sources.map((source: { source: string }) => source.source)).toEqual([
      "gameConfig",
      "marketPrices",
    ]);
    expect(JSON.stringify(body)).not.toContain("private upstream details");
  });

  it("maps required Market source rate limits and invalid upstream responses to safe errors", async () => {
    const app = createApp({
      wareraClient: client({
        getItemPrices: vi.fn(async () => {
          throw new WarEraApiError("rate limit private detail", {
            kind: "rate-limited",
            status: 429,
            retryAfterSeconds: 8,
          });
        }),
      }),
    });
    const overview = await app.request("/api/market/overview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(overview.status).toBe(503);
    expect(overview.headers.get("retry-after")).toBe("8");
    await expect(overview.json()).resolves.toMatchObject({
      error: { code: "UPSTREAM_RATE_LIMITED", retryAfterSeconds: 8 },
    });

    const item = await createApp({
      wareraClient: client({
        getEconomyGameConfig: vi.fn(async () => {
          throw new WarEraApiError("internal config detail", { kind: "invalid-response" });
        }),
      }),
    }).request("/api/market/item", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemCode: "steel" }),
    });
    expect(item.status).toBe(502);
    await expect(item.json()).resolves.toMatchObject({
      error: { code: "UPSTREAM_INVALID_RESPONSE" },
    });
  });

  it("rejects invalid Market requests before touching upstream APIs", async () => {
    const wareraClient = client();
    const app = createApp({ wareraClient });
    const requests: Array<[string, string]> = [
      ["/api/market/item", JSON.stringify({ itemCode: "x".repeat(65) })],
      ["/api/market/item", JSON.stringify({ itemCode: "" })],
      ["/api/market/item", JSON.stringify({ itemCode: "__proto__", unexpected: true })],
      ["/api/market/item", "bad json"],
      ["/api/market/overview", JSON.stringify({ unrelated: "x" })],
      ["/api/market/overview", "bad json"],
    ];
    for (const [path, body] of requests) {
      const response = await app.request(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      expect(response.status).toBe(400);
    }
    expect(wareraClient.getItemPrices).not.toHaveBeenCalled();
    expect(wareraClient.getEconomyGameConfig).not.toHaveBeenCalled();
    expect(wareraClient.getTopOrders).not.toHaveBeenCalled();
  });
});
