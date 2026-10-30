# Auditoria de SEO técnico do Dialogon

Data: 30/out/2026. Base: HTML servido em `https://autofluxos.4yu.com.br` (curl), código em `src/app` e fontes oficiais do Google. Nenhum código foi alterado.

## (a) Resumo do estado atual

1. O site tem 19 páginas públicas no sitemap, todas com 200, um `<h1>` único, canonical, OG/Twitter com imagem 1200x630 por página, `lang="pt-BR"` e HTML pequeno o bastante (46 a 200 KB, resposta em ~0,3 s).
2. Nenhuma página tem dados estruturados (JSON-LD): faltam Organization, SoftwareApplication e BreadcrumbList. Não achei GA4, GTM nem Clarity no código do site.
3. Contradição grave: `/privacidade`, `/termos` e `/exclusao-de-dados` estão no sitemap e liberadas no robots.txt, mas servem `noindex, nofollow`. Também `/cadastrar` sai sem título próprio (herda "atendimento desenhado bloco a bloco") e sem canonical.
4. Títulos: não há duplicados entre as páginas de conteúdo, mas o padrão varia ("Instagram no Dialogon", "Dialogon para loja virtual", "Preços... | Dialogon", home com dois-pontos) e os títulos de canais são curtos demais (20 a 24 caracteres). Todos os domínios estão fixos no código (`autofluxos.4yu.com.br` em ~10 arquivos), então a migração exige trocar vários pontos.
5. Para a migração: `dialogon.com.br` hoje responde 200 numa página de estacionamento da Hostinger com `noindex, nofollow, noarchive, nosniff`; é preciso apontar o DNS para a Vercel antes de qualquer coisa. URLs inexistentes de primeiro nível (ex. `/nao-existe`) respondem 307 para `/entrar` em vez de 404, e `/ajuda` está bloqueada no robots mesmo sendo conteúdo útil.

## Dados coletados, página por página (produção)

Legenda: T = title (caracteres), D = description (caracteres). Todas as páginas indexáveis têm canonical absoluto sem barra final, `index, follow`, og:title, og:image, twitter:card, 1 h1, `<html lang="pt-BR">`, 0 JSON-LD.

| Página | T atual | D atual | Observações |
|---|---|---|---|
| `/` | Dialogon: atendimento, vendas e pós-venda no WhatsApp (53) | 144 | Bom. FAQ com 3 perguntas em `<details>` sem marcação. Falta Organization/SoftwareApplication. |
| `/produto` | O produto: fluxos, IA, Inbox e canais \| Dialogon (48) | 133 | Bom. |
| `/produto/fluxos` | Fluxos e chatbot \| Dialogon (27) | 122 | Curto, sem palavra de busca ("chatbot WhatsApp"). |
| `/produto/ia` | IA que lê o seu negócio \| Dialogon (34) | 116 | Pouco descritivo para busca. |
| `/produto/inbox` | Inbox da equipe \| Dialogon (26) | 156 | Descrição 1 caractere acima do ideal. |
| `/produto/contatos-e-funil` | Contatos e funil \| Dialogon (27) | 109 | Genérico. |
| `/produto/transmissoes` | Transmissões \| Dialogon (23) | 139 | Genérico. |
| `/produto/relatorios` | Relatórios \| Dialogon (21) | 101 | Genérico. |
| `/precos` | Preços e custo da Meta \| Dialogon (33) | 113 | Bom. Sem marcação de oferta. |
| `/integracoes` | Integrações \| Dialogon (22) | 137 | Curto. |
| `/canais/whatsapp` | WhatsApp no Dialogon (20) | 131 | Fora do padrão "Assunto \| Dialogon". |
| `/canais/instagram` | Instagram no Dialogon (21) | 97 | Idem; descrição curta. |
| `/canais/site` | Chat do site no Dialogon (24) | 137 | Idem. |
| `/canais/telegram` | Telegram no Dialogon (20) | 94 | Idem; descrição curta. |
| `/segmentos/aulas-e-horarios` | Dialogon para aulas e horários (30) | 119 | Fora do padrão. |
| `/segmentos/loja-virtual` | Dialogon para loja virtual (26) | 106 | Fora do padrão. |
| `/segmentos/restaurantes-e-delivery` | Dialogon para restaurantes e delivery (37) | 96 | Fora do padrão. |
| `/segmentos/comercio` | Dialogon para comércio e serviços (33) | 132 | Descrição sai com `&quot;` no HTML (verificar escape duplo). |
| `/privacidade` | Política de Privacidade · Dialogon (34) | 102 | `noindex` mas no sitemap; sem canonical. |
| `/termos` | Termos de Serviço · Dialogon (28) | 136 | Idem. |
| `/exclusao-de-dados` | Exclusão de dados · Dialogon (28) | 107 | Idem. |
| `/entrar`, `/cadastrar`, `/esqueci-senha` | Dialogon, atendimento desenhado bloco a bloco (45) | 44 | `noindex, nofollow` correto, mas título e descrição iguais em três páginas e herdados do layout raiz. |
| `/painel`, `/admin`, `/clientes/*`, `/contas`, `/criar-conta`, `/ajuda*` | n/a | n/a | 307 para `/entrar` sem sessão. Protegidas, mas sem `X-Robots-Tag`. |

