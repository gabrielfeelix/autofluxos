# Plano da LP v2: o miolo branco com ritmo, efeito e personalidade

28/out/2026. Pedido do Gabriel: "algo BEM uau, com efeitos tech, que dê para
entender as informações, visual muito legal e personalidade". Este documento é
para o agente que vai executar. Leia inteiro antes de tocar em código.

## O que fica e o que não se discute

- **O azul do hero e do rodapé fica** (`--lp-casca`, #1a3fb8 → #3a6cf0, com os
  fios de fluxo no fundo). O Gabriel ama. O efeito do hero também fica.
- Rodapé fica, já com "Pergunte a uma IA" (commit `94df224d`).
- A seção **Por segmento** (`src/app/(site)/conversa-por-segmento.tsx`, commit
  `94df224d`, **ainda não publicado**) é a base da demo de conversa: evolua, não
  refaça do zero.

## Diagnóstico (print inteiro em 1440, 28/out)

1. **Um compasso só.** Da "Na prática" às dúvidas são ~8.000 px com a mesma
   fórmula: rótulo, título centralizado, parágrafo, cards cinza-claro. Nenhum
   momento de tela cheia, nenhuma faixa escura, nenhuma mudança de escala.
2. **O produto aparece pequeno e desbotado.** As telas viraram esqueletos
   cinza. O que vende (a conversa acontecendo) é figurinha.
3. **Repetição.** "Para quem atende no WhatsApp" (6 cards de segmento) repete a
   "Por segmento". E são dois blocos de números seguidos.
4. **Número sem fonte.** "70% das mensagens são as mesmas cinco perguntas" não
   tem medição conhecida. Meça no banco ou tire. Só entra número medido,
   citado em comentário no código (como o 74% e o "1 em 6").

## Os quatro princípios

1. **Assinatura: os fios de fluxo.** O desenho do fundo azul (linhas que ligam
   nós) vira a linguagem visual da página inteira. Fios que se desenham ao
   rolar, ligam canais ao AutoFluxos, acendem quando uma mensagem passa. É o
   que dá personalidade: nenhum concorrente tem isso, e é literalmente o nome do
   produto.
2. **Todo efeito explica algo.** Mensagem chegando, bot decidindo, fluxo se
   montando, número subindo. Nada de brilho solto.
3. **Ritmo.** Alternar branco, escuro e azul; densidade e respiro; escala
   pequena e tela cheia; uma parte que trava a tela contando história.
4. **Leitura em 3 segundos.** Uma ideia por seção, título que se entende
   sozinho, número grande quando houver número.

## O mapa novo, seção a seção

