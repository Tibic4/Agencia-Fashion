import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { runCampaignPipeline } from "@/lib/ai/pipeline";
import { runMockPipeline } from "@/lib/ai/mock-data";
import { getStoreByClerkId, createCampaign, savePipelineResult, failCampaign, incrementCampaignsUsed, canGenerateCampaign, getActiveModel } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import type { PipelineStep } from "@/types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const IS_DEMO_MODE = !process.env.ANTHROPIC_API_KEY;

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
 *   - useModel?: "true" | "false"
 *   - backgroundType?: string
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
    const price = formData.get("price") as string | null;
    const objective = (formData.get("objective") as string) || "venda_imediata";
    const storeName = (formData.get("storeName") as string) || "Minha Loja";
    const targetAudience = formData.get("targetAudience") as string | null;
    const toneOverride = formData.get("toneOverride") as string | null;
    const useModel = formData.get("useModel") !== "false";

    // Validation
    if (!imageFile) {
      return NextResponse.json({ error: "Envie a foto do produto", code: "MISSING_IMAGE" }, { status: 400 });
    }
    if (!price) {
      return NextResponse.json({ error: "Informe o preço do produto", code: "MISSING_PRICE" }, { status: 400 });
    }

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

    // ── Verificar quota ──
    if (store) {
      const quota = await canGenerateCampaign(store.id);
      if (!quota.allowed) {
        return NextResponse.json({
          error: `Limite de campanhas atingido (${quota.used}/${quota.limit}). Faça upgrade do plano.`,
          code: "QUOTA_EXCEEDED",
        }, { status: 429 });
      }
    }

    // ── Buscar modelo ativo (para contexto plus size) ──
    let activeModelBodyType: string | undefined;
    if (store) {
      const model = await getActiveModel(store.id);
      if (model?.body_type) {
        activeModelBodyType = model.body_type;
      }
    }

    // ── Converter imagem para base64 ──
    const arrayBuffer = await imageFile.arrayBuffer();
    const imageBase64 = Buffer.from(arrayBuffer).toString("base64");
    const mediaType = imageFile.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif";

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
        price: parseFloat(price.replace(",", ".")),
        objective,
        targetAudience: targetAudience || undefined,
        toneOverride: toneOverride || undefined,
        useModel,
      });
    }

    // ── VIRTUAL TRY-ON (Fashn.ai) ──
    let tryOnImageUrl: string | null = null;
    if (useModel && store && process.env.FASHN_API_KEY) {
      try {
        const model = await getActiveModel(store.id);
        // Precisa de preview_url (foto do modelo) e da foto do produto já uploaded
        const modelImageUrl = model?.preview_url || null;
        const productUrl = campaignRecord ? (
          // Usa a URL do produto que acabou de subir
          (() => {
            try {
              const { createAdminClient } = require("@/lib/supabase/admin");
              const supabase = createAdminClient();
              const { data } = supabase.storage.from("product-photos").getPublicUrl(
                `campaigns/${store.id}/${campaignRecord.id}.jpg`
              );
              return data?.publicUrl;
            } catch { return null; }
          })()
        ) : null;

        if (modelImageUrl && productUrl) {
          const { tryOnProduct } = await import("@/lib/fashn/client");
          console.log("[API:campaign] 👗 Iniciando Virtual Try-On...");
          const tryOnResult = await tryOnProduct({
            garmentImageUrl: productUrl,
            modelImageUrl: modelImageUrl,
            category: "tops", // TODO: detect from vision analysis
          });

          if (tryOnResult.status === "completed" && tryOnResult.outputUrl) {
            tryOnImageUrl = tryOnResult.outputUrl;
            console.log("[API:campaign] ✅ Try-On concluído:", tryOnImageUrl);
          } else {
            console.warn("[API:campaign] Try-On falhou ou timeout, usando foto original");
          }
        } else {
          console.log("[API:campaign] Modelo sem preview_url, pulando try-on");
        }
      } catch (tryOnErr) {
        console.warn("[API:campaign] Try-On error (não fatal):", tryOnErr);
        // Não é erro fatal - segue com foto original
      }
    }

    // ── DEMO MODE ──
    if (IS_DEMO_MODE) {
      console.log("[API:campaign/generate] 🎭 Demo mode — usando dados mock");
      const mockResult = await runMockPipeline(3000);

      // Persistir resultado mock no banco
      if (campaignRecord) {
        await savePipelineResult({
          campaignId: campaignRecord.id,
          durationMs: mockResult.durationMs,
          vision: mockResult.vision as unknown as Record<string, unknown>,
          strategy: mockResult.strategy as unknown as Record<string, unknown>,
          output: mockResult.output as unknown as Record<string, unknown>,
          score: mockResult.score as unknown as Record<string, unknown>,
        });
        await incrementCampaignsUsed(store!.id);
      }

      return NextResponse.json({
        success: true,
        demo: true,
        campaignId: campaignRecord?.id || null,
        data: {
          vision: mockResult.vision,
          strategy: mockResult.strategy,
          output: mockResult.output,
          score: mockResult.score,
          durationMs: mockResult.durationMs,
        },
      });
    }

    // ── PRODUCTION: pipeline real ──
    try {
      const result = await runCampaignPipeline(
        {
          imageBase64,
          mediaType,
          price,
          objective,
          storeName: store?.name || storeName,
          targetAudience: targetAudience || undefined,
          toneOverride: toneOverride || undefined,
          storeSegment: store?.segment_primary || undefined,
          bodyType: activeModelBodyType,
        },
        (step, label, progress) => {
          console.log(`[Pipeline] ${step} (${progress}%) — ${label}`);
        }
      );

      // Persistir resultado no banco
      if (campaignRecord) {
        await savePipelineResult({
          campaignId: campaignRecord.id,
          durationMs: result.durationMs,
          vision: result.vision as unknown as Record<string, unknown>,
          strategy: result.strategy as unknown as Record<string, unknown>,
          output: result.output as unknown as Record<string, unknown>,
          score: result.score as unknown as Record<string, unknown>,
        });
        await incrementCampaignsUsed(store!.id);
      }

      return NextResponse.json({
        success: true,
        demo: false,
        campaignId: campaignRecord?.id || null,
        data: {
          vision: result.vision,
          strategy: result.strategy,
          output: result.output,
          score: result.score,
          durationMs: result.durationMs,
        },
      });
    } catch (pipelineError: unknown) {
      // Marcar campanha como falha
      if (campaignRecord) {
        const msg = pipelineError instanceof Error ? pipelineError.message : "Pipeline error";
        await failCampaign(campaignRecord.id, msg);
      }
      throw pipelineError;
    }
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
}
