"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type CookiePreferences = {
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
  version: number;
};

const STORAGE_KEY = "cookieConsent";
const CONSENT_VERSION = 1;

function loadStoredPreferences(): CookiePreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookiePreferences;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function dispatchConsentEvent(prefs: CookiePreferences) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("cookie-consent-changed", { detail: prefs }));
  } catch {
    // no-op
  }
}

function persistPreferences(prefs: Omit<CookiePreferences, "timestamp" | "version">) {
  if (typeof window === "undefined") return null;
  const full: CookiePreferences = {
    ...prefs,
    timestamp: new Date().toISOString(),
    version: CONSENT_VERSION,
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(full));
  } catch {
    // no-op
  }
  dispatchConsentEvent(full);
  return full;
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [prefs, setPrefs] = useState({
    functional: true,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    const stored = loadStoredPreferences();
    if (!stored) {
      setVisible(true);
    } else {
      // re-dispatch on mount so consumers (PostHog/Sentry) can sync on navigation
      dispatchConsentEvent(stored);
    }
  }, []);

  const acceptAll = () => {
    persistPreferences({ functional: true, analytics: true, marketing: true });
    setVisible(false);
    setCustomizing(false);
  };

  const rejectOptional = () => {
    persistPreferences({ functional: true, analytics: false, marketing: false });
    setVisible(false);
    setCustomizing(false);
  };

  const savePreferences = () => {
    persistPreferences({
      functional: true, // funcional é sempre verdadeiro por ser técnico/opcionalmente desligável via código
      analytics: prefs.analytics,
      marketing: prefs.marketing,
    });
    setVisible(false);
    setCustomizing(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Preferências de cookies"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-4 md:p-6"
    >
      <div
        className="mx-auto max-w-4xl rounded-2xl p-4 sm:p-5 md:p-6 shadow-2xl"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          backdropFilter: "blur(12px)",
        }}
      >
        {!customizing ? (
          <>
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex-1">
                <h2 className="text-base font-bold mb-1.5" style={{ color: "var(--foreground)" }}>
                  Nós usamos cookies
                </h2>
                <p className="text-xs sm:text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                  Utilizamos cookies estritamente necessários para o funcionamento da Plataforma e, mediante seu
                  consentimento, cookies analíticos e de estabilidade para melhorar o produto. Você pode aceitar tudo,
                  rejeitar os opcionais ou personalizar suas preferências. Saiba mais na nossa{" "}
                  <Link href="/privacidade" className="underline hover:opacity-80" style={{ color: "var(--brand-500)" }}>
                    Política de Privacidade
                  </Link>
                  .
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end">
              <button
                type="button"
                onClick={() => setCustomizing(true)}
                className="text-sm font-medium rounded-lg px-4 py-2.5 min-h-[40px] transition-colors hover:opacity-80"
                style={{
                  background: "transparent",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              >
                Personalizar
              </button>
              <button
                type="button"
                onClick={rejectOptional}
                className="text-sm font-medium rounded-lg px-4 py-2.5 min-h-[40px] transition-colors hover:opacity-80"
                style={{
                  background: "transparent",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              >
                Rejeitar opcionais
              </button>
              <button
                type="button"
                onClick={acceptAll}
                className="btn-primary text-sm !py-2.5 !px-4 min-h-[40px] flex items-center justify-center"
              >
                Aceitar todos
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
              <div className="flex-1">
                <h2 className="text-base font-bold mb-1.5" style={{ color: "var(--foreground)" }}>
                  Personalizar preferências
                </h2>
                <p className="text-xs sm:text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                  Escolha quais categorias de cookies você autoriza. Cookies estritamente necessários não podem ser
                  desativados, pois são essenciais ao funcionamento seguro da Plataforma.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <CookieRow
                title="Estritamente necessários"
                description="Autenticação (Clerk), segurança (Cloudflare), CSRF e sessão. Sempre ativos."
                checked
                disabled
              />
              <CookieRow
                title="Funcionais"
                description="Preferências do usuário (tema, idioma). Base: execução do contrato."
                checked
                disabled
              />
              <CookieRow
                title="Analíticos (PostHog)"
                description="Estatísticas agregadas de uso do produto. Base: consentimento."
                checked={prefs.analytics}
                onChange={(v) => setPrefs((p) => ({ ...p, analytics: v }))}
              />
              <CookieRow
                title="Marketing"
                description="Cookies de publicidade. Atualmente não utilizados — fica desligado por padrão."
                checked={prefs.marketing}
                onChange={(v) => setPrefs((p) => ({ ...p, marketing: v }))}
              />
            </div>

            <div className="mt-5 flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end">
              <button
                type="button"
                onClick={() => setCustomizing(false)}
                className="text-sm font-medium rounded-lg px-4 py-2.5 min-h-[40px] transition-colors hover:opacity-80"
                style={{
                  background: "transparent",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={savePreferences}
                className="btn-primary text-sm !py-2.5 !px-4 min-h-[40px] flex items-center justify-center"
              >
                Salvar preferências
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CookieRow({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-lg p-3 ${disabled ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
      style={{ background: "var(--background)", border: "1px solid var(--border)" }}
    >
      <input
        type="checkbox"
        className="mt-1"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <div className="flex-1">
        <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          {title}
        </div>
        <div className="text-xs leading-relaxed mt-0.5" style={{ color: "var(--muted)" }}>
          {description}
        </div>
      </div>
    </label>
  );
}
