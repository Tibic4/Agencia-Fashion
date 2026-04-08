import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStoreByClerkId } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/store/logo
 * 
 * Upload de logo da loja para Supabase Storage.
 * Aceita form-data com campo "logo" (image file).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const store = await getStoreByClerkId(session.userId);
    if (!store) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get("logo") as File | null;

    if (!file || !file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Arquivo inválido" }, { status: 400 });
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Imagem muito grande (max 5MB)" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const ext = file.name.split(".").pop() || "png";
    const path = `logos/${store.id}.${ext}`;

    // Upload to storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from("store-assets")
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("[API:store/logo] Upload error:", uploadError);
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("store-assets")
      .getPublicUrl(path);

    const logoUrl = urlData.publicUrl;

    // Update store record
    const { error: updateError } = await supabase
      .from("stores")
      .update({ logo_url: logoUrl })
      .eq("id", store.id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, url: logoUrl, logo_url: logoUrl });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[API:store/logo] Error:", message);
    return NextResponse.json({ error: "Erro ao enviar logo" }, { status: 500 });
  }
}
