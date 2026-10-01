import type {
  EconomyPlannerContextResponse,
  PublicCompanySnapshot,
  PublicPlayerSnapshotResponse,
} from "@warera-lab/domain";
import {
  ScenarioModelError,
  compareMarketMarginScenarios,
  compareScenarioDocument,
  createScenarioDocument,
  decodeScenarioFragment,
  parseScenarioDocument,
  type EconomyScenarioStateV1,
  type ScenarioDocumentComparisonV1,
  type ScenarioDocumentV1,
  type ScenarioStateComparisonV1,
} from "@warera-lab/simulation-core";

import {
  evaluateEconomyLab,
  type EconomyLabEvaluation,
  type EconomyLabFormState,
} from "./economy-lab-model.js";

export type ScenarioSlot = "baseline" | "scenarioA" | "scenarioB";

export interface ScenarioEvaluationSummary {
  slot: ScenarioSlot;
  evaluation?: EconomyLabEvaluation;
  unavailableReason?: string;
}

export interface DerivedScenarioComparison {
  from: ScenarioSlot;
  to: ScenarioSlot;
  skillPointDelta?: number;
  remainingSkillPointDelta?: number;
  grossMarginDelta?: number;
  marginPerUnitDelta?: number;
  breakEvenPriceDelta?: number;
  upgradeSteelCostDelta?: number;
  note?: string;
}

function observedScenario(
  snapshot: PublicPlayerSnapshotResponse,
  company: PublicCompanySnapshot,
): EconomyScenarioStateV1 {
  return {
    skills: {
      production: snapshot.player.skills.production.level,
      entrepreneurship: snapshot.player.skills.entrepreneurship.level,
      management: snapshot.player.skills.management.level,
      companies: snapshot.player.skills.companies.level,
    },
    companyItemCode: company.itemCode,
    companyUpgrades: {
      automatedEngine: company.activeUpgradeLevels.automatedEngine ?? 0,
      storage: company.activeUpgradeLevels.storage ?? 0,
      breakRoom: company.activeUpgradeLevels.breakRoom ?? 0,
    },
    market: {
      itemCode: company.itemCode,
      quantity: 1,
      inputPriceOverrides: {},
    },
  };
}

function cloneScenario(state: EconomyScenarioStateV1): EconomyScenarioStateV1 {
  return {
    skills: { ...state.skills },
    ...(state.companyItemCode === undefined ? {} : { companyItemCode: state.companyItemCode }),
    companyUpgrades: { ...state.companyUpgrades },
    ...(state.market === undefined
      ? {}
      : {
          market: {
            itemCode: state.market.itemCode,
            quantity: state.market.quantity,
            inputPriceOverrides: { ...state.market.inputPriceOverrides },
            ...(state.market.outputPriceOverride === undefined
              ? {}
              : { outputPriceOverride: state.market.outputPriceOverride }),
            ...(state.market.assumedLabourCostTotal === undefined
              ? {}
              : { assumedLabourCostTotal: state.market.assumedLabourCostTotal }),
            ...(state.market.assumedOtherCostTotal === undefined
              ? {}
              : { assumedOtherCostTotal: state.market.assumedOtherCostTotal }),
          },
        }),
  };
}

function scenarioConfigMetadata(context: EconomyPlannerContextResponse) {
  return {
    revision: context.configRevision,
    retrievedAt:
      context.freshness.sources.find((source) => source.source === "gameConfig")?.retrievedAt ??
      context.freshness.generatedAt,
  };
}

export function createWorkspaceScenarioDocument(
  snapshot: PublicPlayerSnapshotResponse,
  company: PublicCompanySnapshot,
  context: EconomyPlannerContextResponse,
): ScenarioDocumentV1 {
  const baseline = observedScenario(snapshot, company);

  return createScenarioDocument(
    {
      baseline,
      scenarioA: cloneScenario(baseline),
      scenarioB: cloneScenario(baseline),
      config: scenarioConfigMetadata(context),
      sourceSnapshotRetrievedAt: snapshot.freshness.generatedAt,
      sourcePlayer: {
        id: snapshot.player.id,
        username: snapshot.player.username,
      },
    },
    { includeSourcePlayerIdentity: true },
  );
}

export function refreshWorkspaceScenarioDocument(
  document: ScenarioDocumentV1,
  snapshot: PublicPlayerSnapshotResponse,
  company: PublicCompanySnapshot,
  context: EconomyPlannerContextResponse,
): ScenarioDocumentV1 {
  const samePlayer = document.source?.player?.id === snapshot.player.id;
  const sameItem =
    document.scenarios.baseline.companyItemCode === company.itemCode &&
    document.scenarios.baseline.market?.itemCode === company.itemCode;

  if (!samePlayer || !sameItem) {
    return createWorkspaceScenarioDocument(snapshot, company, context);
  }

  return createScenarioDocument(
    {
      baseline: observedScenario(snapshot, company),
      scenarioA: cloneScenario(document.scenarios.scenarioA),
      scenarioB: cloneScenario(document.scenarios.scenarioB),
      config: scenarioConfigMetadata(context),
      sourceSnapshotRetrievedAt: snapshot.freshness.generatedAt,
      sourcePlayer: {
        id: snapshot.player.id,
        username: snapshot.player.username,
      },
    },
    { includeSourcePlayerIdentity: true },
  );
}

