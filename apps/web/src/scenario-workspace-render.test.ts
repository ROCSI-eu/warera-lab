import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createScenarioDocument } from "@warera-lab/simulation-core";

import { ScenarioTransfer, ScenarioWorkspace } from "./ScenarioWorkspace.js";

function documentFixture() {
  const baseline = {
    skills: { production: 1, entrepreneurship: 1, management: 1, companies: 1 },
    companyItemCode: "steel",
    companyUpgrades: { automatedEngine: 1, storage: 1, breakRoom: 1 },
    market: {
      itemCode: "steel",
      quantity: 1,
      inputPriceOverrides: {},
    },
  };

  return createScenarioDocument(
    {
      baseline,
      scenarioA: {
        ...baseline,
        skills: { ...baseline.skills, production: 2 },
      },
      scenarioB: {
        ...baseline,
        market: { ...baseline.market, outputPriceOverride: 12 },
      },
      config: { revision: "cfg-1", retrievedAt: "2026-10-01T14:00:00.000Z" },
      sourceSnapshotRetrievedAt: "2026-10-01T13:59:00.000Z",
      sourcePlayer: { id: "secret-player-id", username: "Private Planner" },
    },
    { includeSourcePlayerIdentity: true },
  );
}

describe("scenario workspace rendering", () => {
  it("renders portable export without source identity by default", () => {
    const document = documentFixture();
    const html = renderToStaticMarkup(
      createElement(ScenarioTransfer, {
        document,
        onImport: () => undefined,
      }),
    );

    expect(html).toContain("Copy share link");
    expect(html).toContain("Advanced scenario data");
    expect(html).toContain("JSON export");
    expect(html).toContain("URL fragment");
    expect(html).not.toContain("secret-player-id");
    expect(html).not.toContain("Private Planner");
  });

  it("renders detached scenario tabs, changed inputs, and calculation metadata", () => {
    const document = documentFixture();
    const html = renderToStaticMarkup(
      createElement(ScenarioWorkspace, {
        document,
        onDocumentChange: () => undefined,
      }),
    );

    expect(html).toContain("Scenario workspace");
    expect(html).toContain("Baseline");
    expect(html).toContain("Scenario A");
    expect(html).toContain("Scenario B");
    expect(html).toContain("Skill · production");
    expect(html).toContain("How is this calculated?");
    expect(html).toContain("skill-planner-v1");
    expect(html).toContain("cfg-1");
    expect(html).toContain("not attached");
  });
});
