---
plan_id: 04-04
phase: 4
title: SSRF allowlist + Sharp MIME magic-byte check + service-role move on fashion-facts/middleware
wave: 2
depends_on: []
owner_action: false
files_modified:
  - campanha-ia/src/lib/security/image-host-allowlist.ts
  - campanha-ia/src/lib/security/image-host-allowlist.test.ts
  - campanha-ia/src/lib/security/verify-image-mime.ts
  - campanha-ia/src/lib/security/verify-image-mime.test.ts
  - campanha-ia/src/app/api/campaign/format/route.ts
  - campanha-ia/src/app/api/campaign/generate/route.ts
  - campanha-ia/src/app/api/fashion-facts/route.ts
autonomous: true
requirements: ["D-15", "D-16", "D-17"]
must_haves:
  truths:
    - "image-host-allowlist.ts enforces Supabase Storage origin (configurable via env IMAGE_HOST_ALLOWLIST)"
    - "/api/campaign/format rejects imageUrl outside allowlist with 400 BEFORE fetching"
    - "/api/campaign/generate validates modelImageUrl against same allowlist (defense-in-depth)"
    - "verify-image-mime.ts uses sharp.metadata() to confirm magic bytes match claimed MIME; rejects mismatches"
    - "Generate route uses verify-image-mime on imageFile / closeUpImage / secondImage at route boundary"
    - "fashion-facts/route.ts uses createAdminClient() inside handler (no top-level service-role createClient)"
  acceptance:
    - "vitest covers allowlist accept/reject + MIME match/mismatch"
    - "tsc --noEmit exits 0"
    - "grep top-level createClient in fashion-facts/route.ts returns 0"
---

# Plan 04-04: SSRF Allowlist + MIME Magic-Byte Check + Service-Role Audit

## Objective

Close three independent CONCERNS §1/§5 gaps:

