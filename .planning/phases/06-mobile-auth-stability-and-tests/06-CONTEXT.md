# Phase 6: Mobile Auth Stability & Tests - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning (P3 done, P5 plan to coordinate F-10 sequencing)

<domain>
## Phase Boundary

Patch the known Clerk Expo SDK auth-bypass advisory, harden cold-start failure modes (font hang, error-message leak, deep-link IDOR), add the missing release-critical tests for billing + auth + error boundaries, and produce — but do NOT execute — the Clerk Client Trust re-enable plan for after Play approval.

In scope (PHASE-DETAILS Phase 6):
- Bump `@clerk/clerk-expo` to `~2.19.36+` (GHSA-w24r-5266-9c3c). Regen lock via `npm run lock:fix` (per memory). Verify EAS preview build still authenticates.
- Font load timeout via `Promise.race([useFonts, timeout(8000)])` in `AppFadeIn`. (F-09)
- Wrap `TabErrorBoundary.tsx:67-75` `error.message` in `{__DEV__ && (…)}`. (F-10) — gated on P5 F-03 live
- Audit `useLocalSearchParams()` in `app/(tabs)/gerar/resultado.tsx` + `historico.tsx` for client-side rendering from URL params without API re-fetch. (CONCERNS §7)
- Add `lib/__tests__/billing.test.ts` (`obfuscatedAccountIdAndroid`)
- Add `lib/__tests__/auth.test.ts` (JWT cache TTL 30s, 401-retry, signOut clears cache)
- Add tests for `ErrorBoundary.tsx` + `TabErrorBoundary.tsx`
- Deep-link UUID validation test for `_layout.tsx:75-79`
- Write `crialook-app/.planning/CLERK_CLIENT_TRUST_REENABLE.md` (or equivalent) with full pre-flight + enable + monitoring + rollback + memory-update plan from CRIALOOK-PLAY-READINESS.md §11. **Do NOT execute** — execution is post-Play approval, out of M1.
- Document the 7 server-side compensating controls (CRIALOOK-PLAY-READINESS.md §4); confirm with backend they are live; add to ongoing checklist
- Document keystore migration to EAS-managed credentials path

Out of scope:
- Actually re-enabling Clerk Client Trust (post-Play)
- Maestro/Detox e2e (parking lot)
- F-11 delete-UX (Phase 7)
- iOS section cleanup (parking lot)
- Keystore migration EXECUTION (doc-only per owner D-15)

</domain>

<decisions>
## Implementation Decisions

### Font load fix (F-09)
- **D-01:** `Promise.race([useFonts(...), timeout(8000)])` — silent fallback to system fonts after 8s. Sentry warn `font.load.timeout` for metric. Zero UX disruption.
- **D-02:** `timeout()` helper returns a no-op resolution (NOT a rejection) so `Promise.race` resolves cleanly and `setReady(true)` runs. UI continues with system font.
- **D-03:** No "Recarregar" UI fallback (option B rejected). System font fallback is invisible to user; race timeout is not.

### TabErrorBoundary `__DEV__` wrap (F-10)
- **D-04:** Wrap line 67-75 `error.message` display in `{__DEV__ && (...)}`. In production AAB, error message is hidden — only generic "Algo deu errado" visible.
- **D-05:** Sentry `captureError` still fires (no behavior change to error reporting). User-facing UI is what changes.
- **D-06:** Sequencing: implement F-10 only after P5's F-03 (Sentry DSN live in production) is committed. Otherwise prod errors are invisible AND unreported. Plan flags task with `depends_on: 05-XX-sentry-config` (or whichever plan owns F-03).

### Clerk Expo SDK CVE bump
- **D-07:** Bump `@clerk/clerk-expo` to `~2.19.36+` to patch GHSA-w24r-5266-9c3c.
- **D-08:** Regenerate lockfile via `npm run lock:fix` (NEVER `npm install` — per `project_eas_npm_lock` memory). Lock file must be `lockfileVersion: 3` (npm 10).
- **D-09:** Verify EAS preview build still authenticates (Google SSO produces valid JWT). Plan task is `owner-action: true` for the build trigger; verification can be inline if I can read the EAS build logs (likely cannot — owner verifies).

### CLERK_CLIENT_TRUST_REENABLE.md runbook detail level
- **D-10:** **Full runbook** following CRIALOOK-PLAY-READINESS.md §11. Sections:
  1. Pre-flight checks (Play approved? Sentry healthy 7d? auth tests green? compensating controls confirmed live?)
  2. Enable command + exact code change
  3. Monitoring metrics (Clerk auth success rate, Sentry auth-related errors, conversion funnel)
  4. Observation window (24h baseline → 7d sustained)
  5. Rollback step-by-step (revert code change, redeploy, monitor revert)
  6. Memory note update (delete `project_clerk_client_trust.md` after sustained pass)
- **D-11:** Doc lives at `crialook-app/docs/CLERK_CLIENT_TRUST_REENABLE.md` (NOT `.planning/` — production runbook, not phase artifact).

### Server-side compensating controls confirmation
- **D-12:** Researcher (in plan-phase) audits backend code for each of the 7 compensating controls (CRIALOOK-PLAY-READINESS.md §4). For each: confirm presence with `path:line` reference. Doc with refs at `crialook-app/docs/CLERK_TRUST_COMPENSATING_CONTROLS.md`.
- **D-13:** Doc structure: 7 controls × (description, code ref, last-verified date, owner). Becomes living checklist for re-enable pre-flight (D-10 step 1).
- **D-14:** If any control is MISSING in code: surface as plan task `owner-action: true` for backend fix (or as parking lot if outside M1 scope). Do NOT silently document gaps as "live".

