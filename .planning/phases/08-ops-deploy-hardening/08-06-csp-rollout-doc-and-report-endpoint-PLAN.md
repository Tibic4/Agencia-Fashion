---
plan_id: 08-06
phase: 8
title: CSP rollout — /api/csp-report endpoint + ops/csp-rollout.md owner-action doc with 2-week zero-violation gate (D-08, D-09, D-10, D-11)
wave: 1
depends_on: []
owner_action: false
files_modified:
  - campanha-ia/src/app/api/csp-report/route.ts
  - ops/csp-rollout.md
autonomous: true
requirements: ["D-08", "D-09", "D-10", "D-11"]
must_haves:
  truths:
    - "create /api/csp-report Next.js route handler at campanha-ia/src/app/api/csp-report/route.ts that accepts POST with content-type 'application/csp-report' OR 'application/json' OR 'application/reports+json' (the modern Reporting API uses the latter)"
    - "endpoint MUST be POST-only (other methods → 405) — no GET, no OPTIONS preflight (CORS not relevant for same-origin reports)"
    - "endpoint parses the JSON body defensively: legacy CSP-1 reports have shape {csp-report: {document-uri, violated-directive, blocked-uri, effective-directive, original-policy, source-file, line-number, column-number, status-code}}; modern Reporting API has shape [{type: 'csp-violation', body: {documentURL, blockedURL, effectiveDirective, originalPolicy, ...}}]. Handle both"
    - "endpoint forwards each violation to Sentry via Sentry.captureMessage with level='warning', tags={csp_violation: 'true', directive: <effective-directive>, blocked: <blocked-uri-host-only>}, and extra={full violation body}. The Sentry server config (sentry.server.config.ts) is already loaded — just import * as Sentry from '@sentry/nextjs' and call captureMessage"
    - "endpoint returns 204 No Content on success (browsers don't read the response body for report POSTs; 204 is the canonical response). On parse error: 400 with no body"
    - "endpoint MUST be exempt from rate-limit middleware (csp violation reports can come in bursts during a page load — rate-limiting them would lose data). The existing rate-limit middleware doesn't auto-cover all routes; verify by reading middleware.ts (likely just covers /api/campaign and /api/webhooks). If middleware DOES cover /api/csp-report, add an exclusion"
    - "endpoint MUST log to console at INFO level a one-liner per violation: '[csp-report] violation: directive=X blocked=Y document=Z' — so even before Sentry quota exhaustion, ops can grep PM2 logs for violations"
    - "endpoint must NOT crash on malformed bodies (browsers historically send weird shapes, especially older Safari) — wrap parse + Sentry call in try/catch; on error, log a warn and return 204 (don't 400 because the browser will retry, and we don't want to encourage retry — silently swallow malformed and move on)"
    - "endpoint MUST be force-dynamic (revalidate=0, dynamic='force-dynamic') because every request is unique — Next.js shouldn't cache it"
    - "ops/csp-rollout.md is an OWNER-ACTION doc structured for the owner to (a) monitor Sentry for 2 weeks, (b) decide whether to flip Report-Only → enforced, (c) execute the single nginx edit + reload"
    - "ops/csp-rollout.md MUST include: 1) header explaining the rollout phases, 2) Sentry filter to find CSP reports (project, level=warning, tag csp_violation=true), 3) the exact 2-week zero-violation criterion (D-09: 'zero violations across all directives in a continuous 14-day window'), 4) the flip procedure (the 1-character nginx edit), 5) the rollback procedure (re-add '-Report-Only' suffix), 6) the re-trigger criterion (D-11: any violation post-flip restarts the 14-day clock — IF still in observation; once enforced, violations are noise unless they break a real user)"
    - "ops/csp-rollout.md flip procedure MUST cite exact file path (nginx-crialook.conf line ~39 in repo + /etc/nginx/sites-available/crialook on server) and the exact sed command: 'sudo sed -i s/Content-Security-Policy-Report-Only/Content-Security-Policy/ /etc/nginx/sites-available/crialook && sudo nginx -t && sudo systemctl reload nginx'"
    - "ops/csp-rollout.md MUST include a checklist the owner ticks at flip time (verifies all 4 prerequisites before flip)"
    - "Sentry forwarding does NOT require new env var — process.env.SENTRY_DSN is already loaded by sentry.server.config.ts on boot; the captureMessage call uses the already-initialized client"
    - "the route handler must NOT require authentication — CSP reports are POST'd by browsers without credentials; gating with Clerk would drop all reports. Confirm middleware.ts allows /api/csp-report through (it currently allows /api/health and /api/webhooks/* without auth — same pattern)"
    - "test (at minimum a smoke test): a vitest at csp-report.test.ts that POSTs a sample legacy + modern report payload and asserts 204 + Sentry.captureMessage called once per payload (mock Sentry)"
  acceptance:
    - "test -f campanha-ia/src/app/api/csp-report/route.ts exits 0"
    - "grep -c 'export async function POST' campanha-ia/src/app/api/csp-report/route.ts returns at least 1"
    - "grep -c 'Sentry.captureMessage\\|captureMessage' campanha-ia/src/app/api/csp-report/route.ts returns at least 1"
    - "grep -c 'csp_violation\\|csp-violation' campanha-ia/src/app/api/csp-report/route.ts returns at least 1"
    - "grep -c 'force-dynamic' campanha-ia/src/app/api/csp-report/route.ts returns at least 1"
    - "grep -c 'application/csp-report\\|application/reports' campanha-ia/src/app/api/csp-report/route.ts returns at least 1 (handles both content-types)"
    - "grep -c '204\\|NextResponse.*status.*204' campanha-ia/src/app/api/csp-report/route.ts returns at least 1"
    - "test -f ops/csp-rollout.md exits 0"
    - "wc -l ops/csp-rollout.md returns at least 80 (real doc, not a stub)"
    - "grep -c '^## ' ops/csp-rollout.md returns at least 5 (multiple sections)"
    - "grep -ic '14 day\\|14-day\\|2 week\\|2-week\\|two week' ops/csp-rollout.md returns at least 2 (D-09 timing)"
    - "grep -c 'sudo sed\\|sed -i' ops/csp-rollout.md returns at least 1 (exact flip command per D-10)"
    - "grep -c 'systemctl reload nginx\\|nginx -t' ops/csp-rollout.md returns at least 1 (post-flip verification)"
    - "grep -c '- \\[ \\]' ops/csp-rollout.md returns at least 4 (owner checklist)"
    - "grep -c 'rollback\\|revert\\|re-add.*-Report-Only' ops/csp-rollout.md returns at least 1 (rollback procedure)"
    - "cd campanha-ia && npx tsc --noEmit exits 0 (route handler typechecks)"
    - "cd campanha-ia && npm test -- --run --no-coverage src/app/api/csp-report 2>/dev/null || npm test -- --run --no-coverage 2>&1 | tail -5 — exits 0 (smoke test passes if added; otherwise full suite still passes)"
