# Renomear AutoFluxos para Dialogon

Decidido pelo Gabriel em 30/out/2026; `dialogon.com.br` comprado no mesmo dia
(ativa à noite). Por que o nome passou: `docs/NAMING.md`, "Rodada de 30/out/2026".

## Decisões de partida (o Gabriel pode vetar)

- Grafia: **Dialogon** (só o D maiúsculo).
- Site e sistema juntos em `dialogon.com.br` (o `app.` exigiria dividir o
  app; decidido em 30/out). `autofluxos.4yu.com.br` redireciona as páginas com
  308 e mantém `/api` respondendo (webhooks da Meta não seguem redirect).

## Estado em 30/out/2026, fim do dia

Feito: texto do cliente (`e52840ea`); domínio na Vercel e DNS na Hostinger
(`@` A 216.198.79.1 e 64.29.17.1, `www` CNAME da Vercel); URLs fixas e
redirecionamento do domínio antigo (`6e12aab3`); `contato@dialogon.com.br`
criado na Hostinger e no texto do cliente (`c30e412f`); Meta: URLs de
privacidade, termos, exclusão, e-mail, URL do site, URIs de OAuth do WhatsApp
e de anúncios, SDK JS e redirect do login do Instagram com o domínio novo
(validador da Meta confirmou). As URIs antigas ficam até meados de
novembro; depois, apagar as de `autofluxos.4yu.com.br` no Login do Facebook
e no Instagram (não os Domínios do aplicativo nem os webhooks).

Também feito em 30/out: Search Console (`sc-domain:dialogon.com.br`, sitemap,
Gabriel proprietário), envio do Brevo em `mail.dialogon.com.br`
(`EMAIL_REMETENTE` na Vercel), chat da home liberado para o domínio novo no
banco (`channels.site_config`), cron `autofluxos-pedidos-da-loja` apontando para
`dialogon.com.br`, Instagram oficial `@usedialogon` (o `@dialogon` tem dono).
Webhooks conferidos: cardápios, gateways de cliente e Telegram sem nenhum
conectado; Asaas da 4YU sem chave em produção. Os webhooks da Meta seguem em
`autofluxos.4yu.com.br/api/webhook/*` de propósito: o token de verificação é
segredo sensível na Vercel e a troca ficou para o Gabriel decidir.

**Webhooks da Meta (30/out, 17h):** o Gabriel trocou as callbacks de WhatsApp,
Instagram e Page para `dialogon.com.br/api/webhook/*` com token de verificação
novo (já na Vercel; o aperto de mão das três rotas respondeu certo). Depois
disso, um "oi" mandado para +55 44 7400-7438 às 17h18 **não chegou** em
`public.messages` (última entrada 16:47). Não é urgente (ninguém entrando em
contato) e ele decidiu não voltar para a URL antiga. Investigar numa sessão com
acesso aos logs de requisição da Vercel: se a Meta entrega e a rota falha
(assinatura, corpo) ou se a callback não salvou / há override por WABA. Rollback
possível: callback antiga com o mesmo token novo.

**Resolvido em 03/nov:** a callback salvou, mas a troca deixou os campos
assinados vazios nos três objetos (`GET /{app_id}/subscriptions` com token de
app mostrava `fields: []`). Sem `messages` a Meta não entregou nada a ninguém de
30/out 16h27 até 03/nov 14h25; o MGM reclamou. Reassinados no painel:
`messages`, `history`, `smb_app_state_sync`, `smb_message_echoes`,
`account_update`, `message_template_status_update`, `template_category_update`.
Teste no número do MGM entrou e o bot respondeu. Pendente: o objeto Page aponta
para `/api/webhook/instagram` sem campos; o certo é `/api/webhook/leadgen` com
`leadgen` (a varredura diária cobre os leads enquanto isso). Ao trocar a URL,
confira os campos de novo.

**Revisão de 03/nov (o que ainda pode quebrar):**
- `enderecoDoPainel()` caía no `VERCEL_URL` em produção (não há
  `BETTER_AUTH_URL` lá): a URL do webhook de entrada na tela e a que a ponte
  registra na Verandi eram do deploy. Agora é `dialogon.com.br` em produção.
  Nenhum cliente tinha registrado uma (só o PCYES/Magento, criado à mão).
- PCYES: o fluxo "Pesquisa pós-compra" (agora v13), o gatilho
  `pedido.processando` e o modelo `pesquisa_pos_compra_v4` apontavam imagem e
  pontos para `autofluxos.4yu.com.br`. Trocados para `dialogon.com.br`; nenhum
  fluxo, gatilho ou modelo de cliente guarda mais o endereço antigo.
- Objeto Page da Meta reapontado para `/api/webhook/leadgen` com `leadgen`
  (POST assinado responde 200). Para isso o `WHATSAPP_VERIFY_TOKEN` foi trocado
  na Vercel e em `.secrets/4yu.env` (`AUTOFLUXOS_WA_VERIFY_TOKEN`); a entrega
  não usa esse token, só o aperto de mão ao salvar uma callback.
- Mercado Pago, PagBank, Stripe e Nuvemshop: nenhum tem chave em produção,
  então nunca foram ligados. Ao criar cada app, cadastrar já com
  `dialogon.com.br`.
