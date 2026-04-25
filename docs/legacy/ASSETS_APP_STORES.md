# CriaLook — Guia de Imagens e Assets para Publicação nas Lojas

**Data:** 2026-04-22

---

## Assets que já existem no projeto

| Arquivo | Tamanho | Localização |
|---------|---------|-------------|
| `logo.png` | 791 KB | `public/logo.png` |
| `icon-512.png` | 386 KB (512×512) | `public/icon-512.png` |
| `icon-192.png` | 59 KB (192×192) | `public/icon-192.png` |
| `apple-icon.png` | 58 KB (192×192) | `src/app/apple-icon.png` |
| `favicon.png` | 58 KB (192×192) | `src/app/favicon.png` |
| `clerk-logo.png` | 196 KB | `public/clerk-logo.png` |

> ⚠️ **Nenhum asset existente atende os requisitos das lojas.** O ícone máximo é 512×512 — Apple exige 1024×1024.

---

## 1. ÍCONE DO APP (Obrigatório)

Você precisa de **1 arquivo fonte** de 1024×1024 px. Dele, todos os outros tamanhos são gerados automaticamente.

### Arquivo fonte

| Item | Especificação |
|------|--------------|
| **Tamanho** | 1024 × 1024 px |
| **Formato** | PNG |
| **Cor de fundo** | Sólida (sem transparência para iOS) |
| **Cantos** | Quadrados (as lojas arredondam automaticamente) |
| **Conteúdo** | Logo centralizada, sem texto pequeno |
| **Margem segura** | Conteúdo importante dentro dos 80% centrais (820×820 px) |
| **Arquivo** | `assets/icon.png` |

### Tamanhos gerados a partir dele

#### Android (Adaptive Icon)

| Densidade | Tamanho | Pasta |
|-----------|---------|-------|
| mdpi | 48 × 48 px | `mipmap-mdpi/` |
| hdpi | 72 × 72 px | `mipmap-hdpi/` |
| xhdpi | 96 × 96 px | `mipmap-xhdpi/` |
| xxhdpi | 144 × 144 px | `mipmap-xxhdpi/` |
| xxxhdpi | 192 × 192 px | `mipmap-xxxhdpi/` |
| Play Store | 512 × 512 px | Upload manual |

> **Ferramenta:** Android Studio > New > Image Asset (gera tudo automaticamente)

#### iOS

| Contexto | Tamanho | Escala |
|----------|---------|--------|
| iPhone Spotlight | 40 × 40 px | 2x, 3x |
| iPhone App | 60 × 60 px | 2x, 3x |
| iPad App | 76 × 76 px | 1x, 2x |
| iPad Pro | 83.5 × 83.5 px | 2x |
| App Store | 1024 × 1024 px | 1x |

> **Ferramenta:** Xcode > Assets.xcassets > AppIcon (arraste o 1024×1024 e ele gera)

#### Expo (React Native)

No `app.json`:
```json
{
  "expo": {
    "icon": "./assets/icon.png",
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0a0a12"
      }
    },
    "ios": {
      "icon": "./assets/icon.png"
    }
  }
}
```

| Arquivo | Tamanho | Descrição |
|---------|---------|-----------|
| `assets/icon.png` | 1024 × 1024 px | Ícone geral (Expo redimensiona) |
| `assets/adaptive-icon.png` | 1024 × 1024 px | Foreground do ícone adaptativo Android (fundo transparente) |

---

## 2. SPLASH SCREEN (Obrigatório)

Tela exibida enquanto o app carrega.

| Item | Especificação |
|------|--------------|
| **Tamanho** | 1284 × 2778 px (cobre todos os devices) |
| **Formato** | PNG |
| **Conteúdo** | Logo centralizada, fundo sólido |
| **Cor de fundo** | `#0a0a12` (mesma do app) |
| **Área segura** | Logo dentro de 600 × 600 px no centro |
| **Arquivo** | `assets/splash.png` |

