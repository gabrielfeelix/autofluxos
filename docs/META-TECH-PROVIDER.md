# Meta / WhatsApp: o que falta para vender o serviço no número do cliente

> Escrito em 19/08/2026, com o estado apurado pela Graph API no mesmo dia. Os
> comandos que apuraram cada linha estão aqui — refaça-os antes de confiar no
> que está escrito, porque estado da Meta muda sem avisar.

## A fila, e por que ela é uma fila

O objetivo é **atender no número do próprio cliente** — inclusive num número
que ele já usa no WhatsApp Business App, o que a Meta chama de **Coexistence**
(coexistência). Isso não é um botão: é o fim de uma sequência em que cada etapa
destranca a próxima.

```
verificação do negócio  →  app review (Advanced Access)  →  Tech Provider  →  Coexistence
      ✅ feito              ↑ você está aqui
```

> **02/09/2026 — a verificação do negócio saiu.** `business_verification_status`
> passou de `pending` para **`verified`** (conferido pela Graph API na data). Isso
> destrava o app review, e **só ele**. Não destrava vender ainda: as duas
> permissões continuam em Standard Access, então o Embedded Signup segue
> funcionando só para números da própria conta. Ver "E agora?" no fim.

1. **Verificação do negócio é bloqueante.** A documentação da Meta é literal:
   *"Your business must be verified before you can start the app review
   process."* Não há caminho paralelo.
2. **O app review é o que concede o Advanced Access** de
   `whatsapp_business_messaging` (mandar mensagem em nome do cliente) e
   `whatsapp_business_management` (acessar a WABA do cliente). Sem esses dois em
   Advanced, o Embedded Signup só funciona para números da própria conta.
3. **Coexistence exige já ser Tech Provider ou Solution Partner.** Ela não é uma
   alternativa à fila — é o último degrau dela.

Duas armadilhas que valem saber antes de prometer ao cliente:

- **Verificação padrão do negócio não está disponível para contas em
  coexistência** — o caminho de verificação do cliente muda quando o número é
  coexistente.
- **Coexistência não vale para todo número nem toda região**, e exige WhatsApp
  Business App **2.24.17 ou mais novo** no celular do cliente.

## O que já está pronto (apurado, não suposto)

| Item | Estado | Como foi conferido |
|---|---|---|
| App na Meta | **existe** — `AutoFluxos`, id `1063817842847269` | `debug_token` |
| Token de acesso | **permanente**, tipo `SYSTEM_USER` (`expires_at: 0`) | `debug_token` |
| Escopos do token | `whatsapp_business_messaging`, `whatsapp_business_management`, `business_management`, `manage_app_solution`, `whatsapp_business_manage_events` | `debug_token` |
| Webhook | **configurado e ativo** → `https://autofluxos.4yu.com.br/api/webhook/whatsapp` | `GET /{app}/subscriptions` |
| Campos do webhook | `messages`, `account_alerts`, `account_review_update`, `account_update`, `calls`, `message_template_quality_update`, `message_template_status_update`, `phone_number_name_update`, `phone_number_quality_update`, `security` | idem |
| WABA | `4YU Tech` (`2245936116250161`), `account_review_status: APPROVED` | `GET /{waba}` |
| App assinando a WABA | **sim**, o `AutoFluxos` | `GET /{waba}/subscribed_apps` |
| Número | `+55 44 7400-7438` (`1301107846409860`), `CLOUD_API`, `VERIFIED`, qualidade `GREEN`, throughput `STANDARD` | `GET /{waba}/phone_numbers` |
| **Verificação do negócio** | **`verified`** (02/09/2026; era `pending` em 19/08) | `GET /{waba}?fields=business_verification_status` |
| Política de privacidade | **criada agora**: `https://autofluxos.4yu.com.br/privacidade` | `src/app/privacidade/page.tsx` |

Ou seja: **o número não é de teste** — é número real, verificado e entregando.
O que trava agora é o **app review**; a verificação do negócio saiu em 02/09/2026.

### Os comandos

Carregam o `.env` do repositório e não imprimem segredo nenhum.

```bash
set -a && . ./.env && set +a
APP=1063817842847269
WABA=2245936116250161

# quem é o token, que escopos tem, quando vence (0 = nunca)
curl -s "https://graph.facebook.com/v21.0/debug_token?input_token=$WHATSAPP_TOKEN&access_token=$WHATSAPP_TOKEN" | python3 -m json.tool

# o webhook do app: para onde aponta e que eventos assina
curl -s "https://graph.facebook.com/v21.0/$APP/subscriptions?access_token=$APP|$META_APP_SECRET" | python3 -m json.tool

# a WABA: revisão da conta e verificação do negócio
curl -s "https://graph.facebook.com/v21.0/$WABA?fields=id,name,account_review_status,business_verification_status,ownership_type&access_token=$WHATSAPP_TOKEN" | python3 -m json.tool

# os números e a qualidade deles
curl -s "https://graph.facebook.com/v21.0/$WABA/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status,platform_type,throughput&access_token=$WHATSAPP_TOKEN" | python3 -m json.tool
```

