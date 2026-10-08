import type { MarketLabItemResponse } from "@warera-lab/domain";
import {
  MarketMarginSimulationError,
  simulateMarketMargin,
  type MarketMarginSimulationResult,
} from "@warera-lab/simulation-core";

export type MarketRecipeEconomics =
  | { status: "available"; result: MarketMarginSimulationResult }
  | { status: "unavailable"; reason: string; missingPriceCodes: string[] };

export function evaluateMarketRecipeEconomics(
  context: MarketLabItemResponse,
): MarketRecipeEconomics {
  const item = context.item;
  if (!item || item.code !== context.itemCode || !item.productionNeeds) {
    return {
      status: "unavailable",
      reason:
        "A matching normalized item recipe is not available. No recipe-only economics can be derived.",
      missingPriceCodes: [],
    };
  }

  // The normalization layer currently maps an absent upstream productionNeeds
  // to {}. Therefore an empty record is not evidence of a genuine zero-input
  // recipe; withhold the derivation rather than silently reporting zero cost.
  if (Object.keys(item.productionNeeds).length === 0) {
    return {
      status: "unavailable",
      reason:
        "No confirmed input recipe is available. The normalized source cannot distinguish an empty recipe from omitted upstream requirements, so zero input cost is not assumed.",
      missingPriceCodes: [],
    };
  }

  const missingConfiguration = context.contextGaps.itemCodes.filter(
    (code) => code === context.itemCode || Object.hasOwn(item.productionNeeds, code),
  );
  if (missingConfiguration.length > 0) {
    return {
      status: "unavailable",
      reason:
        "Some recipe inputs are absent from the normalized item configuration: " +
        missingConfiguration.join(", ") +
        ".",
      missingPriceCodes: [],
    };
  }

  const codes = [context.itemCode, ...Object.keys(item.productionNeeds)];
  const missingPriceCodes = [...new Set(codes)].filter(
    (code) =>
      !Object.hasOwn(context.marketPrices, code) || context.marketPrices[code] === undefined,
  );
  if (missingPriceCodes.length > 0) {
    return {
      status: "unavailable",
      reason:
        "Required current market prices are missing. No recipe-only spread or break-even value is calculated.",
      missingPriceCodes,
    };
  }

  try {
    const result = simulateMarketMargin({
      item,
      marketPrices: context.marketPrices,
      quantity: 1,
    });
    const totals = [
      result.recipeInputCost.value,
      result.grossRevenue.value,
      result.breakEvenOutputPrice.value,
      result.marginPerUnit.value,
    ];
    if (totals.some((value) => !Number.isFinite(value))) {
      return {
        status: "unavailable",
        reason: "Recipe calculation returned a non-finite value. The derivation is withheld.",
        missingPriceCodes: [],
      };
    }
    return { status: "available", result };
  } catch (error) {
    if (!(error instanceof MarketMarginSimulationError)) throw error;
    return {
      status: "unavailable",
      reason:
        "The observed recipe or price inputs cannot be evaluated safely (" + error.code + ").",
      missingPriceCodes: [],
    };
  }
}
