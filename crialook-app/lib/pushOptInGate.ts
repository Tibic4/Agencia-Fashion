/**
 * Gate de opt-in de push — prompt contextual de permissão.
 *
 * Pedir permissão de notificação no boot é o pior momento possível: usuário
 * acabou de abrir o app, ainda não experimentou valor nenhum, não tem
 * contexto do que as notificações conteriam. Estudos (Localytics, Mixpanel)
 * mostram opt-in 4-5× maior em prompts pós-ação vs. boot.
 *
 * Estratégia: dispara o dialog do sistema UMA vez, depois da primeira
 * campanha gerada com sucesso (em resultado.tsx). Persiste que já
 * perguntamos pra nunca repetir. Se o usuário já tinha concedido via
 * OS settings, no-op. Breadcrumb no Sentry pra ver opt-in rate em prod.
 */
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import { apiPost } from './api';
import { registerForPushNotifications } from './notifications';
import { Sentry } from './sentry';

const KEY_HAS_PROMPTED = 'push_opt_in_prompted_v1';

/**
 * Pede permissão de push contextualmente. Idempotent — safe chamar várias
 * vezes. Retorna true se conseguiu token (do prompt ou de um grant
 * pré-existente).
 */
export async function maybeRequestPushPermission(): Promise<boolean> {
  try {
    // Já concedido? Só sincroniza o token (cobre o caso de o usuário ter
    // concedido em OS Settings fora do app).
    const existing = await Notifications.getPermissionsAsync();
    if (existing.status === 'granted') {
      const token = await registerForPushNotifications();
      if (token) {
        await apiPost('/store/push-token', { token }).catch(() => {});
      }
      return !!token;
    }

    // Já pedimos uma vez e não foi concedido → não enche.
    const hasPrompted = await SecureStore.getItemAsync(KEY_HAS_PROMPTED);
    if (hasPrompted === '1') return false;

    // OS bloqueou o ask ("Don't ask again") → respeita.
    if (existing.status === 'denied' && !existing.canAskAgain) {
      await SecureStore.setItemAsync(KEY_HAS_PROMPTED, '1').catch(() => {});
      return false;
    }

    // O ask contextual: dispara o dialog do sistema. O OS mostra ícone +
    // nome do app — não dá pra anexar copy tipo "Saiba quando sua próxima
    // campanha estiver pronta" via expo-notifications. A intenção é
    // comunicada por *quando* pedimos (logo após sucesso), não por copy.
    const token = await registerForPushNotifications();
    await SecureStore.setItemAsync(KEY_HAS_PROMPTED, '1').catch(() => {});

    Sentry.addBreadcrumb({
      category: 'push',
      message: token ? 'push_opt_in_granted' : 'push_opt_in_denied',
      level: 'info',
    });

    if (token) {
      await apiPost('/store/push-token', { token }).catch(() => {});
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
