# Handoff: F0 completa e T1.1 entregue

> 19/set/2026, fim da sessão. Continuação da execução do
> [plano por fases](plans/2026-09-19-operacao-chatbot-crm.md).
>
> **Onde parou:** F0 inteira e a T1.1 da F1 implementadas, testadas localmente e
> empurradas para `origin/main`. A próxima tarefa é a **T1.2**.
>
> Nada foi aplicado em produção. Nenhuma mensagem real enviada.

## 1. Comece por aqui

```bash
cd /home/gabfelix/dev/4yu-apps/autofluxos
git fetch && git log --oneline -4      # deve terminar em 9b15673

# o banco local (Docker). Sem ele, 311 testes se pulam.
npx supabase start
cp .env.teste-local.example .env.teste-local   # e ajuste a SECRET_KEY impressa

npm run test:unit                  # 1755 passam, 14 pulados
npm run test:integration:local     # 311 passam
npm run typecheck                  # limpo
```

Se `npm run test:integration:local` reclamar de host remoto, é o guarda
funcionando: ele recusa qualquer coisa que não seja `localhost`/`127.0.0.1`.

**Leitura obrigatória antes de tocar banco:** `AGENTS.md` e
`docs/BANCO-COMPARTILHADO.md` inteiro. AutoFluxos e Verandi dividem o projeto
Supabase de produção.

## 2. A regra que mais importa nesta sessão

**`npm test` estava escrevendo no banco de produção.** O `vitest.config.ts`
carregava o `.env` inteiro para dentro dos testes, e 25 arquivos de integração
se ligavam sozinhos ao ver `SUPABASE_URL` + `SUPABASE_SECRET_KEY`.

Agora credencial **não é** autorização: um teste só fala com banco se o host for
comprovadamente local **e** existir `AUTOFLUXOS_TESTE_LOCAL=sim`. O guarda está
em `test/ambiente-local.ts` e recusa no `setupFiles`, antes de abrir conexão.

Não desfaça isso. Se um teste novo precisar de banco, ponha o caminho dele em
`test/suites.ts` — há um teste que recusa quem usar credencial sem estar na lista.

## 3. O que foi entregue

### F0 · T0.1 — ambiente de teste

| Antes | Agora |
|---|---|
| `npm test` alcançava produção | roda sem `.env` e sem rede |
| 295 testes pulavam sem ninguém ver | 311 rodam no Docker local |
| banco local parado na `0061` | na `0071` |

Arquivos: `test/ambiente-local.ts`, `test/rede-bloqueada.ts`, `test/suites.ts`,
`vitest.unit.config.ts`, `vitest.integration.config.ts`.

### F0 · T0.2 — inventário e a pendência do canal

**A dúvida das 72h está resolvida, com fonte primária.** A documentação da Meta
(consultada em 19/set) diz que a janela de atendimento é **independente** da
janela gratuita: as 72h valem para **cobrança**, não para texto livre. Quem
autoriza texto livre continua sendo a janela de 24h contada da última mensagem
da pessoa. A leitura da Salesforce estava certa.

Consequência registrada, **ainda não corrigida** (é da T3.3): `restaDaJanela`
em `src/channels/janela.ts` devolve o **maior** dos dois prazos, então quem
clicou no anúncio e nunca escreveu aparece com janela aberta por três dias.

**Achado novo, provado contra o banco:** a view da `0065` deriva
`porta_de_entrada_em` de *qualquer* linha de `passagens`, e `passagens` não tem
coluna de tipo. Então **lead de formulário abre 72h de texto livre** para quem
nunca escreveu, contra a RB-09. Teste: `src/server/repos/porta-de-entrada.test.ts`.
Correção é da F3 (T3.1/T3.3), porque exige coluna nova e mexer na mesma view.

### F1 · T1.1 — sucesso deixou de ser venda

Migration **0071**, toda aditiva, aplicada **só no Docker local**:

| Mudança | Por quê |
|---|---|
| `quadros.finalidade` | comercial vs operacional (RB-03) |
| `quadro_cartoes_aberto_unico_idx` | unicidade só entre abertos: recompra existe (A12) |
| `quadro_cartoes.chave_de_criacao` | idempotência da ocorrência (RB-10) |
| `vendas` + `venda_itens` | a compra com registro próprio (RB-05, RB-29) |

