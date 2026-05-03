# DOMAIN-RUBRIC — CriaLook Fashion Copy Quality Standard

- **Status:** Active
- **Owner:** CriaLook product owner (final tie-breaker; AI-SPEC §1b "Domain Expert Roles for Evaluation")
- **Decisions:** D-11 / D-12 / D-13 / D-14 (Phase 01)
- **Last review:** 2026-05-03
- **Audit reference:** `.planning/codebase/AI-PIPELINE-AUDIT.md` Dimension 3

---

## Compliance Posture (D-12) — read this first

**The lojista is the *anunciante* under Brazilian advertising self-regulation (CONAR).** CriaLook ships a **tool**. We carry the obligation to **ship guardrails preventing clearly-noncompliant outputs from being generated in the first place** — not to act as a CONAR pre-clearance review and not to assume the lojista's anunciante responsibility.

Concretely, the tool's compliance contract is:

- **No medical or therapeutic promises** ("rejuvenesce", "alivia dor nas costas", "tira celulite"). These are disease-adjacent or treatment-adjacent claims that exceed both the lojista's authority as a fashion retailer and the truthfulness/substantiation requirements of the CBARP base articles cited below.
- **No body-transformation claims that go beyond the literal effect of the garment.** The garment can change how a silhouette *looks* (e.g., "wide leg cintura alta alonga as pernas" — a visual effect that is verifiable from the photo); the garment cannot change the body itself ("afina a cintura em 2 cm" — a transformative claim about the body, CONAR-risk).
- **No invented sizes.** If the lojista did not supply size availability in the form input, copy cannot name P / M / G / GG, "do P ao GG", "tem do 36 ao 48", or any specific measurement. The CTA fallback is "manda seu tamanho no direct que eu confiro".
- **No claims about identifiable individuals beyond the literal photo of the lojista's chosen virtual model.** No invented testimonials ("clientes adoraram"), no third-party endorsement language that would force a `#publi` disclosure the lojista did not necessarily make.
- **LGPD posture:** the pipeline only operates on the lojista's chosen virtual model image (already enforced upstream of `pipeline.ts`). We do not generate images of the lojista's customers, of identifiable third parties, or of public figures.

> The downstream economic impact of a single bad generation is small (one post deleted, one customer lost) but the cumulative effect across thousands of lojistas is brand-defining for CriaLook. **There is no human review step in the current product flow** — generated caption + image goes from the SSE stream to a one-tap "Copy / Post" action. Any guardrail that fails ships to the public. (AI-SPEC §1b "Output Consequence".)

### Regulatory reference table

Per AI-SPEC §1b "Regulatory / Compliance Context":

| Instrument | Relevance to CriaLook |
|---|---|
| **CBARP — Código Brasileiro de Autorregulamentação Publicitária** (CONAR, 2024) — Arts. 1, 17, 23, 27 | Veracidade, ostensividade, comprovação. Drives the "no invented attributes" + "no transformative body claims" rubric dimensions. <http://www.conar.org.br/pdf/Codigo-CONAR-2024.pdf> |
| **CONAR Guia de Publicidade por Influenciadores Digitais** (2020/2021) | Defines the three cumulative elements of *publicidade* and the disclosure tags (`#publi`, `#publicidade`, `#parceriaPaga`). Disclosure is the lojista's act, not the tool's — but our copy must not embed false testimonial language that would force one. <http://conar.org.br/pdf/CONAR_Guia-de-Publicidade-Influenciadores_2021-03-11.pdf> |
| **CONAR institutional site** | Primary source for self-regulatory complaint/judgment record. <http://www.conar.org.br/> |
| **LGPD** (Lei 13.709/2018) + general personality-rights doctrine | Pipeline only operates on lojista's chosen virtual model image. Risk surface is narrow but real if any user uploads a photo of an identifiable third party as the "model". |
| **Marco Civil da Internet** (Lei 12.965/2014) | General internet-content regime; relevant if a generated post becomes the subject of a takedown request — Instagram is the platform-of-record, not CriaLook. |
| **Instagram × CONAR partnership** (2025) | Reinforces that platform-level enforcement of the influencer guide is now active. <https://www.meioemensagem.com.br/midia/redes-sociais-da-meta-passam-a-integrar-o-conar> |

