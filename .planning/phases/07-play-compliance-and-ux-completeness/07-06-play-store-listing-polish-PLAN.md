---
plan_id: 07-06
phase: 7
title: Polish crialook-app/store-assets/PLAY_STORE_LISTING.md — enforce title ≤30, short desc ≤80, full desc ≤4000, no emoji in title, no superlatives, sync rating to Classificação 12 (D-17, D-18)
wave: 1
depends_on: []
owner_action: false
files_modified:
  - crialook-app/store-assets/PLAY_STORE_LISTING.md
autonomous: true
requirements: ["D-17", "D-18", "F-PLAY-§1-listing"]
must_haves:
  truths:
    - "title (the line under '## Nome do app') is ≤30 chars including spaces (Play Console hard limit) and contains NO emoji"
    - "short description (the line under '## Descrição curta (máx 80 caracteres)') is ≤80 chars including spaces (Play Console hard limit)"
    - "full description (the block under '## Descrição longa (máx 4000 caracteres)') is ≤4000 chars including spaces"
    - "title + short desc + full desc contain NO unsubstantiated superlative claims like 'best', 'melhor', '#1', 'most popular' (Play policy 8.6 — no misleading claims). Existing 'mais popular' on line 43 is acceptable IF it remains scoped to a specific plan tier description (it's a comparative within the pricing list, not a superlative about the app); doc reviewer confirms the wording stays scoped"
    - "the rating line under '## Classificação etária' is updated from 'Todos (sem conteúdo restrito)' to 'Classificação 12 — AI-generated apparel imagery, may include swimwear/lingerie/sleepwear' to match plan 07-05's locked decision (D-13)"
    - "no other section is restructured: '## Nome do app', '## Descrição curta', '## Descrição longa', '## Categoria', '## Tags', '## Política de privacidade', '## Classificação etária' headers stay in the same order"
    - "tags (line under '## Tags') stay within Play Console's 5-tag soft limit OR the doc records 'Tags listed are candidates; Play Console allows 5 selections'; current line lists ~10 — owner picks the top 5 at submission time"
    - "Política de privacidade URL stays as 'https://crialook.com.br/privacidade' (verified by app.config.ts:255 and content.ts post-07-03)"
    - "the doc adds a new section '## Screenshot inventory' enumerating the 5 PNGs in store-assets/ (screenshot-1-geracao.png through screenshot-5-config.png) with one-line caption suggestions per Play Console requirement (Play allows screenshots labeled in PT-BR; suggestions are starting points)"
    - "the doc adds a new section '## Submission checklist' that lists owner-action items: title char count verified, short desc char count verified, full desc char count verified, rating updated to Classificação 12, advisory text matches PLAY_IARC.md, screenshots uploaded, privacy URL live, Data Safety form completed per PLAY_DATA_SAFETY.md"
    - "the doc adds a comment block at the top noting 'This doc is the SOURCE OF TRUTH for the Play Console listing fields. Drift from Play Console = the doc is authoritative; update Play Console to match. Plan 07-06 (Phase 7) is the canonical update point.'"
    - "no code is modified — pure documentation polish"
  acceptance:
    - "node -e \"const f=require('fs').readFileSync('crialook-app/store-assets/PLAY_STORE_LISTING.md','utf8'); const m=f.match(/## Nome do app\\s*\\n([^\\n]+)/); const t=m?m[1].trim():''; process.exit(t.length>0 && t.length<=30 && !/[\\u{1F300}-\\u{1FAFF}\\u2600-\\u27BF\\u2700-\\u27BF\\u{2300}-\\u{23FF}]/u.test(t) ? 0 : 1)\" exits 0"
    - "node -e \"const f=require('fs').readFileSync('crialook-app/store-assets/PLAY_STORE_LISTING.md','utf8'); const m=f.match(/## Descrição curta[^\\n]*\\n([^\\n]+)/); const s=m?m[1].trim():''; process.exit(s.length>0 && s.length<=80 ? 0 : 1)\" exits 0"
    - "node -e \"const f=require('fs').readFileSync('crialook-app/store-assets/PLAY_STORE_LISTING.md','utf8'); const m=f.match(/## Descrição longa[^\\n]*\\n([\\s\\S]*?)\\n## /); const d=m?m[1].trim():''; process.exit(d.length>0 && d.length<=4000 ? 0 : 1)\" exits 0"
    - "grep -c 'Classificação 12' crialook-app/store-assets/PLAY_STORE_LISTING.md returns at least 1"
    - "grep -c 'Todos (sem conteúdo restrito)' crialook-app/store-assets/PLAY_STORE_LISTING.md returns 0 (old rating fully replaced)"
    - "grep -ic '^## Screenshot inventory\\|^## Submission checklist' crialook-app/store-assets/PLAY_STORE_LISTING.md returns at least 2 (new sections present)"
    - "grep -c 'screenshot-[1-5]' crialook-app/store-assets/PLAY_STORE_LISTING.md returns at least 5 (one ref per PNG)"
    - "grep -c 'AI-generated apparel imagery' crialook-app/store-assets/PLAY_STORE_LISTING.md returns at least 1 (advisory text present, sync with PLAY_IARC.md)"
    - "grep -ic 'best\\|#1\\|melhor (app|escolha|opção|sistema)' crialook-app/store-assets/PLAY_STORE_LISTING.md returns 0 (no naked superlatives — 'mais popular' scoped to plan tier description is acceptable per truth above)"
    - "grep -c '- \\[ \\]' crialook-app/store-assets/PLAY_STORE_LISTING.md returns at least 6 (submission checklist rows)"
