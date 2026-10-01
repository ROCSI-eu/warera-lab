import type {
  EconomyPlannerContextResponse,
  PublicCompanySnapshot,
  PublicPlayerSnapshotResponse,
  SnapshotFreshness,
  SnapshotFreshnessSource,
} from "@warera-lab/domain";
import type { ScenarioDocumentV1 } from "@warera-lab/simulation-core";
import { type FormEvent, useMemo, useReducer, useState } from "react";

import { ScenarioTransfer, ScenarioWorkspace } from "./ScenarioWorkspace.js";
import {
  PublicApiClientError,
  getEconomyContext,
  getPlayerSnapshot,
  searchPlayers,
} from "./public-api.js";
import {
  createWorkspaceScenarioDocument,
  importScenarioFragment,
} from "./scenario-workspace-model.js";
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

function initialScenarioFromLocation(): {
  document?: ScenarioDocumentV1;
  message?: string;
} {
  if (typeof window === "undefined") return {};
  const imported = importScenarioFragment(window.location.hash);
  if (imported.document) {
    return {
      document: imported.document,
      message: "Shared scenario imported from the URL. No live player lookup was performed.",
    };
  }
  return imported.error === undefined ? {} : { message: imported.error };
}

export function App() {
  const [state, dispatch] = useReducer(workspaceReducer, initialWorkspaceState);
  const [initialScenario] = useState(initialScenarioFromLocation);
  const [scenarioDocument, setScenarioDocument] = useState<ScenarioDocumentV1 | undefined>(
    initialScenario.document,
  );
  const [scenarioCompanyId, setScenarioCompanyId] = useState<string>();
  const [scenarioImportMessage, setScenarioImportMessage] = useState<string | undefined>(
    initialScenario.message,
  );
  const [scenarioSessionKey, setScenarioSessionKey] = useState(
    initialScenario.document === undefined ? 0 : 1,
  );
  const selectedCompany = useMemo(
    () =>
      state.snapshot?.companies.find((company) => company.id === state.selectedCompanyId) ??
      state.snapshot?.companies[0],
    [state.selectedCompanyId, state.snapshot],
  );

  function establishScenarioDocument(
    snapshot: PublicPlayerSnapshotResponse,
    company: PublicCompanySnapshot,
    context: EconomyPlannerContextResponse,
  ) {
    setScenarioDocument(createWorkspaceScenarioDocument(snapshot, company, context));
    setScenarioCompanyId(company.id);
    setScenarioImportMessage(undefined);
    setScenarioSessionKey((current) => current + 1);
  }

  function handleScenarioImport(document: ScenarioDocumentV1) {
    setScenarioDocument(document);
    setScenarioCompanyId(undefined);
    setScenarioImportMessage(
      "Portable scenario loaded without attaching or looking up a live player workspace.",
    );
    setScenarioSessionKey((current) => current + 1);
  }

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

  async function loadEconomyContext(
    itemCode: string,
  ): Promise<EconomyPlannerContextResponse | undefined> {
    dispatch({ type: "economy-context-started", itemCode });
    try {
      const context = await getEconomyContext(itemCode);
      dispatch({ type: "economy-context-succeeded", itemCode, context });
      return context;
    } catch (error) {
      dispatch({
        type: "economy-context-failed",
        itemCode,
        message: describeClientError(error),
      });
      return undefined;
    }
  }

  async function handleImport(playerId: string) {
    dispatch({ type: "import-started", playerId });
    try {
      const snapshot = await getPlayerSnapshot(playerId);
      dispatch({ type: "import-succeeded", snapshot });
      const firstCompany = snapshot.companies[0];
      if (firstCompany) {
        const context = await loadEconomyContext(firstCompany.itemCode);
        if (context) establishScenarioDocument(snapshot, firstCompany, context);
      } else {
        setScenarioCompanyId(undefined);
      }
    } catch (error) {
      dispatch({ type: "import-failed", message: describeClientError(error) });
    }
  }

  async function handleCompanySelect(company: PublicCompanySnapshot) {
    dispatch({ type: "company-selected", companyId: company.id });
    const context = await loadEconomyContext(company.itemCode);
    if (context && state.snapshot) {
      establishScenarioDocument(state.snapshot, company, context);
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

      <ScenarioTransfer
        document={scenarioDocument}
        onImport={(document) => handleScenarioImport(document)}
      />
      {scenarioImportMessage ? (
        <p
          className={
            scenarioImportMessage.toLowerCase().includes("could not") ||
            scenarioImportMessage.toLowerCase().includes("exceeds") ||
            scenarioImportMessage.toLowerCase().includes("unsupported")
              ? "message message--error"
              : "message"
          }
          role="status"
        >
          {scenarioImportMessage}
        </p>
      ) : null}

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
                      onSelect={() => void handleCompanySelect(company)}
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

          {state.isLoadingEconomyContext ? (
            <p className="message" role="status">
              Loading live Economy Lab configuration and relevant market references…
            </p>
          ) : null}

          {selectedCompany &&
          state.economyContext &&
          state.economyContextItemCode === selectedCompany.itemCode ? (
            <FreshnessPanel freshness={state.economyContext.freshness} title="Economy context" />
          ) : null}
        </section>
      ) : (
        <section className="empty-workspace" aria-labelledby="workspace-preview-title">
          <p className="section-kicker">Next</p>
          <h2 id="workspace-preview-title">Economy Lab starts with an imported snapshot</h2>
          <p>
            Import a player to see economy skills, companies, selected company context, and source
            freshness. You can also import a portable scenario without attaching a player.
          </p>
        </section>
      )}

      {scenarioDocument ? (
        <ScenarioWorkspace
          key={scenarioSessionKey}
          document={scenarioDocument}
          onDocumentChange={(document) => setScenarioDocument(document)}
          snapshot={
            scenarioCompanyId !== undefined && scenarioCompanyId === selectedCompany?.id
              ? state.snapshot
              : undefined
          }
          company={
            scenarioCompanyId !== undefined && scenarioCompanyId === selectedCompany?.id
              ? selectedCompany
              : undefined
          }
          context={
            scenarioCompanyId !== undefined &&
            scenarioCompanyId === selectedCompany?.id &&
            state.economyContextItemCode === selectedCompany?.itemCode
              ? state.economyContext
              : undefined
          }
        />
      ) : null}

      <footer>
        WarEra Lab is an independent community project and is not affiliated with, endorsed by, or
        operated by WarEra.
      </footer>
    </main>
  );
}