Imagens: 0 `<img>` sem atributo `alt`; todas as `<img>` do site usam `alt=""` (decorativas). Nas páginas de segmento e na home, capturas de tela do produto e logos de integrações merecem `alt` descritivo.

## (b) Títulos e descrições propostos

Regras: formato "Assunto | Dialogon", título até 60, descrição até 155, sem travessão. A home mantém descrição mais completa (o Google aceita nome do site mais longo na página inicial).

| Página | Título proposto | Descrição proposta |
|---|---|---|
| `/` | Dialogon \| Atendimento e vendas no WhatsApp com IA | Atendimento, vendas e pós-venda no WhatsApp, Instagram e chat do site, com chatbot, IA, funil e pagamento na conversa. Teste por 14 dias. |
| `/produto` | Produto: fluxos, IA, Inbox e canais \| Dialogon | Fluxos visuais, IA que responde pelo seu negócio, caixa de entrada da equipe, contatos e funil, no WhatsApp, Instagram, site e Telegram. |
| `/produto/fluxos` | Chatbot de WhatsApp com fluxos visuais \| Dialogon | Desenhe o atendimento em blocos, valide tudo antes de publicar e teste num simulador que roda o motor de verdade. Sem programar. |
| `/produto/ia` | IA de atendimento que lê o seu negócio \| Dialogon | A IA responde com a ficha da empresa, o catálogo e o cardápio, consulta pedido e agenda, e passa para a equipe quando não sabe. |
| `/produto/inbox` | Caixa de entrada para equipes no WhatsApp \| Dialogon | WhatsApp, Instagram, site e Telegram na mesma caixa, com fila por setor. A IA ajuda a responder e a equipe devolve ao chatbot. |
| `/produto/contatos-e-funil` | CRM e funil de vendas no WhatsApp \| Dialogon | O que o fluxo pergunta vira campo do contato, o cartão do funil anda sozinho e a equipe acompanha tudo sem planilha. |
| `/produto/transmissoes` | Transmissões em massa no WhatsApp \| Dialogon | Escolha o público por etiqueta, o modelo aprovado pela Meta e o horário. Veja quem recebeu e quem leu, com envio no ritmo do número. |
| `/produto/relatorios` | Relatórios de atendimento e vendas \| Dialogon | Relatórios de atendimento e de vendas no período que você escolher, com a explicação de cada número. |
| `/precos` | Preços e custo das mensagens da Meta \| Dialogon | Planos do Dialogon, teste grátis e a calculadora do que a Meta cobra pelas mensagens do WhatsApp, repassado sem acréscimo. |
| `/integracoes` | Integrações com loja, pagamento e cardápio \| Dialogon | Magento, Nuvemshop, Mercado Pago, Asaas, Cardápio Web, Goomer e mais: o Dialogon consulta o seu sistema e responde com o dado real. |
| `/canais/whatsapp` | WhatsApp API oficial com coexistência \| Dialogon | API oficial da Meta com coexistência: o número segue no app do celular e o chatbot, a IA e a equipe respondem pelo Dialogon. |
| `/canais/instagram` | Atendimento no Direct do Instagram \| Dialogon | Mensagens, fotos, áudios e menções em story chegam na mesma fila do WhatsApp, e a equipe responde sem abrir o celular. |
| `/canais/site` | Chat para site com chatbot e IA \| Dialogon | Uma linha de código e o visitante conversa com o mesmo chatbot do WhatsApp. Quando precisa de gente, chama a equipe direto da página. |
| `/canais/telegram` | Chatbot para Telegram \| Dialogon | Crie o bot no BotFather, cole o token e o mesmo fluxo do WhatsApp passa a atender no Telegram, sem custo por conversa. |
| `/segmentos/aulas-e-horarios` | Agendamento no WhatsApp para estúdios e clínicas \| Dialogon | Aula experimental, remarcação, lembrete e aluno que sumiu: o Dialogon conduz a conversa e a agenda se atualiza sozinha. |
| `/segmentos/loja-virtual` | WhatsApp para loja virtual \| Dialogon | O cliente pergunta do produto, recebe foto, preço, estoque e frete, e fecha a compra sem sair da conversa. |
| `/segmentos/restaurantes-e-delivery` | Pedidos no WhatsApp para restaurantes e delivery \| Dialogon | Cardápio com foto e botões, pedido montado na conversa, Pix na hora e tudo no quadro da cozinha. |
| `/segmentos/comercio` | WhatsApp para comércio e serviços \| Dialogon | Pergunta de estoque respondida com foto e preço, produto separado para retirada e orçamento por áudio, sem tirar ninguém do caixa. |
| `/privacidade` | Política de Privacidade \| Dialogon | Como o Dialogon trata os dados das conversas de WhatsApp atendidas pelas automações dos seus clientes. |
| `/termos` | Termos de Serviço \| Dialogon | As regras de uso do Dialogon: quem opera, o que o serviço faz, o que não se pode fazer e as consequências de uso indevido. |
| `/exclusao-de-dados` | Exclusão de dados \| Dialogon | Como pedir a exclusão dos seus dados no Dialogon, em quanto tempo respondemos e o que exatamente é apagado. |
| `/entrar` | Entrar \| Dialogon | Acesse o painel do Dialogon. |
| `/cadastrar` | Criar conta \| Dialogon | Crie sua conta no Dialogon e teste por 14 dias, sem cartão. |
| `/esqueci-senha` | Recuperar senha \| Dialogon | Receba por e-mail o link para criar uma nova senha do Dialogon. |

