# Handoff — 13/set/2026: o Inbox que responde ao clique

> Continuação direta de uma sessão longa. O que está aqui é **o que ficou pela
> metade e por quê** — o resto está no código, comentado.

## O que o dono pediu, na palavra dele

> "tem mt info mas poucas ações, n tem mt controle de conversa"
>
> "eu quero um SISTEMA otimista. filtros rapidos, tudo rapido"

E, sobre a lentidão:

> "é pq o supabase é free? toda ação q envolve banco demora um rim"

**Não era o Supabase.** Medido em 13/set:

| | |
|---|---|
| Banco, query trivial | ~200ms · `sa-east-1` (São Paulo) |
| Aplicação | ~130ms · `gru1` (São Paulo) |
| Plano | `ACTIVE_HEALTHY` |

A causa é `revalidatePath`: ele refaz a página inteira no servidor — sete
consultas no Inbox — **antes** de a tela mudar. Escrita de 20ms virava 2s de
espera. Há 126 chamadas dele em `acoes.ts`; é o padrão do produto inteiro.

## O que está pronto, em produção

### Migration 0049 — o estado da conversa

`contacts` ganhou `estado` (`aberta` | `adiada` | `resolvida`), `adiada_ate`,
`adiada_nota`, `resolvida_em`. A view `leads` expõe tudo mais `estado_efetivo`.

Veio de benchmarking: o Front reorganizou o inbox deles em **Open / Later /
Done** com a justificativa publicada de que *"conversas esperando não ficam mais
escondidas em Arquivadas"*. O rail daqui respondia só "de quem é?" — faltava "em
que pé está?".

**A regra que só apareceu na doc da Meta/Front e que ninguém tinha previsto:**
um gatilho em `messages` reabre a conversa quando chega entrada. Adiou para
terça e o cliente escreveu na segunda? Volta para a fila na hora. Mora no
gatilho e não no webhook porque entrada chega por três caminhos (`messages`,
`history`, `smb_message_echoes`). Histórico importado não reabre nada.

`estado_efetivo` trata adiamento vencido como aberta **por comparação de data**,
sem processo agendado: sobrevive a servidor fora do ar no fim de semana.

Aplicada com autorização do dono, depois do ensaio em transação. Conferida
objeto a objeto. O gatilho foi provado com `adiar + inserir entrada + rollback`.

### UI otimista (camadas 1 e 2)

`useAcaoOtimista` em `components/design/acao-otimista.ts`: aplica a mudança,
chama a ação, desfaz se o servidor recusar. O padrão já existia à mão no
`SeletorDeEtiquetas`, num componente só — virou o jeito padrão.

Aplicado em: Resolver/Depois/Reabrir, Assumir/Liberar, Pausar/Religar bot,
criação de etiqueta.

O hook documenta **quando não usar**: nada que saia do sistema (mandar mensagem
no WhatsApp), nada destrutivo, nada que seja lote.

### Etiqueta nasce na conversa

O link "Criar" que levava para Configurações era a mesma volta que fazia
ninguém anotar nada antes da `NotaRapida` existir. Agora é `+ Etiqueta` no
padrão do `+ Anotar`, otimista, e já nasce aplicada ao contato.

## O que ficou pela metade — a Camada 3

**Filtros ainda são navegação de página inteira.** É o que o dono reclamou e o
que não fechou.

### O que já existe e funciona

| Peça | Onde | Estado |
|---|---|---|
| `filaInteira()` | `repos/leads.ts` | pronta — traz a fila toda até `TETO_DA_FILA_LOCAL` (200), `null` acima |
| `recortarFila` / `contarEstados` / `contarDonos` | `components/inbox/fila-local.tsx` | prontas, **9 testes passando** |
| `RailsLocais` | idem | pronto, não ligado |
| `FichaDoRail` em dois modos | `components/inbox/ficha-do-rail.tsx` | pronta — `aoEscolher` = botão local; sem ele = `<Link>` |

