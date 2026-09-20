# Handoff: a F7 e a F8 completas, e a F9 a fazer

> Escrito em 21/set/2026, ao fim da sessão que executou a **T7.4, a T8.1 e a
> T8.2**.
>
> **Estado:** F0 a F8 **completas**. Tudo em `origin/main` (último commit
> `7d2eb93`). Banco local **e produção** na **0086**. A próxima migration é a
> **0087**: confira com `ls supabase/migrations/ | tail -1` e **não copie
> numeração de plano nenhum, inclusive deste arquivo**.
>
> **Falta a F9 inteira**, e ela é de natureza diferente das anteriores: é
> piloto, validação e liberação gradual, não código. Ver o §6.
>
> Leia antes o [handoff da T7.1/T7.2/T7.3](HANDOFF-20-SET-F7-E-F8.md) e o
> [que pediu a F7/F8](HANDOFF-20-SET-PARA-F7-E-F8.md): o §2 (regras da casa), o
> §6 (armadilhas antigas) e o §7 (pendências) do segundo continuam valendo
> inteiros, e este arquivo não os repete.

## 1. Antes de escrever qualquer código

```bash
cd /home/gabfelix/dev/4yu-apps/autofluxos
git fetch && git log --oneline -4      # deve terminar em 7d2eb93

npx supabase start                     # Docker

npm run test:unit                  # 2117 passam, 14 pulados
npm run test:integration:local     # 486 passam
npm run typecheck                  # limpo
npm run build                      # limpo
npm run lint                       # 8 problemas, 3 errors ANTERIORES
```

Os 3 lint errors continuam sendo os mesmos de sempre, em arquivos não tocados
(`inbox/page.tsx`, `clientes/[clienteId]/page.tsx`, `components/inbox/fila.tsx`).

O banco local deve estar na 0086:

```bash
docker exec supabase_db_autofluxos psql -U postgres -d postgres \
  -tAc "select max(version) from supabase_migrations.schema_migrations"
```

**O Docker estava desligado quando esta sessão começou**, e `npx supabase start`
resolveu sem drama. Se ele falhar com "The command 'docker' could not be found
in this WSL 2 distro", a distro `docker-desktop` do WSL está parada: suba o
Docker Desktop no Windows e espere o engine responder.

### Consulta à produção: heredoc, sempre

A armadilha do handoff anterior continua valendo e foi usada o tempo todo nesta
sessão sem nenhum susto. **Não consulte a produção com SQL aninhado em
`python3 -c` dentro de `bash`**: as três camadas de aspas se comem e a resposta
vem errada sem erro nenhum.

```bash
set -a && . /home/gabfelix/dev/4yu-apps/.secrets/4yu.env && set +a
python3 - <<'PY'
import json,os,urllib.request
req=urllib.request.Request(
  f"https://api.supabase.com/v1/projects/{os.environ['AUTOFLUXOS_SUPABASE_PROJECT_REF']}/database/query",
  data=json.dumps({"query":"select 1 as ok"}).encode(),
  headers={"Authorization":f"Bearer {os.environ['SUPABASE_ACCESS_TOKEN']}",
           "Content-Type":"application/json"})
print(urllib.request.urlopen(req).read().decode())
PY
```

## 2. O que esta sessão entregou

Três tarefas, **uma** migration, três commits, todos em `origin/main`.

| Tarefa | Commit | Migration |
|---|---|---|
| T7.4 formulários que não perdem estado | `32ba2fa` | nenhuma |
| T8.1 a base dos indicadores | `20ccfe6` | nenhuma |
| T8.2 a visão geral | `7d2eb93` | **0086** |

### T7.4: o modal que enviava duas vezes e perdia o digitado

Três defeitos no `ModalFormulario`, e os três eram silenciosos:

1. **duplo clique enviava duas vezes.** `enviar()` é `async` e não havia estado
   de pendência: dois cliques rápidos criavam duas etiquetas, dois produtos,
   dois anúncios. **A trava é um `ref` lido de forma síncrona, e não só o
   `disabled` do botão**, e a diferença importa: `Enter` num campo de texto
   envia o formulário sem passar pelo botão, e `setPendente(true)` só chega ao
   render seguinte, então dois cliques no mesmo quadro leriam `false` os dois;
