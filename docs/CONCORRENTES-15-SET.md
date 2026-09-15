# Os concorrentes do AutoFluxos — o que eles vendem, e o que falta na gente

Levantamento de 15/set/2026. Cobre 8 plataformas internacionais em profundidade,
8 secundárias, e 20 brasileiras. Tudo conferido em página oficial, com URL. O que
não deu para conferir está marcado **não verificado** — e vale mais assim do que
um número bonito e errado.

Este documento não é fonte de verdade sobre preço: tabela muda. Serve para
responder uma pergunta só — **o que o mercado vende que a gente ainda não
vende?**

---

## 1. O mercado se divide em quatro famílias

Isso importa mais que a lista de recursos, porque define contra quem a gente
compete e quem acha o nosso preço caro.

**Criador / social-first** — ManyChat, Chatfuel. Vivem de Instagram e TikTok:
comentário vira DM, resposta de story vira lead. ManyChat tem os gatilhos nativos
mais completos do mercado (comentário em post *e* reel, resposta de story, menção
em story) e é a única com TikTok. Chatfuel se reposicionou para **agência** — "o
sistema que prova qual lead virou venda", com relatório automático para o cliente
renovar contrato.

**WhatsApp-first comercial** — Wati, Respond.io, Zoko, e no Brasil Botconversa,
Poli, Digisac, Nexloo. **É onde a gente está.**

**Suporte / helpdesk com IA** — Tidio (Lyro), Fin (ex-Intercom), Freshchat,
Octadesk. Vendem **resolução**, não ferramenta. A Fin cobra US$ 0,99 por resolução
e publica 76% de taxa média em 12 mil clientes.

**Infraestrutura** — Botpress, Twilio, Infobip, Gupshup, Z-API, Evolution API.
Vendem peça, não produto.

---

## 2. O que eles têm que a gente não tem

Filtrado pelo que aparece em **várias** plataformas — sinal de que o mercado
cobra, não de que é firula.

### 2.1 Templates da Meta — a lacuna número um

Todo mundo tem. Sem isso não existe retomada fora das 24h, nem disparo em massa,
nem lembrete de véspera. Botconversa, Poli, Blip, Zenvia, Wati, ManyChat,
Landbot, RD Conversas, Octadesk — todas vendem "disparo em massa" como item de
primeira linha.

Não é opinião: é o que trava três coisas que a gente **já tem meio construídas** —
`0027_campanhas` e `0031_sequencias` têm repositório completo e nenhuma tela, e
`src/exemplos/lembrete.ts` registra que o lembrete de véspera não sai sozinho.

Detalhe que a Landbot faz e vale copiar: **a campanha dispara um bot**, então o
disparo vira conversa de duas vias, não mensagem morta.

### 2.2 Acervo de conhecimento para a IA

Nosso bloco de IA responde dentro do contexto do negócio cadastrado em tela. O
padrão de mercado é subir um agente treinado em **documentos, site e FAQ**:

- **Respond.io** — RAG com sincronização contínua, sem retraining; aceita pdf,
  txt, md, csv, docx, pptx e imagens; liga/desliga fonte por agente.
- **Botpress** — PDF/HTML/TXT/DOC/DOCX/MD até 100 MB por arquivo, **crawl de site
  inteiro**, tabelas como conhecimento, sync por API.
- **ManyChat** — texto até 250 mil caracteres por entrada + links escaneados.
- **Tidio (Lyro)** — faz scraping automático do conteúdo de suporte do cliente.

A gente tem o agente. Falta o que ele lê.

### 2.3 Copiloto para o atendente humano

Padrão emergente, aparece em três plataformas sérias:

- **Octadesk (WOZ Copiloto)** — sugere resposta ao atendente em tempo real.
- **Blip Copilot** — copiloto baseado em dados e histórico.
- **Wati Copilot** — resumo em um clique de conversas de 50+ mensagens, tradução
  instantânea, e **AI CX Score** (avalia a qualidade da conversa sem enviar
  pesquisa).

A gente já tem a infraestrutura de IA e a política por ferramenta. É o item de
maior retorno por esforço depois dos templates.

