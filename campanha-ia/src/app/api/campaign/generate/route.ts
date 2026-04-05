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

    // ── VIRTUAL TRY-ON (Fashn.ai → fal.ai → foto original) ──
    let tryOnImageUrl: string | null = null;
    let tryOnProvider: string | null = null;
    if (useModel && store) {
      try {
        const model = await getActiveModel(store.id);
        const modelImageUrl = model?.preview_url || null;

        // Obter URL pública do produto
        let productUrl: string | null = null;
        if (campaignRecord) {
          try {
            const { createAdminClient } = await import("@/lib/supabase/admin");
            const supabase = createAdminClient();
            const { data } = supabase.storage.from("product-photos").getPublicUrl(
              campaignRecord.product_photo_storage_path || `campaigns/${store.id}/${campaignRecord.id}.jpg`
            );
            productUrl = data?.publicUrl || null;
          } catch { /* ignore */ }
        }

        if (modelImageUrl && productUrl) {
          // Check admin setting for try-on provider control
          let fashnEnabled = true;
          try {
            const { createAdminClient } = await import("@/lib/supabase/admin");
            const supabase = createAdminClient();
            const { data: setting } = await supabase
              .from("admin_settings")
              .select("value")
              .eq("key", "enable_tryon")
              .single();
            fashnEnabled = setting?.value !== "false" && setting?.value !== false;
          } catch { /* default to enabled */ }

          // 1️⃣ Tentar Fashn.ai primeiro (melhor qualidade) — se habilitado no admin
          if (fashnEnabled && process.env.FASHN_API_KEY) {
            try {
              const { tryOnProduct } = await import("@/lib/fashn/client");
              console.log("[TryOn] 👗 Tentando Fashn.ai...");
              const result = await tryOnProduct({
                garmentImageUrl: productUrl,
                modelImageUrl,
                category: "tops",
              });
              if (result.status === "completed" && result.outputUrl) {
                tryOnImageUrl = result.outputUrl;
                tryOnProvider = "fashn.ai";
                console.log("[TryOn] ✅ Fashn.ai sucesso");
              }
            } catch (e) {
              console.warn("[TryOn] Fashn.ai falhou:", e);
            }
          } else if (!fashnEnabled) {
            console.log("[TryOn] ⚠️ Fashn.ai DESABILITADO no admin — pulando para fal.ai");
          }

          // 2️⃣ Fallback: fal.ai IDM-VTON (mais barato)
          if (!tryOnImageUrl && process.env.FAL_KEY) {
            try {
              const { falTryOn } = await import("@/lib/fal/client");
              console.log("[TryOn] 🔄 Fallback fal.ai IDM-VTON...");
              const result = await falTryOn({
                garmentImageUrl: productUrl,
                modelImageUrl,
                description: "Fashion garment for virtual try-on",
              });
              if (result.status === "completed" && result.outputUrl) {
                tryOnImageUrl = result.outputUrl;
                tryOnProvider = "fal.ai";
                console.log("[TryOn] ✅ fal.ai sucesso");
              }
            } catch (e) {
              console.warn("[TryOn] fal.ai falhou:", e);
            }
          }

          // 📊 Registrar custo do try-on (se usou algum provider)
          if (tryOnProvider && store) {
            try {
              const { createAdminClient } = await import("@/lib/supabase/admin");
              const supabase = createAdminClient();
              const costUsd = tryOnProvider === "fashn.ai" ? 0.075 : 0.035;
              const exchangeRate = parseFloat(process.env.USD_BRL_EXCHANGE_RATE || "5.80");
              await supabase.from("api_cost_logs").insert({
                store_id: store.id,
                campaign_id: campaignRecord?.id || null,
                provider: tryOnProvider,
                model_used: tryOnProvider === "fashn.ai" ? "fashn-tryon" : "idm-vton",
                action: "virtual_try_on",
                cost_usd: costUsd,
                cost_brl: costUsd * exchangeRate,
              });
            } catch (costErr) {
              console.warn("[TryOn] Falha ao registrar custo:", costErr);
            }
          }

          if (!tryOnImageUrl) {
            console.log("[TryOn] Nenhum provider disponível, usando foto original");
          }
        } else {
          console.log("[TryOn] Modelo sem preview_url ou sem URL do produto");
        }
      } catch (tryOnErr) {
        console.warn("[TryOn] Erro geral (não fatal):", tryOnErr);
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
