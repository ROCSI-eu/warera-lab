import { describe, expect, it } from "vitest";

import {
  ScenarioModelError,
  compareScenarioDocument,
  createScenarioDocument,
  decodeScenarioFragment,
  encodeScenarioFragment,
  parseScenarioDocument,
  parseScenarioJson,
  scenarioDocumentVersion,
  serializeScenarioJson,
  type EconomyScenarioStateV1,
} from "./scenario-model.js";

const baseline: EconomyScenarioStateV1 = {
  skills: {
    production: 1,
    entrepreneurship: 0,
    management: 1,
    companies: 0,
  },
  companyItemCode: "steel",
  companyUpgrades: {
    automatedEngine: 1,
    storage: 1,
    breakRoom: 0,
  },
  market: {
    itemCode: "steel",
    quantity: 10,
    inputPriceOverrides: {
      iron: 2,
    },
  },
};

const scenarioA: EconomyScenarioStateV1 = {
  ...baseline,
  skills: {
    ...baseline.skills,
    production: 2,
  },
  market: {
    ...baseline.market!,
    outputPriceOverride: 11,
    inputPriceOverrides: {
      iron: 2.5,
    },
  },
};

const scenarioB: EconomyScenarioStateV1 = {
  ...baseline,
  skills: {
    ...baseline.skills,
    management: 2,
  },
  companyUpgrades: {
    ...baseline.companyUpgrades,
    storage: 2,
  },
  market: {
    ...baseline.market!,
    quantity: 12,
    assumedOtherCostTotal: 5,
  },
};

function buildDocument() {
  return createScenarioDocument({
    baseline,
    scenarioA,
    scenarioB,
    config: {
      revision: "game-config-2026-10-01",
      retrievedAt: "2026-10-01T12:00:00.000Z",
    },
    sourceSnapshotRetrievedAt: "2026-10-01T12:01:00.000Z",
    sourcePlayer: {
      id: "player-1",
      username: "Planner",
    },
  });
}

describe("scenario document round trips", () => {
  it("round-trips stable JSON and keeps source player identity out by default", () => {
    const document = buildDocument();
    const json = serializeScenarioJson(document);
    const parsed = parseScenarioJson(json);

    expect(parsed).toEqual(document);
    expect(parsed.version).toBe(scenarioDocumentVersion);
    expect(parsed.source?.snapshotRetrievedAt).toBe("2026-10-01T12:01:00.000Z");
    expect(parsed.source?.player).toBeUndefined();
    expect(json).not.toContain("player-1");
    expect(json).not.toContain("Planner");
    expect(parsed.calculationVersions).toEqual({
      skillPlanner: "skill-planner-v1",
      companyUpgradePlanner: "company-upgrade-planner-v1",
      marketMarginSimulator: "market-margin-v1",
      marketMarginComparison: "market-margin-comparison-v1",
    });
  });

  it("round-trips a URL fragment without requiring a player identifier", () => {
    const document = buildDocument();
    const fragment = encodeScenarioFragment(document);
    const parsed = decodeScenarioFragment(fragment);

    expect(fragment.startsWith("#wl=")).toBe(true);
    expect(parsed).toEqual(document);
    expect(parsed.source?.player).toBeUndefined();
  });

  it("includes source player identity only after explicit opt-in", () => {
    const document = createScenarioDocument(
      {
        baseline,
        scenarioA,
        scenarioB,
        sourcePlayer: {
          id: "player-1",
          username: "Planner",
        },
      },
      { includeSourcePlayerIdentity: true },
    );

    expect(document.source?.player).toEqual({
      id: "player-1",
      username: "Planner",
    });
  });

  it("requires explicit opt-in again when exporting or sharing source player identity", () => {
    const document = createScenarioDocument(
      {
        baseline,
        scenarioA,
        scenarioB,
        sourceSnapshotRetrievedAt: "2026-10-01T12:01:00.000Z",
        sourcePlayer: {
          id: "player-1",
          username: "Planner",
        },
      },
      { includeSourcePlayerIdentity: true },
    );

    const defaultJson = serializeScenarioJson(document);
    const optedInJson = serializeScenarioJson(document, {
      includeSourcePlayerIdentity: true,
    });
    const defaultFragment = encodeScenarioFragment(document);
    const optedInFragment = encodeScenarioFragment(document, {
      includeSourcePlayerIdentity: true,
    });

    expect(parseScenarioJson(defaultJson).source).toEqual({
      snapshotRetrievedAt: "2026-10-01T12:01:00.000Z",
    });
    expect(parseScenarioJson(optedInJson).source?.player).toEqual({
      id: "player-1",
      username: "Planner",
    });
    expect(decodeScenarioFragment(defaultFragment).source?.player).toBeUndefined();
    expect(decodeScenarioFragment(optedInFragment).source?.player).toEqual({
      id: "player-1",
      username: "Planner",
    });
  });
});

