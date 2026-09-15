# Plano: enriquecer o produto — 15/set/2026

Nasceu do levantamento de concorrentes (`CONCORRENTES-15-SET.md`). Não é lista de
desejos: é o que o mercado cobra e a gente não entrega, na ordem em que destrava
mais coisa.

**Próxima migration: 0059** (última é `0058_crm_funil.sql` — conferir com
`ls supabase/migrations/ | tail -1` antes de criar).

---

## Decisões tomadas nesta conversa

Ficam registradas porque não estão no código e custam caro se esquecidas.

**1. Cada cliente no portfólio dele da Meta — e não há alternativa.**
O modelo On-Behalf-Of **foi descontinuado**: *"The On-Behalf-Of WABA ownership
model is deprecated and is no longer possible."* Pelo Embedded Signup — que é o
que a gente já usa — a WABA **nasce no portfólio do cliente**, compartilhada com
até dois parceiros. Não é escolha, é o único caminho.

E se fosse: *"You cannot migrate a WABA from one business to another"* (sem
conserto), e *"one number can consume all of the portfolio's messaging
capability"* (um cliente seca a cota dos outros). A conta é simples: 5.000/dia
divididos por 50 clientes = 100 cada, com o degrau seguinte em 100 mil e
exigindo qualidade alta em **todos** os números. Um cliente ruim trava os 50.

**O que continua sendo decisão nossa:** nunca misturar número da 4YU com número
de cliente no mesmo portfólio — ali o teto é um só.

Vira argumento comercial: *"a conta é sua, o número é seu, você sai quando quiser."*

**2. Verificação de empresa NÃO é obrigatória — onboarding é de 5 minutos.**
Foi o maior achado desta conversa, e derruba o atrito que parecia inevitável.

Sem verificar nada, para sempre:
- **250 conversas iniciadas pela empresa por dia** (não são "as 250 primeiras" —
  é a cota diária, renovável)
- **responder quem chamou primeiro: ilimitado**, não conta no teto

O segundo ponto muda o desenho do produto: operação de atendimento (o caso da
Alders — consultores respondendo quem chamou) **nunca esbarra no limite**.

Dá para subir de 250 → 2.000 **sem verificar**, entregando 2.000 mensagens de
template com qualidade alta em 30 dias.

Verificar serve para: nome da empresa aparecer na conversa (sem isso aparece só
o número), passar de 2 números, e selo verde. **É upsell disparado por limite,
não portão de entrada.** É o que o Botconversa faz — a aula de conexão deles
pede só número ativo e acesso ao Gerenciador, zero documento.

- No onboarding, pedir razão social, endereço e site HTTPS **antes** do signup —
  preenche o Business Info e evita a restrição automática pós-signup. É um
  formulário, não burocracia.
- **A 4YU precisa** de Business Verification + App Review + Access Verification
  — uma vez só, não por cliente. Rende cota de 200 clientes novos a cada 7 dias.
- PLBV (verificação conduzida pelo parceiro) exige tier Select/Premier e parece
  pausado desde jan/2026. Não construir produto em cima disso.

**3. Somos oficial-only, e isso é argumento de venda.**
Metade do mercado brasileiro vende WhatsApp por QR code (Botconversa R$ 189,
Nexloo R$ 149, Digisac, ChatGuru). É mais barato porque não paga a Meta — e o
número pode ser banido sem volta. A própria Z-API documenta shadowban. Não
esconder que somos mais caros: dizer por quê.

**4. Preço em real, conta honesta.**
Nenhuma das oito internacionais grandes cobra em BRL. E o padrão do mercado é
trancar o essencial no plano de cima (Respond.io sem bot abaixo de US$ 159,
ManyChat sem WhatsApp abaixo de US$ 39, Tidio com três faturas). Não fazer isso.

**5. Fora do escopo:** voz, app móvel, white label.
White label foi descartado com razão: ninguém usa o RD Station fingindo que é
da empresa dele.

---

## Fase 1 — Templates da Meta e disparo em massa

**Por que primeiro:** destrava disparo em massa, campanha, lembrete de véspera e
tira o teto de 24h das sequências (`0031` nasceu com `atraso_minutos ≤ 1440` por
causa dessa ausência). É o buraco que todo concorrente preenche.

**O que existe:** `src/channels/janela.ts` (janela de 24h, completo),
`mensagens-agendadas` (fila 1-para-1, completo), `sequencias` (completo).
**O que não existe:** a interface `Canal` não tem `enviarTemplate`. Nada de
template no código. Transmissão em massa não existe.

