---
plan_id: 07-01
phase: 7
title: Add trash icon affordance + danger ConfirmSheet to ModelBottomSheet, wired to existing handleDelete (F-11)
wave: 1
depends_on: []
owner_action: false
files_modified:
  - crialook-app/components/ModelBottomSheet.tsx
  - crialook-app/app/(tabs)/modelo.tsx
  - crialook-app/lib/i18n/strings.ts
autonomous: true
requirements: ["D-01", "D-02", "D-03", "D-04", "D-05", "F-11"]
must_haves:
  truths:
    - "ModelBottomSheet exposes an `onDelete?: (modelId: string) => void` prop alongside the existing `onSelect` prop (D-02)"
    - "When `onDelete` is provided AND model is `is_custom === true`, a small trash icon Pressable renders inside the body section (below the CTA, paddingHorizontal 20, gap 12) with accessibilityLabel `Deletar modelo` (D-01, D-05)"
    - "When `is_custom === false` (default catalog model), the trash icon does NOT render — users cannot delete catalog models, only their own (defensive: server already enforces this; UI hides the affordance to avoid an unactionable button)"
    - "Tapping the trash icon opens the existing `useConfirmSheet().ask({ title: t('model.deleteTitle'), message: t('model.deleteMessage'), variant: 'danger', confirmLabel: t('common.delete') })` (D-03)"
    - "On confirm: invokes `onDelete(model.id)`, dismisses the bottom sheet (`sheetRef.current?.dismiss()`), and emits `toast.success(t('model.deletedToast'))` (D-03)"
    - "On cancel: bottom sheet stays open, no state mutation"
    - "i18n strings.ts adds `model.deletedToast` (PT-BR: 'Modelo deletado') in BOTH the pt-BR block (around line 538) AND the en-US block (around line 1195) — no untranslated string ships"
    - "i18n strings.ts upgrades `model.deleteMessage` from the current 'Tem certeza?' / 'Are you sure?' to the discuss-phase locked copy 'Essa ação não pode ser desfeita.' / 'This action cannot be undone.' (D-01)"
    - "modelo.tsx ModelBottomSheet usage at line 479 passes `onDelete={handleDelete}` so the existing `handleDelete` (modelo.tsx:375) wires through end-to-end"
    - "NO swipe-to-delete gesture is added (D-04 — explicitly rejected)"
    - "NO trash icon is added to ModelGridCard — UX scope is the bottom sheet only (per CONTEXT D-01 + ModelGridCard:746-748 comment leaves long-press for peek)"
    - "Trash icon uses FontAwesome `trash` glyph (already a transitive dep via @expo/vector-icons used elsewhere in the codebase) at size 18 with color Colors.red[500] or equivalent semantic-danger color from Colors palette"
    - "No other ModelBottomSheet behavior regresses: pinch/zoom, double-tap, pan, snap points, close button, CTA all behave identically to current code"
  acceptance:
    - "grep -c 'onDelete' crialook-app/components/ModelBottomSheet.tsx returns at least 4 (prop type, destructure, usage, accessibility)"
    - "grep -c 'useConfirmSheet\\|ConfirmEl' crialook-app/components/ModelBottomSheet.tsx returns at least 2 (hook used, element rendered)"
    - "grep -c 'accessibilityLabel=\"Deletar modelo\"\\|accessibilityLabel={.*Deletar' crialook-app/components/ModelBottomSheet.tsx returns at least 1"
    - "grep -c 'is_custom' crialook-app/components/ModelBottomSheet.tsx returns at least 1 (gating present)"
    - "grep -c 'toast.success' crialook-app/components/ModelBottomSheet.tsx returns at least 1"
    - "grep -c 'deletedToast' crialook-app/lib/i18n/strings.ts returns exactly 2 (PT and EN)"
    - "grep -c 'Essa ação não pode ser desfeita' crialook-app/lib/i18n/strings.ts returns exactly 1 (PT block)"
    - "grep -c 'This action cannot be undone' crialook-app/lib/i18n/strings.ts returns exactly 1 (EN block)"
    - "grep -c 'onDelete={handleDelete}' \"crialook-app/app/(tabs)/modelo.tsx\" returns at least 1 (the new ModelBottomSheet wiring; the existing ModelsListBody usage at line 467 stays)"
    - "cd crialook-app && npm run typecheck exits 0"
    - "cd crialook-app && npm run lint exits 0"
