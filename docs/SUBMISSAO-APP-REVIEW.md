# App Review — o que enviar, palavra por palavra

> Escrito em 14/set/2026. Tudo aqui é para **copiar e colar** no painel da Meta.
> App `1063817842847269` · portfólio `Portfólio - 4YU` (`1494483661926723`).

## O que a pesquisa mudou no plano

**Não dá para testar antes de aprovar.** A doc da Meta é literal: app em modo
Live só exerce permissão aprovada, *"inclusive para usuários que têm função no
app"*. E em modo de desenvolvimento só se lê lead de quem tem função no app.
Não existe configuração em que o arranjo funcione sem review.

**Saída para gravar o vídeo:** criar um **app de teste** a partir do AutoFluxos
(Painel → Configurações → Criar app de teste). Ele nasce em desenvolvimento e
libera todas as permissões para quem tem função — serve para gravar, não para
atender cliente.

**São 7 permissões, não 5.** O caso de uso "Capture & manage ad leads" arrasta
as outras e não deixa removê-las.

**Prazo real: ~9 dias.** Medido na sua submissão anterior (03/set → 12/set), não
os "3 dias" que a doc promete.

**Sem penalidade pendente.** Consultado agora: `compliant`, zero violações.

---

## Antes de submeter

- [ ] App **sem Instagram** nesta submissão — foi o que derrubou a anterior
- [ ] Ícone 1024×1024
- [ ] Política de privacidade pública, dizendo **como pedir exclusão dos dados**
- [ ] Categoria e finalidade do app preenchidas (finalidade = **Clientes**)
- [ ] **Uma chamada real por permissão**, feita nos últimos 30 dias (vale o
      Explorador de API)
- [ ] Conta de demonstração do AutoFluxos criada, com lead de exemplo dentro

---

## As 7 permissões e o que escrever em cada uma

> Escreva em **inglês**. Nunca repita o mesmo texto — a Meta diz explicitamente
> *"do not copy and paste"*, e texto repetido é sinal de submissão fraca.
>
> A expressão **"advertiser authorized CRM platform"** vem do texto oficial de
> uso permitido de `leads_retrieval`. Use-a: é o vocabulário que o revisor
> procura.

### 1. `leads_retrieval`

```
AutoFluxos is an advertiser authorized CRM platform used by marketing agencies
in Brazil. Agencies connect their clients' Facebook Pages so that people who
submit a lead ad form are created as contacts in the CRM, where the client's
sales team contacts them.

We use this permission to read the lead data (name, phone number and the form
answers) as soon as the lead is submitted, so the sales team can call the person
back within minutes instead of exporting spreadsheets by hand.

Without it the advertiser has to download a CSV from Ads Manager and re-type it
into the CRM, which is how leads go cold and how contact data gets duplicated.
The data is used only to contact the person who filled the form, and it is
deleted on request as described in our privacy policy.
```

### 2. `pages_manage_ads`

```
Required together with leads_retrieval to read complete lead data from the
advertiser's Page. Our users are agencies acting on behalf of the advertiser who
owns the Page and the ad account, and this permission is what lets the CRM read
the ad-level information attached to each lead on that Page.
```

### 3. `pages_manage_metadata`

```
We use this permission only to subscribe the advertiser's Page to the `leadgen`
webhook (POST /{page-id}/subscribed_apps). That subscription is what makes a
lead reach the sales team in seconds. Without it we would have to poll the API
on a schedule, which adds minutes of delay to every lead and wastes the Page's
rate limit.
```

### 4. `pages_show_list`

```
When an agency connects a client, we show the list of Facebook Pages that person
manages so they can pick which Page should send leads into that client's CRM
account. Agencies manage several clients, so choosing the wrong Page would send
one client's leads into another client's account. Without this permission the
user would have to find and paste a numeric Page ID by hand.
```

### 5. `pages_read_engagement`

```
After the user picks a Page, we read its name to display it back in the CRM, so
the person can confirm they connected the right Page and recognise it later in
the settings screen. Page IDs are 15-digit numbers and are not recognisable on
their own.
```

### 6. `ads_management`

