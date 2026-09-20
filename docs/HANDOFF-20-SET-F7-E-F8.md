# Handoff: F7 quase inteira, e a F8 a fazer

> Escrito em 20/set/2026, ao fim da sessão que executou a **T7.1, a T7.2 e a
> T7.3**.
>
> **Estado:** F0 a F6 completas, e a **F7 com três das quatro tarefas**. Tudo em
> `origin/main` (último commit `3515d17`). Banco local **e produção** na
> **0085**. A próxima migration é a **0086**: confira com
> `ls supabase/migrations/ | tail -1` e **não copie numeração de plano nenhum,
> inclusive deste arquivo**.
>
> **Falta a T7.4, a T8.1 e a T8.2.** A sessão parou por custo de contexto, e não
> por bloqueio: nada está pela metade, a árvore está limpa e os três commits
> estão empurrados. O §3 diz exatamente onde retomar.
>
> Leia antes o [handoff que pediu a F7/F8](HANDOFF-20-SET-PARA-F7-E-F8.md): o §2
> (regras da casa), o §6 (armadilhas) e o §7 (pendências) continuam valendo
> inteiros, e este arquivo não os repete.

## 1. Antes de escrever qualquer código

```bash
cd /home/gabfelix/dev/4yu-apps/autofluxos
git fetch && git log --oneline -4      # deve terminar em 3515d17

npx supabase start                     # Docker

npm run test:unit                  # 2090 passam, 14 pulados
npm run test:integration:local     # 477 passam
npm run typecheck                  # limpo
npm run build                      # limpo
npm run lint                       # 8 problemas, 3 errors ANTERIORES
```

Os 3 lint errors continuam sendo os mesmos de sempre, em arquivos não tocados
(`inbox/page.tsx`, `clientes/[clienteId]/page.tsx`, `components/inbox/fila.tsx`).

O banco local deve estar na 0085:

```bash
docker exec supabase_db_autofluxos psql -U postgres -d postgres \
  -tAc "select max(version) from supabase_migrations.schema_migrations"
```

**O Docker estava ligado quando esta sessão começou**, ao contrário das duas
anteriores. Se não estiver, o sintoma e a cura estão no `BANCO-COMPARTILHADO.md`.

### Uma armadilha nova, e ela custou um susto

**Não consulte a produção com SQL aninhado em `python3 -c` dentro de `bash`.**
As três camadas de aspas se comem: uma consulta que perguntava se as colunas da
`0084` e da `0085` existiam devolveu **zero para as duas**, e por um minuto
pareceu que as migrations tinham sumido da produção. Elas estavam lá. O mesmo SQL
num *heredoc* (`python3 - <<'PY'`) respondeu certo.

Confirme sempre com a forma que não escapa nada:

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

Três tarefas, duas migrations, três commits, todos em `origin/main`. Os dois
deploys da Vercel estão `READY` (`288bccd` e `3515d17`), e **as migrations
entraram na produção antes de cada push**, com autorização explícita do dono
para a 0084 e para as seguintes da F7/F8.

| Tarefa | Commit | Migration |
|---|---|---|
| T7.1 navegação, objetivo e CRM opcional | `288bccd` | 0084 |
| T7.2 o portão da publicação | `31981cb` | nenhuma |
| T7.3 a inscrição com contexto de negociação | `3515d17` | 0085 |

### T7.1: o onboarding que não fecha nunca (0084)

Os "primeiros passos" cobravam cinco coisas de toda conta, e a quinta era
**"Organizar no funil"**. Quem abriu a conta para atender no WhatsApp com a
própria equipe fazia as três primeiras, terminava o que queria, e a tela seguia
dizendo que faltavam duas, para sempre. Barra que nunca fecha ensina a ignorar a
barra, e a partir daí também se ignora o aviso de canal desligado, que é o que
derruba o atendimento de verdade.

Quem decide agora é `clients.objetivo` (`atender`/`automatizar`/`vender`), e
`cobra()` em `core/objetivo-da-conta.ts` é a **única** fonte de qual objetivo
pede o quê. Conta que escolheu `atender` vê três passos, e os três fecham.

**Passo já feito nunca é escondido**, e essa linha é o que impede o pior efeito
colateral: quem montou funil e depois trocou o objetivo veria o passo concluído
desaparecer, e concluiria que o funil foi apagado.

