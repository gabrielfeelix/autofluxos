# Handoff 07/out/2026 (noite): formatação no campo de resposta da Inbox

Continua `docs/HANDOFF-07-OUT.md`. Regras de trabalho e ambiente local em
`docs/HANDOFF-06-OUT.md`.

## Próximo passo: o campo de resposta formata como o WhatsApp

Pedido do Gabriel: quem atende não consegue fazer lista nem numeração no campo
de resposta, e quer ver a formatação enquanto digita. Tudo que aparecer no
campo tem que sair igual no WhatsApp de quem recebe.

**Decisões já tomadas (não reabrir):**

1. **O campo continua `<textarea>` não controlado.** `src/components/lead/responder.tsx`
   explica o porquê (comentário perto da linha 116), restaura rascunho pelo
   setter nativo (linhas 176 a 188) e ajusta a altura em `ajustarAltura`.
   `contentEditable` traria de volta colar, IME e celular como problema; não
   vale.
2. **Listas por atalho, enviadas como texto puro:**
   - `* ` ou `- ` no começo da linha vira `• `;
   - Enter numa linha de lista abre o próximo item (`• `, ou `2. ` depois de `1. `);
   - Enter num item vazio encerra a lista (apaga o marcador);
   - envia `•` e `1.` como caracteres, que aparecem iguais em qualquer versão
     do WhatsApp (a lista nativa com `* ` não aparece nas antigas).
3. **Formatação ao vivo por camada espelho:** uma `div` atrás do textarea
   desenha o mesmo texto; o textarea fica com o texto transparente e o cursor
   visível (`caret-color`). Os marcadores (`*`, `_`, `~`) ficam visíveis e
   esmaecidos. Regra de ouro: **nada pode mudar a largura de um caractere**, ou
   o cursor desalinha.
   - negrito `*x*`: negrito sintético por `text-shadow` (ex.: `0.35px 0 currentColor`),
     nunca `font-weight`;
   - riscado `~x~`: `text-decoration: line-through`;
   - itálico `_x_`: só cor de destaque (inclinar muda a largura);
   - monoespaçado: sem estilo no campo.
   Mesma fonte, tamanho, `line-height`, `padding`, `white-space: pre-wrap` e
   `word-break` nas duas camadas; rolagem sincronizada.
4. **A gramática é uma só:** `src/core/flow/marcacao.ts` (`interpretarMarcacao`)
   já decide o que é negrito, itálico e riscado para as bolhas
   (`src/components/texto-do-whatsapp.tsx`). A camada espelho usa a mesma
   função, para o campo e a bolha nunca discordarem. Endereço é separado antes
   da marcação (ver o comentário em `texto-do-whatsapp.tsx`), e no espelho
   também.
5. **Bolhas da conversa:** `TextoDoWhatsApp` passa a desenhar linha começando
   com `• `, `- `, `* ` ou `1. ` como item de lista, e `> ` como citação, do
   jeito do WhatsApp.

**Botões que já existem:** negrito, itálico e riscado na seleção, por botão ou
Ctrl+B / Ctrl+I (`aplicarMarca`, perto da linha 224; `BotaoDeFormato`). Mantê-los.

**Como provar:** teste unitário da regra das listas (função pura em `src/core/`,
ao lado de `marcacao.ts`) e de `interpretarMarcacao` com itens de lista. Print
local em 1440 e 390 antes de entregar (memória `sempre-ver-como-ficou`): digitar
`* item`, Enter, `item 2`, Enter, Enter, `*negrito*` e mostrar o campo e a bolha
enviada. O ambiente local é `scripts/ux-local/dev.sh` contra o Supabase local do
AutoFluxos; em 07/out só o Supabase da **Verandi** estava no Docker, e subir os
dois juntos pesa (memória `nao-derrubar-a-wsl`).

## O que entrou em 07/out (tudo no ar)

| Commit | O quê |
|---|---|
| `6468d21e` | Id de produto chutado volta para a IA buscar, em vez de ir para a equipe |
| `712ad70b` | Avaliação da IA da PCYES (`npm run avaliacao`, 25 casos reais) e terceira volta de consulta |
| `10cd5320` | Volta final sem ferramenta não proíbe usar o que a consulta trouxe (a ficha virava "fora do assunto") |
| `da3e1267` | Prompt 23% menor (32.750 para 25.363 caracteres na PCYES), linha de prioridade TAREFA sobre o genérico, avisos do servidor como fato e não ordem |
| `ebaee454` | Prévia da fila com tiques e "reagiu com ❤️"; migration `0132` aplicada em produção com autorização |
| `3ea62844` | Frase que promete link sem card ganha o card do servidor (`PROMETE_LINK`, `produtosPrometidos`) |
| `156e457a` | O mesmo encaminhamento não sai duas vezes em 10 minutos (`encaminhouHaPouco`) |

Fluxo "Vendas com IA" da PCYES (`baff0b15`): **v16** (especialista para dúvida
técnica) e **v17** (resumo `especialista: ...`, "Oi" retoma o assunto, produto
escolhido com card e CHAT10, marca concorrente busca similar, encaminhar sem
telefone), as duas publicadas com autorização. Avaliação da v17: 24/25.

**Avaliação da IA:** `set -a && . ./.env && set +a`, depois
`node scripts/avaliacao/exportar.mjs <flow> <no> pcyes` (gera
`scripts/avaliacao/.dados/`, fora do git: o repositório é público) e
`AVALIACAO=1 AVALIACAO_SAIDA=/tmp/x.json npm run avaliacao`.
`AVALIACAO_DADOS=<arquivo>` testa uma instrução candidata sem publicar. O
modelo oscila: compare mais de uma rodada.

## Pendências

- **"Monte seu PC" da PCYES vende processador**, mas o processador não aparece
  na busca da loja. A IA diz "a PCYES não vende processador". Falta o link do
  Monte seu PC, com o Gabriel, para pôr no "sobre a empresa" junto com
  **processador nas exceções do CHAT10** (o cupom não vale para processador,
  placa de vídeo, placa-mãe e memória).
- **Venda do Rei (PCYES, contato `fe3f9c23`)**, R$ 10.129,00 com o i5-12400F:
  o Gabriel vai montar o carrinho quando ele mandar o e-mail da conta. Ele
  pediu link de pagamento; a resposta foi que o pagamento é no site.
- **Chave paga do Gemini:** o "Tive um probleminha agora" vem do Gemini grátis
  caindo por demanda; a reserva Groq grátis não comporta o prompt (8 mil
  tokens/min). Só resolve com chave paga. Ação do Gabriel.
- **Encaminhamento instável (~12%)**: a IA escreve "vou te direcionar" e não
  chama `concluir_conversa`. Medido igual no prompt antigo e no novo.
- **"Sobre a empresa" da PCYES**: resumir garantia e trocas cortaria mais
  ~2,5 mil caracteres; depende do ok do Gabriel.
- A Lidiane (suporte de tablet `31599`, esgotado) ficou sem o link prometido.
