import type { PublicCompanySnapshot, PublicPlayerSnapshotResponse } from "@warera-lab/domain";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ActiveContextSummary } from "./ActiveContextSummary.js";

const first: PublicCompanySnapshot = {
  id: "company-fish-1",
  ownerId: "player-1",
  regionId: "region-1",
  name: "Fish Inc",
  itemCode: "fish",
  activeUpgradeLevels: {},
};
const second: PublicCompanySnapshot = { ...first, id: "company-fish-2" };
const snapshot: PublicPlayerSnapshotResponse = {
  player: {
    id: "player-1",
    username: "MihaiROCSI",
    countryId: "country-1",
    level: 37,
    availableSkillPoints: 1,
    spentSkillPoints: 9,
    totalSkillPoints: 10,
    skills: {
      production: { level: 1, value: 1, total: 1 },
      entrepreneurship: { level: 1, value: 1, total: 1 },
      management: { level: 1, value: 1, total: 1 },
      companies: { level: 1, value: 1, total: 1 },
    },
  },
  companies: [first, second],
  countries: {},
  regions: {},
  contextGaps: { regionIds: [], countryIds: [] },
  freshness: { generatedAt: "2026-10-12T12:00:00Z", hasStaleData: false, sources: [] },
};
const markup = (props: Parameters<typeof ActiveContextSummary>[0]) =>
  renderToStaticMarkup(createElement(ActiveContextSummary, props));

describe("shared selected-context summary", () => {
  it("leaves fresh Player/Company/Economy and independent Market entries unchanged", () => {
    for (const lab of ["player", "company", "economy", "market"] as const) {
      expect(markup({ lab })).toBe("");
    }
  });

  it("shows loaded player and a targeted portfolio continuation without implying an active company", () => {
    const html = markup({ lab: "player", snapshot });
    expect(html).toContain("MihaiROCSI");
    expect(html).toContain("2 owned companies listed");
    expect(html).toContain("View owned companies");
    expect(html).not.toContain("Company ·");
  });

  it("preserves duplicate-name company disambiguation in linked Player, Company and Economy entries", () => {
    for (const lab of ["player", "company", "economy"] as const) {
      const html = markup({
        lab,
        snapshot,
        ...(lab === "player" ? { focusedCompany: second } : { company: second }),
      });
      expect(html).toMatch(/Fish Inc \(Company .*\)/);
      expect(html).toContain("Output fish");
      expect(html).not.toContain("Active company");
    }
  });

  it("never advertises company inspection when the loaded player has no companies", () => {
    const html = markup({ lab: "company", snapshot: { ...snapshot, companies: [] } });
    expect(html).toContain("View company availability");
    expect(html).not.toContain("Inspect company");
  });

  it("does not attach a retained what-if scenario to a different selected company", () => {
    const detached = markup({
      lab: "economy",
      snapshot,
      company: second,
      hasScenario: true,
      scenarioCompanyId: first.id,
    });
    expect(detached).toContain("A scenario from a different company remains available below");
    expect(detached).toContain("View imported workspace");
    expect(detached).not.toContain("Open scenario workspace");

    const attached = markup({
      lab: "economy",
      snapshot,
      company: second,
      hasScenario: true,
      scenarioCompanyId: second.id,
    });
    expect(attached).toContain("Open scenario workspace");
    expect(attached).not.toContain("different company");
  });

  it("labels detached live-derived scenarios without confusing them with portable imports", () => {
    const detached = markup({
      lab: "economy",
      snapshot: { ...snapshot, companies: [] },
      hasScenario: true,
      isPortableScenario: false,
    });
    expect(detached).toContain("previously live-derived scenario");
    expect(detached).toContain("detached from its former live company context");
    expect(detached).not.toContain("Portable what-if scenario");
    expect(detached).not.toContain("Open scenario workspace");

    const portable = markup({
      lab: "economy",
      snapshot: { ...snapshot, companies: [] },
      hasScenario: true,
      isPortableScenario: true,
    });
    expect(portable).toContain("Portable what-if scenario");
    expect(portable).not.toContain("previously live-derived scenario");
  });

  it("does not claim the Market link identifies a verified company or independent origin", () => {
    const linked = markup({
      lab: "market",
      itemCode: "fish",
      linkedPlayerId: "player-1",
      linkedCompanyId: "company-fish-2",
    });
    expect(linked).toContain("Item requested: fish");
    expect(linked).toContain("Linked company ID:");
    expect(linked).toContain("not verified by Market Lab");
    expect(linked).not.toContain("Fish Inc");
    const independent = markup({ lab: "market", itemCode: "fish" });
    expect(independent).not.toContain("Linked player ID");
    expect(independent).not.toContain("from a linked player");
  });

  it("distinguishes linked loading/errors from a detached portable scenario", () => {
    expect(markup({ lab: "company", linkedPlayerId: "player-1", isLoadingPlayer: true })).toContain(
      "Loading linked player context",
    );
    expect(markup({ lab: "player", linkedPlayerId: "player-1", playerLoadFailed: true })).toContain(
      "Linked player could not be loaded",
    );
    const portable = markup({ lab: "economy", hasScenario: true, isPortableScenario: true });
    expect(portable).toContain("Portable what-if scenario");
    expect(portable).toContain("No player snapshot was imported");
    const separate = markup({
      lab: "economy",
      snapshot,
      company: second,
      hasScenario: true,
      isPortableScenario: true,
    });
    expect(separate).toContain("not attached to this scenario");
    expect(separate).toContain("View separate player snapshot");
    expect(separate).not.toContain("Company ·");
  });
});
