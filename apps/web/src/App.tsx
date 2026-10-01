import type {
  PublicCompanySnapshot,
  SnapshotFreshness,
  SnapshotFreshnessSource,
} from "@warera-lab/domain";
import { type FormEvent, useMemo, useReducer } from "react";

import { PublicApiClientError, getPlayerSnapshot, searchPlayers } from "./public-api.js";
import { initialWorkspaceState, workspaceReducer } from "./workspace-state.js";

const skillLabels = {
  production: "Production",
  entrepreneurship: "Entrepreneurship",
  management: "Management",
  companies: "Companies",
} as const;

const upgradeLabels = {
  automatedEngine: "Automated Engine",
  storage: "Storage",
  breakRoom: "Break Room",
} as const;

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

function freshnessLabel(source: SnapshotFreshnessSource): string {
  if (source.state === "live") return "Live";
  if (source.state === "cached") return "Cached";
  return "Stale";
}

function FreshnessPanel({ freshness, title }: { freshness: SnapshotFreshness; title: string }) {
  const titleId = title.toLowerCase() + "-freshness";
  return (
    <section className="freshness-panel" aria-labelledby={titleId}>
      <div className="section-heading">
        <div>
          <p className="section-kicker">Data provenance</p>
          <h3 id={titleId}>{title} freshness</h3>
        </div>
        <span className={freshness.hasStaleData ? "badge badge--warn" : "badge"}>
          {freshness.hasStaleData ? "Contains stale data" : "Current snapshot"}
        </span>
      </div>
      <p className="muted">Generated {formatTimestamp(freshness.generatedAt)}</p>
      {freshness.sources.length > 0 ? (
        <ul className="freshness-list">
          {freshness.sources.map((source, index) => (
            <li key={source.source + "-" + (source.subjectId ?? "global") + "-" + index}>
              <strong className={"freshness-state freshness-state--" + source.state}>
                {freshnessLabel(source)}
              </strong>
              <span>
                {source.source}
                {source.subjectId ? " · " + source.subjectId : ""}
              </span>
              <time dateTime={source.retrievedAt}>{formatTimestamp(source.retrievedAt)}</time>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No individual source timestamps were returned.</p>
      )}
    </section>
  );
}

function CompanyButton({
  company,
  selected,
  onSelect,
}: {
  company: PublicCompanySnapshot;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={"company-card" + (selected ? " company-card--selected" : "")}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <strong>{company.name}</strong>
      <span>
        {company.itemCode} · {company.workerCount ?? "—"} workers
      </span>
    </button>
  );
}

function describeClientError(error: unknown): string {
  if (!(error instanceof PublicApiClientError)) {
    return "Something unexpected happened. Your imported workspace has been preserved.";
  }
  if (error.code === "UPSTREAM_RATE_LIMITED" && error.retryAfterSeconds !== undefined) {
    return error.message + " Suggested retry: in about " + error.retryAfterSeconds + " seconds.";
  }
  return error.message;
}

export function App() {
  const [state, dispatch] = useReducer(workspaceReducer, initialWorkspaceState);
  const selectedCompany = useMemo(
    () =>
      state.snapshot?.companies.find((company) => company.id === state.selectedCompanyId) ??
      state.snapshot?.companies[0],
    [state.selectedCompanyId, state.snapshot],
  );

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = state.query.trim();
    if (query.length < 2) {
      dispatch({
        type: "search-failed",
        message: "Enter at least two characters to search for a public WarEra player.",
      });
      return;
    }

    dispatch({ type: "search-started" });
    try {
      const search = await searchPlayers(query);
      dispatch({ type: "search-succeeded", search });
    } catch (error) {
      dispatch({ type: "search-failed", message: describeClientError(error) });
    }
  }

  async function handleImport(playerId: string) {
    dispatch({ type: "import-started", playerId });
    try {
      const snapshot = await getPlayerSnapshot(playerId);
      dispatch({ type: "import-succeeded", snapshot });
    } catch (error) {
      dispatch({ type: "import-failed", message: describeClientError(error) });
    }
  }

  const playerCountry = state.snapshot?.countries[state.snapshot.player.countryId];
  const region = selectedCompany ? state.snapshot?.regions[selectedCompany.regionId] : undefined;
  const companyCountry = region ? state.snapshot?.countries[region.countryId] : undefined;

  return (
    <main className="shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="WarEra Lab home">
          <span className="brand-mark" aria-hidden="true">
            WL
          </span>
          <span>WarEra Lab</span>
        </a>
        <span className="status-pill">Public MVP · Economy Lab</span>
      </header>

      <section className="hero" id="top" aria-labelledby="warera-lab-title">
        <p className="eyebrow">ROCSI · independent open-source project</p>
        <h1 id="warera-lab-title">Import the present. Model the what-if.</h1>
        <p className="lede">
          Search a public WarEra player, inspect a normalized economy snapshot, and carry that
          observed state into transparent scenarios without credentials or in-game actions.
        </p>
      </section>

      <section className="search-panel" aria-labelledby="player-search-title">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Step 1 · public data</p>
            <h2 id="player-search-title">Find a player</h2>
          </div>
          <span className="badge">Documented API only</span>
        </div>

        <form className="search-form" onSubmit={handleSearch}>
          <label htmlFor="player-query">WarEra player name</label>
          <div className="search-row">
            <input
              id="player-query"
              type="search"
              minLength={2}
              maxLength={80}
              autoComplete="off"
              value={state.query}
              onChange={(event) =>
                dispatch({ type: "query-changed", query: event.currentTarget.value })
              }
              placeholder="Search by player name"
            />
            <button type="submit" disabled={state.isSearching}>
              {state.isSearching ? "Searching…" : "Search"}
            </button>
          </div>
          <p className="field-help">Same-origin public API only. No WarEra token is requested.</p>
        </form>

        {state.message ? (
          <p
            className={"message message--" + state.message.kind}
            role={state.message.kind === "error" ? "alert" : "status"}
          >
            {state.message.text}
          </p>
        ) : null}

        {state.search ? (
          <div className="results-block" aria-live="polite">
            <div className="results-heading">
              <h3>
                {state.search.matches.length}{" "}
                {state.search.matches.length === 1 ? "match" : "matches"}
              </h3>
              {state.search.truncated ? (
                <span className="badge badge--warn">More exist</span>
              ) : null}
            </div>
            {state.search.matches.length > 0 ? (
              <ul className="search-results">
                {state.search.matches.map((match) => (
                  <li key={match.id}>
                    <button
                      type="button"
                      className="result-button"
                      onClick={() => handleImport(match.id)}
                      disabled={state.isImporting}
                    >
                      <span>
                        <strong>{match.username}</strong>
                        <small>
                          Level {match.level} · country {match.countryId}
                        </small>
                      </span>
                      <span aria-hidden="true">
                        {state.isImporting && state.pendingPlayerId === match.id
                          ? "Importing…"
                          : "Import →"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <FreshnessPanel freshness={state.search.freshness} title="Search" />
          </div>
        ) : null}
      </section>

      {state.snapshot ? (
        <section className="workspace" aria-labelledby="workspace-title">
          <div className="workspace-heading">
            <div>
              <p className="section-kicker">Imported workspace</p>
              <h2 id="workspace-title">{state.snapshot.player.username}</h2>
              <p className="muted">
                Level {state.snapshot.player.level} ·{" "}
                {playerCountry?.name ?? state.snapshot.player.countryId}
              </p>
            </div>
            <span className="badge badge--observed">Observed snapshot</span>
          </div>

          {state.snapshot.freshness.hasStaleData ? (
            <p className="message message--warning" role="status">
              Some imported values are stale. They remain visible so the workspace never hides which
              data it is using.
            </p>
          ) : null}

          <div className="metric-grid" aria-label="Player economy summary">
            <article>
              <span>Available skill points</span>
              <strong>{state.snapshot.player.availableSkillPoints}</strong>
            </article>
            <article>
              <span>Spent skill points</span>
              <strong>{state.snapshot.player.spentSkillPoints}</strong>
            </article>
            <article>
              <span>Total skill points</span>
              <strong>{state.snapshot.player.totalSkillPoints}</strong>
            </article>
            <article>
              <span>Owned companies</span>
              <strong>{state.snapshot.companies.length}</strong>
            </article>
          </div>

          <div className="workspace-grid">
            <section className="workspace-panel" aria-labelledby="skills-title">
              <p className="section-kicker">Observed</p>
              <h3 id="skills-title">Economy skills</h3>
              <dl className="skill-list">
                {Object.entries(state.snapshot.player.skills).map(([key, skill]) => (
                  <div key={key}>
                    <dt>{skillLabels[key as keyof typeof skillLabels]}</dt>
                    <dd>
                      <strong>Level {skill.level}</strong>
                      <span>Configured value {skill.value}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="workspace-panel" aria-labelledby="companies-title">
              <p className="section-kicker">Choose context</p>
              <h3 id="companies-title">Companies</h3>
              {state.snapshot.companies.length > 0 ? (
                <div className="company-list">
                  {state.snapshot.companies.map((company) => (
                    <CompanyButton
                      key={company.id}
                      company={company}
                      selected={company.id === selectedCompany?.id}
                      onSelect={() => dispatch({ type: "company-selected", companyId: company.id })}
                    />
                  ))}
                </div>
              ) : (
                <p className="muted">No public company records were returned for this player.</p>
              )}
            </section>

            <section
              className="workspace-panel workspace-panel--wide"
              aria-labelledby="company-title"
            >
              <p className="section-kicker">Selected context</p>
              <h3 id="company-title">Company snapshot</h3>
              {selectedCompany ? (
                <div className="company-detail">
                  <div>
                    <span>Company</span>
                    <strong>{selectedCompany.name}</strong>
                    <small>{selectedCompany.itemCode}</small>
                  </div>
                  <div>
                    <span>Region</span>
                    <strong>{region?.name ?? selectedCompany.regionId}</strong>
                    <small>
                      {companyCountry?.name ?? region?.countryCode ?? "Context unavailable"}
                    </small>
                  </div>
                  <div>
                    <span>Observed production</span>
                    <strong>{selectedCompany.production ?? "—"}</strong>
                    <small>Public snapshot field</small>
                  </div>
                  <div>
                    <span>Workers</span>
                    <strong>{selectedCompany.workerCount ?? "—"}</strong>
                    <small>Public snapshot field</small>
                  </div>
                  <div className="upgrade-detail">
                    <span>Active upgrades</span>
                    {Object.entries(selectedCompany.activeUpgradeLevels).length > 0 ? (
                      <ul>
                        {Object.entries(selectedCompany.activeUpgradeLevels).map(([key, level]) => (
                          <li key={key}>
                            {upgradeLabels[key as keyof typeof upgradeLabels] ?? key}: level {level}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <strong>None reported</strong>
                    )}
                  </div>
                </div>
              ) : (
                <p className="muted">Select a company to inspect its imported context.</p>
              )}
            </section>
          </div>

          {state.snapshot.contextGaps.regionIds.length > 0 ||
          state.snapshot.contextGaps.countryIds.length > 0 ? (
            <p className="message message--warning" role="status">
              Some geographic context was unavailable. Missing regions:{" "}
              {state.snapshot.contextGaps.regionIds.length}; missing countries:{" "}
              {state.snapshot.contextGaps.countryIds.length}. No replacement values were invented.
            </p>
          ) : null}

          <FreshnessPanel freshness={state.snapshot.freshness} title="Snapshot" />
        </section>
      ) : (
        <section className="empty-workspace" aria-labelledby="workspace-preview-title">
          <p className="section-kicker">Next</p>
          <h2 id="workspace-preview-title">Economy Lab starts with an imported snapshot</h2>
          <p>
            Import a player to see economy skills, companies, selected company context, and source
            freshness. Scenario controls arrive in the next MVP slice.
          </p>
        </section>
      )}

      <footer>
        WarEra Lab is an independent community project and is not affiliated with, endorsed by, or
        operated by WarEra.
      </footer>
    </main>
  );
}
