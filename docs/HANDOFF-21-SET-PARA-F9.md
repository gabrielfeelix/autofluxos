# Handoff: executar a F9

> Escrito em 21/set/2026, ao fim da sessão que entregou a **T7.4, a T8.1 e a
> T8.2** e fechou a F7 e a F8.
>
> **Para quem vai executar a fase F9** do
> [plano por fases](plans/2026-09-19-operacao-chatbot-crm.md).
>
> **Estado:** F0 a F8 **completas** e em `origin/main` (último commit
> `9fdb42b`). Banco local **e produção** na **0086**. A próxima migration é a
> **0087**: confira com `ls supabase/migrations/ | tail -1` e **não copie
> numeração de plano nenhum, inclusive deste arquivo**.
>
> Leia antes o [handoff da T7.4/T8.1/T8.2](HANDOFF-21-SET-T74-E-F8.md): ele tem
> o que foi entregue, o estado medido e o §6 com tudo que ficou de fora, item a
> item, com o motivo de cada um.

## 1. Antes de escrever qualquer código

```bash
cd /home/gabfelix/dev/4yu-apps/autofluxos
git fetch && git log --oneline -4      # deve terminar em 9fdb42b

npx supabase start                     # Docker

npm run test:unit                  # 2117 passam, 14 pulados
npm run test:integration:local     # 486 passam
npm run typecheck                  # limpo
npm run build                      # limpo
npm run lint                       # 8 problemas, 3 errors ANTERIORES
```

**Se não bater, investigue antes de escrever código.** Os 3 lint errors são
anteriores, em arquivos não tocados (`inbox/page.tsx`,
`clientes/[clienteId]/page.tsx`, `components/inbox/fila.tsx`).

O banco local deve estar na 0086:

```bash
docker exec supabase_db_autofluxos psql -U postgres -d postgres \
  -tAc "select max(version) from supabase_migrations.schema_migrations"
```

**Docker pode estar desligado.** Se `npx supabase start` falhar com "The command
'docker' could not be found in this WSL 2 distro", a distro `docker-desktop` do
WSL está parada: suba o Docker Desktop no Windows e espere o engine responder.

### Consulta à produção: heredoc, sempre

**Não consulte a produção com SQL aninhado em `python3 -c` dentro de `bash`.**
As três camadas de aspas se comem e a resposta vem errada **sem erro nenhum**:
uma consulta que perguntava se colunas existiam devolveu zero para colunas que
existiam, e por um minuto pareceu que migrations tinham sumido.

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

### Leitura obrigatória, nesta ordem

1. `docs/HANDOFF-21-SET-T74-E-F8.md`: o estado atual, e o §4 e o §6 economizam
   horas.
2. `AGENTS.md` e **todo** o `docs/BANCO-COMPARTILHADO.md`: banco de produção
   compartilhado com a Verandi.
3. A seção **F9** do plano, e a tabela de aceites **A01 a A32** da proposta
   (`docs/PROPOSTA-19-SET-CHATBOT-FIRST.md`, §15.2, linhas 875 a 906).

## 2. As regras da casa (não negociáveis)

- **Nunca `git stash` nem `git reset --hard`.** Há sessões paralelas no repo.
  `git fetch` antes de começar. (`git reset --soft HEAD~1` é seguro e já foi
  usado para separar commits, depois de conferir que `origin/main` não avançou.)
- **Nada de travessão** em tela, comentário, commit ou doc. Use dois pontos.
- **Teste que fala com banco entra em `test/suites.ts`**, senão o guarda recusa.
  A lista é explícita de propósito, e `test/integracao/lista-de-integracao.test.ts`
  recusa quem usar credencial sem estar nela.
- **`service_role` ignora RLS.** Quem isola é o `client_id` em **cada** consulta.
- **Ação e rota novas precisam declarar capacidade** (`exigirCapacidade`), senão
  as travas de `acoes.test.ts` e `rotas-conferem-acesso.test.ts` quebram.