Observação sobre palavras de busca: os títulos de `/produto/*` e `/canais/*` ganharam o termo que a pessoa digita ("chatbot WhatsApp", "CRM WhatsApp", "transmissão em massa"). Confirmar volume no Search Console depois de 30 dias antes de ajustar de novo.

## (c) Correções técnicas, em ordem de prioridade

Arquivos prováveis entre parênteses.

1. **Resolver a contradição noindex x sitemap das páginas legais.** `/privacidade`, `/termos`, `/exclusao-de-dados` estão no sitemap com `noindex`. Decidir: ou indexam (usar `metadadosDoSite`, canonical, `robots index`) ou saem do sitemap. Recomendado: sair do sitemap e manter `noindex` (ninguém pesquisa isso; a Meta só precisa da URL acessível). (`src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/(site)/pagina-legal.tsx`, `src/app/privacidade|termos|exclusao-de-dados/page.tsx`)
2. **Centralizar o domínio numa constante/variável de ambiente** (`SITE_URL`) e trocar os ~10 pontos fixos: metadataBase, sitemap, robots, `metadados.ts`, OG, `llms.txt`, textos de docs. Sem isso a migração vira caça a string. (`src/app/layout.tsx`, `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/(site)/metadados.ts`, `src/app/(site)/imagem-de-compartilhamento.tsx`, `public/llms.txt`)
3. **Adicionar JSON-LD**: `Organization` (nome, logo, url, `sameAs`, contato) e `WebSite` na home; `SoftwareApplication` (categoria BusinessApplication, offers em BRL a partir de R$ 297/mês) na home e em `/precos`; `BreadcrumbList` em `/produto/*`, `/canais/*`, `/segmentos/*`. Validar no Rich Results Test. (`src/app/page.tsx`, `src/app/(site)/pagina-do-site.tsx`, `src/app/(site)/nicho-pagina.tsx`)
4. **404 de verdade para URL inexistente.** `/nao-existe` responde 307 para `/entrar` (o `proxy.ts` trata tudo fora da lista aberta como painel). Para o Google isso é soft redirect e polui o relatório. Responder 404 para caminhos que não existem em nenhuma rota. (`src/proxy.ts`, `src/app/not-found.tsx`)
5. **Padronizar títulos e descrições** com a tabela (b), e dar título/descrição próprios a `/entrar`, `/cadastrar`, `/esqueci-senha`, `/redefinir-senha`, `/confirmar-email`. (`src/app/(site)/recursos-do-site.ts`, `canais-do-site.ts`, `nichos-do-site.ts`, `src/app/integracoes/page.tsx`, `src/app/precos/page.tsx`, `src/app/page.tsx`, `src/app/entrar/page.tsx`, `src/app/cadastrar/page.tsx`)
6. **Garantir a separação site x app para a migração**: no domínio novo, `dialogon.com.br` serve só o site e `app.dialogon.com.br` serve login e painel inteiro com `noindex` e `X-Robots-Tag: noindex` nas rotas autenticadas. No app, o robots.txt do subdomínio deve deixar rastrear (o Google precisa ver o noindex) ou bloquear tudo, mas não os dois ao mesmo tempo. Hoje `/entrar` e `/ajuda` estão em Disallow e sem canonical. (`src/proxy.ts`, `next.config.ts` headers, `src/app/robots.ts`)
7. **Redirecionamentos 301/308 do domínio antigo e redirecionar rotas de app**: no host `autofluxos.4yu.com.br`, 308 página a página para o equivalente em `dialogon.com.br`; `/entrar`, `/cadastrar`, `/painel`, `/clientes/*`, `/ajuda*`, `/e/*`, `/f/*`, `/pagar/*` vão para `app.dialogon.com.br` com o mesmo caminho. (`next.config.ts` `redirects()` com `has: host`, ou regras de domínio na Vercel)
8. **Atualizar `llms.txt`**: o link "Preços" aponta para âncora `/#precos`; trocar por `/precos`, e listar as páginas de produto, canais, segmentos e integrações. (`public/llms.txt`)
9. **`alt` descritivo** nas capturas de tela e ilustrações de produto (hoje todas `alt=""`), mantendo vazio só em logos decorativos. (`src/app/(site)/previa-whatsapp.tsx`, `bento-do-produto.tsx`, `inbox-do-ramo.tsx`, `vitrine-de-integracoes.tsx`)
10. **Sitemap com `lastModified`** e sem `priority/changeFrequency` (o Google ignora ambos). Gerar a data a partir da data do último deploy ou do conteúdo. (`src/app/sitemap.ts`)
11. **Instalar GA4 e verificar Search Console** (propriedade nova "Dialogon", seguindo a regra de uma propriedade GA4 por produto do `CLAUDE.md` de `4yu-apps`). Eventos: clique em "Testar grátis", envio do cadastro. (`src/app/layout.tsx` ou `(site)`)
12. **Escape do `&quot;` na descrição de `/segmentos/comercio`**: conferir se a descrição está duplamente escapada na fonte; o texto exibido no Google pode sair com `&quot;` literal. (`src/app/(site)/nichos-do-site.ts`)
13. **Novas páginas de aquisição** (depois da migração): uma página por integração (`/integracoes/<nome>`: Magento, Nuvemshop, Mercado Pago, Asaas, Cardápio Web, Goomer), páginas de comparação ("Dialogon vs ..."), e blog/guias (API oficial do WhatsApp, custo da Meta). FAQ marcado em HTML continua útil para o usuário, mas não gera rich result (ver fontes).
14. **Tamanho do HTML**: home com 201 KB e `/produto` com 186 KB (67 e 51 `<img>`). Aceitável, mas vale `loading="lazy"` abaixo da dobra e checar LCP no PageSpeed Insights após a troca de domínio. (`src/app/(site)/*`)