> **Note on Anexo P:** CONAR's Anexo P regulates *cervejas e vinhos*, not fashion. There is no fashion-specific CONAR annex; fashion-advertising obligations flow from the CBARP base articles cited above and from the influenciadores guide.

---

## Fashion Glossary

> Lifted from `campanha-ia/src/lib/ai/sonnet-copywriter.ts:259-279` (ETAPA 2 — GLOSSÁRIO DE MODA). The prompt strings stay inline in the `.ts` file per D-14; this section is the human-review source-of-truth that prompt-edit PRs are diffed against.

### Conjunto vs Look

- **Conjunto** → only when 2+ pieces share the **SAME tecido, cor ou estampa coordenada**.
  - "Conjunto jeans" → only when 2+ pieces are denim.
  - **Calça jeans + regata branca = NOT a conjunto**, it is a *"look com calça jeans"*.
- **Look** → any combination of different pieces.

**One-line summary:** *"Conjunto" claims fabric/color coordination; "look" claims composition. Mis-using "conjunto" is a garment-attribute faithfulness violation, not a stylistic preference.*

### Color discrimination (PT-BR — these are DISTINCT, not synonyms)

- **Earth tones:** Caramelo ≠ bege ≠ camel ≠ marrom ≠ terracota.
- **Neutrals:** Off-white ≠ branco ≠ cru ≠ marfim.
- **Blues:** Azul-marinho ≠ azul-escuro ≠ petróleo.
- **Denim wash:** claro / médio / escuro / black / delavê / destroyed — name correctly relative to the photo. Do **not** call a medium wash "jeans escuro".

> **Why this matters:** affordable jeans is the **#1 SKU category** for Brazilian lojistas (AI-SPEC §1b "Known Failure Modes"). A wash error on jeans hits more campaigns than any other garment type and erodes trust on the SKU customers are most likely to compare against competitors' photos.

### Fabric / weight terms (NEVER invent unless lojista provided in form input)

- **Fabrics that are commonly confused (do not interchange):**
  - Tricô ≠ moletom ≠ malha ≠ lã
  - Linho ≠ viscose ≠ algodão ≠ seda
  - Jeans/denim ≠ sarja ≠ brim
- **Forbidden when `tecido` is not provided:** "tecido seda gelada", "seda pura", "cetim puro", "tem forro", "não amassa", "lava na máquina".
- **Generic fallback:** if uncertain, describe generically ("blusa clara") instead of guessing ("blusa branca de seda").

### Garment terms (these CAN be cited because they are visually verifiable)

- **Silhueta** (wide leg ≠ pantalona ≠ reta ≠ flare ≠ skinny).
- **Comprimento** (cropped, na cintura, midi, longo).
- **Manga** (regata, manga curta, manga longa, manga 3/4).
- **Fechamento** (botões, zíper, amarração, aberto na frente).
- **Cardigan** = malha aberta (com botões ou aberta na frente).
- **Blusa ≠ camisa ≠ camiseta ≠ regata ≠ cropped** — these are distinct garment categories, not synonyms.

> Visually-verifiable attributes are safe to cite from the analyzer's structured output. Non-visual attributes (fabric weight, lining, stretch, washability, sizes) are **never** safe to infer.

---

## 5 Mental-Trigger Taxonomy

> Lifted from `campanha-ia/src/lib/ai/sonnet-copywriter.ts:283-296` (ETAPA 3 — ESCOLHA ESTRATÉGICA). Each generated caption must use **exactly one** of the 5 triggers; the trigger must be identifiable to a reviewer in <5s. Trigger choice fits the product and the lojista's `tom_legenda`.

### 1. Escassez

- **Definition:** Limited availability of a desirable item; the audience risks missing the piece if they hesitate.
- **PASS criteria:** Names a concrete scarcity signal ("últimas peças", "repôs e já tá saindo", "só restam 3 do tamanho M") that the lojista actually communicated, with a CTA that closes the loop ("manda BLUSA no direct que confiro").
- **FAIL example:** "Não perca!" / "Corre pra garantir" / "Peça única" — generic urgency with no concrete signal, blacklisted as cliché in `sonnet-copywriter.ts:329`. Equally FAIL: invented scarcity ("últimas 5 peças") when stock data was not provided.
- **Source line:** `sonnet-copywriter.ts:286` ("Escassez → \"últimas peças\", \"repôs e já tá saindo\"").

### 2. Prova social

