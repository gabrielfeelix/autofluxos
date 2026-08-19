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
        ↑ você está aqui
```

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
| **Verificação do negócio** | **`pending`** | `GET /{waba}?fields=business_verification_status` |
| Política de privacidade | **criada agora**: `https://autofluxos.4yu.com.br/privacidade` | `src/app/privacidade/page.tsx` |

Ou seja: **o número não é de teste** — é número real, verificado e entregando.
O que trava é só a verificação do negócio.

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

## O que dá para adiantar enquanto a verificação corre

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
(ou *Informações do negócio* → *Verificação*). É lá que sai de `pending`. Quando
sair, a próxima etapa — o app review — passa a estar disponível no painel do app,
em **Revisão do app** → **Permissões e recursos**, onde se pede o Advanced Access
das duas permissões citadas acima.

## Fontes

- [Become a Tech Provider — Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers)
- [Onboard WhatsApp Business app users (Coexistence) — Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users/)
- [Embedded Signup — Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview/)
- [WhatsApp Coexistence — 360dialog](https://docs.360dialog.com/partner/onboarding/whatsapp-coexistence)
