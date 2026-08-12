-- 0007 — uma conversa por vez, por contato.
--
-- O problema: quem manda "oi" e "tudo bem?" em seguida gera dois webhooks, e
-- nada garante que o segundo espere o primeiro. Os dois leem a sessão no mesmo
-- estado; como o primeiro ainda não gravou nada, o segundo também conclui que
-- a conversa é nova e cria uma **segunda sessão**. A conversa reinicia sozinha
-- e a pessoa vê a saudação duas vezes. Reproduzido em teste antes de existir
-- esta migration.
--
-- Por que uma tabela e não `pg_advisory_lock`: o advisory lock de sessão vive
-- preso à conexão, e o Supabase serve por *pooler* — a conexão que pega a
-- trava não é necessariamente a que a solta, e uma que morre segurando trava
-- deixa o contato mudo até o pooler reciclar. Tabela com prazo é mais chata de
-- ler e não tem esse buraco.
--
-- Por que não `unique (contact_id, channel_id)` em `sessions`: porque sessão
-- encerrada e sessão nova do mesmo contato coexistem de propósito — é assim que
-- o histórico sobrevive ao "Já atendi". A trava resolve a corrida sem proibir
-- o que é legítimo.

create table if not exists public.conversation_locks (
  contact_id uuid primary key references public.contacts (id) on delete cascade,
  -- Quando esta trava deixa de valer. Não é "quando foi pega": prazo é o que
  -- garante que uma função morta no meio não trave o contato para sempre.
  ate        timestamptz not null
);

-- Pega a trava, ou diz que não deu.
--
-- Um `insert ... on conflict do update ... where` é **uma** instrução, e por
-- isso é atômico sem transação explícita: ou a linha é criada, ou ela é
-- tomada de uma trava vencida, ou nada acontece porque alguém a segura. O
-- `where` é o que separa os dois últimos casos, e o `returning` só devolve
-- linha quando houve escrita — daí o `coalesce(..., false)`.
create or replace function public.travar_contato(alvo uuid, segundos integer)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  pegou boolean;
begin
  insert into public.conversation_locks (contact_id, ate)
  values (alvo, now() + make_interval(secs => segundos))
  on conflict (contact_id) do update
    set ate = excluded.ate
    where public.conversation_locks.ate < now()
  returning true into pegou;

  return coalesce(pegou, false);
end;
$$;

-- Soltar é apagar. A linha só existe enquanto alguém segura.
create or replace function public.destravar_contato(alvo uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from public.conversation_locks where contact_id = alvo;
$$;

-- Travar é ação de servidor, com a chave secreta — como tudo aqui.
revoke execute on function public.travar_contato(uuid, integer) from anon, authenticated;
revoke execute on function public.destravar_contato(uuid) from anon, authenticated;

-- Mesma postura das outras: ligada, sem política. Só o servidor entra.
alter table public.conversation_locks enable row level security;

notify pgrst, 'reload schema';
