export const OFFICIAL_WARERA_API_BASE_URL = "https://api2.warera.io/trpc";

export interface WarEraRateLimitMetadata {
  limit?: number;
  remaining?: number;
  resetSeconds?: number;
  policy?: string;
}

export interface WarEraAdapterResponse<T> {
  data: T;
  retrievedAt: string;
  rateLimit: WarEraRateLimitMetadata;
}

export interface WarEraAdapter {
  call<T>(procedure: string, input: unknown): Promise<WarEraAdapterResponse<T>>;
}