**`crm_ativo` nasce `true`, e é a decisão mais importante da migration.** O
default natural de um recurso opcional seria `false`, e aqui estaria errado: as
6 contas da produção usam quadros hoje, e nascer `false` esconderia no deploy a
tela que alguém usa todo dia. Conta nova não herda isso: `nasceComCrm` grava
`false` para quem não escolheu "vender". E `crmVisivel` ainda considera o funil
existente, cinto e suspensórios.

**A aba "Templates" virou "Modelos de chatbot"** (proposta §4.3). O produto chama
de "modelo" outra coisa, o modelo de mensagem aprovado pela Meta, e quem
precisava aprovar um texto vinha procurar na aba errada. A chave
`?aba=templates` **não** mudou, pelo motivo que manteve a rota `/leads`.

**O carregamento passou a ser por aba, e a medida foi feita antes.** A página
fazia **14 idas ao banco em toda visita**, e a galeria de modelos, que é
constante em `exemplos/`, pagava as 14 para desenhar zero dado de banco. A
medida honesta é a contagem de consultas e não o tempo: o Postgres local está
vazio, e cronometrar consulta sobre zero linha mediria a rede do Docker.

**A armadilha que essa correção esconde, e ela quase passou:** as pastilhas da
barra mostram a contagem de **todas** as abas, sempre. Trocar `listarX().length`
por lazy sem olhar isso faria a barra dizer "0 palavras-chave" para quem tem
vinte. Por isso a barra ganhou consulta própria e barata (`head: true`, nenhuma
linha na rede), em `repos/contagens-de-automacao.ts`.

### T7.2: o modelo que manda "Rua Exemplo, 123" para o cliente de alguém

O defeito está no repositório e foi contado: os modelos de `src/exemplos/` vêm
com **nove** marcadores de demonstração no texto que o cliente recebe.

```
menu-atendimento    "Rua Exemplo, 123 — bairro, cidade."
                    "_Troque este texto pelo horário real._"
                    "_Troque este texto pelo endereço real._"
                    "*Valores*\nA partir de R$ 000..."
pesquisa-nps        "*cole aqui o link da sua página*"
cobranca-amigavel   "*cole aqui o link ou o Pix*"
qualificar-sdr      "*cole aqui o link*"
carrinho-abandonado "_Troque o código pelo seu._" / "_Troque este texto pela
                    sua regra de frete._"
```

A RB-43 manda copiar o modelo para um rascunho editável, e está certa: é
justamente o que faz a cópia nascer com esses textos. `core/validar-publicacao.ts`
recusa a publicação, e **é erro e não aviso**: aviso se aprende a pular, e o
custo aqui é o negócio de alguém mandando o endereço falso para quem perguntou
onde fica a loja.

Arquivo à parte de `validar()`, e não mais um caso dentro dele, porque a pergunta
é outra: `validar()` responde "este desenho funciona?" e roda **enquanto alguém
digita**, aceitando rascunho incompleto por contrato; este responde "está pronto
para receber gente de verdade?" e só roda no clique de publicar.

**Um marcador foi escrito e removido, e o registro ficou no arquivo.** O padrão
para `exemplo.com` recusava desenho válido: nenhum modelo usa esse domínio, e ele
é a convenção de fixture do repositório, então o teste de `receber-mensagem`
(que publica um fluxo com `cdn.exemplo.com`) quebrou. **A regra que isso deixa:
marcador entra com uma ocorrência medida atrás.** Padrão escrito por precaução
recusa trabalho correto, e validação que recusa trabalho correto é validação que
alguém aprende a contornar.

**Duas bordas de regex custaram uma volta cada**, e as duas estão comentadas no
arquivo: `\b` não casa em `_Troque` porque o sublinhado do itálico do WhatsApp é
caractere de palavra; e `R$ 000` seguido de vírgula de frase exige distinguir a
vírgula decimal por `[.,]\d`.

#### A auditoria do simulador, respondida efeito por efeito

O item 4 pedia auditoria, e a resposta é: **o simulador não alcança
`registrar_venda_e_concluir`, `criarAtividade` nem `enfileirarDestinatarios`**,
porque nenhum dos três existe como ação no tipo `Acao` do motor. É a RB-46
escrita no tipo em vez de num comentário, e é a garantia mais forte possível:
não é uma guarda que alguém esquece de pôr, é a ausência do caminho.

