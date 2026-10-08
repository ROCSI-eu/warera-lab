import type { ItemEconomyConfig } from "@warera-lab/domain";
import { describe, expect, it } from "vitest";

import {
  MarketMarginSimulationError,
  compareMarketMarginScenarios,
  simulateMarketMargin,
} from "./market-margin-simulator.js";

const steel: ItemEconomyConfig = {
  code: "steel",
  type: "resource",
  rarity: "common",
  productionNeeds: {
    iron: 2,
    coal: 1,
  },
  isTradable: true,
};

describe("simulateMarketMargin", () => {
  it("calculates a live-price baseline with transparent generic arithmetic", () => {
    const result = simulateMarketMargin({
      item: steel,
      marketPrices: {
        steel: 10,
        iron: 2,
        coal: 3,
      },
      quantity: 10,
    });

    const iron = result.recipeInputs.iron!;

    expect(result.version).toBe("market-margin-v1");
    expect(result.quantity).toEqual({ value: 10, provenance: "assumed" });
    expect(result.liveOutputPriceBaseline).toEqual({ value: 10, provenance: "observed" });
    expect(result.outputPrice).toEqual({ value: 10, provenance: "observed" });
    expect(iron).toMatchObject({
      requiredPerOutputUnit: { value: 2, provenance: "observed" },
      totalInputQuantity: { value: 20, provenance: "derived" },
      marketPrice: { value: 2, provenance: "observed" },
      effectivePrice: { value: 2, provenance: "observed" },
      cost: { value: 40, provenance: "derived" },
    });
    expect(result.recipeInputCost.value).toBe(70);
    expect(result.explicitAssumedCostTotal.value).toBe(0);
    expect(result.grossRevenue.value).toBe(100);
    expect(result.grossMargin.value).toBe(30);
    expect(result.marginPerUnit.value).toBe(3);
    expect(result.breakEvenOutputPrice.value).toBe(7);
    expect(result.outputPriceDeltaFromLive.value).toBe(0);
    expect(result.grossMarginDeltaVsLiveOutputPrice.value).toBe(0);
  });

  it("preserves prototype-shaped recipe item codes as enumerable cost components", () => {
    const prototypeInput = Object.fromEntries([["__proto__", 2]]);
    const prices = Object.fromEntries([
      ["steel", 10],
      ["__proto__", 3],
    ]);
    const result = simulateMarketMargin({
      item: { ...steel, productionNeeds: prototypeInput },
      marketPrices: prices,
      quantity: 1,
    });

    expect(Object.keys(result.recipeInputs)).toEqual(["__proto__"]);
    expect(Object.values(result.recipeInputs)).toHaveLength(1);
    expect(result.recipeInputs["__proto__"]).toMatchObject({
      itemCode: "__proto__",
      cost: { value: 6, provenance: "derived" },
    });
    expect(result.recipeInputCost.value).toBe(6);
    expect(
      Object.values(result.recipeInputs).reduce((sum, entry) => sum + entry.cost.value, 0),
    ).toBe(result.recipeInputCost.value);
  });

  it("marks output/input overrides and optional cost inputs explicitly", () => {
    const result = simulateMarketMargin({
      item: steel,
      marketPrices: {
        steel: 10,
        iron: 2,
        coal: 3,
      },
      quantity: 10,
      outputPriceOverride: 12,
      inputPriceOverrides: {
        iron: 3,
      },
      assumedLabourCostTotal: 10,
      assumedOtherCostTotal: 5,
    });

    const iron = result.recipeInputs.iron!;

    expect(result.outputPrice).toEqual({ value: 12, provenance: "overridden" });
    expect(result.outputPriceDeltaFromLive.value).toBe(2);
    expect(iron.effectivePrice).toEqual({
      value: 3,
      provenance: "overridden",
    });
    expect(iron.marketPrice).toEqual({
      value: 2,
      provenance: "observed",
    });
    expect(result.assumedLabourCostTotal).toEqual({ value: 10, provenance: "assumed" });
    expect(result.assumedOtherCostTotal).toEqual({ value: 5, provenance: "assumed" });
    expect(result.explicitAssumedCostTotal.value).toBe(15);
    expect(result.recipeInputCost.value).toBe(90);
    expect(result.grossRevenue.value).toBe(120);
    expect(result.grossRevenueAtLiveOutputPrice.value).toBe(100);
    expect(result.grossMargin.value).toBe(15);
    expect(result.grossMarginAtLiveOutputPrice.value).toBe(-5);
    expect(result.grossMarginDeltaVsLiveOutputPrice.value).toBe(20);
    expect(result.marginPerUnit.value).toBe(1.5);
    expect(result.breakEvenOutputPrice.value).toBe(10.5);
  });

  it("allows an explicit recipe-price override when the live input price is missing", () => {
    const result = simulateMarketMargin({
      item: steel,
      marketPrices: {
        steel: 10,
        coal: 3,
      },
      inputPriceOverrides: {
        iron: 2.5,
      },
      quantity: 4,
    });

    const iron = result.recipeInputs.iron!;

    expect(iron.marketPrice).toBeUndefined();
    expect(iron.effectivePrice).toEqual({
      value: 2.5,
      provenance: "overridden",
    });
    expect(result.recipeInputCost.value).toBe(32);
  });

  it("fails explicitly when a required recipe input has neither a market price nor override", () => {
    try {
      simulateMarketMargin({
        item: steel,
        marketPrices: {
          steel: 10,
          iron: 2,
        },
        quantity: 5,
      });
      throw new Error("Expected missing recipe input price to fail");
    } catch (error) {
      expect(error).toMatchObject({
        code: "MISSING_INPUT_PRICE",
        subject: "coal",
      });
    }
  });

  it("requires the live output-price baseline even when an output override is supplied", () => {
    expect(() =>
      simulateMarketMargin({
        item: steel,
        marketPrices: {
          iron: 2,
          coal: 3,
        },
        outputPriceOverride: 12,
        quantity: 5,
      }),
    ).toThrowError(MarketMarginSimulationError);

    try {
      simulateMarketMargin({
        item: steel,
        marketPrices: {
          iron: 2,
          coal: 3,
        },
        outputPriceOverride: 12,
        quantity: 5,
      });
    } catch (error) {
      expect(error).toMatchObject({
        code: "MISSING_OUTPUT_PRICE",
        subject: "steel",
      });
    }
  });

  it("rejects unused input-price overrides", () => {
    try {
      simulateMarketMargin({
        item: steel,
        marketPrices: {
          steel: 10,
          iron: 2,
          coal: 3,
        },
        inputPriceOverrides: {
          wood: 4,
        },
        quantity: 5,
      });
      throw new Error("Expected unused input-price override to fail");
    } catch (error) {
      expect(error).toMatchObject({
        code: "UNUSED_INPUT_PRICE_OVERRIDE",
        subject: "wood",
      });
    }
  });

  it("rejects non-positive quantities explicitly", () => {
    try {
      simulateMarketMargin({
        item: steel,
        marketPrices: {
          steel: 10,
          iron: 2,
          coal: 3,
        },
        quantity: 0,
      });
      throw new Error("Expected invalid quantity to fail");
    } catch (error) {
      expect(error).toMatchObject({
        code: "INVALID_QUANTITY",
      });
    }
  });
});

