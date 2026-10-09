import type { PublicPlayerSnapshotResponse } from "@warera-lab/domain";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PlayerLabShell } from "./PlayerLabShell.js";

const ordinary: PublicPlayerSnapshotResponse = {
  player: {
    id: "player-opaque-1234",
    username: "Planner",
    countryId: "country-opaque-7890",
    level: 12,
    availableSkillPoints: 5,
    spentSkillPoints: 20,
    totalSkillPoints: 25,
    skills: {
      production: { level: 2, value: 12.5, total: 15.5 },
      entrepreneurship: { level: 1, value: 35, total: 35 },
      management: { level: 3, value: 6, total: 8 },
      companies: { level: 1, value: 3, total: 3 },
    },
  },
  companies: [
    {
      id: "company-opaque",
      ownerId: "player-opaque-1234",
      regionId: "region-opaque",
      itemCode: "steel",
      name: "Steel Inc",
      activeUpgradeLevels: {},
    },
  ],
  countries: {
    "country-opaque-7890": {
      id: "country-opaque-7890",
      code: "RO",
      name: "Romania",
    },
  },
  regions: {},
  contextGaps: { countryIds: [], regionIds: [] },
  freshness: {
    generatedAt: "2026-10-09T12:00:00.000Z",
    hasStaleData: false,
    sources: [
      {
        source: "player",
        subjectId: "player-opaque-1234",
        retrievedAt: "2026-10-09T11:59:59.000Z",
        ageMs: 1000,
        state: "live",
      },
      {
        source: "companies",
        retrievedAt: "2026-10-09T11:59:59.000Z",
        ageMs: 1000,
        state: "cached",
      },
    ],
  },
};

function render(snapshot: PublicPlayerSnapshotResponse) {
  return renderToStaticMarkup(
    createElement(PlayerLabShell, {
      snapshot,
      focusedCompanyId: undefined,
      navigationMessage: undefined,
      isImporting: false,
      isRefreshing: false,
      refreshMessage: undefined,
      onRefresh: () => undefined,
    }),
  );
}

describe("Player Lab observed public profile", () => {
  it("shows observed identity, exact skill levels/values/totals, points and company count above provenance", () => {
    const html = render(ordinary);
    expect(html).toContain("Player Lab · public snapshot");
    expect(html).toContain(">Planner</h2>");
    expect(html).toContain(">Romania</strong>");
    expect(html).toContain(">12</strong>");
    expect(html).toContain("Available skill points");
    expect(html).toContain("Spent skill points");
    expect(html).toContain("Total skill points");
    expect(html).toContain("Listed owned companies");
    expect(html).toContain("Level 2");
    expect(html).toContain("Reported value 12.5");
    expect(html).toContain("Total 15.5");
    expect(html).toContain("Level 3");
    expect(html).toContain("Production");
    expect(html).toContain("Entrepreneurship");
    expect(html).toContain("Management");
    expect(html).toContain("Companies");
    expect(html).toContain("Current public values · not a scenario");
    expect(html).toContain("Player snapshot freshness");
    expect(html).toContain("1 live · 1 cached");
    expect(html).toContain("View source details (2)");
    expect(html).toContain('<details class="provenance-details">');
    expect(html).not.toContain("Company selection");
    expect(html.indexOf("Observed economy skills")).toBeLessThan(
      html.indexOf("Player snapshot freshness"),
    );
    expect(html).not.toContain("country-opaque-7890");
  });

  it("is explicit when country context and all owned companies are missing", () => {
    const html = render({
      ...ordinary,
      companies: [],
      countries: {},
      contextGaps: {
        regionIds: ["region-opaque"],
        countryIds: ["country-opaque-7890"],
      },
    });
    expect(html).toContain("Country unavailable");
    expect(html).toContain("No owned companies are listed");
    expect(html).toContain("Some geographic context is unavailable");
    expect(html).toContain("not whether any company is active");
    expect(html).not.toContain("country-opaque-7890");
    expect(html).not.toContain("region-opaque");
  });

  it("preserves stale and cached disclosures without pretending they are live", () => {
    const html = render({
      ...ordinary,
      freshness: {
        ...ordinary.freshness,
        hasStaleData: true,
        sources: ordinary.freshness.sources.map((source) => ({ ...source, state: "stale" })),
      },
    });
    expect(html).toContain("Some public data is stale");
    expect(html).toContain("Contains stale data");
    expect(html).toContain("2 stale");
    expect(html).not.toContain("Current snapshot</span>");
  });

  it("formats large observed numbers consistently without showing a hypothetical planner", () => {
    const html = render({
      ...ordinary,
      player: {
        ...ordinary.player,
        level: 1234,
        availableSkillPoints: 1200,
        skills: {
          ...ordinary.player.skills,
          production: { level: 6, value: 12345.5, total: 12399 },
        },
      },
    });
    expect(html).toContain("1,234");
    expect(html).toContain("1,200");
    expect(html).toContain("12,345.5");
    expect(html).not.toContain("Scenario A");
  });
});
