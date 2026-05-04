/**
 * CriaLook — Gemini API Error Handler
 *
 * Classifica e trata erros da Google Gemini API:
 * - 400 Bad Request → mensagem user-friendly
 * - 429 Rate Limit → retry automático com backoff
 * - 500/503 Server Error → retry automático
 * - SAFETY block → mensagem amigável
 * - Timeout → mensagem com instrução
 *
 * Usado pelo Analyzer e VTO Generator via callGeminiSafe().
 */

import { withTimeout } from "./with-timeout";

// ═══════════════════════════════════════
// Error Classification
// ═══════════════════════════════════════

export type GeminiErrorCode =
  | "RATE_LIMITED"
  | "MODEL_OVERLOADED"
  | "SERVER_ERROR"
  | "BAD_REQUEST"
  | "SAFETY_BLOCKED"
  | "API_KEY_INVALID"
  | "TIMEOUT"
  | "RECITATION"
  | "IMAGE_GENERATION_BLOCKED"
  | "UNKNOWN";

export interface GeminiClassifiedError {
  code: GeminiErrorCode;
  /** Mensagem amigável para o usuário (português) */
  userMessage: string;
  /** Mensagem técnica para logs */
  technicalMessage: string;
  /** Se deve tentar novamente automaticamente */
  retryable: boolean;
  /** HTTP status equivalente */
  httpStatus: number;
  /** Erro original */
  originalError: unknown;
}

/**
 * Concrete Error subclass that callers (route handlers, pipeline steps)
 * can `instanceof`-check to recover the classification. Replaces the
 * pre-existing pattern of `(new Error(msg) as any).code = ...` ad-hoc
 * augmentation, which made the metadata invisible to the type checker.
 */
export class GeminiClassifiedFailure extends Error {
  readonly code: GeminiErrorCode;
  readonly httpStatus: number;
  readonly retryable: boolean;
  readonly technicalMessage: string;

  constructor(classified: GeminiClassifiedError) {
    super(classified.userMessage);
    this.name = "GeminiClassifiedFailure";
    this.code = classified.code;
    this.httpStatus = classified.httpStatus;
    this.retryable = classified.retryable;
    this.technicalMessage = classified.technicalMessage;
  }
}

/**
 * Classificar um erro da Gemini API em uma categoria conhecida.
 */
export function classifyGeminiError(error: unknown): GeminiClassifiedError {
  const msg = error instanceof Error ? error.message : String(error);
  const errObj = (error ?? {}) as { status?: unknown; statusCode?: unknown; httpStatusCode?: unknown };
  const rawStatus = errObj.status ?? errObj.statusCode ?? errObj.httpStatusCode;
  const status: number | undefined =
    typeof rawStatus === "number" ? rawStatus : undefined;

  // ── 429 Rate Limit / Quota ──
  if (status === 429 || msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota") || msg.includes("rate limit")) {
    return {
      code: "RATE_LIMITED",
      userMessage: "A IA está com alta demanda agora. Tente novamente em 1 minuto.",
      technicalMessage: `Gemini 429 Rate Limited: ${msg}`,
      retryable: true,
      httpStatus: 429,
      originalError: error,
    };
  }

  // ── 503 Model Overloaded ──
  if (status === 503 || msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("overloaded") || msg.includes("model is overloaded")) {
    return {
      code: "MODEL_OVERLOADED",
      userMessage: "O modelo de IA está temporariamente sobrecarregado. Tente em alguns segundos.",
      technicalMessage: `Gemini 503 Overloaded: ${msg}`,
      retryable: true,
      httpStatus: 503,
      originalError: error,
    };
  }

  // ── 500/504 Server Error ──
  if (status === 500 || status === 504 || msg.includes("500") || msg.includes("504") || msg.includes("INTERNAL") || msg.includes("DEADLINE_EXCEEDED")) {
    return {
      code: "SERVER_ERROR",
      userMessage: "Instabilidade temporária na IA. Tente novamente.",
      technicalMessage: `Gemini Server Error (${status || '5xx'}): ${msg}`,
      retryable: true,
      httpStatus: status || 500,
      originalError: error,
    };
  }

  // ── 400 Bad Request (imagem corrompida, prompt inválido) ──
  if (status === 400 || msg.includes("400") || msg.includes("INVALID_ARGUMENT") || msg.includes("bad request")) {
    return {
      code: "BAD_REQUEST",
      userMessage: "A imagem não foi reconhecida. Tente outra foto com melhor iluminação.",
      technicalMessage: `Gemini 400 Bad Request: ${msg}`,
      retryable: false,
      httpStatus: 400,
      originalError: error,
    };
  }

  // ── 403 API Key ──
  if (status === 403 || msg.includes("403") || msg.includes("PERMISSION_DENIED") || msg.includes("API_KEY")) {
    return {
      code: "API_KEY_INVALID",
      userMessage: "Erro de configuração do sistema. Nossa equipe foi notificada.",
      technicalMessage: `Gemini 403 Forbidden: ${msg}`,
      retryable: false,
      httpStatus: 403,
      originalError: error,
    };
  }

  // ── Safety Block ──
  if (msg.includes("SAFETY") || msg.includes("safety") || msg.includes("blocked") || msg.includes("filtrado") || msg.includes("Conteúdo bloqueado")) {
    return {
      code: "SAFETY_BLOCKED",
      userMessage: "A IA bloqueou esta foto por segurança. Dica: manequins brancos/sem roupa podem ser confundidos com nudez. Fotografe a peça sobre um cabide, mesa ou manequim vestido. Seu crédito foi devolvido.",
      technicalMessage: `Gemini Safety Block: ${msg}`,
      retryable: false,
      httpStatus: 400,
      originalError: error,
    };
  }

  // ── Recitation (output blocked due to copyright) ──
  if (msg.includes("RECITATION") || msg.includes("recitation")) {
    return {
      code: "RECITATION",
      userMessage: "A IA não conseguiu gerar esta imagem. Tente com uma foto diferente.",
      technicalMessage: `Gemini Recitation Block: ${msg}`,
      retryable: false,
      httpStatus: 400,
      originalError: error,
    };
  }

  // ── Image generation blocked (Gemini refused to generate image) ──
  if (msg.includes("não gerou imagem") || msg.includes("sem imagem no response") || msg.includes("IMAGE_GENERATION")) {
    return {
      code: "IMAGE_GENERATION_BLOCKED",
      userMessage: "A IA não conseguiu gerar a foto. Tente novamente com uma pose ou cenário diferente.",
      technicalMessage: `Gemini no image output: ${msg}`,
      retryable: true,
      httpStatus: 500,
      originalError: error,
    };
  }

  // ── Timeout ──
  if (msg.includes("timeout") || msg.includes("TIMEOUT") || msg.includes("aborted") || msg.includes("AbortError")) {
    return {
      code: "TIMEOUT",
      userMessage: "A geração demorou demais. Tente novamente — geralmente é mais rápido na segunda vez.",
      technicalMessage: `Gemini Timeout: ${msg}`,
      retryable: true,
      httpStatus: 504,
      originalError: error,
    };
  }

  // ── Unknown ──
  return {
    code: "UNKNOWN",
    userMessage: "Erro ao processar com a IA. Tente novamente.",
    technicalMessage: `Gemini Unknown Error: ${msg}`,
    retryable: true,
    httpStatus: 500,
    originalError: error,
  };
}

