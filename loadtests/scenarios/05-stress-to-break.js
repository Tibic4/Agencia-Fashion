// Stress test — sobe VUs até a app falhar.
// Diferente do load test (carga esperada), aqui buscamos o LIMITE.
//
// Ramp: 1 → 100 → 200 → 350 → 500 VUs ao longo de ~12min.
// Aborta automaticamente se p95 > 15s ou error rate > 50%.
//
// Uso: k6 run loadtests/scenarios/05-stress-to-break.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { BASE_URL, defaultHeaders } from '../lib/config.js';

const breakingPoint = new Counter('breaking_point_signal');
const stageLatency = new Trend('stage_latency', true);

export const options = {
  stages: [
    { duration: '1m', target: 50 },    // baseline (já testado, sabe que aguenta)
    { duration: '2m', target: 100 },   // já testado, p95 ~2s
    { duration: '2m', target: 200 },   // novo território
    { duration: '2m', target: 350 },   // pressão alta
    { duration: '2m', target: 500 },   // tentando quebrar
    { duration: '2m', target: 500 },   // sustenta no extremo
    { duration: '1m', target: 0 },     // recovery
  ],
  thresholds: {
    'http_req_duration': [
      { threshold: 'p(95)<15000', abortOnFail: true, delayAbortEval: '60s' },
    ],
    'http_req_failed': [
      { threshold: 'rate<0.50', abortOnFail: true, delayAbortEval: '60s' },
    ],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/`, {
    headers: defaultHeaders,
    timeout: '20s',
  });

  stageLatency.add(res.timings.duration);

  const ok = check(res, {
    'status 200': (r) => r.status === 200,
    'sem 5xx': (r) => r.status < 500,
    'TTFB < 10s': (r) => r.timings.waiting < 10000,
  });

  // Sinaliza ponto de quebra
  if (!ok || res.status >= 500) {
    breakingPoint.add(1);
  }

  sleep(Math.random() * 2 + 1);
}

export function handleSummary(data) {
  const m = data.metrics;
  const failRate = (m.http_req_failed?.values?.rate * 100).toFixed(2);
  const breaks = m.breaking_point_signal?.values?.count || 0;

  return {
    'stdout': `
═════════════════════════════════════════════════
  STRESS TEST — ATÉ QUEBRAR
═════════════════════════════════════════════════
  Total requests:        ${m.http_reqs?.values?.count}
  Throughput médio:      ${(m.http_reqs?.values?.rate || 0).toFixed(1)} req/s
  Failure rate:          ${failRate}%
  Sinais de quebra:      ${breaks}

  p(50):                 ${m.http_req_duration?.values?.med?.toFixed(0)}ms
  p(95):                 ${m.http_req_duration?.values?.['p(95)']?.toFixed(0)}ms
  p(99):                 ${m.http_req_duration?.values?.['p(99)']?.toFixed(0)}ms
  Max latency:           ${m.http_req_duration?.values?.max?.toFixed(0)}ms

  Max VUs alcançado:     ${m.vus_max?.values?.value}

  Veredito: ${
    failRate < 1 && breaks < 10
      ? 'AGUENTOU — sem quebra detectada nesse range'
      : failRate < 5
      ? 'DEGRADAÇÃO — começou a falhar mas sem colapso'
      : 'COLAPSO — encontrou breaking point'
  }
═════════════════════════════════════════════════
`,
  };
}
