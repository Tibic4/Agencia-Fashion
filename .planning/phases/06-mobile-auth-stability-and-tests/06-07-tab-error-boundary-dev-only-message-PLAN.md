---
plan_id: 06-07
phase: 6
title: Wrap TabErrorBoundary error.message render in __DEV__ guard so production AAB hides raw exception text (F-10); depends on P5 Sentry DSN config
wave: 2
depends_on: ["05-02"]
owner_action: false
files_modified:
  - crialook-app/components/TabErrorBoundary.tsx
autonomous: true
requirements: ["D-04", "D-05", "D-06", "F-10"]
must_haves:
  truths:
    - "the <Text> rendering this.state.error.message in TabErrorBoundary.tsx is wrapped in __DEV__ guard so production AAB never shows it"
    - "the staleness comment block (currently lines 65-67 explaining 'Reverter pra __DEV__ depois que o EXPO_PUBLIC_SENTRY_DSN entrar no eas.json') is removed or shortened to a one-liner pointing to lib/sentry.ts"
    - "Sentry.captureException at line 41 (componentDidCatch) is unchanged — error reporting behavior identical"
    - "the user-facing 'Esta tela travou' title and 'Tentar de novo' button are unchanged"
    - "no other behavioral change in TabErrorBoundary — only the conditional render of error.message"
  acceptance:
    - "grep -nE '__DEV__.*error\\.message|error\\.message.*__DEV__' crialook-app/components/TabErrorBoundary.tsx returns at least 1 line"
    - "grep -c 'Reverter pra __DEV__' crialook-app/components/TabErrorBoundary.tsx returns 0 (stale comment removed)"
    - "grep -c 'Sentry.captureException' crialook-app/components/TabErrorBoundary.tsx returns 1 (unchanged)"
    - "cd crialook-app && npx tsc --noEmit exits 0"
    - "cd crialook-app && npm run lint exits 0"
---

# Plan 06-07: TabErrorBoundary `__DEV__` guard for error.message (F-10)

## Objective

Patch finding F-10. `TabErrorBoundary.tsx:67-75` currently renders `this.state.error.message` unconditionally, with a stale comment ("Reverter pra `__DEV__` depois que o EXPO_PUBLIC_SENTRY_DSN entrar no eas.json"). With Phase 05 plan 05-02 having landed Sentry DSN configuration in `eas.json` (production profile, `SENTRY_DISABLE_AUTO_UPLOAD: false`), the precondition is satisfied — error reports flow to Sentry server-side, so the user-facing UI no longer needs to leak the raw exception text.

Per D-04: wrap the `<Text>` in `{__DEV__ && (…)}`. In production AAB, only "Esta tela travou" + the "Tentar de novo" button are visible. Per D-05: Sentry capture at `componentDidCatch` (line 41) is UNCHANGED — error reporting behavior is identical, only the user-facing display changes.

## Truths the executor must respect

- **Dependency on 05-02 (P5):** This plan is gated on `crialook-app/eas.json` containing `EXPO_PUBLIC_SENTRY_DSN` per profile. P5 plan 05-02 (commit `791abda` per orchestrator note) landed that config layer. Verify before executing:

```bash
grep -c 'EXPO_PUBLIC_SENTRY_DSN' crialook-app/eas.json
# Expect: 3 (one per profile)
```

If grep returns 0, STOP — the precondition is not satisfied.

  Note that the actual end-to-end Sentry verification (real DSN replaces placeholder, build triggered, deliberate throw appears in Sentry dashboard) happens during owner's `PLAY_RELEASE_CHECKLIST` step 4 + step 11 — that's not a code change, it's an owner-action runtime confirmation. The CODE change in this plan is safe to land now because the DSN config is in place; the worst case if the placeholder isn't replaced in time is users see "Esta tela travou" without exception detail AND Sentry doesn't receive it — which is the same Class-of-failure as the current state, not worse.

- DO NOT change the Sentry.captureException call (line 41-44). DO NOT change the title text, button text, accessibility props, or styles. Only the conditional render of the `<Text>` block (currently lines 67-75) is touched, plus the stale comment cleanup.

