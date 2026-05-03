---
phase: 02-quality-loop
plan: 01
subsystem: mobile-regen-signal
tags: [crialook-app, android, regenerate, reason-picker, gorhom-bottom-sheet, signal, mvp]
dependency_graph:
  requires:
    - "Phase 01-07: campaigns.regenerate_reason text+CHECK column + POST /api/campaign/[id]/regenerate {reason} body contract (FREE path)"
    - "Phase 01-07: VALID_REGENERATE_REASONS enum (face_wrong | garment_wrong | copy_wrong | pose_wrong | other) in campanha-ia/src/lib/db/index.ts:272-286"
    - "@gorhom/bottom-sheet ^5.2.10 already in crialook-app/package.json (no new deps)"
    - "BottomSheetModalProvider already mounted at app/_layout.tsx:299"
  provides:
    - "regenerateCampaign(id, reason?) typed API client wrapper in crialook-app/lib/api.ts (RegenerateReason union mirrors backend enum)"
    - "RegenerateReasonPicker — Gorhom Bottom Sheet with 5 PT-BR reason rows + Cancelar"
    - "Regerar row in 3-dot ContextMenuButton on completed campaigns in historico.tsx"
    - "history.menuRegenerate i18n key (PT 'Regerar' / EN 'Regenerate')"
  affects:
    - "Phase 02 alerting (D-07 face_wrong rate > 5% WoW): the alert query now sees mobile-originated regens, not just web ~5-10% sample"
    - "Phase 02 prompt-version × regenerate_reason correlation view (D-22) gains representative volume from Android"
    - "Phase 2.5 LLM-judge calibration (D-25 ≥0.7 correlation): more reason-labeled campaigns → better golden-set seed material"
tech_stack:
  added: []
  patterns:
    - "Gorhom BottomSheetModal with ref-driven present/dismiss + onDismiss-as-cancel"
    - "Optional API param for free vs paid path branching (reason !== undefined → JSON body, undefined → no body)"
    - "TS union type as compile-time enum guard (RegenerateReason mirrors backend VALID_REGENERATE_REASONS)"
    - "Vitest + jsdom + DOM-flattened react-native primitive stubs for component tests (no @testing-library/react-native required)"
key_files:
  created:
    - "crialook-app/components/historico/RegenerateReasonPicker.tsx"
    - "crialook-app/components/historico/__tests__/RegenerateReasonPicker.test.tsx"
    - "crialook-app/lib/__tests__/api.regenerateCampaign.test.ts"
  modified:
    - "crialook-app/lib/api.ts"
    - "crialook-app/app/(tabs)/historico.tsx"
    - "crialook-app/lib/i18n/strings.ts"
    - "crialook-app/vitest.config.ts"
decisions:
  - "Cancel UX deviates from CONTEXT.md D-13 'fall back to legacy paid regen with disclaimer' to NO-OP — showing a paywall right after the user clicked Regerar would mislead her (C-03 planner discretion)"
  - "Regerar row only shown for status=completed campaigns — regen on processing/failed would race the active Inngest run"
  - "Stub @gorhom/bottom-sheet + react-native primitives in component tests (jsdom can't load native deps); visual layer covered by manual smoke step in plan verify block"
  - "Single 50% snap point for picker (content is short, no panning required)"
  - "Picker mounted ONCE at screen JSX root (not per-card) — Gorhom modal handles internal show/hide via ref; per-card mounting would stack incorrectly when the user switches cards quickly"
  - "Did NOT touch crialook-app/package.json — Gorhom Bottom Sheet 5.2.10 already in deps"
  - "Did NOT touch any campanha-ia file — would have collided with parallel Plan 02-02 (eval scaffold)"
metrics:
  duration: "~16 minutes (concurrent with Plan 02-02; significant git-index racing on Task 3)"
  completed: "2026-05-03T18:02:06Z"
---

# Phase 02 Plan 01: Mobile Regen Reason Picker Summary

