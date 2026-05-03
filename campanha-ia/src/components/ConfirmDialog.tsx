"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { haptics } from "@/lib/utils/haptics";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

/**
 * ConfirmDialog — modal de confirmação branded.
 *
 * Substitui `window.confirm()` nativo por um diálogo acessível e estilizado
 * que segue o padrão do `QuotaExceededModal`:
 *   - role="dialog" + aria-modal + aria-labelledby
 *   - focus trap (Tab/Shift+Tab ciclam dentro do modal)
 *   - ESC fecha (quando não está em loading)
 *   - Restaura foco no elemento que abriu o modal ao fechar
 *   - haptics.medium() ao confirmar (haptics.error() na variante danger)
 *   - onConfirm pode ser async — exibe spinner e bloqueia botões durante o resolve
 *   - Fecha em backdrop click só quando NÃO está em loading
 *
 * Variantes:
 *   - "default": botão de confirmar usa `.btn-primary` (gradient brand)
 *   - "danger": botão de confirmar usa `var(--error)` com texto branco
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [closing, setClosing] = useState(false);
  const [loading, setLoading] = useState(false);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    haptics.light();

    // Guarda o elemento focado antes do modal abrir
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    // Foca no botão Cancelar por padrão (mais seguro em diálogos destrutivos)
    requestAnimationFrame(() => {
      const cancelBtn = dialogRef.current?.querySelector<HTMLElement>(
        '[data-confirm-cancel="true"]',
      );
      if (cancelBtn) {
        cancelBtn.focus();
      } else {
        const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
          "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
        );
        firstFocusable?.focus();
      }
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (!loading) handleCancel();
      }
      // Tab trap
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loading]);

  const handleCancel = () => {
    if (loading) return;
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onCancel();
    }, 200);
  };

  const handleConfirm = async () => {
    if (loading) return;
    if (variant === "danger") {
      haptics.error();
    } else {
      haptics.medium();
    }
    try {
      const result = onConfirm();
      if (result instanceof Promise) {
        setLoading(true);
        await result;
      }
    } finally {
      setLoading(false);
      setClosing(true);
      setTimeout(() => {
        setClosing(false);
        // não chama onCancel — o consumidor é responsável por fechar via state
      }, 200);
    }
  };

  if (!open && !closing) return null;

  return (
    <AnimatePresence>
      {open && !closing && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
          style={{
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.65)" }}
            onClick={handleCancel}
            aria-hidden="true"
          />

          {/* Dialog */}
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby={description ? "confirm-dialog-desc" : undefined}
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full md:max-w-md md:mx-4 overflow-hidden"
            style={{
              background: "linear-gradient(145deg, var(--surface) 0%, var(--surface-2) 50%, var(--background) 100%)",
              borderRadius: "24px 24px 0 0",
              boxShadow: "0 -8px 60px rgba(217, 70, 239, 0.15), 0 0 0 1px var(--border)",
            }}
          >
            {/* Drag handle (mobile) */}
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <div
                className="w-10 h-1 rounded-full"
                style={{ background: "var(--border)" }}
              />
            </div>

            <div className="px-6 pt-5 pb-6">
              <h2
                id="confirm-dialog-title"
                className="text-lg md:text-xl font-bold leading-tight mb-2"
                style={{ color: "var(--foreground)" }}
              >
                {title}
              </h2>
              {description && (
                <p
                  id="confirm-dialog-desc"
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--muted)" }}
                >
                  {description}
                </p>
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-2.5 mt-6">
                <button
                  type="button"
                  data-confirm-cancel="true"
                  onClick={handleCancel}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all min-h-tap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: "var(--surface-hover)",
                    color: "var(--foreground)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {cancelLabel}
                </button>

                {variant === "danger" ? (
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={loading}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all min-h-tap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                    style={{
                      background: "var(--error)",
                      color: "#fff",
                      border: "1px solid var(--error)",
                      boxShadow: "0 4px 16px color-mix(in srgb, var(--error) 30%, transparent)",
                    }}
                  >
                    {loading && (
                      <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                      </svg>
                    )}
                    {confirmLabel}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={loading}
                    className="btn-primary flex-1 min-h-tap inline-flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {loading && (
                      <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                      </svg>
                    )}
                    {confirmLabel}
                  </button>
                )}
              </div>
            </div>

            <style jsx>{`
              @media (min-width: 768px) {
                .relative.w-full {
                  border-radius: 24px !important;
                }
              }
            `}</style>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
