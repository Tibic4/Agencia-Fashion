---
plan_id: 06-02
phase: 6
title: Font-load timeout via Promise.race in app/_layout.tsx (8s silent fallback to system font; F-09)
wave: 1
depends_on: []
owner_action: false
files_modified:
  - crialook-app/app/_layout.tsx
autonomous: true
requirements: ["D-01", "D-02", "D-03", "F-09"]
must_haves:
  truths:
    - "useFonts call site (currently app/_layout.tsx:260) is wrapped in a Promise.race with an 8000ms no-op timeout helper"
    - "the timeout helper RESOLVES (does not reject) so the race always settles cleanly and `setReady(true)` / `appReady = true` runs"
    - "Sentry.captureMessage or addBreadcrumb fires with tag font.load.timeout when the timeout wins (instrumentation, not error)"
    - "no UI fallback / Recarregar button is added (D-03 explicitly rejects option B)"
    - "the 12s SPLASH_SAFETY_TIMEOUT_MS at line 70-73 is preserved unchanged (independent safety net)"
    - "no other behavior in _layout.tsx changes — AuthGate, AppFadeIn props, providers tree all stay character-for-character identical except for the new font-race code"
  acceptance:
    - "grep -n 'font.load.timeout' crialook-app/app/_layout.tsx returns at least 1 line (Sentry tag string)"
    - "grep -nE 'Promise\\.race' crialook-app/app/_layout.tsx returns at least 1 line near the useFonts call"
    - "grep -nE 'SPLASH_SAFETY_TIMEOUT_MS *= *12_000' crialook-app/app/_layout.tsx still returns 1 line (safety net untouched)"
    - "node -e \"const c=require('fs').readFileSync('crialook-app/app/_layout.tsx','utf8'); process.exit(c.includes('useFonts')&&c.includes('Promise.race')&&c.includes('font.load.timeout')?0:1)\" exits 0"
    - "cd crialook-app && npx tsc --noEmit exits 0 (no type regression in _layout.tsx)"
    - "cd crialook-app && npm run lint exits 0"
---

# Plan 06-02: Font-load timeout race in `_layout.tsx`

## Objective

Patch finding F-09 (cold-start font hang). Currently `_layout.tsx:260-265` calls `useFonts(...)` and gates render on `loaded`. If the Inter font CDN flakes (slow EDGE network, transient `fonts.gstatic.com` outage, regional CDN edge issue), `loaded` stays false indefinitely, the safety-net at line 70-73 fires after 12s and the user sees a blank or flashed-error screen.

Per D-01 / D-02 / D-03: wrap the `useFonts(...)` promise in a `Promise.race` against an 8000ms **resolving** timeout. After 8s, the race resolves (regardless of whether fonts loaded), `appReady` flips true, AppFadeIn cross-fades in, and the UI paints with the system fallback font. User sees zero disruption — system font is invisibly substituted. Sentry fires a `font.load.timeout` breadcrumb / message so we can measure how often this fires in prod.

D-03 explicitly rejects option B (a "Recarregar" UI fallback) — silent fallback is better UX than a button the user can do nothing useful with.

## Truths the executor must respect

- `useFonts(...)` from `@expo-google-fonts/inter` returns a tuple `[loaded, error]`. The hook itself is synchronous from React's POV — it kicks off the load on mount and re-renders when the load resolves. We CANNOT race it directly because it's not a promise.
- The pattern: introduce a parallel `fontTimedOut` state that flips true after 8000ms via `setTimeout` (cleared on unmount or on `loaded` true). Then `appReady = loaded || fontTimedOut`. This achieves the same "race" semantics without having to refactor `useFonts` into a Promise.
- The Sentry breadcrumb / message must NOT be a `captureException` — this is observability, not an error. Use `Sentry.addBreadcrumb({ category: 'font.load', level: 'warning', message: 'font.load.timeout' })` followed by `Sentry.captureMessage('font.load.timeout', 'warning')` so it shows up as a metric event but doesn't pollute the error count.
- The existing 12s `SPLASH_SAFETY_TIMEOUT_MS` at line 70-73 stays. It is the LAST line of defense — covers cases where the JS thread is wedged before even the 8s timer can fire. Do NOT collapse the two; they protect against different failure modes.
- The existing `useEffect` at line 278-280 that throws if `useFonts` returns an error stays unchanged. If the font system itself errors (vs hanging), we still want AppErrorBoundary to catch.
- Do NOT touch `AppFadeIn.tsx`, `AuthGate`, `AppErrorBoundary`, or any other file. The change is contained to `_layout.tsx` between the `useFonts` call (line ~260) and the `appReady` assignment (line ~276).

