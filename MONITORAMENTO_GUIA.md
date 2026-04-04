# 📊 MONITORAMENTO — Guia Prático das Ferramentas

> **CriaLook** — O que cada ferramenta faz e quando usar.
> Todas funcionam sozinhas. Só precisa olhar quando necessário.

---

## 🐛 Sentry — Alarme de Erros

**O que faz:** Captura erros automaticamente. Se algo quebrar no site, você vê o erro exato (arquivo, linha, o que aconteceu).

**Como usar:**
1. Acesse [sentry.io](https://sentry.io) → login
2. Painel mostra erros recentes com prioridade
3. **Não precisa fazer nada** — é passivo. Quando algo quebrar, aparece lá

**Quando olhar:** Quando cliente reclamar de erro ou tela branca.

**Exemplo:** Cliente clicou "Gerar campanha" e deu erro → Sentry captura → Você vê:  
`TypeError: Cannot read property 'name' of null` na rota `/api/campaign/generate`, linha 157

**Plano:** Grátis (5K eventos/mês)  
**Variáveis:** `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`

---

## 📊 PostHog — Raio-X dos Usuários

**O que faz:** Analytics inteligente com:
- **Visitas** — quantos acessam por dia
- **Funil de conversão** — visitou → cadastrou → gerou campanha → pagou
- **Session replay** — assistir a tela do usuário (como um vídeo)
- **Feature flags** — ligar/desligar funcionalidades sem deploy

**Como usar:**
1. Acesse [posthog.com](https://posthog.com) → login
2. **Dashboard** → métricas gerais
3. **Funnels** → criar funil de conversão
4. **Recordings** → assistir sessões reais dos usuários

**Quando olhar:** 1x por semana para acompanhar métricas.

**Exemplo de funil útil:**
```
Visitou landing page → Clicou "Começar grátis" → Cadastrou → Gerou 1ª campanha → Fez upgrade
```
Ver onde as pessoas saem = saber o que melhorar.

**Plano:** Grátis (1M eventos/mês)  
**Variáveis:** `POSTHOG_KEY`, `POSTHOG_HOST`

---

## ⚡ Inngest — Fila de Jobs com Retry

**O que faz:** Executa tarefas pesadas em background. Se o pipeline de IA falhar (timeout, API fora), tenta de novo sozinho.

**Como usar:**
1. Acesse [inngest.com](https://inngest.com) → login
2. Vê jobs executados, quais falharam, quais deram retry
3. Útil para debug quando uma campanha "travou"

**Quando olhar:** Quando campanha não gerar resultado.

**Exemplo:** Claude API ficou fora 5 min → Inngest detecta falha → Retry automático em 30s → Campanha gerada com sucesso

**Plano:** Grátis (25K runs/mês)  
**Variáveis:** `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`

---

## 📋 Resumo Rápido

| Ferramenta | Pergunta que responde | Frequência |
|---|---|---|
| **Sentry** | "Tem algo **quebrado**?" | Só quando cliente reportar erro |
| **PostHog** | "Onde as pessoas **desistem**?" | 1x por semana |
| **Inngest** | "A campanha **travou** no pipeline?" | Só quando campanha não gerar |

---

## 🔗 Links Rápidos

| Ferramenta | Painel |
|---|---|
| Sentry | [sentry.io](https://sentry.io) |
| PostHog | [posthog.com](https://posthog.com) |
| Inngest | [inngest.com](https://inngest.com) |

---

> **Dica:** Os três funcionam 100% sozinhos sem nenhuma ação sua. Só cheque quando precisar investigar algo específico.
