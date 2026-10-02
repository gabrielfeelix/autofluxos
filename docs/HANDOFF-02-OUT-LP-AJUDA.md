# Handoff 02/out/2026: LP, central de ajuda e telas fora da conta na casca azul

Para o próximo agente. Trabalha **em paralelo** com o agente do
`docs/HANDOFF-02-OUT-DS-CASCA.md` (que padroniza botão, busca, menu, tabela e
checkbox dentro da conta). Combine antes de mexer em `globals.css` ou em
`src/components/design/`: use os componentes que ele criar, não crie outros.

## O pedido do dono (Gabriel, designer)

- "**Não somos dark mode.**" A LP é escura hoje; tem que ser **o azul com
  degradê** da casca, a mesma identidade de dentro do produto.
- A **central de ajuda** "está com cara de IA, não está profissional, está
  feia". Tem que ser **bem mais profissional, igual aos concorrentes do
  mercado**, com componentes bonitos e padronizados.
- As **outras telas que ainda não mexemos** seguem o novo padrão de layout.

## A identidade (já em produção dentro da conta)

Decisão em `docs/DECISIONS.md` (02/out, "casca azul, opção C" e "padrão de
tela"). Protótipo: https://claude.ai/artifact/UBK2qodWLXc2nMqqpVxBsJ.

- Fundo: `--casca` (degradê 135°, `#1a3fb8` → `#1d4ed8` → `#3a6cf0`) com
  `--casca-fios` (blocos e fios de fluxo a 10%). Classe `.app-casca` em
  `src/app/globals.css`, bloco "A casca".
- Superfícies brancas por cima (ilha da barra, cartões), cantos 16 a 22px,
  sombra `--sombra-ilha`. Texto solto no azul em branco. Botão primário no azul
  = branco com texto azul.
- Fonte Outfit (já carregada). **Nada de serifa, bege ou itálico**, o dono
  rejeita explicitamente o visual "de IA" (creme + serifa + terracota, ou
  preto com um acento neon).
- Antes de desenhar, carregue a skill `frontend-design` e leia
  `docs/CONCORRENTES-15-SET.md` e `docs/CONCORRENTES-22-SET-PROFUNDIDADE.md`.

## 1. LP (`src/app/page.tsx` + `src/app/(site)/`)

- Hoje: paleta escura própria em `pagina-inicial.module.css` (`--canvas:
  #080b10`, `--panel: #0e131c`, acento ciano `#56d0f5`), cursor com anel
  (`cursor.tsx`), partículas (`deriva-de-particulas.tsx`), números que sobem,
  revelar no scroll. 1.336 linhas na página.
- Fazer: trocar a paleta para a casca azul (fundo em degradê com fios,
  seções em branco ou vidro claro onde pedir leitura), mantendo o que funciona
  (estrutura, textos, cursor). Revise contraste de tudo que era claro sobre
  escuro. O cursor foi corrigido em `4af9379` (anel centralizado); não volte a
  margem negativa.
- Rever as páginas legais que usam o mesmo módulo: `privacidade`, `termos`,
  `exclusao-de-dados` (`pagina-legal.tsx`, `privacidade.module.css`).

## 2. Central de ajuda (`src/app/ajuda/page.tsx` + `src/components/ajuda/`)

- Hoje: página única com índice lateral (`components/ajuda/indice`) e texto
  corrido; cabeçalho próprio de 54px. Há também a **gaveta de ajuda** que abre
  do "?" no cabeçalho da conta (`GavetaDeAjuda` em
  `design/cabecalho.tsx`) e a `AjudaDaTela`/`AjudaDoCampo` dentro das telas.
- Fazer como uma central de ajuda de SaaS de verdade (Intercom, Brevo, RD,
  Zendesk Help Center como régua): topo na casca azul com **busca grande**,
  **categorias em cartões** com ícone e contagem de artigos, artigo com
  hierarquia tipográfica clara, sumário, "artigos relacionados", passo a passo
  numerado só onde é sequência de verdade, imagens/prints com moldura, rodapé
  "não achou? fale com a gente" (WhatsApp da 4YU já existe em
  `WHATSAPP_DA_4YU`). Gaveta e página falando a mesma língua visual.
- Conteúdo: o que existe é a fonte; reescreva só o que estiver confuso, no tom
  de SaaS B2B profissional (sem "gente esperando", "humano"). Placeholder de
  exemplo começa com "Exemplo:".

## 3. Telas fora da conta

Todas para a casca azul, com o cartão branco no centro:

- Entrada (usam `Portico`, `design/portico.tsx`): `entrar`, `entrar/codigo`,
  `criar-conta`, `cadastrar`, `esqueci-senha`, `redefinir-senha`,
  `confirmar-email`, `primeiro-acesso`, `ativar-duas-etapas`. Mudar o
  `Portico` resolve a maioria; confira cada uma em print.
- `contas` (escolha de organização), `painel`, `voltar`, `demo/pagar`,
  formulário público `f/[token]`, `not-found`, `error`, `global-error`.
- Administração (`app/admin`) já está na casca desde `3f5edd5`; só conferir.

## Como trabalhar aqui

- Local: `bash scripts/ux-local/dev.sh` (porta 3100) e
  `node scripts/ux-local/entrar.mjs`; login `revisao@local.test` /
  `senha-local-123456`. LP e ajuda não exigem login. Turbopack às vezes cai
  com panic: suba de novo.
- Print em 1440 e 390 de cada tela antes de entregar (o dono exige). Grades
  2x2 para revisar barato; abra em tamanho real só o que precisar.
- `npx tsc --noEmit -p .` e o teste do arquivo mexido; **não rode a suíte
  inteira**. Um processo pesado por vez.
- Sem travessão em texto nenhum. Commit, push e conferir o deploy na
  Vercel (projeto `autofluxos`) ao fim de cada frente. Registrar a decisão da
  LP e da ajuda em `docs/DECISIONS.md`.