---

# Plan 08-06: CSP rollout — /api/csp-report endpoint + ops/csp-rollout.md owner-action doc

## Objective

Per D-08..D-11: complete the CSP observability loop so the Report-Only header from plan 08-02 actually feeds Sentry, and document the owner-action flip procedure (after 2 weeks zero-violation gate).

Two deliverables:
1. **`campanha-ia/src/app/api/csp-report/route.ts`** — same-origin POST endpoint that browsers send CSP violation reports to. Forwards each violation to Sentry as a warning-level message with structured tags. Same-origin keeps the Sentry DSN out of the nginx config (which is committed to the repo).
2. **`ops/csp-rollout.md`** — owner-facing markdown doc with the 14-day zero-violation criterion, the exact sed command to flip Report-Only → enforced, and a 4-item checklist the owner ticks before flipping.

After this plan + plan 08-02 land:
- Browsers POST violations to `/api/csp-report` → Sentry sees them
- Owner monitors Sentry for 14 days
- Owner runs the documented flip command
- nginx reloads with enforced CSP
- Owner re-runs the 14-day window if any violation appears after the flip

## Truths the executor must respect

- **Endpoint is unauthenticated.** Browsers don't send credentials with CSP report POSTs. Gating with Clerk would drop all reports. Verify the existing `middleware.ts` allows `/api/csp-report` through — same pattern as `/api/health` and `/api/webhooks/*`.
- **Endpoint is POST-only, returns 204.** GET → 405. Browsers don't read the response body; 204 No Content is canonical. Errors swallow silently as 204 too (don't 400 or browsers will retry; we don't want retry storms).
- **Two payload shapes supported.** Legacy CSP-1: `{csp-report: {document-uri, violated-directive, blocked-uri, ...}}`. Modern Reporting API: `[{type: 'csp-violation', body: {documentURL, blockedURL, effectiveDirective, ...}}]`. Both content-types: `application/csp-report` (legacy) and `application/reports+json` (modern). Plus plain `application/json` as a fallback (some browsers send this).
- **Sentry forwarding uses the already-loaded server client.** `sentry.server.config.ts` runs at boot via `instrumentation.ts:18`. `Sentry.captureMessage(...)` from `@sentry/nextjs` uses the singleton — no init needed in the route handler.
- **No DSN in nginx config.** The whole point of routing reports through `/api/csp-report` is to keep the Sentry DSN public key out of `nginx-crialook.conf` (which is in the repo). The endpoint reads `SENTRY_DSN` from env (already loaded) — no env var addition.
- **Tags are searchable in Sentry.** Use `tags: { csp_violation: 'true', directive: <effective-directive>, blocked: <host-only> }` so the owner can filter Sentry's UI to "csp_violation:true AND directive:script-src" etc. Keep the blocked URI to host-only (strip path/query) — a full URL would explode the tag cardinality.
- **The doc is the owner contract.** `ops/csp-rollout.md` is what the owner reads at flip time. It must be self-contained — they shouldn't need to ssh in and grep the codebase to find the exact command.

