# Handoff 28/set/2026: segurança, rodada 4

Leia antes: seção 5 de `docs/PLANO-SEGURANCA-2026-09-28.md` (estado e
pendências), `docs/PENTEST-2026-09-28.md` e, se tocar banco,
`docs/BANCO-COMPARTILHADO.md`. O `git log 5b07f64..HEAD` conta a rodada 3.

## Onde está

Tudo publicado (`main` = produção, último deploy `8acc714`, CI verde). Nenhum
PR aberto. Nada de banco mudou nesta rodada (sem migration).

- CI voltou a passar: `typecheck` = `next typegen && tsc --noEmit`.
- Dependabot: entraram Vitest 4, zod 4, actions 7 e o grupo "menores";
  TypeScript 7 e ESLint 10 estão no `ignore` do `dependabot.yml` com o motivo.
- "Esqueci a senha" (`/esqueci-senha`, `/redefinir-senha`) e confirmação de
  e-mail (`/confirmar-email`) no ar, e-mail pelo Brevo (`src/server/email.ts`).
  Regra da confirmação em `faltaConfirmarEmail` (`src/server/sessao.ts`): só
  conta criada depois de 28/set 21h UTC, 3 dias de carência.
- SSRF por IPv6 consertado em `src/server/efeitos/rede.ts`.
- Vercel: `BREVO_API_KEY` (sensitive), `EMAIL_REMETENTE`, e
  `VAPID_PRIVATE_KEY` dividida (sensitive em produção/preview, encrypted em
  desenvolvimento, mesmo valor).

## Pendente, em ordem

1. **DNS do e-mail, com o Gabriel.** Os 4 registros estão no item 6 das
   pendências do plano. Quando ele disser que criou: confira por DNS público
   (`https://cloudflare-dns.com/dns-query?name=autofluxos.mail.4yu.com.br&type=TXT`
   com `accept: application/dns-json`; não há `dig` na máquina), depois
   `PUT https://api.brevo.com/v3/senders/domains/autofluxos.mail.4yu.com.br/authenticate`
   e mande um "esqueci a senha" de teste para o e-mail do Gabriel. Até lá o
   e-mail de redefinição pode não sair.
2. **Login em produção:** o Gabriel ainda não confirmou que entra no painel.
   Pergunte. Se tiver caído, avise na hora; **nunca gere
   `BETTER_AUTH_SECRET` novo** (cifra o 2FA).
3. **Resto do P10 (teste de invasão ao vivo), só no local.** Feito: SSRF e
   leitura de código da troca de conta. Falta tudo o que ataca o sistema
   rodando (roteiro na frente 2 de `HANDOFF-28-SET-SEGURANCA-RODADA-3.md`).
   O Gabriel autorizou atacar **só o código e o AutoFluxos local, nunca a
   rede** (ele está na rede do trabalho). Registre em
   `docs/PENTEST-2026-09-28.md`.
4. **Dois e2e de agenda falharam** (`agenda.spec.ts:56` e `:121`) na única
   rodada da suíte inteira. Não investigados; podem ser efeito da máquina
   sobrecarregada.
5. Do plano, ainda não feitos: P12 (MFA para todo usuário), P15, P16.

## Armadilhas desta máquina (pagas nesta rodada)

- **A WSL cai com carga.** Um processo pesado por vez, em primeiro plano.
  Playwright só um `.spec` por vez, nunca a suíte inteira, nunca junto com
  build ou vitest.
- **Depois que a WSL reinicia**, o Docker aceita conexão nas portas do
  Supabase local e derruba em seguida (`Connection terminated unexpectedly`,
  curl `000`). Conserto: `docker restart supabase_db_autofluxos`, esperar o
  `pg_isready`, e `docker restart supabase_rest_autofluxos supabase_kong_autofluxos`.
- **Limite de cadastro no e2e** (5 por IP em 5 min): no banco **local**,
  `delete from public.limites_de_requisicao` libera.
- `next-env.d.ts` e `tsconfig.json` aparecem modificados pelo `next dev`:
  ruído, não commite.
- O filtro de segurança do Claude Code barrou: leitura de logs de runtime da
  Vercel, escrita de DNS na Hostinger e a escrita do teste de troca de conta
  ao vivo. Não tente contornar; peça ao Gabriel.

## Regras que continuam

Nada em produção (migration, DNS, Brevo, variável) sem o sim do Gabriel para
aquela mudança. Push no `main` publica. Repositório público: nada de segredo
em doc. Sem travessão. Gabriel é designer: mensagem curta, decisão tomada,
link clicável para painel.
