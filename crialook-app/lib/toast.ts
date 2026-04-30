/**
 * Toast — sistema leve de mensagem in-app.
 *
 * Por que não `Alert.alert`: o dialog nativo bloqueia, tem tipografia feia,
 * zero identidade de marca e quebra o fluxo visual em todo "salvo" / "erro".
 * Reservamos `Alert.alert` pra confirmação destrutiva (onde bloquear é o
 * ponto) e usamos toast pro resto.
 *
 * `<ToastHost />` precisa estar montado uma vez no root (acima da navegação).
 * Chamadas `toast.*` empurram mensagens numa queue minúscula — o host
 * renderiza a atual com slide-in/out.
 */
import { useSyncExternalStore } from 'react';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: number;
  kind: ToastKind;
  text: string;
  /** Label + handler de ação secundária (opcional). */
  action?: { label: string; onPress: () => void };
  /** Override do default (3500ms; error/warning duram mais). */
  durationMs?: number;
}

let nextId = 1;
let current: ToastMessage | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function show(kind: ToastKind, text: string, opts: { action?: ToastMessage['action']; durationMs?: number } = {}) {
  current = { id: nextId++, kind, text, action: opts.action, durationMs: opts.durationMs };
  notify();
}

export function dismissCurrentToast() {
  current = null;
  notify();
}

export const toast = {
  success: (text: string, opts?: { action?: ToastMessage['action']; durationMs?: number }) =>
    show('success', text, opts),
  error: (text: string, opts?: { action?: ToastMessage['action']; durationMs?: number }) =>
    show('error', text, { durationMs: 5000, ...opts }),
  warning: (text: string, opts?: { action?: ToastMessage['action']; durationMs?: number }) =>
    show('warning', text, { durationMs: 4500, ...opts }),
  info: (text: string, opts?: { action?: ToastMessage['action']; durationMs?: number }) =>
    show('info', text, opts),
};

export function useCurrentToast(): ToastMessage | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => current,
    () => current,
  );
}
