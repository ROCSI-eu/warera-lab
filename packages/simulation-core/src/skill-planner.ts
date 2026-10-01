import {
  economySkillKeys,
  type EconomyGameConfig,
  type EconomySkillKey,
  type EconomySkillLevelConfig,
  type PublicPlayerEconomySnapshot,
  type ValueWithProvenance,
} from "@warera-lab/domain";

export const skillPlannerVersion = "skill-planner-v1" as const;

export type SkillPlannerErrorCode =
  | "CURRENT_LEVEL_UNAVAILABLE"
  | "PROPOSED_LEVEL_UNAVAILABLE"
  | "DOWNGRADE_UNVERIFIED"
  | "NON_MONOTONIC_CONFIG";

export class SkillPlannerError extends Error {
  readonly code: SkillPlannerErrorCode;
  readonly skill: EconomySkillKey;
  readonly level: number;

  constructor(
    message: string,
    details: { code: SkillPlannerErrorCode; skill: EconomySkillKey; level: number },
  ) {
    super(message);
    this.name = "SkillPlannerError";
    this.code = details.code;
    this.skill = details.skill;
    this.level = details.level;
  }
}

export interface EconomySkillPlannerInput {
  player: PublicPlayerEconomySnapshot;
  skillConfig: EconomyGameConfig["skills"];
  proposedLevels?: Partial<Record<EconomySkillKey, number>>;
}

export interface EconomySkillPlanEntry {
  key: EconomySkillKey;
  currentLevel: ValueWithProvenance<number>;
  proposedLevel: ValueWithProvenance<number>;
  currentObservedValue: ValueWithProvenance<number>;
  currentConfiguredValue: ValueWithProvenance<number>;
  proposedConfiguredValue: ValueWithProvenance<number>;
  valueDelta: ValueWithProvenance<number>;
  currentTotalCost: ValueWithProvenance<number>;
  proposedTotalCost: ValueWithProvenance<number>;
  additionalPointCost: ValueWithProvenance<number>;
  unlockAtPlayerLevel: ValueWithProvenance<number>;
  eligible: ValueWithProvenance<boolean>;
}

export interface EconomySkillPlannerResult {
  version: typeof skillPlannerVersion;
  playerLevel: ValueWithProvenance<number>;
  totalSkillPoints: ValueWithProvenance<number>;
  spentSkillPoints: ValueWithProvenance<number>;
  availableSkillPoints: ValueWithProvenance<number>;
  currentEconomySkillPointCost: ValueWithProvenance<number>;
  proposedEconomySkillPointCost: ValueWithProvenance<number>;
  additionalSkillPointsRequired: ValueWithProvenance<number>;
  plannedSpentSkillPoints: ValueWithProvenance<number>;
  remainingSkillPoints: ValueWithProvenance<number>;
  overspentSkillPoints: ValueWithProvenance<number>;
  allUnlocksEligible: ValueWithProvenance<boolean>;
  canApplyAllocation: ValueWithProvenance<boolean>;
  skills: Record<EconomySkillKey, EconomySkillPlanEntry>;
}

function value<T>(
  input: T,
  provenance: ValueWithProvenance<T>["provenance"],
): ValueWithProvenance<T> {
  return { value: input, provenance };
}

function requireLevel(
  skill: EconomySkillKey,
  level: number,
  config: EconomyGameConfig["skills"][EconomySkillKey],
  code: "CURRENT_LEVEL_UNAVAILABLE" | "PROPOSED_LEVEL_UNAVAILABLE",
): EconomySkillLevelConfig {
  if (!Number.isInteger(level) || level < 0) {
    throw new SkillPlannerError(
      `${skill} level ${level} is not a valid non-negative integer configuration level.`,
      { code, skill, level },
    );
  }

  const configured = config.levels[level];
  if (configured === undefined) {
    throw new SkillPlannerError(
      `${skill} level ${level} is absent from the current game configuration.`,
      {
        code,
        skill,
        level,
      },
    );
  }

  return configured;
}

