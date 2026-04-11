/**
 * Converte erros brutos (rede, API, inglês) em mensagens amigáveis em português.
 * Usado em TODOS os catch blocks do frontend para nunca mostrar erros técnicos ao usuário.
 */

const ERROR_MAP: [RegExp, string][] = [
  // Rede / conexão
  [/failed to fetch/i, "Sem conexão. Verifique sua internet e tente novamente."],
  [/network\s*(error|request)/i, "Problema de conexão. Verifique sua internet."],
  [/ERR_NETWORK/i, "Sem conexão com o servidor. Tente novamente."],
  [/ERR_CONNECTION/i, "Não foi possível conectar ao servidor."],
  [/timeout|timed?\s*out|ETIMEDOUT/i, "A operação demorou demais. Tente novamente."],
  [/aborted|AbortError/i, "Operação cancelada. Tente novamente."],
  [/ERR_NAME_NOT_RESOLVED/i, "Servidor não encontrado. Verifique sua conexão."],

  // HTTP genéricos
  [/Erro\s*401|Unauthorized/i, "Sessão expirada. Faça login novamente."],
  [/Erro\s*403|Forbidden/i, "Você não tem permissão para esta ação."],
  [/Erro\s*404|Not Found/i, "Conteúdo não encontrado."],
  [/Erro\s*429|Too Many/i, "Muitas tentativas. Aguarde um momento e tente novamente."],
  [/Erro\s*5\d{2}/i, "Erro no servidor. Tente novamente em alguns instantes."],

  // Supabase / DB
  [/PGRST|PostgrestError/i, "Erro interno. Tente novamente."],
  [/JWT|token/i, "Sessão expirada. Faça login novamente."],
  [/violates.*constraint/i, "Dados duplicados ou inválidos. Verifique e tente novamente."],

  // Gemini / IA
  [/SAFETY_BLOCKED|safety/i, "Envie apenas fotos de peças de roupa. Fotos com pessoas sem roupa ou conteúdo impróprio são bloqueadas automaticamente. Seu crédito foi devolvido."],
  [/RATE_LIMITED|rate.limit/i, "Alta demanda. Aguarde um momento e tente novamente."],
  [/MODEL_OVERLOADED/i, "Servidor de IA sobrecarregado. Tente em alguns instantes."],
  [/quota|resource.*exhausted/i, "Limite de uso atingido. Tente mais tarde."],
  [/invalid.*response|JSON/i, "Resposta inesperada da IA. Tente novamente."],

  // Upload / arquivo
  [/Arquivo inválido/i, "Arquivo inválido. Use uma imagem JPG, PNG ou WebP."],
  [/muito grande|too large/i, "Arquivo muito grande. Use uma imagem de até 5MB."],
  [/unsupported.*media|content.type/i, "Formato de arquivo não suportado."],
];

/**
 * Retorna uma mensagem user-friendly em português.
 * - Se o erro já é uma mensagem amigável em português, retorna como está.
 * - Se é erro técnico em inglês ou código HTTP, traduz para mensagem amigável.
 * - Fallback genérico se nada casar.
 */
export function friendlyError(
  error: unknown,
  fallback = "Algo deu errado. Tente novamente."
): string {
  let raw: string;

  if (error instanceof Error) {
    raw = error.message;
  } else if (typeof error === "string") {
    raw = error;
  } else {
    return fallback;
  }

  // Se já é uma mensagem limpa em português da API, manter como está
  // (mensagens curtas sem caracteres técnicos como {, stack, at, Error:)
  const looksClean = /^[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]/.test(raw) &&
    !raw.includes("{") &&
    !raw.includes("Error:") &&
    !raw.includes("at ") &&
    !raw.includes("stack") &&
    raw.length < 300;

  if (looksClean) {
    // Mas verificar se não é um "Erro NNN" genérico
    if (/^Erro\s+\d{3}$/.test(raw)) {
      // Mapear para friendly
      for (const [pattern, friendly] of ERROR_MAP) {
        if (pattern.test(raw)) return friendly;
      }
      return "Erro no servidor. Tente novamente.";
    }
    return raw;
  }

  // Tentar casar com padrões conhecidos
  for (const [pattern, friendly] of ERROR_MAP) {
    if (pattern.test(raw)) return friendly;
  }

  return fallback;
}
