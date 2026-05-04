/**
 * Phase 1 D-05/D-06/D-07: webhook event dedup helper.
 *
 * Pattern (per CONTEXT.md):
 *   1. Verify signature (caller).
 *   2. const { duplicate } = await dedupWebhook(provider, eventId, payload);
 *   3. if (duplicate) return 200 OK immediately.
 *   4. Process the event (caller).
 *   5. await markWebhookProcessed(provider, eventId) in finally.
 *
 * The PRIMARY KEY (provider, event_id) on webhook_events makes the INSERT the
 * dedup primitive — Postgres returns code 23505 (unique_violation) on the second
 * insert. We translate that into { duplicate: true }; any other DB error bubbles
 * up so the caller can decide between 200 (swallow per MP convention) and 5xx
 * (re-queue per RTDN convention).
 *
 * Service-role-only: webhook_events has RLS enabled with no policies. Only the
 * admin client (which bypasses RLS via service_role) can read/write. See
 * 20260503_180300_create_webhook_events.sql.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type WebhookProvider = "mp" | "clerk" | "rtdn";

export interface DedupResult {
  /** True iff the (provider, event_id) was already in webhook_events. */
  duplicate: boolean;
}

/**
 * Insert a webhook event into webhook_events.
 *
 * - Returns { duplicate: false } on first insert.
 * - Returns { duplicate: true } when the (provider, event_id) PK already exists
 *   (Postgres error code 23505).
 * - Throws on any other database error — caller decides 200 vs 5xx.
 */
export async function dedupWebhook(
  provider: WebhookProvider,
  eventId: string,
  payload: unknown
): Promise<DedupResult> {
  if (!eventId || typeof eventId !== "string") {
    throw new Error(`dedupWebhook: eventId must be a non-empty string (got ${JSON.stringify(eventId)})`);
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("webhook_events")
    .insert({
      provider,
      event_id: eventId,
      payload: payload as Record<string, unknown> | null,
    });

  if (!error) return { duplicate: false };
  // Postgres unique_violation
  if ((error as { code?: string }).code === "23505") return { duplicate: true };
  throw error;
}

/**
 * Mark a webhook event as fully processed. Idempotent: re-running just overwrites
 * processed_at with a newer timestamp.
 *
 * Caller MUST invoke this AFTER successful processing (in a `finally` is fine, but
 * skip if you want "ghost transactions" reconcile to surface failed handlers).
 */
export async function markWebhookProcessed(
  provider: WebhookProvider,
  eventId: string
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("provider", provider)
    .eq("event_id", eventId);
  if (error) throw error;
}
