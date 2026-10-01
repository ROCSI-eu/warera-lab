import { describe, expect, it } from "vitest";

import { app } from "./app.js";

describe("GET /api/health", () => {
  it("returns a no-store health response", async () => {
    const response = await app.request("/api/health");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      service: "warera-lab-api",
    });
  });
});
