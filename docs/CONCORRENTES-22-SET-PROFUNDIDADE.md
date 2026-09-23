# Cinco concorrentes por dentro: o que a documentação deles diz

Levantamento de 22/set/2026. Cobre **BotConversa, ChatGuru, Kommo, ManyChat e
Leadster** — não pela landing page, mas pela central de ajuda, pela referência de
API e pelo Reclame Aqui. Mais a **Payments API do WhatsApp** e a comparação dos
**PSPs brasileiros de Pix**.

Complementa `CONCORRENTES-15-SET.md`, que cobriu 36 ferramentas em largura. Este
aqui é o oposto: cinco, fundo, com a pergunta de sempre — **o que eles vendem que
a gente não vende, e o que eles prometem e não entregam?**

Regra do documento: cada afirmação diz de onde veio. **Doc oficial** é central de
ajuda ou referência de API. **Marketing** é landing page. Quando os dois
divergem, o doc oficial ganha e a divergência fica registrada, porque a
divergência **é** o achado.

Preço muda. Este documento não é fonte de verdade sobre preço; é fonte sobre
**funcionalidade e sobre o que está escondido no preço**.

---

## O achado que organiza tudo

Das cinco ferramentas, **uma só tem pagamento no chat que funciona no Brasil**: a
Kommo. As outras quatro, incluindo as três brasileiras, param na mesma porta.

E param pelo mesmo motivo: o contorno que oferecem é **montar requisição REST na
mão** dentro de um bloco de HTTP genérico. Gerar API key, montar header de
autenticação, criar cliente, capturar o ID numa variável, montar a segunda
requisição para gerar a cobrança.

O cliente-alvo delas é dono de clínica, de salão, de estúdio. **Esse cara não vai
montar header de autenticação.** O recurso existe no papel e é inacessível na
prática para quem paga a conta.

Isso é o buraco do mercado brasileiro, e é o buraco que a gente tem chance de
tapar — porque o nó `http` já existe aqui, e transformá-lo num bloco "Cobrar" que
o dono configura uma vez em Ajustes é trabalho de produto, não de infraestrutura.

---

## Tabela de decisão

| | Pagamento no chat | E-mail | Multicanal | Preço público | Cobra por atendente |
|---|---|---|---|---|---|
| **BotConversa** | ❌ webhook na mão (Asaas) | ❌ só aviso interno | ❌ só WhatsApp | ✅ (bagunçado) | Starter sim (5), Pro não |
| **ChatGuru** | ❌ integração Asaas, é régua de cobrança | ❌ inexistente | ❌ só WhatsApp | ❌ | ✅ é o eixo do preço |
| **Kommo** | ✅ **nativo, Mercado Pago, move o funil** | ⚠️ IMAP/SMTP, não é campanha | ✅ 11+ canais | ✅ | ✅ por assento |
| **ManyChat** | ⚠️ existe, **não no WhatsApp**, sem BRL, sem Pix | ✅ canal real, mas cego no inbox | ✅ | ✅ | não, por contato ativo |
| **Leadster** | ❌ ausência estrutural | ❌ só notificação de lead | ❌ site + WhatsApp | ❌ | não, por visitas do site |
| **AutoFluxos** | ❌ | ❌ (Web Push no lugar) | ✅ IG travado na fila da Meta | ✅ | ❌ ilimitados |

Leitura em uma linha: **e-mail marketing não existe em lugar nenhum**, pagamento
só na Kommo, e os três brasileiros são monocanal.

---

# BotConversa

O concorrente de volume e a âncora de preço do mercado: **45 mil clientes
declarados**, R$ 189–199/mês.

## O que tem, confirmado em doc

Fluxo visual (blocos: inicial, conteúdo, ação, conexão de fluxo, condicional),
transmissões, sequências drip, palavras-chave, campanhas com link e QR Code de
WhatsApp, etiquetas, campos personalizados, importação de contatos, bate-papo ao
vivo multi-atendente, respostas rápidas, bloco de integração HTTP, webhook de
entrada, **app mobile nativo** (iOS e Android, confirmado nas lojas).

API pública existe, **só no plano Pro**.

## O que NÃO tem

Catálogo, carrinho, pagamento, e-mail, SMS, white label. **Monocanal: só
WhatsApp** — o menu inteiro da central de ajuda é WhatsApp, e a home também. Um
blog de terceiro afirma "Messenger e Instagram Direct", o que **não aparece em
nenhuma documentação oficial**. Tratado como falso ou legado morto.

White label: não é oficial. O que circula é material de afiliado, e há
concorrentes (Zaapy, ChatLabel, ZapWork) vendendo white label **contra** ele.
Achei até freelancer no 99Freelas pedindo "auxílio com white label - bot
conversa", que é sinal de gambiarra de terceiro.

## "+50 integrações" é contagem de webhook

A home lista ChatGPT, Claude, Gemini, Google Ads, Facebook Ads, ActiveCampaign,
Hotmart, HubSpot, Salesforce, Bitrix24, RD Station, Shopify, Eduzz, VTEX,
Nuvemshop, Mercado Livre, Asaas, Google Calendar, Zapier, Webhook.

**A documentação tem 12 tutoriais**: Hotmart, Asaas, ActiveCampaign, Eduzz,
Google Sheets, Calendly, OlaClick, WooCommerce, Elementor, RDStation, Cloudinary,
Trello.

E a própria doc entrega o jogo: *"basicamente, qualquer software que tenha
compatibilidade com API/Webhook é compatível com o BotConversa"*. HubSpot,
Salesforce, Shopify, VTEX, Mercado Livre e Bitrix24 aparecem só na landing, sem
tutorial. **Isso é vitrine.**

## Pagamento: não existe, e o contorno é caro

A integração documentada com o **Asaas** é explicitamente não nativa. A doc diz
textualmente que *"usaremos a ferramenta de API do BotConversa"* e exige plano
PRO. O passo a passo: gerar API Key no Asaas → criar cliente via requisição HTTP
montada à mão → configurar headers de autenticação → escolher ambiente
(asaas.com ou sandbox) → capturar o ID retornado numa variável → montar outra
requisição para gerar a cobrança.

**Não há bloco "Gerar Pix". Há um bloco de HTTP genérico e um tutorial ensinando
a chamar a API do Asaas com ele.** Mercado Pago, Stripe, PagSeguro: nenhum
tutorial, nenhuma menção.

O que a doc chama de "receber pagamentos" é **webhook de notificação** —
Hotmart, Kiwify e Eduzz avisam que uma compra ocorreu e o fluxo dispara. Isso é
pós-pagamento. O checkout aconteceu fora.

**Armadilha de leitura:** "Pix" aparece com destaque na home, mas é a forma de
**você pagar a assinatura deles**, não de cobrar seu cliente.

## E-mail: a única menção em toda a doc é aviso de equipe

