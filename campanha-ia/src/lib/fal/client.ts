/**
 * fal.ai — Virtual Try-On Fallback (IDM-VTON)
 *
 * Usado como fallback quando Fashn.ai falha ou não está configurado.
 * Mais barato (~R$ 0,15-0,25/imagem) e usa modelo open source IDM-VTON.
 *
 * Docs: https://fal.ai/models/fal-ai/idm-vton
 */

import { fal } from "@fal-ai/client";

const FAL_KEY = process.env.FAL_KEY || "";

// Configurar credenciais
if (FAL_KEY) {
  fal.config({ credentials: FAL_KEY });
}

interface FalTryOnParams {
  /** URL pública da foto do produto (roupa) */
  garmentImageUrl: string;
  /** URL pública da foto do modelo (pessoa) */
  modelImageUrl: string;
  /** Descrição da peça (ex: "Vestido vermelho manga longa") */
  description?: string;
}

interface FalTryOnResult {
  status: "completed" | "failed";
  outputUrl: string | null;
  provider: "fal.ai";
}

/**
 * Virtual Try-On usando fal.ai IDM-VTON
 */
export async function falTryOn(params: FalTryOnParams): Promise<FalTryOnResult> {
  if (!FAL_KEY) {
    throw new Error("FAL_KEY não configurada");
  }

  try {
    const result = await fal.subscribe("fal-ai/idm-vton", {
      input: {
        human_image_url: params.modelImageUrl,
        garment_image_url: params.garmentImageUrl,
        description: params.description || "Fashion garment",
      },
      logs: false,
    });

    const data = result.data as Record<string, unknown>;
    const image = data?.image as { url?: string } | undefined;

    if (image?.url) {
      return {
        status: "completed",
        outputUrl: image.url,
        provider: "fal.ai",
      };
    }

    return { status: "failed", outputUrl: null, provider: "fal.ai" };
  } catch (error) {
    console.error("[fal.ai] Try-On error:", error);
    return { status: "failed", outputUrl: null, provider: "fal.ai" };
  }
}

/**
 * Verificar se a API está acessível.
 */
export function isFalConfigured(): boolean {
  return !!FAL_KEY;
}
