# Handoff 29/out: website institucional do AutoFluxos

Para o agente que continua o site. Leia isto, depois
`docs/PLANO-SITE-INSTITUCIONAL.md` (estado e pendências) e, se precisar do
porquê das escolhas, `docs/PLANO-LP-V2.md` (princípios, 24 concorrentes).

## O pedido do Gabriel

Site **completo, bonito, tech e com cara extremamente profissional, sem cara
de IA** (memória `sem-cara-de-ia`), com **várias abas no header**, cada uma uma
página de verdade. Referências que ele aprovou: Zipchat (menus flutuantes por
canal e plataforma), Agendor (`/clientes/crm-para-industrias`, páginas por
segmento), Colmeia (integrações na home), Linear e Attio (produto real na
tela). **Texto novo está autorizado** sem revisão (memória
`lp-v2-texto-livre-e-referencias`). Ele é designer e não é dev: decida,
implemente, mostre o print. Respostas curtas.

## Onde está

| O quê | Valor |
|---|---|
| Branch | `lp-v2` (o `main` tem a v1 no ar; **não mexer no `main`**) |
| Pasta | `../autofluxos-v2/` (git worktree, já tem `node_modules`) |
| Local | `PORTA=3101 bash scripts/ux-local/dev.sh` → http://localhost:3101 |
| Prévia | https://autofluxos-git-lp-v2-4-yu.vercel.app (gera a cada push) |
| Ir ao ar | só com ok explícito do Gabriel: merge da `lp-v2` no `main` e push |
| Último commit | `49e1a801` (revisão do Gabriel em casa: bento real, LCP, tarifas conferidas) |

## Mapa do código (tudo em `src/app/`)

| Arquivo | Papel |
|---|---|
| `(site)/pagina-do-site.tsx` | `PaginaDoSite` (cabeçalho, chamada final, rodapé) e as seções antigas exportadas (`SecaoFluxo`, `SecaoOQueFaz`, `SecaoComo`, `SecaoNaPratica`, `SecaoPrecos`, `SecaoDuvidas`, `Desktop`, `Pergunta`) |
| `(site)/secoes-do-site.tsx` | Seções novas: capas (`CapaDaHome`, `CapaSimples`, `CapaDoNicho`), `SecaoNumeros`, `SecaoNichos`, `SecaoCanais`, `SecaoDoisLados`, `SecaoCalculadora`, `CorpoDoNicho`, resumos |
| `(site)/pecas-interativas.tsx` | Client: `PreviaQueTroca`, `DoisLados` (celular sobre o Inbox), `CalculadoraMeta` |
| `(site)/menu-do-topo.tsx` | Header com painéis flutuantes (Produto, Canais, Segmentos) e folha de tela cheia no celular |
| `(site)/previa-whatsapp.tsx` | Conversas encenadas por negócio (`CONVERSAS`), visual do WhatsApp |
| `(site)/nichos-do-site.ts` | Os 4 nichos, tirados de `src/core/nichos.ts` |
| `(site)/canais-do-site.ts`, `integracoes-do-site.tsx` | Dados (fora de arquivo `'use client'`, senão chegam ao servidor como referência) |
| `(site)/fluxo-se-montando.tsx` | O fluxo que se desenha ao rolar (assinatura dos fios) |
| `(site)/site.module.css`, `pagina-inicial.module.css` | Estilos; tokens em `.pagina` e `.quadro` |
| `page.tsx`, `produto/`, `precos/`, `integracoes/`, `segmentos/[slug]/` | As rotas |
| `src/proxy.ts` | **Toda rota nova do site entra em `PORTAS_ABERTAS` (exata) ou `PREFIXOS_ABERTOS`**, senão redireciona para o login |
| `sitemap.ts` | Rota nova entra aqui também |

## Abas do header: o que propor e construir

Hoje: Produto ▾, Canais ▾, Segmentos ▾, Integrações, Preços. Os painéis
apontam para âncoras de `/produto`. O passo seguinte é cada item virar página:

- **Produto**: `/produto` como visão geral e subpáginas `/produto/fluxos`,
  `/produto/ia`, `/produto/inbox`, `/produto/contatos-e-funil`,
  `/produto/transmissoes`, `/produto/relatorios`. Fonte dos fatos:
  `docs/FUNCIONALIDADES.md` (algumas linhas estão desatualizadas, ex.:
  pagamentos já têm gateways reais; confira no código).
- **Canais**: `/canais/whatsapp` (coexistência, API oficial, áudio
  transcrito), `/canais/instagram` (aviso: fluxos fechados até o App Review,
  `src/core/canais.ts`), `/canais/site`, `/canais/telegram`.
- **Segmentos**: os 4 já existem; falta caso real (depende de autorização).
- **Integrações**: `/integracoes/[slug]` por integração.
- **Preços**: falta comparação de planos (`src/core/planos.ts`,
  `RECURSOS_DO_PLANO`).
- Novas a considerar: **Empresa/Sobre a 4YU**, **Contato**, e a central
  `/ajuda` (a rota já existe no app, ver se é pública antes de linkar).

## Regras que custaram retrabalho (não repetir)

- **Rejeitado pelo Gabriel:** faixa escura do problema (saiu inteira);
  prévia do WhatsApp no hero da home; ícone em quadradinho com etiquetas em
  pílula; etiquetas ligadas por fio que pareciam botões; selo flutuante com
  sombra; pílulas coloridas de status; cinza sobre cinza; espaço vazio
  esticado em grade; seções repetindo a mesma ideia.
- **Aprovado:** menus flutuantes do header; prévia do WhatsApp por segmento
  com foto, botões, Pix, áudio e rastreio; cartões de nicho com foto inteira;
  bento com palco de cor e janela branca; coexistência com celular sobre o
  Inbox alinhada numa margem só.
- Só **número medido** (consulta citada em comentário); só **logo oficial**
  (memória `logos-oficiais-sempre`); fotos do Unsplash sem marca visível
  (tênis da Nike e bonecos da Nintendo foram descartados).
- Sem travessão longo no texto; pt-BR; tom B2B.
- **Processo:** print em 1440 e 390 de cada seção antes de mostrar
  (scripts em `.ux-local/`: `site-paginas.mjs`, `site-secoes.mjs`,
  `fatiar.mjs`, `lp-menu.mjs`, `lp-segmentos.mjs`); `npx tsc --noEmit -p .`
  e eslint limpos; um processo pesado por vez na WSL; commit por frente,
  push juntando (cota da Vercel dividida com a Verandi).
- **Push:** `set -a && . ../.secrets/4yu.env && set +a && git -c
  credential.helper='!f(){ echo username=x-access-token; echo
  "password=$GITHUB_TOKEN"; }; f' push origin lp-v2`.

## Depende do Gabriel

Nome comercial dos nichos; logo oficial da Verandi; autorização escrita de
MGM Pilates e PCYES para logo ou depoimento.
