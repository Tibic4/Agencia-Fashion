/**
 * Admin guard — Phase 4 D-09/D-10/D-12.
 *
 * D-09: publicMetadata.role === 'admin' (or 'super_admin') is CANONICAL.
 *       sessionClaims.metadata.role is also accepted for back-compat with the
 *       Clerk JWT template that emits `metadata` instead of `publicMetadata`.
 * D-10: ADMIN_USER_IDS env stays as BREAK-GLASS. In production, using it emits
 *       a Sentry warn `admin.breakglass_used` so security knows when the safety
 *       net was needed.
 * D-12: every deny emits Sentry warn `admin.deny` (route, userId_hash, reason).
 *
 * The guard does NOT distinguish 'admin' from 'super_admin' — both are admins
 * here. Future RBAC layering can split them in a separate decision.
 */

import { auth } from "@clerk/nextjs/server";
import { createHash } from "crypto";
import { logger } from "@/lib/observability";

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const IS_PROD = process.env.NODE_ENV === "production";

function hashUserId(userId: string): string {
  return createHash("sha256").update(userId).digest("hex").slice(0, 12);
}

function emitDeny(reason: string, userId: string | null, route: string): void {
  logger.warn("admin.deny", {
    route,
    userId_hash: userId ? hashUserId(userId) : null,
    reason,
  });
}

function emitBreakglass(userId: string, route: string): void {
  if (!IS_PROD) return; // dev: env var works as today, no signal
  logger.warn("admin.breakglass_used", {
    route,
    userId_hash: hashUserId(userId),
  });
}

export type AdminCheck =
  | { isAdmin: true; userId: string; via: "publicMetadata" | "metadata" | "breakglass" }
  | { isAdmin: false; userId: null };

/**
 * Verifica se o user atual é admin.
 * `route` é o path do handler chamando o guard — usado nos signals Sentry.
 *
 * TODO(P4 follow-up): admin route handlers can pass `requireAdmin("/api/admin/settings")`
 * for richer Sentry data. Default `"unknown"` is back-compat for `await requireAdmin()` callers.
 */
export async function requireAdmin(route: string = "unknown"): Promise<AdminCheck> {
  const session = await auth();
  if (!session.userId) {
    emitDeny("no_session", null, route);
    return { isAdmin: false, userId: null };
  }

  // 1. Canonical: publicMetadata.role
  const claims = session.sessionClaims as Record<string, unknown> | undefined;
  const publicMetadata = claims?.publicMetadata as { role?: string } | undefined;
  const publicRole = publicMetadata?.role;
  if (publicRole === "admin" || publicRole === "super_admin") {
    return { isAdmin: true, userId: session.userId, via: "publicMetadata" };
  }

  // 2. Back-compat: sessionClaims.metadata.role (some Clerk JWT templates use `metadata`)
  const metadata = claims?.metadata as { role?: string } | undefined;
  const metaRole = metadata?.role;
  if (metaRole === "admin" || metaRole === "super_admin") {
    return { isAdmin: true, userId: session.userId, via: "metadata" };
  }

  // 3. Break-glass: ADMIN_USER_IDS env
  if (ADMIN_USER_IDS.includes(session.userId)) {
    emitBreakglass(session.userId, route);
    return { isAdmin: true, userId: session.userId, via: "breakglass" };
  }

  emitDeny("not_admin", session.userId, route);
  return { isAdmin: false, userId: null };
}
