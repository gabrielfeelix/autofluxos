# Onde paramos — 14/ago/2026

Documento de retomada. Quem chegar aqui sem ter acompanhado a construção
consegue continuar lendo só isto e o [ARQUITETURA.md](ARQUITETURA.md).

> **ANTES DE QUALQUER MUDANÇA DE BANCO:** desde 14/ago/2026, este projeto
> Supabase também hospeda a Verandi em `app_verandi`. Leia
> [BANCO-COMPARTILHADO.md](BANCO-COMPARTILHADO.md). AutoFluxos continua em
> `public`; Auth, Storage, extensões, Data API, cotas e backup são globais.
> **Nunca rode `supabase db push` contra produção.**

---

## Leia isto primeiro

**Estado:** fases 1 a 3 do plano mestre concluídas. `npm test` dá **309
passando** (8 pulados), `npm run typecheck`, `npm run lint` e `npm run build`
estão limpos. O último `main`
publicado continua em https://autofluxos.4yu.com.br.

**O produto hoje faz:** desenhar fluxo arrastando bloco, testar a conversa ao
lado, publicar versão imutável, receber mensagem do WhatsApp, responder,
**chamar o sistema do cliente no meio da conversa** (bloco API), guardar as
credenciais dele num cofre, e o lead cair na tela.

**As quatro regras que não se quebram**, e das quais quase tudo aqui decorre:

1. `src/core/` não faz rede, não importa Next, WhatsApp nem banco. Se uma tarefa
   parecer exigir quebrar isso, a tarefa está errada.
2. O motor nunca vê segredo. Credencial é resolvida no servidor, depois de
   `executar()`, e por isso não entra na sessão — que viaja para o navegador a
   cada mensagem do simulador.
3. Recusa de tela é conveniência; a recusa que vale é a do servidor. `publicar()`
   revalida tudo, e `efeitos/rede.ts` recusa endereço independentemente do que o
   editor deixou passar.
4. O banco é compartilhado com a Verandi, não o domínio. Este repositório só
   cria objetos do AutoFluxos em `public`; nunca consulta `app_verandi`. Mudança
   em Auth, Storage, extensões ou Data API precisa ser avaliada nos dois produtos.

**A regra de produto que não é óbvia e já me fez errar:** mandar o cliente usar
n8n, Zapier ou Make **não é resposta aceitável**. O AutoFluxos vende ser a
camada de automação; se o cliente precisa do n8n, ele não precisa da gente.
Faltou peça? Constrói a peça. Ferramenta externa pode ser destino de um webhook
nosso, nunca requisito para funcionar.

> A dívida de segurança continua em
> [PLANO-ENDURECIMENTO.md](PLANO-ENDURECIMENTO.md), mas não é mais a ordem de
> produto. O [PLANO-MESTRE.md](PLANO-MESTRE.md) começa por Inbox e automações
> de atendimento; os blocos 4 e 7 de endurecimento entram obrigatoriamente
> antes de liberar login de cliente.

**Existem duas filas neste projeto, e elas não competem.** A de baixo é de
**dívida**: o que está torto, inseguro ou pela metade. A de features está em
[EXPANSAO.md](EXPANSAO.md), que saiu da análise de 31 telas de um concorrente
(BotConversa) rodando num cliente real, e traz o nosso estado campo a campo, o
que existe fora, e o que construir com estado esperado de cada item.

Onde as duas se tocam: o **item 1** daqui (papéis) é o item 15 de lá, e o
**item 2** (modelos da Meta) é o 13. Quando divergirem, **esta fila manda na
dívida e a de lá manda na ordem das features.**

O índice executável das duas filas, com dependências, gatilhos e critérios de
aceite, é [PLANO-MESTRE.md](PLANO-MESTRE.md). Use-o para escolher a próxima
fase; mantenha este arquivo como retrato operacional e evidência das decisões.

### Atualização de 14/ago/2026 — Fase 1 do plano mestre

- Limite de cinco tentativas por IP em cinco minutos para login e simulador;
  indisponibilidade da conferência fecha a porta.