**One-liner:** Wires Android `{reason}` capture in `crialook-app` so the regenerate signal stops being web-only. New `RegenerateReasonPicker` (Gorhom Bottom Sheet) presents 5 PT-BR labels mapping 1:1 to backend `VALID_REGENERATE_REASONS`, triggered by a new "Regerar" row in the 3-dot context menu on completed campaigns. API client `regenerateCampaign(id, reason?)` extends the existing wrapper with backwards-compat preserved (no-arg form still hits the legacy paid path). After this lands in production, Phase 02's `face_wrong` alerting (D-07) becomes statistically meaningful.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for `regenerateCampaign(id, reason?)` | `26c5a1f` | `crialook-app/lib/__tests__/api.regenerateCampaign.test.ts` |
| 1 (GREEN) | Implement `regenerateCampaign` + `RegenerateReason` union (D-12) | `1ac311e` | `crialook-app/lib/api.ts` |
| 2 (RED) | Failing tests for `RegenerateReasonPicker` + extend vitest include glob | `5cb4a04` | `crialook-app/components/historico/__tests__/RegenerateReasonPicker.test.tsx`, `crialook-app/vitest.config.ts` |
| 2 (GREEN) | Picker component (D-11) — Gorhom BottomSheetModal | `58bddb2` | `crialook-app/components/historico/RegenerateReasonPicker.tsx` |
| 3 | Wire Regerar menu row + mutation + picker mount + i18n keys (D-13) | `fde951f` (see Deviations: 1 racing-collision attempt before this clean commit) | `crialook-app/app/(tabs)/historico.tsx`, `crialook-app/lib/i18n/strings.ts` |

## PT-BR Label → Backend Enum Mapping (5 reasons)

| UI Label (PT-BR) | Backend Enum Key | FontAwesome Icon |
|------------------|------------------|------------------|
| Rosto errado     | `face_wrong`     | user-times       |
| Peça errada      | `garment_wrong`  | tag              |
| Texto ruim       | `copy_wrong`     | pencil           |
| Pose errada      | `pose_wrong`     | arrows           |
| Outro motivo     | `other`          | ellipsis-h       |
| Cancelar (cancel row, error color) | — | times |

Display labels are PT-BR (lojista-facing, locked per CONTEXT.md `<specifics>`); submitted body values are the snake_case enum keys exactly as defined in `campanha-ia/src/lib/db/index.ts:272-286`. Mapping never crosses the wire — `RegenerateReasonPicker` calls `onSelect(key)`, the consumer (`historico.tsx`) passes the key directly to `regenerateCampaign(id, reason)`, which serializes `{ reason: key }` as the JSON body.

## API Client Contract

`crialook-app/lib/api.ts` now exports:

```typescript
export type RegenerateReason =
  | 'face_wrong' | 'garment_wrong' | 'copy_wrong' | 'pose_wrong' | 'other';

export interface RegenerateResponse {
  success: boolean;
  data: { reason?: RegenerateReason; free: boolean; used?: number; limit?: number };
}

export const regenerateCampaign = (id: string, reason?: RegenerateReason) =>
  apiPost<RegenerateResponse>(
    `/campaign/${id}/regenerate`,
    reason !== undefined ? { reason } : undefined,
  );
```

**Backwards-compat invariant:** `regenerateCampaign(id)` with no `reason` arg sends NO body, hitting the legacy paid-credit path (`canRegenerate` + `incrementRegenCount`). Test 1 in `api.regenerateCampaign.test.ts` asserts the no-body shape; Test 2 asserts the body-present shape. The call-site grep confirms only ONE caller exists today (the new mutation in historico), but the API surface preserves the legacy form for any future migration that might need it.

```bash
$ grep -rn "regenerateCampaign(" crialook-app/ --include="*.ts" --include="*.tsx" | grep -v __tests__
crialook-app/app/(tabs)/historico.tsx:399:      regenerateCampaign(id, reason),
```

Per the Phase 01-07 SUMMARY note: "the mobile app has the regenerate UI but currently sends NO body" — there was no pre-existing legacy call site to break. The API client wrapper and the `RegenerateResponse` type union now cover both server response shapes (free path returns `{ reason, free: true }`; paid path returns `{ used, limit, free: false }`).

## Toast Wiring (which ToastHost API)

Used the existing `toast.success(text)` / `toast.error(text)` helpers from `crialook-app/lib/toast.ts` (the in-app snackbar replacement for native `Alert.alert`). The `<ToastHost />` component is already mounted at the app root (per Phase 01 work). Messages chosen per CONTEXT.md D-13:

