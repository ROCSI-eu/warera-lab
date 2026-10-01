import type {
  EconomyPlannerContextResponse,
  PublicCompanySnapshot,
  PublicPlayerSnapshotResponse,
} from "@warera-lab/domain";
import {
  ScenarioModelError,
  encodeScenarioFragment,
  parseScenarioJson,
  serializeScenarioJson,
  type ScenarioChangeV1,
  type ScenarioDocumentV1,
} from "@warera-lab/simulation-core";
import { useMemo, useState } from "react";

import { EconomyLab } from "./EconomyLab.js";
import type { EconomyLabFormState } from "./economy-lab-model.js";
import {
  buildScenarioComparisons,
  evaluateScenario,
  formToScenario,
  replaceScenario,
  scenarioChangesForPair,
  scenarioToForm,
  type ScenarioSlot,
} from "./scenario-workspace-model.js";

const slotLabels: Record<ScenarioSlot, string> = {
  baseline: "Baseline",
  scenarioA: "Scenario A",
  scenarioB: "Scenario B",
};

type ComparisonPair = "baselineToA" | "baselineToB" | "scenarioAToB";

const pairLabels: Record<ComparisonPair, string> = {
  baselineToA: "Baseline → A",
  baselineToB: "Baseline → B",
  scenarioAToB: "A → B",
};

function formatValue(value: string | number | undefined): string {
  if (value === undefined) return "—";
  if (typeof value === "number") {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
  }
  return value;
}

function readablePath(path: string): string {
  return path
    .replace(/^skills\./, "Skill · ")
    .replace(/^companyUpgrades\./, "Upgrade · ")
    .replace(/^market\./, "Market · ")
    .replace(/^companyItemCode$/, "Company item")
    .replaceAll(".", " · ");
}

