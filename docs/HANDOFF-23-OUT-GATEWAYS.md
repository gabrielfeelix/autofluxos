# Handoff 23/out/2026: gateways da cobrança pelo chat

Para o próximo agente. A cobrança pelo chat deixa o **dono conectar a conta
dele** e cobrar quem conversa; o dinheiro vai direto para ele, sem comissão
nossa. Leia antes: `docs/MERCADO-COBRANCA-NO-CHAT.md` (pesquisa, seções
"Gateways", "Maquininhas" e "Pesquisa a fundo") e `docs/BANCO-COMPARTILHADO.md`
(regras do banco, obrigatório).

## Onde está

| Gateway | Estado | Commit |
|---|---|---|
| Mercado Pago | pronto; espera o Gabriel criar a aplicação (`MERCADO_PAGO_CLIENT_ID/SECRET`) | `b00410cc` |
| Asaas | pronto; testado só com respostas simuladas, espera chave do sandbox | 0141 a 0145 |
| InfinitePay | pronto no código e no ar; **a `0149` não está aplicada em produção** (conectar diz "em liberação") | `5be24fd8` |
| **PagBank** | **próximo**, não começado | |
| Woovi, Pagar.me | depois, se pedirem | |

## Como um gateway entra (molde: InfinitePay, `5be24fd8`)

- `src/channels/pagamento.ts`: `GATEWAYS`, `NOME_DO_GATEWAY` e a interface
  `GatewayDePagamento` (`criarCobranca`, `lerPagamento`, `cancelarPagamento`;
  recorrência opcional).
- `src/channels/<gateway>.ts`: traduz. **Nunca confiar no corpo do aviso**:
  só o id sai dele, e o pagamento é relido na API com o acesso do dono.
- `src/server/cobrancas.ts`: registro em `GATEWAYS`; `aplicarPagamento` é quem
  muda a cobrança.
- Aviso: `src/app/api/webhook/<gateway>/[clienteId]/route.ts`, segredo derivado
  do `BETTER_AUTH_SECRET` por organização, conferido **antes** do banco;
  responde 200 sempre e alerta na falha. Teste obrigatório em
  `src/app/api/webhook/assinatura-obrigatoria.test.ts`.
- Conexão: `src/server/acoes-pagamentos.ts` + cartão em
  `src/app/clientes/[clienteId]/ajustes/pagamentos/page.tsx` (um gateway por
  vez: `outro(gateway)`), catálogo em `src/server/catalogo-de-integracoes.ts`,
  logo em `src/components/design/logos-de-marca.tsx` (cor em `globals.css`),
  mapa de logos em `ajustes/integracoes/page.tsx`, tipo público em
  `src/core/api/cobrancas.ts` e doc em `src/components/docs/paginas-api.tsx`.
- Banco: o nome do gateway é restrito por `*_gateway_check` em
  `conexoes_de_pagamento`, `cobrancas` e `assinaturas`. Gateway novo = migration
  que recria os três (molde: `0149`). Número pelo diretório.

## PagBank: o plano

OAuth de verdade (Connect), Pix copia e cola na conversa, sandbox.
Documentação: https://developer.pagbank.com.br/docs/connect ,
/docs/connect-authorization , /reference/obter-access-token ,
/reference/criar-aplicacao , /reference/criar-pedido ,
/reference/confirmar-autenticidade-da-notificacao .

1. Migration aceitando `pagbank` nos três checks.
2. `channels/pagbank.ts`: `criarCobranca` com `POST /orders` (`reference_id` =
   referência, `qr_codes[].amount.value` em centavos, `notification_urls` com o
   endereço da organização e o segredo); `lerPagamento` relendo
   `GET /orders/{id}` com o token do dono; cancelar se a API permitir.
3. Conectar por OAuth no molde do Mercado Pago (`acaoConectarMercadoPago`,
   `state` de `iniciarConexao`, rota de retorno em `PREFIXOS_ABERTOS` do
   `src/proxy.ts`, leia o comentário de lá). `code` vale 10 minutos, uso único.
   Escopos: `payments.create payments.read checkout.create accounts.read`.
4. Renovação em `renovarTokensDePagamento` (manutenção diária). O refresh
   invalida o anterior. Duração do token: ler da resposta, não chutar.
5. O `x-authenticity-token` do aviso tem relatos de falha: a defesa é o segredo
   no endereço mais reler o pedido.
6. `PAGBANK_CLIENT_ID` e `PAGBANK_CLIENT_SECRET` no cofre e na Vercel; sem
   eles, o cartão diz "em liberação". Sandbox: `sandbox.api.pagseguro.com`,
   `connect.sandbox.pagbank.com.br`.

Depois: **Woovi** (OAuth WooviApps, só Pix; confirmar se o escopo cria
cobrança) ou **Pagar.me** (secret key colada, cartão, Pix, boleto e
assinatura). Bancos com certificado (Inter, Sicoob, Efí) só se um cliente
pedir: o dono teria de subir certificado.

## Regras deste projeto que custaram caro

- Produção é dividida com a Verandi. **Nenhuma migration em produção sem
  autorização explícita do Gabriel.** Antes: replay em Docker
  (`npx supabase start` e `npx supabase db reset --local`; o Docker Desktop
  pode precisar ser aberto) e ensaio em transação com `rollback` pela
  Management API (`SUPABASE_ACCESS_TOKEN` do cofre, ref `xxxynoshwirupkdzwxbj`).
  Registrar em `docs/BANCO-COMPARTILHADO.md`.
- Validar com `npx tsc --noEmit` e os testes do que mexeu; **não rodar a suíte
  inteira**. Um processo pesado por vez na WSL.
- Formatação: aspas simples, sem ponto e vírgula. Não rodar `prettier` sem
  `--single-quote --no-semi --print-width 140`.
- Sem travessão em nenhum texto. Placeholder começa com "Exemplo:".
- UI: print em 1440 e 390 antes de entregar (o Supabase local permite a tela
  real; sem ele, página de prévia temporária em `src/app/demo/`, apagada antes
  do commit).
- Push: `GITHUB_TOKEN` do cofre por credential helper inline. A Vercel é Hobby
  e a cota é dividida com a Verandi: juntar commits e conferir o READY.
- O que depender do Gabriel vai para `4yu-apps/PENDENCIAS-DO-GABRIEL.md`.

## Depende do Gabriel

- Autorizar a `0149` em produção; testar a InfinitePay com R$ 1 de verdade
  (ela não tem sandbox).
- Criar a aplicação no PagBank e passar `client_id` e `client_secret`.
- Mercado Pago e Asaas: ver `PENDENCIAS-DO-GABRIEL.md`.
