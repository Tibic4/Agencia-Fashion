import { describe, it, expect } from "vitest";
import { badRequest, forbidden, isValidUuid, notFound, unauthorized } from "./validation";

describe("isValidUuid", () => {
  it("aceita UUIDs v4 válidos", () => {
    expect(isValidUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isValidUuid("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")).toBe(true);
  });

  it("aceita UPPER case", () => {
    expect(isValidUuid("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });

  it("rejeita strings malformadas", () => {
    expect(isValidUuid("abc")).toBe(false);
    expect(isValidUuid("550e8400-e29b-41d4-a716")).toBe(false);
    expect(isValidUuid("550e8400e29b41d4a716446655440000")).toBe(false);
    expect(isValidUuid("550e8400-e29b-41d4-a716-44665544000Z")).toBe(false);
  });

  it("rejeita não-strings", () => {
    expect(isValidUuid(null)).toBe(false);
    expect(isValidUuid(undefined)).toBe(false);
    expect(isValidUuid(123)).toBe(false);
    expect(isValidUuid({})).toBe(false);
    expect(isValidUuid([])).toBe(false);
  });

  it("rejeita SQL injection attempts", () => {
    expect(isValidUuid("'; DROP TABLE stores; --")).toBe(false);
    expect(isValidUuid("550e8400-e29b-41d4-a716-446655440000' OR 1=1")).toBe(false);
  });
});

describe("error response helpers", () => {
  it("badRequest defaults to 400 + BAD_REQUEST", async () => {
    const r = badRequest("missing field");
    expect(r.status).toBe(400);
    const body = await r.json();
    expect(body).toEqual({ error: "missing field", code: "BAD_REQUEST" });
  });

  it("badRequest accepts custom code", async () => {
    const r = badRequest("bad", "CUSTOM_CODE");
    const body = await r.json();
    expect(body.code).toBe("CUSTOM_CODE");
  });

  it("unauthorized default + custom message", async () => {
    const r = unauthorized();
    expect(r.status).toBe(401);
    const body = await r.json();
    expect(body.code).toBe("UNAUTHORIZED");
    expect(body.error).toBe("Não autenticado");

    const custom = unauthorized("token expired");
    const cb = await custom.json();
    expect(cb.error).toBe("token expired");
  });

  it("forbidden uses 403 + FORBIDDEN", async () => {
    const r = forbidden();
    expect(r.status).toBe(403);
    const body = await r.json();
    expect(body.code).toBe("FORBIDDEN");
  });

  it("notFound uses 404 + NOT_FOUND", async () => {
    const r = notFound("missing");
    expect(r.status).toBe(404);
    const body = await r.json();
    expect(body.code).toBe("NOT_FOUND");
    expect(body.error).toBe("missing");
  });
});
