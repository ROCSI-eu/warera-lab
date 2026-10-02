import type { PublicPlayerSnapshotResponse } from "@warera-lab/domain";
import { describe, expect, it } from "vitest";

import { describeCompany } from "./company-display.js";

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
  companies: [],
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
  freshness: { generatedAt: "2026-10-01T12:00:00.000Z", hasStaleData: false, sources: [] },
};

const baseCompany = {
  id: "company-alpha-1234567",
  ownerId: "player-1",
  regionId: "region-ph",
  itemCode: "iron",
  name: "Iron Inc",
  production: 24,
  workerCount: 2,
  activeUpgradeLevels: { automatedEngine: 1, storage: 2 },
};

describe("describeCompany", () => {
  it("prefers human context and does not expose an ID when it is unnecessary", () => {
    const current = { ...snapshot, companies: [baseCompany] };
    expect(describeCompany(baseCompany, current)).toEqual({
      location: "Prahova · Romania",
      operations: "2 workers · Production 24",
      upgrades: "Automated Engine L1 · Storage L2",
    });
  });

  it("uses a short stable ID only when human-readable context is identical", () => {
    const duplicate = { ...baseCompany, id: "company-beta-7654321" };
    const current = { ...snapshot, companies: [baseCompany, duplicate] };

    expect(describeCompany(baseCompany, current).fallbackId).toBe("…1234567");
    expect(describeCompany(duplicate, current).fallbackId).toBe("…7654321");
  });

  it("does not use an ID when duplicate names differ by meaningful context", () => {
    const other = { ...baseCompany, id: "company-other", workerCount: 4 };
    const current = { ...snapshot, companies: [baseCompany, other] };

    expect(describeCompany(baseCompany, current).fallbackId).toBeUndefined();
    expect(describeCompany(other, current).fallbackId).toBeUndefined();
  });
});
