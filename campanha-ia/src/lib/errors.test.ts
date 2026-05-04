import { describe, it, expect } from "vitest";
import {
  CrialookError,
  ValidationError,
  AuthError,
  BillingError,
  NotFoundError,
  RateLimitError,
  respondToError,
} from "./errors";

describe("CrialookError", () => {
  it("stores code, userMessage, httpStatus, cause", () => {
    const cause = new Error("underlying");
    const e = new CrialookError("X_CODE", "Mensagem amigável", 418, cause);
    expect(e.code).toBe("X_CODE");
    expect(e.userMessage).toBe("Mensagem amigável");
    expect(e.httpStatus).toBe(418);
    expect(e.cause).toBe(cause);
    // base Error.message includes the code prefix for stack-trace clarity
    expect(e.message).toBe("[X_CODE] Mensagem amigável");
  });

  it("default httpStatus = 500 when omitted", () => {
    const e = new CrialookError("X", "y");
    expect(e.httpStatus).toBe(500);
  });

  it("toJSON returns the wire-shape exposed to clients (no leaks)", () => {
    const cause = new Error("internal db detail");
    const e = new CrialookError("X", "Mensagem", 500, cause);
    expect(e.toJSON()).toEqual({ error: "Mensagem", code: "X" });
    // ensure cause / stack are NOT in the serialized payload
    expect(JSON.stringify(e.toJSON())).not.toContain("internal db detail");
  });
});

describe("CrialookError subclasses", () => {
  it("ValidationError → 400", () => {
    const e = new ValidationError("campo obrigatório");
    expect(e).toBeInstanceOf(CrialookError);
    expect(e.httpStatus).toBe(400);
    expect(e.code).toBe("VALIDATION_ERROR");
  });

  it("AuthError → 401", () => {
    const e = new AuthError();
    expect(e.httpStatus).toBe(401);
    expect(e.code).toBe("UNAUTHORIZED");
  });

  it("BillingError → 402", () => {
    const e = new BillingError("sem créditos");
    expect(e.httpStatus).toBe(402);
    expect(e.code).toBe("BILLING_ERROR");
  });

  it("NotFoundError → 404", () => {
    const e = new NotFoundError();
    expect(e.httpStatus).toBe(404);
    expect(e.code).toBe("NOT_FOUND");
  });

  it("RateLimitError → 429 with optional retryAfterSeconds", () => {
    const e = new RateLimitError("aguarde", "RATE_LIMITED", 90);
    expect(e.httpStatus).toBe(429);
    expect(e.retryAfterSeconds).toBe(90);
  });
});

describe("respondToError", () => {
  it("renders CrialookError with status + JSON shape", async () => {
    const e = new ValidationError("x falhou", "X_FAILED");
    const res = respondToError(e);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: "x falhou", code: "X_FAILED" });
  });

  it("RateLimitError gets Retry-After header rounded up", async () => {
    const e = new RateLimitError("esp", "RATE", 12.3);
    const res = respondToError(e);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("13");
  });

  it("RateLimitError without retryAfter omits header", async () => {
    const e = new RateLimitError("esp", "RATE");
    const res = respondToError(e);
    expect(res.headers.get("Retry-After")).toBeNull();
  });

  it("non-Crialook errors fall back to generic 500", async () => {
    const res = respondToError(new Error("some random thing"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("INTERNAL_ERROR");
    // generic message — never leaks underlying error
    expect(body.error).not.toContain("some random thing");
  });

  it("respects custom httpStatus on base CrialookError", async () => {
    const e = new CrialookError("TEAPOT", "I'm a teapot", 418);
    const res = respondToError(e);
    expect(res.status).toBe(418);
  });
});
