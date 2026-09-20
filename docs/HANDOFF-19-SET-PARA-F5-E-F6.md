# Handoff: executar a F5 e a F6 inteiras

> Escrito em 19/set/2026, ao fim da sessão que entregou a F3 e a F4.
> **Para quem vai executar as fases F5 e F6** do
> [plano por fases](plans/2026-09-19-operacao-chatbot-crm.md).
>
> **Estado:** F0 a F4 completas e em `origin/main` (último commit `de3515a`).
> Banco local na **0078**. A próxima migration é a **0079** — confira com
> `ls supabase/migrations/ | tail -1` e **não copie numeração de plano nenhum**,
> inclusive deste arquivo.
>
> Nada foi aplicado em produção. Nenhuma mensagem real enviada.

## 1. Antes de escrever qualquer código

```bash
cd /home/gabfelix/dev/4yu-apps/autofluxos
git fetch && git log --oneline -7      # deve terminar em de3515a

npx supabase start                     # Docker

npm run test:unit                  # 1967 passam, 14 pulados
npm run test:integration:local     # 384 passam
npm run typecheck                  # limpo
npm run build                      # limpo
npm run lint                       # 8 problemas, 3 errors ANTERIORES
```

**Se não bater, investigue antes de escrever código.** Os 3 lint errors são
anteriores e estão em arquivos não tocados (`inbox/page.tsx`,
`clientes/[clienteId]/page.tsx`, `components/inbox/fila.tsx`).

O banco local deve estar na 0078:

```bash
docker exec supabase_db_autofluxos psql -U postgres -d postgres \
  -tAc "select max(version) from supabase_migrations.schema_migrations"
```

### Leitura obrigatória, nesta ordem

1. `docs/HANDOFF-19-SET-F3-E-F4.md` — o estado atual e as armadilhas da sessão
   anterior. O §4 de lá economiza horas.
2. `AGENTS.md` e **todo** o `docs/BANCO-COMPARTILHADO.md` — banco de produção
   compartilhado com a Verandi. Obrigatório antes de tocar em migration, RLS,
   Storage, extensão, função ou view.
3. As seções **F5** e **F6** do plano, e as regras **RB-23 a RB-39** da proposta.

## 2. As regras da casa (não negociáveis)

- **Nunca `git stash` nem `git reset`.** Há sessões paralelas no repo. `git fetch`
  antes de começar.
- **Nada de travessão** em tela, comentário, commit ou doc. Use dois pontos.
- **Teste que fala com banco entra em `test/suites.ts`**, senão o guarda recusa.
- **`service_role` ignora RLS.** Quem isola é o `client_id` em **cada** consulta,
  não o Postgres. Uma consulta que o esqueça não é recusada: ela devolve a conta
  do vizinho.
- **Nada aplicado em produção sem autorização explícita do dono.** Migration nova
  roda só no Docker local, e nenhuma mensagem real pode sair.
- **Ao trocar retorno de função de booleano para objeto, procure os chamadores à
  mão:** `if (!objeto)` é sempre falso e o typecheck não avisa.
- **Ação e rota novas precisam declarar capacidade** (`exigirCapacidade`), senão
  as travas de varredura em `acoes.test.ts` e `rotas-conferem-acesso.test.ts`
  quebram. Elas existem exatamente para isso.

### O protocolo de execução (§"Protocolo de execução" do plano)

Uma tarefa por vez. Antes de alterar, **localizar todos os chamadores** das
funções afetadas. Para regra de negócio: **escrever o cenário que falha**,
implementar a menor mudança consistente, rodar a verificação. Commit e push por
tarefa. Não pare para pedir confirmação entre elas.

## 3. O que já existe, e que você NÃO deve reconstruir

Isto é o que mais economiza tempo: boa parte da persistência da F5 foi entregue
na F1, e o plano foi escrito antes disso.

