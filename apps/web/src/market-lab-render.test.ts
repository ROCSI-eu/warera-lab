import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MarketLabShell } from "./MarketLabShell.js";

describe("MarketLabShell", () => {
  it("renders a standalone empty Market Lab without requiring player context", () => {
    const html = renderToStaticMarkup(createElement(MarketLabShell, {}));

    expect(html).toContain("Market Lab");
    expect(html).toContain("Current state only");
    expect(html).not.toContain("Selected item");
  });

  it("renders reload-safe item context without pretending market data was loaded", () => {
    const html = renderToStaticMarkup(createElement(MarketLabShell, { itemCode: "steel" }));

    expect(html).toContain("Selected item");
    expect(html).toContain("<strong>steel</strong>");
    expect(html).toContain("Market context is intentionally not loaded yet");
  });

  it("surfaces invalid-link recovery messages", () => {
    const html = renderToStaticMarkup(
      createElement(MarketLabShell, {
        navigationMessage: "The item context in this link is invalid. Choose an item again.",
      }),
    );

    expect(html).toContain('role="status"');
    expect(html).toContain("item context in this link is invalid");
  });
});
