# Handoff 28/out/2026: LP ganha "por segmento" e "pergunte à IA"

Pedido do Gabriel, a partir da página inicial do zipchat.ai (ele amou as duas
coisas). A LP é `src/app/page.tsx` (seções com `s.secao`, CSS em
`src/app/(site)/pagina-inicial.module.css`, motion em `src/app/(site)/*`).
Trabalho de design: main thread, Opus, print em 1440 e 390 antes de entregar.

## 1. Seção "por segmento", com conversa animada

Referência: zipchat.ai, bloco "Pre-sale first". Abas de segmento em pílula;
ao lado, uma janela de conversa que **se encena sozinha** ao trocar de aba:
mensagem do cliente entra, indicador de digitando, resposta do bot, card de
produto/botão, selo de resultado ("Adicionado ao carrinho"), legenda curta
embaixo. Etiqueta do canal no topo da janela (WhatsApp, Chat do site,
Instagram): regra da casa, toda automação mostra o canal.

Segmentos (casos reais, sem nome de cliente na LP):
- **Loja virtual**: pergunta de compatibilidade de periférico, card do produto
  com estoque, "adicionado ao carrinho" (PCYES).
- **Estúdio e academia**: remarcar aula, horários livres em botões, confirmado
  (MGM, Verandi).
- **Restaurante e delivery**: cardápio, pedido montado, link de pagamento.
- **Clínica e saúde**: agendar consulta, lembrete, confirmação.
- **Pós-compra**: pesquisa com botões e PC Points (o fluxo da PCYES de 27/out).

Coluna da esquerda do zipchat tem número grande (89%). **Só entra número
medido no nosso banco**, citado no código (ex.: % das conversas fora do horário
comercial, consulta em `messages`). Sem número medido, a coluna leva título e
texto, nunca estatística inventada.

Motion: entrada escalonada das bolhas, digitando com 3 pontos, respeitar
`prefers-reduced-motion` (mostra a conversa pronta). Reaproveitar `Revelar`.
Textos em pt-BR, tom profissional, sem gíria (memórias de copy).

## 2. Rodapé: "Pergunte à IA sobre o AutoFluxos"

Botões com **logo oficial baixada** (nunca desenhada): ChatGPT, Claude,
Gemini, Perplexity. Cada um abre a IA com o prompt pronto:

- ChatGPT: `https://chatgpt.com/?q=<prompt>`
- Claude: `https://claude.ai/new?q=<prompt>`
- Perplexity: `https://www.perplexity.ai/search?q=<prompt>`
- Gemini não aceita `?q=` (no zipchat também falhou): usar o Modo IA do Google,
  `https://www.google.com/search?udm=50&q=<prompt>`, com o rótulo "Google IA".

Prompt (pt-BR, ajustar com o Gabriel antes de publicar): "Estou pesquisando o
AutoFluxos (https://autofluxos.4yu.com.br), automação de atendimento e vendas
no WhatsApp, Instagram e chat do site para empresas brasileiras. Usando o site
oficial e https://autofluxos.4yu.com.br/llms.txt, resuma: 1) o que faz e como
funciona; 2) para quem é e os melhores usos; 3) resultados de clientes."

**Criar `public/llms.txt`** antes: sem ele a IA responde do que achar. Conteúdo
tirado de `docs/vantagens/VANTAGENS-AUTOFLUXOS.md`, sem nome de cliente sem
autorização.

## Regras que pegam aqui

- Texto que o visitante lê: propor e publicar só com ok do Gabriel.
- Sem travessão longo em arquivo nenhum.
- Commit por pathspec; tsc limpo; deploy READY conferido; cota da Vercel é
  compartilhada com a Verandi, juntar pushes.
- Docker não roda nesta WSL hoje: print da LP vale com `next dev` puro, a LP
  não depende de banco.
