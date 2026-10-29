# Handoff 29/out (tarde): páginas de Produto e de Preços

Para o agente que continua o site. A home, os menus e as páginas de ramo
foram refeitos e aprovados pelo Gabriel nesta sessão. Sua frente: **cada
página de produto (`/produto/[slug]`) e a página de preços (`/precos`)**,
no mesmo nível de acabamento. O Gabriel pediu: "caprichar" nas de produto e,
em preços, **a Enterprise tem que ter destaque**.

## Onde está

| O quê | Valor |
|---|---|
| Branch | `lp-v2`, pasta `../autofluxos-v2/` (worktree, já tem `node_modules`) |
| Local | `PORTA=3101 bash scripts/ux-local/dev.sh` → http://localhost:3101 |
| Produção | `autofluxos.4yu.com.br`. O site novo já está no ar: `main` = `lp-v2` até `075d5815` |
| Commits locais ainda sem push | as páginas de ramo e este handoff. Conferir com `git log origin/main..lp-v2` |
| Publicar | **só com ok do Gabriel** (memória `site-v2-localhost-ate-aprovar`): `git push origin lp-v2:main lp-v2` (fast-forward; conferir antes com `git merge-base --is-ancestor origin/main lp-v2`) e acompanhar o deploy até READY pela API da Vercel |
| Push | `set -a && . ../.secrets/4yu.env && set +a && git -c credential.helper='!f(){ echo username=x-access-token; echo "password=$GITHUB_TOKEN"; }; f' push origin lp-v2:main lp-v2` |

A pasta `../autofluxos/` (o `main` local) é usada por outra sessão: não mexa
nela.

## O que o Gabriel aprovou (siga o padrão)

- **Home** (`src/app/page.tsx`): capa "Atendimento, vendas e pós-venda no
  WhatsApp"; jornada em player com 7 etapas e tela por etapa
  (`jornada-viva.tsx`); antes e depois em cena com chave Hoje / Com o
  AutoFluxos (`antes-e-depois.tsx`); vitrine dos ramos em círculos ilustrados
  (`pecas-interativas.tsx`, `ilustracoes-dos-ramos.tsx`); bento assimétrico
  com **um tratamento por peça** (`bento-do-produto.tsx`, `bento.module.css`).
- **Páginas de ramo** (`nicho-pagina.tsx`, `nicho.module.css`): a página
  inteira na cor do ramo via `PaginaDoSite cor={...}`; base comum (capa com
  cena, dores, IA, tela de automações fiel ao app, menu do ramo, FAQ) e
  **personalidade própria** em `modulos-dos-ramos.tsx`: janela da capa e um
  módulo exclusivo por ramo (agenda semanal, loja sincronizada, quadro da
  cozinha, planilha que vira catálogo). O Gabriel cobra isso: "cada um tem
  vantagens e módulos próprios, componentes próprios". Vale para as páginas
  de produto também.
- **Fundo de fios componentizado**: `--casca-fios`, `--casca-fios-2`,
  `--casca-fios-3` (`scripts/fundos/gerar-fios.mjs`). Use nos palcos coloridos
  com degradê da cor: `background: var(--casca-fios-2), linear-gradient(145deg, cor, color-mix(cor 62%, #0c1838))`.
- **Imagem de compartilhamento** por página: `opengraph-image.tsx` chamando
  `imagemDeCompartilhamento` (`(site)/imagem-de-compartilhamento.tsx`).

## Lições caras desta sessão (não repetir)

- **Tudo igual cansa.** O que reprovou: seis cartões com o mesmo molde
  (palco + janela centralizada + texto embaixo), seção só de texto,
  "faixa esticada" de ponta a ponta, título à esquerda com componente à
  direita dentro de grade. O que aprovou: cada bloco com tratamento próprio
  (claro, escuro/azul, tingido, cor da marca, número gigante, interface
  saindo pela borda), movimento em loop que explica a coisa, ilustração
  desenhada.
- **Nomes comerciais e claros**: "Captação de leads", "Avaliação e recompra";
  nunca "Chega", "Volta". Títulos que se entendem sem contexto.
- **Fundo escuro #0c1838 em cartão foi reprovado**; use o azul da capa em
  degradê com fios.
- **Ilustração tem que contar a história**: a do pagamento só foi entendida
  quando virou cobrança + status "Pago" + aviso do banco.
- **Largura**: seções de palco a 1360–1440px (`.faixaLarga`, bento com
  `width: min(100vw - 80px, 1440px)`); em monitor largo, nunca esticar sem
  limite.
- **Movimento**: automático começa ~1 s depois de a seção aparecer; clique
  para o automático. Sempre `prefers-reduced-motion`.
- Só número medido (74%, 4 s, 1 min 46 s, 1 em 6; consulta no comentário de
  `SecaoNumeros`). Só logo oficial. Sem travessão. Sem roxo, vidro, glow.

## A sua frente

### 1. Páginas de produto (`/produto/[slug]`)

Hoje: `CapaDoRecurso` (capa com uma janela de ficha) + `CorpoDoRecurso`
(3 destaques numerados, peça própria, lista de 9 itens em cartões cinza, e
as 6 partes). Fonte dos dados: `recursos-do-site.ts`; seções em
`secoes-do-site.tsx`. Está no molde antigo, "texto + cartões iguais".

Sugestão de direção (decida e mostre o print):
- Capa com cena do produto daquela parte (reaproveitar as telas animadas do
  bento e da jornada, maiores), cor própria por parte como os ramos (as cores
  do bento: fluxos azul, IA laranja, inbox teal, CRM índigo, relatórios
  ardósia, pagamento verde).
- Os 9 itens viram um bento com tratamentos variados, não uma grade cinza.
- Cada parte com a sua peça interativa (as que já existem: fluxo que se monta,
  Inbox + coexistência, calculadora; criar a de IA, CRM e relatórios).
- Fatos novos que já existem no app: **fila por setor** (`a743d066`) e **IA do
  atendente** (sugerir, corrigir, mais formal, mais curto, resumir;
  `79aa74f4`). Confira no código antes de prometer qualquer coisa.

### 2. Preços (`/precos`)

Hoje: `SecaoPrecos` (`pagina-do-site.tsx`), calculadora da Meta e dúvidas.
Dados: `src/core/planos.ts` (`PLANOS`, `RECURSOS_DO_PLANO`, `ENTERPRISE` =
a partir de R$ 2.500, "acima de 50 atendentes ou integração sob medida",
gerente de conta, robôs montados pela 4YU).

- **Enterprise com destaque**: cartão próprio, maior ou escuro-azul, com os
  itens e "Falar com vendas"; não pode parecer um quarto plano qualquer.
- **Comparação de planos** lado a lado (`RECURSOS_DO_PLANO`), pendente desde
  o plano do site.
- Manter a calculadora (tarifas conferidas em 28/out).

## Processo

Print em 1440 e 390 de cada seção antes de mostrar (scripts em `.ux-local/`:
`secao.mjs <rota> <seletor> <largura> <arquivo> <espera>`, `site-paginas.mjs`,
`fatiar.mjs`, `rolagem.mjs` para rolagem lateral). `npx tsc --noEmit -p .` e
eslint limpos. Commit por frente; push só com ok. Um processo pesado por vez
na WSL.
