# Plano da LP v2: o miolo branco com ritmo, efeito e personalidade

28/out/2026. Pedido do Gabriel: "algo BEM uau, com efeitos tech, que dê para
entender as informações, visual muito legal e personalidade". Este documento é
para o agente que vai executar. Leia inteiro antes de tocar em código.

## Versões: a v1 não muda

A LP que está no ar é a **v1** e fica exatamente como está até o Gabriel
aprovar outra. Cada versão nova vive separada, com endereço e link próprios.

| Versão | Branch | Pasta (git worktree) | Local | Link |
|---|---|---|---|---|
| v1 (no ar) | `main` | `autofluxos/` | `localhost:3100` | https://autofluxos.4yu.com.br |
| v2 | `lp-v2` | `../autofluxos-v2/` | `localhost:3101` | prévia da Vercel da branch `lp-v2` |
| v3, v4... | `lp-v3`, `lp-v4` | `../autofluxos-v3/`... | `3102`, `3103`... | prévia da branch |

- **Na v2 não se mexe no `main`.** Todo trabalho da LP nova é commit na
  `lp-v2`, dentro de `../autofluxos-v2/`. O `main` continua recebendo os
  consertos do produto normalmente, e a `lp-v2` traz o `main` para si com
  `git merge main` quando precisar.
- Subir o local da v2: de dentro de `../autofluxos-v2/`,
  `PORTA=3101 bash scripts/ux-local/dev.sh`.
- O link é a prévia que a Vercel gera a cada push da `lp-v2` (prévias já saem
  com `noindex`, fora do Google). Junte commits antes do push: a cota de deploy
  é dividida com a Verandi.
- **Trocar de versão só com aprovação explícita do Gabriel:** merge da branch
  aprovada no `main` e push. v3 e v4 seguem a mesma regra e podem partir do
  `main` ou de outra versão.
- A base da v2 já tem a seção **Por segmento** e o **Pergunte a uma IA** no
  rodapé, com `public/llms.txt` (antigo commit `94df224d`, tirado do `main` em
  28/out por não estar aprovado).

## O que fica e o que não se discute

- **O azul do hero e do rodapé fica** (`--lp-casca`, #1a3fb8 → #3a6cf0, com os
  fios de fluxo no fundo). O Gabriel ama. O efeito do hero também fica.
- Rodapé fica, com o "Pergunte a uma IA" que já está na `lp-v2`.
- A seção **Por segmento** (`src/app/(site)/conversa-por-segmento.tsx`, na
  `lp-v2`) é a base da demo de conversa: evolua, não refaça do zero.

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

## O que a concorrência faz (24 páginas lidas em 28/out)

Blip, Zenvia, Botmaker, Weni/VTEX, Huggy, Octadesk, JivoChat, Kommo, ChatGuru,
Poli, Digisac, Umbler Talk, BotConversa, Leadster, ManyChat, Respond.io, WATI,
Gallabox, Tidio, Zipchat, Chatbase, Landbot, Trengo, Intercom. Material bruto
(hero literal, títulos, prints) estava em
`/tmp/claude-1000/.../scratchpad/lp/` e `.../shots/` (some ao reiniciar).

**A fórmula de quase todos (não repetir):**
- Hero centralizado com pílula "Parceiro oficial da Meta", H1 com palavra em
  gradiente e dois CTAs (cerca de 20 de 24).
- **Print da inbox de 3 colunas com cards flutuando** como visual principal
  (Huggy, Octadesk, ChatGuru, Digisac, Respond, Botmaker, Kommo).
- Parede de logos em marquee + número redondo de vaidade ("+60 mil empresas",
  "2B+"): cerca de 18 de 24.
- Sequência logos, canais em grade, features alternadas, abas de segmento,
  parede de integrações, depoimentos, FAQ.
- Gradiente pastel ou roxo, foto de banco de imagem, ícone 3D. Nenhum mascote.

