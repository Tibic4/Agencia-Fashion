import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getStoreByClerkId, createStoreModel, listStoreModels, getStorePlanName, getModelLimitForPlan, consumeCredit, getStoreCredits } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

/**
 * POST /api/model/create
 * Salva as configurações da modelo no banco.
 * Dispara geração de preview em background via Inngest.
 * Retorna imediatamente (<1s) com o model.id.
 *
 * Body (FormData):
 *   - skinTone: string
 *   - hairStyle: string
 *   - bodyType: string
 *   - style: string
 *   - ageRange: string
 *   - name: string
 *   - facePhoto: File (opcional) — foto de referência facial
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const store = await getStoreByClerkId(session.userId);
    if (!store) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
    }

    // ── Verificar limite de modelos do plano ──
    const [existingModels, planName] = await Promise.all([
      listStoreModels(store.id),
      getStorePlanName(store.id),
    ]);
    const modelLimit = getModelLimitForPlan(planName);

    if (existingModels.length >= modelLimit) {
      // Plano esgotou — tentar crédito avulso de modelos
      const creditUsed = await consumeCredit(store.id, "models");
      if (creditUsed) {
        console.log(`[Model] 💳 Crédito avulso de modelo consumido (plano: ${existingModels.length}/${modelLimit})`);
      } else {
        const credits = await getStoreCredits(store.id);
        return NextResponse.json(
          {
            error: `Limite de modelos atingido (${existingModels.length}/${modelLimit}). Compre créditos avulsos ou faça upgrade.`,
            code: "QUOTA_EXCEEDED",
            current: existingModels.length,
            limit: modelLimit,
            plan: planName,
            creditsAvailable: credits.models,
          },
          { status: 403 }
        );
      }
    }

    const formData = await request.formData();
    const skinTone = formData.get("skinTone") as string;
    const hairStyle = formData.get("hairStyle") as string;
    const bodyType = formData.get("bodyType") as string;
    const style = formData.get("style") as string;
    const ageRange = formData.get("ageRange") as string;
    const name = (formData.get("name") as string) || "Modelo";

    if (!skinTone || !hairStyle || !bodyType) {
      return NextResponse.json({ error: "Preencha todos os campos obrigatórios" }, { status: 400 });
    }

    // ── Processar foto de referência facial (opcional) ──
    const facePhoto = formData.get("facePhoto") as File | null;
    let facePhotoBuffer: Buffer | null = null;
    let facePhotoMimeType = "image/jpeg";

    if (facePhoto && facePhoto.size > 0) {
      console.log(`[Model] 📷 Foto de referência recebida: ${facePhoto.name} (${(facePhoto.size / 1024).toFixed(1)}KB)`);

      // Validar tipo e tamanho (rápido, não bloqueia)
      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(facePhoto.type)) {
        return NextResponse.json({ error: "Formato de imagem não suportado. Use JPG, PNG ou WebP." }, { status: 400 });
      }
      if (facePhoto.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: "Imagem muito grande. Máximo 5MB." }, { status: 400 });
      }

      const ab = await facePhoto.arrayBuffer();
      facePhotoBuffer = Buffer.from(new Uint8Array(ab));
      facePhotoMimeType = facePhoto.type;
    }

    // ── Salvar no banco IMEDIATAMENTE (sem bloquear com Sharp/Upload) ──
    const model = await createStoreModel({
      storeId: store.id,
      skinTone,
      hairStyle,
      bodyType,
      style,
      ageRange,
      name,
    });

    // ── Retorno instantâneo (<500ms) — frontend mostra placeholder ──
    const responsePayload = NextResponse.json({
      success: true,
      data: {
        id: model.id,
        previewUrl: null,
        previewStatus: "pending",
        hasFaceRef: !!facePhotoBuffer,
        traits: { skinTone, hairStyle, bodyType, style, ageRange },
      },
    });

    // ── Background: Sharp + Upload + Inngest (fire-and-forget) ──
    // Não bloqueia a response — executa em paralelo após HTTP 200
    const modelId = model.id;
    const storeId = store.id;
    (async () => {
      let faceRefUrl: string | null = null;

      // 1. Sharp resize (se disponível) — dentro do background, longe da main thread
      if (facePhotoBuffer) {
        let processedBuffer = facePhotoBuffer;
        let processedMime = facePhotoMimeType;
        try {
          const sharp = (await import("sharp")).default;
          processedBuffer = await sharp(facePhotoBuffer as any)
            .resize(512, 512, { fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer() as any;
          processedMime = "image/jpeg";
          console.log(`[Model:BG] ✂️ Imagem processada: ${(processedBuffer.length / 1024).toFixed(1)}KB`);
        } catch {
          console.warn("[Model:BG] ⚠️ Sharp indisponível, usando imagem original");
          processedMime = facePhotoMimeType;
        }

        // 2. Upload para Supabase Storage
        try {
          const { createAdminClient } = await import("@/lib/supabase/admin");
          const supabase = createAdminClient();
          const ext = processedMime.includes("png") ? "png" : "jpg";
          const filePath = `face-refs/${storeId}/${crypto.randomUUID()}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from("assets")
            .upload(filePath, processedBuffer, { contentType: processedMime, upsert: true });

          if (!uploadError) {
            const { data: pub } = supabase.storage.from("assets").getPublicUrl(filePath);
            faceRefUrl = pub.publicUrl;
            console.log(`[Model:BG] 💾 Face ref salva: ${faceRefUrl?.slice(0, 60)}...`);

            // Atualizar modelo com face_ref_url
            await supabase
              .from("store_models")
              .update({ face_ref_url: faceRefUrl })
              .eq("id", modelId);
          }
        } catch (uploadErr) {
          console.warn("[Model:BG] ⚠️ Upload da face ref falhou:", uploadErr);
        }
      }

      // 3. Disparar Inngest (agora com faceRefUrl se disponível)
      try {
        await inngest.send({
          name: "model/preview.requested",
          data: {
            modelId,
            storeId,
            skinTone,
            hairStyle,
            bodyType,
            style: style || "casual_natural",
            ageRange: ageRange || "adulta_26_35",
            name,
            faceRefUrl: faceRefUrl || null,
          },
        });
        const mode = faceRefUrl ? "multimodal 📷" : "text-only";
        console.log(`[Model:BG] 🚀 Preview disparado via Inngest (${mode}) para "${name}" (model: ${modelId})`);
      } catch (inngestErr: unknown) {
        console.warn("[Model:BG] ⚠️ Inngest dispatch falhou:", inngestErr instanceof Error ? inngestErr.message : inngestErr);
      }
    })().catch((bgErr) => {
      console.error("[Model:BG] ❌ Erro no background:", bgErr);
    });

    return responsePayload;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[API:model/create] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
