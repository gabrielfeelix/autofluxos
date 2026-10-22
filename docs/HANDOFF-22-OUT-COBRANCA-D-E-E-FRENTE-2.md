# Handoff: 22/out/2026 (tarde), cobrança etapas D e E, e frente 2

Para o agente que continua. Faça a **frente 1 (etapas D e E)** e a **frente 2**.
Continua `docs/HANDOFF-22-OUT-COBRANCA-E-FRENTES.md`; as frentes 3, 4 e 5 de
lá seguem valendo depois destas.

## Leia antes

1. `docs/PLANO-COBRANCA-CAMADA-1.md` (andamento no topo, 4 decisões tomadas).
2. `docs/BANCO-COMPARTILHADO.md` e `AGENTS.md` antes de qualquer migration.
3. `docs/vantagens/VANTAGENS-AUTOFLUXOS.md`: feature nova entra no dia.

## O que está no ar (conferido `READY` na Vercel)

| Commit | O quê |
|---|---|
| `8a6591bf` | Interface de gateway (`src/channels/pagamento.ts`), Asaas por chave (`channels/asaas.ts`), Mercado Pago etapa B (`channels/mercado-pago.ts`), núcleo `src/server/cobrancas.ts` (criar, `aplicarPagamento`, vencimento, cancelar), webhooks `/api/webhook/asaas/[clienteId]` e `/api/webhook/mercado-pago`, tarefa `vencimento_de_cobranca`, evento `cobranca` na linha do tempo |
| `9d9073b1` | Botão Cobrar no Inbox (`components/lead/botao-de-cobrar.tsx`, ação em `server/acoes-cobrancas.ts`), CRM > Cobranças (`leads/cobrancas`), cartão na ficha |

Tudo depende da `0141`, que **não está em produção** (só no Docker local).
Ela ainda pode ser editada no lugar; confira `ls supabase/migrations | tail -1`.

## Frente 1, o que falta

### Etapa D: bloco Cobrar no fluxo (2 dias)
- Bloco novo no editor com duas saídas, **pagou** e **venceu**, e vencimento
  configurável (decisão 3: Inbox fixo em 24h, fluxo escolhe).
- Chama `criarCobranca` com `origem: 'fluxo'` e `sessaoId`; a coluna
  `cobrancas.sessao_id` já existe para isso.
- Acordar o fluxo: em `aplicarPagamento` (pagou) e em
  `rodarVencimentoDeCobranca` (venceu), hoje só anotam na linha do tempo.
  Siga o padrão do `timeout_de_pergunta` (sessão mais nó registrados, só age
  se a conversa ainda estiver no mesmo nó).
- A IA de vendas usa o total de `src/core/cobranca.ts` (já soma pelo
  catálogo, em centavos). O valor nunca vem do modelo.
- O texto da mensagem já existe: `textoDaCobranca` em `server/cobrancas.ts`.

### Etapa E: mensagem nativa `order_details` (2 dias)
- Pix dentro do WhatsApp: https://developers.facebook.com/documentation/business-messaging/whatsapp/payments/payments-br/orders
- Escreva com teste de `fetch` simulado. Se exigir catálogo ligado ao número,
  vira etapa separada (decisão 4) e anota em `PENDENCIAS-DO-GABRIEL.md`.

### Quando o Gabriel mandar as chaves
- Chave do sandbox do Asaas: conectar numa conta local, cobrar R$ 1, pagar
  pelo sandbox. Fora de produção o Asaas não alcança o localhost; a conexão
  segue sem webhook e o vencimento relê o pagamento.
- Mercado Pago: `MERCADO_PAGO_CLIENT_ID`, `_SECRET` e `_WEBHOOK_SECRET` no
  cofre e na Vercel.

## Frente 2 (1 a 2 dias, nada depende do Gabriel)
- **Transmissão para segmento salvo**: hoje o público é só por etiqueta.
- **Telegram com mídia**: foto, áudio e arquivo pelo `getFile`, guardados
  como mídia (hoje chegam como texto "mandou uma foto").
- **Clique contado no modelo escrito do zero**: botão de link por
  `comCliqueContado`.

## Armadilhas já pagas nesta sessão
- **Nada de `<form>` dentro da caixa de resposta**: ela já é um form.
  Popover da barra usa `div` com Enter no `onKeyDown`.
- `.app-field` tem `width: 100%` fora de camada e vence `w-auto` do
  Tailwind: para largura menor, embrulhe numa `div` com largura.
- Arquivo `'use server'` só exporta função `async`. Ajudante puro mora em
  `server/cobrancas.ts`.
- Webhook do Asaas responde **200 mesmo quando falha**: 15 falhas pausam a
  fila da conta inteira.
- Docker desligado: abra o Docker Desktop
  (`/mnt/c/Program Files/Docker/Docker/Docker Desktop.exe`) e espere o
  `docker ps` responder.
- Local semeado: conta `71aa7f92-3814-49f4-a7b5-ee22ae53f826` no plano
  Operação, Asaas falso em teste, 9 cobranças. Prints em
  `.ux-local/cobrar.mjs` (Inbox com o Cobrar aberto) e
  `.ux-local/ficha-cobrancas.mjs`.

## Regras do Gabriel (não negociáveis)
- pt-BR, curto, decisão tomada com recomendação. Ele é designer, não dev.
- **Travessão proibido** em todo texto e arquivo.
- UI: print local em 1440 e 390 (`scripts/ux-local/dev.sh`, porta 3100).
- Commit e push na hora com `GITHUB_TOKEN` do cofre; conferir `READY` na
  Vercel em segundo plano. Juntar pushes: a cota é compartilhada com a Verandi.
- Migration em produção só com autorização explícita.
- Não rodar a suíte inteira: `tsc` limpo, lint e só os testes mexidos.
- Token de pagamento **nunca** vira Conexão comum (`connections`).
- Tudo que depende do Gabriel vai para `4yu-apps/PENDENCIAS-DO-GABRIEL.md`.
