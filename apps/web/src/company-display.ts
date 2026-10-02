import type { PublicCompanySnapshot, PublicPlayerSnapshotResponse } from "@warera-lab/domain";

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
}

function shortIdentifier(id: string): string {
  if (id.length <= 8) return id;
  return "…" + id.slice(-7);
}

function upgradeSummary(company: PublicCompanySnapshot): string {
  const entries = Object.entries(company.activeUpgradeLevels)
    .filter(([, level]) => level !== undefined && level > 0)
    .map(([key, level]) => `${upgradeLabels[key as keyof typeof upgradeLabels] ?? key} L${level}`);

  return entries.length > 0 ? entries.join(" · ") : "No active upgrades";
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
    workerCount: company.workerCount,
    production: company.production,
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
      : `${company.workerCount} ${company.workerCount === 1 ? "worker" : "workers"}`,
    company.production === undefined
      ? "Production not reported"
      : `Production ${company.production}`,
  ].join(" · ");

  const signature = humanSignature(company, snapshot);
  const needsFallbackId =
    snapshot.companies.filter((candidate) => humanSignature(candidate, snapshot) === signature)
      .length > 1;

  return {
    location: locationParts.length > 0 ? locationParts.join(" · ") : "Location unavailable",
    operations,
    upgrades: upgradeSummary(company),
    ...(needsFallbackId ? { fallbackId: shortIdentifier(company.id) } : {}),
  };
}
