import type {
  EconomyPlannerContextResponse,
  PublicCompanySnapshot,
  SnapshotFreshness,
} from "@warera-lab/domain";

import { formatDisplayNumber } from "./display-format.js";
import { FreshnessPanel } from "./FreshnessPanel.js";

function marketFreshness(context: EconomyPlannerContextResponse): SnapshotFreshness {
  const sources = context.freshness.sources.filter((source) => source.source === "marketPrices");
  return {
    generatedAt: context.freshness.generatedAt,
    hasStaleData: sources.some((source) => source.state === "stale"),
    sources,
  };
}

function currentPrice(
  context: EconomyPlannerContextResponse,
  itemCode: string,
): string | undefined {
  const value = context.marketPrices[itemCode];
  return value === undefined ? undefined : formatDisplayNumber(value, "price");
}

export function CompanyMarketContext({
  company,
  context,
  isLoading,
}: {
  company: PublicCompanySnapshot;
  context: EconomyPlannerContextResponse | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <section
        className="workspace-panel workspace-panel--wide company-market-context"
        aria-labelledby="company-market-context-title"
      >
        <p className="section-kicker">Current-state reference</p>
        <h3 id="company-market-context-title">Current market context</h3>
        <p className="message" role="status">
          Loading current market references for {company.itemCode}…
        </p>
      </section>
    );
  }

  if (!context || context.itemCode !== company.itemCode) {
    return (
      <section
        className="workspace-panel workspace-panel--wide company-market-context"
        aria-labelledby="company-market-context-title"
      >
        <p className="section-kicker">Current-state reference</p>
        <h3 id="company-market-context-title">Current market context</h3>
        <p className="message message--warning" role="status">
          Normalized current market context is unavailable for this selected company right now. No
          output or input prices are substituted.
        </p>
      </section>
    );
  }

  const inputs = Object.entries(context.item?.productionNeeds ?? {});
  const relevantItemCodes = [company.itemCode, ...inputs.map(([inputCode]) => inputCode)];
  const missingPriceItemCodes = relevantItemCodes.filter(
    (itemCode, index) =>
      relevantItemCodes.indexOf(itemCode) === index && context.marketPrices[itemCode] === undefined,
  );
  const hasAnyCurrentPrice = relevantItemCodes.some(
    (itemCode) => context.marketPrices[itemCode] !== undefined,
  );
  const outputPrice = currentPrice(context, company.itemCode);

  return (
    <section
      className="workspace-panel workspace-panel--wide company-market-context"
      aria-labelledby="company-market-context-title"
    >
      <div className="section-heading">
        <div>
          <p className="section-kicker">Current-state reference</p>
          <h3 id="company-market-context-title">Current market context</h3>
          <p className="muted">
            A concise current-price reference for this company&apos;s output and required recipe
            inputs. It is not a market dashboard, trend view, or profitability recommendation.
          </p>
        </div>
        <span className="badge">Current prices only</span>
      </div>

      <div className="market-reference-grid">
        <div className="market-reference-card">
          <span className="operating-context-label">Output item</span>
          <strong>{company.itemCode}</strong>
          <dl className="operating-reference-list">
            <div>
              <dt>Current observed price</dt>
              <dd>{outputPrice ?? "No current price"}</dd>
            </div>
          </dl>
        </div>

        <div className="market-reference-card market-reference-card--inputs">
          <span className="operating-context-label">Required production inputs</span>
          {context.item ? (
            inputs.length > 0 ? (
              <ul className="market-price-list">
                {inputs.map(([inputCode, quantity]) => {
                  const price = currentPrice(context, inputCode);
                  return (
                    <li key={inputCode}>
                      <div>
                        <strong>{inputCode}</strong>
                        <small>Recipe quantity {formatDisplayNumber(quantity, "quantity")}</small>
                      </div>
                      <div className="market-price-value">
                        <span>Current observed price</span>
                        <strong>{price ?? "No current price"}</strong>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted">
                No required production inputs are listed in the normalized item configuration.
              </p>
            )
          ) : (
            <p className="message message--warning">
              Required input-price context cannot be listed because {company.itemCode} is absent
              from the normalized item configuration.
            </p>
          )}
        </div>
      </div>

      {!hasAnyCurrentPrice ? (
        <p className="message message--warning" role="status">
          No normalized current prices are available for this company&apos;s output or required
          inputs. Company Lab leaves those values unavailable instead of substituting assumptions.
        </p>
      ) : missingPriceItemCodes.length > 0 ? (
        <p className="message message--warning" role="status">
          Missing current price references: {missingPriceItemCodes.join(", ")}. No replacement
          values were invented.
        </p>
      ) : null}

      <FreshnessPanel freshness={marketFreshness(context)} title="Market prices" />
    </section>
  );
}