function requireNumber(value: string, label: string): number {
  if (value.trim() === "") throw new Error(`${label} is required.`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a finite number.`);
  return parsed;
}

function requireLevel(value: string, label: string): number {
  const parsed = requireNumber(value, label);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return parsed;
}

function requirePositive(value: string, label: string): number {
  const parsed = requireNumber(value, label);
  if (parsed <= 0) throw new Error(`${label} must be greater than zero.`);
  return parsed;
}

function requireNonNegative(value: string, label: string): number {
  const parsed = requireNumber(value, label);
  if (parsed < 0) throw new Error(`${label} must be non-negative.`);
  return parsed;
}

function optionalNonNegative(value: string, label: string): number | undefined {
  if (value.trim() === "") return undefined;
  return requireNonNegative(value, label);
}

export function scenarioToForm(
  scenario: EconomyScenarioStateV1,
  context?: EconomyPlannerContextResponse,
): EconomyLabFormState {
  const recipeInputs = Object.keys(context?.item?.productionNeeds ?? {});
  const savedOverrides = scenario.market?.inputPriceOverrides ?? {};

  return {
    skillLevels: {
      production: String(scenario.skills.production ?? 0),
      entrepreneurship: String(scenario.skills.entrepreneurship ?? 0),
      management: String(scenario.skills.management ?? 0),
      companies: String(scenario.skills.companies ?? 0),
    },
    upgradeLevels: {
      automatedEngine: String(scenario.companyUpgrades.automatedEngine ?? 0),
      storage: String(scenario.companyUpgrades.storage ?? 0),
      breakRoom: String(scenario.companyUpgrades.breakRoom ?? 0),
    },
    quantity: String(scenario.market?.quantity ?? 1),
    outputPriceOverride:
      scenario.market?.outputPriceOverride === undefined
        ? ""
        : String(scenario.market.outputPriceOverride),
    inputPriceOverrides: Object.fromEntries(
      [...new Set([...recipeInputs, ...Object.keys(savedOverrides)])].map((itemCode) => [
        itemCode,
        savedOverrides[itemCode] === undefined ? "" : String(savedOverrides[itemCode]),
      ]),
    ),
    assumedLabourCostTotal:
      scenario.market?.assumedLabourCostTotal === undefined
        ? ""
        : String(scenario.market.assumedLabourCostTotal),
    assumedOtherCostTotal:
      scenario.market?.assumedOtherCostTotal === undefined
        ? ""
        : String(scenario.market.assumedOtherCostTotal),
  };
}

export function formToScenario(
  form: EconomyLabFormState,
  itemCode: string,
): EconomyScenarioStateV1 {
  const inputPriceOverrides = Object.fromEntries(
    Object.entries(form.inputPriceOverrides)
      .filter(([, value]) => value.trim() !== "")
      .map(([code, value]) => [code, requireNonNegative(value, `${code} price override`)]),
  );
  const outputPriceOverride = optionalNonNegative(
    form.outputPriceOverride,
    "Output price override",
  );
  const assumedLabourCostTotal = optionalNonNegative(
    form.assumedLabourCostTotal,
    "Assumed labour cost",
  );
  const assumedOtherCostTotal = optionalNonNegative(
    form.assumedOtherCostTotal,
    "Other assumed cost",
  );

  return {
    skills: {
      production: requireLevel(form.skillLevels.production, "Production level"),
      entrepreneurship: requireLevel(form.skillLevels.entrepreneurship, "Entrepreneurship level"),
      management: requireLevel(form.skillLevels.management, "Management level"),
      companies: requireLevel(form.skillLevels.companies, "Companies level"),
    },
    companyItemCode: itemCode,
    companyUpgrades: {
      automatedEngine: requireLevel(form.upgradeLevels.automatedEngine, "Automated Engine level"),
      storage: requireLevel(form.upgradeLevels.storage, "Storage level"),
      breakRoom: requireLevel(form.upgradeLevels.breakRoom, "Break Room level"),
    },
    market: {
      itemCode,
      quantity: requirePositive(form.quantity, "Quantity"),
      inputPriceOverrides,
      ...(outputPriceOverride === undefined ? {} : { outputPriceOverride }),
      ...(assumedLabourCostTotal === undefined ? {} : { assumedLabourCostTotal }),
      ...(assumedOtherCostTotal === undefined ? {} : { assumedOtherCostTotal }),
    },
  };
}

export function replaceScenario(
  document: ScenarioDocumentV1,
  slot: Exclude<ScenarioSlot, "baseline">,
  state: EconomyScenarioStateV1,
): ScenarioDocumentV1 {
  return parseScenarioDocument({
    ...document,
    scenarios: {
      ...document.scenarios,
      [slot]: cloneScenario(state),
    },
  });
}

export function evaluateScenario(
  slot: ScenarioSlot,
  document: ScenarioDocumentV1,
  snapshot?: PublicPlayerSnapshotResponse,
  company?: PublicCompanySnapshot,
  context?: EconomyPlannerContextResponse,
): ScenarioEvaluationSummary {
  if (!snapshot || !company || !context) {
    return {
      slot,
      unavailableReason:
        "Live player/company context is not attached. Scenario inputs remain available for comparison and sharing.",
    };
  }

  const state = document.scenarios[slot];
  if (state.companyItemCode !== company.itemCode || state.market?.itemCode !== company.itemCode) {
    return {
      slot,
      unavailableReason:
        "This scenario targets a different company item than the currently attached live company.",
    };
  }

  return {
    slot,
    evaluation: evaluateEconomyLab(
      snapshot.player,
      company,
      context,
      scenarioToForm(state, context),
    ),
  };
}

function totalUpgradeSteelDelta(evaluation: EconomyLabEvaluation | undefined): number | undefined {
  if (!evaluation?.upgradePlan) return undefined;
  return Object.values(evaluation.upgradePlan.upgrades).reduce(
    (sum, entry) => sum + entry.configuredSteelCostDelta.value,
    0,
  );
}

function compareDerivedPair(
  fromSlot: ScenarioSlot,
  toSlot: ScenarioSlot,
  from: ScenarioEvaluationSummary,
  to: ScenarioEvaluationSummary,
): DerivedScenarioComparison {
  if (!from.evaluation || !to.evaluation) {
    return {
      from: fromSlot,
      to: toSlot,
      note: from.unavailableReason ?? to.unavailableReason ?? "Derived results are unavailable.",
    };
  }

  const fromMarket = from.evaluation.marketResult;
  const toMarket = to.evaluation.marketResult;
  let marketComparison: ReturnType<typeof compareMarketMarginScenarios> | undefined;
  let note: string | undefined;

  if (fromMarket && toMarket) {
    try {
      marketComparison = compareMarketMarginScenarios(fromMarket, toMarket);
    } catch {
      note =
        "Market results use different items and are shown separately rather than directly compared.";
    }
  } else if (from.evaluation.marketError || to.evaluation.marketError) {
    note =
      "At least one market result is unavailable until its required live references or overrides are present.";
  }

  const fromSteel = totalUpgradeSteelDelta(from.evaluation);
  const toSteel = totalUpgradeSteelDelta(to.evaluation);

  return {
    from: fromSlot,
    to: toSlot,
    ...(from.evaluation.skillPlan && to.evaluation.skillPlan
      ? {
          skillPointDelta:
            to.evaluation.skillPlan.additionalSkillPointsRequired.value -
            from.evaluation.skillPlan.additionalSkillPointsRequired.value,
          remainingSkillPointDelta:
            to.evaluation.skillPlan.remainingSkillPoints.value -
            from.evaluation.skillPlan.remainingSkillPoints.value,
        }
      : {}),
    ...(marketComparison === undefined
      ? {}
      : {
          grossMarginDelta: marketComparison.grossMarginDelta.value,
          marginPerUnitDelta: marketComparison.marginPerUnitDelta.value,
          breakEvenPriceDelta: marketComparison.breakEvenOutputPriceDelta.value,
        }),
    ...(fromSteel === undefined || toSteel === undefined
      ? {}
      : { upgradeSteelCostDelta: toSteel - fromSteel }),
    ...(note === undefined ? {} : { note }),
  };
}

export function buildScenarioComparisons(
  document: ScenarioDocumentV1,
  evaluations: Record<ScenarioSlot, ScenarioEvaluationSummary>,
): {
  inputs: ScenarioDocumentComparisonV1;
  derived: {
    baselineToA: DerivedScenarioComparison;
    baselineToB: DerivedScenarioComparison;
    scenarioAToB: DerivedScenarioComparison;
  };
} {
  return {
    inputs: compareScenarioDocument(document),
    derived: {
      baselineToA: compareDerivedPair(
        "baseline",
        "scenarioA",
        evaluations.baseline,
        evaluations.scenarioA,
      ),
      baselineToB: compareDerivedPair(
        "baseline",
        "scenarioB",
        evaluations.baseline,
        evaluations.scenarioB,
      ),
      scenarioAToB: compareDerivedPair(
        "scenarioA",
        "scenarioB",
        evaluations.scenarioA,
        evaluations.scenarioB,
      ),
    },
  };
}

export function scenarioChangesForPair(
  comparison: ScenarioDocumentComparisonV1,
  pair: "baselineToA" | "baselineToB" | "scenarioAToB",
): ScenarioStateComparisonV1 {
  return comparison[pair];
}

export function importScenarioFragment(fragment: string): {
  document?: ScenarioDocumentV1;
  error?: string;
} {
  if (!fragment.startsWith("#wl=")) return {};
  try {
    return { document: decodeScenarioFragment(fragment) };
  } catch (caught) {
    return {
      error:
        caught instanceof ScenarioModelError
          ? caught.message
          : "Shared scenario URL could not be imported safely.",
    };
  }
}
