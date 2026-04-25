// Spike test — simula viralização (Insta/TikTok).
// 1 → 200 VUs em 5 segundos. Sustenta 1min. Resfria.
// Mede: tempo de recovery, taxa de erro durante spike, latência max.
//
// Uso: k6 run loadtests/scenarios/06-spike-test.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { BASE_URL, defaultHeaders } from '../lib/config.js';

const spikeRecovery = new Trend('spike_recovery', true);
const errorsDuringSpike = new Rate('errors_during_spike');

export const options = {
  stages: [
    { duration: '30s', target: 1 },     // baseline calmo
    { duration: '5s',  target: 200 },   // SPIKE — 200 VUs em 5s
    { duration: '1m',  target: 200 },   // sustenta o pico
    { duration: '30s', target: 0 },     // resfria
  ],
  thresholds: {
    'http_req_duration': [
      { threshold: 'p(95)<10000', abortOnFail: true, delayAbortEval: '30s' },
    ],
    // Spike test tolera mais erro (é cenário de stress agudo)
    'http_req_failed': [
      { threshold: 'rate<0.40', abortOnFail: true, delayAbortEval: '30s' },
    ],
  },
};

export default function () {
  const startTime = Date.now();
  const res = http.get(`${BASE_URL}/`, {
    headers: defaultHeaders,
    timeout: '15s',
  });

  spikeRecovery.add(Date.now() - startTime);

  const ok = check(res, {
    'sobreviveu ao spike': (r) => r.status === 200,
    'sem 5xx': (r) => r.status < 500,
  });

  errorsDuringSpike.add(!ok);

  sleep(0.5); // think time curto — usuário viralizado é ansioso
}

export function handleSummary(data) {
  const m = data.metrics;
  const failRate = (m.http_req_failed?.values?.rate * 100).toFixed(2);

  return {
    'stdout': `
═════════════════════════════════════════════════
  SPIKE TEST — VIRAL TRAFFIC SIMULATION
═════════════════════════════════════════════════
  Total requests:        ${m.http_reqs?.values?.count}
  Failure rate (total):  ${failRate}%

  Latência durante spike:
    p(50):               ${m.http_req_duration?.values?.med?.toFixed(0)}ms
    p(95):               ${m.http_req_duration?.values?.['p(95)']?.toFixed(0)}ms
    p(99):               ${m.http_req_duration?.values?.['p(99)']?.toFixed(0)}ms
    max:                 ${m.http_req_duration?.values?.max?.toFixed(0)}ms

  Max VUs:               ${m.vus_max?.values?.value}

  Veredito: ${
    failRate < 2
      ? 'EXCELENTE — spike absorvido sem dor'
      : failRate < 10
      ? 'OK — alguns erros mas voltou ao normal'
      : 'RUIM — infra precisa de auto-scale ou queue'
  }
═════════════════════════════════════════════════
`,
  };
}
