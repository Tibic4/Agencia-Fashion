import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const createBrowserMock = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createBrowserClient: (...args: unknown[]) => {
    createBrowserMock(...args);
    return { __client: true };
  },
}));

import { createClient } from "./client";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  createBrowserMock.mockReset();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test-key";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("supabase/client.createClient", () => {
  it("forwards the public URL + anon key from env", () => {
    createClient();
    expect(createBrowserMock).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "anon-test-key",
    );
  });
});
