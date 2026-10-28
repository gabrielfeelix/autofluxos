# Plano do site institucional (substitui a LP de página única)

28/out/2026, branch `lp-v2`, pasta `../autofluxos-v2/`, local `PORTA=3101 bash scripts/ux-local/dev.sh`.
Pedido do Gabriel: "website institucional, uma página por departamento que
atendemos, uma de integrações, uma de preços"; referências Zipchat e
Agendor (`agendor.com.br/clientes/crm-para-industrias`). Texto novo está
autorizado sem revisão (memória `lp-v2-texto-livre-e-referencias`).
Regras visuais: memória `sem-cara-de-ia`. Leia também `docs/PLANO-LP-V2.md`
(princípios, orçamento de desempenho, concorrentes).

## O problema que este plano resolve

A home atual repete a mesma ideia em quatro lugares: o hero fala de perguntas
repetidas, "Na prática" mostra a tela, "Por segmento" dá exemplos, "Para quem
é" dá exemplos de novo, e o menu Segmentos dá exemplos de novo. Parece que o
produto é só isso. **Regra daqui em diante: cada ideia aparece uma vez na home,
e o detalhe mora na página própria.**

## Mapa do site

| Rota | O que é | Conteúdo |
|---|---|---|
| `/` | Home curta | ver abaixo |
| `/segmentos/[slug]` | Uma página por departamento | template abaixo |
| `/produto` | O produto inteiro | Fluxos, IA, Inbox, Contatos e funil, Transmissões, Relatórios, API; canais (WhatsApp com coexistência, Instagram, Site, Telegram) |
| `/integracoes` | Vitrine completa | `vitrine-de-integracoes.tsx` inteira, com busca; depois uma página por integração |
| `/precos` | Planos | planos + calculadora do custo da Meta (seção 7b do plano v2) + dúvidas de preço e os medos reais ("meu número pode ser bloqueado?") |

Slugs: `lojas-virtuais`, `saude`, `estudios-e-academias`,
`restaurantes-e-delivery`, `servicos`, `pos-venda` (os seis do menu,
`menu-do-topo.tsx`). Nome comercial de cada um ("AutoFluxos Saúde"...) ainda
**não decidido pelo Gabriel**: use o nome do segmento até ele decidir.
Recursos liberados por nicho: o plano é o mesmo e muda o que cada nicho tem.
**Pergunte ao Gabriel a lista de liberações por nicho** antes de escrever essa
parte; não invente.

**Proxy:** as rotas novas abrem sem sessão. Acrescente `/segmentos/`,
`/produto`, `/integracoes`, `/precos` na lista pública de `src/proxy.ts`,
conferindo antes que nenhuma colide com rota da conta.

## Home: uma ideia por seção, nesta ordem

| # | Seção | Chão | Já existe? |
|---|---|---|---|
| 1 | Hero: título e subtítulo novos (commit deste plano) + **uma prévia de WhatsApp grande ao lado**, tocando a conversa (reaproveite `previa-whatsapp.tsx`) | azul | metade |
| 2 | O problema: faixa escura, pilha + 74%, 1 em 6, 4 s | escuro | sim, `pergunta-repetida.tsx` |
| 3 | Como resolve: o fluxo se montando | branco | sim, `fluxo-se-montando.tsx` |
| 4 | Para quem: seis cartões de segmento (os do menu, com ícone e cor) que levam a `/segmentos/[slug]`. **Sem conversa encenada aqui**: ela fica na página do segmento | branco | cartões no menu; adaptar |
| 5 | O produto: bento "O que ele faz" com micro-UI viva (seção 5 do plano v2), cada peça leva a `/produto#...` | branco | evoluir o bento atual |
| 6 | Integrações: uma linha de logos + "ver todas" para `/integracoes` | branco | recortar a vitrine |
| 7 | Preço: "a partir de" + link para `/precos` | faixa azul | novo |
| 8 | Chamada final + rodapé | azul | sim |

**Sai da home:** "Na prática" (`<Desktop />`), "Por segmento" com a conversa
(`conversa-por-segmento.tsx` vai para as páginas de segmento), "Para quem é",
"Como funciona" (vai para `/produto`), "Dúvidas" e preços completos (vão para
`/precos`).

## Template da página de segmento (referência Agendor)

1. Hero do nicho: título da dor do nicho + prévia de WhatsApp grande com a
   conversa daquele segmento (`CONVERSAS` em `previa-whatsapp.tsx`).
2. Três dores concretas do nicho, cada uma com a resposta do produto.
3. Os modelos prontos daquele nicho (`src/exemplos/`, galeria "Nova
   automação"), mostrados como blocos do editor.
4. Recursos liberados no nicho (lista do Gabriel).
5. Integrações do nicho (filtro da vitrine).
6. Chamada para os planos.

## Como construir

- Extrair cabeçalho, rodapé e tokens de `src/app/page.tsx` (1.400+ linhas)
  para componentes compartilhados antes de criar as rotas. Os links do menu
  passam de âncora (`#segmentos`) para rota (`/segmentos/saude`).
- Uma rota por commit; print em 1440 e 390 de cada página; tsc e eslint
  limpos; push juntando commits (cota da Vercel dividida com a Verandi).
- Conferir na próxima sessão: o título "Integrações" apareceu em branco num
  print do Gabriel (revelação por rolagem que não disparou ao chegar pela
  âncora do menu). Ver `revelar.tsx`.

## Estado em 28/out, fim do dia (commits `2fe69c9d` e seguintes)

Feito: home com uma ideia por seção; `/segmentos/[slug]` para os quatro
nichos de `src/core/nichos.ts` (aulas-e-horarios, loja-virtual,
restaurantes-e-delivery, comercio); `/produto` com canais, fluxo,
coexistência (`DoisLados`), Inbox, bento e passos; `/precos` com
calculadora da Meta e dúvidas com os medos reais; `/integracoes`; menu em
rotas; rede de segurança da revelação (`revelar.tsx`). O hero da home
ficou sem visual a pedido do Gabriel; a prévia que troca segue nas
páginas de nicho.

Feito depois (commit desta rodada): home com números medidos em linha clara,
tela do Inbox saindo do hero, coexistência e três dúvidas curtas; sitemap
com as páginas novas; busca e "Pedir esta" na vitrine de integrações.

Falta:

1. **Conferir as tarifas da Meta** na tabela oficial antes do merge no
   `main` (`pecas-interativas.tsx`, constantes `SERVICO` e `MARKETING`).
2. **Lighthouse mobile** da `/` (não pode cair de 90).
3. Bento "O que ele faz" com conteúdo real nas janelas (nomes na fila, texto
   nos blocos, IA consultando o catálogo).
4. Comparação de planos em `/precos`; índice fixo em `/produto`; seção
   própria de IA e de relatórios em `/produto`.
5. Imagem de compartilhamento (OG) por página; página por integração.
6. **Depende do Gabriel:** nome comercial dos nichos; logo oficial da
   Verandi; autorização de MGM Pilates e PCYES para logo ou depoimento
   (casos nas páginas de nicho).