---

# Plan 07-06: Final pass on PLAY_STORE_LISTING.md

## Objective

Per D-17 and D-18: take the existing `crialook-app/store-assets/PLAY_STORE_LISTING.md` (drafted earlier per TASKS.md notes) and bring it to submission-ready quality. This is a polish pass with three targeted goals:

1. **Enforce Play Console character/format limits** on title (≤30), short desc (≤80), full desc (≤4000).
2. **Sync rating to Classificação 12** (D-13 from plan 07-05).
3. **Add screenshot inventory + owner submission checklist** so the doc is fully self-contained for owner submission.

The current doc is already close — title is 30 chars, short desc is 78 chars, full desc is well under 4000. The rating line (60) is the main change, plus structural additions. No emoji is present in the title (✓ already). No naked superlatives (✓ already; "mais popular" is scoped to a plan tier comparison and stays).

## Truths the executor must respect

- Play Console hard limits (verified against current Play Developer Help, 2025):
  - **Title:** 30 chars max, no emoji, no leading/trailing whitespace
  - **Short description:** 80 chars max
  - **Full description:** 4000 chars max
  - **Tags:** 5 max
- Current state (as-of read of the file):
  - Title: "CriaLook - Marketing de Moda com IA" → counts: 36 chars. **OVER LIMIT.** Must shorten.
    - Options: "CriaLook: Moda com IA" (22 chars), "CriaLook - Moda com IA" (22 chars), "CriaLook IA - Moda Pro" (23 chars). Pick one that preserves brand recognition.
    - Owner-tunable; executor picks "CriaLook - Moda com IA" (22 chars) as the safe default; owner can override.
  - Short desc: 78 chars (under 80; ✓)
  - Full desc: ~1300 chars (under 4000; ✓)
  - Rating: "Todos (sem conteúdo restrito)" → must change per D-13
  - Tags: 10 listed, doc must note Play Console picks 5
- The "mais popular" wording on line 43 ("Pro: 40 campanhas/mês (R$ 179) — mais popular") is a SCOPED comparative within the pricing block (which plan tier is most popular among the 4 tiers we offer), NOT an unsubstantiated superlative claim about the app itself. Play policy 8.6 prohibits "best", "#1", "top-rated" claims about the app's market position. Comparative within the in-app pricing structure is fine.
- The "✅" emoji in lines 25-30 (the "O QUE VOCÊ RECEBE" bullets) and the "•" bullet in lines 19-22 are in the FULL DESCRIPTION, not the title. Play allows emoji in descriptions. Keep.
- Screenshots are inventoried by file name (not content described) — the captions in the new section are SUGGESTIONS the owner can edit at submission time. Play Console allows up to 8 screenshots per device type.
- Cross-reference plan 07-05 (PLAY_IARC.md) for the exact advisory text — it MUST match byte-for-byte. If 07-05 lands first, copy from there; if 07-06 lands first, the executor uses the locked text from CONTEXT.md D-13 ("AI-generated apparel imagery, may include swimwear/lingerie/sleepwear") and 07-05 must match this.

## Tasks

### Task 1: Polish title + sync rating + add inventory + checklist

