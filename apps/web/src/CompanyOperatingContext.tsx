import {
  companyUpgradeAvailability,
  type CompanyUpgradeKey,
  type CompanyUpgradeLevelConfig,
  type EconomyPlannerContextResponse,
  type PublicCompanySnapshot,
  type PublicPlayerSnapshotResponse,
  type SnapshotFreshness,
} from "@warera-lab/domain";

import { formatDisplayNumber, type DisplayNumberKind } from "./display-format.js";
import { FreshnessPanel } from "./FreshnessPanel.js";

const upgradeLabels: Record<CompanyUpgradeKey, string> = {
  automatedEngine: "Automated Engine",
  storage: "Storage",
  breakRoom: "Break Room",
};

const statLabels: Record<
  keyof CompanyUpgradeLevelConfig["stats"],
  { label: string; kind: DisplayNumberKind }
> = {
  dailyProd: { label: "Configured daily production", kind: "production" },
  maxProduction: { label: "Configured production capacity", kind: "production" },
  maxWorkers: { label: "Configured worker capacity", kind: "integer" },
  dailyHires: { label: "Configured daily hires", kind: "integer" },
};

function gameConfigFreshness(context: EconomyPlannerContextResponse): SnapshotFreshness {
  const sources = context.freshness.sources.filter((source) => source.source === "gameConfig");
  return {
    generatedAt: context.freshness.generatedAt,
    hasStaleData: sources.some((source) => source.state === "stale"),
    sources,
  };
}

function availabilityLabel(key: CompanyUpgradeKey): string {
  const gameplay = companyUpgradeAvailability[key].gameplay;
  if (gameplay === "production") return "Production-live mechanic";
  if (gameplay === "dev-not-production") {
    return "Dev preview, not currently available in production";
  }
  return "Gameplay availability unverified";
}

function configuredLevel(
  context: EconomyPlannerContextResponse,
  key: CompanyUpgradeKey,
  level: number,
): CompanyUpgradeLevelConfig | undefined {
  return context.companyUpgrades[key]?.levels[level];
}

function configuredStat(
  context: EconomyPlannerContextResponse,
  company: PublicCompanySnapshot,
  key: CompanyUpgradeKey,
  stat: keyof CompanyUpgradeLevelConfig["stats"],
): number | undefined {
  if (companyUpgradeAvailability[key].gameplay !== "production") return undefined;
  const level = company.activeUpgradeLevels[key];
  if (level === undefined || level <= 0) return undefined;
  return configuredLevel(context, key, level)?.stats[stat];
}

