import type {
  EconomyPlannerContextResponse,
  PublicCompanySnapshot,
  PublicPlayerSnapshotResponse,
} from "@warera-lab/domain";

import { CompanyOperatingContext } from "./CompanyOperatingContext.js";
import { CompanySelector } from "./CompanySelector.js";
import { CompanySnapshotOverview } from "./CompanySnapshotOverview.js";
import type { CompanyPresentation } from "./company-display.js";

export function CompanyLabShell({
  snapshot,
  selectedCompany,
  companyPresentations,
  economyContext,
  economyContextItemCode,
  navigationMessage,
  isBusy,
  isLoadingEconomyContext,
  onCompanySelect,
}: {
  snapshot: PublicPlayerSnapshotResponse | undefined;
  selectedCompany: PublicCompanySnapshot | undefined;
  companyPresentations: Map<string, CompanyPresentation>;
  economyContext: EconomyPlannerContextResponse | undefined;
  economyContextItemCode: string | undefined;
  navigationMessage: string | undefined;
  isBusy: boolean;
  isLoadingEconomyContext: boolean;
  onCompanySelect: (company: PublicCompanySnapshot) => void;
}) {
  if (!snapshot) {
    return (
      <section className="empty-workspace company-lab-entry" aria-labelledby="company-lab-title">
        <p className="section-kicker">Company Lab</p>
        <h2 id="company-lab-title">Choose a player to establish company context</h2>
        <p>
          Search and import a public player above. Company Lab will keep the chosen player and
          company in the URL so the same context can be reopened or shared.
        </p>
        {navigationMessage ? (
          <p className="message message--warning" role="status">
            {navigationMessage}
          </p>
        ) : null}
      </section>
    );
  }

  const selectedPresentation = selectedCompany
    ? companyPresentations.get(selectedCompany.id)
    : undefined;

  return (
    <section className="workspace company-lab-entry" aria-labelledby="company-lab-title">
      <div className="workspace-heading">
        <div>
          <p className="section-kicker">Company Lab · public snapshot</p>
          <h2 id="company-lab-title">{snapshot.player.username}</h2>
          <p className="muted">
            Select a company to inspect its normalized identity, location, observed operations,
            active upgrades, and snapshot provenance before modelling any changes.
          </p>
        </div>
        <span className="badge badge--observed">Public snapshot context</span>
      </div>

      {navigationMessage ? (
        <p className="message message--warning" role="status">
          {navigationMessage}
        </p>
      ) : null}

      {snapshot.freshness.hasStaleData ? (
        <p className="message message--warning" role="status">
          Some imported values are stale. They remain visible so the lab never hides which data it
          is using.
        </p>
      ) : null}

      <div className="company-lab-context-grid">
        <section className="workspace-panel" aria-labelledby="company-lab-companies-title">
          <p className="section-kicker">Choose context</p>
          <h3 id="company-lab-companies-title">Companies</h3>
          <CompanySelector
            companies={snapshot.companies}
            presentations={companyPresentations}
            selectedCompanyId={selectedCompany?.id}
            onSelect={onCompanySelect}
            disabled={isBusy}
          />
        </section>

        {selectedCompany ? (
          <CompanySnapshotOverview
            snapshot={snapshot}
            company={selectedCompany}
            presentation={selectedPresentation}
          />
        ) : (
          <section className="workspace-panel" aria-labelledby="company-lab-selection-title">
            <p className="section-kicker">Selected company</p>
            <h3 id="company-lab-selection-title">No company available</h3>
            <p className="muted">
              This player has no selectable public company context. Search for another player to
              continue.
            </p>
          </section>
        )}

        {selectedCompany ? (
          <CompanyOperatingContext
            snapshot={snapshot}
            company={selectedCompany}
            context={
              economyContextItemCode === selectedCompany.itemCode ? economyContext : undefined
            }
            isLoading={
              isLoadingEconomyContext && economyContextItemCode === selectedCompany.itemCode
            }
          />
        ) : null}
      </div>
    </section>
  );
}
