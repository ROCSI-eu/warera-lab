import type { PublicCompanySnapshot, PublicPlayerSnapshotResponse } from "@warera-lab/domain";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PlayerCompanyPortfolio } from "./PlayerCompanyPortfolio.js";
import { PlayerNextSteps } from "./PlayerNextSteps.js";
import { PlayerLabShell } from "./PlayerLabShell.js";
import { playerHandoffHref } from "./player-handoffs.js";

const location = {
  pathname: "/",
  search: "?lab=player&player=old&company=old&item=fish",
  hash: "#wl=do-not-transfer",
};
const company: PublicCompanySnapshot = {
  id: "company-1",
  ownerId: "player-1",
  regionId: "region-1",
  name: "Fish Inc",
  itemCode: "fish",
  activeUpgradeLevels: {},
};
const snapshot: PublicPlayerSnapshotResponse = {
  player: {
    id: "player-1",
    username: "Tester",
    countryId: "country-1",
    level: 8,
    availableSkillPoints: 2,
    spentSkillPoints: 12,
    totalSkillPoints: 14,
    skills: {
      production: { level: 1, value: 1, total: 1 },
      entrepreneurship: { level: 1, value: 1, total: 1 },
      management: { level: 1, value: 1, total: 1 },
      companies: { level: 1, value: 1, total: 1 },
    },
  },
  companies: [company],
  regions: {},
  countries: {},
  contextGaps: { regionIds: [], countryIds: [] },
  freshness: { generatedAt: "2026-10-09T12:00:00.000Z", hasStaleData: false, sources: [] },
};

describe("Player Lab contextual URL handoffs", () => {
  it("uses only public identifiers in existing routes; drops unrelated item and portable scenario fragment", () => {
    expect(playerHandoffHref("economy", "player-1", location)).toBe(
      "/?lab=economy&player=player-1",
    );
    expect(playerHandoffHref("company", "player-1", location)).toBe(
      "/?lab=company&player=player-1",
    );
    expect(playerHandoffHref("market", "player-1", location)).toBeUndefined();
    expect(playerHandoffHref("company", "player-1", location, company)).toBe(
      "/?lab=company&player=player-1&company=company-1",
    );
    expect(playerHandoffHref("economy", "player-1", location, company)).toBe(
      "/?lab=economy&player=player-1&company=company-1",
    );
    expect(playerHandoffHref("market", "player-1", location, company)).toBe(
      "/?lab=market&player=player-1&company=company-1&item=fish",
    );
  });

  it("does not emit Market item handoff if company output is absent or violates the parser limit", () => {
    expect(
      playerHandoffHref("market", "player-1", location, { ...company, itemCode: "" }),
    ).toBeUndefined();
    expect(
      playerHandoffHref("market", "player-1", location, { ...company, itemCode: "  " }),
    ).toBeUndefined();
    expect(
      playerHandoffHref("market", "player-1", location, { ...company, itemCode: "x".repeat(65) }),
    ).toBeUndefined();
  });

  it("makes zero-company player-level destinations discoverable and truthful", () => {
    const html = renderToStaticMarkup(
      createElement(PlayerNextSteps, {
        snapshot: { ...snapshot, companies: [] },
        location,
      }),
    );
    expect(html).toContain("Model this player");
    expect(html).toContain("Browse owned companies in Company Lab");
    expect(html).toContain("company-based modelling may be unavailable");
    expect(html).toContain('href="/?lab=economy&amp;player=player-1"');
    expect(html).toContain('href="/?lab=company&amp;player=player-1"');
    expect(html).not.toContain("lab=market");
    expect(html).not.toContain("wl=");
  });

  it("distinguishes two identically named companies and preserves clicked company/item", () => {
    const second = { ...company, id: "company-2", itemCode: "steel" };
    const duplicate = { ...company, id: "company-3" };
    const html = renderToStaticMarkup(
      createElement(PlayerCompanyPortfolio, {
        snapshot: { ...snapshot, companies: [company, second, duplicate] },
        location,
      }),
    );
    expect(html).toContain("company-1");
    expect(html).toContain("company-2");
    expect(html).toContain("company-3");
    expect(html).toContain("item=steel");
    expect(html).toContain("item=fish");
    expect(html.match(/Model Fish Inc \(Company /g)?.length).toBe(3);
    expect(html.match(/Inspect fish from Fish Inc \(Company /g)?.length).toBe(2);
    expect(html).not.toContain("wl=");
  });

  it("rejects unusable API/route identities instead of generating silently coerced links", () => {
    expect(playerHandoffHref("economy", " player-1 ", location)).toBeUndefined();
    expect(playerHandoffHref("company", "p".repeat(129), location)).toBeUndefined();
    expect(
      playerHandoffHref("market", "player-1", location, { ...company, id: "company-1 " }),
    ).toBeUndefined();
    expect(
      playerHandoffHref("economy", "player-1", location, { ...company, id: "c".repeat(161) }),
    ).toBeUndefined();

    const invalid = { ...snapshot, player: { ...snapshot.player, id: " ".repeat(2) + "bad" } };
    const emptyLinks = renderToStaticMarkup(
      createElement(PlayerNextSteps, { snapshot: invalid, location }),
    );
    expect(emptyLinks).toContain("player identifier is invalid");
    expect(emptyLinks).not.toContain("href=");
    const companyLinks = renderToStaticMarkup(
      createElement(PlayerCompanyPortfolio, { snapshot: invalid, location }),
    );
    expect(companyLinks).toContain("Lab links unavailable");
    expect(companyLinks).not.toContain("href=");
  });

  it("warns next to Market handoffs when the public company association could be stale", () => {
    const html = renderToStaticMarkup(
      createElement(PlayerCompanyPortfolio, {
        snapshot: { ...snapshot, freshness: { ...snapshot.freshness, hasStaleData: true } },
        location,
      }),
    );
    expect(html).toContain("This company-to-output association may be stale");
    expect(html).toContain("Market Lab fetches current");
    expect(html).toContain("does not verify the company still produces it");
    const currentHtml = renderToStaticMarkup(
      createElement(PlayerCompanyPortfolio, { snapshot, location }),
    );
    expect(currentHtml).not.toContain("company-to-output association may be stale");
  });

  it("identifies exact focused company when duplicate names are present", () => {
    const second = { ...company, id: "company-2" };
    const html = renderToStaticMarkup(
      createElement(PlayerLabShell, {
        snapshot: { ...snapshot, companies: [company, second] },
        focusedCompanyId: second.id,
        navigationMessage: undefined,
        isImporting: false,
        isRefreshing: false,
        refreshMessage: undefined,
        onRefresh: () => undefined,
        handoffLocation: location,
      }),
    );
    expect(html).toContain("This link focuses the owned company");
    expect(html).toContain("Fish Inc (Company");
    expect(html).toContain("company-2");
    expect(html.indexOf("This link focuses the owned company")).toBeLessThan(
      html.indexOf("Observed economy skills"),
    );
  });

  it("keeps company-level actions without inventing market item or activity status", () => {
    const html = renderToStaticMarkup(
      createElement(PlayerCompanyPortfolio, {
        snapshot: { ...snapshot, companies: [{ ...company, itemCode: "" }] },
        location,
      }),
    );
    expect(html).toContain("No usable output item for Market Lab");
    expect(html).toContain("Company Lab");
    expect(html).toContain("Economy Lab");
    expect(html).not.toContain("lab=market");
    expect(html).not.toMatch(/active company|inactive company|inventory balance quantity/i);
  });
});
