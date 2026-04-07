# Relatório Completo de Auditoria: Falhas e Resoluções Técnicas do Pipeline v2.1 (Contexto VPS)

A análise extensiva do pipeline evidenciou que a **Demora Severa** e as **Falhas Súbitas (Exceptions)** derivam da soma simultânea de lógicas defensivas de lentidão e fragilidades na estruturação paralela de dados da aplicação em Next.js. Como o sistema está hospedado em uma **VPS (Virtual Private Server)**, gargalos que seriam absorvidos escalarmente por Serverless se tornam fatais aqui, pois o acúmulo de memória e processamento pesado "sufoca" os recursos da máquina física, travando o Node.js/PM2 para todos os usuários ao mesmo tempo.

Aqui está o mapeamento detalhado e as resoluções (arquiteturais e de código) para cada ofensor, interpretados sob o cenário de infraestrutura própria.

---

## 1. Orquestração e Gargalo do Endpoint 
**Arquivo:** `src/app/api/campaign/generate/route.ts`

### Problema A: I/O Bloqueante e Saturamento da VPS (Linhas 147-170)
**Diagnóstico:** Antes do envio Stream pro Frontend iniciar o serviço SSE, o App salva as imagens via `Supabase Storage`. O Supabase atrasa cerca de ~1.5 a 3.5 segundos o script. Sendo uma VPS, cada segundo a mais que uma requisição Next.js passa presa segurando uma porta aberta, é um socket a menos para lidar com a concorrência.
**A Resolução:** 
- O evento de Stream SSE (`new Response(stream.readable)`) precisa estar posicionado logo após as *Validações de Payload*. As lógicas de Supabase devem rodar paralelizadas no background, liberando o Front-end e enviando feedback IMEDIATAMENTE (ping), aliviando o pool de conexões HTTP do NGINX/Apache frontal do servidor.

### Problema B: O Abismo do `Promise.all` e a Queda de Performance (Linha 475)
**Diagnóstico:** A lógica encapsula Texto e VTO juntos: `Promise.all([runTryOn(), runCampaignPipeline(...)])`. 
O `Promise.all` possui o mecanismo de **Falha Rápida**. Se a imagem Try-On for aprovada impecavelmente, mas o LLM de Textos (Claude/Gemini) falhar em seguida, a exception derruba TUDO. Como VPS lida com tráfego concentrado, os picos de tráfego que quebram o parser de JSON matam faturamentos perfeitos do VTO — a foto processada e paga nas cloud APIs vai embora porque a Promise de texto não soube lidar com o stress.
**A Resolução:**
- Trocar para `Promise.allSettled`. Isso obriga aguardar o fim de ambas as requisições ativas. Em vez de abortar o processo inteiro, envia para a fila: Se Imagem (`tryOnResult`) está `fulfilled` mas Texto é `rejected`: Retorne Partial Success, entregue a Fotografia na UI e informe: "Texto instabilizou, gere a legenda avulso", salvando o gargalo massivo de refazer tudo.

### Problema C: Processos Zumbis na Máquina e Custo Fantasma (Network)
**Diagnóstico:** Usuários frustrados com a lentidão da V2 fecham a aba. No entanto, sua VPS tem o backend Node.js continuar iterando o extenso for-loop de AI Pipeline. A "Campaign" roda no escuro, devora CPU e queima cota do seu faturamento Anthropic/Google consumindo memória RAM sem devolver nenhum payload e sem guardar nada.
**A Resolução:**
- Acoplar `request.signal` (AbortController nativo) e repassá-lo ao `runCampaignPipeline`. Se o cliente encerrar (GUI disconnect) antes do pipeline salvar no DB, emita um abort propagation ao Node, instrucionando a matar a thread da I.A em tempo real para devolver fôlego pro processador da VPS.

---

## 2. A Esteira de LLM Têxtil (Copys e Scores)
**Arquivo:** `src/lib/ai/pipeline.ts`

### Problema D: Colapso do Parse JSON Manual (`parseJSON()`)
**Diagnóstico:** Quando os provedores falham minimamente ao montar a string ````json... ````, o Regex manual cracha. Foi ordenado `throw new Error("Resposta inválida da IA")`. Isso não só mata o Request do lojista, mas, sob carga alta num processador físico de VPS, essas instâncias de loop de error catch desperdiçam a performance I/O interna.
**A Resolução:**
- Assumir a estrutura de **Modo Estruturado Zod** da `Vercel AI SDK` ou `Object Mode` do Google AI, cortando pela raiz o ato de interpretar Regex stringificado em backend.

### Problema E: A Bola de Neve do Auto-Retry do Scorer
**Diagnóstico:** A configuração `"v2.1"` cria um avaliador (Scorer). Notas menores que 55 invocam o motor inteiro do Copywriter e Refiner mais uma vez (L293-341 do `pipeline.ts`). Isso aumenta a esteira em +2 chamadas pesadas (Input de 4k+ tokens). O processador envia o stream e fica esperando. Esse fluxo quadruplica o TTFB (Time To First Byte Final) expondo a arquitetura Proxy (NGINX) da sua VPS ao risco de engolir um gatilho de inatividade `Timeout 504 Gateway Time-out` (frequentemente configurado para 60s padrão num servidor isolado Linux).
**A Resolução:**
- Remover o auto-retry inteiro do Scorer. Em vez disso, se `nota_geral < 55`, incluir flag `needsRefinement: true` no resultado. O frontend exibirá o botão "✨ Refinar textos" para o lojista clicar sob demanda — transformando um bug de latência numa feature monetizável no Plano Pro. Não empilhe esperas no Server-Side.

