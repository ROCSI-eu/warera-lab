export const publicItemCodeMaxLength = 64;

export const economySkillKeys = [
  "production",
  "entrepreneurship",
  "management",
  "companies",
] as const;

export type EconomySkillKey = (typeof economySkillKeys)[number];

export interface EconomySkillSnapshot {
  level: number;
  value: number;
  total: number;
}

export interface PublicPlayerEconomySnapshot {
  id: string;
  username: string;
  countryId: string;
  level: number;
  availableSkillPoints: number;
  spentSkillPoints: number;
  totalSkillPoints: number;
  skills: Record<EconomySkillKey, EconomySkillSnapshot>;
}

export interface PublicCompanySnapshot {
  id: string;
  ownerId: string;
  regionId: string;
  itemCode: string;
  name: string;
  production?: number;
  workerCount?: number;
  activeUpgradeLevels: Partial<Record<CompanyUpgradeKey, number>>;
  estimatedValue?: number;
}

export const companyUpgradeKeys = ["automatedEngine", "storage", "breakRoom"] as const;
export type CompanyUpgradeKey = (typeof companyUpgradeKeys)[number];

export const gameplayAvailabilityStates = [
  "production",
  "dev-not-production",
  "unverified",
] as const;
export type GameplayAvailabilityState = (typeof gameplayAvailabilityStates)[number];

export interface FeatureAvailabilityRecord {
  api: "exposed";
  gameplay: GameplayAvailabilityState;
  evidence: string;
  checkedAt: string;
}

export const companyUpgradeAvailability: Record<CompanyUpgradeKey, FeatureAvailabilityRecord> = {
  automatedEngine: {
    api: "exposed",
    gameplay: "production",
    evidence: "Observed as a production company upgrade.",
    checkedAt: "2026-10-06",
  },
  storage: {
    api: "exposed",
    gameplay: "production",
    evidence: "Observed as a production company upgrade.",
    checkedAt: "2026-10-06",
  },
  breakRoom: {
    api: "exposed",
    gameplay: "dev-not-production",
    evidence:
      "Exposed by the production API/config, but not currently available as production gameplay.",
    checkedAt: "2026-10-06",
  },
};

export interface EconomySkillLevelConfig {
  level: number;
  value: number;
  totalCost: number;
  cost?: number;
  unlockAtLevel: number;
}

export interface EconomySkillConfig {
  key: EconomySkillKey;
  levels: Record<number, EconomySkillLevelConfig>;
}

export interface ItemEconomyConfig {
  code: string;
  type: string;
  rarity: string;
  productionPoints?: number;
  productionNeeds: Record<string, number>;
  isTradable?: boolean;
}

export interface CompanyUpgradeLevelConfig {
  level: number;
  steelCost: number;
  constructionPointsCost?: number;
  stats: {
    dailyProd?: number;
    maxProduction?: number;
    maxWorkers?: number;
    dailyHires?: number;
  };
}

export interface CompanyUpgradeConfig {
  key: CompanyUpgradeKey;
  canDowngrade?: boolean;
  pendingDurationHours?: number;
  levels: Record<number, CompanyUpgradeLevelConfig>;
}

export interface EconomyGameConfig {
  skills: Record<EconomySkillKey, EconomySkillConfig>;
  items: Record<string, ItemEconomyConfig>;
  companyUpgrades: Record<CompanyUpgradeKey, CompanyUpgradeConfig>;
  company: {
    depositResourceBonus?: number;
    moveCost?: number;
    changeItemCost?: number;
  };
  worker: {
    maxFidelity?: number;
    fidelityProductionBonusPercent?: number;
  };
}

export interface PublicSearchResult {
  userIds: string[];
  countryIds: string[];
  regionIds: string[];
  muIds: string[];
  partyIds: string[];
  hasData: boolean;
}

export interface RegionContext {
  id: string;
  code: string;
  name: string;
  countryId: string;
  countryCode: string;
  development: number;
  baseDevelopment: number;
  isCapital: boolean;
  isLinkedToCapital: boolean;
  biome?: string;
  climate?: string;
}

export interface CountryContext {
  id: string;
  code: string;
  name: string;
  development?: number;
  specializedItem?: string;
  taxes?: {
    income: number;
    market: number;
    selfWork: number;
  };
  productionBonusPercent?: number;
}

export type MarketPriceMap = Record<string, number>;

export interface MarketOrder {
  id: string;
  ownerId: string;
  itemCode: string;
  quantity: number;
  price: number;
  type: "buy" | "sell";
  offeredAt?: string;
}

export interface MarketOrderBook {
  buyOrders: MarketOrder[];
  sellOrders: MarketOrder[];
}

export interface PublicPlayerSearchMatch {
  id: string;
  username: string;
  countryId: string;
  level: number;
}

export type SnapshotFreshnessState = "live" | "cached" | "stale";
export type SnapshotFreshnessSourceKind =
  | "search"
  | "player"
  | "companies"
  | "company"
  | "regions"
  | "countries"
  | "gameConfig"
  | "marketPrices"
  | "marketOrders";

export interface SnapshotFreshnessSource {
  source: SnapshotFreshnessSourceKind;
  subjectId?: string;
  retrievedAt: string;
  ageMs: number;
  state: SnapshotFreshnessState;
}

export interface SnapshotFreshness {
  generatedAt: string;
  hasStaleData: boolean;
  sources: SnapshotFreshnessSource[];
}

export interface PlayerSearchResponse {
  query: string;
  matches: PublicPlayerSearchMatch[];
  truncated: boolean;
  freshness: SnapshotFreshness;
}

export interface PublicPlayerSnapshotResponse {
  player: PublicPlayerEconomySnapshot;
  companies: PublicCompanySnapshot[];
  regions: Record<string, RegionContext>;
  countries: Record<string, CountryContext>;
  contextGaps: {
    regionIds: string[];
    countryIds: string[];
  };
  freshness: SnapshotFreshness;
}

export interface EconomyPlannerContextResponse {
  itemCode: string;
  configRevision: string;
  item?: ItemEconomyConfig;
  skills: EconomyGameConfig["skills"];
  companyUpgrades: EconomyGameConfig["companyUpgrades"];
  marketPrices: MarketPriceMap;
  contextGaps: {
    itemCodes: string[];
    marketPriceItemCodes: string[];
  };
  freshness: SnapshotFreshness;
}

// Market Lab uses the existing normalized item, price and order types, never upstream shapes.
export interface MarketLabCatalogueItem {
  code: string;
  type: string;
  rarity: string;
  isTradable?: boolean;
  currentPrice?: number;
}

export interface MarketLabOverviewResponse {
  items: MarketLabCatalogueItem[];
  contextGaps: {
    // Prices that have no corresponding normalized game-config item.
    itemCodes: string[];
    marketPriceItemCodes: string[];
  };
  freshness: SnapshotFreshness;
}

export interface MarketLabItemResponse {
  itemCode: string;
  item?: ItemEconomyConfig;
  marketPrices: MarketPriceMap;
  topOrders?: MarketOrderBook;
  contextGaps: {
    // Selected output or recipe inputs absent from normalized game config.
    itemCodes: string[];
    marketPriceItemCodes: string[];
    // Order lookup could not be completed; differs from an empty valid order book.
    orderBookItemCodes: string[];
  };
  freshness: SnapshotFreshness;
}
