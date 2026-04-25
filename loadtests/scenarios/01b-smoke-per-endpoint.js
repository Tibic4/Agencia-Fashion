// Smoke test detalhado — mostra latência POR endpoint pra identificar o gargalo.
// Cada endpoint vira uma métrica separada (Trend) que aparece no relatório final.
//
// Uso: k6 run loadtests/scenarios/01b-smoke-per-endpoint.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { BASE_URL, defaultHeaders } from '../lib/config.js';

const ENDPOINTS = [
  { name: 'landing', path: '/' },
  { name: 'sobre', path: '/sobre' },
  { name: 'termos', path: '/termos' },
  { name: 'privacidade', path: '/privacidade' },
  { name: 'subprocessadores', path: '/subprocessadores' },
  { name: 'sitemap', path: '/sitemap.xml' },
  { name: 'robots', path: '/robots.txt' },
  { name: 'health', path: '/api/health' },
];

// Cria uma Trend por endpoint — k6 vai reportar p50/p95/p99 separados
const trends = {};
for (const e of ENDPOINTS) {
  trends[e.name] = new Trend(`dur_${e.name}`, true);
}

export const options = {
  vus: 1,
  duration: '30s',
};

export default function () {
  for (const ep of ENDPOINTS) {
    const res = http.get(`${BASE_URL}${ep.path}`, {
      headers: defaultHeaders,
      tags: { endpoint: ep.name },
    });
    trends[ep.name].add(res.timings.duration);

    // Captura headers de cache pra debugar
    const cacheHeader = res.headers['X-Nextjs-Cache'] || res.headers['Cf-Cache-Status'] || 'none';
    const ageHeader = res.headers['Age'] || '0';

    check(res, {
      [`${ep.name} status 200`]: (r) => r.status === 200,
    });

    // Loga header de cache (vai aparecer só se algo for raro/crítico, mas ajuda)
    if (__ITER === 0) {
      console.log(`[${ep.name}] cache=${cacheHeader} age=${ageHeader} dur=${res.timings.duration.toFixed(0)}ms server=${res.headers['Server'] || 'unknown'}`);
    }
  }
  sleep(1);
}
