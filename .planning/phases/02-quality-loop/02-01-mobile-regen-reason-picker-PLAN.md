---
phase: 02-quality-loop
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - crialook-app/components/historico/RegenerateReasonPicker.tsx
  - crialook-app/lib/api.ts
  - crialook-app/app/(tabs)/historico.tsx
autonomous: true
requirements: [D-11, D-12, D-13, D-14]

must_haves:
  truths:
    - "Lojista pode tocar 'Regerar' no menu 3-pontos de qualquer campanha do histórico"
    - "Picker abre com 5 opções PT-BR (Rosto errado / Peça errada / Texto ruim / Pose errada / Outro motivo) e botão Cancelar"
    - "Selecionar uma opção dispara POST /api/campaign/[id]/regenerate com body {reason} e mostra toast de sucesso"
    - "Se picker é cancelado, NENHUM POST é disparado (Phase 02 só ativa o fluxo gratuito de captura de razão; pago legacy é fora de escopo desse plano)"
    - "Reasons enviadas batem 1:1 com VALID_REGENERATE_REASONS do backend (face_wrong | garment_wrong | copy_wrong | pose_wrong | other)"
  artifacts:
    - path: "crialook-app/components/historico/RegenerateReasonPicker.tsx"
      provides: "Gorhom Bottom Sheet com 5 opções + cancelar; props (visible, onSelect, onCancel)"
    - path: "crialook-app/lib/api.ts"
      provides: "regenerateCampaign(id, reason?) — backwards-compat (existing callers passam undefined)"
    - path: "crialook-app/app/(tabs)/historico.tsx"
      provides: "Nova MenuRow 'Regerar' no ContextMenuButton + state pra abrir RegenerateReasonPicker"
  key_links:
    - from: "crialook-app/app/(tabs)/historico.tsx"
      to: "crialook-app/components/historico/RegenerateReasonPicker.tsx"
      via: "import + render condicional baseado em selectedCampaignForRegen state"
      pattern: "RegenerateReasonPicker"
    - from: "crialook-app/components/historico/RegenerateReasonPicker.tsx"
      to: "crialook-app/lib/api.ts → regenerateCampaign"
      via: "onSelect callback chama mutation que invoca regenerateCampaign(id, reason)"
      pattern: "regenerateCampaign\\(.*reason"
---

<objective>
Wire the mobile `{reason}` capture loop. Today the regenerate-reason signal only fires from the web admin (~5-10% of total volume per CONTEXT.md `<scope>`). After this plan, every regen on Android sends a reason — closing the data gap that makes Phase 02's `face_wrong` alert (D-07) statistically meaningful. Implements D-11 (picker component), D-12 (API client wrapper sends `{reason}` matching backend enum), D-13 (UX flow with toast), D-14 (Android-only — no iOS work, per memory `crialook-app é Android-only`).

Purpose: Stop the alerting signal from being web-only.
Output: New `RegenerateReasonPicker.tsx`, extended `lib/api.ts` with `regenerateCampaign(id, reason?)`, new "Regerar" row in the existing 3-dot context menu in `historico.tsx`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-quality-loop/02-CONTEXT.md
@.planning/phases/01-ai-pipeline-hardening/01-AI-SPEC.md

<interfaces>
<!-- Backend contract (already shipped Phase 01, do NOT modify) -->

From campanha-ia/src/lib/db/index.ts:272-286 (the closed enum):
```typescript
export const VALID_REGENERATE_REASONS = [
  "face_wrong",
  "garment_wrong",
  "copy_wrong",
  "pose_wrong",
  "other",
] as const;
export type RegenerateReason = (typeof VALID_REGENERATE_REASONS)[number];
```

