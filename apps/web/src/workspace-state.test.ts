import type { PlayerSearchResponse, PublicPlayerSnapshotResponse } from "@warera-lab/domain";
import { describe, expect, it } from "vitest";

import { initialWorkspaceState, workspaceReducer, type WorkspaceState } from "./workspace-state.js";

const search: PlayerSearchResponse = {
  query: "Example",
  matches: [{ id: "user-1", username: "Example", countryId: "country-1", level: 12 }],
  truncated: false,
  freshness: {
    generatedAt: "2026-10-01T12:00:05.000Z",
    hasStaleData: false,
    sources: [
      {
        source: "search",
        retrievedAt: "2026-10-01T12:00:00.000Z",
        ageMs: 0,
        state: "live",
      },
    ],
  },
};

const snapshot: PublicPlayerSnapshotResponse = {
  player: {
    id: "user-1",
    username: "Example",
    countryId: "country-1",
    level: 12,
    availableSkillPoints: 4,
    spentSkillPoints: 20,
    totalSkillPoints: 24,
    skills: {
      production: { level: 4, value: 22, total: 22 },
      entrepreneurship: { level: 3, value: 45, total: 45 },
      management: { level: 2, value: 8, total: 8 },
      companies: { level: 5, value: 7, total: 7 },
    },
  },
  companies: [
    {
      id: "company-1",
      ownerId: "user-1",
      regionId: "region-1",
      itemCode: "steel",
      name: "Example Steel",
      activeUpgradeLevels: {},
    },
    {
      id: "company-2",
      ownerId: "user-1",
      regionId: "region-2",
      itemCode: "iron",
      name: "Example Iron",
      activeUpgradeLevels: {},
    },
  ],
  regions: {},
  countries: {},
  contextGaps: { regionIds: ["region-1", "region-2"], countryIds: ["country-1"] },
  freshness: {
    generatedAt: "2026-10-01T12:00:06.000Z",
    hasStaleData: false,
    sources: [],
  },
};

function readyState(): WorkspaceState {
  return workspaceReducer(
    workspaceReducer(workspaceReducer(initialWorkspaceState, { type: "search-started" }), {
      type: "search-succeeded",
      search,
    }),
    { type: "import-succeeded", snapshot },
  );
}

describe("workspace state", () => {
  it("moves through search without clearing an existing imported workspace", () => {
    const current = readyState();
    const searching = workspaceReducer(
      { ...current, query: "Another player" },
      { type: "search-started" },
    );

    expect(searching.isSearching).toBe(true);
    expect(searching.snapshot).toBe(snapshot);
    expect(searching.selectedCompanyId).toBe("company-1");
  });

  it("stores search results and clears the transient searching state", () => {
    const searching = workspaceReducer(initialWorkspaceState, { type: "search-started" });
    const results = workspaceReducer(searching, { type: "search-succeeded", search });

    expect(results.isSearching).toBe(false);
    expect(results.search).toBe(search);
    expect(results.message).toBeUndefined();
  });

  it("imports a snapshot and selects the first company by default", () => {
    const importing = workspaceReducer(initialWorkspaceState, {
      type: "import-started",
      playerId: "user-1",
    });
    const ready = workspaceReducer(importing, { type: "import-succeeded", snapshot });

    expect(ready.isImporting).toBe(false);
    expect(ready.snapshot).toBe(snapshot);
    expect(ready.selectedCompanyId).toBe("company-1");
  });

  it("preserves a usable snapshot when a later import fails", () => {
    const current = workspaceReducer(readyState(), {
      type: "import-started",
      playerId: "user-2",
    });
    const failed = workspaceReducer(current, {
      type: "import-failed",
      message: "WarEra is temporarily unavailable.",
    });

    expect(failed.snapshot).toBe(snapshot);
    expect(failed.selectedCompanyId).toBe("company-1");
    expect(failed.message).toEqual({
      kind: "error",
      text: "WarEra is temporarily unavailable.",
    });
  });

  it("allows selection only from companies in the imported snapshot", () => {
    const ready = readyState();
    const selected = workspaceReducer(ready, {
      type: "company-selected",
      companyId: "company-2",
    });
    const ignored = workspaceReducer(selected, {
      type: "company-selected",
      companyId: "unknown-company",
    });

    expect(selected.selectedCompanyId).toBe("company-2");
    expect(ignored).toBe(selected);
  });
});
