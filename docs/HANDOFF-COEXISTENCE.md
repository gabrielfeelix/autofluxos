# Handoff — Coexistence: o trabalho de código

> Escrito em 13/set/2026. O dono e outra sessão cuidam do **painel da Meta**;
> este documento é o **código**, e as duas frentes não se bloqueiam.
> Leia também [META-TECH-PROVIDER.md](META-TECH-PROVIDER.md) e, antes de tocar
> em banco, [BANCO-COMPARTILHADO.md](BANCO-COMPARTILHADO.md) inteiro.

## O que é Coexistence, em uma frase

Atender no número que o cliente **já usa no WhatsApp Business App**, sem ele
perder o celular: ele continua respondendo à mão pelo aparelho, a gente manda em
escala pela Cloud API, e os dois lados enxergam a mesma conversa.

O "os dois lados enxergam a mesma conversa" é o trabalho. Sem ele, o cliente
responde pelo celular, o nosso banco não sabe, e o bot atropela uma conversa que
um humano já estava tendo.

## Estado da fila (apurado pelo MCP em 13/09, não suposto)

```
verificação do negócio → app review → app em Live → Tech Provider → Coexistence
    ✅ 02/09              ✅ 12/09      ✅ 13/09      ✅ 13/09        ← o código é aqui
```

**Tech Provider saiu.** O alerta da Meta diz literalmente *"Sua empresa foi
verificada como Provedora de Tecnologia"*. O modal "Integre-se como Provedor de
Tecnologia" que ainda aparece em Casos de uso → WhatsApp é **tela de entrada do
trilho, não veredito** — o painel relata o passo, nunca o resultado (mesma
armadilha do contêiner GTM que dizia "publicado" por meses sem estar no ar).

Não se assuste com `screencast: is_completed: false` em `devtools_app_review
action: requirements`: as duas permissões de WhatsApp estão
`DEVOPS_APPROVED / advanced` em `action: privileges`, que é o que vale.
`requirements` descreve **a composição de um envio** (uma bandeja de pedidos),
não o que está vigente.

| O quê | Valor |
|---|---|
| App | `1063817842847269` (`AutoFluxos`), `live_mode`, compliance limpo |
| Nossa WABA | `2245936116250161` (`4YU Tech`), `verified`, `APPROVED` |
| Nosso número | `1301107846409860` — `+55 44 7400-7438` |
| Webhook | `https://autofluxos.4yu.com.br/api/webhook/whatsapp` |
| `config_id` do Hosted | `1071840912286349` |
| Retorno do OAuth | `https://autofluxos.4yu.com.br/api/whatsapp/retorno` |
| Última migration | `0046_ordem_do_fluxo` — **confira com `ls supabase/migrations/ \| tail -1`** |

> A WABA `468946307261350` citada no `HANDOFF-13-SET.md` **não existe** (erro 100
> com o nosso token). Ignore-a. O selo CoEx é coisa do painel, e é com o dono.

## Dois prazos que mudam a prioridade

1. **Embedded Signup v2 morre em 15/out/2026.** Já está escrito na doc da Meta.
   Nasça em **v4**. Começar em v2 é retrabalho contratado.
2. **Você tem 24 horas** depois de embarcar o cliente para sincronizar contatos e
   histórico. Passou, ele precisa ser desembarcado e refazer o Embedded Signup
   inteiro. E **cada sync só pode ser disparado uma vez**. Ou seja: o disparo da
   sincronização não é um botão que alguém aperta quando lembra — é consequência
   automática do onboarding terminar.

## O que já existe, e está bom

Não reescreva nada disto:

- [route.ts](src/app/api/webhook/whatsapp/route.ts) — assinatura HMAC validada
  sobre o corpo cru, 200 imediato com processamento no `after()`, `maxDuration =
  60`. As regras da Meta (200 em menos de 20s) já estão respeitadas.
- [receber-mensagem.ts](src/server/receber-mensagem.ts) — o roteamento
  multi-tenant: `entry[].changes[].value.metadata.phone_number_id` → `channels` →
  `client_id`. **Todo campo novo entra por esse mesmo caminho.**
- `messages.wa_message_id` é `unique` — dedup garantida pelo banco, não por
  lembrança de quem escreve o código.
- `channels` já tem `phone_number_id` (unique) e `waba_id`.
- `contacts` já tem `(client_id, wa_id)` unique e a coluna `nome`.

