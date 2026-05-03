# Phase 03: Pipeline Polish & Carry-overs — Context

**Gathered:** 2026-05-03
**Status:** Executed inline (no plan ceremony — 4 explicit user-scoped items)
**Source:** Direct user scoping post-Phase-02. Carry-overs from `01-deferred-items.md` + `02-deferred-items.md`.

> **Naming note:** "Phase 03" here is the cleanup phase. Phoenix tracing (originally tagged `[Phase 3]` in `01-AI-SPEC.md`) remains deferred indefinitely (per `02-deferred-items.md` Phase 2.5 deferral rationale and `~/.claude/projects/.../memory/project_phase_25_deferred.md`). Slot reuse is intentional — Phase 03 = cleanup, Phoenix = future unnumbered work.

<domain>
## Phase Boundary

A small (~half-day) cleanup phase consuming carry-overs accumulated through Phases 01-02. Three discrete code changes + one non-code engagement item. No new design surface, no new infrastructure.

**In scope (4 items):**

1. **Prompt-content fix** — sonnet-copywriter.ts system prompts (PT-BR + EN) cite body-transformation phrases as examples of the Transformação trigger AND the Benefício pattern. These violate DOMAIN-RUBRIC.md Forbidden List (CONAR risk per CBARP Arts. 17 + 27). Replace with look-only language about the GARMENT, not the BODY.
2. **MeanTile component extraction** — `/admin/quality` had 5 near-identical tile JSX blocks (~40 LoC dup). Extract to a local `<MeanTile />` component with 5 props.
3. **Heatmap UI for correlation matrix** — `/admin/quality` Section 4 was a plain HTML table. Convert to a real heatmap aggregating (prompt_version × regenerate_reason) cells with bg-red-500 opacity ramp.
4. **CBARP citations counsel review** — non-code engagement item. Acknowledged but NOT executed in this phase (engagement decision, not engineering).

**Out of scope:**
- Anything new — this phase is strictly cleanup
- Phoenix tracing — see naming note above
- Phase 2.5 (labeling) — deferred indefinitely per memory
- Any backend/judge/Inngest changes

</domain>

<decisions>
## Implementation Decisions

### D-01 — Prompt edit replacements (PT-BR)
- Line 368: `"afina a cintura na hora"` → `"wide leg que alonga as pernas no espelho"` (focus on visual effect of the pant cut, not body change)
- Line 376: `"afina a cintura e alonga as pernas"` → `"wide leg fluido que cria silhueta alongada no espelho"` (effect on look, not body)

### D-02 — Prompt edit replacements (EN)
- Line 572: `"snatches the waist instantly"` → `"wide-leg cut that elongates the leg line in the mirror"`
- Line 580: `"snatches the waist and elongates the leg"` → `"fluid wide-leg cut that creates an elongated silhouette in the mirror"`

### D-03 — Accept SHA boundary (D-15 mechanism working as intended)
- Old SHAs: `SONNET_PROMPT_VERSION_PT=368daa52106b`, `SONNET_PROMPT_VERSION_EN=6fb4023c4732`
- New SHAs: `SONNET_PROMPT_VERSION_PT=665c6eca748f`, `SONNET_PROMPT_VERSION_EN=394694843c25`
- Historical campaign rows stay tagged with old SHAs in `api_cost_logs.metadata.prompt_version`
- New campaigns get new SHAs from next deploy onwards
- `/admin/quality` per-prompt_version table will show the SHA boundary — exactly what D-15 was built for

### D-04 — MeanTile is local to /admin/quality
- Cross-page sharing with /admin/custos rejected (already analyzed in 02-04 deferred-items.md): custos tiles each have unique sub-content (progress bar, projection color logic, no delta) → shared component would be 4-of-8 props per call site, lose readability
- File location: `src/app/admin/quality/MeanTile.tsx` — co-located with the only consumer

### D-05 — Heatmap design
- Aggregation: top 8 prompt_versions by total regen count, columns are 5 fixed regenerate_reason enum values (face_wrong/garment_wrong/copy_wrong/pose_wrong/other) with PT-BR display labels (Rosto/Peça/Copy/Pose/Outro)
- Color scale: 5-step `bg-red-500/{10,25,40,60,80}` opacity ramp based on cell count relative to matrix max
- Empty cells: `bg-gray-900 text-gray-600` (zero count is visually distinct)
- aria-label on every cell for screen-reader compatibility

### D-06 — CBARP citations counsel review
- Acknowledged but NOT executed
- This is an engagement decision (counsel hire, scope of review) — outside engineering Phase 03
- Status: open in `02-deferred-items.md` "Adjacent" section; revisit when team makes engagement decision

### Claude's Discretion
- **C-01:** Inline execution chosen over agent ceremony — scope is 3 small code changes, total ~30 min. GSD planner+executor cycle would have been slower than direct edits with the same atomicity guarantees.
- **C-02:** No new tests added. Existing test suite (148 tests) covers what changed: page.test.tsx tests use exported `getQualityData()` server loader (untouched by JSX restructure). Sonnet prompt is system-prompt text that the existing 13 sonnet-copywriter.test.ts tests don't lock against (they test parser, not prompt content).

</decisions>

<canonical_refs>
## Canonical References

- `.planning/phases/01-ai-pipeline-hardening/01-AI-SPEC.md` §6.1 — forbidden-token regex co-owned with PT-BR copywriter; the `afina a cintura` regex from this section was the catch-net the prompt was tripping
- `.planning/codebase/DOMAIN-RUBRIC.md` — Forbidden List section that the old prompt examples violated
- `.planning/phases/01-ai-pipeline-hardening/deferred-items.md` — original carry-over note for the prompt edit (D-23 scope discipline)
- `.planning/phases/02-quality-loop/deferred-items.md` — heatmap + MeanTile deferred items + the project-level Phase 2.5 deferral

</canonical_refs>

<code_context>

### Files modified
- `campanha-ia/src/lib/ai/sonnet-copywriter.ts` — 4 single-line edits (2 PT, 2 EN), no structural changes
- `campanha-ia/src/app/admin/quality/page.tsx` — Section 1 simplified to use `<MeanTile />`; Section 4 rewritten as heatmap; helper `buildHeatmap()` + `heatColor()` + `REGEN_REASONS`/`REASON_LABELS` constants added; legacy `formatScore`/`formatDelta` helpers moved into MeanTile

### Files created
- `campanha-ia/src/app/admin/quality/MeanTile.tsx` — local presentational component (43 LoC)

### Verification
- `npx tsc --noEmit` exits 0
- `npx vitest run` — 148/148 pass (no test count change; tests use server loader, not JSX)
- Sonnet PT/EN SHAs verified to differ from Phase 01 baseline (D-15 mechanism captures the change)

</code_context>

<deferred>
## Deferred Ideas

- **CBARP citations counsel review** — engagement decision, not Phase 03 work
- **Phase 2.5 (Labeling)** — deferred indefinitely per memory; revisit triggers documented
- **Phoenix tracing** — future unnumbered work; deferred until signal density warrants it

</deferred>

---

*Phase: 03-pipeline-polish*
*Context: 2026-05-03*
