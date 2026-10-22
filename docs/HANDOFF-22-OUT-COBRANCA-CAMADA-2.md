# Handoff: 22/out/2026 (noite), cobrança camada 2

Para o agente que continua. Plano aprovado por inteiro em
`docs/PLANO-COBRANCA-CAMADA-2.md` (andamento no fim dele). O Gabriel autorizou
fazer **tudo o que falta**, inclusive migration em produção, **com uma regra:
para o MGM Pilates nada muda de fato** (conta `5de5a891-790f-4c14-b60b-ce0a573fe1c7`,
ramo `aulas`, objetivo `atender`, 1 dono e 2 administradores com função
personalizada).

## Atualização, 22/out (tarde): concluído

Pedidos (a) e a parte possível de Relatórios (b) foram feitos: `36a9e801`
(0146 em produção), `3ecb7055` (pedidos, quadro, estoque), `5cade8f2`
(blocos em Vendas). O que ficou de fora e por quê está no fim de
`docs/PLANO-COBRANCA-CAMADA-2.md`. O que segue abaixo é o registro de antes.

## No ar (todos `READY` na Vercel)

| Commit | O quê |
|---|---|
| `e2a8586a` | d: Cobrar do Inbox com abas Do catálogo e Valor livre, cartão da cobrança na conversa, "Mais vendidos pelo chat" em Vendas |
| `b9c32fe0` | c1: mensalidade Pix do mês, relógio diário (`server/mensalidades.ts` no cron de tarefas), `/pagar/<código>`, modelo `lembrete_de_cobranca` em Ajustes > Pagamentos. **`0145` aplicada em produção** |
| `15adbbf9` | c2 e c3: cartão recorrente e Pix Automático pelo Asaas, escritos contra a documentação, **sem teste real** (falta a chave do sandbox) |

**c4 (ponte Verandi) não será feita**: o Gabriel disse que o MGM não vai usar
cobrança. Só se o MGM pedir.

## Em andamento: a) Pedidos

Escrito e **sem commit**:
- `supabase/migrations/0146_pedidos.sql`: `produtos.estoque` (nulo = não
  controla), `pedidos` (número por conta, entrega, status, data de cada etapa,
  `cobranca_id` único), `pedido_itens`. Aplicada **só no local**, duas vezes,
  fechada para `anon`. **Ensaiar em transação e aplicar em produção antes do
  push** do código que lê `estoque` (o select do catálogo quebra sem a coluna).
- `src/core/pedidos.ts` (+ teste, 5 passam): `temPedidos(nicho)` é falso só
  para `aulas`, etapas e nomes por ramo, `proximoStatus`, `podeMover`,
  `avisoDoStatus`.

Falta, já decidido:
1. `server/repos/pedidos.ts`: criar com número `max+1` por conta (retenta no
   conflito do `unique`), listar por status, mudar status gravando a coluna de
   data (`COLUNA_DO_STATUS`). Baixa de estoque numa transação pelo pool
   (`server/banco-de-dados.ts`): `update produtos set estoque = estoque - q
   where id = ... and estoque is not null and estoque >= q`; sem linha e com
   estoque controlado = recusa com "X tem só N". Devolve no cancelamento.
2. Origem: (a) Cobrar do Inbox com itens, só se `temPedidos(nicho)`: reserva
   o estoque e cria o pedido, depois a cobrança, e liga `cobranca_id`; falhou a
   cobrança, cancela o pedido e devolve o estoque. Cobrar ganha Retirada/Entrega
   e endereço na aba Do catálogo (só com pedidos). (b) Bloco Cobrar do fluxo
   (`receber-mensagem.ts`, `case 'criar_cobranca'`): pedido sem itens, a
   descrição vira a observação.
3. `aplicarPagamento` (paga) move o pedido de `novo` para `pago`; vencida ou
   cancelada move para `cancelado` e devolve o estoque.
4. Tela `clientes/[id]/loja/pedidos`: quadro por etapa (restaurante) ou lista
   (os outros), com troca; cartão com número, contato com avatar, itens,
   total, tempo desde o pedido; botão da próxima etapa, otimista. Mudar de
   etapa manda `avisoDoStatus` na conversa dentro da janela.
5. Menu: item `pedidos` (rótulo Pedidos, `/loja/pedidos`) em Comércio
   (`components/design/secoes-do-cliente.tsx`), `'pedidos'` em
   `LUGARES_DA_BARRA` e nos `ocultos` do pacote `aulas`. Tirar o rótulo
   `negocios: 'Pedidos'` do pacote `restaurante` (senão há dois "Pedidos").
6. Estoque no catálogo (`loja/catalogo/page.tsx`, `AcoesDoItem`): botão
   Estoque e "N em estoque" ao lado do preço, **só com `temPedidos(nicho)`**.
   A busca do Cobrar já mostra "esgotado".

## Depois: b) Relatórios

Só para restaurante, e-commerce e comércio (o MGM é `aulas`, não muda):
blocos de pedidos em Análise > Vendas (pedidos por hora e dia, ticket médio,
tempo de preparo e entrega pelas colunas de data, mais pedido, entrega ou
retirada, cancelamentos) e arranjo padrão por ramo quando não há cookie.
**Adiado por causa do MGM**: `ler_valores: proprios` no operador (as funções
do MGM podem herdar), relatórios de aulas e o seletor Eu/Equipe/Conta (mudaria
a Análise do MGM). Anotar no plano.

## Regras

pt-BR, curto, sem travessão; print 1440 e 390 (`scripts/ux-local/dev.sh`,
porta 3100; scripts em `.ux-local/`: `cobrar-catalogo.mjs`, `mensalidade.mjs`,
`pagar.mjs`, `q-cobrar.mjs` para consultar o banco local,
`aplicar-local.mjs` para aplicar SQL no local). `tsc` limpo, lint e só os
testes mexidos. Push com o `GITHUB_TOKEN` do cofre, conferir `READY`, juntar
pushes. Migration em produção: ensaio em transação, aplicação pela Management
API, releitura, nota em `docs/BANCO-COMPARTILHADO.md`. Outro agente mexe em
`docs/vantagens/` ao mesmo tempo: não sobrescrever, só acrescentar.