From campanha-ia/src/app/api/campaign/[id]/regenerate/route.ts (POST):
- Body shape (reason path): `{ "reason": "face_wrong" | "garment_wrong" | "copy_wrong" | "pose_wrong" | "other" }`
- Success response: `{ success: true, data: { reason, free: true } }`
- Error response: `{ error, code: "INVALID_REASON" | "FEATURE_DISABLED", validReasons }`
- Feature gate: env `FEATURE_REGENERATE_CAMPAIGN=1` must be on; off → 404. Do NOT silently swallow 404 in the mobile UI — surface as toast "Regeneração não disponível".

From crialook-app/lib/api.ts (already exported):
```typescript
export const apiPost: <T = unknown>(path: string, body?: unknown, options?: ApiOptions<T>) => Promise<T>;
```

From crialook-app/components/CreateModelSheet.tsx + ModelBottomSheet.tsx:
These are the existing precedents for how the project uses `@gorhom/bottom-sheet` (`^5.2.10` in package.json). Read one of them to mirror the BottomSheet/BottomSheetModal API + the snapPoints pattern + the backdrop component.
</interfaces>

@crialook-app/lib/api.ts
@crialook-app/app/(tabs)/historico.tsx
@crialook-app/components/ModelBottomSheet.tsx
@campanha-ia/src/lib/db/index.ts
@campanha-ia/src/app/api/campaign/[id]/regenerate/route.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add regenerateCampaign(id, reason?) to lib/api.ts</name>
  <files>crialook-app/lib/api.ts, crialook-app/lib/__tests__/api.regenerateCampaign.test.ts</files>
  <read_first>
    - crialook-app/lib/api.ts (the file being modified — read the existing apiPost / apiPatch shape lines 270-285)
    - campanha-ia/src/lib/db/index.ts:272-286 (VALID_REGENERATE_REASONS enum — copy the union exactly)
    - campanha-ia/src/app/api/campaign/[id]/regenerate/route.ts:96-99 (success response shape)
    - .planning/phases/02-quality-loop/02-CONTEXT.md `<specifics>` Mobile picker labels block
  </read_first>
  <behavior>
    - Test 1: `regenerateCampaign(id)` (no reason) → calls `apiPost('/campaign/{id}/regenerate', undefined)` (legacy paid path; mocked to return `{success: true, data: {used: 1, limit: 3, free: false}}`); resolves with that payload.
    - Test 2: `regenerateCampaign(id, 'face_wrong')` → calls `apiPost('/campaign/{id}/regenerate', { reason: 'face_wrong' })`; resolves with `{success: true, data: {reason: 'face_wrong', free: true}}`.
    - Test 3: TypeScript-level — passing an unknown reason string must fail to compile (assert via `// @ts-expect-error` line in the test); the union type is the gate.
    - Test 4: backend returns 400 with `code: 'INVALID_REASON'` → ApiError surfaces with `code: 'BAD_REQUEST'` (mapped by classifyStatus); test asserts the rejection.
  </behavior>
  <action>
    Append a new exported function at the end of `crialook-app/lib/api.ts` (after `apiFetchRaw`, before the final `export { ApiError }` line at 301):

    ```typescript
    // ─── Regenerate (Phase 02 D-12) ──────────────────────────────────────
    /**
     * Mirror of campanha-ia VALID_REGENERATE_REASONS. Keep this union in sync
     * by hand — backend is the source of truth (see
     * campanha-ia/src/lib/db/index.ts:272-286). A future codegen step is
     * possible but not in Phase 02 scope.
     */
    export type RegenerateReason =
      | 'face_wrong'
      | 'garment_wrong'
      | 'copy_wrong'
      | 'pose_wrong'
      | 'other';

    export interface RegenerateResponse {
      success: boolean;
      data: { reason?: RegenerateReason; free: boolean; used?: number; limit?: number };
    }

    /**
     * D-12 (Phase 02 quality-loop): POST regenerate with optional reason.
     * - reason supplied → backend takes the FREE reason-capture path (D-03 Phase 01)
     *   and persists campaigns.regenerate_reason. Used by the 5-option picker.
     * - reason undefined → legacy paid path (consumes a regen credit). Kept for
     *   backwards-compat with any existing call site that hasn't been migrated yet.
     */
    export const regenerateCampaign = (id: string, reason?: RegenerateReason) =>
      apiPost<RegenerateResponse>(
        `/campaign/${id}/regenerate`,
        reason !== undefined ? { reason } : undefined,
      );
    ```

    Then create `crialook-app/lib/__tests__/api.regenerateCampaign.test.ts` covering the 4 behavior cases. Mock `fetch` globally (vi.stubGlobal('fetch', vi.fn())) and assert call shape via the recorded args. Mirror the mocking style from `crialook-app/hooks/__tests__/useModelSelector.test.tsx` (already present per git status).

    Note (per memory `EAS build expects npm 10 lock`): this task does NOT add new dependencies — Vitest is already configured. Do NOT touch package.json. If for any reason a dep is added, run `npm run lock:fix` from `crialook-app/`, never plain `npm install`.
  </action>
  <acceptance_criteria>
    - `grep -nE "export const regenerateCampaign|export type RegenerateReason" crialook-app/lib/api.ts` returns both lines.
    - `cd crialook-app && npx tsc --noEmit` succeeds (no type errors).
    - `cd crialook-app && npx vitest run lib/__tests__/api.regenerateCampaign.test.ts` passes all 4 tests.
    - `grep -c '@ts-expect-error' crialook-app/lib/__tests__/api.regenerateCampaign.test.ts` returns 1 (TS-level guard test exists).
  </acceptance_criteria>
  <verify>
    <automated>cd crialook-app && npx vitest run lib/__tests__/api.regenerateCampaign.test.ts && npx tsc --noEmit</automated>
  </verify>
  <done>regenerateCampaign exported with typed reason union; backwards-compat preserved; 4 tests green; tsc clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create RegenerateReasonPicker component (Gorhom Bottom Sheet)</name>
  <files>crialook-app/components/historico/RegenerateReasonPicker.tsx, crialook-app/components/historico/__tests__/RegenerateReasonPicker.test.tsx</files>
  <read_first>
    - crialook-app/components/ModelBottomSheet.tsx (the reference for `@gorhom/bottom-sheet` API in this project — backdrop + snapPoints + ref pattern)
    - crialook-app/components/ConfirmSheet.tsx (lighter precedent for action-sheet UX with cancel)
    - crialook-app/lib/api.ts (RegenerateReason union just added in Task 1 — import it)
    - .planning/phases/02-quality-loop/02-CONTEXT.md `<specifics>` Mobile picker labels (PT-BR exact strings)
    - C:\Users\bicag\.claude\projects\d--Nova-pasta-Agencia-Fashion\memory\project_android_only.md (memory: do NOT add iOS-specific paths/props)
  </read_first>
  <behavior>
    - Test 1: When `visible=true`, sheet renders with exactly 5 reason rows + 1 cancel row. Labels (PT-BR, exact): "Rosto errado", "Peça errada", "Texto ruim", "Pose errada", "Outro motivo", "Cancelar".
    - Test 2: Tapping "Rosto errado" calls `onSelect('face_wrong')`. Tapping "Peça errada" → `onSelect('garment_wrong')`. Tapping "Texto ruim" → `onSelect('copy_wrong')`. Tapping "Pose errada" → `onSelect('pose_wrong')`. Tapping "Outro motivo" → `onSelect('other')`.
    - Test 3: Tapping "Cancelar" calls `onCancel` and does NOT call `onSelect`.
    - Test 4: Each reason row has accessibilityLabel set (FontAwesome icon-only would fail a11y; rows are text-with-icon — assert the testID + accessible role).
  </behavior>
  <action>
    Create `crialook-app/components/historico/RegenerateReasonPicker.tsx`. It is a Gorhom Bottom Sheet (NOT a React Native `Modal` — the project standard for action sheets is `@gorhom/bottom-sheet@^5.2.10`, already in deps; mirror the API from `crialook-app/components/ModelBottomSheet.tsx`).

    Props (exported `RegenerateReasonPickerProps`):
    ```typescript
    import type { RegenerateReason } from '@/lib/api';
    interface RegenerateReasonPickerProps {
      visible: boolean;
      onSelect: (reason: RegenerateReason) => void;
      onCancel: () => void;
    }
    ```

    Internal label map (PT-BR — exact strings, do NOT translate, do NOT add new options):
    ```typescript
    const REASONS: Array<{ key: RegenerateReason; label: string; icon: React.ComponentProps<typeof FontAwesome>['name'] }> = [
      { key: 'face_wrong',    label: 'Rosto errado',  icon: 'user-times' },
      { key: 'garment_wrong', label: 'Peça errada',   icon: 'tag' },
      { key: 'copy_wrong',    label: 'Texto ruim',    icon: 'pencil' },
      { key: 'pose_wrong',    label: 'Pose errada',   icon: 'arrows' },
      { key: 'other',         label: 'Outro motivo',  icon: 'ellipsis-h' },
    ];
    ```

    Snap points: `['50%']` (single snap; sheet auto-dismisses on backdrop tap calling `onCancel`). Use `BottomSheetModal` + `BottomSheetBackdrop` per the ModelBottomSheet.tsx pattern. Render rows as `<Pressable>` with `accessibilityRole="button"` + `accessibilityLabel={label}`. Wrap label with `<Text>` from `@/components/Themed` if that import exists in the project (mirror `ConfirmSheet.tsx`); otherwise use `react-native` Text.

    Cancel row: visually distinct (text color = `Colors.brand.error` or the equivalent the codebase uses — read `ConfirmSheet.tsx` for the destructive-row pattern). Cancel calls `onCancel` then `dismiss()` on the sheet ref.

    Do NOT add any iOS-specific props/paths (memory `crialook-app é Android-only`). Do NOT add new package dependencies — Gorhom Bottom Sheet is already at `^5.2.10` per `crialook-app/package.json:27`.

    Then create the test file `crialook-app/components/historico/__tests__/RegenerateReasonPicker.test.tsx` covering the 4 behavior cases. Use `@testing-library/react-native` (mirror style of `crialook-app/hooks/__tests__/useModelSelector.test.tsx`). Mock `@gorhom/bottom-sheet` if its native deps don't load in node env — provide a thin stub that renders children directly (pattern: `vi.mock('@gorhom/bottom-sheet', () => ({ BottomSheetModal: ({children}) => children, BottomSheetBackdrop: () => null, BottomSheetView: ({children}) => children, BottomSheetModalProvider: ({children}) => children }))`).
  </action>
  <acceptance_criteria>
    - File `crialook-app/components/historico/RegenerateReasonPicker.tsx` exists and exports `RegenerateReasonPicker` + `RegenerateReasonPickerProps`.
    - `grep -c "face_wrong\|garment_wrong\|copy_wrong\|pose_wrong\|'other'" crialook-app/components/historico/RegenerateReasonPicker.tsx` ≥ 5 (each reason key present).
    - `grep -E "Rosto errado|Peça errada|Texto ruim|Pose errada|Outro motivo|Cancelar" crialook-app/components/historico/RegenerateReasonPicker.tsx | grep -v '^#' | wc -l` ≥ 6 (all 6 PT-BR labels present).
    - `cd crialook-app && npx vitest run components/historico/__tests__/RegenerateReasonPicker.test.tsx` passes all 4 tests.
    - `cd crialook-app && npx tsc --noEmit` clean.
  </acceptance_criteria>
  <verify>
    <automated>cd crialook-app && npx vitest run components/historico/__tests__/RegenerateReasonPicker.test.tsx && npx tsc --noEmit</automated>
  </verify>
  <done>Picker component renders 5 reason rows + cancel; selection callbacks fire with correct enum values; tests green.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Wire "Regerar" menu row in historico.tsx ContextMenuButton</name>
  <files>crialook-app/app/(tabs)/historico.tsx</files>
  <read_first>
    - crialook-app/app/(tabs)/historico.tsx (the file being modified — read lines 132-237 for ContextMenuButton + MenuRow shape; lines 282-465 for HistoricoScreenInner state + mutations; lines 738-758 for where ContextMenuButton is rendered per card)
    - crialook-app/components/historico/RegenerateReasonPicker.tsx (just created in Task 2)
    - crialook-app/lib/api.ts (regenerateCampaign + RegenerateReason from Task 1)
    - .planning/phases/02-quality-loop/02-CONTEXT.md decisions D-13 + D-14
  </read_first>
  <action>
    Modify `crialook-app/app/(tabs)/historico.tsx`:

    1. **Add import** at the top of the existing imports block:
       ```typescript
       import { regenerateCampaign, type RegenerateReason } from '@/lib/api';
       import { RegenerateReasonPicker } from '@/components/historico/RegenerateReasonPicker';
       ```

    2. **Extend ContextMenuButtonProps** (around line 133) to accept `onRegenerate?: () => void` (optional like `onDelete`).

    3. **Inside ContextMenuButton's <Modal>** body (between the existing Share row at line 209 and the optional Delete row at line 221), add a new MenuRow when `onRegenerate` is supplied:
       ```tsx
       {onRegenerate && (
         <MenuRow
           icon="refresh"
           label={t('history.menuRegenerate')}
           color={textColor}
           onPress={() => {
             close();
             onRegenerate();
           }}
         />
       )}
       ```

    4. **Inside `HistoricoScreenInner`** (around line 283), add picker state:
       ```typescript
       const [pickerCampaignId, setPickerCampaignId] = useState<string | null>(null);
       ```

    5. **Add the regenerate mutation** (mirror the existing `toggleFavoriteMut` pattern at lines 338-359):
       ```typescript
       const regenerateMut = useMutation({
         mutationFn: ({ id, reason }: { id: string; reason: RegenerateReason }) =>
           regenerateCampaign(id, reason),
         onSuccess: () => {
           // Invalidate so the list reflects any backend-side state changes.
           queryClient.invalidateQueries({ queryKey: qk.campaigns.list() });
         },
       });
       ```

    6. **Wire the menu row** in the per-card render (line 743-746 area, where `ContextMenuButton` is instantiated). Add `onRegenerate={() => setPickerCampaignId(c.id)}`.

    7. **Render the picker** ONCE at the end of the screen JSX (alongside other modals — find the existing return JSX root). The picker is mounted whether visible or not (Gorhom modal handles internal show/hide):
       ```tsx
       <RegenerateReasonPicker
         visible={pickerCampaignId !== null}
         onSelect={(reason) => {
           const id = pickerCampaignId;
           setPickerCampaignId(null);
           if (id) {
             regenerateMut.mutate(
               { id, reason },
               {
                 onSuccess: () => {
                   // Toast: per D-13, confirm regen was queued.
                   // Use the existing ToastHost pattern — read crialook-app/components/ToastHost.tsx
                   // for the exposed API. If a `showToast(message)` helper exists, use it; otherwise
                   // dispatch via the same hook other screens use.
                 },
               }
             );
           }
         }}
         onCancel={() => setPickerCampaignId(null)}
       />
       ```

    8. **Add toast wiring**: read `crialook-app/components/ToastHost.tsx` first; whatever exposed API exists (e.g. `useToast()` hook or a `showToast` import), call it on `onSuccess` with PT-BR message `"Vamos refazer essa! Obrigado pelo retorno."`. On error, show `"Ops, não rolou. Tenta de novo?"`.

    9. **Add the i18n key** `history.menuRegenerate` with PT-BR value `"Regerar"` and EN value `"Regenerate"`. Find the i18n source: `grep -rn "history.menuShare" crialook-app/lib/i18n* crialook-app/locales 2>/dev/null` and add the new key in the same files at the same nesting level.

    10. **NO existing call sites need updating** — `regenerateCampaign(id)` (no reason) preserves the legacy paid path. The new menu row always passes a reason.

    Do NOT add the picker to non-Android target paths or props (memory: Android-only). Do NOT modify `crialook-app/package.json` (no new deps). Do NOT touch the swipe actions (CONTEXT.md `<deferred>` — out of scope). The "Cancelar" branch per D-13 falls back to "no-op" in Phase 02 (NOT to legacy paid regen) — the comment in CONTEXT.md `<decisions>` D-13 about "fall back to legacy paid-regen flow with disclaimer" is C-03 discretion; we choose no-op + log because surfacing a paywall in the cancel path would mislead the lojista about the affordance she just saw. Document this choice in the JSX comment.
  </action>
  <acceptance_criteria>
    - `grep -n "RegenerateReasonPicker\|regenerateCampaign\|regenerateMut" crialook-app/app/(tabs)/historico.tsx | wc -l` ≥ 4 (import + state + mutation + picker render).
    - `grep -n "history.menuRegenerate" crialook-app/app/(tabs)/historico.tsx` returns ≥ 1 match (key used).
    - `grep -rn "history.menuRegenerate.*Regerar\|menuRegenerate.*Regenerate" crialook-app/lib/i18n* crialook-app/locales 2>/dev/null | wc -l` ≥ 2 (PT + EN keys present).
    - `cd crialook-app && npx tsc --noEmit` clean.
    - `cd crialook-app && npx eslint app/(tabs)/historico.tsx components/historico/` passes (existing project lint rules).
  </acceptance_criteria>
  <verify>
    <automated>cd crialook-app && npx tsc --noEmit && npx eslint "app/(tabs)/historico.tsx" "components/historico/"</automated>
  </verify>
  <done>"Regerar" appears in the 3-dot context menu on every campaign card; tap opens the picker; reason selection fires regenerateMut; tsc + eslint clean.</done>
