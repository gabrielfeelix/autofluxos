# Handoff 02/out/2026: Inbox rápido, tempo real e esqueletos

Para o próximo agente. Tudo abaixo está commitado, publicado e em produção
(`bfe08d6` READY na Vercel em 02/out). O que falta está no fim.

## O que mudou hoje, em três commits

### `0ea17b2`: o "visualizado" e o prefetch

- **Bug grave corrigido:** o `Link` de cada linha da fila tinha `prefetch`
  completo. No Next 16 isso renderiza a página **sem cabeçalho de prefetch**
  (`node_modules/next/dist/client/components/segment-cache/cache.js`,
  `FetchStrategy.Full` não seta `next-router-prefetch`). Toda conversa à vista
  na fila era marcada como lida e mandava o tique azul para o cliente sem
  ninguém abrir.
- A marca de lida e o visto saíram da renderização. Quem marca é o
  `Historico` (`src/components/inbox/historico.tsx`), com a conversa montada e a
  aba visível, por `POST /api/clientes/[clienteId]/inbox/conversa/[contatoId]`.
  É `fetch` e não Server Action de propósito: ação passa pela fila do roteador.

### `6b79ede`: trocar de conversa sem navegar + mensagem ao vivo

- **Trocar de conversa não navega mais.** Antes cada clique refazia o Inbox
  inteiro no servidor (~20 consultas). Agora:
  - `src/components/inbox/aberta-local.ts`: loja fora do React (qual conversa
    está aberta, cópias guardadas, até 40). Clique faz `history.pushState`,
    mostra a cópia guardada no mesmo quadro e busca a fresca. Apontar para a
    linha já pré-carrega.
  - `src/components/inbox/painel-da-conversa.tsx`: a coluna do meio e a ficha
    viraram componente de navegador (eram server components em `inbox/page.tsx`).
  - `src/server/conversa-aberta.ts` + `GET /api/clientes/[clienteId]/inbox/aberta/[contatoId]`:
    os dados da conversa em JSON. A página usa a mesma função no primeiro
    desenho. Consultas paralelizadas (5 idas em série viraram 2).
  - Link de outra tela, notificação ou voltar do navegador: a página semeia a
    loja (`semearAberta`) e ela acompanha.
- **Mensagem ao vivo pelo Realtime do Supabase.** Migration `0119_inbox_ao_vivo.sql`
  **aplicada em produção** com autorização explícita do dono (registro e como
  desfazer em `docs/BANCO-COMPARTILHADO.md`). Gatilho em `public.messages`
  chama `realtime.send` num canal público `inbox:<clients.canal_ao_vivo>`, com
  só o id do contato no payload. O navegador assina em `pulso-do-inbox.tsx`
  (`@supabase/realtime-js`, chave publicável via `inboxAoVivo()` em
  `src/server/repos/clientes.ts`) e busca o conteúdo pelas rotas com sessão.
  O SSE (`inbox/stream`) continua: carrega ligações, carona das agendadas e é
  o plano B.
- Medido no `next dev` local (`test/e2e/troca-de-conversa.spec.ts`): zero
  pedidos RSC no clique, mensagem gravada no banco aparece em ~0,7 s.

### `bfe08d6`: esqueletos e estados vazios

- Esqueleto da conversa (`ConversaChegando` em `painel-da-conversa.tsx`):
  balões alternados sobre `app-conversa`, pílula do dia, caixa de resposta no
  pé, ficha ao lado.
- `loading.tsx` próprios: `conversas/canais/(lista)/`, `conversas/respostas-rapidas/`,
  `favoritas/`. A lista de Canais foi para o grupo de rota `(lista)` para o
  esqueleto de cartões não valer nas telas de cada canal (URL igual).
- Vazios no padrão de Transmissões (cartão de largura cheia, cabeçalho com
  título e botão, vazio centrado `px-5 py-14`): Mensagens guardadas e Inbox
  vazio refeitos; funil (`quadro.tsx`), `contas/page.tsx` e `admin/(visao)` sem
  tracejado. **Referência visual do dono:** `components/transmissoes/lista-de-templates.tsx`.
- `.app-esqueleto` foi para `@layer components` em `globals.css`: solta, ela
  vencia o `rounded-*` de todo esqueleto do app.

## Armadilhas que custaram tempo hoje

- **`next dev` frio engana medição:** a primeira chamada de rota nova leva
  15 a 25 s compilando. Aqueça antes de medir.
