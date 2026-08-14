# Onde paramos — 13/ago/2026

Documento de retomada. Quem chegar aqui sem ter acompanhado a construção
consegue continuar lendo só isto e o [ARQUITETURA.md](ARQUITETURA.md).

---

## Leia isto primeiro

**Estado:** item 1 da expansão concluído na base local. `npm test` dá **250
passando**, `npm run typecheck` e `npm run lint` estão limpos. O último `main`
publicado continua em https://autofluxos.4yu.com.br.

**O produto hoje faz:** desenhar fluxo arrastando bloco, testar a conversa ao
lado, publicar versão imutável, receber mensagem do WhatsApp, responder,
**chamar o sistema do cliente no meio da conversa** (bloco API), guardar as
credenciais dele num cofre, e o lead cair na tela.

**As três regras que não se quebram**, e das quais quase tudo aqui decorre:

1. `src/core/` não faz rede, não importa Next, WhatsApp nem banco. Se uma tarefa
   parecer exigir quebrar isso, a tarefa está errada.
2. O motor nunca vê segredo. Credencial é resolvida no servidor, depois de
   `executar()`, e por isso não entra na sessão — que viaja para o navegador a
   cada mensagem do simulador.
3. Recusa de tela é conveniência; a recusa que vale é a do servidor. `publicar()`
   revalida tudo, e `efeitos/rede.ts` recusa endereço independentemente do que o
   editor deixou passar.

**A regra de produto que não é óbvia e já me fez errar:** mandar o cliente usar
n8n, Zapier ou Make **não é resposta aceitável**. O AutoFluxos vende ser a
camada de automação; se o cliente precisa do n8n, ele não precisa da gente.
Faltou peça? Constrói a peça. Ferramenta externa pode ser destino de um webhook
nosso, nunca requisito para funcionar.

> **Antes de pegar qualquer item da fila abaixo**, veja o
> [PLANO-ENDURECIMENTO.md](PLANO-ENDURECIMENTO.md). Ele é o que falta a nível de
> código para o sistema ficar profissional e seguro — nove blocos, em ordem, com
> as decisões técnicas já tomadas. Os blocos 4 e 7 de lá são pré-requisito
> barato do item 1 desta fila.

**Existem duas filas neste projeto, e elas não competem.** A de baixo é de
**dívida**: o que está torto, inseguro ou pela metade. A de features está em
[EXPANSAO.md](EXPANSAO.md), que saiu da análise de 31 telas de um concorrente
(BotConversa) rodando num cliente real, e traz o nosso estado campo a campo, o
que existe fora, e o que construir com estado esperado de cada item.

Onde as duas se tocam: o **item 1** daqui (papéis) é o item 15 de lá, e o
**item 2** (modelos da Meta) é o 13. Quando divergirem, **esta fila manda na
dívida e a de lá manda na ordem das features.**

### Por onde continuar, em ordem

| # | O quê | Por que agora |
|---|---|---|
| 1 | **Papéis de usuário** (BRIEF-UI §6) | É a maior, e destrava as outras. Hoje é uma senha só. Há comentário em quatro pontos do código dizendo "isto muda quando o cliente ganhar acesso" — recusa de endereço interno, isolamento entre clientes, a tela de "não encontrado" que vira "não é seu". Este é o dia. **Duas coisas entram junto, e não depois:** (a) `/api/simular` aceita um fluxo inventado + `fluxoId` de qualquer cliente e manda a credencial dele para a URL do corpo — hoje inofensivo porque a senha já dá acesso a tudo, escalada de privilégio no minuto em que o cliente tiver login; (b) a sessão do painel é `SHA-256(senha)` pura, sem nonce e sem carimbo, então cookie copiado vale para sempre e não há como revogar um acesso só. |
| 2 | **Modelos (templates) da Meta** | A caixa de resposta do painel só funciona dentro da janela de 24h — é a regra da Meta, e fora dela o único jeito de retomar é um modelo aprovado, que este produto não manda. A tela avisa antes de alguém digitar. Gatilho para construir: o primeiro lead que esfriar e precisar de retomada. |
| 3 | **Histórico de versões, e voltar para uma** | `listarVersoes` existe no repo e **nenhuma tela usa**. Publicou errado, hoje o único caminho é redesenhar e publicar de novo — com o desenho ruim atendendo gente no WhatsApp enquanto isso. O caminho é curto: as versões são imutáveis e `publicar()` já aceita um grafo qualquer, então voltar é publicar o grafo de uma versão antiga. |
| 4 | **Apagar cliente** | Dá para apagar automação e desconectar número; cliente não. Ficou de fora de propósito: `on delete cascade` leva leads, conversas e credenciais junto, e isso merece uma confirmação melhor do que um `confirm()` — provavelmente digitar o nome. |
| 5 | **Credencial de sandbox por conexão** | A aba Testar usa a credencial real: testar um fluxo de CRM grava no CRM de verdade. Hoje há aviso na tela e o cabeçalho `X-AutoFluxos-Teste: 1`. Gatilho para construir: o primeiro cliente com CRM em produção. |
| 6 | **`drop` de `clients.ia_habilitada`** | O código já parou de ler (migration 0005 pedia essa confirmação). Falta a migration que apaga. |
| 7 | **Teste de banco intermitente** | `repos.test.ts` falha de vez em quando com `JWT issued at future` — o relógio do WSL2 desanda quando a máquina suspende e o Supabase recusa o token. É ambiente, não código: rodar de novo passa. Se incomodar, `sudo hwclock -s` acerta na hora. |

