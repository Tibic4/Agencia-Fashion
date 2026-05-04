# Phase 7: Play Compliance & UX Completeness - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning (independent of other phases — no dependencies)

<domain>
## Phase Boundary

Close the LGPD-adjacent UX gap (model-delete affordance), confirm/document Data Safety form alignment, re-evaluate IARC content rating given AI-generated fashion imagery, align in-app legal copy with site, and finalize Play Store listing assets.

In scope (PHASE-DETAILS Phase 7):
- Delete affordance for models — small trash icon in `ModelBottomSheet` peek view, wired to existing `handleDelete`. Required for LGPD/GDPR clean flow given face-derived model data. (F-11)
- Manually diff `lib/legal/content.ts` against `https://crialook.com.br/{privacidade,termos,dpo}`; reconcile drift; add `scripts/check-legal-drift.js`. (F-06)
- Cross-check Play Console "Data safety" form against CRIALOOK-PLAY-READINESS.md §1 categories.
- Re-evaluate IARC content-rating given AI-generated fashion imagery.
- Final pass on `store-assets/PLAY_STORE_LISTING.md` + screenshots.

Out of scope: backend prompt-injection eval suite (parking), F-12 Storybook (parking).

</domain>

<decisions>
## Implementation Decisions

### Delete UX (F-11)
- **D-01:** Small trash icon in `ModelBottomSheet` peek view (Material 3 pattern). Long-press already opens peek; trash icon in canto inferior do sheet, with confirmation modal "Deletar modelo? Essa ação não pode ser desfeita."
- **D-02:** Wire to existing `onDelete` / `handleDelete` (already in code path, lost UI trigger when long-press got repurposed for peek).
- **D-03:** Confirmation modal uses existing modal component (researcher confirms which). On confirm: call `handleDelete`, close sheet, toast "Modelo deletado".
- **D-04:** No swipe-to-delete (rejected — non-Material, poor discoverability).
- **D-05:** Accessibility: trash icon has `accessibilityLabel="Deletar modelo"`, modal buttons have proper labels.

### Legal drift (F-06)
- **D-06:** `scripts/check-legal-drift.js`:
  - Fetches `https://crialook.com.br/privacidade`, `/termos`, `/dpo`
  - Extracts main content (skip nav/footer)
  - Compares against `lib/legal/content.ts` exported strings
  - Diff output: line-by-line with markers
  - Exit 0 if equal, exit 1 if diff
  - Retry 3x with backoff on 5xx (fail-soft on site outage = exit 0 with warn log)
- **D-07:** **Fail CI on diff.** Wired into `.github/workflows/ci.yml` as a job. Forces sync between site and bundled content.
- **D-08:** Manual one-time diff at start of phase: identify current drift, reconcile by updating `lib/legal/content.ts` to match site OR vice versa (planner+owner judgment per section).

### Data Safety form
- **D-09:** Owner-action deliverable: `crialook-app/docs/PLAY_DATA_SAFETY.md`. Markdown structured per Play Console form sections.
- **D-10:** Doc structure: each Play Console category (e.g., "Photos and videos", "Personal info", "App activity", "Financial info") gets:
  - Whether collected: yes/no
  - Whether shared: yes/no
  - Why collected (purpose enumeration)
  - User control (delete account, opt-out)
  - Data handling note (encrypted in transit, RLS at rest)
- **D-11:** Owner copies into Play Console manually. Doc is reusable for re-submissions and audit trail.
- **D-12:** Categories cross-referenced with CRIALOOK-PLAY-READINESS.md §1: "Photos and videos" (uploads), "Personal info → email" (Clerk), "App activity → in-app actions" (analytics), "Financial info → purchase history" (Play Billing).

### IARC content rating
- **D-13:** Bump to **"Classificação 12"** + add advisory **"AI-generated apparel imagery"**.
- **D-14:** Honest default given swimwear/lingerie possibility in fashion catalog. Reviewer Play tem zero ambiguidade. UX impact mínima (12 ainda é ampla audiência).
- **D-15:** Owner updates IARC questionnaire in Play Console; doc the new answers in `crialook-app/docs/PLAY_IARC.md` as audit trail for re-submissions.
- **D-16:** Note: commit `258380b` already hardened the prompt against body-transformation; advisory stays accurate ("AI generates clothing on uploaded photos, may include swimwear/lingerie/sleepwear").

