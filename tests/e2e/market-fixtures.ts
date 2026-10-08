import type {
  MarketLabItemResponse,
  MarketLabOverviewResponse,
  SnapshotFreshness,
} from "@warera-lab/domain";
import type { Page } from "@playwright/test";

const freshness: SnapshotFreshness = {
  generatedAt: "2026-10-08T09:00:00.000Z",
  hasStaleData: false,
  sources: [
    { source: "gameConfig", retrievedAt: "2026-10-08T08:59:00.000Z", ageMs: 0, state: "live" },
    {
      source: "marketPrices",
      retrievedAt: "2026-10-08T08:59:30.000Z",
      ageMs: 2_000,
      state: "cached",
    },
  ],
};

const overview: MarketLabOverviewResponse = {
  items: [
    { code: "coal", type: "resource", rarity: "common", isTradable: false, currentPrice: 0 },
    { code: "iron", type: "resource", rarity: "common", isTradable: true },
    { code: "steel", type: "product", rarity: "rare", isTradable: true, currentPrice: 12.75 },
  ],
  contextGaps: { itemCodes: [], marketPriceItemCodes: ["iron"] },
  freshness,
};

function selectedItem(itemCode: string): MarketLabItemResponse {
  if (itemCode === "missing") {
    return {
      itemCode,
      marketPrices: {},
      contextGaps: {
        itemCodes: ["missing"],
        marketPriceItemCodes: ["missing"],
        orderBookItemCodes: [],
      },
      freshness,
    };
  }
  const isSteel = itemCode === "steel";
  return {
    itemCode,
    item: {
      code: itemCode,
      type: isSteel ? "product" : "resource",
      rarity: isSteel ? "rare" : "common",
      isTradable: itemCode !== "coal",
      productionNeeds: isSteel ? { iron: 2, coal: 1 } : {},
    },
    marketPrices: isSteel ? { steel: 12.75, coal: 0 } : { [itemCode]: itemCode === "coal" ? 0 : 8 },
    ...(itemCode === "coal"
      ? {}
      : {
          topOrders: {
            buyOrders: [
              {
                id: "buy-1",
                ownerId: "owner",
                itemCode,
                quantity: 3,
                price: 11,
                type: "buy" as const,
              },
            ],
            sellOrders: [
              {
                id: "sell-1",
                ownerId: "owner",
                itemCode,
                quantity: 5,
                price: 14,
                type: "sell" as const,
              },
            ],
          },
        }),
    contextGaps: {
      itemCodes: [],
      marketPriceItemCodes: isSteel ? ["iron"] : [],
      orderBookItemCodes: [],
    },
    freshness: {
      ...freshness,
      sources: [
        ...freshness.sources,
        ...(itemCode === "coal"
          ? []
          : [
              {
                source: "marketOrders" as const,
                subjectId: itemCode,
                retrievedAt: "2026-10-08T08:59:40.000Z",
                ageMs: 0,
                state: "live" as const,
              },
            ]),
      ],
    },
  };
}

export interface MarketMockState {
  overviewMode: "ok" | "empty" | "error";
  itemMode: "ok" | "missing-orders" | "error";
  itemCodes: string[];
}

export async function installMarketMocks(page: Page): Promise<MarketMockState> {
  const state: MarketMockState = { overviewMode: "ok", itemMode: "ok", itemCodes: [] };

  await page.route("**/api/market/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (
      (path === "/api/market/overview" && state.overviewMode === "error") ||
      (path === "/api/market/item" && state.itemMode === "error")
    ) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "UPSTREAM_UNAVAILABLE",
            message: "Market data is temporarily unavailable.",
          },
        }),
      });
      return;
    }
    if (path === "/api/market/overview") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data:
            state.overviewMode === "empty"
              ? {
                  ...overview,
                  items: [],
                  contextGaps: { itemCodes: [], marketPriceItemCodes: [] },
                }
              : overview,
        }),
      });
      return;
    }
    if (path === "/api/market/item") {
      const { itemCode } = route.request().postDataJSON() as { itemCode: string };
      state.itemCodes.push(itemCode);
      const item = selectedItem(itemCode);
      if (state.itemMode === "missing-orders" && itemCode !== "missing") {
        delete item.topOrders;
        item.contextGaps.orderBookItemCodes = [itemCode];
        item.freshness.sources = freshness.sources;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: item }),
      });
      return;
    }
    await route.fallback();
  });
  return state;
}