## Tasks

### Task 1: Implement /api/csp-report POST endpoint

<read_first>
- campanha-ia/src/app/api/health/route.ts (as a Next.js route handler reference — same project conventions: NextRequest/NextResponse, force-dynamic, revalidate=0)
- campanha-ia/sentry.server.config.ts (confirm Sentry is initialized at boot; the route handler can just import @sentry/nextjs and call captureMessage)
- campanha-ia/src/middleware.ts (verify which routes are auth-exempt; /api/csp-report MUST be exempt — pattern-match against /api/health and /api/webhooks/*)
- nginx-crialook.conf (post-08-02 patches — confirm /api/csp-report is reachable via the catch-all 'location /' since there's no specific location block for it)
- .planning/phases/08-ops-deploy-hardening/08-CONTEXT.md (D-08, D-09, D-10, D-11)
</read_first>

<action>
Create the directory + file: `campanha-ia/src/app/api/csp-report/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * POST /api/csp-report
 *
 * Receives CSP violation reports from browsers (Report-Only mode initially per
 * D-09; flipped to enforced after 14-day zero-violation gate per ops/csp-rollout.md).
 * Forwards each violation to Sentry as a warning-level message with structured
 * tags so ops can filter the Sentry UI by directive, blocked host, etc.
 *
 * Browsers send POST requests with one of three content-types:
 *   - application/csp-report           (legacy CSP-1)
 *   - application/reports+json         (modern Reporting API)
 *   - application/json                 (fallback some browsers use)
 *
 * Two payload shapes:
 *   - Legacy: { "csp-report": { "document-uri", "violated-directive", "blocked-uri", ... } }
 *   - Modern: [ { "type": "csp-violation", "body": { "documentURL", "blockedURL", "effectiveDirective", ... } } ]
 *
 * Always returns 204. Parse errors swallow silently (don't 400 — browsers retry,
 * and we don't want retry storms). DSN comes from SENTRY_DSN env, already
 * loaded by instrumentation.ts.
 *
 * D-08 / Phase 8 plan 08-06.
 */

type LegacyCspReport = {
  "csp-report"?: {
    "document-uri"?: string;
    "violated-directive"?: string;
    "effective-directive"?: string;
    "blocked-uri"?: string;
    "original-policy"?: string;
    "source-file"?: string;
    "line-number"?: number;
    "column-number"?: number;
    "status-code"?: number;
    referrer?: string;
  };
};

type ModernCspReport = {
  type: string;
  body?: {
    documentURL?: string;
    referrer?: string;
    blockedURL?: string;
    effectiveDirective?: string;
    originalPolicy?: string;
    sourceFile?: string;
    lineNumber?: number;
    columnNumber?: number;
    statusCode?: number;
    disposition?: "enforce" | "report";
  };
};

function hostOf(uri: string | undefined | null): string {
  if (!uri) return "unknown";
  try {
    return new URL(uri).host || "unknown";
  } catch {
    // blocked-uri can be 'inline', 'eval', 'data', 'self', or other non-URL keywords
    return uri.length > 100 ? uri.slice(0, 100) + "..." : uri;
  }
}

function reportLegacyToSentry(report: LegacyCspReport["csp-report"]): void {
  if (!report) return;
  const directive = report["effective-directive"] || report["violated-directive"] || "unknown";
  const blocked = hostOf(report["blocked-uri"]);
  const document = hostOf(report["document-uri"]);
  console.info(
    `[csp-report] violation: directive=${directive} blocked=${blocked} document=${document}`,
  );
  Sentry.captureMessage(`CSP violation: ${directive}`, {
    level: "warning",
    tags: {
      csp_violation: "true",
      directive,
      blocked,
    },
    extra: { ...report },
  });
}

function reportModernToSentry(report: ModernCspReport): void {
  const body = report.body;
  if (!body) return;
  const directive = body.effectiveDirective || "unknown";
  const blocked = hostOf(body.blockedURL);
  const document = hostOf(body.documentURL);
  console.info(
    `[csp-report] violation (modern): directive=${directive} blocked=${blocked} document=${document} disposition=${body.disposition ?? "report"}`,
  );
  Sentry.captureMessage(`CSP violation: ${directive}`, {
    level: "warning",
    tags: {
      csp_violation: "true",
      directive,
      blocked,
      disposition: body.disposition ?? "report",
    },
    extra: { ...body },
  });
}

export async function POST(req: NextRequest) {
  try {
    const text = await req.text();
    if (!text) {
      return new NextResponse(null, { status: 204 });
    }
    const parsed: unknown = JSON.parse(text);

    if (Array.isArray(parsed)) {
      // Modern Reporting API — array of report objects
      for (const item of parsed) {
        const report = item as ModernCspReport;
        if (report?.type === "csp-violation") {
          reportModernToSentry(report);
        }
      }
    } else if (parsed && typeof parsed === "object" && "csp-report" in parsed) {
      // Legacy CSP-1 — single object with "csp-report" wrapper
      reportLegacyToSentry((parsed as LegacyCspReport)["csp-report"]);
    }
    // Anything else: silently ignore (don't crash on shapes we don't recognize)
  } catch (err) {
    // Defensive: malformed body, JSON parse error, Sentry call failure.
    // Log warn + return 204 anyway — never 4xx/5xx to a browser-driven report POST.
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[csp-report] parse error (swallowed): ${msg}`);
  }

  return new NextResponse(null, { status: 204 });
}

export async function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
```

Reasoning:
- TypeScript types `LegacyCspReport` and `ModernCspReport` document both payload shapes for future maintainers.
- `hostOf()` strips full URIs to host-only for tag cardinality control. `'inline'`, `'eval'`, `'data'` keywords pass through as-is (they're meaningful in CSP context).
- Always returns 204 — never 4xx to browsers (avoids retry storms).
- Console.info per violation gives ops a PM2-log fallback if Sentry is down or quota-exhausted.
- The `extra` field preserves the full violation body for deep inspection in Sentry's UI.
- Explicit `GET → 405` so the endpoint signals method-not-allowed cleanly (Next.js would otherwise 404 GET on a POST-only handler — minor improvement).
</action>

<verify>
```bash
test -f campanha-ia/src/app/api/csp-report/route.ts && echo OK
grep -c 'export async function POST' campanha-ia/src/app/api/csp-report/route.ts   # expect 1
grep -c 'Sentry.captureMessage' campanha-ia/src/app/api/csp-report/route.ts       # expect 2 (legacy + modern handlers)
grep -c 'csp_violation' campanha-ia/src/app/api/csp-report/route.ts               # expect ≥ 2
grep -c '204' campanha-ia/src/app/api/csp-report/route.ts                          # expect ≥ 3 (success + empty + error paths)
grep -c 'force-dynamic' campanha-ia/src/app/api/csp-report/route.ts               # expect 1
cd campanha-ia && npx tsc --noEmit && echo TYPECHECK_OK
```
</verify>

### Task 2: Verify middleware.ts allows /api/csp-report through unauthenticated

<read_first>
- campanha-ia/src/middleware.ts (FULL FILE — to find the publicRoutes / matcher pattern)
</read_first>

<action>
Open `campanha-ia/src/middleware.ts`. Find the Clerk middleware config (typically `clerkMiddleware` from `@clerk/nextjs/server` with a `publicRoutes` array OR a `matcher` config that excludes certain paths from auth).

Likely shape (one of these patterns):
```typescript
export default clerkMiddleware((auth, req) => {
  // ...
});

export const config = {
  matcher: [
    '/((?!_next|api/health|api/webhooks|api/csp-report|.*\\..*).*)',
    '/(api|trpc)(.*)',
  ],
};
```

OR the `clerkMiddleware` has a `publicRoutes` list:
```typescript
export default clerkMiddleware((auth, req) => {
  if (req.url.includes('/api/health') || req.url.includes('/api/webhooks/') || req.url.includes('/api/csp-report')) {
    return; // unauthenticated
  }
  // ...
});
```

The executor must:
1. Read the existing middleware
2. Identify the pattern used to exempt `/api/health` from auth (it MUST be auth-exempt today — public endpoint)
3. Apply the IDENTICAL pattern to `/api/csp-report`

If `/api/csp-report` is already covered by the existing exemption (e.g., a wildcard that includes it), no change needed — verify and document.

If a change is needed, the modification is a 1-line addition (extending the path list or regex).

**Note:** if the executor finds the middleware uses a regex that already exempts `/api/*` (rather than an explicit allowlist), `/api/csp-report` is already auth-exempt and this task is a no-op verification. Document the finding either way.
</action>

<verify>
```bash
# Verify the middleware doesn't 401 the endpoint:
grep -c 'csp-report' campanha-ia/src/middleware.ts || echo "NOT EXPLICITLY LISTED — verify pattern"

# Functional verification (requires a running dev server):
# cd campanha-ia && npm run dev &
# DEV_PID=$!
# sleep 5
# curl -X POST -H 'Content-Type: application/csp-report' -d '{"csp-report":{"violated-directive":"script-src","blocked-uri":"inline"}}' http://localhost:3000/api/csp-report -o /dev/null -w '%{http_code}\n'
# Expected: 204
# kill $DEV_PID
# (Skip if no local dev server — type-check is sufficient evidence)
```
</verify>

### Task 3: Add a smoke test for the route handler

<read_first>
- campanha-ia/src/app/api/health/route.ts (route handler reference)
- campanha-ia/src/app/api/campaign/generate/__tests__ or similar (find an existing route-handler test as a pattern reference; if none exists, the executor writes the simplest possible direct handler-call test)
- vitest.config.ts (to confirm test discovery patterns)
</read_first>

<action>
Create `campanha-ia/src/app/api/csp-report/route.test.ts` with a smoke test:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Sentry BEFORE importing the route handler (handler imports Sentry at module load)
vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
}));

import * as Sentry from "@sentry/nextjs";
import { POST, GET } from "./route";

describe("/api/csp-report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 204 + forwards legacy CSP-1 report to Sentry", async () => {
    const body = {
      "csp-report": {
        "document-uri": "https://crialook.com.br/",
        "violated-directive": "script-src",
        "effective-directive": "script-src",
        "blocked-uri": "https://evil.example.com/x.js",
      },
    };
    const req = new Request("http://localhost/api/csp-report", {
      method: "POST",
      headers: { "Content-Type": "application/csp-report" },
      body: JSON.stringify(body),
    });

    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(204);
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining("script-src"),
      expect.objectContaining({
        level: "warning",
        tags: expect.objectContaining({ csp_violation: "true", directive: "script-src" }),
      }),
    );
  });

  it("returns 204 + forwards modern Reporting API array to Sentry", async () => {
    const body = [
      {
        type: "csp-violation",
        body: {
          documentURL: "https://crialook.com.br/",
          blockedURL: "https://evil.example.com/x.js",
          effectiveDirective: "script-src",
          disposition: "report",
        },
      },
    ];
    const req = new Request("http://localhost/api/csp-report", {
      method: "POST",
      headers: { "Content-Type": "application/reports+json" },
      body: JSON.stringify(body),
    });

    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(204);
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
  });

  it("returns 204 + swallows malformed body silently (no Sentry call)", async () => {
    const req = new Request("http://localhost/api/csp-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json{{{",
    });

    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(204);
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it("returns 204 on empty body (no Sentry call)", async () => {
    const req = new Request("http://localhost/api/csp-report", {
      method: "POST",
      headers: { "Content-Type": "application/csp-report" },
      body: "",
    });

    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(204);
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it("returns 405 on GET", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("POST");
  });
});
```

Reasoning:
- Mock Sentry at module-load via `vi.mock` (BEFORE the route handler imports it). This is the standard vitest pattern.
- 5 cases cover: legacy shape, modern shape, malformed body (silently 204), empty body (silently 204), method-not-allowed (GET → 405).
- The cast `as unknown as Parameters<typeof POST>[0]` works around Next.js's NextRequest extending Request — the handler only uses `.text()` which is on the base Request prototype.
</action>

<verify>
```bash
test -f campanha-ia/src/app/api/csp-report/route.test.ts && echo OK
cd campanha-ia && npm test -- --run --no-coverage src/app/api/csp-report 2>&1 | tail -10
# Expected: 5 passed (or all passed)
```
</verify>

### Task 4: Author ops/csp-rollout.md owner-action doc

<read_first>
- nginx-crialook.conf (line 39 area — the CSP header to confirm the exact directive string the owner will sed against)
- .planning/phases/08-ops-deploy-hardening/08-CONTEXT.md (D-08, D-09, D-10, D-11)
- ops/health-check.sh (read for tone/style — terse, command-block-heavy)
- .planning/phases/07-play-compliance-and-ux-completeness/07-04-play-data-safety-doc-PLAN.md (for owner-action-doc structure pattern)
</read_first>

<action>
Create `ops/csp-rollout.md`:

```markdown
# CSP Rollout — Report-Only → Enforced (Owner Action)

