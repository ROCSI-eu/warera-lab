import type {
  EconomyPlannerContextResponse,
  PublicCompanySnapshot,
  PublicPlayerSnapshotResponse,
} from "@warera-lab/domain";
import { encodeScenarioFragment } from "@warera-lab/simulation-core";
import { describe, expect, it } from "vitest";

import {
  buildScenarioComparisons,
  createWorkspaceScenarioDocument,
  evaluateScenario,
  formToScenario,
  importScenarioFragment,
  refreshWorkspaceScenarioDocument,
  replaceScenario,
  scenarioToForm,
} from "./scenario-workspace-model.js";

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

const snapshot: PublicPlayerSnapshotResponse = {
  player: {
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
  },
  companies: [company],
  regions: {},
  countries: {},
  contextGaps: { regionIds: [], countryIds: [] },
  freshness: {
    generatedAt: "2026-10-01T14:00:00.000Z",
    hasStaleData: false,
    sources: [],
  },
};

const context: EconomyPlannerContextResponse = {
  itemCode: "steel",
  configRevision: "fnv1a-deadbeef-123",
  item: {
    code: "steel",
    type: "resource",
    rarity: "common",
    productionNeeds: { iron: 2 },
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
  marketPrices: { steel: 10, iron: 2 },
  contextGaps: { itemCodes: [], marketPriceItemCodes: [] },
  freshness: {
    generatedAt: "2026-10-01T14:00:05.000Z",
    hasStaleData: false,
    sources: [
      {
        source: "gameConfig",
        retrievedAt: "2026-10-01T14:00:01.000Z",
        ageMs: 0,
        state: "live",
      },
      {
        source: "marketPrices",
        retrievedAt: "2026-10-01T14:00:02.000Z",
        ageMs: 0,
        state: "live",
      },
    ],
  },
};

describe("scenario workspace model", () => {
  it("establishes an immutable-style baseline and independent A/B clones", () => {
    const document = createWorkspaceScenarioDocument(snapshot, company, context);

    expect(document.scenarios.baseline).toEqual(document.scenarios.scenarioA);
    expect(document.scenarios.baseline).toEqual(document.scenarios.scenarioB);
    expect(document.config).toEqual({
      revision: "fnv1a-deadbeef-123",
      retrievedAt: "2026-10-01T14:00:01.000Z",
    });
    expect(document.source?.player).toEqual({ id: "player-1", username: "Planner" });

    const form = scenarioToForm(document.scenarios.scenarioA, context);
    form.skillLevels.production = "2";
    const updatedA = formToScenario(form, "steel");
    const changed = replaceScenario(document, "scenarioA", updatedA);

    expect(changed.scenarios.baseline.skills.production).toBe(1);
    expect(changed.scenarios.scenarioA.skills.production).toBe(2);
    expect(changed.scenarios.scenarioB.skills.production).toBe(1);
  });

  it("evaluates each live-attached scenario independently and compares derived outputs", () => {
    let document = createWorkspaceScenarioDocument(snapshot, company, context);
    const formA = scenarioToForm(document.scenarios.scenarioA, context);
    formA.skillLevels.production = "2";
    formA.outputPriceOverride = "12";
    document = replaceScenario(document, "scenarioA", formToScenario(formA, "steel"));

    const evaluations = {
      baseline: evaluateScenario("baseline", document, snapshot, company, context),
      scenarioA: evaluateScenario("scenarioA", document, snapshot, company, context),
      scenarioB: evaluateScenario("scenarioB", document, snapshot, company, context),
    };
    const comparison = buildScenarioComparisons(document, evaluations);

    expect(comparison.inputs.baselineToA.changes).toEqual(
      expect.arrayContaining([
        { path: "skills.production", from: 1, to: 2 },
        { path: "market.outputPriceOverride", to: 12 },
      ]),
    );
    expect(comparison.derived.baselineToA.skillPointDelta).toBe(2);
    expect(comparison.derived.baselineToA.grossMarginDelta).toBe(2);
  });

  it("refreshes the observed baseline without discarding Scenario A/B hypotheticals", () => {
    let document = createWorkspaceScenarioDocument(snapshot, company, context);
    const formA = scenarioToForm(document.scenarios.scenarioA, context);
    formA.skillLevels.production = "2";
    formA.outputPriceOverride = "12";
    document = replaceScenario(document, "scenarioA", formToScenario(formA, "steel"));

    const refreshedSnapshot: PublicPlayerSnapshotResponse = {
      ...snapshot,
      player: {
        ...snapshot.player,
        availableSkillPoints: 8,
      },
      freshness: {
        ...snapshot.freshness,
        generatedAt: "2026-10-01T15:00:00.000Z",
      },
    };
    const refreshedContext: EconomyPlannerContextResponse = {
      ...context,
      configRevision: "fnv1a-updated-456",
      freshness: {
        ...context.freshness,
        generatedAt: "2026-10-01T15:00:05.000Z",
        sources: context.freshness.sources.map((source) =>
          source.source === "gameConfig"
            ? { ...source, retrievedAt: "2026-10-01T15:00:01.000Z" }
            : source,
        ),
      },
    };

    const refreshed = refreshWorkspaceScenarioDocument(
      document,
      refreshedSnapshot,
      company,
      refreshedContext,
    );

    expect(refreshed.scenarios.baseline.skills.production).toBe(1);
    expect(refreshed.scenarios.scenarioA.skills.production).toBe(2);
    expect(refreshed.scenarios.scenarioA.market?.outputPriceOverride).toBe(12);
    expect(refreshed.scenarios.scenarioB).toEqual(document.scenarios.scenarioB);
    expect(refreshed.source?.snapshotRetrievedAt).toBe("2026-10-01T15:00:00.000Z");
    expect(refreshed.config).toEqual({
      revision: "fnv1a-updated-456",
      retrievedAt: "2026-10-01T15:00:01.000Z",
    });
  });

  it("keeps invalid numeric drafts out of the authoritative scenario document", () => {
    const document = createWorkspaceScenarioDocument(snapshot, company, context);
    const form = scenarioToForm(document.scenarios.scenarioA, context);
    form.quantity = "0";

    expect(() => formToScenario(form, "steel")).toThrow("Quantity must be greater than zero");
    expect(document.scenarios.scenarioA.market?.quantity).toBe(1);
  });

  it("keeps pure imported scenarios usable without a player or live lookup", () => {
    const document = createWorkspaceScenarioDocument(snapshot, company, context);
    const detached = evaluateScenario("scenarioA", document);

    expect(detached.evaluation).toBeUndefined();
    expect(detached.unavailableReason).toContain("not attached");

    const fragment = encodeScenarioFragment(document);
    const imported = importScenarioFragment(fragment);

    expect(imported.error).toBeUndefined();
    expect(imported.document?.source?.player).toBeUndefined();
    expect(imported.document?.scenarios).toEqual(document.scenarios);
  });

  it("returns an actionable error for a malformed shared fragment", () => {
    const imported = importScenarioFragment("#wl=%E0%A4%A");

    expect(imported.document).toBeUndefined();
    expect(imported.error).toContain("malformed");
  });
});