### O que foi construído em 12/ago, e onde está escrito

- **Nó de API** (o sétimo bloco) — [NO-API.md](NO-API.md), plano em [PLANO-NO-API.md](PLANO-NO-API.md)
- **Conexões** (credenciais no cofre) — [CONEXOES.md](CONEXOES.md), migration `0006`
- **DNS rebinding fechado** — `server/efeitos/rede.ts`, e o porquê de vir antes do cofre está no CONEXOES
- **Tela do contexto do negócio** — era lido em cinco lugares e escrito em nenhum
- **Passada de uso, dirigindo o painel de verdade** (Playwright, 18 conferências).
  O que ela achou e consertou: id torto no endereço dava **500** em vez de 404
  (`ehIdInvalido` em `server/db.ts` — Postgres recusa uuid malformado com 22P02
  antes de olhar a tabela); "Esqueci a senha" era um `<span>` morto **dentro do
  `<label>` da senha**; o e-mail sumia ao errar a senha; salvar o contexto não
  confirmava nada; a caixa de números não tinha estado vazio; não havia como
  desconectar número nem apagar automação; apagar bloco não tinha desfazer;
  publicar não confirmava em texto; bloco novo nascia em cima do anterior; e a
  porta de entrada anunciava "6 tipos de bloco" quando já são 7.
- **Responder o lead pelo painel** — `components/lead/responder.tsx`,
  `acaoResponderLead`, e a janela de 24h em `channels/janela.ts`. Era o beco do
  handoff: o bot calava e não havia de onde responder, porque o número roda na
  Cloud API e o celular do cliente não é caixa de entrada. Responder assume a
  conversa (a sessão vai para `humano`) e "Já atendi" devolve ela ao bot.
- **Revisão de segurança e de uso**, e os quatro consertos que saíram dela:
  falha de entrega vira handoff (`receber-mensagem.ts`), prazo de 15s na Cloud
  API (`channels/cloud-api.ts`), botão **"Já atendi"** na tela do lead
  (`repos/conversas.ts` → `encerrarAtendimento`) e cabeçalhos de segurança no
  `next.config.ts`. O que a revisão achou e ficou para a fila está lá em cima,
  nos itens 1 e 2.

### O que foi construído em 13/ago

- **Origem do lead por anúncio** — o webhook preserva o `referral` da primeira
  mensagem Click-to-WhatsApp em `contacts.campos`: `origem`, `origem_anuncio` e
  `origem_titulo`. Quem chega sem anúncio fica como `Direto`. A origem só é
  escrita uma vez, então uma conversa futura não troca a aquisição verdadeira.
  Não houve migration: a tela de leads já transforma as chaves do `jsonb` em
  colunas.

### Armadilhas que já custaram caro nesta base

- **Interpolar dentro de estrutura sem escapar.** O que a pessoa digita no
  WhatsApp entra em URL, corpo JSON e cabeçalho. Sem escape, ela deixa de
  preencher campo e passa a escrever a requisição. Os escapes por contexto estão
  em `core/engine/interpolar.ts` — use-os em qualquer campo novo.
- **Exceção solta dentro do `after()` do webhook.** A mensagem já foi
  deduplicada, então se a sessão não for salva a pessoa fica sem resposta e a
  Meta não reenvia. Tudo que pode lançar no caminho do webhook precisa virar
  handoff, não exceção. Foi assim que o **envio** ficou aberto até 12/ago: a
  sessão é gravada *antes* de `aplicar()`, e a Cloud API lança em qualquer
  não-2xx (token expirado, janela de 24h, limite de taxa) — o fluxo avançava
  como se tivesse falado e ninguém recebia nada. Hoje falha de entrega vira
  handoff e **para o resto das ações**, porque mandar a terceira mensagem
  depois da segunda ter falhado entrega uma conversa fora de ordem.
