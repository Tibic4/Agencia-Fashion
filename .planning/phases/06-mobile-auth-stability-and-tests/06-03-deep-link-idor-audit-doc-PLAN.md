---
plan_id: 06-03
phase: 6
title: Deep-link IDOR audit — confirm useLocalSearchParams usages re-fetch with auth (CONCERNS §7) and document
wave: 1
depends_on: []
owner_action: false
files_modified:
  - crialook-app/docs/DEEP_LINK_IDOR_AUDIT.md
autonomous: true
requirements: ["D-17", "F-CONCERNS-7"]
must_haves:
  truths:
    - "doc enumerates every useLocalSearchParams() call site in app/(tabs)/gerar/resultado.tsx and app/(tabs)/historico.tsx with path:line refs"
    - "for each call site, doc confirms whether data is rendered from URL params directly (UNSAFE) or only after an authenticated apiGet refetch (SAFE)"
    - "doc confirms current state is SAFE (resultado.tsx:297-304 does apiGet('/campaigns/${id}') before rendering — auth check happens server-side via Clerk Bearer)"
    - "doc lists the deep-link UUID validation pattern at _layout.tsx:75-79 as the second defensive layer"
    - "doc adds an ongoing-checklist line: 'every new useLocalSearchParams call must re-fetch via lib/api.ts before rendering — no exceptions'"
  acceptance:
    - "test -f crialook-app/docs/DEEP_LINK_IDOR_AUDIT.md exits 0"
    - "wc -l crialook-app/docs/DEEP_LINK_IDOR_AUDIT.md returns 30 or more lines"
    - "grep -c 'resultado.tsx' crialook-app/docs/DEEP_LINK_IDOR_AUDIT.md returns at least 1"
    - "grep -c 'historico.tsx' crialook-app/docs/DEEP_LINK_IDOR_AUDIT.md returns at least 1"
    - "grep -c 'apiGet' crialook-app/docs/DEEP_LINK_IDOR_AUDIT.md returns at least 1"
    - "grep -c '_layout.tsx:75' crialook-app/docs/DEEP_LINK_IDOR_AUDIT.md returns at least 1"
---

# Plan 06-03: Deep-link IDOR audit doc

## Objective

Per D-17 + CONCERNS.md §7, audit every `useLocalSearchParams()` call site in `app/(tabs)/gerar/resultado.tsx` and `app/(tabs)/historico.tsx` to confirm none of them render data derived from URL params **without** an authenticated API re-fetch. If any such pattern is found, surface as an immediate code-fix task (not just doc); if all are safe, document that fact and add an ongoing-checklist line for future contributors.

Pre-research finding (already verified during plan-phase research): `resultado.tsx:268,297-304` extracts `id` from `useLocalSearchParams` and immediately calls `apiGet('/campaigns/${id}')` (which goes through `lib/api.ts` — Clerk Bearer attached, backend enforces ownership). `historico.tsx` uses `useQuery` with `apiGet('/campaigns')` — list endpoint, no URL-derived data rendered raw. **Current state is SAFE.** This plan is doc-only confirmation + future-proofing checklist.

## Truths the executor must respect

- This plan does NOT modify any source file under `app/`, `lib/`, `components/`, `hooks/`. The audit confirmed no fix is needed.
- Doc lives at `crialook-app/docs/DEEP_LINK_IDOR_AUDIT.md` (owner-facing reference docs path, NOT `.planning/` — this is a living checklist for ongoing contributions, not a phase artifact).
- Doc must include path:line references so a future contributor opening it can audit the code in 30 seconds.
- If during execution the executor discovers a useLocalSearchParams call NOT covered by the pre-research (e.g., new file added since), they MUST surface it as a HIGH-severity verification flag — do NOT silently document as safe.

## Tasks

### Task 1: Re-confirm the audit (sanity check before writing doc)