---

# Plan 07-01: Trash icon + danger confirm in ModelBottomSheet

## Objective

Per D-01..D-05 and F-11 (CRIALOOK-PLAY-READINESS.md), add the missing UI affordance that lets a user delete one of their custom models from inside the app. Without this affordance, the LGPD/GDPR pathway for "delete face-derived data on demand" has no end-user surface — the backend `DELETE /model/:id` endpoint exists, the React Query mutation (`deleteMut`, modelo.tsx:361-373) exists, the confirm flow (`handleDelete`, modelo.tsx:375-383) exists, but there is currently no UI trigger after long-press got repurposed for the peek preview overlay.

This plan adds:

1. An `onDelete` prop to `ModelBottomSheet`.
2. A small trash icon rendered inside the bottom sheet body (visible only for `is_custom: true` models — default catalog models cannot be deleted by user).
3. A danger-variant `ConfirmSheet` confirmation modal using the existing `useConfirmSheet()` imperative hook (per ConfirmSheet.tsx:235-274).
4. A success toast on confirmation using the existing `toast.success` API (per lib/toast.ts:45-54).
5. The `<ModelBottomSheet>` invocation in `modelo.tsx` (line 479) wired to pass the existing `handleDelete` function.

This is the **only** UX change in Phase 7 — F-11 is closed by this single plan. The deferred test plan 07-02 verifies the affordance contract.

## Truths the executor must respect

- `ModelBottomSheet` is a `forwardRef` component (line 107). The new `onDelete` prop goes into the `Props` interface (line 65) alongside `onSelect`, marked optional (`onDelete?: (modelId: string) => void`) so other callsites (none today, but defensive) don't break.
- `ConfirmSheet` is the project's branded confirmation primitive (replaces `Alert.alert`). Use the imperative `useConfirmSheet()` hook (ConfirmSheet.tsx:235) — same pattern `handleDelete` already uses via `askDeleteModel` in modelo.tsx:376. The hook returns `{ ConfirmEl, ask }`. Mount `ConfirmEl` inside the `BottomSheetModal` body so it overlays the sheet correctly.
- The toast API is `toast.success(text)` from `@/lib/toast` (lib/toast.ts:45-54). DO NOT use `Alert.alert` or React Native's native Toast.
- Use `is_custom` from the `ModelItem` type to gate visibility — the default catalog models (the ones shipped with the app) have `is_custom: false`. Users can only delete models they created. ModelBottomSheet already reads this field at line 258 (`const isCustom = !!model?.is_custom`) so the gate is `if (isCustom && onDelete) renderTrashIcon()`.
- Visual placement: BELOW the existing CTA (`Selecionar modelo`), separated by a gap. Small (icon size ~18px), centered horizontally, with a subtle danger color (use `Colors.red[500]` if it exists in `@/constants/Colors`; otherwise import `tokens.color.danger` or fall back to `'#dc2626'` literal — read constants/Colors.ts first to know which exists). Pressable with hitSlop 14 for accessibility.
- The confirm modal copy:
  - Title: `t('model.deleteTitle')` — already exists ('Excluir modelo' / 'Delete model')
  - Message: `t('model.deleteMessage')` — UPGRADE the existing string per D-01: PT 'Essa ação não pode ser desfeita.' / EN 'This action cannot be undone.'
  - Confirm label: `t('common.delete')` — assume exists; if missing, add it (PT 'Excluir' / EN 'Delete')
  - Variant: `'danger'` (red CTA + warning haptic on open per ConfirmSheet.tsx:95-96)
