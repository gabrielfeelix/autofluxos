# Handoff 23/09: plano de UX, Fases 0 a 3 feitas

Plano: `docs/PLANO-UX-UI-2026-09-23.md`. Os checkboxes e o "Registro de
execução" no fim dele estão em dia até a 3.6. **Próxima: Fase 4, tarefa 4.1**
(sequência editável; regra de horário na tabela de decisões do plano).

## Fase 3 (esta sessão, tudo na `main`, deploy READY)

| Tarefa | Commit | O quê |
|---|---|---|
| 3.1 | `ccd07ab` | `podeLigar` (`src/core/entrada.ts`) + `recusaParaLigar`/`destinoPodeReceber` (`src/server/repos/entrada.ts`); entrada criada para rascunho nasce desligada |
| 3.2 | `4cd0f17` | Testar avisa IA real; escrita da IA já era simulada (`resolver.ts`, `deTeste && escreve`); avisos em `text-info` |
| 3.3 | `f54b28e` | `rotulosDoEstado`: "Publicada vN" / "Entrada ligada" na lista e no editor; aviso ao desligar |
| 3.4 | `f5f9e57` | `BarraDeLista` genérica, filtro `src/core/lista-de-fluxos.ts`, `MenuDoFluxo` (⋯), `AvisoFlutuante`, Renomear pasta |
| 3.5 | `c7115d7` | "Salvo às HH:MM", Tentar de novo, "Publicar vN" com confirmação |
| 3.6 | ver `git log` | `BarraDoSelecionado` no topo do quadro |

## Pendências e achados

- Contatos **não** usa `BarraDeLista` (outro agente mexia em Contatos). Migrar
  quando ele terminar.
- Editor no celular rola de lado (cabeçalho largo); diálogo sai deslocado.
  Encaixa na 5.8.
- Automação nova nasce `ativo = true` sem versão: aparece "Ligada, mas sem
  versão publicada" até publicar. Entrada criada para rascunho continua
  desligada depois de publicar o destino (alguém liga).
- Da sessão anterior, ainda abertos: `prazoDoDia` usa fuso do servidor;
  concluir/cancelar/reabrir não conferem dono com escopo `proprios`;
  `consultas/contatos.ts:172` busca com `ilike`; lint antigo em
  `colunas-da-tabela.tsx`.

## Ambiente (armadilhas pagas)

- **Outro agente trabalha no mesmo diretório**, com arquivos não commitados
  dele. Commite sempre por caminho (`git add <arquivos>`), nunca `-A`.
- Ele roda e2e na 3100 e derruba o `dev.sh`. Se o print der
  `ERR_CONNECTION_REFUSED`, espere o `playwright test` dele acabar e suba o
  `dev.sh` de novo.
- Scripts em `.ux-local/` (ignorado): além dos antigos, `testar.mjs` (aba
  Testar), `desligar.mjs`, `fluxos-filtro.mjs <saida> "<query>"` (lista
  filtrada e menu ⋯), `publicar.mjs` (diálogo de Publicar), `bloco.mjs` (barra
  do bloco selecionado), `deploy.sh [sha]`.
- Resto igual ao handoff anterior: parar dev pelo PID, `next-env.d.ts` e
  `tsconfig.json` não entram em commit, deploy pela API da Vercel.

## Banco

Nenhuma migration nas Fases 0 a 3. Nada pendente para produção.
