import { describe, expect, it } from "vitest";

import { buildLabHref, buildPortableScenarioHref, parseLabLocation } from "./lab-navigation.js";

describe("lab navigation", () => {
  it("defaults old URLs to Economy Lab without inventing context", () => {
    expect(parseLabLocation("")).toEqual({ route: { lab: "economy" } });
  });

  it("accepts direct Player Lab links with optional focused company identity", () => {
    expect(parseLabLocation("?lab=player&player=player-1")).toEqual({
      route: { lab: "player", playerId: "player-1" },
    });
    expect(parseLabLocation("?lab=player&player=player-1&company=company-2")).toEqual({
      route: { lab: "player", playerId: "player-1", companyId: "company-2" },
    });
    expect(parseLabLocation("?lab=player&company=orphan").message).toMatch(/needs a player/i);
  });

  it("builds Player Lab links without carrying Market item or scenario state", () => {
    expect(
      buildLabHref(
        { lab: "player", playerId: "player-1" },
        {
          pathname: "/",
          search: "?lab=market&company=old&item=steel",
          hash: "",
        },
      ),
    ).toBe("/?lab=player&player=player-1");
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

  it("parses reload-safe Market Lab item context without requiring a player", () => {
    expect(parseLabLocation("?lab=market&item=steel")).toEqual({
      route: {
        lab: "market",
        itemCode: "steel",
      },
    });
  });

  it("preserves optional live identity alongside Market Lab item context", () => {
    expect(parseLabLocation("?lab=market&item=steel&player=player-1&company=company-2")).toEqual({
      route: {
        lab: "market",
        itemCode: "steel",
        playerId: "player-1",
        companyId: "company-2",
      },
    });
  });

  it("drops invalid Market Lab item context and returns a recovery message", () => {
    const parsed = parseLabLocation("?lab=market&item=");

    expect(parsed.route).toEqual({ lab: "market" });
    expect(parsed.message).toMatch(/item context.*invalid/i);
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

  it("builds Market Lab URLs with item and optional live identity", () => {
    expect(
      buildLabHref(
        {
          lab: "market",
          itemCode: "steel",
          playerId: "player-1",
          companyId: "company-2",
        },
        {
          pathname: "/",
          search: "?source=test",
          hash: "",
        },
      ),
    ).toBe("/?source=test&lab=market&player=player-1&company=company-2&item=steel");
  });

  it("removes stale company and item context when the destination does not use them", () => {
    expect(
      buildLabHref(
        { lab: "economy", playerId: "player-1" },
        {
          pathname: "/",
          search: "?lab=market&player=player-1&company=old-company&item=steel",
          hash: "",
        },
      ),
    ).toBe("/?lab=economy&player=player-1");
  });
});

describe("portable scenario navigation", () => {
  it("strips live lab identity and item context while preserving unrelated query parameters", () => {
    expect(
      buildPortableScenarioHref(
        {
          pathname: "/",
          search: "?source=test&lab=market&player=player-1&company=company-2&item=steel",
          hash: "",
        },
        "#wl=portable-scenario",
      ),
    ).toBe("/?source=test#wl=portable-scenario");
  });
});
