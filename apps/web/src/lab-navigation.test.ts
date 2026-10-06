import { describe, expect, it } from "vitest";

import { buildLabHref, buildPortableScenarioHref, parseLabLocation } from "./lab-navigation.js";

describe("lab navigation", () => {
  it("defaults old URLs to Economy Lab without inventing context", () => {
    expect(parseLabLocation("")).toEqual({ route: { lab: "economy" } });
  });

  it("parses reload-safe Company Lab player and company context", () => {
    expect(parseLabLocation("?lab=company&player=player-1&company=company-2")).toEqual({
      route: {
        lab: "company",
        playerId: "player-1",
        companyId: "company-2",
      },
    });
  });

  it("drops orphaned company context and returns a recovery message", () => {
    const parsed = parseLabLocation("?lab=company&company=company-2");

    expect(parsed.route).toEqual({ lab: "company" });
    expect(parsed.message).toMatch(/needs a player context/i);
  });

  it("falls back safely from an unknown lab", () => {
    const parsed = parseLabLocation("?lab=unknown&player=player-1");

    expect(parsed.route).toEqual({ lab: "economy", playerId: "player-1" });
    expect(parsed.message).toMatch(/unknown lab link/i);
  });

  it("builds lab URLs without changing scenario hashes or unrelated query parameters", () => {
    expect(
      buildLabHref(
        { lab: "company", playerId: "player-1", companyId: "company-2" },
        {
          pathname: "/",
          search: "?source=test",
          hash: "#wl=portable-scenario",
        },
      ),
    ).toBe("/?source=test&lab=company&player=player-1&company=company-2#wl=portable-scenario");
  });

  it("removes stale company context when no company is selected", () => {
    expect(
      buildLabHref(
        { lab: "economy", playerId: "player-1" },
        {
          pathname: "/",
          search: "?lab=company&player=player-1&company=old-company",
          hash: "",
        },
      ),
    ).toBe("/?lab=economy&player=player-1");
  });
});

describe("portable scenario navigation", () => {
  it("strips live lab identity while preserving unrelated query parameters", () => {
    expect(
      buildPortableScenarioHref(
        {
          pathname: "/",
          search: "?source=test&lab=economy&player=player-1&company=company-2",
          hash: "",
        },
        "#wl=portable-scenario",
      ),
    ).toBe("/?source=test#wl=portable-scenario");
  });
});