### 1.1 Cadastro e sincronização de templates
- Migration `0059_templates_da_meta.sql`: tabela `templates` por cliente
  (`waba_template_id`, `nome`, `categoria`, `idioma`, `componentes jsonb`,
  `status`, `quality_score`, `motivo_recusa`, `atualizado_em`).
  Um template lógico tem **ID diferente por WABA** — a chave é (cliente, nome).
- `POST /{waba-id}/message_templates` para criar; `GET` para reconciliar.
- Webhook `message_template_status_update` → atualiza status. O campo
  `rejection_info` traz explicação acionável quando o motivo é `INVALID_FORMAT`:
  **repassar literalmente para a tela**, é a melhor informação que a Meta dá.
- **Reconciliação noturna** por `GET`: webhook perdido é questão de quando, não
  de se. Sem isso, template fica preso em "pendente" para sempre na nossa tela.

### 1.2 Enviar template
- `enviarTemplate` na interface `Canal` (`src/channels/types.ts`) e no adaptador
  Cloud API.
- Mídia no header por **media ID**, não por link (ID vale 30 dias; link expõe
  nosso servidor a milhares de fetches e o cache da Meta é de só 10 minutos).
- **Gravar `message_status` da resposta**, não só o `wamid`. Três valores:
  `accepted`, `held_for_quality_assessment`, `paused`.

### 1.3 A armadilha do pacing — tratar desde o início
Confirmado atual (doc atualizada em 21/mai/2026). A Meta **segura** mensagens de
template novo, template sem nota verde, e — desde 2026 — **de portfólio novo com
pouco histórico** (`business-portfolio-pacing`). Se o feedback for ruim, o
template é pausado e **cada mensagem retida é descartada**, com webhook
`messages` `status: failed`, `code: 132015`.

Não é silencioso — **mas só quem escuta o webhook fica sabendo.** Se olharmos só
o 200 do POST, mostramos "campanha enviada" e nada saiu.

- Estado da mensagem na campanha: `aceita | retida | entregue | lida | falhou`.
  `retida` ≠ enviada. A tela tem que dizer isso.
- Tratar `132015` como "template pausado", não como falha genérica.
- **Consequência de produto:** cliente novo vai apanhar disso mesmo fazendo tudo
  certo. Não prometer campanha grande na primeira semana.

### 1.4 Limites e fila
- Escada: **250 → 2.000 → 10.000 → 100.000 → ilimitado**, por destinatário único
  em 24h. Sobe em 6h se a qualidade estiver alta **e** o cliente tiver usado
  **pelo menos 50% do limite nos últimos 7 dias**. Quem dispara pouco fica preso.
  Mostrar isso na tela do cliente — é informação de produto, não detalhe técnico.
- Throughput: 80 mps padrão, **20 mps em coexistência** (relevante: é o nosso
  caminho principal).
- Fila com rate limiter **por `phone_number_id`**, não global. Começar em 20–40
  mps — throughput conta entrada + saída, e o inbound do cliente compete.
- Checar o limite de 24h **antes** de enfileirar: campanha de 5.000 com tier
  2.000 fatia em 3 dias. Estourar queima nota à toa.
- Política de retry por classe de erro, sem misturar:
  - `130429`, `80007`, `131057` → transitório, backoff com jitter
  - `131026` → terminal para aquele contato, marcar inválido, **nunca** repetir
  - `131049` → limite por usuário, esperar **24h** (repetir antes suspende o
    destinatário por 24h)
  - `132000`, `132012` → bug nosso (payload errado), **não** vai para retry

### 1.5 Opt-in e opt-out
Exigência da Meta e da LGPD. Desde nov/2024 o opt-in **pode ser genérico** (não
precisa mencionar WhatsApp), desde que cumpra a lei.
- Registrar: telefone E.164, timestamp com timezone, canal de coleta, **o texto
  exato exibido** (versionado — ele muda), cliente, origem.
  Sem o texto versionado temos um booleano, não uma prova. LGPD cobra prova.
