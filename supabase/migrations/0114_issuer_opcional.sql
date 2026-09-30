-- 0114: login voltou a funcionar. `af_contas.issuer` deixa de ser obrigatória.
--
-- O Better Auth 1.7.0 a 1.7.2 exigia a coluna `issuer` na conta, e a 0019 a
-- criou `not null`. A 1.7.3 tirou a exigência, e a 1.7.5 (que subiu pelo
-- dependabot) confere o schema ao iniciar: coluna obrigatória que ela nunca
-- escreve derruba **todo** login com "Database schema mismatch", e a tela
-- mostrava só "Credenciais não conferem". É o passo do guia oficial
-- (better-auth.com/docs/guides/1-7-upgrade-guide). Não há índice em `issuer`
-- aqui para apagar.
--
-- Só `public.af_contas`. Não toca `app_verandi`, Auth do Supabase, Storage nem
-- extensão. Aditiva: afrouxa uma restrição, nenhum dado muda.

set search_path = public, extensions;

alter table public.af_contas alter column "issuer" drop not null;
