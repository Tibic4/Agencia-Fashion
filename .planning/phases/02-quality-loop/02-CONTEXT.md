# Phase 02: Quality Loop — Context

**Gathered:** 2026-05-03
**Status:** Ready for planning
**Source:** Decisions inherit from Phase 01's `01-AI-SPEC.md` §5/§6/§7 `[Phase 2]`-tagged items + interactive discussion. Phase 01 production signals (`prompt_version` + `regenerate_reason` + `api_cost_logs.metadata`) are now LIVE in production — this phase wires the loop that consumes them.

<domain>
## Phase Boundary

Close the AI quality measurement loop. Phase 01 captured signals (regenerate_reason from users, prompt_version on every generation, cost log metadata). Phase 02 consumes those signals: scores every generation with an LLM-as-judge that writes the existing `campaign_scores` table, surfaces drift via 3 Sentry-routed alerts, scaffolds the golden-set + Promptfoo CI gate (without rubric labels yet — that's Phase 2.5), and finally wires the `crialook-app` mobile UI to send `{reason}` so the regen signal stops being web-only.

**This phase makes silent quality regressions LOUD.** Today a prompt edit can degrade copy quality and the team finds out from lojista complaints. After this phase, a prompt edit shows up in (a) a Sentry alert when nivel_risco rates spike, (b) a Promptfoo CI check when rubric pass-rates regress (gate activates in Phase 2.5 once labels land), and (c) a `prompt_version × regenerate_reason` correlation query that points at the responsible deploy.

**In scope:**
- **LLM-as-judge wiring (Inngest async)** — `lib/ai/judge.ts` + Inngest function `judgeCampaignJob` triggered by event `campaign/judge.requested` emitted from `pipeline.ts` after `successCount > 0`. Uses existing `getAnthropic()` from `lib/ai/clients.ts` + `tool_use` pattern from D-16 (Phase 01). Writes 6 dimensions to `campaign_scores` columns: `naturalidade`, `nivel_risco`, `conversao`, `clareza`, `aprovacao_meta`, `nota_geral` (computed). ~R$0.02/campaign overhead, fire-and-forget on failure (Sentry-captured).
- **Sentry-routed alerts** — 3 alert rules wired via Sentry custom-issue creation (synthetic issues with stable fingerprints): (a) `face_wrong` rate > 5% week-over-week, (b) judge `nivel_risco="alto"` rate > 1% on rolling 7-day window, (c) Promptfoo CI failure on Critical-priority dimension. Sentry alert rules route to existing team channel.
- **Mobile `{reason}` hook in crialook-app** — wire the regenerate button to show a 5-option picker (Rosto / Peça / Copy / Pose / Outro), submit `{reason}` in POST body to `/api/campaign/[id]/regenerate`. Without this, the alerting signal (a) only sees web-originated regens (~5-10% of total volume).
- **Golden-set INFRA scaffold** — `evals/golden-set/` directory + JSON schema spec + `evals/run.ts` script + `.github/workflows/eval-on-pr.yml` GitHub Action triggering on `paths: ['campanha-ia/src/lib/ai/**']`. The infra runs but has 0 labeled entries today; Promptfoo CI surfaces "no labeled entries" warning rather than blocking PRs. **Pass-rate gate activation is Phase 2.5 deliverable**, after the labeler is onboarded.
- **`/admin/quality` dashboard page** — reads from `campaign_scores`, surfaces 7-day rolling means per dimension + drift indicators + per-`prompt_version` aggregates. Companion to existing `/admin/custos` (which surfaces costs + `regenerate_reason` aggregate from Phase 01).
- **`prompt_version × regenerate_reason` correlation SQL view** — Postgres view that joins `api_cost_logs.metadata.prompt_version` with `campaigns.regenerate_reason`, refreshable daily. Backs the per-prompt-version drift query used by alert (a). Surface in `/admin/quality`.

**Out of scope (deferred):**
- **Labeling the first 30-50 golden-set entries** → **Phase 2.5 (Labeling)** — blocked on PT-BR fashion copywriter onboarding (or product owner committing 1h/week, decision deferred). Until labels exist, Promptfoo CI runs in observability-only mode (records pass-rates but does not block PR).
- **LLM-judge calibration vs human ground truth** → **Phase 2.5** — the ≥0.7 correlation gate from AI-SPEC §5.1 only activates once labels exist. Until then, judge scores are persisted but not trusted as a quality oracle.
- **Phase 3 — Phoenix tracing** stays deferred. AI-SPEC §7.1 is explicit: tracing without Phase 2's score-per-prompt_version data is debugger-in-the-dark. Revisit after Phase 02 + 2.5 land.
- **Prompt-content edits** (e.g., remove "afina a cintura na hora" at `sonnet-copywriter.ts:289`) — separate phase. Phase 02 is infrastructure; the prompt-content audit + edit cycle is its own work, possibly bundled with the labeler engagement.
- **CONAR/CBARP citations counsel review** — engagement decision, not engineering work.
- **DOMAIN-RUBRIC.md "great output" examples** — product-owner nomination, not engineering work.

</domain>

<decisions>
## Implementation Decisions

### Judge Architecture (Inngest async)
- **D-01:** The LLM-as-judge runs as an Inngest async job triggered by event `campaign/judge.requested`. Pipeline emits the event from `pipeline.ts` after `successCount > 0` (post-`savePipelineResultV3` write). Pattern mirrors existing `generateModelPreviewJob` and `generateBackdropJob` (durable, retryable, off the request path).
- **D-02:** Job retries: 2 attempts with exponential backoff (matches existing model-preview job convention). On final failure: write `nivel_risco='falha_judge'` to `campaign_scores` (sentinel value) so dashboards can distinguish "judge failed" from "low quality". Sentry-captured via existing `captureError` pattern.
- **D-03:** Judge call uses `getAnthropic()` from `lib/ai/clients.ts` (Phase 01 D-10) and the `tool_use` + Zod-boundary pattern established for Sonnet copywriter (Phase 01 D-16). Tool name: `score_campaign_quality`. Schema mirrors the 6 `campaign_scores` columns + a `justificativa` text field per dimension.
- **D-04:** Judge model: `claude-sonnet-4-6` (same as copywriter) — symmetry simplifies cost forecasting and re-uses the existing prompt-version SHA infrastructure. Cost: ~R$0.02/campaign per CONTEXT.md `<deferred>` estimate (carried over from Phase 01 audit recommendation).
- **D-05:** Judge prompt versioning: same SHA mechanism as Phase 01 (`computePromptVersion(JUDGE_SYSTEM_PROMPT)`); written to `api_cost_logs.metadata.prompt_version` so judge-prompt edits are themselves traceable.
- **D-06:** Judge writes to `campaign_scores` via a new helper `setCampaignScores(campaignId, scores)` in `lib/db/index.ts`. The 6 score fields are smallint 1-5 (per existing `baseline.sql:60-76`); helpers must clamp + validate before insert.

### Sentry-Routed Alerts (3 rules)
- **D-07:** Alert (a) — `face_wrong` rate > 5% WoW: nightly cron job (`Inngest cron: '0 7 * * *'`) queries `campaigns.regenerate_reason` aggregated by week, computes WoW delta. If `face_wrong` share > 5% AND week-over-week delta > +1pp, emits a synthetic Sentry issue with fingerprint `face_wrong_spike_<YYYYMMDD>` (date-stable so same week's spike doesn't re-fire). Includes top-3 `prompt_version` SHAs by `face_wrong` count in the breadcrumbs.
- **D-08:** Alert (b) — `nivel_risco="alto"` rate > 1%: same nightly cron, separate query. Fingerprint `nivel_risco_alto_spike_<YYYYMMDD>`. Includes a sample of 5 affected `campaign_id`s in breadcrumbs (not the full payload — PII).
- **D-09:** Alert (c) — Promptfoo PR regression: GitHub Action `eval-on-pr.yml` posts a Sentry issue with fingerprint `promptfoo_regression_pr_<PR_NUMBER>` if rubric pass-rate drops on Critical dimension. **Phase 2.5 activates the PR-blocking behavior**; Phase 02 only emits the Sentry issue (observability-only).
- **D-10:** Alert config lives in `lib/quality/alerts.ts` as TypeScript constants (not Sentry UI rules) so thresholds are git-versioned + reviewable. Sentry rule itself is just "fire on any synthetic issue with these fingerprints".

### Mobile `{reason}` Hook (crialook-app)
- **D-11:** Add a `<RegenerateReasonPicker />` component in `crialook-app/components/historico/` (Modal with 5 options + cancel). Triggered from the existing regenerate button on the historico screen.
- **D-12:** API client wrapper updates to send `{reason: string}` in POST body. Reasons stay PT-BR-key-strings matching `VALID_REGENERATE_REASONS` from Phase 01 (`face_wrong | garment_wrong | copy_wrong | pose_wrong | other`).
- **D-13:** UX flow: user taps regenerate → picker modal slides up → user selects reason → request fires with `{reason}` body → success returns `{free: true}` (per Phase 01 D-03 contract: regen with reason is FREE) → toast confirms regen. If user cancels picker → fall back to legacy paid-regen flow with a "Mande sua opinião pro time" disclaimer.
- **D-14:** This phase only modifies Android (`crialook-app` is Android-only per memory). No iOS work.

### Golden-Set INFRA Scaffold (no labels yet — Phase 2.5)
- **D-15:** Create `campanha-ia/evals/` directory. Subdirs: `golden-set/` (JSON entries), `fixtures/` (image hashes + thumbnails, gitignored if >100KB), `results/` (Promptfoo run outputs).
- **D-16:** Define golden-set entry schema: matches AI-SPEC §5.3 schema-per-entry (anonymized form input + product image + analyzer JSON + VTO image hash + Sonnet copy JSON + `prompt_version` SHA + `regenerate_reason` if applicable + per-rubric labels — labels will be empty objects `{}` until Phase 2.5).
- **D-17:** Create `evals/run.ts` — TypeScript script that loops golden-set entries through `runCampaignPipeline` with new `dryRun: true` flag (skips DB writes + storage uploads). Emits per-entry pass/fail per dimension. With zero labels: only schema-level + regex-level checks gate (e.g., "Sonnet copy returns valid JSON with all required keys", "no forbidden tokens in output"). Pass-rate gate on Critical dimensions activates in Phase 2.5.
- **D-18:** Add `dryRun` parameter to `runCampaignPipeline` in `pipeline.ts` — when true, skips the Supabase upload + the Inngest judge enqueue + the cost-log write (so eval runs don't pollute production data).
- **D-19:** GitHub Action `.github/workflows/eval-on-pr.yml` triggers on `paths: ['campanha-ia/src/lib/ai/**', 'campanha-ia/evals/**']`. Runs `cd campanha-ia && npx promptfoo eval --config evals/promptfoo.config.yaml --output evals/results/$PR.json`. Posts a comment to the PR with results table. **Does NOT fail PR in Phase 02** (observability-only); Phase 2.5 changes the action to fail PR on Critical-dimension regression.
- **D-20:** Promptfoo install: `npm install -D promptfoo` in `campanha-ia/`. Verify it works with bare-SDK (no LangChain dep) — Promptfoo is pipeline-agnostic so this should be clean.

### `/admin/quality` Dashboard
- **D-21:** New page at `campanha-ia/src/app/admin/quality/page.tsx`. Companion to `/admin/custos`. Reads from `campaign_scores` + `api_cost_logs.metadata`. Sections:
  - 7-day rolling mean per dimension (6 dimensions) with WoW delta arrows
  - Per-`prompt_version` aggregate table (top 10 by row count, sortable by any dimension's mean)
  - "Top 10 worst-rated last 7 days" sample table (campaign IDs + thumbnail + judge `justificativa` snippet)
  - `prompt_version × regenerate_reason` correlation matrix (heatmap-style, from the SQL view per D-22)
- **D-22:** Postgres view `vw_prompt_version_regen_correlation`: joins `api_cost_logs.metadata->>'prompt_version'` with `campaigns.regenerate_reason`. Refreshable daily (or on-demand from admin page). Migration adds the view; nightly Inngest cron refreshes if it's a `MATERIALIZED VIEW` (decide: planner picks based on row count — under ~100K rows, regular VIEW is fine).

### Decision precedence + scope discipline
- **D-23:** Phase 02 does NOT touch prompt content. The DOMAIN-RUBRIC.md vs `sonnet-copywriter.ts:289` "afina a cintura" conflict (logged in Phase 01 deferred-items.md) is handled in a separate prompt-edit phase. If a Phase 02 task notices an opportunity to fix prompt content, log it to deferred-items.md and continue.
- **D-24:** Phase 02 does NOT activate Promptfoo PR-blocking. Until labels exist (Phase 2.5), CI runs and reports but doesn't gate. This is intentional: blocking PRs without ground truth would create false-positive friction.
- **D-25:** Judge calibration target ≥0.7 correlation with human labels (AI-SPEC §5.1) is Phase 2.5 acceptance criterion. Phase 02 just persists the scores.

### Claude's Discretion
- **C-01:** Order of execution within phase — planner picks. Suggested: D-15..D-20 first (eval scaffold isolated, no dependencies) → D-01..D-06 (judge wiring) → D-21..D-22 (admin/quality dashboard, depends on judge populating campaign_scores) → D-07..D-10 (alerts, depend on dashboard data + correlation view) → D-11..D-14 (mobile hook, completely independent — could parallel from start).
- **C-02:** Test coverage targets — mandatory: judge tool_use parser (mirrors Phase 01 sonnet test pattern); Inngest job idempotency (re-emit `judge.requested` for same campaignId → only one row in campaign_scores); evals/run.ts dry-run safety (verify no DB writes, no Inngest emit). Optional: integration test for `/admin/quality` page (Vitest + React Testing Library if quick; skip if frontend test infra needs setup).
- **C-03:** crialook-app picker UX — planner picks the modal library (Gorhom Bottom Sheet is already in stack per STACK.md). Use it. Don't import a new modal lib.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 01 outputs (the foundation Phase 02 builds on)
- `.planning/phases/01-ai-pipeline-hardening/01-AI-SPEC.md` §5 (Eval Strategy with `[Phase 2]` rows), §6.2 (Offline flywheel metrics), §7 (Production monitoring + alerts) — Phase 02 implements every `[Phase 2]`-tagged item here.
- `.planning/phases/01-ai-pipeline-hardening/01-CONTEXT.md` `<deferred>` section — explicit list of what Phase 02 inherits.
- `.planning/codebase/AI-PIPELINE-AUDIT.md` Dimension 4 Phases 1-4 rollout plan — Phase 02 = Phases 2 + 3 of the audit's 4-phase eval rollout (Phase 4 audit = Phase 03 in our roadmap).
- `.planning/codebase/DOMAIN-RUBRIC.md` — judge prompt MUST reference this rubric for the 5 quality dimensions (Garment-attribute / Color/wash / Mental-trigger / Anti-cliché / Compliance-safe). Use the Forbidden List as the rubric for `nivel_risco='alto'`.

### Phase 01 deferred-items (carried forward awareness)
- `.planning/phases/01-ai-pipeline-hardening/deferred-items.md` — known prompt-content conflict at `sonnet-copywriter.ts:289` (NOT fixed this phase; if judge alerts surface it, that's signal working as intended).

### Codebase intel (must-read for orientation)
- `.planning/codebase/ARCHITECTURE.md` §"AI Pipeline" + §"Background Jobs" + §"Data Flow"
- `.planning/codebase/STACK.md` §"campanha-ia" (Inngest pattern) + §"crialook-app" (Gorhom Bottom Sheet, MMKV, Clerk)

### AI pipeline source files (the change surface)
- `campanha-ia/src/lib/ai/clients.ts` — `getAnthropic()` for judge call (Phase 01 D-10)
- `campanha-ia/src/lib/ai/sonnet-copywriter.ts` — pattern to mirror for judge `tool_use` + Zod boundary (Phase 01 D-16)
- `campanha-ia/src/lib/ai/log-model-cost.ts` — judge calls cost-log here (Phase 01 D-18) with `prompt_version` from `lib/ai/prompt-version.ts`
- `campanha-ia/src/lib/ai/pipeline.ts` — emit `campaign/judge.requested` event after `successCount > 0` (after `savePipelineResultV3`); add `dryRun?` param for evals/run.ts
- `campanha-ia/src/lib/inngest/client.ts` + `functions.ts` — pattern for new `judgeCampaignJob` mirrors existing `generateModelPreviewJob`
- `campanha-ia/src/lib/db/index.ts` — add `setCampaignScores(campaignId, scores)` helper; existing `campaign_scores` table per `baseline.sql:60-76`
- `campanha-ia/src/lib/observability.ts` — `captureError` for fire-and-forget judge failures + the 3 synthetic alert issues (D-07/08/09)
- `campanha-ia/src/app/admin/custos/page.tsx` — reference pattern for new `/admin/quality/page.tsx`
- `crialook-app/app/(tabs)/historico.tsx` — regenerate button location (1222 LoC — likely deep, planner reads carefully); existing API call wrapper to extend with `{reason}` body
- `crialook-app/components/historico/` — directory exists per git status; new `RegenerateReasonPicker.tsx` lands here
- `crialook-app/lib/api.ts` — API client; existing `regenerateCampaign(id)` signature gains optional `{reason}` arg
- `campanha-ia/supabase/migrations/00000000000000_baseline.sql` lines 60-76 — `campaign_scores` schema reference (column types: smallint 1-5)

### External dependencies to install
- `promptfoo` (`-D` in `campanha-ia/`) — eval framework, OSS, language-agnostic CLI

### Memory notes
- `crialook-app é Android-only` — D-14 confirms this phase only ships Android picker
- `EAS build expects npm 10 lock` — if D-11..D-14 modifies crialook-app/package.json (probably won't — Gorhom + the existing API client are sufficient), use `npm run lock:fix`
- `Clerk Client Trust desligado` — irrelevant to this phase

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (heavy reuse from Phase 01)
- **`getAnthropic()` from `lib/ai/clients.ts`** — judge call's only LLM client (D-03). Single source of truth, no inline singleton.
- **Anthropic `tool_use` + Zod-boundary pattern** from sonnet-copywriter.ts — judge mirrors this exactly. `JudgeOutputSchema` (Zod) + `JudgeInvalidOutputError extends Error` calling `captureError`.
- **`computePromptVersion()` + per-prompt SHA constants** from `lib/ai/prompt-version.ts` — judge prompt gets its own `JUDGE_PROMPT_VERSION` constant; flows to `api_cost_logs.metadata` via `logModelCost`.
- **`logModelCost()` from `lib/ai/log-model-cost.ts`** — judge call writes its cost row through this helper. New `action: "judge_quality"` and `model: "claude-sonnet-4-6"`. Falls back via `FALLBACK_TOKENS["judge_quality"]` (planner adds an entry).
- **Inngest function pattern** — `generateModelPreviewJob` and `generateBackdropJob` in `lib/inngest/functions.ts` are the direct templates. `judgeCampaignJob` follows the same shape: `inngest.createFunction({ id, retries, triggers })` + `step.run("step-name", async () => {...})`.
- **`captureError` from `lib/observability.ts`** — fires on judge failure (already established) + the 3 synthetic alert issues (D-07/08/09 fingerprint patterns).
- **Gorhom Bottom Sheet** (in `crialook-app` per STACK.md `^5.2.10`) — direct fit for the picker modal in D-11.
- **MMKV cache + TanStack React Query** — `crialook-app` already uses these for API state; the `{reason}`-augmented regenerate call slots in without new infra.

### Established Patterns
- **Fire-and-forget for non-critical writes** — judge failures must not block UX (mirrors cost-log fire-and-forget). Inngest itself is durable so the job will retry; the orchestrator (`pipeline.ts`) doesn't await its result.
- **Sentry synthetic issues with stable fingerprints** — pattern established in some legacy code (planner verifies); use stable date-bucketed fingerprints (D-07/08) so weekly cron doesn't re-fire identical issues.
- **PT-BR error/user-facing strings, English logs/technical fields** — judge `justificativa` text fields write PT-BR (lojista may eventually see them); judge `prompt_version` and SQL view names stay English.
- **GitHub Action paths-filter triggering** — repo has `.github/workflows/` per `git status`; planner reads existing CI config to match style.

### Integration Points
- **`pipeline.ts` after `savePipelineResultV3` → emit Inngest event** — single integration point for judge wiring. ~3-5 line change.
- **`/admin/quality` page → reads `campaign_scores` + `vw_prompt_version_regen_correlation`** — new page, no integration with existing dashboards beyond shared layout/auth.
- **`crialook-app/lib/api.ts → regenerateCampaign(id, reason?)`** — single API client function gains an optional `reason` param; existing call sites pass `undefined` (legacy behavior preserved).
- **GitHub Action `eval-on-pr.yml`** — new file, no integration with existing workflows.
- **Inngest `judgeCampaignJob`** — new function added to `inngestFunctions` array exported from `functions.ts:329`.

</code_context>

<specifics>
## Specific Ideas

- **Judge tool name:** `score_campaign_quality` — symmetric with copywriter tool naming convention (`generate_dicas_postagem`).
- **Judge tool schema:** 6 numeric fields (smallint 1-5 each) + 6 `justificativa_*` text fields (one short PT-BR sentence per dimension explaining the score) + `nota_geral` computed by judge (not server-side average) so the model can apply weights.
- **`nivel_risco` enum values** match AI-SPEC §6.1 forbidden-token regex categories: `baixo` (default), `medio` (one yellow flag), `alto` (any forbidden token category triggered, OR an invented fact pattern). Maps to `campaign_scores.nivel_risco` text column.
- **Synthetic Sentry issue fingerprints** (D-07/08/09):
  - `face_wrong_spike_<YYYYMMDD>` (date-bucketed by Monday-of-week)
  - `nivel_risco_alto_spike_<YYYYMMDD>` (date-bucketed daily)
  - `promptfoo_regression_pr_<PR_NUMBER>` (per-PR)
- **`/admin/quality` dashboard 7-day rolling mean tile shape:** mimic existing `/admin/custos` 4-card grid pattern; just swap cost values for dimension means with WoW delta arrows.
- **Inngest `judgeCampaignJob` event payload:** `{ campaignId: string, storeId: string, copyText: string, productImageUrl: string, modelImageUrl: string, generatedImageUrl: string, prompt_version: string }` — minimal fields the judge needs without re-fetching from DB.
- **Mobile picker labels (PT-BR):** `Rosto errado` / `Peça errada` / `Texto ruim` / `Pose errada` / `Outro motivo` (matches admin/custos tile labels for symmetry — verify with Phase 01's actual tile copy).

</specifics>

<deferred>
## Deferred Ideas

### Phase 2.5 — Labeling + PR-Blocking Gate
- **Curate first 30-50 golden-set entries with rubric labels** — pre-requisite: PT-BR fashion copywriter onboarded OR product owner commits 1h/week. Without this the judge scores are persisted but uncalibrated.
- **Calibrate LLM-judge against human labels** — target ≥0.7 correlation per AI-SPEC §5.1; if correlation lower, refine judge prompt + re-run.
- **Activate Promptfoo PR-blocking gate** — change `eval-on-pr.yml` from observability-only to PR-failing on Critical-dimension regression >5pp.
- **Quarterly compliance review** by CONAR-savvy counsel on a sampled batch of public posts (per AI-SPEC §1b "Domain Expert Roles").

### Phase 03 — Observability (Phoenix Tracing)
- **Arize Phoenix per-span tracing** with `prompt_version` + token-counts + judge scores as span attributes (AI-SPEC §7.1).
- **Anomaly-driven sampling** from Phoenix spans (AI-SPEC §7.4 Phase 3 row).
- **Latency alerts** for Sonnet p99 > 30s sustained, VTO p99 > 90s sustained (AI-SPEC §7.3 alerts 4 + 5).

### Adjacent (separate phases or follow-up work — captured for backlog)
- **Prompt-content audit + edit cycle** — fix `sonnet-copywriter.ts:289` "afina a cintura na hora" + run full Forbidden List sweep against current prompts. Likely bundled with copywriter onboarding.
- **DOMAIN-RUBRIC.md "great output" examples** — product-owner nominates 2-3 anonymized real campaigns. Engagement decision.
- **CBARP citations independent verification** — counsel cross-checks the article references against the 2024 PDF before treating DOMAIN-RUBRIC.md as a formal compliance reference.
- **Mobile picker iOS port** — irrelevant per `crialook-app é Android-only` memory; if iOS ever ships, this is a one-day port.
- **Cosmetic: rebase Phase 01's 3 commits with drifted messages** — `0bb5338`, `7304961`, `eebb453` carry duplicate `feat(admin)(01-07)` messages; non-functional, deferred indefinitely.

</deferred>

---

*Phase: 02-quality-loop*
*Context gathered: 2026-05-03*
