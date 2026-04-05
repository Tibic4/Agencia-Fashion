import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/campaign/generate
 * 
 * API pública para clientes do plano Agência.
 * Autenticação via header: Authorization: Bearer sk_live_...
 * 
 * Body: { image_url, price, objective?, target_audience?, category? }
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Validar API key
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "API key ausente. Use: Authorization: Bearer sk_live_..." }, { status: 401 });
    }

    const apiKey = authHeader.slice(7);
    const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

    const supabase = createAdminClient();
    const { data: keyRecord } = await supabase
      .from("api_keys")
      .select("id, store_id, is_active")
      .eq("key_hash", keyHash)
      .single();

    if (!keyRecord || !keyRecord.is_active) {
      return NextResponse.json({ error: "API key inválida ou revogada" }, { status: 401 });
    }

    // Atualizar last_used_at
    await supabase
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", keyRecord.id);

    // 2. Validar body
    const body = await req.json();
    const { image_url, price, objective, target_audience } = body;

    if (!image_url || !price) {
      return NextResponse.json({ error: "Campos obrigatórios: image_url, price" }, { status: 400 });
    }

    // 3. Chamar o mesmo endpoint interno de geração
    const internalUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/campaign/generate`;
    
    const formData = new FormData();
    // Buscar a imagem e enviar como blob
    const imgResponse = await fetch(image_url);
    if (!imgResponse.ok) {
      return NextResponse.json({ error: "Não foi possível baixar a imagem da URL fornecida" }, { status: 400 });
    }
    const imgBlob = await imgResponse.blob();
    formData.append("image", imgBlob, "product.jpg");
    formData.append("price", String(price));
    formData.append("objective", objective || "vender");
    formData.append("target_audience", target_audience || "");
    formData.append("api_store_id", keyRecord.store_id);

    const generateResponse = await fetch(internalUrl, {
      method: "POST",
      body: formData,
    });

    const result = await generateResponse.json();

    if (!generateResponse.ok) {
      return NextResponse.json({ error: result.error || "Erro na geração" }, { status: generateResponse.status });
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[API:v1:generate]", message);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
