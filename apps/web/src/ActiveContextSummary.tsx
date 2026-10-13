import type { PublicCompanySnapshot, PublicPlayerSnapshotResponse } from "@warera-lab/domain";

import { focusLabSection } from "./focus-lab-section.js";
import { portfolioCompanyIdentity } from "./PlayerCompanyPortfolio.js";
import type { LabId } from "./lab-navigation.js";

interface ActiveContextSummaryProps {
  lab: LabId;
  snapshot?: PublicPlayerSnapshotResponse | undefined;
  company?: PublicCompanySnapshot | undefined;
  focusedCompany?: PublicCompanySnapshot | undefined;
  linkedPlayerId?: string | undefined;
  linkedCompanyId?: string | undefined;
  itemCode?: string | undefined;
  isLoadingPlayer?: boolean | undefined;
  playerLoadFailed?: boolean | undefined;
  isLoadingEconomyContext?: boolean | undefined;
  hasScenario?: boolean | undefined;
  scenarioCompanyId?: string | undefined;
  isPortableScenario?: boolean | undefined;
}

export function ActiveContextSummary({
  lab,
  snapshot,
  company,
  focusedCompany,
  linkedPlayerId,
  linkedCompanyId,
  itemCode,
  isLoadingPlayer = false,
  playerLoadFailed = false,
  isLoadingEconomyContext = false,
  hasScenario = false,
  scenarioCompanyId,
  isPortableScenario = false,
}: ActiveContextSummaryProps) {
  const hasMarketLink = lab === "market" && Boolean(itemCode || linkedPlayerId);
  const hasPlayerLink = lab !== "market" && Boolean(linkedPlayerId);
  if (!snapshot && !hasPlayerLink && !hasMarketLink && !(lab === "economy" && isPortableScenario)) {
    return null;
  }

  const contextCompany = lab === "player" ? focusedCompany : company;
  const companyIdentity =
    contextCompany && snapshot && !(lab === "economy" && isPortableScenario)
      ? portfolioCompanyIdentity(contextCompany, snapshot.companies)
      : undefined;
  const actions: { label: string; target: string }[] = [];
  let heading: string;
  let detail: string;

  if (lab === "market") {
    heading = itemCode ? "Item requested: " + itemCode : "Market context from a linked player";
    detail = itemCode
      ? "Inspect the selected item's current public market data below."
      : "Browse current public market items below.";
    actions.push(
      itemCode
        ? { label: "Inspect selected item", target: "market-inspection-title" }
        : { label: "Browse market items", target: "market-catalogue-title" },
    );
  } else if (lab === "economy" && isPortableScenario) {
    heading = "Portable what-if scenario";
    detail = snapshot
      ? `A separate public snapshot of ${snapshot.player.username} is also available, but is not attached to this scenario.`
      : "Scenario loaded separately from live player data. No player snapshot was imported.";
    if (hasScenario)
      actions.push({ label: "Open scenario workspace", target: "scenario-workspace-title" });
    if (snapshot)
      actions.push({ label: "View separate player snapshot", target: "workspace-title" });
  } else if (snapshot) {
    heading = "Current player: " + snapshot.player.username;
    detail =
      lab === "player"
        ? `Public player snapshot loaded · ${snapshot.companies.length} owned ${snapshot.companies.length === 1 ? "company" : "companies"} listed.`
        : "Public player snapshot loaded. The displayed company is observed context, not a modified scenario.";

    if (
      lab === "economy" &&
      hasScenario &&
      !isPortableScenario &&
      (scenarioCompanyId === undefined || scenarioCompanyId !== company?.id)
    ) {
      detail =
        scenarioCompanyId === undefined
          ? "A previously live-derived scenario remains available below, but is detached from its former live company context."
          : "A scenario from a different company remains available below, but is not attached to the currently selected company.";
    }

    if (lab === "player") {
      actions.push({ label: "View owned companies", target: "player-portfolio-title" });
      actions.push({ label: "Explore next steps", target: "player-next-steps-title" });
    } else if (lab === "company") {
      if (company) actions.push({ label: "Inspect company", target: "company-overview-title" });
      actions.push({
        label: company ? "Change company" : "View company availability",
        target: "company-lab-companies-title",
      });
    } else {
      actions.push({ label: "View imported workspace", target: "workspace-title" });
      if (hasScenario && scenarioCompanyId !== undefined && scenarioCompanyId === company?.id)
        actions.push({ label: "Open scenario workspace", target: "scenario-workspace-title" });
    }
  } else {
    heading = playerLoadFailed
      ? "Linked player could not be loaded"
      : isLoadingPlayer
        ? "Loading linked player context"
        : "Opening linked player context";
    detail = playerLoadFailed
      ? "The linked public player is unavailable. Search for another player or retry below."
      : "Retrieving the public player snapshot before showing its verified identity.";
    actions.push({ label: "Find a player", target: "player-search-title" });
  }

  return (
    <section className="active-context" aria-labelledby="active-context-title">
      <div className="active-context__copy">
        <p className="section-kicker">{lab} Lab · current context</p>
        <p id="active-context-title" className="active-context__title">
          {heading}
        </p>
        {companyIdentity ? (
          <p className="active-context__identity">
            Company · <strong>{companyIdentity}</strong> · Output {contextCompany?.itemCode}
          </p>
        ) : null}
        {lab === "market" && linkedPlayerId ? (
          <p className="active-context__identity">
            Linked player ID: <code>{linkedPlayerId}</code>
            {linkedCompanyId ? (
              <>
                {" "}
                · Linked company ID: <code>{linkedCompanyId}</code>
              </>
            ) : null}
          </p>
        ) : null}
        <p className="muted">{detail}</p>
        {lab === "market" && linkedPlayerId ? (
          <p className="muted">
            These identifiers came from the link and are not verified by Market Lab; no company
            snapshot or scenario was transferred.
          </p>
        ) : null}
        {isLoadingEconomyContext && snapshot && lab === "economy" ? (
          <p className="muted">Loading current Economy configuration for the selected company…</p>
        ) : null}
      </div>
      <div className="active-context__actions">
        {actions.map((action) => (
          <button
            className="company-lab-handoff"
            key={action.target}
            type="button"
            onClick={() => focusLabSection(action.target)}
          >
            {action.label} ↓
          </button>
        ))}
      </div>
    </section>
  );
}
