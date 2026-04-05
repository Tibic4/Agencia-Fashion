import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStoreByClerkId, getStorePlanName, hasPublicApi } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * GET /api/apikeys — lista API keys da loja
 * POST /api/apikeys — cria nova API key
 * DELETE /api/apikeys — revoga uma API key
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session.userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const store = await getStoreByClerkId(session.userId);
    if (!store) return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });

    const planName = await getStorePlanName(store.id);
    if (!hasPublicApi(planName)) {
      return NextResponse.json({ error: "API pública disponível apenas no plano Agência", code: "PLAN_UPGRADE_REQUIRED" }, { status: 403 });
    }

    const supabase = createAdminClient();
    const { data } = await supabase
      .from("api_keys")
      .select("id, name, key_prefix, created_at, last_used_at, is_active")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false });

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: unknown) {
    console.error("[API:apikeys]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session.userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const store = await getStoreByClerkId(session.userId);
    if (!store) return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });

    const planName = await getStorePlanName(store.id);
    if (!hasPublicApi(planName)) {
      return NextResponse.json({ error: "API pública disponível apenas no plano Agência" }, { status: 403 });
    }

    const body = await req.json();
    const name = body.name || "Chave API";

    // Gerar chave segura
    const rawKey = `sk_live_${crypto.randomBytes(32).toString("hex")}`;
    const keyPrefix = rawKey.slice(0, 12) + "...";
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("api_keys")
      .insert({
        store_id: store.id,
        name,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        is_active: true,
      })
      .select("id, name, key_prefix, created_at")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: { ...data, key: rawKey },
      message: "Salve esta chave — ela não será exibida novamente.",
    });
  } catch (error: unknown) {
    console.error("[API:apikeys]", error);
    return NextResponse.json({ error: "Erro ao criar chave" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session.userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const store = await getStoreByClerkId(session.userId);
    if (!store) return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const keyId = searchParams.get("id");
    if (!keyId) return NextResponse.json({ error: "ID da chave é obrigatório" }, { status: 400 });

    const supabase = createAdminClient();
    await supabase
      .from("api_keys")
      .update({ is_active: false })
      .eq("id", keyId)
      .eq("store_id", store.id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[API:apikeys]", error);
    return NextResponse.json({ error: "Erro ao revogar chave" }, { status: 500 });
  }
}
