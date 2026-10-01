import type {
  CompanyUpgradeConfig,
  CompanyUpgradeKey,
  CountryContext,
  EconomyGameConfig,
  EconomySkillConfig,
  EconomySkillKey,
  ItemEconomyConfig,
  MarketOrder,
  MarketOrderBook,
  MarketPriceMap,
  PublicCompanySnapshot,
  PublicPlayerEconomySnapshot,
  PublicSearchResult,
  RegionContext,
} from "@warera-lab/domain";
import { z } from "zod";

import {
  companiesPageSchema,
  companySchema,
  countriesSchema,
  countrySchema,
  economyGameConfigSchema,
  marketOrderBookSchema,
  marketPricesSchema,
  publicPlayerEconomySchema,
  regionSchema,
  regionsObjectSchema,
  searchResultSchema,
} from "./schemas.js";

export interface CompanyIdsPage {
  itemIds: string[];
  nextCursor?: string;
}

function parseLevelKey(level: string): number {
  const parsed = Number(level);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid WarEra configuration level key: ${level}`);
  }
  return parsed;
}

export function normalizeSearchResult(raw: unknown): PublicSearchResult {
  const value = searchResultSchema.parse(raw);
  return {
    userIds: value.userIds,
    countryIds: value.countryIds,
    regionIds: value.regionIds,
    muIds: value.muIds,
    partyIds: value.partyIds,
    hasData: value.hasData,
  };
}

export function normalizePublicPlayer(raw: unknown): PublicPlayerEconomySnapshot {
  const value = publicPlayerEconomySchema.parse(raw);
  return {
    id: value._id,
    username: value.username,
    countryId: value.country,
    level: value.leveling.level,
    availableSkillPoints: value.leveling.availableSkillPoints,
    spentSkillPoints: value.leveling.spentSkillPoints,
    totalSkillPoints: value.leveling.totalSkillPoints,
    skills: {
      production: value.skills.production,
      entrepreneurship: value.skills.entrepreneurship,
      management: value.skills.management,
      companies: value.skills.companies,
    },
  };
}

function normalizeCompanyFromParsed(value: z.infer<typeof companySchema>): PublicCompanySnapshot {
  return {
    id: value._id,
    ownerId: value.user,
    regionId: value.region,
    itemCode: value.itemCode,
    name: value.name,
    ...(value.production === undefined ? {} : { production: value.production }),
    ...(value.workerCount === undefined ? {} : { workerCount: value.workerCount }),
    activeUpgradeLevels: {
      ...(value.activeUpgradeLevels?.automatedEngine === undefined
        ? {}
        : { automatedEngine: value.activeUpgradeLevels.automatedEngine }),
      ...(value.activeUpgradeLevels?.storage === undefined
        ? {}
        : { storage: value.activeUpgradeLevels.storage }),
      ...(value.activeUpgradeLevels?.breakRoom === undefined
        ? {}
        : { breakRoom: value.activeUpgradeLevels.breakRoom }),
    },
    ...(value.estimatedValue === undefined ? {} : { estimatedValue: value.estimatedValue }),
  };
}

export function normalizeCompany(raw: unknown): PublicCompanySnapshot {
  return normalizeCompanyFromParsed(companySchema.parse(raw));
}

export function normalizeCompaniesPage(raw: unknown): CompanyIdsPage {
  const value = companiesPageSchema.parse(raw);
  return {
    itemIds: value.items,
    ...(value.nextCursor == null ? {} : { nextCursor: value.nextCursor }),
  };
}

export function normalizeRegion(raw: unknown): RegionContext {
  const value = regionSchema.parse(raw);
  return {
    id: value._id,
    code: value.code,
    name: value.name,
    countryId: value.country,
    countryCode: value.countryCode,
    development: value.development,
    baseDevelopment: value.baseDevelopment,
    isCapital: value.isCapital,
    isLinkedToCapital: value.isLinkedToCapital,
    ...(value.biome === undefined ? {} : { biome: value.biome }),
    ...(value.climate === undefined ? {} : { climate: value.climate }),
  };
}

export function normalizeRegionsObject(raw: unknown): Record<string, RegionContext> {
  const value = regionsObjectSchema.parse(raw);
  return Object.fromEntries(
    Object.entries(value).map(([id, region]) => [id, normalizeRegion(region)]),
  );
}

function normalizeCountryFromParsed(value: z.infer<typeof countrySchema>): CountryContext {
  const productionBonusPercent = value.strategicResources?.bonuses?.productionPercent;
  return {
    id: value._id,
    code: value.code,
    name: value.name,
    ...(value.development === undefined ? {} : { development: value.development }),
    ...(value.specializedItem === undefined ? {} : { specializedItem: value.specializedItem }),
    ...(value.taxes === undefined ? {} : { taxes: value.taxes }),
    ...(productionBonusPercent === undefined ? {} : { productionBonusPercent }),
  };
}

export function normalizeCountry(raw: unknown): CountryContext {
  return normalizeCountryFromParsed(countrySchema.parse(raw));
}

export function normalizeCountries(raw: unknown): CountryContext[] {
  return countriesSchema.parse(raw).map(normalizeCountryFromParsed);
}

export function normalizeMarketPrices(raw: unknown): MarketPriceMap {
  return marketPricesSchema.parse(raw);
}

function normalizeOrder(
  value: z.infer<typeof marketOrderBookSchema>["buyOrders"][number],
): MarketOrder {
  return {
    id: value._id,
    ownerId: value.user,
    itemCode: value.itemCode,
    quantity: value.quantity,
    price: value.price,
    type: value.type,
    ...(value.offerAt === undefined ? {} : { offeredAt: value.offerAt }),
  };
}

export function normalizeMarketOrderBook(raw: unknown): MarketOrderBook {
  const value = marketOrderBookSchema.parse(raw);
  return {
    buyOrders: value.buyOrders.map(normalizeOrder),
    sellOrders: value.sellOrders.map(normalizeOrder),
  };
}

const economySkillKeys: EconomySkillKey[] = [
  "production",
  "entrepreneurship",
  "management",
  "companies",
];
const companyUpgradeKeys: CompanyUpgradeKey[] = ["automatedEngine", "storage", "breakRoom"];

export function normalizeEconomyGameConfig(raw: unknown): EconomyGameConfig {
  const value = economyGameConfigSchema.parse(raw);

  const skills = Object.fromEntries(
    economySkillKeys.map((key) => {
      const rawSkill = value.skills[key];
      const normalized: EconomySkillConfig = {
        key,
        levels: Object.fromEntries(
          Object.entries(rawSkill.levels).map(([level, config]) => {
            const parsedLevel = parseLevelKey(level);
            return [
              parsedLevel,
              {
                level: parsedLevel,
                value: config.value,
                totalCost: config.totalCost,
                ...(config.cost === undefined ? {} : { cost: config.cost }),
                unlockAtLevel: config.unlockAtLevel,
              },
            ];
          }),
        ),
      };
      return [key, normalized];
    }),
  ) as Record<EconomySkillKey, EconomySkillConfig>;

  const items = Object.fromEntries(
    Object.entries(value.items).map(([key, item]) => {
      const normalized: ItemEconomyConfig = {
        code: item.code,
        type: item.type,
        rarity: item.rarity,
        ...(item.productionPoints === undefined ? {} : { productionPoints: item.productionPoints }),
        productionNeeds: item.productionNeeds ?? {},
        ...(item.isTradable === undefined ? {} : { isTradable: item.isTradable }),
      };
      return [key, normalized];
    }),
  );

  const companyUpgrades = Object.fromEntries(
    companyUpgradeKeys.map((key) => {
      const upgrade = value.upgradesConfig[key];
      const normalized: CompanyUpgradeConfig = {
        key,
        ...(upgrade.canDowngrade === undefined ? {} : { canDowngrade: upgrade.canDowngrade }),
        ...(upgrade.pendingDurationHours === undefined
          ? {}
          : { pendingDurationHours: upgrade.pendingDurationHours }),
        levels: Object.fromEntries(
          Object.entries(upgrade.levels).map(([level, config]) => [
            parseLevelKey(level),
            {
              level: config.level,
              steelCost: config.steelCost,
              ...(config.constructionPointsCost === undefined
                ? {}
                : { constructionPointsCost: config.constructionPointsCost }),
              stats: {
                ...(config.stats.dailyProd === undefined
                  ? {}
                  : { dailyProd: config.stats.dailyProd }),
                ...(config.stats.maxProduction === undefined
                  ? {}
                  : { maxProduction: config.stats.maxProduction }),
                ...(config.stats.maxWorkers === undefined
                  ? {}
                  : { maxWorkers: config.stats.maxWorkers }),
                ...(config.stats.dailyHires === undefined
                  ? {}
                  : { dailyHires: config.stats.dailyHires }),
              },
            },
          ]),
        ),
      };
      return [key, normalized];
    }),
  ) as Record<CompanyUpgradeKey, CompanyUpgradeConfig>;

  return {
    skills,
    items,
    companyUpgrades,
    company: {
      ...(value.company.depositResourceBonus === undefined
        ? {}
        : { depositResourceBonus: value.company.depositResourceBonus }),
      ...(value.company.moveCost === undefined ? {} : { moveCost: value.company.moveCost }),
      ...(value.company.changeItemCost === undefined
        ? {}
        : { changeItemCost: value.company.changeItemCost }),
    },
    worker: {
      ...(value.worker.maxFidelity === undefined ? {} : { maxFidelity: value.worker.maxFidelity }),
      ...(value.worker.fidelityProductionBonusPercent === undefined
        ? {}
        : { fidelityProductionBonusPercent: value.worker.fidelityProductionBonusPercent }),
    },
  };
}
