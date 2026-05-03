---
phase: 02-quality-loop
plan: 03
subsystem: ai
tags: [judge, llm-as-judge, anthropic, inngest, tool-use, zod-boundary, sentinel, idempotent-upsert, dryRun, canary]

# Dependency graph
requires:
  - phase: 01-ai-pipeline-hardening
    provides: "getAnthropic() + tool_use + Zod boundary pattern + computePromptVersion + logModelCost"
  - phase: 02-quality-loop
    plan: 02
    provides: "PipelineInput.dryRun gate + reserved Inngest emit slot at pipeline.ts:328"
provides:
  - "lib/ai/judge.ts — scoreCampaignQuality + JudgeOutputSchema + JudgeInvalidOutputError + JUDGE_PROMPT_VERSION (8627dc8411fe)"
  - "judge_quality entry in FALLBACK_TOKENS (~1200 in / 800 out)"
  - "setCampaignScores helper in lib/db (idempotent UPSERT on campaign_id, clamps 1-5)"
  - "judgeCampaignJob Inngest function (3 steps, retries:2, falha_judge sentinel onFailure)"
  - "campaign/judge.requested emit in pipeline.ts (gated by !dryRun + successCount>0 + storeId + campaignId)"
  - "VTO logModelCost gated by dryRun (closes 02-02 follow-up)"
affects: [02-04-quality-dashboard, 02-05-correlation-view, 02-06-sentry-alerts, phase-2.5-labeling]

# Tech tracking
tech-stack:
  added: ["JUDGE_PROMPT_VERSION SHA constant pattern (already used by Sonnet/Analyzer/VTO — judge is the 4th)"]
  patterns:
    - "Inngest createFunction with onFailure sentinel writer (D-02 falha_judge)"
    - "PT-BR judge prompt verbatim-quoting DOMAIN-RUBRIC.md (no rubric drift between doc + runtime prompt)"
    - "tool_use + Zod boundary parallel to sonnet-copywriter.ts (D-16)"
    - "Idempotent UPSERT on natural key (campaign_id) for retry-safe writes"

key-files:
  created:
    - "campanha-ia/src/lib/ai/judge.ts"
    - "campanha-ia/src/lib/ai/judge.test.ts"
    - "campanha-ia/src/lib/inngest/judge.test.ts"
    - "campanha-ia/src/lib/db/set-campaign-scores.test.ts"
    - ".planning/phases/02-quality-loop/deferred-items.md"
  modified:
    - "campanha-ia/src/lib/pricing/fallbacks.ts"
    - "campanha-ia/src/lib/db/index.ts"
    - "campanha-ia/src/lib/inngest/functions.ts"
    - "campanha-ia/src/lib/ai/pipeline.ts"
    - "campanha-ia/src/lib/ai/pipeline.test.ts"
    - "campanha-ia/src/lib/ai/gemini-vto-generator.ts"

key-decisions:
  - "Judge prompt is a NEW 12-char SHA (8627dc8411fe) — verified NOT one of the 4 Phase 01 SHAs"
  - "tool name `score_campaign_quality` LOCKED per CONTEXT.md <specifics>"
  - "nivel_risco enum is baixo|medio|alto only — `falha_judge` is NEVER emitted by the model (Zod rejects it); only the Inngest onFailure handler writes that sentinel via setCampaignScores"
  - "nota_geral computed by the judge with its own weighting (NOT a server-side average) per <specifics>"
  - "productImageUrl + modelImageUrl passed as empty strings — pipeline.ts has them as base64, not URLs. Default = Accept (option a). Logged in deferred-items.md for canary review."
  - "Gate set: !input.dryRun && imageResult.successCount > 0 && input.storeId && input.campaignId — all 4 must be present to emit"
  - "VTO logModelCost wrapping (Plan 02-02 follow-up) added — coherent dryRun semantics across all 4 cost-log sites"
  - "No FEATURE_JUDGE_QUALITY env flag added — canary recommendation in this SUMMARY suggests softer rollout strategy"

requirements-completed: [D-01, D-02, D-03, D-04, D-05, D-06, D-23, D-25]

# Metrics
duration: ~30min
completed: 2026-05-03
---

