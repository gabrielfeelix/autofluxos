# Handoff 23/09: plano de UX, Fases 0 a 4 feitas, Fase 5 até a 5.2

Plano: `docs/PLANO-UX-UI-2026-09-23.md`. Os checkboxes e o "Registro de
execução" no fim dele estão em dia. **Próxima: tarefa 5.3** (checklist depois
de importar ou duplicar). A Fase 5 agora vai até a **5.9** (anotações da
equipe como histórico no Inbox, pedida pelo Gabriel; está escrita no plano).

## Esta sessão (tudo na `main`, deploy READY)

| O quê | Commit |
|---|---|
| Contatos: coluna Responsável ligada de saída; "Colunas +N" conta o que falta ligar | `2c569fa` |
| 4.1 `editarPasso` + `conferirOrdem`, remarca a tarefa de quem espera | `fcf5aae` |
| 4.2 Editar passo pela tela, `CamposDoPasso`, `esperandoPorPasso` | `69efdf9` |
| 5.1 abas Fluxos · Gatilhos · Sequências (`src/core/abas-de-automacao.ts`) | `22e4e51` |
| Pedido do Gabriel: interruptor de volta na linha, alça de arrastar (`ListaOrdenavel`), "Ver respostas" no menu ⋯, sem "Entrada ligada/desligada" | `586ba41` |
| 5.2 "+ Criar automação" com 4 origens; `?aba=templates` abre a galeria no diálogo | `b0bcab8` |
| Arrasto refeito: linha flutua, marcador azul entre linhas, grava ao soltar | `e13411c` |

## Preferências do Gabriel vistas nesta sessão

- Estado ligado/desligado precisa estar **à vista na linha** (interruptor), não
  escondido em menu. Não reverter isso em tarefas futuras.
- Ação de salvar **não recarrega a página**: atualização otimista no front
  enquanto o servidor grava (vale para a 5.9 e para o que vier).

## Pendências e achados

- Automação nova (Em branco / modelo) ainda nasce `ativo = true` sem versão:
  aparece "Ligada, mas sem versão publicada". Duplicar nasce desligada.
- Contatos ainda **não** usa `BarraDeLista`.
- Editor no celular rola de lado; diálogo sai deslocado (5.8).
- Da sessão anterior: `prazoDoDia` usa fuso do servidor; concluir/cancelar/
  reabrir não conferem dono com escopo `proprios`; `consultas/contatos.ts:172`
  busca com `ilike`.

## Ambiente (armadilhas pagas)

- **Outro agente trabalha no mesmo diretório.** Commite por caminho, nunca `-A`.
- Scripts em `.ux-local/` (ignorado), além dos antigos: `passo.mjs` (editar
  passo), `arrastar.mjs` (arrasta a 1ª linha de Fluxos e mostra o menu),
  `nova.mjs` (diálogo Nova automação, Duplicar, `?aba=templates`),
  `deploy.sh [sha]`. `scripts/ux-local/prints.mjs` ganhou `fluxos-gatilhos`.
- Link que cobre a linha inteira (`absolute inset-0`) pinta por cima de
  controles que vêm antes no DOM: controle na linha precisa de `z-[1]`.
- Arrastar que reordena o DOM perde a captura do ponteiro: escute
  `pointermove`/`pointerup` na janela.
- O lint `react-hooks/refs` recusa ref lida no render ou passada para função de
  render; use `useId` + `getElementById` ou refs só em handlers.
- Banco local tem 3 inscrições ativas semeadas na sequência "Nutrição
  pós-aula experimental" (passo 2), para prints da 4.2.

## Banco

Nenhuma migration nesta sessão. Nada pendente para produção. A 5.9 vai criar
tabela nova de anotações: aplicar só no local e anotar no fim do plano.