## O que dá para adiantar (agora vale para o app review)

- [x] **Webhook** apontando para produção e assinando `messages`. Já está.
- [x] **Política de privacidade em URL pública** — exigência do app review, e o
      campo estava vazio no app. `https://autofluxos.4yu.com.br/privacidade`.
      Falta **colar essa URL no painel do app** (é campo de UI, não tem API).
- [ ] **Ícone e categoria do app**, na mesma tela de Configurações → Básico.
- [ ] **Os dois vídeos do app review**, que é o que mais atrasa gente:
      1. um mostrando uma mensagem sendo criada e **chegando** num WhatsApp;
      2. outro mostrando a criação de um **template** (pelo painel ou pela API).
      Os dois dá para gravar hoje, com o número que já está no ar.
- [ ] **Revisar o texto da política** (razão social e CNPJ não entraram — não
      invento dado cadastral). Se a 4YU tiver CNPJ registrado, ele deve aparecer
      lá.

## Como conferir se o app tem o use case "WhatsApp"

Não há endpoint público que responda isso de fora; é tela.

1. `developers.facebook.com/apps` → abra o app **AutoFluxos**.
2. No menu da esquerda, procure **WhatsApp**. Se ele aparece com
   *Início rápido*, *Configuração da API* e *Configuração* — o use case está
   adicionado.
3. Se não aparecer: **Painel** → **Adicionar caso de uso** (ou *Add use case*) →
   escolha **WhatsApp**.

Na prática, o estado do banco de dados da Meta já responde por você: o app
**assina a WABA** e **recebe os webhooks de `messages`**, o que só existe com o
produto WhatsApp adicionado. A conferência na tela é confirmação, não descoberta.

## Onde ver a verificação do negócio

`business.facebook.com` → **Configurações do negócio** → **Central de segurança**
(ou *Informações do negócio* → *Verificação*). É lá que saiu de `pending` em
02/09/2026. Com ela feita, a próxima etapa — o app review — passa a estar disponível no painel do app,
em **Revisão do app** → **Permissões e recursos**, onde se pede o Advanced Access
das duas permissões citadas acima.

## E agora? (02/09/2026)

**Ainda não dá para vender atendimento no número do cliente.** Verificação do
negócio aprovada é o *primeiro* degrau, não o último. O que falta:

1. **App review** — pedir **Advanced Access** de `whatsapp_business_messaging` e
   `whatsapp_business_management` em *Revisão do app → Permissões e recursos*.
   Enquanto estiverem em Standard, o Embedded Signup só embarca números da
   própria conta: dá para atender **no nosso número**, não no do cliente.
2. **Tech Provider** — sai do app review aprovado.
3. **Coexistence** — último degrau, e exige já ser Tech Provider.

Ou seja: a resposta a "já podemos começar os negócios?" é **sim, com o nosso
número; não, no número do cliente**. E "tem que fazer o rolê do coexistence?" —
tem, mas ainda não é a vez dele; coexistence é o fim da fila, não um atalho.

**Bloqueadores concretos do app review, conferidos hoje:**

- [x] `privacy_policy_url` **preenchido** — `https://autofluxos.4yu.com.br/privacidade`.
      Estava vazio em 02/09; foi colado no painel e o MCP confirmou em 03/09.
      `terms_of_service_url` também entrou (`/termos`).
- [x] Categoria do app: `BUSINESS`.
- [ ] `data_deletion_url` está com o valor de placeholder `https://www.facebook.com/`.
      Isso reprova a submissão. Ver a seção de 03/09 abaixo.
- [ ] Ícone do app (`app_icon_url` continua nulo) e `description`, em
      Configurações → Básico.
- [ ] `contact_email` (`contato@4yu.com.br`) **não verificado**.
- [ ] Os dois vídeos do app review (mensagem chegando; template sendo criado).

O que já está pronto e não precisa refazer: token permanente com os escopos
certos, webhook em produção assinando `messages`, WABA `APPROVED`, número real
`+55 44 7400-7438` verificado com qualidade `GREEN`.

## O Instagram: o código já existe, e ele muda a conta da fila

Escrito em 03/set/2026, no commit `18f9dee`. Vale registrar porque muda o que o
app review destrava.

**Direct do Instagram não passa pelo Facebook Login.** A tabela de permissões da
documentação da Meta exclui `messages` daquele lado: por lá dá para ler
comentário e métrica, e não dá para receber nem mandar mensagem. O caminho é o
**Instagram Login** (Business Login), com OAuth próprio, host
`graph.instagram.com`, e as permissões `instagram_business_basic` e
`instagram_business_manage_messages`.

Consequência para a fila: **são dois app reviews, não um.** As permissões do
WhatsApp (`whatsapp_business_messaging`, `whatsapp_business_management`) e as do
Instagram são revisadas separadamente, cada uma com os próprios vídeos. Elas não
dependem uma da outra — dá para submeter as duas na mesma leva, e a aprovação de
uma não espera a outra.