| Já existe | Onde | O que faz |
|---|---|---|
| `vendas` e `venda_itens` | 0071 | tabelas, com `vendas_uma_valida_por_cartao_idx` e `vendas_chave_da_operacao_idx` |
| `registrarVenda`, `cancelarVenda`, `porChaveDaOperacao`, `vendaDoCartao`, `resumoDeVendas` | `server/repos/vendas.ts` | o protocolo transacional, com `repetida: true` para o duplo clique |
| `concluir_processo` (RPC) + `resolver_continuidade` | 0072 | conclusão atômica e a continuidade entre processos (RB-25) |
| `conclusoes_de_processo` | 0072 | a conclusão com ids **e nomes da época** (RB-24) |
| `motivos_de_perda` | 0058 | os motivos da empresa (RB-27) |
| `acaoFecharCartao`, `acaoReabrirCartao`, `acaoCriarMotivo`, `acaoDefinirTemperatura` | `server/acoes-crm.ts` | 18 ações de CRM, todas com acesso conferido |
| `campos_definidos` + `gravar_campos` | 0077 | campos tipados com proveniência, e a escrita campo a campo |
| `criterios_de_qualificacao` + `avaliacoes_de_qualificacao` | 0078 | qualificação versionada por objetivo |

**`registrarVenda` já cumpre boa parte da RB-30.** Leia `repos/vendas.ts` inteiro
antes de escrever qualquer coisa da T5.2: o que falta lá é **UI e ação**, não
persistência.

**O que de fato não existe** (todos os caminhos são `src/`):
`repos/produtos.ts`, `core/atividades.ts`, `repos/atividades.ts`,
`core/segmentos.ts`, `repos/segmentos.ts`, `consultas/contatos.ts`, e todos os
componentes novos que o plano lista.

## 4. F5 — Operação comercial e atividades

**Regras:** RB-23 a RB-34. **Interfaces:** UI-09 a UI-13, UI-17, UI-21, UI-25.

### T5.1 — Oportunidade e catálogo mínimo

O catálogo é **mínimo de propósito**: produto/serviço, nome, ativo/arquivado.
Sem estoque, sem impostos, sem ERP. **Itens de venda preservam nome e valor da
época** — renomear produto não pode mudar o histórico, que é a mesma decisão da
`conclusoes_de_processo` da 0072 e do `titulo` congelado em `passagens`.

Três armadilhas específicas:

1. **A temperatura hoje é do contato, não da oportunidade** (`contacts.temperatura`,
   da 0068, com default `'morno'`). O plano manda migrá-la para informação
   **legada** e **não** copiar o `morno` automático para todas as negociações
   como se fosse avaliação humana. Copiar transformaria um default em opinião de
   alguém, que é exatamente o que a 0068 documentou evitar.
2. **Preservar a rota `/quadros` e os links.** As visões Oportunidades e
   Processos entram dentro dela.
3. **Oportunidade de outra equipe não aparece como sugestão de duplicata** (RB-26
   combinado com os escopos da F2). O `escopoDe`/`filtroDe` de
   `core/permissoes.ts` é quem responde isso.

### T5.2 — Registrar, perder e corrigir venda

A persistência existe (ver §3). O que falta é UI, ação e as regras de fechamento.

- **RB-29 é a que mais se erra:** venda registrada significa que a empresa
  confirmou a compra, **não** que foi paga. Pagamento fica *Não acompanhado* por
  padrão. Não escreva nada que sugira "pago".
- **RB-30:** não trocar desconhecido por zero. `valorTotal` é `number | null`, e
  o `null` é informação, não ausência de informação.
- **RB-31:** cancelar venda e mudar a situação da oportunidade acontecem
  **juntos**. Não deixar oportunidade ganha sem venda válida. "Ganhar novamente"
  reutiliza a identidade da venda com revisão auditável — não cria uma segunda
  compra válida para a mesma oportunidade, e o índice
  `vendas_uma_valida_por_cartao_idx` já recusa isso no banco.
- **RB-23:** arrastar para conclusão abre a ação; **cancelar o modal restaura a
  posição**. Não mostrar sucesso visual persistente antes da confirmação do
  servidor.
- **RB-32:** ganhos antigos entram como **resultados legados** até alguém
  classificar. Não converter "Resolvido"/"Qualificado"/"Compareceu" em compra
  automaticamente. Contexto medido: a produção tem **0 ganhos e 0 cartões com
  valor**, então na prática não há legado a converter — mas a regra precisa
  existir antes de alguém importar uma base.