- **Corpo de resposta HTTP não consumido.** Stream pausado que o undici destrói
  depois vira exceção sem dono, e cai no caso acima.
- **Identidade vinda do corpo da requisição.** `/api/simular` aceitava o
  `clienteId` do cliente HTTP e isso permitia resolver credencial de qualquer
  cliente. Desenho pode vir de fora; identidade sai do banco.

---

## Etapa 1 COMPLETA — o bot respondeu no WhatsApp de verdade

Em 12/ago/2026, 02:58, a conversa inteira rodou no WhatsApp real:

```
saida    Perfeito! Como posso te chamar?
entrada  joao
saida    Legal, joao. Para quando seria?
entrada  Próximas semanas
saida    Show, joao! Já estou chamando alguém do time aqui. 🙌
saida    Prontinho! Alguém do time assume a conversa a partir daqui.
```

Interpolação (`{{nome}}` virou "joao"), casamento da opção clicada, sessão presa
na versão publicada e handoff no fim. O caminho do lead quente, de ponta a ponta.

### O número (Cliente 00)

`+55 44 7400-7438` · phone_number_id `1301107846409860` · WABA `2245936116250161`

`VERIFIED` e `CONNECTED`. O PIN de 2 fatores usado no `register` está no cofre
como `AUTOFLUXOS_WA_PIN` — **no cofre da máquina de casa**, que é o completo.
Ele é pedido de novo se o número for movido de WABA. Ver "Segredos" mais abaixo
sobre as duas máquinas não estarem iguais.

### O que custou caro descobrir

- **Verificação por ligação, não SMS.** Pedir código muitas vezes derruba num
  limite por tempo que custa horas. Uma tentativa, sem reenviar.
- **Verificado não basta: falta `register`.** Sem ele, todo envio volta
  `(#133010) Account not registered`. É uma chamada de API, não tem no painel.
- **Quem começa a conversa importa.** Mensagem iniciada pela empresa exige forma
  de pagamento cadastrada. Mensagem de resposta (a pessoa escreveu primeiro) é
  grátis, mil por mês. Para testar, **mande você primeiro**.
- **Número de teste só fala com até 5 destinatários autorizados**, e autorizar
  só pelo painel. Existe um número de teste registrado (`+1 555-197-7747`,
  phone_number_id `1171822376025244`) que ficou inútil por isso.