## Tasks

### Task 1: Add font-load timeout race in `app/_layout.tsx`

<read_first>
- crialook-app/app/_layout.tsx (lines 1-90 for module-scope imports + safety net; lines 250-290 for the useFonts call site and appReady assignment)
- crialook-app/lib/sentry.ts (confirm Sentry.addBreadcrumb + Sentry.captureMessage are exported via the `Sentry` re-export)
- .planning/phases/06-mobile-auth-stability-and-tests/06-CONTEXT.md (D-01, D-02, D-03 — silent fallback, no UI button, breadcrumb tag exact string)
- .planning/audits/CRIALOOK-PLAY-READINESS.md F-09 section (font-load remediation)
</read_first>

<action>
In `crialook-app/app/_layout.tsx`:

1. Locate the `useFonts(...)` call at line ~260 and the `appReady = loaded` assignment at line ~276.

2. Add a `fontTimedOut` state hook IMMEDIATELY AFTER the `useFonts(...)` call (so it sits between the `useFonts` line and the `useEffect(() => { if (error) throw error; }, [error]);` block):

```tsx
  const [fontTimedOut, setFontTimedOut] = useState(false);

  // F-09 (D-01..D-03): silent fallback to system font after 8s if useFonts
  // hangs (CDN flake, slow EDGE network, regional fonts.gstatic.com edge
  // issue). Race semantics emulated via parallel timer flag because
  // useFonts itself isn't promise-shaped — we can't Promise.race the hook
  // directly. The 12s SPLASH_SAFETY_TIMEOUT_MS at module scope is a
  // separate, independent last-resort. Sentry breadcrumb + message tagged
  // `font.load.timeout` so we can measure how often this fires in prod.
  useEffect(() => {
    if (loaded) return;
    const t = setTimeout(() => {
      setFontTimedOut(true);
      try {
        Sentry.addBreadcrumb({
          category: 'font.load',
          level: 'warning',
          message: 'font.load.timeout',
        });
        Sentry.captureMessage('font.load.timeout', 'warning');
      } catch {
        /* never throw from observability path */
      }
    }, 8_000);
    return () => clearTimeout(t);
  }, [loaded]);
```

3. Update the `appReady` assignment from:

```tsx
  const appReady = loaded;
```

to:

```tsx
  const appReady = loaded || fontTimedOut;
```

4. Update the early-return guard from:

```tsx
  if (!loaded) return null;
```

to:

```tsx
  if (!appReady) return null;
```

(This keeps the existing "splash stays until ready" semantics but now `ready` includes the timeout fallback — the AppFadeIn cross-fade will trigger even on font timeout, painting with the system font.)

5. Leave the existing useEffect block (`useEffect(() => { if (error) throw error; }, [error]);`) UNCHANGED — font system errors still propagate to AppErrorBoundary.
</action>

<verify>
```bash
grep -n 'fontTimedOut' crialook-app/app/_layout.tsx
# Expect: state declaration line + appReady assignment line + at least one usage in useEffect

grep -n 'font.load.timeout' crialook-app/app/_layout.tsx
# Expect: 2 lines (addBreadcrumb message + captureMessage)

grep -n 'SPLASH_SAFETY_TIMEOUT_MS' crialook-app/app/_layout.tsx
# Expect: 2 lines unchanged (declaration at 70 + setTimeout at 71)

grep -n 'const appReady' crialook-app/app/_layout.tsx
# Expect: const appReady = loaded || fontTimedOut;
```
</verify>

### Task 2: TypeScript and lint sanity

<action>
From `crialook-app/`:

```bash
npx tsc --noEmit
npm run lint
```

Both must exit 0.
</action>

<verify>
```bash
cd crialook-app
npx tsc --noEmit 2>&1 | tail -5
# Expect: no errors

npm run lint 2>&1 | tail -5
# Expect: no errors (warnings OK)
```
</verify>

## Files modified

- `crialook-app/app/_layout.tsx` — add fontTimedOut state + useEffect timer + Sentry breadcrumb; update appReady and early-return guard

## Why this matters (risk if skipped)

Without this fix, a single bad day at `fonts.gstatic.com` (or a user on EDGE / 2G in a low-coverage area) bricks first-launch experience. The 12s safety net then forces splash hide and the app paints with the system font ANYWAY — but during those 12s the user is staring at a brand splash and may force-quit. With the 8s race, fallback happens 4s sooner AND we get a Sentry signal to measure prevalence (currently invisible). Cost-of-fix is ~15 lines; cost-of-skip is a non-trivial fraction of cold-start abandons that we can't even see today.