- **Definition:** Real, plural validation from other customers — a piece that "everyone is asking about".
- **PASS criteria:** "A queridinha voltou", "todo mundo tá pedindo", "esgotou semana passada e voltou". Anchored in observable lojista demand patterns, not invented testimonials.
- **FAIL example:** "Clientes adoraram" / "todo mundo aprovou" — invented testimonial language that would force a `#publi` disclosure the lojista did not necessarily make (CONAR Guia de Publicidade por Influenciadores). FAIL also: quoting a fictitious customer ("Maria comprou e amou").
- **Source line:** `sonnet-copywriter.ts:287` ("Prova social → \"a queridinha voltou\", \"todo mundo tá pedindo\"").

### 3. Curiosidade

- **Definition:** A hook that promises a specific discovery — the audience reads to find out what.
- **PASS criteria:** First-line hook that opens an information gap and pays it off in line 2-3. "Achei a calça que afina sem apertar 👖" — promises a specific reveal, delivers it, hooks attention before the scroll.
- **FAIL example:** "Confira esta peça incrível!" — the ChatGPT-default opener (AI-SPEC §1b "Anti-cliché violations at scale"). It is curious-shaped but reveals nothing and reads as obviously AI-generated.
- **Source line:** `sonnet-copywriter.ts:288` ("Curiosidade → \"achei a calça que…\", \"descobri o truque…\"").

### 4. Transformação — **do LOOK, NÃO do CORPO**

> **This trigger has a critical sub-rule that intersects with D-12 compliance.** Transformation is about how the garment changes the **outfit / context / occasion** — not about how the garment changes the body.

- **Definition:** The piece transforms the look (versatile styling, day-to-night, work-to-going-out) — never the body.
- **PASS criteria:** "De casa pro trabalho sem trocar", "transforma o jeans em produção de festa", "uma peça que cabe em três contextos". Visual / stylistic transformation only.
- **FAIL example (CONAR-risk — D-12):** "Afina a cintura em 2 cm", "modela o corpo", "tira a barriga". Transformative body claims; CBARP Arts. 17 and 27 substantiation problem; lojista as anunciante absorbs the legal exposure but our guardrail must catch this before it ships.
- **Source line:** `sonnet-copywriter.ts:289` ("Transformação → \"afina a cintura na hora\", \"de casa pro trabalho sem trocar\"").
  - **Caveat on the source line:** the source prompt cites "afina a cintura na hora" as an example. **That phrasing is a body-transformation claim and is itself blacklisted by the Forbidden List below.** This is a known gap in the inline prompt that DOMAIN-RUBRIC.md surfaces for the next prompt-edit PR — the Transformação examples in the source prompt should be edited to remove body-transformation phrasing in line with D-12. (Per phase scope: this rubric documents *what is*; prompt content edits land in the next prompt-content phase. Filed for product-owner review — see "Document Maintenance" below.)

### 5. Preço

- **Definition:** Price as the lead persuasion lever — only valid when the lojista actually provided the price in the form input.
- **PASS criteria:** "Por menos de R$ 100", "Investimento: R$ 79,90", "Achei essa por R$ 89". Specific value, lifted from `productPrice` field on the campaign input.
- **FAIL example:** Inventing a price when none was provided ("Por R$ 99,90" with no source). FAIL also: vague "preço imperdível" with no number — that's effectively Escassez phrased as Preço.
- **Source line:** `sonnet-copywriter.ts:290-292` ("Preço (APENAS se informado) → \"Por menos de R$ 100\", \"Investimento: R$ 79,90\"" + "Se NÃO foi informado, NUNCA invente preço").

> **Mixing rule:** the prompt is explicit — "só 1, nunca misture". One trigger per caption. A caption that hedges across two triggers (Escassez + Preço, Curiosidade + Prova social) reads as un-anchored and underperforms.

---

## Forbidden List (with rationale + regex hints)

Each forbidden category is paired with a rationale (why it is forbidden) and a regex hint that downstream guardrail work — **Phase 1 forbidden-token regex per AI-SPEC §6.1** or **Phase 2 LLM-as-judge** — can target. The regex hints are conservative starting points, not final patterns; full regex hardening is a Phase 2 task.

### Sizes

