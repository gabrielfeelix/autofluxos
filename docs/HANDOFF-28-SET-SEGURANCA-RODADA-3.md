# Handoff 28/set/2026: segurança, rodada 3 (pendências técnicas)

Leia antes: `docs/PLANO-SEGURANCA-2026-09-28.md` (o plano aprovado e a seção 5
com o que já foi feito), `docs/BANCO-COMPARTILHADO.md` (obrigatório se tocar
banco) e `docs/INCIDENTE.md`. O `git log` desde `0520dc0` conta o dia inteiro.

## Primeira coisa: conferir o login depois do primeiro deploy

Na rodada 2, `BETTER_AUTH_SECRET`, `GEMINI_API_KEY` e `CRON_SECRET` foram
**recriados na Vercel como "sensitive", com o mesmo valor** (não dá mais para
ler). Nenhum deploy rodou com eles ainda: o **primeiro push desta rodada** é o
que os estreia. Depois dele, confira:

- `curl -I https://autofluxos.4yu.com.br/entrar` responde 200;
- os logs de runtime da Vercel não mostram erro do Better Auth nem
  `[sessao] não deu para ler a sessão` fora do build;
- peça ao Gabriel para entrar no painel e confirmar.

Se o login cair: o valor antigo do `BETTER_AUTH_SECRET` **não** está no cofre
(só o do `DATABASE_URL`, em `AUTOFLUXOS_DATABASE_URL_ANTIGO`). Avise o Gabriel
na hora. **Nunca gere um `BETTER_AUTH_SECRET` novo**: ele cifra os segredos do
2FA (`af_dois_fatores`), e trocar desloga todo mundo e desliga o 2FA de todos.

## As quatro frentes

### 1. PRs do Dependabot (7 abertos)

`gh pr list`. Ligado hoje com cooldown (`.github/dependabot.yml`).

- **Pode entrar depois de CI verde e build local:** `actions/checkout` e
  `actions/setup-node` (PRs 1 e 2) e o grupo "menores" (PR 3, 9 pacotes).
- **Majors, avaliar um a um:** TypeScript 7 (PR 6, compilador novo em Go,
  maior risco), Vitest 4 (PR 4), ESLint 10 e `@eslint/js` 10 (PRs 5 e 7, andam
  juntos). Para cada um: checkout do branch, `npm ci`, `npx tsc --noEmit`,
  `npm run lint`, os testes vizinhos e `npm run build`. Se quebrar e o
  conserto não for pequeno, **feche o PR com um comentário dizendo o porquê**
  e acrescente um `ignore` para aquela major no `dependabot.yml`, para ele
  não reabrir toda semana.
- Merge pelo `gh pr merge --squash`; cada merge no `main` publica na Vercel,
  então junte os que forem entrar e faça em sequência curta.

### 2. Teste de invasão dinâmico (P10), só no ambiente local

**Nunca contra produção.** Banco local em Docker (`npx supabase start`, porta
56432) e `next dev` na 3100, como os e2e (`test/e2e/README.md`). As rodadas 1
e 2 foram leitura de código; esta é a primeira que ataca o sistema rodando.

Roteiro mínimo, cada item com o resultado esperado:

- **Troca de conta (IDOR):** duas contas, A e B. Com a sessão de A, chamar as
  Server Actions e rotas de `/api/` passando ids de B (contato, fluxo, canal,
  transmissão, cartão, arquivo do acervo). Esperado: recusa em todas. As
  Server Actions são POST com o cabeçalho `Next-Action`; dá para capturar o id
  pelo DevTools e repetir com `curl` ou Playwright.
- **Sessão:** cookie forjado, cookie de sessão apagada, sessão de admin com mais
  de 24 h (mexa em `af_sessoes."createdAt"` no banco local), "entrar como"
  com login de mais de 12 h, pular `/entrar/codigo` com o cookie de "falta o
  código".
- **2FA:** força bruta no código (a biblioteca trava depois de erros
  seguidos; o `consumirLimite` também), reuso do mesmo código, código de
  recuperação usado duas vezes.
- **Limites:** estourar o teto de IA da conta e o limite por contato (ver
  `src/server/repos/ia-chamadas.ts`), a vitrine pública, o `/api/site`.
- **Upload:** tipo proibido, arquivo acima do teto, nome com `../`.
- **Webhooks:** corpo acima de 1 MB, assinatura errada, assinatura certa com
  corpo trocado.
- **Injeção de prompt no bot:** mensagens de lead tentando fazer a IA chamar
  ferramenta com id que não veio de resultado, mudar `pessoa_id`, revelar o
  prompt do sistema ou o contexto de outra conta.