**Phase 8 plan 08-06 (D-08..D-11).** Decision authority: owner.

This doc is the operating manual for transitioning the CriaLook nginx CSP header from `Content-Security-Policy-Report-Only` to enforced `Content-Security-Policy`. The transition is OWNER ACTION — single nginx edit + reload; not automatable from the codebase.

---

## Context

`nginx-crialook.conf` ships the CSP header in **Report-Only** mode (per plan 08-02). Browsers compute violations against the policy but do NOT block resources — they POST a violation report to `/api/csp-report` (this same Phase 8 plan), which forwards to Sentry as a `warning`-level message with `tag: csp_violation=true`.

The 2-week zero-violation observation window (D-09) exists because:
- The CSP source-list covers Clerk, Sentry, Mercado Pago, PostHog, Supabase, Fashn, plus inline scripts/styles. Any one of them shipping a new CDN URL or migrating to a different host would trigger a violation. Enforcement BEFORE 2 weeks risks breaking auth, payments, or analytics in production.
- A continuous 14-day zero-violation window across all directives is empirical proof the source-list is complete enough to enforce.

---

## Phase 0 — Verify the report endpoint is alive

Before starting the observation window, confirm `/api/csp-report` is wired correctly:

```bash
# From any machine that can reach crialook.com.br:
curl -X POST \
  -H 'Content-Type: application/csp-report' \
  -d '{"csp-report":{"document-uri":"https://crialook.com.br/","violated-directive":"script-src","effective-directive":"script-src","blocked-uri":"https://test.example.com/x.js"}}' \
  https://crialook.com.br/api/csp-report \
  -o /dev/null -w 'HTTP %{http_code}\n'
# Expected: HTTP 204
```

