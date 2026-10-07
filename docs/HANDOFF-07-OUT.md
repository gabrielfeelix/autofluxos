# Handoff 07/out/2026: PCYES ajustada, próximo assunto é a MGM

Continua `docs/HANDOFF-06-OUT-TARDE.md`. Regras de trabalho e ambiente local em
`docs/HANDOFF-06-OUT.md`.

## Próximo passo

O Gabriel vai trazer considerações sobre a **MGM Pilates** (cliente pagante,
usa Verandi e AutoFluxos juntos). Antes de mexer:

- Licença ("Voltei de licença") mora na Verandi; o handoff dela é apontado em
  `docs/HANDOFF.md` (`9123d17f`).
- `scripts/fluxos/mgm-licenca-simplifica.mts` (`34ea9976`) enxuga o fluxo da
  licença: tira o item do menu e os gatilhos por frase, junta "está voltando?"
  e "quer marcar?", pula "qual aula?" com `modalidadeUnica`. **Dry-run por
  padrão; `--gravar` publica.** Não se sabe se já foi gravado: conferir a versão
  publicada antes de rodar.
- Fluxos da MGM: `scripts/fluxos/mgm-*.mts`.

## O que entrou em 06/out (tudo no ar, deploy `ba1c6a2e` READY)

| Commit | O quê |
|---|---|
| `c4015fef` | Manual sem PDF (driver `.exe`, manual `.doc`) vira card `cta_url` com foto da página de downloads e botão. Ação nova `enviar_link` |
| `b31fde61` `55f81e99` `c7fb0cf5` `cb9f22d3` | Status do pedido: card com foto do item, linha do tempo (✅ / 🔵 atual / ⚪ futuro), previsão com dia da semana. Primeira linha é a resposta (vai na notificação) |
| `9be06ca8` | Bot (`loja_pedido`) manda o mesmo card da Inbox (`server/card-do-pedido.ts`); o card substitui a frase da IA (`substituiFrase`) |
| `9b0dfef7` | Agradecimento recusado como "fora do assunto" é perguntado de novo à IA com aviso (`server/ia/cortesia.ts`) |
| `393e34f3` | "Finalizar atendimento" também com bot pausado (encerra e religa) |
| `5566d4e3` | Etiqueta posta pelo bot aparece no painel na hora (rota da conversa devolve `etiquetas`) |
| `2965384c` | Bloco de etiqueta com opção "Tirar" (`tirar?: true` em `aplicar_etiqueta`) |
| `fc2a6697` | Foto em pergunta de resposta escrita: servidor lê, leitura vira a resposta; sem leitura pede para escrever. Não transfere antes de `MAX_TENTATIVAS` (5) |
| `4ce0441c` `967c9310` `cd2bd9e4` `a84505eb` `dbae7ed7` `85ea9315` `f5ded83d` `ae0b090b` `ba1c6a2e` `78e3b6c0` | Inbox: cursor no campo ao Responder; Ctrl+V de imagem; bolha da foto do tamanho dela; reação por cima do balão; fila sem "responder em" folgado e sem "responsável: você"; reação com autor; "Responsável" com foto no painel; funil com rolagem; botão de link dentro da bolha; um X só na busca; prévia "📄 documento" para mídia enviada |

## Fluxos da PCYES alterados direto em produção (autorizados pelo Gabriel)

| Fluxo | Versão | Mudança |
|---|---|---|
| Vendas com IA `baff0b15` | 13 | "Suporte" sozinho: pergunta se é para comprar ou técnico |
| Vendas com IA | 14 | 5 blocos "Tira: Quer comprar" antes de cada desvio de assunto (menos site) |
| Vendas com IA | 15 | "PRODUTO JÁ ESCOLHIDO": sem perguntar uso/orçamento; card + CHAT10 + "finalize pelo botão" |
| Drivers e manuais `968c958a` | 7 | Botão vai direto para a IA (lê foto); nó `modelo` ficou órfão |

Publicação foi `update flows.rascunho` + `publicar_fluxo` via Management API,
conferindo antes `rascunho = versão publicada`. O classificador do Claude Code
bloqueia escrita em produção sem autorização explícita na mensagem.

## Pendências

- **Cota da Vercel**: time `4-yu` (Hobby) é compartilhado com a Verandi; em
  06/out estourou (52 + 37 deploys). Juntar pushes; conferir `READY` antes de
  dizer "no ar".
- Nota fiscal no Magento: não deu para ler o token da loja (classificador). Se
  o Magento guardar NF no pedido, o card de status pode mostrar número e chave.
- Contatos com "Quer comprar" de antes da v14 seguem com as duas etiquetas.
- Linhas antigas sem `type` (PDF do Marcio, reação de ontem) continuam
  "mensagem sem texto" / "celular": só as novas saem certas.
- Resolvedor de loja e testes que usam banco não rodam local (Docker fora).
