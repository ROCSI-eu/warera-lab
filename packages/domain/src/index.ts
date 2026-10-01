export const provenanceKinds = ["observed", "derived", "assumed", "overridden"] as const;

export type ProvenanceKind = (typeof provenanceKinds)[number];

export interface SnapshotMetadata {
  source: "warera-public-api";
  retrievedAt: string;
}

export interface ValueWithProvenance<T> {
  value: T;
  provenance: ProvenanceKind;
  source?: string;
  observedAt?: string;
}

export * from "./warera.js";
