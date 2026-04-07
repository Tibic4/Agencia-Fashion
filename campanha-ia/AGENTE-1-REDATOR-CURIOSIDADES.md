# Agente 1: Redator de Curiosidades Fashion (Loading Content)

## Objetivo
Criar um componente React que exibe **curiosidades, dicas e fatos sobre moda** durante o tempo de carregamento da geração de campanha (~30-60s), mantendo o usuário engajado e a experiência premium.

---

## Contexto do Projeto

### O que é o CriaLook
SaaS de geração de campanhas de moda com IA. O lojista faz upload de uma foto do produto, e a plataforma gera textos de marketing + imagem da modelo vestindo a roupa. O processo leva **30-60 segundos**.

### Stack Técnico
- **Framework:** Next.js 15 (App Router)
- **Linguagem:** TypeScript
- **Styling:** CSS puro (variáveis CSS, sem Tailwind)
- **Hospedagem:** VPS Linux com PM2

### Localização do Projeto
```
d:\Nova pasta\Agencia-Fashion\campanha-ia\
```

---

## Onde Inserir o Componente

### Arquivo principal (tela de loading atual)
```
src/app/(auth)/gerar/page.tsx
```

### Seção exata — linhas 366-414
A tela de loading é renderizada quando `isGenerating === true`. Atualmente exibe:
- Ícone animado (raio pulsando)
- Título "Gerando sua campanha"
- Barra de progresso
- Lista de steps (✓ concluído / ● atual / ○ pendente)

### O que manter
- A barra de progresso
- A lista de steps
- O botão "Ver resultado" no final

### O que adicionar
Um **carrossel de curiosidades** abaixo da barra de progresso e acima da lista de steps.

---

## Especificação do Componente

### `FashionFactsCarousel`
- Exibe uma curiosidade por vez, trocando automaticamente a cada **5 segundos**
- Transição: fade-in/fade-out suave (300ms)
- Estilo: card com borda sutil, ícone emoji, texto curto

### Conteúdo (30+ curiosidades)
Misturar categorias:
1. **Curiosidades históricas** — "O jeans foi inventado em 1873 para mineradores"
2. **Dados de mercado** — "O mercado de moda brasileiro movimenta R$ 190 bilhões/ano"
3. **Dicas para lojistas** — "Posts com modelo vestindo a roupa vendem 3x mais que flat lay"
4. **Tendências** — "Cores terrosas são tendência em 2026"
5. **Psicologia de vendas** — "A cor do fundo do produto influencia 62% da decisão de compra"
6. **Instagram tips** — "Reels com música trendy têm 48% mais alcance"

### Formato de cada curiosidade
```typescript
interface FashionFact {
  emoji: string;      // "👗", "📊", "💡", "🔥", "🧠", "📱"
  category: string;   // "Curiosidade", "Dica", "Tendência", "Dado"
  text: string;       // Texto curto (max 120 caracteres)
  source?: string;    // Fonte opcional (ex: "ABIT 2025")
}
```

### Design (CSS)
```css
.fashion-fact-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 20px 24px;
  margin: 24px 0;
  text-align: center;
  min-height: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.fashion-fact-card .emoji {
  font-size: 28px;
}

.fashion-fact-card .category {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--muted);
  font-weight: 600;
}

.fashion-fact-card .text {
  font-size: 15px;
  line-height: 1.5;
  color: var(--foreground);
  max-width: 380px;
}
```

### Variáveis CSS disponíveis
```css
--brand-500: #E64980;      /* Rosa principal */
--background: #FFFFFF;
--surface: #F8F9FA;
--foreground: #1A1A2E;
--muted: #6B7280;
--border: #E5E7EB;
--success: #10B981;
--gradient-brand: linear-gradient(135deg, #E64980 0%, #F97316 100%);
```

---

## States/Variáveis já existentes

```typescript
const [isGenerating, setIsGenerating] = useState(false);
const [generationStep, setGenerationStep] = useState(0);

const generationSteps = [
  { label: "Analisando produto...", progress: 15 },
  { label: "Criando estratégia...", progress: 30 },
  { label: "Escrevendo textos...", progress: 50 },
  { label: "Refinando copy...", progress: 65 },
  { label: "Processando imagem...", progress: 80 },
  { label: "Montando criativo...", progress: 92 },
  { label: "Pronto!", progress: 100 },
];
```

---

## Regras
1. **NÃO alterar** a lógica de geração (`handleGenerate`)
2. **NÃO alterar** o backend (route.ts, pipeline.ts)
3. **NÃO usar** Tailwind — usar CSS puro com as variáveis acima
4. **MANTER** a barra de progresso e lista de steps — o carrossel é adicionado entre eles
5. O componente deve funcionar como um arquivo separado em `src/components/FashionFactsCarousel.tsx`
6. Conteúdo em **português brasileiro** (pt-BR)
7. Textos devem ser precisos — não inventar estatísticas falsas

---

## Entrega Esperada
1. `src/components/FashionFactsCarousel.tsx` — Componente React
2. Atualização em `src/app/(auth)/gerar/page.tsx` — Import + inserção na tela de loading
3. CSS opcional em `src/app/globals.css` se necessário
