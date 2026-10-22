# Handoff: 22/out/2026, cobrança no chat e as frentes paralelas

Para o agente que continua. O Gabriel cria a aplicação do Mercado Pago **mais
tarde**; até lá, adiante as frentes abaixo que não dependem dele. Continua
`docs/HANDOFF-21-OUT-PROXIMAS-FEATURES.md`.

## Leia antes (nesta ordem)

1. `docs/PLANO-COBRANCA-CAMADA-1.md`: plano **aprovado** (4 decisões tomadas:
   Operação para cima, dono e gerente cobram e atendente só com permissão, Pix
   vence em 24h no Inbox, mensagem nativa `order_details` como última etapa).
2. `docs/MERCADO-COBRANCA-NO-CHAT.md`: por que conta do dono, sem porcentagem.
3. `docs/BANCO-COMPARTILHADO.md` e `AGENTS.md` antes de qualquer migration.
4. `docs/vantagens/VANTAGENS-AUTOFLUXOS.md`: feature nova entra no dia.

## O que está no ar (conferido `READY` na Vercel)

| Commit | O quê |
|---|---|
| `39cf884c` | "SAIR" tira das promoções; aceite do site e do Lead Ads registrado; erro 131050 vira desistir. Núcleo em `src/core/consentimento.ts` |
| `b00410cc` | Etapa A da cobrança: Ajustes > Pagamentos, OAuth do Mercado Pago (`src/channels/mercado-pago.ts`), token no cofre (`src/server/repos/pagamentos.ts`), renovação diária, Mercado Pago em Todas as conexões |

**A `0141_cobrancas` NÃO está em produção** (só no Docker local). O código trata
a tabela ausente como "não conectado". Como ela ainda não foi aplicada, **pode
ser editada**: acrescentar `'asaas'` aos dois `check (gateway in (...))` ali
mesmo, em vez de abrir uma `0142` só para isso. Confira com
`ls supabase/migrations | tail -1` antes.

## Bloqueado no Gabriel (não cobrar de novo; está em `PENDENCIAS-DO-GABRIEL.md`)

- Aplicação do Mercado Pago (Client ID e Secret) e autorização para aplicar a
  `0141` em produção. Sem isso: login real e Pix real do Mercado Pago.

## Frentes, em ordem de recomendação

### 1. Cobrança independente de gateway, com Asaas primeiro de verdade (5 a 7 dias)
O que dá para fazer sem o Mercado Pago, e o que mais adianta a etapa B:
- **Interface de gateway** em `src/channels/` (criar cobrança Pix e link, ler
  pagamento, validar webhook). Mercado Pago e Asaas atrás dela.
- **Asaas** conecta por **chave de API** do dono (não tem OAuth): campo na tela
  Pagamentos, validada numa chamada antes de salvar, guardada no cofre como a do
  Mercado Pago. API: `POST /v3/payments` com `billingType: PIX`, depois
  `GET /v3/payments/{id}/pixQrCode`; o Asaas exige `customer` antes
  (`POST /v3/customers` com nome e CPF/CNPJ ou telefone). Webhook com token no
  cabeçalho `asaas-access-token`. Sandbox: `api-sandbox.asaas.com`. Emite NFS-e
  embutida (R$ 0,49), o argumento de venda dele.
- **Pedir ao Gabriel uma chave do sandbox do Asaas** (conta grátis em
  sandbox.asaas.com) para provar o ciclo inteiro sem dinheiro real. Enquanto
  não vier, testes com `fetch` simulado, como `src/channels/mercado-pago.test.ts`.
- **Mercado Pago, etapa B escrita contra a documentação**: `POST /v1/payments`
  com `pix` e `date_of_expiration`, preferência do Checkout Pro para o link,
  webhook em `/api/webhook/mercado-pago` (o prefixo `/api/webhook/` já é
  público no `proxy.ts`), conferindo `x-signature` e **relendo o pagamento na
  API antes de marcar pago**. Fica pronto para testar quando a aplicação existir.
- **Etapa C** (não depende de gateway nenhum): botão **Cobrar** no Inbox, tela
  **CRM > Cobranças**, cartão na ficha. Print 1440 e 390.

### 2. Pontas soltas de 21/out (1 a 2 dias, nenhuma depende do Gabriel)
- **Transmissão para segmento salvo**: hoje o público é só por etiqueta.
- **Telegram com mídia**: foto, áudio e arquivo pelo `getFile`, guardados como
  mídia (hoje chegam como texto "mandou uma foto").
- **Clique contado no modelo escrito do zero**: dar botão de link a ele, já
  por `comCliqueContado`.

### 3. Conector de BI (2 a 3 dias)
A Colmeia vende "conector pronto" para Power BI, Looker e Tableau, por cima de
um data warehouse próprio. O nosso equivalente barato: endpoints de leitura
autenticados por chave da API v1 (que já existe), em CSV e JSON, para conversas,
contatos, vendas e cobranças, que o Power BI ("Obter dados > Web") e o Looker
Studio leem sozinhos. Mais um passo a passo na tela de API. Sem warehouse.

### 4. Saída genérica da cobrança (1 a 2 dias, depois da frente 1)
Evento `cobranca.paga` pelo webhook de saída e pela API v1 que já existem
(`src/server/webhooks-de-saida.ts`). É o que serve a quem tem sistema próprio.

### 5. Grandes, já no handoff de 21/out
WhatsApp Flows de agendamento (Verandi/MGM, criptografia RSA+AES) e catálogo
oficial do WhatsApp. Só depois das de cima.

## Como a Colmeia integra (pesquisa de 22/out, colmeia.cx)

- **Qualquer sistema com API REST**: "Funções" do Smart Flow = uma Conexão
  (domínio e credencial) mais uma Rota (endpoint e método), em editor visual.
  **Já temos o equivalente**: bloco "Chama um sistema" mais Credenciais de
  sistemas. Não há o que copiar.
- **Prontos de verdade**: WhatsApp (BSP oficial), Conversions API (já temos),
  Mercado Pago no chat (frente 1), Power BI, Looker e Tableau (frente 3),
  Flows e catálogo do WhatsApp (frente 5).
- **ERP, CRM e legado**: "biblioteca de conectores" sem nome nenhum, e projeto
  sob medida com o time deles. Não citam sistema específico, nem e-commerce,
  nem agenda (aí estamos à frente: Magento, Nuvemshop, Verandi).

## Regras do Gabriel (não negociáveis)
- pt-BR, curto, decisão tomada com recomendação. Ele é designer, não dev.
- **Travessão proibido** em todo texto e arquivo.
- UI: print local em 1440 e 390 (`scripts/ux-local/dev.sh`, porta 3100). O
  banco local está na `0141`; scripts de print em `.ux-local/tela.mjs`.
- Commit e push na hora com `GITHUB_TOKEN` do cofre; conferir `READY` na
  Vercel em segundo plano. Juntar pushes: a cota é compartilhada com a Verandi.
- **Migration em produção só com autorização explícita**. Código que lê tabela
  nova tolera a tabela ausente até ela ser aplicada.
- Não rodar a suíte inteira: `tsc` limpo e só os testes das partes mexidas.
- Token de pagamento **nunca** vira Conexão comum (`connections`): os blocos
  HTTP do fluxo o alcançariam.
- Tudo que depende do Gabriel vai para `4yu-apps/PENDENCIAS-DO-GABRIEL.md`.