2. **fechar descartava o digitado em silêncio.** `Esc`, o clique no fundo e o
   "Cancelar" chamavam `close()` direto. Agora pergunta, **e só quando há o que
   perder**: a decisão compara o valor atual com o **inicial**, e não com vazio.
   Comparar com vazio perguntaria sempre no modal de edição, onde todo campo já
   nasce cheio, e pergunta que aparece sempre é pergunta que ninguém lê;
3. **`w-[420px]` fixo vazava em tela estreita.** O `Modal` irmão já usava
   `min(…, 92vw)`.

**A decisão de descarte vive em `components/design/rascunho-do-modal.ts`**, e
não dentro do `.tsx`, porque este repositório não tem `jsdom` nem
`@testing-library/react`: o jeito da casa é extrair a decisão para um módulo
puro e testá-la ali, como `secoes-do-cliente.ts` e `acao-otimista.ts` fazem.
**Os 10 testes foram vistos falhar** contra a implementação antiga sabotada de
propósito (4 falham, 6 passam), nos dois sentidos.

O que **não** mudou, de propósito: nenhuma prop nova, nenhum `<dialog>` trocado
por `div`, nenhuma cor nem espaçamento. O plano pede "preservar identidade
visual; não fazer redesign gratuito", e os **22 usos** espalhados por 11
arquivos não foram tocados.

### T8.1: a compra que era um atendimento resolvido

O defeito estava em duas cópias da mesma regra errada, nas linhas 83 e 161 de
`repos/relacionamento.ts`: as duas liam `quadro_cartoes` com
`situacao = 'ganha'`, em **qualquer** quadro. É a RB-32: "Resolvido" no
Atendimento, "Qualificado" na Captação e "Compareceu" na Agenda são processos
que terminaram bem, e não dinheiro que entrou. A clínica que respondeu dez
dúvidas aparecia com dez compras e uma receita que ninguém faturou.

**A segunda metade era pior porque não parecia erro.** `Number(linha.valor ?? 0)`
transformava valor desconhecido em zero, o oposto da RB-06. Com total zero a
pessoa caía em `sem_compra`, e o produto **afirmava que ela nunca comprou** por
causa de um campo que ninguém preencheu.

A correção: `nivelPor` passou a receber `compras`, e quem comprou sem valor
informado é **`bronze`** e não `sem_compra`. `Relacionamento` ganhou `semValor`.
A fonte virou a view `contatos_comerciais` (0082), que já agregava tudo certo.
**Sem migration**: a peça já existia, e de quebra `relacionamentoDeMuitos` caiu
de duas consultas para uma, porque a view traz `ultima_mensagem_em` junto.

**Os chamadores eram quatro, e dois desenhavam dinheiro.** O selo do contato
(`lead-crm/selo-do-cliente.tsx:43`) e o painel "clientes sumindo"
(`clientes/[clienteId]/page.tsx:681`) escreviam `R$ 0,00` para quem comprou sem
valor informado. Os dois agora dizem "valor não informado", e o selo marca com
`+` o total que está incompleto. (Há uma quinta ocorrência de
`relacionamentoDeMuitos` em `repos/fluxos.ts:902`, e ela é só uma menção em
comentário.)

**A prova está no teste de integração com fixture, e não numa conferência na
produção depois:** a produção tem zero vendas e zero cartões ganhos, então todo
contato lê `sem_compra` e a correção não muda número visível nenhum lá. Ela
impede o número errado na primeira vez que alguém vender.

**O fixture de `passada-de-retomada.test.ts` também mudou**, e a mudança é o
ponto: ele dizia "os dois compraram" e fechava cartão. Agora registra venda de
verdade, e ganhou um contato que só teve atendimento resolvido, para provar que
ele **não** entra na régua.

`docs/RELACIONAMENTO.md` atualizado (item 5), inclusive a pendência de "segmento
salvo", que a 0082 e a 0083 já tinham resolvido e o doc ainda listava como
futura.

