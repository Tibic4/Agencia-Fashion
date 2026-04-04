# ⚡ CAMPANHA IA — Onboarding, Modelo Virtual e Criativos

## Parte 6: Fluxo Detalhado de Cada Tela + Composição Visual

---

## 1. ONBOARDING COMPLETO

### 1.1 Tela de Dados da Loja

```
┌─────────────────────────────────────────────────┐
│              Vamos conhecer sua loja             │
│         Etapa 1 de 3  ●──○──○                   │
│                                                  │
│  Nome da loja *                                  │
│  ┌─────────────────────────────────────┐         │
│  │ Moda da Bia                        │         │
│  └─────────────────────────────────────┘         │
│                                                  │
│  Qual o segmento principal? *                    │
│  ┌────────┐ ┌────────┐ ┌────────┐               │
│  │ 👗     │ │ 👔     │ │ 🧒     │               │
│  │ Moda   │ │ Moda   │ │ Moda   │               │
│  │Feminina│ │Mascul. │ │Infantil│               │
│  └────────┘ └────────┘ └────────┘               │
│  ┌────────┐ ┌────────┐ ┌────────┐               │
│  │ 👟     │ │ 💎     │ │ 🍔     │               │
│  │Calçados│ │Acessór.│ │Aliment.│               │
│  └────────┘ └────────┘ └────────┘               │
│  ┌────────┐ ┌────────┐ ┌────────┐               │
│  │ 💄     │ │ 💊     │ │ 🏠     │               │
│  │Beleza  │ │ Saúde  │ │Casa/Dec│               │
│  └────────┘ └────────┘ └────────┘               │
│  ┌────────┐ ┌────────┐ ┌────────┐               │
│  │ 🐶     │ │ 📱     │ │ 📦     │               │
│  │  Pet   │ │Eletrôn.│ │ Outro  │               │
│  └────────┘ └────────┘ └────────┘               │
│                                                  │
│  ─── Personalize ainda mais (opcional) ───       │
│                                                  │
│  Cidade / Estado                                 │
│  ┌─────────────────────────────────────┐         │
│  │ São Paulo, SP                      │         │
│  └─────────────────────────────────────┘         │
│                                                  │
│  Logo da loja                                    │
│  ┌────────────────────┐                          │
│  │ 📷 Arraste ou      │                          │
│  │    clique para     │                          │
│  │    enviar logo     │                          │
│  └────────────────────┘                          │
│                                                  │
│  @ do Instagram                                  │
│  ┌─────────────────────────────────────┐         │
│  │ @modadabia                         │         │
│  └─────────────────────────────────────┘         │
│                                                  │
│              [Próximo →]                         │
└─────────────────────────────────────────────────┘
```

**Campos obrigatórios:** Nome da loja, Segmento
**Campos opcionais:** Cidade, Logo, Instagram
**Validações:**
- Nome: 2-50 caracteres
- Segmento: exatamente 1 selecionado
- Logo: PNG/JPG/WEBP, máx 5MB
- Instagram: validar formato @handle

**Ao enviar:**
- Salvar em `stores` com `onboarding_completed = false`
- Upload do logo para bucket `store-logos` no Supabase
- Se informou Instagram, agenda job para analisar últimos 9 posts (v2)
- Se segmento é moda → próxima tela = Modelo Virtual
- Se segmento NÃO é moda → pular para tela Concluído

---

### 1.2 Tela de Modelo Virtual (apenas moda)

```
┌─────────────────────────────────────────────────┐
│         Crie a modelo da sua loja               │
│    Ela vai representar suas roupas nos           │
│    criativos — criada uma vez, usada sempre      │
│         Etapa 2 de 3  ○──●──○                   │
│                                                  │
│  ┌─ Veja como fica ──────────────────────┐      │
│  │  [Produto flat lay] → [Produto na     │      │
│  │                         modelo]       │      │
│  └───────────────────────────────────────┘      │
│                                                  │
│  Tom de pele                                     │
│  ⬤ Clara   ⬤ Média   ⬤ Morena   ⬤ Negra       │
│                                                  │
│  Estilo do cabelo                                │
│  ┌────────┐ ┌────────┐ ┌────────┐               │
│  │ Liso   │ │ Liso   │ │ Liso   │               │
│  │ Preto  │ │Castanho│ │ Loiro  │               │
│  └────────┘ └────────┘ └────────┘               │
│  ┌────────┐ ┌────────┐                           │
│  │Ondulado│ │Cacheado│                           │
│  └────────┘ └────────┘                           │
│                                                  │
│  Biotipo                                         │
│  [Magra] [Média] [Plus Size] [Curvilínea]        │
│                                                  │
│  Estilo                                          │
│  [Casual & Natural] [Sofisticado]                │
│  [Jovem & Descolada] [Clássico]                  │
│                                                  │
│  Faixa etária                                    │
│  [Jovem 18-25] [Adulta 26-35] [Madura 36-45]    │
│                                                  │
│  ─── Opcionais ───                               │
│  Cor dos olhos                                   │
│  ⬤ Castanho  ⬤ Verde  ⬤ Azul  ⬤ Mel            │
│                                                  │
│  Dê um nome para ela (opcional)                  │
│  ┌─────────────────────────────────────┐         │
│  │ Ana                                │         │
│  └─────────────────────────────────────┘         │
│                                                  │
│           [✨ Gerar minha modelo]                │
└─────────────────────────────────────────────────┘
```

