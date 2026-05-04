/**
 * Phase 4 D-06: Cloudflare-aware client-IP extraction.
 *
 * Order of preference (most trustworthy first):
 *   1. cf-connecting-ip — set by Cloudflare proxy. Single IP, always real client.
 *   2. x-forwarded-for first hop — nginx-forwarded chain. Comma-separated; take left-most.
 *   3. x-real-ip — fallback for non-CF non-nginx setups.
 *   4. "unknown" — last-resort sentinel (DO NOT use as a rate-limit key in prod;
 *      callers should treat "unknown" as a single shared bucket and fail-closed).
 *
 * Why cf-connecting-ip is preferred: behind Cloudflare, $remote_addr at nginx is
 * Cloudflare's edge IP, NOT the user. All CF-fronted users would share one bucket
 * (H-8 / CONCERNS §6) without this header preference.
 */

import type { NextRequest } from "next/server";

export function getClientIp(req: Request | NextRequest): string {
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp && cfIp.trim().length > 0) return cfIp.trim();

  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first && first.length > 0) return first;
  }

  const xreal = req.headers.get("x-real-ip");
  if (xreal && xreal.trim().length > 0) return xreal.trim();

  return "unknown";
}
