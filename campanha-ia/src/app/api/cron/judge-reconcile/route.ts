import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest/client";
import { logger, captureError, hashStoreId } from "@/lib/observability";
import { timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Phase 02 D-16: reconcile cron for orphaned judge dispatches (H-13).
 *
 * Runs every 5 minutes (configured in Inngest cron, Vercel cron, or system
 * crontab calling this endpoint with Authorization: Bearer ${CRON_SECRET}).
 *
 * Behavior:
 *   1. Query campaigns WHERE judge_pending=true AND judge_retry_count<3
 *      AND (judge_last_attempt IS NULL OR judge_last_attempt < now() - interval '5 minutes')
 *   2. For each row: re-emit Inngest event using stored judge_payload,
 *      increment judge_retry_count, set judge_last_attempt = now()
 *   3. After ROW judge_retry_count would reach 3+: INSERT to judge_dead_letter,
 *      clear judge_pending=false, emit Sentry 'judge.dead_letter' alert (D-19)
 *
 * Auth: Authorization: Bearer ${CRON_SECRET} (same as /api/cron/downgrade-expired).
 */

const MAX_RETRIES = 3;
const STALE_THRESHOLD_MINUTES = 5;

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!header) return false;
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(header);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const cutoffIso = new Date(
      Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000,
    ).toISOString();

    // D-16 query: pending + below max retries + stale or never-attempted
    const { data: pending, error: queryErr } = await supabase
      .from("campaigns")
      .select("id, store_id, judge_payload, judge_retry_count, judge_last_attempt")
      .eq("judge_pending", true)
      .lt("judge_retry_count", MAX_RETRIES)
      .or(`judge_last_attempt.is.null,judge_last_attempt.lt.${cutoffIso}`);

    if (queryErr) {
      captureError(queryErr, {
        route: "cron.judge_reconcile",
        step: "query",
      });
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
    }

    if (!pending || pending.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, dead_lettered: 0, errors: 0 });
    }

    let processed = 0;
    let deadLettered = 0;
    let errors = 0;

    for (const row of pending) {
      try {
        const newRetryCount = (row.judge_retry_count ?? 0) + 1;

        if (newRetryCount > MAX_RETRIES) {
          // D-18: dead-letter terminal state
          const { error: dlErr } = await supabase.from("judge_dead_letter").insert({
            campaign_id: row.id,
            last_error: "exceeded_3_retries",
            retry_count: row.judge_retry_count ?? 0,
          });
          if (dlErr) {
            captureError(dlErr, {
              route: "cron.judge_reconcile",
              step: "dead_letter_insert",
              campaign_id: row.id,
            });
            errors++;
            continue;
          }

          // Clear judge_pending so cron stops touching this row
          await supabase
            .from("campaigns")
            .update({ judge_pending: false })
            .eq("id", row.id);

          // D-19: Sentry alert
          Sentry.captureMessage("judge.dead_letter", {
            level: "warning",
            tags: {
              route: "cron.judge_reconcile",
              campaign_id: row.id,
              store_id: row.store_id ? hashStoreId(row.store_id) : "unknown",
              reason: "exceeded_3_retries",
            },
          });

          logger.warn("judge_dead_letter_moved", {
            campaign_id: row.id,
            store_id: row.store_id ? hashStoreId(row.store_id) : "unknown",
            retry_count: row.judge_retry_count,
          });

          deadLettered++;
          continue;
        }

        // D-17: re-emit + bump counters
        if (!row.judge_payload) {
          // No payload to re-emit (shouldn't happen if producer wrote it correctly).
          // Mark as dead-letter immediately rather than retry forever.
          captureError(new Error("judge_payload missing on pending campaign"), {
            route: "cron.judge_reconcile",
            step: "missing_payload",
            campaign_id: row.id,
          });
          await supabase.from("judge_dead_letter").insert({
            campaign_id: row.id,
            last_error: "missing_payload",
            retry_count: row.judge_retry_count ?? 0,
          });
          await supabase
            .from("campaigns")
            .update({ judge_pending: false })
            .eq("id", row.id);
          deadLettered++;
          continue;
        }

        await inngest.send({
          name: "campaign/judge.requested",
          data: row.judge_payload as Record<string, unknown>,
        });

        await supabase
          .from("campaigns")
          .update({
            judge_retry_count: newRetryCount,
            judge_last_attempt: new Date().toISOString(),
          })
          .eq("id", row.id);

        logger.info("judge_reemit", {
          campaign_id: row.id,
          new_retry_count: newRetryCount,
        });

        processed++;
      } catch (e) {
        captureError(e, {
          route: "cron.judge_reconcile",
          step: "reemit_row",
          campaign_id: row.id,
        });
        errors++;
      }
    }

    return NextResponse.json({
      ok: true,
      processed,
      dead_lettered: deadLettered,
      errors,
    });
  } catch (e) {
    captureError(e, { route: "cron.judge_reconcile", step: "outer" });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
