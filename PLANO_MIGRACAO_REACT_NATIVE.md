# CriaLook — Plano de Migração para React Native

**Data:** 2026-04-22  
**Projeto:** CriaLook (campanha-ia)  
**Stack atual:** Next.js 16 + Tailwind + Framer Motion + Clerk + Supabase  
**Stack alvo:** React Native (Expo) + React Navigation + Reanimated + Clerk RN + Supabase

---

## Escopo da migração

### O que ENTRA na migração
Todas as telas voltadas ao **usuário final** (lojista).

### O que NÃO entra
| Item | Motivo |
|------|--------|
| **Editor Konva** (canvas de Instagram) | Ferramenta de uso administrativo interno, não faz parte do app do cliente |
| **Painel Admin** (/admin/*) | Uso interno — continua acessível pelo site na VPS |
| **Editor standalone** (/editor) | Ferramenta administrativa |
| **Landing page** (/) | Marketing — continua como site web |
| **API routes** (41 endpoints) | Continuam rodando na VPS, o app chama via fetch |
| **Preview compartilhável** (/preview/[token]) | Link web para compartilhar, não precisa de app |

---

## Inventário de telas a migrar

| # | Tela | Arquivo atual | LOC | Dificuldade | Estimativa |
|---|------|--------------|-----|-------------|------------|
| 1 | Onboarding (3 etapas) | `src/app/onboarding/page.tsx` | 1.259 | 🔴 Alta | 4-5 semanas |
| 2 | Gerar campanha | `src/app/(auth)/gerar/page.tsx` | 1.552 | 🔴 Muito alta | 6-8 semanas |
| 3 | Resultado da campanha | `src/app/(auth)/gerar/demo/page.tsx` | 889 | 🟠 Alta | 3-4 semanas |
| 4 | Gerenciar modelos | `src/app/(auth)/modelo/page.tsx` | 808 | 🟠 Média-alta | 2-3 semanas |
| 5 | Histórico | `src/app/(auth)/historico/page.tsx` | 475 | 🟢 Média | 1 semana |
| 6 | Configurações | `src/app/(auth)/configuracoes/page.tsx` | 391 | 🟡 Média | 2 semanas |
| 7 | Planos e créditos | `src/app/(auth)/plano/page.tsx` | 553 | 🟢 Baixa | 1 semana |
| 8 | Layout (nav + sidebar) | `src/app/(auth)/layout.tsx` | 326 | 🟡 Média | 1-2 semanas |
| 9 | Login / Cadastro | `src/app/sign-in`, `sign-up` | ~50 | 🟢 Baixa | 3 dias |
| | **TOTAL** | | **~6.300** | | **20-28 semanas** |

---

## Inventário de componentes a migrar

### Componentes que precisam ser reescritos

| Componente | LOC | O que faz | Bloqueio para RN | Equivalente nativo |
|-----------|-----|-----------|-------------------|-------------------|
| `GenerationLoadingScreen` | 275 | Tela de loading com fases, timer, confetti | CSS keyframes | `react-native-reanimated` |
| `CreativePreview` | ~100 | Preview da imagem gerada (feed) | Next/Image | `react-native-fast-image` |
| `CreativeStoriesPreview` | ~80 | Preview formato stories | Next/Image | `react-native-fast-image` |
| `BrandColorPicker` | ~200 | Extrai cor da logo via Canvas | Canvas API | Lib nativa de color picker ou simplificar |
| `BeforeAfterSlider` | ~120 | Slider antes/depois | Touch DOM events | `react-native-gesture-handler` |
| `PhotoTipsCard` | ~80 | Carrossel de dicas de foto | CSS scroll | `FlatList` horizontal |
| `QuotaExceededModal` | 568 | Modal de upsell (créditos/planos) | Framer Motion modal | `react-native-reanimated` + `Modal` |
| `ModelPlaceholder` | ~100 | Avatar placeholder SVG | SVG inline | `react-native-svg` |
| `FloatingWhatsApp` | ~50 | Botão WhatsApp flutuante | CSS position | `Linking.openURL` |
| `ThemeToggle` | ~60 | Dark/light mode | CSS variables | `useColorScheme` nativo |
| `ui.tsx` | ~150 | Botões, inputs, cards base | HTML/Tailwind | Componentes StyleSheet |

### Componentes que NÃO migram

| Componente | Motivo |
|-----------|--------|
| `KonvaCanvas`, `KonvaCompositor`, `KonvaToolbar`, etc. | Ferramenta administrativa — não faz parte do app |
| `InstagramEditor` | Usa Konva — administrativo |
| `HowItWorksAnimation` | Landing page (web) |
| `FaqAccordion` | Landing page (web) |
| `TestimonialCards` | Landing page (web) |
| `ShowcaseSection` | Landing page (web) |
| `PricingTabs` | Landing page (web, versão simplificada já existe em /plano) |
| `LiveCampaignDemo` | Landing page (web) |
| `StickyCTA` | Landing page (web) |
| `ScrollTracker` | Landing page analytics (web) |
| `HeadlineABTest` | Landing page A/B test (web) |
| `HumiliatingMathTable` | Landing page (web) |

---

## Hooks a migrar

| Hook | O que faz | Dificuldade |
|------|-----------|-------------|
| `useGenerateCampaign` | Controla SSE stream da geração | 🔴 Alta — SSE precisa virar WebSocket ou polling |
| `useWakeLock` | Impede tela apagar durante geração | 🟢 Baixa — `expo-keep-awake` |
| `useScrollTracking` | Tracking de scroll (analytics) | Não migra — landing page |

---

## Libs a migrar / substituir

| Lib atual (Web) | Substituto (React Native) | Esforço |
|-----------------|--------------------------|---------|
| `framer-motion` | `react-native-reanimated` + `react-native-gesture-handler` | Alto — API completamente diferente |
| `next/image` | `react-native-fast-image` ou `expo-image` | Baixo |
| `next/link` + `next/router` | `@react-navigation/native` | Médio |
| `@clerk/nextjs` | `@clerk/clerk-expo` | Médio — SDK diferente |
| `@supabase/ssr` | `@supabase/supabase-js` (client only) | Baixo |
| `tailwindcss` | `StyleSheet.create()` ou `nativewind` | Alto — tudo manual |
| `html2canvas-pro` | `react-native-view-shot` | Baixo |
| `lucide-react` | `lucide-react-native` | Baixo |
| `clsx` | `clsx` (funciona igual) | Zero |
| Canvas API (crop/color) | `react-native-skia` ou `expo-image-manipulator` | Alto |
| SSE (ReadableStream) | WebSocket ou polling HTTP | Alto |
| Clipboard API | `expo-clipboard` | Baixo |
| localStorage / sessionStorage | `expo-secure-store` ou `@react-native-async-storage` | Baixo |
| CSS animations / @keyframes | `react-native-reanimated` Worklets | Alto |

---

## Bloqueios técnicos críticos

### 1. SSE Streaming (Geração de campanha)
**Problema:** A tela de geração usa `fetch` com `ReadableStream` para receber progresso em tempo real do servidor. React Native não suporta SSE nativamente de forma confiável.

**Solução:**
- Opção A: Substituir por **WebSocket** (requer mudança no backend)
- Opção B: Substituir por **polling HTTP** a cada 3s (mais simples, sem mudança no backend)
- Opção C: Usar lib `react-native-sse` (experimental)

**Recomendação:** Polling HTTP — mais simples, funciona sem mexer no backend.

### 2. Canvas API (Crop de imagem)
**Problema:** A tela de resultado usa Canvas para recortar imagens em diferentes formatos (Stories 9:16, Feed 4:5, Feed 1:1) com fundo desfocado.

**Solução:** `expo-image-manipulator` para crop + `react-native-skia` para efeitos.

### 3. Canvas API (Color Picker)
**Problema:** `BrandColorPicker` usa Canvas para extrair cores de uma imagem (logo).

**Solução:** Simplificar — oferecer paleta de cores predefinidas + input manual de hex. Ou usar `react-native-image-colors` para extrair cor dominante automaticamente.

### 4. Drag & Drop (Upload de fotos)
**Problema:** A tela de geração tem drag & drop de fotos.

**Solução:** `expo-image-picker` — o conceito de drag & drop não existe em mobile. Substituir por botão "Escolher foto" que abre a galeria/câmera.

### 5. Confetti (Onboarding + Loading)
**Problema:** Animação CSS de confetti com @keyframes.

**Solução:** `react-native-confetti-cannon` ou `react-native-reanimated`.

---

## Arquitetura do app React Native

```
CriaLook/
├── src/
│   ├── app/                          # Expo Router (file-based routing)
│   │   ├── (auth)/                   # Telas protegidas (tab navigator)
│   │   │   ├── _layout.tsx           # Tab navigator (5 tabs)
│   │   │   ├── gerar/
│   │   │   │   ├── index.tsx         # Formulário de geração
│   │   │   │   └── resultado.tsx     # Resultado da campanha
│   │   │   ├── historico.tsx         # Lista de campanhas
│   │   │   ├── modelo.tsx            # Gerenciar modelos virtuais
│   │   │   ├── configuracoes.tsx     # Configurações da loja
│   │   │   └── plano.tsx             # Planos e créditos
│   │   ├── onboarding.tsx            # Onboarding (3 etapas)
│   │   ├── sign-in.tsx               # Login (Clerk)
│   │   ├── sign-up.tsx               # Cadastro (Clerk)
│   │   └── _layout.tsx               # Root layout (Clerk provider)
│   ├── components/
│   │   ├── ui/                       # Componentes base (Button, Input, Card, Modal)
│   │   ├── GenerationLoading.tsx
│   │   ├── CreativePreview.tsx
│   │   ├── PhotoTipsCard.tsx
│   │   ├── QuotaExceededModal.tsx
│   │   ├── ModelPlaceholder.tsx
│   │   └── BrandColorPicker.tsx
│   ├── hooks/
│   │   ├── useGenerateCampaign.ts    # Polling-based (substituindo SSE)
│   │   └── useKeepAwake.ts           # expo-keep-awake wrapper
│   ├── lib/
│   │   ├── api.ts                    # fetch wrapper apontando para VPS
│   │   ├── supabase.ts               # Cliente Supabase
│   │   ├── auth.ts                   # Clerk helpers
│   │   ├── storage.ts                # AsyncStorage helpers
│   │   └── plans.ts                  # Planos (copiado do web)
│   ├── types/
│   │   └── index.ts                  # Types (copiado do web)
│   └── utils/
│       ├── analytics.ts              # PostHog RN
│       └── haptics.ts                # expo-haptics
├── app.json                          # Expo config
├── package.json
└── tsconfig.json
```

---

## API: o que muda no backend

| Item | Muda? | Detalhe |
|------|-------|---------|
| API routes (/api/*) | **Não** | Continuam na VPS |
| Banco Supabase | **Não** | Mesmo banco |
| Webhooks MercadoPago | **Não** | Mesmo endpoint |
| Inngest jobs | **Não** | Mesma infra |
| Autenticação Clerk | **Parcial** | Precisa habilitar "React Native" no dashboard do Clerk e configurar redirect URLs |
| SSE endpoint (geração) | **Opcional** | Se optar por WebSocket, precisa criar novo endpoint. Se polling, não muda nada |

---

## Plano de execução por fases

### Fase 1 — Setup e fundação (Semanas 1-3)
- [ ] Criar projeto Expo com TypeScript
- [ ] Configurar Expo Router (file-based routing)
- [ ] Integrar Clerk Expo (`@clerk/clerk-expo`)
- [ ] Configurar Supabase client
- [ ] Criar componentes UI base (Button, Input, Card, Modal)
- [ ] Configurar tema (cores, fontes, dark mode)
- [ ] Configurar `api.ts` com base URL da VPS
- [ ] Configurar analytics (PostHog RN)

### Fase 2 — Telas simples (Semanas 4-7)
- [ ] Login / Cadastro (Clerk screens)
- [ ] Tab navigator (5 abas: Gerar, Histórico, Modelos, Planos, Config)
- [ ] Histórico — lista de campanhas com paginação
- [ ] Planos — cards de planos + checkout redirect
- [ ] Configurações — formulário da loja + upload logo

### Fase 3 — Telas médias (Semanas 8-13)
- [ ] Gerenciamento de modelos — form + lista + polling
- [ ] Onboarding — 3 etapas com animações Reanimated
- [ ] QuotaExceededModal
- [ ] BrandColorPicker (versão simplificada)

### Fase 4 — Telas complexas (Semanas 14-22)
- [ ] Geração de campanha — upload + form + polling de progresso
- [ ] GenerationLoadingScreen com fases e timer
- [ ] Resultado — galeria + crop de formatos + download/compartilhar
- [ ] Integração expo-image-manipulator para crop
- [ ] Share sheet nativo (compartilhar imagem no Instagram/WhatsApp)

### Fase 5 — Polimento e publicação (Semanas 23-28)
- [ ] Push notifications (expo-notifications)
- [ ] Deep links (expo-linking)
- [ ] Splash screen e ícone
- [ ] Testes em devices reais (Android + iOS)
- [ ] Build de produção (EAS Build)
- [ ] Submissão Google Play
- [ ] Submissão App Store

---

## Dependências do projeto React Native

```json
{
  "dependencies": {
    "expo": "~52",
    "expo-router": "~4",
    "expo-image": "~2",
    "expo-image-picker": "~16",
    "expo-image-manipulator": "~13",
    "expo-clipboard": "~7",
    "expo-haptics": "~14",
    "expo-keep-awake": "~14",
    "expo-notifications": "~0.30",
    "expo-linking": "~7",
    "expo-secure-store": "~14",
    "expo-splash-screen": "~0.30",
    "@clerk/clerk-expo": "^2",
    "@supabase/supabase-js": "^2",
    "@react-navigation/native": "^7",
    "@react-navigation/bottom-tabs": "^7",
    "react-native-reanimated": "~3",
    "react-native-gesture-handler": "~2",
    "react-native-svg": "~15",
    "react-native-fast-image": "^8",
    "react-native-view-shot": "^4",
    "react-native-confetti-cannon": "^1",
    "lucide-react-native": "^0.400",
    "clsx": "^2",
    "posthog-react-native": "^3",
    "@sentry/react-native": "^6"
  }
}
```

---

## Riscos e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| SSE não funcionar bem em RN | Alta | Alto | Usar polling HTTP desde o início |
| Crop de imagem com qualidade inferior | Média | Médio | Testar expo-image-manipulator cedo |
| Clerk Expo com bugs | Baixa | Alto | Clerk tem SDK estável para Expo |
| Rejeição da Apple | Média | Alto | App tem funcionalidade real (IA), não é só WebView |
| Manutenção dupla (web + app) | Certa | Alto | Compartilhar types e lib de API. Considerar monorepo |
| Performance de imagens pesadas | Média | Médio | Usar expo-image com cache agressivo |

---

## Custo estimado

| Item | Estimativa |
|------|-----------|
| Tempo total | 20-28 semanas (1 dev senior) |
| Conta Apple Developer | US$ 99/ano |
| Conta Google Play | US$ 25 (única) |
| EAS Build (Expo) | Gratuito (30 builds/mês) ou US$ 99/mês (ilimitado) |

---

## Alternativa recomendada: WebView agora + nativo depois

Se o objetivo é estar na Play Store / App Store **rápido**:

1. **Semana 1:** Subir com WebView (Capacitor ou RN WebView)
2. **Meses seguintes:** Migrar tela por tela para nativo, começando pelas mais simples
3. **Resultado:** app na loja em dias, não meses

Essa abordagem híbrida permite ter presença nas lojas imediatamente enquanto o app nativo é construído gradualmente.