- After confirm: call `onDelete(model.id)`, then `sheetRef.current?.dismiss()`, then `toast.success(t('model.deletedToast'))`. Order matters: dismiss the sheet BEFORE the toast so the toast doesn't render behind the sheet's backdrop.
- DO NOT add a trash icon to `ModelGridCard` (modelo.tsx:740). The comment at modelo.tsx:746-748 explicitly reserves long-press for peek; D-04 rejects swipe-to-delete; the only delete UX surface is the bottom sheet.
- DO NOT modify the existing `handleDelete` function in modelo.tsx:375-383 — it already does the right thing (asks for confirm via `askDeleteModel` THEN calls `deleteMut.mutate`). The new `onDelete` prop wires `onDelete={handleDelete}` so the bottom sheet's confirm wraps the entire flow.
  - **Important**: Since both the new ConfirmSheet (in ModelBottomSheet) AND the existing `askDeleteModel` (in modelo.tsx) would ask for confirm, the executor MUST refactor: the new bottom-sheet trash button calls `onDelete(id)` which goes to a NEW handler `handleDeleteFromSheet` that calls `deleteMut.mutate(id)` directly (no second confirm). The original `handleDelete` (with the existing askDeleteModel confirm) stays for the `ModelsListBody onDelete={handleDelete}` wiring at line 467 — though that path also has no current UI trigger (per F-11 finding), it stays defensively in case a future card-level affordance is added.
  - Net wiring: `ModelsListBody onDelete={handleDelete}` (existing, unchanged) + `ModelBottomSheet onDelete={handleDeleteFromSheet}` (new — direct mutate, since the sheet already showed the confirm).
- Preserve all existing ModelBottomSheet behavior: pinch (line 158), double-tap (line 175), pan (line 195), snap points (line 73), close button (line 345), CTA (line 388). Visually the sheet body grows by ~50px to accommodate the trash row — that's fine, snap point is `'100%'`.
- Files modified are exactly 3: ModelBottomSheet.tsx, modelo.tsx (one prop addition + one new handler), strings.ts (3 string additions/edits across PT and EN blocks).

## Tasks

### Task 1: Add `onDelete` prop + trash icon UI to ModelBottomSheet

<read_first>
- crialook-app/components/ModelBottomSheet.tsx (full file — lines 65-69 for Props interface, line 107 for component signature, lines 240-252 for handleConfirm/handleChange pattern, lines 386-403 for CTA block where trash sits below)
- crialook-app/components/ConfirmSheet.tsx (lines 235-274 — `useConfirmSheet` hook signature; lines 56-69 — `ConfirmSheetProps` shape)
- crialook-app/lib/toast.ts (lines 45-54 — `toast.success` signature)
- crialook-app/lib/i18n/index.ts or strings.ts (confirm `useT` returns `{ t }` and how to call `t('model.deletedToast')`)
- crialook-app/constants/Colors.ts (confirm `Colors.red[500]` exists or what danger color is canonical)
- .planning/phases/07-play-compliance-and-ux-completeness/07-CONTEXT.md (D-01..D-05)
</read_first>

<action>
In `crialook-app/components/ModelBottomSheet.tsx`:

1. Update the imports block at the top:
   - Add `import { useConfirmSheet } from '@/components/ConfirmSheet';`
   - Add `import { toast } from '@/lib/toast';`
   - Add `import { FontAwesome } from '@expo/vector-icons';` (or whichever icon family the project uses — check by greping for `from '@expo/vector-icons'` in other components first; if a different family is canonical, use that)

2. Update the `Props` interface (line 65-69):
   ```typescript
   interface Props {
     /** Called with the model id when the user taps "Selecionar modelo". */
     onSelect: (modelId: string) => void;
     /** Optional. Called with the model id when the user confirms delete via the trash icon.
      *  Only invoked AFTER the danger ConfirmSheet returns true. The caller should NOT
      *  show its own confirm — this sheet already does. */
     onDelete?: (modelId: string) => void;
   }
   ```

3. Update the component signature on line 107-108:
   ```typescript
   export const ModelBottomSheet = forwardRef<ModelBottomSheetRef, Props>(
     function ModelBottomSheet({ onSelect, onDelete }, ref) {
   ```

4. Inside the component body, after `const { t } = useT();` (line 112), add:
   ```typescript
   const { ConfirmEl, ask } = useConfirmSheet();
   ```