Regras puras novas: `src/core/oportunidades.ts` (o que conta como compra) e
`src/core/vendas.ts` (quanto, e por que desconhecido não é zero).
Persistência: `src/server/repos/vendas.ts`.

| Aceite | Antes | Depois |
|---|---|---|
| A11 atendimento resolvido | 1 compra fictícia | **0 compras** |
| A12 recompra no mesmo funil | recusada | **2 ocorrências, 2 vendas** |
| A13 duplo clique / corrida | — | mesma venda |
| A14 compra sem valor | — | conta 1, `semValor: 1`, total não vira zero |
| A15 cancelar venda | — | sai dos indicadores, registro preservado |

## 4. Armadilhas que já custaram tempo

1. **`upsert ... onConflict` não funciona com índice parcial.** O PostgREST
   responde "there is no unique or exclusion constraint matching the ON CONFLICT
   specification". Os três chamadores de `repos/quadros.ts` viraram
   leitura + insert explícito (`jaAbertosNoQuadro`), com `23505` tratado como
   sucesso para cobrir a corrida. Se criar outro índice parcial, lembre disso.
2. **`vi.stubGlobal('fetch')` roda antes dos hooks.** O bloqueio de rede troca o
   `fetch` na carga do setup, e não num `beforeAll`, senão sobrescreve o mock que
   o próprio teste instalou (quebrou `whatsapp/conexao.test.ts`).
3. **Assinaturas dos repos não são as que se imagina.** `criarQuadro` devolve
   `{ok, id}` e recebe `modeloId`; `porNoQuadro` recebe um **array**;
   `criarCliente` devolve objeto, não string. Confira antes de escrever teste.
4. **O banco local pode estar atrás do disco.** Estava na `0061` com o diretório
   em `0070`. Confira com
   `docker exec supabase_db_autofluxos psql -U postgres -d postgres -tAc "select max(version) from supabase_migrations.schema_migrations"`.

## 5. A próxima tarefa: T1.2

**Transações, histórico e continuidade.** O plano detalha em
`docs/plans/2026-09-19-operacao-chatbot-crm.md`, seção "T1.2".

O que ela pede, em resumo:

1. estado final e evento de conclusão na **mesma unidade transacional**;
2. IDs de processo/etapa/ocorrência e o **rótulo da época** no histórico (RB-24);
3. intenção de criar o destino com chave por conclusão, executada pela fila
   existente, registrando pendência/falha **sem perder a conclusão de origem**
   (RB-25, A26);
4. testes de falha entre gravações e retry após resposta perdida;
5. atualizar `docs/MODELO-CRM.md` com a fronteira entre a regra antiga e a nova.

Arquivos indicados: `src/server/repos/quadros.ts`, `repos/eventos.ts`,
`repos/tarefas.ts`, e criar `src/server/servicos/concluir-processo.ts`.

**Ponto de atenção:** a passagem ao quadro seguinte hoje vive em
`repos/quadros.ts` (a função que chama `jaAbertosNoQuadro` no fim) e, quando
falha, só escreve `console.error` e devolve `null`. É exatamente a "pendência
visível" que o A26 exige e que ainda não existe.

## 6. O que NÃO foi feito, de propósito

- **Nenhuma migration em produção.** A `0071` existe no disco e no Docker local.
  Aplicar exige autorização explícita sua.
- **Nada de tela.** A T1.1 é modelo de dados e regra; a proposta manda não expor
  tela comercial antes da F2/F5.
- **Janela de envio não foi ampliada.** A regra das 72h ficou documentada e
  testada como está, com a correção marcada para a T3.3.
- **Legado não foi convertido.** Ganho antigo em quadro comercial continua
  contando como compra por compatibilidade; a classificação assistida é da F5
  (RB-32). Nenhum "Resolvido" virou venda.

## 7. Estado por fase

| Fase | Situação |
|---|---|
| F0 | **completa**, testada localmente |
| F1 · T1.1 | **completa**, testada localmente |
| F1 · T1.2 | próxima |
| F2 a F9 | não iniciadas |

Commits desta sessão: `de8c8ea`, `9c98cf1`, `6232fa0`, `9b15673` — todos em
`origin/main`.
