import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { logger } from "@/lib/observability";
import { auth } from "@clerk/nextjs/server";
import { getStoreByClerkId, createStoreModel, listStoreModels, getStorePlanName, getModelLimitForPlan, consumeCredit, getStoreCredits } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";
import { env } from "@/lib/env";

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
        logger.info(`[Model] 💳 Crédito avulso de modelo consumido (plano: ${existingModels.length}/${modelLimit})`);
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
    const hairFromPhoto = formData.get("hairFromPhoto") === "true";
    const hairTexture = hairFromPhoto ? null : ((formData.get("hairTexture") as string) || null);
    const hairLength = hairFromPhoto ? null : ((formData.get("hairLength") as string) || null);
    const hairColor = hairFromPhoto ? null : ((formData.get("hairColor") as string) || null);
    const bodyType = formData.get("bodyType") as string;
    const style = formData.get("style") as string;
    const ageRange = formData.get("ageRange") as string;
    const name = (formData.get("name") as string) || "Modelo";
    const gender = (formData.get("gender") as string) || "feminino";

    if (!skinTone || (!hairStyle && !hairTexture) || !bodyType) {
      return NextResponse.json({ error: "Preencha todos os campos obrigatórios" }, { status: 400 });
    }

    // ── Processar foto de referência facial (opcional) ──
    let faceRefUrl: string | null = null;
    const facePhoto = formData.get("facePhoto") as File | null;

    if (facePhoto && facePhoto.size > 0) {
      logger.info(`[Model] 📷 Foto de referência recebida: ${facePhoto.name} (${(facePhoto.size / 1024).toFixed(1)}KB)`);

      // Validar tipo e tamanho
      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(facePhoto.type)) {
        return NextResponse.json({ error: "Formato de imagem não suportado. Use JPG, PNG ou WebP." }, { status: 400 });
      }
      if (facePhoto.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: "Imagem muito grande. Máximo 5MB." }, { status: 400 });
      }

      // Converter para buffer
      const arrayBuffer = await facePhoto.arrayBuffer();
      let processedBuffer = Buffer.from(new Uint8Array(arrayBuffer));
      let processedMime = facePhoto.type;

      // Sharp resize para reduzir tokens
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- sharp() accepts Buffer but @types/sharp narrows to specific input shapes
        processedBuffer = await sharp(processedBuffer as any)
          .resize(768, 768, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 85 })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 3rd-party untyped boundary
          .toBuffer() as any;
        processedMime = "image/jpeg";
        logger.info(`[Model] ✂️ Imagem processada: ${(processedBuffer.length / 1024).toFixed(1)}KB`);
      } catch {
        logger.warn("[Model] ⚠️ Sharp não disponível, usando imagem original");
      }

      // Upload para Supabase Storage
      try {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const supabase = createAdminClient();
        const ext = processedMime.includes("png") ? "png" : "jpg";
        const filePath = `face-refs/${store.id}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("assets")
          .upload(filePath, processedBuffer, { contentType: processedMime, upsert: true });

        if (!uploadError) {
          const { data: pub } = supabase.storage.from("assets").getPublicUrl(filePath);
          faceRefUrl = pub.publicUrl;
          logger.info(`[Model] 💾 Face ref salva: ${faceRefUrl?.slice(0, 60)}...`);
        }
      } catch (uploadErr) {
        logger.warn("[Model] ⚠️ Upload da face ref falhou:", uploadErr);
      }
    }

    // ── Salvar no banco ──
    const model = await createStoreModel({
      storeId: store.id,
      skinTone,
      hairStyle: hairTexture || hairStyle,
      bodyType,
      style,
      ageRange,
      name,
      gender,
    });

    // Salvar campos granulares de cabelo
    if (hairTexture && hairLength && hairColor) {
      const { createAdminClient: createAdmin2 } = await import("@/lib/supabase/admin");
      const sb2 = createAdmin2();
      await sb2.from("store_models").update({
        hair_texture: hairTexture,
        hair_length: hairLength,
        hair_color: hairColor,
      }).eq("id", model.id);
    }

    // Salvar face_ref_url no modelo
    if (faceRefUrl) {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const supabase = createAdminClient();
      await supabase
        .from("store_models")
        .update({ face_ref_url: faceRefUrl })
        .eq("id", model.id);
    }

    // ── Disparar geração de preview via Inngest ──
    try {
      await inngest.send({
        name: "model/preview.requested",
        data: {
          modelId: model.id,
          storeId: store.id,
          skinTone,
          hairStyle: hairTexture || hairStyle,
          hairTexture: hairTexture || null,
          hairLength: hairLength || null,
          hairColor: hairColor || null,
          hairFromPhoto,
          bodyType,
          style: style || "casual_natural",
          ageRange: ageRange || "adulta_26_35",
          name,
          gender,
          faceRefUrl: faceRefUrl || null,
        },
      });
      const mode = faceRefUrl ? "multimodal 📷" : "text-only";
      logger.info(`[Model] 🚀 Preview disparado via Inngest (${mode}) para "${name}" (model: ${model.id})`);
    } catch (inngestErr: unknown) {
      logger.warn("[Model] ⚠️ Inngest dispatch falhou:", inngestErr instanceof Error ? inngestErr.message : inngestErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: model.id,
        previewUrl: null,
        previewStatus: "pending",
        hasFaceRef: !!faceRefUrl,
        traits: { skinTone, hairStyle: hairTexture || hairStyle, hairTexture, hairLength, hairColor, bodyType, style, ageRange, gender },
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    logger.error("[API:model/create] Error:", msg);
    return NextResponse.json(
      { error: "Erro ao criar modelo", details: env.NODE_ENV === "development" ? msg : undefined },
      { status: 500 }
    );
  }
}
