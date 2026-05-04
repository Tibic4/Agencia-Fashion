---
plan_id: 08-02
phase: 8
title: nginx-crialook.conf — Brotli graceful fallback + SSE proxy_request_buffering off + CSP report-uri (D-08, D-16, D-18)
wave: 1
depends_on: []
owner_action: false
files_modified:
  - nginx-crialook.conf
autonomous: true
requirements: ["D-08", "D-16", "D-18"]
must_haves:
  truths:
    - "patch nginx-crialook.conf brotli block (currently lines 57-72) so it fails GRACEFULLY when libnginx-mod-http-brotli-filter is not installed — D-16"
    - "the brotli graceful-fallback approach: wrap brotli directives in a 'load_module check' is NOT possible inside a server block (load_module is module-config scope only); instead, the deploy script (08-01) will pre-flight check via 'nginx -t' AFTER copying the canonical config, and if it fails on a brotli error, the script can sed-comment the 4 brotli lines and re-test. BUT this plan still adds explicit comments above the block so a manual operator knows what to do."
    - "pragmatic D-16 implementation: add a clear comment marker '### BROTLI BLOCK START ###' and '### BROTLI BLOCK END ###' around lines 57-72 so future tooling (and humans) can sed-strip the block deterministically. Add a header comment listing the install command and the workaround."
    - "deploy-crialook.sh already has a 'brotli modules não disponíveis' warning at line 163-164, but it doesn't do anything about it — this plan does NOT modify deploy-crialook.sh (08-01 owns that file). The graceful behavior here is via the comment markers; deploy-crialook.sh already attempts to install brotli. If install fails, the markers let an operator (or follow-up tooling) strip the block."
    - "add 'proxy_request_buffering off;' inside the /api/campaign/generate location block (currently line 127-144) per D-18 — this is the single critical line for SSE multipart upload latency. Place it adjacent to the existing 'proxy_buffering off;' (line 138) so both are visually grouped"
    - "add CSP report-uri directive to the existing Content-Security-Policy-Report-Only header (currently a single huge line at nginx-crialook.conf:39) per D-08. Use the in-app endpoint /api/csp-report (created by plan 08-06 as a simple ingest that forwards to Sentry server-side) — DO NOT use Sentry's direct ingest URL because the DSN public key would leak into nginx config which is committed to the repo"
    - "the report-uri value MUST be exactly 'report-uri /api/csp-report;' — relative path, lands on same origin, gets proxied to Next.js by the catch-all 'location /' block at nginx-crialook.conf:198 — no extra nginx routing needed"
    - "add 'report-to csp-endpoint' for modern browsers (CSP Level 3) AND keep 'report-uri' for Firefox/Safari fallback. The 'report-to' value names a group; the group is declared via a separate Reporting-Endpoints header. Add 'add_header Reporting-Endpoints \"csp-endpoint=\\\"/api/csp-report\\\"\" always;' alongside the CSP header"
    - "do NOT change the CSP source-list directives (default-src, script-src, etc.) — that's a separate concern owned by the security review; this plan only adds report-uri/report-to to the existing header"
    - "do NOT flip from 'Content-Security-Policy-Report-Only' to 'Content-Security-Policy' yet — D-09/D-10 require 2 weeks zero-violation observation BEFORE that flip; the flip itself is owner-action documented in plan 08-06's ops/csp-rollout.md"
    - "add a comment ABOVE the CSP header explaining: 'CSP-Report-Only mode (D-08..D-11). Flip to enforced (drop -Report-Only suffix) ONLY after 2 weeks of zero violations in Sentry. See ops/csp-rollout.md for the criteria + flip procedure.'"
    - "all changes must keep the file syntactically valid for nginx — verify by running 'nginx -t' against the patched file in a docker container OR (if not available locally) at minimum confirm the file structure is unchanged: 2 server blocks, 9 location directives, all braces balanced"
    - "do NOT move limit_req_zone or proxy_cache_path out of server scope — that's D-17, owner-action, in plan 08-09. This plan touches ONLY the brotli block, the SSE location, and the CSP header"
    - "the patched header line is long (CSP source-lists + report-uri + report-to) — keep it on one line per existing convention OR break across lines using nginx's continuation (each header line repeated). Existing file uses one giant line at line 39; keeping that style avoids visual diff churn"
  acceptance:
    - "test -f nginx-crialook.conf exits 0"
    - "grep -c 'BROTLI BLOCK START\\|### BROTLI' nginx-crialook.conf returns at least 1 (D-16 marker added)"
    - "grep -c 'proxy_request_buffering off' nginx-crialook.conf returns at least 1 (D-18)"
    - "grep -c 'report-uri /api/csp-report' nginx-crialook.conf returns at least 1 (D-08)"
    - "grep -c 'Reporting-Endpoints\\|report-to csp-endpoint' nginx-crialook.conf returns at least 1 (modern browsers)"
    - "grep -c 'Content-Security-Policy-Report-Only' nginx-crialook.conf returns at least 1 (still in report-only mode — flip is in plan 08-06's owner-action doc)"
    - "grep -c 'Content-Security-Policy[^-]\\|Content-Security-Policy$' nginx-crialook.conf returns 0 (NOT yet flipped to enforced — verify Report-Only suffix preserved)"
    - "grep -c 'csp-rollout.md\\|2 weeks\\|14 days' nginx-crialook.conf returns at least 1 (the flip-criteria pointer comment)"
    - "grep -c 'limit_req_zone' nginx-crialook.conf returns at least 2 (zones still in server scope — D-17 is owner-action elsewhere; this plan must not touch them)"
    - "grep -c '^server {' nginx-crialook.conf returns 2 (still 2 server blocks — http-redirect + main https server)"
    - "grep -c 'location /api/campaign/generate' nginx-crialook.conf returns at least 1 (location block intact)"
    - "node -e \"const c=require('fs').readFileSync('nginx-crialook.conf','utf8'); const o=(c.match(/{/g)||[]).length; const x=(c.match(/}/g)||[]).length; if(o!==x){console.error('UNBALANCED', o, x); process.exit(1)} else console.log('balanced', o)\" — exit 0 (braces balanced; sanity check that the patches didn't break structure)"