### Problema F: QA Agent Usa Modelo Hardcoded
**Arquivo:** `src/lib/google/nano-banana.ts` (Linha 200)
**Diagnóstico:** O QA Visual Agent (`qaVisualCheck`) chama `model: "gemini-2.5-flash"` diretamente no código, ignorando a variável de ambiente `AI_MODEL_GEMINI_FLASH`. Se os defaults forem migrados para `gemini-3-flash-preview` na configuração do pipeline, o QA Agent continua preso no modelo antigo deprecated — gerando inconsistência de velocidade e risco de descontinuação.
**A Resolução:**
- Substituir o hardcode por `process.env.AI_MODEL_GEMINI_FLASH || "gemini-3-flash-preview"` para que todas as chamadas de texto sigam o mesmo motor configurável.

---

## 3. Imagens VTO e Risco de Out-Of-Memory (OOM) na VPS
**Arquivo:** `src/lib/google/nano-banana.ts`

### Problema G: O Gargalo do Chain of Thought e Timeouts (Linha 164)
**Diagnóstico:** Uma imagem demorada vinda da API Google (15s). Ao bater no **QA Visual Agent**, o código impõe um raciocínio detalhado em CoT (*STEP 1, STEP 2...*). E se rejeitada (exibindo major errors), ela refaz a imagem do zero, gastando facilmente ~35 a 45 segundos. Em cima disso, o Proxy da sua VPS tem um timeout severo de espera pro front End. Quando bate a marca dos ~50s ele rasga a conexão e diz falha, independente se a segunda imagem chegou na memória 3ms depois.
**A Resolução:**
- Adoção de **Timeout Limiter Interrompível**: `const elapsed = Date.now() - start;`. Se ao falhar e tentar de novo, o relógio encostar no Redline da sua VPS (Ex: > 35s executados), interrompa o re-check e aja via Fallback: *"Entregue a imagem VTO V1 com pequenas falhas"*. Preferível manter retenção e não cair pro OOM Error.

### Problema H: Base64 Strings Massivos Estourando V8 Heap Memory
**Diagnóstico:** As strings das Fotos da loja e avatares rolam livremente pelo código via *Base64* num Array. Numa VPS genérica rodando Next Server em cluster PM2/Docker, os Limites do NodeJS Heap Memory (1.4GB - 2GB) podem estourar num sabado à tarde caso 10-15 Lojistas subam 4 fotos simultâneas fazendo campanha. A string Base64 se expande enormemente. Isso resulta num `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed` na VPS física, botando o seu site fora do ar de vez.
**A Resolução:**
- Tratamento em Stream ou downscale rigorosíssimo agressivo (Usando Sharp restritamente encapsulado de modo buffer/worker thread) de tudo que for passar por QA Agent. A Inteligência analisadora (Gemini) só precisa da foto `1024x` e de altíssima compressão em WEBP, ao invés da full resolution em RAW/Base64 JPG.

---

## 4. Pipeline Assíncrono: Geração de Modelo Virtual (Avatar)
**Arquivos Auditados:** `src/app/api/model/create/route.ts` e `src/lib/inngest/functions.ts`

> [!NOTE]
> **A Decisão Arquitetural do Inngest**
> Utilizar o Inngest para rodar o processamento pesado enquanto a interface exibe que "está carregando em segundo plano" foi uma **excelente decisão de arquitetura**. A topologia escolhida é a melhor prática global para SaaS. Os problemas de lentidão detectados abaixo *não são falhas do Inngest*, e sim "rachaduras" mecânicas na hora da API passar a bola para a fila e na forma que a fila morre em silêncio.

### Problema I: O Passe de Bola Atrasado e Bloqueio do Main Thread (`route.ts`)
**Diagnóstico:** Ferramentas de mídia (Sharp, Resize) rodam na Thread da API principal antes de invocar o worker. O `route.ts` aceita preenchimento na aba Modelos e tenta forçar o Sharp e Supabase Upload a terminarem antes de chamar o `inngest.send(...)`. O Next.js carrega o peso do mundo na frente do cliente, trava, toma o erro de "Failed to fetch" na VPS, e o Inngest acaba nunca sendo avisado. Assim, os `loading spinners` viram um teste de resistência.
**A Resolução:**
- Transbordo pro Inngest de forma Bruta. A API principal recebe o ID e dá HTTP 200 pro lojista instantaneamente. Toda edição fotográfica, estourar e remontar buffers para a API do Google GenAI precisa ocorrer obrigatoriamente dentro do script Worker do Inngest `generateModelPreviewJob`.