### 2.4 Automação de Instagram (comment-to-DM, story reply)

É o motor comercial inteiro de ManyChat e Chatfuel. Nosso código está escrito,
testado e travado no Advanced Access da Meta (`canais.ts`, `disponivel: false`).

Aqui não estamos atrás em produto, estamos atrás em fila. Mas quando sair, o que
converte **não é "inbox de Instagram"** — é *comentário vira conversa*.

### 2.5 Pesquisa de satisfação (NPS / CSAT) com relatório

Digisac, Octadesk, Respond.io, Zenvia, Nexloo e Leadster têm nativo. A gente tem
modelo de fluxo de NPS, mas não o instrumento com relatório. É barato e fecha o
ciclo do painel.

### 2.6 Voz

Está virando padrão, não diferencial:

- **Respond.io** — atende chamada (WhatsApp + VoIP) em 30+ idiomas, extrai
  intenção, resume para o time.
- **Zenvia** — WhatsApp Calling pela conta oficial.
- **Poli** — VoIP de um clique.
- **Wati** — WhatsApp Business Calling.
- **Fin Voice** — preço sob consulta, acesso restrito.

Ver `docs/PESQUISA-VOZ-E-CHAMADA.md`.

### 2.7 App móvel

Digisac (nativo iOS/Android confirmado), Respond.io, Huggy, Octadesk, Nexloo.
Para dono de PME que atende do celular, isso pesa mais do que parece.

### 2.8 Catálogo e pagamento no chat

Zoko é uma empresa inteira sobre isso (catálogo Shopify dentro do WhatsApp). Poli
tem Poli Pay com link de pagamento. Landbot tem Stripe nativo. Wati tem commerce.
Se nosso cliente vende produto, falta.

### 2.9 Relatório para o cliente final

O truque do Chatfuel: a agência precisa provar ROI para renovar contrato. A gente
tem o painel da 4YU e as métricas — falta empacotar como entregável.

---

## 3. O que a gente tem e eles não

Vale saber, para não jogar fora numa corrida de recursos.

- **Fluxo que não publica sem caminho até humano.** Validador que recusa.
  Ninguém mais faz isso.
- **Versão publicada imutável, com histórico e rollback.**
- **Coexistência.** Blip Go e Chatfuel têm (Chatfuel desde mar/2025); Kommo
  aparentemente não. É vantagem real contra boa parte do mercado.
- **BYOK + política de IA por ferramenta** (leitura automática, escrita em
  `confirmar`). A Wati vende BYOA como diferencial premium; a gente já tem.
- **Estágio do contato pelos fatos**, não por formulário.
- **Funis encadeados** (SDR → vendedor → pós-venda). A Octadesk, que cobra
  R$ 2.499/mês, **não tem kanban** — a recomendação oficial deles é usar tags.
- **Fluxo compartilhável por link** com token, prazo e revogação.
- **Multi-cliente de verdade.** A Octadesk dá 1 número por plano.

### Pontos cegos do mercado (brechas reais)

- A **IA da ManyChat está em beta e só no Instagram.** A maior base de usuários do
  segmento tem IA capenga.
- A **Landbot não tem Instagram**, nem email, nem Shopify nativo.
- A **Tidio não tem WhatsApp documentado** — a página `/whatsapp/` responde 404.
- A **Chatfuel não consegue dizer quanto cobra**: três números conflitantes em
  páginas do próprio fornecedor (US$ 20/90, US$ 69/400, US$ 41).
- **Coexistência**: só a Chatfuel divulga há mais de um ano. É reconhecidamente
  caro de construir — e a gente já construiu.

---

## 4. Preço: três achados que mudam decisão

### 4.1 A unidade de cobrança é o campo de batalha, não o preço

Convivem **seis modelos incompatíveis**, e escolher a unidade é escolher o cliente:

