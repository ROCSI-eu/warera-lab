import type { ItemEconomyConfig, MarketPriceMap, ValueWithProvenance } from "@warera-lab/domain";

export const marketMarginSimulatorVersion = "market-margin-v1" as const;
export const marketMarginComparisonVersion = "market-margin-comparison-v1" as const;

export type MarketMarginSimulationErrorCode =
  | "INVALID_QUANTITY"
  | "INVALID_PRICE"
  | "INVALID_COST"
  | "INVALID_RECIPE_QUANTITY"
  | "MISSING_OUTPUT_PRICE"
  | "MISSING_INPUT_PRICE"
  | "UNUSED_INPUT_PRICE_OVERRIDE"
  | "ITEM_MISMATCH";

export class MarketMarginSimulationError extends Error {
  readonly code: MarketMarginSimulationErrorCode;
  readonly subject?: string;

  constructor(
    message: string,
    details: { code: MarketMarginSimulationErrorCode; subject?: string },
  ) {
    super(message);
    this.name = "MarketMarginSimulationError";
    this.code = details.code;
    if (details.subject !== undefined) this.subject = details.subject;
  }
}

export interface MarketMarginSimulationInput {
  item: ItemEconomyConfig;
  marketPrices: MarketPriceMap;
  quantity: number;
  outputPriceOverride?: number;
  inputPriceOverrides?: Record<string, number>;
  assumedLabourCostTotal?: number;
  assumedOtherCostTotal?: number;
}

export interface MarketMarginRecipeInputResult {
  itemCode: string;
  requiredPerOutputUnit: ValueWithProvenance<number>;
  totalInputQuantity: ValueWithProvenance<number>;
  marketPrice?: ValueWithProvenance<number>;
  effectivePrice: ValueWithProvenance<number>;
  cost: ValueWithProvenance<number>;
}

export interface MarketMarginSimulationResult {
  version: typeof marketMarginSimulatorVersion;
  itemCode: ValueWithProvenance<string>;
  quantity: ValueWithProvenance<number>;
  liveOutputPriceBaseline: ValueWithProvenance<number>;
  outputPrice: ValueWithProvenance<number>;
  outputPriceDeltaFromLive: ValueWithProvenance<number>;
  recipeInputs: Record<string, MarketMarginRecipeInputResult>;
  recipeInputCost: ValueWithProvenance<number>;
  assumedLabourCostTotal?: ValueWithProvenance<number>;
  assumedOtherCostTotal?: ValueWithProvenance<number>;
  explicitAssumedCostTotal: ValueWithProvenance<number>;
  grossRevenue: ValueWithProvenance<number>;
  grossRevenueAtLiveOutputPrice: ValueWithProvenance<number>;
  grossMargin: ValueWithProvenance<number>;
  grossMarginAtLiveOutputPrice: ValueWithProvenance<number>;
  grossMarginDeltaVsLiveOutputPrice: ValueWithProvenance<number>;
  marginPerUnit: ValueWithProvenance<number>;
  breakEvenOutputPrice: ValueWithProvenance<number>;
}

export interface MarketMarginScenarioComparison {
  version: typeof marketMarginComparisonVersion;
  itemCode: ValueWithProvenance<string>;
  outputPriceDelta: ValueWithProvenance<number>;
  quantityDelta: ValueWithProvenance<number>;
  recipeInputCostDelta: ValueWithProvenance<number>;
  explicitAssumedCostDelta: ValueWithProvenance<number>;
  grossRevenueDelta: ValueWithProvenance<number>;
  grossMarginDelta: ValueWithProvenance<number>;
  marginPerUnitDelta: ValueWithProvenance<number>;
  breakEvenOutputPriceDelta: ValueWithProvenance<number>;
}

function value<T>(
  input: T,
  provenance: ValueWithProvenance<T>["provenance"],
): ValueWithProvenance<T> {
  return { value: input, provenance };
}

function derived(input: number): ValueWithProvenance<number> {
  return value(input, "derived");
}

function requireFiniteNumber(
  input: number,
  options: {
    code: "INVALID_QUANTITY" | "INVALID_PRICE" | "INVALID_COST" | "INVALID_RECIPE_QUANTITY";
    subject: string;
    positive?: boolean;
  },
): number {
  const invalid = !Number.isFinite(input) || (options.positive === true ? input <= 0 : input < 0);

  if (invalid) {
    throw new MarketMarginSimulationError(
      `${options.subject} must be a finite ${options.positive === true ? "positive" : "non-negative"} number.`,
      { code: options.code, subject: options.subject },
    );
  }

  return input;
}

