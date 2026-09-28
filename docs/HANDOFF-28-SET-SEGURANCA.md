# Handoff 28/set/2026: segurança, rodada de pentest e o que vem depois

## A tarefa de quem pega isto

1. **Pesquisar** o que as maiores referências de segurança recomendam para um
   SaaS como este (multi-tenant, WhatsApp/Instagram, IA paga, dado pessoal de
   cliente do cliente, LGPD). Fontes primárias, citadas com link.
2. **Revisar de novo** o sistema contra essa pesquisa: o que já cumprimos, o
   que falta, o que não se aplica.
3. **Planejar melhorias só se fizer sentido.** Entregar um plano priorizado em
   `docs/PLANO-SEGURANCA-<data>.md`, com custo, ganho e gatilho de cada item.
   **Não implementar** sem o Gabriel aprovar o plano.

Critério de "faz sentido": o sistema tem um cliente pagante (MGM Pilates) e
é pequeno. Recomendação que exige equipe de segurança, SOC 24h ou orçamento
de empresa grande entra como "não agora", com o gatilho que a tornaria
necessária. Não encha o plano de item de checklist sem ataque concreto por trás.

## Onde pesquisar (ponto de partida, não teto)

- **OWASP:** ASVS (o nível 2 é o alvo realista), Top 10, API Security Top 10,
  Cheat Sheet Series (Multi-tenancy, Session Management, OAuth, Logging).
- **Governo:** NIST SP 800-218 (SSDF), NIST SP 800-63B (senha e MFA), CISA
  Secure by Design, e ANPD (guia de segurança para agentes de pequeno porte,
  LGPD art. 46 a 49: incidente e comunicação).
- **Nuvem e SaaS:** Cloud Security Alliance (CCM, SaaS Security Capability
  Framework).
- **Empresas:** relatórios e guias de Google (Mandiant/M-Trends), Microsoft
  (Digital Defense Report), CrowdStrike (Global Threat Report), Cloudflare,
  Verizon DBIR. Procure o que eles dizem sobre **roubo de credencial e de
  sessão, abuso de OAuth, supply chain de npm, e abuso de IA/LLM** (prompt
  injection, custo), que são os vetores deste sistema.
- **Da nossa pilha:** docs de segurança de Supabase (RLS, service role, backup),
  Vercel (WAF, Firewall, Attack Challenge Mode), Better Auth (rate limit, 2FA),
  Next.js (Server Actions e CSRF), Meta Platform Terms (dado de usuário do
  WhatsApp/Instagram) e OWASP Top 10 for LLM Applications.

## O que já foi feito hoje (tudo no `main`, ver `git log`)

Rodada 1, auditoria sem agentes funcionando: `0520dc0` a `99113b4`.
Rodada 2, 5 agentes atacantes read-only, cada achado conferido no código antes
de corrigir: `ce12030` a `3e11adb`.

| Furo | Commit |
|---|---|
| Next 16.3.0 com RCE sem login (GHSA-2xp9) | `0520dc0` |
| `/api/auth/*` expunha o Better Auth inteiro: força bruta sem teto, cadastro e `organization/*` por fora das regras. Rota fechada (404), limite de login por conta | `99333a4` |
| `/api/simular` rodava IA da 4YU com cookie forjado | `c032476` |
| OAuth `state` ao portador: canal da vítima caía na conta do atacante. Amarrado a cookie | `1e937ba` |
| Trocar senha não derrubava outras sessões | `ce12030` |
| Cadastro enumerava e-mails; log do Instagram gravava texto de DM | `5fd260f` |
| Transmissão saía em dobro com gatilhos concorrentes | `a954d3d` |
| Transmissão aceitava contato de outra conta; duplo clique criava 2 campanhas | `068984b` |
| Sem teto por conta em importação e transcrição | `795867f` |
| Importar leads de página de outra conta; desligar aviso de outro usuário | `3e11adb` |

Verificado em produção depois do deploy da rodada 1: `/api/auth/*` 404,
simulador com cookie forjado 401. A rodada 2 foi só typecheck e testes
unitários dos arquivos tocados.

## Conferido e limpo (não refazer sem motivo)

Histórico do git sem segredo; `npm audit` 0; SQL sem interpolação; funções
`security definer` com `search_path` e sem EXECUTE público; RLS em toda tabela
desde a 0041; views com `security_invoker`; senha em scrypt, nunca logada;
upload com lista fechada de tipo no bucket; SSRF com IP fixado na conexão
(`src/server/efeitos/http.ts`); CORS do `/api/site` por host exato;
webhooks com HMAC em tempo constante sobre o corpo cru; CSV sem injeção de
fórmula; todas as 276 Server Actions conferem acesso; IDOR varrido em todos os
40 arquivos de ação.

## O que ficou aberto (decisão do Gabriel, não de código)

1. **Teto de IA por conta.** Hoje só existe limite por contato por dia,
   desligado por padrão (`clients.ia_limite_contato_dia`). Falta o número por
   plano. Maior exposição de custo que sobrou.
2. **MFA**, pelo menos para admin da plataforma (pode entrar como qualquer
   cliente, `acaoEntrarComo`).
3. **Confirmação de e-mail** no cadastro, e não há "esqueci a senha".
4. **Banco compartilhado com a Verandi** sem backup (plano grátis). Um
   vazamento da `service_role` de um produto alcança o outro. Gabriel está
   avaliando Supabase Pro; a alternativa grátis é um usuário de Postgres por
   produto, com grant só no próprio schema.
5. Menores: `/api/simular` devolve `issues` do zod (só logado); limite diário
   da transmissão (`limiteDiario`) vem da tela; um segredo só
   (`BETTER_AUTH_SECRET`) assina sessão, OAuth e link de produto, sem chave
   derivada por finalidade; `PAINEL_SEGREDO` ainda é fallback em
   `src/server/instagram/estado.ts`.
6. **Nunca houve teste ao vivo de invasão.** As duas rodadas foram leitura de
   código. Um pentest dinâmico (contra ambiente local ou de teste, nunca contra
   produção com dado de cliente) é candidato natural do plano.

## Regras que valem para quem continuar

- Ler `docs/BANCO-COMPARTILHADO.md` antes de qualquer coisa que toque banco.
  Nada em produção sem autorização explícita. Nunca `supabase db push`.
- O repo é **público**: comentário e doc descrevem o ataque, nunca segredo, IP
  ou dado de cliente. Telefone com DDD 44 é teste do Gabriel.
- Achado de agente só vira conserto depois de conferido no código. As duas
  rodadas tiveram falso positivo (ex.: `papelNaConta` existe duas vezes, com
  ordem de argumento oposta, e todas as chamadas estão certas).
- Sem travessão (o traço longo) em arquivo nenhum. Gabriel é designer, não dev: plano com
  decisão tomada e explicação curta, não lista de opções.
- Validar com `npx tsc --noEmit` e os testes dos arquivos tocados, não a suíte
  inteira. Commit por correção; um push ao fim da frente (push no `main` publica
  na Vercel).
- Auditoria anterior, de 06/set: `docs/SEGURANCA.md` (OWASP Top 10 com
  evidência). O backlog dela (S1 a S13) foi parcialmente resolvido hoje: S1 em
  parte (`795867f`), S10 e S13 em parte (`99333a4`, `5fd260f`).