| Unidade | Quem usa | Pune quem |
|---|---|---|
| Por assento/atendente | JivoChat (R$ 63–238), Umbler (R$ 99,90–219,90), Kommo (US$ 20–45) | equipe grande |
| Por contato ativo (MAC) | ManyChat, Wati, SleekFlow (R$ 259–1.499) | campanha |
| Por conversa / DAU | Octadesk (R$ 2.499–4.399), Blip, Nexloo (R$ 149–599), VTEX/Weni (R$ 1,20–1,90) | volume |
| Por cliente atendido | RD Conversas (R$ 989–2.699) — **atendentes ilimitados** | volume |
| Por instância/número | Z-API (R$ 99,99) | multi-número |
| Flat | SURI (R$ 270–290), Botconversa (R$ 189–199) | ninguém — e por isso tem teto |
| Por resolução | Fin (US$ 0,99), Tidio Premium | — |

**O topo do mercado brasileiro abandonou a cobrança por atendente.** RD Conversas
e Octadesk cobram por conversa com atendentes ilimitados. O andar de baixo
(Botconversa, Meets, Umbler) ainda cobra por assento ou flat.

A gente ainda não fixou a nossa. Essa decisão vem antes da tabela.

**O piso do mercado brasileiro é R$ 270–290/mês** — flat, **atendentes ilimitados**,
WhatsApp oficial com homologação sem custo. É a **SURI (Chatbot Maker**, Fortaleza/CE,
https://chatbotmaker.io/planos). Qualquer cobrança por atendente acima disso precisa
de justificativa boa. Abaixo desse piso só tem QR code (Botconversa R$ 189, Nexloo
R$ 149) — que é outra categoria de risco, não de preço.

**Detalhe que decide a conta no Brasil:** a Respond.io transformou *"broadcast não
conta como MAC"* em argumento de venda. Num mercado onde disparo em massa é **o**
caso de uso, a definição de quem conta como contato ativo importa mais que o preço
por unidade. Se a gente cobrar por contato e o disparo contar, a conta do cliente
explode no mês de campanha — que é justamente quando ele mais precisa da
ferramenta.

### 4.3.1 O corte de funcionalidade no plano de entrada

É onde mora a dor do cliente, e vale como aviso de como **não** montar a tabela:

- **Respond.io** — bot, broadcast, API e Zapier **só a partir de US$ 159**. O
  Starter (US$ 79) é inbox e mais nada.
- **ManyChat** — **sem WhatsApp** abaixo de US$ 39. Free e Essential não têm
  WhatsApp, SMS nem email.
- **Landbot** — WhatsApp é add-on de **+€100/mês**.
- **Tidio** — plano base, Lyro e Flows são **três faturas separadas**.

Quem entra barato descobre depois. É uma reclamação recorrente, e um espaço para
quem for honesto na tabela desde a primeira tela.

### 4.2 A linha oficial/não-oficial corta o mercado em dois preços

Não-oficial (QR code) fica em **R$ 99–150 flat com mensagem ilimitada**. Oficial
começa em ~R$ 259 e **ainda soma o custo de conversa da Meta por cima**.

Quem oferece QR code, verificado:

- **Botconversa Starter (R$ 189)** — a doc se chama literalmente
  `primeiros-passos-botconversa-api-nao-oficial`.
- **Digisac** — três modos na mesma plataforma (Cloud API, WABA, QR espelhado).
- **Nexloo** — a base de conhecimento ensina o QR code; a página do disparador
  confirma os dois métodos.
- **ChatGuru** — Web (QR), WABA e CoEx; tem até página de "aparelhos recomendados
  para usar como servidor".
- **Meets** — o cliente escolhe na criação da linha.
- **Z-API / Evolution / Baileys** — infraestrutura QR pura.

O ponto de equilíbrio: Z-API a R$ 99,99/mês com mensagem ilimitada empata com o
oficial em ~311 mensagens de marketing/mês ou ~2.857 de utilidade.

**O que o preço não mostra:** o ativo em risco não é a mensalidade, é o **número**,
que não volta depois de banido. Os termos da Meta são explícitos, a própria
biblioteca Baileys declara não ser autorizada e desencoraja disparo em massa, e há
issues documentando banimento imediato após escanear o QR.

**Consequência para nós:** somos oficial-only, somos mais caros, e isso precisa ser
**argumento de venda explícito** — "não tomamos ban" — não um detalhe técnico
escondido.

### 4.3 A IA é cobrada à parte em quase todas

Trengo €0,30/conversa · Freshchat US$ 49/100 sessões · Tidio US$ 0,50/conversa ·
Botpress US$ 0,10 embutido + AI Spend acumulável 12 meses · Landbot €0,10/chat de
IA (o dobro do chat normal) · Zoko US$ 24,99/mês · Chatfuel créditos em dólar
(US$ 20 e US$ 100/mês) · ChatGuru exige **chave própria da OpenAI do cliente**.

**A exceção que vale notar:** a Octadesk fez disso bandeira — o título da página de
preços é *"IA em Todos os Planos, Sem Taxas Extras"*. Quando a gente ligar a
transcrição automática e o agente, os dois caminhos têm precedente de mercado.

Mas registre o tamanho do padrão: **entre as internacionais que expõem preço, a IA
é linha de receita separada em 100% dos casos.** Embutir IA no plano é
posicionamento — e precisa de margem que aguente.

### 4.4 A fresta de preço entre "construir" e "comprar resultado"

Botpress cobra **US$ 0,50–0,65 por conversa** (plataforma de construção). A Fin
cobra **US$ 0,99 por resolução** — e **US$ 9,99 quando o outcome é qualificação de
lead**, dez vezes os outros três tipos.

Entre construir e comprar resultado há uma ordem de grandeza. É exatamente aí que
um produto brasileiro entra: **entregar resolução sem cobrar preço de resolução.**

E nenhuma das oito principais publica preço em real ou entende a conversa da Meta
pela ótica de quem paga em BRL. A Zenvia é a única — e é CX enterprise, não
automação self-serve.

---

## 5. White label: mais concorrido do que a fama sugere

Verificado, com marca e domínio próprios:

- **Z-PRO (ZDG)** — o único que **publica preço**: R$ 2.797/ano para revenda
  multi-tenant, subcontas ilimitadas, "o nome Z-PRO não aparece para o cliente
  final". Licença anual fixa, sem cobrança por usuário ou conexão.
- **Poli Digital** — white label empacotado como produto (marca, identidade,
  domínio, infra por conta deles). **Preço sob consulta.**
- **Meets CRM** — white label no plano Corporativo.
- **NotificaMe Hub** — é o **fornecedor por trás de white labels alheios**:
  Whazing e Z-PRO documentam "Hub NotificaMe" como fonte de canais.
- Cauda: Produtive.ai, ZapWork, ChatZapi, Chat Inteligente, WhatsLabel, BotAtende,
  WhatsCompany — **nenhum verificado em fonte primária**.

**Não têm white label** (verificado, contrariando a fama):

- **Botconversa** — nada no site nem no help center. O que circula é material de
  afiliado.
- **Kommo** — tem revenda com margem, mas **proíbe rebranding** explicitamente.
- **Chatguru** — só comissão: R$ 500/contrato ou até 20% do MRR. O cliente é deles.
- **Octadesk, Leadster, RD, Cliengo** — só programa de indicação com comissão.
  A Leadster chega a dar 20% de desconto **ao cliente**, não margem à agência.

**Open source, com pegadinha jurídica:** Chatwoot é MIT (permissivo, mas há uma
pasta `/enterprise` fora da MIT — conferir antes). **Typebot é Functional Source
License**, que tipicamente proíbe oferecer o produto como serviço concorrente —
exatamente o que uma revenda white label faz. Verificar antes de qualquer plano
nessa direção.

---

## 6. Movimentos de mercado registrados (2025–2026)

- **Tallos foi comprada pela RD Station** (R$ 6,7 mi) e virou **RD Station
  Conversas**. `tallos.com.br` redireciona. A RD é **BSP oficial da Meta**.
- **Weni (Ilhasoft) foi comprada pela VTEX** (set/2024) e virou **VTEX CX
  Platform**, cobrando R$ 1,20–1,90 por conversa. Deixou de ser concorrente de PME.
- **Movidesk foi absorvida pela Zenvia** → Zenvia Customer Cloud.
- **Intercom virou Fin** (`intercom.com/fin` → `fin.ai`), e a **Salesforce assinou
  compra por ~US$ 3,6 bi** (jun/2026, fecha no Q4 FY2027).
- **Botpress descontinuou o self-hosted** (v12 sunset) — virou Cloud-only.
- **ManyChat trocou o modelo de preço em 02/mar/2026** — 5 planos por Active
  Contacts com overage.
- **Meta passou a cobrar por mensagem** (não mais por conversa de 24h) desde
  01/jul/2025; **WABA em BRL** desde 01/jul/2026.
- **Sirena virou Zenvia Conversion.** **Zapping não existe** como plataforma de
  chatbot (é streaming de TV). **Nectar e Meets são empresas diferentes.**

---

## 7. O que eu faria, na ordem

1. **Templates da Meta.** Destrava disparo em massa, campanhas e sequências —
   três coisas já meio construídas, que todo concorrente vende. Maior retorno por
   esforço, disparado.
2. **Acervo de conhecimento para o bloco de IA.** O agente existe; falta o que ele lê.
3. **Copiloto para o atendente.** Infraestrutura de IA já está de pé.
4. **Terminar a ficha do lead** — item nº 1 de `HANDOFF-15-SET-CRM-FUNIL.md`,
   servidor pronto, tela faltando.
5. **NPS/CSAT com relatório.** Barato, fecha o ciclo do painel.

**Antes de tudo isso**, o alerta que atravessa os handoffs continua valendo:
mídia recebida, tique azul, reação, citação e gravação de áudio passaram por
typecheck, teste e build, e **nenhum passou por um celular real**
(`HANDOFF-15-SET-MIDIA-RECEBIDA.md`, §"O que ninguém provou"). Recurso novo não
conserta recurso não provado.

---

## 8. Ressalvas honestas deste levantamento

- Preços da **Wati em dólar** não saem da página oficial (geo-pricing renderizado
  no cliente). Os valores em INR estão confirmados.
- **Blip** não publica a mensalidade dos planos Plus e Super.
- **Digisac** não publica tabela nenhuma — a única âncora é "a partir de R$ 197"
  num post de blog; a página de planos responde 404.
- **ChatGuru** não publica valor em R$ de nenhum plano.
- **Leadster** só é transparente na menor faixa de tráfego.
- **manychat.com** bloqueia fetch automatizado (403); os dados vieram do help
  center oficial e de snippets indexados das próprias páginas.
- ⚠️ **O CUSTO POR MENSAGEM DA META NÃO ESTÁ CONFIÁVEL — E É A BASE DO NOSSO
  CUSTO.** A Meta não imprime a tabela em página nenhuma: serve CSV por moeda e
  uma calculadora dinâmica. Tudo que circula é estimativa de blog, e as fontes
  **se contradizem em 6×**:

  | Fonte | Marketing | Utilidade | Autenticação |
  |---|---|---|---|
  | api-wa.me / ominiflow | R$ 0,3217 | **R$ 0,0350** | **R$ 0,0350** |
  | socialhub.pro (mar/2026) | ~R$ 0,35 | **~R$ 0,21** | ~R$ 0,21 |
  | messagecentral | — | — | **R$ 0,15–0,19** |

  Divergem **6× em utilidade** e **5× em autenticação**. Não é arredondamento — é
  uma das fontes estar errada, e não há como saber qual (a socialhub admite que
  são "estimativas baseadas na cotação do dólar"). **Não use nenhuma dessas
  colunas para montar preço.**
  Se a gente precificar com utilidade a R$ 0,035 e o real for R$ 0,21, a margem
  desaparece.

  **Onde está o número certo:** Business Manager → WhatsApp Manager → Preços, ou
  o CSV linkado na doc da Meta. Meia hora de trabalho, e elimina o risco de um
  custo 6× errado na planilha.

  O que **está** confirmado na fonte primária: desde **01/jul/2025** a Meta cobra
  **por mensagem entregue** (não mais por conversa de 24h); rate card em **BRL**
  disponível desde 01/jul/2026; mensagem de **serviço é grátis**, e utilidade em
  resposta ao usuário também.
  → https://developers.facebook.com/docs/whatsapp/pricing
