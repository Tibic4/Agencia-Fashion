import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// We mock `jose` so we never have to call out to Google's JWKS or sign a
// real token in tests — the focus here is the pre-validation gating logic
// (header shape, env presence, email matching) of verifyPubSubJwt.
const jwtVerifyMock = vi.fn();
vi.mock("jose", () => ({
  createRemoteJWKSet: vi.fn(() => "fake-jwks"),
  jwtVerify: (...args: unknown[]) => jwtVerifyMock(...args),
}));

import { verifyPubSubJwt } from "./google-pubsub-auth";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  jwtVerifyMock.mockReset();
  process.env.GOOGLE_PUBSUB_AUDIENCE = "https://example.com/api/billing/rtdn";
  process.env.GOOGLE_PUBSUB_ALLOWED_SERVICE_ACCOUNT = "rtdn@iam.gserviceaccount.com";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("verifyPubSubJwt", () => {
  it("rejects when Authorization header is missing", async () => {
    const r = await verifyPubSubJwt(null);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("missing_bearer");
  });

  it("rejects non-Bearer schemes", async () => {
    const r = await verifyPubSubJwt("Basic abc:def");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("missing_bearer");
  });

  it("rejects empty token after Bearer", async () => {
    const r = await verifyPubSubJwt("Bearer   ");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("empty_token");
  });

  it("fails closed when env vars are missing", async () => {
    delete process.env.GOOGLE_PUBSUB_AUDIENCE;
    const r = await verifyPubSubJwt("Bearer fake-token");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("missing_pubsub_env");
    expect(jwtVerifyMock).not.toHaveBeenCalled();
  });

  it("rejects when payload email is unverified", async () => {
    jwtVerifyMock.mockResolvedValueOnce({
      payload: { email: "rtdn@iam.gserviceaccount.com", email_verified: false },
    });
    const r = await verifyPubSubJwt("Bearer abc.def.ghi");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("email_unverified");
  });

  it("rejects when payload email is missing", async () => {
    jwtVerifyMock.mockResolvedValueOnce({ payload: { email_verified: true } });
    const r = await verifyPubSubJwt("Bearer abc.def.ghi");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("email_unverified");
  });

  it("rejects when email does not match the allowlisted SA", async () => {
    jwtVerifyMock.mockResolvedValueOnce({
      payload: { email: "spoofed@evil.com", email_verified: true },
    });
    const r = await verifyPubSubJwt("Bearer abc.def.ghi");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/^email_mismatch:spoofed@evil\.com$/);
  });

  it("returns ok + email when JWT verifies and email matches", async () => {
    jwtVerifyMock.mockResolvedValueOnce({
      payload: { email: "rtdn@iam.gserviceaccount.com", email_verified: true },
    });
    const r = await verifyPubSubJwt("Bearer abc.def.ghi");
    expect(r.ok).toBe(true);
    expect(r.email).toBe("rtdn@iam.gserviceaccount.com");
  });

  it("captures jose error name as reason on signature/expired/etc failures", async () => {
    class JWTExpired extends Error {
      override name = "JWTExpired";
    }
    jwtVerifyMock.mockRejectedValueOnce(new JWTExpired("token expired"));
    const r = await verifyPubSubJwt("Bearer abc.def.ghi");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("JWTExpired");
  });

  it("falls back to verify_failed for non-Error throws", async () => {
    jwtVerifyMock.mockRejectedValueOnce("string error");
    const r = await verifyPubSubJwt("Bearer abc.def.ghi");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("verify_failed");
  });
});
