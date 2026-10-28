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

## Pendências que o Gabriel já pediu (revisão da sessão de 28/out)

Feito nesta sessão: faixa escura do problema, fluxo se montando, menu com
painéis (Produto, Canais, Segmentos com prévia de WhatsApp e fotos), folha de
tela cheia no celular, vitrine de integrações, hero mais curto sem as tiras.

Ainda não feito, em ordem de prioridade:

1. **Reestruturar a home** conforme a tabela acima: tirar "Na prática",
   "Por segmento" com a conversa, "Para quem é", "Como funciona" e
   "Dúvidas". Hoje o 74% e o "1 em 6" aparecem duas vezes (faixa escura e
   "Por segmento").
2. **Páginas novas:** `/segmentos/[slug]` (seis), `/produto`,
   `/integracoes`, `/precos`, com cabeçalho e rodapé extraídos de
   `page.tsx` e os links do menu trocados de âncora para rota.
3. **Hero com visual:** uma prévia de WhatsApp grande tocando a conversa,
   no lugar do vazio atual. Conferir com o Gabriel se "esses dados" que
   pareciam mockados eram só as tiras (já saíram) ou também a constelação
   de partículas do fundo (`deriva-de-particulas.tsx`).
4. **Seção 1 do plano v2:** a mesma conversa no celular do dono e no Inbox
   ao mesmo tempo (coexistência). Vai para `/produto` ou para a home no
   lugar de "Na prática".
5. **Seção 6** (Como funciona na faixa azul, tela travada) e **seção 5**
   (bento com micro-UI viva), em `/produto`.
6. **`/precos`:** calculadora honesta do custo da Meta (valores na memória
   `meta-cobra-mensagem-de-servico`, conferir na tabela oficial) e dúvidas
   com os medos reais ("meu número pode ser bloqueado?", "perco o WhatsApp
   do celular?", "a IA inventa preço?").
7. **Bug:** o título de "Integrações" ficou em branco num print do Gabriel
   (revelação por rolagem não disparou ao chegar pela âncora). Ver
   `revelar.tsx`.
8. **Lighthouse mobile** da `/` antes e depois (não pode cair de 90; JS novo
   até ~25 KB gz). Ainda não medido.
9. **Depende do Gabriel:** lista do que cada nicho libera; nome comercial
   dos nichos; logo oficial da Verandi; autorização escrita de MGM Pilates
   e PCYES para logo ou depoimento.