1. **D-15 SSRF allowlist** — `/api/campaign/format` accepts arbitrary `imageUrl`; an authed user can probe internal IPs (`http://169.254.169.254/...` for cloud metadata, localhost services, etc.). Pin to Supabase Storage origin allowlist. Mirror on `/api/campaign/generate`'s `modelImageUrl` fetch path as defense-in-depth.
2. **D-16 MIME magic-byte check** — uploaded buffers go straight to Sharp + Storage with only `imageFile.type` (the browser-claimed MIME) validated. A `evil.exe` renamed to `image/png` gets through to disk before Sharp throws (and Sharp's error is a 500, not a 400). Run `sharp(buf).metadata()` at the route boundary and reject if claimed MIME ≠ detected format.
3. **D-17 service-role audit** — `app/api/fashion-facts/route.ts` calls `createClient` at module scope with the service role key, bypassing RLS for what should be a public read endpoint. Move to `createAdminClient()` inside the handler. Audit pass on `middleware.ts:hasStore` (which also instantiates a service-role client) — leave as-is if it's the only way to do auth-redirect, but document why.

## Truths the executor must respect

- The allowlist MUST be env-configurable: `IMAGE_HOST_ALLOWLIST` (CSV). Default value (when env unset) is the current Supabase URL host derived from `NEXT_PUBLIC_SUPABASE_URL`.
- Block `localhost`, `127.0.0.1`, link-local `169.254.0.0/16`, and any URL whose hostname resolves to a private IP (we do NOT do DNS resolution at runtime — too slow + DNS-rebinding bypass — instead rely on the strict allowlist match against scheme+hostname+port).
- The MIME check is `sharp(buf).metadata()` returning `{ format: 'jpeg' | 'png' | 'webp' | 'gif' | … }`. Map: `image/jpeg` → `jpeg`, `image/png` → `png`, `image/webp` → `webp`, `image/gif` → `gif`. Reject mismatches with 400.
- DO NOT change `lib/middleware.ts:hasStore` in this plan unless the audit reveals a clean alternative. If keeping the service-role client there, add a comment explaining why (it's middleware — runs before the request hits a route handler — and `auth().protect()` already gates the call, so RLS would block the legit lookup).
- `fashion-facts` is a PUBLIC read (no auth required). Moving to `createAdminClient()` inside the handler doesn't change behavior — it just stops the module-scope side effect (the client should be lazily created, not at import-time).

## Tasks

### Task 1: Create `image-host-allowlist.ts`

<read_first>
- campanha-ia/src/lib/env.ts (lines 60-100 — env schema convention; add IMAGE_HOST_ALLOWLIST as optional string)
- campanha-ia/src/app/api/campaign/format/route.ts (current `/^https?:\/\//.test(imageUrl)` — the weak check being replaced)
- .planning/phases/04-security-hardening-and-rate-limit/04-CONTEXT.md (D-15)
- .planning/codebase/CONCERNS.md (§5 SSRF rationale)
</read_first>

<action>
Create `campanha-ia/src/lib/security/image-host-allowlist.ts`:

```typescript
/**
 * Phase 4 D-15: SSRF allowlist for image fetches.
 *
 * Strict allowlist by host (and port if non-default). Default seed: derive the
 * Supabase Storage origin from NEXT_PUBLIC_SUPABASE_URL. Override via env
 * IMAGE_HOST_ALLOWLIST (CSV of `https://host[:port]` entries).
 *
 * What this DOESN'T do (intentionally):
 *  - DNS resolution at runtime — slow, racy, and bypassable via DNS rebinding.
 *  - Block private CIDRs by IP — relies on hostname allowlist instead.
 *
 * Practical effect: only Supabase-hosted image URLs (or whatever the deployer
 * explicitly opts into) can reach `fetch()`. Probing 169.254.x.x / localhost /
 * internal services becomes impossible.
 */

function getDefaultAllowlist(): string[] {
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supaUrl) return [];
  try {
    const u = new URL(supaUrl);
    return [`${u.protocol}//${u.host}`];
  } catch {
    return [];
  }
}

function getAllowlist(): string[] {
  const fromEnv = (process.env.IMAGE_HOST_ALLOWLIST || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  if (fromEnv.length > 0) return fromEnv;
  return getDefaultAllowlist();
}

export interface AllowlistResult {
  allowed: boolean;
  reason?: string;
}

export function isAllowedImageUrl(rawUrl: string): AllowlistResult {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { allowed: false, reason: "empty_or_invalid_url" };
  }
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return { allowed: false, reason: "malformed_url" };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    return { allowed: false, reason: "unsupported_protocol" };
  }
  const allowlist = getAllowlist();
  if (allowlist.length === 0) {
    // No allowlist configured AND no NEXT_PUBLIC_SUPABASE_URL fallback → reject.
    return { allowed: false, reason: "allowlist_not_configured" };
  }
  const origin = `${u.protocol}//${u.host}`;
  if (!allowlist.includes(origin)) {
    return { allowed: false, reason: `host_not_allowlisted:${u.host}` };
  }
  return { allowed: true };
}

