import type { MarketLabItemResponse } from "@warera-lab/domain";

import { formatDisplayNumber } from "./display-format.js";
import { evaluateMarketRecipeEconomics } from "./market-recipe-economics.js";

export function MarketRecipeEconomics({ context }: { context: MarketLabItemResponse }) {
  const evaluation = evaluateMarketRecipeEconomics(context);
  const sources = context.freshness.sources.filter(
    (source) => source.source === "gameConfig" || source.source === "marketPrices",
  );
  return (
    <section className="market-recipe-economics" aria-labelledby="market-recipe-economics-title">
      <p className="section-kicker">Derived · one output unit</p>
      <h4 id="market-recipe-economics-title">Recipe-only current economics</h4>
      <p className="muted">
        One nominal output unit at current observed prices. Uses documented recipe quantities only;
        labour, taxes, production time, fees, transport, bonuses, and all other unverified costs or
        game mechanics are excluded. This is not realized profit, an executable quote, or a
        recommendation.
      </p>
      {evaluation.status === "unavailable" ? (
        <p className="message message--warning" role="status">
          Recipe-only economics unavailable. {evaluation.reason}{" "}
          {evaluation.missingPriceCodes.length > 0
            ? "Missing price codes: " + evaluation.missingPriceCodes.join(", ") + "."
            : ""}
        </p>
      ) : (
        <>
          <div
            className="market-recipe-economics__metrics"
            aria-label="Recipe-only derived amounts"
          >
            <article>
              <span>Current output value</span>
              <strong>{formatDisplayNumber(evaluation.result.grossRevenue.value, "price")}</strong>
            </article>
            <article>
              <span>Recipe input cost</span>
              <strong>
                {formatDisplayNumber(evaluation.result.recipeInputCost.value, "cost")}
              </strong>
            </article>
            <article>
              <span>Recipe-only break-even output price</span>
              <strong>
                {formatDisplayNumber(evaluation.result.breakEvenOutputPrice.value, "price")}
              </strong>
            </article>
            <article>
              <span>Recipe-only implied spread</span>
              <strong>
                {formatDisplayNumber(evaluation.result.marginPerUnit.value, "margin")}
              </strong>
            </article>
          </div>
          <p className="muted">
            A negative spread means the currently observed output reference is below the current
            recipe input-cost reference, before excluded costs. A positive spread is not a profit
            estimate.
          </p>
          <details className="calculation-details">
            <summary>How is this recipe-only spread calculated?</summary>
            <div>
              <p>
                Quantity is assumed to be exactly one nominal output unit. Current output value = 1
                × observed output price. Recipe input cost = Σ (normalized required input quantity ×
                current observed input unit price). Recipe-only break-even output price = recipe
                input cost ÷ 1. Recipe-only implied spread = current output value − recipe input
                cost. No output/input price overrides or assumed extra costs are passed to the
                shared simulator.
              </p>
              <dl>
                <div>
                  <dt>Calculation version</dt>
                  <dd>{evaluation.result.version}</dd>
                </div>
                <div>
                  <dt>Output quantity</dt>
                  <dd>1 · assumed</dd>
                </div>
                <div>
                  <dt>Current prices</dt>
                  <dd>Observed · no overrides</dd>
                </div>
                <div>
                  <dt>Recipe quantities</dt>
                  <dd>Normalized game configuration</dd>
                </div>
                <div>
                  <dt>Extra costs</dt>
                  <dd>Excluded · not verified, not asserted to be zero</dd>
                </div>
                <div>
                  <dt>Data freshness</dt>
                  <dd>
                    {context.freshness.hasStaleData
                      ? "Stale source present"
                      : "See source timestamps below"}
                  </dd>
                </div>
              </dl>
              <ul
                className="market-recipe-breakdown"
                aria-label="Exact recipe component calculations"
              >
                {Object.values(evaluation.result.recipeInputs).map((input) => (
                  <li key={input.itemCode}>
                    <strong>{input.itemCode}</strong> —{" "}
                    {formatDisplayNumber(input.requiredPerOutputUnit.value, "quantity")}
                    {" × "}
                    {formatDisplayNumber(input.effectivePrice.value, "price")}
                    {" = "}
                    {formatDisplayNumber(input.cost.value, "cost")}
                    {" · recipe observed, cost derived"}
                  </li>
                ))}
              </ul>

              <p className="muted">
                Recipe and price sources:{" "}
                {sources
                  .map(
                    (source) =>
                      source.source +
                      " (" +
                      source.state +
                      ", retrieved " +
                      source.retrievedAt +
                      ")",
                  )
                  .join("; ") || "No source timestamps available"}
                .
              </p>
              <details className="raw-details">
                <summary>Advanced / exact calculation inputs and outputs</summary>
                <pre>
                  {JSON.stringify(
                    {
                      calculationVersion: evaluation.result.version,
                      itemCode: context.itemCode,
                      outputQuantity: { value: 1, provenance: "assumed" },
                      recipe: context.item?.productionNeeds,
                      observedMarketPrices: Object.fromEntries(
                        [context.itemCode, ...Object.keys(context.item?.productionNeeds ?? {})]
                          .filter((code) => Object.hasOwn(context.marketPrices, code))
                          .map((code) => [code, context.marketPrices[code]]),
                      ),
                      recipeInputCost: evaluation.result.recipeInputCost,
                      outputValue: evaluation.result.grossRevenue,
                      breakEvenOutputPrice: evaluation.result.breakEvenOutputPrice,
                      recipeOnlyImpliedSpread: evaluation.result.marginPerUnit,
                      sourceFreshness: sources,
                      excludedCosts: [
                        "labour",
                        "taxes",
                        "production time",
                        "fees",
                        "transport",
                        "bonuses",
                        "other unverified mechanics",
                      ],
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
