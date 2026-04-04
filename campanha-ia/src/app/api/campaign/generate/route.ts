import { NextRequest, NextResponse } from "next/server";
import { runCampaignPipeline } from "@/lib/ai/pipeline";
import type { PipelineStep } from "@/types";

export const maxDuration = 60; // Vercel Pro: 60s timeout
export const dynamic = "force-dynamic";

/**
 * POST /api/campaign/generate
 *
 * Body (FormData):
 *   - image: File (foto da peça)
 *   - price: string (ex: "89,90")
 *   - objective: string (venda_imediata | lancamento | promocao | engajamento)
 *   - storeName: string
 *   - targetAudience?: string
 *   - toneOverride?: string
 *   - useModel?: "true" | "false"
 *   - backgroundType?: string
 *
 * Returns: PipelineResult
 */
export async function POST(request: NextRequest) {
  try {
    // Parse FormData
    const formData = await request.formData();
    const imageFile = formData.get("image") as File | null;
    const price = formData.get("price") as string | null;
    const objective = (formData.get("objective") as string) || "venda_imediata";
    const storeName = (formData.get("storeName") as string) || "Minha Loja";
    const targetAudience = formData.get("targetAudience") as string | null;
    const toneOverride = formData.get("toneOverride") as string | null;

    // Validation
    if (!imageFile) {
      return NextResponse.json(
        { error: "Envie a foto do produto", code: "MISSING_IMAGE" },
        { status: 400 }
      );
    }

    if (!price) {
      return NextResponse.json(
        { error: "Informe o preço do produto", code: "MISSING_PRICE" },
        { status: 400 }
      );
    }

    // Validate image type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(imageFile.type)) {
      return NextResponse.json(
        { error: "Formato de imagem inválido. Use JPG, PNG ou WebP", code: "INVALID_IMAGE_TYPE" },
        { status: 400 }
      );
    }

    // Validate image size (10MB max)
    if (imageFile.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Imagem muito grande. Máximo 10MB", code: "IMAGE_TOO_LARGE" },
        { status: 400 }
      );
    }

    // Convert image to base64
    const arrayBuffer = await imageFile.arrayBuffer();
    const imageBase64 = Buffer.from(arrayBuffer).toString("base64");
    const mediaType = imageFile.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif";

    // Track progress steps (for logging)
    const steps: { step: PipelineStep; startedAt: number }[] = [];

    // Run pipeline
    const result = await runCampaignPipeline(
      {
        imageBase64,
        mediaType,
        price,
        objective,
        storeName,
        targetAudience: targetAudience || undefined,
        toneOverride: toneOverride || undefined,
      },
      (step, label, progress) => {
        steps.push({ step, startedAt: Date.now() });
        console.log(`[Pipeline] ${step} (${progress}%) — ${label}`);
      }
    );

    // TODO: Quando o banco estiver pronto, salvar aqui:
    // await saveCampaignToDatabase(result, storeId);

    return NextResponse.json({
      success: true,
      data: {
        vision: result.vision,
        strategy: result.strategy,
        output: result.output,
        score: result.score,
        durationMs: result.durationMs,
        steps,
      },
    });
  } catch (error: any) {
    console.error("[API:campaign/generate] Error:", error);

    // Specific error handling
    if (error.message?.includes("ANTHROPIC_API_KEY")) {
      return NextResponse.json(
        { error: "Chave da API não configurada", code: "API_KEY_MISSING" },
        { status: 500 }
      );
    }

    if (error.status === 429) {
      return NextResponse.json(
        { error: "Muitas requisições. Tente novamente em alguns segundos", code: "RATE_LIMITED" },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error: "Erro ao gerar campanha. Tente novamente.",
        code: "PIPELINE_ERROR",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