Then check Sentry → search for `csp_violation:true directive:script-src blocked:test.example.com` — should see the test report within ~30s.

If the test report doesn't appear in Sentry: troubleshoot before starting observation. Likely causes:
- `SENTRY_DSN` env not loaded on server → check `pm2 logs crialook | grep '\[boot\] env loaded'`
- Endpoint returning 401 → middleware.ts not exempting `/api/csp-report` (verify the auth-exempt pattern matches `/api/health`)
- Sentry quota exhausted → check Sentry billing

---

## Phase 1 — Observation window (14 days)

Mark the start date in this doc:

- [ ] **Observation start date:** ____________ (YYYY-MM-DD)
- [ ] **Observation end date:** ____________ (start + 14 days, inclusive)

During the window, monitor Sentry daily:

```
Sentry filter:
  project: crialook (or your project name)
  level: warning
  tag: csp_violation:true
  date: last 24h
```

For each violation that appears:
1. Triage: is the blocked URL a legitimate dependency that should be added to the CSP source-list, or is it actually a security concern (XSS attempt, malicious script injection)?
2. If legitimate: add the host to the appropriate directive in `nginx-crialook.conf` (e.g., `script-src` or `connect-src`), commit + deploy + restart the 14-day clock (D-11).
3. If genuine attack: investigate. CSP-Report-Only is doing its job by surfacing the attempt; the user is unaffected.