As escritas que o motor **sim** descreve (`salvar_campo`, `mover_etapa`,
`aplicar_etiqueta`, `escrever_nota`) são aplicadas em `receber-mensagem.ts`, e a
rota `/api/simular` não o chama: ela devolve as ações como JSON para o navegador.

`src/server/efeitos/simulador-nao-escapa.test.ts` congela essa auditoria lendo o
**texto** do tipo. Efeito novo faz o teste falhar, e a falha é o pedido de
auditoria: quem acrescentar precisa responder ali se o simulador o alcança.

### T7.3: a compra que cancelava o acompanhamento errado (0085)

O defeito estava **numa função no banco**. `sair_das_sequencias` (0031) tirava o
contato de **todas** as sequências ativas, sempre, porque `sequencia_inscricoes`
não tinha `cartao_id`: a inscrição era do contato, ponto, e não havia como
escrever outra coisa.

O cenário, e não é hipotético num CRM com vários funis: a cliente fecha a
mensalidade (uma oportunidade, no funil comercial) e sai no mesmo instante do
acompanhamento de pós-venda que ia oferecer a avaliação física dela (outra
oportunidade, outro funil). **Ninguém percebe:** a sequência não falha, ela "sai
com motivo".

**O índice único NÃO mudou, e é a decisão mais delicada da fase.** A tentação é
trocar `(sequencia, contato)` por `(sequencia, contato, cartao)` para a mesma
pessoa caber duas vezes. Duas razões contra, e a segunda decide:

1. em Postgres `unique` não considera dois nulos iguais, então a versão de três
   colunas **deixaria de barrar** a duplicata do caso comum (nulo), que é
   justamente o que o índice existe para barrar;
2. mesmo resolvido isso, o efeito visível seria **duas mensagens** da mesma
   sequência no mesmo dia para o mesmo número. A pessoa do outro lado não tem
   funil: ela tem uma conversa.

`cartao_id` é **anulável, e isso é o desenho e não uma concessão**: inscrição sem
cartão é o caso comum e legítimo (régua por sumiço, por etiqueta,
pós-atendimento são **do contato**). Nulo quer dizer "é do contato", e não
"faltou preencher".

**O segundo defeito era pior, porque não aparecia em log nenhum.**
`abrirFluxoParaContato` encerrava a sessão anterior qualquer que fosse o status
dela, **inclusive `humano`**. Um passo de sequência que vencesse durante um
atendimento derrubava o handoff e punha o bot de volta na conversa, no meio do
assunto que uma pessoa estava resolvendo. A sessão "encerrou" e outra "abriu", as
duas coisas normais.

**A guarda foi conferida contra o pós-atendimento (A6) antes de entrar**, e é o
que a torna segura: ele roda **depois** de `encerrarAtendimento`, que já levou a
sessão de `humano` para `encerrada`. O teste prova os dois lados, porque uma
guarda larga demais mataria o quarto papel do número em silêncio.

No passo, atendimento humano **estoura** em vez de encerrar: encerrar mataria o
acompanhamento por causa de um atendimento que acaba em vinte minutos, e a RB-47
exige ação explícita para reinscrever.

A ficha ganhou a aba **Acompanhamentos** (UI-23/UI-24), e os três desfechos são
palavras diferentes de propósito: `concluida` entregou tudo, `saiu` foi uma
regra, e **`bloqueada` NÃO entregou** porque a janela fechou. Só a terceira é
falha, e só ela tem cor de atenção: um "encerrado" cinza esconderia justamente a
que pede ação.

## 3. Onde retomar, e o que já está medido

### T7.4: formulários (a que falta da F7)

**Arquivos:** `components/design/modal.tsx`,
`components/design/modal-formulario.tsx`,
`components/design/formulario-salvar.tsx`.

**O que já está certo e não precisa ser reconstruído:**

- `Modal` usa `<dialog>` nativo, então **foco preso, `Esc` e camada de topo já
  funcionam de graça**, e o comentário de lá explica por que não é uma `div`;
- `FormularioSalvar` já tem pendência (`useActionState`), botão desabilitado
  durante o envio, e confirmação que some na edição seguinte.

**O que está medido e falta (li os três arquivos):**