5. Add a new handler near `handleConfirm` (line 240):
   ```typescript
   // ─── Delete action (danger confirm + toast) ──────────────────────
   const handleDeletePress = useCallback(async () => {
     if (!model || !onDelete) return;
     const ok = await ask({
       title: t('model.deleteTitle'),
       message: t('model.deleteMessage'),
       variant: 'danger',
       confirmLabel: t('common.delete'),
     });
     if (!ok) return;
     onDelete(model.id);
     sheetRef.current?.dismiss();
     toast.success(t('model.deletedToast'));
   }, [model, onDelete, ask, t]);
   ```

6. In the JSX body section (after the CTA Pressable at line 402, INSIDE the `<View style={styles.body}>` block), conditionally render the trash icon:
   ```typescript
   {isCustom && onDelete ? (
     <Pressable
       onPress={handleDeletePress}
       accessibilityRole="button"
       accessibilityLabel="Deletar modelo"
       hitSlop={14}
       style={styles.deleteBtn}
     >
       <FontAwesome name="trash" size={18} color="#dc2626" />
       <Text style={styles.deleteBtnText}>{t('common.delete')}</Text>
     </Pressable>
   ) : null}
   ```

7. After the closing `</BottomSheetModal>` (line 406-407), but still inside the function's return — actually the cleaner pattern is to render `{ConfirmEl}` AT THE TOP LEVEL of the return alongside the BottomSheetModal. Since BottomSheetModal returns a fragment-able structure, wrap the return in a Fragment:
   ```typescript
   return (
     <>
       <BottomSheetModal ... >
         {/* existing children */}
       </BottomSheetModal>
       {ConfirmEl}
     </>
   );
   ```

8. Add styles to the `styles` block at the bottom:
   ```typescript
   deleteBtn: {
     marginTop: 16,
     flexDirection: 'row',
     alignItems: 'center',
     justifyContent: 'center',
     gap: 8,
     paddingVertical: 10,
   },
   deleteBtnText: {
     color: '#dc2626',
     fontSize: 14,
     fontFamily: 'Inter_600SemiBold',
   },
   ```
</action>

<verify>
```bash
cd crialook-app
grep -n "onDelete" components/ModelBottomSheet.tsx
# Expect at least 4 hits: prop type, destructure in signature, useCallback dep, conditional render

grep -n "useConfirmSheet\|ConfirmEl\|toast.success" components/ModelBottomSheet.tsx
# Expect at least 3 hits

grep -n "accessibilityLabel=\"Deletar modelo\"" components/ModelBottomSheet.tsx
# Expect exactly 1

npm run typecheck 2>&1 | tail -10
# Expect no errors
```
</verify>

### Task 2: Add `model.deletedToast` + upgrade `model.deleteMessage` + ensure `common.delete` in i18n strings

<read_first>
- crialook-app/lib/i18n/strings.ts (lines 530-545 PT model block; lines 1190-1205 EN model block; grep `common:` to find common.delete location in BOTH locales)
- .planning/phases/07-play-compliance-and-ux-completeness/07-CONTEXT.md (D-01 confirm message copy)
</read_first>

<action>
In `crialook-app/lib/i18n/strings.ts`:

1. **PT-BR block (around line 538):** Locate `deleteTitle: 'Excluir modelo',` and `deleteMessage: 'Tem certeza?',`. Update `deleteMessage` and add `deletedToast`:
   ```typescript
   deleteTitle: 'Excluir modelo',
   deleteMessage: 'Essa ação não pode ser desfeita.',
   deletedToast: 'Modelo deletado',
   ```

2. **EN block (around line 1195):** Locate `deleteTitle: 'Delete model',` and `deleteMessage: 'Are you sure?',`. Update `deleteMessage` and add `deletedToast`:
   ```typescript
   deleteTitle: 'Delete model',
   deleteMessage: 'This action cannot be undone.',
   deletedToast: 'Model deleted',
   ```

3. **Confirm `common.delete` exists in both locales.** Grep `common:` block:
   ```bash
   grep -n "common: {" crialook-app/lib/i18n/strings.ts
   ```
   Then for each occurrence, confirm `delete:` is present. If `common.delete` is missing in EITHER locale, add:
   - PT: `delete: 'Excluir',`
   - EN: `delete: 'Delete',`
</action>

