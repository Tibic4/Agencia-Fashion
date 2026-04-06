import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { runCampaignPipeline } from "@/lib/ai/pipeline";
import { getCategory } from "@/lib/ai/config";
import { runMockPipeline } from "@/lib/ai/mock-data";
import { getStoreByClerkId, createCampaign, savePipelineResult, failCampaign, incrementCampaignsUsed, canGenerateCampaign, getActiveModel, consumeCredit, getStoreCredits } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import type { PipelineStep } from "@/types";

export const maxDuration = 60;
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
    const modelBankId = formData.get("modelBankId") as string | null;
    const backgroundType = (formData.get("backgroundType") as string) || "branco";

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

    // ── Verificar quota (seção 5.5 da arquitetura) ──
    let usedAvulsoCredit = false;
    if (store) {
      const quota = await canGenerateCampaign(store.id);
      if (!quota.allowed) {
        // Plano esgotou — tentar crédito avulso
        const creditUsed = await consumeCredit(store.id, "campaigns");
        if (creditUsed) {
          usedAvulsoCredit = true;
          console.log(`[Generate] 💳 Crédito avulso consumido (plano esgotado: ${quota.used}/${quota.limit})`);
        } else {
          // Sem créditos — retorna com info de créditos disponíveis
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

    // ── Converter fotos extras (close-up + segunda peça) ──
    const extraImages: { base64: string; mediaType?: "image/jpeg" | "image/png" | "image/webp" | "image/gif" }[] = [];
    if (closeUpImage && closeUpImage.size > 0) {
      const buf = Buffer.from(await closeUpImage.arrayBuffer());
      extraImages.push({ base64: buf.toString("base64"), mediaType: closeUpImage.type as any });
      console.log(`[Generate] 📷 Close-up recebido (${(closeUpImage.size / 1024).toFixed(0)}KB)`);
    }
    if (secondImage && secondImage.size > 0) {
      const buf = Buffer.from(await secondImage.arrayBuffer());
      extraImages.push({ base64: buf.toString("base64"), mediaType: secondImage.type as any });
      console.log(`[Generate] 📷 Segunda peça recebida (${(secondImage.size / 1024).toFixed(0)}KB)`);
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

    // ── VIRTUAL TRY-ON (Banco de Modelos → Fashn try-on) ──
    let tryOnImageUrl: string | null = null;
    let tryOnProvider: string | null = null;
    if (store) {
      try {
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

        // Prioridade 1: Modelo do banco (nova funcionalidade)
        if (modelBankId && productUrl && process.env.FASHN_API_KEY) {
          try {
            const { createAdminClient } = await import("@/lib/supabase/admin");
            const supabase = createAdminClient();
            const { data: bankModel } = await supabase
              .from("model_bank")
              .select("image_url")
              .eq("id", modelBankId)
              .single();

            if (bankModel?.image_url) {
              const { generateWithModelBank } = await import("@/lib/fashn/client");
              const category = getCategory(productType || "auto");
              console.log(`[TryOn] 🏦 Usando modelo do banco (${modelBankId})`);
              const result = await generateWithModelBank(
                productUrl,
                bankModel.image_url,
                backgroundType as any,
              );
              if (result.status === "completed" && result.outputUrl) {
                tryOnImageUrl = result.outputUrl;
                tryOnProvider = "fashn.ai-bank";
                console.log("[TryOn] ✅ Modelo do banco + try-on sucesso");
              }
            }
          } catch (e) {
            console.warn("[TryOn] Banco de modelos falhou:", e);
          }
        }

        // Prioridade 2: Modelo ativa da loja (legado)
        if (!tryOnImageUrl) {
          const model = await getActiveModel(store.id);
          const modelImageUrl = model?.preview_url || null;

          if (modelImageUrl && productUrl) {
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

            if (fashnEnabled && process.env.FASHN_API_KEY) {
              try {
                const { tryOnProduct } = await import("@/lib/fashn/client");
                console.log("[TryOn] 👗 Tentando Fashn.ai (modelo ativa da loja)...");
                const result = await tryOnProduct({
                  productImage: productUrl,
                  modelImage: modelImageUrl,
                });
                if (result.status === "completed" && result.outputUrl) {
                  tryOnImageUrl = result.outputUrl;
                  tryOnProvider = "fashn.ai";
                  console.log("[TryOn] ✅ Fashn.ai sucesso");
                }
              } catch (e) {
                console.warn("[TryOn] Fashn.ai falhou:", e);
              }
            }

            // Fallback: Google Nano Banana 2
            if (!tryOnImageUrl && process.env.GOOGLE_AI_API_KEY) {
              try {
                const { nanoBananaTryOn } = await import("@/lib/google/nano-banana");
                console.log("[TryOn] 🍌 Fallback Nano Banana 2...");
                
                // Converter URLs para base64 para o Nano Banana
                const productRes = await fetch(productUrl);
                const productBuf = Buffer.from(await productRes.arrayBuffer());
                const modelRes = await fetch(modelImageUrl);
                const modelBuf = Buffer.from(await modelRes.arrayBuffer());

                const result = await nanoBananaTryOn({
                  productImageBase64: productBuf.toString("base64"),
                  productMimeType: "image/jpeg",
                  modelImageBase64: modelBuf.toString("base64"),
                  modelMimeType: "image/png",
                  bodyType: bodyType || "normal",
                });
                if (result.status === "completed" && result.imageBase64) {
                  // Salvar a imagem base64 como URL (data URI)
                  tryOnImageUrl = `data:image/png;base64,${result.imageBase64}`;
                  tryOnProvider = "nano-banana-2";
                  console.log("[TryOn] ✅ Nano Banana 2 sucesso");
                }
              } catch (e) {
                console.warn("[TryOn] Nano Banana 2 falhou:", e);
              }
            }
          }
        }

        // 📊 Registrar custo do try-on
        if (tryOnProvider && store) {
          try {
            const { createAdminClient } = await import("@/lib/supabase/admin");
            const supabase = createAdminClient();
            const costMap: Record<string, number> = {
              "fashn.ai-bank": 0.075 + 0.017, // try-on + edit
              "fashn.ai": 0.075,
              "fal.ai": 0.035,
              "nano-banana-2": 0.04, // Gemini imagen ~$0.04/image
            };
            const costUsd = costMap[tryOnProvider] || 0.075;
            const exchangeRate = parseFloat(process.env.USD_BRL_EXCHANGE_RATE || "5.80");
            await supabase.from("api_cost_logs").insert({
              store_id: store.id,
              campaign_id: campaignRecord?.id || null,
              provider: tryOnProvider,
              model_used: tryOnProvider === "fal.ai" ? "idm-vton" : tryOnProvider === "nano-banana-2" ? "gemini-imagen" : "fashn-tryon",
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
          extraImages: extraImages.length > 0 ? extraImages : undefined,
          price: priceStr,
          objective,
          storeName: store?.name || storeName,
          targetAudience: targetAudience || undefined,
          toneOverride: toneOverride || undefined,
          storeSegment: store?.segment_primary || undefined,
          bodyType: bodyType || "normal",
          productType: productType || undefined,
          material: material || undefined,
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
          tryOnImageUrl: tryOnImageUrl || null,
          tryOnProvider: tryOnProvider || null,
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