// Exported for tests + observability
export function _getEffectiveAllowlist(): string[] {
  return getAllowlist();
}
```
</action>

<acceptance_criteria>
- File exists at `campanha-ia/src/lib/security/image-host-allowlist.ts`
- File exports `isAllowedImageUrl(url: string): AllowlistResult`
- File exports `_getEffectiveAllowlist()` for tests
- Default allowlist derives from `NEXT_PUBLIC_SUPABASE_URL`
- `IMAGE_HOST_ALLOWLIST` env CSV overrides the default
- File rejects: empty, malformed, non-http(s) protocol, host not in allowlist, no allowlist configured
- `tsc --noEmit` exits 0
</acceptance_criteria>

---

### Task 2: Test `image-host-allowlist`

<read_first>
- campanha-ia/src/lib/security/image-host-allowlist.ts (just created)
- campanha-ia/src/lib/mp-signature.test.ts (env-mocking pattern via vi.stubEnv)
</read_first>

<action>
Create `campanha-ia/src/lib/security/image-host-allowlist.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isAllowedImageUrl } from "./image-host-allowlist";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
  vi.stubEnv("IMAGE_HOST_ALLOWLIST", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isAllowedImageUrl (D-15 SSRF)", () => {
  it("allows Supabase Storage origin (default seed)", () => {
    expect(isAllowedImageUrl("https://abc.supabase.co/storage/v1/object/public/x.jpg").allowed).toBe(true);
  });

  it("blocks 169.254 link-local IP probe", () => {
    const r = isAllowedImageUrl("http://169.254.169.254/latest/meta-data/");
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/host_not_allowlisted/);
  });

  it("blocks localhost", () => {
    expect(isAllowedImageUrl("http://localhost:3000/x").allowed).toBe(false);
    expect(isAllowedImageUrl("http://127.0.0.1/x").allowed).toBe(false);
  });

  it("blocks malformed URL", () => {
    expect(isAllowedImageUrl("not a url").allowed).toBe(false);
  });

  it("blocks file:// and javascript: schemes", () => {
    expect(isAllowedImageUrl("file:///etc/passwd").allowed).toBe(false);
    expect(isAllowedImageUrl("javascript:alert(1)").allowed).toBe(false);
  });

  it("respects IMAGE_HOST_ALLOWLIST env override (CSV)", () => {
    vi.stubEnv("IMAGE_HOST_ALLOWLIST", "https://cdn.example.com,https://other.cdn.io");
    expect(isAllowedImageUrl("https://cdn.example.com/x.jpg").allowed).toBe(true);
    expect(isAllowedImageUrl("https://abc.supabase.co/x.jpg").allowed).toBe(false);
  });

  it("returns allowlist_not_configured when no env + no SUPABASE URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("IMAGE_HOST_ALLOWLIST", "");
    const r = isAllowedImageUrl("https://anywhere.test/x.jpg");
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/allowlist_not_configured/);
  });
});
```
</action>

<acceptance_criteria>
- File exists at `campanha-ia/src/lib/security/image-host-allowlist.test.ts`
- `cd campanha-ia && npx vitest run src/lib/security/image-host-allowlist.test.ts` exits 0
- At least 7 passing cases: Supabase allow, 169.254 block, localhost block, malformed block, non-http schemes block, env override, allowlist_not_configured
</acceptance_criteria>

---

### Task 3: Create `verify-image-mime.ts` magic-byte check

<read_first>
- campanha-ia/src/app/api/campaign/format/route.ts (lines 44-50 — existing sharp(input).metadata() usage as pattern)
- campanha-ia/src/app/api/campaign/generate/route.ts (lines 138-146 — current claimed-MIME validation)
- .planning/phases/04-security-hardening-and-rate-limit/04-CONTEXT.md (D-16)
</read_first>

<action>
Create `campanha-ia/src/lib/security/verify-image-mime.ts`:

```typescript
/**
 * Phase 4 D-16: verify uploaded buffer's magic bytes match the claimed MIME type.
 *
 * Why: route handlers historically trust `File.type` (browser-supplied; trivially
 * forgeable). A `evil.exe` renamed to `image/png` reaches Sharp/Storage before
 * any check fires. Sharp's error then surfaces as a 500, not a 400.
 *
 * sharp.metadata() returns `{ format: 'jpeg' | 'png' | 'webp' | 'gif' | 'svg' | … }`.
 * We coerce the claim to the expected sharp `format` and reject mismatches.
 *
 * Returns:
 *   - { ok: true, format } on match
 *   - { ok: false, reason } on mismatch / unreadable
 */

import sharp from "sharp";

