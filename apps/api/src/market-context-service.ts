import type {
  EconomyGameConfig,
  MarketLabItemResponse,
  MarketLabOverviewResponse,
  MarketOrderBook,
  MarketPriceMap,
} from "@warera-lab/domain";
import { WarEraApiError, type WarEraAdapterResponse } from "@warera-lab/warera-api";

import { aggregateFreshness, sourceFreshness } from "./source-freshness.js";

const topOrdersPerSide = 10;

export interface MarketWarEraClient {
  getEconomyGameConfig(): Promise<WarEraAdapterResponse<EconomyGameConfig>>;
  getItemPrices(): Promise<WarEraAdapterResponse<MarketPriceMap>>;
  getTopOrders(itemCode: string, limit?: number): Promise<WarEraAdapterResponse<MarketOrderBook>>;
}

export class MarketContextService {
  readonly #client: MarketWarEraClient;
  readonly #now: () => Date;

  constructor(client: MarketWarEraClient, now: () => Date = () => new Date()) {
    this.#client = client;
    this.#now = now;
  }

  async getOverview(): Promise<MarketLabOverviewResponse> {
    const [config, prices] = await Promise.all([
      this.#client.getEconomyGameConfig(),
      this.#client.getItemPrices(),
    ]);

    const items = Object.entries(config.data.items)
      .map(([code, item]) => ({
        code,
        type: item.type,
        rarity: item.rarity,
        ...(item.isTradable === undefined ? {} : { isTradable: item.isTradable }),
        ...(Object.hasOwn(prices.data, code) ? { currentPrice: prices.data[code] } : {}),
      }))
      .sort((a, b) => a.code.localeCompare(b.code));

    return {
      items,
      contextGaps: {
        itemCodes: Object.keys(prices.data)
          .filter((code) => !Object.hasOwn(config.data.items, code))
          .sort(),
        marketPriceItemCodes: items
          .filter(({ code }) => !Object.hasOwn(prices.data, code))
          .map(({ code }) => code),
      },
      freshness: aggregateFreshness(this.#now().toISOString(), [
        sourceFreshness("gameConfig", config),
        sourceFreshness("marketPrices", prices),
      ]),
    };
  }

  async getItem(itemCode: string): Promise<MarketLabItemResponse> {
    const [config, prices] = await Promise.all([
      this.#client.getEconomyGameConfig(),
      this.#client.getItemPrices(),
    ]);
    const item = Object.hasOwn(config.data.items, itemCode)
      ? config.data.items[itemCode]
      : undefined;
    const requiredCodes = [itemCode, ...Object.keys(item?.productionNeeds ?? {})];
    const relevantCodes = [...new Set(requiredCodes)];
    const marketPrices: MarketPriceMap = Object.fromEntries(
      relevantCodes.flatMap((code) => {
        const price = prices.data[code];
        return price === undefined || !Object.hasOwn(prices.data, code)
          ? []
          : [[code, price] as const];
      }),
    );

    const sources = [
      sourceFreshness("gameConfig", config),
      sourceFreshness("marketPrices", prices),
    ];
    let topOrders: MarketOrderBook | undefined;
    let orderBookItemCodes: string[] = [];

    // Only inspect orders for a configured item that is not explicitly non-tradable.
    if (item !== undefined && item.isTradable !== false) {
      try {
        const response = await this.#client.getTopOrders(itemCode, topOrdersPerSide);
        topOrders = {
          buyOrders: response.data.buyOrders
            .filter((order) => order.itemCode === itemCode && order.type === "buy")
            .slice(0, topOrdersPerSide),
          sellOrders: response.data.sellOrders
            .filter((order) => order.itemCode === itemCode && order.type === "sell")
            .slice(0, topOrdersPerSide),
        };
        sources.push(sourceFreshness("marketOrders", response, itemCode));
      } catch (error) {
        if (!(error instanceof WarEraApiError)) throw error;
        orderBookItemCodes = [itemCode];
      }
    }

    return {
      itemCode,
      ...(item === undefined ? {} : { item }),
      marketPrices,
      ...(topOrders === undefined ? {} : { topOrders }),
      contextGaps: {
        itemCodes: relevantCodes.filter((code) => !Object.hasOwn(config.data.items, code)),
        marketPriceItemCodes: relevantCodes.filter((code) => !Object.hasOwn(prices.data, code)),
        orderBookItemCodes,
      },
      freshness: aggregateFreshness(this.#now().toISOString(), sources),
    };
  }
}
