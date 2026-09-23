# Handoff 23/09: plano de UX, Fases 0, 1 e 2 feitas

Plano: `docs/PLANO-UX-UI-2026-09-23.md`. Os checkboxes e o "Registro de
execução" no fim dele estão em dia até a 2.4. **Próxima: Fase 3, tarefa 3.1.**

## Feito (tudo na `main`, com push)

| Tarefa | Commit | O quê |
|---|---|---|
| 0.1 | `ff6a51a` | célula vazia volta a `·` (Contatos, Respostas) |
| 0.2 | `b208a48`, `0c93f74` | notificações sem erro de hidratação (`useSyncExternalStore`) |
| 0.3 | `ab4b05f` | "Falta 1 passo"; "quadro" vira "funil"; **Contatos e CSV passam `estado: 'todas'`** (antes escondiam quem teve a conversa resolvida: 30 de 60) |
| 1.1 | `4bb7f23` | `paginaDaAgenda` + `lerFiltroDaAgenda`/`paraParametros`/`padraoSemAcento` (busca sem acento por regex `imatch`, sem `unaccent`) |
| 1.2 | `5d0bbe1` | `reagendarAtividade`/`atribuirAtividade` + ações; `prazoDoDia` foi para `src/core/atividades.ts` |
| 1.3 | `03efe07`, `2f6a5e9` | página nova de Atividades; contador do menu com `contagensDaAgenda` (clique vai a `?recorte=vencidas`); `agenda()` removida |
| 1.4 | `b38b538` | `ListaDaAgenda` + `AcoesDaLinha` (Concluir com Desfazer 6 s, Reagendar em popover, menu `⋯`, Cancelar com motivo); e2e `test/e2e/agenda.spec.ts` verde |
| 1.5 | `a6612df` | `NovaAtividade` (busca de contato, `CamposDaAtividade` compartilhado com o Inbox, responsável, negócio); criação confere responsável (`ehMembroDaConta`) e negócio no servidor |
| 1.6 | `d1221ee` | `?vista=agenda&escala=semana\|mes&dia=`; `agendaDoIntervalo` + `intervaloDaVista`; `VistaDaAgenda`; ações extraídas em `useAcoesDaAgenda` |
| 1.7 | `72874fd` | `SeletorDePessoa` (modal com busca) no "Atribuir tarefa…", no filtro Responsável e em Nova atividade |

| 2.1 | `2804dd1` | Contato e checkbox fixos (`FIXA_SELECAO`/`FIXA_CONTATO`); contêiner `relative` (página do celular rolava 913px de lado) |
| 2.2 | `c03c9ff` | `CLASSE_DA_COR` com versão clara; `dark:` segue `data-tema` (`@custom-variant` em `globals.css`); máx. 2 etiquetas + "+N" |
| 2.3 | `70f7996` | `BarraDeContatos` fora do `Suspense`; `lerPagina` com `cache`; `paginarLeads` sem acento; "+ Novo contato" no cabeçalho; e2e `contatos.spec.ts` |
| 2.4 | `a7f48a0` | "desta página"; `marcarContatos` devolve `mudaram`; resumo aplicados / já tinham / fora da conta |

Deploy: `a7f48a0` READY. e2e `agenda.spec.ts` com 4 testes verdes.

## Achados que não estavam no plano

- `prazoDoDia` com hora usa o fuso do servidor (Vercel = UTC): "14:00"
  digitado pode virar 11:00 em Brasília. Não mexi; conferir antes da Fase 8.
- Ações de concluir/cancelar/reabrir não conferem dono com escopo `proprios`
  (reagendar e atribuir já conferem, `conferirDono` em `acoes-atividades.ts`).
- Seed local tem atividades repetidas (mesmo título e contato várias vezes).
- `src/server/consultas/contatos.ts:172` (segmentos) ainda busca com `ilike`
  (depende de acento). Fora do plano; não mexi.
- `colunas-da-tabela.tsx:56` tem erro de lint antigo (`setState` em efeito).

## Ambiente (armadilhas pagas)

- `scripts/ux-local/dev.sh` em segundo plano na 3100. **O e2e sobe o próprio
  `next dev` na 3100**: pare o `dev.sh` antes. Não use `pkill -f "next dev"`:
  o padrão casa com o próprio shell e mata o comando.
- `.env.teste-local` ganhou `DATABASE_URL` local (arquivo ignorado pelo git).
- Scripts meus em `.ux-local/` (ignorado): `hidratacao.mjs <rotas>` conta erro
  de hidratação; `texto.mjs <rota> <seletor>` imprime o texto da tela;
  `dialogo.mjs` e `menu.mjs` tiram print do diálogo de Nova atividade e do
  menu/seletor de atribuir. `prints.mjs` ganhou `agenda-semana`, `agenda-mes`
  e `contatos-filtros`. Novos em `.ux-local/`: `rolagem.mjs` (tabela rolada à
  direita, zoom 200%, celular), `popover.mjs <saida> [rótulo do botão]`,
  `selecao.mjs`, `escuro.mjs <rota> <arquivo>`, `largo.mjs` (quem estoura a
  largura no celular) e **`deploy.sh [sha]`** (espera o deploy e diz o estado).
- Parar o dev: `ps -eo pid,cmd | grep -E "[n]ext dev|[n]ext-server"` e `kill`
  nos PIDs. `pkill -f` mata o próprio shell.
- Banco local: as etiquetas da conta de revisão foram recoloridas (cinza,
  verde, âmbar, rosa, roxo) e "Beatriz Ribeiro Neto" tem as 5 (para ver "+N").
- Print "antes" de tarefa já editada: `git stash push <arquivos>`, print com o
  dev rodando, `git stash pop`.
- Deploy: API da Vercel com `VERCEL_TOKEN` do `.secrets/4yu.env`, projeto
  `prj_17XxHvJ1vOAQ6j4mQSauCPA1BJXO`, time `team_hmVHyYO1YFO9fuAtpG9Ym2hm`
  (o MCP da Vercel dá 403 nesse time).
- `next-env.d.ts` e `tsconfig.json` aparecem modificados pelo `next dev`: não
  commitar.

## Banco

Nenhuma migration nas Fases 0 a 2. Nada pendente para produção.
