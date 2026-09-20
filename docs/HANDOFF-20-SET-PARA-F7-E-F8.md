# Handoff: executar a F7 e a F8

> Escrito em 20/set/2026, ao fim da sessão que entregou a F5 e a F6 inteiras.
>
> **Para quem vai executar as fases F7 e F8** do
> [plano por fases](plans/2026-09-19-operacao-chatbot-crm.md).
>
> **Estado:** F0 a F6 completas e em `origin/main` (último commit `8c659f6`).
> Banco local **e produção** na **0083**. A próxima migration é a **0084**:
> confira com `ls supabase/migrations/ | tail -1` e **não copie numeração de
> plano nenhum, inclusive deste arquivo**.
>
> Leia antes o [handoff da F5/F6](HANDOFF-19-SET-F5-E-F6.md): ele tem o que foi
> entregue, o que ficou de fora e o incidente de produção que abriu o §7 daqui.

## 1. Antes de escrever qualquer código

```bash
cd /home/gabfelix/dev/4yu-apps/autofluxos
git fetch && git log --oneline -7      # deve terminar em 8c659f6

npx supabase start                     # Docker

npm run test:unit                  # 2029 passam, 14 pulados
npm run test:integration:local     # 444 passam
npm run typecheck                  # limpo
npm run build                      # limpo
npm run lint                       # 8 problemas, 3 errors ANTERIORES
```

**Se não bater, investigue antes de escrever código.** Os 3 lint errors são
anteriores, em arquivos não tocados (`inbox/page.tsx`,
`clientes/[clienteId]/page.tsx`, `components/inbox/fila.tsx`).

O banco local deve estar na 0083:

```bash
docker exec supabase_db_autofluxos psql -U postgres -d postgres \
  -tAc "select max(version) from supabase_migrations.schema_migrations"
```

**Docker pode estar desligado.** Se `npx supabase start` falhar com "The command
'docker' could not be found in this WSL 2 distro", a distro `docker-desktop` do
WSL está parada: suba o Docker Desktop no Windows e espere o engine responder.

### Leitura obrigatória, nesta ordem

1. `docs/HANDOFF-19-SET-F5-E-F6.md`: o estado atual, e o §4 e o §7 economizam
   horas.
2. `AGENTS.md` e **todo** o `docs/BANCO-COMPARTILHADO.md`: banco de produção
   compartilhado com a Verandi.
3. As seções **F7** e **F8** do plano, e as regras **RB-43 a RB-48** (F7) e
   **RB-06, RB-29, RB-32, RB-35, RB-41** (F8) da proposta.

## 2. As regras da casa (não negociáveis)

- **Nunca `git stash` nem `git reset`.** Há sessões paralelas no repo. `git
  fetch` antes de começar.
- **Nada de travessão** em tela, comentário, commit ou doc. Use dois pontos.
- **Teste que fala com banco entra em `test/suites.ts`**, senão o guarda recusa.
- **`service_role` ignora RLS.** Quem isola é o `client_id` em **cada**
  consulta, não o Postgres.
- **Ação e rota novas precisam declarar capacidade** (`exigirCapacidade`), senão
  as travas de `acoes.test.ts` e `rotas-conferem-acesso.test.ts` quebram.
- **Ao trocar retorno de booleano para objeto, procure os chamadores à mão:**
  `if (!objeto)` é sempre falso e o typecheck não avisa.
- **Teste de concorrência só vale depois de você vê-lo falhar.** Sabote a
  implementação de propósito e confirme os dois sentidos.

### A regra que a sessão passada comprou caro: migration antes do push

**Neste repositório o `git push` em `main` É o deploy.** Não existe passo
separado para esquecer.

Em 20/set/2026 o código da T5.2 (`listarQuadros` lendo `quadros.finalidade`) foi
empurrado com a `0071` ainda pendente na produção, e a tela `/clientes/[id]` caiu
para todo mundo com React #441. Os testes locais passavam todos, porque o Docker
local tinha a coluna.

**Antes de empurrar código que lê objeto novo, aplique a migration.** E confira
o estado **consultando a produção**, nunca lendo um handoff: em 20/set o handoff
dizia que faltavam 5 migrations, e faltavam 13.

```bash
# o que existe de verdade na producao, por objeto
curl -s -X POST "https://api.supabase.com/v1/projects/$AUTOFLUXOS_SUPABASE_PROJECT_REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"select to_regclass('"'"'public.atividades'"'"') is not null as existe"}'
```