### Keystore migration to EAS-managed
- **D-15:** Doc-only in M1. Plan writes `crialook-app/docs/EAS_KEYSTORE_MIGRATION.md` with steps: `eas credentials -p android` → `Migrate to EAS` → delete local copies → verify `eas build` works post-migration.
- **D-16:** Owner executes when ready (post-Play approval, low priority — not on critical path).

### Deep-link IDOR audit (CONCERNS §7)
- **D-17:** Researcher reads `app/(tabs)/gerar/resultado.tsx` and `historico.tsx`. Confirms no client-side rendering of data derived from URL params without an API re-fetch. If found, plan task wraps the read with auth-checked fetch.
- **D-18:** Add deep-link UUID validation test for `_layout.tsx:75-79` (regex check before navigating).

### Tests to add
- **D-19:** Tests use the now-stable jest infra (P3). Coverage thresholds were lowered in P3 (15-22% range) — P6 SHOULD raise back to D-10 spec (30/35) once these tests land. Plan task: after all new tests pass, raise thresholds in `vitest.config.ts` files.
- **D-20:** Test fixtures: synthesize Clerk JWTs (don't use real ones). Mock `useAuth()` per test.

### Claude's Discretion
- Exact `timeout()` helper implementation (lib/utils/ co-location vs inline)
- Font fallback list (system vs explicit Roboto/SF Pro)
- Mock setup for Clerk in new tests (per-test inline vs centralized in `__mocks__/`)

### Flagged for plan-phase research
- **R-01:** Confirm exact line of `useFonts` call in `AppFadeIn` (D-01 implementation)
- **R-02:** Confirm Clerk Expo SDK version currently in `crialook-app/package.json` (verify `^2.19.31` baseline)
- **R-03:** Read CRIALOOK-PLAY-READINESS.md §4 to enumerate the 7 compensating controls precisely (D-12 audit input)
- **R-04:** Confirm `_layout.tsx:75-79` current state for D-18 test target

</decisions>

<specifics>
## Specific Ideas

- "Silent fallback é melhor UX que UI fallback" — D-01 over option B
- "Runbook completo, owner segue cego pós-Play" — D-10
- "Confirma controls com refs no código, não trust+document" — D-12
- "Keystore doc-only, não bloqueia Play submission" — D-15
- "Coverage threshold raise back to D-10 spec when tests land" — D-19 follow-up to P3 caveat

</specifics>

<canonical_refs>
## Canonical References

### Phase scope sources
- `.planning/PROJECT.md` — Clerk Client Trust off; do not re-enable in M1
- `.planning/ROADMAP.md` §"Phase 6"
- `.planning/PHASE-DETAILS.md` §"Phase 6"

### Findings to address
- `.planning/audits/CRIALOOK-PLAY-READINESS.md` — F-09, F-10, §4 (compensating controls), §9 (test gaps), §11 (re-enable runbook)
- `.planning/codebase/CONCERNS.md` §1 (signing material — keystore part), §2 (Clerk Expo CVE; Client Trust off — plan only), §7 (deep-link IDOR)

### Phase 3 dependency (DONE — Sept commits 1537733..88b661a)
- Stable jest infra
- Mobile lint + coverage ratchet (Note: thresholds lowered in P3; D-19 raises back)

### Phase 5 dependency
- F-10 (D-04) gated on P5 F-03 (Sentry DSN live)
- Plan must explicitly sequence: F-10 task `depends_on` includes P5's F-03 task

### Out-of-M1
- Clerk Client Trust EXECUTION → post-Play
- iOS cleanup → parking
- e2e stack → parking
- Keystore migration EXECUTION → owner D-15 doc-only

</canonical_refs>

<code_context>
## Existing Code Insights

### Files this phase touches (researcher confirms exact paths)
- `crialook-app/components/AppFadeIn.tsx` — D-01 useFonts wrap
- `crialook-app/components/TabErrorBoundary.tsx` — D-04 __DEV__ wrap
- `crialook-app/app/_layout.tsx:75-79` — D-18 test target
- `crialook-app/app/(tabs)/gerar/resultado.tsx` + `historico.tsx` — D-17 audit
- `crialook-app/lib/__tests__/billing.test.ts` (new) — D-... billing test
- `crialook-app/lib/__tests__/auth.test.ts` (new) — D-... auth test
- `crialook-app/components/__tests__/ErrorBoundary.test.tsx` (new)
- `crialook-app/components/__tests__/TabErrorBoundary.test.tsx` (new)
- `crialook-app/package.json` — D-07 Clerk bump
- `crialook-app/package-lock.json` — D-08 lock:fix regen
- `crialook-app/docs/CLERK_CLIENT_TRUST_REENABLE.md` (new) — D-10
- `crialook-app/docs/CLERK_TRUST_COMPENSATING_CONTROLS.md` (new) — D-13
- `crialook-app/docs/EAS_KEYSTORE_MIGRATION.md` (new) — D-15
- `crialook-app/vitest.config.ts` — D-19 raise thresholds

### Established Patterns
- Tests in `crialook-app/lib/__tests__/` (vitest) — D-19 follows
- Tests in `crialook-app/components/__tests__/` (vitest with jsdom)
- Sentry mobile config (already exists; F-03 from P5 turns on full reporting)
- npm 10 lock requirement (memory) — D-08 enforces

</code_context>

<deferred>
## Deferred Ideas

- Actually re-enabling Clerk Client Trust → post-Play, out of M1
- Maestro/Detox e2e → parking lot
- F-11 delete-UX → Phase 7
- iOS section cleanup → parking lot
- Keystore migration EXECUTION (D-15 ships only the doc) → owner runs when ready
- Coverage threshold raise (D-19) is in scope, but raising further (e.g., 50%+) is parking lot

</deferred>

---

*Phase: 06-mobile-auth-stability-and-tests*
*Context gathered: 2026-05-04*