- **What:** Naming "P / M / G / GG", "PP", "XG", "plus size", "do P ao GG", "tem do 36 ao 48", "todos os tamanhos", or specific measurements (busto, cintura, comprimento em cm) — unless the lojista provided them.
- **Rationale:** Garment-attribute faithfulness (AI-SPEC §1b Dimension 1); CBARP Art. 27 §1 (truthfulness of product descriptions); the lojista cannot ship what isn't in stock and the brand pays the return cost. Source: `sonnet-copywriter.ts:332-336` ("⚠️ PROIBIDO MENCIONAR TAMANHOS").
- **Regex hint:** `/\b(do\s+[Pp]{1,2}\s+ao\s+G{1,2}|do\s+3[68]\s+ao\s+4[2-8]|tamanhos?\s+(P{1,2}|M|G{1,2}|XG|36|38|40|42|44|46|48)\b|todos\s+os\s+tamanhos|plus\s*size|disponível\s+do\s+[Pp])/i`

### Body-transformation claims

- **What:** "Afina a cintura", "modela o corpo", "tira celulite", "rejuvenesce", "tira a barriga", "deixa mais magra", "esconde gordurinhas".
- **Rationale:** D-12 lojista-as-anunciante; medical-adjacent claim risk; CBARP Arts. 17 + 27 (no transformative body claims without substantiation, which a fashion garment cannot provide). The garment can change how a silhouette *looks* in the photo (visual-effect language); it cannot change the body.
- **Regex hint:** `/\b(afina\s+a?\s*cintura|tira\s+celulite|modela\s+o\s+corpo|rejuvenesce|tira\s+a?\s*barriga|deixa\s+mais\s+magra|esconde\s+gordurinhas)\b/i`

### Invented testimonials

- **What:** "Clientes adoraram", "todo mundo aprovou", "as meninas amaram", "@usuario disse…", or any quoted/named third-party endorsement that the lojista did not literally provide.
- **Rationale:** CONAR Guia de Publicidade por Influenciadores Digitais — a false or unverified testimonial is *publicidade* requiring `#publi` disclosure that the lojista did not necessarily make. Embedding the testimonial language in the copy implicitly forces the lojista into a disclosure obligation she may not be able to meet.
- **Regex hint:** `/\b(clientes?\s+(adoraram|amaram|aprovaram)|todo\s+mundo\s+(aprovou|amou)|as\s+meninas\s+amaram)\b/i`

### Unproven superlatives

- **What:** "A melhor blusa do Brasil", "a peça mais elegante", "a calça #1 do Instagram", "número um em conforto".
- **Rationale:** CBARP Art. 27 (comprovação requirement) — superlative claims require substantiation that a fashion lojista is unlikely to be able to produce on demand. Even if true, the burden of proof is on the anunciante.
- **Regex hint:** `/\b(a\s+(melhor|pior|mais\s+(elegante|linda|confortável|chique))\s+\w+\s+do\s+\w+|n[uú]mero\s+(1|um)\s+em\b|#\s*1\s+(do|em))/i`

### Identity drift