### T8.2: o bot que "resolvia 26%" (0086)

O painel de todo cliente dizia "o bot resolveu X% das conversas", e o número
saía de quatro linhas em `repos/metricas.ts` com **três** defeitos ao mesmo
tempo:

1. **toda transferência contava igual.** O fluxo que termina em "falar com a
   recepção" porque foi desenhado assim, e a conversa que caiu no colo de alguém
   porque a integração estava fora, somavam no mesmo lugar. A clínica com 50% de
   transferências previstas lia "o bot só resolve 40%" e concluía que a
   automação era ruim, **enquanto as falhas de verdade ficavam escondidas no
   meio e ninguém ia consertar**;
2. **`atendida_por_pessoa` não entrava em fatia nenhuma**, só no total. A view da
   0011 já classificava esse desfecho e o TypeScript o ignorava: as partes não
   fechavam com o todo, e ninguém percebia;
3. **o denominador incluía conversa em andamento**, então a taxa caía todo
   começo de mês sozinha, sem ninguém mexer em nada.

#### Por que precisou de coluna

`handoffs.motivo` é **texto livre escrito para gente ler**, e dos três pontos que
gravam handoff hoje, só um é transferência prevista: justamente o
`transferir_humano`, cujo texto quem monta o fluxo escreve como quiser.
Classificar por palavra-chave erraria nos dois sentidos, e o exemplo é real: "a
integração não chegou a ser executada" (falha nossa) e "o cliente quer falar
sobre a integração" (bloco previsto) casariam no mesmo `like`.

#### A coluna nasce anulável, sem default e sem backfill

**É decisão, e não preguiça.** Um default escreveria classificação inventada em
cima de registro histórico. Nulo quer dizer "gravado antes de o produto saber
distinguir", que é a verdade, e quem lê trata como **`falha`**:

- chamar de `prevista` inflaria "está tudo funcionando" com o que pode ter sido
  defeito, e **esconder defeito de produção é o erro caro**;
- chamar de `falha` pinta pior do que talvez seja, e no pior caso gasta o tempo
  de quem vai investigar.

E é temporário por construção: toda transferência nova grava a origem, então a
fatia só encolhe.

#### `registrarHandoff` exige a origem, sem default

E isso é a parte que mais protege o futuro: o typecheck pegou os quatro
chamadores de teste **na hora**, e quem acrescentar um quinto ponto de handoff é
forçado a decidir em vez de herdar uma classificação em silêncio. Os três pontos
de produção foram classificados um a um: `transferir_humano` é `prevista`, e
`pararNoHumano` (entrega que não saiu, IA sem modelo, integração fora) e
`desistirDaVez` (conversa travada) são `falha`.

#### Na tela

As quatro fatias aparecem escritas, **e elas somam o total de propósito**:
painel cujas partes não fecham com o todo é painel que ninguém consegue
conferir, e a primeira vez que alguém soma as colunas e não bate, a tela inteira
perde a credibilidade.

E o mais sutil do plano está feito e comentado no lugar: **a espera é medida do
pedido humano em diante**. `metricas_de_tempo` já marcava o relógio no handoff,
e a tela agora **diz isso** em vez de deixar subentendido. Contar a conversa
inteira com o bot como espera do funcionário produz um número que nenhuma equipe
reconhece, e que piora quanto melhor o bot for.

## 3. A produção: o que foi aplicado e o que a releitura mostrou

**A 0086 foi aplicada em 21/set/2026**, pela Management API, com autorização
explícita do dono pedida nesta sessão (a anterior cobria as migrations da F7 que
já tinham entrado, e não esta).

Pelos **dois** testes: replay do zero em Docker (`0001`–`0086` em ordem, sem
erro) e ensaio em transação contra a produção, os dois limpos. O `notify pgrst`
sai do ensaio de propósito: recarregar o cache dos dois produtos por causa de
uma transação que vai ser desfeita seria arriscar a API da Verandi para nada.