**D-11 re-trigger:** ANY violation during the window resets the 14-day clock. The criterion is **continuous** zero-violation, not "low rate".

---

## Phase 2 — Pre-flip checklist (owner ticks ALL before flipping)

- [ ] 14 continuous days of zero CSP violations in Sentry confirmed
- [ ] No new third-party integrations added in the past 14 days (Clerk SDK update, new analytics tool, new payment provider, etc.) — if added, observation window restarts
- [ ] `/api/csp-report` endpoint health verified (Phase 0 test re-run within last 24h returns 204)
- [ ] Backup of current `/etc/nginx/sites-available/crialook` taken: `sudo cp /etc/nginx/sites-available/crialook /etc/nginx/sites-available/crialook.pre-csp-flip.$(date +%Y%m%d)`

---

## Phase 3 — Flip Report-Only → enforced

Single nginx edit + reload. Run on the production VPS as root or DEPLOY_USER:

```bash
# 1. Edit the directive in /etc/nginx/sites-available/crialook (1-character change in the header name)
sudo sed -i 's/Content-Security-Policy-Report-Only/Content-Security-Policy/' /etc/nginx/sites-available/crialook

# 2. Validate nginx config
sudo nginx -t
# Expected: "syntax is ok" + "test is successful"

# 3. Reload nginx (zero-downtime — existing connections drain, new ones use the new config)
sudo systemctl reload nginx

# 4. Verify the header is now enforced (NOT -Report-Only) by hitting the live site:
curl -sI https://crialook.com.br/ | grep -i 'content-security-policy'
# Expected: "Content-Security-Policy: default-src 'self'; ..."
# Should NOT see "-Report-Only" in the header name.
```