O que já está pronto e não precisa ser feito depois da aprovação: adaptador de
entrega, webhook com validação de assinatura, o OAuth inteiro com `state`
assinado, o token de 60 dias guardado no Vault com a validade vigiada, e a tela
de conectar em `/clientes/<id>/instagram`.

O que falta é só o Advanced Access. Em Standard, o Business Login embarca
apenas contas ligadas à própria conta da Meta da 4YU — dá para demonstrar no
nosso perfil, não no do cliente. É a mesma distinção do WhatsApp, e pela mesma
razão.

## 03/09/2026 — o que o MCP DevTools da Meta mostrou

A partir daqui o estado do app dá para apurar sem abrir o painel: a Meta publica
um servidor MCP oficial que lê configuração, permissões, webhooks, compliance e
app review. Instalação e uso estão na seção seguinte.

**Compliance: limpo.** `overall_status: compliant`, zero violação aberta, zero
ação obrigatória. Rate limit em 0%, `effective_users_count: 1` — número que não
serve para decidir nada enquanto só nós usamos o app.

**App review: existe um rascunho parado.** `submission_status: UNSUBMITTED`,
`submission_id 1082311667664553`. Dentro dele estão `public_profile`,
`business_management`, `manage_app_solution`, `whatsapp_business_messaging`,
`whatsapp_business_management` e `whatsapp_business_manage_events`. Nunca foi
enviado.

**Só uma permissão está concedida de fato:**

| Permissão | grant_status | access_level |
|---|---|---|
| `openid` | `DEVOPS_APPROVED` | `standard` |
| `whatsapp_business_messaging` | `REJECTED` | `none` |
| `whatsapp_business_management` | `REJECTED` | `none` |
| `business_management` | `REJECTED` | `none` |
| `manage_app_solution` | `REJECTED` | `none` |
| `whatsapp_business_manage_events` | `REJECTED` | `none` |
| `public_profile`, `email` | `REJECTED` | `none` |

O `REJECTED` assusta e não é reprova de análise: `rejection_reasons` vem vazio em
todas, e a submissão nunca saiu. É o estado default de quem ainda não pediu. O
efeito prático, porém, é idêntico ao de uma reprova — `access_level: none`.

Isso não contradiz o que está escrito acima sobre o token funcionar: o token é
`SYSTEM_USER` da própria conta, e Standard Access atende número da própria
conta. O que `none`/Standard impede é o número **do cliente**.

**Três coisas que o painel não deixa óbvias:**

1. **`data_deletion_url` é placeholder.** Está em `https://www.facebook.com/`.
   É o item mais barato de arrumar e trava a submissão inteira depois. Precisa
   ser uma URL nossa que realmente apague dado de usuário mediante pedido.
2. **`contact_email_verified: false`** para `contato@4yu.com.br`.
3. **Não existe webhook de Instagram.** A única assinatura do app é
   `whatsapp_business_account`. O Inbox de direct (commit `a86efab`) não recebe
   evento nenhum em produção: falta a subscription de `instagram`, e as
   permissões `instagram_business_basic` / `instagram_business_manage_messages`
   sequer estão no rascunho de submissão.

**Ordem sugerida:** arrumar o `data_deletion_url` → verificar o e-mail de
contato → subir ícone e descrição → acrescentar o Instagram ao rascunho →
gravar os vídeos → submeter.

## Instalar o MCP DevTools da Meta (para continuar de outra máquina)

O servidor é oficial da Meta e é HTTP remoto — não instala nada local, só
autentica no navegador com a conta que tem papel no app.

```
https://mcp.facebook.com/devtools
```

**Neste repositório já está configurado** em `.mcp.json` (commit `c91be7f`), e o
arquivo é versionado. Então, na máquina de casa, basta clonar o repositório e
abrir o Claude Code nele: ele oferece o servidor `meta-devtools`, você aprova, e
na primeira chamada abre o OAuth no navegador. Faça o login com a conta que é
**admin do app `AutoFluxos`** — o MCP só enxerga app em que a conta tem papel de
developer, admin ou tester.

Fora deste repositório, ou em outro cliente MCP:

```bash
claude mcp add --transport http meta-devtools https://mcp.facebook.com/devtools
```

Confirme que ficou de pé listando os apps — devem aparecer três
(`garimpo-rede social`, `claude-garimpo`, `AutoFluxos` id `1063817842847269`),
todos com papel `admin` e permissões `read` + `manage`.

O que ele responde, e que evita abrir o painel: configuração básica e avançada
do app, segurança e restrições, status e histórico de app review com as
permissões uma a uma, compliance, rate limit e volume de chamadas, depreciações
da Graph API, tópicos e assinaturas de webhook (inclusive disparar teste), e
busca na documentação da Meta.

O que ele **não** faz: nada de WhatsApp Business em si — WABA, número,
qualidade e template continuam sendo `curl` na Graph API, com os comandos que já
estão na seção "Os comandos" acima.

## Fontes

- [Become a Tech Provider — Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers)
- [Onboard WhatsApp Business app users (Coexistence) — Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users/)
- [Embedded Signup — Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview/)
- [WhatsApp Coexistence — 360dialog](https://docs.360dialog.com/partner/onboarding/whatsapp-coexistence)