**Após clicar "Gerar":**

```
┌─────────────────────────────────────────────────┐
│          ✨ Criando sua modelo...                │
│                                                  │
│    [Animação de loading com silhueta]             │
│    "Preparando traços..."                        │
│    "Definindo estilo..."                         │
│    "Gerando variações..."                        │
│                                                  │
│  ──── RESULTADO (4 variações) ────              │
│                                                  │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   │
│  │        │ │        │ │        │ │        │   │
│  │ Var 1  │ │ Var 2  │ │ Var 3  │ │ Var 4  │   │
│  │        │ │        │ │        │ │        │   │
│  │  [ ✓ ] │ │  [   ] │ │  [   ] │ │  [   ] │   │
│  └────────┘ └────────┘ └────────┘ └────────┘   │
│                                                  │
│  "Perfeita! Ela vai representar sua loja         │
│   em todas as campanhas 🎉"                      │
│                                                  │
│        [Escolher esta →]                         │
│        [Gerar outras opções]                     │
└─────────────────────────────────────────────────┘
```

**Tecnicamente:**
1. Chamada API: `POST /api/model/create`
2. Fashn.ai: endpoint `Model Create` com `num_samples: 4`
3. Custo: ~R$ 1,72 (uma única vez por modelo)
4. Tempo: 15-30 segundos
5. As 4 imagens são salvas no bucket `model-previews`
6. Ao escolher: salvar `fashn_model_id` em `store_models`
7. "Gerar outras opções" = nova chamada (cobra novamente)

---

### 1.3 Tela de Conclusão

```
┌─────────────────────────────────────────────────┐
│              Tudo pronto! 🎉                    │
│         Etapa 3 de 3  ○──○──●                   │
│                                                  │
│    Sua loja [Moda da Bia] está configurada       │
│    com a modelo [Ana] pronta para vestir         │
│    suas peças.                                   │
│                                                  │
│         [🚀 Gerar minha primeira campanha]       │
│                                                  │
│    Dica: tire a foto do produto com boa          │
│    iluminação e fundo limpo para melhores        │
│    resultados.                                   │
└─────────────────────────────────────────────────┘
```

**Ao clicar:** `stores.onboarding_completed = true` → redireciona para `/gerar`

---

## 2. TELA DE GERAÇÃO DE CAMPANHA

### 2.1 Input do Produto (`/gerar`)

```
┌─────────────────────────────────────────────────┐
│            Nova Campanha                         │
│                                                  │
│  📸 Foto do produto *                            │
│  ┌────────────────────────────────┐              │
│  │                                │              │
│  │   📷 Tire uma foto ou          │              │
│  │      arraste uma imagem        │              │
│  │                                │              │
│  │   Aceita: JPG, PNG, WEBP       │              │
│  │   Máximo: 10MB                 │              │
│  └────────────────────────────────┘              │
│                                                  │
│  💰 Preço *                                      │
│  R$ ┌──────────────┐                             │
│     │ 89,90        │                             │
│     └──────────────┘                             │
│                                                  │
│  👥 Para quem? (opcional)                        │
│  [Mulheres 25-40] [Jovens 18-25] [Homens 25-45] │
│  [Mães] [Público geral] [Premium]                │
│                                                  │
│  🎯 Objetivo (opcional)                          │
│  ┌────────┐ ┌────────┐                           │
│  │ 🛒     │ │ 🆕     │                           │
│  │ Venda  │ │Lançam. │                           │
│  │Imediata│ │        │                           │
│  └────────┘ └────────┘                           │
│  ┌────────┐ ┌────────┐                           │
│  │ 🏷️     │ │ 💬     │                           │
│  │Promoção│ │Engajam.│                           │
│  └────────┘ └────────┘                           │
│                                                  │
│  ── Personalizar campanha ──                     │
│  Tom: Casual & Energético · Canais: Todos        │
│  Modelo: Ana ✅  [Personalizar ↓]               │
│                                                  │
│            [⚡ Gerar Campanha]                   │
└─────────────────────────────────────────────────┘
```