---

# Plan 08-02: nginx-crialook.conf — Brotli graceful fallback + SSE request buffering + CSP report-uri

## Objective

Per D-08 (CSP report endpoint), D-16 (Brotli graceful fallback), D-18 (SSE upload latency): patch the canonical nginx config so:
- A fresh distro without `libnginx-mod-http-brotli-filter` doesn't break `nginx -t` silently (D-16)
- The `/api/campaign/generate` SSE endpoint streams uploads to upstream immediately instead of buffering the full multipart body (D-18)
- CSP violations are reported to `/api/csp-report` (a same-origin endpoint added by plan 08-06) so the 2-week observation window (D-09..D-11) actually has data to observe

This plan touches **only** the canonical `nginx-crialook.conf` in the repo. The owner re-applies on the server via `nginx -t && systemctl reload nginx` (called out in `ops/deploy.md` from plan 08-09) — the deploy script already copies the canonical config to `/etc/nginx/sites-available/crialook` (`deploy-crialook.sh:172, 222`).

This plan does **NOT**:
- Move `limit_req_zone` and `proxy_cache_path` to `/etc/nginx/conf.d/crialook-zones.conf` — that's D-17 in plan 08-09 (owner-action because it requires creating a file in `/etc/nginx/conf.d/` on the server, not in the repo)
- Flip CSP from Report-Only to enforced — that's D-09/D-10 owner-action documented in plan 08-06 after 2 weeks zero-violation gate
- Alter CSP source-lists (`default-src`, `script-src`, etc.) — security review owns those

## Truths the executor must respect

- **The Brotli fallback is non-trivial in pure nginx config.** Module-load checks live in module-config scope, not server scope. Pragmatic approach: explicit BEGIN/END markers around the brotli block so an operator (or future tooling) can sed-strip it. The deploy script's existing warning about brotli install failure (line 163-164) tells the operator what to do; the markers in this plan tell them WHERE.
- **The CSP report-uri MUST be a relative path.** Don't put a Sentry direct-ingest URL in the nginx config (it commits the DSN public key to the repo). Plan 08-06 creates `POST /api/csp-report` in the Next.js app which forwards to Sentry server-side using `process.env.SENTRY_DSN` (already loaded). This keeps the DSN out of nginx-crialook.conf.
- **`report-to` is the modern CSP3 directive; `report-uri` is the deprecated-but-widely-supported one.** Both are needed for full coverage (Firefox/Safari still rely on report-uri). The `report-to` value references a group declared via the `Reporting-Endpoints` header (CSP3 superseded the older `Report-To` header, which is now legacy).
- **Don't break the existing CSP source-list.** The CSP header on line 39 is a long single line covering Clerk, Sentry, Mercado Pago, PostHog, Supabase, Fashn, etc. This plan ONLY appends `report-uri /api/csp-report; report-to csp-endpoint;` to the directive list; everything else stays byte-identical.
- **`proxy_request_buffering off`** is a single-line addition to the `/api/campaign/generate` location. Don't conflate with `proxy_buffering off` (which is RESPONSE-side, already present). Both are needed for full duplex streaming on a multipart upload + SSE response.
- **Verify brace balance.** The patched file MUST still have matched braces. Add a sanity check in the verification step (count `{` vs `}`).

