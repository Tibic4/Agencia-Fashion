import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isAllowedImageUrl } from "./image-host-allowlist";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
  vi.stubEnv("IMAGE_HOST_ALLOWLIST", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isAllowedImageUrl (D-15 SSRF)", () => {
  it("allows Supabase Storage origin (default seed)", () => {
    expect(isAllowedImageUrl("https://abc.supabase.co/storage/v1/object/public/x.jpg").allowed).toBe(true);
  });

  it("blocks 169.254 link-local IP probe", () => {
    const r = isAllowedImageUrl("http://169.254.169.254/latest/meta-data/");
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/host_not_allowlisted/);
  });

  it("blocks localhost", () => {
    expect(isAllowedImageUrl("http://localhost:3000/x").allowed).toBe(false);
    expect(isAllowedImageUrl("http://127.0.0.1/x").allowed).toBe(false);
  });

  it("blocks malformed URL", () => {
    expect(isAllowedImageUrl("not a url").allowed).toBe(false);
  });

  it("blocks file:// and javascript: schemes", () => {
    expect(isAllowedImageUrl("file:///etc/passwd").allowed).toBe(false);
    expect(isAllowedImageUrl("javascript:alert(1)").allowed).toBe(false);
  });

  it("respects IMAGE_HOST_ALLOWLIST env override (CSV)", () => {
    vi.stubEnv("IMAGE_HOST_ALLOWLIST", "https://cdn.example.com,https://other.cdn.io");
    expect(isAllowedImageUrl("https://cdn.example.com/x.jpg").allowed).toBe(true);
    expect(isAllowedImageUrl("https://abc.supabase.co/x.jpg").allowed).toBe(false);
  });

  it("returns allowlist_not_configured when no env + no SUPABASE URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("IMAGE_HOST_ALLOWLIST", "");
    const r = isAllowedImageUrl("https://anywhere.test/x.jpg");
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/allowlist_not_configured/);
  });
});
