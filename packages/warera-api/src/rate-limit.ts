export interface WarEraRateLimitMetadata {
  limit: number | undefined;
  remaining: number | undefined;
  resetSeconds: number | undefined;
  policy: string | undefined;
}

function parseFiniteNumber(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function readRateLimitMetadata(headers: Headers): WarEraRateLimitMetadata {
  return {
    limit: parseFiniteNumber(headers.get("ratelimit-limit")),
    remaining: parseFiniteNumber(headers.get("ratelimit-remaining")),
    resetSeconds: parseFiniteNumber(headers.get("ratelimit-reset")),
    policy: headers.get("ratelimit-policy") ?? undefined,
  };
}