### Por que o teto de 200, e por que ele não é opcional

Filtrar no cliente **mente** se a lista estiver paginada: "Adiadas 40" mostrando
três porque as outras 37 estão na página 2. Não é lentidão, é resposta errada.

200 sai de medida: um lead pesa **~490 bytes** (média real no banco), então 200
são ~100KB de JSON. O gargalo nunca foi tamanho — é a honestidade do filtro.

### O que falta, exatamente

Ligar `RailsLocais` na `Fila` do `inbox/page.tsx`. **O bloqueio é estrutural:**
os rails vivem dentro do `<header>` e a lista fora dele, então o componente não
consegue envolver as duas coisas sem reorganizar o JSX.

O caminho certo é **extrair a `Fila` (~330 linhas) para arquivo próprio como
`'use client'`**. Ela é elegível:

- não usa `await`, `async`, nem Server Action — conferido;
- o último bloqueio caiu nesta sessão: `TETO_DA_INSIGNIA` estava em
  `repos/leituras.ts`, que é `server-only`, e foi movido para `core/insignia.ts`.

Dependências a levar junto: `RelogioDaJanela`, `resumoDaConversa`,
`PassoDaPagina` (locais ao `page.tsx`) e `quando`/`restaDaJanela` (já importadas
de fora).

**Duas tentativas de atalho falharam e foram revertidas** — uma quebrou o JSX,
a outra esbarrou no callback precisando de pai cliente. Não insista no atalho: a
extração é o caminho.

## Um problema do projeto, descoberto de lado

**Os testes rodam contra o banco de produção.** `src/server/repos/*.test.ts`
importam `../db`, que lê o `.env`.

Duas consequências vistas hoje:

1. Quando uma migration falta, a suíte inteira "falha" — foram 27 falhas que
   eram só a `0049` não aplicada ainda;
2. **Os testes são flaky.** `leituras.test.ts` falhou duas vezes seguidas e
   passou nas três seguintes, sem nenhuma mudança de código. São corridas
   competindo pelos mesmos dados.

Isso não foi causado por esta sessão e não foi consertado nela. Mas quem
depurar falha de teste aqui precisa saber: **falha isolada pode ser corrida, não
regressão.** Confira rodando de novo antes de investigar.

## Pendências menores

1. **"O que o fluxo coletou"** — o dono questionou o título e pediu para trazer
   "os dados da ficha". Conferi: a Ficha **não tem nada além** do que a coluna
   já mostra. A pergunta ficou sem resposta — é trocar o rótulo (que descreve a
   origem, não o conteúdo) ou trazer outros campos do `Lead` (telefone, quando
   chegou, origem)? **Pergunte antes de fazer.**
2. **Funil dentro da conversa** — planejado, não feito. `acaoPorNaEtapa` e
   `acaoMoverCartao` já existem; falta uma consulta que devolva os **ids** do
   quadro/etapa, porque `quadrosDoContato` só devolve nomes.
3. **Conversas anteriores do contato** — o produto não tem o conceito de
   "conversa" separada; tudo é fluxo contínuo por contato. Precisa de estudo do
   modelo antes de prometer prazo.

## O que o dono dispensou

- **Command palette (⌘K)** — pedido explícito para tirar.
- **Prioridade na sidebar** (padrão do Chatwoot) — as etiquetas já cobrem.
- **Favoritar mensagem** — ninguém soube dizer que problema resolve.

## Como ele gosta de trabalhar

Direto. Respostas curtas, sem explicação que ele não pediu — cortou isso três
vezes em telas ("é só botar uma TAG, SÓ") e uma vez em conversa.

E é cético com razão: apontou o card de pendências falso, o "Pausar bot" sem
bot, o alinhamento das mensagens e a lentidão — **todos reais**, todos achados
por ele antes de mim. Quando ele disser que algo está errado, meça antes de
discordar.
