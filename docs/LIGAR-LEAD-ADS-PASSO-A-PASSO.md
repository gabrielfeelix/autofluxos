# Ligar o Lead Ads — passo a passo, com os links

> Escrito em 14/set/2026. O código está pronto e testado; tudo aqui é
> configuração na Meta, que só quem tem a conta consegue fazer.
>
> **IDs desta instalação** — já preenchidos nos links abaixo:
> app `1063817842847269` · portfólio `Portfólio - 4YU` (`1494483661926723`) ·
> WABA `2245936116250161` (`4YU Tech`)

## Antes de começar

Tenha à mão, do **cliente** (a empresa que anuncia):
- a **Página do Facebook** onde o formulário de anúncio roda;
- a **conta de anúncios** dele.

E confirme que o formulário de anúncio **pede telefone**. Sem telefone o lead é
recusado — não é limitação contornável: o contato deste sistema é chaveado por
número de WhatsApp. Se o formulário só pedir e-mail, o lead não tem onde entrar.

---

## Passo 1 — Gerar o token (Usuário do sistema)

**Link:** https://business.facebook.com/settings/system-users?business_id=1494483661926723

1. **Adicionar** → nome (ex.: `autofluxos-ads`) → função **Administrador**.
2. Nesse usuário, **Adicionar ativos**:
   - aba **Contas de anúncios** → a conta do cliente → **Gerenciar campanhas**;
   - aba **Páginas** → a Página do cliente → **Gerenciar Página**.
3. **Gerar novo token** → app **AutoFluxos** (`1063817842847269`) → marcar:

```
ads_read               ler nome de campanha/conjunto/anúncio
leads_retrieval        ler o dado do lead
pages_show_list
pages_read_engagement
pages_manage_metadata  inscrever o webhook
pages_manage_ads
```

4. **Copie o token.** Ele aparece uma vez só.

> **Por que Usuário do sistema e não um token comum:** o token de usuário vence
> em 60 dias e quebra **em silêncio** — a integração para de trazer lead sem
> erro nenhum na tela. Foi assim que a RD Station perdeu 18 dias de leads em
> jul/2024. Token de Usuário do sistema não expira.

---

## Passo 2 — Guardar o token no AutoFluxos

No painel do cliente: **Conexões → Nova**

| Campo | Valor |
|---|---|
| Nome | `meta-ads` (exatamente assim, minúsculo, com hífen) |
| Tipo | `bearer` |
| Valor | o token do passo 1 |

O nome é o que liga as duas pontas. Conexão com outro nome não é usada.

---

## Passo 3 — Inscrever o webhook no app

**Link:** https://developers.facebook.com/apps/1063817842847269/webhooks/

1. No seletor, escolha **Página** (Page).
2. **Assinar este objeto**:
   - **URL de callback:** `https://autofluxos.4yu.com.br/api/webhook/leadgen`
   - **Token de verificação:** o mesmo `WHATSAPP_VERIFY_TOKEN` que o webhook do
     WhatsApp já usa (está no cofre, em `AUTOFLUXOS_WA_VERIFY_TOKEN`).
3. **Verificar e salvar** — a Meta chama a URL na hora; se o token bater, ela
   aceita.
4. Na lista de campos, assine **`leadgen`**. Só esse.

---

## Passo 4 — A Página precisa instalar o app

**Este é o passo que todo mundo esquece, e ele falha em silêncio:** sem ele a
Meta não manda nada, e o painel do passo 3 continua dizendo que está tudo certo.

**Link:** https://developers.facebook.com/tools/explorer/1063817842847269/

1. Em **Token de acesso**, cole o token do passo 1.
2. Método **POST**, e na caixa da URL:

```
{PAGE_ID}/subscribed_apps?subscribed_fields=leadgen
```

trocando `{PAGE_ID}` pelo ID da Página do cliente.

3. **Enviar.** A resposta tem de ser `{"success": true}`.

> Como achar o `PAGE_ID`: **Configurações da Página → Informações**, ou rode
> `GET me/accounts` no mesmo explorador com o token do passo 1 — ele lista as
> Páginas com os ids.

---

## Passo 5 — Dizer de quem é a Página

A Meta manda o lead com o `page_id`, e nada que diga de qual cliente é. Essa
ligação é cadastrada **deste lado**, de propósito: a assinatura do webhook prova
que a Meta mandou, não de quem é o lead — se a rota aceitasse isso do payload,
qualquer um que descobrisse a URL escreveria na conta alheia.

Ainda não há tela. Me passe o **PAGE_ID** e o **nome do cliente**, e eu rodo:

```sql
insert into public.paginas_de_lead (page_id, client_id, nome)
values ('<PAGE_ID>', '<ID_DO_CLIENTE>', '<nome da Página>');
```

Contas que já existem em produção, para referência:

| Cliente | `client_id` |
|---|---|
| Cliente 00 — Gabriel | `4d26cf4c-7c49-485a-8819-68da3931c530` |
| MGM Pilates | `5de5a891-790f-4c14-b60b-ce0a573fe1c7` |
| Academia de Boxe | `ef83b120-553e-4cf0-a861-a8ec8002404c` |

---

## Passo 6 — Testar sem gastar mídia

**Link:** https://developers.facebook.com/tools/lead-ads-testing

1. Escolha a Página e o formulário.
2. **Criar lead** (preencha com um telefone real seu, para ver o contato nascer).
3. A ferramenta mostra uma tabela com o **HTTP que a nossa URL devolveu** — tem
   de ser `200`.

Depois, no AutoFluxos: o contato aparece na lista de leads e como cartão no
quadro padrão da conta.

> **Lead de teste vem sem `ad_id`, por design.** Ele entra sem passagem de
> anúncio, e isso não é bug de atribuição — só acontece com lead de teste.

---

## Se não chegar

| O que você vê | Causa | Onde consertar |
|---|---|---|
| Testing Tool mostra erro ≠ 200 | webhook mal inscrito | passo 3 |
| Testing Tool mostra 200, nada aparece | a Página não instalou o app | passo 4 |
| Alerta "Página não ligada a nenhuma conta" | falta o cadastro | passo 5 |
| Alerta "a conta não tem acesso aos anúncios" | falta a conexão | passo 2 |
| Alerta "o acesso aos leads venceu" | token revogado (código 190) | passo 1, e trocar o valor da conexão |
| Alerta "não trouxe telefone válido" | o formulário não pede telefone | formulário do cliente |

Os alertas ficam em **Admin → Alertas** no painel.

---

## A incerteza honesta

`leads_retrieval` normalmente exige **App Review**. A documentação da Meta diz
que **Standard Access basta quando o app é usado só por quem tem função nele** —
e o arranjo do passo 1 (Usuário do sistema do nosso portfólio, com os ativos do
cliente compartilhados) pode se enquadrar nisso. **A doc não confirma esse caso
específico.**

Por isso o passo 6 é a prova, e ela é barata: se o lead de teste entrar, está
resolvido e não há review a pedir. Se a Meta responder erro de permissão, aí
sim é submeter App Review — e aí o degrau lento já está pago, porque o negócio
foi verificado em 02/09 e o app está **Live** desde 13/09.

Nossa parte, se cair nesse caminho, é preparar a submissão. Me avise o erro
exato que aparecer.
