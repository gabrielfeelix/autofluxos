-- 0102: plano de verdade (seções 8 e 8.1 e A8 do plano da administração de
-- 24/09).
--
-- 1. Descida agendada: `clients.plano_agendado` e `plano_agendado_para`. A
--    descida vale na virada do mês; a passada diária da manutenção aplica.
-- 2. Preço contratado por organização: `clients.preco_contratado`, preenchido
--    aqui com o preço de hoje do plano de cada uma. Mudar o preço na tela
--    Planos passa a valer só para organização nova; para as existentes, a
--    administração mantém (legado) ou agenda com aviso de 30 dias
--    (`preco_agendado`, `preco_agendado_para`).
-- 3. Excedente por conversa: `planos.preco_excedente` (0,40 / 0,30 / 0,20).
-- 4. Avisos já dados (7 e 1 dia antes da descida, 80% e 100% do consumo, preço
--    novo): `avisos_de_plano`, uma linha por aviso, para o e-mail não sair
--    duas vezes.
-- 5. A8: sai o `check` de ids fixos de `planos.id` e `clients.plano`. No lugar,
--    formato do id e chave estrangeira: plano com organização não se exclui
--    nem por engano no banco.
--
-- Só `public`. Não toca `app_verandi`, Auth, Storage nem extensão. O único
-- dado reescrito é o preenchimento de `preco_contratado` (nulo antes) e de
-- `preco_excedente` nos três planos. Objeto novo nasce fechado para
-- `anon`/`authenticated` pelo default da 0041; os grants são escritos por
-- clareza.

set search_path = public, extensions;

alter table public.planos
  add column if not exists preco_excedente numeric(10, 2) not null default 0 check (preco_excedente >= 0);

update public.planos set preco_excedente = 0.40 where id = 'essencial' and preco_excedente = 0;
update public.planos set preco_excedente = 0.30 where id = 'operacao' and preco_excedente = 0;
update public.planos set preco_excedente = 0.20 where id = 'escala' and preco_excedente = 0;

comment on column public.planos.preco_excedente is
  'Reais por conversa acima do limite do mês, cobrados na fatura seguinte.';

alter table public.clients
  add column if not exists plano_agendado text,
  add column if not exists plano_agendado_para date,
  add column if not exists preco_contratado integer check (preco_contratado >= 0),
  add column if not exists preco_agendado integer check (preco_agendado >= 0),
  add column if not exists preco_agendado_para date;

comment on column public.clients.plano_agendado is
  'Plano para onde a organização desce na virada do mês. Nulo = nada agendado.';
comment on column public.clients.plano_agendado_para is
  'Dia em que plano_agendado passa a valer (primeiro dia do mês seguinte).';
comment on column public.clients.preco_contratado is
  'Reais por mês que a organização paga. Nulo = o preço do plano.';
comment on column public.clients.preco_agendado is
  'Preço novo aplicado pela administração com aviso de 30 dias.';
comment on column public.clients.preco_agendado_para is
  'Dia em que preco_agendado passa a valer.';

update public.clients c
   set preco_contratado = p.preco
  from public.planos p
 where p.id = c.plano
   and c.preco_contratado is null;

-- A8: ids livres, com formato, e amarrados por chave estrangeira.
alter table public.planos drop constraint if exists planos_id_check;
alter table public.planos
  add constraint planos_id_formato check (id ~ '^[a-z0-9][a-z0-9_-]{0,39}$');

alter table public.clients drop constraint if exists clients_plano_check;
alter table public.clients
  add constraint clients_plano_fkey foreign key (plano) references public.planos (id) on update restrict on delete restrict;
alter table public.clients
  add constraint clients_plano_agendado_fkey foreign key (plano_agendado) references public.planos (id) on update restrict on delete set null;

create table if not exists public.avisos_de_plano (
  client_id uuid not null references public.clients (id) on delete cascade,
  chave text not null check (length(chave) between 1 and 120),
  criado_em timestamptz not null default now(),
  email_enviado_em timestamptz,
  primary key (client_id, chave)
);

comment on table public.avisos_de_plano is
  'Avisos de plano já dados a cada organização (descida, consumo, preço). A chave identifica o aviso, e a linha impede repetir o e-mail.';

alter table public.avisos_de_plano enable row level security;

revoke all on table public.avisos_de_plano from public, anon, authenticated;
grant select, insert, update, delete on table public.avisos_de_plano to service_role;

notify pgrst, 'reload schema';
