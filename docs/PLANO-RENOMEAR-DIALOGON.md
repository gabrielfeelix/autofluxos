# Renomear AutoFluxos para Dialogon

Decidido pelo Gabriel em 30/out/2026; `dialogon.com.br` comprado no mesmo dia
(ativa à noite). Por que o nome passou: `docs/NAMING.md`, "Rodada de 30/out/2026".

## Decisões de partida (o Gabriel pode vetar)

- Grafia: **Dialogon** (só o D maiúsculo).
- Site em `dialogon.com.br`; sistema em `app.dialogon.com.br`.
  `autofluxos.4yu.com.br` vira redirecionamento permanente, não some.

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
