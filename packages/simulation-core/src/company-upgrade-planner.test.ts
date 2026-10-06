import type {
  CompanyUpgradeConfig,
  CompanyUpgradeKey,
  EconomyGameConfig,
  PublicCompanySnapshot,
} from "@warera-lab/domain";
import { describe, expect, it } from "vitest";

import { CompanyUpgradePlannerError, planCompanyUpgrades } from "./company-upgrade-planner.js";

function upgrade(
  key: CompanyUpgradeKey,
  config: Omit<CompanyUpgradeConfig, "key">,
): CompanyUpgradeConfig {
  return { key, ...config };
}

const upgradeConfig: EconomyGameConfig["companyUpgrades"] = {
  automatedEngine: upgrade("automatedEngine", {
    canDowngrade: true,
    levels: {
      1: {
        level: 1,
        steelCost: 10,
        constructionPointsCost: 5,
        stats: { dailyProd: 24 },
      },
      2: {
        level: 2,
        steelCost: 25,
        constructionPointsCost: 10,
        stats: { dailyProd: 40 },
      },
    },
  }),
  storage: upgrade("storage", {
    canDowngrade: true,
    levels: {
      1: {
        level: 1,
        steelCost: 20,
        constructionPointsCost: 8,
        stats: { maxProduction: 200 },
      },
      2: {
        level: 2,
        steelCost: 35,
        constructionPointsCost: 14,
        stats: { maxProduction: 350 },
      },
    },
  }),
  breakRoom: upgrade("breakRoom", {
    canDowngrade: true,
    levels: {
      1: {
        level: 1,
        steelCost: 15,
        stats: { maxWorkers: 2, dailyHires: 1 },
      },
      2: {
        level: 2,
        steelCost: 30,
        stats: { maxWorkers: 4, dailyHires: 2 },
      },
    },
  }),
};

const company: PublicCompanySnapshot = {
  id: "company-1",
  ownerId: "player-1",
  regionId: "region-1",
  itemCode: "steel",
  name: "Planner Steel",
  activeUpgradeLevels: {
    automatedEngine: 1,
    storage: 1,
    breakRoom: 1,
  },
};

