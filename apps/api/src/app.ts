import { WarEraApiError, WarEraPublicApiClient } from "@warera-lab/warera-api";
import { Hono } from "hono";
import { z } from "zod";

import { EconomyContextService, type EconomyWarEraClient } from "./economy-context-service.js";
import {
  PlayerNotFoundError,
  PlayerSnapshotService,
  type PublicWarEraClient,
} from "./player-service.js";

const searchRequestSchema = z.object({
  query: z.string().trim().min(2).max(80),
});

const snapshotRequestSchema = z.object({
  userId: z.string().trim().min(1).max(128),
});

const economyContextRequestSchema = z.object({
  itemCode: z.string().trim().min(1).max(128),
});

interface AppDependencies {
  wareraClient?: PublicWarEraClient & EconomyWarEraClient;
  now?: () => Date;
}

interface PublicApiError {
  error: {
    code:
      | "INVALID_REQUEST"
      | "PLAYER_NOT_FOUND"
      | "UPSTREAM_RATE_LIMITED"
      | "UPSTREAM_UNAVAILABLE"
      | "UPSTREAM_INVALID_RESPONSE"
      | "UPSTREAM_ERROR"
      | "INTERNAL_ERROR";
    message: string;
    retryAfterSeconds?: number;
  };
}

function invalidRequest(message: string): Response {
  return Response.json({ error: { code: "INVALID_REQUEST", message } } satisfies PublicApiError, {
    status: 400,
  });
}

function playerNotFound(): Response {
  return Response.json(
    {
      error: { code: "PLAYER_NOT_FOUND", message: "The requested WarEra player was not found." },
    } satisfies PublicApiError,
    { status: 404 },
  );
}

function mapWarEraError(error: WarEraApiError): Response {
  if (error.kind === "rate-limited") {
    const retryAfterSeconds = error.retryAfterSeconds;
    const headers = new Headers();
    if (retryAfterSeconds !== undefined) headers.set("Retry-After", String(retryAfterSeconds));
    return Response.json(
      {
        error: {
          code: "UPSTREAM_RATE_LIMITED",
          message: "WarEra is temporarily rate-limited. Please retry shortly.",
          ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
        },
      } satisfies PublicApiError,
      { status: 503, headers },
    );
  }

  if (error.kind === "upstream" || (error.kind === "http" && (error.status ?? 0) >= 500)) {
    return Response.json(
      {
        error: {
          code: "UPSTREAM_UNAVAILABLE",
          message: "WarEra is temporarily unavailable. Please retry shortly.",
        },
      } satisfies PublicApiError,
      { status: 503 },
    );
  }

  if (error.kind === "invalid-response") {
    return Response.json(
      {
        error: {
          code: "UPSTREAM_INVALID_RESPONSE",
          message: "WarEra returned data that could not be safely validated.",
        },
      } satisfies PublicApiError,
      { status: 502 },
    );
  }

  return Response.json(
    {
      error: { code: "UPSTREAM_ERROR", message: "WarEra rejected the upstream request." },
    } satisfies PublicApiError,
    { status: 502 },
  );
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = new Hono();
  const client = dependencies.wareraClient ?? new WarEraPublicApiClient();
  const playerService = new PlayerSnapshotService(client, dependencies.now);
  const economyContextService = new EconomyContextService(client, dependencies.now);

  app.use("/api/*", async (context, next) => {
    await next();
    context.header("Cache-Control", "no-store");
  });

  app.get("/api/health", (context) =>
    context.json({
      status: "ok",
      service: "warera-lab-api",
    }),
  );

  app.post("/api/players/search", async (context) => {
    const parsed = searchRequestSchema.safeParse(await readJson(context.req.raw));
    if (!parsed.success)
      return invalidRequest("Provide a search query between 2 and 80 characters.");

    try {
      return context.json({ data: await playerService.searchPlayers(parsed.data.query) });
    } catch (error) {
      if (error instanceof WarEraApiError) return mapWarEraError(error);
      throw error;
    }
  });

  app.post("/api/players/snapshot", async (context) => {
    const parsed = snapshotRequestSchema.safeParse(await readJson(context.req.raw));
    if (!parsed.success) return invalidRequest("Provide a valid WarEra player identifier.");

    try {
      return context.json({ data: await playerService.getSnapshot(parsed.data.userId) });
    } catch (error) {
      if (error instanceof PlayerNotFoundError) return playerNotFound();
      if (error instanceof WarEraApiError) return mapWarEraError(error);
      throw error;
    }
  });

  app.post("/api/economy/context", async (context) => {
    const parsed = economyContextRequestSchema.safeParse(await readJson(context.req.raw));
    if (!parsed.success) return invalidRequest("Provide a valid company item code.");

    try {
      return context.json({ data: await economyContextService.getContext(parsed.data.itemCode) });
    } catch (error) {
      if (error instanceof WarEraApiError) return mapWarEraError(error);
      throw error;
    }
  });

  app.onError((error) => {
    console.error("Unhandled WarEra Lab API error", error);
    return Response.json(
      {
        error: { code: "INTERNAL_ERROR", message: "An unexpected server error occurred." },
      } satisfies PublicApiError,
      { status: 500 },
    );
  });

  return app;
}

export const app = createApp();