- The current code (per executor's read of `TabErrorBoundary.tsx`):

```tsx
        {/* Mensagem visível em release enquanto Sentry DSN não está
            configurado nas builds preview. Reverter pra `__DEV__` depois
            que o EXPO_PUBLIC_SENTRY_DSN entrar no eas.json. */}
        {!!this.state.error.message && (
          <Text style={styles.errorText} numberOfLines={8} selectable>
            {this.state.error.message}
          </Text>
        )}
```

After this plan:

```tsx
        {/* DEV-only: error.message is information disclosure in production
            (API paths, internal IDs, stack hints). Sentry captureException
            in componentDidCatch handles prod reporting — see lib/sentry.ts. */}
        {__DEV__ && !!this.state.error.message && (
          <Text style={styles.errorText} numberOfLines={8} selectable>
            {this.state.error.message}
          </Text>
        )}
```

## Tasks

### Task 1: Verify P5 dependency is satisfied

<read_first>
- crialook-app/eas.json (focus on the env blocks of all 3 profiles — confirm EXPO_PUBLIC_SENTRY_DSN is present)
</read_first>

<action>
```bash
grep -c 'EXPO_PUBLIC_SENTRY_DSN' crialook-app/eas.json
# Expect: 3 (one in development.env, preview.env, production.env)
```

If the count is < 3, STOP and surface as blocker — P5 plan 05-02 must complete first.
</action>

<verify>
```bash
grep -nE 'EXPO_PUBLIC_SENTRY_DSN' crialook-app/eas.json
# Expect 3 lines, one per profile
```
</verify>

### Task 2: Wrap error.message render in `__DEV__` guard + clean up stale comment

<read_first>
- crialook-app/components/TabErrorBoundary.tsx (full file — focus lines 60-80 for the error.message render block)
- .planning/phases/06-mobile-auth-stability-and-tests/06-CONTEXT.md (D-04, D-05, D-06)
- .planning/audits/CRIALOOK-PLAY-READINESS.md F-10 finding (lines 159-161)
</read_first>

<action>
In `crialook-app/components/TabErrorBoundary.tsx`, locate this block (currently around lines 65-75):

```tsx
        {/* Mensagem visível em release enquanto Sentry DSN não está
            configurado nas builds preview. Reverter pra `__DEV__` depois
            que o EXPO_PUBLIC_SENTRY_DSN entrar no eas.json. */}
        {!!this.state.error.message && (
          <Text style={styles.errorText} numberOfLines={8} selectable>
            {this.state.error.message}
          </Text>
        )}
```

Replace it with EXACTLY:

```tsx
        {/* DEV-only: error.message is information disclosure in production
            (API paths, internal IDs, stack hints). Sentry captureException
            in componentDidCatch handles prod reporting — see lib/sentry.ts. */}
        {__DEV__ && !!this.state.error.message && (
          <Text style={styles.errorText} numberOfLines={8} selectable>
            {this.state.error.message}
          </Text>
        )}
```

Changes:
1. Comment text replaced (stale workaround note → DEV-only rationale).
2. `__DEV__ &&` added at the front of the conditional.

Nothing else in the file changes.
</action>

<verify>
```bash
grep -nE '__DEV__.*error\.message|error\.message.*__DEV__|__DEV__ && !!this\.state\.error\.message' crialook-app/components/TabErrorBoundary.tsx
# Expect: at least 1 line — the __DEV__ guard

grep -c 'Reverter pra __DEV__' crialook-app/components/TabErrorBoundary.tsx
# Expect: 0 (stale comment gone)

grep -c 'Sentry.captureException' crialook-app/components/TabErrorBoundary.tsx
# Expect: 1 (unchanged)

grep -c 'Esta tela travou' crialook-app/components/TabErrorBoundary.tsx
# Expect: 1 (title text unchanged)
```
</verify>

### Task 3: TypeScript + lint sanity

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
npm run lint 2>&1 | tail -5
# Both: no errors
```
</verify>

## Files modified

- `crialook-app/components/TabErrorBoundary.tsx` — wrap error.message in `__DEV__` guard, replace stale comment

## Owner-action runtime verification (not blocking this plan)

After this plan commits, the F-10 fix is verified end-to-end during owner's PLAY_RELEASE_CHECKLIST:

- **Step 4 (build):** Owner replaces the placeholder DSN in `eas.json` production env with the real Sentry DSN, triggers `eas build --profile production`. The build embeds the real DSN.
- **Step 11 (smoke test):** Owner runs the resulting AAB on a test device, deliberately triggers a tab crash (e.g. via a temporary `throw` in a screen), confirms:
  - User sees ONLY "Esta tela travou" + retry button — no raw error text.
  - Sentry dashboard receives the captured exception within 1-2 minutes.

If both bullets pass, F-10 is fully resolved. If only the first passes (no Sentry event), the issue is the DSN env var not actually reaching the build — checklist troubleshoot, NOT a regression of this plan.

## Why this matters (risk if skipped)

Without the `__DEV__` guard, every tab crash in production shows the user a raw stack-message which can include:
- Backend API paths (e.g. `Error: Failed to fetch /api/internal/foo`)
- Internal feature flag names (e.g. `TypeError: Cannot read properties of undefined (reading 'feature_x_enabled')`)
- Hermes stack hints with internal function names

This is information disclosure (CWE-209) AND bad UX (raw English/JS-jargon text in a Portuguese-language app). The fix is a 4-character addition (`__DEV__ && `).
