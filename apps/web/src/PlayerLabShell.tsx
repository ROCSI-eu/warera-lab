import type { PublicPlayerSnapshotResponse } from "@warera-lab/domain";
import type { WorkspaceMessage } from "./workspace-state.js";

export function PlayerLabShell({
  snapshot,
  focusedCompanyId,
  navigationMessage,
  isImporting,
  isRefreshing,
  refreshMessage,
  onRefresh,
}: {
  snapshot: PublicPlayerSnapshotResponse | undefined;
  focusedCompanyId: string | undefined;
  navigationMessage: string | undefined;
  isImporting: boolean;
  isRefreshing: boolean;
  refreshMessage: WorkspaceMessage | undefined;
  onRefresh: () => void;
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
              ? "Public player context is loaded. The economic profile, owned-company overview, and specialist-lab shortcuts will be added in the next focused steps."
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
      {snapshot ? (
        <>
          <p className="muted">
            Snapshot generated{" "}
            <time dateTime={snapshot.freshness.generatedAt}>
              {new Date(snapshot.freshness.generatedAt).toLocaleString()}
            </time>
            .
          </p>
          {focusedCompany ? (
            <p className="muted">
              This link focuses the owned company {focusedCompany.name}. This does not indicate
              whether the company is active in WarEra.
            </p>
          ) : null}
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