- **Ao trocar retorno de função, procure os chamadores à mão.** `if (!objeto)` é
  sempre falso e o typecheck não avisa. **Vale também para campo acrescentado:**
  na T8.1 o typecheck aprovou um campo novo sem dizer nada, e os dois lugares
  que escreviam `R$ 0,00` só apareceram no `grep`.
- **Teste de concorrência só vale depois de você vê-lo falhar.** Sabote a
  implementação de propósito e confirme os dois sentidos.
- **Regra de validação nova entra com uma ocorrência medida atrás**, nunca por
  precaução: na T7.2 um padrão escrito por precaução recusou desenho válido e
  quebrou um teste.

### A regra que comprou um incidente: migration antes do push

**Neste repositório o `git push` em `main` É o deploy.** Não existe passo
separado para esquecer.

Em 20/set/2026 o código da T5.2 foi empurrado com a `0071` ainda pendente, e a
tela `/clientes/[id]` caiu para todo mundo com React #441. Os testes locais
passavam todos, porque o Docker local tinha a coluna.

**Antes de empurrar código que lê objeto novo, aplique a migration.** E confira
o estado **consultando a produção**, nunca lendo um handoff.

## 3. O que a F9 é, e por que ela não é como as outras oito

As fases F0 a F8 eram código: um defeito medido, uma correção, um teste. **A F9
não é**, e confundir as duas coisas é o maior risco desta fase.

| Tarefa | De quem é |
|---|---|
| **T9.1** verificação integrada e revisão do legado | **sua, inteira** |
| **T9.2** itens 1, 2 e 4 (piloto com gente, empresas, liberação) | **do dono** |
| **T9.2** item 3 (o pacote concreto) | **sua**: prepare e entregue |
| **T9.2** item 5 (declarar liberado) | **do dono**, com evidência |

**Não simule o piloto e não marque a T9.2 como feita.** Observar pessoas usando
o produto, escolher empresas e liberar gradualmente não é coisa que um agente
faz. O plano é explícito no item 3: "solicitar autorização de produção somente
com esse pacote concreto, quando a execução chegar a esta fase". O que você
entrega é **o pacote**, e a frase dizendo o que depende do dono.

O item 5 diz o resto: "planejamento ou teste local não equivalem a release".

## 4. A decisão que muda o formato de toda a T9.1: Playwright

**Resolva esta primeiro**, porque ela decide como o resto da tarefa é escrito.

O estado é mais curioso do que "não existe":

```
test/e2e/                     existe, e está VAZIO
package.json  test:e2e:local  "playwright test"   <- o gancho já está lá
playwright.config.*           NÃO existe
playwright em dependências    NÃO está
```

Ou seja: alguém deixou o script pronto e a dependência nunca entrou. `npm run
test:e2e:local` hoje falha com "playwright: not found".

**Quatro arquivos `.spec.ts` estão pendentes**, e três deles são dívida das
fases anteriores:

```
test/e2e/configuracao-da-operacao.spec.ts   T7.1
test/e2e/formularios.spec.ts                T7.4
test/e2e/visao-geral.spec.ts                T8.2
test/e2e/jornada-chatbot-crm.spec.ts        T9.1  <- esta é sua
```

Instalar é decisão com custo próprio: dependência, navegadores no CI, tempo de
execução. **Se instalar, faça em commit separado, antes dos testes**, e os
quatro ficam ao alcance de uma vez. **Se não instalar, diga explicitamente que
ficaram de fora e por quê**, e escreva a T9.1 em cima do que existe (integração
contra o Postgres de verdade, e os módulos puros de decisão).

**A T7.4 é a que mais sente a falta**, e vale saber antes de decidir: teclado,
foco, `Esc` e clique no fundo de um `<dialog>` são precisamente o que um teste
de navegador prova e um módulo puro não. A T7.4 extraiu a decisão de descarte
para `components/design/rascunho-do-modal.ts` e a testou lá justamente porque
este repositório **não tem `jsdom` nem `@testing-library/react`**. O que ficou
sem prova automatizada é o gesto, não a regra.