const CLAIMED_TO_SHARP: Record<string, string> = {
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export type VerifyResult =
  | { ok: true; format: string }
  | { ok: false; reason: string };

export async function verifyImageMime(
  buffer: Buffer,
  claimedMime: string,
): Promise<VerifyResult> {
  const expected = CLAIMED_TO_SHARP[claimedMime?.toLowerCase?.() ?? ""];
  if (!expected) {
    return { ok: false, reason: `unsupported_claimed_mime:${claimedMime}` };
  }
  let detected: string | undefined;
  try {
    const meta = await sharp(buffer).metadata();
    detected = meta.format;
  } catch (err) {
    return {
      ok: false,
      reason: `sharp_metadata_failed:${(err as Error).message?.slice(0, 80) ?? "unknown"}`,
    };
  }
  if (!detected) {
    return { ok: false, reason: "no_format_detected" };
  }
  if (detected !== expected) {
    return {
      ok: false,
      reason: `mime_mismatch:claimed=${claimedMime},detected=${detected}`,
    };
  }
  return { ok: true, format: detected };
}
```
</action>

<acceptance_criteria>
- File exists at `campanha-ia/src/lib/security/verify-image-mime.ts`
- File exports `verifyImageMime(buffer: Buffer, claimedMime: string): Promise<VerifyResult>`
- File maps `image/jpeg|jpg|png|webp|gif` to sharp's format strings
- Rejects: unsupported claimed MIME, sharp throw, no format detected, format mismatch
- `tsc --noEmit` exits 0
</acceptance_criteria>

---

### Task 4: Test `verify-image-mime`

<read_first>
- campanha-ia/src/lib/security/verify-image-mime.ts (just created)
- campanha-ia/src/app/api/campaign/format/route.ts (sharp output buffer convention — useful for synthesizing a real PNG buffer in test)
</read_first>

<action>
Create `campanha-ia/src/lib/security/verify-image-mime.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { verifyImageMime } from "./verify-image-mime";

async function makePng(): Promise<Buffer> {
  return sharp({
    create: { width: 4, height: 4, channels: 3, background: { r: 255, g: 0, b: 0 } },
  }).png().toBuffer();
}

async function makeJpeg(): Promise<Buffer> {
  return sharp({
    create: { width: 4, height: 4, channels: 3, background: { r: 0, g: 255, b: 0 } },
  }).jpeg().toBuffer();
}

describe("verifyImageMime (D-16)", () => {
  it("accepts real PNG claimed as image/png", async () => {
    const buf = await makePng();
    const r = await verifyImageMime(buf, "image/png");
    expect(r.ok).toBe(true);
  });

  it("rejects PNG buffer claimed as image/jpeg (mismatch)", async () => {
    const buf = await makePng();
    const r = await verifyImageMime(buf, "image/jpeg");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/mime_mismatch/);
  });

  it("rejects junk buffer claimed as image/png", async () => {
    const buf = Buffer.from("MZ\x90\x00not-a-png-just-fake-exe-header");
    const r = await verifyImageMime(buf, "image/png");
    expect(r.ok).toBe(false);
  });

  it("rejects unsupported claimed MIME", async () => {
    const buf = await makePng();
    const r = await verifyImageMime(buf, "application/octet-stream");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/unsupported_claimed_mime/);
  });

  it("accepts JPEG claimed as image/jpg (alias)", async () => {
    const buf = await makeJpeg();
    const r = await verifyImageMime(buf, "image/jpg");
    expect(r.ok).toBe(true);
  });
});
```
</action>

<acceptance_criteria>
- File exists at `campanha-ia/src/lib/security/verify-image-mime.test.ts`
- `cd campanha-ia && npx vitest run src/lib/security/verify-image-mime.test.ts` exits 0
- At least 5 passing cases: real PNG accept, PNG-as-JPEG mismatch, junk buffer reject, unsupported MIME reject, jpg-alias accept
</acceptance_criteria>

---

### Task 5: Wire allowlist + MIME check into `/api/campaign/format`

<read_first>
- campanha-ia/src/app/api/campaign/format/route.ts (lines 98-150 — current handler)
- campanha-ia/src/lib/security/image-host-allowlist.ts (just created)
- campanha-ia/src/lib/security/verify-image-mime.ts (just created)
- .planning/phases/04-security-hardening-and-rate-limit/04-CONTEXT.md (D-15, D-16)
</read_first>

<action>
Edit `campanha-ia/src/app/api/campaign/format/route.ts`:

1. Add imports:
   ```typescript
   import { isAllowedImageUrl } from "@/lib/security/image-host-allowlist";
   import { verifyImageMime } from "@/lib/security/verify-image-mime";
   ```

2. Replace the current `if (!/^https?:\/\//.test(body.imageUrl))` validation block with:
   ```typescript
   const allow = isAllowedImageUrl(body.imageUrl);
   if (!allow.allowed) {
     return NextResponse.json(
       { error: "imageUrl host not allowed", reason: allow.reason },
       { status: 400 },
     );
   }
   ```

3. After `inputBuffer` is set (whether from `imageUrl` fetch or `imageBase64` decode), and BEFORE the call to `formatImage(inputBuffer, ...)`, infer the claimed MIME and validate. For the URL path, infer from response Content-Type header captured during the fetch:
   ```typescript
   // For URL: capture Content-Type header during fetch
   // For base64: parse the data URI MIME prefix; fallback to image/jpeg
   ```
   Then:
   ```typescript
   // Default to image/jpeg if no claim available — sharp.metadata() will
   // reject any non-image buffer regardless.
   const claimedMime = sourceMime || "image/jpeg";
   const mimeCheck = await verifyImageMime(inputBuffer, claimedMime);
   if (!mimeCheck.ok) {
     return NextResponse.json(
       { error: "image MIME mismatch", reason: mimeCheck.reason },
       { status: 400 },
     );
   }
   ```

   For the URL branch, capture `res.headers.get("content-type") || ""` into `sourceMime` after the fetch.
   For the base64 branch, parse the leading `data:image/(\w+);base64,` prefix into `sourceMime`.

DO NOT remove the existing fetch error handling.
</action>

<acceptance_criteria>
- `grep -n "isAllowedImageUrl" campanha-ia/src/app/api/campaign/format/route.ts` returns at least 1 match
- `grep -n "verifyImageMime" campanha-ia/src/app/api/campaign/format/route.ts` returns at least 1 match
- `grep -n "/^https?:\\\/\\\//" campanha-ia/src/app/api/campaign/format/route.ts` returns 0 matches (old weak check removed)
- `grep -n "imageUrl host not allowed" campanha-ia/src/app/api/campaign/format/route.ts` returns 1 match
- Manual test (post-deploy): POST with `imageUrl=http://169.254.169.254/latest/meta-data/` → 400 with reason starting `host_not_allowlisted`
- `tsc --noEmit` exits 0
</acceptance_criteria>

---

### Task 6: Wire allowlist + MIME check into `/api/campaign/generate`

<read_first>
- campanha-ia/src/app/api/campaign/generate/route.ts (lines 120-150 — current claimed-MIME check; lines 248-265 — sharp downscale)
- campanha-ia/src/lib/security/image-host-allowlist.ts
- campanha-ia/src/lib/security/verify-image-mime.ts
- .planning/phases/04-security-hardening-and-rate-limit/04-CONTEXT.md (D-15, D-16)
</read_first>

<action>
Edit `campanha-ia/src/app/api/campaign/generate/route.ts`:

1. Add imports:
   ```typescript
   import { isAllowedImageUrl } from "@/lib/security/image-host-allowlist";
   import { verifyImageMime } from "@/lib/security/verify-image-mime";
   ```

2. AFTER the existing `validTypes.includes(imageFile.type)` claimed-MIME validation (around line 140) and AFTER `imageFile.size` size check, BEFORE the `getStoreByClerkId` call, add a magic-byte check on `imageFile`:
   ```typescript
   // D-16: magic-byte MIME check at route boundary — rejects evil.exe-renamed-as-png
   {
     const buf = Buffer.from(await imageFile.arrayBuffer());
     const mc = await verifyImageMime(buf, imageFile.type);
     if (!mc.ok) {
       return NextResponse.json({ error: "Imagem inválida (MIME mismatch)", code: "INVALID_IMAGE_MAGIC", reason: mc.reason }, { status: 400 });
     }
   }
   ```
   Note: this re-reads the buffer — that's intentional (the existing code reads it later via `imageFile.arrayBuffer()` again, which works because the underlying File is reusable).

3. Repeat the same magic-byte check pattern for `closeUpImage` and `secondImage` IF they are non-null and have `size > 0`. Place the checks just before `extraImages.push(await downscaleExtra(...))` for each.

4. If anywhere in the file an external `modelImageUrl` is fetched (search for `modelImageUrl` and any `fetch(` of an image), wrap the URL in `isAllowedImageUrl(modelImageUrl)` and reject 400 on `!allowed`. If no such fetch exists in `generate/route.ts` itself, document in the verification log that the modelImageUrl path is internal-only (no SSRF surface) — this satisfies D-15's "mirror as defense-in-depth" requirement: if there's no fetch, there's no risk.
</action>

<acceptance_criteria>
- `grep -n "verifyImageMime" campanha-ia/src/app/api/campaign/generate/route.ts` returns at least 1 match (target: 1-3 — for imageFile, optionally closeUp + second)
- `grep -n "INVALID_IMAGE_MAGIC" campanha-ia/src/app/api/campaign/generate/route.ts` returns at least 1 match
- The magic-byte check on `imageFile` is positioned AFTER `validTypes.includes(imageFile.type)` and BEFORE `getStoreByClerkId(clerkUserId)`
- If `modelImageUrl` is fetched anywhere in this file, `isAllowedImageUrl` is called on it before the fetch
- `tsc --noEmit` exits 0
- Pre-existing vitest cases still pass (no regression)
</acceptance_criteria>

---

### Task 7: Move fashion-facts service-role client into handler (D-17)

<read_first>
- campanha-ia/src/app/api/fashion-facts/route.ts (entire file — top-level createClient is the smell)
- campanha-ia/src/lib/supabase/admin.ts (the createAdminClient pattern this should adopt)
- .planning/phases/04-security-hardening-and-rate-limit/04-CONTEXT.md (D-17)
- campanha-ia/src/middleware.ts (lines 56-62 — `getSupabaseAdmin` is also a top-level service-role pattern; keep + document why)
</read_first>

<action>
Edit `campanha-ia/src/app/api/fashion-facts/route.ts`:

1. Remove the top-level imports + module-scope client:
   ```typescript
   // DELETE:
   // import { createClient } from "@supabase/supabase-js";
   // const supabase = createClient(
   //   process.env.NEXT_PUBLIC_SUPABASE_URL!,
   //   process.env.SUPABASE_SERVICE_ROLE_KEY!
   // );
   ```

2. Add the admin client import:
   ```typescript
   import { createAdminClient } from "@/lib/supabase/admin";
   ```

3. Inside `GET()`, instantiate the client lazily:
   ```typescript
   const supabase = createAdminClient();
   ```

4. Add a comment near the top of the file explaining: this endpoint is a public read; it uses the admin client because RLS on `fashion_facts` blocks anon reads even for `is_active=true`. A future improvement is to add a permissive RLS policy and switch to anon — outside Phase 4 scope.

5. Audit `campanha-ia/src/middleware.ts:hasStore` (lines 56-88) — it instantiates a service-role client at module scope (`getSupabaseAdmin()`). Add a comment block above `getSupabaseAdmin()` explaining why it stays:
   - middleware runs BEFORE any route handler
   - `auth.protect()` already gates the userId we look up
   - moving to RLS would require an authenticated Supabase client per-request, which is significantly more expensive in middleware (runs on EVERY request to a protected route)
   - the lookup is for a flag (has_store), not user data — leak surface is minimal
   Reference D-17 in the comment.
</action>

<acceptance_criteria>
- `grep -n "^import { createClient } from \"@supabase/supabase-js\"" campanha-ia/src/app/api/fashion-facts/route.ts` returns 0 matches
- `grep -n "createAdminClient" campanha-ia/src/app/api/fashion-facts/route.ts` returns at least 2 matches (import + usage)
- `grep -n "const supabase = createClient(" campanha-ia/src/app/api/fashion-facts/route.ts` returns 0 matches (top-level instance gone)
- `campanha-ia/src/middleware.ts` contains a comment block referencing D-17 above `getSupabaseAdmin`
- `tsc --noEmit` exits 0
- Manual smoke: GET /api/fashion-facts returns 200 with the same shape as before
</acceptance_criteria>

---

## Verification

After all 7 tasks complete:

1. `cd campanha-ia && npx tsc --noEmit` exits 0.
2. `cd campanha-ia && npx vitest run src/lib/security/` — all allowlist + MIME tests pass.
3. SSRF static check: `grep -rn "fetch(body.imageUrl\|fetch(imageUrl\|fetch(modelImageUrl" campanha-ia/src/app/api/campaign/` — every match is preceded by an `isAllowedImageUrl` guard within ~10 lines.
4. MIME static check: `grep -rn "imageFile.type\|imageFile.arrayBuffer" campanha-ia/src/app/api/campaign/generate/route.ts` — confirms `verifyImageMime` is called on the buffer before downscaling.
5. Service-role static check: `grep -rn "process.env.SUPABASE_SERVICE_ROLE_KEY" campanha-ia/src/app/api/` — only legitimate route handlers remain (none at module scope).

## must_haves

```yaml
truths:
  - image_host_allowlist_lib_exists_and_strict
  - verify_image_mime_lib_exists_and_uses_sharp_metadata
  - format_route_validates_imageUrl_before_fetch
  - format_route_validates_inputBuffer_mime_before_processing
  - generate_route_validates_imageFile_mime_at_boundary
  - fashion_facts_uses_createAdminClient_inside_handler
  - middleware_hasStore_comments_d17_rationale
acceptance:
  - tsc_no_emit_exit_zero
  - allowlist_test_7_passing
  - mime_test_5_passing
  - no_top_level_service_role_in_fashion_facts
```