describe("compareMarketMarginScenarios", () => {
  it("returns deterministic scenario-to-scenario deltas", () => {
    const baseline = simulateMarketMargin({
      item: steel,
      marketPrices: {
        steel: 10,
        iron: 2,
        coal: 3,
      },
      quantity: 10,
    });
    const scenario = simulateMarketMargin({
      item: steel,
      marketPrices: {
        steel: 10,
        iron: 2,
        coal: 3,
      },
      quantity: 12,
      outputPriceOverride: 11,
      assumedOtherCostTotal: 6,
    });

    const comparison = compareMarketMarginScenarios(baseline, scenario);

    expect(comparison.version).toBe("market-margin-comparison-v1");
    expect(comparison.itemCode).toEqual({ value: "steel", provenance: "derived" });
    expect(comparison.outputPriceDelta.value).toBe(1);
    expect(comparison.quantityDelta.value).toBe(2);
    expect(comparison.recipeInputCostDelta.value).toBe(14);
    expect(comparison.explicitAssumedCostDelta.value).toBe(6);
    expect(comparison.grossRevenueDelta.value).toBe(32);
    expect(comparison.grossMarginDelta.value).toBe(12);
    expect(comparison.marginPerUnitDelta.value).toBe(0.5);
    expect(comparison.breakEvenOutputPriceDelta.value).toBe(0.5);
  });

  it("rejects comparisons between different output items", () => {
    const first = simulateMarketMargin({
      item: steel,
      marketPrices: { steel: 10, iron: 2, coal: 3 },
      quantity: 1,
    });
    const second = simulateMarketMargin({
      item: {
        ...steel,
        code: "tools",
      },
      marketPrices: { tools: 20, iron: 2, coal: 3 },
      quantity: 1,
    });

    try {
      compareMarketMarginScenarios(first, second);
      throw new Error("Expected item mismatch to fail");
    } catch (error) {
      expect(error).toMatchObject({
        code: "ITEM_MISMATCH",
        subject: "steel:tools",
      });
    }
  });
});