<read_first>
- crialook-app/app/(tabs)/gerar/resultado.tsx (focus lines 260-310 — useLocalSearchParams + the apiGet refetch)
- crialook-app/app/(tabs)/historico.tsx (focus lines 1-50 + lines 305-345 — useQuery hook with apiGet)
- crialook-app/app/_layout.tsx (lines 75-79 — UUID_REGEX + isValidCampaignId guard)
- crialook-app/lib/api.ts (confirm apiGet attaches Clerk Bearer via getAuthToken)
- .planning/codebase/CONCERNS.md §7 (deep-link IDOR finding text)
- .planning/audits/CRIALOOK-PLAY-READINESS.md §5 "Deep link validation" (lines 212-216)
</read_first>

<action>
1. Re-grep for any other `useLocalSearchParams` call site that wasn't in the original pre-research. Run:

```bash
grep -rn 'useLocalSearchParams' crialook-app/app/ crialook-app/components/ crialook-app/hooks/ 2>/dev/null
```

2. For each result, verify:
   - URL param is validated (UUID regex or similar) before use, OR
   - Data is fetched via `apiGet` / `apiPost` / `useQuery` (which goes through `lib/api.ts` and attaches Clerk Bearer) before rendering, OR
   - The param is used purely for navigation / display strings that aren't sensitive (e.g., a `from` breadcrumb).

3. If ANY call site renders data from `useLocalSearchParams` without going through `lib/api.ts` and that data could leak someone else's resource — STOP and surface as a code-fix task (not doc). Do not silently document as safe.

4. If all call sites are safe (expected outcome based on pre-research), proceed to Task 2.
</action>

<verify>
```bash
grep -rn 'useLocalSearchParams' crialook-app/app/ crialook-app/components/ crialook-app/hooks/ 2>/dev/null
# Document each result in your head; ensure each is either UUID-guarded or refetched via lib/api.ts
```
</verify>

### Task 2: Write `crialook-app/docs/DEEP_LINK_IDOR_AUDIT.md`

<read_first>
- (re-uses the files from Task 1 — no new reads)
</read_first>

<action>
Create `crialook-app/docs/DEEP_LINK_IDOR_AUDIT.md` with EXACTLY this structure (substitute the actual current line numbers if they have drifted from the pre-research baseline):

```markdown
# Deep-link IDOR Audit — crialook-app

**Last audited:** [today's date]
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

### Layer 2 — Authenticated API re-fetch (rendering)

Every `useLocalSearchParams()` call site that drives data rendering MUST re-fetch through `lib/api.ts`. `apiGet` / `apiPost` / `apiFetchRaw` all attach a Clerk Bearer JWT (via `getAuthToken`); the backend (`crialook.com.br/api`) is the source of truth for ownership and rejects with 401/403 on mismatch.

## Current call sites (audited [today's date])

### `app/(tabs)/gerar/resultado.tsx`

| Line | Param | Render path | Status |
|------|-------|-------------|--------|
| 268 | `id` | `apiGet('/campaigns/${id}')` at line 297-304 fetches the campaign before render | SAFE |
| 268 | `from` | Used only as a navigation breadcrumb string (no sensitive render) | SAFE |

The `useEffect` at lines 297-304 keeps `loading=true` until the apiGet resolves — no flash of params-derived content.

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
```

If the line numbers in `resultado.tsx` have drifted from `268` / `297-304`, substitute the current ones — the doc must be accurate at write time.
</action>

<verify>
```bash
test -f crialook-app/docs/DEEP_LINK_IDOR_AUDIT.md && echo "OK: file exists"
wc -l crialook-app/docs/DEEP_LINK_IDOR_AUDIT.md
# Expect: 30 or more lines

grep -c 'resultado.tsx\|historico.tsx\|apiGet\|_layout.tsx:75' crialook-app/docs/DEEP_LINK_IDOR_AUDIT.md
# Expect: at least 4 lines matching
```
</verify>

## Files modified

- `crialook-app/docs/DEEP_LINK_IDOR_AUDIT.md` (NEW)

## Why this matters (risk if skipped)

Without this audit + checklist, a future contributor adding a `useLocalSearchParams` call in (say) a new `gerar/preview/[id].tsx` route might naively render the param without re-fetching, opening an IDOR. The audit is cheap; the doc is the future-proofing.
