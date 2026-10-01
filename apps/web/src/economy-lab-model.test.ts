import type {
  EconomyPlannerContextResponse,
  PublicCompanySnapshot,
  PublicPlayerEconomySnapshot,
} from "@warera-lab/domain";
import { describe, expect, it } from "vitest";

import { createEconomyLabForm, evaluateEconomyLab } from "./economy-lab-model.js";

const player: PublicPlayerEconomySnapshot = {
  id: "player-1",
  username: "Planner",
  countryId: "country-1",
  level: 12,
  availableSkillPoints: 5,
  spentSkillPoints: 20,
  totalSkillPoints: 25,
  skills: {
    production: { level: 1, value: 12, total: 12 },
    entrepreneurship: { level: 1, value: 35, total: 35 },
    management: { level: 1, value: 6, total: 6 },
    companies: { level: 1, value: 3, total: 3 },
  },
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

const context: EconomyPlannerContextResponse = {
  itemCode: "steel",
  configRevision: "test-config",
  item: {
    code: "steel",
    type: "resource",
    rarity: "common",
    productionNeeds: { iron: 2, coal: 1 },
    isTradable: true,
  },
  skills: {
    production: {
      key: "production",
      levels: {
        1: { level: 1, value: 12, totalCost: 1, unlockAtLevel: 1 },
        2: { level: 2, value: 16, totalCost: 3, unlockAtLevel: 5 },
      },
    },
    entrepreneurship: {
      key: "entrepreneurship",
      levels: {
        1: { level: 1, value: 35, totalCost: 2, unlockAtLevel: 1 },
        2: { level: 2, value: 42, totalCost: 5, unlockAtLevel: 8 },
      },
    },
    management: {
      key: "management",
      levels: {
        1: { level: 1, value: 6, totalCost: 1, unlockAtLevel: 1 },
        2: { level: 2, value: 9, totalCost: 4, unlockAtLevel: 7 },
      },
    },
    companies: {
      key: "companies",
      levels: {
        1: { level: 1, value: 3, totalCost: 2, unlockAtLevel: 1 },
        2: { level: 2, value: 4, totalCost: 5, unlockAtLevel: 9 },
      },
    },
  },
  companyUpgrades: {
    automatedEngine: {
      key: "automatedEngine",
      canDowngrade: true,
      levels: {
        1: { level: 1, steelCost: 10, constructionPointsCost: 5, stats: { dailyProd: 24 } },
        2: { level: 2, steelCost: 25, constructionPointsCost: 10, stats: { dailyProd: 40 } },
      },
    },
    storage: {
      key: "storage",
      canDowngrade: true,
      levels: {
        1: { level: 1, steelCost: 20, constructionPointsCost: 8, stats: { maxProduction: 200 } },
        2: { level: 2, steelCost: 35, constructionPointsCost: 14, stats: { maxProduction: 350 } },
      },
    },
    breakRoom: {
      key: "breakRoom",
      canDowngrade: false,
      levels: {
        1: { level: 1, steelCost: 15, stats: { maxWorkers: 2, dailyHires: 1 } },
        2: { level: 2, steelCost: 30, stats: { maxWorkers: 4, dailyHires: 2 } },
      },
    },
  },
  marketPrices: { steel: 10, iron: 2, coal: 3 },
  contextGaps: { itemCodes: [], marketPriceItemCodes: [] },
  freshness: {
    generatedAt: "2026-10-01T14:00:00.000Z",
    hasStaleData: false,
    sources: [],
  },
};

describe("Economy Lab integration model", () => {
  it("initializes all planner controls from the imported player/company state", () => {
    const form = createEconomyLabForm(player, company, context);

    expect(form.skillLevels).toEqual({
      production: "1",
      entrepreneurship: "1",
      management: "1",
      companies: "1",
    });
    expect(form.upgradeLevels).toEqual({
      automatedEngine: "1",
      storage: "1",
      breakRoom: "1",
    });
    expect(form.inputPriceOverrides).toEqual({ iron: "", coal: "" });
  });

  it("evaluates skill, upgrade, and market edits through simulation-core", () => {
    const form = createEconomyLabForm(player, company, context);
    form.skillLevels.production = "2";
    form.upgradeLevels.automatedEngine = "2";
    form.quantity = "10";
    form.outputPriceOverride = "12";
    form.inputPriceOverrides.iron = "3";
    form.assumedLabourCostTotal = "10";

    const result = evaluateEconomyLab(player, company, context, form);

    expect(result.skillError).toBeUndefined();
    expect(result.skillPlan?.skills.production).toMatchObject({
      proposedLevel: { value: 2, provenance: "overridden" },
      additionalPointCost: { value: 2, provenance: "derived" },
    });
    expect(result.upgradePlan?.upgrades.automatedEngine).toMatchObject({
      proposedLevel: { value: 2, provenance: "overridden" },
      configuredSteelCostDelta: { value: 15, provenance: "derived" },
    });
    expect(result.marketResult).toMatchObject({
      outputPrice: { value: 12, provenance: "overridden" },
      recipeInputCost: { value: 90, provenance: "derived" },
      explicitAssumedCostTotal: { value: 10, provenance: "derived" },
      grossRevenue: { value: 120, provenance: "derived" },
      grossMargin: { value: 20, provenance: "derived" },
      marginPerUnit: { value: 2, provenance: "derived" },
      breakEvenOutputPrice: { value: 10, provenance: "derived" },
    });
  });

  it("surfaces invalid planner inputs instead of inventing a result", () => {
    const form = createEconomyLabForm(player, company, context);
    form.skillLevels.production = "99";
    form.upgradeLevels.breakRoom = "0";
    form.quantity = "0";

    const result = evaluateEconomyLab(player, company, context, form);

    expect(result.skillError).toContain("absent from the current game configuration");
    expect(result.upgradeError).toContain("downgrade support is not enabled");
    expect(result.marketError).toContain("quantity must be a finite positive number");
  });

  it("requires explicit input-price assumptions when a live recipe price is missing", () => {
    const missingPriceContext: EconomyPlannerContextResponse = {
      ...context,
      marketPrices: { steel: 10, coal: 3 },
      contextGaps: { itemCodes: [], marketPriceItemCodes: ["iron"] },
    };
    const form = createEconomyLabForm(player, company, missingPriceContext);

    const missing = evaluateEconomyLab(player, company, missingPriceContext, form);
    expect(missing.marketError).toContain("No live market price or explicit override");

    form.inputPriceOverrides.iron = "2.5";
    const supplied = evaluateEconomyLab(player, company, missingPriceContext, form);
    expect(supplied.marketError).toBeUndefined();
    expect(supplied.marketResult?.recipeInputs.iron?.effectivePrice).toEqual({
      value: 2.5,
      provenance: "overridden",
    });
  });
});
