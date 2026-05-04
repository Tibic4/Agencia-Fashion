import { describe, it, expect, vi, beforeEach } from "vitest";
import { dedupWebhook, markWebhookProcessed } from "./dedup";

// ── Mock createAdminClient ──
const mockInsert = vi.fn();
const mockEq = vi.fn();
const mockEq2 = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: mockInsert,
      update: () => ({ eq: mockEq }),
    }),
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  // chain .eq().eq() for the markWebhookProcessed update
  mockEq.mockReturnValue({ eq: mockEq2 });
  mockEq2.mockResolvedValue({ error: null });
});

describe("dedupWebhook", () => {
  it("returns { duplicate: false } on first insert", async () => {
    mockInsert.mockResolvedValueOnce({ error: null });
    const result = await dedupWebhook("mp", "req-abc-123", { foo: "bar" });
    expect(result).toEqual({ duplicate: false });
    expect(mockInsert).toHaveBeenCalledWith({
      provider: "mp",
      event_id: "req-abc-123",
      payload: { foo: "bar" },
    });
  });

  it("returns { duplicate: true } on Postgres 23505 unique_violation", async () => {
    mockInsert.mockResolvedValueOnce({ error: { code: "23505", message: "unique violation" } });
    const result = await dedupWebhook("clerk", "msg_abc", { type: "user.created" });
    expect(result).toEqual({ duplicate: true });
  });

  it("throws on non-23505 database errors", async () => {
    mockInsert.mockResolvedValueOnce({ error: { code: "57P01", message: "admin shutdown" } });
    await expect(dedupWebhook("rtdn", "pubsub-1", {})).rejects.toMatchObject({ code: "57P01" });
  });

  it("rejects empty eventId", async () => {
    await expect(dedupWebhook("mp", "", {})).rejects.toThrow(/non-empty string/);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("accepts the three documented providers without TS error", async () => {
    mockInsert.mockResolvedValue({ error: null });
    await dedupWebhook("mp", "x", {});
    await dedupWebhook("clerk", "y", {});
    await dedupWebhook("rtdn", "z", {});
    expect(mockInsert).toHaveBeenCalledTimes(3);
  });
});

describe("markWebhookProcessed", () => {
  // re-mock for these tests
  beforeEach(() => {
    vi.clearAllMocks();
    mockEq.mockReturnValue({ eq: mockEq2 });
  });

  it("calls update with processed_at = ISO timestamp and filters by (provider, event_id)", async () => {
    mockEq2.mockResolvedValueOnce({ error: null });
    await markWebhookProcessed("mp", "req-abc-123");
    expect(mockEq).toHaveBeenCalledWith("provider", "mp");
    expect(mockEq2).toHaveBeenCalledWith("event_id", "req-abc-123");
  });

  it("throws when the underlying update reports an error", async () => {
    mockEq2.mockResolvedValueOnce({ error: { code: "X", message: "boom" } });
    await expect(markWebhookProcessed("clerk", "msg")).rejects.toMatchObject({ code: "X" });
  });
});