```
Each lead arrives with an ad_id only. We use this permission to read the ad, ad
set and campaign names for that ad_id, so the sales person sees "Institutional
Campaign — September" on the contact instead of a 16-digit number.

This is the core value of our product for marketing agencies: knowing which
campaign produced each lead, and therefore which campaigns produce customers. We
only read names; we do not create, edit, pause or manage campaigns or budgets.
```

### 7. `ads_read`

```
Read-only access to the ad objects we resolve names from. It is listed as a
dependency of the lead ads use case, and our integration only performs read
operations against ad, ad set and campaign names.
```

### 8. `business_management`

```
Agencies connect their clients through their business portfolio using a system
user token, which does not expire when an employee leaves the company. This
permission is required by that integration flow so the connection survives staff
changes on the client side.
```

---

## O roteiro do vídeo

Regras da Meta que definem o formato:

- **Sem áudio** — o revisor não escuta. Toda explicação é **texto na tela**.
- **Em inglês**, ou com legenda em inglês em cada passo.
- **Comece deslogado.** Começar já logado é reprovação clássica.
- **Cursor grande e visível**, resolução 1080, tela cheia.
- **Toda permissão pedida precisa aparecer sendo usada.** A que não aparecer,
  não é aprovada.

### Os passos

| # | O que mostrar | Que permissão isso prova |
|---|---|---|
| 1 | Sair da conta. Tela de login do AutoFluxos vazia. | — |
| 2 | Entrar com a conta de demonstração. | — |
| 3 | Ir em Configurações → **Anúncios**. | — |
| 4 | Clicar em **Ligar a conta de anúncios**, mostrar o passo a passo do modal, colar o token. | `business_management` |
| 5 | Mostrar o login do Facebook e **a tela de permissões, com as permissões visíveis**. | todas |
| 6 | Escolher a Página numa lista. | `pages_show_list` |
| 7 | A Página aparece ligada, **com o nome**. | `pages_read_engagement`, `pages_manage_metadata` |
| 8 | Na Meta: criar um lead pela ferramenta de teste de Lead Ads. | — |
| 9 | Voltar ao AutoFluxos: **o lead apareceu** na lista. | `leads_retrieval` |
| 10 | Abrir o contato: telefone, respostas do formulário e **o nome da campanha**. | `ads_management`, `ads_read` |
| 11 | Mostrar o cartão dele no funil. | — |

O passo 10 é o mais importante: é o único quadro que prova as duas permissões de
anúncio. Sem ele elas ficam sem evidência e são recusadas.

---

## Instruções para o revisor

Cole no campo de instruções. A Meta reprova instrução que **resume o que o app
faz** ou que **explica a API** — quer passo numerado.

```
AutoFluxos is a WhatsApp inbox and CRM used by marketing agencies in Brazil.
This submission covers ingesting Facebook lead ads into the CRM.

Test account (this is not a Facebook account — it is our own product login):
URL: https://autofluxos.4yu.com.br
User: <PREENCHER>
Password: <PREENCHER>

Steps:
1. Open the URL above and log in with the credentials.
2. In the left menu, open "Configurações", then "Anúncios".
3. Press "Ligar a conta de anúncios" and connect with Facebook.
4. Select a Page you manage. The Page appears in the list below, by name.
5. Submit a test lead for that Page using the Lead Ads Testing Tool.
6. In the left menu, open "Leads". The new contact appears at the top.
7. Open the contact. Phone number, form answers and the originating campaign
   name are shown in the right-hand column.
8. Open "Funil" to see the same contact as a card in the first stage.

The interface is in Portuguese. The screen recording has English captions on
every step.
```

Preencha usuário e senha de uma conta de demonstração — **nunca a sua conta
pessoal**. A Meta diz por escrito para não usar conta pessoal, e criar conta
falsa no Facebook é reprovação imediata.

---

## Depois de enviar

- ~9 dias até a resposta.
- Se reprovar, o retorno diz o motivo. Reenviar é o caminho normal, **exceto**
  quando o texto disser que o *uso* não é aprovável — aí reenviar igual é perda
  de tempo.
- **Não mova o app para outro portfólio.** Portfólio não verificado derruba
  inclusive o que já está aprovado, incluindo o WhatsApp.
