import type { ApiError, ApiErrorCode } from "@cart/contracts";

export class ApiException extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiException";
  }
}

export function toErrorResponse(e: ApiException): ApiError {
  return {
    error: {
      code: e.code,
      message: e.message,
      ...(e.details !== undefined ? { details: e.details } : {}),
    },
  };
}