export function CompanyOperatingContext({
  snapshot,
  company,
  context,
  isLoading,
}: {
  snapshot: PublicPlayerSnapshotResponse;
  company: PublicCompanySnapshot;
  context: EconomyPlannerContextResponse | undefined;
  isLoading: boolean;
}) {
  const region = snapshot.regions[company.regionId];
  const country = region ? snapshot.countries[region.countryId] : undefined;
  const regionDevelopment =
    typeof region?.development === "number"
      ? formatDisplayNumber(region.development)
      : "Not reported";
  const regionBaseDevelopment =
    typeof region?.baseDevelopment === "number"
      ? formatDisplayNumber(region.baseDevelopment)
      : "Not reported";
  const capitalConnection =
    region === undefined
      ? "Not available"
      : region.isCapital === true
        ? "Capital region"
        : region.isLinkedToCapital === true
          ? "Linked to capital"
          : typeof region.isCapital === "boolean" && typeof region.isLinkedToCapital === "boolean"
            ? "Not linked to capital"
            : "Not reported";

  if (isLoading) {
    return (
      <section
        className="workspace-panel workspace-panel--wide company-operating-context"
        aria-labelledby="company-operating-context-title"
      >
        <p className="section-kicker">Configuration reference</p>
        <h3 id="company-operating-context-title">Production &amp; operating context</h3>
        <p className="message" role="status">
          Loading normalized production configuration for {company.itemCode}…
        </p>
      </section>
    );
  }

  if (!context || context.itemCode !== company.itemCode) {
    return (
      <section
        className="workspace-panel workspace-panel--wide company-operating-context"
        aria-labelledby="company-operating-context-title"
      >
        <p className="section-kicker">Configuration reference</p>
        <h3 id="company-operating-context-title">Production &amp; operating context</h3>
        <p className="message message--warning" role="status">
          Normalized game configuration is unavailable for this selected company right now. The
          observed snapshot above remains usable, but no recipe, configured upgrade stats, or
          operating limits are inferred.
        </p>
      </section>
    );
  }

  const item = context.item;
  const activeUpgrades = Object.entries(company.activeUpgradeLevels).filter(
    ([, level]) => level !== undefined && level > 0,
  ) as [CompanyUpgradeKey, number][];
  const configuredDailyProduction = configuredStat(
    context,
    company,
    "automatedEngine",
    "dailyProd",
  );
  const configuredProductionCapacity = configuredStat(context, company, "storage", "maxProduction");
  const productionWorkerCapacity = (Object.keys(companyUpgradeAvailability) as CompanyUpgradeKey[])
    .filter((key) => companyUpgradeAvailability[key].gameplay === "production")
    .map((key) => configuredStat(context, company, key, "maxWorkers"))
    .find((value) => value !== undefined);

  return (
    <section
      className="workspace-panel workspace-panel--wide company-operating-context"
      aria-labelledby="company-operating-context-title"
    >
      <div className="section-heading">
        <div>
          <p className="section-kicker">Configuration reference</p>
          <h3 id="company-operating-context-title">Production &amp; operating context</h3>
          <p className="muted">
            Observed company state stays separate from current game configuration. These references
            describe what the normalized data exposes; they do not infer a complete production
            formula or recommendation.
          </p>
        </div>
        <span className="badge">Reference, not simulation</span>
      </div>

      <div className="operating-context-grid">
        <div className="operating-context-card">
          <span className="operating-context-label">Production recipe</span>
          {item ? (
            <>
              <strong>
                {item.code} · {item.type} · {item.rarity}
              </strong>
              {item.productionPoints !== undefined ? (
                <small>
                  Configured production points:{" "}
                  {formatDisplayNumber(item.productionPoints, "production")}
                </small>
              ) : (
                <small>Configured production points: not reported</small>
              )}
              {Object.keys(item.productionNeeds).length > 0 ? (
                <ul className="operating-context-list">
                  {Object.entries(item.productionNeeds).map(([inputCode, quantity]) => (
                    <li key={inputCode}>
                      <span>{inputCode}</span>
                      <strong>{formatDisplayNumber(quantity, "quantity")}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <small>No production inputs are listed in the normalized item configuration.</small>
              )}
            </>
          ) : (
            <p className="message message--warning">
              {company.itemCode} is absent from the normalized game configuration. No recipe or
              production-input assumptions were substituted.
            </p>
          )}
        </div>

        <div className="operating-context-card">
          <span className="operating-context-label">Current operating references</span>
          <dl className="operating-reference-list">
            <div>
              <dt>Daily production reference</dt>
              <dd>
                {configuredDailyProduction === undefined
                  ? "Not available"
                  : formatDisplayNumber(configuredDailyProduction, "production")}
              </dd>
            </div>
            <div>
              <dt>Production capacity reference</dt>
              <dd>
                {configuredProductionCapacity === undefined
                  ? "Not available"
                  : formatDisplayNumber(configuredProductionCapacity, "production")}
              </dd>
            </div>
            <div>
              <dt>Worker-capacity reference</dt>
              <dd>
                {productionWorkerCapacity === undefined
                  ? "No production-live reference"
                  : formatDisplayNumber(productionWorkerCapacity, "integer")}
              </dd>
            </div>
          </dl>
          <small>
            References come only from the selected company&apos;s active production-live upgrade
            levels. No utilization or combined-effect formula is inferred.
          </small>
        </div>

        <div className="operating-context-card">
          <span className="operating-context-label">Location reference</span>
          <dl className="operating-reference-list">
            <div>
              <dt>Region development</dt>
              <dd>
                {region
                  ? `${regionDevelopment} current · ${regionBaseDevelopment} base`
                  : "Not available"}
              </dd>
            </div>
            <div>
              <dt>Capital connection</dt>
              <dd>{capitalConnection}</dd>
            </div>
            <div>
              <dt>Country production bonus</dt>
              <dd>
                {country?.productionBonusPercent === undefined
                  ? "Not reported"
                  : `${formatDisplayNumber(country.productionBonusPercent)}%`}
              </dd>
            </div>
          </dl>
          <small>
            Normalized snapshot context only. No unverified production effect is calculated from
            these fields.
          </small>
        </div>
      </div>

      <div className="configured-upgrades">
        <span className="operating-context-label">
          Active upgrades · configured level reference
        </span>
        {activeUpgrades.length > 0 ? (
          <ul>
            {activeUpgrades.map(([key, level]) => {
              const availability = companyUpgradeAvailability[key];
              const levelConfig = configuredLevel(context, key, level);
              return (
                <li key={key}>
                  <div>
                    <strong>
                      {upgradeLabels[key]} · observed level {level}
                    </strong>
                    <small>
                      {availabilityLabel(key)}
                      {" · "}checked {availability.checkedAt}
                    </small>
                  </div>
                  {levelConfig ? (
                    Object.keys(levelConfig.stats).length > 0 ? (
                      <div className="configured-stat-list">
                        {Object.entries(levelConfig.stats).map(([stat, value]) => {
                          if (value === undefined) return null;
                          const metadata =
                            statLabels[stat as keyof CompanyUpgradeLevelConfig["stats"]];
                          if (!metadata) return null;
                          return (
                            <span key={stat}>
                              {metadata.label}: {formatDisplayNumber(value, metadata.kind)}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="muted">No operating stats reported for this level.</span>
                    )
                  ) : (
                    <span className="message message--warning">
                      The observed level is not present in the current normalized configuration.
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <strong>None reported in the observed company snapshot.</strong>
        )}
      </div>

      {context.contextGaps.itemCodes.includes(company.itemCode) ? (
        <p className="message message--warning" role="status">
          Item configuration is incomplete for {company.itemCode}. Company Lab will keep the gap
          visible instead of inventing recipe or capacity values.
        </p>
      ) : null}

      <FreshnessPanel freshness={gameConfigFreshness(context)} title="Configuration context" />
    </section>
  );
}