## O trabalho, em quatro frentes

> A frente 2 encolheu: o Embedded Signup é hospedado pela Meta. Ver o aviso lá.

### 1. Webhook: três campos novos

Confirmei pelo MCP (`devtools_webhook_list action: list_topics`) que os três
existem no tópico `whatsapp_business_account` e **nenhum está assinado hoje**.
Hoje assinamos: `messages`, `account_alerts`, `account_review_update`,
`account_update`, `calls`, `message_template_*`, `phone_number_*`, `security`.

| Campo | O que traz |
|---|---|
| `history` | conversas passadas do cliente, na adesão |
| `smb_app_state_sync` | contatos da agenda dele (e toda mudança futura) |
| `smb_message_echoes` | **mensagens que ele mandar pelo celular, dali em diante** |

**Não confunda com `message_echoes`** (sem o `smb_`), que também aparece na lista
do painel: aquele é do **Messenger**, com outro payload (`sender`/`recipient`,
`is_echo`), e não tem nada a ver com Coexistence. O nosso é `smb_message_echoes`
— e, confusamente, o array dentro do payload dele **se chama** `message_echoes`.

`smb_message_echoes` é o mais importante dos três para o produto: é o que impede
o bot de atropelar uma conversa que o dono do negócio já está tendo à mão.

Assinar é painel (App Dashboard → WhatsApp → Configuration) ou
`devtools_webhook_manage action: update_fields` com `add_fields`. **Não assine
antes de o handler saber digerir o payload** — webhook chegando em código que não
o entende vira erro silencioso em produção.

### 2. Onboarding: Embedded Signup v4 com session logging

> **DECIDIDO (13/09): é o Hosted. Não construa SDK de Embedded Signup.**
>
> O link gerado no painel de Tech Provider já vem com Coexistence ligado — é a
> URL que o cliente abre, e ela está pronta:
>
> ```
> https://business.facebook.com/messaging/whatsapp/onboard/
>   ?app_id=1063817842847269
>   &config_id=1071840912286349
>   &extras={"version":"v4","sessionInfoVersion":"3",
>            "featureType":"whatsapp_business_app_onboarding"}
>   &redirect_uri=https://autofluxos.4yu.com.br/api/whatsapp/retorno
> ```
>
> `featureType: whatsapp_business_app_onboarding` é exatamente o que a doc exige
> para Coexistence, e `version: v4` já evita o v2 que morre em 15/out/2026.
>
> **Não é preciso**: SDK do JavaScript, `FB.login`, lista de domínios permitidos,
> nem montar o `extras` no nosso código. A Meta hospeda a tela inteira.
>
> **É preciso**: a rota de retorno abaixo, e trocar o `code` por token
> servidor-a-servidor (a seção "Trocar token" do painel).
>
> Guarde `config_id = 1071840912286349` junto dos outros IDs fixos.

**A rota de retorno é o nosso lado do Hosted** — é para onde a Meta devolve o
cliente com o `code`. Já está cadastrada no painel:

```
https://autofluxos.4yu.com.br/api/whatsapp/retorno
```

Espelhe [instagram/retorno/route.ts](src/app/api/instagram/retorno/route.ts), que
já resolveu esse problema: `state` prova **qual cliente** começou (impede link
forjado ligar um número ao cliente errado), a sessão prova **quem está pedindo**
(a rota é pública por obrigação, quem chama é o navegador vindo da Meta), o
cancelamento vem como `error=access_denied` e é resposta e não falha, e o retorno
é **sempre um redirect para a tela**, nunca JSON na cara de quem clicou.

Depois do retorno, **troque o `code` por token servidor-a-servidor** — nunca no
navegador. É a seção "Trocar token" do configurador no painel.

Conferir se um número embarcou em coexistência:

```bash
curl 'https://graph.facebook.com/v21.0/<PHONE_NUMBER_ID>?fields=is_on_biz_app,platform_type' \
  -H 'Authorization: Bearer <TOKEN>'
# coexistente = is_on_biz_app: true  E  platform_type: CLOUD_API
```

### 2b. O fluxo do cliente mudou — **não é mais QR code**

A doc foi atualizada em **21/mai/2026** e descreve outro fluxo. Qualquer tutorial
(ou versão anterior deste documento) que fale em "escanear QR code" está velho.
O que acontece hoje, na tela do cliente:

