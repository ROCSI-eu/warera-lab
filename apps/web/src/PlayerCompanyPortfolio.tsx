import type { PublicCompanySnapshot, PublicPlayerSnapshotResponse } from "@warera-lab/domain";

import { describeCompany } from "./company-display.js";
import { formatDisplayNumber } from "./display-format.js";
import { playerHandoffHref, type HandoffLocation } from "./player-handoffs.js";

// Keep duplicate-name records identifiable even when their names, locations and
// reported operations match. Only show an ID fragment for ambiguous names.
function uniqueSuffix(id: string, duplicateIds: string[]): string {
  for (let length = 7; length < id.length; length += 1) {
    const suffix = id.slice(-length);
    if (duplicateIds.every((candidate) => candidate === id || !candidate.endsWith(suffix))) {
      return "…" + suffix;
    }
  }
  return id;
}

export function portfolioCompanyIdentity(
  company: PublicCompanySnapshot,
  companies: PublicCompanySnapshot[],
): string {
  const duplicateIds = companies
    .filter((candidate) => candidate.name === company.name)
    .map((candidate) => candidate.id);
  return duplicateIds.length > 1
    ? company.name + " (Company " + uniqueSuffix(company.id, duplicateIds) + ")"
    : company.name;
}

function reportedOperations(company: PublicCompanySnapshot): string[] {
  return [
    company.production === undefined
      ? undefined
      : "Reported production " + formatDisplayNumber(company.production, "production"),
    company.workerCount === undefined
      ? undefined
      : formatDisplayNumber(company.workerCount, "integer") +
        (company.workerCount === 1 ? " worker" : " workers"),
  ].filter((value): value is string => value !== undefined);
}

export function PlayerCompanyPortfolio({
  snapshot,
  location = { pathname: "/", search: "", hash: "" },
}: {
  snapshot: PublicPlayerSnapshotResponse;
  location?: HandoffLocation;
}) {
  const companies = snapshot.companies;
  const outputCounts = new Map<string, number>();
  const nameCounts = new Map<string, string[]>();

  for (const company of companies) {
    outputCounts.set(company.itemCode, (outputCounts.get(company.itemCode) ?? 0) + 1);
    nameCounts.set(company.name, [...(nameCounts.get(company.name) ?? []), company.id]);
  }

  return (
    <section className="player-portfolio" aria-labelledby="player-portfolio-title">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Observed company records</p>
          <h3 id="player-portfolio-title">Owned-company overview</h3>
          <p className="muted">
            {formatDisplayNumber(companies.length, "integer")}{" "}
            {companies.length === 1 ? "company" : "companies"} listed ·{" "}
            {formatDisplayNumber(outputCounts.size, "integer")} distinct company output types.
            Company outputs are not player-owned inventory balances.
          </p>
        </div>
      </div>

      {companies.length === 0 ? (
        <p className="muted">No owned companies are listed in this public snapshot.</p>
      ) : (
        <>
          <div className="player-portfolio__outputs" aria-label="Company output types">
            <strong>Company outputs</strong>
            <ul>
              {[...outputCounts].map(([itemCode, count]) => (
                <li key={itemCode}>
                  <span>{itemCode}</span>
                  <small>
                    {formatDisplayNumber(count, "integer")} {count === 1 ? "company" : "companies"}
                  </small>
                </li>
              ))}
            </ul>
          </div>

          <ul className="player-portfolio__grid" aria-label="Listed owned companies">
            {companies.map((company) => {
              const presentation = describeCompany(company, snapshot);
              const duplicateIds = nameCounts.get(company.name) ?? [];
              const region = snapshot.regions[company.regionId];
              const country = region && snapshot.countries[region.countryId];
              const companyLocation = !region
                ? "Location unavailable"
                : !country
                  ? region.name + " · Country unavailable"
                  : presentation.location;
              const cues = reportedOperations(company);
              const companyHref = playerHandoffHref(
                "company",
                snapshot.player.id,
                location,
                company,
              );
              const economyHref = playerHandoffHref(
                "economy",
                snapshot.player.id,
                location,
                company,
              );
              const marketHref = playerHandoffHref("market", snapshot.player.id, location, company);
              const identity = portfolioCompanyIdentity(company, companies);

              return (
                <li key={company.id}>
                  <article className="player-portfolio__card">
                    <div className="player-portfolio__heading">
                      <h4>{company.name}</h4>
                      {duplicateIds.length > 1 ? (
                        <small className="player-portfolio__identifier">
                          Company {uniqueSuffix(company.id, duplicateIds)}
                        </small>
                      ) : null}
                    </div>
                    <p className="player-portfolio__item">
                      <span>Company output</span>
                      <strong>{company.itemCode}</strong>
                    </p>
                    <p className="player-portfolio__location">{companyLocation}</p>
                    {cues.length > 0 ? (
                      <p className="player-portfolio__operations">{cues.join(" · ")}</p>
                    ) : null}
                    <nav className="player-portfolio__actions" aria-label={"Explore " + identity}>
                      {companyHref ? (
                        <a
                          href={companyHref}
                          aria-label={"Inspect " + identity + " in Company Lab"}
                        >
                          Company Lab →
                        </a>
                      ) : null}
                      {economyHref ? (
                        <a href={economyHref} aria-label={"Model " + identity + " in Economy Lab"}>
                          Economy Lab →
                        </a>
                      ) : null}
                      {marketHref ? (
                        <a
                          href={marketHref}
                          aria-label={
                            "Inspect " + company.itemCode + " from " + identity + " in Market Lab"
                          }
                        >
                          Market Lab →
                        </a>
                      ) : null}
                      {!companyHref && !economyHref ? (
                        <span className="muted">
                          Lab links unavailable: public identifier is invalid.
                        </span>
                      ) : null}
                      {!marketHref && companyHref ? (
                        <span className="muted">No usable output item for Market Lab</span>
                      ) : null}
                    </nav>
                    {marketHref && snapshot.freshness.hasStaleData ? (
                      <p className="player-portfolio__market-caveat">
                        This company-to-output association may be stale. Market Lab fetches current
                        item data but does not verify the company still produces it.
                      </p>
                    ) : null}
                  </article>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