## Tasks

### Task 1: Brotli graceful-fallback markers + header comment (D-16)

<read_first>
- nginx-crialook.conf (FULL FILE — to see the brotli block at lines 57-72 and surrounding context)
- deploy-crialook.sh (lines 161-164 — the existing brotli install attempt with non-fatal warning)
- .planning/phases/08-ops-deploy-hardening/08-CONTEXT.md (D-16)
</read_first>

<action>
Find the existing brotli block at lines 57-72 of `nginx-crialook.conf`:
```
    # Brotli (requer libnginx-mod-http-brotli-filter instalado)
    # Instalar: apt install libnginx-mod-http-brotli-filter libnginx-mod-http-brotli-static
    brotli on;
    brotli_static on;
    brotli_comp_level 5;
    brotli_min_length 256;
    brotli_types
        text/plain
        ...
        font/woff2;
```

Replace with:
```
    # ─────────────────────────────────────────────────────────────────
    # ### BROTLI BLOCK START ###
    # Requires libnginx-mod-http-brotli-filter + libnginx-mod-http-brotli-static.
    #
    # GRACEFUL FALLBACK (D-16): if the modules are NOT installed,
    #   `nginx -t` will fail with "unknown directive 'brotli'".
    # In that case:
    #   1. Try install: `apt install libnginx-mod-http-brotli-filter libnginx-mod-http-brotli-static && systemctl restart nginx`
    #   2. If unavailable on this distro: comment out (or sed-strip) every
    #      line between BROTLI BLOCK START / BROTLI BLOCK END, then
    #      `nginx -t && systemctl reload nginx`. gzip (above) still gives ~80%
    #      of brotli's compression on text — losing brotli is graceful, not catastrophic.
    # ─────────────────────────────────────────────────────────────────
    brotli on;
    brotli_static on;
    brotli_comp_level 5;
    brotli_min_length 256;
    brotli_types
        text/plain
        text/css
        text/javascript
        application/javascript
        application/json
        application/xml
        application/xml+rss
        image/svg+xml
        font/woff2;
    # ### BROTLI BLOCK END ###
```

Reasoning: the markers are deterministic anchors. A future tooling pass (or a manual operator) can run `sed -i '/### BROTLI BLOCK START ###/,/### BROTLI BLOCK END ###/d'` to remove the entire block in one step. The header comment surfaces the install command and the fallback decision tree.
</action>

<verify>
```bash
grep -c '### BROTLI BLOCK START' nginx-crialook.conf   # expect 1
grep -c '### BROTLI BLOCK END' nginx-crialook.conf     # expect 1
grep -c 'brotli on' nginx-crialook.conf                # expect 1 (still present, unchanged content)
grep -c 'brotli_types' nginx-crialook.conf             # expect 1
```
</verify>

### Task 2: Add proxy_request_buffering off to the SSE location (D-18)

<read_first>
- nginx-crialook.conf (lines 127-144 — the /api/campaign/generate location block)
- .planning/phases/08-ops-deploy-hardening/08-CONTEXT.md (D-18)
- .planning/audits/MONOREPO-BUG-BASH.md M-13 (the why behind this fix — multipart upload latency)
</read_first>

<action>
Find the `/api/campaign/generate` block (currently lines 127-144). The current block has:
```
    location /api/campaign/generate {
        limit_req zone=api_limit burst=5 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        # FIX: sobrescrever X-Forwarded-For para impedir spoofing de IP
        # (era $proxy_add_x_forwarded_for, que acrescenta o header do cliente)
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        client_max_body_size 25M;
        chunked_transfer_encoding on;
    }
```

Insert `proxy_request_buffering off;` immediately after the existing `proxy_buffering off;` line so both buffering directives are visually grouped:

