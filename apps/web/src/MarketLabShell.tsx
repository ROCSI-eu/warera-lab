export function MarketLabShell({
  itemCode,
  navigationMessage,
}: {
  itemCode?: string;
  navigationMessage?: string;
}) {
  return (
    <section className="workspace" aria-labelledby="market-lab-title">
      {navigationMessage ? (
        <p className="message message--warning" role="status">
          {navigationMessage}
        </p>
      ) : null}

      <div className="workspace-heading">
        <div>
          <p className="section-kicker">Current-state market module</p>
          <h2 id="market-lab-title">Market Lab</h2>
          <p className="muted">
            Inspect current public market context without historical collection, alerts, or hidden
            recommendation logic.
          </p>
        </div>
        <span className="badge">Current state only</span>
      </div>

      {itemCode ? (
        <div className="metric-grid" aria-label="Market Lab selected item context">
          <article>
            <span>Selected item</span>
            <strong>{itemCode}</strong>
            <small>Reload-safe URL context</small>
          </article>
        </div>
      ) : null}

      <section
        className="workspace-panel workspace-panel--wide"
        aria-labelledby="market-next-title"
      >
        <p className="section-kicker">Foundation</p>
        <h3 id="market-next-title">Market context is intentionally not loaded yet</h3>
        <p className="muted">
          This first Market Lab step establishes the module and item URL contract only. Current
          prices, recipe context, bounded order data, and derived economics remain separate focused
          changes.
        </p>
      </section>
    </section>
  );
}
