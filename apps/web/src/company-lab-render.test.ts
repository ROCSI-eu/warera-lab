import type {
  EconomyPlannerContextResponse,
  PublicCompanySnapshot,
  PublicPlayerSnapshotResponse,
} from "@warera-lab/domain";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CompanyLabShell } from "./CompanyLabShell.js";
import { describeCompany } from "./company-display.js";

const company: PublicCompanySnapshot = {
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
      productionBonusPercent: 5,
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

const economyContext: EconomyPlannerContextResponse = {
  itemCode: "steel",
  configRevision: "test-company-config",
  item: {
    code: "steel",
    type: "resource",
    rarity: "common",
    productionPoints: 10,
    productionNeeds: { iron: 2, coal: 1 },
    isTradable: true,
  },
  skills: {
    production: {
      key: "production",
      levels: { 1: { level: 1, value: 12, totalCost: 1, unlockAtLevel: 1 } },
    },
    entrepreneurship: {
      key: "entrepreneurship",
      levels: { 1: { level: 1, value: 35, totalCost: 2, unlockAtLevel: 1 } },
    },
    management: {
      key: "management",
      levels: { 1: { level: 1, value: 6, totalCost: 1, unlockAtLevel: 1 } },
    },
    companies: {
      key: "companies",
      levels: { 1: { level: 1, value: 3, totalCost: 2, unlockAtLevel: 1 } },
    },
  },
  companyUpgrades: {
    automatedEngine: {
      key: "automatedEngine",
      canDowngrade: true,
      levels: {
        1: { level: 1, steelCost: 10, constructionPointsCost: 5, stats: { dailyProd: 24 } },
      },
    },
    storage: {
      key: "storage",
      canDowngrade: true,
      levels: {
        2: {
          level: 2,
          steelCost: 35,
          constructionPointsCost: 14,
          stats: { maxProduction: 350 },
        },
      },
    },
    breakRoom: {
      key: "breakRoom",
      canDowngrade: false,
      levels: {
        1: { level: 1, steelCost: 15, stats: { maxWorkers: 2, dailyHires: 1 } },
      },
    },
  },
  marketPrices: { steel: 10, iron: 2, coal: 3 },
  contextGaps: { itemCodes: [], marketPriceItemCodes: [] },
  freshness: {
    generatedAt: "2026-10-06T12:00:01.000Z",
    hasStaleData: false,
    sources: [
      {
        source: "gameConfig",
        retrievedAt: "2026-10-06T12:00:00.000Z",
        ageMs: 1000,
        state: "live",
      },
      {
        source: "marketPrices",
        retrievedAt: "2026-10-06T12:00:00.000Z",
        ageMs: 1000,
        state: "live",
      },
    ],
  },
};

interface RenderOptions {
  selected?: PublicCompanySnapshot | undefined;
  context?: EconomyPlannerContextResponse | undefined;
  contextProvided?: boolean;
  isLoading?: boolean;
}

function renderShell(current: PublicPlayerSnapshotResponse, options: RenderOptions = {}) {
  const selected = options.selected ?? current.companies[0];
  const currentContext =
    options.contextProvided || "context" in options ? options.context : economyContext;
  const presentations = new Map(
    current.companies.map((candidate) => [candidate.id, describeCompany(candidate, current)]),
  );
  return renderToStaticMarkup(
    createElement(CompanyLabShell, {
      snapshot: current,
      selectedCompany: selected,
      companyPresentations: presentations,
      economyContext: currentContext,
      economyContextItemCode: selected?.itemCode,
      navigationMessage: undefined,
      economyLabHref: "/?lab=economy&player=player-1&company=" + (selected?.id ?? ""),
      marketLabHref: selected
        ? "/?lab=market&player=player-1&company=" + selected.id + "&item=" + selected.itemCode
        : undefined,
      isBusy: false,
      isLoadingEconomyContext: options.isLoading ?? false,
      onCompanySelect: () => undefined,
    }),
  );
}

describe("Company Lab snapshot overview", () => {
  it("renders complete normalized company context and existing duplicate disambiguation", () => {
    const duplicate = { ...company, id: "company-beta-2222222" };
    const current = { ...snapshot, companies: [company, duplicate] };
    const html = renderShell(current, { selected: company });

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
    expect(html).toContain("Model in Economy Lab →");
    expect(html).toContain("Inspect steel in Market Lab →");
    expect(html).toContain(
      'href="/?lab=market&amp;player=player-1&amp;company=company-alpha-1111111&amp;item=steel"',
    );
    expect(html).toContain("without transferring snapshot data or scenario state");
    expect(html).toContain(
      'href="/?lab=economy&amp;player=player-1&amp;company=company-alpha-1111111"',
    );
    expect(html).toContain("receives only the current player and company identifiers");
    expect(html).toContain("reloads");
    expect(html).toContain("normalized context before creating its observed baseline");
    expect(html).not.toContain("production=24");
    expect(html).not.toContain("name=Planner");
  });

  it("targets the selected company output for Market Lab, not another company", () => {
    const iron = { ...company, id: "company-iron-22222", itemCode: "iron", name: "Iron Works" };
    const html = renderShell({ ...snapshot, companies: [company, iron] }, { selected: iron });
    expect(html).toContain("Inspect iron in Market Lab");
    expect(html).toContain(
      'href="/?lab=market&amp;player=player-1&amp;company=company-iron-22222&amp;item=iron"',
    );
    expect(html).not.toContain('item=steel"');
  });

  it("shows recipe, production-live operating references, and configured active-upgrade stats", () => {
    const html = renderShell(snapshot);

    expect(html).toContain("Production &amp; operating context");
    expect(html).toContain("Reference, not simulation");
    expect(html).toContain("Production recipe");
    expect(html).toContain("Configured production points: 10");
    expect(html).toContain(">iron<");
    expect(html).toContain(">2<");
    expect(html).toContain(">coal<");
    expect(html).toContain(">1<");
    expect(html).toContain("Daily production reference");
    expect(html).toContain("Production capacity reference");
    expect(html).toContain(">350<");
    expect(html).toContain("Worker-capacity reference");
    expect(html).toContain("No production-live reference");
    expect(html).toContain("Automated Engine · observed level 1");
    expect(html).toContain("Configured daily production: 24");
    expect(html).toContain("Storage · observed level 2");
    expect(html).toContain("Configured production capacity: 350");
    expect(html).toContain("10 current · 8 base");
    expect(html).toContain("Linked to capital");
    expect(html).toContain("5%");
    expect(html).toContain("Configuration context freshness");
  });

  it("shows current output/input prices with market-only provenance", () => {
    const html = renderShell(snapshot);

    expect(html).toContain("Current market context");
    expect(html).toContain("Current prices only");
    expect(html).toContain("A concise current-price reference");
    expect(html).toContain("Output item");
    expect(html).toContain("<strong>steel</strong>");
    expect(html).toContain("<dt>Current observed price</dt><dd>10</dd>");
    expect(html).toContain("Required production inputs");
    expect(html).toContain("<strong>iron</strong>");
    expect(html).toContain("Recipe quantity 2");
    expect(html).toContain("<strong>coal</strong>");
    expect(html).toContain("Recipe quantity 1");
    expect(html).toContain("Market prices freshness");
    expect(html).toContain("<span>marketPrices</span>");
  });

  it("keeps partial current-price context explicit without substituting values", () => {
    const partialMarketContext: EconomyPlannerContextResponse = {
      ...economyContext,
      marketPrices: { steel: 10, iron: 2 },
      contextGaps: {
        ...economyContext.contextGaps,
        marketPriceItemCodes: ["coal"],
      },
    };
    const html = renderShell(snapshot, { context: partialMarketContext });

    expect(html).toContain("<dt>Current observed price</dt><dd>10</dd>");
    expect(html).toContain("Missing current price references: coal");
    expect(html).toContain("No replacement values were invented");
    expect(html.match(/No current price/g)).toHaveLength(1);
    expect(html).toContain("Market prices freshness");
  });

  it("renders an absent current-price state without inventing market data", () => {
    const absentMarketContext: EconomyPlannerContextResponse = {
      ...economyContext,
      marketPrices: {},
      contextGaps: {
        ...economyContext.contextGaps,
        marketPriceItemCodes: ["steel", "iron", "coal"],
      },
      freshness: {
        ...economyContext.freshness,
        sources: economyContext.freshness.sources.filter(
          (source) => source.source !== "marketPrices",
        ),
      },
    };
    const html = renderShell(snapshot, { context: absentMarketContext });

    expect(html.match(/No current price/g)).toHaveLength(3);
    expect(html).toContain(
      "No normalized current prices are available for this company&#x27;s output or required inputs",
    );
    expect(html).toContain("instead of substituting assumptions");
    expect(html).toContain("Market prices freshness");
    expect(html).toContain("No individual source timestamps were returned");
  });

  it("labels observed Break Room state and config as dev-only instead of a production constraint", () => {
    const devCompany: PublicCompanySnapshot = {
      ...company,
      activeUpgradeLevels: { breakRoom: 1 },
    };
    const current: PublicPlayerSnapshotResponse = {
      ...snapshot,
      companies: [devCompany],
    };
    const html = renderShell(current, { selected: devCompany });

    expect(html).toContain(
      "Break Room: level 1 · dev preview, not currently available in production",
    );
    expect(html).toContain("Break Room L1 (dev preview)");
    expect(html).toContain("Break Room · observed level 1");
    expect(html).toContain("Dev preview, not currently available in production");
    expect(html).toContain("Configured worker capacity: 2");
    expect(html).toContain("Configured daily hires: 1");
    expect(html).toContain("No production-live reference");
  });

  it("renders calm unavailable states for partial normalized snapshots and config", () => {
    const partialCompany: PublicCompanySnapshot = {
      id: company.id,
      ownerId: company.ownerId,
      regionId: "region-missing",
      itemCode: company.itemCode,
      name: company.name,
      activeUpgradeLevels: { storage: 2 },
    };
    const current: PublicPlayerSnapshotResponse = {
      ...snapshot,
      companies: [partialCompany],
      regions: {},
      countries: {},
      contextGaps: { regionIds: ["region-missing"], countryIds: [] },
      freshness: { ...snapshot.freshness, sources: [] },
    };
    const partialContext: EconomyPlannerContextResponse = {
      ...economyContext,
      companyUpgrades: {
        ...economyContext.companyUpgrades,
        storage: { ...economyContext.companyUpgrades.storage, levels: {} },
      },
      contextGaps: { ...economyContext.contextGaps, itemCodes: ["steel"] },
    };
    delete partialContext.item;
    const html = renderShell(current, { selected: partialCompany, context: partialContext });

    expect(html.match(/Not reported/g)).toHaveLength(3);
    expect(html).toContain("Region unavailable");
    expect(html).toContain("Country unavailable");
    expect(html).toContain("No replacement values were invented");
    expect(html).not.toContain("Estimated company value");
    expect(html).toContain("No individual source timestamps were returned");
    expect(html).toContain("steel is absent from the normalized game configuration");
    expect(html).toContain(
      "The observed level is not present in the current normalized configuration",
    );
    expect(html).toContain("Item configuration is incomplete for steel");
    expect(html).toContain("Not available");
    expect(html).not.toContain("NaN");
  });

  it("keeps the observed snapshot usable when normalized configuration cannot be loaded", () => {
    const html = renderShell(snapshot, { contextProvided: true, context: undefined });

    expect(html).toContain("Planner Steel");
    expect(html).toContain("Observed production");
    expect(html).toContain("Normalized game configuration is unavailable");
    expect(html).toContain("no recipe, configured upgrade stats, or operating limits are inferred");
  });

  it("renders an explicit loading state while selected-company config is being fetched", () => {
    const html = renderShell(snapshot, {
      contextProvided: true,
      context: undefined,
      isLoading: true,
    });

    expect(html).toContain("Loading normalized production configuration for steel");
    expect(html).not.toContain("Normalized game configuration is unavailable");
  });
});