function getObservedMarketPrice(
  marketPrices: MarketPriceMap,
  itemCode: string,
  missingCode: "MISSING_OUTPUT_PRICE" | "MISSING_INPUT_PRICE",
): number {
  const price = marketPrices[itemCode];
  if (price === undefined) {
    throw new MarketMarginSimulationError(`No live market price is available for ${itemCode}.`, {
      code: missingCode,
      subject: itemCode,
    });
  }

  return requireFiniteNumber(price, {
    code: "INVALID_PRICE",
    subject: `${itemCode} live market price`,
  });
}

function hasOwnPriceOverride(
  overrides: Record<string, number> | undefined,
  itemCode: string,
): boolean {
  return overrides !== undefined && Object.prototype.hasOwnProperty.call(overrides, itemCode);
}

function validateInputPriceOverrides(
  overrides: Record<string, number> | undefined,
  productionNeeds: Record<string, number>,
): void {
  if (overrides === undefined) return;

  for (const [itemCode, price] of Object.entries(overrides)) {
    if (!Object.prototype.hasOwnProperty.call(productionNeeds, itemCode)) {
      throw new MarketMarginSimulationError(
        `Input-price override for ${itemCode} is not used by the selected item's recipe.`,
        { code: "UNUSED_INPUT_PRICE_OVERRIDE", subject: itemCode },
      );
    }

    requireFiniteNumber(price, {
      code: "INVALID_PRICE",
      subject: `${itemCode} input-price override`,
    });
  }
}