1. ele escolhe conectar a conta existente e digita o número;
2. a tela mostra um **código de verificação**;
3. ele recebe uma mensagem da **Conta Oficial do Facebook Business** no
   WhatsApp Business dele e toca em **Connect**;
4. toca em **Connect to the Business Platform**, depois **Confirm** — é aqui que
   ele decide compartilhar (ou não) o histórico;
5. **cola o código** e termina o Embedded Signup.

Importa para o suporte: quando um cliente travar, a pergunta certa é "chegou a
mensagem do Facebook Business?" e não "conseguiu ler o QR?".

### 2c. Teste sem cliente real: conta de sandbox

Em **Ferramentas de parceiros → Obter conta de sandbox** a Meta dá uma WABA de
mentira (com portfólio próprio) que completa o Embedded Signup como se fosse um
cliente de verdade — devolve WABA ID, phone number ID e token trocável.

É assim que se testa a frente 3 inteira sem depender do Eduardo nem de um celular
real. No fluxo, escolher **Sandbox Business** como portfólio e **Sandbox WhatsApp
Business Account** como conta.

**Vale 30 dias**, depois desativa e precisa ser reivindicada de novo — então não
reivindique antes de ter o que testar.

### 3. Sincronização: a janela de 24h

Mesmo endpoint, dois disparos, **cada um uma vez só**:

```bash
POST /<BUSINESS_PHONE_NUMBER_ID>/smb_app_data
{ "messaging_product": "whatsapp", "sync_type": "smb_app_state_sync" }   # contatos

POST /<BUSINESS_PHONE_NUMBER_ID>/smb_app_data
{ "messaging_product": "whatsapp", "sync_type": "history" }              # histórico
```

Responde `{"messaging_product":"whatsapp","request_id":"<REQUEST_ID>"}`.
**Grave o `request_id`** — é o que o suporte da Meta pede.

Antes de disparar, garanta que o app está inscrito na WABA **do cliente**
(`subscribed_apps`), senão os webhooks que respondem ao disparo se perdem e a
janela de 24h queima sem volta.

Se o cliente recusou compartilhar histórico, chega um `history` com o código de
erro **2593109**. Isso é resposta normal, não falha — trate como "sem histórico"
e siga.

O `history` chega **fatiado**, e a ordem importa:

- `phase`: `0` = do dia 0 ao 1 · `1` = dia 1 a 90 · `2` = dia 90 a 180
- `chunk_order`: ordene os lotes por ele
- `progress`: 0 a 100

Armadilha de mídia: mensagem com anexo chega com `type: "media_placeholder"` e
**sem conteúdo**. O conteúdo vem num `history` posterior — mas **só se a mensagem
for das últimas duas semanas**. Mídia mais velha que isso não vem nunca; o
placeholder é tudo que vai existir.

### 4. Banco

Leia `BANCO-COMPARTILHADO.md` **inteiro** antes. Resumo do que não dá para
esquecer: banco de produção é compartilhado com a Verandi (`app_verandi`), sem
backup; AutoFluxos vive em `public`; nunca `supabase db push` / `db reset`;
descubra a numeração por `ls supabase/migrations/ | tail -1`, nunca por plano
(inclusive este); **nada aplicado em produção sem autorização explícita do dono**.

Não há Docker nesta máquina (WSL2 sem a integração), então o replay local não
roda. O substituto usado em 12/09 foi o **ensaio em transação**
(`begin; <migration>; rollback;` pela Management API).

O que o schema pede, como sugestão a validar antes de escrever:

- **`channels`**: marcar que o número é coexistente e onde a janela de 24h está
  (`is_on_biz_app`, quando sincronizou contatos, quando sincronizou histórico,
  o `request_id` de cada um). Sem isso não dá para saber se um sync já foi
  gasto — e ele não pode ser repetido.
- **contatos vindos da agenda**: `smb_app_state_sync` traz `full_name`,
  `first_name`, `phone_number` e uma `action` (`add` / `remove`). São contatos da
  **agenda do celular dele**, não gente que conversou com a gente — misturar com
  `contacts` sem distinguir a origem suja a tela de leads. Note que `remove` vem
  sem os nomes, só com o telefone.
