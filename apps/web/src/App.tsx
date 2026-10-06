import type {
  EconomyPlannerContextResponse,
  PublicCompanySnapshot,
  PublicPlayerSnapshotResponse,
  SnapshotFreshness,
  SnapshotFreshnessSource,
} from "@warera-lab/domain";
import type { ScenarioDocumentV1 } from "@warera-lab/simulation-core";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import { CompanyLabShell } from "./CompanyLabShell.js";
import { CompanySelector } from "./CompanySelector.js";
import { ScenarioTransfer, ScenarioWorkspace } from "./ScenarioWorkspace.js";
import { formatDisplayNumber, formatOptionalDisplayNumber } from "./display-format.js";
import { describeCompany, type CompanyPresentation } from "./company-display.js";
import { buildLabHref, parseLabLocation, type LabId, type LabRoute } from "./lab-navigation.js";
import {
  PublicApiClientError,
  getEconomyContext,
  getPlayerSnapshot,
  searchPlayers,
} from "./public-api.js";
import {
  createWorkspaceScenarioDocument,
  importScenarioFragment,
  refreshWorkspaceScenarioDocument,
} from "./scenario-workspace-model.js";
import { initialWorkspaceState, workspaceReducer } from "./workspace-state.js";

const releaseVersion = import.meta.env.VITE_WARERA_LAB_VERSION;

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
  const counts = freshness.sources.reduce(
    (current, source) => ({ ...current, [source.state]: current[source.state] + 1 }),
    { live: 0, cached: 0, stale: 0 },
  );
  const summary = [
    counts.live > 0 ? `${counts.live} live` : undefined,
    counts.cached > 0 ? `${counts.cached} cached` : undefined,
    counts.stale > 0 ? `${counts.stale} stale` : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

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
      <p className="freshness-summary">
        Generated {formatTimestamp(freshness.generatedAt)}
        {freshness.sources.length > 0 ? ` · ${freshness.sources.length} sources · ${summary}` : ""}
      </p>
      {freshness.sources.length > 0 ? (
        <details className="provenance-details">
          <summary>View source details ({freshness.sources.length})</summary>
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
        </details>
      ) : (
        <p className="muted">No individual source timestamps were returned.</p>
      )}
    </section>
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
  const [initialLocation] = useState(() =>
    typeof window === "undefined"
      ? { route: { lab: "economy" as const } }
      : parseLabLocation(window.location.search),
  );
  const activeLab = initialLocation.route.lab;
  const [navigationMessage, setNavigationMessage] = useState(initialLocation.message);
  const initialRouteLoadStarted = useRef(false);
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
  const scenarioImportIsError =
    scenarioImportMessage !== undefined &&
    /malformed|invalid|exceeds|unsupported|could not/i.test(scenarioImportMessage);

  const replaceLabContext = useCallback(
    (playerId?: string, companyId?: string) => {
      if (typeof window === "undefined") return;
      const route: LabRoute = {
        lab: activeLab,
        ...(playerId ? { playerId } : {}),
        ...(playerId && companyId ? { companyId } : {}),
      };
      window.history.replaceState(window.history.state, "", buildLabHref(route, window.location));
    },
    [activeLab],
  );

  const establishScenarioDocument = useCallback(
    (
      snapshot: PublicPlayerSnapshotResponse,
      company: PublicCompanySnapshot,
      context: EconomyPlannerContextResponse,
      options: { preserveHypotheticals?: boolean } = {},
    ) => {
      const preserveHypotheticals = options.preserveHypotheticals ?? true;
      setScenarioDocument((current) =>
        preserveHypotheticals && current && scenarioCompanyId === company.id
          ? refreshWorkspaceScenarioDocument(current, snapshot, company, context)
          : createWorkspaceScenarioDocument(snapshot, company, context),
      );
      setScenarioCompanyId(company.id);
      setScenarioImportMessage(undefined);
      setScenarioSessionKey((current) => current + 1);
    },
    [scenarioCompanyId],
  );

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

  const loadEconomyContext = useCallback(
    async (itemCode: string): Promise<EconomyPlannerContextResponse | undefined> => {
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
    },
    [],
  );

  const importPlayerContext = useCallback(
    async (
      playerId: string,
      requestedCompanyId?: string,
      options: { attachScenario?: boolean; clearNavigationMessage?: boolean } = {},
    ) => {
      dispatch({ type: "import-started", playerId });
      if (options.clearNavigationMessage ?? true) setNavigationMessage(undefined);
      try {
        const snapshot = await getPlayerSnapshot(playerId);
        dispatch({ type: "import-succeeded", snapshot });

        const requestedCompany = requestedCompanyId
          ? snapshot.companies.find((company) => company.id === requestedCompanyId)
          : undefined;
        const targetCompany = requestedCompany ?? snapshot.companies[0];

        if (requestedCompanyId && !requestedCompany) {
          setNavigationMessage(
            targetCompany
              ? `The company from this link is no longer available. Switched to ${targetCompany.name}; choose another company if needed.`
              : "The company from this link is no longer available, and this player has no public companies to select.",
          );
        }

        if (targetCompany && targetCompany.id !== snapshot.companies[0]?.id) {
          dispatch({ type: "company-selected", companyId: targetCompany.id });
        }

        replaceLabContext(snapshot.player.id, targetCompany?.id);

        if (activeLab === "economy" && targetCompany) {
          const context = await loadEconomyContext(targetCompany.itemCode);
          if (context && (options.attachScenario ?? true)) {
            establishScenarioDocument(snapshot, targetCompany, context);
          }
        } else if (!targetCompany) {
          setScenarioCompanyId(undefined);
        }
      } catch (error) {
        dispatch({ type: "import-failed", message: describeClientError(error) });
      }
    },
    [activeLab, establishScenarioDocument, loadEconomyContext, replaceLabContext],
  );

  useEffect(() => {
    if (initialRouteLoadStarted.current) return;
    initialRouteLoadStarted.current = true;
    const { playerId, companyId } = initialLocation.route;
    if (!playerId) return;
    queueMicrotask(() => {
      void importPlayerContext(playerId, companyId, {
        attachScenario: initialScenario.document === undefined,
        clearNavigationMessage: false,
      });
    });
  }, [importPlayerContext, initialLocation.route, initialScenario.document]);

  async function handleImport(playerId: string) {
    await importPlayerContext(playerId, undefined, {
      attachScenario: true,
      clearNavigationMessage: true,
    });
  }

  async function handleCompanySelect(company: PublicCompanySnapshot) {
    dispatch({ type: "company-selected", companyId: company.id });
    setNavigationMessage(undefined);
    replaceLabContext(state.snapshot?.player.id, company.id);

    if (activeLab !== "economy") return;
    const context = await loadEconomyContext(company.itemCode);
    if (context && state.snapshot) {
      establishScenarioDocument(state.snapshot, company, context);
    }
  }

  async function handleRefreshSnapshot() {
    if (!state.snapshot || state.isRefreshing || state.isLoadingEconomyContext) return;

    const currentPlayerId = state.snapshot.player.id;
    const previousCompanyId = state.selectedCompanyId;
    dispatch({ type: "refresh-started" });

    try {
      const snapshot = await getPlayerSnapshot(currentPlayerId);
      const preservedCompany = previousCompanyId
        ? snapshot.companies.find((company) => company.id === previousCompanyId)
        : undefined;
      const targetCompany = preservedCompany ?? snapshot.companies[0];
      const context = targetCompany ? await getEconomyContext(targetCompany.itemCode) : undefined;
      const fellBack =
        previousCompanyId !== undefined &&
        targetCompany !== undefined &&
        targetCompany.id !== previousCompanyId;
      const canPreserveHypotheticals =
        targetCompany !== undefined &&
        targetCompany.id === previousCompanyId &&
        scenarioCompanyId === targetCompany.id &&
        scenarioDocument !== undefined &&
        scenarioDocument.scenarios.baseline.companyItemCode === targetCompany.itemCode &&
        scenarioDocument.scenarios.baseline.market?.itemCode === targetCompany.itemCode;

      const refreshMessage = fellBack
        ? `Snapshot refreshed. The previously selected company is no longer available; switched to ${targetCompany.name} and reset scenarios to its observed baseline.`
        : previousCompanyId !== undefined && targetCompany === undefined
          ? "Snapshot refreshed. The previously selected company is no longer available, and no replacement company was returned. The existing scenarios are now detached from live company context."
          : canPreserveHypotheticals
            ? "Snapshot and Economy context refreshed. Scenario A/B inputs were preserved."
            : targetCompany
              ? "Snapshot and Economy context refreshed. Scenarios were reset to the refreshed observed baseline."
              : "Snapshot refreshed. No company context was returned.";

      dispatch({
        type: "refresh-succeeded",
        snapshot,
        selectedCompanyId: targetCompany?.id,
        context,
        message: refreshMessage,
      });
      replaceLabContext(snapshot.player.id, targetCompany?.id);

      if (targetCompany && context) {
        establishScenarioDocument(snapshot, targetCompany, context, {
          preserveHypotheticals: canPreserveHypotheticals,
        });
      } else {
        setScenarioCompanyId(undefined);
      }
    } catch (error) {
      dispatch({ type: "refresh-failed", message: describeClientError(error) });
    }
  }

  const playerCountry = state.snapshot?.countries[state.snapshot.player.countryId];
  const companyPresentations = useMemo(
    () =>
      state.snapshot
        ? new Map(
            state.snapshot.companies.map((company) => [
              company.id,
              describeCompany(company, state.snapshot!),
            ]),
          )
        : new Map<string, CompanyPresentation>(),
    [state.snapshot],
  );
  const selectedCompanyPresentation = selectedCompany
    ? companyPresentations.get(selectedCompany.id)
    : undefined;
  const region = selectedCompany ? state.snapshot?.regions[selectedCompany.regionId] : undefined;
  const companyCountry = region ? state.snapshot?.countries[region.countryId] : undefined;
  const navigationPlayerId = state.snapshot?.player.id ?? initialLocation.route.playerId;
  const navigationCompanyId =
    selectedCompany?.id ??
    (navigationPlayerId === initialLocation.route.playerId
      ? initialLocation.route.companyId
      : undefined);
  const labHref = (lab: LabId) =>
    typeof window === "undefined"
      ? "/"
      : buildLabHref(
          {
            lab,
            ...(navigationPlayerId ? { playerId: navigationPlayerId } : {}),
            ...(navigationPlayerId && navigationCompanyId
              ? { companyId: navigationCompanyId }
              : {}),
          },
          window.location,
        );

  return (
    <main className="shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="WarEra Lab home">
          <span className="brand-mark" aria-hidden="true">
            WL
          </span>
          <span>WarEra Lab</span>
        </a>
        <div className="site-header__actions">
          <nav className="lab-navigation" aria-label="WarEra Lab modules">
            <a
              href={labHref("economy")}
              aria-current={activeLab === "economy" ? "page" : undefined}
            >
              Economy Lab
            </a>
            <a
              href={labHref("company")}
              aria-current={activeLab === "company" ? "page" : undefined}
            >
              Company Lab
            </a>
          </nav>
          <span className="status-pill">Public MVP</span>
        </div>
      </header>

      <section className="hero" id="top" aria-labelledby="warera-lab-title">
        <p className="eyebrow">ROCSI · independent open-source project</p>
        <h1 id="warera-lab-title">
          {activeLab === "economy"
            ? "Import the present. Model the what-if."
            : "Carry company context into a dedicated lab."}
        </h1>
        <p className="lede">
          {activeLab === "economy"
            ? "Search a public WarEra player, inspect a normalized economy snapshot, and carry that observed state into transparent scenarios without credentials or in-game actions."
            : "Company Lab now has a stable public entry point and reload-safe player/company selection. Detailed company analysis follows in the next focused releases."}
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
                      disabled={state.isImporting || state.isRefreshing}
                    >
                      <span>
                        <strong>{match.username}</strong>
                        <small>Level {match.level}</small>
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

      {activeLab === "economy" && navigationMessage ? (
        <p className="message message--warning" role="status">
          {navigationMessage}
        </p>
      ) : null}

      {activeLab === "economy" ? (
        <>
          <ScenarioTransfer
            document={scenarioDocument}
            onImport={(document) => handleScenarioImport(document)}
          />
          {scenarioImportMessage ? (
            <p
              className={scenarioImportIsError ? "message message--error" : "message"}
              role={scenarioImportIsError ? "alert" : "status"}
            >
              {scenarioImportMessage}
            </p>
          ) : null}
        </>
      ) : null}

      {activeLab === "company" ? (
        <CompanyLabShell
          snapshot={state.snapshot}
          selectedCompany={selectedCompany}
          companyPresentations={companyPresentations}
          navigationMessage={navigationMessage}
          isBusy={state.isImporting || state.isRefreshing}
          onCompanySelect={(company) => void handleCompanySelect(company)}
        />
      ) : state.snapshot ? (
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
            <div className="workspace-header-actions">
              <span className="badge badge--observed">Observed snapshot</span>
              <button
                type="button"
                className="refresh-button"
                onClick={() => void handleRefreshSnapshot()}
                disabled={state.isRefreshing || state.isImporting || state.isLoadingEconomyContext}
              >
                {state.isRefreshing ? "Refreshing…" : "Refresh snapshot"}
              </button>
            </div>
          </div>

          {state.refreshMessage ? (
            <p
              className={
                state.refreshMessage.kind === "error"
                  ? "message message--error"
                  : "message message--refresh"
              }
              role={state.refreshMessage.kind === "error" ? "alert" : "status"}
            >
              {state.refreshMessage.text}
            </p>
          ) : null}

          {state.snapshot.freshness.hasStaleData ? (
            <p className="message message--warning" role="status">
              Some imported values are stale. They remain visible so the workspace never hides which
              data it is using.
            </p>
          ) : null}

          <div className="metric-grid" aria-label="Player economy summary">
            <article>
              <span>Available skill points</span>
              <strong>
                {formatDisplayNumber(state.snapshot.player.availableSkillPoints, "points")}
              </strong>
            </article>
            <article>
              <span>Spent skill points</span>
              <strong>
                {formatDisplayNumber(state.snapshot.player.spentSkillPoints, "points")}
              </strong>
            </article>
            <article>
              <span>Total skill points</span>
              <strong>
                {formatDisplayNumber(state.snapshot.player.totalSkillPoints, "points")}
              </strong>
            </article>
            <article>
              <span>Owned companies</span>
              <strong>{formatDisplayNumber(state.snapshot.companies.length, "integer")}</strong>
            </article>
          </div>

          <div className="workspace-grid">
            <section className="workspace-panel" aria-labelledby="skills-title">
              <p className="section-kicker">Observed</p>
              <h3 id="skills-title">Observed economy skills</h3>
              <dl className="skill-list">
                {Object.entries(state.snapshot.player.skills).map(([key, skill]) => (
                  <div key={key}>
                    <dt>{skillLabels[key as keyof typeof skillLabels]}</dt>
                    <dd>
                      <strong>Level {skill.level}</strong>
                      <span>Configured value {formatDisplayNumber(skill.value, "number")}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="workspace-panel" aria-labelledby="companies-title">
              <p className="section-kicker">Choose context</p>
              <h3 id="companies-title">Companies</h3>
              <CompanySelector
                companies={state.snapshot.companies}
                presentations={companyPresentations}
                selectedCompanyId={selectedCompany?.id}
                onSelect={(company) => void handleCompanySelect(company)}
                disabled={state.isRefreshing}
              />
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
                    <small>
                      {selectedCompany.itemCode}
                      {selectedCompanyPresentation?.fallbackId
                        ? " · ID " + selectedCompanyPresentation.fallbackId
                        : ""}
                    </small>
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
                    <strong>
                      {formatOptionalDisplayNumber(selectedCompany.production, "production")}
                    </strong>
                    <small>Public snapshot field</small>
                  </div>
                  <div>
                    <span>Workers</span>
                    <strong>
                      {formatOptionalDisplayNumber(selectedCompany.workerCount, "integer")}
                    </strong>
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

      {activeLab === "economy" && scenarioDocument ? (
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

      <footer className="site-footer">
        <div className="footer-summary">
          <div className="footer-title">
            <strong>WarEra Lab</strong>
            <span className="footer-version" aria-label={"Production release " + releaseVersion}>
              {releaseVersion}
            </span>
          </div>
          <p>
            Independent open-source analysis and simulation by ROCSI. Not affiliated with, endorsed
            by, sponsored by, or operated by WarEra.
          </p>
        </div>
        <nav className="footer-links" aria-label="Project links">
          <a href="https://github.com/ROCSI-eu/warera-lab">GitHub repository</a>
          <a href="https://github.com/ROCSI-eu/warera-lab/blob/main/CHANGELOG.md">Changelog</a>
          <a href="https://rocsi.eu/">ROCSI website</a>
          <a href="https://github.com/ROCSI-eu/warera-lab/blob/main/LICENSE">AGPL-3.0 license</a>
          <a href="https://github.com/ROCSI-eu/warera-lab/blob/main/NOTICE.md">Notices</a>
        </nav>
      </footer>
    </main>
  );
}