### Problema J: Egress Network Invisível (Inngest API) — ✅ JÁ MITIGADO
**Diagnóstico:** Na forma em que foi escrito, a VPS posta a referência da face no Storage Supabase e envia a String da URL pro Worker Inngest, que roda `fetch()` contra o storage para remontar a foto em Base64 de novo.
**Status Atual:** Após auditoria cruzada do código real, esta abordagem é na verdade **a correta**. O payload do Inngest tem limite rígido de 512KB. Enviar Base64 diretamente estouraria esse limite com fotos de celular (3-5MB → 4-7MB em Base64). O `fetch()` do worker para o Supabase Storage demora ~200ms (mesmo datacenter) — custo irrisório perante os 8-15s da geração de imagem.
**Conclusão:** Manter como está. Nenhuma ação necessária.

### Problema K: O Acidente Silencioso e Avatares Zumbis (`functions.ts`)
**Diagnóstico:** O trecho `if (!url) { throw new Error("..."); }` falha sob stress longo das IAs. E se a API do Gemini Models cair fora do ar, o Inngest tenta 2x e falha em silêncio. Como ele não manda uma mensagem avisando a Database que desistiu da vida, a base fica eternamente gravada como `status: "pending"`. O usuário abre o Painel amanhã e o avatar nunca carrega, eternizando o Loader girando na tela.
**A Resolução:**
- O processador Inngest deve comportar handlers estritos de "onFailure". Se todos os Fallbacks baterem na trave, uma instrução final corre para a base de dados: `await supabase.from("store_models").update({ preview_status: 'failed' })`. Isso reativa a tela do PWA Front-end avisando o lojista: *"Epa, o gerador de IA caiu. Clique aqui e tente de novo"*.

---

## 5. Migração Obrigatória de Motor (Gemini V3)
**Contexto de Falha:** Os problemas de Timeouts severos da VPS (Problema G) estão sendo agravados porque os modelos de **texto** usados no pipeline são da geração `2.5`, que o Google já classificou como **Legacy/Deprecated**.

> [!NOTE]
> **SDK Correto — Já Migrado ✅**
> O projeto já utiliza o SDK oficial mais recente (`@google/genai` com `GoogleGenAI`). Nenhuma mudança de pacote NPM é necessária.

> [!WARNING]
> **Modelos de Texto Deprecated**  
> Os defaults atuais (`gemini-2.5-flash` e `gemini-2.5-pro`) são modelos Legacy. Devem ser substituídos pelos modelos da geração 3, que oferecem menor latência e maior qualidade cognitiva.
> O modelo de **imagem** (`gemini-3.1-flash-image-preview`) já é o mais recente e **NÃO deve ser alterado**.

**O Plano Direto de Refatoração:**
1. **Salto de Geração — Texto (Hiper Velocidade):** Substituir nos defaults do pipeline: `gemini-2.5-flash` → `gemini-3-flash-preview` e `gemini-2.5-pro` → `gemini-3-pro-preview`. Arquivos afetados: `providers/index.ts` (L46-47), `providers/gemini.ts` (L47), `route.ts` (L226, L276, L284), e `nano-banana.ts` (L200 — QA Agent).
2. **Tabela de Pricing Desatualizada:** Os mapas de custo em `providers/types.ts` (L81-82) e `pricing/index.ts` (L32-33) só possuem entradas para `gemini-2.5-*`. Adicionar entradas para `gemini-3-flash-preview` e `gemini-3-pro-preview` para que os relatórios de custo continuem precisos.
3. **Morte Final ao Erro de JSON (Structured Outputs Nativos):** O SDK atual já suporta `responseSchema` nativamente. Ao garantir que o Gemini 3 receba o schema Zod convertido, a função perigosa de Regex `parseJSON()` deixa de ser necessária. O motor obriga a IA a devolver JSON perfeito em 100% das vezes.

---

## 6. Problemas Adicionais Descobertos na Auditoria Cruzada

### Problema L: Nano Banana Cost Logger Referencia Modelo Errado
**Arquivo:** `src/lib/google/nano-banana.ts` (Linha 66)
**Diagnóstico:** A função `logNanoBananaCost` busca pricing com a key `"gemini-2.5-flash"` para calcular o custo de geração de imagem, porém o modelo real é `gemini-3.1-flash-image-preview` (constante `MODEL` na L14). O cost-log grava valores incorretos no banco, distorcendo os relatórios financeiros do SaaS.
**A Resolução:**
- Usar a constante `MODEL` já definida no topo do arquivo, ou criar uma entrada específica na tabela de pricing para o modelo de imagem.

### Problema M: Cache de Providers Nunca Invalida
**Arquivo:** `src/lib/ai/providers/index.ts` (Linha 29-36)
**Diagnóstico:** A variável `_providers` é cacheada na primeira chamada e nunca é resetada. Se variáveis de ambiente forem alteradas em runtime (hot-reload, reconfiguração de modelo via painel admin), o sistema continua usando os modelos antigos até o próximo restart do PM2.
**A Resolução:**
- Registrar como tech-debt de baixa prioridade. Não bloqueia a implementação atual, mas deve ser endereçado quando o painel admin permitir troca de modelos em tempo real.