Also update the canonical config in the repo so the next `bash deploy-crialook.sh` doesn't revert the flip:

```bash
# On your dev machine (not the VPS):
cd Agencia-Fashion
sed -i 's/Content-Security-Policy-Report-Only/Content-Security-Policy/' nginx-crialook.conf
git diff nginx-crialook.conf  # verify only the directive name changed
git add nginx-crialook.conf
git commit -m "ops(csp): flip from Report-Only to enforced after 14-day zero-violation window"
git push
```

Mark in this doc:
- [ ] **Flip date:** ____________ (YYYY-MM-DD)
- [ ] **Repo updated + pushed:** committed in `__SHA__`

---

## Phase 4 — Post-flip monitoring (first 7 days)

Continue watching Sentry. Once enforced, violations represent:
- A real user being blocked (likely a missing source-list entry that didn't surface during Report-Only — e.g., a country-specific Clerk CDN that didn't fire for your test traffic)
- Or an actual attack the policy is now successfully blocking

Triage each. If you see real users being blocked: rollback (Phase 5).

---

## Phase 5 — Rollback procedure (revert to Report-Only)

If post-flip violations indicate real-user breakage, revert immediately:

```bash
# On the VPS:
sudo sed -i 's/Content-Security-Policy/Content-Security-Policy-Report-Only/' /etc/nginx/sites-available/crialook
sudo nginx -t && sudo systemctl reload nginx

# Verify rollback:
curl -sI https://crialook.com.br/ | grep -i 'content-security-policy'
# Expected: "Content-Security-Policy-Report-Only: ..."

# On dev machine:
cd Agencia-Fashion
sed -i 's/Content-Security-Policy/Content-Security-Policy-Report-Only/' nginx-crialook.conf
git add nginx-crialook.conf
git commit -m "ops(csp): revert flip — real-user breakage observed; restart 14-day window after fix"
git push
```

