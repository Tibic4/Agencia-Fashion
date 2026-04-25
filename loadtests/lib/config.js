// Configuração central dos load tests CriaLook
// Pode sobrescrever via env: BASE_URL=http://localhost:3000 k6 run ...

export const BASE_URL = __ENV.BASE_URL || 'https://crialook.com.br';

// User-Agent que marca toda request como teste — útil pra filtrar logs/PostHog depois
export const TEST_UA = 'k6-loadtest-crialook/1.0 (+stresstest)';

// Headers padrão que toda request manda
export const defaultHeaders = {
  'User-Agent': TEST_UA,
  'X-Loadtest': 'crialook-k6',
};

// Thresholds globais. Se ultrapassar, k6 sai com exit code 99 (falha de SLA).
// Use no `options.thresholds` de cada cenário.
export const standardThresholds = {
  // 95% das requests sub-1s (landing/static deve ser muito mais rápido)
  'http_req_duration': ['p(95)<1000', 'p(99)<3000'],
  // Menos de 1% de erro
  'http_req_failed': ['rate<0.01'],
};

// Thresholds mais frouxos para endpoints que vão pra Supabase/IA
export const apiThresholds = {
  'http_req_duration': ['p(95)<2000', 'p(99)<5000'],
  'http_req_failed': ['rate<0.05'],
};