```
        proxy_buffering off;
        # D-18 / M-13: stream multipart upload to upstream immediately so the
        # SSE response can start within ~200ms instead of waiting for the full
        # body to land on disk. proxy_buffering=off is response-side; this is
        # request-side. Pair required for true duplex streaming.
        proxy_request_buffering off;
        proxy_cache off;
```
</action>

<verify>
```bash
grep -c 'proxy_request_buffering off' nginx-crialook.conf   # expect 1
grep -A 2 'proxy_buffering off' nginx-crialook.conf | grep -c 'proxy_request_buffering off'  # expect 1 (adjacent placement)
```
</verify>

### Task 3: Add CSP report-uri + report-to + Reporting-Endpoints header (D-08)

<read_first>
- nginx-crialook.conf (line 38-39 — the comment 'CSP em report-only primeiro' and the giant CSP header line)
- .planning/phases/08-ops-deploy-hardening/08-CONTEXT.md (D-08, D-09, D-10, D-11)
</read_first>

<action>
Find the current CSP block (lines 38-39):
```
    # CSP em report-only primeiro; remover Report-Only quando validado
    add_header Content-Security-Policy-Report-Only "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://clerk.crialook.com.br https://*.posthog.com https://js.sentry-cdn.com https://sdk.mercadopago.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.clerk.accounts.dev https://clerk.crialook.com.br https://api.mercadopago.com https://*.posthog.com https://*.sentry.io https://api.fashn.ai; img-src 'self' data: blob: https://*.supabase.co https://*.pravatar.cc https://secure.mlstatic.com; style-src 'self' 'unsafe-inline'; font-src 'self' data:; frame-src https://*.mercadopago.com https://*.mercadolivre.com https://*.clerk.accounts.dev; object-src 'none'; base-uri 'self'; form-action 'self';" always;
```

Replace with (note: the CSP source-list value is unchanged byte-for-byte — only `report-uri` and `report-to` are appended at the end before the closing `";`):

```
    # ── CSP (D-08..D-11) ──
    # Mode: Content-Security-Policy-Report-Only.
    # Flip to enforced (drop "-Report-Only" suffix) ONLY after 2 weeks of
    # zero violations in Sentry. See ops/csp-rollout.md for the criteria + flip procedure.
    # Reports land at /api/csp-report (same-origin endpoint, forwards to Sentry server-side).
    add_header Reporting-Endpoints "csp-endpoint=\"/api/csp-report\"" always;
    add_header Content-Security-Policy-Report-Only "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://clerk.crialook.com.br https://*.posthog.com https://js.sentry-cdn.com https://sdk.mercadopago.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.clerk.accounts.dev https://clerk.crialook.com.br https://api.mercadopago.com https://*.posthog.com https://*.sentry.io https://api.fashn.ai; img-src 'self' data: blob: https://*.supabase.co https://*.pravatar.cc https://secure.mlstatic.com; style-src 'self' 'unsafe-inline'; font-src 'self' data:; frame-src https://*.mercadopago.com https://*.mercadolivre.com https://*.clerk.accounts.dev; object-src 'none'; base-uri 'self'; form-action 'self'; report-uri /api/csp-report; report-to csp-endpoint;" always;
```

Reasoning:
- `Reporting-Endpoints` is the modern (CSP Level 3) replacement for the older `Report-To` header. Browsers parse this and group reports for delivery.
- `report-to csp-endpoint` references the group from `Reporting-Endpoints`. Modern Chrome/Edge use this.
- `report-uri /api/csp-report` is the legacy directive Firefox + Safari still rely on. Both are appended; modern browsers ignore the legacy one when `report-to` is present.
- The path `/api/csp-report` is relative — same-origin POST. Plan 08-06 implements the route handler; until that lands, browsers will get 404 on the report POST, which is harmless (the page still loads; only the report POST fails).
</action>

<verify>
```bash
grep -c 'report-uri /api/csp-report' nginx-crialook.conf       # expect 1
grep -c 'report-to csp-endpoint' nginx-crialook.conf            # expect 1
grep -c 'Reporting-Endpoints' nginx-crialook.conf               # expect 1
grep -c 'Content-Security-Policy-Report-Only' nginx-crialook.conf  # expect 1 (still in report-only mode)
grep -c 'csp-rollout.md' nginx-crialook.conf                    # expect 1 (flip-criteria pointer)
# Verify the existing source-list is unchanged byte-for-byte (clerk, supabase, mercadopago, etc.)
grep -c "https://\\*.clerk.accounts.dev" nginx-crialook.conf    # expect 4 (script-src, connect-src, frame-src, Reporting-Endpoints if any — but only 3 actual CSP source-list mentions)
grep -c "wss://\\*.supabase.co" nginx-crialook.conf             # expect 1 (connect-src — must be preserved)
```
</verify>

