# Handoff: F1 e F2 completas, a próxima é a T3.1

> 19/set/2026, fim da sessão. Continuação da execução do
> [plano por fases](plans/2026-09-19-operacao-chatbot-crm.md).
>
> **Onde parou:** F0, F1 e F2 inteiras, implementadas, testadas localmente e
> empurradas para `origin/main`. A próxima tarefa é a **T3.1**.
>
> Nada foi aplicado em produção. Nenhuma mensagem real enviada.
>
> O handoff anterior (`HANDOFF-19-SET-F0-E-T11.md`) continua valendo no que
> descreve a F0 — principalmente a regra do §2, sobre testes e banco.

## 1. Comece por aqui

```bash
cd /home/gabfelix/dev/4yu-apps/autofluxos
git fetch && git log --oneline -5      # deve terminar em ec47f0d

npx supabase start                     # Docker
# .env.teste-local já existe; se não, copie do .example e ajuste a SECRET_KEY

npm run test:unit                  # 1792 passam, 14 pulados
npm run test:integration:local     # 343 passam
npm run typecheck                  # limpo
npm run build                      # limpo
npm run lint                       # 8 problemas, TODOS anteriores (ver §6)
```

O banco local deve estar na **0073**:

```bash
docker exec supabase_db_autofluxos psql -U postgres -d postgres \
  -tAc "select max(version) from supabase_migrations.schema_migrations"
```

**Leitura obrigatória antes de tocar banco:** `AGENTS.md` e
`docs/BANCO-COMPARTILHADO.md` inteiro. AutoFluxos e Verandi dividem o projeto
Supabase de produção.

## 2. As duas regras que mais importam

1. **Teste não fala com banco sem estar em `test/suites.ts`.** Credencial não é
   autorização: o guarda em `test/ambiente-local.ts` exige host local **e**
   `AUTOFLUXOS_TESTE_LOCAL=sim`. Arquivo novo que use banco entra na lista, e há
   um teste que recusa quem esquecer.
2. **`service_role` ignora RLS.** As tabelas não defendem ninguém: quem defende
   é o `client_id` em cada consulta. Uma consulta que o esqueça **não é
   recusada** pelo Postgres — ela devolve a conta do vizinho.

## 3. O que foi entregue nesta sessão

### F1 · T1.2 — concluir virou transação (0072)

`fecharCartao` fazia quatro escritas em fila e admitia "não é transação": uma
queda no meio deixava o cartão ganho **sem** o evento no histórico. E a passagem
ao quadro seguinte, quando falhava, escrevia `console.error` e devolvia `null` —
o log da Vercel expira, e a pendência expirava junto.

| Peça | O que faz |
|---|---|
| `concluir_processo` (RPC) | estado final + evento + conclusão numa transação só |
| `conclusoes_de_processo` | a conclusão com ids e nomes **da época** (RB-24) |
| `resolver_continuidade` (RPC) | abre o destino, idempotente pela conclusão |
| `servicos/concluir-processo.ts` | coordena; a fila é a rede embaixo da tentativa inline |

**A passagem continua no mesmo clique.** A tentativa é inline e a fila só cobre
a falha: adiar o caso comum para o cron transformaria o "o contato entrou no
funil Pós-venda" da tela em promessa. O que mudou não é *quando* a passagem
acontece, é o que sobra quando ela **não** acontece.

Estados de `continuidade`: `nao_se_aplica` · `pendente` · `feita` · `falhou`.
Os dois últimos são a "pendência visível" do A26. `continuidadesPendentes()`
existe; **a tela dela é da F5**.

### F2 · T2.1 — capacidades e escopos (0073)

O sistema tinha **uma** fronteira: `sessao.ts` responde "alcança esta empresa?".
A segunda pergunta não existia. Medido, não suposto: `acoes-crm.ts` tinha 18
ações e **zero** conferências de papel.

- `src/core/permissoes.ts` — capacidade (o verbo), escopo (sobre quem), papel
  (o conjunto). **O padrão é negar**: capacidade nova nasce `nenhum`.
- `src/server/permissoes.ts` — `exigirCapacidade()` é a porta. Ela chama
  `exigirAcessoAoCliente` por dentro, então cobre as duas fronteiras.
- 0073 — `equipes`, `equipe_membros`, `membro_capacidades`.

**Ausência de sobrescrita = "usa a política do papel", nunca "nenhum".** É o que
faz a migration não trancar nenhuma conta existente. `member` preserva o que faz
hoje; as exceções (`configurar_empresa`, que já era negada, e `corrigir_venda`,
que mexe em número fechado) não são "acesso atual".

### F2 · T2.2 — a tela, e as rotas que ninguém confere

- `editor-de-acesso.tsx` (UI-18) com prévia que usa `escopoDe`, **a mesma
  função do servidor** — reimplementar daria duas verdades;
- "Igual ao papel" **apaga** a sobrescrita em vez de gravar o valor. Gravar
  congelaria a pessoa na política de hoje;
