import {
  companyUpgradeAvailability,
  type CompanyUpgradeKey,
  type PublicCompanySnapshot,
  type PublicPlayerSnapshotResponse,
} from "@warera-lab/domain";

import { formatDisplayNumber } from "./display-format.js";

const upgradeLabels = {
  automatedEngine: "Automated Engine",
  storage: "Storage",
  breakRoom: "Break Room",
} as const;

export interface CompanyPresentation {
  location: string;
  operations: string;
  upgrades: string;
  fallbackId?: string;
  compactFallbackId?: string;
}

function shortIdentifier(id: string): string {
  if (id.length <= 8) return id;
  return "…" + id.slice(-7);
}

function upgradeSummary(company: PublicCompanySnapshot): string {
  const entries = Object.entries(company.activeUpgradeLevels)
    .filter(([, level]) => level !== undefined && level > 0)
    .map(([key, level]) => {
      const upgradeKey = key as CompanyUpgradeKey;
      const availability = companyUpgradeAvailability[upgradeKey];
      const availabilityNote = availability.gameplay === "production" ? "" : " (dev preview)";
      return `${upgradeLabels[upgradeKey] ?? key} L${level}${availabilityNote}`;
    });

  return entries.length > 0 ? entries.join(" · ") : "No active upgrades";
}

function compactHumanSignature(
  company: PublicCompanySnapshot,
  snapshot: PublicPlayerSnapshotResponse,
): string {
  const region = snapshot.regions[company.regionId];
  const country = region ? snapshot.countries[region.countryId] : undefined;

  return JSON.stringify({
    name: company.name,
    itemCode: company.itemCode,
    region: region?.name,
    country: country?.name ?? region?.countryCode,
    workerCount:
      company.workerCount === undefined
        ? undefined
        : formatDisplayNumber(company.workerCount, "integer"),
    production:
      company.production === undefined
        ? undefined
        : formatDisplayNumber(company.production, "production"),
  });
}

function humanSignature(
  company: PublicCompanySnapshot,
  snapshot: PublicPlayerSnapshotResponse,
): string {
  const region = snapshot.regions[company.regionId];
  const country = region ? snapshot.countries[region.countryId] : undefined;

  return JSON.stringify({
    name: company.name,
    itemCode: company.itemCode,
    region: region?.name,
    country: country?.name ?? region?.countryCode,
    workerCount:
      company.workerCount === undefined
        ? undefined
        : formatDisplayNumber(company.workerCount, "integer"),
    production:
      company.production === undefined
        ? undefined
        : formatDisplayNumber(company.production, "production"),
    upgrades: Object.entries(company.activeUpgradeLevels).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  });
}

export function describeCompany(
  company: PublicCompanySnapshot,
  snapshot: PublicPlayerSnapshotResponse,
): CompanyPresentation {
  const region = snapshot.regions[company.regionId];
  const country = region ? snapshot.countries[region.countryId] : undefined;
  const locationParts = [region?.name, country?.name ?? region?.countryCode].filter(Boolean);
  const operations = [
    company.workerCount === undefined
      ? "Workers not reported"
      : `${formatDisplayNumber(company.workerCount, "integer")} ${company.workerCount === 1 ? "worker" : "workers"}`,
    company.production === undefined
      ? "Production not reported"
      : `Production ${formatDisplayNumber(company.production, "production")}`,
  ].join(" · ");

  const signature = humanSignature(company, snapshot);
  const compactSignature = compactHumanSignature(company, snapshot);
  const needsFallbackId =
    snapshot.companies.filter((candidate) => humanSignature(candidate, snapshot) === signature)
      .length > 1;
  const needsCompactFallbackId =
    !needsFallbackId &&
    snapshot.companies.filter(
      (candidate) => compactHumanSignature(candidate, snapshot) === compactSignature,
    ).length > 1;

  return {
    location: locationParts.length > 0 ? locationParts.join(" · ") : "Location unavailable",
    operations,
    upgrades: upgradeSummary(company),
    ...(needsFallbackId ? { fallbackId: shortIdentifier(company.id) } : {}),
    ...(needsCompactFallbackId ? { compactFallbackId: shortIdentifier(company.id) } : {}),
  };
}