- Opt-out **por categoria**, não só "parar tudo" (a Meta pede "specific
  categories"). Quick reply de "não quero promoções" no template de marketing,
  honrado antes do próximo disparo.

### 1.6 Tela
- Lista de templates com status, nota e motivo de recusa em português.
- Criar template (com validação que evita as armadilhas: 4+ botões ou quick
  reply misturado com outro tipo **somem no WhatsApp Desktop**).
- Nova transmissão: escolher template, público (filtro de contatos), pré-visualizar
  contagem, agendar. Progresso com os cinco estados de 1.3.
- **Verificar** se o código lê `messaging_limit_tier` (deprecado) ou
  `whatsapp_business_manager_messaging_limit`. Também: `max_daily_conversation_per_phone`
  virou `max_daily_conversations_per_business` em v24.0 — o prazo já passou.

---

## Fase 2 — IA que lê documento (base de conhecimento)

**Por que:** a nossa IA só sabe o que está digitado num textarea
(`clients.contexto_negocio`). O mercado inteiro treina em documento: Respond.io
sincroniza continuamente, Botpress aceita 100MB e faz crawl de site, Tidio faz
scraping do suporte do cliente.

**O que existe:** o acervo (`src/server/repos/acervo.ts`) **já aceita PDF**, já
tem upload direto ao Storage por URL assinada, bucket público. Nada lê o conteúdo.
**O que não existe:** embeddings, chunking, busca semântica. Zero — nem a extensão
`vector` está instalada.

**O encaixe barato:** `src/core/ferramentas.ts` já tem whitelist de function
calling por nó no bloco `ia`. Uma ferramenta `buscar_na_base` entra ali **sem
tocar no resolver**.

- Migration `0060`: extensão `vector`, tabela `base_conhecimento_chunks`
  (`cliente_id`, `origem`, `texto`, `embedding vector`, `metadados`).
- Extrair texto de PDF e de página web; chunking com sobreposição.
- Gerar embedding (Gemini) na ingestão; busca por similaridade na consulta.
- Ferramenta `buscar_na_base` no catálogo de `ferramentas.ts`.
- Tela: subir documento / colar URL, ver o que foi indexado, reindexar, apagar.
- **Respeitar a política de IA que já existe** (`src/server/ia/politica.ts`) e
  logar em `ia-chamadas`.

---

## Fase 3 — Copiloto para o atendente

**Por que:** aparece em Octadesk, Blip e Wati. É padrão emergente, e a gente já
tem toda a infraestrutura.

**O molde a copiar:** `src/server/acoes-transcricao.ts` + `messages.transcricao`
fazem exatamente o caminho certo — ação sob demanda → Gemini → resultado
guardado na linha → não repete. **Repetir esse padrão, não inventar outro.**

- **Sugerir resposta**: botão no Inbox → lê a conversa (`lerConversa`) + contexto
  do negócio + base de conhecimento (fase 2) → devolve rascunho editável.
  O atendente sempre edita antes de enviar — nunca envia sozinho.
- **Resumir conversa longa**: para quem assume um atendimento no meio.
- Sob demanda, nunca automático (a chave é free tier da 4YU).
- Guardar o resultado para não regerar.

---

## Fase 4 — Pesquisa de satisfação (NPS/CSAT)

**Por que:** Digisac, Octadesk, Respond.io, Zenvia, Nexloo e Leadster têm.
A gente tem o fluxo de exemplo (`src/exemplos/pesquisa-nps.ts`) funcionando hoje,
mas a nota cai em `contacts.campos` (JSONB, sem data, sobrescrita na segunda
resposta). **Dá para perguntar, não dá para ter o número.**

**Ordem correta — o armazenamento vem antes da tela:**

1. Migration `0061`: tabela `avaliacoes` (`cliente_id`, `contato_id`, `nota`,
   `comentario`, `origem: fluxo|atendimento`, `atendente_id`, `criada_em`).
   Histórico de verdade — a segunda resposta não apaga a primeira.
2. **Bloco `nps` no editor** — um bloco só na barra da esquerda, no lugar dos
   cinco atuais. Grava em `avaliacoes`, não em `campos`.
3. **Disparo fora da automação:** quando o atendente clica em "resolver" no
   Inbox, a pesquisa sai sozinha (opcional por cliente).
4. Cálculo de NPS (% promotores − % detratores) e CSAT, pendurado em
   `src/server/repos/metricas.ts`, que já tem série diária.

---

## Fase 5 — Catálogo e venda no chat

**Por que:** foi o item que mais interessou. E resolve o problema da Alders
("como sabemos que o consultor vendeu?") — **se a venda passa pela ferramenta, o
relatório se escreve sozinho.**

**A verdade sobre "pagar sem sair do WhatsApp": não existe.** A Meta tem
Payments API para o Brasil (`payment_type: "br"`, Pix, boleto, link), mas ela
**não processa dinheiro** — desenha o card do pedido. A própria doc: *"WhatsApp
does NOT support payment reconciliations."* Quem anuncia "checkout nativo" está
descrevendo esse card. Não vender essa promessa.

**O que dá para entregar, e já é bem melhor que link solto:**

### 5.0 TESTE ANTES DE TUDO — coexistência
A doc da Meta lista **"business tools (catalog, orders, status)"** como **não
suportado** em coexistência. Coexistência é o nosso caminho principal.

A doc é ambígua: não dá para saber se o catálogo some, se só as ferramentas do
app param, ou se as mensagens de produto pela API continuam. **Testar num número
real** (`is_catalog_visible` + mandar uma Single Product Message) **antes de
prometer catálogo para qualquer cliente.** Mesma lição do `health_status mente`:
o console não é evidência.

Se não funcionar em coexistência, catálogo vira recurso só para número novo — e
isso muda a proposta comercial.

### 5.1 Catálogo
- É **o mesmo catálogo** do app do celular (um por WABA, mesmo `catalog_id`).
  Cliente que já montou no celular **não recadastra nada** — a gente lê o dele.
- Sincronizar produto: Commerce API (`items_batch`) ou feed agendado.
- Origem: API + webhook do e-commerce (Nuvemshop e Shopify têm boa API; Bling
  também). Planilha só para quem não tem loja.
- Bloco novo no editor: **enviar produto** (Single Product) e **enviar vitrine**
  (Multi-Product, até 30 itens em seções).
- No Inbox: botão "enviar produto" para o atendente escolher e mandar.

### 5.2 Pedido e Pix
- Gateway: **Asaas** (cria cobrança → `GET /payments/{id}/pixQrCode` devolve o
  copia-e-cola pronto) ou **Mercado Pago** (uma chamada, devolve `qr_code`).
  Credencial do cliente no Vault, como as outras.
- `order_details` com `pix_dynamic_code` → card de pedido nativo na conversa.
- Webhook do gateway → `order_status` → pedido vira "pago" na conversa.
- **`reference_id` é a costura** entre pedido e cobrança. É nossa
  responsabilidade — a Meta não concilia. Encaixa na fronteira do dado: estado
  de execução é nosso, o dinheiro fica no gateway do cliente.

### 5.3 O que isso resolve de graça
Venda registrada sem ninguém anotar: produto, valor, data, contato, atendente.
Alimenta o funil (`negociacoes`) e o relatório automaticamente.

---

## Fase 6 — Relatórios

**Por que:** a agência precisa provar resultado para renovar contrato (é o
produto inteiro do Chatfuel). E hoje as métricas estão espalhadas dentro de
outras telas — não existe rota `/relatorios`.

**O que existe:** `src/server/repos/metricas.ts` é rico (funil mensal, execuções
por fluxo, tempos, série diária, desempenho por pessoa) e `painel.ts` tem fila e
fechamentos. Falta a tela.

- Rota `/clientes/[clienteId]/relatorios`, reunindo o que já existe.
- Acrescentar: satisfação (fase 4), campanhas (fase 1), vendas (fase 5).
- Exportar PDF/CSV com a marca do cliente — é o que a agência entrega.
- Período comparável (mês a mês), não só o mês corrente.

---

## Fase 7 — Telegram

**Por que agora é barato:** `src/core/canais.ts` **já tem o Telegram desenhado**,
com os limites dele alimentando o `validar()`. Falta só o adaptador. A tela de
integrações já existe e já o lista como "em breve".

- Adaptador implementando `Canal` (`src/channels/types.ts`): `enviarTexto`,
  `enviarOpcoes` (teclado inline), `enviarMidia`, `aguardarResposta`, `reagir`.
- `disponivel: true` em `canais.ts`.
- Sem janela de 24h, sem template, sem aprovação — muito mais simples que o
  WhatsApp.
- **Sem catálogo e sem Pix nativo.** Vitrine no Telegram, se um dia, é desenhada
  na mão com inline keyboard.

---

## Pendências registradas, fora deste plano

**Permissionamento** — hoje um consultor consegue apagar um fluxo. Não há papel
de gestor vs. atendente dentro da conta. É furo real; entra depois destas fases,
mas antes de vender para empresa com equipe grande.

**Instagram** — código pronto (`disponivel: false`), travado no Advanced Access
da Meta. Não é trabalho nosso, é fila. Quando sair, o que converte é
*comentário vira conversa*, não "inbox de Instagram".

**O custo real da Meta** — as fontes públicas divergem **6× em utilidade** e **5×
em autenticação**. O único número confiável está em Business Manager → WhatsApp
Manager → Preços. **Conferir antes de montar qualquer tabela de preço.**

**Provar no celular** — mídia recebida, tique azul, reação, citação e gravação de
áudio passaram por typecheck, teste e build, e **nenhum passou por um aparelho
real** (`HANDOFF-15-SET-MIDIA-RECEBIDA.md`). Recurso novo não conserta recurso
não provado.
