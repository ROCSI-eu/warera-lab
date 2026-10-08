import type {
  MarketLabItemResponse,
  MarketLabOverviewResponse,
  MarketOrder,
} from "@warera-lab/domain";
import { useState } from "react";

import { formatDisplayNumber } from "./display-format.js";
import { FreshnessPanel } from "./FreshnessPanel.js";
import { MarketRecipeEconomics } from "./MarketRecipeEconomics.js";

interface MarketLabShellProps {
  itemCode?: string;
  navigationMessage?: string;
  overview?: MarketLabOverviewResponse;
  item?: MarketLabItemResponse;
  overviewError?: string;
  itemError?: string;
  isLoadingOverview?: boolean;
  isLoadingItem?: boolean;
  itemHref?: (code?: string) => string;
  onRefresh?: () => void;
}

function priceLabel(price: number | undefined): string {
  return price === undefined ? "No current price" : formatDisplayNumber(price, "price");
}

// Item identifiers can be valid object-prototype-shaped strings.
// An inherited property is never an observed market value.
function observedPrice(item: MarketLabItemResponse, code: string): number | undefined {
  return Object.hasOwn(item.marketPrices, code) ? item.marketPrices[code] : undefined;
}

function Orders({ orders, side }: { orders: MarketOrder[]; side: "buy" | "sell" }) {
  return (
    <section className="market-order-side" aria-label={"Current " + side + " orders"}>
      <div className="market-order-side__heading">
        <h4>{side === "buy" ? "Buy orders" : "Sell orders"}</h4>
        <small>{orders.length} shown · maximum 10</small>
      </div>
      {orders.length ? (
        <ol className="market-order-list">
          {orders.map((order) => (
            <li key={order.id}>
              <span>
                Quantity <strong>{formatDisplayNumber(order.quantity, "quantity")}</strong>
              </span>
              <span>
                Unit price <strong>{formatDisplayNumber(order.price, "price")}</strong>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">No current {side} orders were returned.</p>
      )}
    </section>
  );
}

export function MarketLabShell({
  itemCode,
  navigationMessage,
  overview,
  item,
  overviewError,
  itemError,
  isLoadingOverview = false,
  isLoadingItem = false,
  itemHref = () => "/?lab=market",
  onRefresh,
}: MarketLabShellProps) {
  const [filter, setFilter] = useState("");
  const normalizedFilter = filter.trim().toLocaleLowerCase();
  const visible =
    overview?.items.filter((candidate) =>
      [candidate.code, candidate.type, candidate.rarity].some((value) =>
        value.toLocaleLowerCase().includes(normalizedFilter),
      ),
    ) ?? [];
  const inputs = Object.entries(item?.item?.productionNeeds ?? {});

  return (
    <section className="workspace market-lab" aria-labelledby="market-lab-title">
      {navigationMessage ? (
        <p className="message message--warning" role="status">
          {navigationMessage}
        </p>
      ) : null}
      <div className="workspace-heading">
        <div>
          <p className="section-kicker">Current-state market module</p>
          <h2 id="market-lab-title">Market Lab</h2>
          <p className="muted">
            Browse normalized public item prices and inspect recipes or current orders. This is a
            snapshot, not a price history, valuation, or recommendation.
          </p>
        </div>
        <div className="workspace-header-actions">
          <span className="badge">Current state only</span>
          {onRefresh ? (
            <button
              className="refresh-button"
              type="button"
              onClick={onRefresh}
              disabled={isLoadingOverview || isLoadingItem}
            >
              {isLoadingOverview || isLoadingItem ? "Loading market…" : "Refresh market"}
            </button>
          ) : null}
        </div>
      </div>
      <div className="market-lab-grid">
        <section
          className="workspace-panel market-catalogue"
          aria-labelledby="market-catalogue-title"
        >
          <div className="section-heading">
            <div>
              <p className="section-kicker">Explore items</p>
              <h3 id="market-catalogue-title">Current item overview</h3>
            </div>
            {overview ? <span className="badge">{overview.items.length} items</span> : null}
          </div>
          <label className="market-filter-label" htmlFor="market-item-filter">
            Filter items by code, type, or rarity
          </label>
          <input
            id="market-item-filter"
            className="market-filter"
            type="search"
            autoComplete="off"
            value={filter}
            onChange={(event) => setFilter(event.currentTarget.value)}
            placeholder="Find an item"
          />
          {isLoadingOverview ? (
            <p className="message" role="status">
              Loading current items and prices…
            </p>
          ) : null}
          {overviewError ? (
            <p className="message message--error" role="alert">
              {overviewError}
            </p>
          ) : null}
          {overview && overview.items.length === 0 ? (
            <p className="message message--warning" role="status">
              No current items were returned by the normalized catalogue. No prices can be listed.
            </p>
          ) : null}
          {overview && overview.items.length > 0 && visible.length === 0 ? (
            <p className="message" role="status">
              No items match this filter. Try another code or type.
            </p>
          ) : null}
          {visible.length > 0 ? (
            <ul className="market-catalogue-list" aria-label="Browse current market items">
              {visible.map((candidate) => (
                <li key={candidate.code}>
                  <a
                    href={itemHref(candidate.code)}
                    className={
                      "market-item-link" +
                      (candidate.code === itemCode ? " market-item-link--selected" : "")
                    }
                    aria-current={candidate.code === itemCode ? "true" : undefined}
                  >
                    <span className="market-item-link__identity">
                      <strong>{candidate.code}</strong>
                      <small>
                        {candidate.type} · {candidate.rarity}
                        {candidate.isTradable === false ? " · Not tradable" : ""}
                      </small>
                    </span>
                    <span className="market-item-link__price">
                      <small>Current price</small>
                      <strong>{priceLabel(candidate.currentPrice)}</strong>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          {overview && overview.contextGaps.marketPriceItemCodes.length > 0 ? (
            <p className="message message--warning" role="status">
              {overview.contextGaps.marketPriceItemCodes.length} configured item(s) have no current
              price. Missing prices are not zero.
            </p>
          ) : null}
          {overview && overview.contextGaps.itemCodes.length > 0 ? (
            <p className="muted">
              Some price codes are absent from the normalized catalogue:{" "}
              {overview.contextGaps.itemCodes.join(", ")}.
            </p>
          ) : null}
          {overview ? (
            <FreshnessPanel freshness={overview.freshness} title="Market overview" />
          ) : null}
        </section>
        <section
          className="workspace-panel market-inspection"
          aria-labelledby="market-inspection-title"
        >
          <p className="section-kicker">Selected item · current-state inspection</p>
          <h3 id="market-inspection-title">{itemCode ?? "Choose an item"}</h3>
          {!itemCode ? (
            <p className="muted">
              Choose an item from the current catalogue to see its normalized recipe, output/input
              prices, and available current order context.
            </p>
          ) : null}
          {itemCode ? (
            <p className="muted">
              Selected item · <strong>{itemCode}</strong> · reload-safe URL context.{" "}
              <a href={itemHref()}>Clear selection</a>
            </p>
          ) : null}
          {isLoadingItem ? (
            <p className="message" role="status">
              Loading selected item context…
            </p>
          ) : null}
          {itemError ? (
            <p className="message message--error" role="alert">
              {itemError} Current item context is unavailable.
            </p>
          ) : null}
          {item && !isLoadingItem ? (
            <>
              <div className="market-output-price">
                <span>Output · current observed price</span>
                <strong>{priceLabel(observedPrice(item, item.itemCode))}</strong>
              </div>
              {item.item ? (
                <>
                  <div className="market-item-meta">
                    <span>
                      Type: <strong>{item.item.type}</strong>
                    </span>
                    <span>
                      Rarity: <strong>{item.item.rarity}</strong>
                    </span>
                    <span>
                      Tradable:{" "}
                      <strong>
                        {item.item.isTradable === undefined
                          ? "Unspecified"
                          : item.item.isTradable
                            ? "Yes"
                            : "No"}
                      </strong>
                    </span>
                    <span>
                      Production points:{" "}
                      <strong>
                        {item.item.productionPoints === undefined
                          ? "Not provided"
                          : formatDisplayNumber(item.item.productionPoints, "points")}
                      </strong>
                    </span>
                  </div>
                  <h4>Required production inputs</h4>
                  {inputs.length > 0 ? (
                    <ul className="market-input-list">
                      {inputs.map(([code, quantity]) => (
                        <li key={code}>
                          <div>
                            <strong>{code}</strong>
                            <small>
                              Recipe quantity {formatDisplayNumber(quantity, "quantity")}
                            </small>
                          </div>
                          <div>
                            <small>Current observed price</small>
                            <strong>{priceLabel(observedPrice(item, code))}</strong>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">
                      No required production inputs are listed in the normalized recipe.
                    </p>
                  )}
                </>
              ) : (
                <p className="message message--warning" role="status">
                  This item is absent from the normalized configuration. Recipe details cannot be
                  shown.
                </p>
              )}
              {item.contextGaps.itemCodes.length > 0 ? (
                <p className="message message--warning" role="status">
                  Missing item configuration: {item.contextGaps.itemCodes.join(", ")}.
                </p>
              ) : null}
              {item.contextGaps.marketPriceItemCodes.length > 0 ? (
                <p className="message message--warning" role="status">
                  Missing current prices: {item.contextGaps.marketPriceItemCodes.join(", ")}. No
                  values were substituted.
                </p>
              ) : null}

              <MarketRecipeEconomics context={item} />

              <div className="market-orders">
                <h4>Current top orders</h4>
                <p className="muted">
                  Public top-of-book observations, not trades or executable quotes. Up to ten orders
                  per side; no spread or profitability estimate.
                </p>
                {item.topOrders ? (
                  <div className="market-order-grid">
                    <Orders orders={item.topOrders.buyOrders} side="buy" />
                    <Orders orders={item.topOrders.sellOrders} side="sell" />
                  </div>
                ) : item.contextGaps.orderBookItemCodes.length > 0 ? (
                  <p className="message message--warning" role="status">
                    Current orders are temporarily unavailable for{" "}
                    {item.contextGaps.orderBookItemCodes.join(", ")}.
                  </p>
                ) : (
                  <p className="muted">
                    Order inspection is not applicable for this item (unknown configuration or
                    explicitly non-tradable).
                  </p>
                )}
              </div>
              <FreshnessPanel freshness={item.freshness} title="Selected item" />
            </>
          ) : null}
        </section>
      </div>
    </section>
  );
}