# Phase 02 Plan 03: Judge Wiring Summary

**LLM-as-judge wired end-to-end as Inngest async — every successful campaign gets scored across 5 numeric dims + nivel_risco enum within minutes, with retry:2 + falha_judge sentinel on terminal failure. Pause for canary review before push.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-05-03T15:14Z
- **Completed:** 2026-05-03T15:44Z
- **Tasks:** 3 code tasks + 1 canary checkpoint (this SUMMARY)
- **Files created:** 5 (3 source/test + 1 deferred-items + this SUMMARY)
- **Files modified:** 6
- **New tests:** 38 (16 judge.test + 9 set-campaign-scores.test + 9 inngest judge.test + 4 pipeline.test additions)

## Task Commits

| Step | Hash | Type | Scope |
|------|---------|------|-------|
| 1 | `0c76837` | feat(pricing) | judge_quality fallback tokens + prices (D-04) |
| 2 | `4af1a78` | feat(db) | setCampaignScores idempotent UPSERT helper (D-06) |
| 3 | `a35509d` | feat(ai) | judge.ts with score_campaign_quality tool + Zod boundary (D-01..D-05) |
| 4 | `1099e46` | feat(inngest) | judgeCampaignJob + retries:2 + falha_judge sentinel (D-01, D-02) |
| 5 | `222b569` | feat(ai) | pipeline emits campaign/judge.requested after success (D-01) |
| 6 | `172178f` | feat(ai) | wrap gemini-vto-generator logModelCost behind dryRun (02-02 follow-up) |

**Plan metadata commit:** _pending — appended after canary review approves._

## Files Created / Modified (with LoC)

### Created

| Path | LoC | Purpose |
|------|-----|---------|
| `campanha-ia/src/lib/ai/judge.ts` | 327 | scoreCampaignQuality + JudgeOutputSchema + JudgeInvalidOutputError + JUDGE_PROMPT_VERSION + tool definition + PT-BR system prompt |
| `campanha-ia/src/lib/ai/judge.test.ts` | 330 | 16 vitest cases (schema, error class, prompt-version, happy path, failure paths, leading-text edge) |
| `campanha-ia/src/lib/inngest/judge.test.ts` | 306 | 9 vitest cases (happy path orchestration, falha_judge sentinel × 3, idempotency proxy, config, registration) |
| `campanha-ia/src/lib/db/set-campaign-scores.test.ts` | 159 | 9 vitest cases (idempotency, clamp high/low/round, payload shape × 3, error propagation) |
| `.planning/phases/02-quality-loop/deferred-items.md` | ~50 | productImageUrl/modelImageUrl gap + sonnet-copywriter:289 noted (D-23) |

### Modified (LoC delta only)

| Path | Delta | Change |
|------|-------|--------|
| `campanha-ia/src/lib/pricing/fallbacks.ts` | +17 | judge_quality entry with cost-derivation comment block |
| `campanha-ia/src/lib/db/index.ts` | +83 | setCampaignScores helper + CampaignScoresInput interface + JSDoc |
| `campanha-ia/src/lib/inngest/functions.ts` | +147 | judgeCampaignJob (createFunction + onFailure + 3 steps) + array registration + 3 imports |
| `campanha-ia/src/lib/ai/pipeline.ts` | +33 / -10 | inngest import + emit block (replaced Plan 02-02 placeholder) + thread input.dryRun into VTO call |
| `campanha-ia/src/lib/ai/pipeline.test.ts` | +63 | inngest mock + VTO fixture imageUrl + 4 new emit cases |
| `campanha-ia/src/lib/ai/gemini-vto-generator.ts` | +18 / -1 | dryRun?: boolean field on GeminiVTOInput + guard at line 437 |

## Tests Added (38 total, 0 regressions)