- Simulador recusa corpo maior que 256 KB e fluxo com mais de 200 nós antes de
  executar efeitos; `robots.txt` e metadado bloqueiam indexação do painel.
- Salvar rascunho, alternar IA e publicar agora exigem que o fluxo pertença ao
  cliente informado. O teste cobre as três tentativas de escrita cruzada.
- A migration `0014_limites.sql` foi aplicada em produção em 16/ago/2026 pela
  Management API do AutoFluxos, com a tabela e o RPC conferidos depois da
  aplicação. Ela não toca objetos do schema `app_verandi`.

### Atualização de 14/ago/2026 — Fase 2 do plano mestre

Sem migration: as três entregas são código.

- **Histórico e rollback.** O editor lista as versões publicadas e "voltar para
  esta" publica o desenho antigo como versão nova, passando pelo mesmo
  `publicar()` — com validação, porque uma versão antiga pode ter ficado
  inválida depois de publicada (conexão apagada, IA descontratada, contexto
  removido). A versão é buscada pelo par `(versão, fluxo)`.
- **Alertas.** `server/alertar.ts` avisa por webhook em três lugares e só três:
  falha no `after()` do webhook, recusa da Cloud API e cofre que não devolve
  credencial. Sem `ALERTA_WEBHOOK_URL` é no-op, e ela nunca estoura nem segura a
  conversa — os três chamadores já estão num caminho de falha.
- **Sessão do painel.** O cookie deixou de ser `SHA-256(senha)` e virou
  `id.expira.HMAC(segredo, id.expira)`: id aleatório por login, prazo conferido
  no servidor (não no navegador), e trocar `PAINEL_SEGREDO` encerra todas as
  sessões. Revogar **uma** sessão continua exigindo banco e segue com papéis de
  usuário.
- **Duas variáveis novas no `.env.example` ainda não preenchidas em produção:**
  `PAINEL_SEGREDO` (sem ela, a assinatura é derivada de `PAINEL_SENHA`) e
  `ALERTA_WEBHOOK_URL` (sem ela, nenhum alerta sai). Os dois padrões são
  documentados, não falhas — mas o alerta só começa a servir depois de
  preenchida.

### Atualização de 14/ago/2026 — Fase 3 do plano mestre

- **Leads em escala.** A lista pagina de 50 com contagem vinda do banco, busca
  por nome ou telefone e exportação CSV do filtro atual. As contagens por
  etiqueta saíram da barra: cada número obrigava a ler o histórico do cliente
  inteiro a cada visita, que é o que a paginação veio evitar.
- **LGPD.** Apagar contato na tela do lead e retenção de 12 meses contados do
  último sinal de vida. A retenção roda por tarefa agendada da Vercel, e **não**
  por `pg_cron`: extensão é global ao projeto compartilhado com a Verandi. A
  rota exige `CRON_SECRET` e falha fechada sem ele — **enquanto a variável não
  existir em produção, nada é apagado**.
- **Apagar cliente** com confirmação digitando o nome, mostrando quantos leads,
  automações, credenciais e números somem junto. A logo sai do bucket na mesma
  ação: cascata de banco não alcança o Storage.
- **390px e WCAG 2.2 A/AA.** Auditoria com axe-core em 11 telas, em três
  larguras. Três defeitos latentes apareceram e foram corrigidos: o piso de
  1024px estava em `html/body` em vez do editor; `text-soft` era usada em 34
  lugares e **nunca pintou nada** (o token só existia em `:root`, e no Tailwind 4
  quem gera utilitário é `@theme`); e `--dim` reprovava contraste AA em
  praticamente toda tela.
- **Um 500 pré-existente saiu junto:** `ControleDeAutomacao` era componente de
  servidor passando closure inline no `action` do formulário, e isso derrubava a
  tela do lead sempre que o contato **não** estava aguardando pessoa — o caso
  comum. Virou componente de cliente e passou a mostrar os motivos de recusa que
  a ação já devolvia.