- as 4 rotas de `api/clientes/` passam a exigir capacidade;
- último dono protegido também no **rebaixamento** (antes só na remoção).

## 4. Armadilhas que já custaram tempo

1. **`returns table (id uuid, situacao text, ...)` dá 42702.** Os parâmetros OUT
   competem com as colunas das tabelas consultadas, e o Postgres recusa com
   `column reference "id" is ambiguous`. Os nomes de saída levam `o_`, e o
   TypeScript os remapeia em `doRpc()`. Mesma classe da 0033.
2. **`repetida` não se deduz de `criado_em`.** Duas chamadas separadas por 80 ms
   dão a mesma idade que uma chamada só. O booleano sai do banco.
3. **`if (!objeto)` é sempre falso.** `definirPapelNaConta` passou a devolver
   `{ok, motivo}` e o typecheck **não** pegou o `if (!mudou)` do chamador: a
   recusa passava batida e a auditoria registrava uma troca que não aconteceu.
   Ao trocar retorno de booleano para objeto, **procure os chamadores à mão**.
4. **Apagar o quadro de destino não testa a pendência.** `quadros.seguinte_id` é
   `on delete set null`, então apagar desfaz a cadeia e a conclusão nasce
   `nao_se_aplica` — que está certo. Para testar `falhou`, use destino **sem
   etapa**. Foi o próprio teste que mostrou a diferença.
5. **`upsert ... onConflict` não funciona com índice parcial** (da sessão
   anterior, continua valendo).

## 5. A próxima tarefa: T3.1

**Registrar entrada antes de decidir automação.** O plano detalha na seção
"T3.1". Em resumo:

1. deduplicar evento antes de métricas e efeitos; distinguir inbound novo,
   submissão, importação histórica e mensagem humana do celular;
2. registrar origem mesmo com bot pausado; manter a primeira conhecida;
3. atualizar contato por política de campos, preservando submissão;
4. substituir o fallback do "quadro mais antigo" por configuração explícita;
5. tratar CRM desligado sem acesso residual à criação de cartão.

**Ponto de atenção que a F0 deixou medido e a F3 tem que corrigir:** a view da
0065 deriva `porta_de_entrada_em` de *qualquer* linha de `passagens`, e
`passagens` não tem coluna de tipo. Então **lead de formulário abre 72h de texto
livre** para quem nunca escreveu, contra a RB-09. O teste que prova está em
`src/server/repos/porta-de-entrada.test.ts`. Exige coluna nova e mexer na mesma
view — por isso ficou para a T3.1/T3.3.

**A próxima migration é a `0074`.** Confira com `ls supabase/migrations/ | tail -1`
e **não copie numeração de plano nenhum**.

## 6. O que NÃO foi feito, de propósito

- **Nenhuma migration em produção.** 0072 e 0073 existem no disco e no Docker
  local. Aplicar exige autorização explícita do dono.
- **3 lint errors continuam.** São anteriores e estão em arquivos não tocados:
  `inbox/page.tsx`, `clientes/[clienteId]/page.tsx`, `components/inbox/fila.tsx`
  (dois de `react-hooks/purity`, um de `setState` em efeito). Confirme com
  `git diff --stat HEAD~4 -- <arquivo>`, que vem vazio.
- **3 ações ainda sem capacidade declarada:** `acaoCadastrarPessoaNaConta`,
  `acaoDefinirPapelNaConta`, `acaoRemoverDaConta`. Todas já conferem
  `podeAdministrarConta`, que é a mesma pergunta com outro nome. O teto em
  `acoes.test.ts` é **3 e só desce** — se subir, alguém escreveu ação nova com a
  fronteira antiga.
- **`test/e2e/permissoes.spec.ts` não foi criado.** O plano o pede na T2.2, mas
  Playwright ainda não é dependência do projeto e instalá-lo é decisão própria
  (o plano manda incluí-lo "ao adicionar testes de navegador"). As travas de
  varredura (`acoes.test.ts`, `rotas-conferem-acesso.test.ts`) cobrem o que o
  e2e cobriria de regressão; o que falta é a jornada de navegador.
- **Papel de compatibilidade não foi "revisado com prévia".** A T2.2 pede
  revisão assistida das permissões legadas. O modelo existe (`MODELOS_EXTRA`) e
  a tela aplica, mas não há a tela de *revisão em lote* — ela depende de alguém
  decidir a política da conta, e a proposta manda não retirar acesso em massa
  sem prévia. Fica explícito como pendência.

## 7. Estado por fase

| Fase | Situação |
|---|---|
| F0 | **completa** |
| F1 | **completa** (T1.1 e T1.2) |
| F2 | **completa** (T2.1 e T2.2), com as duas pendências do §6 |
| F3 · T3.1 | **próxima** |
| F4 a F9 | não iniciadas |

Commits desta sessão: `dfb6543`, `0eb6fbc`, `e0d332d`, `ec47f0d` — todos em
`origin/main`.
