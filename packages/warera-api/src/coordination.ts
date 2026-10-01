import { WarEraApiError } from "./errors.js";
import type { DocumentedMvpProcedure } from "./procedures.js";
import type { WarEraRateLimitMetadata } from "./rate-limit.js";

export type WarEraCacheState = "miss" | "fresh" | "stale";

export interface WarEraCacheMetadata {
  state: WarEraCacheState;
  ageMs: number;
  ttlMs: number;
  staleIfErrorMs: number;
  coalesced: boolean;
}

export interface WarEraCachePolicy {
  ttlMs: number;
  staleIfErrorMs: number;
}

export type WarEraCachePolicyOverrides = Partial<
  Record<DocumentedMvpProcedure, Partial<WarEraCachePolicy>>
>;

export interface WarEraCoordinationOptions {
  maxEntries?: number;
  safetyReserve?: number;
  policies?: WarEraCachePolicyOverrides;
}

export const DEFAULT_CACHE_POLICIES: Record<DocumentedMvpProcedure, WarEraCachePolicy> = {
  "search.searchAnything": { ttlMs: 10_000, staleIfErrorMs: 0 },
  "user.getUserLite": { ttlMs: 10_000, staleIfErrorMs: 0 },
  "company.getCompanies": { ttlMs: 10_000, staleIfErrorMs: 0 },
  "company.getById": { ttlMs: 10_000, staleIfErrorMs: 0 },
  "region.getById": { ttlMs: 30_000, staleIfErrorMs: 60_000 },
  "region.getRegionsObject": { ttlMs: 30_000, staleIfErrorMs: 60_000 },
  "country.getCountryById": { ttlMs: 30_000, staleIfErrorMs: 60_000 },
  "country.getAllCountries": { ttlMs: 30_000, staleIfErrorMs: 60_000 },
  "itemTrading.getPrices": { ttlMs: 5_000, staleIfErrorMs: 10_000 },
  "tradingOrder.getTopOrders": { ttlMs: 3_000, staleIfErrorMs: 0 },
  "gameConfig.getGameConfig": { ttlMs: 60_000, staleIfErrorMs: 300_000 },
};

interface CacheEntry<T> {
  value: T;
  storedAtMs: number;
}

interface RateBudget {
  limit: number | undefined;
  remaining: number;
  resetAtMs: number;
  resetSeconds: number | undefined;
  policy: string | undefined;
}

export interface CoordinatedResult<T> {
  value: T;
  cache: WarEraCacheMetadata;
}

