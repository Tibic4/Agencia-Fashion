import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/observability";
import { auth } from "@clerk/nextjs/server";
import {
  getStoreByClerkId,
  setRegenerateReason,
  isValidRegenerateReason,
  VALID_REGENERATE_REASONS,
  type RegenerateReason,
} from "@/lib/db";

/**
 * POST /api/campaign/[id]/regenerate
 *
 * Reason-capture only (D-01 + D-03): body = { "reason": "<one of 5 enum values>" }
 *  → persists campaigns.regenerate_reason, returns { success, data: { reason, free: true } }
 *  → does NOT consume a regeneration credit (FREE in MVP to maximize feedback density).
 *
 * The legacy "consume a credit and bump regen_count" branch was gated behind
 * FEATURE_REGENERATE_CAMPAIGN. The flag was dropped in M2-04-04 (default-drop
 * per parking-lot decision) — neither product nor pricing has committed to a
 * paid regenerate flow, so the gated code was dead. If we revive paid
 * regenerate later, recover canRegenerate + incrementRegenCount from git
 * history (the function bodies are preserved in lib/db/index.ts via test).
 *
 * The favorite-flag column is intentionally NOT touched here (D-02 — favorite
 * stays a separate signal).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const store = await getStoreByClerkId(session.userId);
    if (!store) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
    }

    const { id } = await params;

    let body: unknown = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }

    let reason: RegenerateReason | null = null;
    if (body && typeof body === "object" && "reason" in body) {
      const candidate = (body as Record<string, unknown>).reason;
      if (!isValidRegenerateReason(candidate)) {
        return NextResponse.json(
          {
            error: "reason inválido",
            code: "INVALID_REASON",
            validReasons: [...VALID_REGENERATE_REASONS],
          },
          { status: 400 }
        );
      }
      reason = candidate;
    }

    if (!reason) {
      // No reason supplied → 400. Previously this fell through to the
      // FEATURE_REGENERATE_CAMPAIGN-gated credit path (always 404 in prod).
      return NextResponse.json(
        {
          error: "reason obrigatório",
          code: "MISSING_REASON",
          validReasons: [...VALID_REGENERATE_REASONS],
        },
        { status: 400 },
      );
    }

    await setRegenerateReason(id, store.id, reason);
    return NextResponse.json({
      success: true,
      data: { reason, free: true },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    logger.error("[API:regenerate] Error:", message);
    return NextResponse.json({ error: "Erro ao registrar feedback de regeneração" }, { status: 500 });
  }
}
