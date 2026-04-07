"use client";

import { useState, useCallback } from "react";
import type { PipelineStep } from "@/types";

interface GenerationState {
  status: "idle" | "uploading" | "generating" | "done" | "error";
  step: PipelineStep | null;
  stepLabel: string;
  progress: number;
  result: any | null;
  error: string | null;
}

interface GenerateParams {
  image: File;
  price: string;
  objective: string;
  storeName?: string;
  targetAudience?: string;
  toneOverride?: string;
  useModel?: boolean;
  backgroundType?: string;
}

const STEPS_LABELS: Record<string, { label: string; progress: number }> = {
  uploading: { label: "Enviando foto...", progress: 5 },
  vision: { label: "🔍 Analisando produto...", progress: 15 },
  strategy: { label: "🎯 Criando estratégia...", progress: 30 },
  copywriter: { label: "✍️ Escrevendo textos...", progress: 50 },
  refiner: { label: "✨ Refinando copy...", progress: 55 },
  scorer: { label: "📊 Avaliando qualidade...", progress: 70 },
  image_processing: { label: "🖼️ Processando imagem...", progress: 90 },
  composition: { label: "🎨 Montando criativo...", progress: 95 },
  done: { label: "✅ Pronto!", progress: 100 },
};

export function useGenerateCampaign() {
  const [state, setState] = useState<GenerationState>({
    status: "idle",
    step: null,
    stepLabel: "",
    progress: 0,
    result: null,
    error: null,
  });

  const generate = useCallback(async (params: GenerateParams) => {
    setState({
      status: "uploading",
      step: null,
      stepLabel: "Enviando foto...",
      progress: 5,
      result: null,
      error: null,
    });

    try {
      // Build FormData
      const formData = new FormData();
      formData.append("image", params.image);
      formData.append("price", params.price);
      formData.append("objective", params.objective);
      formData.append("storeName", params.storeName || "Minha Loja");
      if (params.targetAudience) formData.append("targetAudience", params.targetAudience);
      if (params.toneOverride) formData.append("toneOverride", params.toneOverride);
      if (params.useModel !== undefined) formData.append("useModel", String(params.useModel));
      if (params.backgroundType) formData.append("backgroundType", params.backgroundType);

      // Call API — agora retorna SSE stream com progresso real
      const response = await fetch("/api/campaign/generate", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        // Erros de inicialização (auth, rate limit) ainda vêm como JSON
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ${response.status}`);
      }

      const contentType = response.headers.get("content-type") || "";

      // ── SSE STREAM: progresso real do pipeline ──
      if (contentType.includes("text/event-stream") && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from buffer
          const events = buffer.split("\n\n");
          buffer = events.pop() || ""; // último item pode ser incompleto

          for (const eventBlock of events) {
            if (!eventBlock.trim()) continue;

            const lines = eventBlock.split("\n");
            let eventType = "";
            let eventData = "";

            for (const line of lines) {
              if (line.startsWith("event: ")) eventType = line.slice(7);
              if (line.startsWith("data: ")) eventData = line.slice(6);
            }

            if (!eventType || !eventData) continue;

            try {
              const parsed = JSON.parse(eventData);

              if (eventType === "progress") {
                const stepInfo = STEPS_LABELS[parsed.step] || { label: parsed.label, progress: parsed.progress };
                setState((prev) => ({
                  ...prev,
                  status: "generating",
                  step: parsed.step,
                  stepLabel: parsed.label || stepInfo.label,
                  progress: parsed.progress || stepInfo.progress,
                }));
              } else if (eventType === "done") {
                if (!parsed.success) {
                  throw new Error(parsed.error || "Erro desconhecido");
                }
                setState({
                  status: "done",
                  step: "done",
                  stepLabel: "✅ Pronto!",
                  progress: 100,
                  result: parsed.data,
                  error: null,
                });
                return parsed.data;
              } else if (eventType === "error") {
                throw new Error(parsed.error || "Erro no pipeline");
              }
            } catch (parseError: any) {
              if (parseError.message && !parseError.message.includes("JSON")) {
                throw parseError; // Re-throw non-parse errors
              }
              console.warn("[SSE] Parse error:", parseError);
            }
          }
        }

        // Stream ended without 'done' event
        throw new Error("Stream finalizado sem resultado");
      }

      // ── FALLBACK: resposta JSON clássica (demo mode, erros) ──
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Erro desconhecido");
      }

      setState({
        status: "done",
        step: "done",
        stepLabel: "✅ Pronto!",
        progress: 100,
        result: data.data,
        error: null,
      });

      return data.data;
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: error.message || "Erro ao gerar campanha",
        progress: 0,
      }));
      throw error;
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      status: "idle",
      step: null,
      stepLabel: "",
      progress: 0,
      result: null,
      error: null,
    });
  }, []);

  return {
    ...state,
    generate,
    reset,
    isGenerating: state.status === "uploading" || state.status === "generating",
  };
}