describe("planCompanyUpgrades", () => {
  it("returns imported no-op upgrade state with zero configured deltas", () => {
    const result = planCompanyUpgrades({ company, upgradeConfig });

    expect(result.version).toBe("company-upgrade-planner-v1");
    expect(result.companyId).toEqual({ value: "company-1", provenance: "observed" });
    expect(result.upgrades.automatedEngine).toMatchObject({
      currentLevel: { value: 1, provenance: "observed" },
      proposedLevel: { value: 1, provenance: "observed" },
      direction: { value: "no-op", provenance: "derived" },
      configuredSteelCostDelta: { value: 0, provenance: "derived" },
      configuredConstructionPointsCostDelta: { value: 0, provenance: "derived" },
      configuredStats: {
        dailyProd: {
          current: { value: 24, provenance: "observed" },
          proposed: { value: 24, provenance: "observed" },
          delta: { value: 0, provenance: "derived" },
        },
      },
    });
  });

  it("compares an upgrade using configured cost and stat deltas only", () => {
    const result = planCompanyUpgrades({
      company,
      upgradeConfig,
      proposedLevels: { automatedEngine: 2 },
    });

    expect(result.upgrades.automatedEngine).toMatchObject({
      proposedLevel: { value: 2, provenance: "overridden" },
      direction: { value: "upgrade", provenance: "derived" },
      currentConfiguredSteelCost: { value: 10, provenance: "observed" },
      proposedConfiguredSteelCost: { value: 25, provenance: "derived" },
      configuredSteelCostDelta: { value: 15, provenance: "derived" },
      configuredConstructionPointsCostDelta: { value: 5, provenance: "derived" },
      configuredStats: {
        dailyProd: {
          current: { value: 24, provenance: "observed" },
          proposed: { value: 40, provenance: "derived" },
          delta: { value: 16, provenance: "derived" },
        },
      },
    });
  });

  it("supports configured production downgrades without describing negative deltas as refunds", () => {
    const result = planCompanyUpgrades({
      company: {
        ...company,
        activeUpgradeLevels: { ...company.activeUpgradeLevels, automatedEngine: 2 },
      },
      upgradeConfig,
      proposedLevels: { automatedEngine: 1 },
    });

    expect(result.upgrades.automatedEngine).toMatchObject({
      direction: { value: "downgrade", provenance: "derived" },
      configuredSteelCostDelta: { value: -15, provenance: "derived" },
      configuredConstructionPointsCostDelta: { value: -5, provenance: "derived" },
      configuredStats: {
        dailyProd: { delta: { value: -16, provenance: "derived" } },
      },
    });
  });

  it("keeps observed Break Room state but rejects hypothetical level changes while it is not production-live", () => {
    const observed = planCompanyUpgrades({ company, upgradeConfig });
    expect(observed.upgrades.breakRoom.direction.value).toBe("no-op");

    try {
      planCompanyUpgrades({
        company,
        upgradeConfig,
        proposedLevels: { breakRoom: 2 },
      });
      throw new Error("Expected non-production Break Room planning to fail");
    } catch (error) {
      expect(error).toMatchObject({
        code: "FEATURE_NOT_PRODUCTION",
        upgrade: "breakRoom",
        level: 2,
      });
    }
  });

  it("rejects downgrades when the current configuration does not explicitly allow them", () => {
    const restrictedConfig: EconomyGameConfig["companyUpgrades"] = {
      ...upgradeConfig,
      storage: { ...upgradeConfig.storage, canDowngrade: false },
    };

    expect(() =>
      planCompanyUpgrades({
        company: {
          ...company,
          activeUpgradeLevels: { ...company.activeUpgradeLevels, storage: 2 },
        },
        upgradeConfig: restrictedConfig,
        proposedLevels: { storage: 1 },
      }),
    ).toThrowError(CompanyUpgradePlannerError);

    try {
      planCompanyUpgrades({
        company: {
          ...company,
          activeUpgradeLevels: { ...company.activeUpgradeLevels, storage: 2 },
        },
        upgradeConfig: restrictedConfig,
        proposedLevels: { storage: 1 },
      });
    } catch (error) {
      expect(error).toMatchObject({
        code: "DOWNGRADE_NOT_ALLOWED",
        upgrade: "storage",
        level: 1,
      });
    }
  });

  it("rejects proposed levels absent from the live normalized configuration", () => {
    try {
      planCompanyUpgrades({
        company,
        upgradeConfig,
        proposedLevels: { automatedEngine: 99 },
      });
      throw new Error("Expected unavailable proposed level to fail");
    } catch (error) {
      expect(error).toMatchObject({
        code: "PROPOSED_LEVEL_UNAVAILABLE",
        upgrade: "automatedEngine",
        level: 99,
      });
    }
  });

  it("rejects imported active levels that disappeared from the live configuration", () => {
    try {
      planCompanyUpgrades({
        company: {
          ...company,
          activeUpgradeLevels: { ...company.activeUpgradeLevels, automatedEngine: 3 },
        },
        upgradeConfig,
      });
      throw new Error("Expected unavailable current level to fail");
    } catch (error) {
      expect(error).toMatchObject({
        code: "CURRENT_LEVEL_UNAVAILABLE",
        upgrade: "automatedEngine",
        level: 3,
      });
    }
  });

  it("uses an explicit zero-cost baseline without inventing an unconfigured stat delta", () => {
    const result = planCompanyUpgrades({
      company: { ...company, activeUpgradeLevels: {} },
      upgradeConfig,
      proposedLevels: { storage: 1 },
    });
    const storage = result.upgrades.storage;

    expect(storage.currentLevel.value).toBe(0);
    expect(storage.currentConfiguredSteelCost).toEqual({ value: 0, provenance: "derived" });
    expect(storage.configuredSteelCostDelta.value).toBe(20);
    expect(storage.configuredStats.maxProduction).toEqual({
      proposed: { value: 200, provenance: "derived" },
    });
  });
});