**Clichês de texto (proibidos na nossa página):** "24/7", "24 horas", "nunca
para" (17 de 24); "tudo em um só lugar" (15); "omnichannel" (15); "transforme
conversas em receita"; "do primeiro oi à venda"; "sem perder o toque humano";
"escale"; "venda mais e atenda melhor". **Atenção:** a LP atual tem "24/7" no
hero e no bloco de números. Trocar por cena concreta ("responde domingo de
manhã") e propor ao Gabriel.

**Quem quebra o padrão:** WATI (o hero é uma conversa com começo, meio e fim,
cruzando canal, áudio e idioma), Tidio (pergunta quanto as últimas 100
conversas renderam, preço no hero) e ManyChat (voz própria, inbox antes e
depois, FAQ com o medo real: "minha conta vai ser bloqueada?").

**O que ninguém faz, e vira nosso:**
1. **Coexistência mostrada:** a mesma conversa, ao mesmo tempo, no WhatsApp do
   celular do dono e no Inbox. Hoje é só card ou meia linha (ChatGuru,
   BotConversa).
2. **O editor de fluxo:** nenhum dos 24 heros mostra um fluxo visual, e é o
   que o dono de PME quer ver para confiar que controla o robô. **É a nossa
   assinatura dos fios, com função.**
3. **Resultado medido com método:** os outros usam agregado de vaidade ou case
   de gigante. Nós: 74% sem a equipe, 1 em 6 fora do horário, com a conta dita.
4. **Conversar com a IA de um negócio demo na própria página** (fase 2).
5. **Custo da Meta explicado:** uma calculadora honesta seria inédita no
   Brasil (só a Zenvia cita, numa barra de topo).
6. **Brasil concreto:** Pix, áudio de 2 minutos transcrito, "tá disponível?",
   Magento, Asaas, Verandi. Hoje só a ChatGuru cita integração brasileira.
7. **Identidade:** o setor inteiro é gradiente genérico. O nosso azul, os fios
   e uma voz de cena concreta já nos separam.

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
| 1 | **Os dois lados da mesma conversa** (substitui "Na prática") | branco, tela cheia | **Não é o print de inbox que 7 concorrentes usam.** À esquerda, um celular com o WhatsApp do dono; à direita, o Inbox. Uma conversa acontece e aparece nos dois ao mesmo tempo: o cliente manda áudio ("tá disponível?"), a transcrição aparece no Inbox, o bot responde com chips de ação ("agenda.marcar", "2 ações · 3 s"), o cliente pede uma pessoa, a atendente responde **pelo celular** e a resposta surge no Inbox. Mostra coexistência, IA e equipe numa cena só. | WATI (conversa com começo, meio e fim), Lindy (passos com check), Linear (UI real que se mexe) | Roteiro como na `conversa-por-segmento`; moldura Magic UI iPhone; perspectiva com CSS `animation-timeline: view()` |
| 2 | **O fluxo se montando** (a assinatura) | branco, tela travada | Ao rolar, o editor de fluxo se desenha: os fios saem dos canais (WhatsApp, Instagram, Site, Telegram), ligam blocos de verdade (Mensagem, Pergunta com botões, Condição, IA, Agenda) e terminam nas integrações (Magento, Verandi, Asaas). Um pulso de luz percorre o caminho que uma mensagem faria. **Nenhum dos 24 concorrentes mostra fluxo; é o nome do produto.** | Magic UI Animated Beam, Attio (builder de workflow) | SVG `stroke-dashoffset` com rolagem; blocos no visual do editor real (`@xyflow/react` já instalado, mas aqui SVG leve) |
| 3 | **O problema** | **faixa escura** (#0b1430), tela cheia | A mesma pergunta "Que horas vocês abrem?" chega de novo e de novo, empilhando com horários diferentes (8h12, 9h40, 11h03...), até virar uma pilha. Corta para três números brancos que sobem ao entrar na tela: 74% sem a equipe, 1 em 6 fora do horário, e um terceiro medido. | Fin (números como cadência), Decagon (faixa de ROI) | Magic UI Animated List + Number Ticker |
| 4 | **Por segmento** | branco | A que já existe, com: Brasil concreto em cada aba (áudio transcrito, Pix, "tá disponível?"), chips de ação nas respostas (estilo Lindy), absorvendo os segmentos do "Para quem é" (salão, imobiliária). O número da esquerda migra para a faixa escura; a coluna da esquerda vira o que o bot resolve naquele segmento (3 linhas), trocando com a aba. | Zipchat (abas), Lindy | Já feito, evoluir |
| 5 | **O que ele faz** (bento numerado) | branco | Cinco cards com legenda técnica "Fig. 01" a "Fig. 05", cada um com micro-UI viva: o fluxo se desenhando bloco a bloco (os fios de novo); a fila do Inbox entrando; a IA "pensando" com brilho no texto e o selo "não inventa preço"; a ficha do contato se preenchendo; integrações com fios. Borda acende seguindo o mouse. | Linear (Fig. 0.1), Aceternity Glowing Effect | SVG `stroke-dashoffset`, Motion Primitives Text Shimmer |
| 6 | **Como funciona** | **faixa azul full-bleed** que corta a ilha branca em duas | Quatro passos com a tela travada: o texto rola à esquerda e o painel à direita troca (conectar número, montamos o fluxo, equipe entra, você ajusta). No passo 1, celular com o WhatsApp e o Inbox lado a lado, a mesma mensagem aparecendo nos dois (coexistência). | Raycast (faixa azul no meio quebra a página), Attio (abas numeradas trocando tela), Aceternity Sticky Scroll Reveal | `position: sticky` + IntersectionObserver; moldura Magic UI iPhone |
| 7 | Preços | branco (segunda ilha) | Como está, mais luz correndo na borda do plano "Mais escolhido" e o valor animando ao trocar mensal/anual. | Magic UI Border Beam, Motion Primitives Animated Number | `motion` |
| 7b | **Quanto a Meta cobra** (novo, logo depois dos preços) | branco | Calculadora honesta: quantas conversas de atendimento e quantas de campanha por mês, e o custo da Meta à parte. Inédito no Brasil. Valores em `memory/meta-cobra-mensagem-de-servico` (serviço: 1.000 grátis por número por mês, depois R$ 0,035; marketing R$ 0,3217); **confira na tabela oficial da Meta antes de publicar.** | Tidio (preço sem rodeio) | Controle deslizante + número animado |
| 8 | Dúvidas | branco | Entram os medos reais, como faz a ManyChat: "Meu número pode ser bloqueado?", "Perco o WhatsApp do celular?", "A IA inventa preço?". | ManyChat | Como está |
| 8b | **Converse com um negócio demo** (fase 2) | branco | O visitante escreve para um estúdio ou loja de demonstração e a IA de verdade responde com as regras daquele negócio. Precisa de limite de uso e de custo de IA aprovado. | Lacuna 4 da pesquisa | Rota `/demo` já existe; avaliar |
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
2. Seção 2 (o fluxo se montando): estabelece a assinatura dos fios.
3. Seção 1 (os dois lados da mesma conversa): o momento mais caro e o mais
   diferente da concorrência.
4. Seção 6 (como funciona na faixa azul).
5. Seção 5 (bento vivo).
6. Seção 4 (ajustes no Por segmento) e 7 (preços).
7. Seção 7b (calculadora da Meta) e 8 (dúvidas com os medos reais).
8. Mandar ao Gabriel o link da prévia e o `localhost:3101`, ajustar texto.
   Publicar só quando ele aprovar a versão (merge no `main`).
