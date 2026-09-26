-- 0110: preço anual dos planos (ideias de 26/set, item 4).
--
-- `planos.preco_anual`: reais cobrados por ano no pagamento anual. Nulo = o
-- plano não tem opção anual. Preenchido nos planos que já existem com 10 vezes
-- o preço mensal ("pague 10 meses, leve 12", cerca de 17% de desconto), a
-- escolha registrada em `docs/IDEIAS-26-SET-DA-CONVERSA.md`. A tela Planos da
-- administração passa a editar o valor.
--
-- Só `public`. Não toca `app_verandi`, Auth, Storage nem extensão. Aditiva: uma
-- coluna anulável, e o único dado escrito é o preenchimento dela onde está
-- nula. Tabela já fechada para `anon`/`authenticated` desde a 0041.

set search_path = public, extensions;

alter table public.planos
  add column if not exists preco_anual integer check (preco_anual >= 0);

update public.planos
   set preco_anual = preco * 10
 where preco_anual is null;

comment on column public.planos.preco_anual is
  'Reais por ano no pagamento anual. Nulo = sem opção anual.';
