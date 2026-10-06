import {
  companyUpgradeAvailability,
  companyUpgradeKeys,
  type CompanyUpgradeConfig,
  type CompanyUpgradeKey,
  type CompanyUpgradeLevelConfig,
  type EconomyGameConfig,
  type PublicCompanySnapshot,
  type ValueWithProvenance,
} from "@warera-lab/domain";

export const companyUpgradePlannerVersion = "company-upgrade-planner-v1" as const;

export const companyUpgradeStatKeys = [
  "dailyProd",
  "maxProduction",
  "maxWorkers",
  "dailyHires",
] as const;

export type CompanyUpgradeStatKey = (typeof companyUpgradeStatKeys)[number];
export type CompanyUpgradeDirection = "no-op" | "upgrade" | "downgrade";

export type CompanyUpgradePlannerErrorCode =
  | "CURRENT_LEVEL_UNAVAILABLE"
  | "PROPOSED_LEVEL_UNAVAILABLE"
  | "DOWNGRADE_NOT_ALLOWED"
  | "FEATURE_NOT_PRODUCTION";

export class CompanyUpgradePlannerError extends Error {
  readonly code: CompanyUpgradePlannerErrorCode;
  readonly upgrade: CompanyUpgradeKey;
  readonly level: number;

  constructor(
    message: string,
    details: { code: CompanyUpgradePlannerErrorCode; upgrade: CompanyUpgradeKey; level: number },
  ) {
    super(message);
    this.name = "CompanyUpgradePlannerError";
    this.code = details.code;
    this.upgrade = details.upgrade;
    this.level = details.level;
  }
}

export interface CompanyUpgradePlannerInput {
  company: PublicCompanySnapshot;
  upgradeConfig: EconomyGameConfig["companyUpgrades"];
  proposedLevels?: Partial<Record<CompanyUpgradeKey, number>>;
}

export interface ConfiguredUpgradeStatComparison {
  current?: ValueWithProvenance<number>;
  proposed?: ValueWithProvenance<number>;
  delta?: ValueWithProvenance<number>;
}

export interface CompanyUpgradePlanEntry {
  key: CompanyUpgradeKey;
  currentLevel: ValueWithProvenance<number>;
  proposedLevel: ValueWithProvenance<number>;
  direction: ValueWithProvenance<CompanyUpgradeDirection>;
  currentConfiguredSteelCost: ValueWithProvenance<number>;
  proposedConfiguredSteelCost: ValueWithProvenance<number>;
  configuredSteelCostDelta: ValueWithProvenance<number>;
  currentConfiguredConstructionPointsCost?: ValueWithProvenance<number>;
  proposedConfiguredConstructionPointsCost?: ValueWithProvenance<number>;
  configuredConstructionPointsCostDelta?: ValueWithProvenance<number>;
  configuredStats: Partial<Record<CompanyUpgradeStatKey, ConfiguredUpgradeStatComparison>>;
}

export interface CompanyUpgradePlannerResult {
  version: typeof companyUpgradePlannerVersion;
  companyId: ValueWithProvenance<string>;
  upgrades: Record<CompanyUpgradeKey, CompanyUpgradePlanEntry>;
}

function value<T>(
  input: T,
  provenance: ValueWithProvenance<T>["provenance"],
): ValueWithProvenance<T> {
  return { value: input, provenance };
}

function resolveLevel(
  upgrade: CompanyUpgradeKey,
  level: number,
  config: CompanyUpgradeConfig,
  code: "CURRENT_LEVEL_UNAVAILABLE" | "PROPOSED_LEVEL_UNAVAILABLE",
): CompanyUpgradeLevelConfig | undefined {
  if (!Number.isInteger(level) || level < 0) {
    throw new CompanyUpgradePlannerError(
      `${upgrade} level ${level} is not a valid non-negative integer configuration level.`,
      { code, upgrade, level },
    );
  }

  const configured = config.levels[level];
  if (configured !== undefined) return configured;
  if (level === 0) return undefined;

  throw new CompanyUpgradePlannerError(
    `${upgrade} level ${level} is absent from the current game configuration.`,
    { code, upgrade, level },
  );
}

function constructionPointsCost(config: CompanyUpgradeLevelConfig | undefined): number | undefined {
  if (config === undefined) return 0;
  return config.constructionPointsCost;
}

