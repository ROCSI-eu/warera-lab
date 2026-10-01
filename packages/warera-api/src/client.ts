import type {
  CountryContext,
  EconomyGameConfig,
  MarketOrderBook,
  MarketPriceMap,
  PublicCompanySnapshot,
  PublicPlayerEconomySnapshot,
  PublicSearchResult,
  RegionContext,
} from "@warera-lab/domain";
import { WarEraApiError } from "./errors.js";
import {
  normalizeCompaniesPage,
  normalizeCompany,
  normalizeCountries,
  normalizeCountry,
  normalizeEconomyGameConfig,
  normalizeMarketOrderBook,
  normalizeMarketPrices,
  normalizePublicPlayer,
  normalizeRegion,
  normalizeRegionsObject,
  normalizeSearchResult,
  type CompaniesPage,
} from "./normalize.js";
import { isDocumentedMvpProcedure, type DocumentedMvpProcedure } from "./procedures.js";
import { readRateLimitMetadata, type WarEraRateLimitMetadata } from "./rate-limit.js";
import { trpcErrorEnvelopeSchema, trpcSuccessEnvelopeSchema } from "./schemas.js";

export const OFFICIAL_WARERA_API_BASE_URL = "https://api2.warera.io/trpc";

export interface WarEraAdapterResponse<T> {
  data: T;
  retrievedAt: string;
  rateLimit: WarEraRateLimitMetadata;
}

export interface WarEraApiClientOptions {
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  now?: () => Date;
  timeoutMs?: number;
}

function retryAfterSeconds(headers: Headers): number | undefined {
  const value = headers.get("retry-after");
  if (value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.trim() === "") return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export class WarEraPublicApiClient {
  readonly #baseUrl: string;
  readonly #fetch: typeof globalThis.fetch;
  readonly #now: () => Date;
  readonly #timeoutMs: number;

  constructor(options: WarEraApiClientOptions = {}) {
    this.#baseUrl = (options.baseUrl ?? OFFICIAL_WARERA_API_BASE_URL).replace(/\/$/, "");
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#now = options.now ?? (() => new Date());
    this.#timeoutMs = options.timeoutMs ?? 10_000;
    if (!Number.isFinite(this.#timeoutMs) || this.#timeoutMs <= 0) {
      throw new TypeError("WarEra API timeoutMs must be a positive finite number");
    }
  }

  async #request(procedure: string, input: unknown): Promise<WarEraAdapterResponse<unknown>> {
    if (!isDocumentedMvpProcedure(procedure)) {
      throw new WarEraApiError(`Unsupported WarEra procedure: ${procedure}`, {
        kind: "unsupported-procedure",
      });
    }

    const url = new URL(`${this.#baseUrl}/${procedure}`);
    url.searchParams.set("input", JSON.stringify(input));

    let response: Response;
    try {
      response = await this.#fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(this.#timeoutMs),
      });
    } catch (cause) {
      throw new WarEraApiError("WarEra API request failed before a response was received", {
        kind: "upstream",
        cause,
      });
    }

    const rateLimit = readRateLimitMetadata(response.headers);
    const body = await readBody(response);

    if (!response.ok) {
      const errorEnvelope = trpcErrorEnvelopeSchema.safeParse(body);
      const message = errorEnvelope.success
        ? errorEnvelope.data.error.message
        : typeof body === "string"
          ? body
          : `WarEra API returned HTTP ${response.status}`;
      const upstreamCode = errorEnvelope.success ? errorEnvelope.data.error.data?.code : undefined;
      const retryAfter = retryAfterSeconds(response.headers);
      throw new WarEraApiError(message, {
        kind: "http",
        status: response.status,
        ...(upstreamCode === undefined ? {} : { upstreamCode }),
        ...(retryAfter === undefined ? {} : { retryAfterSeconds: retryAfter }),
      });
    }

    const envelope = trpcSuccessEnvelopeSchema.safeParse(body);
    if (!envelope.success) {
      throw new WarEraApiError("WarEra API returned an invalid tRPC success envelope", {
        kind: "invalid-response",
        status: response.status,
        cause: envelope.error,
      });
    }

    return {
      data: envelope.data.result.data,
      retrievedAt: this.#now().toISOString(),
      rateLimit,
    };
  }

  async #normalized<T>(
    procedure: DocumentedMvpProcedure,
    input: unknown,
    normalize: (raw: unknown) => T,
  ): Promise<WarEraAdapterResponse<T>> {
    const response = await this.#request(procedure, input);
    try {
      return { ...response, data: normalize(response.data) };
    } catch (cause) {
      if (cause instanceof WarEraApiError) throw cause;
      throw new WarEraApiError(`WarEra payload failed validation for ${procedure}`, {
        kind: "invalid-response",
        cause,
      });
    }
  }

  search(searchText: string): Promise<WarEraAdapterResponse<PublicSearchResult>> {
    return this.#normalized("search.searchAnything", { searchText }, normalizeSearchResult);
  }

  getPlayer(userId: string): Promise<WarEraAdapterResponse<PublicPlayerEconomySnapshot>> {
    return this.#normalized("user.getUserLite", { userId }, normalizePublicPlayer);
  }

  getCompanies(userId: string, perPage = 100): Promise<WarEraAdapterResponse<CompaniesPage>> {
    return this.#normalized("company.getCompanies", { userId, perPage }, normalizeCompaniesPage);
  }

  getCompany(companyId: string): Promise<WarEraAdapterResponse<PublicCompanySnapshot>> {
    return this.#normalized("company.getById", { companyId }, normalizeCompany);
  }

  getRegion(regionId: string): Promise<WarEraAdapterResponse<RegionContext>> {
    return this.#normalized("region.getById", { regionId }, normalizeRegion);
  }

  getRegions(): Promise<WarEraAdapterResponse<Record<string, RegionContext>>> {
    return this.#normalized("region.getRegionsObject", {}, normalizeRegionsObject);
  }

  getCountry(countryId: string): Promise<WarEraAdapterResponse<CountryContext>> {
    return this.#normalized("country.getCountryById", { countryId }, normalizeCountry);
  }

  getCountries(): Promise<WarEraAdapterResponse<CountryContext[]>> {
    return this.#normalized("country.getAllCountries", {}, normalizeCountries);
  }

  getItemPrices(): Promise<WarEraAdapterResponse<MarketPriceMap>> {
    return this.#normalized("itemTrading.getPrices", {}, normalizeMarketPrices);
  }

  getTopOrders(itemCode: string, limit = 10): Promise<WarEraAdapterResponse<MarketOrderBook>> {
    return this.#normalized(
      "tradingOrder.getTopOrders",
      { itemCode, limit },
      normalizeMarketOrderBook,
    );
  }

  getEconomyGameConfig(): Promise<WarEraAdapterResponse<EconomyGameConfig>> {
    return this.#normalized("gameConfig.getGameConfig", {}, normalizeEconomyGameConfig);
  }
}
