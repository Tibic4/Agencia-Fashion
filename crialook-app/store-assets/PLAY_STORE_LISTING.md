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
| 2026-05-03 | Phase 7 plan 07-06 | Title shortened from 36 → 22 chars; rating bumped to Classificação 12 + advisory; screenshot inventory + submission checklist sections added |
