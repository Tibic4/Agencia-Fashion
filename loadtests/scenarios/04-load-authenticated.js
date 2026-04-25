// Load test autenticado — ramp 1 → 50 VUs em endpoints que validam auth e batem em Supabase.
// Testa Clerk validation + DB pool sob carga real.
//
// Pré-requisito: .env.loadtest com COOKIE_HEADER preenchido.
//
// Uso (PowerShell):
//   $line = (Get-Content .\loadtests\.env.loadtest -Raw).Trim()
//   $env:COOKIE_HEADER = $line.Substring($line.IndexOf('=') + 1)
//   k6 run loadtests/scenarios/04-load-authenticated.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { BASE_URL } from '../lib/config.js';
import { authHeaders } from '../lib/auth.js';

// 4 endpoints que sabemos retornar 200 com auth — testa stack completa
const ENDPOINTS = [
  '/api/credits',
  '/api/credits/trial-status',
  '/api/credits/mini-trial-status',
  '/api/models/bank',
];

const epDuration = new Trend('endpoint_duration', true);
const epErrors = new Counter('endpoint_errors');

export const options = {
  stages: [
    { duration: '1m', target: 5 },    // aquece
    { duration: '2m', target: 20 },   // load leve
    { duration: '2m', target: 20 },   // sustenta 20
    { duration: '2m', target: 50 },   // pico
    { duration: '1m', target: 50 },   // sustenta 50
    { duration: '1m', target: 0 },    // resfria
  ],
  thresholds: {
    // Abort se p95 > 10s ou erro > 30% sustentados (proteção)
    'http_req_duration': [
      { threshold: 'p(95)<10000', abortOnFail: true, delayAbortEval: '30s' },
    ],
    'http_req_failed': [
      { threshold: 'rate<0.30', abortOnFail: true, delayAbortEval: '30s' },
    ],
    'endpoint_duration': ['p(95)<5000'],
    'checks': ['rate>0.85'],
  },
};

export default function () {
  // Pega 1 endpoint aleatório por iteração — distribui carga
  const path = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
  const res = http.get(`${BASE_URL}${path}`, {
    headers: authHeaders,
    timeout: '15s',
    tags: { endpoint: path },
  });

  epDuration.add(res.timings.duration);
  if (res.status >= 400) epErrors.add(1);

  check(res, {
    'status 200': (r) => r.status === 200,
    'sem erro auth': (r) => r.status !== 401,
    'sem 5xx': (r) => r.status < 500,
  });

  // Think time menor que landing — usuário batendo em API é mais ativo
  sleep(Math.random() * 2 + 1);
}

export function handleSummary(data) {
  const m = data.metrics;
  const failRate = (m.http_req_failed?.values?.rate * 100).toFixed(2);
  const errCount = m.endpoint_errors?.values?.count || 0;

  const summary = `
═════════════════════════════════════════════════
  RESUMO LOAD TEST — ENDPOINTS AUTENTICADOS
═════════════════════════════════════════════════
  Total requests:    ${m.http_reqs?.values?.count}
  Throughput:        ${(m.http_reqs?.values?.rate || 0).toFixed(1)} req/s
  Failed rate:       ${failRate}%
  Errors (4xx/5xx):  ${errCount}

  Latência p50:      ${m.http_req_duration?.values?.med?.toFixed(0)}ms
  Latência p95:      ${m.http_req_duration?.values?.['p(95)']?.toFixed(0)}ms
  Latência p99:      ${m.http_req_duration?.values?.['p(99)']?.toFixed(0)}ms
  Max latency:       ${m.http_req_duration?.values?.max?.toFixed(0)}ms

  Max VUs alcançado: ${m.vus_max?.values?.value}
  Checks pass rate:  ${((m.checks?.values?.rate || 0) * 100).toFixed(1)}%
═════════════════════════════════════════════════
`;
  return { 'stdout': summary };
}