Then: investigate the violation that broke users, add the missing source to the CSP, commit, deploy, restart Phase 1 (14-day observation).

---

## Notes

- **Why a doc, not automation?** The flip is a single sed command but the *decision* to flip is human (judging Sentry data + business risk tolerance). Automating the flip would create the wrong incentive (flip too eagerly to hit a metric).
- **Re-flip after rollback?** After fixing the missing source, re-start the 14-day observation window from scratch. Do NOT count days from the original window.
- **CSP-3 reporting (`report-to`)** vs **CSP-1 reporting (`report-uri`)**: both are wired in nginx-crialook.conf (per plan 08-02). Modern Chrome/Edge use `report-to`; Firefox/Safari use `report-uri`. Both POST to the same endpoint — Sentry sees them merged.
- **DSN safety:** `/api/csp-report` is the indirection that keeps the Sentry DSN public key out of the nginx config (which is in the public repo). Don't ever switch nginx to POST directly to Sentry's ingest URL.

---

## Versioning

| Date | Editor | Change |
|------|--------|--------|
| 2026-05-04 | Phase 8 plan 08-06 | Initial doc; observation not yet started |
| (TBD) | Owner | Observation start: YYYY-MM-DD |
| (TBD) | Owner | Flip executed: YYYY-MM-DD |
```
</action>

<verify>
```bash
test -f ops/csp-rollout.md && echo OK
wc -l ops/csp-rollout.md                                        # expect ≥ 80
grep -c '^## ' ops/csp-rollout.md                                # expect ≥ 5
grep -ic '14 day\|14-day\|2 week\|2-week\|two week' ops/csp-rollout.md  # expect ≥ 2
grep -c 'sudo sed' ops/csp-rollout.md                            # expect ≥ 2 (flip + rollback)
grep -c 'systemctl reload nginx\|nginx -t' ops/csp-rollout.md    # expect ≥ 2
grep -c '^- \[ \]' ops/csp-rollout.md                            # expect ≥ 4 (checklist items)
grep -c 'rollback\|revert\|re-add' ops/csp-rollout.md            # expect ≥ 2
grep -c 'Phase 0\|Phase 1\|Phase 2\|Phase 3\|Phase 4\|Phase 5' ops/csp-rollout.md  # expect ≥ 6 (all 6 phases)
```
</verify>

## Files modified

- `campanha-ia/src/app/api/csp-report/route.ts` — NEW; Next.js POST endpoint forwards CSP violation reports to Sentry (Tasks 1, 2)
- `campanha-ia/src/app/api/csp-report/route.test.ts` — NEW; vitest smoke test covering legacy + modern payload shapes + malformed/empty body + method-not-allowed (Task 3)
- `ops/csp-rollout.md` — NEW; owner-action operating manual with 6 phases (verify endpoint → observe → checklist → flip → monitor → rollback) (Task 4)

## Owner-action callout (D-10)

This plan ships the report endpoint and the rollout doc. The OWNER then:

1. Waits for plans 08-01 + 08-02 to deploy (so nginx ships the report-uri header)
2. Runs Phase 0 verification (curl test → 204 → Sentry sees test report)
3. Marks Phase 1 observation start date in `ops/csp-rollout.md` (commit the date in)
4. Monitors Sentry daily for 14 days
5. Ticks Phase 2 checklist
6. Executes Phase 3 flip (sed + nginx reload + commit canonical config update)
7. Monitors Phase 4 for 7 days post-flip
8. Rollback via Phase 5 if needed

The doc lives in the repo so it can evolve as the rollout progresses (each phase has fillable date fields).

## Why this matters (risk if skipped)

Without `/api/csp-report`, plan 08-02's `report-uri` directive points at a 404 — browsers send violations into the void, Sentry never sees them, and the 14-day zero-violation gate (D-09) cannot start. Without `ops/csp-rollout.md`, the owner has no checklist for the flip and may flip-then-rollback in production from forgetting a step. After this plan: violations flow to Sentry with structured tags, the owner has a deterministic 6-phase operating manual, and the flip-to-enforced is one sed command away from being safe.
