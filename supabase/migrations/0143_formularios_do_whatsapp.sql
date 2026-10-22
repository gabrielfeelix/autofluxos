-- 0143, o formulário nativo do WhatsApp (WhatsApp Flows), frente 5 do
-- handoff de 22/out. Primeiro modelo: agendamento ligado à Verandi.
--
-- Uma tabela nova em `public`. Nenhuma linha existente muda e nada da Verandi
-- é tocado (a agenda é lida pela API dela, com a chave `vr_` da conta).
--
-- * `formularios_do_whatsapp`: um formulário publicado na Meta por número de
--   WhatsApp e por modelo. A chave pública RSA vai para o número na Meta; a
--   **privada mora no Vault**, e a linha guarda só a referência, como
--   `channels.token_ref` (0040). O endpoint de dados é
--   `/api/whatsapp/formulario/<id desta linha>`: o id diz qual chave abre o
--   pedido, sem tentar uma por uma.
--
-- RLS ligada e sem política, como o resto de `public`: só o servidor acessa,
-- com a chave secreta (docs/BANCO-COMPARTILHADO.md, regra 6).

set search_path = public, extensions;

create table if not exists public.formularios_do_whatsapp (
  id                 uuid primary key default gen_random_uuid(),
  cliente_id         uuid not null references public.clients (id) on delete cascade,
  canal_id           uuid not null references public.channels (id) on delete cascade,
  modelo             text not null default 'agendamento' check (modelo in ('agendamento')),

  -- O Flow na WABA do número. Nulo até a Meta criar.
  flow_id            text,
  -- `rascunho`: criado e ainda não publicado (a Meta confere o endpoint antes).
  -- `publicado`: pronto para mandar. `erro`: a última tentativa falhou, e
  -- `erro` diz por quê, para a tela.
  status             text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'erro')),
  erro               text,

  -- Vault. A chave privada RSA do número, em PEM.
  chave_privada_ref  uuid not null,

  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),

  unique (canal_id, modelo)
);

comment on table public.formularios_do_whatsapp is
  'Formulário nativo do WhatsApp (Flows) publicado por número. Chave privada no Vault (chave_privada_ref), nunca aqui (0143).';

create index if not exists formularios_do_whatsapp_da_conta
  on public.formularios_do_whatsapp (cliente_id);

-- Só **usa** `tocar_atualizado_em` (0001). Não redefinir: ver o aviso da 0059.
drop trigger if exists formularios_do_whatsapp_tocar on public.formularios_do_whatsapp;
create trigger formularios_do_whatsapp_tocar
  before update on public.formularios_do_whatsapp
  for each row execute function public.tocar_atualizado_em();

-- A chave privada sai junto da linha: segredo órfão no Vault é o pior órfão.
create or replace function public.apagar_chave_do_formulario()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
begin
  delete from vault.secrets where id = old.chave_privada_ref;
  return old;
end;
$$;

revoke all on function public.apagar_chave_do_formulario() from public, anon, authenticated;

drop trigger if exists formularios_do_whatsapp_apagar_chave on public.formularios_do_whatsapp;
create trigger formularios_do_whatsapp_apagar_chave
  after delete on public.formularios_do_whatsapp
  for each row execute function public.apagar_chave_do_formulario();

alter table public.formularios_do_whatsapp enable row level security;
revoke all on public.formularios_do_whatsapp from anon, authenticated;

-- Tabela nova em schema exposto. O cache é o mesmo dos dois produtos: depois
-- do reload, conferir que `app_verandi` continua respondendo.
notify pgrst, 'reload schema';
