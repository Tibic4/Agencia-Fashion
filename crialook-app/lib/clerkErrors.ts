/**
 * Tradução de erros do Clerk pra mensagens user-friendly em PT-BR/EN.
 *
 * Clerk retorna erros em estrutura:
 *   { errors: [{ code, longMessage, message, meta }] }
 *
 * `longMessage` vem em inglês cru ("Password is incorrect. Try again,
 * or use another method.") porque usamos UI custom (não o <SignIn /> da
 * Clerk com locale built-in). Esse helper:
 *
 *   1. Lê o `code` (estável, documentado pela Clerk)
 *   2. Mapeia pra uma chave i18n nossa (signIn.errors.passwordIncorrect, etc)
 *   3. Cai no `longMessage`/`message` original como fallback se code novo
 *      aparecer — o pior cenário é mostrar inglês, não tela em branco
 *
 * Usado em sign-in, sign-up, sso-callback e GoogleSignInButton.
 */
import type { TKey } from '@/lib/i18n';

type TFunction = (key: TKey, options?: Record<string, string | number>) => string;

interface ClerkErrorEntry {
  code?: string;
  longMessage?: string;
  message?: string;
}

interface ClerkLikeError {
  errors?: ClerkErrorEntry[];
  message?: string;
}

// Cobre os códigos que dão pra acontecer em sign-in/up/oauth/verify.
// Lista canônica: https://clerk.com/docs/errors/overview
const CODE_TO_KEY: Record<string, string> = {
  // Identifier / email
  form_identifier_not_found: 'errors.clerk.identifierNotFound',
  form_identifier_exists: 'errors.clerk.identifierExists',
  form_param_format_invalid: 'errors.clerk.formatInvalid',
  form_param_nil: 'errors.clerk.fieldRequired',
  form_param_unknown: 'errors.clerk.formatInvalid',

  // Password
  form_password_incorrect: 'errors.clerk.passwordIncorrect',
  form_password_pwned: 'errors.clerk.passwordPwned',
  form_password_validation_failed: 'errors.clerk.passwordWeak',
  form_password_too_short: 'errors.clerk.passwordTooShort',
  form_password_size_in_bytes_exceeded: 'errors.clerk.passwordTooLong',
  form_password_not_strong_enough: 'errors.clerk.passwordWeak',

  // Sessão
  session_exists: 'errors.clerk.sessionExists',
  session_token_expired: 'errors.clerk.sessionExpired',
  authentication_invalid: 'errors.clerk.authInvalid',

  // Verificação por código (email/SMS)
  verification_failed: 'errors.clerk.verificationFailed',
  verification_expired: 'errors.clerk.verificationExpired',
  form_code_incorrect: 'errors.clerk.codeIncorrect',
  verification_already_verified: 'errors.clerk.alreadyVerified',

  // OAuth / SSO
  oauth_access_denied: 'errors.clerk.oauthDenied',
  oauth_callback_invalid: 'errors.clerk.oauthCallbackInvalid',
  oauth_email_domain_reserved_by_saml: 'errors.clerk.oauthDomainReserved',
  external_account_not_found: 'errors.clerk.externalAccountNotFound',

  // Rate limiting
  too_many_requests: 'errors.clerk.tooManyRequests',
  rate_limit_exceeded: 'errors.clerk.tooManyRequests',
};

/**
 * Detecta se o erro veio de cancel/dismiss do flow OAuth (browser fechado,
 * usuário voltou). Esses não devem virar toast — silêncio é o sinal certo.
 */
export function isOAuthCanceled(err: unknown): boolean {
  const msg = (err as ClerkLikeError)?.message ?? '';
  return /cancel|dismiss|user_canceled/i.test(msg);
}

/**
 * Pega a melhor mensagem traduzida pro erro do Clerk.
 * Se o `code` é conhecido → mensagem amigável em PT-BR.
 * Se não, cai no `longMessage` original (inglês, mas pelo menos descritivo).
 * Último fallback: mensagem genérica passada pelo caller.
 */
export function clerkErrorMessage(
  err: unknown,
  t: TFunction,
  fallbackKey: string,
): string {
  const e = err as ClerkLikeError;
  const first = e?.errors?.[0];
  const code = first?.code;

  if (code && CODE_TO_KEY[code]) {
    return t(CODE_TO_KEY[code] as TKey);
  }

  // Fallback 1: mensagem do Clerk (inglês mas descritiva)
  if (first?.longMessage) return first.longMessage;
  if (first?.message) return first.message;
  if (e?.message) return e.message;

  // Fallback 2: chave genérica que o caller passa (ex: signIn.genericError)
  return t(fallbackKey as TKey);
}