A página "como notificar sua equipe" diz que administradores podem ser avisados
"por EMAIL ou por WHATSAPP" quando cai um atendimento. É alerta operacional.
Sem lista, template, editor, campanha, métrica, domínio de envio. **Nem vitrine
é.** A saída documentada é integrar ActiveCampaign ou RD Station.

## Preço, e o custo escondido

Site oficial (verificado por review independente em 13/09/2026):
- **Starter R$ 189/mês** no anual — 1.000 contatos, 5 membros, **sem API
  Oficial, sem IA**
- **Pro R$ 199/mês** no anual — contatos ilimitados, atendentes ilimitados, API
  Oficial Meta, assistente GPT, Integrador, CRM Kanban

Vitrines de afiliado mostram preços diferentes da mesma marca: botconversa.chat
tem Starter mensal R$ 199 e Pro mensal R$ 297; lp.botconversa.com.br tem pacotes
de R$ 219,90 a R$ 699,90. `botconversa.com.br/precos` e `/planos` dão **404** — o
preço vive na home e em vitrines de afiliado, com valores divergentes.

**O custo escondido, e é o relevante:** crédito de template da Meta **não vem no
plano e não renova**. Recarga a **R$ 0,50 por mensagem de marketing** e **R$ 0,05
por utility**, com mínimo. Comparado ao custo real da Meta no Brasil (marketing
~R$ 0,38), isso é markup relevante — e é exatamente o que o `PLANO-16-SET`
posiciona contra, ao decidir repasse a custo em linha visível.

Também há cobrança extra por WhatsApp adicional na mesma conta, apontada como não
transparente por review.

## Reputação

**Reclame Aqui 6,6/10 "Regular"**, 50 reclamações (mar–ago/2026), 96%
respondidas, 64,3% resolvidas, **tempo médio de resposta ~38 dias**. Temas:
cobrança após cancelamento, cancelamento difícil, produto que não funciona.
Reviews citam instabilidade em datas críticas (Black Friday).

## Fontes