### Play Store listing finalization
- **D-17:** Final pass on `store-assets/PLAY_STORE_LISTING.md`: title (≤30), short desc (≤80), full desc (≤4000), keywords. Follow Play conventions (no emoji in title, no superlative claims like "best").
- **D-18:** Screenshot pass: 4 PNGs in `crialook-app/store-assets/` (TASKS.md flagged compression opp; not blocking, optional).

### Claude's Discretion
- Modal component choice (existing primary modal vs new ConfirmDialog)
- Toast component if missing (likely already exists; researcher checks)
- Diff format details for legal-drift script (unified diff vs side-by-side)
- IARC questionnaire walkthrough order in PLAY_IARC.md doc

### Flagged for plan-phase research
- **R-01:** Read `crialook-app/components/ModelBottomSheet.tsx` and `ModelGridCard.tsx` — confirm exact path of `onDelete` and current peek view shape (D-01)
- **R-02:** Read `campanha-ia/src/lib/legal/content.ts` — current exported strings for the diff script (D-06)
- **R-03:** Confirm Toast component existence in mobile (D-03 dependency)
- **R-04:** Confirm whether CRIALOOK-PLAY-READINESS.md §1 has the precise Data Safety category list or just an outline

</decisions>

<specifics>
## Specific Ideas

- "LGPD-clean flow exige delete de face-derived data" — D-01..D-05
- "Site vs bundled drift = CI block" — D-07
- "Honest IARC > otimista IARC" — D-13 (Classificação 12 com advisory)
- "Doc owner copia pro Play Console" — D-09 (markdown estruturado)

</specifics>

<canonical_refs>
## Canonical References

### Phase scope sources
- `.planning/PROJECT.md`
- `.planning/ROADMAP.md` §"Phase 7"
- `.planning/PHASE-DETAILS.md` §"Phase 7"

### Findings to address
- `.planning/audits/CRIALOOK-PLAY-READINESS.md` — F-06, F-11, §1 (privacy URL + Data Safety + content rating)

### Codebase intel
- `.planning/codebase/ARCHITECTURE.md` §"Mobile↔Web boundary" (legal content shape)
- `.planning/codebase/STACK.md` §"crialook-app" (UI components)

### Independent phase
- No upstream dependency — can plan + execute anytime

### Out-of-M1
- Backend prompt-injection eval suite → parking lot
- F-12 Storybook fix → parking lot
- Screenshot compression (TASKS.md) → optional, not blocking

</canonical_refs>

<code_context>
## Existing Code Insights

### Files this phase touches
- `crialook-app/components/ModelBottomSheet.tsx` — D-01 add trash icon
- `crialook-app/components/ModelGridCard.tsx` — confirm `onDelete` plumbing intact (D-02)
- `campanha-ia/src/lib/legal/content.ts` — D-06 reconcile drift
- `scripts/check-legal-drift.js` (new, root or `campanha-ia/scripts/`) — D-06
- `.github/workflows/ci.yml` — D-07 wire script as CI job
- `crialook-app/docs/PLAY_DATA_SAFETY.md` (new) — D-09
- `crialook-app/docs/PLAY_IARC.md` (new) — D-15
- `crialook-app/store-assets/PLAY_STORE_LISTING.md` — D-17 polish

### Established Patterns
- Material 3 patterns (existing ModelBottomSheet uses)
- Vitest tests in `crialook-app/components/__tests__/` — add ModelBottomSheet test for delete affordance
- Owner-action checkpoints (used in P4-P6) — D-11, D-15 follow

</code_context>

<deferred>
## Deferred Ideas

- Backend prompt-injection eval suite → parking lot (Promptfoo never blocks per memory)
- F-12 Storybook×Vite peer-dep → parking lot, dev-only
- Screenshot compression (TASKS.md) → optional, not blocking
- Re-submission automation → manual flow stays, automation parking lot

</deferred>

---

*Phase: 07-play-compliance-and-ux-completeness*
*Context gathered: 2026-05-04*
