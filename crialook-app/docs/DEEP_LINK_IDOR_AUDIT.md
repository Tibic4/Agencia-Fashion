# Deep-link IDOR Audit — crialook-app

**Last audited:** 2026-05-04
**Audit owner:** Phase 06 (Mobile Auth Stability & Tests)
**Re-audit cadence:** every time a new `useLocalSearchParams()` call lands in the app

## Threat model (CONCERNS §7)

Expo Router's `useLocalSearchParams()` reads URL params from deep links. Without server-side authorization checks, a crafted deep link `crialook://campaign/<other-user-uuid>` could load and render another user's resource ("IDOR" — Insecure Direct Object Reference).

## Defensive layers in place

### Layer 1 — UUID format validation (deep-link entry point)

`crialook-app/app/_layout.tsx:75-79`:

```ts
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidCampaignId(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}
```

Any incoming deep-link `campaignId` is regex-validated before navigation. Prevents arbitrary route injection (e.g., `crialook://campaign/../../../../etc/passwd`).

> Note: in plan 06-11 the regex + guard are extracted to `crialook-app/lib/_layout-deep-link.ts` so they can be unit-tested in isolation. Behavior is byte-identical.

### Layer 2 — Authenticated API re-fetch (rendering)

Every `useLocalSearchParams()` call site that drives data rendering MUST re-fetch through `lib/api.ts`. `apiGet` / `apiPost` / `apiFetchRaw` all attach a Clerk Bearer JWT (via `getAuthToken`); the backend (`crialook.com.br/api`) is the source of truth for ownership and rejects with 401/403 on mismatch.

## Current call sites (audited 2026-05-04)

### `app/(tabs)/gerar/resultado.tsx`

| Line | Param | Render path | Status |
|------|-------|-------------|--------|
| 268 | `id` | `apiGet('/campaigns/${id}')` at line 304 fetches the campaign before render | SAFE |
| 268 | `from` | Used only as a navigation breadcrumb string (no sensitive render) | SAFE |

The `useEffect` at lines 296-303 keeps `loading=true` until the apiGet resolves — no flash of params-derived content. The hydration guard (`if (id === undefined) return`) prevents the first-render flicker.

### `app/(tabs)/historico.tsx`

| Line | Param | Render path | Status |
|------|-------|-------------|--------|
| (n/a — no `useLocalSearchParams`) | — | List endpoint via `useQuery` + `apiGet('/campaigns')` — no URL-derived data | SAFE |

## Ongoing checklist (for new contributors)

> **Before merging any PR that introduces a new `useLocalSearchParams()` call:**
>
> 1. Validate the param shape (UUID regex, enum, or numeric range) before use.
> 2. If the param drives data rendering, fetch through `lib/api.ts` so Clerk Bearer attaches automatically.
> 3. NEVER render trusted UI (e.g., user names, paid-tier flags) directly from URL params.
> 4. Add the new call site to the table above when this doc is next refreshed.

## References

- `.planning/codebase/CONCERNS.md` §7 (Deep links accept arbitrary URLs)
- `.planning/audits/CRIALOOK-PLAY-READINESS.md` §5 "Deep link validation" (lines 212-216)
- `crialook-app/lib/api.ts` (Bearer attachment via `getAuthToken`)
- `crialook-app/lib/auth.tsx:117-135` (jwtCache + token refresh)
- `crialook-app/lib/_layout-deep-link.ts` (extracted UUID guard — plan 06-11)
- `crialook-app/lib/__tests__/deep-link-uuid.test.ts` (regression-lock for the regex — plan 06-11)
