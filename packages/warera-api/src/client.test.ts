import { describe, expect, it, vi } from "vitest";

import { WarEraApiError, WarEraPublicApiClient } from "./index.js";

function jsonResponse(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    ...init,
  });
}

const playerPayload = {
  _id: "user-1",
  username: "Example",
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

describe("WarEraPublicApiClient", () => {
  it("uses GET with the direct JSON input shape and captures rate-limit metadata", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse(
        { result: { data: playerPayload } },
        {
          headers: {
            "content-type": "application/json",
            "ratelimit-limit": "100",
            "ratelimit-remaining": "73",
            "ratelimit-reset": "60",
            "ratelimit-policy": "100;w=60",
          },
        },
      ),
    );
    const client = new WarEraPublicApiClient({
      fetch: fetchMock,
      now: () => new Date("2026-10-01T12:00:00.000Z"),
    });

    const response = await client.getPlayer("user-1");

    expect(response.data.username).toBe("Example");
    expect(response.retrievedAt).toBe("2026-10-01T12:00:00.000Z");
    expect(response.rateLimit).toEqual({
      limit: 100,
      remaining: 73,
      resetSeconds: 60,
      policy: "100;w=60",
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(init?.method).toBe("GET");
    const calledUrl = new URL(String(url));
    expect(calledUrl.pathname).toBe("/trpc/user.getUserLite");
    expect(JSON.parse(calledUrl.searchParams.get("input") ?? "null")).toEqual({ userId: "user-1" });
  });

  it("rejects malformed upstream payloads instead of filling missing fields", async () => {
    const client = new WarEraPublicApiClient({
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          jsonResponse({ result: { data: { _id: "user-1", username: "Incomplete" } } }),
        ),
    });

    await expect(client.getPlayer("user-1")).rejects.toMatchObject<Partial<WarEraApiError>>({
      kind: "invalid-response",
    });
  });

  it("normalizes tRPC HTTP errors", async () => {
    const client = new WarEraPublicApiClient({
      fetch: vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse(
          {
            error: {
              message: "API token required",
              data: { code: "UNAUTHORIZED", httpStatus: 401 },
            },
          },
          { status: 401, headers: { "retry-after": "30" } },
        ),
      ),
    });

    await expect(client.getPlayer("user-1")).rejects.toMatchObject<Partial<WarEraApiError>>({
      kind: "http",
      status: 401,
      upstreamCode: "UNAUTHORIZED",
      retryAfterSeconds: 30,
    });
  });

  it("normalizes an upstream 429 as a retryable rate-limit error", async () => {
    const client = new WarEraPublicApiClient({
      fetch: vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse(
          { error: { message: "Too many requests", data: { code: "TOO_MANY_REQUESTS" } } },
          {
            status: 429,
            headers: {
              "retry-after": "12",
              "ratelimit-limit": "100",
              "ratelimit-remaining": "0",
              "ratelimit-reset": "12",
            },
          },
        ),
      ),
    });

    await expect(client.getItemPrices()).rejects.toMatchObject<Partial<WarEraApiError>>({
      kind: "rate-limited",
      status: 429,
      retryAfterSeconds: 12,
      rateLimit: expect.objectContaining({ remaining: 0, resetSeconds: 12 }),
    });
  });

  it("normalizes plain-text upstream outages", async () => {
    const client = new WarEraPublicApiClient({
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("no available server", { status: 503 })),
    });

    await expect(client.getItemPrices()).rejects.toMatchObject<Partial<WarEraApiError>>({
      kind: "http",
      status: 503,
      message: "no available server",
    });
  });

  it("passes company pagination cursors through the documented input", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse({ result: { data: { items: ["company-1"], nextCursor: null } } }),
      );
    const client = new WarEraPublicApiClient({ fetch: fetchMock });

    const response = await client.getCompanies("user-1", 25, "cursor-2");

    expect(response.data).toEqual({ itemIds: ["company-1"] });
    const [url] = fetchMock.mock.calls[0] ?? [];
    const calledUrl = new URL(String(url));
    expect(JSON.parse(calledUrl.searchParams.get("input") ?? "null")).toEqual({
      userId: "user-1",
      perPage: 25,
      cursor: "cursor-2",
    });
  });

  it("normalizes market order books", async () => {
    const client = new WarEraPublicApiClient({
      fetch: vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          result: {
            data: {
              buyOrders: [
                {
                  _id: "buy-1",
                  user: "user-a",
                  itemCode: "grain",
                  quantity: 10,
                  price: 0.1,
                  offerAt: "2026-10-01T10:00:00.000Z",
                  type: "buy",
                },
              ],
              sellOrders: [
                {
                  _id: "sell-1",
                  user: "user-b",
                  itemCode: "grain",
                  quantity: 20,
                  price: 0.2,
                  type: "sell",
                },
              ],
            },
          },
        }),
      ),
    });

    await expect(client.getTopOrders("grain")).resolves.toMatchObject({
      data: {
        buyOrders: [{ id: "buy-1", ownerId: "user-a", type: "buy" }],
        sellOrders: [{ id: "sell-1", ownerId: "user-b", type: "sell" }],
      },
    });
  });
});
