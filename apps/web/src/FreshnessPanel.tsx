import type { SnapshotFreshness, SnapshotFreshnessSource } from "@warera-lab/domain";

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

export function FreshnessPanel({
  freshness,
  title,
}: {
  freshness: SnapshotFreshness;
  title: string;
}) {
  const titleId = title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-freshness";
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