- **histórico e echoes**: vão para `messages`. O `wa_message_id` unique já
  protege contra duplicata, inclusive entre o histórico e um echo da mesma
  mensagem. Falta decidir a `direcao` — no payload, `from` igual ao número do
  negócio significa saída; um echo ainda traz `to`.

Um cuidado de produto que o schema não resolve sozinho: mensagem que chega por
`smb_message_echoes` é o **humano falando pelo celular**. Ela deveria pausar o
bot naquela conversa, como um handoff. Já existe `handoffs` e lógica de
`aguardando_http` em `receber-mensagem.ts` — reaproveite em vez de inventar.

## Quem paga o quê (apurado na doc em 13/09, e é contraintuitivo)

**Tech Provider não tem linha de crédito, e isso é bom.** A doc da Meta é
literal: *"Unlike Solution Partners, Tech Providers do not have credit lines.
Instead, clients onboarded by Tech Providers must provide their own payment
method after onboarding is complete. Meta will then bill these clients for API
usage, and the Tech Provider will bill for other services."*

| | Solution Partner | **Tech Provider (nós)** |
|---|---|---|
| Tem linha de crédito | sim | **não** |
| Cliente pula o método de pagamento | sim | **não** |
| Fatura o cliente pelo uso da API | sim | **não — a Meta fatura** |

Ou seja: **a Meta cobra do cliente** pelas conversas, com o cartão dele; **nós
cobramos do cliente** a mensalidade do AutoFluxos, por fora. Não há custo
variável de conversa na nossa conta, nem exposição se um cliente disparar muito.

Se você leu em alguma página do painel que é preciso "compartilhar sua linha de
crédito", repare no sujeito da frase: é *"os Parceiros da Solução precisam"*.
Não é o nosso caso, e no nosso painel a seção aparece vazia.

**A consequência é de produto, e é o que importa aqui:** depois de conectar, o
cliente **precisa cadastrar um cartão** na conta dele, senão a mensagem não sai.
Não é bloqueio nosso, mas é onde ele trava calado — a tela de conexão tem que
avisar disso, e o ideal é conferir e mostrar o estado em vez de deixar o cliente
descobrir pelo silêncio.

## O que a doc oficial não conta (apurado na web em 13/09)

Nada aqui está na documentação da Meta. Veio de quem implementou, e muda decisão.