### 2.2 Pipeline em Execução

```
┌─────────────────────────────────────────────────┐
│          Criando sua campanha... ⚡              │
│                                                  │
│  ✅ Analisando produto...              2s        │
│  ✅ Estrategista definindo ângulo...   4s        │
│  🔄 Copywriter escrevendo...          ···        │
│  ○  Refinador aprimorando...                     │
│  ○  Scorer avaliando...                          │
│  ○  Gerando foto com modelo...                   │
│  ○  Montando criativo...                         │
│                                                  │
│  ┌──────────────────────────────────┐            │
│  │ Preview parcial aparece aqui     │            │
│  │ conforme cada etapa completa     │            │
│  └──────────────────────────────────┘            │
│                                                  │
│  Tempo estimado: ~30 segundos                    │
└─────────────────────────────────────────────────┘
```

**Implementação técnica do progresso:**
- WebSocket via Supabase Realtime ou Server-Sent Events
- Cada etapa do pipeline atualiza `campaigns.pipeline_step`
- Frontend escuta mudanças em tempo real e avança a UI
- Preview parcial: headline aparece quando Copywriter termina

---

## 3. TELA DE RESULTADO

### 3.1 Abas por Canal

```
┌─────────────────────────────────────────────────┐
│  [📸 Feed] [⚡ Stories] [💬 WhatsApp]           │
│  [📣 Meta Ads] [🧠 Estratégia] [◎ Score]       │
├─────────────────────────────────────────────────┤
│                                                  │
│  ── ABA: Instagram Feed ──                       │
│                                                  │
│  ┌──────────────┐  Headlines:                    │
│  │              │  ┌─────────────────────┐       │
│  │  [Criativo   │  │ "Esse conjunto     │ [📋]  │
│  │   1:1 com    │  │  canelado é pra     │       │
│  │   modelo +   │  │  quem não abre mão  │       │
│  │   texto +    │  │  de conforto" 🤎    │       │
│  │   preço]     │  └─────────────────────┘       │
│  │              │                                │
│  │  [⬇ Baixar]  │  Legenda completa:             │
│  └──────────────┘  ┌─────────────────────┐       │
│                    │ Copy do Instagram   │ [📋]  │
│                    │ com emojis e        │       │
│                    │ hashtags separadas  │       │
│                    └─────────────────────┘       │
│                                                  │
│  [🔄 Regerar só a copy]  [🔄 Regerar só imagem] │
└─────────────────────────────────────────────────┘
```

### 3.2 Aba Score

```
┌─────────────────────────────────────────────────┐
│  ── Score da Campanha ──                         │
│                                                  │
│      ┌───────────────────┐                       │
│      │   🟢 87/100       │                       │
│      │ Campanha forte!   │                       │
│      └───────────────────┘                       │
│                                                  │
│  Conversão      ████████████░░  85               │
│  Clareza        █████████████░  90               │
│  Urgência       ██████████░░░░  70               │
│  Naturalidade   ████████████░░  88               │
│  Aprovação Meta ██████████████  95               │
│                                                  │
│  ✅ Pontos fortes:                               │
│  • CTA com canal definido (WhatsApp)             │
│  • Tom natural e envolvente                      │
│                                                  │
│  💡 Sugestões de melhoria:                       │
│  ┌─────────────────────────────────────┐         │
│  │ Instagram Feed                      │         │
│  │ Falta motivo para agir agora        │         │
│  │ → Adicionar "Últimas 8 peças        │         │
│  │   nesse tamanho" antes do CTA       │         │
│  └─────────────────────────────────────┘         │
│                                                  │
│  [🔄 Aplicar melhorias automaticamente]          │
└─────────────────────────────────────────────────┘
```

---

## 4. COMPOSIÇÃO DO CRIATIVO (Konva.js)

### 4.1 Template Feed (1080×1080)

```
┌──────────────────────────┐
│                          │
│     [Imagem produto      │
│      com modelo ou       │
│      lifestyle]          │
│                          │
│  ┌────────────────────┐  │
│  │ HEADLINE PRINCIPAL │  │  ← Fonte: Inter Bold, 32px
│  └────────────────────┘  │
│                          │
│  ┌──────────┐            │
│  │ R$ 89,90 │            │  ← Badge de preço com fundo
│  └──────────┘            │
│                          │
│  ┌──────┐                │
│  │ LOGO │                │  ← Logo da loja (canto inferior)
│  └──────┘                │
└──────────────────────────┘
```

