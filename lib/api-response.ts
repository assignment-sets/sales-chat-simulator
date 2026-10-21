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

export function forbidden(clientMessage = "Forbidden") {
  return apiError(clientMessage, 403);
}

export function notFound(clientMessage = "Resource not found") {
  return apiError(clientMessage, 404);
}

export function internalError(
  clientMessage = "An unexpected error occurred. Please try again later.",
  internalError?: unknown,
  context?: string
) {
  return apiError(clientMessage, 500, internalError, context);
}
