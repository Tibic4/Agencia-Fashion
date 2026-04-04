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
  refiner: { label: "✨ Refinando copy...", progress: 65 },
  scorer: { label: "📊 Avaliando qualidade...", progress: 80 },
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

      // Simulate progress while waiting (API doesn't stream yet)
      const progressInterval = simulateProgress(setState);

      // Call API
      const response = await fetch("/api/campaign/generate", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ${response.status}`);
      }

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

/**
 * Simula progresso enquanto espera a API responder
 */
function simulateProgress(
  setState: React.Dispatch<React.SetStateAction<GenerationState>>
) {
  const steps: PipelineStep[] = [
    "vision",
    "strategy",
    "copywriter",
    "refiner",
    "scorer",
    "composition",
  ];
  let currentIndex = 0;

  const interval = setInterval(() => {
    if (currentIndex < steps.length) {
      const step = steps[currentIndex];
      const info = STEPS_LABELS[step] || { label: step, progress: 50 };
      setState((prev) => ({
        ...prev,
        status: "generating",
        step,
        stepLabel: info.label,
        progress: info.progress,
      }));
      currentIndex++;
    }
  }, 4000); // ~4s per step, total ~24s

  return interval;
}