export function planEconomySkills(input: EconomySkillPlannerInput): EconomySkillPlannerResult {
  const entries = {} as Record<EconomySkillKey, EconomySkillPlanEntry>;
  let currentEconomySkillPointCost = 0;
  let proposedEconomySkillPointCost = 0;
  let allUnlocksEligible = true;

  for (const skill of economySkillKeys) {
    const observed = input.player.skills[skill];
    const config = input.skillConfig[skill];
    const currentConfig = requireLevel(skill, observed.level, config, "CURRENT_LEVEL_UNAVAILABLE");
    const proposedLevel = input.proposedLevels?.[skill] ?? observed.level;

    if (proposedLevel < observed.level) {
      throw new SkillPlannerError(
        `${skill} cannot be planned below the observed level until a respec/refund mechanic is verified.`,
        { code: "DOWNGRADE_UNVERIFIED", skill, level: proposedLevel },
      );
    }

    const proposedConfig = requireLevel(
      skill,
      proposedLevel,
      config,
      "PROPOSED_LEVEL_UNAVAILABLE",
    );
    const additionalPointCost = proposedConfig.totalCost - currentConfig.totalCost;

    if (additionalPointCost < 0) {
      throw new SkillPlannerError(
        `${skill} configuration cost decreases between the observed and proposed levels.`,
        { code: "NON_MONOTONIC_CONFIG", skill, level: proposedLevel },
      );
    }

    const changed = proposedLevel !== observed.level;
    const eligible = input.player.level >= proposedConfig.unlockAtLevel;
    currentEconomySkillPointCost += currentConfig.totalCost;
    proposedEconomySkillPointCost += proposedConfig.totalCost;
    allUnlocksEligible &&= eligible;

    entries[skill] = {
      key: skill,
      currentLevel: value(observed.level, "observed"),
      proposedLevel: value(proposedLevel, changed ? "overridden" : "observed"),
      currentObservedValue: value(observed.value, "observed"),
      currentConfiguredValue: value(currentConfig.value, "observed"),
      proposedConfiguredValue: value(proposedConfig.value, changed ? "derived" : "observed"),
      valueDelta: value(proposedConfig.value - currentConfig.value, "derived"),
      currentTotalCost: value(currentConfig.totalCost, "observed"),
      proposedTotalCost: value(proposedConfig.totalCost, changed ? "derived" : "observed"),
      additionalPointCost: value(additionalPointCost, "derived"),
      unlockAtPlayerLevel: value(proposedConfig.unlockAtLevel, "observed"),
      eligible: value(eligible, "derived"),
    };
  }

  const additionalSkillPointsRequired =
    proposedEconomySkillPointCost - currentEconomySkillPointCost;
  const rawRemainingSkillPoints = input.player.availableSkillPoints - additionalSkillPointsRequired;
  const remainingSkillPoints = Math.max(0, rawRemainingSkillPoints);
  const overspentSkillPoints = Math.max(0, -rawRemainingSkillPoints);

  return {
    version: skillPlannerVersion,
    playerLevel: value(input.player.level, "observed"),
    totalSkillPoints: value(input.player.totalSkillPoints, "observed"),
    spentSkillPoints: value(input.player.spentSkillPoints, "observed"),
    availableSkillPoints: value(input.player.availableSkillPoints, "observed"),
    currentEconomySkillPointCost: value(currentEconomySkillPointCost, "derived"),
    proposedEconomySkillPointCost: value(proposedEconomySkillPointCost, "derived"),
    additionalSkillPointsRequired: value(additionalSkillPointsRequired, "derived"),
    plannedSpentSkillPoints: value(
      input.player.spentSkillPoints + additionalSkillPointsRequired,
      "derived",
    ),
    remainingSkillPoints: value(remainingSkillPoints, "derived"),
    overspentSkillPoints: value(overspentSkillPoints, "derived"),
    allUnlocksEligible: value(allUnlocksEligible, "derived"),
    canApplyAllocation: value(allUnlocksEligible && overspentSkillPoints === 0, "derived"),
    skills: entries,
  };
}
