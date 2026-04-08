import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { runCampaignPipeline } from "@/lib/ai/pipeline";
import { getCategory } from "@/lib/ai/config";
import { runMockPipeline } from "@/lib/ai/mock-data";
import { getStoreByClerkId, createCampaign, savePipelineResult, failCampaign, incrementCampaignsUsed, canGenerateCampaign, getActiveModel, consumeCredit, getStoreCredits, hasAvulsoCredit } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import type { PipelineStep } from "@/types";

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
          // Registrar custo REAL do mini-vision (tokens da API)
          if (store) {
            try {
              const { createAdminClient } = await import("@/lib/supabase/admin");
              const supabase = createAdminClient();
              const { getExchangeRate, calculateCostBrlDynamic } = await import("@/lib/pricing");
              const exchangeRate = await getExchangeRate();
              const inputTokens = miniResult.usage?.inputTokens || 0;
              const outputTokens = miniResult.usage?.outputTokens || 0;
              const costBrl = await calculateCostBrlDynamic(
                miniResult.model || "gemini-2.5-flash",
                { inputTokens, outputTokens },
              );
              const costUsd = exchangeRate > 0 ? costBrl / exchangeRate : 0;
              await supabase.from("api_cost_logs").insert({
                store_id: store.id,
                campaign_id: campaignRecord?.id || null,
                provider: "google",
                model_used: miniResult.model || "gemini-2.5-flash",
                action: "mini_vision_vto",
                input_tokens: inputTokens,
                output_tokens: outputTokens,
                cost_usd: costUsd,
                cost_brl: costBrl,
                response_time_ms: miniResult.usage ? undefined : undefined,
              });
              console.log(`[MiniVision] 💰 Custo: R$ ${costBrl.toFixed(4)} (${inputTokens}+${outputTokens} tokens)`);
            } catch { /* ignore cost log failure */ }
          }
        } catch {
          console.warn("[MiniVision] Falha ao parsear JSON, try-on seguirá sem VTO data");
        }
      } catch (e) {
        console.warn("[MiniVision] Falha (não fatal):", e);
      }
    }

    // ── DEMO MODE (antes de paralelizar) ──
    if (IS_DEMO_MODE) {
      console.log("[API:campaign/generate] 🎭 Demo mode — usando dados mock");
      const mockResult = await runMockPipeline(3000);

      if (campaignRecord) {
        await savePipelineResult({
          campaignId: campaignRecord.id,
          durationMs: mockResult.durationMs,
          vision: mockResult.vision as unknown as Record<string, unknown>,
          strategy: mockResult.strategy as unknown as Record<string, unknown>,
          output: mockResult.output as unknown as Record<string, unknown>,
          score: mockResult.score as unknown as Record<string, unknown>,
        });
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
          vision: mockResult.vision,
          strategy: mockResult.strategy,
          output: mockResult.output,
          score: mockResult.score,
          durationMs: mockResult.durationMs,
        },
      });
    }

    // ── PRODUCTION: pipeline real + try-on em PARALELO ──
    // Compor material para conjunto (duas peças com materiais diferentes)
    let materialHint: string | undefined = material || undefined;
    if (productType?.startsWith("conjunto:") && material2) {
      const types = productType.replace("conjunto:", "").split("+");
      const parts: string[] = [];
      if (material) parts.push(`Peça 1 (${types[0] || "peça 1"}): ${material}`);
      parts.push(`Peça 2 (${types[1] || "peça 2"}): ${material2}`);
      materialHint = parts.join(" | ");
    }

    // ── Função try-on (roda em paralelo com pipeline) ──
    // Provider ÚNICO: Gemini 3.1 Flash Image (Nano Banana 2)
    // Aceita até 14 imagens de referência — enviamos: modelo + produto + close-up + 2ª peça
    const runTryOn = async (): Promise<{ url: string | null; provider: string | null; debug?: string }> => {
      if (!store) return { url: null, provider: null };
      if (!process.env.GOOGLE_AI_API_KEY) {
        return { url: null, provider: null, debug: "GOOGLE_AI_API_KEY not configured" };
      }

      try {
        // Buscar modelo do banco ou modelo ativa
        let modelImageUrl: string | null = null;

        // Prioridade 1: Modelo do banco selecionada pelo usuário
        if (modelBankId) {
          try {
            const { createAdminClient } = await import("@/lib/supabase/admin");
            const supabase = createAdminClient();
            const { data: bankModel } = await supabase
              .from("model_bank")
              .select("image_url")
              .eq("id", modelBankId)
              .single();
            if (bankModel?.image_url) {
              modelImageUrl = bankModel.image_url;
              console.log(`[TryOn] 🏦 Modelo do banco: ${modelImageUrl!.substring(0, 60)}...`);
            }
          } catch (e) {
            console.warn("[TryOn] Erro ao buscar modelo do banco:", e instanceof Error ? e.message : e);
          }
        }

        // Prioridade 2: Modelo ativa da loja (custom usa preview_url, stock usa image_url)
        if (!modelImageUrl) {
          const activeModel = await getActiveModel(store.id);
          const activeUrl = activeModel?.preview_url || activeModel?.image_url;
          if (activeUrl) {
            modelImageUrl = activeUrl;
            console.log(`[TryOn] 👤 Modelo ativa: ${modelImageUrl!.substring(0, 60)}...`);
          }
        }

        if (!modelImageUrl) {
          console.log("[TryOn] ⚠️ Nenhuma modelo disponível");
          return { url: null, provider: null, debug: "no model available" };
        }

        // Baixar modelo como base64
        const modelRes = await fetch(modelImageUrl);
        const modelBuf = Buffer.from(await modelRes.arrayBuffer());

        // Montar chamada Nano Banana com TODAS as fotos disponíveis
        // Ordem de imagens no prompt:
        //   1. Modelo (referência visual — rosto, corpo, tom de pele)
        //   2. Produto principal (outfit completo no manequim)
        //   3. Close-up do tecido (textura, detalhes — opcional)
        //   4. Segunda peça do conjunto (opcional)
        const { nanoBananaTryOn } = await import("@/lib/google/nano-banana");
        console.log(`[TryOn] 🍌 Gemini 3.1 Flash Image — ${1 + extraImages.length} foto(s) do produto + modelo`);

        // Extrair cor da marca da loja (se background = minha_marca)
        let brandColorHex: string | undefined;
        if (backgroundType === "minha_marca" && store) {
          try {
            const { createAdminClient } = await import("@/lib/supabase/admin");
            const supabase = createAdminClient();
            const { data: storeData } = await supabase
              .from("stores")
              .select("brand_colors")
              .eq("id", store.id)
              .single();
            const bc = storeData?.brand_colors as Record<string, string> | null;
            brandColorHex = bc?.primary || undefined;
            if (brandColorHex) console.log(`[TryOn] 🎨 Cor da marca: ${brandColorHex}`);
          } catch { /* ignore */ }
        }

        const nanoResult = await nanoBananaTryOn({
          productImageBase64: imageBase64,
          productMimeType: mediaType,
          closeUpBase64: extraImages[0]?.base64,
          closeUpMimeType: extraImages[0]?.mediaType,
          secondPieceBase64: extraImages[1]?.base64,
          secondPieceMimeType: extraImages[1]?.mediaType,
          modelImageBase64: modelBuf.toString("base64"),
          modelMimeType: modelRes.headers.get("content-type")?.startsWith("image/") ? modelRes.headers.get("content-type") as any : "image/png",
          bodyType: bodyType || "normal",
          background: backgroundType as any,
          brandColorHex,
          visionData: vtoData,
          storeId: store.id,
          campaignId: campaignRecord?.id,
        });

        if (nanoResult.status === "completed" && nanoResult.imageBase64) {
          console.log(`[TryOn] ✅ Gemini VTO sucesso (${nanoResult.durationMs}ms)`);
          return { url: `data:image/png;base64,${nanoResult.imageBase64}`, provider: "gemini-3-pro-image" };
        }

        console.warn(`[TryOn] ❌ Gemini VTO falhou:`, nanoResult.error);
        return { url: null, provider: null, debug: nanoResult.error || "Gemini VTO failed" };
      } catch (tryOnErr) {
        const errMsg = tryOnErr instanceof Error ? tryOnErr.message : String(tryOnErr);
        console.warn("[TryOn] Erro geral (não fatal):", errMsg);
        return { url: null, provider: null, debug: errMsg };
      }
    };

    try {
      // 🚀 SSE STREAMING: enviar progresso real do pipeline ao frontend
      console.log("[Generate] 🚀 Iniciando pipeline com SSE streaming...");

      const encoder = new TextEncoder();
      const stream = new TransformStream();
      const writer = stream.writable.getWriter();

      // Helper para enviar eventos SSE
      const sendSSE = async (event: string, data: any) => {
        try {
          await writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch { /* stream may be closed */ }
      };

      // Rodar pipeline em background enquanto o stream está aberto
      (async () => {
        try {
          const [tryOnSettled, pipelineSettled] = await Promise.allSettled([
            runTryOn(),
            runCampaignPipeline(
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
                signal: request.signal,
              },
              async (step, label, progress) => {
                console.log(`[Pipeline] ${step} (${progress}%) — ${label}`);
                await sendSSE("progress", { step, label, progress });
              }
            ),
          ]);

          // Extrair resultados com tratamento de falha parcial
          const tryOnResult = tryOnSettled.status === "fulfilled"
            ? tryOnSettled.value
            : { url: null, provider: null, debug: `TryOn failed: ${(tryOnSettled as PromiseRejectedResult).reason?.message || "unknown"}` };

          if (tryOnSettled.status === "rejected") {
            console.warn(`[Generate] ⚠️ TryOn falhou (partial success): ${(tryOnSettled as PromiseRejectedResult).reason?.message}`);
          }

          // Pipeline é obrigatório — se falhou, propaga o erro
          if (pipelineSettled.status === "rejected") {
            throw pipelineSettled.reason;
          }
          const pipelineResult = pipelineSettled.value;

          // Registrar custo do try-on
          if (tryOnResult.url && tryOnResult.provider && store) {
            try {
              const { createAdminClient } = await import("@/lib/supabase/admin");
              const supabase = createAdminClient();
              const { getExchangeRate } = await import("@/lib/pricing");
              const exchangeRate = await getExchangeRate();
              const baseCostUsd = 0.005;
              await supabase.from("api_cost_logs").insert({
                store_id: store.id,
                campaign_id: campaignRecord?.id || null,
                provider: "google",
                model_used: "gemini-3-pro-image",
                action: "virtual_try_on",
                cost_usd: baseCostUsd,
                cost_brl: baseCostUsd * exchangeRate,
                exchange_rate: exchangeRate,
              });
            } catch { /* ignore cost log failure */ }
          }

          // Persistir resultado no banco
          if (campaignRecord) {
            await savePipelineResult({
              campaignId: campaignRecord.id,
              durationMs: pipelineResult.durationMs,
              vision: pipelineResult.vision as unknown as Record<string, unknown>,
              strategy: pipelineResult.strategy as unknown as Record<string, unknown>,
              output: pipelineResult.output as unknown as Record<string, unknown>,
              score: pipelineResult.score as unknown as Record<string, unknown>,
            });
            if (needsAvulsoCredit) {
              await consumeCredit(store!.id, "campaigns");
              console.log(`[Generate] 💳 Crédito avulso CONSUMIDO após sucesso (produção)`);
            } else {
              await incrementCampaignsUsed(store!.id);
            }
          }

          // Enviar resultado final via SSE
          await sendSSE("done", {
            success: true,
            demo: false,
            campaignId: campaignRecord?.id || null,
            data: {
              vision: pipelineResult.vision,
              strategy: pipelineResult.strategy,
              output: pipelineResult.output,
              score: pipelineResult.score,
              durationMs: pipelineResult.durationMs,
              tryOnImageUrl: tryOnResult.url || null,
              tryOnProvider: tryOnResult.provider || null,
              tryOnDebug: tryOnResult.url ? undefined : (tryOnResult.debug || "no provider succeeded"),
            },
          });
        } catch (pipelineError: unknown) {
          // Marcar campanha como falha
          if (campaignRecord) {
            const msg = pipelineError instanceof Error ? pipelineError.message : "Pipeline error";
            await failCampaign(campaignRecord.id, msg);
          }
          const errMsg = pipelineError instanceof Error ? pipelineError.message : "Pipeline error";
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
