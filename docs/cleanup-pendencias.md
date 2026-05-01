# Cleanup — pendências entre frentes de trabalho

Toda vez que duas mudanças tocam no mesmo fluxo em janelas próximas, a parte
que sobra (cleanup, dead code, comentário desatualizado) cai aqui pra não
virar dívida silenciosa.

---

## Pipeline AI — `photoCount` deprecated

**Quando:** 2026-04-30

**O que aconteceu:** o pipeline migrou pra **foto única universal** (1
imagem por campanha, pagos e trial). `runCampaignPipeline` ignora qualquer
valor de `input.photoCount` — o param ficou só por compat com chamadas
legadas. Ver doc inline em `campanha-ia/src/lib/ai/pipeline.ts`
(`PipelineInput.photoCount`).

**Onde sobrou ref ao 3:**
- `campanha-ia/src/app/api/campaign/generate/route.ts`:
  - L162-227: detecção `isTrialOnly` + log "Trial-only → 1 foto"
  - L518: `photoCount: isTrialOnly ? 1 : 3`
  - L527: `const photoCount = isTrialOnly ? 1 : 3`
  - L531, 740, 743: logs `successCount/${photoCount}`
- A semântica não quebra: passar `3` é no-op, o pipeline gera 1.

**Plano de cleanup (1 passada):**
1. Remover `isTrialOnly`, `mini_trial_uses`, `credit_purchases` count na route
2. Tirar `photoCount` do `runCampaignPipeline` call
3. Remover o param `photoCount` de `PipelineInput`
4. Trocar logs `${successCount}/${photoCount}` por `${successCount}/1`
5. Decidir o que fazer com `lockedTeaserUrls`: hoje só é gerado quando
   `isTrialOnly`, mas se cair, o trial perde o upsell visual (1 hero + 2
   teasers blur). Manter ou descontinuar é decisão de produto.

**Coluna SQL `stores.recent_pose_indices`** continua com o nome plural,
mas a semântica virou "histórico de últimas N poses pra detectar streak"
(ver `getStreakBlockedPose`). Sem migration de rename — só comentário no
schema se virar incômodo.

---

## Convenções

- Adiciona uma seção nova com data, "o que aconteceu", "onde sobrou ref",
  e "plano de cleanup".
- Quando o cleanup sair, deleta a seção (não risca, deleta — git mantém
  histórico).
