# Plano: cobrança no chat, camada 1

Aprovado em 21/out/2026 com as 4 recomendações abaixo.

**Andamento:** etapa A escrita (tela Ajustes > Pagamentos, OAuth, renovação
diária, migration `0141`). Falta: `0141` em produção (autorização) e a
aplicação do Mercado Pago com `MERCADO_PAGO_CLIENT_ID`/`_SECRET` no cofre e na
Vercel. Sem as duas variáveis a tela mostra "em liberação". O recurso usa
`integracoes` do plano (Operação para cima), sem dado novo em produção. Base: `docs/MERCADO-COBRANCA-NO-CHAT.md` (por que assim) e
`src/core/cobranca.ts` (a IA já monta o pedido e soma pelo catálogo, em
centavos; hoje o Pix só existe na demonstração).

## O que o dono vê no fim

1. Ajustes > Pagamentos: botão **Conectar Mercado Pago**. Login no Mercado
   Pago, volta conectado. Nenhuma chave copiada.
2. Na conversa, botão **Cobrar**: valor, descrição, vencimento. A pessoa
   recebe Pix copia e cola e um link (cartão e boleto pelo link).
3. No fluxo, bloco **Cobrar** com duas saídas: **pagou** e **venceu**. A IA de
   vendas usa o total que `cobranca.ts` já calcula.
4. Pagou: o Mercado Pago avisa, a cobrança vira **paga**, a conversa recebe
   "pagamento confirmado" e o fluxo segue sozinho.
5. Tela **CRM > Cobranças**: pendente, paga, vencida, cancelada, com filtro e
   total do período. A ficha do contato mostra as cobranças dele.

O dinheiro vai direto para a conta do dono. O AutoFluxos não recebe, não
repassa e não cobra porcentagem (Resolução BCB 494/2025). Nota fiscal não é
nossa.

## Etapas (12 dias)

| # | Entrega | Dias |
|---|---|---|
| A | Conexão Mercado Pago (OAuth, token no cofre, renovação diária) e as tabelas | 3 |
| B | Criar cobrança (Pix e link), webhook assinado, vencimento | 3 |
| C | Botão Cobrar no Inbox, tela Cobranças, cartão na ficha | 2 |
| D | Bloco Cobrar no fluxo (pagou / venceu) e IA ligada ao total do catálogo | 2 |
| E | Mensagem nativa de pedido do WhatsApp (`order_details`, Pix dentro do app) | 2 |

Cada etapa vai ao ar sozinha, atrás da conexão: quem não conectou não vê nada.
Asaas fica para depois (4 a 6 dias), com NFS-e.

## Desenho técnico (decidido)

- **Migration `0141`** (número confirmado no diretório na hora de escrever):
  `public.conexoes_de_pagamento` (conta, gateway, id da conta no gateway,
  referência do token no cofre, validade) e `public.cobrancas` (conta,
  contato, valor em centavos, descrição, itens, status, id no gateway, Pix
  copia e cola, link, vence_em, paga_em, quem criou, origem: inbox, fluxo ou
  IA). RLS ligada, sem política, `revoke` de `anon` e `authenticated`, como o
  resto de `public`. Aplicação em produção só com autorização, ensaio em
  transação antes.
- **Token do dono nunca no banco**: vai para o cofre (`cofre.ts`), a tabela
  guarda só a referência.
- **Pix**: `POST /v1/payments` do Mercado Pago com `pix` e
  `date_of_expiration`; devolve o copia e cola e o QR. **Link**: preferência do
  Checkout Pro (cartão, boleto, Pix). Chave de idempotência por cobrança.
- **Webhook**: confere a assinatura `x-signature` e **nunca confia no corpo**:
  relê o pagamento na API com o token do dono antes de marcar paga. Repetido
  não paga duas vezes.
- **Vencimento**: tarefa agendada (`repos/tarefas`) marca vencida e acorda a
  saída "venceu" do fluxo.
- **Valor sempre do servidor**: atendente digita, IA usa `cobranca.ts`; o
  navegador e o modelo nunca definem o valor final sozinhos.
- Vantagem do dia em `docs/vantagens/VANTAGENS-AUTOFLUXOS.md` a cada etapa.

## Precisa de você (antes da etapa A)

1. **Criar a aplicação no Mercado Pago Developers** com a conta da 4YU (é
   UI, não tem API): https://www.mercadopago.com.br/developers/panel/app .
   Eu passo a URL de retorno e as permissões; o Client ID e o Secret entram no
   cofre. Sem isso a etapa A não sai do lugar.
2. **Uma conta Mercado Pago para teste** (a sua serve) e um Pix de R$ 1 no
   fim da etapa B, para provar o ciclo inteiro com dinheiro de verdade.

## Decisões suas

1. **Quais planos têm Cobrança?** Recomendo **Operação para cima**: é recurso
   de venda, e o Essencial fica como entrada.
2. **Quem pode cobrar?** Recomendo: dono e gerente sempre; atendente só se a
   permissão for dada a ele (mesma lógica das outras permissões).
3. **Vencimento padrão do Pix?** Recomendo **24 horas** no Inbox (cobrança de
   conversa é quente) e configurável no bloco do fluxo.
4. **Mensagem nativa (etapa E) entra agora ou depois?** Recomendo **agora**,
   por último: é o diferencial que nenhuma plataforma pequena tem no Brasil.
   Se o teste mostrar que exige catálogo ligado ao número, ela vira etapa
   separada e o resto já está no ar.

## Fora desta camada

Pedido leve com estoque e entrega (6 a 8 dias, depois), Asaas, recorrência,
conector de loja virtual, split e porcentagem.