// ═══════════════════════════════════════
// Retry Wrapper
// ═══════════════════════════════════════

interface CallGeminiOptions {
  /** Máximo de tentativas (default: 2 = 1 original + 1 retry) */
  maxRetries?: number;
  /** Backoff base em ms (default: 2000) */
  backoffMs?: number;
  /** Label para logs (ex: "Analyzer", "VTO #1") */
  label?: string;
  /** Timeout em ms; default = 90_000 se label inclui "VTO", senão 30_000 (D-17). */
  timeoutMs?: number;
}

/**
 * Executa uma chamada à Gemini API com retry automático para erros retryable.
 *
 * Para erros não-retryable (400, SAFETY), lança imediatamente com mensagem amigável.
 * Para erros retryable (429, 503, 500), tenta novamente com backoff exponencial.
 */
export async function callGeminiSafe<T>(
  fn: () => Promise<T>,
  options: CallGeminiOptions = {}
): Promise<T> {
  const {
    maxRetries = 2,
    backoffMs = 2000,
    label = "Gemini",
    // D-17: VTO calls (image generation) are slower than analyzer/text calls.
    // Label-based default keeps zero call-site changes — every existing caller
    // already passes a meaningful label like "Analyzer", "VTO #1", "Backdrop".
    timeoutMs = label.includes("VTO") ? 90_000 : 30_000,
  } = options;

  let lastError: GeminiClassifiedError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // withTimeout rejects with AITimeoutError (retryable=true) on deadline
      // exceeded → flows through the existing classify/retry loop below
      // without special-casing (msg.includes("timeout") branch in
      // classifyGeminiError already handles it).
      return await withTimeout(fn(), timeoutMs, label);
    } catch (error) {
      const classified = classifyGeminiError(error);
      lastError = classified;

      console.warn(
        `[${label}] ⚠️ Attempt ${attempt + 1}/${maxRetries + 1} failed — ${classified.code}: ${classified.technicalMessage.slice(0, 120)}`
      );

      // Non-retryable → throw immediately with user-friendly message
      if (!classified.retryable || attempt >= maxRetries) {
        throw new GeminiClassifiedFailure(classified);
      }

      // Retryable → wait with exponential backoff
      const waitMs = backoffMs * Math.pow(2, attempt);
      console.log(`[${label}] ⏳ Retrying in ${waitMs}ms...`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }

  // Should never reach here, but TypeScript requires it
  throw new GeminiClassifiedFailure(
    lastError ?? {
      code: "UNKNOWN",
      userMessage: "Erro inesperado na IA",
      technicalMessage: "fallback path reached without lastError",
      retryable: false,
      httpStatus: 500,
      originalError: undefined,
    },
  );
}
