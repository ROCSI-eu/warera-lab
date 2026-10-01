import { afterEach, describe, expect, it, vi } from "vitest";

import { PublicApiClientError, getPlayerSnapshot, searchPlayers } from "./public-api.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("public API client", () => {
  it("uses the same-origin player search endpoint", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        data: {
          query: "Example",
          matches: [],
          truncated: false,
          freshness: {
            generatedAt: "2026-10-01T12:00:00.000Z",
            hasStaleData: false,
            sources: [],
          },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await searchPlayers("Example");

    expect(fetchMock).toHaveBeenCalledWith("/api/players/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "Example" }),
    });
  });

  it("preserves the server rate-limit message and retry hint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            error: {
              code: "UPSTREAM_RATE_LIMITED",
              message: "WarEra is temporarily rate-limited. Please retry shortly.",
              retryAfterSeconds: 17,
            },
          },
          { status: 503, headers: { "Retry-After": "17" } },
        ),
      ),
    );

    await expect(searchPlayers("Example")).rejects.toMatchObject({
      name: "PublicApiClientError",
      code: "UPSTREAM_RATE_LIMITED",
      retryAfterSeconds: 17,
    });
  });

  it("fails safely when a successful response is missing its data envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ ok: true })),
    );

    await expect(getPlayerSnapshot("user-1")).rejects.toEqual(
      expect.objectContaining<Partial<PublicApiClientError>>({
        code: "UNEXPECTED_RESPONSE",
      }),
    );
  });
});