### T5.3 — Agenda humana e ficha integrada

- **RB-33 é a regra central: lembrete não é envio.** Criar atividade **não**
  agenda WhatsApp. Já existe `mensagens_agendadas` (0057) e a fila técnica: o
  risco real aqui é reaproveitar uma pela outra e uma atividade humana virar
  mensagem enviada ao cliente. O plano é explícito: a fila técnica **não**
  armazena atividades humanas como se fossem tarefas do motor.
- **Diferenciar três coisas** que a tela hoje confunde: lembrete humano,
  adiamento da conversa (`contacts.adiada_ate`) e mensagem agendada.
- **Atividade ligada só ao contato funciona sem ativar o CRM.**

## 5. F6 — Segmentos e destinatários

**Regras:** RB-35 a RB-39. **Interfaces:** UI-14, UI-15.

### T6.1 — Uma consulta para todas as superfícies

**O defeito já está medido, e é o ponto inteiro da fase.** Hoje a tela de leads
filtra **em memória, sobre a página que já carregou**:

```
src/app/clientes/[clienteId]/leads/page.tsx:211
  const visiveis = nivel
    ? leads.filter((lead) => relacionamentos.get(lead.contatoId)?.nivel === nivel)
    : leads
```

O comentário logo acima é honesto sobre isso ("ele afina a página que está na
frente da pessoa"), mas a RB-37 exige o contrário: **lista, contagem, paginação,
exportação e seleção em lote usam a mesma definição no servidor**, e os filtros
são calculados **antes** de paginar. Ordenar por valor gasto, por exemplo, exige
view no Postgres, não `filter()` em memória.

E a exportação é hoje **outro caminho**:
`src/app/api/clientes/[clienteId]/leads/csv/route.ts`, com a própria
`exigirCapacidade('exportar', 'todos')`. Duas superfícies, duas definições: é
exatamente o que a T6.1 unifica em `src/server/consultas/contatos.ts`.

Três coisas que o plano exige e que são fáceis de perder:

1. **Nunca aceitar SQL ou identificador arbitrário vindo do cliente.** Compile
   somente operadores e campos permitidos, e valide o acesso aos campos.
   `BANCO-COMPARTILHADO.md` repete isso: `service_role` ignora RLS.
2. **RB-36, a mais sutil:** "oportunidade fria E aberta no processo X" tem que
   ser satisfeito pela **mesma** oportunidade. Não juntar a temperatura de uma
   negociação com o estado de outra. O mesmo vale para "comprou produto X nos
   últimos 90 dias": mesma venda/item.
3. **Contato aparece uma vez**, mesmo com várias oportunidades correspondentes, e
   `null` recebe semântica explícita. RB-35: "sem comprar há X dias" exige compra
   com **data conhecida**; importado sem histórico fica em grupo próprio, e não
   fundido num "inativo" universal.

### T6.2 — Editor e transmissão a partir do segmento

- **RB-39:** estar no segmento **não** autoriza mensagem. A prévia separa total
  correspondente, elegível e excluído **por motivo**, e o worker **revalida** no
  instante do envio. Isso conversa direto com o que a T3.3 acabou de entregar:
  use `permissaoDeEnvio` de `channels/janela.ts`, que já devolve permissão, causa
  e cobrança separadas.
- **RB-38:** três objetos diferentes, e confundi-los é o erro clássico. Visão
  salva (pessoal) ≠ segmento (regra dinâmica compartilhada) ≠ lista materializada
  do envio (congelada, para rastreabilidade). **Editar o segmento depois de
  confirmar não aumenta o lote.**
- **Não implemente uma segunda fila de envio.** `passada-de-transmissoes.ts` e
  `repos/transmissoes.ts` já existem e atendem boa parte do contrato.

## 6. Armadilhas que já custaram tempo (leia antes, não depois)

1. **Teste de concorrência que passa com o defeito no lugar.** Aconteceu nesta
   sessão: um teste chamava a função duas vezes em `Promise.all` e passava **mesmo
   com a trava removida do banco**, porque a função lia e mesclava em TypeScript
   antes de chamar o RPC. **Teste de corrida só vale depois de você vê-lo
   falhar.** Sabote a implementação de propósito e confirme os dois sentidos.
2. **Corrigir uma consulta e esquecer a gêmea.** A view da 0065 e
   `contextoDeResposta` tinham a **mesma** regra duplicada; corrigir só uma
   deixaria metade do produto errado. Antes de declarar um filtro corrigido,
   procure as consultas irmãs. Na F6 isto é quase garantido: lista, contagem e
   CSV são três lugares hoje.
3. **`returns table (id uuid, ...)` dá 42702.** Os parâmetros OUT competem com as
   colunas das tabelas consultadas. Os nomes de saída levam `o_`, e o TypeScript
   remapeia. Já mordeu na 0033, na 0072 e na 0076.
4. **Rollback de migration esbarra em dependência.** `drop column` falha se uma
   view depende dela. O replay do zero (`npx supabase db reset`) é o caminho
   confiável, e é ele que prova a ordem.
5. **`upsert ... onConflict` não funciona com índice parcial.**
6. **Apagar o quadro de destino não testa a pendência.** `quadros.seguinte_id` é
   `on delete set null`. Para testar `falhou`, use destino **sem etapa**.

## 7. O que ficou pendente da F3/F4 e encosta nestas fases

Nada disto bloqueia a F5/F6, mas você vai esbarrar:

- **As telas da F4 não existem.** As ações de servidor existem e estão testadas
  (`acoes-campos.ts`, `acoes-qualificacao.ts`, com capacidade declarada), mas
  `editor-de-campos.tsx`, `ajustes/campos/page.tsx` e `lead-crm/qualificacao.tsx`
  não foram construídas. A F6 vai querer os campos definidos para segmentar por
  eles: **se precisar deles, construa a tela da T4.1 junto e diga isso no
  commit**, em vez de inventar um caminho paralelo.
- **27 ações ainda não declaram capacidade**, agora visíveis em `acoes.test.ts`
  com teto que só desce. Todas conferem acesso ao cliente. Ação nova sua **tem**
  que declarar, senão o teto sobe e a trava acusa.
- **A varredura de "ações sem clienteId" só cobre `acoes.ts`.** Os outros
  arquivos têm ações que recebem id de contato/mensagem e resolvem a conta a
  partir dele; exigir `exigirOperadorDa4YU` nelas trancaria o produto.
- **`test/e2e/*.spec.ts` não existe, e Playwright não é dependência.** A T5.3 e a
  T6.2 pedem `operacao-comercial.spec.ts` e `segmentacao.spec.ts`. Instalar
  Playwright é decisão própria — o plano manda incluí-lo "ao adicionar testes de
  navegador". Se não instalar, **diga explicitamente** que os e2e ficaram de fora
  e por quê.
- **A segunda metade da janela gratuita continua pendente** (a 72h só existe se a
  empresa responder em 24h do clique, e o código não guarda se houve resposta).
  Encosta na T6.2, na hora de dizer se um envio sai de graça.

## 8. Como verificar, e o que reportar

Depois de **cada tarefa**: `npm run test:unit`, `npm run test:integration:local`,
`npm run typecheck`, `npm run lint`. `npm run build` nos marcos de interface.
Migration nova: aplique no Docker **e** rode o replay do zero
(`npx supabase db reset`), que é o que prova a ordem.

Commit e push **por tarefa**, com a mensagem dizendo o defeito medido, a decisão
e o que ficou de fora.

**No fim das duas fases**, escreva `docs/HANDOFF-19-SET-F5-E-F6.md` no mesmo
formato deste e do anterior, e relate ao dono o que ficou de fora e por quê.

## 9. Estado por fase

| Fase | Situação |
|---|---|
| F0 a F4 | **completas** (F4 sem as telas) |
| F5 · T5.1, T5.2, T5.3 | **a fazer** |
| F6 · T6.1, T6.2 | **a fazer** |
| F7 a F9 | não iniciadas |
