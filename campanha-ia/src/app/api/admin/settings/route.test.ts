import { describe, it, expect, vi, beforeEach } from "vitest";

// Default-non-admin claims; per-test override sets userId / role.
const authMock = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => authMock(),
}));

// Stub Supabase admin client so the GET path doesn't try to talk to a real DB.
const fromMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: fromMock }),
}));

import { GET } from "./route";

beforeEach(() => {
  authMock.mockReset();
  fromMock.mockReset();
});

describe("/api/admin/settings — 403 for non-admin (CONCERNS §12)", () => {
  it("returns 403 when no session", async () => {
    authMock.mockResolvedValue({ userId: null, sessionClaims: null });
    const res = await GET();
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/Acesso negado/i);
  });

  it("returns 403 when user is logged in but not admin (no metadata.role)", async () => {
    authMock.mockResolvedValue({
      userId: "user_nonadmin",
      sessionClaims: { metadata: {}, publicMetadata: {} },
    });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("allows admin via publicMetadata.role='admin'", async () => {
    authMock.mockResolvedValue({
      userId: "user_admin",
      sessionClaims: { metadata: {}, publicMetadata: { role: "admin" } },
    });
    // Stub the admin_settings select chain
    const orderMock = vi.fn().mockResolvedValue({ data: [], error: null });
    const selectMock = vi.fn().mockReturnValue({ order: orderMock });
    fromMock.mockReturnValue({ select: selectMock });
    const res = await GET();
    expect(res.status).toBe(200);
  });
});