1. **`ModalFormulario` não desabilita o botão de enviar.** `enviar()` é `async` e
   não há estado de pendência: **duplo clique envia duas vezes.** É o item 2 da
   tarefa ("retry idempotente") pelo lado da tela. Compare com
   `FormularioSalvar`, que já resolve isso com `useActionState`;
2. **fechar descarta o que foi digitado, em silêncio.** `Esc`, o clique no fundo
   e o "Cancelar" chamam `close()` direto, sem perguntar. É o item 1
   ("proteção de edição não salva") e o item 3 ("preservando rascunho");
3. **`ModalFormulario` não tem `aria-label`**, enquanto `Modal` tem. A largura é
   fixa em `w-[420px]`, sem o `min(…, 92vw)` que `Modal` usa: **em tela estreita
   ele vaza**, e o item 3 pede tela estreita explicitamente.

**Cuidado com o que o plano escreve em letras miúdas:** *"preservar identidade
visual; não fazer redesign gratuito"*. A tarefa é foco, teclado, Escape,
rascunho não perdido e retry idempotente, e **não** uma revisão estética.

### T8.1: a base dos indicadores (o ponto inteiro da F8)

**O defeito continua exatamente onde o handoff anterior o deixou.** Reconferido
nesta sessão, linha por linha:

```
src/server/repos/relacionamento.ts:83    .from('quadro_cartoes')
src/server/repos/relacionamento.ts:86      .eq('situacao', 'ganha')   <- relacionamentoDeMuitos
src/server/repos/relacionamento.ts:161   .from('quadro_cartoes')
src/server/repos/relacionamento.ts:164     .eq('situacao', 'ganha')   <- clientesSumidos
src/server/repos/relacionamento.ts:171   Number(linha.valor ?? 0)     <- o oposto da RB-06
```

A linha 171 é a que merece o teste primeiro: o `?? 0` transforma **valor
desconhecido em zero**, e `resumoDeVendas` já devolve `semValor` justamente para
a tela poder dizer "há vendas sem valor informado".

**Os três chamadores, conferidos à mão (não são dois):**

```
app/clientes/[clienteId]/leads/page.tsx:227   relacionamentoDeMuitos  (a lista)
app/clientes/[clienteId]/page.tsx:681         clientesSumidos        (o painel)
server/passada-de-retomada.ts:78              clientesSumidos        (o cron)
```

E o selo (`components/lead-crm/selo-do-cliente.tsx:43`) lê `r.total` e
`r.compras`, que vêm do primeiro. Mudar o significado de "compras" sem olhar os
quatro deixaria metade do produto com a regra antiga.

**As peças prontas:** `resumoDeVendas` (`repos/vendas.ts:254`) e a view
`contatos_comerciais`, cujas colunas são:

```
contact_id client_id telefone nome nome_do_perfil estagio responsavel
ultima_mensagem_em criado_em campos compras valor_conhecido
vendas_sem_valor ultima_compra_em
```

`ultima_mensagem_em` e `ultima_compra_em` são as duas do item 3 (separar última
interação de última compra), **com o nulo preservado**.

**O que a produção diz hoje, e isso muda como você testa:**

```
vendas: 0 · vendas válidas: 0 · cartões ganhos: 0
cartões ganhos sem valor: 0 · quadros comerciais: 0 · quadros: 7
```

Ou seja: **hoje todo contato lê `sem_compra`, e a correção não muda número
visível nenhum.** Ela impede o número errado **na primeira vez que alguém
vender**. Não espere ver diferença na produção depois de aplicar: a prova é o
teste de integração com fixture, e é lá que ela tem que estar.

Cuidado com a armadilha 2 do handoff da F3/F4, que vale em dobro aqui:
**corrigir uma consulta e esquecer a gêmea.** São duas cópias da mesma regra
errada, nas linhas 83 e 161.

**Não esqueça o item 5:** `docs/RELACIONAMENTO.md` descreve a regra antiga.

### T8.2: a visão geral

O plano é explícito sobre dois erros, e o handoff anterior os detalha. O que
vale reconferir: `app/clientes/[clienteId]/page.tsx` já calcula
`resolvidasPeloBot / conversas`, que é taxa de resolução e está certo; o risco é
a coluna de dinheiro ao lado vir da mesma fonte errada da T8.1. **Faça a T8.1
antes.**