**O ensaio acertou o resultado exato**, e isso é a melhor parte: dentro da
transação a view respondeu `bot 5 · falha 9 · aberta 1`, e depois de aplicar de
verdade respondeu o mesmo. Somam as 15 sessões da produção.

Releitura objeto a objeto depois de aplicar:

- `handoffs.origem` `text`, **anulável, sem default**, como pretendido;
- `handoffs_origem_check` presente, com `null or in ('prevista','falha')`;
- `metricas_de_desfecho` com `security_invoker=true`;
- **`anon` e `authenticated` não aparecem** nos grants da view;
- dado nosso intacto: **37 contatos, 29 cartões, 8 handoffs, 15 sessões**, e
  `com_origem = 0`, que é exatamente o esperado (nenhum handoff antigo foi
  reclassificado).

### Uma coisa para saber, e ela não é falha

`service_role` recebeu os **7** privilégios na view nova, e não só o `SELECT` que
a migration escreve. A causa é o `grant all on all tables in schema public to
service_role` da **0041**, que alcança objeto novo, e é o mesmo efeito que a
**0042** documenta para a `af_auditoria`. Não é falha de isolamento (`anon` e
`authenticated` seguem fora), mas quem auditar grants vai ver o descompasso
entre o que a migration pede e o que o banco mostra, e a explicação é esta.

### O reload do PostgREST, nos dois produtos

`metricas_de_desfecho?select=desfecho` e `handoffs?select=origem` respondem
**200** para `service_role` e **401** para `anon` (sem 400, então o cache pegou
os objetos novos), e `app_verandi.conta` continua respondendo **200** pelo mesmo
PostgREST.

### A Verandi e o nosso dado

Medidos antes e depois: `app_verandi.migrations_aplicadas` com as mesmas **32**
linhas, **42** tabelas, **16** policies de `storage.objects`. **A Verandi não foi
tocada.**

### A ordem

**A migration entrou antes do push**, e não depois. O código da T8.2 lê
`metricas_de_desfecho` e `handoffs.origem`, então o intervalo entre `git push` e
o SQL seria a tela de início caindo para todo mundo, como caiu com a 0071.

A T7.4 e a T8.1 não têm migration, e foram empurradas assim que verificadas.

## 4. Armadilhas que custaram tempo nesta sessão

1. **Aritmética de fixture com fuso.** O teste da T8.2 esperava
   `bot 3 · aberta 1` e o banco respondeu `bot 2 · aberta 2`. **O banco estava
   certo:** a sessão gravada como `2026-09-01T01:00:00Z` é 31/ago às 22h em São
   Paulo, e o fixture original a pôs ali justamente para provar o fuso. Conferir
   a conta contra a view antes de acusar o código economiza a volta.

2. **`git push` não imprime confirmação.** `git push -q` seguido de
   `git log --oneline -1` mostra o commit local, e é fácil ler isso como "foi".
   O que prova é `git fetch && git log --oneline origin/main -1`.

3. **O teste puro passou sem alteração depois da mudança de contrato**, e isso
   foi o aviso: significava que ele não cobria os campos novos. Um teste que
   continua verde depois de você mudar o que ele deveria testar é um teste que
   não testa aquilo.

4. **Trocar retorno de função exige olhar chamador que só lê alguns campos.** O
   typecheck aprovou `clientesSumidos` com `semValor` novo sem dizer nada, porque
   ninguém era obrigado a ler o campo. Os dois lugares que escreviam `R$ 0,00`
   só apareceram no `grep` à mão. É a regra da casa funcionando, e ela vale para
   campo acrescentado e não só para booleano virando objeto.

## 5. Estado por fase

| Fase | Situação |
|---|---|
| F0 a F4 | **completas** (F4 sem as telas) |
| F5 · T5.1, T5.2, T5.3 | **completas** |
| F6 · T6.1, T6.2 | **completas**, sem os e2e |
| F7 · T7.1 a T7.4 | **completas**, sem os e2e |
| F8 · T8.1, T8.2 | **completas**, sem os e2e |
| F9 · T9.1, T9.2 | **não iniciada** |

