-- 0163, o canal do Messenger (docs/HANDOFF-04-NOV-GOOGLE-E-META.md, item 2).
--
-- A página do Facebook vira canal do Inbox, como o Instagram e o Telegram. O
-- `check` de provedor aceitava só WhatsApp, Instagram, site e Telegram, e o de
-- identidade exigia um entre número, conta do Instagram, chave do site e bot.
-- Uma página não tem nenhum dos quatro.
--
-- O que entra:
--
-- * `fb_page_id`: o id da página. É o `recipient.id` do webhook de mensagem e
--   o `entry.id` do de comentário, e é único pelo mesmo motivo do
--   `ig_user_id`: a mesma página em duas contas faria uma responder pela outra.
-- * `fb_page_nome`: o nome da página, só para a tela. Não é identificador.
--
-- O token da página vai para o Vault, em `token_ref`, como o do Instagram; o
-- gatilho da 0040 que apaga o segredo junto da linha vale para ele também.
--
-- Só colunas novas e a troca de dois `check` em `public.channels`. Nenhuma
-- linha existente muda: as quatro formas antigas continuam aceitas iguais.
-- Nada da Verandi é tocado, nenhuma função criada.

set search_path = public, extensions;

alter table public.channels
  add column if not exists fb_page_id text,
  add column if not exists fb_page_nome text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'channels_fb_page_id_key') then
    alter table public.channels add constraint channels_fb_page_id_key unique (fb_page_id);
  end if;
end $$;

alter table public.channels drop constraint if exists channels_provider_check;
alter table public.channels
  add constraint channels_provider_check
  check (provider in ('cloud-api', 'instagram', 'site', 'telegram', 'messenger'));

alter table public.channels drop constraint if exists channels_id_do_canal_check;
alter table public.channels
  add constraint channels_id_do_canal_check
  check (
    (provider = 'cloud-api' and phone_number_id is not null and ig_user_id is null and site_chave is null and tg_bot_id is null and fb_page_id is null)
    or (provider = 'instagram' and ig_user_id is not null and phone_number_id is null and site_chave is null and tg_bot_id is null and fb_page_id is null)
    or (provider = 'site' and site_chave is not null and phone_number_id is null and ig_user_id is null and tg_bot_id is null and fb_page_id is null)
    or (provider = 'telegram' and tg_bot_id is not null and phone_number_id is null and ig_user_id is null and site_chave is null and fb_page_id is null)
    or (provider = 'messenger' and fb_page_id is not null and phone_number_id is null and ig_user_id is null and site_chave is null and tg_bot_id is null)
  );

comment on column public.channels.fb_page_id is
  'Messenger: id da página do Facebook. Acha o canal no webhook de mensagem e de comentário (0163).';
comment on column public.channels.fb_page_nome is
  'Messenger: nome da página, só para a tela (0163).';