## 5. A T9.1, item por item

### Item 1: as jornadas locais

São oito, e o plano as nomeia: só bot/inbox; só humano; SDR/venda;
pós-venda/recompra; múltiplas equipes; formulário/CTWA; importação; integração
de destino com falha.

**A primeira é a que o produto inteiro promete**, e vale conferir que ela passa
de ponta a ponta: a T7.1 fez o onboarding fechar para quem escolhe `atender`, e
`core/objetivo-da-conta.ts` é a única fonte de qual objetivo pede o quê.

### Item 2: migração duas vezes, e rollback de flags

"Simular migração duas vezes" é o **A23** ("migração roda novamente: não duplica
registros nem envia mensagens"). O replay do zero (`npx supabase db reset`) já
prova a ordem das migrations e foi feito na 0086; o que a T9.1 pede além disso é
a **idempotência do efeito de negócio**, que é outra coisa.

### Item 3: o checklist A01 a A32

**Esta é a parte grande da T9.1**, e boa parte já está coberta: vários aceites
são citados **pelo ID** dentro dos testes, então o rastreio existe.

```bash
# quem já cita cada aceite, por ID
for a in $(seq -w 1 32); do printf "A%s " "$a"; grep -rl "A$a\b" src/ test/ | tr '\n' ' '; echo; done
```

Amostra do que essa varredura devolve hoje:

| Aceite | Onde já aparece |
|---|---|
| A11 | `repos/venda-nao-e-atendimento.test.ts` |
| A13, A14, A15 | `repos/vendas.test.ts`, `core/vendas.test.ts` |
| A19, A27 | `server/permissoes.test.ts` |
| A26 | `servicos/concluir-processo.ts` |
| A05, A08, A22, A23, A31, A32 | **sem citação por ID** |

Os sem citação não estão necessariamente descobertos: podem ter teste que não
menciona o ID. **Conferir isso é o trabalho**, e o produto dele é
`docs/VALIDACAO-OPERACAO-CHATBOT-CRM.md` com evidência por aceite e as falhas
abertas nomeadas. O plano pede "checklist com evidência e falhas abertas": um
checklist todo verde sem evidência não vale nada, e um com falha nomeada vale
muito.

**Armadilha de busca, e ela morde:** `A01` também existe em `docs/SEGURANCA.md`,
onde é o **OWASP A01 (Broken Access Control)**, coisa completamente diferente do
aceite A01 ("empresa sem CRM recebe mensagem e assume atendimento"). Um `grep`
por `A01` nos docs devolve os dois. Os aceites moram **só** na proposta, §15.2.

### Item 4: medir, sem prometer número

O plano tem um aviso escrito dentro dele: *"evitar prometer latência arbitrária
neste documento"*. Leve a sério.

**O Postgres local está praticamente vazio**, e cronometrar consulta sobre zero
linha mediria a rede do Docker, não o produto. A medida honesta em base pequena
é **contagem de consultas**, e foi assim que a T7.1 mediu quando achou as 14
idas ao banco por visita. Para falar de tempo, é preciso volume representativo:
gere fixture grande, ou diga que a medida ficou pendente de base real.

**Fixture acima do tamanho da página** é o que expõe defeito de filtro: na T6.1
uma condição caiu num `switch` sem caso e devolveu a base inteira, sem erro, e
com 5 contatos de teste teria passado.

### Item 5: o isolamento AutoFluxos/Verandi

Este é o item que o `BANCO-COMPARTILHADO.md` responde, e ele tem o registro de
cada migration aplicada com a releitura correspondente. O que a T9.1 acrescenta
é a revisão de que **nada indevido** foi mexido em Auth, Storage, extensões ou
Data API.

Os números de referência, medidos em 21/set antes e depois da 0086:

```
app_verandi.migrations_aplicadas   32 linhas
app_verandi tabelas                42
storage.objects policies           16
nosso dado   37 contatos · 29 cartões · 8 handoffs · 15 sessões
```

**Uma coisa que você vai encontrar e que não é falha:** `service_role` tem os 7
privilégios em objetos novos de `public`, e não só o `SELECT` que as migrations
escrevem. É o `grant all on all tables in schema public to service_role` da
**0041** alcançando objeto novo, o mesmo efeito que a **0042** documenta para a
`af_auditoria`. `anon` e `authenticated` seguem fora, que é o que importa.

## 6. O que a produção diz hoje, e como isso muda o teste

```
vendas: 0 · cartões ganhos: 0 · quadros comerciais: 0 · quadros: 7
sessões: 15 (10 encerrada · 4 humano · 1 ativa)
handoffs: 8, TODOS sem `origem` (portanto lidos como `falha`)
contatos: 37 · cartões: 29 · contas: 6
```

Duas consequências diretas:

1. **Qualquer aceite que dependa de dado comercial precisa de fixture.** Todo
   contato da produção lê `sem_compra` hoje, então conferir A11/A14/A15 lá não
   prova nada. A T8.1 já enfrentou isso e a lição ficou: a prova mora no teste
   de integração com fixture.
2. **A fatia `prevista` da 0086 é zero na produção, e isso está certo.** Nenhum
   handoff antigo tem `origem`, e a migration não fez backfill de propósito: nulo
   quer dizer "gravado antes de o produto saber distinguir". A fatia só encolhe a
   partir da primeira transferência nova. Não trate o zero como defeito.

## 7. Armadilhas que já custaram tempo (leia antes, não depois)

1. **Aritmética de fixture com fuso.** Um teste esperava `bot 3 · aberta 1` e o
   banco respondeu `bot 2 · aberta 2`. **O banco estava certo:** a sessão gravada
   como `2026-09-01T01:00:00Z` é 31/ago às 22h em São Paulo. As métricas usam
   `America/Sao_Paulo`, e o fixture original pôs aquela linha ali de propósito.
2. **`git push -q` não imprime confirmação.** Seguido de `git log --oneline -1`
   mostra o commit local, e é fácil ler isso como "foi". O que prova é
   `git fetch && git log --oneline origin/main -1`.
3. **Teste que continua verde depois de você mudar o que ele deveria testar não
   testa aquilo.** Na T8.1 o teste puro passou sem alteração depois de uma
   mudança de contrato, e isso foi o aviso de que faltava cobertura.
4. **Filtro que não filtra é pior que filtro que recusa** (T6.1, ver o item 4 do
   §5).
5. **`messages` não tem `channel_id`**, usa `session_id`, tem `ts` em vez de
   `criado_em`, e não tem `client_id`: três desvios do vocabulário do schema na
   mesma tabela. Fixture de janela de 24h precisa saber dos três, e ainda de
   `historico = false` e `wa_message_id`.
6. **`returns table (id uuid, ...)` dá 42702.** Os nomes de saída levam `o_`. Já
   mordeu na 0033, 0072, 0076 e 0080.
7. **`templates.nome` exige `^[a-z0-9_]+$`** (regra da Meta). Marca de teste com
   traço não passa.
8. **`vi.clearAllMocks()` zera o retorno padrão do mock**; re-arme no `beforeEach`.
9. **Componente de cliente não importa de módulo `server-only`.** Funciona
   enquanto só tipo e constante atravessam, e quebra na primeira linha com banco.
10. **`upsert ... onConflict` não funciona com índice parcial.**
11. **`inscrever` devolve `null` quando já há uma ativa**, pelo índice único
    parcial. Num arquivo com vários casos sobre o mesmo contato isso aparece como
    `Cannot read properties of null`: cada caso limpa antes, e a limpeza é
    fixture, não asserção.

## 8. O que está pendente e encosta nesta fase

Estes são os itens do §6 do handoff anterior que a F9 provavelmente vai
encontrar. Nenhum é bloqueio da F9; todos são candidatos naturais a entrar junto
se a verificação os expuser.

- **Os quatro `.spec.ts`**, e a decisão do Playwright. Ver o §4.
- **A proteção de rascunho nos chamadores do `Modal` controlado.** O
  `ModalFormulario` ganhou na T7.4; o `Modal` recebe `aoFechar` de fora e não tem
  formulário próprio, então a proteção teria que ser de cada um dos 13
  chamadores. `fechar-cartao`, `registrar-venda` e `corrigir-venda` têm
  formulários de verdade e merecem a mesma coisa. **É o A22** ("fechar modal
  alterado, erro de rede ou conflito: usuário mantém dados e tem recuperação
  clara"), então a T9.1 vai bater nisso ao conferir o checklist.
- **`medirFunil` e `MedidasDoMes` continuam existindo** ao lado de
  `medirDesfechos` e `DesfechosDoMes`. A lista de automações ainda usa o antigo, e
  `medirFunil` só é chamado de lá agora.
- **`handoffs.resolvido_em` não entrou na conta de desfecho.** Daria "quanto
  tempo a transferência ficou aberta", que é outra métrica boa. A T8.2 pergunta
  **por que** o bot parou, não quanto durou o que veio depois.
- **A seleção em lote continua fora da consulta única** (RB-37). "Selecionar
  todos os 340 do filtro" ainda não existe como gesto. **É o A18**, parcialmente.
- **`contatosDoNivel` devolve ids com teto de 5.000** (`server/consultas/nivel.ts`).
  O handoff da F7/F8 apostou que a T8.1 seria a hora, e não foi: a T8.1 trocou a
  **fonte** de `relacionamentoDeMuitos`, e `nivel.ts` é outro caminho. Continua
  pendente, agora com a fonte certa já no lugar.
- **As telas da F4 não existem** (`editor-de-campos.tsx`, `ajustes/campos/page.tsx`,
  `lead-crm/qualificacao.tsx`).
- **Não existe opt-out/bloqueio no schema.** Quando houver descadastro, entra em
  `servicos/elegibilidade.ts` como mais um `MotivoDaExclusao`.
- **A segunda metade da janela gratuita continua pendente:** a 72h só existe se a
  empresa responder em 24h do clique, e o código não guarda se houve resposta.
  Erra para o lado conservador, mas é promessa de custo não verificada.
- **Os 3 lint errors anteriores** seguem em `inbox/page.tsx`,
  `clientes/[clienteId]/page.tsx` e `components/inbox/fila.tsx`.

## 9. Como verificar, e o que reportar

Depois de **cada tarefa**: `npm run test:unit`, `npm run test:integration:local`,
`npm run typecheck`, `npm run lint`. `npm run build` nos marcos de interface.
Migration nova: aplique no Docker **e** rode o replay do zero
(`npx supabase db reset`), que é o que prova a ordem.

Commit e push **por tarefa**, com a mensagem dizendo o defeito medido, a decisão
e o que ficou de fora.

**Sobre produção:** a autorização da `0086` valeu só para ela, e **não se
estende** à F9. Peça antes de aplicar qualquer coisa. O procedimento está no
`BANCO-COMPARTILHADO.md`: Management API, uma por vez, replay em Docker e ensaio
em transação antes, releitura objeto a objeto depois, e conferir a Verandi se
houver `notify pgrst`.

**No fim da fase**, escreva `docs/HANDOFF-F9.md` no mesmo formato deste, e relate
ao dono o que ficou de fora e por quê: **em especial, o que da T9.2 depende
dele e ficou esperando**.

## 10. Estado por fase

| Fase | Situação |
|---|---|
| F0 a F4 | **completas** (F4 sem as telas) |
| F5 · T5.1, T5.2, T5.3 | **completas** |
| F6 · T6.1, T6.2 | **completas**, sem os e2e |
| F7 · T7.1 a T7.4 | **completas**, sem os e2e |
| F8 · T8.1, T8.2 | **completas**, sem os e2e |
| F9 · T9.1 | **a fazer** (§5, item por item) |
| F9 · T9.2 | **a fazer**, e majoritariamente **do dono** (§3) |
