// Smoke test autenticado — endpoints autenticados read-only.
// Pré-requisito: .env.loadtest com COOKIE_HEADER preenchido.
//
// Uso (PowerShell):
//   $line = (Get-Content .\loadtests\.env.loadtest -Raw).Trim()
//   $env:COOKIE_HEADER = $line.Substring($line.IndexOf('=') + 1)
//   k6 run loadtests/scenarios/03-smoke-authenticated.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { BASE_URL } from '../lib/config.js';
import { authHeaders } from '../lib/auth.js';

// Apenas endpoints com GET autenticado confirmado (route.ts inspecionado)
const ENDPOINTS = [
  // Rotas públicas (não exigem auth) — comparativo
  { name: 'mini_trial_status', path: '/api/credits/mini-trial-status', auth: false },
  { name: 'fashion_facts',     path: '/api/fashion-facts',             auth: false },
  { name: 'showcase',          path: '/api/showcase',                  auth: false },
  // Rotas que exigem auth — onde DB sob carga importa
  { name: 'credits',           path: '/api/credits',                   auth: true },
  { name: 'trial_status',      path: '/api/credits/trial-status',      auth: true },
  { name: 'store',             path: '/api/store',                     auth: true },
  { name: 'store_usage',       path: '/api/store/usage',               auth: true },
  { name: 'store_credits',     path: '/api/store/credits',             auth: true },
  { name: 'campaigns_list',    path: '/api/campaigns?limit=10',        auth: true },
  { name: 'model_list',        path: '/api/model/list',                auth: true },
  { name: 'models_bank',       path: '/api/models/bank',               auth: true },
];

const trends = {};
for (const e of ENDPOINTS) {
  trends[e.name] = new Trend(`dur_${e.name}`, true);
}

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    'http_req_failed': ['rate<0.10'],
  },
};

export default function () {
  for (const ep of ENDPOINTS) {
    const res = http.get(`${BASE_URL}${ep.path}`, {
      headers: authHeaders,
      redirects: 0,
      tags: { endpoint: ep.name, requires_auth: String(ep.auth) },
    });
    trends[ep.name].add(res.timings.duration);

    check(res, {
      [`${ep.name} sem 5xx`]: (r) => r.status < 500,
      [`${ep.name} status válido`]: (r) =>
        r.status === 200 || r.status === 304 || r.status === 401 || r.status === 403,
    });

    if (__ITER === 0) {
      const s = res.status;
      const note = s === 200 ? 'OK'
        : s === 304 ? 'NOT MODIFIED'
        : s === 401 ? 'UNAUTHENTICATED (auth falhou)'
        : s === 403 ? 'FORBIDDEN'
        : s === 404 ? 'NOT FOUND'
        : s >= 500 ? 'SERVER ERROR'
        : `status ${s}`;
      console.log(`[${ep.name}${ep.auth ? ' 🔒' : ''}] ${note} dur=${res.timings.duration.toFixed(0)}ms size=${res.body ? res.body.length : 0}b`);
    }
  }
  sleep(2);
}
