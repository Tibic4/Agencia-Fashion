# Clerk Client Trust — Re-enable Runbook

> **OUT OF M1 SCOPE — DO NOT EXECUTE THIS RUNBOOK YET.**
>
> Trigger: app is approved on Play Store production track AND has run for >=7 days with stable Sentry crash-free rate.
> Owner: project owner (`bicagold@gmail.com`). Backend confirmation required from `campanha-ia` team for pre-flight.
> Source: `.planning/audits/CRIALOOK-PLAY-READINESS.md` §11 (this runbook is the executable form).

## Why this runbook exists

Clerk Client Trust is currently **OFF** in production (per `MEMORY.md` `project_clerk_client_trust.md` and the inline comment at `crialook-app/lib/auth.tsx:38-43`). It was disabled to pass the Play Store review's posture of "client claims are not implicitly trusted". This trades ~100-400ms per `getToken()` call for stronger defense-in-depth.

When the app is approved on Play Store production track AND has run stably for 7+ days, this perf cost should be reclaimed by re-enabling Client Trust — the 7 server-side compensating controls (see `CLERK_TRUST_COMPENSATING_CONTROLS.md`) remain the security floor regardless. Client Trust is a perf optimization on top of that floor, not a security boundary.

This runbook captures every step. Follow it linearly; do not improvise.

## Pre-flight checks (REQUIRED before flipping anything)

Pre-flight passes ONLY when ALL of the following are confirmed:

### PF-1 — Play Store approval

- App is approved on Play Store **production** track (not internal / closed / open testing).
- At least 7 days have elapsed since production-track approval.
- Crash-free session rate >= 99% over the last 7 days (Sentry → Releases → crash-free sessions metric).

### PF-2 — Sentry healthy

- `EXPO_PUBLIC_SENTRY_DSN` is configured and emitting events in production. Confirm via Sentry → Issues → "Last seen" within the last 24h.
- `SENTRY_AUTH_TOKEN` is provisioned in EAS env so source maps upload on production builds (per `eas.json` production profile, `SENTRY_DISABLE_AUTO_UPLOAD: "false"`).
- No P0 / P1 unresolved Sentry issues tagged `auth` or `clerk`.

### PF-3 — Auth tests green

- `crialook-app/lib/__tests__/auth.test.ts` (added in Phase 06 — plan 06-09) passes locally and in CI.
- `crialook-app/lib/__tests__/billing.test.ts` (added in Phase 06 — plan 06-08) passes locally and in CI.
- The full `npm test` suite is green at HEAD on `main`.

### PF-4 — Compensating controls confirmed LIVE

