# Plano de segurança, 28/set/2026

Escrito depois das duas rodadas de auditoria do dia
(`docs/HANDOFF-28-SET-SEGURANCA.md`, commits `0520dc0` a `3e11adb`). Aqui
entra só o que a pesquisa acrescentou e o que ainda falta. **Nada foi
implementado e nada foi mexido em produção.** Espera aprovação.

## Resumo em cinco linhas

1. O código está bem acima da média para o porte. O que sobra de risco real
   está **fora do código**: contas humanas (GitHub, Vercel, Supabase, Meta),
   backup inexistente, e custo de IA sem teto por conta.
2. As fontes concordam no vetor principal: **credencial e sessão roubadas**
   (Verizon: 55% das violações; Mandiant: 2º vetor de entrada). Para nós, a
   conta mais valiosa é a do admin da plataforma, que entra em qualquer cliente.
3. O gatilho "separar/proteger o banco quando houver cliente pagante"
   (`BANCO-COMPARTILHADO.md`, seção final) **já disparou**: a MGM paga e não
   há backup.
4. Oito itens para agora, somando cerca de 3 dias de trabalho e US$ 45/mês.
5. O resto (CSP completa, SSO, SIEM, pentest de terceiro, certificação) fica
   para depois, cada um com o gatilho que o torna necessário.

---

## 1. O que as referências dizem, e o que vale para nós

