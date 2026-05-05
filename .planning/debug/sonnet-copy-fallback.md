---
slug: sonnet-copy-fallback
status: investigating
trigger: "Sonnet copywriter retornando texto IDÊNTICO byte-por-byte em todas as campanhas pós-deploy M1+M2"
created: 2026-05-05
updated: 2026-05-05
severity: P0 production (paying users impacted)
---

# Debug: Sonnet copy byte-identical across campaigns

## Symptoms

- **Reported by:** owner (2026-05-05 manhã)
- **What user sees:** every campaign generated returns identical caption / hashtags / dicas_postagem
- **Evidence:** owner ran `pm2 logs crialook --lines 500 | grep "Sonnet Copy falhou"` → result:
  ```
  [Pipeline] ❌ Sonnet Copy falhou: Connection error.
  ```
- **Timeline:** apareceu DEPOIS do deploy M1+M2 (commits ~`f447674` e anteriores)

## Initial debugger run (background agent, returned wrong root cause)

Background agent claimed `MODEL = "claude-sonnet-4-6"` was non-existent → false positive.
Per environment context, `claude-sonnet-4-6` IS canonical Sonnet 4.6 ID.
Agent was operating on outdated training data and hallucinated.

Lesson: trust-but-verify agent diagnoses, especially claims about model ID validity.

## Verified findings

1. **Code path** (CORRECT in agent report):
   - `campanha-ia/src/lib/ai/sonnet-copywriter.ts:155` — `MODEL = "claude-sonnet-4-6"` (valid)
   - `campanha-ia/src/lib/ai/pipeline.ts:288-311` — fallback `.catch()` returns hardcoded `dicas_postagem` object (the byte-identical text users see)
   - `campanha-ia/src/lib/ai/clients.ts:35` — Anthropic client reads `process.env.ANTHROPIC_API_KEY` (NOT typed env from M2 P4)

2. **Real error message from PM2 logs**: `Connection error.` (NOT `model_not_found`)

3. **Network from VPS to Anthropic works** (system curl):
   ```
   curl ... https://api.anthropic.com/v1/models -H "x-api-key: dummy"
   → HTTP 401 | DNS 0.002s | Connect 1.04s | Total 1.24s
   ```
   So: DNS OK, TCP connect OK, TLS handshake OK, Anthropic responds 401 (esperado pra dummy key).

4. **PM2 process env doesn't have ANTHROPIC_API_KEY directly**:
   ```
   pm2 env 6 | grep -i anthropic
   → (no output)
   ```
   But: Next.js loads `.env.local` at runtime, so PM2 process env not having it is OK.

5. **Isolated Anthropic SDK test** (run with `set -a; source .env.local; set +a`):
   ```
   Key loaded: true len: 108 prefix: sk-ant-api03  (formato válido)
   FAIL: APIConnectionError Connection error.
   Cause: undefined fetch failed
   ```
   So: key loaded correctly, but Anthropic SDK fetch fails.

6. **Force IPv4 via `NODE_OPTIONS=--dns-result-order=ipv4first`**: SAME failure
   (so not just IPv6 ordering issue)

7. **Raw Node fetch (bypass Anthropic SDK)**: SAME failure
   ```
   FAIL fetch failed | ETIMEDOUT |
   ```
   So: problem is NOT Anthropic SDK-specific. Node fetch global is broken/timeout.

8. **No proxy env vars** (HTTP_PROXY / HTTPS_PROXY / NO_PROXY all undefined)
   Node 24.15.0 (current LTS-ish)

## Current hypothesis (INVESTIGATING)

`undici` (Node 24's fetch implementation) is broken in this VPS context. Likely:
- IPv6 path stuck (curl uses happy-eyeballs, Node fetch may not)
- OR Anthropic edge serving HTTP/2 + ALPN issue
- OR specific Linux/Locaweb VPS config breaking undici
- OR system has IPv6 stack but no IPv6 routing → Node sticks on IPv6 timeout

Next diagnostic awaiting:
1. `node -e "require('https').get(...)"` (bypass undici, use Node legacy `https` module)
2. `dns.lookup` with `all: true` to see what IPs Node sees
3. `ip -6 route` + `curl -6` to confirm IPv6 routing state

## Owner just mentioned

- Site agora rodando no VPS (deploy ok, only Sonnet broken)
- "docker" — TBD if site moved to Docker (would change network surface)

## Pending

- Run 3 diagnostic tests
- Decide fix:
  - Option A: NODE_OPTIONS in ecosystem.config.js if IPv4 forces work
  - Option B: switch Anthropic SDK to use custom fetch via Node `https` module
  - Option C: undici upgrade
  - Option D: HTTP/1.1 force in fetch
- Apply fix, redeploy, verify variability returns

## Eliminated

- ❌ Model name (`claude-sonnet-4-6` IS valid per env context)
- ❌ Env schema (M2 P4 didn't break clients.ts which still uses `process.env`)
- ❌ Promise.allSettled (D-01) side effects
- ❌ Prompt caching (no cache_control blocks)
- ❌ Temperature 0 (set to 0.7)
- ❌ Network outage (curl works)
- ❌ API key invalid (key loaded, formato correto)
- ❌ IPv6 ordering alone (forced IPv4 didn't help)