**`src/lib/ai/judge.test.ts` (16 cases)**
1. Zod: accepts valid payload
2. Zod: rejects naturalidade=10 (above 5)
3. Zod: rejects naturalidade=0 (below 1)
4. Zod: rejects nivel_risco='falha_judge' (sentinel must come from us, not model)
5. Zod: rejects payload missing required justificativa
6. Error class: code/userMessage/cause shape
7. Error class: optional cause preserved
8. JUDGE_PROMPT_VERSION: matches /^[0-9a-f]{12}$/
9. JUDGE_PROMPT_VERSION: NOT one of the 4 Phase 01 SHAs
10. Happy path: returns parsed output + usage
11. Happy path: calls Anthropic with locked tool_choice + score_campaign_quality + temp=0.2
12. Happy path: wraps with withTimeout(30_000, 'Judge Quality')
13. Failure: throws JudgeInvalidOutputError + pages Sentry on no tool_use
14. Failure: throws + pages Sentry on Zod-fail with bad input
15. Failure: does NOT retry on schema validation failure
16. Edge: parser ignores leading text blocks, finds named tool_use

**`src/lib/inngest/judge.test.ts` (9 cases)**
1. Happy path: orchestration order (3 steps) + scoreCampaignQuality args + setCampaignScores payload + logModelCost args + return shape
2. Sentinel: setCampaignScores called with nivel_risco='falha_judge' + numerics=1 + error message embedded
3. Sentinel: handles wrapped Inngest event shape (event.data.event.data)
4. Sentinel: does NOT throw when campaignId missing
5. Idempotency proxy: re-emit → setCampaignScores called twice with same campaignId
6. Config: event name LOCKED 'campaign/judge.requested'
7. Config: retries:2
8. Config: id='judge-campaign'
9. Registration: in inngestFunctions array

**`src/lib/db/set-campaign-scores.test.ts` (9 cases)**
1. Idempotency: upsert with onConflict:'campaign_id'
2. Idempotency: re-emit → 2 upserts with same key (DB layer collapses)
3. Clamp: high (7 → 5)
4. Clamp: low (0 → 1)
5. Clamp: round non-integer (3.6 → 4)
6. Payload: 6 PT-BR justificativas land in melhorias JSONB
7. Payload: legacy urgencia=3 (neutral midpoint)
8. Payload: nivel_risco passthrough including 'falha_judge'
9. Error propagation: throws when supabase returns error

**`src/lib/ai/pipeline.test.ts` (4 NEW cases on top of 6 existing)**
1. Emit: dryRun=true → no emit (eval traffic stays off Inngest)
2. Emit: dryRun=false + successCount>0 → exactly 1 emit with locked event name + payload shape
3. Emit: successCount=0 → no emit (judge has nothing to score)
4. Emit: missing storeId → no emit

## JUDGE_PROMPT_VERSION (D-05)

**SHA: `8627dc8411fe`** (12-char hex prefix of SHA-256 of JUDGE_SYSTEM_PROMPT body)

Verified NOT equal to any Phase 01 SHA:
- Sonnet PT: `368daa52106b` — preserved (sonnet-copywriter.ts unchanged this plan)
- Sonnet EN: `6fb4023c4732` — preserved
- Analyzer:  `5c900fb19472` — preserved (gemini-analyzer.ts unchanged)
- VTO:       `9d5c754caf28` — preserved (gemini-vto-generator.ts only added optional `dryRun?` field; VTO_TEMPLATE_PROMPT byte-identical)

## Judge System Prompt Preview (first 30 lines verbatim — for review)

