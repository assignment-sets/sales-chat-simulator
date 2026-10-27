import { NextResponse } from "next/server";

export interface ApiErrorPayload {
  error: string;
}

/**
 * Standardized success response helper.
 */
export function apiSuccess<T extends Record<string, unknown>>(
  data: T,
  status = 200
): NextResponse<T> {
  return NextResponse.json(data, { status });
}

/**
 * Standardized error response helper that logs internal details on the server
 * and returns only safe, sanitized error messages to the client.
 */
export function apiError(
  clientMessage: string,
  status: number,
  internalError?: unknown,
  context?: string
): NextResponse<ApiErrorPayload> {
  if (internalError !== undefined) {
    const errorDetails =
      internalError instanceof Error
        ? {
            name: internalError.name,
            message: internalError.message,
            stack: internalError.stack,
          }
        : internalError;

    console.error(`[API Error${context ? ` | ${context}` : ""}] (status ${status}):`, {
      clientMessage,
      internalError: errorDetails,
    });
  }

  return NextResponse.json({ error: clientMessage }, { status });
}

export function badRequest(
  clientMessage = "Bad Request",
  internalError?: unknown,
  context?: string
) {
  return apiError(clientMessage, 400, internalError, context);
}

export function unauthorized(clientMessage = "Unauthorized") {
  return apiError(clientMessage, 401);
}

/**
 * 499 for requests the client already abandoned (closed tab, cancelled fetch).
 * Nobody reads this body; it exists so handlers can exit deterministically
 * instead of pretending a generation failure happened.
 */
export function clientClosed(clientMessage = "Request cancelled by the client") {
  return apiError(clientMessage, 499);
}

export function forbidden(clientMessage = "Forbidden") {
  return apiError(clientMessage, 403);
}

export function notFound(clientMessage = "Resource not found") {
  return apiError(clientMessage, 404);
}

/**
 * Standardized 429 response for rate-limited requests.
 * Includes standard retry/limit headers so clients can back off correctly.
 */
export function rateLimited(
  retryAfterMs: number,
  limit?: number,
  remaining = 0
): NextResponse<ApiErrorPayload> {
  const retryAfter = Math.max(1, Math.ceil(retryAfterMs / 1000));
  const response = apiError(
    `Too many requests. Please wait ${retryAfter}s and try again.`,
    429
  );

  response.headers.set("Retry-After", String(retryAfter));
  response.headers.set("X-RateLimit-Remaining", String(Math.max(0, remaining)));
  response.headers.set(
    "X-RateLimit-Reset",
    String(Math.ceil((Date.now() + Math.max(0, retryAfterMs)) / 1000))
  );

  if (limit !== undefined) {
    response.headers.set("X-RateLimit-Limit", String(limit));
  }

  return response;
}

export function internalError(
  clientMessage = "An unexpected error occurred. Please try again later.",
  internalError?: unknown,
  context?: string
) {
  return apiError(clientMessage, 500, internalError, context);
}
