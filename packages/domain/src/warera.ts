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