export function simulateMarketMargin(
  input: MarketMarginSimulationInput,
): MarketMarginSimulationResult {
  const quantity = requireFiniteNumber(input.quantity, {
    code: "INVALID_QUANTITY",
    subject: "quantity",
    positive: true,
  });
  const liveOutputPrice = getObservedMarketPrice(
    input.marketPrices,
    input.item.code,
    "MISSING_OUTPUT_PRICE",
  );
  const outputPrice =
    input.outputPriceOverride === undefined
      ? liveOutputPrice
      : requireFiniteNumber(input.outputPriceOverride, {
          code: "INVALID_PRICE",
          subject: `${input.item.code} output-price override`,
        });

  validateInputPriceOverrides(input.inputPriceOverrides, input.item.productionNeeds);

  // Valid item codes may include object-prototype keys such as "__proto__".
  // Use a null-prototype record so every computed component remains enumerable.
  const recipeInputs: Record<string, MarketMarginRecipeInputResult> = Object.create(null) as Record<
    string,
    MarketMarginRecipeInputResult
  >;
  let recipeInputCost = 0;

  for (const [inputItemCode, requiredPerOutputUnitRaw] of Object.entries(
    input.item.productionNeeds,
  )) {
    const requiredPerOutputUnit = requireFiniteNumber(requiredPerOutputUnitRaw, {
      code: "INVALID_RECIPE_QUANTITY",
      subject: `${inputItemCode} recipe quantity`,
    });
    const totalInputQuantity = requiredPerOutputUnit * quantity;
    const hasOverride = hasOwnPriceOverride(input.inputPriceOverrides, inputItemCode);
    const marketPriceRaw = input.marketPrices[inputItemCode];
    const marketPrice =
      marketPriceRaw === undefined
        ? undefined
        : requireFiniteNumber(marketPriceRaw, {
            code: "INVALID_PRICE",
            subject: `${inputItemCode} live market price`,
          });

    if (!hasOverride && marketPrice === undefined) {
      throw new MarketMarginSimulationError(
        `No live market price or explicit override is available for recipe input ${inputItemCode}.`,
        { code: "MISSING_INPUT_PRICE", subject: inputItemCode },
      );
    }

    const effectivePrice = hasOverride
      ? requireFiniteNumber(input.inputPriceOverrides![inputItemCode]!, {
          code: "INVALID_PRICE",
          subject: `${inputItemCode} input-price override`,
        })
      : marketPrice!;
    const cost = totalInputQuantity * effectivePrice;
    recipeInputCost += cost;

    recipeInputs[inputItemCode] = {
      itemCode: inputItemCode,
      requiredPerOutputUnit: value(requiredPerOutputUnit, "observed"),
      totalInputQuantity: derived(totalInputQuantity),
      ...(marketPrice === undefined ? {} : { marketPrice: value(marketPrice, "observed") }),
      effectivePrice: value(effectivePrice, hasOverride ? "overridden" : "observed"),
      cost: derived(cost),
    };
  }

  const assumedLabourCost =
    input.assumedLabourCostTotal === undefined
      ? undefined
      : requireFiniteNumber(input.assumedLabourCostTotal, {
          code: "INVALID_COST",
          subject: "assumed labour cost total",
        });
  const assumedOtherCost =
    input.assumedOtherCostTotal === undefined
      ? undefined
      : requireFiniteNumber(input.assumedOtherCostTotal, {
          code: "INVALID_COST",
          subject: "assumed other cost total",
        });
  const explicitAssumedCostTotal = (assumedLabourCost ?? 0) + (assumedOtherCost ?? 0);
  const grossRevenue = quantity * outputPrice;
  const grossRevenueAtLiveOutputPrice = quantity * liveOutputPrice;
  const grossMargin = grossRevenue - recipeInputCost - explicitAssumedCostTotal;
  const grossMarginAtLiveOutputPrice =
    grossRevenueAtLiveOutputPrice - recipeInputCost - explicitAssumedCostTotal;

  return {
    version: marketMarginSimulatorVersion,
    itemCode: value(input.item.code, "observed"),
    quantity: value(quantity, "assumed"),
    liveOutputPriceBaseline: value(liveOutputPrice, "observed"),
    outputPrice: value(
      outputPrice,
      input.outputPriceOverride === undefined ? "observed" : "overridden",
    ),
    outputPriceDeltaFromLive: derived(outputPrice - liveOutputPrice),
    recipeInputs,
    recipeInputCost: derived(recipeInputCost),
    ...(assumedLabourCost === undefined
      ? {}
      : { assumedLabourCostTotal: value(assumedLabourCost, "assumed") }),
    ...(assumedOtherCost === undefined
      ? {}
      : { assumedOtherCostTotal: value(assumedOtherCost, "assumed") }),
    explicitAssumedCostTotal: derived(explicitAssumedCostTotal),
    grossRevenue: derived(grossRevenue),
    grossRevenueAtLiveOutputPrice: derived(grossRevenueAtLiveOutputPrice),
    grossMargin: derived(grossMargin),
    grossMarginAtLiveOutputPrice: derived(grossMarginAtLiveOutputPrice),
    grossMarginDeltaVsLiveOutputPrice: derived(grossMargin - grossMarginAtLiveOutputPrice),
    marginPerUnit: derived(grossMargin / quantity),
    breakEvenOutputPrice: derived((recipeInputCost + explicitAssumedCostTotal) / quantity),
  };
}

export function compareMarketMarginScenarios(
  from: MarketMarginSimulationResult,
  to: MarketMarginSimulationResult,
): MarketMarginScenarioComparison {
  if (from.itemCode.value !== to.itemCode.value) {
    throw new MarketMarginSimulationError(
      `Cannot compare market-margin scenarios for different items: ${from.itemCode.value} and ${to.itemCode.value}.`,
      { code: "ITEM_MISMATCH", subject: `${from.itemCode.value}:${to.itemCode.value}` },
    );
  }

  return {
    version: marketMarginComparisonVersion,
    itemCode: value(from.itemCode.value, "derived"),
    outputPriceDelta: derived(to.outputPrice.value - from.outputPrice.value),
    quantityDelta: derived(to.quantity.value - from.quantity.value),
    recipeInputCostDelta: derived(to.recipeInputCost.value - from.recipeInputCost.value),
    explicitAssumedCostDelta: derived(
      to.explicitAssumedCostTotal.value - from.explicitAssumedCostTotal.value,
    ),
    grossRevenueDelta: derived(to.grossRevenue.value - from.grossRevenue.value),
    grossMarginDelta: derived(to.grossMargin.value - from.grossMargin.value),
    marginPerUnitDelta: derived(to.marginPerUnit.value - from.marginPerUnit.value),
    breakEvenOutputPriceDelta: derived(
      to.breakEvenOutputPrice.value - from.breakEvenOutputPrice.value,
    ),
  };
}
