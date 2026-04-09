import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { runCampaignPipeline } from "@/lib/ai/pipeline";
import { runMockPipeline } from "@/lib/ai/mock-data";
import {
  getStoreByClerkId,
  createCampaign,
  savePipelineResultV3,
  failCampaign,
  incrementCampaignsUsed,
  canGenerateCampaign,
  getActiveModel,
  consumeCredit,
  getStoreCredits,
  hasAvulsoCredit,
} from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 180;
export const dynamic = "force-dynamic";

// v2: Pipeline híbrido precisa de pelo menos uma key. Demo mode se nenhuma key existe.
const IS_DEMO_MODE = !process.env.GOOGLE_AI_API_KEY && !process.env.ANTHROPIC_API_KEY;

/**
 * POST /api/campaign/generate
 *
 * Body (FormData):
 *   - image: File
 *   - price: string
 *   - objective: string
 *   - storeName: string
 *   - targetAudience?: string
 *   - toneOverride?: string

 *   - backgroundType?: string
 *   - bodyType?: "normal" | "plus"
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const clerkUserId = session.userId;

    // ── Rate limit por IP (anti-abuso) ──
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip")
      || "unknown";
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      const retryMin = Math.ceil((rateCheck.retryAfterMs || 60000) / 60000);
      return NextResponse.json({
        error: `Muitas gerações recentes. Tente novamente em ${retryMin} minuto${retryMin > 1 ? "s" : ""}.`,
        code: "RATE_LIMITED",
      }, { status: 429 });
    }

    // Parse FormData
    const formData = await request.formData();
    const imageFile = formData.get("image") as File | null;
    const closeUpImage = formData.get("closeUpImage") as File | null;
    const secondImage = formData.get("secondImage") as File | null;
    const price = formData.get("price") as string | null;
    const objective = (formData.get("objective") as string) || "venda_imediata";
    const storeName = (formData.get("storeName") as string) || "Minha Loja";
    const targetAudience = formData.get("targetAudience") as string | null;
    const toneOverride = formData.get("toneOverride") as string | null;
    const productType = formData.get("productType") as string | null;
    const material = formData.get("material") as string | null;
    const material2 = formData.get("material2") as string | null;
    const modelBankId = formData.get("modelBankId") as string | null;
    const backgroundType = (formData.get("backgroundType") as string) || "branco";
    const brandColor = formData.get("brandColor") as string | null;

    const bodyType = (formData.get("bodyType") as string) as "normal" | "plus" | null;

    // Validation
    if (!imageFile) {
      return NextResponse.json({ error: "Envie a foto do produto", code: "MISSING_IMAGE" }, { status: 400 });
    }
    const priceStr = price || "";


    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(imageFile.type)) {
      return NextResponse.json({ error: "Formato de imagem inválido. Use JPG, PNG ou WebP", code: "INVALID_IMAGE_TYPE" }, { status: 400 });
    }
    if (imageFile.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Imagem muito grande. Máximo 10MB", code: "IMAGE_TOO_LARGE" }, { status: 400 });
    }

    // ── Buscar loja do usuário (se autenticado) ──
    let store = null;
    if (clerkUserId) {
      store = await getStoreByClerkId(clerkUserId);
    }

    // ── Verificar quota (só verifica, NÃO consome ainda) ──
    let needsAvulsoCredit = false;
    if (store) {
      const quota = await canGenerateCampaign(store.id);
      if (!quota.allowed) {
        // Plano esgotou — verificar se TEM crédito avulso (sem consumir)
        const hasCredit = await hasAvulsoCredit(store.id, "campaigns");
        if (hasCredit) {
          needsAvulsoCredit = true;
          console.log(`[Generate] 💳 Crédito avulso reservado (plano esgotado: ${quota.used}/${quota.limit})`);
        } else {
          // Sem créditos — bloquear
          const credits = await getStoreCredits(store.id);
          return NextResponse.json({
            error: `Suas ${quota.limit} campanhas do mês acabaram!`,
            code: "QUOTA_EXCEEDED",
            used: quota.used,
            limit: quota.limit,
            credits: credits.campaigns,
            upgradeHint: true,
          }, { status: 429 });
        }
      }
    }

    // ── Buscar modelo ativo da loja ──
    let activeModelBodyType: "normal" | "plus" | undefined;
    if (store) {
      const model = await getActiveModel(store.id);
      if (model?.body_type) {
        activeModelBodyType = model.body_type === "plus" ? "plus" : "normal";
      }
    }

    // ── Converter imagem para base64 com downscale (evitar OOM na VPS) ──
    const arrayBuffer = await imageFile.arrayBuffer();
    let imageBuffer = Buffer.from(arrayBuffer);
    let mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" = imageFile.type as any;

    // Sharp downscale: max 1536px, WEBP 80% — Gemini só precisa de 1024-1536px
    try {
      const sharp = (await import("sharp")).default;
      const originalSize = imageBuffer.length;
      imageBuffer = await sharp(imageBuffer as any)
        .resize(1536, 1536, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer() as any;
      mediaType = "image/webp";
      const savings = ((1 - imageBuffer.length / originalSize) * 100).toFixed(0);
      console.log(`[Generate] 📐 Imagem principal: ${(originalSize / 1024).toFixed(0)}KB → ${(imageBuffer.length / 1024).toFixed(0)}KB (-${savings}%)`);
    } catch {
      console.warn("[Generate] ⚠️ Sharp indisponível, usando imagem original");
    }
    const imageBase64 = imageBuffer.toString("base64");

    // ── Converter fotos extras com downscale ──
    const extraImages: { base64: string; mediaType?: "image/jpeg" | "image/png" | "image/webp" | "image/gif" }[] = [];

    async function downscaleExtra(file: File): Promise<{ base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" }> {
      let buf = Buffer.from(await file.arrayBuffer());
      let mime: "image/jpeg" | "image/png" | "image/webp" | "image/gif" = file.type as any;
      try {
        const sharp = (await import("sharp")).default;
        buf = await sharp(buf as any)
          .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 75 })
          .toBuffer() as any;
        mime = "image/webp";
      } catch { /* fallback to original */ }
      return { base64: buf.toString("base64"), mediaType: mime };
    }

    if (closeUpImage && closeUpImage.size > 0) {
      extraImages.push(await downscaleExtra(closeUpImage));
      console.log(`[Generate] 📷 Close-up processado (${(closeUpImage.size / 1024).toFixed(0)}KB → downscaled)`);
    }
    if (secondImage && secondImage.size > 0) {
      extraImages.push(await downscaleExtra(secondImage));
      console.log(`[Generate] 📷 Segunda peça processada (${(secondImage.size / 1024).toFixed(0)}KB → downscaled)`);
    }

    // ── Criar campanha no banco (se tem loja) ──
    let campaignRecord = null;
    if (store) {
      const ext = imageFile.type.split("/")[1] || "jpg";
      const storagePath = `campaigns/${store.id}/${Date.now()}.${ext}`;

      // Upload real para Supabase Storage
      let productPhotoUrl = "";
      try {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const supabase = createAdminClient();
        const { error: uploadError } = await supabase.storage
          .from("product-photos")
          .upload(storagePath, Buffer.from(arrayBuffer), {
            contentType: imageFile.type,
            upsert: true,
          });

        if (uploadError) {
          console.warn("[API:campaign/generate] Storage upload failed:", uploadError.message);
          productPhotoUrl = `upload-failed://${storagePath}`;
        } else {
          const { data: urlData } = supabase.storage
            .from("product-photos")
            .getPublicUrl(storagePath);
          productPhotoUrl = urlData.publicUrl;
        }
      } catch {
        console.warn("[API:campaign/generate] Storage unavailable, saving path reference");
        productPhotoUrl = `pending-upload://${storagePath}`;
      }

      campaignRecord = await createCampaign({
        storeId: store.id,
        productPhotoUrl,
        productPhotoStoragePath: storagePath,
        price: priceStr ? parseFloat(priceStr.replace(",", ".")) : 0,
        objective,
        targetAudience: targetAudience || undefined,
        toneOverride: toneOverride || undefined,

      });
    }

    // ── DEMO MODE ──
    if (IS_DEMO_MODE) {
      console.log("[API:campaign/generate] 🎭 Demo mode — usando dados mock");
      const mockResult = await runMockPipeline(3000);

      if (campaignRecord) {
        if (needsAvulsoCredit) {
          await consumeCredit(store!.id, "campaigns");
        } else {
          await incrementCampaignsUsed(store!.id);
        }
      }

      return NextResponse.json({
        success: true,
        demo: true,
        campaignId: campaignRecord?.id || null,
        data: {
          analise: {},
          images: [],
          dicas_postagem: {},
          durationMs: mockResult.durationMs,
        },
      });
    }

    // ── PRODUCTION: buscar modelo para o pipeline v3 ──
    let modelImageBase64: string | null = null;
    let modelMediaType = "image/png";

    if (store) {
      try {
        let modelImageUrl: string | null = null;

        // Prioridade 1: modelo do banco selecionado pelo usuário
        if (modelBankId) {
          const { createAdminClient } = await import("@/lib/supabase/admin");
          const supabase = createAdminClient();
          const { data: bankModel } = await supabase
            .from("model_bank")
            .select("image_url")
            .eq("id", modelBankId)
            .single();
          if (bankModel?.image_url) {
            modelImageUrl = bankModel.image_url;
            console.log(`[Generate] 🏦 Modelo do banco: ${modelBankId}`);
          }
        }

        // Prioridade 2: modelo ativa da loja
        if (!modelImageUrl) {
          const activeModel = await getActiveModel(store.id);
          const activeUrl = activeModel?.preview_url || activeModel?.image_url;
          if (activeUrl) {
            modelImageUrl = activeUrl;
            console.log(`[Generate] 👤 Modelo ativa da loja`);
          }
        }

        if (modelImageUrl) {
          const modelRes = await fetch(modelImageUrl);
          const modelBuf = Buffer.from(await modelRes.arrayBuffer());
          modelImageBase64 = modelBuf.toString("base64");
          const ct = modelRes.headers.get("content-type");
          if (ct?.startsWith("image/")) modelMediaType = ct;
          console.log(`[Generate] ✅ Modelo carregada (${(modelBuf.length / 1024).toFixed(0)}KB)`);
        } else {
          console.warn("[Generate] ⚠️ Nenhuma modelo disponível — pipeline continuará sem modelo");
        }
      } catch (e) {
        console.warn("[Generate] ⚠️ Erro ao carregar modelo (não fatal):", e instanceof Error ? e.message : e);
      }
    }

    if (!modelImageBase64) {
      // Fallback: pixel transparente 1x1 PNG — o Gemini ainda pode gerar sem modelo de referência
      modelImageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      modelMediaType = "image/png";
    }

    try {
      // 🚀 SSE STREAMING — pipeline v3
      console.log("[Generate] 🚀 Iniciando pipeline v3 (Opus + 3x Gemini)...");

      const encoder = new TextEncoder();
      const stream = new TransformStream();
      const writer = stream.writable.getWriter();

      const sendSSE = async (event: string, data: unknown) => {
        try {
          await writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch { /* stream fechado */ }
      };

      (async () => {
        try {
          const pipelineResult = await runCampaignPipeline(
            {
              imageBase64,
              mediaType,
              extraImages: extraImages.length > 0 ? extraImages : undefined,
              modelImageBase64: modelImageBase64!,
              modelMediaType,
              price: priceStr,
              storeName: store?.name || storeName,
              bodyType: bodyType === "plus" ? "plus" : (activeModelBodyType || "normal"),
              backgroundType: backgroundType || undefined,
              brandColor: brandColor || undefined,
              storeId: store?.id,
              campaignId: campaignRecord?.id,
              signal: request.signal,
            },
            async (step, label, progress) => {
              console.log(`[Pipeline] ${step} (${progress}%) — ${label}`);
              await sendSSE("progress", { step, label, progress });
            }
          );

          const { successCount, images, analise, prompts, dicas_postagem, durationMs } = pipelineResult;

          // ── Regra de negócio: cobrar crédito SÓ se ≥1 imagem gerada ──
          if (successCount === 0) {
            if (campaignRecord) await failCampaign(campaignRecord.id, "0/3 images generated");
            await sendSSE("error", {
              error: "Nenhuma foto foi gerada. Tente novamente.",
              retry: true,
              code: "ALL_IMAGES_FAILED",
            });
            return;
          }

          // ✅ ≥1 imagem gerada — cobrar crédito
          if (campaignRecord) {
            // Upload das imagens geradas para Supabase Storage
            const imageUrls: (string | null)[] = [];
            try {
              const { createAdminClient } = await import("@/lib/supabase/admin");
              const supabase = createAdminClient();
              for (let i = 0; i < images.length; i++) {
                const img = images[i];
                if (!img) { imageUrls.push(null); continue; }
                try {
                  const path = `campaigns/${campaignRecord.id}/v3_image_${i + 1}.webp`;
                  const buf = Buffer.from(img.imageBase64, "base64");
                  const { error: upErr } = await supabase.storage
                    .from("generated-images")
                    .upload(path, buf, { contentType: "image/webp", upsert: true });
                  if (upErr) {
                    console.warn(`[Generate] ⚠️ Upload imagem ${i + 1} falhou:`, upErr.message);
                    imageUrls.push(null);
                  } else {
                    const { data: urlData } = supabase.storage
                      .from("generated-images")
                      .getPublicUrl(path);
                    imageUrls.push(urlData.publicUrl);
                    console.log(`[Generate] ✅ Imagem ${i + 1} salva: ${path}`);
                  }
                } catch (uploadErr) {
                  console.warn(`[Generate] ⚠️ Upload imagem ${i + 1} exception:`, uploadErr);
                  imageUrls.push(null);
                }
              }
            } catch (e) {
              console.warn("[Generate] Upload parcial falhou:", e);
              images.forEach(img => imageUrls.push(img ? "pending" : null));
            }

            await savePipelineResultV3({
              campaignId: campaignRecord.id,
              durationMs,
              analise: analise as unknown as Record<string, unknown>,
              imageUrls,
              prompts: prompts as unknown as Record<string, unknown>[],
              dicas_postagem: dicas_postagem as unknown as Record<string, unknown>,
              successCount,
            });

            if (needsAvulsoCredit) {
              await consumeCredit(store!.id, "campaigns");
              console.log(`[Generate] 💳 Crédito avulso CONSUMIDO (${successCount}/3 imagens)`);
            } else {
              await incrementCampaignsUsed(store!.id);
            }
          }

          // Enviar resultado final via SSE
          await sendSSE("done", {
            success: true,
            campaignId: campaignRecord?.id || null,
            data: {
              analise,
              images,   // array de 3: GeneratedImage | null
              prompts,  // para permitir regeneração individual no frontend
              dicas_postagem,
              durationMs,
              successCount,
            },
          });
        } catch (pipelineError: unknown) {
          if (campaignRecord) {
            const msg = pipelineError instanceof Error ? pipelineError.message : "Pipeline v3 error";
            await failCampaign(campaignRecord.id, msg);
          }
          const errMsg = pipelineError instanceof Error ? pipelineError.message : "Erro ao gerar campanha";
          await sendSSE("error", { error: errMsg });
        } finally {
          try { await writer.close(); } catch { /* already closed */ }
        }
      })();

      return new Response(stream.readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    } catch (error: unknown) {
      const errorObj = error as Record<string, unknown>;
      console.error("[API:campaign/generate] Error:", errorObj);

      if (String(errorObj.message || "").includes("ANTHROPIC_API_KEY")) {
        return NextResponse.json({ error: "Chave da API não configurada", code: "API_KEY_MISSING" }, { status: 500 });
      }
      if (errorObj.status === 429) {
        return NextResponse.json({ error: "Muitas requisições. Tente novamente em alguns segundos", code: "RATE_LIMITED" }, { status: 429 });
      }

      return NextResponse.json(
        {
          error: "Erro ao gerar campanha. Tente novamente.",
          code: "PIPELINE_ERROR",
          details: process.env.NODE_ENV === "development" ? String(errorObj.message || "") : undefined,
        },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    const errorObj = error as Record<string, unknown>;
    console.error("[API:campaign/generate] Top-level error:", errorObj);

    if (String(errorObj.message || "").includes("ANTHROPIC_API_KEY")) {
      return NextResponse.json({ error: "Chave da API não configurada", code: "API_KEY_MISSING" }, { status: 500 });
    }
    if (errorObj.status === 429) {
      return NextResponse.json({ error: "Muitas requisições. Tente novamente em alguns segundos", code: "RATE_LIMITED" }, { status: 429 });
    }

    return NextResponse.json(
      {
        error: "Erro ao gerar campanha. Tente novamente.",
        code: "PIPELINE_ERROR",
        details: process.env.NODE_ENV === "development" ? String(errorObj.message || "") : undefined,
      },
      { status: 500 }
    );
  }
}