No `app.json`:
```json
{
  "expo": {
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#0a0a12"
    }
  }
}
```

---

## 3. SCREENSHOTS PARA AS LOJAS (Obrigatório)

### Google Play Store

| Tipo | Tamanho | Quantidade | Formato |
|------|---------|------------|---------|
| **Celular** (obrigatório) | 1080 × 1920 px | Mínimo 2, máximo 8 | JPEG ou PNG |
| **Tablet 7"** (opcional) | 1080 × 1920 px | Até 8 | JPEG ou PNG |
| **Tablet 10"** (opcional) | 1200 × 1920 px | Até 8 | JPEG ou PNG |

**Tamanho máximo por arquivo:** 8 MB

### Apple App Store

| Device | Tamanho | Quantidade | Obrigatório |
|--------|---------|------------|-------------|
| **iPhone 6.7"** (15 Pro Max) | 1290 × 2796 px | Mínimo 1, máximo 10 | ✅ Sim |
| **iPhone 6.5"** (14 Plus) | 1284 × 2778 px | Mínimo 1, máximo 10 | ✅ Sim |
| **iPhone 5.5"** (SE, 8 Plus) | 1242 × 2208 px | Até 10 | Opcional |
| **iPad 12.9"** | 2048 × 2732 px | Até 10 | Se suportar iPad |

**Tamanho máximo por arquivo:** 5 MB

### Screenshots recomendadas (conteúdo)

Criar **5 screenshots** cobrindo as telas principais:

| # | Tela | Texto de destaque sugerido |
|---|------|---------------------------|
| 1 | Tela de geração (upload de foto) | "Envie a foto do produto e a IA faz o resto" |
| 2 | Resultado da campanha (imagem gerada) | "Modelo virtual vestindo sua roupa" |
| 3 | Texto gerado (copy + hashtags) | "Legendas prontas para Instagram e WhatsApp" |
| 4 | Histórico de campanhas | "Todas as suas campanhas organizadas" |
| 5 | Planos e preços | "Comece grátis, escale quando quiser" |

