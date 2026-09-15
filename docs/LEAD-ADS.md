# Lead Ads — o lead do formulário, sem intermediário

> Construído em 14/set/2026. Substitui o LeadsBridge/Pluga/Zapier que a agência
> paga hoje para tirar o lead do Facebook e jogar numa planilha.

## O que mudou para o cliente

| | Antes (com intermediário) | Agora |
|---|---|---|
| Caminho | Meta → LeadsBridge → planilha → olho humano | Meta → AutoFluxos |
| Custo | R$ 89 a R$ 359/mês, por fora | nenhum |
| Atraso | 5 a 15 minutos | segundos |
| Dado pessoal | passa por mais uma empresa | não sai daqui |
| De qual campanha veio | perdido no caminho | fica no histórico do lead |

O lead preenche o formulário dentro do Facebook, **sem nunca abrir conversa**, e
aparece no funil com telefone, nome, as respostas que deu e o anúncio de onde
veio.

## Como ligar, uma vez por cliente

### 1. O token de Ads

É o mesmo da conexão `meta-ads` — se o cliente já ligou o nome da campanha
(ver [CONEXOES.md](CONEXOES.md)), **não precisa de outro**. Se ainda não:
System User token no Business Manager, `ads_read`, colado numa Conexão chamada
exatamente `meta-ads`, tipo `bearer`.

Para Lead Ads o token precisa também de `leads_retrieval` — ver "Permissões"
abaixo.

### 2. Inscrever o webhook

No painel do app Meta: **Webhooks → Page → `leadgen`**, apontando para

```
https://autofluxos.4yu.com.br/api/webhook/leadgen
```

com o mesmo `WHATSAPP_VERIFY_TOKEN` que o webhook do WhatsApp já usa.

### 3. A Página precisa instalar o app

**É o passo que todo mundo esquece**, e sem ele nada chega — com tudo parecendo
certo no painel:

```
POST /{page-id}/subscribed_apps?subscribed_fields=leadgen
```

com token de alguém que tenha a tarefa `ADVERTISE` na Página. A doc da Meta é
literal: *"Webhook notifications will only be sent if your Page has installed
your Webhooks configured-app"*.

### 4. Ligar a Página à conta, deste lado

A tabela `paginas_de_lead` (0051) traduz `page_id` para conta. Enquanto não há
tela, é uma linha no banco:

```sql
insert into public.paginas_de_lead (page_id, client_id, nome)
values ('<page_id>', '<cliente_id>', 'Página do cliente X');
```

**Por que não vem do corpo do webhook:** a assinatura prova que a Meta mandou,
não de quem é o lead. Se a rota aceitasse um `cliente_id` informado no payload,
qualquer um que descobrisse a URL escreveria na conta alheia — com a assinatura
conferindo.

## Permissões

Para ler `field_data` são necessárias, além do que já temos:

```
leads_retrieval        ler o dado do lead   ← Advanced Access + Business Verification
ads_management         campos de anúncio
pages_show_list
pages_read_engagement
pages_manage_metadata  webhooks
pages_manage_ads
```

Dois pontos que economizam tempo:

- **App em Development mode não lê lead nenhum.** A doc é explícita. É o mesmo
  gênero de armadilha do `403 Release in track targeting no countries` do Play:
  o console diz que está tudo certo e a API recusa por um estado que não é
  permissão nem código. O app já está **Live** desde 13/09/2026.
- **Talvez não precise de App Review.** A doc de níveis de acesso diz que
  Standard Access basta se o app for usado só por quem tem função nele, e o
  arranjo System User + Business Manager (o cliente adiciona a agência como
  parceira) pode se enquadrar. **Não confirmado em doc** para
  `leads_retrieval` — a prova barata é montar com um cliente real e chamar
  `GET /{LEAD_ID}`. Se vier `field_data`, está resolvido.

O diagnóstico oficial quando não vier:

```
GET /{page_id}?fields=has_lead_access.user_id({user_id})
```

devolve `failure_reason` e `failure_resolution`. Mas, pela lição do
`health_status`, o teste real é **buscar um lead**, não ler campo de status.

## O que acontece quando chega um lead

1. A Meta chama `/api/webhook/leadgen` com **só os IDs** — nunca o dado.
2. A rota confere a assinatura, responde `200` e processa depois. **Responder
   antes não é otimização**: a Meta não reentrega depois de um `200` e
   reentrega tudo depois de um erro, então uma Graph lenta viraria lead
   duplicado.
3. Para cada aviso: busca o lead, traduz, cria o contato, guarda as respostas em
   `campos`, registra a passagem pelo anúncio e põe no quadro padrão.
4. Um cron diário (`/api/manutencao/leads-do-formulario`, 07:30) varre os
   formulários das últimas 48h e pega o que o webhook não trouxe.

## O que recusa, e por quê

**Formulário sem telefone.** `contacts` tem `wa_id not null`, e a migration do
Kanban diz que *"o cartão É um contato"* — telefone é a identidade deste sistema.
Lead sem como falar com ele é linha de planilha, não lead. A recusa vira alerta
com o motivo escrito, porque a correção é no formulário do cliente.

**Telefone repetido não é recusa.** É a mesma pessoa preenchendo de novo, ou
quem já conversava respondendo um anúncio. O contato fica como está — renomear
com o nome do formulário apagaria a correção feita à mão — e a passagem daquela
vez é registrada.

## Quando algo não chega

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Nenhum lead, nunca | a Página não instalou o app | refazer o passo 3 |
| Alerta "Página não ligada a nenhuma conta" | falta o passo 4 | inserir em `paginas_de_lead` |
| Alerta "a conta não tem acesso aos anúncios" | falta a conexão `meta-ads` | ver [CONEXOES.md](CONEXOES.md) |
| Alerta "o acesso aos leads venceu" | token revogado (código 190) | gerar outro e trocar o valor |
| Lead sem telefone recusado | o formulário não pede telefone | incluir o campo no formulário |
| Lead atrasado horas | o webhook falhou; a reconciliação pegou | nada; é a rede funcionando |

A **Lead Ads Testing Tool** da Meta cria lead falso e mostra o HTTP que a nossa
URL devolveu. É o "prove fora do console" deste caminho — use antes de culpar o
código. Lead de teste não tem `ad_id`, por design: não é bug de atribuição.

## O que ainda não existe

- **Tela para ligar Página e ver formulários.** Hoje é `insert` no banco. Vale
  quando houver o segundo cliente.
- **Conversions API** — mandar de volta "este lead virou venda" para a Meta
  otimizar. O `ctwa_clid` já é guardado desde o CTWA, e o `lead_da_meta` fica em
  `campos`; é o que mantém essa porta aberta. Integrações nativas famosas
  (HubSpot, Zoho) **não guardam** o lead id e ficam trancadas fora desse loop.
