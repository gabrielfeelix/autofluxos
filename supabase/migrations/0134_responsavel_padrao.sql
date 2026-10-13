-- 0134, o responsável padrão: toda conversa nova já nasce com dono.
--
-- A distribuição (0064) só dá dono quando o bot passa a conversa para uma
-- pessoa, e pula quem está ausente. Conversa que o bot resolveu sozinho, ou que
-- chegou com todo mundo ausente, ficava em "Sem responsável". Na MGM o dono
-- atende tudo, e dez conversas estavam sem ninguém (13/out/2026).
--
-- `responsavel_padrao` nasce vazio: conta nenhuma muda de comportamento sem
-- alguém escolher. Com uma pessoa escolhida, todo contato que entra sem dono
-- ganha essa pessoa, venha do WhatsApp, do site, da importação ou do cadastro
-- à mão. Por isso é gatilho, e não código no webhook: são vários caminhos de
-- criação, e o que esquecer um deles volta a deixar conversa sem dono.
--
-- Só vale se a pessoa ainda for da conta. Quem sai da equipe deixa de receber
-- sem ninguém precisar lembrar de limpar o ajuste.
--
-- Aditiva, toda qualificada com `public.`, sem citar `app_verandi`
-- (ver docs/BANCO-COMPARTILHADO.md).

set search_path = public, extensions;

alter table public.clients
  add column if not exists responsavel_padrao uuid
    references public.af_usuarios (id) on delete set null;

comment on column public.clients.responsavel_padrao is
  'quem recebe todo contato novo que entra sem dono; vazio = segue a distribuição';

create or replace function public.contato_nasce_com_responsavel()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.atribuido_a is null then
    select c.responsavel_padrao into new.atribuido_a
      from public.clients c
     where c.id = new.client_id
       and exists (
         select 1 from public.af_membros m
          where m."organizationId"::text = c.id::text
            and m."userId"::text = c.responsavel_padrao::text
       );
  end if;
  return new;
end
$$;

drop trigger if exists contacts_responsavel_padrao on public.contacts;
create trigger contacts_responsavel_padrao
  before insert on public.contacts
  for each row execute function public.contato_nasce_com_responsavel();
