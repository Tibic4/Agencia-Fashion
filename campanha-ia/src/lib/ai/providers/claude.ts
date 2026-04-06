/**
 * Claude Provider — wrapper usando Anthropic SDK.
 *
 * Mantido para o step Copywriter onde o tom brasileiro
 * coloquial do Claude ainda é superior ao Gemini.
 *
 * Retry removido daqui — gerenciado pelo pipeline via withRetry().
 */

import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider, LLMRequest, LLMVisionRequest, LLMResponse } from "./types";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY não configurada");
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

export class ClaudeProvider implements LLMProvider {
  readonly name = "anthropic" as const;
  private model: string;

  constructor(model: string = "claude-sonnet-4-20250514") {
    this.model = model;
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const anthropic = getClient();

    const messages: Anthropic.MessageParam[] = request.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const response = await anthropic.messages.create({
      model: this.model,
      max_tokens: request.maxTokens || 2048,
      temperature: request.temperature ?? 0.7,
      system: request.system,
      messages,
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Claude não retornou texto");
    }

    return {
      text: textBlock.text,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      provider: "anthropic",
      model: this.model,
    };
  }

  async generateWithVision(request: LLMVisionRequest): Promise<LLMResponse> {
    const anthropic = getClient();

    // Montar imagens
    const imageBlocks: Anthropic.ImageBlockParam[] = [
      {
        type: "image",
        source: {
          type: "base64",
          media_type: request.mediaType || "image/jpeg",
          data: request.imageBase64,
        },
      },
    ];

    if (request.extraImages?.length) {
      for (const img of request.extraImages) {
        imageBlocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: img.mediaType || "image/jpeg",
            data: img.base64,
          },
        });
      }
    }

    // Texto do prompt
    const userMsg = request.messages.find((m) => m.role === "user");
    const textContent = userMsg?.content || "";

    const response = await anthropic.messages.create({
      model: this.model,
      max_tokens: request.maxTokens || 1024,
      temperature: request.temperature ?? 0.3,
      system: request.system,
      messages: [
        {
          role: "user",
          content: [
            ...imageBlocks,
            { type: "text", text: textContent },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Claude Vision não retornou texto");
    }

    return {
      text: textBlock.text,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      provider: "anthropic",
      model: this.model,
    };
  }
}