- Re-walk `crialook-app/docs/CLERK_TRUST_COMPENSATING_CONTROLS.md`. ALL 7 controls must be marked LIVE.
- ANY control marked MISSING or PARTIAL is a hard blocker. Close the gap in the backend BEFORE flipping Client Trust.
- Per the 2026-05-04 audit, controls 2 (rate-limit on /billing/verify+restore) and 3 (obfuscatedAccountIdAndroid hash binding) are MISSING. These MUST be implemented before pre-flight passes.
- Get written sign-off from the `campanha-ia` team that the controls are still in place (refactor drift can move things between the doc's last-verified date and now).
- Update the "Last verified" date on each row of `CLERK_TRUST_COMPENSATING_CONTROLS.md` to today.

### PF-5 — Baseline metrics captured

- Take a snapshot BEFORE flipping:
  - Avg `getToken()` round-trip count per session (from Sentry transactions or backend logs).
  - P50 / P95 / P99 latency for any authed API call (e.g. `/store`, `/campaigns`).
  - Sign-in latency (cold start to home screen).
  - Clerk Dashboard → Sessions → Hourly graph for the past 7 days (screenshot).
- Save these to a `PRE_REENABLE_BASELINE_$(date).md` alongside this runbook so post-enable comparison has a reference.

If PF-1..PF-5 are ALL green, proceed. Otherwise STOP and resolve the failing precondition.

## Enable

Per `CRIALOOK-PLAY-READINESS.md` §11 lines 391-394, the actual enable is a Clerk Dashboard toggle — **no app code change required**:

1. Sign in to Clerk Dashboard (production instance).
2. Navigate to **Sessions → Token settings**.
3. Enable the **"Client Trust"** toggle (exact UI label may differ; confirm with current Clerk docs at the time).
4. Save.

The Clerk SDK in the app adapts to the dashboard setting transparently. The 30s `jwtCache` in `lib/auth.tsx:117-135` continues to provide additional client-side caching on top of Clerk's now-trusted client state.

NO mobile code deploy is required to enable. The change takes effect on the next session refresh per device.

## Post-enable monitoring (first 72h)

Set up Sentry alerts BEFORE flipping (in PF-5) so they fire as soon as data flows.

### M-1 — 401 spike alert

- **What:** Spike in 401 responses on authed endpoints — signals client-server view mismatch.
- **Threshold:** >0.5% of authed requests over a rolling 1h window.
- **Action on alert:** Roll back (see Rollback section).

### M-2 — Forced sign-out spike

- **What:** Spike in `signOut` events from `lib/auth.tsx:62-68` (which is called on session loss).
- **Threshold:** >2x the baseline rate over a rolling 1h window.
- **Action on alert:** Roll back.

### M-3 — Performance confirmation

- **What:** Avg `getToken()` round-trips per session should drop by ~60-80% (the whole point).
- **Where:** Sentry transactions or backend access logs filtered on Clerk JWKS endpoint hits.
- **Action if NOT seen:** Investigate before celebrating — if round-trips didn't drop, the Dashboard toggle didn't take effect.

### M-4 — Cold-start latency

- **What:** Auth init time should drop by 1-2s (from baseline captured in PF-5).
- **Where:** Sentry → Performance → "App start" transactions.

### M-5 — Crash-free rate

- **What:** Crash-free session rate must stay at or above pre-flip baseline (>=99%).
- **Where:** Sentry → Releases → crash-free sessions.
- **Action if drops below 99%:** Roll back immediately.

## Observation window

- **0-24h:** Active monitoring. Owner checks Sentry every 4-6h. Any M-1, M-2, or M-5 alert → immediate rollback.
- **24h-7d:** Daily check-in. Compare M-3 and M-4 against baseline. Confirm gains are real and sustained.
- **7d sustained pass:** Proceed to Memory Updates section. Client Trust is now permanently on.

## Knobs to consider after sustained pass (optional, not blocking)

These tightenings make sense once Client Trust is proven stable but are not required for the re-enable itself. Open them as small follow-up tickets:

- **Reduce `INIT_TIMEOUT_MS` in `lib/auth.tsx:43` from 6000 → 3000ms.** With Client Trust on, hydration is fast enough that 6s tolerance is excessive.
- **Reduce `TOKEN_TTL_MS` in `lib/auth.tsx:118` from 30_000 → 15_000ms.** Cheap refresh under Client Trust = less reason to cache aggressively.

These are independent improvements; do not do them in the same change as the enable.

## Rollback plan

If anything goes wrong (M-1, M-2, or M-5 alert fires):

1. Clerk Dashboard → Sessions → Token settings → toggle Client Trust **OFF**.
2. **No app deploy needed.** App reads the dashboard state on next session refresh (typically within 30s for users on the app, on next cold start for backgrounded apps).
3. Within 15 min, re-check M-1 / M-2 / M-5 — alerts should clear.
4. Update `MEMORY.md` `project_clerk_client_trust.md` with rollback rationale (which alert fired, observed metric values, hypothesized cause).
5. File a follow-up ticket to investigate root cause before next re-enable attempt.

## Memory updates (after 7d sustained pass)

Once the observation window completes cleanly:

1. **Update `project_clerk_client_trust.md`:**
   - Date of re-enable.
   - Observed metric deltas (latency drop, 401 rate stability).
   - Outcome ("kept on" — if rolled back, document that instead and KEEP the memory file).
   - On a successful sustained pass: change the memory note from "Client Trust off" to "Client Trust on as of [date], baseline metrics in PRE_REENABLE_BASELINE_*.md". Optionally delete the memory file once the deprecation date is more than 90 days old.

2. **Remove the inline comment block in `lib/auth.tsx:38-43`** (or shorten to a one-liner pointing to the memory file). This is purely cosmetic — comment cleanup once the underlying issue is resolved.

3. **Optionally remove the `_layout.tsx:25-31` Sentry session replay comment.** Independent of Client Trust but the codebase has accumulated these "why this defensive setup exists" notes; they read as noise once the underlying issue is gone.

## What does NOT need to change

These are independent of Client Trust and stay regardless:

- The 401-retry-once path in `lib/api.ts:178-183` — handles any short-lived token desync.
- The in-memory `jwtCache` in `lib/auth.tsx:117-135` — orthogonal optimization (in-process only) and continues to reduce SDK calls inside a single render cycle.
- All 7 backend compensating controls — they were never optional. Client Trust is a perf knob; the controls are the security floor.

## References

- `.planning/audits/CRIALOOK-PLAY-READINESS.md` §11 (source of this runbook)
- `crialook-app/docs/CLERK_TRUST_COMPENSATING_CONTROLS.md` (PF-4 input)
- `MEMORY.md` `project_clerk_client_trust.md` (the memory file this runbook eventually deprecates)
- `crialook-app/lib/auth.tsx:38-43` (inline comment block to clean up post-pass)
- `crialook-app/lib/auth.tsx:117-135` (jwtCache + TOKEN_TTL_MS knob)
- `crialook-app/lib/auth.tsx:43` (INIT_TIMEOUT_MS knob)
