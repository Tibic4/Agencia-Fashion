import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const authMock = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => authMock(),
}));

const loggerWarnMock = vi.fn();
vi.mock("@/lib/observability", () => ({
  logger: { warn: loggerWarnMock, info: vi.fn(), error: vi.fn() },
}));

beforeEach(() => {
  authMock.mockReset();
  loggerWarnMock.mockReset();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("ADMIN_USER_IDS", "user_breakglass_1,user_breakglass_2");
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("requireAdmin (D-09/D-10/D-12)", () => {
  it("admits via publicMetadata.role='admin' (canonical)", async () => {
    authMock.mockResolvedValue({
      userId: "u1",
      sessionClaims: { publicMetadata: { role: "admin" }, metadata: {} },
    });
    const { requireAdmin } = await import("./guard");
    const r = await requireAdmin("/api/admin/foo");
    expect(r.isAdmin).toBe(true);
    if (r.isAdmin) expect(r.via).toBe("publicMetadata");
    expect(loggerWarnMock).not.toHaveBeenCalled(); // no deny, no breakglass
  });

  it("admits via metadata.role='admin' (back-compat)", async () => {
    authMock.mockResolvedValue({
      userId: "u2",
      sessionClaims: { metadata: { role: "admin" }, publicMetadata: {} },
    });
    const { requireAdmin } = await import("./guard");
    const r = await requireAdmin("/api/admin/foo");
    expect(r.isAdmin).toBe(true);
    if (r.isAdmin) expect(r.via).toBe("metadata");
  });

  it("admits via ADMIN_USER_IDS break-glass + emits admin.breakglass_used in prod (D-10)", async () => {
    authMock.mockResolvedValue({
      userId: "user_breakglass_1",
      sessionClaims: { publicMetadata: {}, metadata: {} },
    });
    const { requireAdmin } = await import("./guard");
    const r = await requireAdmin("/api/admin/foo");
    expect(r.isAdmin).toBe(true);
    if (r.isAdmin) expect(r.via).toBe("breakglass");
    expect(loggerWarnMock).toHaveBeenCalledWith(
      "admin.breakglass_used",
      expect.objectContaining({ route: "/api/admin/foo" }),
    );
  });

  it("does NOT emit breakglass warn in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.resetModules();
    authMock.mockResolvedValue({
      userId: "user_breakglass_1",
      sessionClaims: { publicMetadata: {}, metadata: {} },
    });
    const { requireAdmin } = await import("./guard");
    const r = await requireAdmin("/api/admin/foo");
    expect(r.isAdmin).toBe(true);
    expect(loggerWarnMock).not.toHaveBeenCalledWith("admin.breakglass_used", expect.anything());
  });

  it("denies + emits admin.deny when no session", async () => {
    authMock.mockResolvedValue({ userId: null, sessionClaims: null });
    const { requireAdmin } = await import("./guard");
    const r = await requireAdmin("/api/admin/foo");
    expect(r.isAdmin).toBe(false);
    expect(loggerWarnMock).toHaveBeenCalledWith(
      "admin.deny",
      expect.objectContaining({ route: "/api/admin/foo", reason: "no_session", userId_hash: null }),
    );
  });

  it("denies + emits admin.deny with hashed userId when not admin", async () => {
    authMock.mockResolvedValue({
      userId: "u_outsider",
      sessionClaims: { publicMetadata: { role: "user" }, metadata: {} },
    });
    const { requireAdmin } = await import("./guard");
    const r = await requireAdmin("/api/admin/foo");
    expect(r.isAdmin).toBe(false);
    expect(loggerWarnMock).toHaveBeenCalledWith(
      "admin.deny",
      expect.objectContaining({
        route: "/api/admin/foo",
        reason: "not_admin",
        userId_hash: expect.stringMatching(/^[a-f0-9]{12}$/),
      }),
    );
  });

  it("publicMetadata wins over conflicting metadata role", async () => {
    authMock.mockResolvedValue({
      userId: "u3",
      sessionClaims: { publicMetadata: { role: "admin" }, metadata: { role: "user" } },
    });
    const { requireAdmin } = await import("./guard");
    const r = await requireAdmin();
    expect(r.isAdmin).toBe(true);
    if (r.isAdmin) expect(r.via).toBe("publicMetadata");
  });
});
