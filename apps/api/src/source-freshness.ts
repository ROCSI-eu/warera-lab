import type {
  SnapshotFreshness,
  SnapshotFreshnessSource,
  SnapshotFreshnessSourceKind,
} from "@warera-lab/domain";
import type { WarEraAdapterResponse, WarEraCacheMetadata } from "@warera-lab/warera-api";

function freshnessState(cache: WarEraCacheMetadata): SnapshotFreshnessSource["state"] {
  if (cache.state === "stale") return "stale";
  if (cache.state === "fresh") return "cached";
  return "live";
}

export function sourceFreshness(
  source: SnapshotFreshnessSourceKind,
  response: Pick<WarEraAdapterResponse<unknown>, "retrievedAt" | "cache">,
  subjectId?: string,
): SnapshotFreshnessSource {
  return {
    source,
    ...(subjectId === undefined ? {} : { subjectId }),
    retrievedAt: response.retrievedAt,
    ageMs: response.cache.ageMs,
    state: freshnessState(response.cache),
  };
}

export function aggregateFreshness(
  generatedAt: string,
  sources: SnapshotFreshnessSource[],
): SnapshotFreshness {
  return {
    generatedAt,
    hasStaleData: sources.some((source) => source.state === "stale"),
    sources,
  };
}
