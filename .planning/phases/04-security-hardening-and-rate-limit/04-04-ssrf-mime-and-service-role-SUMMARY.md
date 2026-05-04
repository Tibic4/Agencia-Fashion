---
plan_id: 04-04
phase: 4
status: complete
completed_at: 2026-05-03
---

# Plan 04-04 — SUMMARY

## What was built

1. `src/lib/security/image-host-allowlist.ts` + 7 tests — strict origin allowlist (env-configurable; default seed from NEXT_PUBLIC_SUPABASE_URL).
2. `src/lib/security/verify-image-mime.ts` + 5 tests — sharp.metadata() magic-byte check for image uploads.
3. `/api/campaign/format` — D-15 allowlist replaces weak http(s) regex; captures Content-Type header; D-16 verifyImageMime before formatImage.
4. `/api/campaign/generate` — D-16 verifyImageMime on imageFile, closeUpImage, secondImage at route boundary; D-15 defense-in-depth allowlist on modelImageUrl before fetch.
5. `/api/fashion-facts` — D-17 lazy createAdminClient inside handler (removes top-level service-role smell).
6. `src/middleware.ts` — D-17 audit comment block above getSupabaseAdmin explaining why it stays.

## Key files created
- `campanha-ia/src/lib/security/image-host-allowlist.ts`
- `campanha-ia/src/lib/security/image-host-allowlist.test.ts`
- `campanha-ia/src/lib/security/verify-image-mime.ts`
- `campanha-ia/src/lib/security/verify-image-mime.test.ts`

## Files modified
- `campanha-ia/src/app/api/campaign/format/route.ts`
- `campanha-ia/src/app/api/campaign/generate/route.ts`
- `campanha-ia/src/app/api/fashion-facts/route.ts`
- `campanha-ia/src/middleware.ts`

## Deviations
None.

## Self-Check: PASSED
- `npx tsc --noEmit` exit 0
- `npm test` 34 files / 252 tests passing (was 32/240, +2 files +12 tests)
- Each task atomically committed
