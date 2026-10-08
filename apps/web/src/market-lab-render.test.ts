import type { MarketLabItemResponse, MarketLabOverviewResponse } from "@warera-lab/domain";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MarketLabShell } from "./MarketLabShell.js";

const freshness = {
  generatedAt: "2026-10-08T09:00:00.000Z",
  hasStaleData: false,
  sources: [
    {
      source: "gameConfig" as const,
      retrievedAt: "2026-10-08T08:59:00.000Z",
      ageMs: 0,
      state: "live" as const,
    },
    {
      source: "marketPrices" as const,
      retrievedAt: "2026-10-08T08:59:30.000Z",
      ageMs: 0,
      state: "cached" as const,
    },
  ],
};

const overview: MarketLabOverviewResponse = {
  items: [
    { code: "coal", type: "resource", rarity: "common", currentPrice: 0, isTradable: true },
    { code: "iron", type: "resource", rarity: "common", isTradable: true },
    { code: "steel", type: "resource", rarity: "rare", currentPrice: 12.34567, isTradable: true },
  ],
  contextGaps: { itemCodes: ["unknown"], marketPriceItemCodes: ["iron"] },
  freshness,
};

const complete: MarketLabItemResponse = {
  itemCode: "steel",
  item: {
    code: "steel",
    type: "resource",
    rarity: "rare",
    productionPoints: 12,
    isTradable: true,
    productionNeeds: { iron: 2, coal: 1 },
  },
  marketPrices: { steel: 12.34567, coal: 0 },
  topOrders: {
    buyOrders: [
      { id: "buy-1", ownerId: "user-1", itemCode: "steel", type: "buy", price: 11.5, quantity: 3 },
    ],
    sellOrders: [
      {
        id: "sell-1",
        ownerId: "user-2",
        itemCode: "steel",
        type: "sell",
        price: 13.5,
        quantity: 4,
      },
    ],
  },
  contextGaps: {
    itemCodes: [],
    marketPriceItemCodes: ["iron"],
    orderBookItemCodes: [],
  },
  freshness: {
    ...freshness,
    sources: [
      ...freshness.sources,
      {
        source: "marketOrders" as const,
        subjectId: "steel",
        retrievedAt: "2026-10-08T08:59:50.000Z",
        ageMs: 0,
        state: "live" as const,
      },
    ],
  },
};

function markup(props: Parameters<typeof MarketLabShell>[0]): string {
  return renderToStaticMarkup(createElement(MarketLabShell, props));
}

describe("MarketLabShell", () => {
  it("shows independent loading and no-selection guidance without player context", () => {
    const html = markup({ isLoadingOverview: true });
    expect(html).toContain("Market Lab");
    expect(html).toContain("Current state only");
    expect(html).toContain("Loading current items and prices");
    expect(html).toContain("Choose an item");
    expect(html).not.toContain("WarEra player name");
  });

  it("renders complete catalogue and selected recipe/order snapshot without derived economics", () => {
    const html = markup({
      overview,
      item: complete,
      itemCode: "steel",
      itemHref: (code) => "/?lab=market" + (code ? "&item=" + code : ""),
    });
    expect(html).toContain("12.3457");
    expect(html).toContain("No current price");
    expect(html).toContain("Current observed price");
    expect(html).toContain("Recipe quantity");
    expect(html).toContain("Buy orders");
    expect(html).toContain("Sell orders");
    expect(html).toContain("11.5");
    expect(html).toContain("13.5");
    expect(html).toContain("Missing current prices: iron");
    expect(html).toContain('href="/?lab=market&amp;item=coal"');
    expect(html).toContain('href="/?lab=market"');
    expect(html).toContain("Market overview freshness");
    expect(html).toContain("Selected item freshness");
    expect(html).not.toContain("Gross margin");
    expect(html).not.toContain("Projected profit");
  });

  it("renders partial context, missing configuration, missing order source and zero price distinctly", () => {
    const html = markup({
      overview,
      itemCode: "coal",
      item: {
        itemCode: "coal",
        marketPrices: { coal: 0 },
        contextGaps: {
          itemCodes: ["coal"],
          marketPriceItemCodes: [],
          orderBookItemCodes: ["coal"],
        },
        freshness,
      },
    });
    expect(html).toContain("No current price");
    expect(html).toContain("0");
    expect(html).toContain("Recipe details cannot be shown");
    expect(html).toContain("Missing item configuration: coal");
    expect(html).toContain("Current orders are temporarily unavailable for coal");
    expect(html).not.toContain("Buy orders");
  });

  it("shows a known output price even if recipe config is missing, but never uses inherited prices", () => {
    const fromPriceOnly = markup({
      itemCode: "unconfigured",
      item: {
        itemCode: "unconfigured",
        marketPrices: { unconfigured: 6.5 },
        contextGaps: {
          itemCodes: ["unconfigured"],
          marketPriceItemCodes: [],
          orderBookItemCodes: [],
        },
        freshness,
      },
    });
    expect(fromPriceOnly).toContain("6.5");
    expect(fromPriceOnly).toContain("Recipe details cannot be shown");

    const inherited = markup({
      itemCode: "__proto__",
      item: {
        itemCode: "__proto__",
        marketPrices: {},
        contextGaps: { itemCodes: [], marketPriceItemCodes: ["__proto__"], orderBookItemCodes: [] },
        freshness,
      },
    });
    expect(inherited).toContain("No current price");
    expect(inherited).not.toContain("NaN");
  });

  it("handles an empty catalogue, an empty returned order book and source errors distinctly", () => {
    const empty: MarketLabOverviewResponse = {
      items: [],
      contextGaps: { itemCodes: [], marketPriceItemCodes: [] },
      freshness,
    };
    const html = markup({
      overview: empty,
      item: {
        ...complete,
        topOrders: { buyOrders: [], sellOrders: [] },
      },
      itemCode: "steel",
    });
    expect(html).toContain("No current items were returned");
    expect(html).toContain("No current buy orders were returned");
    expect(html).toContain("No current sell orders were returned");

    const errorHtml = markup({
      itemCode: "steel",
      overviewError: "Rate limited",
      itemError: "Source unavailable",
      navigationMessage: "Invalid link context",
    });
    expect(errorHtml).toContain("Rate limited");
    expect(errorHtml).toContain("Source unavailable");
    expect(errorHtml).toContain("Invalid link context");
    expect(errorHtml).toContain('role="alert"');
  });
});
