# Handoff 23/out/2026: PagBank na cobrança pelo chat

Estado: pesquisado, não começado. A InfinitePay entrou em `5be24fd8` e é o
molde mais recente de gateway novo; o Mercado Pago é o molde de OAuth.

## Por que PagBank

Pesquisa a fundo em `docs/MERCADO-COBRANCA-NO-CHAT.md` ("Pesquisa a fundo").
OAuth de verdade (Connect), Pix copia e cola na conversa (`POST /orders` com
`qr_codes`), sandbox, base enorme de pequeno negócio.

## Plano

1. **Migration** (número pelo diretório, `ls supabase/migrations | tail -1`):
   aceitar `pagbank` nos três `*_gateway_check`, como a `0149`.
2. **`channels/pagbank.ts`** implementando `GatewayDePagamento`
   (`channels/pagamento.ts`): `criarCobranca` com `POST /orders`
   (`reference_id` = referência, `qr_codes[].amount.value` em centavos,
   `notification_urls` com o endereço da organização e segredo derivado, como
   em `channels/infinitepay.ts`), `lerPagamento` relendo `GET /orders/{id}` com
   o token do dono, `cancelarPagamento` se a API permitir. Registrar em
   `GATEWAYS` e `NOME_DO_GATEWAY`, `server/cobrancas.ts`, `core/api/cobrancas.ts`,
   catálogo e logo.
3. **Conectar por OAuth** no molde do Mercado Pago: `acaoConectarMercadoPago`
   (`server/acoes-pagamentos.ts`), `state` assinado por `iniciarConexao`, rota
   de retorno aberta no `proxy.ts` (ver o comentário de `PREFIXOS_ABERTOS`),
   troca do `code` em `/oauth2/token` (vale 10 minutos, uso único), escopos
   `payments.create payments.read checkout.create accounts.read`.
4. **Renovação**: o refresh invalida o anterior; entrar em
   `renovarTokensDePagamento` (manutenção diária). Duração do token não
   confirmada: ler da resposta.
5. **Aviso**: `x-authenticity-token` (SHA-256 de `token-corpo`) tem relatos de
   falha; a defesa é o segredo no endereço mais reler o pedido, como no Asaas.
6. **Ambiente**: `PAGBANK_CLIENT_ID` e `PAGBANK_CLIENT_SECRET` no cofre e na
   Vercel; sandbox em `sandbox.api.pagseguro.com` e
   `connect.sandbox.pagbank.com.br`. Sem as variáveis, o cartão diz "em
   liberação", como o Mercado Pago.

## Depende do Gabriel

Criar a aplicação no PagBank com a conta da empresa
(https://developer.pagbank.com.br/reference/criar-aplicacao) e passar
`client_id` e `client_secret`. Autorizar a migration em produção.
