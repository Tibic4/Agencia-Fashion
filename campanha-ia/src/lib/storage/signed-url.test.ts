import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSignedStorageUrl } from "./signed-url";

function makeClient(stub: {
  signed?: unknown;
  publicUrl?: string;
  throwOnSign?: boolean;
}): SupabaseClient {
  return {
    storage: {
      from: () => ({
        createSignedUrl: vi.fn(async () => {
          if (stub.throwOnSign) throw new Error("network");
          return stub.signed ?? { data: null, error: { message: "x" } };
        }),
        getPublicUrl: () => ({
          data: { publicUrl: stub.publicUrl ?? "https://public/url" },
        }),
      }),
    },
  } as unknown as SupabaseClient;
}

describe("getSignedStorageUrl", () => {
  it("returns the signed URL when createSignedUrl succeeds", async () => {
    const c = makeClient({
      signed: { data: { signedUrl: "https://signed/abc" } },
      publicUrl: "https://public/abc",
    });
    expect(await getSignedStorageUrl(c, "bucket", "path/x.png")).toBe("https://signed/abc");
  });

  it("falls back to public URL when signed call returns error", async () => {
    const c = makeClient({
      signed: { data: null, error: { message: "denied" } },
      publicUrl: "https://public/fallback",
    });
    expect(await getSignedStorageUrl(c, "b", "p")).toBe("https://public/fallback");
  });

  it("falls back to public URL when signed call throws", async () => {
    const c = makeClient({
      throwOnSign: true,
      publicUrl: "https://public/throws",
    });
    expect(await getSignedStorageUrl(c, "b", "p")).toBe("https://public/throws");
  });

  it("uses default expiresIn=3600 when omitted (still resolves)", async () => {
    const c = makeClient({
      signed: { data: { signedUrl: "https://signed/default" } },
    });
    expect(await getSignedStorageUrl(c, "b", "p")).toBe("https://signed/default");
  });
});
