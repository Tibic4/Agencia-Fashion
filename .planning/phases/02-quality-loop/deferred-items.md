# Phase 02 Quality Loop — Deferred Items

Items identified during Phase 02 execution that are out of scope for the
current plan but need follow-up.

---

## From Plan 02-03 (judge wiring)

### productImageUrl + modelImageUrl gap in pipeline.ts emit

- **Where:** `campanha-ia/src/lib/ai/pipeline.ts` line ~352 — the
  `inngest.send({ name: "campaign/judge.requested", data: {...} })` call.
- **What:** `productImageUrl` and `modelImageUrl` are passed as empty
  strings because `pipeline.ts` operates on base64 inputs, not on public
  Supabase URLs. The judge prompt is robust to missing URLs (scores
  text + the VTO `generatedImageUrl` primarily).
- **Impact:** judge dimension `naturalidade` + `nivel_risco` quality is
  preserved (text-driven); VTO-fidelity-style scoring against the input
  photos cannot be done by this judge call alone. Phase 03 dimension 6
  (`VTO identity & garment fidelity` per AI-SPEC §5.1) is the long-term
  home for image-vs-image comparison via perceptual hashes — judging
  textual identity drift was never the design intent of this judge.
- **Fix path (candidates):**
  1. **Move emit to `route.ts`** after `savePipelineResultV3` where the
     three `imageUrls` ARE available. Requires re-interpreting CONTEXT
     D-01 ("from pipeline.ts") — minor; the emit is still
     pipeline-level, just on the orchestration layer above.
  2. **Thread URLs into pipeline.ts** by adding a post-VTO
     `uploadToStorage` step. More invasive — the pipeline becomes
     storage-aware where today it's just AI orchestration.
  3. **Accept** (current state): document as a known gap, defer to
     Phase 03.
- **Decision deferred to:** canary review checkpoint (Plan 02-03 Task 4).
  Default = (3) Accept. User can override.
- **Tracked in:** `02-03-SUMMARY.md` Decision section.

---

### sonnet-copywriter.ts:289 "afina a cintura na hora" example (pre-existing — D-23)

- **Where:** `campanha-ia/src/lib/ai/sonnet-copywriter.ts` line 289 in
  `buildSystemPrompt("pt-BR")` Stage 3 strategic-trigger examples.
- **What:** The prompt cites "afina a cintura na hora" as an example
  of the Transformação trigger. That phrase is itself blacklisted by
  the DOMAIN-RUBRIC.md Forbidden List (body-transformation claim,
  CONAR-risk per CBARP Arts. 17 + 27).
- **Impact:** the judge will likely score campaigns that pick up this
  example as `nivel_risco='alto'`. This is the SIGNAL WORKING AS
  INTENDED — the judge correctly flags a prompt-content gap.
- **Fix path:** edit the example to a LOOK-only transformation (e.g.,
  "wide leg que alonga as pernas no espelho" — a visual-effect claim
  about how the garment looks on, not about body change). Bundle with
  the next prompt-content audit (per D-23 phase boundary).
- **Phase scope:** Phase 02 is INFRASTRUCTURE — prompt-content edits
  are a separate phase, possibly bundled with the labeler engagement
  per CONTEXT.md `<deferred>`.
- **Status:** noted, NOT fixed in Plan 02-03 per D-23.

---

## From Plan 02-04 (admin quality dashboard)

### `/admin/quality` correlation matrix — heatmap UI polish

- **Where:** `campanha-ia/src/app/admin/quality/page.tsx` Section 4
  "Correlação prompt × motivo de regeneração".
- **What:** The correlation matrix currently renders as a plain HTML
  table where columns are derived from the first row's keys at render
  time. A proper heatmap (cells colored by count or correlation
  strength) is the desired final UX but requires inspecting Plan 02-05's
  actual view columns + range against real data before designing the
  color scale.
- **Impact:** functional — admins see the raw join output. Just less
  scannable than a heatmap would be.
- **Fix path:** after Plan 02-05 SUMMARY lands and the view is
  populated with at least a week of real data, redesign Section 4 with
  a `<div className="grid grid-cols-N gap-1">` heatmap where each cell
  is a `bg-red-500/{opacity}` based on count. Reuse the existing
  `alertStyles` color scale convention from `/admin/custos`.
- **Phase scope:** polish item. Land it as part of Phase 03 dashboard
  pass OR a small follow-up plan in Phase 02 once 02-05's view is in
  production for a week.
- **Status:** plain table shipped; heatmap deferred.

### Shared `<MeanTile>` component between `/admin/custos` and `/admin/quality`

- **Where:** both pages have near-identical "label / big number / delta
  arrow / caption" tile shapes.
- **What:** A shared `<MeanTile label cur prev format />` would
  collapse ~40 lines of JSX duplication. Held off because (a) the
  budget tiles in `/admin/custos` each have unique sub-content (progress
  bar in Budget Mensal, no delta in Custo/Campanha) so the shared
  component would be 4-of-8 props and lose readability; (b) Phase 03
  dashboard polish is the right home for cross-page component
  consolidation.
- **Status:** deferred to Phase 03.

---

## Project-level decision: Phase 2.5 (Labeling) deferred indefinitely

**Decided:** 2026-05-03 by product owner.

**What was deferred:**
1. Curating + labeling the first 30-50 golden-set entries (PT-BR fashion copywriter onboarding NOT pursued)
2. Calibrating LLM-judge against human ground truth (≥0.7 correlation gate from AI-SPEC §5.1)
3. Activating Promptfoo CI PR-blocking gate (stays observability-only indefinitely)

**What still works without 2.5:**
- LLM-as-judge keeps writing scores to `campaign_scores` for every successful generation (the data accumulates uncalibrated)
- `/admin/quality` dashboard renders judge scores as-is — useful for spotting absolute drift even without absolute trust
- Sentry alerts on `nivel_risco='alto'` rate spikes still fire (a relative measure, doesn't need calibration)
- `regenerate_reason` user signal is independent — keeps capturing
- Promptfoo CI runs on every PR but reports "0 entries" (zero false positives, zero gate)
- `prompt_version × regenerate_reason` correlation view is fully functional

**Implications for downstream agents:**
- Do NOT propose a Phase 2.5 implementation plan unless the user explicitly asks
- Treat LLM-judge scores in `campaign_scores` as **directional signal, not ground truth** — compare drift over time, don't claim absolute quality
- Phase 03 (Phoenix tracing) is technically unblocked — Phase 02's signal density is sufficient even without Phase 2.5 calibration. Whether to actually do Phase 03 is a separate cost-benefit question; current default is also deferred
- Promptfoo CI PR comments are informational only — never block a PR on Promptfoo

**Revisit triggers** (any of these = re-evaluate Phase 2.5):
- Production-volume judge scores show systematic bias the team can't interpret without ground truth
- A CONAR/legal incident traces back to copy that judge scored as `nivel_risco='baixo'` (false-negative on compliance)
- The team contracts a PT-BR fashion copywriter for adjacent reasons (e.g., editorial work)
- Phase 03 Phoenix tracing surfaces dimension-vs-prompt_version regressions that need a "what's the truth" arbiter

**Status:** Phase 2.5 entry in any future ROADMAP/CONTEXT should reference this decision and not re-propose the labeling work without explicit re-authorization.