- **Porta 3100 pode estar com o `next dev` da Verandi** (outra sessão). Rode o
  e2e com `PORTA=3110 npx playwright test test/e2e/troca-de-conversa.spec.ts`.
  Nunca mate o processo de outra sessão.
- **O e2e do ao vivo precisa de `SUPABASE_PUBLISHABLE_KEY` no `.env.teste-local`**
  (gitignorado; é a chave de demonstração do Supabase local, impressa por
  `npx supabase status`). Sem ela a tela cai no SSE e o teste fica lento.
- **A `0119` também precisa estar no banco local** se ele for recriado:
  `docker exec -i supabase_db_autofluxos psql -U postgres -q < supabase/migrations/0119_inbox_ao_vivo.sql`.
- **Esqueleto (`loading.tsx`) não aparece em `next dev` com atraso de rede:**
  o loading vem na mesma resposta. Para fotografar, renderize o componente
  numa rota temporária e apague depois.
- Depois de mover rota, apague `.next/dev/types` se o `tsc` reclamar do caminho
  antigo.

## O que falta

1. **Conferir em produção, como usuário** (nada disso foi visto em produção, só local):
   - abrir o Inbox, clicar em várias conversas: troca instantânea, número de
     não lidas some no clique;
   - mandar mensagem de um celular de teste (DDD 44 é do dono) para um número
     conectado: deve aparecer em menos de 1 s sem recarregar;
   - conversa que só **aparece** na lista **não** pode receber tique azul; só
     a aberta.
2. **Prints em 390 que não foram conferidos:** Mensagens guardadas vazia e
   Inbox vazio depois do ajuste do botão (`inline-flex items-center`), e o funil
   vazio, Contas vazia e Admin vazio em 1440 e 390.
3. **Avisos do React no `next dev` da tela de conversas:** "A tree hydrated but
   some attributes ... didn't match" e "Each child in a list should have a
   unique key" (em `MolduraDoInbox`, filho vindo de `Conteudo`; e em `Fila`,
   vindo de `Tela`). Não se sabe se já existiam antes de hoje: confira com
   `git stash`/checkout de `05cc0fa` antes de corrigir.
   **Conferido em 02/out:** Inbox carregado do zero em 1440 e 390, duas
   rodadas em `05cc0fa` e duas em `c5b98d0`, zero avisos nos dois. O aviso de
   key só apareceu uma vez, logo depois de editar arquivo com o `next dev`
   ligado: é o recarregamento a quente, não o código. Nada a corrigir.
4. **Lint com erro anterior a hoje** em `src/components/inbox/telefone-do-inbox.tsx`
   (`react-hooks/refs`, linha ~42, do commit `5235e79`).
5. **Esqueleto das telas de cada canal** (`canais/whatsapp`, `instagram`,
   `site`) continua o genérico de `conversas/loading.tsx`. O dono reclamou de
   esqueleto que "não condiz": fazer um por tela, no mesmo estilo dos de hoje.
6. **Pedido ambíguo do dono:** ele escreveu "coloque nas atv." no meio da
   conversa. Foi entendido como "ponha na sua lista de tarefas". Se era para
   lançar algo na tela de Atividades do app, pergunte o quê.

7. **Feito em 02/out (ver `docs/DECISIONS.md`).** **Melhorar as notificações de "esperando atendimento"** (pedido do dono,
   02/out, com print): chegou "Um contato está esperando atendimento / a IA
   não soube responder, em \"loja_detalhes\": \"produtoId\" não é um
   identificador que apareceu nesta consulta". Falta dizer **de qual conta**
   (ele não soube se era a PCYES), **quem** escreveu (nome ou número) e **o
   que** a pessoa pediu; e o erro interno da ferramenta da IA não pode virar
   texto para o usuário. Texto montado em `textoDoAviso`
   (`src/core/aviso-de-handoff.ts:94`), que hoje usa o motivo cru.

## Regras do dono que valem aqui

Implementar inline, sem subagente; não rodar a suíte inteira (tsc, lint do
que mexeu, build, um spec por vez); print em 1440 e 390 antes de entregar UI;
commitar e dar push quando pronto; sem travessão em arquivo nenhum; resposta
curta. Banco de produção: ler `docs/BANCO-COMPARTILHADO.md` antes, nada em
produção sem autorização explícita.
