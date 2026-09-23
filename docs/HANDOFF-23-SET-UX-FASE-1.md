# Handoff 23/09: plano de UX, Fase 0 feita, Fase 1 até a tarefa 1.4

Plano: `docs/PLANO-UX-UI-2026-09-23.md`. Os checkboxes e o "Registro de
execução" no fim dele estão em dia até a 1.4. **Próxima: tarefa 1.5** ("Nova
atividade" pela agenda); depois, Fase 2.

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

Deploy: `2f6a5e9` READY; `b38b538` estava BUILDING ao escrever isto. Conferir.

## Duas mudanças pedidas pelo Gabriel em 23/09 (decididas, não reabrir)

Entram como tarefas **1.6 e 1.7**, depois da 1.5, ainda na Fase 1.

**1.6: alternância Lista | Agenda.** A lista atual continua; ao lado dela, um
toggle na barra (`?vista=lista|agenda`, padrão `lista`, guardado na URL como os
outros filtros) troca para uma **visão de agenda de verdade**: calendário com as
atividades nos dias (semana com colunas por dia e horário; mês como grade).
Mesmos filtros, busca e escopo da lista (`paginaDaAgenda` ou uma variante por
intervalo de datas, não uma segunda regra). Clicar na atividade abre as mesmas
ações da linha. Sem prazo fica numa faixa à parte ("Sem prazo"). Celular: vista
de agenda vira lista por dia.

**1.7: atribuir vira modal com busca.** Hoje o menu `⋯` lista "Atribuir a" com
todos os membros embaixo (`src/components/atividades/acoes-da-linha.tsx`); com
300 funcionários isso vira uma lista infinita. Trocar por um item só,
**"Atribuir tarefa…"**, que abre um modal com um seletor pesquisável (campo de
busca por nome, lista filtrada com rolagem, "Ninguém" como opção). Vale o mesmo
padrão para o filtro "Responsável" do popover Filtros em
`barra-da-agenda.tsx`, que tem o mesmo problema.

## Tarefa 1.5: onde parei (nada editado ainda)

- Extrair de `src/components/inbox/marcar-atividade.tsx` os campos (tipos em
  radio, título, `onde` por `FORMATO_DO_TIPO`, dia, hora) para
  `CamposDaAtividade` compartilhado; Inbox e agenda usam o mesmo.
- `src/components/atividades/nova-atividade.tsx`: diálogo com busca de contato
  (mín. 2 caracteres). **Não existe ação de busca de contatos genérica**; a
  mais perto é `acaoBuscarContatosDoQuadro` (`src/server/acoes.ts:1626`).
  Criar uma que use `paginarLeads(..., { estado: 'todas', busca, porPagina: 8 })`.
  Negócio opcional: `oportunidadesAbertasDoContato` (`src/server/repos/quadros.ts:1326`).
- Botão "+ Nova atividade" no cabeçalho de `atividades/page.tsx` (ainda não existe).
- Acrescentar ao `agenda.spec.ts`: criar pela agenda e ver na ficha.

## Achados que não estavam no plano

- **Conta nova sem canal não mostra "+ Criar contato"** em Contatos
  (`PrimeiraVez` em `leads/page.tsx`). Entra na Fase 2.
- `prazoDoDia` com hora usa o fuso do servidor (Vercel = UTC): "14:00"
  digitado pode virar 11:00 em Brasília. Não mexi; conferir antes da Fase 8.
- Ações de concluir/cancelar/reabrir não conferem dono com escopo `proprios`
  (reagendar e atribuir já conferem, `conferirDono` em `acoes-atividades.ts`).
- Seed local tem atividades repetidas (mesmo título e contato várias vezes).

## Ambiente (armadilhas pagas)

- `scripts/ux-local/dev.sh` em segundo plano na 3100. **O e2e sobe o próprio
  `next dev` na 3100**: pare o `dev.sh` antes. Não use `pkill -f "next dev"`:
  o padrão casa com o próprio shell e mata o comando.
- `.env.teste-local` ganhou `DATABASE_URL` local (arquivo ignorado pelo git).
- Scripts meus em `.ux-local/` (ignorado): `hidratacao.mjs <rotas>` conta erro
  de hidratação; `texto.mjs <rota> <seletor>` imprime o texto da tela.
- Deploy: API da Vercel com `VERCEL_TOKEN` do `.secrets/4yu.env`, projeto
  `prj_17XxHvJ1vOAQ6j4mQSauCPA1BJXO`, time `team_hmVHyYO1YFO9fuAtpG9Ym2hm`
  (o MCP da Vercel dá 403 nesse time).
- `next-env.d.ts` e `tsconfig.json` aparecem modificados pelo `next dev`: não
  commitar.

## Banco

Nenhuma migration nesta rodada. Nada pendente para produção.
