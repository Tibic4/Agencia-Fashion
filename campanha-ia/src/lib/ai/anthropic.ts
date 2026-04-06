/**
 * @deprecated — Use providers/claude.ts em vez deste módulo.
 * Mantido apenas para compatibilidade com código legado.
 * O pipeline v2.0 usa a abstração LLMProvider.
 */
import Anthropic from "@anthropic-ai/sdk";

// Singleton client
let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY não configurada. Adicione no .env.local");
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

// Model constants
export const MODELS = {
  /** Modelo rápido para tarefas simples (Vision, Score) */
  FAST: "claude-sonnet-4-20250514" as const,
  /** Modelo principal para geração de texto (Estratégia, Copy) */
  MAIN: "claude-sonnet-4-20250514" as const,
} as const;

// Wrapper para chamadas com retry
export async function callClaude({
  model = MODELS.MAIN,
  system,
  messages,
  maxTokens = 2048,
  temperature = 0.7,
}: {
  model?: string;
  system: string;
  messages: Anthropic.MessageParam[];
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const anthropic = getAnthropicClient();

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system,
        messages,
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("Claude não retornou texto");
      }
      return textBlock.text;
    } catch (error: any) {
      lastError = error;
      // Rate limit — wait and retry
      if (error?.status === 429) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      // Server error — retry
      if (error?.status >= 500) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }
  throw lastError || new Error("Falha após 3 tentativas");
}

// Wrapper para Vision (imagem) — aceita 1 ou mais fotos
export async function callClaudeVision({
  system,
  prompt,
  imageBase64,
  extraImages,
  mediaType = "image/jpeg",
  maxTokens = 1024,
}: {
  system: string;
  prompt: string;
  imageBase64: string;
  extraImages?: { base64: string; mediaType?: "image/jpeg" | "image/png" | "image/webp" | "image/gif" }[];
  mediaType?: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  maxTokens?: number;
}): Promise<string> {
  // Montar array de imagens: principal + extras (close-up, etc)
  const imageBlocks: Anthropic.ImageBlockParam[] = [
    {
      type: "image",
      source: { type: "base64", media_type: mediaType, data: imageBase64 },
    },
  ];

  if (extraImages?.length) {
    for (const img of extraImages) {
      imageBlocks.push({
        type: "image",
        source: { type: "base64", media_type: img.mediaType || "image/jpeg", data: img.base64 },
      });
    }
  }

  return callClaude({
    model: MODELS.FAST,
    system,
    maxTokens,
    temperature: 0.3,
    messages: [
      {
        role: "user",
        content: [
          ...imageBlocks,
          { type: "text", text: prompt },
        ],
      },
    ],
  });
}