| Tema | O que dizem | Fonte |
|---|---|---|
| Credencial roubada | 55% das violações usam credencial roubada; envolvimento de terceiros dobrou (15% para 30%) | [Verizon DBIR 2025](https://www.verizon.com/business/resources/reports/2025-dbir-data-breach-investigations-report.pdf) |
| Credencial roubada | 2º vetor de entrada mais comum (16%), atrás de exploração de falha (33%) | [Mandiant M-Trends 2025](https://cloud.google.com/blog/topics/threat-intelligence/m-trends-2025) |
| Ataque sem malware | 79% das detecções usaram credencial válida, não vírus | [CrowdStrike GTR 2025](https://www.crowdstrike.com/en-us/global-threat-report/) |
| Roubo de sessão | Infostealer rouba o cookie de sessão já autenticado e pula o MFA; chaves de IA roubadas viram consumo pago por terceiro ("LLMjacking") | [Cloudflare Threat Report 2026](https://blog.cloudflare.com/2026-threat-report/) |
| Phishing com IA | Clique 4,5x maior que phishing comum | [Microsoft MDDR 2025](https://www.microsoft.com/en-us/corporate-responsibility/topics/cybersecurity/reports/microsoft-digital-defense-report-2025/) |
| Token OAuth de terceiro | Drift/Salesloft: um fornecedor com tokens de muitos clientes virou porta para todos. Lição: escopo mínimo e log que o atacante não apaga | [Google GTIG](https://cloud.google.com/blog/topics/threat-intelligence/data-theft-salesforce-instances-via-salesloft-drift) |
| Pacote npm | chalk/debug e Shai-Hulud (2025): script de instalação rouba credencial da máquina de build | [CISA](https://www.cisa.gov/news-events/alerts/2025/09/23/widespread-supply-chain-compromise-impacting-npm-ecosystem) |
| Next.js | RCE em React Server Components, CVSS 10, explorado em massa | [Next.js advisory](https://nextjs.org/blog/CVE-2025-66478) |
| IA | Injeção de prompt, agência excessiva e consumo sem limite (LLM01, LLM06, LLM10) | [OWASP LLM Top 10 2025](https://genai.owasp.org/llm-top-10/) |
| API | Consumo sem limite inclui custo por chamada paga | [OWASP API4:2023](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/) |
| Multi-tenant | Conferir dono em todo caminho de acesso; logar o tenant | [OWASP Multi-Tenant Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html) |
| Senha e MFA | Sem regra de composição, checar senha vazada, preferir MFA resistente a phishing | [NIST SP 800-63B rev 4](https://pages.nist.gov/800-63-4/sp800-63b.html) |
| Recuperar senha | Resposta igual para conta que existe e que não existe; token de uso único e curto | [OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html) |
| Desenvolvimento | Rastrear dependência, revisar código, proteger segredo no build | [NIST SSDF SP 800-218](https://csrc.nist.gov/Projects/SSDF) |
| Fabricante | MFA, sem senha padrão, eliminar classes de falha | [CISA Secure by Design](https://www.cisa.gov/securebydesign/pledge) |
| LGPD | Segurança desde a concepção (art. 46); comunicar incidente com risco relevante (art. 48) | [Lei 13.709](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm) |
| ANPD | Incidente: 3 dias úteis; registro de todo incidente por 5 anos, inclusive os não comunicados | [Res. CD/ANPD 15/2024](https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-aprova-o-regulamento-de-comunicacao-de-incidente-de-seguranca) |
| ANPD | Pequeno porte: sem encarregado obrigatório, prazos em dobro, política de segurança simplificada. **Não vale para tratamento de alto risco** | [Res. CD/ANPD 2/2022](https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-2-de-27-de-janeiro-de-2022) |
| Meta | Programa de segurança proporcional; avisar a Meta de incidente com dado da plataforma; recertificação anual (Data Use Checkup) | [Meta Platform Terms](https://developers.facebook.com/terms/dfc_platform_terms/), [Data Security](https://developers.facebook.com/docs/resp-plat-initiatives/individual-processes/data-protection-assessment/data-security) |
| Supabase | **Plano grátis não tem backup.** Pro tem 7 dias diários; MFA obrigatório na organização só no Pro | [Backups](https://supabase.com/docs/guides/platform/backups), [Going into prod](https://supabase.com/docs/guides/deployment/going-into-prod) |
| Supabase | Chaves novas (secret) permitem uma chave por componente e rotação independente; `anon`/`service_role` saem até o fim de 2026 | [Novas chaves](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys) |
| Vercel | Variável "sensitive" não pode ser lida depois de salva; Firewall com regras próprias e rate limit (3 regras no Hobby) | [Sensitive env](https://vercel.com/docs/environment-variables/sensitive-environment-variables), [WAF](https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules) |
| Better Auth | Plugin `twoFactor`; "sessão fresca" para ação sensível; reset de senha com token de 1h | [2FA](https://better-auth.com/docs/plugins/2fa), [Sessão](https://better-auth.com/docs/concepts/session-management) |
| Next.js | Server Action é endpoint público; checagem de Origin contra CSRF já vem pronta | [Server Actions](https://nextjs.org/docs/app/guides/server-actions) |
| GitHub | Push protection de segredo grátis em repo público; rulesets no plano Free; Dependabot com espera configurável | [Secret scanning](https://docs.github.com/en/code-security/secret-scanning), [Rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets), [Dependabot](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependabot-version-updates) |

Três URLs não foram abertas linha a linha pela pesquisa (texto integral da
Res. 15/2024, art. 49 da LGPD, página própria do Attack Challenge Mode). Os
links acima são os canônicos; conferir antes de citar para cliente.

---

## 2. Revisão do sistema contra a pesquisa

### Já cumprimos (conferido hoje, não refazer)

| Recomendação | Onde está |
|---|---|
| Isolamento por conta em todo acesso (BOLA / multi-tenant) | 276 Server Actions e 40 arquivos varridos, handoff de hoje |
| Estado do OAuth amarrado ao navegador | `1e937ba` |
| Senha: mínimo 10, sem regra de composição, scrypt | [auth.ts](../src/server/auth.ts) |
| Limite de tentativa de login por IP e por conta | `99333a4`, [acoes-conta.ts](../src/server/acoes-conta.ts) |
| Trocar senha derruba outras sessões | `ce12030` |
| Cookie `__Secure-`, `SameSite=Lax`, assinado | padrão do Better Auth em HTTPS |
| CSRF em Server Action | padrão do Next (Origin contra Host) |
| Next corrigido do RCE | `0520dc0`, hoje em `^16.3.6` |
| IA com agência contida: campo sensível injetado pelo servidor, id só se veio de resultado anterior, recusa vira atendimento humano | [ferramentas-do-pedido.ts](../src/server/ia/ferramentas-do-pedido.ts) |
| IA com teto de saída (1.200 tokens) e histórico curto (6 turnos) | [prompt.ts](../src/server/ia/prompt.ts), [gemini.ts](../src/server/ia/gemini.ts) |
| SSRF fechado, inclusive rebinding | [http.ts](../src/server/efeitos/http.ts) |
| Segredo de cliente no Vault, nunca em linha de tabela | `SEGURANCA.md` A02 |
| Auditoria append-only no banco, com `publicou_fluxo`, `apagou_contato`, `entrou_como`, `espiou_caixa` (S11 resolvido) | [auditoria.ts](../src/server/repos/auditoria.ts) |
| Preview da Vercel protegido por login; fork não publica | projeto `autofluxos`: `ssoProtection` e `gitForkProtection` ligados |
| Poucas dependências de produção (13) e `npm audit` 0 | [package.json](../package.json) |
| Segredo fora do CI de repo público | [ci.yml](../.github/workflows/ci.yml) |
| LGPD: apagar contato de verdade, retenção de 12 meses, páginas de privacidade, termos e exclusão de dados, papel de operador declarado | `SEGURANCA.md` LGPD, [privacidade](../src/app/privacidade/page.tsx) |

### Falta (vira o plano abaixo)

1. **Sem teto de IA por conta.** Qualquer pessoa pode mandar mensagem para o
   WhatsApp de um cliente e cada mensagem gasta IA da 4YU. O limite por
   contato existe, mas vem desligado (`clients.ia_limite_contato_dia` nulo), e
   o chat do site limita por IP, que o atacante troca à vontade. É o LLM10 e
   o API4 ao pé da letra.
2. **Admin da plataforma sem MFA**, e ele entra em qualquer conta. É a conta que
   um infostealer mais gostaria de pegar.
3. **Contas humanas dos fornecedores** (GitHub, Vercel, Supabase, Meta
   Business, Google Cloud, Hostinger): não tenho como ver se têm MFA. Quem
   entra no GitHub publica código em produção pelo push no `main`.
4. **Banco sem backup** com cliente pagante dentro, e com a Verandi, que
   também atende a MGM.
5. **O login fala com o banco como `postgres`** (`DATABASE_URL`, usado em
   [auth.ts:53](../src/server/auth.ts#L53)). É o dono de tudo, inclusive do
   schema da Verandi. Vazou essa variável, vazaram os dois produtos. Conferir
   o usuário da variável de produção; o local é `postgres`.
6. **Segredos legíveis no painel da Vercel.** `BETTER_AUTH_SECRET`,
   `DATABASE_URL`, `GEMINI_API_KEY` e `CRON_SECRET` estão como "encrypted", não
   "sensitive": quem abre o painel lê o valor. `PAINEL_SEGREDO` e
   `PAINEL_SENHA` continuam lá sem uso (S9).
7. **Sem Dependabot, sem regra de proteção no `main`** e sem espera antes de
   adotar versão nova de pacote. O Shai-Hulud se espalhou justamente em quem
   instalava a versão do dia.
8. **Sem plano de incidente.** A ANPD dá 3 dias úteis, a Meta quer aviso
   imediato, a MGM (controladora) precisa saber para comunicar os alunos
   dela. Hoje ninguém sabe a ordem, e não existe registro de login para
   investigar (S12: nem sucesso, nem falha, e `ip`/`agente` gravam vazio).
9. **Chave do Gemini: conferir se é paga.** Nos termos da API do Google, o
   nível gratuito pode usar o conteúdo enviado para melhorar os produtos
   deles ([termos](https://ai.google.dev/gemini-api/terms)). Mensagem de
   aluno da MGM não pode ir para treino de terceiro.
10. **Vercel no plano Hobby**, que os termos da Vercel restringem a uso não
    comercial. Não é furo de segurança, é risco de o projeto ser suspenso,
    e o Pro traz as regras de firewall que o item 1 pode precisar.

### Não se aplica, ou já está coberto por outro caminho

- **Injeção de SQL/PostgREST, XSS por HTML cru:** fechados e com teste
  (`SEGURANCA.md` A03).
- **Senha padrão (CISA):** não existe; cada conta cria a própria.
- **Bypass de middleware do Next (CVE-2025-29927):** a Vercel não foi afetada,
  e o middleware aqui não é a fronteira de autorização.
- **Publicação de pacote npm / trusted publishing:** não publicamos pacote.
- **SBOM, SSDF completo, CSA CCM/SSCF, certificação:** feitos para fornecedor
  vendendo a empresa grande. Ver "Não agora".
- **Encarregado (DPO) formal:** dispensado para pequeno porte, **enquanto**
  valer a condição do item P8.

---

## 3. O plano

Custo em horas de trabalho de agente, mais o tempo do Gabriel quando é painel.
"Gatilho" diz quando o item deixa de ser opcional; nos de "agora" o gatilho
já disparou.

### Agora

| # | O quê | Custo | Ganho | Gatilho |
|---|---|---|---|---|
| **P1** | **MFA nas contas humanas**: GitHub, Vercel, Supabase, Meta Business, Google Cloud, Hostinger, e-mail do Gabriel. App autenticador ou chave física, nunca SMS. Checklist com link de cada painel | 1h do Gabriel, zero código | Fecha o vetor nº 1 dos relatórios. Quem tem o GitHub publica em produção | Já: é onde começam 55% das violações |
| **P2** | **Teto de IA por conta**: número por plano, contado por dia; ao passar, o bot passa para humano e avisa em `/admin/alertas`. Limite por contato ligado por padrão (sugestão: 40 respostas/dia). Chat do site ganha teto por conta além do por IP | 1 dia | Transforma "conta sem fundo" em prejuízo máximo conhecido | Já: maior exposição de custo que sobrou (handoff, item 1) |
| **P3** | **MFA (TOTP) para admin da plataforma**, com plugin `twoFactor` do Better Auth; `acaoEntrarComo` e `espiar` pedem sessão fresca (login nas últimas 12h). Sessão de admin cai de 7 dias para 1 | 1 dia | Senha vazada do admin deixa de abrir as contas de todos os clientes. A sessão curta reduz o estrago de cookie roubado, que o MFA sozinho não impede | Já: admin alcança todo cliente |
| **P4** | **Backup**: Supabase Pro (US$ 25/mês), backups diários de 7 dias, e liga "MFA obrigatório" na organização. Cobre AutoFluxos e Verandi de uma vez | 30 min do Gabriel | Hoje um `delete` errado ou um ataque apaga dois produtos sem volta | Já: `BANCO-COMPARTILHADO.md` põe o gatilho em "cliente pagante" |
| **P5** | **Usuário de Postgres próprio para o login**: papel `autofluxos_login` com acesso só às tabelas `af_*` que o Better Auth usa; `DATABASE_URL` troca para ele | 4h + migration (pede autorização) | Vazamento da variável deixa de alcançar a Verandi e o resto do banco | Já: a alternativa grátis que o handoff cita, e barata |
| **P6** | **Higiene de segredo e de repositório**: marcar como "sensitive" os 4 segredos acima (recriando o valor, então é rotação); apagar `PAINEL_SEGREDO` do código e da Vercel, e `PAINEL_SENHA`; ruleset no `main` (sem force push, sem apagar); Dependabot de segurança ligado, com espera de 3 dias para versão nova; conferir que push protection está ativo | 3h + 30 min do Gabriel | Segredo não fica legível para quem entra no painel; pacote comprometido do dia não entra sozinho | Já: custo quase zero |
| **P7** | **Plano de incidente de uma página** (`docs/INCIDENTE.md`): quem revoga o quê e em que ordem (os links já estão no `CLAUDE.md` da pasta), prazos (ANPD 3 dias úteis, Meta assim que souber, MGM no mesmo dia), modelo de aviso, e onde registrar (a ANPD pede guardar 5 anos). Junto, **registrar login e falha de login com IP e navegador** (S12) | 2h doc + 4h código | Sem isso, num incidente o primeiro dia vai em descobrir o que fazer e não há rastro para investigar | Já: obrigação legal com cliente pagante |
| **P8** | **Conferências rápidas**: chave do Gemini com faturamento ativo (senão, dado de aluno pode ir para treino do Google); cabeçalho HSTS em produção (a Vercel costuma emitir; se não, uma linha no `next.config.ts`); cláusula nos termos dizendo que a 4YU avisa o cliente de incidente em até 24h | 1h | Fecha três lacunas de conformidade de uma vez | Já |

**Somando:** cerca de 3 dias de agente, 2h do Gabriel em painel, US$ 25/mês
(Supabase Pro). O Vercel Pro (US$ 20/mês) está no item P9 abaixo: é
recomendado já, mas por termos de uso, não por furo.

### Próximo (gatilho próximo, não disparado)

| # | O quê | Custo | Gatilho |
|---|---|---|---|
| **P9** | Vercel Pro; e, se o P2 não bastar, regra de firewall com rate limit no `/api/site` e nos webhooks | US$ 20/mês + 1h | Segundo cliente pagante, ou primeiro pico de abuso visto em `/admin/alertas` |
| **P10** | Teste de invasão dinâmico, contra o ambiente local com dado falso: troca de conta, sessão, upload, webhooks, injeção de prompt no bot. Nunca contra produção | 1 dia | Depois do P2 e P3, e antes do terceiro cliente |
| **P11** | "Esqueci a senha" e confirmação de e-mail, pelo Brevo em `autofluxos.mail.4yu.com.br` (domínio já previsto no contrato da pasta). Não usa o SMTP do Supabase, então não afeta a Verandi | 1 dia | Cadastro aberto ao público, ou primeiro cliente que não fala direto com o Gabriel |
| **P12** | MFA opcional para todo usuário, e obrigatório para dono de conta que pedir | 4h (reusa o P3) | Cliente com equipe maior que 3 pessoas, ou pedido de cliente |
| **P13** | Chave derivada por finalidade (sessão, OAuth, link de produto) em vez de um só `BETTER_AUTH_SECRET` | 4h | Próxima rotação de segredo |
| **P14** | Teto de corpo nos webhooks WhatsApp/Instagram (S2); `limiteDiario` da transmissão vir do plano, não da tela; `/api/simular` sem `issues` do zod | 3h | Próxima vez que alguém tocar esses arquivos |
| **P15** | Separar AutoFluxos da Verandi (projetos Supabase diferentes, ou pelo menos migrar o AutoFluxos para schema próprio) | 3 a 5 dias | Qualquer cliente pedir isolamento por contrato, ou um produto afetar o outro em cota ou incidente |
| **P16** | Reavaliar se a 4YU ainda é "pequeno porte" na ANPD. Hoje usa IA (tecnologia emergente, critério específico de alto risco) e o pilates pode receber dado de saúde em conversa (dado sensível). Falta o critério geral, que é escala | 2h de leitura | Base passar de alguns milhares de contatos, ou entrar cliente de saúde |

### Não agora

| O quê | Por que não | Gatilho que tornaria necessário |
|---|---|---|
| CSP completa com nonce (S7) | Obriga renderização dinâmica e pode quebrar a hidratação; hoje não há HTML de usuário na tela | Primeiro achado de XSS, ou conteúdo rico vindo de lead |
| SSO/SAML para clientes | Vercel/Better Auth cobram ou pedem integração por cliente | Cliente empresa pedir em contrato |
| Chave física (FIDO2) para todos | NIST prefere, mas o TOTP do P3 cobre o porte atual | Primeiro phishing dirigido à equipe, ou equipe da 4YU com mais de 2 admins |
| SIEM, SOC 24h, detecção de intrusão | Exige gente olhando; o `/admin/alertas` cobre o volume de hoje | Receita que pague uma pessoa de segurança, ou exigência contratual |
| Pentest por empresa externa | Caro para 1 cliente; o P10 cobre o essencial | Questionário de segurança de cliente grande, ou antes de captar investimento |
| SBOM, SSDF completo, CSA CCM/SSCF, ISO 27001 | Processo de empresa grande | Cliente enterprise pedir evidência formal |
| Bug bounty | Atrai volume que ninguém triaria | Equipe de engenharia com tempo para triagem |
| Encarregado (DPO) formal | Dispensado para pequeno porte | O P16 concluir que a 4YU saiu do pequeno porte |
| Allow-list de destino no bloco `http` | A defesa de SSRF atual já recusa rede interna | Cliente pedir, ou aparecer abuso do bloco para bater em terceiro |

---

## 4. Ordem de execução, se aprovado

1. **Gabriel, em painel, no mesmo dia:** P1 e P4 (e P9 se aprovar o Vercel
   Pro). Um roteiro com o link de cada tela vai junto.
2. **Agente, uma frente só:** P6, P8, P2, P3, P7, nessa ordem. Commit por
   item, um push no fim.
3. **P5 por último**, porque pede migration em produção e autorização
   separada, com ensaio em transação e conferência nos dois produtos, como
   manda `BANCO-COMPARTILHADO.md`.

O que precisa de decisão sua, além de aprovar: **o número do teto de IA por
plano** (P2). Proposta, se não quiser pensar nisso agora: Essencial 1.500
respostas de IA por mês, os outros planos em proporção ao preço, e o
excedente segue a regra de preço que já existe em `planos.preco_excedente`.

---

## 5. Execução de 28/set (aprovado pelo Gabriel no mesmo dia)

Um push só, `6618b1d..138a020`. Build, tsc e os testes vizinhos (399) passam.

| Item | Estado | Commit |
|---|---|---|
| P2 teto de IA | **feito**: 40 respostas por contato em 24 h por padrão; teto por conta em 30 dias (5 por real de mensalidade, piso 1.500), com alerta diário; vitrine com 200 por dia por link | `7c2324d` |
| P3 admin | **em parte**: sessão de admin morre 24 h após o login; "entrar como" pede login das últimas 12 h. **TOTP não feito** (ver pendências) | `ec437cb` |
| Senha vazada (NIST) | **feito**, fora do plano original: plugin `haveIBeenPwned` | `d225ce4` |
| P5 papel do login | **migration escrita e ensaiada no local, não aplicada** | `138a020` |
| P6 segredos e repositório | **feito no código e no GitHub**: estado OAuth com chave derivada (HKDF, também o P13), `PAINEL_SEGREDO` fora do código, Dependabot com cooldown, alertas e correções do Dependabot ligados, ruleset `main protegido` (sem force push, sem apagar). Painel da Vercel não mexido | `294e1fd` |
| P7 incidente | **feito**: `docs/INCIDENTE.md`; login e senha errada na auditoria; IP e navegador em toda linha | `46bf1fc` |
| P8 conferências | **em parte**: HSTS e cláusula de 24 h nos Termos feitos. Gemini não mexido, por decisão do Gabriel | `bb3589b` |
| P14 miúdos | **feito**: teto de 1 MB nos webhooks da Meta, token de verificação em tempo constante, simulador sem `issues`, teto de 24 h da transmissão só nos degraus da Meta | `133dcc4`, `d02afc0` |

### Rodada 2 do mesmo dia (autorizada pelo Gabriel)

- **0111 aplicada** e o `DATABASE_URL` da Vercel trocado para o papel
  `autofluxos_login`, agora como variável "sensitive". Conferido: login,
  sessão e membros funcionam com o papel; `contacts`, auditoria, conexões,
  Vault e Verandi recusados. O valor antigo ficou no cofre para desfazer.
- **TOTP feito** (`f25d12c`) e **0112 aplicada** antes do push. Obrigatório
  para o admin da plataforma, opcional para todos pelo menu "Você". e2e do
  fluxo inteiro passa no banco local.

### Rodada 3 do mesmo dia

- **CI do `main` verde** pela primeira vez desde que as rotas usam
  `RouteContext`: o `typecheck` chama `next typegen` antes do `tsc`, e 12
  erros antigos de lint foram consertados (`b7f5371`).
- **Dependabot:** entraram Vitest 4 (#4, fecha o alerta de path traversal do
  `@vitest/mocker`), `actions/checkout` 7, `actions/setup-node` 7 e o grupo
  "menores" (#1 a #3, inclui `better-auth` 1.7.5). Fechados com motivo:
  TypeScript 7 (#6, typescript-eslint recusa), ESLint 10 e `@eslint/js` 10
  (#5, #7, eslint-plugin-react quebra), Vitest 5 (#8). As três majors estão no
  `ignore` do `dependabot.yml` (`3cabb32`). Zod 4 (#9): o único erro de tipo
  foi consertado (`be445a2`), falta o CI dele depois do rebase.
- **P11 feito no código** (`d0d8d8f`): "Esqueci a senha" e confirmação de
  e-mail pelo Brevo, remetente `nao-responda@autofluxos.mail.4yu.com.br`.
  Domínio e remetente criados no Brevo; `BREVO_API_KEY` (sensitive) e
  `EMAIL_REMETENTE` na Vercel. Confirmação cobrada só de conta criada depois
  de 28/set 21h UTC, com 3 dias de carência.
- **P10 em parte** (`docs/PENTEST-2026-09-28.md`): SSRF por IPv6 achado e
  consertado (`05af0ce`); troca de conta conferida no código. O ataque ao
  vivo com sessão de outra conta ficou pendente.
- **Miúdos:** helper do e2e com os rótulos novos (`c8c41f8`);
  `VAPID_PRIVATE_KEY` dividida em "sensitive" (produção e preview) e
  "encrypted" (desenvolvimento), mesmo valor.

### Pendências

**Do Gabriel, em painel (cerca de 1 h):**

1. ~~**MFA** nas contas humanas~~: **feito em 28/set** (GitHub, Hostinger, Meta, Vercel, Supabase e Google com app autenticador). Supabase não tem código de recuperação: manter o backup do Google Authenticator ligado.
2. **Supabase Pro** (US$ 25/mês, backup diário de 7 dias; o Gabriel decidiu para **novembro/2026**): [billing da organização](https://supabase.com/dashboard/org/_/billing). Depois, ligar "Require MFA" na organização.
3. **Vercel**: apagar `PAINEL_SEGREDO` e `PAINEL_SENHA`; recriar como **Sensitive**, **com o mesmo valor**, `BETTER_AUTH_SECRET`, `GEMINI_API_KEY` e `CRON_SECRET` (o `DATABASE_URL` já foi). **Não gerar `BETTER_AUTH_SECRET` novo**: ele cifra os segredos do 2FA, e trocar derruba todos os logins e desliga o 2FA de todo mundo. [Variáveis do projeto](https://vercel.com/4-yu/autofluxos/settings/environment-variables). Opcional: Vercel Pro (US$ 20/mês), termos do Hobby restringem uso comercial.
4. **Contradição a resolver:** os Termos dizem "não treinamos modelos de IA com eles", e o nível gratuito da API do Gemini permite ao Google usar o conteúdo ([termos](https://ai.google.dev/gemini-api/terms)). Ou a chave ganha faturamento (o uso segue gratuito dentro da cota, o que muda é o termo), ou o texto dos Termos muda. As IAs gratuitas ficam ligadas até lá, por decisão do Gabriel.

**Precisam de autorização explícita para produção:**

5. ~~0111~~ e ~~TOTP~~: feitos na rodada 2.

6. **DNS do e-mail** (sem ele o Brevo não autentica e a redefinição de senha cai no spam ou não sai): 4 registros na zona `4yu.com.br` da [Hostinger](https://hpanel.hostinger.com/domain/4yu.com.br/dns), TTL 300: TXT `autofluxos.mail` = `brevo-code:956bb6be0a30b14fe90af736230a867c`; CNAME `brevo1._domainkey.autofluxos.mail` = `b1.autofluxos-mail-4yu-com-br.dkim.brevo.com`; CNAME `brevo2._domainkey.autofluxos.mail` = `b2.autofluxos-mail-4yu-com-br.dkim.brevo.com`; TXT `_dmarc.autofluxos.mail` = `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com`. Depois, autenticar no [Brevo](https://app.brevo.com/senders/domain/list).

**Próximos do plano, ainda não feitos:** resto do P10 (ataque ao vivo com sessão de outra conta, sessão, 2FA, limites, upload, webhooks, injeção de prompt; roteiro no handoff da rodada 3), P12 (MFA para todo usuário, reusa o P3), P15 e P16.