### 4.2 Template Stories (1080×1920)

**Slide 1 — Gancho:**
```
┌──────────────────────────┐
│                          │
│                          │
│                          │
│    TEXTO DO GANCHO       │  ← Fonte grande, centralizado
│    (máx 8 palavras)      │
│                          │
│                          │
│       ▲ Arraste          │
│                          │
└──────────────────────────┘
```

**Slide 2 — Produto:**
```
┌──────────────────────────┐
│                          │
│     [Imagem produto]     │
│                          │
│   TEXTO DO PRODUTO       │
│   (máx 12 palavras)      │
│                          │
│   ┌──────────┐           │
│   │ R$ 89,90 │           │
│   │ 3x 29,97 │           │
│   └──────────┘           │
│                          │
└──────────────────────────┘
```

**Slide 3 — CTA:**
```
┌──────────────────────────┐
│                          │
│                          │
│     TEXTO CTA            │  ← Fonte grande
│     (máx 6 palavras)     │
│                          │
│     [Botão CTA]          │
│     Manda no WhatsApp    │
│                          │
│     ┌──────┐             │
│     │ LOGO │             │
│     └──────┘             │
└──────────────────────────┘
```

### 4.3 Parâmetros de Composição

| Parâmetro | Valor | Personalizável? |
|-----------|-------|-----------------|
| Fonte headline | Inter Bold | Sim (v2 — plano Pro) |
| Fonte corpo | Inter Regular | Sim (v2) |
| Cor do texto | #FFFFFF (branco) | Auto-detectado pelo contraste |
| Cor do badge preço | Cor primária do logo (ou brand_colors) | Sim |
| Opacidade overlay | 0.3 (gradient escuro na base) | Não |
| Posição logo | Canto inferior direito | Não |
| Tamanho logo | 80×80px max | Não |

---

## 5. PROCESSAMENTO DE IMAGEM POR SEGMENTO

| Segmento | Pipeline de imagem |
|----------|-------------------|
| Moda feminina/masculina | 1. Fashn.ai try-on com modelo da loja → criativo |
| Moda infantil | 1. Stability AI remoção fundo → flat lay com acessórios |
| Calçados | 1. Remoção fundo → lifestyle (em uso, cenário urbano) |
| Acessórios | 1. Remoção fundo → flat lay elegante com props |
| Alimentos | 1. Remoção fundo → composição gastronômica |
| Bebidas | 1. Remoção fundo → cena social (se não álcool) |
| Beleza | 1. Remoção fundo → lifestyle (bancada, skincare flat lay) |
| Saúde | 1. Remoção fundo → produto isolado (sem pessoa) |
| Eletrônicos | 1. Remoção fundo → cenário tech/desk setup |
| Casa/Decoração | 1. Remoção fundo → composição de ambiente |
| Pet | 1. Remoção fundo → cena com animal (DALL-E) |

---

## 6. ROADMAP DE IMPLEMENTAÇÃO

### Fase 1 — MVP (4-6 semanas)
- [ ] Setup Next.js + Supabase + Clerk + Stripe
- [ ] Landing page com pricing
- [ ] Onboarding básico (nome + segmento)
- [ ] Pipeline IA completo (5 skills)
- [ ] Geração de campanha (sem modelo virtual)
- [ ] Resultado com abas básicas
- [ ] Score simples
- [ ] Painel admin básico (dashboard + custos)

### Fase 2 — Modelo Virtual (2-3 semanas)
- [ ] Integração Fashn.ai Model Create
- [ ] Tela de criação da modelo
- [ ] Try-on automático no pipeline
- [ ] Gestão de modelos no painel

### Fase 3 — Polimento (2-3 semanas)
- [ ] Composição Konva.js (criativos 1:1 e 9:16)
- [ ] Histórico de campanhas com busca
- [ ] Regeneração parcial (copy ou imagem)
- [ ] Alertas Meta Ads detalhados
- [ ] PostHog para analytics de funil

### Fase 4 — Escala (contínuo)
- [ ] Múltiplas modelos por loja
- [ ] Agendamento de postagem (Meta API)
- [ ] Preview mobile (mockup de celular)
- [ ] A/B testing de headlines
- [ ] API pública (plano Agência)
- [ ] White label
