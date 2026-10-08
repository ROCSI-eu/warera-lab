import type { MarketLabItemResponse } from "@warera-lab/domain";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MarketRecipeEconomics } from "./MarketRecipeEconomics.js";
import { evaluateMarketRecipeEconomics } from "./market-recipe-economics.js";

const baseline: MarketLabItemResponse = {
  itemCode: "steel",
  item: {
    code: "steel",
    type: "resource",
    rarity: "rare",
    productionNeeds: { iron: 2, coal: 1 },
    isTradable: true,
  },
  marketPrices: { steel: 10, iron: 2, coal: 3 },
  contextGaps: { itemCodes: [], marketPriceItemCodes: [], orderBookItemCodes: [] },
  freshness: {
    generatedAt: "2026-10-08T08:05:00.000Z",
    hasStaleData: false,
    sources: [
      { source: "gameConfig", retrievedAt: "2026-10-08T08:04:00.000Z", ageMs: 1000, state: "live" },
      {
        source: "marketPrices",
        retrievedAt: "2026-10-08T08:04:15.000Z",
        ageMs: 5000,
        state: "cached",
      },
    ],
  },
};

const html = (context: MarketLabItemResponse) =>
  renderToStaticMarkup(createElement(MarketRecipeEconomics, { context }));

describe("Market Lab recipe economics", () => {
  it("delegates positive one-unit reference arithmetic to the shared versioned simulator", () => {
    const evaluation = evaluateMarketRecipeEconomics(baseline);
    expect(evaluation.status).toBe("available");
    if (evaluation.status !== "available") return;
    expect(evaluation.result).toMatchObject({
      version: "market-margin-v1",
      quantity: { value: 1, provenance: "assumed" },
      liveOutputPriceBaseline: { value: 10, provenance: "observed" },
      recipeInputCost: { value: 7, provenance: "derived" },
      grossRevenue: { value: 10, provenance: "derived" },
      breakEvenOutputPrice: { value: 7, provenance: "derived" },
      marginPerUnit: { value: 3, provenance: "derived" },
      explicitAssumedCostTotal: { value: 0, provenance: "derived" },
    });
    expect(evaluation.result.recipeInputs.iron?.cost.value).toBe(4);
    const rendered = html(baseline);
    expect(rendered).toContain("Recipe-only implied spread");
    expect(rendered).toContain("Recipe-only break-even output price");
    expect(rendered).toContain("market-margin-v1");
    expect(rendered).toContain("labour, taxes");
    expect(rendered).toContain("not realized profit");
    expect(rendered).toContain("gameConfig (live");
    expect(rendered).toContain("marketPrices (cached");
    expect(rendered).toContain("Advanced / exact calculation inputs and outputs");
    expect(rendered).not.toContain("trade recommendation");
  });

  it("shows a negative recipe-only spread without using it as a profitability prediction", () => {
    const context = { ...baseline, marketPrices: { ...baseline.marketPrices, steel: 5 } };
    const evaluation = evaluateMarketRecipeEconomics(context);
    expect(evaluation.status).toBe("available");
    if (evaluation.status !== "available") return;
    expect(evaluation.result.marginPerUnit.value).toBe(-2);
    expect(html(context)).toContain("negative spread");
    expect(html(context)).toContain("not a profit");
    expect(html(context)).toContain("-2");
  });

  it("accepts observed zero prices but conservatively withholds unconfirmed empty recipes", () => {
    const context = {
      ...baseline,
      marketPrices: { steel: 0, iron: 0, coal: 0 },
    };
    const evaluation = evaluateMarketRecipeEconomics(context);
    expect(evaluation.status).toBe("available");
    if (evaluation.status !== "available") return;
    expect(evaluation.result.marginPerUnit.value).toBe(0);
    const zeroRecipe = {
      ...baseline,
      item: { ...baseline.item!, productionNeeds: {} },
      marketPrices: { steel: 5 },
    };
    const withoutNeeds = evaluateMarketRecipeEconomics(zeroRecipe);
    expect(withoutNeeds.status).toBe("unavailable");
    expect(html(zeroRecipe)).toContain("No confirmed input recipe is available");
  });

  it("withholds all economics when output or recipe input prices are absent", () => {
    for (const context of [
      { ...baseline, marketPrices: { steel: 10, iron: 2 } },
      { ...baseline, marketPrices: { iron: 2, coal: 3 } },
    ]) {
      const evaluation = evaluateMarketRecipeEconomics(context);
      expect(evaluation.status).toBe("unavailable");
      expect(html(context)).toContain("Recipe-only economics unavailable");
      expect(html(context)).not.toContain("Recipe-only implied spread</span>");
      if (evaluation.status === "unavailable") expect(evaluation.missingPriceCodes).toHaveLength(1);
    }
  });

  it("refuses mismatched/absent configuration and missing input config while preserving observed prices", () => {
    for (const context of [
      {
        itemCode: baseline.itemCode,
        marketPrices: baseline.marketPrices,
        contextGaps: baseline.contextGaps,
        freshness: baseline.freshness,
      },
      { ...baseline, item: { ...baseline.item!, code: "other" } },
      { ...baseline, contextGaps: { ...baseline.contextGaps, itemCodes: ["iron"] } },
    ]) {
      const evaluation = evaluateMarketRecipeEconomics(context);
      expect(evaluation.status).toBe("unavailable");
      expect(html(context)).toContain("Recipe-only economics unavailable");
    }
  });

  it("rejects inherited property prices and malformed numeric inputs safely", () => {
    const protoItem = {
      ...baseline,
      itemCode: "__proto__",
      item: { ...baseline.item!, code: "__proto__", productionNeeds: { iron: 1 } },
      marketPrices: { iron: 2 },
    };
    const evaluation = evaluateMarketRecipeEconomics(protoItem);
    expect(evaluation).toMatchObject({ status: "unavailable", missingPriceCodes: ["__proto__"] });

    for (const context of [
      { ...baseline, marketPrices: { ...baseline.marketPrices, iron: -5 } },
      { ...baseline, item: { ...baseline.item!, productionNeeds: { iron: -2 } } },
      {
        ...baseline,
        marketPrices: { ...baseline.marketPrices, iron: Number.MAX_VALUE, coal: Number.MAX_VALUE },
      },
    ]) {
      expect(evaluateMarketRecipeEconomics(context).status).toBe("unavailable");
    }
  });

  it("does not depend on top orders and contains only selected item config and prices", () => {
    const evaluation = evaluateMarketRecipeEconomics({
      ...baseline,
      contextGaps: { ...baseline.contextGaps, orderBookItemCodes: ["steel"] },
    });
    expect(evaluation.status).toBe("available");
    const rendered = html(baseline);
    expect(rendered).not.toContain("ownerId");
  });
});
