# Handoff 06/out/2026 (tarde): edição de mensagem, lacunas do modelo, conversa expirada

Continua `docs/HANDOFF-06-OUT.md` (regras de trabalho e ambiente local lá).

## O que entrou (tudo no ar)

| Commit | O quê |
|---|---|
| `9e8dca5` | Webhook: `type: 'edit'` e `'revoke'` agora guardam `original_message_id` (o schema zod descartava). Edição troca o texto da original com "Editada" no rodapé e não acorda o bot; apagar esconde o conteúdo da original. Linha antiga sem corpo mostra "✏️ A pessoa editou uma mensagem" (`EdicaoSemTexto`). Caso real: Hugo, PCYES |
| `9482315` | Retomar e Agendar: um campo por lacuna (`CamposDasLacunas` em `components/lead/lacunas-do-modelo.tsx`), `{{1}}` começa no nome, resto vazio, Enviar trava. Servidor: `conferirValores` em `core/templates.ts`; agendada grava `template_valores` |
| `d07ac3e` | Sequência: passo guarda `template_parametros` (migration **0131**, aplicada) no contrato de `transmissoes.parametros` (`{nome}` = nome do contato); envio usa `valoresPara` |
| `48bebb2` | Estado `expirada` em `core/estado-do-atendimento.ts` ("Conversa expirada"): aguardando ou com pessoa + janela fechada (`janelaExpirada` em `channels/janela.ts`). Fora da contagem "esperando", sem alerta no avatar, não sobe na ordem por espera |

| `42396fb` | Gasto com WhatsApp usa o custo da Meta onde ela já informou (copiador lê `currency`, só guarda custo em BRL); `estimado` no subtítulo. Até 06/out só há serviço grátis |
| `c2f9749` | Barras de Relatórios com chave + posição (aviso `key`); ficha sem lápis do nome (Editar já edita); preços de plano com `CampoDeDinheiro` |
| `830ab60` | Coexistência: eco até 15 s depois de mensagem do bot não cala o bot (`ecoColadoNoBot`). Caso Marcio/PCYES: "Bem-Vindo a PCYES!" saiu de aparelho conectado (id `3EB0...`), 6 s depois do menu. Substitui a regra de texto repetido (`5cf9839`) |
| `b988077`, `841b1de` | "Negócios" em todo lugar (ficha, menu, celular, trilha); "+ Novo negócio" |

Transmissão já perguntava cada lacuna; não mudou.

## Pendências

- Nenhum print das telas desta rodada: Docker sem integração com a WSL, banco local fora. Conferir em produção: Retomar, Agendar fora da janela, passo de sequência, Caixa de Entrada.
- Lacuna de cabeçalho de **mídia** (imagem/vídeo no topo) segue sem parâmetro em todo envio.
- PCYES: descobrir o que manda "Bem-Vindo a PCYES!" (aparelho conectado ou automação da caixa de entrada da Meta); gera boas-vindas dupla.
- `core/nichos.test.ts`: 3 falhas anteriores a esta sessão (`voltei-de-licenca` fora da galeria; `core/modelos-prontos.ts` compara nome de ramo).
- Do handoff anterior: PCYES recriar o modelo com `{{1}}` no link.
