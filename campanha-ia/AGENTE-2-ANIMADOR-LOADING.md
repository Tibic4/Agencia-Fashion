# Agente 2: Animador de Loading (Micro-Interactions)

## Objetivo
Criar **animações e micro-interações premium** na tela de loading da geração de campanha, transformando a espera de ~30-60s em uma experiência visualmente encantadora e que transmita progresso real.

---

## Contexto do Projeto

### O que é o CriaLook
SaaS de geração de campanhas de moda com IA. O lojista faz upload de uma foto do produto, e a plataforma gera textos de marketing + imagem da modelo vestindo a roupa. O loading atual é funcional mas básico.

### Stack Técnico
- **Framework:** Next.js 15 (App Router)
- **Linguagem:** TypeScript
- **Styling:** CSS puro (variáveis CSS, sem Tailwind)
- **Animações:** CSS animations + requestAnimationFrame (NÃO usar bibliotecas externas como Framer Motion)
- **Hospedagem:** VPS Linux com PM2

### Localização do Projeto
```
d:\Nova pasta\Agencia-Fashion\campanha-ia\
```

---

## Onde Inserir as Animações

### Arquivo principal (tela de loading)
```
src/app/(auth)/gerar/page.tsx — linhas 366-414
```

### Estado atual do loading
A tela renderiza quando `isGenerating === true`:
```tsx
if (isGenerating) {
  const step = generationSteps[generationStep];
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh]">
      {/* Ícone animado — SUBSTITUIR por animação premium */}
      <div className="w-20 h-20 rounded-3xl mx-auto mb-8 animate-pulse-glow"
           style={{ background: "var(--gradient-brand)" }}>
        <IconZap />
      </div>

      <h2>Gerando sua campanha</h2>
      <p>{step.label}</p>

      {/* Barra de progresso — MELHORAR com animação */}
      <div className="h-3 rounded-full overflow-hidden">
        <div style={{ width: `${step.progress}%` }} />
      </div>

      {/* Steps list — MELHORAR com transições */}
      {generationSteps.map((s, i) => (
        <div key={i}>
          <span>{i < generationStep ? "✓" : i === generationStep ? "●" : "○"}</span>
          <span>{s.label}</span>
        </div>
      ))}
    </div>
  );
}
```

---

## Especificações das Animações

### 1. Ícone Central Animado
**Substituir** o ícone pulsante por uma animação que muda conforme o step:

| Step | Animação |
|------|----------|
| 0-1 (Vision/Strategy) | Lupa girando suavemente + partículas |
| 2-3 (Copywriter/Refiner) | Caneta escrevendo + linhas aparecendo |
| 4-5 (Imagem/Criativo) | Câmera + flash piscando |
| 6 (Pronto) | Confetti/checkmark animado |

Implementar com **CSS animations** puras (keyframes). Cada ícone faz fade-out/fade-in na troca.

### 2. Barra de Progresso Premium
- **Gradiente animado** que se move da esquerda pra direita (shimmer effect)
- **Glow effect** sutil embaixo da barra
- **Transição suave** entre percentuais (ease-out, 1000ms)
- **Texto de percentual** abaixo da barra (ex: "65%")

```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.progress-bar-fill {
  background: linear-gradient(
    90deg,
    var(--brand-500) 25%,
    #F97316 50%,
    var(--brand-500) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 2s ease-in-out infinite;
  transition: width 1000ms ease-out;
  box-shadow: 0 0 20px rgba(230, 73, 128, 0.3);
}
```

### 3. Steps com Animação de Entrada
- Cada step faz **slide-in da esquerda + fade-in** quando ativado
- O step atual tem um **pulso suave** no indicador (●)
- Steps concluídos têm checkmark com **bounce** (escala 1→1.2→1)
- Usar `transition-delay` escalonado para steps pendentes

### 4. Fundo Animado Sutil
- **Gradiente radial** ultra-sutil que pulsam atrás do card principal
- Cores: rosa e laranja (brand colors) com opacidade 0.05
- Não deve distrair — apenas dar vida ao fundo

### 5. Partículas Flutuantes (opcional, leve)
- 5-8 partículas circulares minúsculas (4-8px) flutuando lentamente
- Cores: brand translúcido (opacity 0.1-0.2)
- Usar CSS animation (não canvas — performance)

---

## Variáveis CSS Disponíveis

```css
--brand-500: #E64980;
--brand-400: #F06292;
--background: #FFFFFF;
--surface: #F8F9FA;
--foreground: #1A1A2E;
--muted: #6B7280;
--border: #E5E7EB;
--success: #10B981;
--gradient-brand: linear-gradient(135deg, #E64980 0%, #F97316 100%);
```

---

## Animações CSS já existentes no projeto

Em `src/app/globals.css`:
```css
@keyframes pulse-glow {
  0%, 100% { opacity: 1; box-shadow: 0 0 20px rgba(230, 73, 128, 0.3); }
  50% { opacity: 0.85; box-shadow: 0 0 40px rgba(230, 73, 128, 0.5); }
}
.animate-pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }

@keyframes fade-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in { animation: fade-in 0.5s ease-out; }
```

---

## States/Props Disponíveis

```typescript
// Estados que controlam a UI de loading
const [isGenerating, setIsGenerating] = useState(false);  // true durante geração
const [generationStep, setGenerationStep] = useState(0);  // 0-6, atualiza a cada ~2s

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
1. **NÃO usar bibliotecas externas** (Framer Motion, GSAP, Lottie) — CSS puro + JS nativo
2. **NÃO alterar** a lógica de geração (`handleGenerate`, `generationSteps`)
3. **NÃO alterar** o backend
4. **NÃO usar** Tailwind — CSS puro com variáveis CSS
5. **Performance:** Todas as animações devem usar `transform` e `opacity` (GPU-accelerated)
6. **Acessibilidade:** Respeitar `prefers-reduced-motion`
7. Componente em arquivo separado: `src/components/GenerationLoadingScreen.tsx`
8. CSS das animações em `src/components/GenerationLoadingScreen.css` ou inline

---

## Entrega Esperada
1. `src/components/GenerationLoadingScreen.tsx` — Componente de loading completo
2. `src/components/GenerationLoadingScreen.css` — Estilos e keyframes
3. Atualização em `src/app/(auth)/gerar/page.tsx` — Substituir bloco de loading (linhas 366-414) por:
   ```tsx
   if (isGenerating) {
     return <GenerationLoadingScreen step={generationStep} steps={generationSteps} />;
   }
   ```

---

## Referências Visuais
- Notion loading (transições de ícone elegantes)
- Linear.app (progresso com gradiente animado)
- Vercel deploy (steps com animação de entrada)
- Stripe checkout (fundo com gradiente sutil animado)
