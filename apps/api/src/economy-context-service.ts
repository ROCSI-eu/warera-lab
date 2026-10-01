import type {
  EconomyGameConfig,
  EconomyPlannerContextResponse,
  MarketPriceMap,
  SnapshotFreshness,
  SnapshotFreshnessSource,
} from "@warera-lab/domain";
import type { WarEraAdapterResponse, WarEraCacheMetadata } from "@warera-lab/warera-api";

export interface EconomyWarEraClient {
  getEconomyGameConfig(): Promise<WarEraAdapterResponse<EconomyGameConfig>>;
  getItemPrices(): Promise<WarEraAdapterResponse<MarketPriceMap>>;
}

function freshnessState(cache: WarEraCacheMetadata): SnapshotFreshnessSource["state"] {
  if (cache.state === "stale") return "stale";
  if (cache.state === "fresh") return "cached";
  return "live";
}

function sourceFreshness(
  source: "gameConfig" | "marketPrices",
  response: Pick<WarEraAdapterResponse<unknown>, "retrievedAt" | "cache">,
): SnapshotFreshnessSource {
  return {
    source,
    retrievedAt: response.retrievedAt,
    ageMs: response.cache.ageMs,
    state: freshnessState(response.cache),
  };
}

function aggregateFreshness(
  generatedAt: string,
  sources: SnapshotFreshnessSource[],
): SnapshotFreshness {
  return {
    generatedAt,
    hasStaleData: sources.some((source) => source.state === "stale"),
    sources,
  };
}

export class EconomyContextService {
  readonly #client: EconomyWarEraClient;
  readonly #now: () => Date;

  constructor(client: EconomyWarEraClient, now: () => Date = () => new Date()) {
    this.#client = client;
    this.#now = now;
  }

  async getContext(itemCode: string): Promise<EconomyPlannerContextResponse> {
    const [config, prices] = await Promise.all([
      this.#client.getEconomyGameConfig(),
      this.#client.getItemPrices(),
    ]);
    const item = config.data.items[itemCode];
    const relevantItemCodes = new Set<string>([itemCode]);

    if (item !== undefined) {
      for (const inputCode of Object.keys(item.productionNeeds)) {
        relevantItemCodes.add(inputCode);
      }
    }

    const marketPrices: MarketPriceMap = {};
    const missingMarketPriceItemCodes: string[] = [];

    for (const relevantItemCode of relevantItemCodes) {
      const price = prices.data[relevantItemCode];
      if (price === undefined) {
        missingMarketPriceItemCodes.push(relevantItemCode);
      } else {
        marketPrices[relevantItemCode] = price;
      }
    }

    return {
      itemCode,
      ...(item === undefined ? {} : { item }),
      skills: config.data.skills,
      companyUpgrades: config.data.companyUpgrades,
      marketPrices,
      contextGaps: {
        itemCodes: item === undefined ? [itemCode] : [],
        marketPriceItemCodes: missingMarketPriceItemCodes,
      },
      freshness: aggregateFreshness(this.#now().toISOString(), [
        sourceFreshness("gameConfig", config),
        sourceFreshness("marketPrices", prices),
      ]),
    };
  }
}
