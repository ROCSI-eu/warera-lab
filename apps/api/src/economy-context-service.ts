import type {
  EconomyGameConfig,
  EconomyPlannerContextResponse,
  MarketPriceMap,
} from "@warera-lab/domain";
import type { WarEraAdapterResponse } from "@warera-lab/warera-api";

import { aggregateFreshness, sourceFreshness } from "./source-freshness.js";

export interface EconomyWarEraClient {
  getEconomyGameConfig(): Promise<WarEraAdapterResponse<EconomyGameConfig>>;
  getItemPrices(): Promise<WarEraAdapterResponse<MarketPriceMap>>;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, canonicalize(nested)]),
  );
}

function configRevision(input: {
  skills: EconomyGameConfig["skills"];
  companyUpgrades: EconomyGameConfig["companyUpgrades"];
  item?: EconomyGameConfig["items"][string];
}): string {
  const serialized = JSON.stringify(canonicalize(input));
  let hash = 2_166_136_261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}-${serialized.length.toString(16)}`;
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
      configRevision: configRevision({
        skills: config.data.skills,
        companyUpgrades: config.data.companyUpgrades,
        ...(item === undefined ? {} : { item }),
      }),
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