## 6. O que ficou de fora, e por quê

- **`test/e2e/*.spec.ts` continua não existindo, e Playwright continua não sendo
  dependência.** É o item que atravessa as três últimas sessões. A T7.1 pede
  `configuracao-da-operacao.spec.ts`, a T7.4 pede `formularios.spec.ts` e a T8.2
  pede `visao-geral.spec.ts`. Instalar é decisão com custo próprio (dependência,
  navegadores no CI, tempo de execução), o plano a deixa em aberto, e ela merece
  commit separado. O que cobre esse buraco hoje são os testes de integração
  contra o Postgres de verdade e os testes puros dos módulos de decisão; o que
  falta é a jornada pelo navegador. **A T7.4 é a que mais sente a falta**: teclado,
  foco e `Esc` num `<dialog>` são precisamente o que um teste de navegador prova
  e um módulo puro não.

- **A F9 inteira**, e ela é de outra natureza: piloto, roteiro de observação,
  lista de empresas, flags, monitoramento e liberação gradual. A T9.2 diz
  explicitamente para "solicitar autorização de produção somente com esse pacote
  concreto, quando a execução chegar a esta fase".

- **O `Modal` controlado não ganhou a proteção de rascunho.** O `ModalFormulario`
  ganhou porque ele **é** o formulário e sabe o que está digitado dentro dele. O
  `Modal` recebe `aoFechar` de fora e não tem formulário próprio: a proteção ali
  teria que ser de cada um dos 13 chamadores, e alguns (`fechar-cartao`,
  `registrar-venda`, `corrigir-venda`) têm formulários de verdade que merecem a
  mesma proteção. É o próximo passo natural da T7.4, e não entrou porque o plano
  nomeia os três arquivos de `design/` e não os chamadores.

- **`MedidasDoMes` e `medirFunil` continuam existindo**, ao lado de
  `DesfechosDoMes` e `medirDesfechos`. A lista de automações ainda usa o antigo,
  e trocar as duas coisas na mesma tarefa misturaria dois consertos. Quem for
  unificar: `medirFunil` só é chamado de lá agora.

- **`handoffs.resolvido_em` não entrou na conta de desfecho.** Ele existe e diz
  quando alguém fechou o atendimento, e daria "quanto tempo a transferência
  ficou aberta", que é outra métrica boa. Não entrou porque a T8.2 pergunta
  **por que** o bot parou, e não quanto durou o que veio depois.

- **A seleção em lote continua fora da consulta única** (RB-37), como nos três
  handoffs anteriores. "Selecionar todos os 340 do filtro" ainda não existe como
  gesto.

- **`contatosDoNivel` continua devolvendo ids com teto de 5.000.** O handoff
  anterior dizia que "a T8.1 é a hora natural disso", e não foi: a T8.1 trocou a
  **fonte** de `relacionamentoDeMuitos` e não mexeu em `consultas/nivel.ts`, que
  é outro caminho. Fazer os dois no mesmo commit teria juntado uma correção de
  regra com uma mudança de paginação, e a primeira precisa poder ser revertida
  sozinha. Continua pendente, e agora com a fonte certa já no lugar.

- **As telas da F4 continuam não existindo** (`editor-de-campos.tsx`,
  `ajustes/campos/page.tsx`, `lead-crm/qualificacao.tsx`).

- **Não existe opt-out/bloqueio no schema.** Quando houver descadastro, entra em
  `servicos/elegibilidade.ts` como mais um `MotivoDaExclusao`.

- **A segunda metade da janela gratuita continua pendente:** a 72h só existe se a
  empresa responder em 24h do clique, e o código não guarda se houve resposta.

- **Os 3 lint errors anteriores continuam lá**, em `inbox/page.tsx`,
  `clientes/[clienteId]/page.tsx` e `components/inbox/fila.tsx`. A T8.2 mexeu no
  segundo arquivo e **não** resolveu o error dele: ele é um
  `react-hooks/set-state-in-effect` em outro bloco da página, e consertá-lo de
  passagem misturaria um conserto de hook com uma correção de métrica.