function configuredStatComparison(
  current: CompanyUpgradeLevelConfig | undefined,
  proposed: CompanyUpgradeLevelConfig | undefined,
  stat: CompanyUpgradeStatKey,
  changed: boolean,
): ConfiguredUpgradeStatComparison | undefined {
  const currentValue = current?.stats[stat];
  const proposedValue = proposed?.stats[stat];

  if (currentValue === undefined && proposedValue === undefined) return undefined;

  return {
    ...(currentValue === undefined ? {} : { current: value(currentValue, "observed") }),
    ...(proposedValue === undefined
      ? {}
      : { proposed: value(proposedValue, changed ? "derived" : "observed") }),
    ...(currentValue === undefined || proposedValue === undefined
      ? {}
      : { delta: value(proposedValue - currentValue, "derived") }),
  };
}

function direction(currentLevel: number, proposedLevel: number): CompanyUpgradeDirection {
  if (proposedLevel === currentLevel) return "no-op";
  return proposedLevel > currentLevel ? "upgrade" : "downgrade";
}

export function planCompanyUpgrades(
  input: CompanyUpgradePlannerInput,
): CompanyUpgradePlannerResult {
  const upgrades = {} as Record<CompanyUpgradeKey, CompanyUpgradePlanEntry>;

  for (const upgrade of companyUpgradeKeys) {
    const config = input.upgradeConfig[upgrade];
    const currentLevel = input.company.activeUpgradeLevels[upgrade] ?? 0;
    const proposedLevel = input.proposedLevels?.[upgrade] ?? currentLevel;
    const currentConfig = resolveLevel(upgrade, currentLevel, config, "CURRENT_LEVEL_UNAVAILABLE");
    const proposedConfig = resolveLevel(
      upgrade,
      proposedLevel,
      config,
      "PROPOSED_LEVEL_UNAVAILABLE",
    );
    const changeDirection = direction(currentLevel, proposedLevel);
    const availability = companyUpgradeAvailability[upgrade];

    if (changeDirection !== "no-op" && availability.gameplay !== "production") {
      throw new CompanyUpgradePlannerError(
        `${upgrade} is exposed by the API/config but is not currently verified as production-live gameplay, so WarEra Lab will not plan a level change for it.`,
        { code: "FEATURE_NOT_PRODUCTION", upgrade, level: proposedLevel },
      );
    }

    if (changeDirection === "downgrade" && config.canDowngrade !== true) {
      throw new CompanyUpgradePlannerError(
        `${upgrade} cannot be planned below the observed level because downgrade support is not enabled in the current configuration.`,
        { code: "DOWNGRADE_NOT_ALLOWED", upgrade, level: proposedLevel },
      );
    }

    const changed = changeDirection !== "no-op";
    const currentSteelCost = currentConfig?.steelCost ?? 0;
    const proposedSteelCost = proposedConfig?.steelCost ?? 0;
    const currentConstructionCost = constructionPointsCost(currentConfig);
    const proposedConstructionCost = constructionPointsCost(proposedConfig);
    const configuredStats: CompanyUpgradePlanEntry["configuredStats"] = {};

    for (const stat of companyUpgradeStatKeys) {
      const comparison = configuredStatComparison(currentConfig, proposedConfig, stat, changed);
      if (comparison !== undefined) configuredStats[stat] = comparison;
    }

    upgrades[upgrade] = {
      key: upgrade,
      currentLevel: value(currentLevel, "observed"),
      proposedLevel: value(proposedLevel, changed ? "overridden" : "observed"),
      direction: value(changeDirection, "derived"),
      currentConfiguredSteelCost: value(
        currentSteelCost,
        currentConfig === undefined ? "derived" : "observed",
      ),
      proposedConfiguredSteelCost: value(
        proposedSteelCost,
        proposedConfig === undefined || changed ? "derived" : "observed",
      ),
      configuredSteelCostDelta: value(proposedSteelCost - currentSteelCost, "derived"),
      ...(currentConstructionCost === undefined
        ? {}
        : {
            currentConfiguredConstructionPointsCost: value(
              currentConstructionCost,
              currentConfig === undefined ? "derived" : "observed",
            ),
          }),
      ...(proposedConstructionCost === undefined
        ? {}
        : {
            proposedConfiguredConstructionPointsCost: value(
              proposedConstructionCost,
              proposedConfig === undefined || changed ? "derived" : "observed",
            ),
          }),
      ...(currentConstructionCost === undefined || proposedConstructionCost === undefined
        ? {}
        : {
            configuredConstructionPointsCostDelta: value(
              proposedConstructionCost - currentConstructionCost,
              "derived",
            ),
          }),
      configuredStats,
    };
  }

  return {
    version: companyUpgradePlannerVersion,
    companyId: value(input.company.id, "observed"),
    upgrades,
  };
}