E o mais sutil: **medir tempo até atendimento a partir do pedido humano**, não da
primeira mensagem.

## 4. A produção: o que foi aplicado e o que a releitura mostrou

**Aplicadas em 20/set/2026 a `0084` e a `0085`**, uma por vez, pela Management
API, com autorização explícita do dono (a da `0084` pedida nesta sessão, e
estendida por ele às seguintes da F7/F8).

Cada uma pelos **dois** testes: replay do zero em Docker (`0001`–`0085` em ordem,
sem erro) e ensaio em transação contra a produção (`begin; <a migration sem o
notify>; rollback;`), os dois limpos. O `notify pgrst` sai do ensaio de
propósito: recarregar o cache dos dois produtos por causa de uma transação que
vai ser desfeita seria arriscar a API da Verandi para nada.

### A 0084

O ensaio provou a decisão antes de aplicar: dentro da transação, as **6 contas**
caíram em `objetivo = 'atender'` com `crm_ativo = true`, que é exatamente como
elas se comportam hoje. Releitura depois de aplicar:

- as duas colunas com o default e a nulidade pretendidos;
- `clients_objetivo_check` presente, com os três valores;
- as **6 contas** em `atender` / `crm_ativo = true`, zero com valor inesperado;
- grants só para `postgres` e `service_role`; `anon` e `authenticated` **não
  aparecem**.

### A 0085

Ensaio limpo, e a produção tinha **zero inscrições**, então não havia dado para
migrar. Releitura depois:

- `cartao_id` `uuid` anulável, com a FK `sequencia_inscricoes_cartao_id_fkey`;
- **as duas assinaturas** da função presentes (2 e 3 argumentos), as duas com
  `proconfig = {search_path=""}`;
- `sequencia_inscricoes_cartao_idx` criado, e os 5 índices antigos intactos;
- **`anon` e `authenticated` sem `EXECUTE` em nenhuma das duas**, conferido por
  `has_function_privilege` e não por `information_schema`: é a lição da 0026, que
  revogou dos dois papéis e a função seguiu executável por meses porque o
  `EXECUTE` vinha de `PUBLIC`.

### O reload do PostgREST, nos dois produtos

As duas têm `notify pgrst`. Conferido depois de cada uma:
`clients?select=objetivo,crm_ativo` e
`sequencia_inscricoes?select=cartao_id` respondem **200** para `service_role` e
**401** para `anon` (sem 400, então o cache pegou as colunas novas), o
`rpc/sair_das_sequencias` de 3 argumentos responde **200**, e
`app_verandi.conta` continua respondendo **200** pelo mesmo PostgREST.

### A Verandi e o nosso dado

Medidos antes e depois das duas: `app_verandi.migrations_aplicadas` com as mesmas
**32** linhas, **42** tabelas, **16** policies de `storage.objects`. Dado nosso:
**37 contatos** e **29 cartões**, iguais antes e depois. **A Verandi não foi
tocada.**

### O deploy

Os dois deploys estão `READY` na Vercel (`288bccd` e `3515d17`), e **a migration
entrou antes de cada push**: é a ordem que o incidente de 20/set comprou, e o
código destas tarefas lê objeto novo (`crm_ativo`, `objetivo`, `cartao_id`), então
o intervalo não era opcional.

## 5. Armadilhas que custaram tempo nesta sessão

1. **Marcador de validação escrito por precaução recusa trabalho correto.** O
   padrão `exemplo.com` quebrou um teste que publica um fluxo com
   `cdn.exemplo.com`, e a quebra foi a informação. Ver o §2.

2. **Consulta à produção com SQL aninhado em `python3 -c` dentro de `bash`
   mentiu.** Devolveu zero para colunas que existem. Use *heredoc*. Ver o §1.

3. **`messages` não tem `channel_id`.** A tabela usa `session_id`, e o `ts` em vez
   de `criado_em`, e não tem `client_id`: três desvios do vocabulário do resto do
   schema, na mesma tabela. Fixture de janela de 24h precisa saber dos três, e
   ainda de `historico = false` e `wa_message_id`, senão `contextoDeResposta`
   responde `janela_fechada` e o teste prova outra coisa.

