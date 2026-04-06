import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/guard";

export const dynamic = "force-dynamic";

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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

/**
 * POST /api/admin/showcase — criar novo item com upload de fotos (admin only)
 * Body: FormData com before_photo, after_photo, caption?
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

    // Upload ANTES
    const beforePath = `before_${timestamp}.${beforeFile.type.split("/")[1] || "jpg"}`;
    const beforeBuffer = Buffer.from(await beforeFile.arrayBuffer());
    const { error: beforeErr } = await supabase.storage
      .from("showcase")
      .upload(beforePath, beforeBuffer, { contentType: beforeFile.type, upsert: true });

    if (beforeErr) throw new Error(`Upload ANTES falhou: ${beforeErr.message}`);

    // Upload DEPOIS
    const afterPath = `after_${timestamp}.${afterFile.type.split("/")[1] || "jpg"}`;
    const afterBuffer = Buffer.from(await afterFile.arrayBuffer());
    const { error: afterErr } = await supabase.storage
      .from("showcase")
      .upload(afterPath, afterBuffer, { contentType: afterFile.type, upsert: true });

    if (afterErr) throw new Error(`Upload DEPOIS falhou: ${afterErr.message}`);

    // Get public URLs
    const { data: beforeUrl } = supabase.storage.from("showcase").getPublicUrl(beforePath);
    const { data: afterUrl } = supabase.storage.from("showcase").getPublicUrl(afterPath);

    // Insert DB
    const { data, error } = await supabase
      .from("showcase_items")
      .insert({
        before_photo_url: beforeUrl.publicUrl,
        after_photo_url: afterUrl.publicUrl,
        caption: caption || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[API:admin/showcase] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/showcase?id=xxx — remover item (admin only)
 */
export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.isAdmin) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from("showcase_items").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
