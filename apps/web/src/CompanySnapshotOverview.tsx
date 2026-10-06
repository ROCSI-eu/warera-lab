import {
  companyUpgradeAvailability,
  type CompanyUpgradeKey,
  type PublicCompanySnapshot,
  type PublicPlayerSnapshotResponse,
} from "@warera-lab/domain";

import type { CompanyPresentation } from "./company-display.js";
import { formatDisplayNumber } from "./display-format.js";
import { FreshnessPanel } from "./FreshnessPanel.js";

const upgradeLabels = {
  automatedEngine: "Automated Engine",
  storage: "Storage",
  breakRoom: "Break Room",
} as const;

function reportedNumber(
  value: number | undefined,
  kind: "integer" | "production" | "number",
): string {
  return value === undefined ? "Not reported" : formatDisplayNumber(value, kind);
}

export function CompanySnapshotOverview({
  snapshot,
  company,
  presentation,
}: {
  snapshot: PublicPlayerSnapshotResponse;
  company: PublicCompanySnapshot;
  presentation: CompanyPresentation | undefined;
}) {
  const region = snapshot.regions[company.regionId];
  const country = region ? snapshot.countries[region.countryId] : undefined;
  const activeUpgrades = Object.entries(company.activeUpgradeLevels).filter(
    ([, level]) => level !== undefined && level > 0,
  );
  const missingGeography = region === undefined || country === undefined;

  return (
    <section
      className="workspace-panel company-snapshot-overview"
      aria-labelledby="company-overview-title"
    >
      <div className="section-heading">
        <div>
          <p className="section-kicker">Selected company</p>
          <h3 id="company-overview-title">{company.name}</h3>
          <p className="muted">
            Owned by {snapshot.player.username} · Level {snapshot.player.level}
          </p>
        </div>
        <span className="badge badge--observed">Observed snapshot</span>
      </div>

      <div className="company-detail">
        <div>
          <span>Output item</span>
          <strong>{company.itemCode}</strong>
          <small>
            {presentation?.fallbackId
              ? "Company ID " + presentation.fallbackId
              : "Normalized item code"}
          </small>
        </div>
        <div>
          <span>Region</span>
          <strong>{region?.name ?? "Region unavailable"}</strong>
          <small>{country?.name ?? region?.countryCode ?? "Country unavailable"}</small>
        </div>
        <div>
          <span>Observed production</span>
          <strong>{reportedNumber(company.production, "production")}</strong>
          <small>Public snapshot field</small>
        </div>
        <div>
          <span>Workers</span>
          <strong>{reportedNumber(company.workerCount, "integer")}</strong>
          <small>Public snapshot field</small>
        </div>
        {company.estimatedValue !== undefined ? (
          <div>
            <span>Estimated company value</span>
            <strong>{formatDisplayNumber(company.estimatedValue, "number")}</strong>
            <small>Estimated current value of invested construction materials and upgrades</small>
          </div>
        ) : null}
        <div className="upgrade-detail">
          <span>Active upgrades</span>
          {activeUpgrades.length > 0 ? (
            <ul>
              {activeUpgrades.map(([key, level]) => {
                const upgradeKey = key as CompanyUpgradeKey;
                const availability = companyUpgradeAvailability[upgradeKey];
                return (
                  <li key={key}>
                    {upgradeLabels[upgradeKey] ?? key}: level {level}
                    {availability.gameplay === "production"
                      ? ""
                      : " · dev preview, not currently available in production"}
                  </li>
                );
              })}
            </ul>
          ) : (
            <strong>None reported</strong>
          )}
        </div>
      </div>

      {missingGeography ? (
        <p className="message message--warning" role="status">
          Some geographic context for this company is unavailable. No replacement values were
          invented.
        </p>
      ) : null}

      <FreshnessPanel freshness={snapshot.freshness} title="Snapshot" />
    </section>
  );
}
