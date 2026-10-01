import type { ProvenanceKind } from "@warera-lab/domain";

export interface ScenarioValue<T> {
  value: T;
  provenance: ProvenanceKind;
}

export function scenarioValue<T>(value: T, provenance: ProvenanceKind): ScenarioValue<T> {
  return { value, provenance };
}

export * from "./company-upgrade-planner.js";
export * from "./skill-planner.js";
