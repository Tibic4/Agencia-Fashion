/**
 * Gemini Provider — usa Google GenAI SDK.
 *
 * Vantagens sobre Claude para steps analíticos:
 * - 10x mais barato (Flash $0.30/MTok vs Sonnet $3.00/MTok)
 * - Structured Output nativo (responseSchema garante JSON válido)
 * - Vision multimodal nativa
 * - Context caching para system prompts repetitivos
 */

import { GoogleGenAI } from "@google/genai";
import type { LLMProvider, LLMRequest, LLMVisionRequest, LLMResponse } from "./types";

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_AI_API_KEY não configurada");
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

/**
 * Converte Zod schema para JSON Schema compatível com Gemini responseSchema.
 * Gemini aceita JSON Schema draft-07.
 */
function zodToJsonSchema(schema: import("zod").ZodSchema): Record<string, unknown> {
  // Zod v4 tem .toJSONSchema() nativo
  if ("toJSONSchema" in schema && typeof schema.toJSONSchema === "function") {
    return schema.toJSONSchema() as Record<string, unknown>;
  }

  // Fallback: retornar undefined para não usar responseSchema
  // (o modelo ainda responderá JSON pelo prompt)
  console.warn("[GeminiProvider] Zod schema sem toJSONSchema — fallback para prompt-based JSON");
  return undefined as unknown as Record<string, unknown>;
}

export class GeminiProvider implements LLMProvider {
  readonly name = "google" as const;
  private model: string;

  constructor(model: string = "gemini-2.5-flash") {
    this.model = model;
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const ai = getClient();

    // Montar config com ou sem responseSchema
    const config: Record<string, unknown> = {};

    if (request.responseSchema) {
      const jsonSchema = zodToJsonSchema(request.responseSchema);
      if (jsonSchema) {
        config.responseMimeType = "application/json";
        config.responseSchema = jsonSchema;
      }
    }

    if (request.temperature !== undefined) {
      config.temperature = request.temperature;
    }
    if (request.maxTokens) {
      config.maxOutputTokens = request.maxTokens;
    }

    // Montar conteúdo: system + user messages
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    for (const msg of request.messages) {
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }

    const response = await ai.models.generateContent({
      model: this.model,
      contents,
      config: {
        ...config,
        systemInstruction: request.system,
      } as any,
    });

    // Extrair texto
    const text = response.candidates?.[0]?.content?.parts
      ?.filter((p: any) => p.text)
      .map((p: any) => p.text)
      .join("") || "";

    // Extrair usage
    const usageMetadata = (response as any).usageMetadata || {};

    return {
      text,
      usage: {
        inputTokens: usageMetadata.promptTokenCount || 0,
        outputTokens: usageMetadata.candidatesTokenCount || 0,
      },
      provider: "google",
      model: this.model,
    };
  }

  async generateWithVision(request: LLMVisionRequest): Promise<LLMResponse> {
    const ai = getClient();

    // Montar parts: imagens + texto
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

    // Imagem principal
    parts.push({
      inlineData: {
        mimeType: request.mediaType || "image/jpeg",
        data: request.imageBase64,
      },
    });

    // Imagens extras
    if (request.extraImages?.length) {
      for (const img of request.extraImages) {
        parts.push({
          inlineData: {
            mimeType: img.mediaType || "image/jpeg",
            data: img.base64,
          },
        });
      }
    }

    // Texto do prompt (última mensagem do usuário)
    const userMsg = request.messages.find((m) => m.role === "user");
    if (userMsg) {
      parts.push({ text: userMsg.content });
    }

    // Config
    const config: Record<string, unknown> = {};

    if (request.responseSchema) {
      const jsonSchema = zodToJsonSchema(request.responseSchema);
      if (jsonSchema) {
        config.responseMimeType = "application/json";
        config.responseSchema = jsonSchema;
      }
    }

    if (request.temperature !== undefined) {
      config.temperature = request.temperature;
    }
    if (request.maxTokens) {
      config.maxOutputTokens = request.maxTokens;
    }

    const response = await ai.models.generateContent({
      model: this.model,
      contents: [{ role: "user", parts }],
      config: {
        ...config,
        systemInstruction: request.system,
      } as any,
    });

    const text = response.candidates?.[0]?.content?.parts
      ?.filter((p: any) => p.text)
      .map((p: any) => p.text)
      .join("") || "";

    const usageMetadata = (response as any).usageMetadata || {};

    return {
      text,
      usage: {
        inputTokens: usageMetadata.promptTokenCount || 0,
        outputTokens: usageMetadata.candidatesTokenCount || 0,
      },
      provider: "google",
      model: this.model,
    };
  }
}
