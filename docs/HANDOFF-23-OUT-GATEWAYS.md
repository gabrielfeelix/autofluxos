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
| InfinitePay | pronto e no ar; `0149` aplicada em 23/out | `5be24fd8` |
| PagBank | pronto; `0150` aplicada em 23/out; faltam `PAGBANK_TOKEN`, `PAGBANK_CLIENT_ID`, `PAGBANK_CLIENT_SECRET` | ver `git log -- src/channels/pagbank.ts` |
| Woovi, PagHiper, Stripe, Efí, Iugu, Pagar.me | prontos no código, testados só com respostas simuladas; **`0151` não aplicada** | ver `git log -- src/channels/woovi.ts` |
| Inter, Sicoob, Cielo, Cora | esperam a Base 3 (`docs/gateways/PLANO-GATEWAYS.md`) | |

## Como um gateway entra (molde: InfinitePay, `5be24fd8`)

**Credencial colada (molde novo, 23/out):** canal em `src/channels/<gateway>.ts`
com `conectar<G>`, `pagamentoDoAviso<G>` e, se cadastrar aviso, `apagarAviso<G>`;
registro em `src/server/gateways-por-campos.ts` (campos da tela, onde achar);
o aviso cai em `api/webhook/pagamento/[gateway]/[clienteId]` sem rota nova, e o
cartão sai da lista `fichas` em `ajustes/pagamentos/page.tsx`. O que segue
abaixo é o caminho de quem tem login próprio (OAuth) ou formato fora do comum.

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

## PagBank: como ficou

Código em `src/channels/pagbank.ts` (o comentário do topo tem as quatro
diferenças), retorno em `api/pagamentos/pagbank/retorno`, aviso em
`api/webhook/pagbank/[endereco]`. O que a documentação não deixava óbvio:

- A troca do `code` e o refresh levam `X_CLIENT_ID`, `X_CLIENT_SECRET` **e**
  `Authorization: Bearer <token da conta da 4YU>`. Por isso há
  `PAGBANK_TOKEN`, além das duas do plano.
- A aplicação se cria pela API (`POST /oauth2/application`, com o mesmo token),
  com `redirect_uri` = `https://autofluxos.4yu.com.br/api/pagamentos/pagbank/retorno`.
  Preview não conecta: o endereço não bate.
- `state` só alfanumérico: o bilhete é reescrito (`stateDoPagBank`).
- `notification_urls` até 100 caracteres: id da organização e segredo em
  base64url (97 no total). Passou de 100, o pedido sai sem aviso.
- `customer.tax_id` obrigatório: sem CPF, `falta_documento`, como o Asaas.
- Não há cancelar QR não pago; ele vence no `expiration_date`, que é o
  vencimento da cobrança.
- `PAGBANK_SANDBOX=1` conecta em sandbox (`ambiente = 'teste'`).
- Não testado contra a API de verdade: falta o token. Primeiro teste: sandbox,
  conectar, cobrar, pagar o QR pelo simulador, conferir o aviso.

Depois: **`docs/gateways/PLANO-GATEWAYS.md`** (pesquisa de 25 gateways, ordem
em ondas, bases a construir antes e o que depende do Gabriel).

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

- Testar a InfinitePay com R$ 1 de verdade (ela não tem sandbox).
- Gerar o token da conta PagBank da empresa (e o de sandbox) e passar ao
  agente, que cria a aplicação. Ver `PENDENCIAS-DO-GABRIEL.md`.
- Mercado Pago e Asaas: ver `PENDENCIAS-DO-GABRIEL.md`.
