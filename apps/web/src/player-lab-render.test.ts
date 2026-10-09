import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PlayerLabShell } from "./PlayerLabShell.js";
import type { WorkspaceMessage } from "./workspace-state.js";

function renderRefresh(message: WorkspaceMessage, isRefreshing: boolean) {
  return renderToStaticMarkup(
    createElement(PlayerLabShell, {
      snapshot: undefined,
      focusedCompanyId: undefined,
      navigationMessage: undefined,
      isImporting: false,
      isRefreshing,
      refreshMessage: message,
      onRefresh: () => undefined,
    }),
  );
}

describe("Player Lab snapshot-only refresh messaging", () => {
  it("never claims to fetch Economy context while Player Lab is refreshing", () => {
    const html = renderRefresh(
      { kind: "status", text: "Refreshing the live snapshot and Economy context…" },
      true,
    );
    expect(html).toContain("Refreshing the public player snapshot…");
    expect(html).not.toContain("Economy context");
    expect(html).toContain('role="status"');
  });

  it("preserves API error information when Player refresh fails", () => {
    const html = renderRefresh({ kind: "error", text: "WarEra rate limit reached." }, false);
    expect(html).toContain("WarEra rate limit reached.");
    expect(html).toContain('role="alert"');
  });
});