<read_first>
- crialook-app/store-assets/PLAY_STORE_LISTING.md (FULL FILE — 60 lines)
- crialook-app/store-assets/ directory listing (confirm screenshot file names: screenshot-1-geracao.png through screenshot-5-config.png; feature-graphic.png; play-store-icon-1024.png; play-store-icon-512.png)
- crialook-app/docs/PLAY_IARC.md (the doc from plan 07-05; if it landed first, copy the verbatim advisory text; if it hasn't, use the CONTEXT.md D-13 locked text)
- .planning/phases/07-play-compliance-and-ux-completeness/07-CONTEXT.md (D-17, D-18)
</read_first>

<action>
Edit `crialook-app/store-assets/PLAY_STORE_LISTING.md` end-to-end. Final state:

```markdown
<!--
THIS DOC IS THE SOURCE OF TRUTH for the Play Console listing fields.
Drift between this doc and the Play Console submission = the doc wins;
update Play Console to match. Plan 07-06 (Phase 7) is the canonical update point.

Hard limits enforced:
  - Title: ≤30 chars, no emoji
  - Short description: ≤80 chars
  - Full description: ≤4000 chars
  - Tags: 5 max picked by owner from candidate list
  - Content rating: synced with PLAY_IARC.md (Classificação 12 + advisory)
-->

# Google Play Store Listing — CriaLook

## Nome do app
CriaLook - Moda com IA

## Descrição curta (máx 80 caracteres)
Fotos profissionais de moda com IA. Envie a peça, receba a campanha pronta.

## Descrição longa (máx 4000 caracteres)
O CriaLook transforma fotos simples do seu produto em campanhas profissionais de moda usando inteligência artificial.

COMO FUNCIONA:
1. Fotografe sua peça de roupa (foto simples, sem produção)
2. Escolha a modelo virtual e o cenário
3. Em ~80 segundos, receba 1 foto profissional com modelo vestindo sua peça
4. Copie a legenda, hashtags e dicas de postagem geradas pela IA

PARA QUEM É:
• Donos de lojas de roupas que precisam de fotos para redes sociais
• Vendedores de moda no Instagram, WhatsApp e marketplaces
• Pequenos e-commerces que não têm orçamento para estúdio fotográfico
• Qualquer pessoa que venda roupas online

O QUE VOCÊ RECEBE:
✅ 1 foto profissional com modelo virtual vestindo sua roupa
✅ Legendas prontas para Instagram e WhatsApp
✅ Hashtags relevantes para o seu nicho
✅ Dicas de melhor horário para postar
✅ CTA (chamada para ação) sugerida
✅ Ideia para Stories

MODELOS VIRTUAIS:
• Banco de modelos diversificado (diferentes biotipos, tons de pele, cabelos)
• Crie sua própria modelo personalizada com as características da sua marca
• Modelos femininas e masculinas

CENÁRIOS:
Branco, Estúdio, Lifestyle, Urbano, Natureza, Praia, Boutique, Luxo, Minimalista e mais 5 opções — todos gerados por IA.

PLANOS:
• Avulso: compre créditos individuais
• Essencial: 15 campanhas/mês (R$ 89)
• Pro: 40 campanhas/mês (R$ 179) — mais popular
• Business: 100 campanhas/mês (R$ 379)

Pagamento seguro via Google Play.

Economize tempo e dinheiro em estúdio fotográfico. Crie campanhas profissionais direto do celular em menos de 2 minutos.

## Categoria
Negócios (Business)

## Tags
moda, marketing, inteligência artificial, fotos, campanha, instagram, roupas, loja, e-commerce, modelo virtual

> Owner: Play Console accepts up to 5 tags. Pick the top 5 from the list above at submission time. Suggested top 5: moda, inteligência artificial, fotos, campanha, e-commerce.

## Política de privacidade
https://crialook.com.br/privacidade

## Classificação etária
Classificação 12 — AI-generated apparel imagery, may include swimwear/lingerie/sleepwear

> Source: `crialook-app/docs/PLAY_IARC.md` (Phase 7 plan 07-05, D-13). The IARC questionnaire is owner-action; this line records the resulting rating + advisory.

## Screenshot inventory

Five PNGs in `crialook-app/store-assets/`. Caption suggestions are starting points — owner can edit at upload time.

| File | Caption (PT-BR) — suggestion |
|------|-------------------------------|
| screenshot-1-geracao.png | "Envie a foto da sua peça e escolha modelo + cenário" |
| screenshot-2-resultado.png | "Receba a foto profissional em ~80 segundos" |
| screenshot-3-copy.png | "Legenda, hashtags e CTA prontos pra colar no Instagram" |
| screenshot-4-historico.png | "Reveja e regenere campanhas anteriores" |
| screenshot-5-config.png | "Gerencie modelos personalizados e plano de assinatura" |

Additional graphics in `store-assets/`:
- `feature-graphic.png` — Play Store feature graphic (1024×500)
- `play-store-icon-1024.png` — Play Store icon (1024×1024)
- `play-store-icon-512.png` — Legacy icon

> Owner: optional screenshot compression pass per `TASKS.md` flag — non-blocking, can ship as-is.

## Submission checklist

Before promoting an AAB to Production track, owner ticks each row:

- [ ] Title is ≤30 chars verified (current: "CriaLook - Moda com IA" = 22 chars)
- [ ] Short description is ≤80 chars verified
- [ ] Full description is ≤4000 chars verified
- [ ] Content rating updated to "Classificação 12" via Play Console questionnaire (per `crialook-app/docs/PLAY_IARC.md` plan 07-05)
- [ ] Advisory text in Play Console matches the line under "## Classificação etária" above (byte-for-byte)
- [ ] All 5 screenshots uploaded with captions (8-screenshot limit allows headroom for additions)
- [ ] Privacy policy URL `https://crialook.com.br/privacidade` is live and matches `crialook-app/lib/legal/content.ts` (per `crialook-app/docs/LEGAL_DRIFT_RECONCILIATION.md` plan 07-03 + CI script plan 07-07)
- [ ] Data Safety form completed per `crialook-app/docs/PLAY_DATA_SAFETY.md` (plan 07-04)
- [ ] App-bundle (.aab) signed via EAS managed credentials (per `crialook-app/docs/PLAY_RELEASE_CHECKLIST.md`)
- [ ] Tags reduced to top 5 in Play Console listing form

## Versioning

| Date | Editor | Change |
|------|--------|--------|
| YYYY-MM-DD | Phase 7 plan 07-06 | Title shortened to 22 chars; rating bumped to Classificação 12 + advisory; screenshot inventory + submission checklist sections added |
```

Replace the date placeholder.

**On title shortening:** The previous title "CriaLook - Marketing de Moda com IA" was 36 chars (over the 30 limit). Choosing "CriaLook - Moda com IA" (22 chars) preserves brand + category and leaves headroom. If the owner prefers a different short title, they edit in Play Console at submission time and update this doc accordingly.
</action>

<verify>
```bash
# Title char count
node -e "const f=require('fs').readFileSync('crialook-app/store-assets/PLAY_STORE_LISTING.md','utf8'); const m=f.match(/## Nome do app\s*\n([^\n]+)/); console.log('title:', JSON.stringify(m[1].trim()), 'len:', m[1].trim().length)"
# Expect: len <= 30

# Short desc char count
node -e "const f=require('fs').readFileSync('crialook-app/store-assets/PLAY_STORE_LISTING.md','utf8'); const m=f.match(/## Descrição curta[^\n]*\n([^\n]+)/); console.log('short:', JSON.stringify(m[1].trim()), 'len:', m[1].trim().length)"
# Expect: len <= 80

# Full desc char count
node -e "const f=require('fs').readFileSync('crialook-app/store-assets/PLAY_STORE_LISTING.md','utf8'); const m=f.match(/## Descrição longa[^\n]*\n([\s\S]*?)\n## /); console.log('full len:', m[1].trim().length)"
# Expect: len <= 4000

# Rating sync
grep -c "Classificação 12" crialook-app/store-assets/PLAY_STORE_LISTING.md
# Expect: at least 1
grep -c "Todos (sem conteúdo restrito)" crialook-app/store-assets/PLAY_STORE_LISTING.md
# Expect: 0

# New sections
grep -c "^## Screenshot inventory\|^## Submission checklist" crialook-app/store-assets/PLAY_STORE_LISTING.md
# Expect: 2

# Screenshot refs
grep -c "screenshot-[1-5]" crialook-app/store-assets/PLAY_STORE_LISTING.md
# Expect: at least 5

# Advisory consistency
grep -c "AI-generated apparel imagery" crialook-app/store-assets/PLAY_STORE_LISTING.md
# Expect: at least 1
```
</verify>

## Files modified

- `crialook-app/store-assets/PLAY_STORE_LISTING.md` — title shortened, rating bumped + advisory added, screenshot inventory + submission checklist sections added

## Why this matters (risk if skipped)

Per D-17/D-18: a 36-char title is HARD-rejected at Play Console upload validation (the 30-char limit is enforced server-side). Without this fix, the first AAB upload attempt fails with a confusing "title too long" error and submission is blocked. The rating sync is the second blocker — submitting an AAB labeled "Todos" with content advisories that contradict the questionnaire answer triggers reviewer-flag → policy strike. Both are cheap to fix here, expensive to fix in re-submission cycles.