- Migration `0015_sem_ia_no_cliente.sql` versionada e **não aplicada**.

### Por onde continuar, em ordem

| # | O quê | Por que agora |
|---|---|---|
| 1 | **Papéis de usuário** (BRIEF-UI §6) | É a maior, e destrava as outras. Hoje é uma senha só. Há comentário em quatro pontos do código dizendo "isto muda quando o cliente ganhar acesso" — recusa de endereço interno, isolamento entre clientes, a tela de "não encontrado" que vira "não é seu". Este é o dia. **Uma coisa entra junto, e não depois:** `/api/simular` aceita um fluxo inventado + `fluxoId` de qualquer cliente e manda a credencial dele para a URL do corpo — hoje inofensivo porque a senha já dá acesso a tudo, escalada de privilégio no minuto em que o cliente tiver login. A sessão do painel deixou de ser problema em 14/ago (cookie assinado, id por login, prazo no servidor); o que ainda falta dela é **revogar uma sessão só**, e isso é banco, então é aqui. |
| 2 | **Modelos (templates) da Meta** | A caixa de resposta do painel só funciona dentro da janela de 24h — é a regra da Meta, e fora dela o único jeito de retomar é um modelo aprovado, que este produto não manda. A tela avisa antes de alguém digitar. Gatilho para construir: o primeiro lead que esfriar e precisar de retomada. |
| 3 | **Credencial de sandbox por conexão** | A aba Testar usa a credencial real: testar um fluxo de CRM grava no CRM de verdade. Hoje há aviso na tela e o cabeçalho `X-AutoFluxos-Teste: 1`. Gatilho para construir: o primeiro cliente com CRM em produção. |
| 4 | **Aplicar `0015_sem_ia_no_cliente.sql`** | A migration que apaga `clients.ia_habilitada` está escrita e versionada. Falta autorização para aplicar em produção — banco compartilhado. |
| 5 | **Teste de banco intermitente** | `repos.test.ts` falha de vez em quando com `JWT issued at future` — o relógio do WSL2 desanda quando a máquina suspende e o Supabase recusa o token. É ambiente, não código: rodar de novo passa. Se incomodar, `sudo hwclock -s` acerta na hora. |

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
- **Funil e execuções** — o início do cliente mostra conversas do mês,
  resolvidas pelo bot, esperando pessoa e o mês anterior como referência; a
  lista de fluxos mostra quantas vezes cada automação rodou. A view
  `metricas_sessoes` (migration `0011`) agrega no Postgres, por mês de São
  Paulo, sem puxar todas as sessões para o Next. Sessão encerrada depois de um
  handoff continua humana — não infla a taxa do bot.
- **Etiquetas automáticas nos leads** — a lista ganhou filtros para quem abriu
  com áudio/mídia, quem já foi para uma pessoa e quem nunca respondeu depois da
  primeira mensagem. Elas são recalculadas de `messages` e do histórico inteiro
  de `handoffs` em consultas por lote; não há campo para sincronizar, escrita
  nova nem migration. Um handoff continua contando depois de resolvido.
- **Atraso curto e “digitando…”** — bloco de Mensagem aceita até 3 segundos. O
  motor puro só descreve `atrasoMs`; a Cloud API marca a entrada
  como lida, mostra o indicador usando o `wamid` recebido e espera no canal. Se
  o indicador falhar, a resposta continua. A aba Testar usa os pontos animados
  durante a mesma pausa e revela sequências mensagem por mensagem. Pausa acima
  de 3 segundos continua reservada ao agendador do item 12.
- **Teste com pele de WhatsApp** — a aba Testar abre em `Conversa`, com contato
  nomeado, horário, papel de parede, bolhas e respostas de largura total. O
  alternador `Bastidores` devolve todos os eventos de sistema, variáveis e
  estado da sessão; no modo visual, eles viram um contador que leva até lá. O
  áudio, os dois alertas e o reinício fixo existem nos dois modos. Nenhuma ação
  do motor mudou: os desenhos consomem a mesma lista.

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
