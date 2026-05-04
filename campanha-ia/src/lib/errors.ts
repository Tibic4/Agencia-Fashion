/**
 * CrialookError — base class for unified API error handling.
 *
 * Why this exists: route handlers historically threw bare `new Error("...")`
 * and relied on a top-level catch to JSON-stringify the message. That left
 * three problems:
 *   1. HTTP status was always 500 even when the failure was a known 4xx
 *      (auth, validation, quota).
 *   2. The user-facing message leaked stack-trace text or internal jargon
 *      when no try/catch translated it.
 *   3. Sentry got the same generic "Erro desconhecido" for every shape of
 *      failure, breaking aggregation.
 *
 * Now each handler can throw a CrialookError subclass and a single
 * `respondToError(err)` helper turns it into the right NextResponse with
 * code + httpStatus + safe userMessage.
 *
 * Subclasses cover the 5 common shapes:
 *   - ValidationError  → 400
 *   - AuthError        → 401
 *   - BillingError     → 402 (quota, plan-required, payment-failed)
 *   - NotFoundError    → 404
 *   - RateLimitError   → 429
 *
 * For 5xx server failures, just throw a base `CrialookError("INTERNAL", "...", 500, cause)`.
 */

import { NextResponse } from "next/server";

export class CrialookError extends Error {
  /**
   * Stable machine-readable code (UPPER_SNAKE_CASE). Used by the mobile app
   * + admin tools to branch UI behavior. Once shipped, treat as part of the
   * public API contract — don't rename without coordination.
   */
  readonly code: string;
  /**
   * End-user-safe Portuguese message. Goes straight into the toast / dialog
   * the user sees. Never include stack-trace, file paths, or internal IDs.
   */
  readonly userMessage: string;
  /** HTTP status code (400..599). */
  readonly httpStatus: number;
  /** Original error if this wraps another exception (chain for Sentry). */
  override readonly cause?: unknown;

  constructor(
    code: string,
    userMessage: string,
    httpStatus = 500,
    cause?: unknown,
  ) {
    super(`[${code}] ${userMessage}`);
    this.name = "CrialookError";
    this.code = code;
    this.userMessage = userMessage;
    this.httpStatus = httpStatus;
    this.cause = cause;
  }

  /** Serialize to the JSON shape returned by `respondToError`. */
  toJSON(): { error: string; code: string } {
    return { error: this.userMessage, code: this.code };
  }
}

/** 400 — request payload failed validation / parse. */
export class ValidationError extends CrialookError {
  constructor(userMessage: string, code = "VALIDATION_ERROR", cause?: unknown) {
    super(code, userMessage, 400, cause);
    this.name = "ValidationError";
  }
}

/** 401 — caller is not authenticated (or session expired). */
export class AuthError extends CrialookError {
  constructor(userMessage = "Não autenticado", code = "UNAUTHORIZED", cause?: unknown) {
    super(code, userMessage, 401, cause);
    this.name = "AuthError";
  }
}

/**
 * 402 — billing / quota / payment-required. Use when the user is authed but
 * their plan or credits don't cover the action they tried to take.
 */
export class BillingError extends CrialookError {
  constructor(userMessage: string, code = "BILLING_ERROR", cause?: unknown) {
    super(code, userMessage, 402, cause);
    this.name = "BillingError";
  }
}

/** 404 — resource (campaign, store, model) not found or not visible to caller. */
export class NotFoundError extends CrialookError {
  constructor(userMessage = "Não encontrado", code = "NOT_FOUND", cause?: unknown) {
    super(code, userMessage, 404, cause);
    this.name = "NotFoundError";
  }
}

/**
 * 429 — rate-limit / quota bucket exhausted. `retryAfterSeconds` (when
 * provided) is rendered as a Retry-After response header by `respondToError`.
 */
export class RateLimitError extends CrialookError {
  readonly retryAfterSeconds?: number;
  constructor(
    userMessage = "Muitas requisições. Tente novamente em alguns segundos.",
    code = "RATE_LIMITED",
    retryAfterSeconds?: number,
    cause?: unknown,
  ) {
    super(code, userMessage, 429, cause);
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Helper: convert any error into a NextResponse. CrialookError instances are
 * rendered with their httpStatus + JSON shape; everything else falls back to
 * a generic 500.
 *
 * Usage:
 *   try { ... }
 *   catch (e) { return respondToError(e); }
 */
export function respondToError(err: unknown): NextResponse {
  if (err instanceof CrialookError) {
    const headers: Record<string, string> = {};
    if (err instanceof RateLimitError && typeof err.retryAfterSeconds === "number") {
      headers["Retry-After"] = String(Math.max(1, Math.ceil(err.retryAfterSeconds)));
    }
    return NextResponse.json(err.toJSON(), { status: err.httpStatus, headers });
  }
  return NextResponse.json(
    { error: "Erro interno do servidor", code: "INTERNAL_ERROR" },
    { status: 500 },
  );
}
