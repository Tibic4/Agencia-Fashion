# Load Testing — CriaLook

Stress tests com [k6](https://k6.io) em produção (`https://crialook.com.br`).

Serve como prática de **engenharia de performance**: identificar gargalos com dados, aplicar otimização, medir impacto e iterar.

## Objetivo

Validar:

1. **Capacidade da landing** sob tráfego realista (1 → 100+ VUs)
2. **Latência por endpoint** público e autenticado
3. **Comportamento de Clerk auth + Supabase** sob carga
4. **Eficácia de otimizações** (cache Nginx, brotli, ISR)

## Stack

- **k6 v1.7.1** (Grafana) — runner JS-based com thresholds e custom metrics
- **VPS KingHost** Ubuntu 24.04, 2 vCPU, 4GB RAM
- **Stack alvo:** Next.js 16 + Nginx + PM2 + Supabase + Clerk

## Estrutura

```
loadtests/
├── lib/
│   ├── config.js              # BASE_URL, headers, thresholds compartilhados
│   └── auth.js                # Helper para injetar cookie Clerk em requests
├── scenarios/
│   ├── 01-smoke-public.js          # 1 VU × 30s — sanity check público
│   ├── 01b-smoke-per-endpoint.js   # Mede latência por endpoint
│   ├── 02-load-landing.js          # Ramp 1→100 VUs na landing
│   ├── 03-smoke-authenticated.js   # Sanity check autenticado
│   └── 04-load-authenticated.js    # Ramp 1→50 VUs em endpoints autenticados
├── reports/                   # JSON dos runs (gitignored)
├── set-cookie.ps1             # Helper PowerShell para configurar auth
└── .env.loadtest.example      # Template para credenciais (gitignored)
```

## Como rodar

### 1. Smoke público (sem auth)

```powershell
k6 run loadtests/scenarios/01-smoke-public.js
k6 run loadtests/scenarios/01b-smoke-per-endpoint.js
```

### 2. Load test landing

```powershell
k6 run loadtests/scenarios/02-load-landing.js
```

### 3. Endpoints autenticados

Pré-requisito: capturar cookie Clerk (instruções abaixo).

```powershell
.\loadtests\set-cookie.ps1   # configura .env.loadtest
$line = (Get-Content .\loadtests\.env.loadtest -Raw).Trim()
$env:COOKIE_HEADER = $line.Substring($line.IndexOf('=') + 1)
k6 run loadtests/scenarios/03-smoke-authenticated.js
k6 run loadtests/scenarios/04-load-authenticated.js
```

### Capturar cookie Clerk

1. Login em `https://crialook.com.br` (incógnito recomendado)
2. F12 → aba **Network** → recarrega (F5)
3. Clica na primeira request → aba **Headers** → **Request Headers**
4. Copia o valor da linha `cookie:` (botão direito → Copy value)
5. Roda `.\loadtests\set-cookie.ps1` e cola quando pedir

⚠️ Cookies dão acesso à sessão. Após testar:
- Logout do browser
- Revogar sessions no Clerk Dashboard

## Resultados — antes / depois

> **Last measured: 2026-05-04 (Phase 8 readiness check)**
> Capacity numbers below reflect a single point-in-time measurement. Re-measure
> after major infra changes (nginx config, PM2 settings, Supabase plan tier).
> Future runs: append a new dated section below ("### 2026-XX-XX run") rather
> than overwriting these numbers — preserves trend visibility.

### Baseline (antes da otimização)

Smoke 1 VU × 30s, landing:

| Endpoint | p50 | p95 | p99 |
|---|---|---|---|
| `/` | 824ms | **1510ms** ❌ | 1620ms |
| `/sobre` | 395ms | 622ms | 668ms |
| `/termos` | 315ms | 756ms | 858ms |
| `/api/health` | 374ms | 760ms | 900ms |

Diagnóstico: `X-Nextjs-Cache: HIT` mas latência ainda alta — Next.js renderizava HTML completo a cada request, sem cache HTTP nativo no Nginx.

### Otimizações aplicadas

1. **Brotli** habilitado no Nginx (`libnginx-mod-http-brotli-filter`)
2. **`proxy_cache`** Nginx criado para rotas estáticas (`/`, `/sobre`, `/termos`, `/privacidade`, `/subprocessadores`, `/dpo`, `/consentimento-biometrico`)
3. **TTL** 2-5min, bypass automático se request tem `Authorization` ou cookie de sessão (usuários logados sempre veem versão fresca)

```nginx
proxy_cache_path /var/cache/nginx/crialook levels=1:2 keys_zone=html_cache:10m
                 max_size=100m inactive=1h use_temp_path=off;

location = / {
    proxy_pass http://127.0.0.1:3000;
    proxy_cache html_cache;
    proxy_cache_valid 200 2m;
    proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
    proxy_cache_lock on;
    proxy_cache_bypass $http_authorization $cookie_session;
    add_header X-Cache-Status $upstream_cache_status always;
}
```

### Resultados pós-otimização

**Direto na VPS** (sem latência de rede externa):
- `Document Length: 127061 bytes` (124KB HTML)
- `Requests per second: 693.33 #/sec` sob 10 conexões simultâneas
- `Time per request: 14.4ms` médio
- `Failed requests: 0` em 200 requests
- `X-Cache-Status: HIT` consistente, `Content-Encoding: br` ativo

**Capacidade demonstrada:** ~60M requests/dia teóricos na landing.

### Load test landing (100 VUs)

Sustentou pico de 100 VUs simultâneos sem falha:

```
Total requests:    5150
Failed rate:       0.00%
Avg duration:      1179ms
p(95):             2009ms
Max VUs:           100
```

Degradação linear (avg 443ms → 1179ms = 2.7×) sob 100×carga = infra com margem.

## Aprendizados

- **`X-Nextjs-Cache: HIT` ≠ resposta rápida** — Next.js cacheia o resultado RSC, mas não substitui cache HTTP no proxy
- **Brotli vs gzip** — ~20% menor em HTML grande; vale o `apt install` de 16KB
- **`proxy_cache_bypass` com `$http_authorization` + `$cookie_session`** é essencial — usuário logado nunca pode ver página cacheada de outro
- **Threshold + `abortOnFail`** no k6 é safety net — aborta antes de derrubar produção
- **`User-Agent` e `X-Loadtest` headers** facilitam filtrar tráfego de teste no PostHog/logs depois

## Outros cenários executados

### Stress test (ramp 50→500 VUs em 12min)
- **45104 requests, 0.06% failure rate** — só 28 falhas em 45k
- p95 5586ms, max 20.2s — degradou mas não colapsou
- PM2 mostrou **0% CPU, 71MB RAM** depois — app não sentiu
- Veredito: gargalo está em proxy/network, não no Next.js

### Spike test (0 → 200 VUs em 5s)
- **7646 requests, 0.00% failure rate** durante 2min06s
- p95 3181ms, p50 1325ms
- Cenário "viralização Insta/TikTok" absorvido sem dor

### Webhook bombardment (174 req/s POST com HMAC inválido)
- 31390 requests em 3min
- **100% das que chegaram no handler foram rejeitadas com 401** (724/724 corretas)
- 76% retornaram **503 do Nginx** — backend saturado em ~50 req/s sustentados de POST
- **Veredito**: fraud-gate seguro; Nginx devolve 503 como circuit breaker (comportamento correto)
- Mercado Pago real envia <10 webhooks/s — 5× de margem confortável

## Capacity findings

| Cenário | Resultado | Margem real |
|---|---|---|
| Landing GET (com cache) | 693 req/s direto na VPS | OK até ~2k req/s |
| Landing GET (via internet, 100 VUs) | 0% erro, p95 2s | OK |
| Landing GET (via internet, 500 VUs) | 0.06% erro | Limite de proxy/network atingido |
| Webhook POST | ~50 req/s sustentado antes de 503 | 5× acima do realista |
| **Bottleneck identificado** | Nginx upstream connection pool / Cloudflare | — |

## Próximos passos

- Distributed load testing com k6 cloud / múltiplas regiões
- Comparar com Cloudflare em modo "Cache Everything" vs DNS-only
- Testar pipeline IA com mock providers (cenário Fase 4)
- Chaos engineering — derrubar Supabase mid-test e medir circuit breaker
