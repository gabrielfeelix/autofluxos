# Handoff 06/out/2026 (tarde): edição de mensagem, lacunas do modelo, conversa expirada

Continua `docs/HANDOFF-06-OUT.md` (regras de trabalho e ambiente local lá).

## O que entrou (tudo no ar)

| Commit | O quê |
|---|---|
| `9e8dca5` | Webhook: `type: 'edit'` e `'revoke'` agora guardam `original_message_id` (o schema zod descartava). Edição troca o texto da original com "Editada" no rodapé e não acorda o bot; apagar esconde o conteúdo da original. Linha antiga sem corpo mostra "✏️ A pessoa editou uma mensagem" (`EdicaoSemTexto`). Caso real: Hugo, PCYES |
| `9482315` | Retomar e Agendar: um campo por lacuna (`CamposDasLacunas` em `components/lead/lacunas-do-modelo.tsx`), `{{1}}` começa no nome, resto vazio, Enviar trava. Servidor: `conferirValores` em `core/templates.ts`; agendada grava `template_valores` |
| `d07ac3e` | Sequência: passo guarda `template_parametros` (migration **0131**, aplicada) no contrato de `transmissoes.parametros` (`{nome}` = nome do contato); envio usa `valoresPara` |
| `48bebb2` | Estado `expirada` em `core/estado-do-atendimento.ts` ("Conversa expirada"): aguardando ou com pessoa + janela fechada (`janelaExpirada` em `channels/janela.ts`). Fora da contagem "esperando", sem alerta no avatar, não sobe na ordem por espera |

Transmissão já perguntava cada lacuna; não mudou.

## Pendências

- Nenhum print das telas desta rodada: Docker sem integração com a WSL, banco local fora. Conferir em produção: Retomar, Agendar fora da janela, passo de sequência, Caixa de Entrada.
- Lacuna de cabeçalho de **mídia** (imagem/vídeo no topo) segue sem parâmetro em todo envio.
- Do handoff anterior: PCYES recriar o modelo com `{{1}}` no link; custo real da Meta no relatório; aviso `key` em `PainelDeBlocos`; itens pequenos de tela.