> **Dica:** Use mockup de celular com a screenshot dentro. Ferramentas: Figma, Canva, ou [screenshots.pro](https://screenshots.pro)

---

## 4. FEATURE GRAPHIC — Google Play (Obrigatório)

| Item | Especificação |
|------|--------------|
| **Tamanho** | 1024 × 500 px |
| **Formato** | JPEG ou PNG |
| **Tamanho máximo** | 1 MB |
| **Conteúdo** | Banner promocional — logo + tagline + imagem do app |
| **Arquivo** | `store-assets/feature-graphic.png` |

Aparece no topo da página do app na Play Store. Precisa ser visualmente atraente.

---

## 5. ÍCONE DE NOTIFICAÇÃO — Android (Obrigatório se usar push)

| Item | Especificação |
|------|--------------|
| **Tamanho** | 96 × 96 px (xxxhdpi) |
| **Formato** | PNG com transparência |
| **Cor** | Branco puro (#FFFFFF) — Android colore automaticamente |
| **Estilo** | Silhueta simples da logo, sem detalhes finos |
| **Arquivo** | `assets/notification-icon.png` |

No `app.json`:
```json
{
  "expo": {
    "notification": {
      "icon": "./assets/notification-icon.png",
      "color": "#A855F7"
    }
  }
}
```

---

## 6. RESUMO — Lista completa de arquivos para criar

### Arquivos obrigatórios

| # | Arquivo | Tamanho | Formato | Para quê |
|---|---------|---------|---------|----------|
| 1 | `assets/icon.png` | 1024 × 1024 px | PNG, sem transparência | Ícone do app (iOS + geral) |
| 2 | `assets/adaptive-icon.png` | 1024 × 1024 px | PNG, com transparência | Ícone adaptativo Android (foreground) |
| 3 | `assets/splash.png` | 1284 × 2778 px | PNG | Splash screen |
| 4 | `assets/notification-icon.png` | 96 × 96 px | PNG, branco + transparente | Notificações Android |
| 5 | `store-assets/feature-graphic.png` | 1024 × 500 px | PNG ou JPEG | Banner Google Play |
| 6 | `store-assets/screenshot-1.png` | 1290 × 2796 px | PNG | Screenshot loja (tela geração) |
| 7 | `store-assets/screenshot-2.png` | 1290 × 2796 px | PNG | Screenshot loja (resultado) |
| 8 | `store-assets/screenshot-3.png` | 1290 × 2796 px | PNG | Screenshot loja (copy gerado) |
| 9 | `store-assets/screenshot-4.png` | 1290 × 2796 px | PNG | Screenshot loja (histórico) |
| 10 | `store-assets/screenshot-5.png` | 1290 × 2796 px | PNG | Screenshot loja (planos) |

### Arquivos opcionais (recomendado)

| # | Arquivo | Tamanho | Para quê |
|---|---------|---------|----------|
| 11 | `store-assets/promo-video.mp4` | 1080 × 1920 px, 15-30s | Vídeo promocional (App Store) |
| 12 | `store-assets/tablet-screenshot-*.png` | 2048 × 2732 px | Screenshots iPad/Tablet |

---

## 7. ESTRUTURA DE PASTAS SUGERIDA

```
CriaLook/
├── assets/
│   ├── icon.png                    ← 1024×1024  (ícone principal)
│   ├── adaptive-icon.png           ← 1024×1024  (foreground Android, fundo transparente)
│   ├── splash.png                  ← 1284×2778  (splash screen)
│   └── notification-icon.png       ← 96×96      (push notification, branco)
│
├── store-assets/                   ← NÃO vai no app, só para upload nas lojas
│   ├── feature-graphic.png         ← 1024×500   (banner Play Store)
│   ├── screenshot-1-geracao.png    ← 1290×2796
│   ├── screenshot-2-resultado.png  ← 1290×2796
│   ├── screenshot-3-copy.png       ← 1290×2796
│   ├── screenshot-4-historico.png  ← 1290×2796
│   └── screenshot-5-planos.png     ← 1290×2796
│
└── app.json                        ← Referencia os assets
```

---

## 8. ESPECIFICAÇÕES VISUAIS DO APP (referência para o designer)

Extraídas do projeto atual:

| Item | Valor |
|------|-------|
| **Cor primária** | `#A855F7` (roxo) |
| **Cor de fundo (dark)** | `#0a0a12` |
| **Cor de fundo (light)** | `#ffffff` |
| **Cor tema** | `#A855F7` |
| **Nome do app** | CriaLook |
| **Subtítulo** | Marketing de Moda com IA |
| **Fonte** | System default (San Francisco / Roboto) |

---

## 9. CHECKLIST ANTES DE SUBMETER

### Google Play
- [ ] Ícone 512×512 PNG
- [ ] Feature graphic 1024×500
- [ ] Mínimo 2 screenshots celular (1080×1920)
- [ ] Descrição curta (até 80 caracteres)
- [ ] Descrição longa (até 4000 caracteres)
- [ ] Categoria: Produtividade ou Negócios
- [ ] Classificação etária (questionário respondido)
- [ ] Política de privacidade (URL)
- [ ] Ícone de notificação (se usar push)

### Apple App Store
- [ ] Ícone 1024×1024 PNG (sem transparência)
- [ ] Screenshots iPhone 6.7" (1290×2796) — mínimo 1
- [ ] Screenshots iPhone 6.5" (1284×2778) — mínimo 1
- [ ] Descrição (até 4000 caracteres)
- [ ] Palavras-chave (até 100 caracteres, separadas por vírgula)
- [ ] Categoria: Negócios ou Produtividade
- [ ] Classificação etária
- [ ] Política de privacidade (URL) — **obrigatória**
- [ ] URL de suporte
- [ ] Se tem login: credenciais de teste para o revisor Apple