- Instagram: o objeto `instagram` não aparece nas assinaturas do app; só o
  canal de teste do Gabriel usa.
- Quem estava logado no endereço antigo precisa entrar de novo em
  `dialogon.com.br` (o cookie é por domínio). Avisar a equipe do MGM.
- O redirecionamento do domínio antigo tem de seguir poupando `/api` e o
  domínio antigo tem de continuar na Vercel: PCYES e a página `leadgen`
  chamam por ele.
- Em meados de novembro, ao apagar as URIs antigas da Meta, reler
  `GET /{app_id}/subscriptions` depois.

Falta: Mercado Pago, PagBank, Stripe e Nuvemshop quando alguém conectar;
Search Console da propriedade `dialogon.com.br` e Mudança de endereço; correções
de `docs/SEO-AUDITORIA.md`; ícone do app na Meta com a logo nova; envio de
e-mail (Brevo) ainda em `autofluxos.mail.4yu.com.br`; webhooks e URLs de API que
clientes cadastraram (PCYES, gateways) ainda no endereço antigo.

## Para continuar (30/out, noite)

- Marca: kit em `assets/marca-dialogon/Dialogon-logos.zip`. Favicon = ícone de
  app; logo horizontal oficial no site (branca no topo azul, colorida quando a
  ilha rola e vira papel), no login, na central de ajuda e na barra do sistema
  (colorida, branca no tema escuro, só símbolo recolhida). Falta print da barra
  do sistema logado.
- Webhooks da Meta no domínio novo sem entrega confirmada (seção acima).
- WhatsApp do +55 44 7400-7438: decidir se o número é só do Dialogon; se for,
  nome de exibição "Dialogon" (revisão da Meta) e reservar o usuário
  `dialogon` (livre em 30/out) pelo app ou WhatsApp Manager.
- Instagram `@usedialogon`: falta o link `https://dialogon.com.br/precos` na bio
  (só pelo celular). Pedir `@dialogon` à Meta depois do registro no INPI.
- INPI: depositar DIALOGON nas classes 9, 42 e 35.
- SEO: GA4 próprio do Dialogon; desfoque do h1 em produto e segmentos; reflow
  forçado e imagens (`docs/SEO-AUDITORIA.md`).

## Inventário (30/out/2026, `grep` sem node_modules, .next, .git)

1.440 ocorrências em 443 arquivos. Dentro de `src/`:

| Pasta | Marca "AutoFluxos" | URL `autofluxos.4yu.com.br` | Identificador técnico |
|---|---|---|---|
| app | 106 | 20 | 9 |
| core | 72 | 31 | 7 |
| components | 53 | 2 | 30 |
| server | 23 | 12 | 21 |
| channels | 9 | 18 | 3 |
| agendas | 6 | 0 | 0 |
| loja / cardapios | 1 | 2 | 1 |

Fora de `src/`: `public/` (6 marca, 6 URL, logos `public/logos/logo-autofluxos*.png`),
`scripts/` (15 marca, 3 URL), 159 migrations, docs históricos.

## Fase 1: texto que o cliente lê (não depende do domínio)

Trocar "AutoFluxos" por "Dialogon" em `src/` e `public/`: títulos, metadata e
OpenGraph, site, telas do sistema, e-mails (`scripts/.../modelos-da-brevo.mts`),
`llms.txt`, mensagens do chat. Conferir com `tsc` e build, print em 1440 e 390.
Logo nova é decisão de design do Gabriel; até lá, texto no lugar da imagem.

## Fase 2: domínio (quando `dialogon.com.br` estiver ativo)

1. Vercel: adicionar `dialogon.com.br` e `app.dialogon.com.br` ao projeto;
   `autofluxos.4yu.com.br` redireciona com 301.
2. Trocar as ~85 URLs fixas em `src/` e `scripts/` pela variável de ambiente
   de URL pública, quando houver; senão pelo domínio novo.
3. Reapontar o que guarda URL fora do código: webhooks e OAuth da Meta
   (WhatsApp, Instagram, Lead Ads), OAuth do Google, URLs de redirecionamento
   do Supabase Auth (global ao projeto: avaliar a Verandi), Brevo.

## Fase 3: fora do código (Gabriel)

Nome do app na Meta (conferir se mexe no App Review antes), remetente do
Brevo e subdomínio de envio (`dialogon.mail...` ou no domínio novo), tela de
consentimento do Google, perfil do WhatsApp, @dialogon, avisar MGM e PCYES.

## Não renomear (invisível ao cliente e quebra coisa)

- Cookie `autofluxos_login`: derruba a sessão de todo mundo.
- Cabeçalhos `autofluxos-assinatura` e `autofluxos-timestamp` dos webhooks de
  saída: quebram a integração dos clientes (PCYES). Se um dia mudar, aceitar os
  dois nomes por um tempo.
- Buckets do Storage (`autofluxos-acervo`, `autofluxos-avatares`,
  `autofluxos-recebidos`): links de arquivo já enviados.
- Variáveis `AUTOFLUXOS_*`, `autofluxos_dados`, projeto Supabase `autofluxos`,
  repositório no GitHub, projeto na Vercel.
- Migrations já aplicadas e docs históricos.
