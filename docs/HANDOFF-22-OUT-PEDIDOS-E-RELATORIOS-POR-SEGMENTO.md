# Handoff: 22/out/2026 (noite), pedidos e relatórios por segmento

Para o agente que continua. Continua `docs/HANDOFF-22-OUT-COBRANCA-D-E-E-FRENTE-2.md`
(feito por inteiro). **Comece pelas perguntas da parte 2 e por um plano para o
Gabriel aprovar.** Não escreva código antes da aprovação.

## Leia antes

1. `docs/PLANO-COBRANCA-CAMADA-1.md`: andamento no topo. A camada 1 está toda no ar.
2. `docs/NICHOS.md` e `docs/PLANO-NICHOS.md`: os segmentos de empresa.
3. `docs/BANCO-COMPARTILHADO.md` e `AGENTS.md` antes de qualquer migration.
4. `docs/vantagens/VANTAGENS-AUTOFLUXOS.md`: feature nova entra no dia.

## 1. O que está no ar (todos `READY` na Vercel)

| Commit | O quê |
|---|---|
| `72ed55ce` | Bloco **Cobrar** no fluxo, com saídas pagou e venceu (`acordarFluxoDaCobranca` em `server/receber-mensagem.ts`) |
| `a4864481` | Pix como pedido nativo do WhatsApp (`order_details` simplificado, `core/pix.ts`); recusa da Meta cai no texto |
| `262b97c8` | Transmissão para segmento salvo |
| `9a1dd444` | Telegram: foto, áudio e arquivo viram mídia (`getFile`) |
| `e8dddc9e` | Modelo próprio com botão de link e clique contado |
| `8a64e7d5` | Cobrar sempre à vista no Inbox (sem conta conectada, o painel leva a Configurações > Pagamentos); ficha com cartão Cobranças abaixo de Negócios e **aba Cobranças** |
| `c9e5bf42` | Análise > Vendas: bloco **Recebido pelo chat** (`recebidoPeloChat` em `server/repos/analise-de-vendas.ts`) |

**A `0141_cobrancas` está em produção** desde 22/out, com autorização: ensaiada em
transação, aplicada pela Management API, `anon` e `authenticated` sem acesso.
Ainda falta conta de recebimento real: a chave do sandbox do Asaas e a aplicação do
Mercado Pago estão em `4yu-apps/PENDENCIAS-DO-GABRIEL.md`.

**Outro agente trabalhou em paralelo** nas frentes 4 e 5
(`docs/HANDOFF-22-OUT-FRENTES-4-E-5.md`): webhooks `cobranca.paga` e a
`0142_formularios_do_whatsapp`, que **não** foi aplicada. Rode `git status` e não
commite arquivo que não é seu.

## 2. O que o Gabriel pediu agora (responder com plano antes de codar)

### a) Tela de Pedidos (camada 2 da cobrança, de 6 a 8 dias)
No plano da camada 1, em "Fora desta camada", está o "pedido leve com estoque e
entrega". Hoje o pedido que a IA monta (`core/cobranca.ts`) vira só o resumo na
mensagem e o total cobrado. Nada guarda os itens. O que propor:
- tabela de pedido (itens, quantidade, entrega ou retirada, endereço, status:
  novo, pago, em preparo, saiu, entregue, cancelado), ligada à cobrança, ao contato e
  à conversa;
- tela **Pedidos** (lista ou quadro), a cobrança vira o "pago" do pedido;
- estoque baixando a cada venda (o catálogo é `loja/catalogo`);
- o que muda por segmento (ver a parte c).

### b) Relatórios por perfil, por usuário e por segmento
Hoje Análise tem Atendimento e Vendas, iguais para toda conta. O que é de quem:
- **Perfil** (dono, gerente, atendente: `core/permissoes.ts`): o atendente vê só o
  dele? Quem vê dinheiro (`ler_valores`)?
- **Usuário**: "meus números" para cada atendente.
- **Segmento** (`core/nichos.ts`: `aulas`, que é o pilates e o estúdio,
  `ecommerce`, `restaurante`, `comercio`): cada um mede uma coisa diferente.
  Aulas: matrícula, mensalidade em dia, faltas e evasão. E-commerce: pedido, ticket,
  carrinho abandonado. Restaurante: pedidos por hora, tempo de entrega. Proponha a
  lista de relatórios por segmento, com o que já existe e o que falta.
- Sugestão de forma: os blocos de `PainelDeBlocos` já são arrumáveis por página
  (`arranjoDaAnalise`); um arranjo padrão por segmento e por perfil sai barato.

### c) Recorrência ou só de uma vez
A camada 1 é **avulsa** (uma cobrança, um Pix). Recorrência ficou fora de
propósito. Para `aulas` ela é o principal: a mensalidade. O Asaas tem assinatura
nativa (`/v3/subscriptions`) e o Mercado Pago tem `preapproval`. Pesquise e
proponha: mensalidade com Pix todo mês na conversa (cobrança gerada pelo
relógio) e assinatura no cartão pelo gateway. Responda também se o Pix
recorrente do Banco Central (Pix Automático) já serve.

### d) "Se ele fica no chat, até porque não estou vendo"
Pergunte ao Gabriel o que ele quis dizer. Leituras possíveis:
- se o cliente paga **sem sair do WhatsApp**: sim, pelo `order_details` (bolha com
  "Copiar código Pix"), mas ainda não testado num número real;
- se a venda **aparece no chat** para a equipe: hoje a mensagem da cobrança
  aparece no Inbox como texto, sem um cartão próprio com status (pago ou
  aguardando). Pode valer um cartão de cobrança dentro da conversa.

## 3. Regras do Gabriel (não negociáveis)
- pt-BR, curto, decisão tomada com recomendação. Ele é designer, não dev.
- **Travessão proibido** em todo texto e arquivo.
- UI: print local em 1440 e 390 (`scripts/ux-local/dev.sh`, porta 3100).
  Scripts de print em `.ux-local/`: `ficha-cobrancas-2.mjs`, `recebido-chat.mjs`,
  `cobrar-bloco.mjs`.
- Commit e push na hora com o `GITHUB_TOKEN` do cofre; conferir `READY` na Vercel.
  Juntar pushes: a cota é compartilhada com a Verandi.
- Migration em produção só com autorização explícita; ensaio em transação antes.
- Não rodar a suíte inteira: `tsc` limpo, lint e só os testes mexidos.
- Recurso novo não fica escondido: quem tem no plano vê, mesmo sem configurar, com
  o caminho para configurar (lição do Cobrar e da ficha, 22/out).
- Tudo que depende do Gabriel vai para `4yu-apps/PENDENCIAS-DO-GABRIEL.md`.