Oficiais: [home](https://botconversa.com.br/) ·
[central de ajuda](https://ajuda.botconversa.com.br/funcionalidades-gerais-botconversa/visao-geral-botconversa) ·
[índice GitBook](https://botconversa.gitbook.io/bem-vindo-ao-botconversa/llms.txt) ·
[bloco de integração](https://botconversa.gitbook.io/bem-vindo-ao-botconversa/integracoes/api-botconversa/bloco-de-integracao) ·
[integração Asaas](https://botconversa.gitbook.io/bem-vindo-ao-botconversa/integracoes/ferramentas-online/asaas) ·
[ferramentas online (as 12 reais)](https://botconversa.gitbook.io/bem-vindo-ao-botconversa/integracoes/ferramentas-online)

Independentes: [Tudo pra Whats](https://tudoprawhats.com.br/botconversa) ·
[AI Hub Brasil](https://botaihub.com.br/ferramentas/botconversa/) ·
[Reclame Aqui](https://www.reclameaqui.com.br/empresa/botconversa/)

---

# ChatGuru

Nichado em jurídico e saúde. Preço não publicado.

## O diferencial real: três modos de número

WhatsApp Web (não oficial), **API Oficial Meta (WABA)** e **CoEx
(coexistência)**. Esse é o diferencial declarado deles — e é **empate** com a
gente, não desvantagem. (Ressalva nossa: ver a memória de que coexistência nunca
entregou de fato do nosso lado.)

## O que tem, da página oficial de planos

NPS embutido, menu de atendimento (URA), etiquetas, **rodízio básico e
avançado**, departamentos, funis, filtros, anotações internas, histórico,
biblioteca de arquivos, campos personalizados, importação de até **10.000
contatos**, mensagem agendada, **modo espião**, **mapa de calor**,
**carteirização de clientes**.

## O que NÃO tem

Catálogo, carrinho, checkout. E-mail (**zero menção em qualquer fonte**). SMS.
White label (a página de parcerias só tem Guru Indica R$ 500/contrato, Parceiro
Estratégico até 20% do MRR, e Revendedor — todos com a marca deles visível).
App mobile: **não confirmado em nenhuma fonte**; tratar como inexistente.

**Multicanal: praticamente inexistente.** Instagram aparece só como ecossistema
Meta, sem módulo de atendimento. Telegram, Messenger, webchat: zero menção.
Reviews independentes tratam como **WhatsApp-only**.

## IA: fraca e periférica

O que está na página de planos é **resumo de chat por IA** e **transcrição de
áudio**, a partir do plano Performance. **Não há agente conversacional, não há
ChatGPT integrado, não há base de conhecimento com RAG.** Os "fluxos prontos"
vendidos na home são árvores de decisão.

Comparação direta: a gente tem agente de IA com function calling e cinco
ferramentas de agenda. **Estamos à frente aqui.**

## Disparo em massa: existe no papel, frustra na prática

Campanhas com listas segmentadas, agendamento e métricas. Limite declarado de
**3 envios por segundo** mais limite diário. E há reclamação pública no Reclame
Aqui intitulada literalmente *"ChatGuru não permite eu fazer disparo em massa"*.

## Pagamento: Asaas de novo, e é régua de cobrança

O blog deles separa as responsabilidades sem rodeio:
- **Asaas faz**: criar a cobrança, gerar link/boleto/Pix, identificar o status
- **ChatGuru faz**: mandar a mensagem, personalizar, agendar lembrete, rotear

**Pix nativo: não.** Catálogo do WhatsApp, carrinho, WhatsApp Pay: não. Mercado
Pago, PagSeguro, Stripe, Pagar.me: nenhum nativo.

O caso de uso real é **régua de inadimplência** — "avisar que venceu", não
"vender e receber". Essa distinção importa: ninguém no mercado brasileiro está
fechando venda dentro do chat.

**Falso positivo a evitar em busca:** "Digital Manager Guru" tem integração Asaas
com checkout e **não é o ChatGuru**. Empresas diferentes, nomes parecidos, e
vários resultados de busca misturam as duas.

## API: módulo pago, precisa ser liberado

Operações: enviar mensagem, anotação, atualizar contexto e campos, renomear chat,
cadastrar chat, enviar arquivo, executar diálogo, consultar status. **Não há
endpoint de pagamento, catálogo, e-mail, SMS nem campanha em massa.** Precisa
pedir ativação, só ADMIN acessa, e é vendida como módulo separado.

Zapier/Make/n8n **não são oficiais**: existe conector no Make e um community node
no n8n feito por terceiro.

## Integrações nativas: curtas e nichadas

Asaas (cobrança), **Projuris e Advbox (jurídico)**, ZapSign (assinatura digital),
**Feegow (saúde)**, Google Sheets, Google Calendar, RD Station, Monday, Zenvia.
Pipedrive, Bitrix, HubSpot: não aparecem.

## Preço: não é público, e isso é explícito

| Plano | Usuários | Números | Departamentos |
|---|---|---|---|
| Essencial | a partir de 2 | 1 | sem segmentação |
| Performance | a partir de 5 | 1 | 3 |
| Profissional | a partir de 10 | **2** | ilimitados |

**O eixo do preço é número de atendentes.** Estimativa de mercado (não oficial):
**~R$ 692/mês** para 1 usuário + 1 número, mais **R$ 500 de setup**. Taxas da
Meta à parte. Sem trial gratuito divulgado.

Contraste com a nossa decisão: atendentes ilimitados, setup zero.

## Reputação: dados que se contradizem

Uma medição aponta **5,8/10 com 75 reclamações**, 57,1% de resolução e só 42,9%
voltariam a fazer negócio (abril/2026). Outra aponta **8,6/10 com 77
reclamações** e 100% resolvidas (setembro/2026). Leitura honesta: reputação
historicamente ruim com melhora recente de SLA.

B2B Stack: 5,0/5 com **1 avaliação de 2021** — estatisticamente inútil.

Queixas recorrentes: SAC lento, instabilidade, **leads que chegam no WhatsApp e
não aparecem no ChatGuru**, dor na migração para API Oficial.

Números que a empresa divulga (não auditados): 6.000+ clientes, 9 países, 200
milhões de mensagens/mês, retenção 92%, clientes como XP, Natura, Volkswagen,
Havaianas.

## Fontes

[home](https://chatguru.com.br/) ·
[planos](https://chatguru.com.br/planos-e-precos/) ·
[parcerias](https://chatguru.com.br/parcerias/) ·
[blog: cobrança no WhatsApp](https://chatguru.com.br/blog/ferramenta-cobranca-whatsapp/) ·
[API (403 em fetch)](https://oldwiki.chatguru.com.br/api/api-documentacao-v1) ·
[Reclame Aqui](https://www.reclameaqui.com.br/empresa/chatguru/) ·
[reclamação sobre disparo](https://www.reclameaqui.com.br/chatguru/chatguru-nao-permite-eu-fazer-disparo-em-massa_l9Wz0qpqc3LfILoq/)

---

# Kommo (ex-amoCRM)

**O único dos cinco com pagamento no chat que funciona no Brasil.** É o
concorrente a estudar de verdade.

## Pagamento: nativo, grátis, e move o funil

Existe categoria oficial **"Invoicing & payments"** no marketplace, com
integrações **built-in feitas pela Kommo, incluídas em qualquer plano, sem custo
separado**:

| Gateway | Status | Brasil |
|---|---|---|
| **Mercado Pago** | ✅ built-in, grátis, todos os planos | ✅ |
| Stripe | ✅ built-in, grátis | parcial |
| PayPal | ✅ built-in, grátis | parcial |
| Payer | ✅ | — |
| Asaas | ❌ só widget de terceiro (7Club, pago) | via terceiro |
| PagSeguro/PagBank | ❌ não aparece | ❌ |
| Pix direto | ❌ só dentro do Mercado Pago | indireto |

**Como funciona, pela doc:**
1. Anexa produtos ao lead (catálogo) ou mapeia campos para a fatura
2. Gatilho no Digital Pipeline **gera a fatura automaticamente** quando o lead
   chega num estágio
3. **Salesbot tem step de widget de pagamento** — envia o link no chat
4. Cliente paga em **checkout externo** do gateway
5. **Status da fatura aparece no card e move o lead no funil**

O passo 5 é exatamente a mecânica que faz o CRM se preencher sozinho. **Não é
território virgem: alguém já faz.**

**Mas não é pagamento dentro do WhatsApp** — é link para checkout externo. E há
um sinal de raso: a doc do Salesbot com Stripe cita **"Facebook chats"**, não
WhatsApp. A automação de cobrança pelo WhatsApp pode ser mais fraca do que a
página de vendas sugere.

**Limitações documentadas do Stripe:** só contas em inglês; contato precisa ter
nome, telefone **e e-mail** (fricção real num fluxo de WhatsApp); **produtos são
criados no dashboard do Stripe, não no Kommo**.

Para o Brasil, o caminho real é **Mercado Pago**.

## Catálogo: existe de verdade

"Lists" com dois tipos, regular e **products**. Só pode haver **uma lista de
produtos por conta**. Elementos se vinculam a leads e viram **aba dentro do card
do lead**. Tem API (`KOMMO_LIST_CATALOGS`, `KOMMO_IMPORT_PRODUCTS_TO_AI`).

Carrinho/checkout próprio: não existe. É "produtos anexados ao lead" → fatura.

**Em que plano, não resolvido.** Uma leitura da doc de planos indica que o
catálogo é **"super fields pack", só no Pro (US$ 45/usuário) e Enterprise** — o
que, se for verdade, empurra a combinação catálogo + cobrança para o plano mais
caro e torna a comparação de preço ainda mais favorável à gente. Não consegui
confirmar na mesma fonte que documenta o resto das Lists. **Conferir antes de
usar como argumento de venda.**

## Multicanal: é o core, e é comprovado

WhatsApp (Cloud API), Instagram, Messenger, Telegram, TikTok, Viber, Skype,
WeChat, webchat, e-mail e telefonia num inbox unificado. Essa parte não é
marketing.

## IA: reformulada, e cara por fora do plano

Três camadas: **AI Agent** (autônomo, qualifica, recomenda produto, move o lead;
não existe no Base; Advanced até 3, Pro até 50), **Copilot** (resumo, detecta
pergunta não respondida; todos os planos), **AI Analyst** (linguagem natural
sobre os dados; só Pro/Enterprise).

**Sistema de créditos** — pool por assento/mês, **não acumula, expira**:
Base 750 · Advanced 1.500 · Pro 2.250. Consumo: agente ~15 créditos/resposta,
analyst ~100–200/request.

**Faça a conta:** 1.500 ÷ 15 = **~100 respostas de agente por assento/mês** no
Advanced. É pouco para operação real de WhatsApp.

Pacotes extras (mínimo 3 meses): Starter US$ 29/mês (10 mil créditos) · Growth
US$ 99 (50 mil) · Scale US$ 299 (200 mil).

## Broadcast: nativo, com travas

Cada pessoa recebe como conversa privada. **Só Advanced, Pro e Enterprise** — não
tem no Base. **Só administradores disparam.** Limites: WhatsApp 1.024 chars,
Instagram/Facebook 1.000, Telegram 4.096, **máximo 3 botões**. **Não inclui
e-mail nem SMS.**

## E-mail: é caixa de entrada, não campanha

Conecta sua caixa por **IMAP/SMTP**. **Não tem infraestrutura própria de envio.
Não é ESP.** Modos: Shared (admin conecta, equipe vê) ou Personal.

Por que não é e-mail marketing:
1. **Sai pelo SMTP da sua caixa.** A própria orientação da Kommo reconhece que
   provedores limitam **2–3 mil/dia** e que passar disso **bloqueia a caixa** — e
   recomenda **SMTP pago de terceiro (SendPulse)**. A Kommo admite que a
   ferramenta dela não faz o trabalho.
2. **Broadcasting não inclui e-mail.**
3. **Sem tracking nativo de abertura/clique** — quem quer usa widget de terceiro
   (Mailer, Komanda F5).

É usado e útil **como caixa de entrada dentro do CRM**. Como canal de campanha,
é vitrine, e a arquitetura impede por construção.

## Relatórios: ponto fraco reconhecido

Reviews independentes e Capterra batem no mesmo: **"reporting remains basic"**,
e gestão de vendas séria **precisa exportar** para analisar fora.

## Preço: subiu em 1º/set/2026

Base US$ 15 → **US$ 25**. Advanced US$ 25 → **US$ 35**. Quem assinou antes travou
o preço. **Muita fonte secundária ainda cita US$ 15** — está desatualizada.

| Plano | USD/usuário/mês | Leads/usuário | Contatos/assento | Números WhatsApp | Salesbot | Broadcast |
|---|---|---|---|---|---|---|
| Base | 25 | 2.500 | 12.500 | 1 (+1/usuário) | ❌ | ❌ |
| Advanced | 35 | 5.000 | 25.000 | 3 (+1/usuário) | ✅ | ✅ |
| Pro | 45 | 10.000 | 50.000 | ilimitado | ✅ | ✅ |
| Enterprise | sob consulta | custom | custom | ilimitado | ✅ | ✅ |

**O preço real é muito maior que a tabela:**
- **O Base não automatiza nada** — sem Salesbot, sem broadcast, sem agente de IA.
  A automação de cobrança pelo chat **começa no Advanced**.
- **Mínimo de 6 meses pré-pago.** No Brasil **não há cobrança mensal**.
- **Mínimo de usuários desde 20/jul/2026**: Básico exige 3+, Avançado e Pro
  exigem 2+. O "Base de R$ 86" custa na real **R$ 258/mês no mínimo**.
- Créditos de IA que expiram mensalmente.
- Conta da Meta por mensagem, que **pode superar a assinatura**: o review
  independente calcula que, na França a US$ 0,13/marketing, uma equipe de 5 com
  550 mensagens ativas/mês já faz a conta da Meta passar a do Kommo.

Kommo **não cobra por número conectado** — a integração WhatsApp é grátis em
todos os planos. O que limita é a quantidade de números.

## White label: NÃO tem, contrariando a fama

Programa de parceiros Bronze/Silver/Gold, 35–50% de comissão, desconto no portal.
**Nenhuma fonte oficial descreve white label real.** O parceiro revende Kommo
*como Kommo*.

## API: existe, doc é ruim

REST documentada, mas crítica independente direta: documentação **"incompleta,
contém erros e falta clareza sobre registro de canais"**, exigindo tempo extra de
desenvolvimento.

## App mobile

Nativo iOS e Android, com **scanner de cartão de visita** — apontado por review
independente como raridade entre CRMs modernos.

## Reputação

Capterra 4,3/5 (164) · G2 4,1/5 (49) · **Reclame Aqui 6,8/10 com 223
reclamações** — nota fraca, e o Brasil é um dos principais mercados deles.
Queixas: suporte inconsistente com repasses sucessivos, relatórios rasos, limites
de customização de estágios, bugs.

## Marketing inflado, registrado

*"AI agent processa pagamentos e fecha negócios com zero intervenção humana"* —
frase do blog deles. Tecnicamente o agente aciona o widget que gera o link; o
pagamento acontece fora. E o Base nem tem agente.

## Fontes

[pricing](https://www.kommo.com/buy/tariff/) ·
[planos](https://support.kommo.com/docs/kommo-subscription-plans-overview) ·
[broadcasting](https://support.kommo.com/docs/broadcasting-overview) ·
[e-mail](https://www.kommo.com/support/crm/mail/) ·
[Mercado Pago](https://www.kommo.com/integrations/mercado-pago-integration/) ·
[Stripe](https://support.kommo.com/docs/en/connect-stripe-to-kommo) ·
[AI pricing](https://www.kommo.com/blog/kommo-ai-pricing/) ·
[API Lists](https://developers.kommo.com/reference/lists) ·
[Salesdorado](https://salesdorado.com/en/crm/crm-software/review-kommo-crm/) ·
[Reclame Aqui](https://www.reclameaqui.com.br/empresa/kommo_1411514/) ·
[calculadora BR](https://www.calculadorakommo.com.br/)

---

# ManyChat

Social-first. Tem pagamento no chat — que **não serve ao Brasil**.

## A mudança de 02/mar/2026: o Free morreu

O modelo antigo (Free com 1.000 contatos + Pro) acabou. Hoje são 5 planos por
**Active Contacts** (contato que interagiu no mês; mesma pessoa 10x conta 1).
**O Free foi migrado à força para 25 contatos.** Contas antigas migram país a
país — por isso ainda se acha review falando de "Free com 1.000".

É a mudança mais hostil do ano e ainda não apareceu em boa parte dos
comparativos.

## Pagamento: existe, e não serve

Buy Button em bloco Card ou Gallery, com **Stripe e PayPal** (o blog que diz que
PayPal não é suportado está errado — o artigo está ativo).

As travas, todas da doc oficial:
- **Só Messenger e Instagram DM.** Os dois artigos dizem na primeira linha
  *"accept payments via Messenger and Instagram"*. **Não vale para WhatsApp**,
  nem Telegram, nem TikTok. Não há artigo de pagamento em WhatsApp.
- **Teto de US$ 100 por item**, piso de US$ 0,50. Isso sozinho mata ticket médio
  de serviço.
- Moeda: o conjunto documentado é **USD, EUR, GBP**. **BRL não aparece.**
- **Pix: busca no help center inteiro dá 0 resultados.** Nem nativo, nem via
  Stripe — o artigo diz literalmente *"When using Stripe, contacts can only
  complete their payments using a credit card"*. Sem Apple/Google Pay.
- Uma conta Stripe/PayPal serve a **uma única** página ManyChat.

**Conclusão para o Brasil: na prática não há pagamento no chat.** Canal errado,
moeda errada, método errado, teto baixo.

## Catálogo e carrinho

Catálogo existe (Settings > Catalog), **só aparece se Stripe ou PayPal estiver
conectado**, e serve para mandar link de produto pelo Inbox.

**Carrinho não existe como recurso.** O próprio artigo ensina a "criar um
carrinho" empilhando blocos de Data Collection com campos numéricos e **somando
na mão** no campo de preço do Buy Button. Isso é gambiarra documentada.

## Canais

Instagram, Messenger, TikTok, Telegram, WhatsApp, SMS, Email.
**Não tem webchat/widget de site** — busca no help center: 0 artigos. É buraco
real.

## E-mail: o único dos cinco com canal de verdade

Canal próprio com automação, broadcast, Data Collection para capturar e opt-in.
**Não é vitrine.**

Preço: franquia mensal de **10× o limite de contatos** do plano (500 contatos →
5.000 e-mails). Acima, **US$ 0,003 por e-mail**, em blocos de 5.000. Só em plano
pago, e o canal só existe **do Pro para cima**.

**Onde decepciona:** remetente padrão é do domínio deles
(`noreply@many-mail.io`), domínio próprio exige setup separado. E a limitação que
dói: **o corpo do e-mail não aparece no Inbox** — a conversa mostra só "Email
message sent". O histórico do contato fica cego.

## SMS: inútil no Brasil

BYO Twilio (você conecta sua conta e paga a Twilio). 160 caracteres, **70 se tiver
emoji**, mensagem longa vira várias cobradas. **MMS só US/CA.**

## IA: add-on pago à parte

AI Step (Messenger, Instagram, WhatsApp, TikTok, Telegram), Intention
Recognition, Text Improver, Flow Builder Assistant, AI Knowledge, e o trio novo
AI Replies / AI Comments / AI Goals — **este trio é só Instagram e está em beta
declarado no artigo**. AI Goals tem exatamente 3 objetivos: mandar link, ganhar
seguidor, capturar lead. **Bem mais raso do que o marketing sugere.**

## Integrações: 13, contadas na doc

Conversions API (CAPI), Google Sheets, Zapier, ChatGPT, Claude, DeepSeek,
Hotmart, Klaviyo, ActiveCampaign, HubSpot CRM, Kit (ConvertKit), MailChimp,
Flodesk.

**Não tem Shopify nativo. Não tem Make nativo.** A lista é pesada em e-mail
marketing e fraca em e-commerce.

API pública: **só do Pro para cima**. Tem Dev Program com app review próprio.

White label: não achei nada. "Powered by Manychat" some no pago, mas isso é
remoção de branding. **Tratar como inexistente.**

App mobile: existe, mas o artigo é explícito de que várias funções são **só
web** — a IA você constrói na web e só gerencia no app.

## Preço (USD, BRL a ~R$ 5,40)

| Plano | Mensal | Anual | Contatos | Usuários | Canais | Excedente/contato |
|---|---|---|---|---|---|---|
| Free | 0 | — | **25** | 1 | 2 (sem WhatsApp) | — |
| Essential | 17 (~R$ 92) | 14 | 250 | 2 | 2 (sem WhatsApp) | $0,10 / $0,08 |
| Pro | 39 (~R$ 211) | 29 | 2.500 | 3 | 3, **aqui entra WhatsApp/SMS/Email** | $0,05 / $0,038 |
| Business | 99 (~R$ 535) | 69 | 7.500 | 5 | ilimitados | $0,025 / $0,018 |
| Advanced | 199 (~R$ 1.075) | 139 | 25.000 | 10 | ilimitados | $0,004 / $0,0028 |

Assento extra de Inbox: **US$ 25**. Free e Essential **não têm WhatsApp** — o
piso real para WhatsApp é **Pro**. Free limita a 4 automações ativas. Estourar o
limite não para o bot: cobra excedente e avisa em 70/90/100%.

**Não existem planos "Premium" e "Elite"** — esses nomes são de material antigo.

**Custo real no Brasil:** plano + **US$ 29/mês do add-on de IA** (número de blog,
não de doc) + conversas WhatsApp à parte. Tarifa oficial no artigo de
17/09/2026 para o Brasil: **Marketing US$ 0,0718 / Utility US$ 0,0078 / Service
US$ 0** por mensagem entregue. E **a partir de 01/out/2026 a Meta passa a cobrar
service message**, com franquia de 1.000/mês por número.

Um Pro com IA e 10 mil marketing/mês passa de **US$ 780/mês (~R$ 4.200)**.

## Reputação: a distância entre os números é o recado

**Reclame Aqui 2,4/10, "Não recomendada", 56 reclamações, 0% de resposta**
(mar–ago/2026). Contra G2 4,5–4,6 e Capterra ~4,6.

O produto agrada; o atendimento e a cobrança não. Queixas recorrentes: escalada
de custo conforme contatos crescem, suporte só por e-mail e lento, cobrança após
cancelamento. Sem operação brasileira: interface e suporte em inglês, cobrança em
dólar (IOF + câmbio).

## Fontes

[Free](https://help.manychat.com/hc/en-us/articles/25800197498652-Free-plan) ·
[Pro](https://help.manychat.com/hc/en-us/articles/25800228332572-Pro-plan) ·
[Active Contacts](https://help.manychat.com/hc/en-us/articles/25800323349020-Active-Contacts) ·
[Buy Button](https://help.manychat.com/hc/en-us/articles/14281189285276-How-to-use-the-Buy-Button-on-Facebook-Messenger-and-Instagram-DM) ·
[Stripe](https://help.manychat.com/hc/en-us/articles/14281204933532-How-to-connect-Stripe-to-Manychat) ·
[e-mail](https://help.manychat.com/hc/en-us/articles/14281215436188-How-to-send-emails-with-Manychat) ·
[SMS](https://help.manychat.com/hc/en-us/articles/14281249064092-How-to-send-SMS-MMS-through-Manychat) ·
[WhatsApp pricing](https://help.manychat.com/hc/en-us/articles/14281380243740-WhatsApp-pricing-guide) ·
[G2](https://www.g2.com/products/manychat/reviews)

Nota de método: `manychat.com/pricing` dá **403 Cloudflare** para fetch. Os
números vieram da **API do Zendesk do help center**, com data de edição.

---

# Leadster

Topo de funil. Entrega o lead e sai de cena antes de qualquer transação.

## O que tem, e é bom

**Chatbot de site** (produto original, o mais maduro): fluxos com regras por
página, qualificação, leadscoring, **teste A/B nativo**, página de captura,
botão de redirecionamento para WhatsApp, chamadas proativas, geolocalização,
agendamento via Google Calendar, LGPD no fluxo.

**Configuração automática de evento de Meta Pixel e GA4.** Isso é forte e
incomum.

**Analytics é o ponto mais forte dele:** flow analytics, dashboard de abandono,
conversão por página e por campanha, origem do lead, relatório exportável,
relatório semanal por e-mail. Ele nasceu como ferramenta de marketing de
performance, e rastreio por origem/campanha/anúncio é **melhor que a média das
plataformas brasileiras de WhatsApp**.

**Dois itens para copiar:** o teste A/B de fluxo (nenhuma das outras quatro tem)
e o analytics de origem.

## WhatsApp Suite (módulo pago à parte)

Inbox de atendimento de verdade: cadastro de atendentes, histórico centralizado,
múltiplos atendentes, monitoramento em tempo real, métricas de tempo de resposta.
API oficial Meta com templates, variáveis e template com imagem — inclusive a dor
clássica do erro **`131042`** (elegibilidade de pagamento) documentada. CSAT,
automação de fluxo, "roleta do WhatsApp" (rodízio), Live Chat.

## Leadster AI e ShopBot (módulos pagos à parte)

**Leadster AI**: base de conhecimento por upload (.doc, .pdf, .txt) e por páginas
do site, bloco de IA no fluxo, condicionais de intenção, conversa proativa.

**ShopBot** (marca e site próprios): recomendação de produto, resposta sobre
produto, carrinho abandonado, pós-venda. Integra Nuvemshop, Tray, VTEX, Loja
Integrada. **Não faz catálogo próprio, carrinho próprio nem checkout** — lê o
catálogo da loja e empurra para o checkout dela.

## O que NÃO tem

**Kanban/funil/CRM nativo: não existe.** Tem "Dashboard" e aba de leads, que é
lista, não funil. Integra com CRM de terceiro por desenho.

**Instagram/Messenger/Telegram: nenhuma evidência.** Os canais que lista são
site, WhatsApp, Google Ads, Meta Ads, LinkedIn — e os três últimos são fonte de
tráfego e evento de conversão, não canal de conversa. **Não é omnichannel.**

SMS: nenhuma menção. White label: nenhuma evidência. **App mobile: não tem** — o
app "Leadster" na App Store é de **outra empresa** (scanner de cartão de visita);
Capterra lista "Android/iPhone" mas é só painel responsivo. **Não confiar nesse
campo.**

**API pública: não comprovada.** Capterra marca "API: sim", mas a central de
ajuda só documenta **webhook de saída com JWT**. Tratar como webhook outbound.

**Disparo em massa: bandeira amarela.** A página do WhatsApp Suite diz que o
preço varia conforme "se inclui disparos" e promete "sem cobrança por disparo",
mas **não existe um único artigo na central de ajuda sobre como fazer disparo**.
Clássico: existe no plano comercial, é raso ou recente no produto.

## Pagamento: ausência estrutural

Procurado por quatro caminhos, todos vazios:
1. Central de ajuda (6 coleções, ~60 artigos): **zero** artigo sobre pagamento,
   Pix, link, checkout, cobrança, ou qualquer gateway
2. Lista de ~20 integrações nativas: **nenhum gateway**
3. ShopBot, o candidato natural: recomenda, não transaciona
4. WhatsApp Suite: a única menção a "pagamento" é o erro `131042`, que é billing
   da conta Meta, não do cliente final

O que existe é o trivial: colar link de pagamento como texto. Não gera cobrança
rastreada, não reconcilia, não muda status.

**Não é "tem mas é fraco" — é ausência estrutural**, coerente com o
posicionamento de topo de funil.

## E-mail: notificação interna, e só

Os artigos são "como adicionar novos **e-mails para recebimento dos leads**" e
"como alterar o assunto do e-mail de notificação". É e-mail **para dentro**, para
a sua equipe. Mais relatório semanal.

Sem editor, lista, segmentação, nutrição, template, métrica, domínio. Mandar o
lead para o RD Station **não é e-mail nativo** — é o modelo dele: o e-mail é
responsabilidade de quem recebe o lead.

## Preço: não é público

Discurso oficial no blog deles: *"você precisa fazer o teste gratuito para
receber uma proposta comercial personalizada."* É venda assistida.

| Plano | Aproximado | Limite |
|---|---|---|
| Free | R$ 0 | 15 leads/mês (algumas fontes dizem 30), 1 fluxo |
| Starter | ~R$ 142/mês anual | leads ilimitados, **5 fluxos** |
| Pro | ~R$ 154/mês anual | fluxos ilimitados, leadscoring, **teste A/B** |
| Full | não publicado | + Leadster AI, roleta, agendamento |

**A variável do preço é visitas mensais do site** (1k a 20k+), não leads nem
usuários — leads são ilimitados nos pagos, e eles fazem questão de dizer.

Módulos à parte: **Leadster AI a partir de R$ 220/mês** · Agendamento ~US$ 9/mês
· **ShopBot a partir de R$ 319/mês** · WhatsApp Suite não publicado.

**Conta fechada realista:** site com tráfego médio + WhatsApp Suite + Leadster AI
passa fácil de **R$ 700 a R$ 1.200/mês**, porque cada peça é um contrato.

Detalhe que confunde: eles aceitam Pix como forma de **você pagar a assinatura**.
Não é funcionalidade do produto — vi essa confusão em artigo de terceiro.

## "Mais de 200 integrações" é Zapier

Nativas (~20): RD Station, HubSpot, Salesforce, ActiveCampaign, PipeRun, Exact
Sales, Bitrix24, Zoho, Pipedrive, Ploomes, Praedium, Followize, Contact2sales,
Sirena, Lahar, Fleeg, E-goi, Google Sheets, Google Calendar, Google Ads, Meta
Ads, LinkedIn, WordPress, Reportei. O resto é catálogo do Zapier/Pluga.

## Reputação: base pequena demais

Capterra 4,5/5 com **11 avaliações**. B2B Stack 4,9/5 com **4**. Estatisticamente
fraco nos dois.

**Reclame Aqui: sem reputação** (não chegou às 10 reclamações avaliadas). 4 anos
na plataforma, 2 reclamações, **0% respondidas e 0% resolvidas**. Duas é pouco,
mas não responder nenhuma é um dado sobre o pós-venda, e casa com venda assistida
e preço não público.

Queixas nas reviews: lógica condicional limitada (não dá para desviar o lead para
outro fluxo conforme a resposta), dashboard limitado, **exclusão automática de
leads que não completaram o fluxo** (incomoda bastante), complexidade de
integração.

## Fontes

[home](https://leadster.com.br/) · [preço](https://leadster.com.br/preco/) ·
[planos](https://help.leadster.com.br/article/67-conheca-nossos-planos) ·
[integrações](https://help.leadster.com.br/article/82-com-quais-plataformas-consigo-integrar-a-leadster) ·
[WhatsApp Suite](https://help.leadster.com.br/collection/314-whatsapp-suite) ·
[gerenciar leads](https://help.leadster.com.br/collection/1-gerencie-seus-leads) ·
[ShopBot](https://shopbot.leadster.com.br/) ·
[Reclame Aqui](https://www.reclameaqui.com.br/empresa/leadster/)

Nota de método: `leadster.com.br` dá **403 Cloudflare**. Os preços vêm de
snapshot de busca, não de leitura direta. `help.leadster.com.br` responde normal,
e é de lá que veio a evidência de produto.

---

# A Payments API do WhatsApp (Brasil)

Existe, é específica do Brasil, e o cliente paga **sem sair do chat**. Nenhum dos
cinco usa.

## Como funciona

Mensagem interativa **`order_details`** com `payment_settings`. Tipos aceitos na
doc: **`pix_dynamic_code`**, `payment_link`, `boleto`. Cada mensagem **deve**
conter um **`reference_id` único**. Depois, a empresa manda **`order_status`**
para marcar como `processing`.

Para Pix, o comprador **troca para o app do banco e usa Pix Copia e Cola**.

## O porém que decide tudo

> *"WhatsApp does not support payment reconciliations. A empresa deve reconciliar
> o pagamento com seu PSP usando o `reference_id` da ordem."*

E a exigência: é preciso *"ter uma integração existente com um banco ou PSP para
gerar códigos Pix dinâmicos e fazer reconciliação automática"*.

**Traduzindo: a Meta não gera o Pix e não confirma o pagamento.** Você precisa de
um PSP real integrado de qualquer jeito. O `order_details` é a **casca bonita**
por cima de uma integração de PSP que você teria que fazer igual.

Consequência prática: **o `order_details` não é o caminho de menor risco.** Ele
soma uma dependência de fila da Meta (a doc não esclarece onboarding, permissão
ou app review — e a gente já está na fila deles por Coexistence) a um trabalho que
precisa ser feito de qualquer forma.

O caminho de 90% do valor com 10% do risco é **Pix copia-e-cola como texto, ou
botão com link de pagamento**. Mais feio. **A confirmação automática, que é o que
importa, funciona igual nos dois.**

## O que já existe do nosso lado

`src/core/tipo-da-mensagem.ts` mapeia `order: '🛒 pedido'` — **o sistema já
reconhece que chegou um pedido do catálogo da Meta**, mas não processa. É a
ponta solta mais próxima desse assunto.

## Fontes

[Payments BR overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/payments/payments-br/overview/) ·
[WhatsApp orders](https://developers.facebook.com/documentation/business-messaging/whatsapp/payments/payments-br/orders/)

---

# PSPs brasileiros de Pix: qual dá para usar

O filtro que importa não é "gera QR dinâmico" — quase todos geram. É **"cria
conta para o meu cliente via API e deixa eu reter minha taxa"**, porque a gente
cobra **em nome de PMEs**.

## Comparação

| PSP | Auth | Certificado mTLS | Custo publicado | Subconta/split via API |
|---|---|---|---|---|
| **Asaas** | header `access_token` | **Não** | **R$ 1,99** por cobrança recebida (R$ 0,99 nos 3 primeiros meses) | ✅ **o mais completo** — `POST /v3/accounts` retorna `apiKey` + `walletId`; split nativo |
| **Mercado Pago** | Bearer token | **Não** | 0,49% (promocional, CNPJ novo) a 0,99% | ✅ via **OAuth**; `application_fee` |
| **Woovi/OpenPix** | App ID no header | Não | **0,80%** (mín. R$ 0,50, máx. R$ 5) ou **R$ 0,85** fixo; **split grátis** | ✅ subcontas + split por chave Pix |
| **Pagar.me** | Basic (secret key) | Não | **não publicado** (por contrato) | ✅ split maduro |
| **Efí (Gerencianet)** | OAuth2 **+ certificado** | **Sim, `.p12` obrigatório** | **1,19%**, mín. R$ 0,01 | split de Pix, mas não abre conta para terceiro |
| **Cora** | OAuth2 + certificado | **Sim** | 1% até R$ 49,99 + **plano CoraPro R$ 44,90/mês** para liberar a API | ❌ uma conta por empresa |
| **PagBank** | Bearer; Connect (OAuth) | Não | "grátis" no marketing, mas **até 1,89%** variável | ⚠️ parcial |
| **Celcoin** | OAuth2 Bearer | Não | **não publicado** | ✅ o mais profundo, mas é BaaS com contrato e responsabilidade regulatória |
| **Stone OpenBank** | parceria | Sim | **não publicado** | ❌ sem self-service |
| **InfinitePay** | checkout/link | Não | **Pix taxa zero** | ❌ sem subcontas para SaaS |

## mTLS: a gente precisa?

**Não.** A exigência de certificado **ICP-Brasil padrão SPB, x509 v3, 2048 bits,
com OAuth 2.0 sobre mTLS** é para quem é **participante do arranjo Pix** e fala
direto com DICT, SPI e os endpoints `/cob` do BCB. Certificado autoassinado não é
aceito.

A gente fala com o PSP, não com o BCB. Aí quem decide é o PSP:
- **Efí e Cora repassam a exigência** (`.p12` nas suas chamadas), porque expõem a
  API no formato padrão BCB. **Efí exige `.p12` inclusive na chamada de
  `/oauth/token`, e o download é único** — perdeu, gera outro.
- **Asaas, Mercado Pago, Woovi, Pagar.me, PagBank abstraem**: só token. O mTLS
  existe entre o PSP e o BCB, não entre nós e o PSP.

## Recomendação

**Asaas como primário.** É o único que resolve o problema inteiro num fluxo: cria
a subconta via API, devolve a `apiKey` dela, e a gente emite cobrança em nome do
cliente com split da nossa taxa. Sem certificado.

**A pegadinha, e é séria:** existe **período de avaliação regulatória de até 60
dias** em que a conta fica limitada a **10 subcontas e R$ 2.000 de emissão por
subconta**. Estourou qualquer um dos dois, **bloqueia criação de subconta nova e
emissão**. Nos primeiros dois meses não se escala — e descobrir isso em produção
seria ruim. Também exige **conta-pai CNPJ**.

**Mercado Pago como caminho alternativo**, para o cliente que já tem conta MP
(muita PME tem) e não quer abrir outra. A gente não vira responsável pela conta
dele. Custo: **não controlamos a taxa que ele paga** (varia por conta e
campanha), e **o token OAuth expira em 6 meses** — sem rotina de refresh, a
cobrança do cliente para de funcionar num dia qualquer.

**Woovi como plano de custo**, se o ticket médio for baixo. R$ 1,99 fixo do Asaas
é caro em cobrança pequena: numa mensalidade de R$ 150 dá 1,3%, mas numa aula
avulsa de R$ 50 dá **4%**. Woovi cobra 0,80% com teto de R$ 5 e split grátis.
Contra: casa menor, e isso pesa quando se trata de dinheiro de terceiro.

**Efí** tem a melhor relação preço/transparência para ticket baixo (1,19% bate
R$ 1,99 fixo em qualquer cobrança abaixo de ~R$ 167), mas gerenciar um `.p12`
**por cliente**, com download único e mTLS no webhook, dentro de um SaaS, não se
paga.

**Fora:** Cora e InfinitePay (uma conta só, sem subconta), Stone (sem
self-service), Celcoin (BaaS de verdade, com responsabilidade regulatória
nossa), PagBank (taxa variável que não dá para explicar ao cliente).

## Onde não há preço publicado

Dito com franqueza, porque chutar aqui custa caro depois: **Pagar.me, Celcoin,
Stone OpenBank** não publicam. **PagBank** publica só o teto. **Mercado Pago**:
o 0,49% é condição promocional de landing ("CNPJ novo, a partir de R$ 15
mil/mês") e as páginas oficiais de custo bloqueiam fetch (403) — tratar como
piso promocional, não taxa padrão.

Publicados e verificáveis: Asaas (R$ 1,99), Efí (1,19%), Woovi (0,80% ou
R$ 0,85), Cora (1% + R$ 44,90/mês), InfinitePay (zero).

## Fontes

[Asaas: Pix](https://docs.asaas.com/docs/cobrancas-via-pix) ·
[Asaas: subcontas](https://docs.asaas.com/docs/criacao-de-subcontas) ·
[Asaas: aprovação de subcontas](https://docs.asaas.com/docs/detalhamento-do-fluxo-de-aprovacao-de-subcontas) ·
[Asaas: preços](https://www.asaas.com/precos-e-taxas) ·
[Efí: credenciais e certificado](https://dev.efipay.com.br/docs/api-pix/credenciais/) ·
[Mercado Pago: Pix](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/pix) ·
[Mercado Pago: split](https://www.mercadopago.com.br/developers/pt/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace) ·
[Pagar.me: split](https://docs.pagar.me/reference/criar-pedido-com-split-1) ·
[OpenPix: preços](https://openpix.com.br/pricing/) ·
[BCB: Manual de Segurança do SFN Vol. II](https://bcb.gov.br/content/estabilidadefinanceira/cedsfn/Manual%20de%20Seguran%C3%A7a%20do%20SFN%20-%20Vol.II%20-%20v6_00.pdf)

---

# O que isto quer dizer para a gente

## A sensação de "falta página" está invertida

O AutoFluxos tem **mais produto que qualquer um dos três brasileiros**: agente de
IA com function calling (ChatGuru tem só resumo e transcrição), CRM de funil
(Leadster não tem), multicanal (os três são monocanal), versão publicada imutável
com rollback, validador que recusa fluxo sem caminho até humano, BYOK.

O que falta não é tela. É:

**(a) Ligar o que já está construído e não tem tela.**

**Correção de 22/set/2026, conferida no repo.** Este parágrafo repetia uma
afirmação do `CONCORRENTES-15-SET.md`, que é de 15/set e envelheceu. O que
vale:

- **Campanhas e Sequências TÊM tela.** São abas de `fluxos/page.tsx`
  (`ABAS_VALIDAS` inclui `campanhas` e `sequencias`), ligadas aos
  repositórios, e `src/components/sequencias/` existe. A afirmação
  "repositório completo e zero tela" **não vale mais**.
- **NPS funciona ponta a ponta.** O nó existe no motor, grava por
  `guardarNota`/`guardarComentario` em `receber-mensagem.ts`, e como tem
  `salvarEm`, **a resposta já aparece na tela de Respostas** como qualquer
  variável colhida. O que ninguém lê são duas consultas de **agregação**
  (`notasDaConta`, `comentariosDaConta`) — e isso é decisão de produto, não
  buraco. A ideia do dono é melhor: **NPS como filtro na tela de Respostas**,
  que já existe com busca, paginação e CSV.
- **Templates da Meta**: submissão `1082311667664553` **em rascunho, nunca
  enviada**. Não é código: é gravar vídeo e enviar.
- **Instagram comment-to-DM**: escrito e testado, travado no Advanced Access.
  Também não é código.

**A lição de método vale mais que o item: o doc envelhece e o repo não.** Antes
de tratar "X não tem tela" como fila de trabalho, rode o grep. Esta seção já
esteve errada uma vez.

**(b) Uma peça nova que fecha o ciclo: cobrar no chat.**

## Por que cobrar no chat é a peça certa

Não é "ia ser massa". É a única coisa que **liga o CRM na tomada**.

Hoje o sistema conversa, qualifica, move no funil — e alguém registra a venda na
mão. Ninguém registra: a produção tem **0 ganhos e 0 cartões com valor**. Toda
tela de cliente nasce vazia, e por isso o painel, o nível por faixa, o LTV e a
régua de retomada — tudo já construído — não têm dado real para mostrar.

**Se o webhook do PSP marca a venda sozinho, o CRM inteiro se preenche.**

E é o buraco que os brasileiros não tapam sem mudar de preço: a R$ 189–199 o
BotConversa não constrói onboarding de PSP; o ChatGuru cobra por atendente e
posiciona cobrança como régua de inadimplência.

## O espaço que sobra não é "ser o primeiro"

A Kommo prova que a mecânica funciona e vende. **Ser honesto sobre isso importa.**

O espaço é **ser o que o dono de PME brasileira consegue ligar**: a Kommo pede
US$ 35/usuário no plano que tem a automação, mínimo 3 usuários, 6 meses
pré-pagos, interface de CRM americano, e exige e-mail do contato no fluxo do
Stripe. Os brasileiros são baratos e falam a língua, mas exigem header de
autenticação REST.

O buraco é no meio: **preço brasileiro, sem mínimo de usuários, e Pix que conecta
em dois cliques.**

## O que NÃO construir

**E-mail marketing.** Nenhuma das cinco tem de verdade — BotConversa, ChatGuru e
Leadster só têm aviso interno; a Kommo é IMAP/SMTP e a doc dela manda usar
terceiro acima de 2–3 mil/dia; o ManyChat tem canal real mas o corpo não aparece
no inbox. Não é lacuna competitiva. Decidido cortar, com prova.

**Catálogo comercial completo** (carrinho, estoque, proposta, contrato). O
`MODELO-CRM.md` já recusou, e a recusa continua certa. O que falta é **preço no
produto** — a mesma peça que a cobrança precisa. Nada além disso.

**`order_details` do WhatsApp como primeiro passo.** Soma fila da Meta a um
trabalho de PSP que precisa ser feito igual. Fica para depois de o ciclo
funcionar com link.

## Duas coisas do Leadster que valem copiar

**Teste A/B de fluxo.** Nenhuma das outras quatro tem. Num produto de chatbot,
parece óbvio depois que alguém faz.

**Analytics de origem.** Ele configura evento de Meta Pixel e GA4 sozinho e
mostra conversão por página e campanha. A gente já guarda `ctwa_clid`,
`source_id`, `source_url`, `headline` e `body` em `contacts.campos` — **a
matéria-prima está lá, sem tela que leia.** Mesmo padrão das Campanhas e do NPS.

---

## Em aberto

O que não foi decidido e não deve ser tratado como decidido:

- **Cross-sell**: o bot oferecer produto complementar na hora da venda, ou
  clientes da 4YU venderem produtos uns dos outros? A resposta muda o desenho.
  A mecânica de encadeamento já existe (`quadros.seguinte_id` + funil de
  pós-venda); falta o bot saber **o que** oferecer — e isso é preço no produto
  de novo.
- **Qual PSP**, e se vale suportar mais de um desde o início.
- **Se a cobrança entra**, em que ordem contra ligar Campanhas, Sequências e NPS,
  que são mais baratos e já estão meio prontos.
