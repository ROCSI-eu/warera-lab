import type {
  EconomyGameConfig,
  EconomySkillConfig,
  EconomySkillKey,
  PublicPlayerEconomySnapshot,
} from "@warera-lab/domain";
import { describe, expect, it } from "vitest";

import { planEconomySkills, SkillPlannerError } from "./skill-planner.js";

function skill(key: EconomySkillKey, levels: EconomySkillConfig["levels"]): EconomySkillConfig {
  return { key, levels };
}

const skillConfig: EconomyGameConfig["skills"] = {
  production: skill("production", {
    0: { level: 0, value: 10, totalCost: 0, unlockAtLevel: 1 },
    1: { level: 1, value: 12, totalCost: 1, cost: 1, unlockAtLevel: 2 },
    2: { level: 2, value: 16, totalCost: 3, cost: 2, unlockAtLevel: 5 },
  }),
  entrepreneurship: skill("entrepreneurship", {
    0: { level: 0, value: 30, totalCost: 0, unlockAtLevel: 1 },
    1: { level: 1, value: 35, totalCost: 2, cost: 2, unlockAtLevel: 3 },
    2: { level: 2, value: 42, totalCost: 5, cost: 3, unlockAtLevel: 8 },
  }),
  management: skill("management", {
    0: { level: 0, value: 4, totalCost: 0, unlockAtLevel: 1 },
    1: { level: 1, value: 6, totalCost: 1, cost: 1, unlockAtLevel: 4 },
    2: { level: 2, value: 9, totalCost: 4, cost: 3, unlockAtLevel: 7 },
  }),
  companies: skill("companies", {
    0: { level: 0, value: 2, totalCost: 0, unlockAtLevel: 1 },
    1: { level: 1, value: 3, totalCost: 2, cost: 2, unlockAtLevel: 6 },
    2: { level: 2, value: 4, totalCost: 5, cost: 3, unlockAtLevel: 9 },
  }),
};

const player: PublicPlayerEconomySnapshot = {
  id: "player-1",
  username: "Planner",
  countryId: "country-1",
  level: 6,
  availableSkillPoints: 5,
  spentSkillPoints: 10,
  totalSkillPoints: 15,
  skills: {
    production: { level: 1, value: 12, total: 12 },
    entrepreneurship: { level: 0, value: 30, total: 30 },
    management: { level: 1, value: 6, total: 6 },
    companies: { level: 0, value: 2, total: 2 },
  },
};

describe("planEconomySkills", () => {
  it("returns a no-op baseline with provenance and no extra point cost", () => {
    const result = planEconomySkills({ player, skillConfig });

    expect(result.version).toBe("skill-planner-v1");
    expect(result.additionalSkillPointsRequired).toEqual({
      value: 0,
      provenance: "derived",
    });
    expect(result.remainingSkillPoints.value).toBe(5);
    expect(result.overspentSkillPoints.value).toBe(0);
    expect(result.canApplyAllocation.value).toBe(true);
    expect(result.skills.production.currentLevel.provenance).toBe("observed");
    expect(result.skills.production.proposedLevel.provenance).toBe("observed");
    expect(result.skills.production.currentObservedValue).toEqual({
      value: 12,
      provenance: "observed",
    });
  });

  it("uses cumulative configuration costs for multi-skill planned upgrades", () => {
    const result = planEconomySkills({
      player,
      skillConfig,
      proposedLevels: {
        production: 2,
        entrepreneurship: 1,
        companies: 1,
      },
    });

    expect(result.currentEconomySkillPointCost.value).toBe(2);
    expect(result.proposedEconomySkillPointCost.value).toBe(8);
    expect(result.additionalSkillPointsRequired.value).toBe(6);
    expect(result.plannedSpentSkillPoints.value).toBe(16);
    expect(result.remainingSkillPoints.value).toBe(0);
    expect(result.overspentSkillPoints.value).toBe(1);
    expect(result.canApplyAllocation.value).toBe(false);

    expect(result.skills.production).toMatchObject({
      proposedLevel: { value: 2, provenance: "overridden" },
      proposedConfiguredValue: { value: 16, provenance: "derived" },
      valueDelta: { value: 4, provenance: "derived" },
      additionalPointCost: { value: 2, provenance: "derived" },
      eligible: { value: true, provenance: "derived" },
    });
  });

  it("reports unlock ineligibility independently from the point budget", () => {
    const result = planEconomySkills({
      player: { ...player, availableSkillPoints: 10, totalSkillPoints: 20 },
      skillConfig,
      proposedLevels: { management: 2 },
    });

    expect(result.additionalSkillPointsRequired.value).toBe(3);
    expect(result.overspentSkillPoints.value).toBe(0);
    expect(result.skills.management.unlockAtPlayerLevel.value).toBe(7);
    expect(result.skills.management.eligible.value).toBe(false);
    expect(result.allUnlocksEligible.value).toBe(false);
    expect(result.canApplyAllocation.value).toBe(false);
  });

  it("rejects proposed levels that are absent from the normalized game configuration", () => {
    expect(() =>
      planEconomySkills({
        player,
        skillConfig,
        proposedLevels: { production: 99 },
      }),
    ).toThrowError(SkillPlannerError);

    try {
      planEconomySkills({
        player,
        skillConfig,
        proposedLevels: { production: 99 },
      });
    } catch (error) {
      expect(error).toMatchObject({
        code: "PROPOSED_LEVEL_UNAVAILABLE",
        skill: "production",
        level: 99,
      });
    }
  });

  it("rejects downgrades until a skill respec/refund mechanic is verified", () => {
    try {
      planEconomySkills({
        player,
        skillConfig,
        proposedLevels: { production: 0 },
      });
      throw new Error("Expected downgrade to fail");
    } catch (error) {
      expect(error).toMatchObject({
        code: "DOWNGRADE_UNVERIFIED",
        skill: "production",
        level: 0,
      });
    }
  });

  it("rejects a configuration whose cumulative cost decreases at a higher level", () => {
    const invalidConfig: EconomyGameConfig["skills"] = {
      ...skillConfig,
      production: skill("production", {
        ...skillConfig.production.levels,
        2: { level: 2, value: 16, totalCost: 0, unlockAtLevel: 5 },
      }),
    };

    try {
      planEconomySkills({
        player,
        skillConfig: invalidConfig,
        proposedLevels: { production: 2 },
      });
      throw new Error("Expected non-monotonic configuration to fail");
    } catch (error) {
      expect(error).toMatchObject({
        code: "NON_MONOTONIC_CONFIG",
        skill: "production",
        level: 2,
      });
    }
  });
});