## (d) Checklist da migração de domínio, em ordem

Premissa: `dialogon.com.br` (site) e `app.dialogon.com.br` (sistema). O Google exige redirecionamento 301/308 no servidor, mapa de URLs, canonical autorreferente, sitemap novo e a ferramenta Mudança de endereço; os redirecionamentos devem ficar pelo menos 180 dias, e o recomendado é 1 ano ou mais. Mudança de endereço só vale para domínio ou subdomínio inteiro, não para pasta.

### Código (antes de ligar o domínio)
1. Mapa de URLs: as 19 do sitemap atual viram o mesmo caminho em `dialogon.com.br` (estrutura de URLs igual, o que simplifica tudo).
2. Introduzir `SITE_URL` e `APP_URL` por variável de ambiente (item 2 da seção c); metadataBase, canonical, og:url, sitemap, robots e `llms.txt` apontando para `https://dialogon.com.br`.
3. Redirects 308 por host: site antigo para site novo página a página; rotas de app (`/entrar`, `/cadastrar`, `/painel`, `/clientes/*`, `/ajuda*`, `/e/*`, `/f/*`, `/pagar/*`, `/api/*` que são links ou callbacks) para `app.dialogon.com.br`. Sem cadeias, sem mandar tudo para a home.
4. Separar o comportamento por host: no host do site, só rotas públicas; no host do app, `noindex` em tudo (meta e `X-Robots-Tag`), `/` do app redireciona para `/entrar` ou painel.
5. Atualizar links absolutos de e-mails transacionais, textos legais, link de privacidade da Meta, `sw-push.js` e CORS/cookies (`Domain`, Better Auth `baseURL` e `trustedOrigins`, sessão em `app.`).
6. Retirar o `noindex` de desenvolvimento se houver; conferir canonical de cada página nova.

