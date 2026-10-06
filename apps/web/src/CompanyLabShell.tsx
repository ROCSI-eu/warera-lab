import type { PublicCompanySnapshot, PublicPlayerSnapshotResponse } from "@warera-lab/domain";

import { CompanySelector } from "./CompanySelector.js";
import type { CompanyPresentation } from "./company-display.js";

export function CompanyLabShell({
  snapshot,
  selectedCompany,
  companyPresentations,
  navigationMessage,
  isBusy,
  onCompanySelect,
}: {
  snapshot: PublicPlayerSnapshotResponse | undefined;
  selectedCompany: PublicCompanySnapshot | undefined;
  companyPresentations: Map<string, CompanyPresentation>;
  navigationMessage: string | undefined;
  isBusy: boolean;
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
          <p className="section-kicker">Company Lab · context foundation</p>
          <h2 id="company-lab-title">{snapshot.player.username}</h2>
          <p className="muted">
            Choose a company below. This release establishes navigation and reload-safe identity
            only; the Company Lab analytical overview is intentionally deferred to the next
            implementation ticket.
          </p>
        </div>
        <span className="badge badge--observed">Public snapshot context</span>
      </div>

      {navigationMessage ? (
        <p className="message message--warning" role="status">
          {navigationMessage}
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

        <section className="workspace-panel" aria-labelledby="company-lab-selection-title">
          <p className="section-kicker">Reload-safe selection</p>
          <h3 id="company-lab-selection-title">Selected company</h3>
          {selectedCompany ? (
            <div className="company-lab-selected">
              <strong>{selectedCompany.name}</strong>
              <span>{selectedCompany.itemCode}</span>
              <small>{selectedPresentation?.location ?? "Location unavailable"}</small>
              <p className="muted">
                The URL now carries this player/company identity. Detailed company facts and
                analysis remain out of scope for this foundation release.
              </p>
            </div>
          ) : (
            <p className="muted">
              This player has no selectable public company context. Search for another player to
              continue.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}
