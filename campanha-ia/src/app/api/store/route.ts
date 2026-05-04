import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/observability";
import { auth } from "@clerk/nextjs/server";
import { getStoreByClerkId } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import {
  AuthError,
  NotFoundError,
  CrialookError,
  respondToError,
} from "@/lib/errors";

const StorePatchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  city: z.string().max(50).optional(),
  state: z.string().max(50).optional(),
  instagram: z.string().max(60).optional(),
  segment: z.string().max(80).optional(),
  brand_colors: z.object({ primary: z.string().max(20).optional() }).optional(),
});

export const dynamic = "force-dynamic";

/**
 * GET /api/store
 * 
 * Retorna a loja do usuário logado.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session.userId) {
      throw new AuthError();
    }

    const store = await getStoreByClerkId(session.userId);
    if (!store) {
      throw new NotFoundError("Loja não encontrada", "NO_STORE");
    }

    return NextResponse.json({ success: true, data: store });
  } catch (error: unknown) {
    if (error instanceof CrialookError) return respondToError(error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    logger.error("[API:store] Error:", message);
    return NextResponse.json({ error: "Erro ao buscar loja" }, { status: 500 });
  }
}

/**
 * PATCH /api/store
 * 
 * Atualiza dados da loja do usuário logado.
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session.userId) {
      throw new AuthError();
    }

    const store = await getStoreByClerkId(session.userId);
    if (!store) {
      throw new NotFoundError("Loja não encontrada", "NO_STORE");
    }

    const rawBody = await req.json();
    const parsed = StorePatchSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const body = parsed.data;
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.city !== undefined) updates.city = body.city;
    if (body.state !== undefined) updates.state = body.state;
    if (body.instagram !== undefined) updates.instagram_handle = body.instagram;
    if (body.segment !== undefined) updates.segment_primary = body.segment;
    if (body.brand_colors !== undefined) updates.brand_colors = body.brand_colors;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("stores")
      .update(updates)
      .eq("id", store.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof CrialookError) return respondToError(error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    logger.error("[API:store:PATCH] Error:", message);
    return NextResponse.json({ error: "Erro ao atualizar loja" }, { status: 500 });
  }
}
