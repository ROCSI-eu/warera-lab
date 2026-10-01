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
import {
  WarEraRequestCoordinator,
  type WarEraCacheMetadata,
  type WarEraCoordinationOptions,
} from "./coordination.js";
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
  type CompanyIdsPage,
} from "./normalize.js";
import type { DocumentedMvpProcedure } from "./procedures.js";
import { readRateLimitMetadata, type WarEraRateLimitMetadata } from "./rate-limit.js";
import { trpcErrorEnvelopeSchema, trpcSuccessEnvelopeSchema } from "./schemas.js";

export const OFFICIAL_WARERA_API_BASE_URL = "https://api2.warera.io/trpc";

export interface WarEraAdapterResponse<T> {
  data: T;
  retrievedAt: string;
  rateLimit: WarEraRateLimitMetadata;
  cache: WarEraCacheMetadata;
}

export interface WarEraApiClientOptions {
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  now?: () => Date;
  timeoutMs?: number;
  coordination?: WarEraCoordinationOptions;
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
  readonly #coordinator: WarEraRequestCoordinator;

  constructor(options: WarEraApiClientOptions = {}) {
    this.#baseUrl = (options.baseUrl ?? OFFICIAL_WARERA_API_BASE_URL).replace(/\/$/, "");
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#now = options.now ?? (() => new Date());
    this.#timeoutMs = options.timeoutMs ?? 10_000;
    if (!Number.isFinite(this.#timeoutMs) || this.#timeoutMs <= 0) {
      throw new TypeError("WarEra API timeoutMs must be a positive finite number");
    }
    this.#coordinator = new WarEraRequestCoordinator(options.coordination, () =>
      this.#now().getTime(),
    );
  }

  async #fetchUpstream(
    procedure: DocumentedMvpProcedure,
    input: unknown,
  ): Promise<Omit<WarEraAdapterResponse<unknown>, "cache">> {
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
        kind: response.status === 429 ? "rate-limited" : "http",
        status: response.status,
        rateLimit,
        ...(upstreamCode === undefined ? {} : { upstreamCode }),
        ...(retryAfter === undefined ? {} : { retryAfterSeconds: retryAfter }),
      });
    }

    const envelope = trpcSuccessEnvelopeSchema.safeParse(body);
    if (!envelope.success) {
      throw new WarEraApiError("WarEra API returned an invalid tRPC success envelope", {
        kind: "invalid-response",
        status: response.status,
        rateLimit,
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
    const coordinated = await this.#coordinator.execute(procedure, input, async () => {
      const response = await this.#fetchUpstream(procedure, input);
      try {
        return { ...response, data: normalize(response.data) };
      } catch (cause) {
        if (cause instanceof WarEraApiError) throw cause;
        throw new WarEraApiError(`WarEra payload failed validation for ${procedure}`, {
          kind: "invalid-response",
          rateLimit: response.rateLimit,
          cause,
        });
      }
    });

    return { ...coordinated.value, cache: coordinated.cache };
  }

  search(searchText: string): Promise<WarEraAdapterResponse<PublicSearchResult>> {
    return this.#normalized("search.searchAnything", { searchText }, normalizeSearchResult);
  }

  getPlayer(userId: string): Promise<WarEraAdapterResponse<PublicPlayerEconomySnapshot>> {
    return this.#normalized("user.getUserLite", { userId }, normalizePublicPlayer);
  }

  getCompanies(
    userId: string,
    perPage = 100,
    cursor?: string,
  ): Promise<WarEraAdapterResponse<CompanyIdsPage>> {
    return this.#normalized(
      "company.getCompanies",
      { userId, perPage, ...(cursor === undefined ? {} : { cursor }) },
      normalizeCompaniesPage,
    );
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