- **O console da Meta quebra silenciosamente.** Vários botões ("Reivindicar
  número de teste", "Gerar token") não fazem nada, e o console só mostra CSP
  bloqueando a telemetria da própria Meta. Quando isso acontecer, procure o
  mesmo caminho pelo `business.facebook.com` ou pela Graph API — quase tudo tem
  equivalente.
- **Token carrega as permissões de quando foi gerado.** Adicionar permissão ao
  app depois não muda o token; tem que gerar outro.

### O que falta para atender cliente de verdade

1. **Verificação da empresa** — `Portfólio - 4YU` está "Não verificada". Demora,
   e é a porta que trava as duas coisas abaixo.
2. **Virar Provedor de Tecnologia** (App Review + Access Verification).
3. **Embedded Signup v4** com `featureType: whatsapp_business_app_onboarding` —
   é o que permite Coexistence: o número do cliente funciona no celular dele e
   na Cloud API ao mesmo tempo. Sem isso, entrar com um cliente significa tirar
   o WhatsApp do celular dele.

Detalhe de prazo: **Embedded Signup v2 morre em 15/out/2026.** Nascer no v4.

---

## Depois da Etapa 1: o nó de API (12/ago/2026)

Enquanto a verificação da empresa não sai, entrou o **sétimo bloco: API**. Ele
chama um endereço no meio da conversa, guarda campos da resposta em variáveis e
segue o fluxo.

O motivo é comercial: passa a ser verdade dizer "integra com o seu sistema" numa
reunião. Cobre Sheets por Apps Script, webhook de qualquer coisa, e n8n/Make/
Zapier inteiros. **Cobre CRM também**, desde as Credenciais (migration 0006): cada cliente
cadastra as chaves dele uma vez, num cofre fora do banco, e o bloco aponta pela
referência. Nada mais precisa de n8n — se o cliente precisasse dele, não
precisaria da gente.

O que ficou pronto: schema, motor, validador, recusa de SSRF, disparo com
timeout, resolvedor único (IA e API no mesmo laço), bloco no editor e aviso na
aba Testar. Desenho em [NO-API.md](NO-API.md), plano em [PLANO-NO-API.md](PLANO-NO-API.md).

O cofre entrou junto, como **Conexões** ([CONEXOES.md](CONEXOES.md)), e o DNS
rebinding foi fechado antes dele — sem o IP fixado na conexão, guardar
credencial seria entregá-la.

**O contexto do negócio ganhou tela** (`/clientes/[id]/contexto`). Ele era lido
em cinco lugares e escrito em nenhum, então era `''` para todo cliente — e o
bloco de IA, que só pode responder com o que está escrito ali, respondia "não
sei" a tudo. Falhava fechado, então ninguém percebia. Agora o validador recusa
publicar fluxo com bloco de IA enquanto o contexto estiver vazio.

O que fica pendente e é decisão de produto: **a aba Testar usa a credencial de
verdade**. Testar um fluxo com conexão de CRM grava no CRM de verdade. Hoje há
o aviso na tela e o cabeçalho `X-AutoFluxos-Teste: 1` para o sistema do cliente
filtrar; a solução completa é uma credencial de sandbox por conexão, e o gatilho
para construir é o primeiro cliente com CRM de produção.

A fila do que continua faltando é **uma só**, e está na tabela lá em cima
("Por onde continuar, em ordem"). Ela não é repetida aqui de propósito: duas
listas do mesmo assunto foi exatamente o que já contradisse este documento uma
vez.

---

## Onde as coisas estão

| O quê | Onde |
|---|---|
| Repositório | https://github.com/gabrielfeelix/autofluxos (**público**) |
| Painel no ar | https://autofluxos.4yu.com.br |
| Vercel | time `4-yu`, projeto `autofluxos`, região `gru1` (São Paulo) |
| Supabase | projeto `autofluxos`, ref `xxxynoshwirupkdzwxbj`, `sa-east-1` |
| App na Meta | `AutoFluxos`, id `1063817842847269`, portfólio `Portfólio - 4YU` (id `1494483661926723`) |
| Segredos | `4yu-apps/.secrets/4yu.env`, prefixo `AUTOFLUXOS_` |
| Token da Hostinger | `~/dev/radar-ofertas/.env`, variável `HOSTINGER_TOKEN` |

**Acesso ao painel:** usuário qualquer (só a senha é conferida), senha em
`AUTOFLUXOS_PAINEL_SENHA`. Ela apareceu uma vez no chat da construção — se
quiser trocar, gere outra e atualize a variável na Vercel.

**DNS:** `4yu.com.br` fica na Hostinger (nameservers `solar`/`lunar.dns-parking.com`).
O subdomínio é um `CNAME autofluxos → cname.vercel-dns.com`, criado pela API
deles. Mesmo padrão do `deixeiaqui` e do `www`.

---

## O caminho da Meta — o que sobrou

O número do Cliente 00 está verificado, registrado e conversando (ver o topo).
O que ainda trava **atender cliente de verdade** são as três coisas da seção
"O que falta", e nenhuma delas é código.

> **Nota para quem lê o histórico:** até 12/ago este documento tinha uma seção
> dizendo que o número estava `NOT_VERIFIED` e que tudo dependia disso. Ela era
> de 11/ago e ficou para trás quando o número foi liberado — mas continuou aqui,
> contradizendo o próprio topo do arquivo. Foi removida em 12/ago. Se você achar
> duas afirmações opostas neste documento de novo, a de cima é a nova.

### O que já está pronto e testado em produção

- Webhook configurado na Meta e **assinado no campo `messages`**
- Assinatura HMAC validada com a chave real: correta → 200, errada → 401,
  ausente → 401, verificação GET → 200
- **Mensagem de verdade já entrou pelo webhook**, criou contato, criou sessão
  presa na versão publicada e **o motor avançou até a primeira pergunta**. Só o
  envio falhou, pelo número não registrado.
- Em 11/ago às 22:51 e 22:54 entraram mais dois "oi" — um de teste e um do
  número do Gabriel. Os dois viraram contato e **aparecem na tela de leads**,
  cada um com uma mensagem de `entrada` e **nenhuma de `saida`**. É o retrato
  exato do bloqueio: o que chega, chega; o que sai, não sai.
- Painel já tem `Cliente 00 — Gabriel` com o fluxo de triagem **publicado (v1)**
  e o número conectado.

### Segredos — o cofre depende de qual máquina você está

Esta seção dizia que os segredos do AutoFluxos estavam em `.secrets/4yu.env`
com o prefixo `AUTOFLUXOS_`. **Depende da máquina:** na de casa estão; na do
trabalho o `.secrets/4yu.env` é uma cópia de 10/ago, anterior a este projeto, e
não tem nenhuma variável com esse prefixo.

Vale a pena saber disso antes de tentar usar: derivar o cookie do painel a
partir do cofre falha em silêncio na máquina do trabalho, e parece problema de
produção quando é só o arquivo estar velho ali.

O que existe em cada lugar, **na máquina do trabalho**:

| Variável | `.secrets/4yu.env` (aqui) | `autofluxos/.env` (local, fora do git) | Vercel |
|---|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | não | sim | sim |
| `META_APP_SECRET` | não | sim | sim |
| `WHATSAPP_TOKEN`, `WHATSAPP_VERIFY_TOKEN` | não | sim | sim |
| `GEMINI_API_KEY` | não | sim | sim |
| `PAINEL_SENHA` | não | **não** | sim |
| PIN de 2 fatores do número (`AUTOFLUXOS_WA_PIN`) | não | não | não |

O PIN **está no cofre da máquina de casa** — não se perdeu. O que falta é o
`.secrets/4yu.env` das duas máquinas estar igual; enquanto não estiver, tarefa
que precisa de segredo só roda em casa.

Um agente não sincroniza isso sozinho: mover credencial viva entre máquinas é
ato do dono, não efeito colateral de uma revisão.

---


## Contexto de negócio que não está no código

**Cliente 00 é o número de freelance do Gabriel.** O bot roda nele primeiro; a
Prelúdio só entra depois que funcionar. Todo susto acontece com a gente.

**Cliente 01 é a Prelúdio Produtora** (produtora de vídeo em São Paulo,
[preludiovideo.com](https://preludiovideo.com) — *a confirmar se é essa mesma*).
Cliente do sócio do Gabriel. Tráfego pago → WhatsApp → triagem na mão → agenda
ou liga. **Já fecha contrato bom.**

O problema dele é específico: **quem está em dúvida no preço trava e não
avança.** Lead quente converte; morno esfria.

**A pergunta central do projeto continua sem resposta, e é do cliente:**

> A Prelúdio topa o bot falar **faixa de preço**?

A hipótese é que o morno trava por falta de âncora, não por objeção real —
perguntou preço, ouviu "depende", leu como "vai ser caro". Se ela não topar, o
bot resolve outro problema, não o que ele contou. **Vale perguntar antes de
desenhar e antes de vender.**

Faltam também: os arquivos de abordagem dele (viram o desenho do fluxo, o
contexto da IA e a suíte de teste), o ticket médio e o volume de conversas.

**Preço combinado entre os sócios:** R$1.800 de setup (R$900 cada) e ~R$700/mês
de manutenção. **Os custos variáveis têm que ser faturados no cliente** — Meta
cobra ~R$0,20–0,50 por conversa e a IA é BYOK. Com o WABA no nome do cliente
(Embedded Signup), a Meta cobra ele direto e a manutenção fica limpa.

---

## Armadilhas já mapeadas (não repetir a pesquisa)

- **IA de propósito geral está proibida** na Business API desde 15/jan/2026. Bot
  task-oriented é permitido. Por isso o nó de IA é sempre fechado no contexto do
  cliente.
- **Free tier do Gemini treina modelo com os dados**, inclusive revisão humana.
  Não pode ver conversa real. Dev com dado fictício; produção com chave paga do
  cliente.
- **Evolution API está sendo caçada.** Perder o número do cliente é o pior
  fracasso possível para uma agência. Só Cloud API oficial.
- **Coexistence** (app + Cloud API no mesmo número) existe e resolve o handoff:
  o celular do cliente continua sendo o inbox, então não precisamos construir
  um. Exige onboarding por parceiro que suporte "business app number onboarding".
- **Embedded Signup v2 morre em 15/out/2026** — nascer no v4.
- **Limite de blocos:** 3 opções viram botões, até 10 viram lista, acima disso a
  Meta recusa. O validador bloqueia.
- **Supabase free:** 2 projetos ativos no total. Hoje `radar-ofertas` +
  `autofluxos`. Retomar o `Otimiza Gestor` (pausado) estoura o limite. Projeto
  free pausa após 1 semana sem requisição.