### Task 4: Sanity check — brace balance + structural invariants

<read_first>
- nginx-crialook.conf (FULL FILE post-patches)
</read_first>

<action>
Run a brace-balance check on the patched file. This is a verification task, not an edit task — but if the count is off, the executor must locate the imbalance and correct it (likely cause: an unclosed comment block or a copy/paste error from one of the previous tasks).

```bash
node -e "
const fs = require('fs');
const c = fs.readFileSync('nginx-crialook.conf', 'utf8');
const open = (c.match(/\\{/g) || []).length;
const close = (c.match(/\\}/g) || []).length;
console.log('open=' + open + ' close=' + close);
if (open !== close) {
  console.error('UNBALANCED BRACES — investigate diff');
  process.exit(1);
}
console.log('OK — braces balanced');
"
```

Also count the structural invariants:
- 2 `server {` blocks (HTTP redirect + HTTPS main)
- 9 `location` directives
- 2 `limit_req_zone` directives (still in server scope — D-17 not yet applied)
- 1 `proxy_cache_path` directive (still in server scope)

If any count is off, the patches from Tasks 1-3 broke structure. Investigate via `git diff nginx-crialook.conf`.
</action>

<verify>
```bash
node -e "const c=require('fs').readFileSync('nginx-crialook.conf','utf8');const o=(c.match(/{/g)||[]).length;const x=(c.match(/}/g)||[]).length;console.log('open',o,'close',x);if(o!==x)process.exit(1)" && echo BALANCED

grep -c '^server {' nginx-crialook.conf         # expect 2
grep -c '    location ' nginx-crialook.conf     # expect ≥ 9
grep -c 'limit_req_zone' nginx-crialook.conf    # expect 2 (preserved — D-17 is owner-action elsewhere)
grep -c 'proxy_cache_path' nginx-crialook.conf  # expect 1
```

**If you have docker available locally** (optional, recommended):
```bash
docker run --rm -v "$PWD/nginx-crialook.conf":/etc/nginx/conf.d/test.conf:ro nginx:latest nginx -t
# Expected: PASS if Brotli not used (it isn't in the bare nginx image), OR fail with "unknown directive 'brotli'"
# A "unknown directive 'brotli'" failure here is EXPECTED and validates D-16's marker rationale —
# in production, the brotli modules ARE installed (per deploy-crialook.sh:163), so this is fine.
```
</verify>

## Files modified

- `nginx-crialook.conf` — Brotli BEGIN/END markers + header comment (Task 1); proxy_request_buffering off + comment (Task 2); CSP report-uri + report-to + Reporting-Endpoints header + flip-criteria pointer comment (Task 3)

## Owner-action callout (re-apply on server)

After this plan merges, the OWNER must re-apply the canonical config on the production server:

```bash
# On the VPS, as root or DEPLOY_USER:
cd $PROJECT_DIR
git pull
cp nginx-crialook.conf /etc/nginx/sites-available/crialook
nginx -t && systemctl reload nginx
```

This is the same pattern documented at `deploy-crialook.sh:172, 222` and is also called out in plan 08-09's `ops/deploy.md`. The deploy-crialook.sh full re-run also does this (it copies the canonical config), so a normal deploy after merge will apply the patches automatically.

## Why this matters (risk if skipped)

- **D-08:** Without `report-uri`, the existing `Content-Security-Policy-Report-Only` header is paying for parse cost with zero observability. The 2-week zero-violation gate (D-09..D-11) cannot start until reports flow.
- **D-16:** A fresh distro deploy without brotli modules silently produces a broken `nginx -t` and the deploy claims success while serving stale config (or worse, no config). The markers + comments give the operator a clear path forward.
- **D-18:** The current SSE upload latency is bottlenecked by nginx full-body buffering. A 5MB image upload to `/api/campaign/generate` waits for nginx to spool the entire body before forwarding — adding hundreds of ms to user-perceived "generation start". This single line is the highest-impact perf fix in P8.
