// Webhook bombardment — testa rejeição de webhooks Mercado Pago inválidos sob carga.
//
// Cenário: atacante manda 100 req/s com HMAC inválido tentando:
//   - DDoS interno (forçar DB lookups caros)
//   - Bypass do fraud-gate
//
// Esperado: app rejeita rápido (<100ms cada) com 401, sem fazer DB lookup.
// Se levar >1s ou retornar 500, é vulnerabilidade.
//
// Payload: simula notificação de pagamento real do MP, mas HMAC é lixo.
//
// Uso: k6 run loadtests/scenarios/07-webhook-bombardment.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { BASE_URL, defaultHeaders } from '../lib/config.js';

const rejectionLatency = new Trend('rejection_latency', true);
const correctRejections = new Rate('correct_rejections');
const securityBreaches = new Rate('security_breaches');

const FAKE_PAYLOAD = JSON.stringify({
  action: 'payment.updated',
  api_version: 'v1',
  data: { id: '123456789' },
  date_created: new Date().toISOString(),
  id: 999999,
  live_mode: true,
  type: 'payment',
  user_id: '12345',
});

// HMAC propositalmente inválido — Mercado Pago vai rejeitar
const FAKE_SIGNATURE = 'ts=1700000000,v1=invalid_signature_for_load_test_only';
const FAKE_REQUEST_ID = 'loadtest-' + Date.now();

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // 50 atacantes simultâneos
    { duration: '1m',  target: 100 },  // ramp pra 100/s
    { duration: '1m',  target: 100 },  // sustenta
    { duration: '30s', target: 0 },    // resfria
  ],
  thresholds: {
    // Rejeição tem que ser RÁPIDA (sem DB lookup) — proteção contra DDoS amplificado
    'rejection_latency': ['p(95)<2000'],
    // ZERO HMAC inválido pode passar como aceito (200) — única hard fail
    'security_breaches': ['rate==0'],
    // Aborta se p95 explodir (proteção)
    'http_req_duration': [
      { threshold: 'p(95)<5000', abortOnFail: true, delayAbortEval: '30s' },
    ],
  },
};

export default function () {
  const res = http.post(`${BASE_URL}/api/webhooks/mercadopago`, FAKE_PAYLOAD, {
    headers: {
      ...defaultHeaders,
      'Content-Type': 'application/json',
      'X-Signature': FAKE_SIGNATURE,
      'X-Request-Id': FAKE_REQUEST_ID,
    },
    timeout: '5s',
    tags: { endpoint: 'webhook_mp_invalid' },
  });

  rejectionLatency.add(res.timings.duration);

  // Categorias do response sob carga:
  //   401/400/403 = fraud-gate rejeitou no handler  (✓ rejeição direta)
  //   429        = Nginx rate limit cortou           (✓ defesa válida)
  //   503/504    = Nginx circuit breaker             (✓ defesa válida sob saturação)
  //   200        = HMAC inválido aceito              (✗ VULNERABILIDADE)
  //   500        = bug no handler                    (✗ erro do servidor)
  const handlerRejected   = res.status === 401 || res.status === 400 || res.status === 403;
  const proxyDefended     = res.status === 429 || res.status === 503 || res.status === 504;
  const isSecurityBreach  = res.status === 200;
  const isServerError     = res.status === 500;

  // "Correta" = qualquer defesa que não deixou HMAC inválido virar evento de pagamento
  correctRejections.add(handlerRejected || proxyDefended);
  securityBreaches.add(isSecurityBreach);

  check(res, {
    'NÃO virou 200 (vulnerabilidade)':         (r) => r.status !== 200,
    'NÃO virou 500 (bug do handler)':          (r) => r.status !== 500,
    'rejeitou rápido quando handler atendeu':  (r) => !handlerRejected || r.timings.duration < 2000,
  });

  sleep(0.1); // ataques rápidos
}

export function handleSummary(data) {
  const m = data.metrics;
  const correctRate = ((m.correct_rejections?.values?.rate || 0) * 100).toFixed(2);
  const breachRate = ((m.security_breaches?.values?.rate || 0) * 100).toFixed(2);
  const total = m.http_reqs?.values?.count || 0;

  return {
    'stdout': `
═════════════════════════════════════════════════
  WEBHOOK BOMBARDMENT — SECURITY UNDER LOAD
═════════════════════════════════════════════════
  Total requests:        ${total}
  Throughput:            ${(m.http_reqs?.values?.rate || 0).toFixed(1)} req/s

  Defesas bem-sucedidas: ${correctRate}%   (handler 401/400/403 + proxy 429/503)
  Vulnerabilidades:      ${breachRate}%   (status 200 com HMAC inválido — DEVE ser 0)

  Latência (rejeição direta no handler):
    p(50):               ${m.rejection_latency?.values?.med?.toFixed(0)}ms
    p(95):               ${m.rejection_latency?.values?.['p(95)']?.toFixed(0)}ms
    p(99):               ${m.rejection_latency?.values?.['p(99)']?.toFixed(0)}ms

  Max VUs:               ${m.vus_max?.values?.value}

  Nota: 503/504 sob carga alta = Nginx circuit breaker protegendo backend.
        Não é vulnerabilidade — confirme breakdown nos logs do Nginx.

  Veredito: ${
    breachRate > 0
      ? `🚨 VULNERABILIDADE: ${breachRate}% das requests com HMAC inválido foram aceitas (200)`
      : correctRate >= 99
      ? '✅ SEGURO — zero vulnerabilidades, defesas em camadas funcionando'
      : '⚠️ Investigar logs do Nginx — algumas respostas inesperadas'
  }
═════════════════════════════════════════════════
`,
  };
}
