// Helpers de autenticação para load tests Clerk.
// Lê o COOKIE_HEADER bruto do .env.loadtest — string já no formato
// `name1=value1; name2=value2; ...` que dá pra colar do DevTools.

import { defaultHeaders } from './config.js';

export const COOKIE_HEADER = __ENV.COOKIE_HEADER || '';

if (!COOKIE_HEADER) {
  throw new Error(
    'COOKIE_HEADER vazio. Veja loadtests/.env.loadtest.example pra como popular.'
  );
}

export const authHeaders = {
  ...defaultHeaders,
  Cookie: COOKIE_HEADER,
};