function validateDuration(name: string, value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative finite number`);
  }
  return value;
}

function normalizeForKey(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(normalizeForKey);

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, normalizeForKey(entry)]),
  );
}

export function buildRequestCacheKey(procedure: DocumentedMvpProcedure, input: unknown): string {
  return `${procedure}:${JSON.stringify(normalizeForKey(input))}`;
}

function isRetryableUpstreamError(error: unknown): boolean {
  if (!(error instanceof WarEraApiError)) return false;
  if (error.kind === "rate-limited" || error.kind === "upstream") return true;
  return error.kind === "http" && error.status !== undefined && error.status >= 500;
}

export class WarEraRequestCoordinator {
  readonly #cache = new Map<string, CacheEntry<unknown>>();
  readonly #inFlight = new Map<string, Promise<unknown>>();
  readonly #maxEntries: number;
  readonly #safetyReserve: number;
  readonly #policies: Record<DocumentedMvpProcedure, WarEraCachePolicy>;
  readonly #nowMs: () => number;
  #budget: RateBudget | undefined;
  #upstreamInFlight = 0;

  constructor(options: WarEraCoordinationOptions = {}, nowMs: () => number = Date.now) {
    const maxEntries = options.maxEntries ?? 256;
    if (!Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new TypeError("WarEra cache maxEntries must be a positive integer");
    }

    const safetyReserve = options.safetyReserve ?? 5;
    if (!Number.isInteger(safetyReserve) || safetyReserve < 0) {
      throw new TypeError("WarEra rate-limit safetyReserve must be a non-negative integer");
    }

    this.#maxEntries = maxEntries;
    this.#safetyReserve = safetyReserve;
    this.#nowMs = nowMs;
    this.#policies = Object.fromEntries(
      Object.entries(DEFAULT_CACHE_POLICIES).map(([procedure, defaults]) => {
        const override = options.policies?.[procedure as DocumentedMvpProcedure];
        return [
          procedure,
          {
            ttlMs: validateDuration(`${procedure} ttlMs`, override?.ttlMs ?? defaults.ttlMs),
            staleIfErrorMs: validateDuration(
              `${procedure} staleIfErrorMs`,
              override?.staleIfErrorMs ?? defaults.staleIfErrorMs,
            ),
          },
        ];
      }),
    ) as Record<DocumentedMvpProcedure, WarEraCachePolicy>;
  }

  async execute<T extends { rateLimit: WarEraRateLimitMetadata }>(
    procedure: DocumentedMvpProcedure,
    input: unknown,
    fetcher: () => Promise<T>,
  ): Promise<CoordinatedResult<T>> {
    const now = this.#nowMs();
    const policy = this.#policies[procedure];
    const key = buildRequestCacheKey(procedure, input);
    const cached = this.#readCache<T>(key, policy, now);

    if (cached?.fresh) {
      return {
        value: cached.entry.value,
        cache: this.#cacheMetadata("fresh", cached.ageMs, policy, false),
      };
    }

    const existing = this.#inFlight.get(key) as Promise<T> | undefined;
    if (existing) {
      try {
        const value = await existing;
        return {
          value,
          cache: this.#cacheMetadata("miss", 0, policy, true),
        };
      } catch (error) {
        if (cached?.stale && isRetryableUpstreamError(error)) {
          return {
            value: cached.entry.value,
            cache: this.#cacheMetadata("stale", cached.ageMs, policy, true),
          };
        }
        throw error;
      }
    }

    try {
      this.#assertBudgetAllowsRequest();
    } catch (error) {
      if (cached?.stale && isRetryableUpstreamError(error)) {
        return {
          value: cached.entry.value,
          cache: this.#cacheMetadata("stale", cached.ageMs, policy, false),
        };
      }
      throw error;
    }

    const request = this.#runUpstream(fetcher);
    this.#inFlight.set(key, request);

    try {
      const value = await request;
      this.#store(key, value, policy);
      return {
        value,
        cache: this.#cacheMetadata("miss", 0, policy, false),
      };
    } catch (error) {
      if (cached?.stale && isRetryableUpstreamError(error)) {
        return {
          value: cached.entry.value,
          cache: this.#cacheMetadata("stale", cached.ageMs, policy, false),
        };
      }
      throw error;
    } finally {
      if (this.#inFlight.get(key) === request) this.#inFlight.delete(key);
    }
  }

  #readCache<T>(key: string, policy: WarEraCachePolicy, now: number) {
    const entry = this.#cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;

    const ageMs = Math.max(0, now - entry.storedAtMs);
    const fresh = ageMs <= policy.ttlMs;
    const stale = !fresh && ageMs <= policy.ttlMs + policy.staleIfErrorMs;

    if (!fresh && !stale) {
      this.#cache.delete(key);
      return undefined;
    }

    this.#cache.delete(key);
    this.#cache.set(key, entry);
    return { entry, ageMs, fresh, stale };
  }

  #store<T>(key: string, value: T, policy: WarEraCachePolicy): void {
    if (policy.ttlMs === 0 && policy.staleIfErrorMs === 0) return;

    this.#cache.delete(key);
    this.#cache.set(key, { value, storedAtMs: this.#nowMs() });
    while (this.#cache.size > this.#maxEntries) {
      const oldest = this.#cache.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.#cache.delete(oldest);
    }
  }

  #cacheMetadata(
    state: WarEraCacheState,
    ageMs: number,
    policy: WarEraCachePolicy,
    coalesced: boolean,
  ): WarEraCacheMetadata {
    return {
      state,
      ageMs,
      ttlMs: policy.ttlMs,
      staleIfErrorMs: policy.staleIfErrorMs,
      coalesced,
    };
  }

  async #runUpstream<T extends { rateLimit: WarEraRateLimitMetadata }>(
    fetcher: () => Promise<T>,
  ): Promise<T> {
    this.#upstreamInFlight += 1;
    try {
      const value = await fetcher();
      this.#observeRateLimit(value.rateLimit);
      return value;
    } catch (error) {
      if (error instanceof WarEraApiError && error.rateLimit !== undefined) {
        this.#observeRateLimit(error.rateLimit);
      }
      throw error;
    } finally {
      this.#upstreamInFlight -= 1;
    }
  }

  #assertBudgetAllowsRequest(): void {
    const budget = this.#budget;
    if (!budget) return;

    const now = this.#nowMs();
    if (now >= budget.resetAtMs) {
      this.#budget = undefined;
      return;
    }

    const projectedRemaining = budget.remaining - this.#upstreamInFlight;
    if (projectedRemaining > this.#safetyReserve) return;

    const retryAfterSeconds = Math.max(1, Math.ceil((budget.resetAtMs - now) / 1000));
    throw new WarEraApiError(
      "WarEra API request held to preserve the configured rate-limit reserve",
      {
        kind: "rate-limited",
        status: 429,
        retryAfterSeconds,
        rateLimit: {
          limit: budget.limit,
          remaining: budget.remaining,
          resetSeconds: retryAfterSeconds,
          policy: budget.policy,
        },
      },
    );
  }

  #observeRateLimit(metadata: WarEraRateLimitMetadata): void {
    if (metadata.remaining === undefined) return;

    const now = this.#nowMs();
    const resetSeconds = metadata.resetSeconds ?? 1;
    const resetAtMs = now + Math.max(1, resetSeconds) * 1000;
    const current = this.#budget;

    if (current && now < current.resetAtMs) {
      this.#budget = {
        limit: metadata.limit ?? current.limit,
        remaining: Math.min(current.remaining, metadata.remaining),
        resetAtMs: Math.max(current.resetAtMs, resetAtMs),
        resetSeconds: metadata.resetSeconds ?? current.resetSeconds,
        policy: metadata.policy ?? current.policy,
      };
      return;
    }

    this.#budget = {
      limit: metadata.limit,
      remaining: metadata.remaining,
      resetAtMs,
      resetSeconds: metadata.resetSeconds,
      policy: metadata.policy,
    };
  }
}
