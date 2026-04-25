// Load test landing — ramp progressivo até saturar.
// Calibrado pra VPS Hostinger single-instance (PM2 1 worker, ~3.8GB RAM).
//
// Ramp: 1 → 10 → 30 → 60 → 100 VUs ao longo de ~9min.
// Aborta automaticamente se p95 > 8s ou error rate > 20% (proteção).
//
// Uso: k6 run loadtests/scenarios/02-load-landing.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { BASE_URL, defaultHeaders } from '../lib/config.js';

// Métricas custom para visualizar separadas
const landingDur = new Trend('landing_duration', true);
const landingFailRate = new Rate('landing_failed');

export const options = {
  stages: [
    { duration: '1m', target: 10 },   // aquece — referência
    { duration: '2m', target: 30 },   // load leve
    { duration: '2m', target: 60 },   // load moderada
    { duration: '2m', target: 100 },  // pico — onde provavelmente sente
    { duration: '1m', target: 100 },  // sustenta o pico
    { duration: '1m', target: 0 },    // resfria
  ],
  thresholds: {
    // ABORT — k6 mata o teste se cruzar (proteção pra não derrubar prod)
    'http_req_duration': [
      { threshold: 'p(95)<8000', abortOnFail: true, delayAbortEval: '30s' },
    ],
    'http_req_failed': [
      { threshold: 'rate<0.20', abortOnFail: true, delayAbortEval: '30s' },
    ],
    // Métricas que reportam mas não abortam
    'landing_duration': ['p(95)<5000'],
    'checks': ['rate>0.90'],
  },
  // Limita conexões pra simular usuários reais
  noConnectionReuse: false,
};

export default function () {
  const res = http.get(`${BASE_URL}/`, {
    headers: defaultHeaders,
    timeout: '15s',
  });

  landingDur.add(res.timings.duration);
  landingFailRate.add(res.status !== 200);

  check(res, {
    'status 200': (r) => r.status === 200,
    'tem CriaLook no HTML': (r) => r.body && r.body.includes('CriaLook'),
    'TTFB < 5s': (r) => r.timings.waiting < 5000,
  });

  // Think time realista — usuário real fica olhando 2-6s
  sleep(Math.random() * 4 + 2);
}

export function handleSummary(data) {
  // Resumo customizado curto no fim
  const m = data.metrics;
  const failRate = (m.http_req_failed?.values?.rate * 100).toFixed(2);
  const summary = `
═══════════════════════════════════════
  RESUMO LOAD TEST LANDING
═══════════════════════════════════════
  Total requests:    ${m.http_reqs?.values?.count}
  Failed rate:       ${failRate}%
  Avg duration:      ${m.http_req_duration?.values?.avg?.toFixed(0)}ms
  p(95):             ${m.http_req_duration?.values?.['p(95)']?.toFixed(0)}ms
  p(99):             ${m.http_req_duration?.values?.['p(99)']?.toFixed(0)}ms
  Max VUs alcançado: ${m.vus_max?.values?.value}
═══════════════════════════════════════
`;
  return {
    'stdout': summary,
  };
}
