import type { PublicPlayerSnapshotResponse } from "@warera-lab/domain";

import { playerHandoffHref, type HandoffLocation } from "./player-handoffs.js";

export function PlayerNextSteps({
  snapshot,
  location,
}: {
  snapshot: PublicPlayerSnapshotResponse;
  location: HandoffLocation;
}) {
  const economyHref = playerHandoffHref("economy", snapshot.player.id, location);
  const companyHref = playerHandoffHref("company", snapshot.player.id, location);

  return (
    <section className="player-handoffs" aria-labelledby="player-next-steps-title">
      <p className="section-kicker">Where to go next</p>
      <h3 id="player-next-steps-title">Continue exploring this player</h3>
      <div className="player-handoffs__grid">
        <article>
          {economyHref ? (
            <a href={economyHref}>Model this player's skills in Economy Lab →</a>
          ) : (
            <span className="muted">
              Economy Lab link unavailable: player identifier is invalid.
            </span>
          )}
          <p>
            Reload the public economy snapshot and explore what-if scenarios.
            {snapshot.companies.length > 0
              ? " Without a chosen company, Economy Lab starts with the first listed company."
              : " No company is currently listed, so company-based modelling may be unavailable."}
          </p>
        </article>
        <article>
          {companyHref ? (
            <a href={companyHref}>Browse owned companies in Company Lab →</a>
          ) : (
            <span className="muted">
              Company Lab link unavailable: player identifier is invalid.
            </span>
          )}
          <p>
            {snapshot.companies.length > 0
              ? "Review a company's detailed public operations and upgrades, starting with its first listed record."
              : "See the missing-company state and search for another public player if needed."}
          </p>
        </article>
      </div>
      <p className="player-handoffs__note">
        These links carry public identifiers only. Each lab reloads its own available public data,
        not your current snapshot or any hypothetical scenario.
      </p>
    </section>
  );
}
