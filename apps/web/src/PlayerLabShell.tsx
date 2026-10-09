import type { PublicPlayerSnapshotResponse } from "@warera-lab/domain";
import type { WorkspaceMessage } from "./workspace-state.js";
import { PlayerProfile } from "./PlayerProfile.js";
import { PlayerCompanyPortfolio, portfolioCompanyIdentity } from "./PlayerCompanyPortfolio.js";
import { PlayerNextSteps } from "./PlayerNextSteps.js";
import type { HandoffLocation } from "./player-handoffs.js";

export function PlayerLabShell({
  snapshot,
  focusedCompanyId,
  navigationMessage,
  isImporting,
  isRefreshing,
  refreshMessage,
  onRefresh,
  onRetryLinkedPlayer,
  handoffLocation = { pathname: "/", search: "", hash: "" },
}: {
  snapshot: PublicPlayerSnapshotResponse | undefined;
  focusedCompanyId: string | undefined;
  navigationMessage: string | undefined;
  isImporting: boolean;
  isRefreshing: boolean;
  refreshMessage: WorkspaceMessage | undefined;
  onRefresh: () => void;
  onRetryLinkedPlayer?: (() => void) | undefined;
  handoffLocation?: HandoffLocation;
}) {
  const focusedCompany = snapshot?.companies.find((company) => company.id === focusedCompanyId);

  return (
    <section className="workspace player-lab" aria-labelledby="player-lab-title">
      <div className="workspace-heading">
        <div>
          <p className="section-kicker">Player Lab · public snapshot</p>
          <h2 id="player-lab-title">
            {snapshot ? snapshot.player.username : "Start with a player"}
          </h2>
          <p className="muted">
            {snapshot
              ? "Public economic profile and a concise owned-company overview from WarEra's public snapshot. Choose a purpose-specific lab below to explore further."
              : "Search for a public WarEra player above and select Import to establish a player-centered starting point."}
          </p>
        </div>
        {snapshot ? (
          <div className="workspace-header-actions">
            <span className="badge badge--observed">Observed public snapshot</span>
            <button
              className="refresh-button"
              type="button"
              onClick={onRefresh}
              disabled={isImporting || isRefreshing}
            >
              {isRefreshing ? "Refreshing…" : "Refresh snapshot"}
            </button>
          </div>
        ) : null}
      </div>

      {isImporting ? (
        <p className="message" role="status">
          Loading public player information…
        </p>
      ) : null}
      {navigationMessage ? (
        <p className="message message--warning" role="status">
          {navigationMessage}
        </p>
      ) : null}
      {refreshMessage ? (
        <p
          className={"message message--" + refreshMessage.kind}
          role={refreshMessage.kind === "error" ? "alert" : "status"}
        >
          {isRefreshing ? "Refreshing the public player snapshot…" : refreshMessage.text}
        </p>
      ) : null}
      {!snapshot && !isImporting && onRetryLinkedPlayer ? (
        <div className="message message--warning">
          <p>
            The public player in this link could not be loaded. You can retry the same link after
            any suggested rate-limit wait, or search for another player above.
          </p>
          <button className="refresh-button" type="button" onClick={onRetryLinkedPlayer}>
            Retry linked player
          </button>
        </div>
      ) : null}
      {snapshot ? (
        <>
          {focusedCompany ? (
            <p className="message" role="status">
              This link focuses the owned company{" "}
              {portfolioCompanyIdentity(focusedCompany, snapshot.companies)}. Use the links in its
              portfolio card below to inspect that company in a specialist lab. The link does not
              indicate whether the company is active in WarEra.
            </p>
          ) : null}
          <PlayerProfile snapshot={snapshot} />
          <PlayerNextSteps snapshot={snapshot} location={handoffLocation} />
          <PlayerCompanyPortfolio snapshot={snapshot} location={handoffLocation} />
          {snapshot.freshness.hasStaleData ? (
            <p className="message message--warning" role="status">
              Some public data is stale; refresh to request another snapshot.
            </p>
          ) : null}
        </>
      ) : !isImporting ? (
        <p className="muted">No player has been imported into Player Lab.</p>
      ) : null}
    </section>
  );
}
