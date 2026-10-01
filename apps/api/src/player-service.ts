import type {
  CountryContext,
  PlayerSearchResponse,
  PublicCompanySnapshot,
  PublicPlayerEconomySnapshot,
  PublicPlayerSearchMatch,
  PublicPlayerSnapshotResponse,
  RegionContext,
  SnapshotFreshness,
  SnapshotFreshnessSource,
} from "@warera-lab/domain";
import type {
  CompanyIdsPage,
  WarEraAdapterResponse,
  WarEraCacheMetadata,
} from "@warera-lab/warera-api";
import { WarEraApiError } from "@warera-lab/warera-api";

const MAX_SEARCH_RESULTS = 8;
const COMPANIES_PAGE_SIZE = 100;
const MAX_COMPANY_PAGES = 5;
const MAX_COMPANIES_PER_SNAPSHOT = 32;

export class PlayerNotFoundError extends Error {
  constructor() {
    super("WarEra player not found");
    this.name = "PlayerNotFoundError";
  }
}

export interface PublicWarEraClient {
  search(searchText: string): Promise<WarEraAdapterResponse<{ userIds: string[] }>>;
  getPlayer(userId: string): Promise<WarEraAdapterResponse<PublicPlayerEconomySnapshot>>;
  getCompanies(
    userId: string,
    perPage?: number,
    cursor?: string,
  ): Promise<WarEraAdapterResponse<CompanyIdsPage>>;
  getCompany(companyId: string): Promise<WarEraAdapterResponse<PublicCompanySnapshot>>;
  getRegions(): Promise<WarEraAdapterResponse<Record<string, RegionContext>>>;
  getCountries(): Promise<WarEraAdapterResponse<CountryContext[]>>;
}

function freshnessState(cache: WarEraCacheMetadata): SnapshotFreshnessSource["state"] {
  if (cache.state === "stale") return "stale";
  if (cache.state === "fresh") return "cached";
  return "live";
}

function sourceFreshness(
  source: SnapshotFreshnessSource["source"],
  response: Pick<WarEraAdapterResponse<unknown>, "retrievedAt" | "cache">,
  subjectId?: string,
): SnapshotFreshnessSource {
  return {
    source,
    retrievedAt: response.retrievedAt,
    ageMs: response.cache.ageMs,
    state: freshnessState(response.cache),
    ...(subjectId === undefined ? {} : { subjectId }),
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

function isNotFound(error: unknown): boolean {
  return error instanceof WarEraApiError && error.kind === "http" && error.status === 404;
}

export class PlayerSnapshotService {
  readonly #client: PublicWarEraClient;
  readonly #now: () => Date;

  constructor(client: PublicWarEraClient, now: () => Date = () => new Date()) {
    this.#client = client;
    this.#now = now;
  }

  async searchPlayers(query: string): Promise<PlayerSearchResponse> {
    const search = await this.#client.search(query);
    const selectedIds = search.data.userIds.slice(0, MAX_SEARCH_RESULTS);
    const matches: PublicPlayerSearchMatch[] = [];
    const sources: SnapshotFreshnessSource[] = [sourceFreshness("search", search)];

    for (const userId of selectedIds) {
      try {
        const player = await this.#client.getPlayer(userId);
        matches.push({
          id: player.data.id,
          username: player.data.username,
          countryId: player.data.countryId,
          level: player.data.level,
        });
        sources.push(sourceFreshness("player", player, userId));
      } catch (error) {
        if (isNotFound(error)) continue;
        throw error;
      }
    }

    return {
      query,
      matches,
      truncated: search.data.userIds.length > MAX_SEARCH_RESULTS,
      freshness: aggregateFreshness(this.#now().toISOString(), sources),
    };
  }

  async getSnapshot(userId: string): Promise<PublicPlayerSnapshotResponse> {
    let player: WarEraAdapterResponse<PublicPlayerEconomySnapshot>;
    try {
      player = await this.#client.getPlayer(userId);
    } catch (error) {
      if (isNotFound(error)) throw new PlayerNotFoundError();
      throw error;
    }

    const [companiesResult, regions, countries] = await Promise.all([
      this.#getAllCompanies(userId),
      this.#client.getRegions(),
      this.#client.getCountries(),
    ]);

    const relevantRegionIds = new Set(companiesResult.companies.map((company) => company.regionId));
    const relevantRegions = Object.fromEntries(
      [...relevantRegionIds]
        .map((regionId) => [regionId, regions.data[regionId]] as const)
        .filter((entry): entry is readonly [string, RegionContext] => entry[1] !== undefined),
    );

    const relevantCountryIds = new Set<string>([player.data.countryId]);
    for (const region of Object.values(relevantRegions)) relevantCountryIds.add(region.countryId);

    const countryById = new Map(countries.data.map((country) => [country.id, country]));
    const relevantCountries = Object.fromEntries(
      [...relevantCountryIds]
        .map((countryId) => [countryId, countryById.get(countryId)] as const)
        .filter((entry): entry is readonly [string, CountryContext] => entry[1] !== undefined),
    );

    const missingRegionIds = [...relevantRegionIds].filter(
      (regionId) => !(regionId in relevantRegions),
    );
    const missingCountryIds = [...relevantCountryIds].filter(
      (countryId) => !(countryId in relevantCountries),
    );

    const sources = [
      sourceFreshness("player", player, userId),
      ...companiesResult.sources,
      sourceFreshness("regions", regions),
      sourceFreshness("countries", countries),
    ];

    return {
      player: player.data,
      companies: companiesResult.companies,
      regions: relevantRegions,
      countries: relevantCountries,
      contextGaps: {
        regionIds: missingRegionIds,
        countryIds: missingCountryIds,
      },
      freshness: aggregateFreshness(this.#now().toISOString(), sources),
    };
  }

  async #getAllCompanies(userId: string): Promise<{
    companies: PublicCompanySnapshot[];
    sources: SnapshotFreshnessSource[];
  }> {
    const companyIds: string[] = [];
    const sources: SnapshotFreshnessSource[] = [];
    let cursor: string | undefined;
    const seenCursors = new Set<string>();

    for (let page = 0; page < MAX_COMPANY_PAGES; page += 1) {
      const response = await this.#client.getCompanies(userId, COMPANIES_PAGE_SIZE, cursor);
      companyIds.push(...response.data.itemIds);
      sources.push(sourceFreshness("companies", response, userId));

      if (companyIds.length > MAX_COMPANIES_PER_SNAPSHOT) {
        throw new WarEraApiError("WarEra company list exceeded the snapshot safety limit", {
          kind: "invalid-response",
          rateLimit: response.rateLimit,
        });
      }

      const nextCursor = response.data.nextCursor;
      if (nextCursor === undefined) {
        const companies: PublicCompanySnapshot[] = [];
        for (const companyId of companyIds) {
          const company = await this.#client.getCompany(companyId);
          companies.push(company.data);
          sources.push(sourceFreshness("company", company, companyId));
        }
        return { companies, sources };
      }
      if (seenCursors.has(nextCursor)) {
        throw new WarEraApiError("WarEra company pagination returned a repeated cursor", {
          kind: "invalid-response",
          rateLimit: response.rateLimit,
        });
      }
      seenCursors.add(nextCursor);
      cursor = nextCursor;
    }

    throw new WarEraApiError("WarEra company pagination exceeded the safety page limit", {
      kind: "invalid-response",
    });
  }
}