### Vercel e DNS
7. Trocar o DNS de `dialogon.com.br`: hoje aponta para a Hostinger (página de estacionamento com `noindex, nofollow`). Apontar apex e `www` para a Vercel (A `76.76.21.21` ou CNAME `cname.vercel-dns.com`, conforme o painel indicar) e `app` para o CNAME da Vercel.
8. Adicionar `dialogon.com.br`, `www.dialogon.com.br` (redirect 308 para o apex) e `app.dialogon.com.br` ao projeto na Vercel e conferir o certificado.
9. Manter `autofluxos.4yu.com.br` apontando para a Vercel, no mesmo projeto, só com os redirects do passo 3, por pelo menos 12 meses.
10. Seguir os três namespaces do `CLAUDE.md` de `4yu-apps`: envio de e-mail em subdomínio próprio (ex.: `mail.dialogon.com.br`) com SPF, DKIM e DMARC novos, sem misturar com a caixa humana.
11. Testar com curl: cada URL antiga retorna 308 direto para a nova (sem cadeia), a nova retorna 200 com canonical próprio, `robots.txt` e `sitemap.xml` do novo domínio com o domínio certo.

### Painel do Google e de terceiros
12. Search Console: criar propriedade de **domínio** `dialogon.com.br` (verificação por DNS TXT, cobre `app.` e `www`); manter a propriedade `autofluxos.4yu.com.br` (a de domínio `4yu.com.br` já existe e a conta de serviço é Owner dela).
13. Enviar `https://dialogon.com.br/sitemap.xml` na propriedade nova; manter o sitemap antigo enquanto o Google reprocessa.
14. Ferramenta **Mudança de endereço**: só funciona em propriedade de domínio ou subdomínio inteiro e como dono das duas. Como o site antigo é um subdomínio de `4yu.com.br`, abrir a ferramenta na propriedade antiga do subdomínio (se ela existir como propriedade própria) e apontar para `dialogon.com.br`. Se o Google não oferecer a ferramenta para esse subdomínio, os 308 por si só fazem o trabalho; confirmar na hora.
15. Inspecionar a home e 5 páginas no URL Inspection do domínio novo, pedir indexação e acompanhar Páginas e Sitemaps por 4 semanas.
16. GA4: nova propriedade "Dialogon" com fluxo web `dialogon.com.br` e outro para `app.` (ou domínios cruzados na mesma propriedade, com a lista de referral exclusion), sem apagar a propriedade antiga até fechar o histórico.
17. Meta for Developers: atualizar domínios do app, URL de privacidade, URL de exclusão de dados, redirect URIs do OAuth (WhatsApp, Instagram, anúncios) e webhooks; revisar domínios verificados. Mesma coisa em Mercado Pago, PagBank, Stripe, Nuvemshop (callbacks de `/api/*/retorno`).
18. Backlinks e perfis: atualizar links próprios (site da 4YU, Verandi, LinkedIn, Instagram, Google Business, assinaturas de e-mail) para `dialogon.com.br`; pedir atualização a parceiros e diretórios.
19. Monitorar: erros 404/redirect no Search Console, crescimento de impressões no novo domínio, queda no antigo; manter os redirects por 12 meses ou mais, e não deixar o domínio antigo expirar.