```
Você é avaliador de qualidade de copy para anúncios de moda no Instagram brasileiro.
Recebe (a) o texto da legenda gerada pelo copywriter, (b) URLs da foto do produto, da modelo e da imagem VTO final.
Sua tarefa é pontuar 5 dimensões em escala 1-5 (1 pior, 5 melhor) + 1 nota_geral computada por você + classificar nivel_risco.
Você também escreve uma justificativa curta em PT-BR para cada dimensão (a lojista pode ler).

═══════════════════════════════════════════════════
DIMENSÕES NUMÉRICAS (sempre 1-5 inteiro)
═══════════════════════════════════════════════════

1. naturalidade — Soa humano e brasileiro? Tem gancho de scroll-stop nos primeiros 12 palavras?
   Evita os clichês listados (Tá perfeito 🔥, Look pronto, Arrasou/Arrasadora, Diva, Maravilhosa,
   Apaixonada, Confira esta peça incrível, Sem palavras, "🔥🔥🔥" sem texto, Disponível agora,
   Não perca, Corre pra garantir, Peça única)?
   Usa exatamente 1 dos 5 gatilhos identificável em <5s?
     - Escassez ("últimas peças", "repôs e já tá saindo")
     - Prova social ("a queridinha voltou", "todo mundo tá pedindo")
     - Curiosidade ("achei a calça que…", "descobri o truque…")
     - Transformação do LOOK ("de casa pro trabalho sem trocar", "transforma o jeans em produção de festa") — NUNCA do CORPO
     - Preço (apenas se valor estiver no contexto)

2. conversao — CTA específico (não genérico tipo só "Comenta EU QUERO")?
   Pede ação clara (manda no direct, comenta com tamanho, etc)?

3. clareza — Frases ≤12 palavras? 3-5 linhas total? Cada frase em linha separada (\n entre frases)?

4. aprovacao_meta — Probabilidade de passar revisão Meta/Instagram?
   Sem termos médicos/farmacêuticos, sem reivindicações superlativas sem prova,
   sem testemunhos inventados.

5. nota_geral — SUA média ponderada das outras 4 + ajuste pelo nivel_risco.
```

Full prompt: 4228 chars / ~110 lines — see `campanha-ia/src/lib/ai/judge.ts` lines 145-250 for the complete body. Cites the 6 Forbidden List categories (Sizes / Body-transformation / Invented testimonials / Unproven superlatives / Identity drift / Denim wash drift) verbatim from DOMAIN-RUBRIC.md and the 5-trigger taxonomy.

## Tool Schema Preview (the JSON Schema fed to Anthropic)

```json
{
  "name": "score_campaign_quality",
  "description": "Score the campaign across 5 numeric quality dimensions plus a nivel_risco enum. Use 1-5 integer scale (1 worst, 5 best). Output one PT-BR justificativa per dimension. nota_geral is your own weighted score across the other dimensions, not an arithmetic mean.",
  "input_schema": {
    "type": "object",
    "properties": {
      "naturalidade":   { "type": "integer", "minimum": 1, "maximum": 5 },
      "conversao":      { "type": "integer", "minimum": 1, "maximum": 5 },
      "clareza":        { "type": "integer", "minimum": 1, "maximum": 5 },
      "aprovacao_meta": { "type": "integer", "minimum": 1, "maximum": 5 },
      "nota_geral":     { "type": "integer", "minimum": 1, "maximum": 5 },
      "nivel_risco":    { "type": "string", "enum": ["baixo", "medio", "alto"] },
      "justificativa_naturalidade":    { "type": "string" },
      "justificativa_conversao":       { "type": "string" },
      "justificativa_clareza":         { "type": "string" },
      "justificativa_aprovacao_meta":  { "type": "string" },
      "justificativa_nota_geral":      { "type": "string" },
      "justificativa_nivel_risco":     { "type": "string" }
    },
    "required": ["naturalidade", "conversao", "clareza", "aprovacao_meta", "nota_geral", "nivel_risco", "justificativa_naturalidade", "justificativa_conversao", "justificativa_clareza", "justificativa_aprovacao_meta", "justificativa_nota_geral", "justificativa_nivel_risco"]
  }
}
```

`tool_choice: { type: "tool", name: "score_campaign_quality" }` forces the model to ALWAYS emit a single tool_use block with this exact shape — Zod boundary catches any drift at runtime.

## Cost Projection

**Per-judge-call estimate** (claude-sonnet-4-6 via FALLBACK_PRICES):

| Component | Tokens | Price (per 1M) | USD | BRL @ 5.8 |
|-----------|-------:|---------------:|----:|----------:|
| Input (prompt + user text) | 1,200 | $3.00 | $0.0036 | R$ 0.021 |
| Output (12 fields under tool_use) | 800 | $15.00 | $0.0120 | R$ 0.070 |
| **Total per campaign** | | | **$0.0156** | **R$ 0.091** |

**vs Phase 01 baseline** (AI-SPEC §4b.5):
- Existing per-campaign cost: ~R$ 0.29 (analyzer + VTO + copywriter)
- Judge adds: ~R$ 0.09 → **new total: ~R$ 0.38/campaign** (+31% absolute)

