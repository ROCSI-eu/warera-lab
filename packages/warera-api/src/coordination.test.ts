import { describe, expect, it, vi } from "vitest";

import { WarEraApiError, WarEraPublicApiClient } from "./index.js";

function playerPayload(userId: string) {
  return {
    _id: userId,
    username: `Player ${userId}`,
    country: "country-1",
    leveling: {
      level: 12,
      availableSkillPoints: 4,
      spentSkillPoints: 20,
      totalSkillPoints: 24,
    },
    skills: {
      production: { level: 4, value: 22, total: 22 },
      entrepreneurship: { level: 3, value: 45, total: 45 },
      management: { level: 2, value: 8, total: 8 },
      companies: { level: 5, value: 7, total: 7 },
    },
  };
}

function successResponse(data: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ result: { data } }), {
    status: 200,
    headers: { "content-type": "application/json", ...headers },
  });
}

function userIdFromRequest(input: string | URL | Request): string {
  const url = new URL(String(input));
  const params = JSON.parse(url.searchParams.get("input") ?? "{}") as { userId?: string };
  return params.userId ?? "unknown";
}

describe("WarEra request coordination", () => {
  it("serves a fresh cache hit without repeating the upstream request", async () => {
    let nowMs = 0;
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input) =>
      successResponse(playerPayload(userIdFromRequest(input)), {
        "ratelimit-limit": "100",
        "ratelimit-remaining": "90",
        "ratelimit-reset": "60",
      }),
    );
    const client = new WarEraPublicApiClient({
      fetch: fetchMock,
      now: () => new Date(nowMs),
    });

    const first = await client.getPlayer("user-1");
    nowMs = 1_000;
    const second = await client.getPlayer("user-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first.cache).toMatchObject({ state: "miss", coalesced: false });
    expect(second.cache).toMatchObject({ state: "fresh", ageMs: 1_000, coalesced: false });
    expect(second.retrievedAt).toBe(first.retrievedAt);
  });

  it("expires entries according to the configured endpoint TTL", async () => {
    let nowMs = 0;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) =>
        successResponse(playerPayload(userIdFromRequest(input))),
      );
    const client = new WarEraPublicApiClient({
      fetch: fetchMock,
      now: () => new Date(nowMs),
      coordination: {
        policies: {
          "user.getUserLite": { ttlMs: 100, staleIfErrorMs: 0 },
        },
      },
    });

    await client.getPlayer("user-1");
    nowMs = 101;
    const refreshed = await client.getPlayer("user-1");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(refreshed.cache.state).toBe("miss");
  });

  it("does not cache a payload that fails endpoint validation", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(successResponse({ _id: "user-1", username: "Incomplete" }))
      .mockResolvedValueOnce(successResponse(playerPayload("user-1")));
    const client = new WarEraPublicApiClient({ fetch: fetchMock });

    await expect(client.getPlayer("user-1")).rejects.toMatchObject<Partial<WarEraApiError>>({
      kind: "invalid-response",
    });
    const recovered = await client.getPlayer("user-1");

    expect(recovered.data.id).toBe("user-1");
    expect(recovered.cache.state).toBe("miss");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("coalesces identical simultaneous requests", async () => {
    let resolveResponse: ((response: Response) => void) | undefined;
    const pending = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    const fetchMock = vi.fn<typeof fetch>().mockReturnValue(pending);
    const client = new WarEraPublicApiClient({ fetch: fetchMock });

    const firstPromise = client.getPlayer("user-1");
    const secondPromise = client.getPlayer("user-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveResponse?.(successResponse(playerPayload("user-1")));

    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    expect(first.cache).toMatchObject({ state: "miss", coalesced: false });
    expect(second.cache).toMatchObject({ state: "miss", coalesced: true });
  });

  it("enforces a hard cache entry bound with least-recently-used eviction", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) =>
        successResponse(playerPayload(userIdFromRequest(input))),
      );
    const client = new WarEraPublicApiClient({
      fetch: fetchMock,
      coordination: { maxEntries: 2 },
    });

    await client.getPlayer("user-1");
    await client.getPlayer("user-2");
    await client.getPlayer("user-3");
    await client.getPlayer("user-1");

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("holds new upstream work when the observed budget reaches the safety reserve", async () => {
    let nowMs = 0;
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input) =>
      successResponse(playerPayload(userIdFromRequest(input)), {
        "ratelimit-limit": "100",
        "ratelimit-remaining": "2",
        "ratelimit-reset": "60",
        "ratelimit-policy": "100;w=60",
      }),
    );
    const client = new WarEraPublicApiClient({
      fetch: fetchMock,
      now: () => new Date(nowMs),
      coordination: { safetyReserve: 2 },
    });

    await client.getPlayer("user-1");
    const cached = await client.getPlayer("user-1");
    nowMs = 0;

    expect(cached.cache.state).toBe("fresh");
    await expect(client.getPlayer("user-2")).rejects.toMatchObject<Partial<WarEraApiError>>({
      kind: "rate-limited",
      status: 429,
      retryAfterSeconds: 60,
      rateLimit: expect.objectContaining({ remaining: 2 }),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("serves explicitly marked stale data only inside the configured stale-if-error window", async () => {
    let nowMs = 0;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(successResponse({ grain: 0.08, steel: 1.6 }))
      .mockResolvedValueOnce(new Response("no available server", { status: 503 }))
      .mockResolvedValueOnce(new Response("no available server", { status: 503 }));
    const client = new WarEraPublicApiClient({
      fetch: fetchMock,
      now: () => new Date(nowMs),
      coordination: {
        policies: {
          "itemTrading.getPrices": { ttlMs: 100, staleIfErrorMs: 500 },
        },
      },
    });

    const first = await client.getItemPrices();
    nowMs = 101;
    const stale = await client.getItemPrices();

    expect(first.cache.state).toBe("miss");
    expect(stale.cache).toMatchObject({ state: "stale", ageMs: 101 });
    expect(stale.data.grain).toBe(0.08);

    nowMs = 601;
    await expect(client.getItemPrices()).rejects.toMatchObject<Partial<WarEraApiError>>({
      kind: "http",
      status: 503,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});