**1. Sincronizar pode quebrar o WhatsApp Business do cliente.** Há relato aberto
e não resolvido no Chatwoot ([issue #12469](https://github.com/chatwoot/chatwoot/issues/12469),
severidade 1, *"deal breaker, no workaround"*): durante a sincronização de
mensagens e contatos, o app do celular **parou de enviar e receber**, e as
tentativas de reconectar falharam. O relator diz que aquilo "destruiu o negócio"
dele, que vendia só por WhatsApp.

Isso é o pior cenário possível do nosso produto: a gente conecta e o cliente
**perde o celular dele**. Duas consequências práticas:

- **Teste em sandbox antes de qualquer cliente real** (ver 2c). Não estreie no
  número do Eduardo.
- Avise o cliente que a sincronização é o momento de risco, e faça num horário
  em que ele não dependa do WhatsApp — nunca na sexta à tarde.

**2. O cliente precisa abrir o WhatsApp Business a cada 14 dias.** Se não abrir,
a Meta **derruba a conexão** e a entrega de mensagem para. Isso não aparece em
lugar nenhum da doc oficial e é uma fonte silenciosa de "parou de funcionar".
Vale monitorar e avisar antes de cair.

**3. O nome do negócio trava depois do onboarding.** A Meta congela para manter
consistência entre os dois lados. Se o cliente quiser mudar, é antes, não depois.

**4. A sincronização é lenta e pode falhar.** Relatos de **até 6 horas**, e de
falhar de vez. Não desenhe a tela supondo que termina em minutos: ela precisa
mostrar progresso (o webhook traz `progress` 0–100) e tolerar falha.

**5. Grupos não vêm.** Mensagens de grupo não entram na sincronização — nem
histórico, nem echo. Se o cliente atende em grupo, aquilo é invisível para nós.

**6. Taxa de rejeição alta.** Há relato de números recusados na conexão sem
motivo claro. Trate "não deu" como resultado possível do onboarding, com
mensagem honesta na tela, não como bug nosso.

**7. Brasil é suportado** — e desde jun/2026 a cobertura é global, inclusive UE e
Reino Unido, que antes estavam de fora. Mas a elegibilidade é decidida **por
número** no onboarding, não só pelo país: um erro de país não significa que o
mercado está fechado.

**8. Linha de crédito de Coexistence não migra.** Para quem usa (não é o nosso
caso, ver acima), ela não pode ser removida nem transferida para outro provedor.
Vale saber porque significa que **trocar de provedor depois é caro para o
cliente** — é um argumento de venda, e também um motivo para não prometer
portabilidade fácil.

> Fontes: a issue do Chatwoot acima, e as bases de conhecimento de respond.io,
> chakrahq, wati.io e gohighlevel, que documentam o que veem no suporte.

## Limitações que valem dizer ao cliente antes de vender

- Número em coexistência fica travado em **20 mensagens/s**.
- Ao embarcar, **todos os aparelhos vinculados são desvinculados**; ele precisa
  religar um a um depois.
- WhatsApp para Windows e WearOS **não são suportados** — mensagem que a pessoa
  mandar por um deles não dispara webhook, e a gente nunca fica sabendo.
- Exige WhatsApp Business App **2.24.17+** no celular dele.
- Nem todo país é suportado.
- **Verificação padrão do negócio não existe para contas em coexistência** — o
  caminho de verificação do cliente muda. Não prometa o fluxo normal.

## Reconexão: o caso que vai acontecer e ninguém espera

Quando o cliente **troca de celular ou reinstala o WhatsApp Business**, o
companion da Cloud API é desembarcado **sozinho**. Chega
`ACCOUNT_OFFBOARDED` no campo `account_update` (que já assinamos).

Ao receber: **pare os envios pendentes** daquele cliente — eles falham enquanto a
reconexão corre. Depois chega `ACCOUNT_RECONNECTED` e o envio volta.

Normalmente reconecta sozinho em minutos, sem ação nossa. Mas sem tratar esses
dois eventos, a troca de aparelho de um cliente vira uma fila de envios falhando
em silêncio.

## Ordem sugerida

1. Handler dos três campos (com testes de payload) → **depois** assinar na Meta.
2. `ACCOUNT_OFFBOARDED` / `ACCOUNT_RECONNECTED` — barato, e evita falha silenciosa.
3. Migration do estado de coexistência em `channels`.
4. Rota `/api/whatsapp/retorno`, espelhando a do Instagram, + troca do `code`
   por token servidor-a-servidor.
5. Disparo automático dos dois syncs ao fim do onboarding, dentro das 24h.
6. Onde o cliente clica: guardar o link do Hosted e levar o cliente até ele.

Nada aqui depende mais do painel — a decisão Hosted × SDK está fechada.

## Como conferir de verdade

Console não é evidência. O que responde:

```
devtools_app_review  action: privileges    → o que está vigente (não `requirements`)
devtools_app         action: basic_settings → dev_mode, urls
devtools_webhook_list action: list_subscriptions → o que está assinado mesmo
devtools_compliance  action: status        → violações abertas
```

Graph API **não** expõe status de Tech Provider: `solutions`,
`client_whatsapp_business_accounts` e `owned_whatsapp_business_accounts` todos
respondem "nonexisting field". Não perca tempo — isso é MCP e painel.

## `description` e `short_description`: não são pendência, são impossibilidade

Apurado em 13/09, tentando de todos os jeitos. **Não insista nisso.**

- Não há campo na tela `settings/basic` — a tela é só ID, nome, domínios, e-mail,
  URLs, ícone e categoria.
- Pela Graph API, `short_description` responde *"nonexisting field"*, e
  `description` **não volta na leitura** mesmo depois de um POST.
- O POST responde **`{"success":true}` e descarta os campos em silêncio** — o
  `success` não prova nada aqui.

O motivo provável: este app é do formato **Caso de Uso**; esses campos são do
formato antigo. `description: null` no MCP é permanente e não é descuido.

Se alguém sugerir ligar *"Allow API Access to App Settings"* para resolver: já foi
tentado, não resolve, e **deve ficar desligado** — ligado, quem tiver o app secret
pode reconfigurar o app.

**`contact_email_verified: false`** continua aberto e é do dono: não há botão na
tela nem API. O caminho é a caixa de `contato@4yu.com.br` (conferir spam) ou o
suporte da Meta. Importa porque é por onde a Meta avisa de violação e suspensão —
mas **não bloqueia Coexistence**.
