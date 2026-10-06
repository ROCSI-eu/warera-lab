import type { PublicCompanySnapshot, PublicPlayerSnapshotResponse } from "@warera-lab/domain";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CompanyLabShell } from "./CompanyLabShell.js";
import { describeCompany } from "./company-display.js";

const company = {
  id: "company-alpha-1111111",
  ownerId: "player-1",
  regionId: "region-ph",
  itemCode: "steel",
  name: "Planner Steel",
  production: 24,
  workerCount: 2,
  activeUpgradeLevels: { automatedEngine: 1, storage: 2 },
  estimatedValue: 1200,
};

const snapshot: PublicPlayerSnapshotResponse = {
  player: {
    id: "player-1",
    username: "Planner",
    countryId: "country-ro",
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
  regions: {
    "region-ph": {
      id: "region-ph",
      code: "PH",
      name: "Prahova",
      countryId: "country-ro",
      countryCode: "RO",
      development: 10,
      baseDevelopment: 8,
      isCapital: false,
      isLinkedToCapital: true,
    },
  },
  countries: {
    "country-ro": {
      id: "country-ro",
      code: "RO",
      name: "Romania",
    },
  },
  contextGaps: { regionIds: [], countryIds: [] },
  freshness: {
    generatedAt: "2026-10-06T12:00:00.000Z",
    hasStaleData: false,
    sources: [
      {
        source: "company",
        subjectId: company.id,
        retrievedAt: "2026-10-06T11:59:59.000Z",
        ageMs: 1000,
        state: "live",
      },
    ],
  },
};

function renderShell(current: PublicPlayerSnapshotResponse, selected = current.companies[0]) {
  const presentations = new Map(
    current.companies.map((candidate) => [candidate.id, describeCompany(candidate, current)]),
  );
  return renderToStaticMarkup(
    createElement(CompanyLabShell, {
      snapshot: current,
      selectedCompany: selected,
      companyPresentations: presentations,
      navigationMessage: undefined,
      isBusy: false,
      onCompanySelect: () => undefined,
    }),
  );
}

describe("Company Lab snapshot overview", () => {
  it("renders complete normalized company context and existing duplicate disambiguation", () => {
    const duplicate = { ...company, id: "company-beta-2222222" };
    const current = { ...snapshot, companies: [company, duplicate] };
    const html = renderShell(current, company);

    expect(html).toContain("Owned by Planner · Level 12");
    expect(html).toContain("Planner Steel");
    expect(html).toContain("steel");
    expect(html).toContain("Prahova");
    expect(html).toContain("Romania");
    expect(html).toContain("Observed production");
    expect(html).toContain(">24<");
    expect(html).toContain("Workers");
    expect(html).toContain(">2<");
    expect(html).toContain("Estimated company value");
    expect(html).toContain(
      "Estimated current value of invested construction materials and upgrades",
    );
    expect(html).toContain("1,200");
    expect(html).toContain("Automated Engine: level 1");
    expect(html).toContain("Storage: level 2");
    expect(html).toContain("Snapshot freshness");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("ID …1111111");
    expect(html).toContain("ID …2222222");
  });

  it("labels observed Break Room state as a dev preview rather than production-live", () => {
    const devCompany: PublicCompanySnapshot = {
      ...company,
      activeUpgradeLevels: { breakRoom: 1 },
    };
    const current: PublicPlayerSnapshotResponse = {
      ...snapshot,
      companies: [devCompany],
    };
    const html = renderShell(current, devCompany);

    expect(html).toContain(
      "Break Room: level 1 · dev preview, not currently available in production",
    );
    expect(html).toContain("Break Room L1 (dev preview)");
  });

  it("renders calm unavailable states for partial normalized snapshots", () => {
    const partialCompany: PublicCompanySnapshot = {
      id: company.id,
      ownerId: company.ownerId,
      regionId: "region-missing",
      itemCode: company.itemCode,
      name: company.name,
      activeUpgradeLevels: {},
    };
    const current: PublicPlayerSnapshotResponse = {
      ...snapshot,
      companies: [partialCompany],
      regions: {},
      countries: {},
      contextGaps: { regionIds: ["region-missing"], countryIds: [] },
      freshness: { ...snapshot.freshness, sources: [] },
    };
    const html = renderShell(current, partialCompany);

    expect(html.match(/Not reported/g)).toHaveLength(2);
    expect(html).toContain("Region unavailable");
    expect(html).toContain("Country unavailable");
    expect(html).toContain("None reported");
    expect(html).toContain("No replacement values were invented");
    expect(html).not.toContain("Estimated company value");
    expect(html).toContain("No individual source timestamps were returned");
  });
});