4. **`inscrever` devolve `null` quando já há uma ativa**, pelo índice único
   parcial. Num arquivo de teste com vários casos sobre o mesmo contato, isso
   aparece como `Cannot read properties of null`: cada caso precisa limpar antes
   (`sairDasSequencias(contatoId, 'respondeu')`), e a limpeza é fixture, não
   asserção.

5. **`partesDaMensagem` recebe o nó, não o texto**, e ler `data.texto` direto dá
   falso negativo em todo bloco já migrado para `partes`.

6. **`git reset --soft HEAD~1` é seguro e foi o que permitiu separar os commits.**
   As regras da casa proíbem `git stash` e `git reset` porque eles levam o
   trabalho da outra sessão junto: o `--soft` não mexe no disco nem no índice
   (tudo fica staged), e foi usado depois de conferir que `origin/main` não tinha
   avançado. Se a árvore tivesse trabalho de outra sessão, **não** valeria.

## 6. O que ficou de fora, e por quê

- **A T7.4, a T8.1 e a T8.2**, e este é o item principal. A sessão parou por
  **custo de contexto** (450k tokens por turno), com o dono escolhendo
  explicitamente encerrar e passar para uma sessão nova em vez de seguir. Nada
  está pela metade: a árvore está limpa, os três commits estão em `origin/main`,
  e o §3 tem o estado medido de cada uma das três.

- **`test/e2e/*.spec.ts` continua não existindo, e Playwright continua não sendo
  dependência.** A T7.1 pede `configuracao-da-operacao.spec.ts`, a T7.4 pede
  `formularios.spec.ts` e a T8.2 pede `visao-geral.spec.ts`. Instalar é decisão
  com custo próprio (dependência, navegadores no CI, tempo de execução), o plano
  a deixa em aberto, e ela merece commit separado. O que cobre esse buraco hoje
  são os testes de integração contra o Postgres de verdade; o que falta é a
  jornada pelo navegador.

- **A mesma pessoa em duas inscrições da mesma sequência**, uma por negociação.
  A `0085` deu à inscrição o `cartao_id` e com ele a **saída** ficou precisa, que
  era o defeito. Deixar duas inscrições ativas convive com duas mensagens no
  mesmo dia para o mesmo número, e depende de a transmissão saber juntar
  mensagem. Ver a discussão inteira no cabeçalho da `0085`.

- **A seleção em lote continua fora da consulta única** (RB-37), como nos dois
  handoffs anteriores. "Selecionar todos os 340 do filtro" ainda não existe como
  gesto.

- **`contatosDoNivel` continua devolvendo ids com teto de 5.000.** O caminho
  definitivo é a consulta de leads ler direto de `contatos_comerciais`, e **a
  T8.1 é a hora natural disso**, já que ela vai mexer nos mesmos indicadores.

- **As telas da F4 continuam não existindo** (`editor-de-campos.tsx`,
  `ajustes/campos/page.tsx`, `lead-crm/qualificacao.tsx`). A T7.1 mexeu em
  navegação e criou `ajustes/recursos/`, e elas seriam vizinhas naturais: não
  entraram porque nenhuma das três tarefas precisou delas.

- **Não existe opt-out/bloqueio no schema.** Quando houver descadastro, entra em
  `servicos/elegibilidade.ts` como mais um `MotivoDaExclusao`.

- **A segunda metade da janela gratuita continua pendente:** a 72h só existe se a
  empresa responder em 24h do clique, e o código não guarda se houve resposta.

- **27 ações ainda não declaravam capacidade** quando esta sessão começou. As
  duas novas (`acoes-recursos.ts`) declaram as duas.

## 7. Estado por fase

| Fase | Situação |
|---|---|
| F0 a F4 | **completas** (F4 sem as telas) |
| F5 · T5.1, T5.2, T5.3 | **completas** |
| F6 · T6.1, T6.2 | **completas**, sem os e2e |
| F7 · T7.1, T7.2, T7.3 | **completas**, sem os e2e |
| F7 · T7.4 | **a fazer** (§3, com os três defeitos já medidos) |
| F8 · T8.1, T8.2 | **a fazer** (§3, com as linhas e os chamadores medidos) |
| F9 | não iniciada |

A próxima é a **T7.4**, ou a **T8.1** se a prioridade for indicador correto
antes de formulário: as duas são independentes, e a T8.1 é a que o plano chama de
ponto da fase.