## 3. O que já existe, e que você NÃO deve reconstruir

A F5 e a F6 entregaram peças que a F7 e a F8 vão querer usar:

| Já existe | Onde | O que faz |
|---|---|---|
| `permissaoDeEnvio` | `channels/janela.ts` | permissão, causa e **cobrança** separadas (3 valores) |
| `avaliarElegibilidade`, `revalidarNoEnvio` | `server/servicos/elegibilidade.ts` | quem pode receber, e por que os outros não (RB-39) |
| `consultarContatos`, `contarContatos` | `server/consultas/contatos.ts` | a consulta única: filtro antes de paginar |
| `contatos_comerciais` (view) | 0082 | o contato com os números de venda dele, com nulo preservado |
| `segmentos` + `validarSegmento` | 0083, `core/segmentos.ts` | regra dinâmica, com campo e operador em lista fechada |
| `atividades` + `core/atividades.ts` | 0081 | a agenda humana, e `urgenciaDe`/`proximaAcao` |
| `registrar_venda_e_concluir`, `cancelar_venda_e_resolver` | 0080 | venda e fechamento atômicos, com trilha em `revisoes_de_venda` |
| `produtos` + `quadro_cartoes.temperatura` | 0079 | catálogo mínimo e a avaliação por oportunidade |
| `resumoDeVendas` | `server/repos/vendas.ts` | compras, total conhecido, **`semValor`** e última compra |

**`resumoDeVendas` é a peça central da T8.1** e já está pronta e testada. Leia
`core/vendas.ts` e `repos/vendas.ts` inteiros antes de escrever qualquer coisa
de indicador: o que falta na T8.1 não é calcular venda, é **parar de calcular a
partir de cartão ganho**.

## 4. F7: modelos, navegação e configuração guiada

**Regras:** RB-43 a RB-48. **Interfaces:** UI-01, UI-02, UI-19, UI-23, UI-24.

Todos os arquivos que o plano manda alterar **existem**. Conferido.

### T7.1: navegação e início por objetivo

O item 5 ("rever carregamentos da página de automações por aba") vem com uma
instrução explícita do plano que é fácil de atropelar: **medir antes de
introduzir otimizações**. Não troque consultas por suposição de lentidão.

O item 3 é o que muda o produto: **concluir o onboarding e receber conversas sem
montar funil nem chatbot fictício.** Hoje o CRM já é opcional de fato (a
atividade da T5.3 funciona só com contato, e o quadro nasce vazio), então o
trabalho é de navegação e texto, não de banco.

### T7.2: versões, simulação e publicação previsível

**O simulador já compartilha um executor só com o motor de verdade**
(`server/efeitos/resolver.ts`, com `origem: 'simulador'`), e o comentário de lá
explica por quê: dois executores matam a frase "no simulador funcionava".

**Há exatamente quatro pontos onde o modo de teste decide alguma coisa** hoje:

```
resolver.ts:286   deTeste: opcoes.origem === 'simulador'
resolver.ts:620   const deTeste = opcoes.origem === 'simulador'
resolver.ts:692   if (deTeste && ferramenta.escreve)
resolver.ts:934   { deTeste: opcoes.origem === 'simulador', ... }
```

