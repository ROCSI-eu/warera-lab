import type { PublicCompanySnapshot, PublicPlayerSnapshotResponse } from "@warera-lab/domain";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PlayerCompanyPortfolio } from "./PlayerCompanyPortfolio.js";
import { PlayerLabShell } from "./PlayerLabShell.js";

const firstCompany: PublicCompanySnapshot = {
  id: "steel-company-1111111",
  ownerId: "player-id",
  regionId: "region-ro",
  itemCode: "steel",
  name: "Steel Inc",
  production: 0,
  workerCount: 0,
  activeUpgradeLevels: {},
};

const snapshot: PublicPlayerSnapshotResponse = {
  player: {
    id: "player-id",
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
  companies: [firstCompany],
  regions: {
    "region-ro": {
      id: "region-ro",
      code: "PH",
      name: "Prahova",
      countryId: "country-ro",
      countryCode: "RO",
      development: 1,
      baseDevelopment: 1,
      isCapital: false,
      isLinkedToCapital: true,
    },
  },
  countries: { "country-ro": { id: "country-ro", code: "RO", name: "Romania" } },
  contextGaps: { regionIds: [], countryIds: [] },
  freshness: { generatedAt: "2026-10-09T12:00:00.000Z", hasStaleData: false, sources: [] },
};

function renderPortfolio(current: PublicPlayerSnapshotResponse) {
  return renderToStaticMarkup(createElement(PlayerCompanyPortfolio, { snapshot: current }));
}

describe("Player Lab company output portfolio", () => {
  it("shows only reported operations and keeps outputs separate from inventory", () => {
    const html = renderPortfolio(snapshot);
    expect(html).toContain("Owned-company overview");
    expect(html).toContain("1 company listed");
    expect(html).toContain("1 distinct company output types");
    expect(html).toContain("Company outputs are not player-owned inventory balances");
    expect(html).toContain("Company output");
    expect(html).toContain(">steel</strong>");
    expect(html).toContain("Prahova · Romania");
    expect(html).toContain("Reported production 0");
    expect(html).toContain("0 workers");
    expect(html).not.toMatch(/active company|inactive company|inventory quantity|Company Lab →/i);
    expect(html).not.toContain("Not reported");
  });

  it("distinguishes duplicate names and identical context using stable, unique ID suffixes", () => {
    const second = { ...firstCompany, id: "iron-company-2222222" };
    const third = { ...firstCompany, id: "another-company-1111111" };
    const current = { ...snapshot, companies: [firstCompany, second, third] };
    const html = renderPortfolio(current);
    expect(html.match(/Steel Inc/g)).toHaveLength(3);
    const identifiers = [...html.matchAll(/Company (…[^<]+)<\/small>/g)].map((match) => match[1]);
    expect(identifiers).toHaveLength(3);
    expect(new Set(identifiers).size).toBe(3);
    expect(identifiers.every((id) => id?.startsWith("…"))).toBe(true);
    expect(html).not.toContain("Company steel-company-1111111");
    expect(html).toContain("3 companies listed");
  });

  it("truthfully handles empty, missing geography, and missing optional operations", () => {
    const empty = renderPortfolio({ ...snapshot, companies: [] });
    expect(empty).toContain("No owned companies are listed in this public snapshot.");
    expect(empty).toContain("0 distinct company output types");
    expect(empty).not.toContain("Company output</span>");

    const missing = renderPortfolio({
      ...snapshot,
      companies: [
        {
          id: "missing-geography",
          ownerId: firstCompany.ownerId,
          regionId: "unknown",
          itemCode: firstCompany.itemCode,
          name: firstCompany.name,
          activeUpgradeLevels: {},
        },
        {
          id: "missing-country",
          ownerId: firstCompany.ownerId,
          regionId: "region-ro",
          itemCode: "iron",
          name: firstCompany.name,
          workerCount: 1,
          activeUpgradeLevels: {},
        },
      ],
      countries: {},
    });
    expect(missing).toContain("Location unavailable");
    expect(missing).toContain("Prahova · Country unavailable");
    expect(missing).toContain("1 worker");
    expect(missing).not.toContain("Production not reported");
    expect(missing).not.toContain("Workers not reported");
    expect(missing).not.toContain("unknown");
  });

  it("handles twelve and more records without inventing a nine/twelve-item cap", () => {
    const companies = Array.from({ length: 13 }, (_, i) => ({
      ...firstCompany,
      id: "company-" + String(i).padStart(3, "0") + "-fully-unique",
      itemCode: i % 2 ? "iron" : "steel",
      name: "A very long company name that should wrap gracefully " + i,
    }));
    const html = renderPortfolio({ ...snapshot, companies });
    expect(html.match(/class="player-portfolio__card"/g)).toHaveLength(13);
    expect(html).toContain("13 companies listed");
    expect(html).toContain("2 distinct company output types");
    expect(html).toContain("7 companies");
    expect(html).toContain("6 companies");
    expect(html).toContain("A very long company name that should wrap gracefully 12");
  });

  it("retains the zero-company text once in the integrated Player Lab shell", () => {
    const html = renderToStaticMarkup(
      createElement(PlayerLabShell, {
        snapshot: { ...snapshot, companies: [] },
        focusedCompanyId: undefined,
        navigationMessage: undefined,
        isImporting: false,
        isRefreshing: false,
        refreshMessage: undefined,
        onRefresh: () => undefined,
      }),
    );
    expect(html.match(/No owned companies are listed in this public snapshot/g)).toHaveLength(1);
    expect(html.indexOf("Observed economy skills")).toBeLessThan(
      html.indexOf("Owned-company overview"),
    );
  });
});