function ScenarioInputSummary({ changes }: { changes: ScenarioChangeV1[] }) {
  if (changes.length === 0) {
    return <p className="muted">No scenario inputs differ for this comparison.</p>;
  }

  return (
    <ul className="comparison-list">
      {changes.map((change) => (
        <li key={change.path}>
          <strong>{readablePath(change.path)}</strong>
          <span>
            {formatValue(change.from)} → {formatValue(change.to)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ScenarioTransfer({
  document,
  onImport,
}: {
  document?: ScenarioDocumentV1 | undefined;
  onImport: (document: ScenarioDocumentV1, source: "json" | "fragment") => void;
}) {
  const [includeIdentity, setIncludeIdentity] = useState(false);
  const [importText, setImportText] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const exportedJson = useMemo(() => {
    if (!document) return "";
    try {
      return serializeScenarioJson(document, {
        includeSourcePlayerIdentity: includeIdentity,
      });
    } catch (caught) {
      return caught instanceof Error ? caught.message : "Scenario export failed.";
    }
  }, [document, includeIdentity]);

  const shareFragment = useMemo(() => {
    if (!document) return "";
    try {
      return encodeScenarioFragment(document, {
        includeSourcePlayerIdentity: includeIdentity,
      });
    } catch {
      return "";
    }
  }, [document, includeIdentity]);

  function importJson() {
    setError(undefined);
    setMessage(undefined);
    try {
      const parsed = parseScenarioJson(importText);
      onImport(parsed, "json");
      setMessage("Scenario JSON imported successfully. No live player lookup was performed.");
    } catch (caught) {
      setError(
        caught instanceof ScenarioModelError
          ? caught.message
          : "Scenario JSON could not be imported safely.",
      );
    }
  }

  async function copyShareLink() {
    if (!document || shareFragment === "") {
      setError("This scenario is too large or invalid for URL-fragment sharing.");
      return;
    }

    window.history.replaceState(null, "", shareFragment);
    const shareUrl = window.location.href;
    setError(undefined);
    try {
      await navigator.clipboard.writeText(shareUrl);
      setMessage("Share link copied. The scenario is encoded only in the URL fragment.");
    } catch {
      setMessage("Share link is ready in the address bar. The scenario remains client-side only.");
    }
  }

  function exportJson() {
    if (!document || exportedJson === "") return;
    const blobUrl = URL.createObjectURL(new Blob([exportedJson], { type: "application/json" }));
    const link = window.document.createElement("a");
    link.href = blobUrl;
    link.download = "warera-lab-scenario.json";
    link.click();
    URL.revokeObjectURL(blobUrl);
    setError(undefined);
    setMessage("Scenario JSON exported.");
  }

  return (
    <section className="transfer-panel" aria-labelledby="scenario-transfer-title">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Portable scenarios</p>
          <h2 id="scenario-transfer-title">Import, export & share</h2>
        </div>
        <span className="badge">No server persistence</span>
      </div>

      <p className="transfer-intro">
        Move a scenario between browsers without an account. Player identity stays excluded unless
        you explicitly include it.
      </p>

      <div className="transfer-actions" aria-label="Scenario transfer actions">
        <button
          type="button"
          onClick={() => void copyShareLink()}
          disabled={!document || !shareFragment}
        >
          Copy share link
        </button>
        <button type="button" onClick={exportJson} disabled={!document || exportedJson === ""}>
          Export JSON
        </button>
        <button type="button" onClick={() => setAdvancedOpen(true)}>
          Import scenario
        </button>
      </div>

      <label className="identity-choice">
        <input
          type="checkbox"
          checked={includeIdentity}
          onChange={(event) => setIncludeIdentity(event.currentTarget.checked)}
          disabled={!document?.source?.player}
        />
        Include source player identity in this export/share
      </label>

      <details
        className="advanced-details"
        open={advancedOpen}
        onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
      >
        <summary>Advanced scenario data</summary>
        <div className="advanced-details__body">
          <p className="field-help">
            Raw serialization is available for inspection and manual transfer. Editing these values
            does not bypass scenario validation.
          </p>

          {document ? (
            <div className="transfer-grid">
              <label>
                <span>JSON export</span>
                <textarea readOnly value={exportedJson} rows={7} />
              </label>
              <div className="share-box">
                <strong>URL fragment</strong>
                <code tabIndex={0} aria-label="Scenario URL fragment">
                  {shareFragment || "Scenario exceeds the share boundary."}
                </code>
              </div>
            </div>
          ) : null}

          <label className="scenario-import">
            <span>Import scenario JSON</span>
            <textarea
              value={importText}
              onChange={(event) => setImportText(event.currentTarget.value)}
              rows={7}
              placeholder='{"version":"warera-lab-scenario-v1",...}'
            />
          </label>
          <button type="button" onClick={importJson} disabled={importText.trim() === ""}>
            Import JSON
          </button>
        </div>
      </details>

      {message ? (
        <p className="message" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="message message--error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

export function ScenarioWorkspace({
  document,
  onDocumentChange,
  snapshot,
  company,
  context,
}: {
  document: ScenarioDocumentV1;
  onDocumentChange: (document: ScenarioDocumentV1) => void;
  snapshot?: PublicPlayerSnapshotResponse | undefined;
  company?: PublicCompanySnapshot | undefined;
  context?: EconomyPlannerContextResponse | undefined;
}) {
  const [activeSlot, setActiveSlot] = useState<ScenarioSlot>("scenarioA");
  const [comparisonPair, setComparisonPair] = useState<ComparisonPair>("baselineToA");
  const [drafts, setDrafts] = useState<Record<ScenarioSlot, EconomyLabFormState>>(() => ({
    baseline: scenarioToForm(document.scenarios.baseline, context),
    scenarioA: scenarioToForm(document.scenarios.scenarioA, context),
    scenarioB: scenarioToForm(document.scenarios.scenarioB, context),
  }));
  const [draftError, setDraftError] = useState<string>();

  const evaluations = useMemo(
    () => ({
      baseline: evaluateScenario("baseline", document, snapshot, company, context),
      scenarioA: evaluateScenario("scenarioA", document, snapshot, company, context),
      scenarioB: evaluateScenario("scenarioB", document, snapshot, company, context),
    }),
    [document, snapshot, company, context],
  );

  const comparisons = useMemo(
    () => buildScenarioComparisons(document, evaluations),
    [document, evaluations],
  );

  const activeState = document.scenarios[activeSlot];
  const activeItemCode = activeState.companyItemCode ?? activeState.market?.itemCode;
  const canEvaluate =
    snapshot !== undefined &&
    company !== undefined &&
    context !== undefined &&
    activeItemCode === company.itemCode;
  const currentContextChanged =
    context !== undefined &&
    document.config.revision !== undefined &&
    document.config.revision !== context.configRevision;

  function changeDraft(next: EconomyLabFormState) {
    setDrafts((current) => ({ ...current, [activeSlot]: next }));
    if (activeSlot === "baseline") return;
    if (!activeItemCode) {
      setDraftError("This scenario has no company item code.");
      return;
    }

    try {
      const state = formToScenario(next, activeItemCode);
      onDocumentChange(replaceScenario(document, activeSlot, state));
      setDraftError(undefined);
    } catch (caught) {
      setDraftError(caught instanceof Error ? caught.message : "Scenario input is invalid.");
    }
  }

  const inputChanges = scenarioChangesForPair(comparisons.inputs, comparisonPair).changes;
  const derived = comparisons.derived[comparisonPair];

  return (
    <section className="scenario-workspace" aria-labelledby="scenario-workspace-title">
      <div className="workspace-heading">
        <div>
          <p className="section-kicker">Step 3 · compare and explain</p>
          <h2 id="scenario-workspace-title">Scenario workspace</h2>
          <p className="muted">
            Baseline is stable. Scenario A and Scenario B are independent hypothetical states.
          </p>
        </div>
        <span className="badge">Versioned document</span>
      </div>

      {currentContextChanged ? (
        <p className="message message--warning" role="status">
          Live game configuration has changed since this scenario document was established. Inputs
          are preserved; displayed calculations use the currently loaded configuration.
        </p>
      ) : null}

      <div className="scenario-tabs" role="group" aria-label="Scenario selection">
        {(Object.keys(slotLabels) as ScenarioSlot[]).map((slot) => (
          <button
            key={slot}
            type="button"
            aria-pressed={activeSlot === slot}
            className={activeSlot === slot ? "scenario-tab scenario-tab--active" : "scenario-tab"}
            onClick={() => setActiveSlot(slot)}
          >
            {slotLabels[slot]}
          </button>
        ))}
      </div>

      {canEvaluate && snapshot && company && context ? (
        <EconomyLab
          player={snapshot.player}
          company={company}
          context={context}
          form={drafts[activeSlot]}
          onFormChange={changeDraft}
          readOnly={activeSlot === "baseline"}
        />
      ) : (
        <div className="scenario-input-card">
          <h3>{slotLabels[activeSlot]} inputs</h3>
          <p className="muted">
            {evaluations[activeSlot].unavailableReason ??
              "Live evaluation is not available for this scenario."}
          </p>
          <pre>{JSON.stringify(activeState, null, 2)}</pre>
        </div>
      )}

      {draftError ? (
        <p className="message message--error" role="alert">
          {draftError}
        </p>
      ) : null}

      <section className="comparison-panel" aria-labelledby="scenario-comparison-title">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Change-focused</p>
            <h3 id="scenario-comparison-title">Comparison</h3>
          </div>
          <select
            aria-label="Comparison pair"
            value={comparisonPair}
            onChange={(event) => setComparisonPair(event.currentTarget.value as ComparisonPair)}
          >
            {(Object.keys(pairLabels) as ComparisonPair[]).map((pair) => (
              <option key={pair} value={pair}>
                {pairLabels[pair]}
              </option>
            ))}
          </select>
        </div>

        <ScenarioInputSummary changes={inputChanges} />

        <div className="derived-comparison" aria-label="Derived output changes">
          <article>
            <span>Skill points required Δ</span>
            <strong>{formatValue(derived.skillPointDelta)}</strong>
          </article>
          <article>
            <span>Remaining skill points Δ</span>
            <strong>{formatValue(derived.remainingSkillPointDelta)}</strong>
          </article>
          <article>
            <span>Upgrade steel cost Δ</span>
            <strong>{formatValue(derived.upgradeSteelCostDelta)}</strong>
          </article>
          <article>
            <span>Gross margin Δ</span>
            <strong>{formatValue(derived.grossMarginDelta)}</strong>
          </article>
          <article>
            <span>Margin / unit Δ</span>
            <strong>{formatValue(derived.marginPerUnitDelta)}</strong>
          </article>
          <article>
            <span>Break-even price Δ</span>
            <strong>{formatValue(derived.breakEvenPriceDelta)}</strong>
          </article>
        </div>
        {derived.note ? <p className="muted">{derived.note}</p> : null}
      </section>

      <details className="calculation-details">
        <summary>How is this calculated?</summary>
        <div>
          <p>
            Scenario inputs are evaluated by the versioned pure calculation modules. Observed live
            values, explicit overrides, assumptions, and derived outputs keep textual provenance.
          </p>

          <h4>Active scenario</h4>
          <dl className="calculation-summary">
            <div>
              <dt>Scenario</dt>
              <dd>{slotLabels[activeSlot]}</dd>
            </div>
            <div>
              <dt>Company item</dt>
              <dd>{activeState.companyItemCode ?? activeState.market?.itemCode ?? "not set"}</dd>
            </div>
            <div>
              <dt>Skill levels</dt>
              <dd>
                Production {activeState.skills.production} · Entrepreneurship{" "}
                {activeState.skills.entrepreneurship} · Management {activeState.skills.management} ·
                Companies {activeState.skills.companies}
              </dd>
            </div>
            <div>
              <dt>Company upgrades</dt>
              <dd>
                Automated Engine {activeState.companyUpgrades.automatedEngine} · Storage{" "}
                {activeState.companyUpgrades.storage} · Break Room{" "}
                {activeState.companyUpgrades.breakRoom}
              </dd>
            </div>
            <div>
              <dt>Market quantity</dt>
              <dd>{formatValue(activeState.market?.quantity)}</dd>
            </div>
            <div>
              <dt>Output price override</dt>
              <dd>{formatValue(activeState.market?.outputPriceOverride)}</dd>
            </div>
          </dl>

          {context ? (
            <>
              <h4>Current live references</h4>
              <dl className="calculation-summary">
                <div>
                  <dt>Item context</dt>
                  <dd>{context.itemCode}</dd>
                </div>
                <div>
                  <dt>Live output price</dt>
                  <dd>{formatValue(context.marketPrices[context.itemCode])}</dd>
                </div>
                <div>
                  <dt>Recipe inputs</dt>
                  <dd>
                    {Object.keys(context.item?.productionNeeds ?? {}).length === 0
                      ? "No recipe inputs reported"
                      : Object.entries(context.item?.productionNeeds ?? {})
                          .map(([itemCode, quantity]) => itemCode + " × " + formatValue(quantity))
                          .join(" · ")}
                  </dd>
                </div>
                <div>
                  <dt>Reference freshness</dt>
                  <dd>
                    {context.freshness.hasStaleData ? "Contains stale data" : "Current snapshot"} ·{" "}
                    {context.freshness.sources.length}{" "}
                    {context.freshness.sources.length === 1 ? "source" : "sources"}
                  </dd>
                </div>
              </dl>
            </>
          ) : null}

          <h4>Calculation versions</h4>
          <dl>
            <div>
              <dt>Skill planner</dt>
              <dd>{document.calculationVersions.skillPlanner}</dd>
            </div>
            <div>
              <dt>Upgrade planner</dt>
              <dd>{document.calculationVersions.companyUpgradePlanner}</dd>
            </div>
            <div>
              <dt>Market simulator</dt>
              <dd>{document.calculationVersions.marketMarginSimulator}</dd>
            </div>
            <div>
              <dt>Market comparison</dt>
              <dd>{document.calculationVersions.marketMarginComparison}</dd>
            </div>
            <div>
              <dt>Config revision</dt>
              <dd>{document.config.revision ?? "not recorded"}</dd>
            </div>
            <div>
              <dt>Config retrieved</dt>
              <dd>{document.config.retrievedAt ?? "not recorded"}</dd>
            </div>
            <div>
              <dt>Snapshot retrieved</dt>
              <dd>{document.source?.snapshotRetrievedAt ?? "not recorded"}</dd>
            </div>
          </dl>

          <details className="raw-details">
            <summary>Raw calculation inputs and references</summary>
            <div>
              <h4>Scenario inputs</h4>
              <pre>{JSON.stringify(activeState, null, 2)}</pre>
              {context ? (
                <>
                  <h4>Live references</h4>
                  <pre>
                    {JSON.stringify(
                      {
                        itemCode: context.itemCode,
                        recipe: context.item?.productionNeeds ?? {},
                        marketPrices: context.marketPrices,
                        configRevision: context.configRevision,
                        freshness: context.freshness,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </>
              ) : null}
            </div>
          </details>
        </div>
      </details>
    </section>
  );
}
