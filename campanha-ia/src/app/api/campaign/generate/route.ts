import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { runCampaignPipeline } from "@/lib/ai/pipeline";
import { getCategory } from "@/lib/ai/config";
import { runMockPipeline } from "@/lib/ai/mock-data";
import { getStoreByClerkId, createCampaign, savePipelineResult, failCampaign, incrementCampaignsUsed, canGenerateCampaign, getActiveModel, consumeCredit, getStoreCredits, hasAvulsoCredit } from "@/lib/db";
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
    const material2 = formData.get("material2") as string | null;
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

    // ── MINI-VISION: extrair dados VTO usando TODAS as fotos + dados do lojista ──
    // Combina: foto principal + close-up (textura!) + 2ª peça + material selecionado + tipo produto
    let vtoData: { fabricDescriptor?: string; garmentStructure?: string; colorHex?: string; criticalDetails?: string[] } | undefined;

    // Mapa de materiais → descritor de tecido em inglês (dados do lojista = fonte confiável)
    const MATERIAL_FABRIC_MAP: Record<string, string> = {
      viscose: "viscose/rayon fabric, soft drape, slight sheen, lightweight",
      algodao: "cotton fabric, matte finish, natural texture, breathable",
      linho: "linen fabric, natural slubbed texture, visible weave, crisp hand feel",
      crepe: "crepe fabric, slightly crinkled surface texture, matte finish, fluid drape",
      malha: "jersey knit fabric, smooth surface, slight stretch, medium weight",
      jeans: "denim fabric, diagonal twill weave, sturdy cotton, visible texture",
      trico: "knit fabric with visible ribbed or cable texture, matte finish, medium to heavy weight",
      seda: "silk/satin fabric, smooth glossy surface, luxurious sheen, lightweight fluid drape",
      couro: "leather or faux leather, smooth or textured surface, slight sheen, structured",
      moletom: "sweatshirt fleece fabric, soft brushed interior, matte cotton exterior, heavyweight",
      chiffon: "chiffon/mousseline, sheer semi-transparent, delicate flowing drape, lightweight",
      poliester: "polyester fabric, smooth synthetic surface, slight sheen",
      la: "wool fabric, soft fuzzy texture, matte finish, medium to heavy weight",
      nylon: "nylon fabric, smooth synthetic surface, slight sheen, lightweight",
      suede: "suede or faux suede, soft velvety napped texture, matte finish",
      renda: "lace fabric, open decorative pattern, delicate texture, semi-transparent",
    };

    // Mapa de tipo de produto → seed de estrutura
    const PRODUCT_STRUCTURE_MAP: Record<string, string> = {
      blusa: "upper body garment, neckline and sleeves define silhouette",
      saia: "lower body garment from waist, hemline defines length",
      calca: "lower body garment covering full legs, rise and leg width define fit",
      vestido: "full-body one-piece garment from shoulders to hemline",
      macacao: "full-body jumpsuit/romper, connected top and bottom",
      conjunto: "two-piece coordinated set, each piece has its own structure",
      jaqueta: "outerwear layer, structured shoulders, front closure, defined collar",
      acessorio: "fashion accessory item",
    };

    // Seed do fabricDescriptor a partir do material selecionado pelo lojista
    const userFabricSeed = material ? MATERIAL_FABRIC_MAP[material.toLowerCase()] : undefined;
    const userStructureSeed = productType ? PRODUCT_STRUCTURE_MAP[productType.split(":")[0]] : undefined;

    if (process.env.GOOGLE_AI_API_KEY) {
      try {
        const { GeminiProvider } = await import("@/lib/ai/providers/gemini");
        const miniVision = new GeminiProvider(process.env.AI_MODEL_GEMINI_FLASH || "gemini-2.5-flash");

        // Montar hints do lojista para o prompt
        const hints: string[] = [];
        if (userFabricSeed) hints.push(`The user confirmed the fabric is: ${userFabricSeed}. Use this as your BASE, then ADD visual details you observe (sheen, weight, texture pattern).`);
        if (userStructureSeed) hints.push(`Product type: ${userStructureSeed}. Use this to seed the garmentStructure field.`);
        if (material2) {
          const mat2Seed = MATERIAL_FABRIC_MAP[material2.toLowerCase()];
          if (mat2Seed) hints.push(`Second piece fabric (for conjunto): ${mat2Seed}`);
        }

        const miniResult = await miniVision.generateWithVision({
          system: `You are a fashion garment analyst. Analyze ALL provided photos (main product + close-up texture detail + second piece if present) and return ONLY a JSON object with these 4 fields:
- "fabricDescriptor": concise English description of the visible fabric texture for photographic reproduction (e.g., "ribbed knit with visible vertical channels, matte finish, medium weight")
- "garmentStructure": English description of garment silhouette and structure (e.g., "structured shoulders, elastic waistband, A-line silhouette from waist down")
- "colorHex": estimated hex color code of the main fabric color (e.g., "#F5C6D0")
- "criticalDetails": array of English strings describing details that MUST be preserved in virtual try-on (e.g., ["gold buttons on front placket, 5 total", "ribbed cuffs 3cm wide"])
${hints.length > 0 ? "\nUSER-PROVIDED DATA (use as authoritative source):\n" + hints.join("\n") : ""}
The CLOSE-UP photo (if provided) is the most important for fabric texture analysis — examine it carefully.
Respond with ONLY the JSON object, no markdown.`,
          messages: [{ role: "user", content: "Analyze this garment for virtual try-on. Use close-up for fabric detail." }],
          imageBase64,
          mediaType,
          extraImages: extraImages.length > 0 ? extraImages : undefined, // ← close-up + 2ª peça!
          temperature: 0.1,
          maxTokens: 400,
        });
        try {
          const cleaned = miniResult.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          vtoData = JSON.parse(cleaned);

          // Garantir que material do lojista prevalece sobre detecção da IA (quando informado)
          if (userFabricSeed && vtoData) {
            // IA enriquece mas NÃO contradiz o lojista
            if (!vtoData.fabricDescriptor?.toLowerCase().includes(material!.toLowerCase())) {
              vtoData.fabricDescriptor = `${userFabricSeed} — ${vtoData.fabricDescriptor || ""}`;
            }
          }

          console.log(`[MiniVision] 🔍 VTO data extraído (${extraImages.length} fotos extras): fabric=${vtoData?.fabricDescriptor?.substring(0, 50)}...`);
          // Registrar custo do mini-vision (~$0.0004)
          if (store) {
            try {
              const { createAdminClient } = await import("@/lib/supabase/admin");
              const supabase = createAdminClient();
              const exchangeRate = parseFloat(process.env.USD_BRL_EXCHANGE_RATE || "5.80");
              await supabase.from("api_cost_logs").insert({
                store_id: store.id,
                campaign_id: campaignRecord?.id || null,
                provider: "google",
                model_used: "gemini-2.5-flash",
                action: "mini_vision_vto",
                cost_usd: 0.0004,
                cost_brl: 0.0004 * exchangeRate,
              });
            } catch { /* ignore cost log failure */ }
          }
        } catch {
          console.warn("[MiniVision] Falha ao parsear JSON, try-on seguirá sem VTO data");
        }
      } catch (e) {
        console.warn("[MiniVision] Falha (não fatal):", e);
      }
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
                undefined, // backgroundValue
                vtoData, // ← VTO data do mini-vision
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
                  visionData: vtoData, // ← VTO data do mini-vision
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
                  visionData: vtoData, // ← VTO data do mini-vision
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
              "fashn.ai-bank": 0.15,  // tryon-max: 2 créditos Quality/1K ($0.15) — quality auto
              "fashn.ai": 0.15,      // tryon-max: 2 créditos Quality/1K ($0.15)
              "fal.ai": 0.035,
              "nano-banana-2": 0.04,  // Gemini imagen ~$0.04/image
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
        // Descontar uso SOMENTE após sucesso
        if (needsAvulsoCredit) {
          await consumeCredit(store!.id, "campaigns");
          console.log(`[Generate] 💳 Crédito avulso CONSUMIDO após sucesso (demo)`);
        } else {
          await incrementCampaignsUsed(store!.id);
        }
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
    // Compor material para conjunto (duas peças com materiais diferentes)
    let materialHint: string | undefined = material || undefined;
    if (productType?.startsWith("conjunto:") && material2) {
      const types = productType.replace("conjunto:", "").split("+");
      const parts: string[] = [];
      if (material) parts.push(`Peça 1 (${types[0] || "peça 1"}): ${material}`);
      parts.push(`Peça 2 (${types[1] || "peça 2"}): ${material2}`);
      materialHint = parts.join(" | ");
    }

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
          material: materialHint,
          backgroundType: backgroundType || undefined,
          storeId: store?.id,
          campaignId: campaignRecord?.id,
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
        // Descontar uso SOMENTE após sucesso
        if (needsAvulsoCredit) {
          await consumeCredit(store!.id, "campaigns");
          console.log(`[Generate] 💳 Crédito avulso CONSUMIDO após sucesso (produção)`);
        } else {
          await incrementCampaignsUsed(store!.id);
        }
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
