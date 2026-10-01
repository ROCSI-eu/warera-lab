export type WarEraApiErrorKind = "unsupported-procedure" | "http" | "upstream" | "invalid-response";

export interface WarEraApiErrorOptions {
  kind: WarEraApiErrorKind;
  status?: number;
  upstreamCode?: string;
  retryAfterSeconds?: number;
  cause?: unknown;
}

export class WarEraApiError extends Error {
  readonly kind: WarEraApiErrorKind;
  readonly status: number | undefined;
  readonly upstreamCode: string | undefined;
  readonly retryAfterSeconds: number | undefined;

  constructor(message: string, options: WarEraApiErrorOptions) {
    super(message, { cause: options.cause });
    this.name = "WarEraApiError";
    this.kind = options.kind;
    this.status = options.status;
    this.upstreamCode = options.upstreamCode;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}
