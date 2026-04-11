import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/guard";
import sharp from "sharp";

export const dynamic = "force-dynamic";

/**
 * Extrai o path de storage a partir da URL pública do Supabase
 * Ex: https://xxx.supabase.co/storage/v1/object/public/showcase/before_123.jpg → before_123.jpg
 */
function extractStoragePath(publicUrl: string): string | null {
  const match = publicUrl.match(/\/showcase\/(.+)$/);
  return match ? match[1] : null;
}

/* ═══════════════════════════════════════
   Redimensionamento automático para 3:4
   - Max 1200px wide (otimiza storage + load time)
   - Crop inteligente: prioriza topo (rosto da modelo)
   - Output JPEG 85% (bom equilíbrio qualidade/tamanho)
   ═══════════════════════════════════════ */
const TARGET_RATIO = 3 / 4; // largura / altura
const MAX_WIDTH = 1200;
const JPEG_QUALITY = 85;

async function processImage(fileBuffer: Buffer): Promise<Buffer> {
  const img = sharp(fileBuffer);
  const metadata = await img.metadata();

  const srcW = metadata.width ?? 800;
  const srcH = metadata.height ?? 1067;
  const srcRatio = srcW / srcH;

  let resized: sharp.Sharp;

  if (Math.abs(srcRatio - TARGET_RATIO) < 0.05) {
    // Já está perto de 3:4 — só redimensionar
    resized = img.resize({
      width: Math.min(srcW, MAX_WIDTH),
      withoutEnlargement: true,
    });
  } else if (srcRatio > TARGET_RATIO) {
    // Foto mais larga que 3:4 (ex: 16:9) — crop lateral, manter altura
    const targetW = Math.round(srcH * TARGET_RATIO);
    resized = img
      .resize({
        width: targetW,
        height: srcH,
        fit: "cover",
        position: "centre", // centraliza o crop horizontal
      })
      .resize({
        width: Math.min(targetW, MAX_WIDTH),
        withoutEnlargement: true,
      });
  } else {
    // Foto mais alta que 3:4 (ex: 9:16) — crop vertical, priorizar topo (rosto)
    const targetH = Math.round(srcW / TARGET_RATIO);
    resized = img
      .resize({
        width: srcW,
        height: targetH,
        fit: "cover",
        position: "top", // prioriza rosto da modelo
      })
      .resize({
        width: Math.min(srcW, MAX_WIDTH),
        withoutEnlargement: true,
      });
  }

  return resized
    .jpeg({ quality: JPEG_QUALITY, progressive: true })
    .toBuffer();
}

