/**
 * Phase 4 D-15: SSRF allowlist for image fetches.
 *
 * Strict allowlist by host (and port if non-default). Default seed: derive the
 * Supabase Storage origin from NEXT_PUBLIC_SUPABASE_URL. Override via env
 * IMAGE_HOST_ALLOWLIST (CSV of `https://host[:port]` entries).
 *
 * What this DOESN'T do (intentionally):
 *  - DNS resolution at runtime — slow, racy, and bypassable via DNS rebinding.
 *  - Block private CIDRs by IP — relies on hostname allowlist instead.
 *
 * Practical effect: only Supabase-hosted image URLs (or whatever the deployer
 * explicitly opts into) can reach `fetch()`. Probing 169.254.x.x / localhost /
 * internal services becomes impossible.
 */

function getDefaultAllowlist(): string[] {
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supaUrl) return [];
  try {
    const u = new URL(supaUrl);
    return [`${u.protocol}//${u.host}`];
  } catch {
    return [];
  }
}

function getAllowlist(): string[] {
  const fromEnv = (process.env.IMAGE_HOST_ALLOWLIST || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  if (fromEnv.length > 0) return fromEnv;
  return getDefaultAllowlist();
}

export interface AllowlistResult {
  allowed: boolean;
  reason?: string;
}

export function isAllowedImageUrl(rawUrl: string): AllowlistResult {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { allowed: false, reason: "empty_or_invalid_url" };
  }
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return { allowed: false, reason: "malformed_url" };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    return { allowed: false, reason: "unsupported_protocol" };
  }
  const allowlist = getAllowlist();
  if (allowlist.length === 0) {
    // No allowlist configured AND no NEXT_PUBLIC_SUPABASE_URL fallback → reject.
    return { allowed: false, reason: "allowlist_not_configured" };
  }
  const origin = `${u.protocol}//${u.host}`;
  if (!allowlist.includes(origin)) {
    return { allowed: false, reason: `host_not_allowlisted:${u.host}` };
  }
  return { allowed: true };
}

// Exported for tests + observability
export function _getEffectiveAllowlist(): string[] {
  return getAllowlist();
}