- **What:** Describing the model's face, body, age, ethnicity beyond what the lojista's chosen model image literally shows. Adding adjectives like "morena linda", "loira atlética", "jovem de 20 anos" when the model card does not specify those traits.
- **Rationale:** D-12 LGPD posture (we do not generate identity claims about real or implied individuals beyond the lojista's chosen model card); brand-persona contract (the lojista picked a model image she identifies with her brand persona; copy that drifts breaks that contract specifically). The structured `ModelInfo` map in `identity-translations.ts` is the source-of-truth for what is sayable about the model.
- **Regex hint:** harder to regex (semantic, not lexical). Phase 1 regex can catch the worst lexical drift: `/\b(morena|loira|negra|branca)\s+(linda|gostosa|sexy|magra|atl[eé]tica)/i`. Phase 2 LLM-as-judge handles the rest by diffing the caption's identity claims against the `ModelInfo` map.

### Denim wash drift

- **What:** Describing a wash that doesn't match the photo (e.g., "jeans escuro" on a medium wash; "delavê" on a black wash).
- **Rationale:** AI-SPEC §1b Dimension 2 (color and wash discrimination); affordable jeans is the #1 SKU category for Brazilian lojistas, so wash-naming errors hit the highest-volume segment. The Gemini analyzer's structured output already produces a wash classification (`denim_wash` field); the rubric is that the copywriter's wash language must match what the analyzer reported.
- **Regex hint:** cross-field comparison, not pure regex. Phase 1 token regex flags the wash terms; the actual drift check needs the analyzer output: `/\b(jeans|denim)\s+(claro|m[eé]dio|escuro|black|delav[eê]|destroyed)\b/i` (extract the term, then compare against `analyzerOutput.denim_wash` in the validator).

### Generic anti-cliché filler (cross-listed with Anti-Cliché List below)

- **What:** "Disponível agora", "não perca", "corre pra garantir", "peça única" — phrases blacklisted in `sonnet-copywriter.ts:328-330`.
- **Rationale:** AI-SPEC §1b Dimension 4 (anti-cliché PT-BR copy quality). These are not compliance failures, they are quality failures — but they degrade engagement enough to warrant the same guardrail treatment as compliance items.
- **Regex hint:** `/\b(disponível\s+agora|não\s+perca|corre\s+pra\s+garantir|peça\s+única|simplesmente\s+apaixonada|arrasadora|sem\s+palavras)\b/i`

---

## Anti-Cliché List

> Lifted from `campanha-ia/src/lib/ai/sonnet-copywriter.ts:303-330` and CONTEXT.md D-11.

### Phrases to avoid (do not use any of these in generated copy)

- "Tá perfeito 🔥"
- "Look pronto"
- "Arrasou" / "Para arrasar" / "Arrasadora"
- "Diva" / "Maravilhoso(a)"
- "Apaixonada(o)" / "Simplesmente apaixonada"
- "Sem palavras"
- "Disponível agora"
- "Não perca" / "Corre pra garantir" / "Peça única"
- "Confira esta peça incrível!" — the ChatGPT-default opener; immediately reads as AI-generated.
- Isolated unanchored emojis ("🔥🔥🔥", "✨✨✨" with no surrounding text).

### Structural rules

- **Hook in the first 12 words.** Line 1 must stop the scroll — "não descreva, provoque" (`sonnet-copywriter.ts:303`).
- **3 to 5 lines total** (`sonnet-copywriter.ts:304`). Each sentence on its own line — legibility is king on Instagram.
- **Sentences ≤ 12 words each** (`sonnet-copywriter.ts:306`).
- **Trade attribute language for benefit language** ("calça wide leg cintura alta" → "afina a cintura e alonga as pernas" — visual effect, not body transformation; see Transformação trigger sub-rule for the LOOK/CORPO line).
- **CTA must be specific.** "Manda JEANS no direct que te passo os tamanhos" ✅ vs "Comenta EU QUERO" ❌ (`sonnet-copywriter.ts:311-313`).
- **Maximum 2 emojis** per copy, well placed; emojis complement, do not decorate (`sonnet-copywriter.ts:317-318`).
- **PT-BR contractions natural** ("pra", "tá", "cê") **when the lojista's `tom_legenda` is informal**. When `tom_legenda` is formal/sophisticated, drop the contractions.

### Opção B = opposite tone

- The Sonnet copywriter generates two options. **Option B must be the opposite tone of Option A** (`sonnet-copywriter.ts:320-322`):
  - If A is urgent → B is aspirational.
  - If A is fun/playful → B is sophisticated.
- This keeps the lojista's two choices genuinely distinct, not minor rewordings of each other.

---

## Pose-Bank (visual problem each pose solves)

> Lifted from `campanha-ia/src/lib/ai/identity-translations.ts` `POSE_BANK` constant. The pose-bank rationale is the answer to *"why does the model output use this pose?"* for downstream prompt-quality reviewers.

The bank contains **8 poses** (`POSE_BANK_TOTAL = 8`), all curated for **minimum hallucination**: hands are either visibly anchored (on hip, in pocket) or clearly hidden (behind back), which directly addresses the HANDS & FINGERS / IDENTITY DRIFT / full-body framing failure modes documented in `gemini-vto-generator.ts`. A previous "tier médio" (perfil lateral, encostada na parede, back-view, mão na lapela) was **removed** because each pose hit a specific VTO warning (face em perfil → identity drift, prop não-controlado, dedos no tecido).

### Pose history rule

- **`POSE_HISTORY_CAP = 3`.** A pose is blocked after **3 consecutive uses** for the same store (`getStreakBlockedPose` in `identity-translations.ts:220`). The Analyzer receives the blocked-pose index and cannot pick it for the next campaign. This is a **streak rule**, not a rolling-window blacklist — alternation is allowed, only consecutive-3 streaks are forced to break.

### Pose 0 — Three-quarter turn right + hand on hip

- **Pose:** *"standing with a relaxed three-quarter turn (facing right), one hand resting on her hip, chin slightly tilted up"*.
- **Visual problem solved:** Three-quarter turn shows garment silhouette from the most flattering angle (vs flat front-on or pure profile). Hand on hip anchors one of the model's hands visibly, eliminating "where is her left hand?" ambiguity that triggers the HANDS & FINGERS failure mode.
- **When NOT to use:** when the garment's hero detail is on the side that gets turned away (e.g., a statement sleeve on the left arm becomes hidden by the right-facing turn).

### Pose 1 — Hands in pockets, weight shifted, front-facing

- **Pose:** *"hands in pockets, weight shifted to one leg, relaxed street-style stance, front-facing"*.
- **Visual problem solved:** Hides hands cleanly inside pockets (zero finger-rendering risk), reads as casual streetwear, weight-shift adds natural posture without breaking the front-facing silhouette.
- **When NOT to use:** garments without pockets (the AI may invent pockets to satisfy the prompt — VTO warning); skirts and dresses without side pockets; cropped tops where the hand-in-pocket position breaks the cropped hem line.

### Pose 2 — Arms behind back, chest open

- **Pose:** *"arms behind back with clasped hands, chest open, elegant confident posture, front-facing"*.
- **Visual problem solved:** Eliminates hand rendering entirely (clasped behind back, out of frame from front view). Open-chest posture flatters tops, blouses, and bodysuits where the chest panel is the hero.
- **When NOT to use:** when the garment's back detail (open back, statement bow, lace-up) is the hero — clasped hands behind the back will obscure it.

### Pose 3 — Standing straight, arms at sides, neutral expression

- **Pose:** *"standing straight front-facing, arms relaxed at sides, calm neutral editorial expression"*.
- **Visual problem solved:** The neutral baseline. Maximum garment visibility (no body parts crossing the silhouette), clean for e-commerce-style product focus, gives the viewer the most "plain reading" of the piece.
- **When NOT to use:** when the brief calls for a lifestyle/dynamic mood — this pose reads as static and can feel un-editorial against `lifestyle` or `urbano` backdrops.

### Pose 4 — Both hands at hips (akimbo)

- **Pose:** *"both hands resting at hips (akimbo), weight on one leg, classic fashion 'attitude' stance, front-facing"*.
- **Visual problem solved:** Anchors **both** hands visibly (hips), zero finger ambiguity, reads as confident "fashion attitude". Weight on one leg breaks the rigidity of pure front-facing.
- **When NOT to use:** when the garment's hero is at the waist/hip line (a statement belt, an interesting waist seam, a peplum) — both hands at the hip will obscure it.

### Pose 5 — Three-quarter turn left, arms at sides

- **Pose:** *"three-quarter turn facing left, both arms relaxed at sides, looking forward"*.
- **Visual problem solved:** Mirror of Pose 0 minus the hand-on-hip — useful for garments whose hero detail is on the right side (statement sleeve, side slit, pocket detail) since the left-facing turn keeps that detail in frame.
- **When NOT to use:** when both Pose 0 and Pose 5 have been used recently (the streak rule will eventually force variety; the Analyzer should diversify pose families, not just within-family).

### Pose 6 — Three-quarter turn right, arms at sides

- **Pose:** *"three-quarter turn facing right, both arms relaxed at sides, looking forward"*.
- **Visual problem solved:** Same family as Pose 0 but without the hand-on-hip. Cleaner for garments whose hip line is the hero (waistlines, peplums, pencil skirts).
- **When NOT to use:** when the previous campaign used Pose 0 — visually too similar; pick from a different pose family for contrast.

### Pose 7 — Front-facing S-curve

- **Pose:** *"front-facing with subtle S-curve (one hip slightly out), hands relaxed at sides, magazine cover stance"*.
- **Visual problem solved:** Magazine-editorial baseline. Subtle S-curve adds movement to a front-facing pose without breaking the full-frontal garment view. Hands at sides keep both hands visible (HANDS & FINGERS guardrail).
- **When NOT to use:** for very structured garments (blazers, tailored coats) where the S-curve disrupts the garment's intended geometry.

### Per-scene styling moods (background + lighting context)

The pose-bank composes with a separate **scene mood map** in `gemini-analyzer.ts:505-581` (`SCENE_MOODS`). The 16 scene moods (`branco`, `estudio`, `lifestyle`, `urbano`, `natureza`, `interior`, `boutique`, `praia`, `noturno`, `tropical`, `minimalista`, `luxo`, `rural`, `neon`, `arte`) define background, lighting, and atmosphere. Pose choice is independent of scene choice but **some pairings are stronger than others** — e.g., Pose 1 (hands in pockets, street-style) pairs naturally with `urbano`; Pose 3 (neutral baseline) pairs naturally with `branco` / `estudio` / `minimalista`; Pose 7 (S-curve magazine-cover) pairs naturally with `luxo` / `noturno` / `arte`. Pose-scene pairing heuristics are not enforced today and are a candidate Phase 2 improvement.

---

## Captioned Examples — 2-3 Great Outputs

> **TODO (D-11 outstanding):** product owner to nominate 2-3 anonymized "great output" campaigns from production. For each, capture:
>
> - Anonymized lojista form input (price, audience, tom)
> - Generated caption + legendas (Feed, WhatsApp, Stories)
> - Why it's great (which rubric dimensions it nails: trigger choice, garment-attribute fidelity, anti-cliché PT-BR voice, etc.)
>
> Until populated, this section is empty by design — fake examples would erode the rubric's credibility as a calibration anchor. (See CONTEXT.md `<specifics>`: *"researcher lifts directly. Include 2-3 actual generated outputs the team flags as great (planner asks user via clarifying note in PLAN.md)."*)

---

## PT/EN Parity Checklist (D-13)

When editing the Sonnet system prompt or DOMAIN-RUBRIC.md, verify:

- [ ] Glossary term added in PT-BR is also reflected in the EN system prompt
- [ ] Forbidden list addition lands in both PT and EN prompts
- [ ] Mental-trigger criteria match across both locales
- [ ] Anti-cliché list updates apply to both (note: cliches are language-specific; EN cliches differ from PT cliches and need locale-appropriate examples)
- [ ] Pose-bank rationale changes propagate to both
- [ ] Compliance language (no body claims, no invented sizes) is identical in spirit even when wording differs

CI sync mechanism (`evals/parity-check.ts` or similar) is **deferred to Phase 2** per CONTEXT.md `<deferred>` ("Bilingual prompt sync mechanism — D-13 deferred. CI script that diffs PT/EN system prompts on PR."). Until that lands, this checklist is the only defense against silent semantic divergence between the PT and EN prompts.

---

## Document Maintenance (D-14)

DOMAIN-RUBRIC.md is the **human-review document**. Prompt strings stay inline in `*.ts` files (`campanha-ia/src/lib/ai/sonnet-copywriter.ts`, `campanha-ia/src/lib/ai/gemini-analyzer.ts`, `campanha-ia/src/lib/ai/identity-translations.ts`) per **D-14**. The `*.ts` files are **executable**; this document is the **diff target for review**. When the rubric changes, the prompt edit lands in the same PR and reviewers diff against this document — there is no runtime dependency on this file, no codegen step, no parser.

This means:

- **Adding a forbidden phrase** = one edit to DOMAIN-RUBRIC.md (the *what* and *why*) + one edit to the inline prompt string (the *how* the model sees it). Single PR.
- **Adding a new mental trigger** = same: rubric edit + prompt edit. Reviewer checks that the trigger criteria in the rubric match the trigger language in the prompt.
- **Detecting drift** = the PR diff. There is no automated sync today (Phase 2 deferred); the PR review step is the mitigation.

The trade-off accepted by D-14 is that **the rubric can drift from the prompts over time** (T-06-01 in the plan's threat register). The mitigation is the PR review process, which the parity checklist above formalizes.

### Known prompt-content gaps surfaced during this rubric pass (for the next prompt-content phase)

This phase is **infrastructure-only** per CONTEXT.md `<scope>` (*"Prompt content/quality changes — infrastructure only this phase"*) — so the items below are **NOT changed in Plan 01-06**. They are flagged here so the next prompt-content phase has a worklist:

- The Sonnet prompt's Transformação trigger example *"afina a cintura na hora"* (line 289) is a body-transformation phrasing and conflicts with the D-12 compliance posture documented in this rubric. Replace with a LOOK-only example (e.g., *"transforma o jeans em produção de festa"*).
- The "EVITE" anti-cliché block in `sonnet-copywriter.ts:328-330` and the Forbidden List above are mostly redundant; consolidating them into a single source list (the rubric here) referenced by a shorter prompt block would reduce drift surface.

---

## Domain Expert Roles for Evaluation

> Lifted from AI-SPEC §1b "Domain Expert Roles for Evaluation".

| Role | Responsibility in Eval |
|---|---|
| **Lojista (CriaLook user)** | Production sampling: regenerate-reason categorization is *her* signal (D-01). Her "post / not post" decision is the highest-fidelity acceptance vote we have access to. For Phase 1, she labels via the regenerate-reason enum; for Phase 2's golden-set she may be invited to rate 5-10 generations from her own store. |
| **PT-BR fashion copywriter** | Reference dataset labeling + rubric calibration. Owns the glossary (Conjunto vs Look, color discrimination, denim wash names) and the anti-cliché list. Edge-case adjudicator when LLM-judge disagrees with code-based check (Phase 2). |
| **CONAR-savvy reviewer / compliance counsel (consulting)** | Rubric calibration of the "compliance-safe claims" dimension only. Periodic review (quarterly) of a sampled batch of public posts to confirm the guardrail is holding. **Not in the per-generation loop** — too expensive and too slow. |
| **CriaLook product owner** | Final tie-breaker on rubric trade-offs (e.g. "is this caption too informal?"). Owns this DOMAIN-RUBRIC.md document (D-11) and merges PR-level edits to it. |

---

## Sources

### Phase artifacts

- `.planning/phases/01-ai-pipeline-hardening/01-CONTEXT.md` — D-11 (rubric sections), D-12 (compliance posture), D-13 (parity checklist), D-14 (prompts stay inline).
- `.planning/phases/01-ai-pipeline-hardening/01-AI-SPEC.md` §1b — domain context, dimensions, regulatory table, expert roles.
- `.planning/codebase/AI-PIPELINE-AUDIT.md` Dimension 3 — the audit finding ("domain knowledge locked inside system prompts") that motivated this rubric.

### Codebase (source of truth for inline prompts and constants)

- `campanha-ia/src/lib/ai/sonnet-copywriter.ts:259-336` — glossary, 5-trigger taxonomy, anti-cliché block, NEVER-cite-sizes block.
- `campanha-ia/src/lib/ai/identity-translations.ts` — `POSE_BANK` (8 poses), `POSE_HISTORY_CAP`, `getStreakBlockedPose`, `ModelInfo` translation maps.
- `campanha-ia/src/lib/ai/gemini-analyzer.ts:505-581` — `SCENE_MOODS` (16 background/lighting moods).
- `campanha-ia/src/lib/ai/gemini-vto-generator.ts` — HANDS & FINGERS / IDENTITY DRIFT / full-body framing warnings the pose-bank is curated against.

### Regulatory

- **CBARP — Código Brasileiro de Autorregulamentação Publicitária** (CONAR, 2024) — Arts. 1, 17, 23, 27. <http://www.conar.org.br/pdf/Codigo-CONAR-2024.pdf>
- **CONAR Guia de Publicidade por Influenciadores Digitais** (2020/2021). <http://conar.org.br/pdf/CONAR_Guia-de-Publicidade-Influenciadores_2021-03-11.pdf>
- **CONAR institutional site.** <http://www.conar.org.br/>
- **LGPD** — Lei 13.709/2018.
- **Marco Civil da Internet** — Lei 12.965/2014.
- **Instagram × CONAR partnership (2025).** <https://www.meioemensagem.com.br/midia/redes-sociais-da-meta-passam-a-integrar-o-conar>

### Practitioner

- **Sebrae RS — 5 dicas para perfil de moda no Instagram.** <https://digital.sebraers.com.br/blog/estrategia/moda-de-milhoes-5-dicas-para-um-perfil-atraente-mkt/>
- **Tendências do e-commerce no setor da moda em 2025 (E-Commerce Brasil).** <https://www.ecommercebrasil.com.br/noticias/tendencias-do-e-commerce-no-setor-da-moda-em-2025>
- **Indústria da moda no e-commerce (Shopify Brasil, 2025).** <https://www.shopify.com/br/blog/industria-da-moda-no-e-commerce>
