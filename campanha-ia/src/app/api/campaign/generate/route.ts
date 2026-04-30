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
} from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// v6: Pipeline Gemini Analyzer + Gemini VTO. Demo mode se nenhuma key existe.
const IS_DEMO_MODE = !process.env.GEMINI_API_KEY && !process.env.GOOGLE_AI_API_KEY;

/**
 * Lê o header X-App-Locale enviado pelo app (PT-BR/EN). Default PT-BR
 * mantém compatibilidade com chamadas antigas (dashboard web, curl etc).
 */
function parseTargetLocale(req: NextRequest): "pt-BR" | "en" {
  const raw = req.headers.get("x-app-locale") || req.headers.get("X-App-Locale");
  if (!raw) return "pt-BR";
  const norm = raw.trim().toLowerCase();
  if (norm === "en" || norm.startsWith("en-")) return "en";
  return "pt-BR";
}

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
    const targetLocale = parseTargetLocale(request);

    // ── Rate limit por IP (anti-abuso) ──
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip")
      || "unknown";
    const rateCheck = checkRateLimit(ip, { authenticated: !!clerkUserId });
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

    // whitelist de objetivos + sanitização de strings (anti-injection em prompt)
    const VALID_OBJECTIVES = new Set(["venda_imediata", "lancamento", "promocao", "engajamento", "trafego"]);
    const rawObjective = (formData.get("objective") as string) || "venda_imediata";
    const objective = VALID_OBJECTIVES.has(rawObjective) ? rawObjective : "venda_imediata";

    const safeStr = (v: unknown, max: number): string | null => {
      if (typeof v !== "string") return null;
      const trimmed = v.trim();
      if (trimmed.length === 0) return null;
      const capped = trimmed.length > max ? trimmed.slice(0, max) : trimmed;
      // Remove < > apenas (evita XSS quando stored e HTML renderizado)
      return capped.split("<").join("").split(">").join("");
    };

    const campaignTitle = safeStr(formData.get("title"), 120);
    const storeName = safeStr(formData.get("storeName"), 80) || "Minha Loja";
    const targetAudienceRaw = safeStr(formData.get("targetAudience"), 40);
    const toneOverrideRaw = safeStr(formData.get("toneOverride"), 40);
    const productType = safeStr(formData.get("productType"), 80);
    const material = safeStr(formData.get("material"), 80);
    const material2 = safeStr(formData.get("material2"), 80);

    // Mapear slugs → labels legíveis para o Sonnet
    const audienceLabels: Record<string, string> = {
      mulheres_25_40: "Mulheres 25-40 anos",
      jovens_18_25: "Jovens 18-25 anos",
      homens_25_45: "Homens 25-45 anos",
      maes: "Mães",
      publico_geral: "Público geral",
      premium: "Público premium / alto padrão",
    };
    const toneLabels: Record<string, string> = {
      casual_energetico: "Casual e energético",
      sofisticado: "Sofisticado e elegante",
      urgente: "Urgente e direto",
      acolhedor: "Acolhedor e próximo",
      divertido: "Divertido e leve",
    };
    const targetAudience = targetAudienceRaw ? (audienceLabels[targetAudienceRaw] || targetAudienceRaw) : null;
    const toneOverride = toneOverrideRaw ? (toneLabels[toneOverrideRaw] || toneOverrideRaw) : null;
    const modelBankId = formData.get("modelBankId") as string | null;
    const customModelId = formData.get("customModelId") as string | null;
    const backgroundType = (formData.get("backgroundType") as string) || "branco";


    const bodyType = (formData.get("bodyType") as string) as "normal" | "plus" | null;

    // Validation
    if (!imageFile) {
      return NextResponse.json({ error: "Envie a foto do produto", code: "MISSING_IMAGE" }, { status: 400 });
    }
    const priceStr = price || "";
    // valida que price é numérico e dentro de range razoável (R$ 0,01 – R$ 99.999)
    if (priceStr) {
      const priceNum = parseFloat(priceStr.replace(",", "."));
      if (!Number.isFinite(priceNum) || priceNum < 0 || priceNum > 99999) {
        return NextResponse.json(
          { error: "Preço inválido (use 0 a 99999)", code: "INVALID_PRICE" },
          { status: 400 },
        );
      }
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

    // ── Verificar quota e reservar crédito UPFRONT (FIX: race condition) ──
    // Reservamos o slot ANTES de gerar — se a geração falhar devolvemos depois.
    let needsAvulsoCredit = false;
    let creditReserved = false;
    let planSlotReserved = false;
    // Trial-only: usuário usou mini-trial e nunca comprou nada. Esses recebem
    // 1 foto em vez de 3 — corte de ~66% do custo de imagem na geração trial,
    // que é o caminho de aquisição (deve ser barato pra escalar).
    let isTrialOnly = false;
    if (store) {
      const quota = await canGenerateCampaign(store.id);
      if (!quota.allowed) {
        // Sem quota de plano e sem créditos avulsos
        const credits = await getStoreCredits(store.id);
        return NextResponse.json({
          error: `Suas ${quota.limit} campanhas do mês acabaram!`,
          code: "QUOTA_EXCEEDED",
          used: quota.used,
          limit: quota.limit,
          credits: credits.campaigns,
          upgradeHint: true,
        }, { status: 429 });
      } else if (quota.hasAvulso) {
        // Plano esgotado mas tem crédito avulso — consumir atomicamente
        const consumed = await consumeCredit(store.id, "campaigns");
        if (consumed) {
          needsAvulsoCredit = true;
          creditReserved = true;
          console.log(`[Generate] 💳 Crédito avulso RESERVADO upfront (plano esgotado: ${quota.used}/${quota.limit})`);
        } else {
          // Race condition: crédito consumido entre check e consume
          const credits = await getStoreCredits(store.id);
          return NextResponse.json({
            error: `Suas campanhas do mês acabaram!`,
            code: "QUOTA_EXCEEDED",
            used: quota.used,
            limit: quota.limit,
            credits: credits.campaigns,
            upgradeHint: true,
          }, { status: 429 });
        }
      } else {
        // Plano tem quota — reservar slot atomicamente agora (evita race condition)
        await incrementCampaignsUsed(store.id);
        planSlotReserved = true;
        console.log(`[Generate] 📋 Slot de plano RESERVADO upfront (${quota.used + 1}/${quota.limit})`);
      }

      // ── Trial-only detection ──
      // Quem usou mini-trial e nunca comprou nada gera 1 foto em vez de 3.
      // Sinais combinados (legacy — ver docs/agent-coordination.md):
      //  1) `creditReserved` (não tá em plano pago)
      //  2) `mini_trial_uses` tem entrada pra esse clerk_user_id
      //  3) Zero rows em `credit_purchases` da loja
      // Hoje o pipeline ignora `photoCount` e gera 1 foto pra todo mundo, mas
      // a flag `isTrialOnly` ainda é usada pra decidir os teasers blurados de
      // upsell em `lockedTeaserUrls`. Falha de detecção é fail-safe: o usuário
      // continua recebendo a foto, só perde o teaser do trial.
      if (creditReserved && clerkUserId) {
        try {
          const { createAdminClient: createAdmin } = await import("@/lib/supabase/admin");
          const sb = createAdmin();
          const [{ count: trialCount }, { count: purchaseCount }] = await Promise.all([
            sb
              .from("mini_trial_uses")
              .select("clerk_user_id", { count: "exact", head: true })
              .eq("clerk_user_id", clerkUserId),
            sb
              .from("credit_purchases")
              .select("id", { count: "exact", head: true })
              .eq("store_id", store.id),
          ]);
          isTrialOnly = (trialCount ?? 0) > 0 && (purchaseCount ?? 0) === 0;
          if (isTrialOnly) {
            console.log(`[Generate] 🎁 Trial-only user → 1 foto (corte de custo)`);
          }
        } catch (trialErr) {
          // Detection failure não bloqueia geração — fail-safe pro usuário
          // recebe a foto mesmo se a detecção do trial falhar (só não vê teaser).
          console.warn("[Generate] trial detection failed, treating as paid:", trialErr);
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
    } catch (sharpErr) {
      console.warn("[Generate] ⚠️ Sharp indisponível, usando imagem original:", sharpErr);
    }
    // se Sharp falhou E buffer ainda é grande, rejeita em vez de mandar
    // 50MB pro Gemini (que retorna erro confuso ou estoura rate-limit).
    if (imageBuffer.length > 8 * 1024 * 1024) {
      return NextResponse.json(
        {
          error: "Imagem muito grande após otimização. Tente uma foto menor (<8MB).",
          code: "IMAGE_TOO_LARGE_POST_OPTIM",
        },
        { status: 400 },
      );
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
        title: campaignTitle || undefined,
      });
    }

    // ── DEMO MODE ──
    if (IS_DEMO_MODE) {
      console.log("[API:campaign/generate] 🎭 Demo mode — usando dados mock");
      const mockResult = await runMockPipeline(3000);

      if (campaignRecord) {
        if (needsAvulsoCredit) {
          // Crédito avulso já consumido upfront
        } else if (!planSlotReserved) {
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

    // ── PRODUCTION: buscar modelo para o pipeline v5 ──
    let modelImageBase64: string | null = null;
    let modelMediaType = "image/png";
    // Metadados da modelo para o Gemini Analyzer (prompts contextuais)
    let modelInfo: { skinTone?: string; bodyType?: string; pose?: string; hairColor?: string; hairTexture?: string; hairLength?: string; ageRange?: string; style?: string; gender?: string } = {};

    if (store) {
      try {
        let modelImageUrl: string | null = null;

        // Prioridade 0: modelo customizada selecionada explicitamente pelo usuário
        if (customModelId && store) {
          const { createAdminClient } = await import("@/lib/supabase/admin");
          const supabase = createAdminClient();
          const { data: customModel } = await supabase
            .from("store_models")
            .select("*")
            .eq("id", customModelId)
            .eq("store_id", store.id)
            .single();
          if (customModel) {
            const cusUrl = customModel.preview_url || customModel.image_url;
            if (cusUrl) {
              modelImageUrl = cusUrl;
              modelInfo = {
                skinTone: customModel.skin_tone || undefined,
                bodyType: customModel.body_type || undefined,
                hairColor: customModel.hair_color || undefined,
                hairTexture: customModel.hair_texture || undefined,
                hairLength: customModel.hair_length || undefined,
                ageRange: customModel.age_range || undefined,
                style: customModel.style || undefined,
                gender: customModel.gender || undefined,
              };
              console.log(`[Generate] ⭐ Modelo customizada selecionada: ${customModelId} (${modelInfo.skinTone || '?'}, ${modelInfo.bodyType || '?'})`);
            }
          }
        }

        // Prioridade 1: modelo do banco selecionado pelo usuário
        if (!modelImageUrl && modelBankId) {
          const { createAdminClient } = await import("@/lib/supabase/admin");
          const supabase = createAdminClient();
          const { data: bankModel } = await supabase
            .from("model_bank")
            .select("image_url, body_type, skin_tone, pose, gender, hair_color, hair_texture, hair_length, age_range, style")
            .eq("id", modelBankId)
            .single();
          if (bankModel?.image_url) {
            modelImageUrl = bankModel.image_url;
            modelInfo = {
              skinTone: bankModel.skin_tone || undefined,
              bodyType: bankModel.body_type || undefined,
              pose: bankModel.pose || undefined,
              hairColor: bankModel.hair_color || undefined,
              hairTexture: bankModel.hair_texture || undefined,
              hairLength: bankModel.hair_length || undefined,
              ageRange: bankModel.age_range || undefined,
              style: bankModel.style || undefined,
              gender: (bankModel as any).gender || undefined,
            };
            console.log(`[Generate] 🏦 Modelo do banco: ${modelBankId} (${modelInfo.skinTone || '?'}, ${modelInfo.bodyType || '?'}, ${modelInfo.hairColor || '?'})`);
          }
        }

        // Prioridade 2: modelo ativa da loja (gerada pelo Gemini — tem mais campos)
        if (!modelImageUrl) {
          const activeModel = await getActiveModel(store.id);
          const activeUrl = activeModel?.preview_url || activeModel?.image_url;
          if (activeUrl) {
            modelImageUrl = activeUrl;
            const am = activeModel as Record<string, unknown>;
            modelInfo = {
              skinTone: (am.skin_tone as string) || undefined,
              bodyType: (am.body_type as string) || undefined,
              hairColor: (am.hair_color as string) || undefined,
              hairTexture: (am.hair_texture as string) || undefined,
              hairLength: (am.hair_length as string) || undefined,
              ageRange: (am.age_range as string) || undefined,
              style: (am.style as string) || undefined,
              gender: (am.gender as string) || undefined,
            };
            console.log(`[Generate] 👤 Modelo ativa da loja (${modelInfo.skinTone || '?'}, ${modelInfo.bodyType || '?'})`);
          }
        }

        if (modelImageUrl) {
          const modelRes = await fetch(modelImageUrl, { signal: AbortSignal.timeout(8000) });
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
      // 🚀 SSE STREAMING — pipeline v5
      console.log("[Generate] 🚀 Iniciando pipeline v6 (Gemini Analyzer + 3x Gemini VTO)...");

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

              modelInfo,
              storeId: store?.id,
              campaignId: campaignRecord?.id,
              signal: request.signal,
              // Sonnet copy: público-alvo e tom (só se escolhido pelo usuário)
              targetAudience: targetAudience && targetAudience !== "auto" ? targetAudience : undefined,
              toneOverride: toneOverride || undefined,
              targetLocale,
              // Trial-only → 1 foto. Default → 3 (paid plans).
              photoCount: isTrialOnly ? 1 : 3,
            },
            async (step, label, progress) => {
              console.log(`[Pipeline] ${step} (${progress}%) — ${label}`);
              await sendSSE("progress", { step, label, progress });
            }
          );

          const { successCount, images, analise, vto_hints, dicas_postagem, durationMs } = pipelineResult;
          const photoCount = isTrialOnly ? 1 : 3;

          // ── Regra de negócio: cobrar crédito SÓ se ≥1 imagem gerada ──
          if (successCount === 0) {
            if (campaignRecord) await failCampaign(campaignRecord.id, `0/${photoCount} images generated`);
            // Devolver crédito avulso se reservado upfront
            if (creditReserved && store) {
              try {
                const { createAdminClient: createAdmin } = await import("@/lib/supabase/admin");
                const sb = createAdmin();
                // usa RPC atômica em vez de read-modify-write
                await sb.rpc("add_credits_atomic", {
                  p_store_id: store.id,
                  p_column: "credit_campaigns",
                  p_quantity: 1,
                });
                console.log(`[Generate] 💳 Crédito avulso DEVOLVIDO (0 imagens geradas)`);
              } catch (refundErr) {
                console.error(`[Generate] ❌ Falha ao devolver crédito:`, refundErr);
              }
            }
            // Devolver slot de plano se reservado upfront
            if (planSlotReserved && store) {
              try {
                const { createAdminClient: createAdmin } = await import("@/lib/supabase/admin");
                const sb = createAdmin();
                const { getCurrentUsage: getUsage } = await import("@/lib/db");
                const usage = await getUsage(store.id);
                if (usage) {
                  // RPC atômica (evita race condition em read-modify-write)
                  await sb.rpc("decrement_campaigns_used", { p_usage_id: usage.id });
                  console.log(`[Generate] 📋 Slot de plano DEVOLVIDO (0 imagens geradas)`);
                }
              } catch (refundErr) {
                console.error(`[Generate] ❌ Falha ao devolver slot de plano:`, refundErr);
              }
            }
            await sendSSE("error", {
              error: "Nenhuma foto foi gerada. Tente novamente.",
              retry: true,
              code: "ALL_IMAGES_FAILED",
            });
            return;
          }

          // ✅ ≥1 imagem gerada — cobrar crédito
          if (campaignRecord) {
            // Gemini VTO retorna base64 — upload direto para Supabase Storage
            const imageUrls: (string | null)[] = [];
            try {
              const { createAdminClient } = await import("@/lib/supabase/admin");
              const supabase = createAdminClient();
              for (let i = 0; i < images.length; i++) {
                const img = images[i];
                if (!img) { imageUrls.push(null); continue; }
                try {
                  // Converter base64 para Buffer e upload direto
                  const buf = Buffer.from(img.imageBase64, "base64");
                  const ext = img.mimeType === "image/png" ? "png" : "jpg";
                  const contentType = img.mimeType || "image/jpeg";
                  const path = `campaigns/${campaignRecord.id}/v6_look_${i + 1}.${ext}`;
                  const { error: upErr } = await supabase.storage
                    .from("generated-images")
                    .upload(path, buf, { contentType, upsert: true });
                  if (upErr) {
                    console.warn(`[Generate] ⚠️ Upload imagem ${i + 1} falhou:`, upErr.message);
                    imageUrls.push(null);
                  } else {
                    const { data: urlData } = supabase.storage
                      .from("generated-images")
                      .getPublicUrl(path);
                    imageUrls.push(urlData.publicUrl);
                    // Preencher imageUrl no objeto para SSE
                    img.imageUrl = urlData.publicUrl;
                    console.log(`[Generate] ✅ Imagem ${i + 1} salva: ${path}`);
                  }
                } catch (uploadErr) {
                  console.warn(`[Generate] ⚠️ Upload imagem ${i + 1} exception:`, uploadErr);
                  imageUrls.push(null);
                }
              }
            } catch (e) {
              console.warn("[Generate] Upload parcial falhou:", e);
              images.forEach(() => imageUrls.push(null));
            }

            // ── FIX P0: Se TODOS uploads falharam, refundar crédito/slot e abortar ──
            const allUploadsFailed = imageUrls.length > 0 && imageUrls.every((u) => !u);
            if (allUploadsFailed) {
              console.error("[Generate] 🚨 Todos os uploads falharam — refundando e abortando");
              if (campaignRecord) await failCampaign(campaignRecord.id, "All uploads failed");
              if (creditReserved && store) {
                try {
                  const { createAdminClient: createAdmin } = await import("@/lib/supabase/admin");
                  const sb = createAdmin();
                  await sb.rpc("add_credits_atomic", {
                    p_store_id: store.id,
                    p_column: "credit_campaigns",
                    p_quantity: 1,
                  });
                  console.log("[Generate] 💳 Crédito avulso DEVOLVIDO (todos uploads falharam)");
                } catch (refundErr) {
                  console.error("[Generate] ❌ Falha ao devolver crédito:", refundErr);
                }
              }
              if (planSlotReserved && store) {
                try {
                  const { createAdminClient: createAdmin } = await import("@/lib/supabase/admin");
                  const sb = createAdmin();
                  const { getCurrentUsage: getUsage } = await import("@/lib/db");
                  const usage = await getUsage(store.id);
                  if (usage) {
                    await sb
                      .from("store_usage")
                      .update({ campaigns_generated: Math.max(0, (usage.campaigns_generated || 0) - 1) })
                      .eq("id", usage.id);
                    console.log("[Generate] 📋 Slot de plano DEVOLVIDO (todos uploads falharam)");
                  }
                } catch (refundErr) {
                  console.error("[Generate] ❌ Falha ao devolver slot:", refundErr);
                }
              }
              await sendSSE("error", {
                error: "Falha ao salvar as imagens geradas. Tente novamente.",
                retry: true,
                code: "ALL_UPLOADS_FAILED",
              });
              return;
            }

            // ── Trial teaser thumbs (3-thumb row no resultado) ──
            // Trial-only gera só 1 foto. Pra slot 2/3 da carrosselzinha embaixo
            // do hero, criamos 2 crops blurados da foto da modelo (entrada do
            // user) com regiões diferentes — esquerda mais top-half, direita
            // mais bottom-half. Cérebro do usuário interpreta como "outros 2
            // ângulos" sem precisar de chamada extra ao Gemini.
            // Custo: ~120ms CPU + ~100KB storage. Skip silencioso em erro —
            // o resultado funciona normalmente sem os teasers.
            let lockedTeaserUrls: [string, string] | undefined;
            if (isTrialOnly) {
              try {
                const sharp = (await import("sharp")).default;
                const modelBuf = Buffer.from(modelImageBase64!, "base64");
                const meta = await sharp(modelBuf as any).metadata();
                const w = meta.width ?? 1024;
                const h = meta.height ?? 1536;

                const [leftBlur, rightBlur] = await Promise.all([
                  sharp(modelBuf as any)
                    .extract({ left: 0, top: 0, width: w, height: Math.floor(h * 0.7) })
                    .resize(400, 600, { fit: "cover" })
                    .blur(45)
                    .webp({ quality: 60 })
                    .toBuffer(),
                  sharp(modelBuf as any)
                    .extract({
                      left: 0,
                      top: Math.floor(h * 0.3),
                      width: w,
                      height: Math.floor(h * 0.7),
                    })
                    .resize(400, 600, { fit: "cover" })
                    .blur(50)
                    .webp({ quality: 60 })
                    .toBuffer(),
                ]);

                const { createAdminClient: createAdmin } = await import("@/lib/supabase/admin");
                const sb = createAdmin();
                const teaserPaths: [string, string] = [
                  `campaigns/${campaignRecord.id}/teaser_left.webp`,
                  `campaigns/${campaignRecord.id}/teaser_right.webp`,
                ];
                const [{ error: e1 }, { error: e2 }] = await Promise.all([
                  sb.storage
                    .from("generated-images")
                    .upload(teaserPaths[0], leftBlur as any, {
                      contentType: "image/webp",
                      upsert: true,
                    }),
                  sb.storage
                    .from("generated-images")
                    .upload(teaserPaths[1], rightBlur as any, {
                      contentType: "image/webp",
                      upsert: true,
                    }),
                ]);
                if (!e1 && !e2) {
                  const left = sb.storage.from("generated-images").getPublicUrl(teaserPaths[0]).data.publicUrl;
                  const right = sb.storage.from("generated-images").getPublicUrl(teaserPaths[1]).data.publicUrl;
                  lockedTeaserUrls = [left, right];
                  console.log(`[Generate] 🔒 Trial teasers gerados: ${teaserPaths[0]}, ${teaserPaths[1]}`);
                } else {
                  console.warn("[Generate] ⚠️ Trial teasers upload falhou:", e1?.message, e2?.message);
                }
              } catch (teaserErr) {
                console.warn("[Generate] ⚠️ Trial teasers skipped:", teaserErr);
              }
            }

            await savePipelineResultV3({
              campaignId: campaignRecord.id,
              durationMs,
              analise: analise as unknown as Record<string, unknown>,
              imageUrls,
              prompts: (vto_hints?.scene_prompts || []) as unknown as Record<string, unknown>[],
              dicas_postagem: dicas_postagem as unknown as Record<string, unknown>,
              successCount,
              lockedTeaserUrls,
            });

            if (needsAvulsoCredit) {
              // Crédito avulso já consumido upfront
              console.log(`[Generate] 💳 Crédito avulso já reservado upfront (${successCount}/${photoCount} imagens geradas)`);
            } else if (planSlotReserved) {
              // Slot de plano já reservado upfront (evita double-count)
              console.log(`[Generate] 📋 Slot de plano já reservado upfront (${successCount}/${photoCount} imagens geradas)`);
            } else {
              await incrementCampaignsUsed(store!.id);
            }
          }

          // Enviar resultado final via SSE
          // Gemini VTO — imagens já estão no Supabase, enviar URLs
          await sendSSE("done", {
            success: true,
            campaignId: campaignRecord?.id || null,
            objective: objective || null,
            targetAudience: targetAudience || null,
            toneOverride: toneOverride || null,
            data: {
              analise,
              images: images.map(img => img ? {
                imageUrl: img.imageUrl,
                mimeType: img.mimeType,
                conceptName: img.conceptName,
                durationMs: img.durationMs,
              } : null),
              prompts: vto_hints?.scene_prompts || [],
              dicas_postagem,
              durationMs,
              successCount,
            },
          });
        } catch (pipelineError: unknown) {
          if (campaignRecord) {
            const msg = pipelineError instanceof Error ? pipelineError.message : "Pipeline v6 error";
            await failCampaign(campaignRecord.id, msg);
          }

          // Extrair código classificado (vem do callGeminiSafe)
          const errObj = pipelineError as Record<string, unknown>;
          const errCode = (errObj?.code as string) || "PIPELINE_ERROR";
          const errMsg = pipelineError instanceof Error ? pipelineError.message : "Erro ao gerar campanha";
          const isRetryable = errObj?.retryable === true;
          const technicalMsg = (errObj?.technicalMessage as string) || errMsg;

          // Devolver crédito avulso se o user não recebeu resultado:
          // - Erros retryable (429, 503) — o user vai tentar de novo
          // - SAFETY_BLOCKED / IMAGE_GENERATION_BLOCKED — a IA recusou, não é culpa do user
          const shouldRefund = isRetryable || errCode === "SAFETY_BLOCKED" || errCode === "IMAGE_GENERATION_BLOCKED";
          if (creditReserved && shouldRefund && store) {
            try {
              const { createAdminClient: createAdmin } = await import("@/lib/supabase/admin");
              const sb = createAdmin();
              const { data: curr } = await sb.from("stores").select("credit_campaigns").eq("id", store.id).single();
              await sb.from("stores").update({ credit_campaigns: (curr?.credit_campaigns || 0) + 1 }).eq("id", store.id);
              console.log(`[Generate] 💳 Crédito avulso DEVOLVIDO (${errCode})`);
            } catch (refundErr) {
              console.error(`[Generate] ❌ Falha ao devolver crédito:`, refundErr);
            }
          }

          // Logar erro no api_cost_logs para visibilidade no admin dashboard
          if (store?.id) {
            try {
              const { createAdminClient } = await import("@/lib/supabase/admin");
              const sb = createAdminClient();
              await sb.from("api_cost_logs").insert({
                store_id: store.id,
                campaign_id: campaignRecord?.id || null,
                provider: "google",
                model_used: "pipeline_v6",
                action: "pipeline_error",
                cost_usd: 0,
                cost_brl: 0,
                exchange_rate: 0,
                input_tokens: 0,
                output_tokens: 0,
                tokens_used: 0,
                response_time_ms: Date.now() - Date.parse(campaignRecord?.created_at || new Date().toISOString()),
                metadata: { error_code: errCode, message: technicalMsg.slice(0, 500), retryable: isRetryable },
              });
            } catch { /* non-critical — don't block error response */ }
          }

          await sendSSE("error", {
            error: errMsg,
            code: errCode,
            retryable: isRetryable,
          });
        } finally {
          // Stream sempre fecha aqui — cobre tanto success quanto error/ALL_IMAGES_FAILED paths
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

      if (String(errorObj.message || "").includes("API_KEY")) {
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

    if (String(errorObj.message || "").includes("API_KEY")) {
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
