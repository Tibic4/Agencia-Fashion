# Implementação Nível 120%: Framer Motion & Haptic Feedback

Este plano descreve o passo a passo para evoluirmos a interface de 100% para 120%, integrando física fluida (molas) através da biblioteca Framer Motion e introduzindo reações físicas no dispositivo mobile através da API de Vibração Nativa (Haptics).

> [!NOTE]
> Estas modificações afetam quase que inteiramente a camada de "Client Components" do React. Não haverá mudanças de regras de negócio de backend, sendo todas voltadas 100% à percepção de valor do usuário (Front-end).

## 1. Instalação e Preparação

- Instalar a dependência principal para animações no React: `npm install framer-motion`.
- Criar a biblioteca utilitária `src/lib/utils/haptics.ts`. Esta biblioteca servirá como um "wrapper" seguro para a `navigator.vibrate` API, garantindo que não quebre em Desktop ou iOS antigo (sendo silenciosamente ignorada caso o hardware não suporte).

### Padrões de Haptics a serem mapeados:
- **`hapticLight()`**: `vibrate(10)` - Interações simples (abrir um menu, selecionar o formato de imagem).
- **`hapticMedium()`**: `vibrate(30)` - Clique principal (acionar o botão de gerar campanha).
- **`hapticSuccess()`**: `vibrate([20, 50, 20])` - Múltiplas vibrações (confete do onboarding ou finalização da geração).
- **`hapticError()`**: `vibrate([40, 50, 40])` - Avisos de erro ou deletar item.

## 2. Refatoração de Bottom Sheets para Molas (Framer Motion)

Os seguintes componentes atualmente usam CSS manual (animate-fade-in-up e transitions de opacidade). Eles serão convertidos para `<motion.div>` utilizando configurações do tipo `type: "spring", damping: 25, stiffness: 300`:

#### [MODIFY] `src/components/QuotaExceededModal.tsx`
- Refatorar a renderização da janela modal.
- Integrar `hapticLight()` ao abrir e `hapticMedium()` ao clicar nos CTA's de plano.

#### [MODIFY] `src/components/BrandColorPicker.tsx`
- Refatorar a transição da modal.
- `hapticLight()` nas trocas de cor de "Swatch" (para dar a sensação de estar apertando botões reais na paleta).

#### [MODIFY] `src/app/(auth)/gerar/demo/page.tsx`
- Acoplar `<motion.div>` na UI inferior (Bottom Sheet dos recortes de aspectos).
- `hapticLight()` ao transitar entre as medidas (ex: 1:1, 4:5, 16:9).

#### [MODIFY] `src/app/(auth)/gerar/page.tsx`
- Adicionar o Haptic no Botão Principal: `hapticMedium()` no momento de acionar "Gerar Campanha".
- Trocar transição manual CSS das modais de Erro / SinglePhoto pelas de física de tração no Framer Motion.

## 3. Micro-interações de Favoritar e Deletar

#### [MODIFY] `src/app/(auth)/historico/page.tsx`
- Deletar e Favoritar as imagens terão Haptics.
- **`toggleFavorite`**: Adicionar animação de "Pop" e sombreado de Framer Motion junto a um `hapticLight()`.
- **AnimatePresence**: Possibilita usar o `<AnimatePresence>` do Framer Motion para fazer a exclusão das campanhas ter uma animação natural de encolhimento, reduzindo agressividade visual.

## Open Questions

> [!WARNING]
> No iOS Safari, a diretiva `navigator.vibrate` muitas vezes é suprimida pelo próprio WebKit do iPhone se não ocorrer num evento interativo direto. Em dispositivos Android / PWA, funciona incrivelmente bem. Concorda em usarmos como Feature Condicional (Progressive Enhancement), ou seja, funciona brilhantemente no Android e não quebra nada no iOS?

## Verification Plan
### Automated Tests
- Executar build padrão para checar se o TSDoc da `framer-motion` acusa erros em diretivas `'use client'`.

### Manual Verification
- Testar pelo navegador simulado no DevTools que as telas não perdem performance por excesso de re-render com as físicas de Framer Motion.
- Pedir para você (o usuário) testar abrindo pelo Smartphone para conferir a sensação tátil na ponta dos dedos ao navegar pelas telas e favoritar campanhas.
