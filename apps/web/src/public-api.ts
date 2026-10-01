import type {
  EconomyPlannerContextResponse,
  PlayerSearchResponse,
  PublicPlayerSnapshotResponse,
} from "@warera-lab/domain";

export type PublicApiErrorCode =
  | "INVALID_REQUEST"
  | "PLAYER_NOT_FOUND"
  | "UPSTREAM_RATE_LIMITED"
  | "UPSTREAM_UNAVAILABLE"
  | "UPSTREAM_INVALID_RESPONSE"
  | "UPSTREAM_ERROR"
  | "INTERNAL_ERROR";

interface PublicApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    retryAfterSeconds?: number;
  };
}

export class PublicApiClientError extends Error {
  readonly code: PublicApiErrorCode | "UNEXPECTED_RESPONSE";
  readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    details: {
      code: PublicApiErrorCode | "UNEXPECTED_RESPONSE";
      retryAfterSeconds?: number;
    },
  ) {
    super(message);
    this.name = "PublicApiClientError";
    this.code = details.code;
    if (details.retryAfterSeconds !== undefined) {
      this.retryAfterSeconds = details.retryAfterSeconds;
    }
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function isKnownErrorCode(value: string): value is PublicApiErrorCode {
  return [
    "INVALID_REQUEST",
    "PLAYER_NOT_FOUND",
    "UPSTREAM_RATE_LIMITED",
    "UPSTREAM_UNAVAILABLE",
    "UPSTREAM_INVALID_RESPONSE",
    "UPSTREAM_ERROR",
    "INTERNAL_ERROR",
  ].includes(value);
}

async function post<T>(path: string, body: object): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new PublicApiClientError(
      "WarEra Lab could not reach its public API. Check your connection and try again.",
      { code: "UNEXPECTED_RESPONSE" },
    );
  }

  const payload = (await readJson(response)) as { data?: T } | PublicApiErrorBody | undefined;

  if (!response.ok) {
    const error = (payload as PublicApiErrorBody | undefined)?.error;
    const code =
      typeof error?.code === "string" && isKnownErrorCode(error.code)
        ? error.code
        : "UNEXPECTED_RESPONSE";
    const retryAfterHeader = Number.parseInt(response.headers.get("retry-after") ?? "", 10);
    const retryAfterSeconds =
      typeof error?.retryAfterSeconds === "number"
        ? error.retryAfterSeconds
        : Number.isFinite(retryAfterHeader)
          ? retryAfterHeader
          : undefined;

    throw new PublicApiClientError(
      typeof error?.message === "string"
        ? error.message
        : "WarEra Lab received an unexpected API response.",
      {
        code,
        ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
      },
    );
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    !("data" in payload) ||
    payload.data === undefined
  ) {
    throw new PublicApiClientError("WarEra Lab received an unexpected API response.", {
      code: "UNEXPECTED_RESPONSE",
    });
  }

  return payload.data;
}

export function searchPlayers(query: string): Promise<PlayerSearchResponse> {
  return post<PlayerSearchResponse>("/api/players/search", { query });
}

export function getPlayerSnapshot(userId: string): Promise<PublicPlayerSnapshotResponse> {
  return post<PublicPlayerSnapshotResponse>("/api/players/snapshot", { userId });
}

export function getEconomyContext(itemCode: string): Promise<EconomyPlannerContextResponse> {
  return post<EconomyPlannerContextResponse>("/api/economy/context", { itemCode });
}