| # | Seção | Chão | O que acontece na tela | Referência | Técnica |
|---|---|---|---|---|---|
| 0 | Hero | azul | Como está. | - | - |
| 1 | **Inbox ao vivo** (substitui "Na prática") | branco, tela cheia | O Inbox de verdade, grande, montado em DOM (não imagem). Entra em perspectiva e assenta reto ao rolar. Roteiro: conversa nova entra na fila; o bot responde com chips de ação ("agenda.marcar", "crm.etiquetar", "2 ações · 3 s"); cliente pede uma pessoa; atendente assume; selo "Resolvido". | Linear (UI real que se mexe), Lindy (passos com check), Chatbase ("Pensando" vira "3 ações concluídas") | CSS `animation-timeline: view()` para a perspectiva; roteiro igual ao da `conversa-por-segmento` |
| 2 | **Faixa de canais** | branco, fina | Fios animados ligando WhatsApp, Instagram, Site e Telegram a um nó AutoFluxos, e dele a Magento, Nuvemshop, Verandi, Asaas. Pulsos de luz correm pelos fios. **É a assinatura em estado puro.** | Magic UI Animated Beam | SVG + `motion` (ou CSS `offset-path`) |
| 3 | **O problema** | **faixa escura** (#0b1430), tela cheia | A mesma pergunta "Que horas vocês abrem?" chega de novo e de novo, empilhando com horários diferentes (8h12, 9h40, 11h03...), até virar uma pilha. Corta para três números brancos que sobem ao entrar na tela: 74% sem a equipe, 1 em 6 fora do horário, e um terceiro medido. | Fin (números como cadência), Decagon (faixa de ROI) | Magic UI Animated List + Number Ticker |
| 4 | **Por segmento** | branco | A que já existe, com: chips de ação nas respostas (estilo Lindy), absorvendo os segmentos do "Para quem é" (salão, imobiliária). O número da esquerda migra para a faixa escura; a coluna da esquerda vira o que o bot resolve naquele segmento (3 linhas), trocando com a aba. | Zipchat (abas), Lindy | Já feito, evoluir |
| 5 | **O que ele faz** (bento numerado) | branco | Cinco cards com legenda técnica "Fig. 01" a "Fig. 05", cada um com micro-UI viva: o fluxo se desenhando bloco a bloco (os fios de novo); a fila do Inbox entrando; a IA "pensando" com brilho no texto e o selo "não inventa preço"; a ficha do contato se preenchendo; integrações com fios. Borda acende seguindo o mouse. | Linear (Fig. 0.1), Aceternity Glowing Effect | SVG `stroke-dashoffset`, Motion Primitives Text Shimmer |
| 6 | **Como funciona** | **faixa azul full-bleed** que corta a ilha branca em duas | Quatro passos com a tela travada: o texto rola à esquerda e o painel à direita troca (conectar número, montamos o fluxo, equipe entra, você ajusta). No passo 1, celular com o WhatsApp e o Inbox lado a lado, a mesma mensagem aparecendo nos dois (coexistência). | Raycast (faixa azul no meio quebra a página), Attio (abas numeradas trocando tela), Aceternity Sticky Scroll Reveal | `position: sticky` + IntersectionObserver; moldura Magic UI iPhone |
| 7 | Preços | branco (segunda ilha) | Como está, mais luz correndo na borda do plano "Mais escolhido" e o valor animando ao trocar mensal/anual. | Magic UI Border Beam, Motion Primitives Animated Number | `motion` |
| 8 | Dúvidas | branco | Como está. | - | - |
| 9 | CTA + rodapé | azul | Como está. | - | - |

**Sai:** "Para quem atende no WhatsApp" (vira abas da seção 4) e o bloco de 4
números do "problema" (vira a faixa escura da seção 3).

**Opcional, depende do Gabriel:** depoimento ou logo de cliente (MGM Pilates e
PCYES são clientes, mas **logo e nome só com autorização escrita deles**).

## Como construir

- **Instalar só `motion`** (`npm i motion`), usado com `LazyMotion` +
  `domAnimation` (~15 a 20 KB gz). Sem GSAP, sem three.js, sem vídeo, sem
  Lottie. Rolagem: CSS `animation-timeline: view()` com `@supports`, que custa
  zero JS; quem não suporta vê a seção pronta.
- Componentes: copie e adapte o código, não instale kits inteiros. Fontes boas
  e verificadas em 28/out:
  - Animated Beam: https://magicui.design/docs/components/animated-beam
  - Animated List: https://magicui.design/docs/components/animated-list
  - Number Ticker: https://magicui.design/docs/components/number-ticker
  - iPhone: https://magicui.design/docs/components/iphone
  - Border Beam: https://magicui.design/docs/components/border-beam
  - Sticky Scroll Reveal: https://ui.aceternity.com/components/sticky-scroll-reveal
  - Glowing Effect: https://ui.aceternity.com/components/glowing-effect
  - Text Shimmer: https://motion-primitives.com/docs/text-shimmer
  - Animated Number: https://motion-primitives.com/docs/animated-number
  - Card de ação da IA: https://www.prompt-kit.com/docs/tool
  Licenças: Magic UI, Motion Primitives e prompt-kit são MIT. Aceternity
  permite uso comercial e proíbe revender. React Bits tem Commons Clause.
- Para estudar um efeito de perto, use a skill `clonar-site` nos sites de
  referência (Zipchat, Lindy, Linear, Attio, Raycast) e isole a animação.
- Demos de conversa: roteiro em dados (`{de, texto|card|acao, espera}`),
  "digitando" com tempo proporcional ao texto, roda só visível, pausa fora da
  tela, e com `prefers-reduced-motion` mostra a conversa pronta. Mesmo padrão
  da `conversa-por-segmento.tsx`.
- Galerias para mais ideias: https://saaslandingpage.com/tag/ai/,
  https://www.awwwards.com/websites/saas/, https://www.landing.love/,
  https://www.saaspo.com/.

## Orçamento e regras que pegam

- **Desempenho:** Lighthouse mobile da `/` antes e depois; não pode cair de
  90. O hero não pode piorar o LCP. JS novo no total: até ~25 KB gz.
- **Acessibilidade:** tudo com `prefers-reduced-motion`; abas com `role=tab`;
  animação nunca esconde texto que precisa ser lido.
- **Texto:** pt-BR, tom profissional B2B, sem gíria nem duplo sentido, sem
  travessão longo. **Todo texto novo passa pelo Gabriel antes de publicar.**
- **Número:** só medido no banco, com a consulta citada em comentário.
- **Marca de terceiro:** só logo oficial baixada (`components/design/glifos-oficiais.ts`).
- **Processo:** uma seção por commit, por pathspec; print local em 1440 e 390
  de cada seção antes de mostrar (`.ux-local/lp-trechos.mjs`,
  `.ux-local/lp-animacao.mjs`); tsc e eslint limpos; push juntando commits
  (a cota de deploy da Vercel é dividida com a Verandi).
- App local: `PORTA=3100 bash scripts/ux-local/dev.sh` (a LP não depende de
  banco). Um processo pesado por vez na WSL.

## Ordem sugerida

1. Seção 3 (faixa escura do problema): é a maior quebra de ritmo e reaproveita
   números prontos.
2. Seção 2 (faixa de canais): estabelece a assinatura dos fios.
3. Seção 1 (Inbox ao vivo): o momento mais caro e mais importante.
4. Seção 6 (como funciona na faixa azul).
5. Seção 5 (bento vivo).
6. Seção 4 (ajustes no Por segmento) e 7 (preços).
7. Mostrar tudo ao Gabriel, ajustar texto, publicar junto com o `94df224d`.
