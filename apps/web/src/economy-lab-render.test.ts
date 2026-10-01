import type {
  EconomyPlannerContextResponse,
  PublicCompanySnapshot,
  PublicPlayerEconomySnapshot,
} from "@warera-lab/domain";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EconomyLab } from "./EconomyLab.js";

const player: PublicPlayerEconomySnapshot = {
  id: "player-1",
  username: "Planner",
  countryId: "country-1",
  level: 10,
  availableSkillPoints: 5,
  spentSkillPoints: 4,
  totalSkillPoints: 9,
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
  activeUpgradeLevels: {},
};

const context: EconomyPlannerContextResponse = {
  itemCode: "steel",
  item: {
    code: "steel",
    type: "resource",
    rarity: "common",
    productionNeeds: {},
    isTradable: true,
  },
  skills: {
    production: {
      key: "production",
      levels: { 1: { level: 1, value: 12, totalCost: 1, unlockAtLevel: 1 } },
    },
    entrepreneurship: {
      key: "entrepreneurship",
      levels: { 1: { level: 1, value: 35, totalCost: 1, unlockAtLevel: 1 } },
    },
    management: {
      key: "management",
      levels: { 1: { level: 1, value: 6, totalCost: 1, unlockAtLevel: 1 } },
    },
    companies: {
      key: "companies",
      levels: { 1: { level: 1, value: 3, totalCost: 1, unlockAtLevel: 1 } },
    },
  },
  companyUpgrades: {
    automatedEngine: { key: "automatedEngine", levels: {} },
    storage: { key: "storage", levels: {} },
    breakRoom: { key: "breakRoom", levels: {} },
  },
  marketPrices: { steel: 10 },
  contextGaps: { itemCodes: [], marketPriceItemCodes: [] },
  freshness: {
    generatedAt: "2026-10-01T14:00:00.000Z",
    hasStaleData: false,
    sources: [],
  },
};

describe("Economy Lab rendering", () => {
  it("renders all three planners and the initial derived market result", () => {
    const html = renderToStaticMarkup(createElement(EconomyLab, { player, company, context }));

    expect(html).toContain("Economy skills");
    expect(html).toContain("Company upgrades");
    expect(html).toContain("Market &amp; margin");
    expect(html).toContain("Gross revenue");
    expect(html).toContain("Break-even price");
    expect(html).toContain("derived");
    expect(html).toContain("observed");
  });
});
