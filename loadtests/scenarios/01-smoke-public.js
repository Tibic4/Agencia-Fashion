// Smoke test — confirma que tudo responde 200 com 1 VU por 30s.
// Roda primeiro pra validar que o teste em si está OK antes de mandar carga.
//
// Uso: k6 run loadtests/scenarios/01-smoke-public.js

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { BASE_URL, defaultHeaders, standardThresholds } from '../lib/config.js';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: standardThresholds,
};

const PUBLIC_PATHS = [
  '/',
  '/sobre',
  '/termos',
  '/privacidade',
  '/subprocessadores',
  '/sitemap.xml',
  '/robots.txt',
  '/api/health',
];

export default function () {
  group('public GETs', () => {
    for (const path of PUBLIC_PATHS) {
      const url = `${BASE_URL}${path}`;
      const res = http.get(url, { headers: defaultHeaders });
      check(res, {
        [`${path} status 200`]: (r) => r.status === 200,
        [`${path} body não-vazio`]: (r) => r.body && r.body.length > 0,
      });
    }
  });
  sleep(1);
}
