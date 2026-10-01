import { describe, expect, it } from "vitest";

import {
  documentedMvpProcedures,
  normalizeCompaniesPage,
  normalizeEconomyGameConfig,
} from "./index.js";

const rawConfig = {
  skills: {
    production: { levels: { "0": { value: 10, totalCost: 0, unlockAtLevel: 1 } } },
    entrepreneurship: { levels: { "0": { value: 30, totalCost: 0, unlockAtLevel: 1 } } },
    management: { levels: { "0": { value: 4, totalCost: 0, unlockAtLevel: 10 } } },
    companies: { levels: { "0": { value: 2, totalCost: 0, unlockAtLevel: 5 } } },
  },
  items: {
    steel: {
      type: "processed",
      code: "steel",
      rarity: "common",
      productionPoints: 10,
      productionNeeds: { iron: 2 },
      isTradable: true,
    },
  },
  upgradesConfig: {
    automatedEngine: {
      canDowngrade: true,
      pendingDurationHours: 6,
      levels: {
        "1": { level: 1, steelCost: 0, constructionPointsCost: 0, stats: { dailyProd: 24 } },
      },
    },
    storage: {
      canDowngrade: true,
      pendingDurationHours: 6,
      levels: {
        "1": { level: 1, steelCost: 0, constructionPointsCost: 0, stats: { maxProduction: 200 } },
      },
    },
    breakRoom: {
      canDowngrade: true,
      levels: {
        "1": { level: 1, steelCost: 0, stats: { maxWorkers: 2, dailyHires: 2 } },
      },
    },
  },
  company: { depositResourceBonus: 30, moveCost: 5, changeItemCost: 5 },
  worker: { maxFidelity: 10, fidelityProductionBonusPercent: 1 },
};

describe("normalizeCompaniesPage", () => {
  it("normalizes the live company list as company identifiers, not detail objects", () => {
    expect(normalizeCompaniesPage({ items: ["company-1", "company-2"], nextCursor: null })).toEqual(
      { itemIds: ["company-1", "company-2"] },
    );
  });
});

describe("normalizeEconomyGameConfig", () => {
  it("keeps only the Economy Lab subset with numeric level keys", () => {
    const config = normalizeEconomyGameConfig(rawConfig);

    expect(config.skills.production.levels[0]).toMatchObject({ level: 0, value: 10, totalCost: 0 });
    expect(config.items.steel?.productionNeeds).toEqual({ iron: 2 });
    expect(config.companyUpgrades.automatedEngine.levels[1]?.stats.dailyProd).toBe(24);
    expect(config.companyUpgrades.storage.levels[1]?.stats.maxProduction).toBe(200);
    expect(config.companyUpgrades.breakRoom.levels[1]?.stats.maxWorkers).toBe(2);
  });

  it("rejects non-numeric configuration level keys", () => {
    const invalid = {
      ...rawConfig,
      skills: {
        ...rawConfig.skills,
        production: {
          levels: { invalid: { value: 10, totalCost: 0, unlockAtLevel: 1 } },
        },
      },
    };

    expect(() => normalizeEconomyGameConfig(invalid)).toThrow(
      "Invalid WarEra configuration level key",
    );
  });

  it("keeps token-gated and unimplemented procedures out of the active adapter allowlist", () => {
    expect(documentedMvpProcedures).not.toContain("worker.getWorkers");
    expect(documentedMvpProcedures).not.toContain("transaction.getPaginatedTransactions");
    expect(documentedMvpProcedures).not.toContain("inventory.fetchCurrentEquipment");
  });
});
