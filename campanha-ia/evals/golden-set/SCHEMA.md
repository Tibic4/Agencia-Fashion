# Golden-set entry schema (Phase 02 — D-16, AI-SPEC §5.3)

This document is **schema-by-example**. Every JSON file in `evals/golden-set/`
MUST conform to the shape below. The `evals/run.ts` driver loads every
`*.json` file in this directory, runs `runCampaignPipeline({...form_input,
dryRun: true})` against it (per D-18), and writes the per-entry pipeline
output to `evals/results/last-run.jsonl` for Promptfoo to consume.

> **Phase 02 status:** the golden-set ships **EMPTY** today. Only
> `example.json` exists, and it carries the reserved id-prefix `_` so
> `run.ts` skips it. Phase 2.5 (labeling) populates the first 30-50 real
> entries with human rubric labels. Until then, Promptfoo runs in
> observability-only mode (per D-24).

---

## Required keys

| Key                  | Type            | Description                                                                                                                                                          |
| -------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                 | `string`        | URL-safe slug, e.g. `vestido-floral-acqua-sm`. Entries whose id starts with `_` are skipped by `run.ts` (used for fixtures-without-execution like `example.json`).  |
| `created_at`         | `string` (ISO)  | When the entry was curated. Useful for "evals added since X" queries in Phase 2.5.                                                                                   |
| `form_input`         | `object`        | Anonymized `PipelineInput`. See sub-schema below. Every field must be PII-free (no real `storeName`, no real `storeId`, no real `campaignId`).                      |
| `product_image_hash` | `string` (SHA-256) | Hex-encoded SHA-256 of the fixture file in `evals/fixtures/`. Informational only — `form_input.imageBase64` carries the actual bytes the pipeline consumes.       |
| `analyzer_output`    | `object \| null`| Full `GeminiAnalise` object captured during a previous live run. `null` if not yet captured (Phase 2.5 will fill these as part of label curation).                 |
| `vto_image_hash`     | `string \| null`| SHA-256 of the VTO output we expect (for image-similarity asserts in Phase 2.5). `null` until labeled.                                                              |
| `sonnet_copy`        | `object \| null`| Full `SonnetDicasPostagem` object captured during a previous live run. `null` if not yet captured.                                                                  |
| `prompt_version`     | `string`        | 12-char SHA prefix from `lib/ai/prompt-version.ts` for the prompt that produced `sonnet_copy` + `analyzer_output`. Lets us query "regressions vs version X".        |
| `regenerate_reason`  | `string \| null`| One of `face_wrong / garment_wrong / copy_wrong / pose_wrong / other` (matches `VALID_REGENERATE_REASONS` from Phase 01). `null` for entries that were not regens. |
| `labels`             | `object`        | **Phase 02: MUST be `{}`** (empty object). Phase 2.5 populates per-rubric keys. See "Labels (Phase 2.5)" below.                                                      |

---

## `form_input` sub-schema

A subset of `PipelineInput` (`campanha-ia/src/lib/ai/pipeline.ts`) safe for
golden-set entries. Other PipelineInput fields (`storeId`, `campaignId`,
`signal`) are intentionally NOT carried in golden-set entries — `run.ts`
omits them so `dryRun: true` does the right thing without store-scoped
side effects.

| Field              | Required | Notes                                                                                            |
| ------------------ | -------- | ------------------------------------------------------------------------------------------------ |
| `imageBase64`      | yes      | Base64 of fixture (no `data:` prefix).                                                           |
| `mediaType`        | no       | `image/jpeg \| image/png \| image/webp \| image/gif`. Defaults to `image/jpeg` if omitted.      |
| `modelImageBase64` | yes      | Base64 of model fixture.                                                                          |
| `modelInfo`        | no       | `{ gender?, ageRange?, hairColor?, hairTexture?, ... }` — see `identity-translations.ts`.        |
| `price`            | no       | Free-text PT-BR price string.                                                                     |
| `targetAudience`   | no       | Free-text PT-BR audience descriptor.                                                              |
| `toneOverride`     | no       | Free-text PT-BR tone hint for Sonnet.                                                             |
| `targetLocale`     | no       | `pt-BR \| en`. Defaults to `pt-BR`.                                                              |

**Anonymization rule:** `storeName` may be a placeholder like `"Loja Demo"`
but MUST NOT be a real lojista name. Similarly, fixture images SHOULD be
royalty-free or product owner-cleared.

---

## `labels` (Phase 2.5)

In Phase 02 every entry carries `labels: {}`. Phase 2.5 expands this to
the 5-dimension taxonomy from `.planning/codebase/DOMAIN-RUBRIC.md`:

```json
{
  "labels": {
    "garment_attribute":  { "expected": "...", "human_score": 4 },
    "color_wash":         { "expected": "...", "human_score": 5 },
    "mental_trigger":     { "category": "afina_emagrece", "human_score": 3 },
    "anti_cliche":        { "forbidden_tokens_present": [], "human_score": 5 },
    "compliance_safe":    { "violations": [], "human_score": 5 }
  }
}
```

**Until Phase 2.5 lands, Promptfoo treats empty `labels: {}` as a warning,
not a failure (D-24).** This is intentional: blocking PRs without ground
truth would create false-positive friction for the team.

---

## Validation

`evals/run.ts` performs a minimal shape check (id present, form_input
present, labels object). Heavier schema validation (Zod) is deferred until
Phase 2.5 — by then the labels shape will be locked.

To bootstrap a new entry from a real campaign:

1. Pull a campaign row from `campaigns` (via Supabase admin in a one-off script).
2. Anonymize `storeName`, drop `storeId / campaignId`.
3. Save the product image to `evals/fixtures/<id>.jpg`, compute
   `product_image_hash = sha256sum evals/fixtures/<id>.jpg`.
4. Inline the base64 into `form_input.imageBase64`.
5. Set `labels: {}`.
6. Drop the file in `evals/golden-set/<id>.json`.

See `example.json` for the canonical shape.
