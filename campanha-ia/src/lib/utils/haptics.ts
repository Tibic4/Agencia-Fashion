/**
 * Web Haptics Utility
 * Seguro para uso global (ignora silenciosamente em navegadores sem suporte).
 * Principalmente suportado em dispositivos Android. No iOS, o Vibration API não afeta a Taptic Engine do iPhone pelo Safari.
 */

export const haptics = {
  /**
   * Vibração ultrarrápida e sutil.
   * Ideal para: Troca de abas, acionar selects, pequenos cliques.
   */
  light: () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(10);
    }
  },

  /**
   * Vibração levemente mais densa.
   * Ideal para: Botões principais, submit de forms não sensíveis.
   */
  medium: () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(25);
    }
  },

  /**
   * Vibração para seleção de cor ou pequenos elementos
   */
  selection: () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(5);
    }
  },

  /**
   * Múltiplas vibrações curtas e alegres.
   * Ideal para: Geração concluída com sucesso, favoritar (ação final).
   */
  success: () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([20, 50, 20]);
    }
  },

  /**
   * Vibrações longas e densas simulando alerta.
   * Ideal para: Erros graves, ações destrutivas (deletar).
   */
  error: () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([40, 60, 40]);
    }
  },
};
