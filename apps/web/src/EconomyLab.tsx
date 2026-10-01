import type {
  CompanyUpgradeKey,
  EconomyPlannerContextResponse,
  EconomySkillKey,
  ProvenanceKind,
  PublicCompanySnapshot,
  PublicPlayerEconomySnapshot,
} from "@warera-lab/domain";
import { useMemo, useState } from "react";

import {
  createEconomyLabForm,
  evaluateEconomyLab,
  type EconomyLabFormState,
} from "./economy-lab-model.js";

const skillLabels: Record<EconomySkillKey, string> = {
  production: "Production",
  entrepreneurship: "Entrepreneurship",
  management: "Management",
  companies: "Companies",
};

const upgradeLabels: Record<CompanyUpgradeKey, string> = {
  automatedEngine: "Automated Engine",
  storage: "Storage",
  breakRoom: "Break Room",
};

function provenance(kind: ProvenanceKind) {
  return <span className={"provenance provenance--" + kind}>{kind}</span>;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

function updateForm(
  setForm: React.Dispatch<React.SetStateAction<EconomyLabFormState>>,
  updater: (current: EconomyLabFormState) => EconomyLabFormState,
) {
  setForm((current) => updater(current));
}

export function EconomyLab({
  player,
  company,
  context,
}: {
  player: PublicPlayerEconomySnapshot;
  company: PublicCompanySnapshot;
  context: EconomyPlannerContextResponse;
}) {
  const [form, setForm] = useState(() => createEconomyLabForm(player, company, context));
  const evaluation = useMemo(
    () => evaluateEconomyLab(player, company, context, form),
    [player, company, context, form],
  );

  return (
    <section className="economy-lab" aria-labelledby="economy-lab-title">
      <div className="workspace-heading">
        <div>
          <p className="section-kicker">Step 2 · hypothetical planning</p>
          <h2 id="economy-lab-title">Economy Lab</h2>
          <p className="muted">
            Editing these controls changes only the local hypothetical plan. Imported values stay
            intact.
          </p>
        </div>
        <span className="badge">Simulation only</span>
      </div>

      <div className="planner-grid">
        <section className="planner-panel" aria-labelledby="skill-planner-title">
          <div className="planner-heading">
            <div>
              <p className="section-kicker">Planner A</p>
              <h3 id="skill-planner-title">Economy skills</h3>
            </div>
            {evaluation.skillPlan ? (
              <span
                className={
                  evaluation.skillPlan.canApplyAllocation.value ? "badge" : "badge badge--warn"
                }
              >
                {evaluation.skillPlan.canApplyAllocation.value
                  ? "Valid allocation"
                  : "Needs attention"}
              </span>
            ) : null}
          </div>

          {evaluation.skillError ? (
            <p className="message message--error" role="alert">
              {evaluation.skillError}
            </p>
          ) : null}

          <div className="control-list">
            {(Object.keys(skillLabels) as EconomySkillKey[]).map((key) => {
              const currentLevel = player.skills[key].level;
              const levels = Object.values(context.skills[key].levels)
                .map((level) => level.level)
                .filter((level) => level >= currentLevel)
                .sort((a, b) => a - b);
              const entry = evaluation.skillPlan?.skills[key];

              return (
                <label className="planner-control" key={key}>
                  <span>
                    <strong>{skillLabels[key]}</strong>
                    <small>Observed level {currentLevel}</small>
                  </span>
                  <select
                    value={form.skillLevels[key]}
                    onChange={(event) =>
                      updateForm(setForm, (current) => ({
                        ...current,
                        skillLevels: { ...current.skillLevels, [key]: event.currentTarget.value },
                      }))
                    }
                  >
                    {levels.map((level) => (
                      <option key={level} value={level}>
                        Level {level}
                      </option>
                    ))}
                  </select>
                  {entry ? (
                    <span className="control-result">
                      value {formatNumber(entry.proposedConfiguredValue.value)}
                      {" · "}Δ {formatNumber(entry.valueDelta.value)}
                      {" · "}+{formatNumber(entry.additionalPointCost.value)} points{" "}
                      {provenance(entry.proposedLevel.provenance)}
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>

          {evaluation.skillPlan ? (
            <div className="result-strip">
              <span>
                Additional points{" "}
                <strong>
                  {formatNumber(evaluation.skillPlan.additionalSkillPointsRequired.value)}
                </strong>
              </span>
              <span>
                Remaining{" "}
                <strong>{formatNumber(evaluation.skillPlan.remainingSkillPoints.value)}</strong>
              </span>
              <span>
                Overspent{" "}
                <strong>{formatNumber(evaluation.skillPlan.overspentSkillPoints.value)}</strong>
              </span>
              <span>
                Unlocks{" "}
                <strong>
                  {evaluation.skillPlan.allUnlocksEligible.value ? "eligible" : "blocked"}
                </strong>
              </span>
            </div>
          ) : null}
        </section>

        <section className="planner-panel" aria-labelledby="upgrade-planner-title">
          <div className="planner-heading">
            <div>
              <p className="section-kicker">Planner B</p>
              <h3 id="upgrade-planner-title">Company upgrades</h3>
            </div>
            <span className="badge badge--observed">{company.name}</span>
          </div>

          {evaluation.upgradeError ? (
            <p className="message message--error" role="alert">
              {evaluation.upgradeError}
            </p>
          ) : null}

          <div className="control-list">
            {(Object.keys(upgradeLabels) as CompanyUpgradeKey[]).map((key) => {
              const config = context.companyUpgrades[key];
              const currentLevel = company.activeUpgradeLevels[key] ?? 0;
              const configuredLevels = [
                0,
                ...Object.values(config.levels).map((level) => level.level),
              ];
              const levels = [...new Set(configuredLevels)]
                .filter((level) => config.canDowngrade === true || level >= currentLevel)
                .sort((a, b) => a - b);
              const entry = evaluation.upgradePlan?.upgrades[key];

              return (
                <label className="planner-control" key={key}>
                  <span>
                    <strong>{upgradeLabels[key]}</strong>
                    <small>
                      Observed level {currentLevel}
                      {config.canDowngrade === true ? "" : " · downgrade not verified"}
                    </small>
                  </span>
                  <select
                    value={form.upgradeLevels[key]}
                    onChange={(event) =>
                      updateForm(setForm, (current) => ({
                        ...current,
                        upgradeLevels: {
                          ...current.upgradeLevels,
                          [key]: event.currentTarget.value,
                        },
                      }))
                    }
                  >
                    {levels.map((level) => (
                      <option key={level} value={level}>
                        Level {level}
                      </option>
                    ))}
                  </select>
                  {entry ? (
                    <span className="control-result">
                      steel Δ {formatNumber(entry.configuredSteelCostDelta.value)}
                      {entry.configuredConstructionPointsCostDelta
                        ? " · construction Δ " +
                          formatNumber(entry.configuredConstructionPointsCostDelta.value)
                        : ""}{" "}
                      {provenance(entry.proposedLevel.provenance)}
                    </span>
                  ) : null}
                  {entry && Object.keys(entry.configuredStats).length > 0 ? (
                    <span className="control-result">
                      {Object.entries(entry.configuredStats)
                        .map(([stat, comparison]) =>
                          comparison?.delta
                            ? stat + " Δ " + formatNumber(comparison.delta.value)
                            : stat + " configured",
                        )
                        .join(" · ")}
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>
        </section>

        <section
          className="planner-panel planner-panel--wide"
          aria-labelledby="market-planner-title"
        >
          <div className="planner-heading">
            <div>
              <p className="section-kicker">Planner C</p>
              <h3 id="market-planner-title">Market & margin</h3>
            </div>
            <span className="badge">{context.itemCode}</span>
          </div>

          {context.contextGaps.itemCodes.length > 0 ? (
            <p className="message message--error">
              The selected output item is absent from the normalized live game configuration.
            </p>
          ) : null}
          {context.contextGaps.marketPriceItemCodes.length > 0 ? (
            <p className="message message--warning">
              Missing live price references: {context.contextGaps.marketPriceItemCodes.join(", ")}.
              Add explicit input overrides where possible; the live output baseline is required.
            </p>
          ) : null}
          {evaluation.marketError ? (
            <p className="message message--error" role="alert">
              {evaluation.marketError}
            </p>
          ) : null}

          <div className="market-controls">
            <label>
              <span>Quantity {provenance("assumed")}</span>
              <input
                type="number"
                min="0"
                step="any"
                value={form.quantity}
                onChange={(event) =>
                  updateForm(setForm, (current) => ({
                    ...current,
                    quantity: event.currentTarget.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Output price override {provenance("overridden")}</span>
              <input
                type="number"
                min="0"
                step="any"
                placeholder={context.marketPrices[context.itemCode]?.toString() ?? "No live price"}
                value={form.outputPriceOverride}
                onChange={(event) =>
                  updateForm(setForm, (current) => ({
                    ...current,
                    outputPriceOverride: event.currentTarget.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Assumed labour cost {provenance("assumed")}</span>
              <input
                type="number"
                min="0"
                step="any"
                value={form.assumedLabourCostTotal}
                onChange={(event) =>
                  updateForm(setForm, (current) => ({
                    ...current,
                    assumedLabourCostTotal: event.currentTarget.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Other assumed cost {provenance("assumed")}</span>
              <input
                type="number"
                min="0"
                step="any"
                value={form.assumedOtherCostTotal}
                onChange={(event) =>
                  updateForm(setForm, (current) => ({
                    ...current,
                    assumedOtherCostTotal: event.currentTarget.value,
                  }))
                }
              />
            </label>
          </div>

          {context.item && Object.keys(context.item.productionNeeds).length > 0 ? (
            <div className="recipe-overrides">
              <h4>Recipe input prices</h4>
              <div className="market-controls">
                {Object.keys(context.item.productionNeeds).map((itemCode) => (
                  <label key={itemCode}>
                    <span>
                      {itemCode} override {provenance("overridden")}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder={
                        context.marketPrices[itemCode]?.toString() ?? "Required override"
                      }
                      value={form.inputPriceOverrides[itemCode] ?? ""}
                      onChange={(event) =>
                        updateForm(setForm, (current) => ({
                          ...current,
                          inputPriceOverrides: {
                            ...current.inputPriceOverrides,
                            [itemCode]: event.currentTarget.value,
                          },
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {evaluation.marketResult ? (
            <div className="margin-results" aria-label="Market margin result">
              <article>
                <span>Gross revenue {provenance("derived")}</span>
                <strong>{formatNumber(evaluation.marketResult.grossRevenue.value)}</strong>
              </article>
              <article>
                <span>Recipe input cost {provenance("derived")}</span>
                <strong>{formatNumber(evaluation.marketResult.recipeInputCost.value)}</strong>
              </article>
              <article>
                <span>Assumed costs {provenance("derived")}</span>
                <strong>
                  {formatNumber(evaluation.marketResult.explicitAssumedCostTotal.value)}
                </strong>
              </article>
              <article>
                <span>Gross margin {provenance("derived")}</span>
                <strong>{formatNumber(evaluation.marketResult.grossMargin.value)}</strong>
              </article>
              <article>
                <span>Margin / unit {provenance("derived")}</span>
                <strong>{formatNumber(evaluation.marketResult.marginPerUnit.value)}</strong>
              </article>
              <article>
                <span>Break-even price {provenance("derived")}</span>
                <strong>{formatNumber(evaluation.marketResult.breakEvenOutputPrice.value)}</strong>
              </article>
              <article>
                <span>Live output price {provenance("observed")}</span>
                <strong>
                  {formatNumber(evaluation.marketResult.liveOutputPriceBaseline.value)}
                </strong>
              </article>
              <article>
                <span>Margin Δ vs live price {provenance("derived")}</span>
                <strong>
                  {formatNumber(evaluation.marketResult.grossMarginDeltaVsLiveOutputPrice.value)}
                </strong>
              </article>
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}