- **SSRF:** bloco `http` apontando para `127.0.0.1`, `169.254.169.254`, nome
  que resolve para IP interno, redirect para interno.

Achado vira conserto **só depois de conferido no código** (as rodadas
anteriores tiveram falso positivo). Registre o resultado em
`docs/PENTEST-<data>.md`: o que foi tentado, o que passou, o que foi
consertado e em qual commit. Repositório público: nada de segredo, IP real ou
dado de cliente no documento.

### 3. "Esqueci a senha" e confirmação de e-mail (P11)

Hoje não existe recuperação; o Gabriel redefine à mão no admin.

- **E-mail sai pelo Brevo, direto pela API**, e **não** pelo SMTP do Supabase
  (que é global e afetaria a Verandi). Credenciais `BREVO_*` em
  `4yu-apps/.secrets/4yu.env`.
- **Remetente em `autofluxos.mail.4yu.com.br`**, pela regra dos namespaces no
  `CLAUDE.md` da pasta `4yu-apps` (nunca o root `4yu.com.br`). O domínio
  precisa ser criado no Brevo e ganhar os registros TXT e DKIM na zona da
  Hostinger (`HOSTINGER_TOKEN` em `radar-ofertas/.env`, API
  `developers.hostinger.com/api/dns/v1`). **Mexer no DNS e no Brevo é mudança
  externa: mostre ao Gabriel os registros antes de criar.**
- No Better Auth: `emailAndPassword.sendResetPassword` e
  `emailVerification.sendVerificationEmail`. O `/api/auth/*` está **fechado**
  (404, commit `99333a4`): o link do e-mail aponta para uma página nossa
  (`/redefinir-senha?token=...`) que chama `auth.api.resetPassword` numa
  Server Action. Não reabra a rota.
- Regras do OWASP Forgot Password: resposta idêntica para e-mail que existe e
  que não existe; token de uso único e curto (o padrão é 1 h); limite por IP e
  por e-mail com `consumirLimite`; trocar a senha derruba as outras sessões;
  auditar o pedido e a troca. A senha nova passa pelo `haveIBeenPwned` que já
  está ligado.
- Confirmação de e-mail: ligar só para cadastro novo; **não** travar quem já
  existe (6 usuários em produção, nenhum confirmado). Avalie
  `requireEmailVerification` com esse cuidado.
- Tirar da tela `/entrar` a frase "Não existe recuperação por e-mail ainda".
- Print em 1440 e 390 das telas novas antes de entregar.

### 4. Miúdos (item 8)

- **Helper do e2e desatualizado:** `test/e2e/cadastro.ts` procura "Nome da
  empresa" e "Criar empresa"; a tela hoje diz "Nome da organização" e "Criar
  organização e continuar". Todos os e2e que usam `cadastrar()` quebram por
  isso. Conserte e rode `npx playwright test` inteiro (é o único lugar em que
  a suíte inteira vale a pena, e roda no local).
- **`VAPID_PRIVATE_KEY`** está "encrypted" (legível no painel) porque cobre
  também o ambiente de desenvolvimento, e "sensitive" não aceita
  desenvolvimento. Recrie com o mesmo valor em duas variáveis: uma
  "sensitive" para produção e preview, outra "encrypted" só para
  desenvolvimento. Mesmo valor; trocar desliga as notificações push de quem
  já assinou.

## Regras que continuam valendo

- Nada em produção (migration, DNS, Brevo, variável) sem o Gabriel dizer sim
  para aquela mudança. Push no `main` publica: um push por frente, no fim.
- Migration: número pelo diretório (`ls supabase/migrations | tail -1`, hoje a
  última é a `0112`), ensaio em transação contra a produção pela Management
  API (`SUPABASE_ACCESS_TOKEN`, ref `xxxynoshwirupkdzwxbj`), conferir a
  Verandi antes e depois, registrar em `BANCO-COMPARTILHADO.md`. Tabela nova
  que o login usa precisa de grant e política para `autofluxos_login`.
- Repositório público; sem travessão (o traço longo) em arquivo nenhum;
  validar com `npx tsc --noEmit` e os testes vizinhos, não a suíte unitária
  inteira; commit por item.
- O Gabriel é designer, não dev: mensagem curta, decisão tomada, link clicável
  para qualquer painel que ele precise abrir.
- As IAs gratuitas (Gemini, Groq) ficam ligadas por decisão dele.

## Ao terminar

Atualize a seção 5 do `PLANO-SEGURANCA-2026-09-28.md` com o que foi feito e o
que sobrou, e entregue ao Gabriel a lista do que depende dele.
