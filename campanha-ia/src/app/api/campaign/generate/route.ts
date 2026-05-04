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
import { logger, captureError, hashStoreId } from "@/lib/observability";
import * as Sentry from "@sentry/nextjs";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// v6: Pipeline Gemini Analyzer + Gemini VTO. Demo mode se nenhuma key existe.
const IS_DEMO_MODE = !process.env.GEMINI_API_KEY && !process.env.GOOGLE_AI_API_KEY;

/**
 * Phase 02 D-13: truncate user-supplied strings before logging so a 5KB
 * "loja name" or product description doesn't pollute the log line. 50-char
 * cap matches the audit guidance; ellipsis suffix marks truncation.
 */
function truncForLog(s: unknown, max = 50): string {
  if (typeof s !== "string") return String(s);
  return s.length > max ? s.slice(0, max) + "..." : s;
}

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
    if (store && !IS_DEMO_MODE) {
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
          logger.info("avulso_credit_reserved_upfront", {
            store_id: store ? hashStoreId(store.id) : "anon",
            quota_used: quota.used,
            quota_limit: quota.limit,
          });
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
        logger.info("plan_slot_reserved_upfront", {
          store_id: store ? hashStoreId(store.id) : "anon",
          quota_used: quota.used + 1,
          quota_limit: quota.limit,
        });
      }

      // ── Trial-only detection ──
      // Quem usou mini-trial e nunca comprou nada gera 1 foto em vez de 3.
      // Sinais combinados (legacy — ver docs/cleanup-pendencias.md):
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
            logger.info("trial_only_user_detected", {
              store_id: store ? hashStoreId(store.id) : "anon",
            });
          }
        } catch (trialErr) {
          // D-04 (Phase 02 H-3): fail-secure. Detection failure → assume trial
          // (1 photo, not 3). Prevents abuse where DB outage could be triggered
          // to get 3 photos on a single trial credit.
          isTrialOnly = true;
          captureError(trialErr, {
            route: "campaign.generate",
            step: "trial_check",
            store_id: store ? hashStoreId(store.id) : "anon",
            severity: "warn",
            fail_secure_applied: true,
          });
          logger.warn("trial_check_fail_secure", {
            reason: trialErr instanceof Error ? trialErr.message : String(trialErr),
          });
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
      logger.debug("image_downscaled", {
        original_kb: Math.round(originalSize / 1024),
        new_kb: Math.round(imageBuffer.length / 1024),
        savings_pct: savings,
      });
    } catch (sharpErr) {
      logger.warn("sharp_unavailable_using_original", {
        error: sharpErr instanceof Error ? sharpErr.message : String(sharpErr),
      });
      captureError(sharpErr, {
        route: "campaign.generate",
        step: "image_downscale",
        store_id: store ? hashStoreId(store.id) : "anon",
      });
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
      logger.debug("closeup_processed", {
        original_kb: Math.round(closeUpImage.size / 1024),
      });
    }
    if (secondImage && secondImage.size > 0) {
      extraImages.push(await downscaleExtra(secondImage));
      logger.debug("second_piece_processed", {
        original_kb: Math.round(secondImage.size / 1024),
      });
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
          logger.warn("storage_upload_failed_pre_pipeline", {
            error: uploadError.message,
          });
          productPhotoUrl = `upload-failed://${storagePath}`;
        } else {
          const { data: urlData } = supabase.storage
            .from("product-photos")
            .getPublicUrl(storagePath);
          productPhotoUrl = urlData.publicUrl;
        }
      } catch {
        logger.warn("storage_unavailable_saving_path_reference");
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
      logger.info("demo_mode_active", { skip_quota: true });
      const mockResult = await runMockPipeline(3000);
      // M-11 fix: demo mode never consumes quota or credits. Upstream gate
      // skipped reservation when !IS_DEMO_MODE; nothing to reconcile here.

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
    // H-12: track if the 1×1 fallback PNG was assigned. Used to skip the
    // trial teaser branch (Sharp errors swallowed today on the 1×1 input).
    let usingFallbackModel = false;
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
              logger.info("custom_model_selected", {
                model_id: customModelId,
                skin_tone: modelInfo.skinTone || "?",
                body_type: modelInfo.bodyType || "?",
              });
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
            logger.info("bank_model_selected", {
              model_id: modelBankId,
              skin_tone: modelInfo.skinTone || "?",
              body_type: modelInfo.bodyType || "?",
              hair_color: modelInfo.hairColor || "?",
            });
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
            logger.info("active_store_model_selected", {
              skin_tone: modelInfo.skinTone || "?",
              body_type: modelInfo.bodyType || "?",
            });
          }
        }

        if (modelImageUrl) {
          const modelRes = await fetch(modelImageUrl, { signal: AbortSignal.timeout(8000) });
          const modelBuf = Buffer.from(await modelRes.arrayBuffer());
          modelImageBase64 = modelBuf.toString("base64");
          const ct = modelRes.headers.get("content-type");
          if (ct?.startsWith("image/")) modelMediaType = ct;
          logger.debug("model_image_loaded", { kb: Math.round(modelBuf.length / 1024) });
        } else {
          logger.warn("no_model_available_continuing");
        }
      } catch (e) {
        logger.warn("model_load_failed_non_fatal", {
          error: e instanceof Error ? e.message : String(e),
        });
        captureError(e, {
          route: "campaign.generate",
          step: "model_load",
          store_id: store ? hashStoreId(store.id) : "anon",
        });
      }
    }

    if (!modelImageBase64) {
      // Fallback: pixel transparente 1x1 PNG — o Gemini ainda pode gerar sem modelo de referência
      modelImageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      modelMediaType = "image/png";
      usingFallbackModel = true; // H-12: signal teaser skip
    }

    try {
      // 🚀 SSE STREAMING — pipeline v5
      logger.info("campaign_generate_pipeline_start", {
        store_id: store ? hashStoreId(store.id) : "anon",
        campaign_id: campaignRecord?.id ?? null,
        is_trial: isTrialOnly,
        store_name: truncForLog(store?.name || storeName),
      });

      const encoder = new TextEncoder();
      const stream = new TransformStream();
      const writer = stream.writable.getWriter();

      const sendSSE = async (event: string, data: unknown) => {
        try {
          await writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch { /* stream fechado */ }
      };

      // D-09 (Phase 02 H-2): write a single client_disconnected row to
      // api_cost_logs and emit a Sentry event. NO refund — cost was real.
      // Idempotent: only fires once per IIFE via the disconnectLogged flag.
      let disconnectLogged = false;
      const logDisconnectAndExit = async (currentStep: string) => {
        if (disconnectLogged) return;
        disconnectLogged = true;
        if (!store) return; // anonymous demo path — nothing to log
        try {
          const { createAdminClient: createAdminDc } = await import("@/lib/supabase/admin");
          const sbDc = createAdminDc();
          await sbDc.from("api_cost_logs").insert({
            store_id: store.id,
            campaign_id: campaignRecord?.id ?? null,
            provider: "system",
            model_used: "client_disconnect",
            action: "client_disconnected",
            cost_usd: 0,
            cost_brl: 0,
            input_tokens: 0,
            output_tokens: 0,
            tokens_used: 0,
            metadata: {
              client_disconnected: true,
              last_step: currentStep,
            },
          });
          // D-14 custom Sentry event
          Sentry.captureMessage("campaign.client_disconnected", {
            level: "info",
            tags: {
              route: "campaign.generate",
              step: currentStep,
              store_id: hashStoreId(store.id),
            },
          });
          logger.info("client_disconnected", { last_step: currentStep, store_id: hashStoreId(store.id) });
        } catch (e) {
          captureError(e, {
            route: "campaign.generate",
            step: "log_disconnect",
            store_id: hashStoreId(store.id),
          });
        }
      };

      (async () => {
        try {
          // D-07/D-10 (Phase 02): pre-pipeline abort check
          if (request.signal.aborted) {
            await logDisconnectAndExit("before_pipeline");
            return;
          }
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
              logger.debug("pipeline_step", { step, progress, label: truncForLog(label, 80) });
              await sendSSE("progress", { step, label, progress });
            }
          );

          // D-07/D-10 (Phase 02): post-pipeline abort check before any
          // upload, DB write, or SSE delivery emit fires.
          if (request.signal.aborted) {
            await logDisconnectAndExit("after_pipeline");
            return;
          }
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
                logger.info("avulso_credit_refunded_zero_images", {
                  store_id: hashStoreId(store.id),
                });
              } catch (refundErr) {
                logger.error("refund_failed_zero_images", {
                  error: refundErr instanceof Error ? refundErr.message : String(refundErr),
                });
                captureError(refundErr, {
                  route: "campaign.generate",
                  step: "refund",
                  store_id: hashStoreId(store.id),
                });
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
                  logger.info("plan_slot_refunded_zero_images", {
                    store_id: hashStoreId(store.id),
                  });
                }
              } catch (refundErr) {
                logger.error("plan_slot_refund_failed_zero_images", {
                  error: refundErr instanceof Error ? refundErr.message : String(refundErr),
                });
                captureError(refundErr, {
                  route: "campaign.generate",
                  step: "refund",
                  store_id: hashStoreId(store.id),
                });
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
                // Converter base64 pra Buffer uma vez (não muda entre tentativas)
                const buf = Buffer.from(img.imageBase64, "base64");
                const ext = img.mimeType === "image/png" ? "png" : "jpg";
                const contentType = img.mimeType || "image/jpeg";
                const path = `campaigns/${campaignRecord.id}/v6_look_${i + 1}.${ext}`;
                // Retry com backoff exponencial — `fetch failed` na rede VPS↔
                // Supabase é transitório. Sem retry, 1 blip = campanha inteira
                // marcada como failed e crédito devolvido (UX ruim).
                // Tentativas: imediata, 400ms, 1200ms.
                let uploaded = false;
                let lastError: string | null = null;
                for (let attempt = 1; attempt <= 3; attempt++) {
                  // D-07/D-10 (Phase 02): abort upload retry loop on disconnect.
                  if (request.signal.aborted) {
                    await logDisconnectAndExit("upload_retry");
                    return;
                  }
                  try {
                    const { error: upErr } = await supabase.storage
                      .from("generated-images")
                      .upload(path, buf, { contentType, upsert: true });
                    if (!upErr) {
                      const { data: urlData } = supabase.storage
                        .from("generated-images")
                        .getPublicUrl(path);
                      imageUrls.push(urlData.publicUrl);
                      img.imageUrl = urlData.publicUrl;
                      logger.info("image_uploaded", {
                        idx: i + 1,
                        attempt,
                        path,
                      });
                      uploaded = true;
                      break;
                    }
                    lastError = upErr.message;
                    logger.warn("image_upload_attempt_failed", {
                      idx: i + 1,
                      attempt,
                      error: upErr.message,
                    });
                  } catch (uploadErr) {
                    lastError = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
                    logger.warn("image_upload_attempt_exception", {
                      idx: i + 1,
                      attempt,
                      error: lastError,
                    });
                  }
                  if (attempt < 3) {
                    await new Promise(r => setTimeout(r, 400 * attempt));
                  }
                }
                if (!uploaded) {
                  logger.error("image_upload_exhausted_retries", {
                    idx: i + 1,
                    last_error: lastError,
                  });
                  captureError(new Error(`Image upload exhausted retries: ${lastError}`), {
                    route: "campaign.generate",
                    step: "upload",
                    store_id: store ? hashStoreId(store.id) : "anon",
                    image_idx: i + 1,
                  });
                  imageUrls.push(null);
                }
              }
            } catch (e) {
              logger.warn("upload_partial_failure", {
                error: e instanceof Error ? e.message : String(e),
              });
              captureError(e, {
                route: "campaign.generate",
                step: "upload",
                store_id: store ? hashStoreId(store.id) : "anon",
              });
              images.forEach(() => imageUrls.push(null));
            }

            // ── FIX P0: Se TODOS uploads falharam, refundar crédito/slot e abortar ──
            const allUploadsFailed = imageUrls.length > 0 && imageUrls.every((u) => !u);
            if (allUploadsFailed) {
              logger.error("all_uploads_failed_refunding", {
                store_id: store ? hashStoreId(store.id) : "anon",
              });
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
                  logger.info("avulso_credit_refunded_uploads_failed", {
                    store_id: hashStoreId(store.id),
                  });
                } catch (refundErr) {
                  logger.error("refund_failed_uploads", {
                    error: refundErr instanceof Error ? refundErr.message : String(refundErr),
                  });
                  captureError(refundErr, {
                    route: "campaign.generate",
                    step: "refund",
                    store_id: hashStoreId(store.id),
                  });
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
                    logger.info("plan_slot_refunded_uploads_failed", {
                      store_id: hashStoreId(store.id),
                    });
                  }
                } catch (refundErr) {
                  logger.error("plan_slot_refund_failed_uploads", {
                    error: refundErr instanceof Error ? refundErr.message : String(refundErr),
                  });
                  captureError(refundErr, {
                    route: "campaign.generate",
                    step: "refund",
                    store_id: hashStoreId(store.id),
                  });
                }
              }
              // H-4 (Phase 02): cost log with upload_failed=true for the
              // per-campaign reconciliation metric. The user got nothing AND
              // we burned Gemini cost -- the cost log row records that.
              if (store?.id) {
                try {
                  const { createAdminClient: createAdminLog } = await import("@/lib/supabase/admin");
                  const sbLog = createAdminLog();
                  await sbLog.from("api_cost_logs").insert({
                    store_id: store.id,
                    campaign_id: campaignRecord?.id || null,
                    provider: "system",
                    model_used: "pipeline_v6",
                    action: "upload_failure",
                    cost_usd: 0,
                    cost_brl: 0,
                    input_tokens: 0,
                    output_tokens: 0,
                    tokens_used: 0,
                    metadata: {
                      error_code: "ALL_UPLOADS_FAILED",
                      upload_failed: true,
                    },
                  });
                } catch (logErr) {
                  captureError(logErr, {
                    route: "campaign.generate",
                    step: "cost_log",
                    store_id: store?.id ? hashStoreId(store.id) : "anon",
                  });
                }
              }
              // D-14: failed event
              Sentry.captureMessage("campaign.generated.failed", {
                level: "error",
                tags: {
                  route: "campaign.generate",
                  store_id: store ? hashStoreId(store.id) : "anon",
                  error_code: "ALL_UPLOADS_FAILED",
                  refund_applied: String(creditReserved),
                },
              });
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
            // D-07/D-10 (Phase 02): abort before the teaser branch.
            if (request.signal.aborted) {
              await logDisconnectAndExit("before_teaser");
              return;
            }
            let lockedTeaserUrls: [string, string] | undefined;
            // H-12: skip teaser entirely if the model image is the 1×1 fallback.
            // Sharp would error on the 70%-tall × 400×600 resize, the catch
            // swallows it, and ops sees a confusing log line every trial run
            // with no model.
            if (isTrialOnly && usingFallbackModel) {
              logger.info("teaser_skipped_fallback_model", {
                reason: "1x1_fallback_no_model_available",
              });
            } else if (isTrialOnly) {
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
                  logger.info("trial_teasers_generated", {
                    paths: teaserPaths,
                  });
                } else {
                  logger.warn("trial_teasers_upload_failed", {
                    e1: e1?.message,
                    e2: e2?.message,
                  });
                }
              } catch (teaserErr) {
                logger.warn("trial_teasers_skipped", {
                  error: teaserErr instanceof Error ? teaserErr.message : String(teaserErr),
                });
                captureError(teaserErr, {
                  route: "campaign.generate",
                  step: "teaser",
                  store_id: store ? hashStoreId(store.id) : "anon",
                });
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
              logger.info("avulso_credit_already_reserved", {
                success_count: successCount,
                photo_count: photoCount,
              });
            } else if (planSlotReserved) {
              // Slot de plano já reservado upfront (evita double-count)
              logger.info("plan_slot_already_reserved", {
                success_count: successCount,
                photo_count: photoCount,
              });
            } else {
              await incrementCampaignsUsed(store!.id);
            }
          }

          // D-07/D-10 (Phase 02): final abort check before delivery emit.
          if (request.signal.aborted) {
            await logDisconnectAndExit("before_done_emit");
            return;
          }
          // D-14 (Phase 02): success / partial event for dashboards.
          // partial_delivery comes from pipeline.ts when image arm has fewer
          // photos than requested; today single-image flow rarely sets it.
          const partialDelivery = !!(pipelineResult as { partial_delivery?: boolean }).partial_delivery;
          if (store) {
            if (partialDelivery) {
              Sentry.captureMessage("campaign.generated.partial", {
                level: "warning",
                tags: {
                  route: "campaign.generate",
                  store_id: hashStoreId(store.id),
                  photos_delivered: String(successCount),
                  photos_requested: String(photoCount),
                },
              });
            } else {
              Sentry.captureMessage("campaign.generated.success", {
                level: "info",
                tags: {
                  route: "campaign.generate",
                  store_id: hashStoreId(store.id),
                  photos_delivered: String(successCount),
                  partial_delivery: "false",
                },
              });
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
            partial_delivery: partialDelivery, // D-01: UI badge hint
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
          // D-10 (Phase 02): if pipeline threw CLIENT_DISCONNECTED (or signal
          // is aborted), this is a client disconnect — NOT a failure. Skip
          // failCampaign + refund + cost log (the disconnect helper handles
          // the cost log + Sentry event itself).
          const earlyErrObj = pipelineError as Record<string, unknown>;
          if (earlyErrObj?.code === "CLIENT_DISCONNECTED" || request.signal.aborted) {
            await logDisconnectAndExit("pipeline_threw_disconnect");
            return;
          }

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
            // CONTEXT scope-in (Phase 02): convert refund race to add_credits_atomic.
            // Closes the H-11-cousin window in the LAST manual read-modify-write
            // site in this route.
            try {
              const { createAdminClient: createAdmin } = await import("@/lib/supabase/admin");
              const sb = createAdmin();
              const { error: refundErr } = await sb.rpc("add_credits_atomic", {
                p_store_id: store.id,
                p_column: "credit_campaigns",
                p_quantity: 1,
              });
              if (refundErr) {
                captureError(new Error(`Refund failed: ${refundErr.message}`), {
                  route: "campaign.generate",
                  step: "refund",
                  store_id: hashStoreId(store.id),
                  error_code: errCode,
                });
                // Do NOT throw -- refund failure shouldn't block the SSE error response.
                // Sentry alert is the recovery channel.
              } else {
                logger.info("refund_credit_returned", {
                  store_id: hashStoreId(store.id),
                  error_code: errCode,
                });
              }
            } catch (refundErr) {
              captureError(refundErr, {
                route: "campaign.generate",
                step: "refund",
                store_id: hashStoreId(store.id),
                error_code: errCode,
              });
            }
          }

          // H-4 / D-09 (Phase 02): cost log for visibility. Adds upload_failed
          // flag (true when ALL_UPLOADS_FAILED triggered the error path) to
          // metadata so per-campaign cost reconciliation can attribute to
          // upload failures vs pipeline failures.
          const isUploadFailure = errCode === "ALL_UPLOADS_FAILED";
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
                metadata: {
                  error_code: errCode,
                  message: technicalMsg.slice(0, 500),
                  retryable: isRetryable,
                  upload_failed: isUploadFailure,
                },
              });
            } catch (logErr) {
              captureError(logErr, {
                route: "campaign.generate",
                step: "cost_log",
                store_id: store?.id ? hashStoreId(store.id) : "anon",
              });
            }
          }

          // D-14 (Phase 02): failed event for dashboards
          Sentry.captureMessage("campaign.generated.failed", {
            level: "error",
            tags: {
              route: "campaign.generate",
              store_id: store ? hashStoreId(store.id) : "anon",
              error_code: errCode,
              refund_applied: String(creditReserved && shouldRefund),
            },
          });

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
      logger.error("api_campaign_generate_outer_error", {
        message: errorObj.message ? truncForLog(String(errorObj.message), 200) : null,
        status: errorObj.status,
      });
      captureError(error, {
        route: "campaign.generate",
        step: "outer",
        store_id: "n/a",
      });

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
    logger.error("api_campaign_generate_toplevel_error", {
      message: errorObj.message ? truncForLog(String(errorObj.message), 200) : null,
    });
    captureError(error, {
      route: "campaign.generate",
      step: "toplevel",
    });

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