/**
 * GET /api/admin/showcase — lista todos (admin only)
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin.isAdmin) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("showcase_items")
    .select("*")
    .order("sort_order")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[API:admin/showcase] GET error:", error.message);
    return NextResponse.json({ error: "Erro ao listar vitrine" }, { status: 500 });
  }
  return NextResponse.json({ success: true, data });
}

/**
 * POST /api/admin/showcase — criar novo item com upload de fotos (admin only)
 * Body: FormData com before_photo, after_photo, caption?
 * 
 * ✨ Auto-processa as imagens para 3:4 (retrato moda) antes do upload:
 *    - Redimensiona para max 1200px de largura
 *    - Crop inteligente priorizando o topo (rosto)
 *    - Converte para JPEG progressivo 85% quality
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.isAdmin) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const beforeFile = formData.get("before_photo") as File | null;
    const afterFile = formData.get("after_photo") as File | null;
    const caption = formData.get("caption") as string | null;

    if (!beforeFile || !afterFile) {
      return NextResponse.json({ error: "Envie as duas fotos (antes e depois)" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const timestamp = Date.now();

    // Processar + Upload ANTES
    const beforeRaw = Buffer.from(await beforeFile.arrayBuffer());
    const beforeProcessed = await processImage(beforeRaw);
    const beforePath = `before_${timestamp}.jpg`;
    const { error: beforeErr } = await supabase.storage
      .from("showcase")
      .upload(beforePath, beforeProcessed, { contentType: "image/jpeg", upsert: true });

    if (beforeErr) throw new Error(`Upload ANTES falhou: ${beforeErr.message}`);

    // Processar + Upload DEPOIS
    const afterRaw = Buffer.from(await afterFile.arrayBuffer());
    const afterProcessed = await processImage(afterRaw);
    const afterPath = `after_${timestamp}.jpg`;
    const { error: afterErr } = await supabase.storage
      .from("showcase")
      .upload(afterPath, afterProcessed, { contentType: "image/jpeg", upsert: true });

    if (afterErr) throw new Error(`Upload DEPOIS falhou: ${afterErr.message}`);

    console.log(`[API:admin/showcase] ✅ Fotos processadas — antes: ${(beforeRaw.length / 1024).toFixed(0)}KB→${(beforeProcessed.length / 1024).toFixed(0)}KB, depois: ${(afterRaw.length / 1024).toFixed(0)}KB→${(afterProcessed.length / 1024).toFixed(0)}KB`);

    // Get public URLs
    const { data: beforeUrl } = supabase.storage.from("showcase").getPublicUrl(beforePath);
    const { data: afterUrl } = supabase.storage.from("showcase").getPublicUrl(afterPath);

    // Buscar maior sort_order pra novo item ir pro final
    const { data: lastItem } = await supabase
      .from("showcase_items")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = (lastItem?.sort_order ?? 0) + 1;

    // Insert DB
    const { data, error } = await supabase
      .from("showcase_items")
      .insert({
        before_photo_url: beforeUrl.publicUrl,
        after_photo_url: afterUrl.publicUrl,
        caption: caption || null,
        is_active: true,
        sort_order: nextOrder,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[API:admin/showcase] Error:", message);
    return NextResponse.json({ error: "Erro ao criar item da vitrine" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/showcase — atualizar item (caption, is_active, sort_order)
 * Body JSON: { id, caption?, is_active?, sort_order? }
 */
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.isAdmin) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
    }

    // Só permitir campos válidos
    const allowed: Record<string, unknown> = {};
    if ("caption" in updates) allowed.caption = updates.caption || null;
    if ("is_active" in updates) allowed.is_active = Boolean(updates.is_active);
    if ("use_in_tips" in updates) allowed.use_in_tips = Boolean(updates.use_in_tips);
    if ("sort_order" in updates) allowed.sort_order = Number(updates.sort_order);

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("showcase_items")
      .update(allowed)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[API:admin/showcase] PATCH error:", message);
    return NextResponse.json({ error: "Erro ao atualizar item" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/showcase?id=xxx — remover item + limpar storage (admin only)
 */
export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.isAdmin) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

  const supabase = createAdminClient();

  // 1. Buscar URLs para limpar o storage
  const { data: item } = await supabase
    .from("showcase_items")
    .select("before_photo_url, after_photo_url")
    .eq("id", id)
    .single();

  // 2. Deletar do banco
  const { error } = await supabase.from("showcase_items").delete().eq("id", id);
  if (error) {
    console.error("[API:admin/showcase] DELETE error:", error.message);
    return NextResponse.json({ error: "Erro ao deletar item" }, { status: 500 });
  }

  // 3. Limpar arquivos do storage (best-effort, não falha se der erro)
  if (item) {
    const paths = [
      extractStoragePath(item.before_photo_url),
      extractStoragePath(item.after_photo_url),
    ].filter(Boolean) as string[];

    if (paths.length > 0) {
      const { error: storageErr } = await supabase.storage.from("showcase").remove(paths);
      if (storageErr) {
        console.warn("[API:admin/showcase] Storage cleanup error:", storageErr.message);
      } else {
        console.log(`[API:admin/showcase] ✅ Storage limpo: ${paths.join(", ")}`);
      }
    }
  }

  return NextResponse.json({ success: true });
}