O item 4 da T7.2 ("nenhuma venda, tarefa de envio ou chamada de integração real
pode escapar da simulação") é **uma auditoria dessa lista**, não uma
reescrita. A pergunta a responder por efeito novo da F5/F6: o simulador pode
alcançar `registrar_venda_e_concluir`, `criarAtividade` ou
`enfileirarDestinatarios`? Se puder, falta guarda.

`core/validar-publicacao.ts` não existe, e é dele que sai a RB-45.

### T7.3: sequências e o controle de atendimento

**Duas coisas medidas, e as duas mudam o desenho da tarefa.**

**1. `sequencia_inscricoes` não tem `cartao_id`.** As colunas são:

```
id, sequencia_id, contact_id, client_id, estado, motivo,
passo_atual, entrou_em, atualizado_em, por_sumico_em
```

O item 1 da T7.3 pede "distinguir inscrição do contato e contexto da
oportunidade", e hoje **não há como**: a inscrição é do contato, ponto. Isso é
migration (a `0084`), e é a decisão de desenho mais importante da fase. Cuidado
com o efeito que o plano nomeia: "eventos afetam os vínculos adequados e não
todas as negociações por acidente": uma venda numa oportunidade não pode
cancelar o acompanhamento de outra.

**2. Só a elegibilidade da T6.2 usa `permissaoDeEnvio`.** Os outros caminhos de
envio ainda chamam `dentroDaJanela`/`restaDaJanela` direto:

```
src/server/acoes.ts
src/server/acoes-midia-do-inbox.ts
src/server/acoes-reacao.ts
src/server/enviar-agendadas.ts
src/server/repos/conversas.ts
src/server/receber-mensagem.ts
src/app/clientes/[clienteId]/leads/[contatoId]/page.tsx
src/app/clientes/[clienteId]/inbox/page.tsx
```

O item 2 pede "reusar a verificação de F3 antes do envio em bot, agendamento,
sequência e transmissão". **Não é trocar tudo por reflexo:** `enviar-agendadas`
já confere a janela na entrega e já cai para modelo quando ela fechou (0067), e
as telas usam `restaDaJanela` só para **mostrar** o relógio, que é outro uso.
Vale a pena unificar onde a decisão é "pode enviar?", e deixar quieto onde a
pergunta é "quanto falta?".

### T7.4: formulários

Cuidado com o que o plano escreve em letras miúdas: **"preservar identidade
visual; não fazer redesign gratuito"**. A tarefa é foco, teclado, Escape,
rascunho não perdido e retry idempotente, e não uma revisão estética.

## 5. F8: relacionamento e visão geral

**Regras:** RB-06, RB-29, RB-32, RB-35, RB-41.

### T8.1: o defeito está medido, e é o ponto inteiro da fase

`src/server/repos/relacionamento.ts` **ainda deriva compra de cartão ganho**, em
dois lugares:

```
relacionamento.ts:83   .from('quadro_cartoes').eq('situacao', 'ganha')   <- relacionamentoDeMuitos
relacionamento.ts:161  .from('quadro_cartoes').eq('situacao', 'ganha')   <- (recompra por sumiço)
```

É exatamente o que a 0071 separou e o que a `venda-nao-e-atendimento.test.ts` já
prova estar errado: "Resolvido" no Atendimento, "Qualificado" na Captação e
"Compareceu" na Agenda **não são compra**, e a clínica que respondeu dez dúvidas
aparece com dez compras e uma receita que ninguém faturou.

**Pior, e é a linha que merece o teste primeiro:**

```ts
total.set(linha.contact_id, (total.get(linha.contact_id) ?? 0) + Number(linha.valor ?? 0))
```

O `?? 0` transforma **valor desconhecido em zero**, que é o oposto da RB-06 e da
RB-30. `resumoDeVendas` já devolve `semValor` justamente para a tela poder dizer
"há vendas sem valor informado" em vez de apresentar um total como se fosse tudo.

A troca é para `resumoDeVendas`/`contatos_comerciais`, que já existem e já
tratam cancelada e nulo corretamente. **Procure os chamadores antes:**
`relacionamentoDeMuitos` alimenta a tela de contatos, o selo do cliente e a
régua de recompra, e mudar o significado de "compras" sem olhar os três deixaria
metade do produto com a regra antiga (é a armadilha 2 do handoff da F3/F4).

O item 3 pede separar **última interação** de **última compra**: a view
`contatos_comerciais` já devolve as duas, com nulo preservado.

**Atualize `docs/RELACIONAMENTO.md`** (item 5), que hoje descreve a regra antiga.

### T8.2: a visão geral

O plano é explícito sobre dois erros a não cometer:

- **não chamar atendimento resolvido de receita.** A página de cliente hoje
  calcula `resolvidasPeloBot / conversas` (linha 506), que é taxa de resolução e
  está certo; o risco é a coluna de dinheiro ao lado vir da mesma fonte errada
  da T8.1;
- **não chamar toda transferência de falha do bot.** Separar automação
  resolvida, transferência **prevista** e transferência **por falha**.

E o mais sutil: **medir tempo até atendimento a partir do pedido humano**, não
da primeira mensagem. Contar a conversa inteira com o bot como espera do
funcionário produz um número que nenhuma equipe reconhece.

## 6. Armadilhas que já custaram tempo (leia antes, não depois)

1. **Filtro que não filtra é pior que filtro que recusa.** Na T6.1, uma condição
   de oportunidade sozinha caía num `switch` sem caso e devolvia a base inteira,
   sem erro. **Fixture acima do tamanho da página** foi o que expôs; com 5
   contatos de teste, passaria.
2. **Corrigir uma consulta e esquecer a gêmea.** Já mordeu na view da 0065 e no
   `contextoDeResposta`, e a T8.1 tem duas cópias da mesma regra errada.
3. **`returns table (id uuid, ...)` dá 42702.** Os nomes de saída levam `o_`.
   Já mordeu na 0033, 0072, 0076 e 0080.
4. **`messages` usa `ts`, e não `criado_em`**, e não tem `client_id`.
5. **`templates.nome` exige `^[a-z0-9_]+$`** (regra da Meta). Marca de teste com
   traço não passa.
6. **`vi.clearAllMocks()` zera o retorno padrão do mock**; re-arme no
   `beforeEach`.
7. **Componente de cliente não importa de módulo `server-only`.** Funciona
   enquanto só tipo e constante atravessam, e quebra na primeira linha com banco.
8. **`upsert ... onConflict` não funciona com índice parcial.**

## 7. O que está pendente e encosta nestas fases

- **`test/e2e/*.spec.ts` não existe, e Playwright não é dependência.** A F7 pede
  três (`configuracao-da-operacao`, `formularios`) e a F8 pede
  `visao-geral.spec.ts`. Se não instalar, **diga explicitamente** que ficaram de
  fora e por quê. Se instalar, é decisão com custo próprio (navegadores no CI,
  tempo de execução) e merece commit separado.
- **A seleção em lote não passou pela consulta única.** A RB-37 a nomeia junto
  de lista, contagem e exportação; as três foram unificadas na T6.1, a seleção
  não. "Selecionar todos os 340 do filtro" ainda não existe como gesto.
- **`contatosDoNivel` devolve ids com teto de 5.000**
  (`server/consultas/nivel.ts`), como ponte para a `paginarLeads` antiga. O
  caminho definitivo é a consulta de leads ler direto de `contatos_comerciais`,
  e a F8 é a fase natural para isso, já que ela mexe nos indicadores.
- **As telas da F4 não existem** (`editor-de-campos.tsx`,
  `ajustes/campos/page.tsx`, `lead-crm/qualificacao.tsx`). Se a F7 for mexer em
  navegação e configuração guiada, elas são candidatas naturais a entrar junto.
- **Não existe opt-out/bloqueio no schema.** A elegibilidade confere número,
  janela e modelo. Quando houver descadastro, entra como mais um
  `MotivoDaExclusao` e a prévia o mostra sem mudar contrato.
- **A segunda metade da janela gratuita continua pendente:** a 72h só existe se
  a empresa responder em 24h do clique, e o código não guarda se houve resposta.
  Erra para o lado conservador, mas é promessa de custo não verificada.
- **27 ações ainda não declaram capacidade.** As da F5/F6 declaram todas.

## 8. Como verificar, e o que reportar

Depois de **cada tarefa**: `npm run test:unit`, `npm run
test:integration:local`, `npm run typecheck`, `npm run lint`. `npm run build`
nos marcos de interface. Migration nova: aplique no Docker **e** rode o replay
do zero (`npx supabase db reset`), que é o que prova a ordem.

Commit e push **por tarefa**, com a mensagem dizendo o defeito medido, a decisão
e o que ficou de fora.

**Sobre produção:** a autorização de 19/set valia para as migrations da F5/F6, e
**não se estende** à F7/F8. Peça antes de aplicar. O procedimento continua o
mesmo e está no `BANCO-COMPARTILHADO.md`: Management API, uma por vez, replay em
Docker e ensaio em transação antes, releitura objeto a objeto depois, e conferir
a Verandi se houver `notify pgrst`.

**No fim das duas fases**, escreva `docs/HANDOFF-20-SET-F7-E-F8.md` no mesmo
formato deste, e relate ao dono o que ficou de fora e por quê.

## 9. Estado por fase

| Fase | Situação |
|---|---|
| F0 a F4 | **completas** (F4 sem as telas) |
| F5 · T5.1, T5.2, T5.3 | **completas** |
| F6 · T6.1, T6.2 | **completas**, sem os e2e |
| F7 · T7.1 a T7.4 | **a fazer** |
| F8 · T8.1, T8.2 | **a fazer** |
| F9 | não iniciada |