</task>

</tasks>

<verification>
End-to-end signal smoke test (manual on Android emulator, NOT a release blocker):
1. Set `EXPO_PUBLIC_API_URL` to a backend with `FEATURE_REGENERATE_CAMPAIGN=1`.
2. Open histórico tab, tap 3-dots on any campaign, tap "Regerar".
3. Picker slides up — verify all 5 PT-BR labels present + Cancelar.
4. Tap "Texto ruim" → toast appears.
5. Backend check: `psql ... -c "SELECT regenerate_reason FROM campaigns WHERE id = '{id}';"` returns `'copy_wrong'`.

Automated:
- `cd crialook-app && npx vitest run lib/__tests__/api.regenerateCampaign.test.ts components/historico/__tests__/RegenerateReasonPicker.test.tsx`
- `cd crialook-app && npx tsc --noEmit`
</verification>

<success_criteria>
- New `RegenerateReasonPicker` component renders 5 PT-BR reason rows + Cancelar (Gorhom Bottom Sheet, not RN Modal).
- `lib/api.ts` exports `regenerateCampaign(id, reason?)` with typed RegenerateReason union matching backend enum.
- `historico.tsx` shows "Regerar" in the 3-dot menu; tap opens picker; selection POSTs `{reason}` and shows toast.
- All 8 tests (4 in api test, 4 in picker test) green.
- No new dependencies (Gorhom Bottom Sheet already in deps; no `npm install` ran — `package-lock.json` byte-identical pre/post).
- Android-only — no iOS paths or props introduced.
</success_criteria>

<output>
After completion, create `.planning/phases/02-quality-loop/02-01-SUMMARY.md` documenting:
- Files created/modified (paths)
- The exact toast wiring used (which ToastHost API)
- i18n keys added (PT + EN values)
- Decision on the Cancelar fallback (no-op vs paid regen) and rationale
- Any deferred items found (e.g., if ToastHost API needs extension — log to deferred-items.md)
</output>
