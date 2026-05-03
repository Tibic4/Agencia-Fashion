import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getStoreByClerkId,
  canRegenerate,
  incrementRegenCount,
  setRegenerateReason,
  isValidRegenerateReason,
  VALID_REGENERATE_REASONS,
  type RegenerateReason,
} from "@/lib/db";
import { env } from "@/lib/env";

/**
 * POST /api/campaign/[id]/regenerate
 *
 * Two operating modes:
 *   1. Reason-capture (D-01 + D-03): body = { "reason": "<one of 5 enum values>" }
 *      → persists campaigns.regenerate_reason, returns { success, data: { reason, free: true } }
 *      → does NOT consume a regeneration credit (FREE this phase to maximize feedback density).
 *   2. Legacy regenerate (no body): consumes a credit via canRegenerate / incrementRegenCount.
 *
 * The favorite-flag column is intentionally NOT touched here (D-02 — favorite stays a separate signal).
 *
 * Feature gate: FEATURE_REGENERATE_CAMPAIGN=1 destrava a rota. Default = off.
 * Quando off, devolve 404 (Not Found) em vez de 403 — pra qualquer cliente
 * que tente bater aqui (legado / futuro botão UI), a resposta deixa claro
 * "feature não existe" e não "você não tem permissão / atingiu limite".
 *
 * O mesmo flag é checado também em `canRegenerate` (src/lib/db/index.ts) —
 * defesa em profundidade caso alguém chame a função fora dessa rota.
 */
function regenerateEnabled(): boolean {
  const v = env.FEATURE_REGENERATE_CAMPAIGN;
  if (!v) return false;
  return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "on";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!regenerateEnabled()) {
    return NextResponse.json(
      {
        error: "Feature de regeneração não está disponível",
        code: "FEATURE_DISABLED",
      },
      { status: 404 }
    );
  }

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

    // Parse optional reason body. Body absent or unparseable → legacy path.
    // Body present with `reason` key → must be a valid enum value (else 400).
    let reason: RegenerateReason | null = null;
    let body: unknown = null;
    try {
      body = await req.json();
    } catch {
      // No body / invalid JSON — treat as legacy no-reason regenerate.
      body = null;
    }

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

    if (reason) {
      // D-03: free regenerate when reason is captured. Skip canRegenerate +
      // incrementRegenCount entirely. Persist the reason and return success.
      await setRegenerateReason(id, store.id, reason);
      return NextResponse.json({
        success: true,
        data: { reason, free: true },
      });
    }

    // Legacy path (no reason): consume a regeneration credit.
    const regen = await canRegenerate(id, store.id);

    if (!regen.allowed) {
      return NextResponse.json({
        error: "Limite de regenerações atingido para esta campanha",
        code: "REGEN_LIMIT_REACHED",
        data: { used: regen.used, limit: regen.limit },
      }, { status: 403 });
    }

    const newCount = await incrementRegenCount(id, store.id);

    return NextResponse.json({
      success: true,
      data: { used: newCount, limit: regen.limit, free: false },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[API:regenerate] Error:", message);
    return NextResponse.json({ error: "Erro ao verificar regeneração" }, { status: 500 });
  }
}