**Volume / monthly impact** (CONTEXT.md `<deferred>` notes the R$0.02 hand-wave estimate; we're 4x higher because the rubric prompt is denser than the back-of-envelope assumed):
- Unknown current generation volume — recommend pulling a 7-day count from `api_cost_logs` post-deploy:
  ```sql
  SELECT COUNT(*) FROM campaigns WHERE status='completed' AND created_at > now() - interval '7 days';
  ```
- At 100 campaigns/day → R$ 9/day → R$ 270/month judge overhead
- At 1000 campaigns/day → R$ 90/day → R$ 2,700/month judge overhead

Real usage from the SDK overrides the FALLBACK estimate once live (logModelCost prefers `args.usage.*` when present) — actual cost should land within ±20% of the projection.

**Cost reduction lever (Phase 03 candidate):** Anthropic prompt caching (`cache_control: {type:"ephemeral"}` on the system block) would knock ~30% off judge input cost for repeat lojistas within 5 min — not added speculatively per Phase 01 D-15 / cache-vs-prompt-version interaction note.

## Canary Plan Recommendation

**Recommended canary strategy: monitor-and-revert**

The judge is fire-and-forget at the pipeline level (`void inngest.send(...)`) — a judge failure NEVER blocks the user-facing SSE response. The blast radius is contained to:
1. Inngest worker compute (judgeCampaignJob retries 2x then writes falha_judge)
2. `api_cost_logs` rows (~R$ 0.09 each, accumulating)
3. `campaign_scores` rows (1 per successful campaign, idempotent)

**Step-by-step rollout:**

1. **Pre-deploy (manual, this canary review):**
   - Apply the UNIQUE constraint migration on `campaign_scores.campaign_id` (see SQL below) — without it the upsert raises "no unique constraint matching ON CONFLICT specification" at runtime.
   - Confirm `ANTHROPIC_API_KEY` env var is set in production (judge calls fail-closed without it).
2. **Deploy to production:** all 6 commits land via the same merge.
3. **First 1 hour:** monitor Sentry for `JudgeInvalidOutputError` issue spikes. If >5 in 1h → revert.
4. **First 24 hours:** monitor Inngest dashboard `judge-campaign` function — terminal-failure rate should be <1%. Sample 10 random `campaign_scores` rows and eyeball the PT-BR justificativas for hallucination / language quality.
5. **First week:** check `api_cost_logs WHERE action='judge_quality'` total cost, compare against the projection table above. Adjust FALLBACK_TOKENS estimate if real usage diverges >20%.
6. **Revert path (if needed):** `git revert 172178f 222b569 1099e46 a35509d 4af1a78 0c76837` (in that order — reverse-chronological). Pipeline emit is the only "live" surface; the others are dead code without it.

**Alternative: env-flag canary (not recommended, but available):**
If you want a per-deploy kill-switch instead of revert-via-git, add at the emit site:
```typescript
if (process.env.FEATURE_JUDGE_QUALITY === "1" && !input.dryRun && ...)
```
Default off, flip to "1" via Vercel env when ready. Mentioned per Plan 02-03 Task 4 option `(needs canary flag)` — request it in the canary checkpoint and it's a 2-line patch.

## Schema Migration Required (BLOCKING for runtime)

`setCampaignScores` requires a UNIQUE constraint on `campaign_scores.campaign_id`. The baseline schema (00000000000000_baseline.sql) does NOT have it — only a primary key on `id`.

**Verify on Supabase:**
```sql
SELECT conname FROM pg_constraint
WHERE conrelid = 'public.campaign_scores'::regclass
  AND contype = 'u';
```

If no row mentions `campaign_id`, apply this migration **before merging** Plan 02-03:

```sql
-- File: campanha-ia/supabase/migrations/{timestamp}_add_campaign_scores_unique_campaign_id.sql
ALTER TABLE public.campaign_scores
  ADD CONSTRAINT campaign_scores_campaign_id_key
  UNIQUE (campaign_id);
```

Apply via `npx supabase db push` (or the project's standard migration workflow).

**Migration file NOT created in this plan** — the canary-review checkpoint is the right time to decide whether to ship the migration in this PR or as a separate PR ahead of the deploy. Default recommendation: **separate PR, applied first, so production has the constraint when this code lands.**

## Decisions Made

- **JUDGE_PROMPT_VERSION = `8627dc8411fe`** — verified NEW SHA, not one of the 4 Phase 01 SHAs.
- **Tool name `score_campaign_quality` LOCKED** — appears 5x in judge.ts (tool def name, tool_choice, plus tests + comments).
- **`nivel_risco` Zod enum is baixo|medio|alto only** — `falha_judge` deliberately rejected by Zod so the model NEVER emits the sentinel; only the Inngest onFailure handler writes it via setCampaignScores.
- **`nota_geral` computed by judge with own weighting** — NOT a server-side average. Per CONTEXT.md `<specifics>`. Prompt instructs the model explicitly: "NÃO é média aritmética — você decide os pesos".
- **Empty productImageUrl/modelImageUrl in pipeline.ts emit (option a)** — pipeline.ts has them as base64, not as public Supabase URLs. Judge prompt is robust to this. Logged in `deferred-items.md` for Phase 03 follow-up.
- **No FEATURE_JUDGE_QUALITY env flag added** — recommended monitor-and-revert canary instead. Available as 2-line patch if user prefers env-flag rollout.
- **No UNIQUE constraint migration created** — depends on whether canary review wants ship-in-same-PR or separate-PR-first. Default: separate PR.
- **VTO logModelCost wrap (Plan 02-02 follow-up) IS in scope** — execution_directives Step 7 explicitly asked for it. Single coherent dryRun semantics across all 4 cost-log sites now.
- **Single tsx invocation pattern reused** — judge prompt SHA extracted via `node -e` regex on the source file (since judge.ts pulls in @/lib/observability → Sentry, can't be imported from a one-off Node script).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Inngest createFunction `.fn` and `.opts.onFailure` are typed as private in the SDK type definitions**
- **Found during:** Task 4 tsc check after writing `src/lib/inngest/judge.test.ts`.
- **Issue:** Tests invoke `(judgeCampaignJob as { fn: ... }).fn(...)` and `(judgeCampaignJob as { opts: { onFailure } }).opts.onFailure(...)` to drive the handler directly without spinning up the Inngest dev server. Inngest's `InngestFunction<...>` type marks `fn` and `opts.onFailure` as `private`, so a direct `as { fn: ... }` cast fails with TS2352 ("Property 'fn' is private in type ... but not in type '{ fn: ... }'").
- **Fix:** Pre-cast through `unknown` first: `(judgeCampaignJob as unknown as { fn: ... })`. This is the escape-hatch tsc itself recommends in the error message.
- **Files modified:** `campanha-ia/src/lib/inngest/judge.test.ts` (5 locations).
- **Verification:** `npx tsc --noEmit` clean, `npx vitest run src/lib/inngest/judge.test.ts` 9/9 pass.
- **Committed in:** `1099e46` (Inngest function commit).

**2. [Rule 2 - Missing critical] pipeline.test.ts VTO mock fixture didn't expose `imageUrl`**
- **Found during:** Task 5 — adding the new emit-assertion tests revealed the existing VTO mock returned `images: [{ base64, mimeType, durationMs }]` but the new emit code reads `imageResult.images[0]?.imageUrl` (a Supabase public URL field).
- **Issue:** Without imageUrl, the emit guard `if (generatedImageUrl)` filters out the send entirely → tests would silently report "no emit" when the real cause is a missing fixture field, masking real regressions later.
- **Fix:** Added `imageUrl: "https://supabase.test/vto-output.png"` to the makeVTOResult fixture.
- **Files modified:** `campanha-ia/src/lib/ai/pipeline.test.ts`.
- **Verification:** New emit assertion test passes (`emits ONCE with locked event name`); existing 6 tests still pass (10/10 total).
- **Committed in:** `222b569` (pipeline emit commit).

### Out-of-Scope Items Logged (NOT auto-fixed)

**1. productImageUrl / modelImageUrl gap in pipeline.ts emit**
- Documented in `deferred-items.md` as candidate for Phase 03.
- Default decision per Task 4 checkpoint = (a) Accept, judge prompt is robust to missing URLs.

**2. sonnet-copywriter.ts:289 "afina a cintura na hora" example (D-23)**
- Pre-existing — Phase 01 deferred-items.md already tracks it.
- Documented again in this phase's deferred-items.md so it's findable from Phase 02 context too.
- Per D-23: NOT fixed. The judge correctly flagging this phrase is the SIGNAL WORKING AS INTENDED.

---

**Total deviations:** 2 auto-fixed (1 blocking type error + 1 missing critical fixture field). No scope creep — both fixes were directly caused by Task work and necessary for tests/types to function.

## Auth Gates / Blockers Encountered

None during execution. The judge code paths exercise mocks; live Anthropic auth (`ANTHROPIC_API_KEY`) is required at runtime, captured in the canary plan above as a pre-deploy check.

## Verification

### Final tsc + vitest

- **`npx tsc --noEmit`:** 0 errors (clean)
- **`npx vitest run`:** 15 test files, 133 tests pass (95 baseline + 38 new)
  - `src/lib/ai/judge.test.ts`: 16 ✓
  - `src/lib/inngest/judge.test.ts`: 9 ✓
  - `src/lib/db/set-campaign-scores.test.ts`: 9 ✓
  - `src/lib/ai/pipeline.test.ts`: 10 ✓ (was 6, +4 new emit cases)
  - All Phase 01 + 02-02 tests: unchanged, all green

### Acceptance criteria greps

- `grep -c "score_campaign_quality" src/lib/ai/judge.ts` → **5** (≥2 required)
- `grep -c "JudgeInvalidOutputError" src/lib/ai/judge.ts` → **4** (≥2 required)
- `grep -c "captureError" src/lib/ai/judge.ts` → **3** (≥1 required)
- `grep -c "setCampaignScores" src/lib/db/index.ts` → **2** (≥1 required, includes JSDoc + body — exports list is via `export async function`)
- `grep -c "judgeCampaignJob" src/lib/inngest/functions.ts` → **2** (≥2 required: definition + array entry)
- `grep -c "campaign/judge.requested" src/lib/ai/pipeline.ts` → **1** (=1 required)
- `grep -c "judge_quality" src/lib/pricing/fallbacks.ts` → 1 (=1 required)
- Forbidden List citations in judge.ts: **7** matches (afina a cintura, tira celulite, modela o corpo, do P ao GG, todos os tamanhos, clientes adoraram, melhor blusa do Brasil — ≥6 required)
- 5-trigger taxonomy citations: **5** matches (Escassez, Prova social, Curiosidade, Transformação, Preço — ≥5 required)

### Pre-existing prompt SHAs preserved

Confirmed by `git diff` — `sonnet-copywriter.ts`, `gemini-analyzer.ts` byte-identical against Phase 01 final commit. `gemini-vto-generator.ts` only added `dryRun?` field on `GeminiVTOInput` interface; `VTO_TEMPLATE_PROMPT` unchanged → VTO_PROMPT_VERSION (`9d5c754caf28`) preserved.

### Push status

**NOT PUSHED.** Per the canary review protocol in execution_directives Step 10, all 6 commits stay on the local `main` branch. Orchestrator handles push after the user approves at the Task 4 canary checkpoint.

## Self-Check: PASSED

Files verified:
- `campanha-ia/src/lib/ai/judge.ts` FOUND
- `campanha-ia/src/lib/ai/judge.test.ts` FOUND
- `campanha-ia/src/lib/inngest/judge.test.ts` FOUND
- `campanha-ia/src/lib/db/set-campaign-scores.test.ts` FOUND
- `.planning/phases/02-quality-loop/deferred-items.md` FOUND

Commits verified:
- `0c76837` FOUND (feat(pricing): judge_quality fallback)
- `4af1a78` FOUND (feat(db): setCampaignScores)
- `a35509d` FOUND (feat(ai): judge.ts)
- `1099e46` FOUND (feat(inngest): judgeCampaignJob)
- `222b569` FOUND (feat(ai): pipeline emit)
- `172178f` FOUND (feat(ai): VTO dryRun follow-up)

---
*Phase: 02-quality-loop*
*Completed: 2026-05-03*
*Awaiting canary review before push.*