<verify>
```bash
grep -c "deletedToast" crialook-app/lib/i18n/strings.ts
# Expect: 2

grep -c "Essa ação não pode ser desfeita" crialook-app/lib/i18n/strings.ts
# Expect: 1

grep -c "This action cannot be undone" crialook-app/lib/i18n/strings.ts
# Expect: 1

# Confirm both locales have common.delete after this plan:
node -e "const s=require('./crialook-app/lib/i18n/strings.ts');" 2>&1 | head
# (The TS file isn't directly require-able; instead grep the structure:)
grep -nE "^\s+delete: '(Excluir|Delete)'," crialook-app/lib/i18n/strings.ts
# Expect at least 2 hits (one PT, one EN)
```
</verify>

### Task 3: Wire `onDelete` to a new `handleDeleteFromSheet` handler in modelo.tsx

<read_first>
- crialook-app/app/(tabs)/modelo.tsx (lines 361-383 — current `deleteMut` + `handleDelete`; line 467 — `ModelsListBody onDelete={handleDelete}`; line 479 — `ModelBottomSheet ref={peekSheetRef} onSelect={handleSetActive}`)
- .planning/phases/07-play-compliance-and-ux-completeness/07-CONTEXT.md (D-02 — wire to existing handleDelete; per Truths above we use a sibling handler that skips the second confirm since the sheet already confirmed)
</read_first>

<action>
In `crialook-app/app/(tabs)/modelo.tsx`:

1. After the existing `handleDelete` definition (around line 383), add a sibling handler:
   ```typescript
   /* Variante usada pelo ModelBottomSheet: a sheet já mostrou o ConfirmSheet
      antes de chamar onDelete, então pulamos askDeleteModel e vamos direto
      pra mutation. Mantém handleDelete original intacto pra outros call-sites
      (ex: futuro card menu, M2). */
   const handleDeleteFromSheet = (id: string) => {
     deleteMut.mutate(id);
   };
   ```

2. Update the `<ModelBottomSheet>` JSX (line 479) to pass `onDelete`:
   ```typescript
   <ModelBottomSheet ref={peekSheetRef} onSelect={handleSetActive} onDelete={handleDeleteFromSheet} />
   ```

3. **Do NOT modify** the `<ModelsListBody onDelete={handleDelete}>` line at 467 — it stays for backward compat / future use. Per the existing comment at modelo.tsx:746-748, ModelGridCard has no UI trigger today; this plan does not add one.
</action>

<verify>
```bash
grep -c "handleDeleteFromSheet" "crialook-app/app/(tabs)/modelo.tsx"
# Expect: 2 (definition + JSX usage)

grep -c "onDelete={handleDeleteFromSheet}" "crialook-app/app/(tabs)/modelo.tsx"
# Expect: 1 (the new ModelBottomSheet wiring)

grep -c "onDelete={handleDelete}" "crialook-app/app/(tabs)/modelo.tsx"
# Expect: 1 (the unchanged ModelsListBody wiring at line 467)

cd crialook-app && npm run typecheck 2>&1 | tail -5
# Expect no errors
cd crialook-app && npm run lint 2>&1 | tail -5
# Expect no errors
```
</verify>

## Files modified

- `crialook-app/components/ModelBottomSheet.tsx` — new `onDelete` prop, useConfirmSheet hook, trash icon Pressable, handleDeletePress handler, ConfirmEl render, deleteBtn styles
- `crialook-app/app/(tabs)/modelo.tsx` — new `handleDeleteFromSheet` handler, `onDelete` prop on `<ModelBottomSheet>`
- `crialook-app/lib/i18n/strings.ts` — upgraded `model.deleteMessage` (PT+EN), added `model.deletedToast` (PT+EN), confirmed `common.delete` (PT+EN)

## Why this matters (risk if skipped)

F-11 (CRIALOOK-PLAY-READINESS.md, Medium severity): without a UI affordance to delete a custom model, the LGPD/GDPR right-to-delete pathway has no end-user surface. The backend route exists, but a Play Store reviewer or an LGPD audit asking "how does the user delete the face data they uploaded?" gets the answer "they can't from inside the app — they have to email DPO." That answer is unacceptable for a Play submission with biometric-adjacent data. Five lines of UI close the gap.