describe("scenario document validation", () => {
  it("fails safely on malformed JSON", () => {
    expect(() => parseScenarioJson("{not-json")).toThrowError(ScenarioModelError);

    try {
      parseScenarioJson("{not-json");
    } catch (error) {
      expect(error).toMatchObject({
        code: "MALFORMED_JSON",
      });
    }
  });

  it("fails explicitly on an unsupported document version", () => {
    const document = buildDocument();

    try {
      parseScenarioDocument({
        ...document,
        version: "warera-lab-scenario-v2",
      });
      throw new Error("Expected unsupported version to fail");
    } catch (error) {
      expect(error).toMatchObject({
        code: "UNSUPPORTED_VERSION",
        path: "scenario.version",
      });
    }
  });

  it("rejects unknown fields so credentials or hidden telemetry cannot ride along", () => {
    const document = buildDocument();

    try {
      parseScenarioDocument({
        ...document,
        apiToken: "secret",
      });
      throw new Error("Expected unknown field to fail");
    } catch (error) {
      expect(error).toMatchObject({
        code: "INVALID_PAYLOAD",
        path: "scenario.apiToken",
      });
    }
  });

  it("rejects an oversized URL-fragment share payload", () => {
    const inputPriceOverrides = Object.fromEntries(
      Array.from({ length: 128 }, (_, index) => [`item-${index}-${"x".repeat(48)}`, index + 1]),
    );
    const largeMarketState: EconomyScenarioStateV1 = {
      skills: {},
      companyUpgrades: {},
      market: {
        itemCode: "steel",
        quantity: 1,
        inputPriceOverrides,
      },
    };
    const document = createScenarioDocument({
      baseline: largeMarketState,
      scenarioA: largeMarketState,
      scenarioB: largeMarketState,
    });

    try {
      encodeScenarioFragment(document);
      throw new Error("Expected oversized share payload to fail");
    } catch (error) {
      expect(error).toMatchObject({
        code: "SHARE_PAYLOAD_TOO_LARGE",
      });
    }
  });
});

describe("scenario comparisons", () => {
  it("returns only changed scenario input paths in deterministic order", () => {
    const comparison = compareScenarioDocument(buildDocument());

    expect(comparison.baselineToA.changes).toEqual([
      {
        path: "skills.production",
        from: 1,
        to: 2,
      },
      {
        path: "market.outputPriceOverride",
        to: 11,
      },
      {
        path: "market.inputPriceOverrides.iron",
        from: 2,
        to: 2.5,
      },
    ]);

    expect(comparison.baselineToB.changes).toEqual([
      {
        path: "skills.management",
        from: 1,
        to: 2,
      },
      {
        path: "companyUpgrades.storage",
        from: 1,
        to: 2,
      },
      {
        path: "market.quantity",
        from: 10,
        to: 12,
      },
      {
        path: "market.assumedOtherCostTotal",
        to: 5,
      },
    ]);
  });
});