## (e) Fontes

- Google Search Central, migração de site com mudança de URL: https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes
- Search Console, ferramenta Mudança de endereço: https://support.google.com/webmasters/answer/9370220
- Google Search Central, redirecionamentos e Google Search: https://developers.google.com/search/docs/crawling-indexing/301-redirects
- Google Search Central, canonicalização: https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- Google Search Central, links de título: https://developers.google.com/search/docs/appearance/title-link
- Google Search Central, galeria de dados estruturados (Organization, Software app): https://developers.google.com/search/docs/appearance/structured-data/search-gallery
- Google Search Central, FAQ rich result descontinuado (a partir de 7/mai/2026): https://developers.google.com/search/docs/appearance/structured-data/faqpage
- Google Search Central, noindex e robots (o Google precisa rastrear para ver o noindex): https://developers.google.com/search/docs/crawling-indexing/block-indexing
- Google Search Central, sitemaps: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- Next.js, `robots.ts` e `sitemap.ts` (versão local): `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/robots.md` e `sitemap.md`
- Conteúdo SaaS 2026, material de fornecedores (usar com cautela, não é fonte oficial): https://www.winstondigitalmarketing.com/playbooks/seo-for-saas-companies/ e https://www.ranktracker.com/blog/ai-overviews-b2b-saas-platforms

Nota de método: a busca na web não retornou dados confiáveis sobre volume de páginas por integração ou por segmento no mercado brasileiro. A recomendação do item 13 vem de práticas gerais (comparativos, páginas programáticas por integração) e deve ser validada com os dados do Search Console depois da migração. Os itens 14 e 7 de DNS dependem de conferir no painel da Vercel e do Google no dia.