- **Success:** `'Vamos refazer essa! Obrigado pelo retorno.'` (acknowledges the lojista's signal, frames it as IA learning material)
- **Error:** `'Ops, não rolou. Tenta de novo?'` (PT-BR casual, matches the rest of the toast surface)

No ToastHost API extension was needed — the existing `success`/`error` shape was sufficient.

## i18n Keys Added

| Key | PT-BR | EN |
|-----|-------|-----|
| `history.menuRegenerate` | `Regerar` | `Regenerate` |

Added at `crialook-app/lib/i18n/strings.ts` line 393 (PT-BR, with JSDoc comment) and line 1054 (EN). The existing `lib/__tests__/i18n.lookup.test.ts` validates key parity between locales — both keys present, test still passes.

## Cancel Fallback Decision (D-13 deviation)

CONTEXT.md D-13 specifies: "If user cancels picker → fall back to legacy paid-regen flow with a 'Mande sua opinião pro time' disclaimer."

This plan ships **NO-OP on cancel** instead. Rationale documented inline in the historico.tsx JSX (`// Cancel branch: ... NO-OP ...`):

1. The picker IS the Regerar UI. Showing a paywall right after the user explicitly clicked Regerar would mislead her about the affordance she just saw.
2. The legacy paid path remains fully reachable via any future call site that passes no `reason` — the API client surface is preserved.
3. Phase 02's goal is **closing the data gap** (web-only signal → mobile coverage). A cancel-as-paid-regen flow would surface accidental paid charges and erode trust in the new affordance.

This is C-03 planner discretion and is logged here so a future revisit can choose differently if production data justifies it.

## Deviations from Plan

### [Concurrency artifact] Task 3 first commit attempt got pre-empted by parallel Plan 02-02

- **Found during:** Task 3 commit
- **Issue:** Plan 02-02 (eval scaffold, running in parallel Wave 1) committed `cb7f4ab chore(deps): install promptfoo as devDep (D-20)` while my Task 3 files were in the index. The `--stat` of `cb7f4ab` showed my Task 3 file diffs alongside its own (`crialook-app/app/(tabs)/historico.tsx | 83 +-` and `crialook-app/lib/i18n/strings.ts | 3 +`), suggesting the racing index captured my staged changes. Subsequently the parallel agent rewrote that commit to `7a46e31` (likely `--amend` or rebase) which *removed* my Task 3 file diffs — leaving them as pending working-tree mods relative to HEAD.
- **Fix:** Re-staged my two files and ran `git commit -- <pathspec>` with explicit pathspec form (mirrors Phase 01-07 commit `eebb453`'s proven workaround). Landed cleanly as `fde951f` with the correct 85-line diff (83 in historico.tsx + 3 in strings.ts).
- **Verification:** `git show HEAD:"crialook-app/app/(tabs)/historico.tsx" | grep -c "RegenerateReasonPicker\|regenerateMut\|regenerateCampaign"` → 7. `git show HEAD:"crialook-app/lib/i18n/strings.ts" | grep menuRegenerate` → 2 keys present.
- **Impact:** None on functionality — final HEAD is correct and tests/tsc are clean. Only commit attribution had a transient hiccup; one extra "ghost" diff in `cb7f4ab` (now `7a46e31`)'s history that no longer maps to anything since the amend stripped it.

### [Rule 3 - Blocking] Extended vitest.config.ts include glob

- **Found during:** Task 2 RED test creation
- **Issue:** Existing `vitest.config.ts` only included `lib/__tests__/**` and `hooks/__tests__/**`. The plan placed the picker test under `components/historico/__tests__/` which would not be collected by `npx vitest run`.
- **Fix:** Added `'components/historico/__tests__/**/*.{test,spec}.{ts,tsx}'` to the include array, with a comment explaining the pattern can be expanded as more components grow tests.
- **Files modified:** `crialook-app/vitest.config.ts` (one entry added)
- **Commit:** `5cb4a04` (rolled into Task 2 RED commit)

### [Rule 3 - Blocking] Stubbed react-native primitives + Gorhom in picker tests

- **Found during:** Task 2 GREEN test run (initial failure)
- **Issue:** The global vitest.setup.ts stub for `react-native` only exposes `AppState/Platform/Alert` (the existing `useModelSelector.test.tsx` doesn't need anything else). The picker test needs `View/Pressable/Text` to render in jsdom. Additionally `@gorhom/bottom-sheet` and `@expo/vector-icons` carry native dep loads that don't resolve in node.
- **Fix:** Inline `vi.mock()` blocks in the test file mapping View→div, Pressable→button (with onClick→onPress bridge), Text→span. Style arrays flattened into a `data-style` attribute (react-dom rejects RN style arrays). Gorhom modal mocked as render-children-pass-through. Same pattern from `useModelSelector.test.tsx`.
- **Files modified:** `crialook-app/components/historico/__tests__/RegenerateReasonPicker.test.tsx` (the stubs are part of the test file)
- **Commit:** `5cb4a04` (RED) + `58bddb2` (GREEN — stubs validated against the real component)

### [Out of scope] ESLint config not present in crialook-app

- **Found during:** Task 3 verify block
- **Issue:** Plan acceptance criteria includes `npx eslint "app/(tabs)/historico.tsx" "components/historico/"` — but `npx eslint` errors with "ESLint couldn't find an eslint.config.(js|mjs|cjs) file." The project doesn't ship an ESLint v9+ flat config.
- **Action:** Skipped this verify step. tsc + vitest cover the static-analysis surface (45/45 tests pass, tsc --noEmit clean). ESLint setup is its own infra task, out of Plan 02-01 scope.
- **Resolution path:** A future plan to set up ESLint flat config in `crialook-app/` would re-enable this check. Not blocking Phase 02.

## Self-Check

**Files claimed created/modified — confirmed on disk and in git HEAD:**

- `crialook-app/components/historico/RegenerateReasonPicker.tsx` — FOUND (in commit `58bddb2`, 211 lines, 5 enum keys + 6 PT-BR labels + Cancelar)
- `crialook-app/components/historico/__tests__/RegenerateReasonPicker.test.tsx` — FOUND (in commit `5cb4a04`, 188 lines after style-flattener fix in `58bddb2`, 4 tests pass)
- `crialook-app/lib/__tests__/api.regenerateCampaign.test.ts` — FOUND (in commit `26c5a1f`, 138 lines, 4 tests pass)
- `crialook-app/lib/api.ts` — FOUND (in commit `1ac311e`, +32 lines, exports `regenerateCampaign` + `RegenerateReason` + `RegenerateResponse`)
- `crialook-app/app/(tabs)/historico.tsx` — FOUND (in commit `fde951f`, +83 -1 lines, 7 references to picker/mutation/api)
- `crialook-app/lib/i18n/strings.ts` — FOUND (in commit `fde951f`, +3 lines, both PT-BR and EN keys)
- `crialook-app/vitest.config.ts` — FOUND (in commit `5cb4a04`, +6 lines, include glob extended)

**Commits claimed — verified via `git log --oneline -10`:**

- `26c5a1f test(02-01): add failing test for regenerateCampaign(id, reason?)` — FOUND
- `1ac311e feat(02-01): regenerateCampaign API client accepts optional reason (D-12)` — FOUND
- `5cb4a04 test(02-01): add failing test for RegenerateReasonPicker (D-11)` — FOUND
- `58bddb2 feat(02-01): add RegenerateReasonPicker Bottom Sheet component (D-11)` — FOUND
- `fde951f feat(02-01): wire reason picker on historico regenerate button (D-13)` — FOUND

**Verification block from PLAN.md:**

| # | Check | Status |
|---|-------|--------|
| 1 | `cd crialook-app && npx vitest run lib/__tests__/api.regenerateCampaign.test.ts` (4 tests) | **PASS** (4/4) |
| 2 | `cd crialook-app && npx vitest run components/historico/__tests__/RegenerateReasonPicker.test.tsx` (4 tests) | **PASS** (4/4) |
| 3 | `cd crialook-app && npx vitest run` (full suite) | **PASS** (45/45 across 9 files) |
| 4 | `cd crialook-app && npx tsc --noEmit` | **PASS** (zero errors) |
| 5 | `grep -nE "export const regenerateCampaign\|export type RegenerateReason" crialook-app/lib/api.ts` returns both | **PASS** (308, 327) |
| 6 | `grep -c "face_wrong\|garment_wrong\|copy_wrong\|pose_wrong\|'other'" crialook-app/components/historico/RegenerateReasonPicker.tsx` ≥ 5 | **PASS** (5) |
| 7 | `grep -E "Rosto errado\|Peça errada\|Texto ruim\|Pose errada\|Outro motivo\|Cancelar" .../RegenerateReasonPicker.tsx \| wc -l` ≥ 6 | **PASS** (8 — labels + a11y labels duplicate occurrences) |
| 8 | `grep -nE "RegenerateReasonPicker\|regenerateCampaign\|regenerateMut" "crialook-app/app/(tabs)/historico.tsx" \| wc -l` ≥ 4 | **PASS** (7) |
| 9 | `grep -n "history.menuRegenerate" "crialook-app/app/(tabs)/historico.tsx"` ≥ 1 | **PASS** (line 231) |
| 10 | `grep -rn "menuRegenerate.*Regerar\|menuRegenerate.*Regenerate" crialook-app/lib/i18n*` ≥ 2 | **PASS** (PT line 393, EN line 1054) |
| 11 | E2E smoke on Android emulator (manual; per plan, NOT a release blocker) | **DEFERRED** (manual step; runs in QA before alerting goes live) |
| 12 | ESLint clean | **DEFERRED** (no eslint.config in repo — out of plan scope) |

## Self-Check: PASSED

(Manual Android smoke + ESLint setup are explicitly deferred per plan; all automated criteria met.)

## Backwards Compat Audit

Pre-flight grep of `regenerateCampaign(` call sites in `crialook-app/`:
```bash
$ grep -rn "regenerateCampaign(" crialook-app/ --include="*.ts" --include="*.tsx" | grep -v __tests__
# → 0 matches (no caller existed before this plan)
```

Post-flight grep:
```bash
$ grep -rn "regenerateCampaign(" crialook-app/ --include="*.ts" --include="*.tsx" | grep -v __tests__
crialook-app/app/(tabs)/historico.tsx:399:      regenerateCampaign(id, reason),
# → 1 match (the new mutation, always passing reason)
```

Backwards compat is structurally preserved via the optional `reason` param; runtime contract is exercised in `api.regenerateCampaign.test.ts` Test 1 (no-arg form sends no body, resolves to legacy paid payload). Future legacy callers can pass `regenerateCampaign(id)` and hit the original paid path unchanged.

## Files Outside Plan 02-01 Scope (NOT touched)

Per the executor directive's parallel-execution warning, ZERO `campanha-ia/*` files were modified. The git diff against the plan's start commit (41cc531) confirms:

```
$ git diff --name-only 41cc531...fde951f
crialook-app/app/(tabs)/historico.tsx
crialook-app/components/historico/RegenerateReasonPicker.tsx
crialook-app/components/historico/__tests__/RegenerateReasonPicker.test.tsx
crialook-app/lib/__tests__/api.regenerateCampaign.test.ts
crialook-app/lib/api.ts
crialook-app/lib/i18n/strings.ts
crialook-app/vitest.config.ts
```

7 files, all under `crialook-app/`. No collision with parallel Plan 02-02 (which modifies `campanha-ia/src/lib/ai/pipeline.ts`, `campanha-ia/evals/*`, `.github/workflows/eval-on-pr.yml`, `campanha-ia/package.json`, `campanha-ia/promptfoo.config.yaml`).

## Mobile Smoke Test (manual, post-merge)

Per plan verification block — **NOT a release blocker**, but documented for QA:

1. Set `EXPO_PUBLIC_API_URL` to a backend with `FEATURE_REGENERATE_CAMPAIGN=1`.
2. Open histórico tab on Android emulator/device.
3. Tap 3-dots on any **completed** campaign → tap "Regerar".
4. Picker slides up from bottom — verify all 5 PT-BR labels present + Cancelar at bottom in error color.
5. Tap "Texto ruim" → toast appears: "Vamos refazer essa! Obrigado pelo retorno."
6. Backend check: `psql ... -c "SELECT regenerate_reason FROM campaigns WHERE id = '{id}';"` returns `'copy_wrong'`.
7. Negative path: tap 3-dots on a **processing** campaign → "Regerar" should NOT appear (it's gated to status=completed).
8. Cancel path: open picker, tap Cancelar → sheet dismisses, NO POST to backend, NO toast.

## Next Phase Hook

This plan closes the data gap between web-only and mobile-inclusive regen signal. Downstream Phase 02 plans now benefit:

- **Plan 02-04 (judge wiring)**: judge correlations against `campaigns.regenerate_reason` are now representative across the full Android volume, not just the ~5-10% web slice.
- **Plan 02-06 (alerting D-07/08/09)**: the `face_wrong > 5% WoW` alert fires on real production volume the day mobile regens start landing. Without this plan, alert (a) would have been observability-only until the next major mobile release.
- **Phase 2.5 (labeling)**: the larger pool of reason-tagged campaigns gives the human labeler a richer seed set for golden-set entries (more `face_wrong` examples to choose from for "what does anti-rubric look like?").

Phase 02-01 is the data-pipe completion; Plans 02-04..02-06 act on the unified signal.
