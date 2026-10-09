import {
  economySkillKeys,
  type EconomySkillKey,
  type PublicPlayerSnapshotResponse,
} from "@warera-lab/domain";

import { formatDisplayNumber } from "./display-format.js";
import { FreshnessPanel } from "./FreshnessPanel.js";

const skillLabels: Record<EconomySkillKey, string> = {
  production: "Production",
  entrepreneurship: "Entrepreneurship",
  management: "Management",
  companies: "Companies",
};

export function PlayerProfile({ snapshot }: { snapshot: PublicPlayerSnapshotResponse }) {
  const { player } = snapshot;
  const country = snapshot.countries[player.countryId];
  const missingGeography =
    !country ||
    snapshot.contextGaps.countryIds.length > 0 ||
    snapshot.contextGaps.regionIds.length > 0;

  return (
    <div className="player-profile">
      <div className="player-profile__identity" aria-label="Public player identity">
        <div>
          <span>Country</span>
          <strong>{country?.name ?? "Country unavailable"}</strong>
        </div>
        <div>
          <span>Player level</span>
          <strong>{formatDisplayNumber(player.level, "integer")}</strong>
        </div>
      </div>

      <div
        className="metric-grid player-profile__metrics"
        aria-label="Observed skill points and owned companies"
      >
        <article>
          <span>Available skill points</span>
          <strong>{formatDisplayNumber(player.availableSkillPoints, "points")}</strong>
        </article>
        <article>
          <span>Spent skill points</span>
          <strong>{formatDisplayNumber(player.spentSkillPoints, "points")}</strong>
        </article>
        <article>
          <span>Total skill points</span>
          <strong>{formatDisplayNumber(player.totalSkillPoints, "points")}</strong>
        </article>
        <article>
          <span>Listed owned companies</span>
          <strong>{formatDisplayNumber(snapshot.companies.length, "integer")}</strong>
        </article>
      </div>
      <p className="player-profile__clarification muted">
        Company count reflects this public snapshot, not whether any company is active.
      </p>
      <section
        className="workspace-panel player-profile__skills"
        aria-labelledby="player-skills-title"
      >
        <div className="section-heading">
          <div>
            <p className="section-kicker">Reported public values · not a scenario</p>
            <h3 id="player-skills-title">Observed economy skills</h3>
          </div>
          <span className="badge badge--observed">Observed</span>
        </div>
        <dl className="skill-list">
          {economySkillKeys.map((key) => {
            const skill = player.skills[key];
            return (
              <div key={key}>
                <dt>{skillLabels[key]}</dt>
                <dd>
                  <strong>Level {formatDisplayNumber(skill.level, "integer")}</strong>
                  <span>
                    Reported value {formatDisplayNumber(skill.value, "number")} · Total{" "}
                    {formatDisplayNumber(skill.total, "number")}
                  </span>
                </dd>
              </div>
            );
          })}
        </dl>
      </section>

      {missingGeography ? (
        <p className="message message--warning" role="status">
          Some geographic context is unavailable in the public snapshot. Missing names have not been
          inferred.
        </p>
      ) : null}
      <FreshnessPanel freshness={snapshot.freshness} title="Player snapshot" />
    </div>
  );
}
