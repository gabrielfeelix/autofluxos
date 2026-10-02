-- O Inbox ao vivo: cada mensagem nova (ou tique, ou arquivo baixado) avisa a
-- tela pelo Realtime do Supabase, em vez de a tela perguntar ao banco a cada
-- segundo.
--
-- O aviso **não leva conteúdo**: só o id do contato que mudou. Quem quer ver a
-- mensagem continua buscando pelas rotas do painel, com sessão e alcance. Por
-- isso o canal pode ser público (Broadcast sem RLS): quem descobrisse o nome
-- dele saberia só que "algo mudou no contato X". E o nome não é o id do
-- cliente, que aparece em todo endereço do painel: é um uuid sorteado aqui,
-- que só a página do Inbox entrega, a quem tem acesso à conta.
--
-- Escopo: só `public` (AutoFluxos). Não toca Auth, Storage nem configuração do
-- Realtime; usa `realtime.send`, que já existe no projeto e que a Verandi não
-- usa. Aditiva: uma coluna com default e um gatilho. Desfazer é
-- `drop trigger` + `drop function` + `drop column`.

set search_path = public, extensions;

alter table public.clients
  add column if not exists canal_ao_vivo uuid not null default gen_random_uuid();

comment on column public.clients.canal_ao_vivo is
  'Nome do canal de Broadcast do Inbox (inbox:<uuid>). Sorteado, não é o id do cliente. Ver 0119.';

create or replace function public.avisar_inbox_ao_vivo()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  topico uuid;
begin
  select c.canal_ao_vivo
    into topico
    from public.contacts ct
    join public.clients c on c.id = ct.client_id
   where ct.id = new.contact_id;

  if topico is not null then
    perform realtime.send(
      jsonb_build_object('contato', new.contact_id),
      'mudou',
      'inbox:' || topico::text,
      false
    );
  end if;
  return null;
exception when others then
  -- O aviso é cortesia; a mensagem é trabalho. Nada aqui pode impedir uma
  -- mensagem de ser gravada: a tela ainda tem o pulso por SSE como plano B.
  return null;
end;
$$;

revoke all on function public.avisar_inbox_ao_vivo() from public, anon, authenticated;

drop trigger if exists avisar_inbox_ao_vivo on public.messages;
create trigger avisar_inbox_ao_vivo
  after insert or update of situacao, arquivo on public.messages
  for each row execute function public.avisar_inbox_ao_vivo();
