import type {
  CompanyUpgradeKey,
  EconomyPlannerContextResponse,
  EconomySkillKey,
  PublicCompanySnapshot,
  PublicPlayerEconomySnapshot,
} from "@warera-lab/domain";
import {
  CompanyUpgradePlannerError,
  MarketMarginSimulationError,
  SkillPlannerError,
  planCompanyUpgrades,
  planEconomySkills,
  simulateMarketMargin,
  type CompanyUpgradePlannerResult,
  type EconomySkillPlannerResult,
  type MarketMarginSimulationResult,
} from "@warera-lab/simulation-core";

export interface EconomyLabFormState {
  skillLevels: Record<EconomySkillKey, string>;
  upgradeLevels: Record<CompanyUpgradeKey, string>;
  quantity: string;
  outputPriceOverride: string;
  inputPriceOverrides: Record<string, string>;
  assumedLabourCostTotal: string;
  assumedOtherCostTotal: string;
}

export interface EconomyLabEvaluation {
  skillPlan?: EconomySkillPlannerResult;
  skillError?: string;
  upgradePlan?: CompanyUpgradePlannerResult;
  upgradeError?: string;
  marketResult?: MarketMarginSimulationResult;
  marketError?: string;
}

function numberValue(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

function optionalNumber(value: string): number | undefined {
  return value.trim() === "" ? undefined : Number(value);
}

export function createEconomyLabForm(
  player: PublicPlayerEconomySnapshot,
  company: PublicCompanySnapshot,
  context: EconomyPlannerContextResponse,
): EconomyLabFormState {
  return {
    skillLevels: {
      production: String(player.skills.production.level),
      entrepreneurship: String(player.skills.entrepreneurship.level),
      management: String(player.skills.management.level),
      companies: String(player.skills.companies.level),
    },
    upgradeLevels: {
      automatedEngine: String(company.activeUpgradeLevels.automatedEngine ?? 0),
      storage: String(company.activeUpgradeLevels.storage ?? 0),
      breakRoom: String(company.activeUpgradeLevels.breakRoom ?? 0),
    },
    quantity: "1",
    outputPriceOverride: "",
    inputPriceOverrides: Object.fromEntries(
      Object.keys(context.item?.productionNeeds ?? {}).map((itemCode) => [itemCode, ""]),
    ),
    assumedLabourCostTotal: "",
    assumedOtherCostTotal: "",
  };
}

export function evaluateEconomyLab(
  player: PublicPlayerEconomySnapshot,
  company: PublicCompanySnapshot,
  context: EconomyPlannerContextResponse,
  form: EconomyLabFormState,
): EconomyLabEvaluation {
  const result: EconomyLabEvaluation = {};

  try {
    result.skillPlan = planEconomySkills({
      player,
      skillConfig: context.skills,
      proposedLevels: {
        production: numberValue(form.skillLevels.production),
        entrepreneurship: numberValue(form.skillLevels.entrepreneurship),
        management: numberValue(form.skillLevels.management),
        companies: numberValue(form.skillLevels.companies),
      },
    });
  } catch (error) {
    result.skillError =
      error instanceof SkillPlannerError ? error.message : "Skill plan could not be calculated.";
  }

  try {
    result.upgradePlan = planCompanyUpgrades({
      company,
      upgradeConfig: context.companyUpgrades,
      proposedLevels: {
        automatedEngine: numberValue(form.upgradeLevels.automatedEngine),
        storage: numberValue(form.upgradeLevels.storage),
        breakRoom: numberValue(form.upgradeLevels.breakRoom),
      },
    });
  } catch (error) {
    result.upgradeError =
      error instanceof CompanyUpgradePlannerError
        ? error.message
        : "Company upgrade plan could not be calculated.";
  }

  if (context.item === undefined) {
    result.marketError =
      "No normalized item configuration is available for this company output item.";
    return result;
  }

  const inputPriceOverrides = Object.fromEntries(
    Object.entries(form.inputPriceOverrides)
      .filter(([, value]) => value.trim() !== "")
      .map(([itemCode, value]) => [itemCode, Number(value)]),
  );

  const outputPriceOverride = optionalNumber(form.outputPriceOverride);
  const assumedLabourCostTotal = optionalNumber(form.assumedLabourCostTotal);
  const assumedOtherCostTotal = optionalNumber(form.assumedOtherCostTotal);

  try {
    result.marketResult = simulateMarketMargin({
      item: context.item,
      marketPrices: context.marketPrices,
      quantity: numberValue(form.quantity),
      ...(outputPriceOverride === undefined ? {} : { outputPriceOverride }),
      ...(Object.keys(inputPriceOverrides).length === 0 ? {} : { inputPriceOverrides }),
      ...(assumedLabourCostTotal === undefined ? {} : { assumedLabourCostTotal }),
      ...(assumedOtherCostTotal === undefined ? {} : { assumedOtherCostTotal }),
    });
  } catch (error) {
    result.marketError =
      error instanceof MarketMarginSimulationError
        ? error.message
        : "Market margin could not be calculated.";
  }

  return result;
}
