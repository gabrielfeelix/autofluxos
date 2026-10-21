-- 0140, o canal do Telegram (docs/PLANO-9-DA-COLMEIA.md, item 8).
--
-- O adaptador da Bot API existia (`channels/telegram.ts`) e não tinha onde
-- morar: o `check` de provedor aceitava só WhatsApp, Instagram e site, e o de
-- identidade exigia um entre número, conta do Instagram e chave do site. Um
-- bot não tem nenhum dos três.
--
-- O que entra:
--
-- * `tg_bot_id`: o id numérico do bot, o começo do token antes dos dois
--   pontos e o que o `getMe` devolve. É o que a rota do webhook leva no
--   endereço para achar o canal, e é único pelo mesmo motivo do `ig_user_id`:
--   o mesmo bot ligado em duas contas faria uma responder pela outra.
-- * `tg_username`: o @ do bot, só para a tela. Não é identificador.
--
-- O token do @BotFather vai para o Vault, em `token_ref`, como o do Instagram;
-- o gatilho da 0040 que apaga o segredo junto da linha vale para ele também.
--
-- Só colunas novas e a troca de dois `check` em `public.channels`. Nenhuma
-- linha existente muda: as três formas antigas continuam aceitas iguais.
-- Nada da Verandi é tocado, nenhuma função criada.

alter table public.channels
  add column if not exists tg_bot_id text,
  add column if not exists tg_username text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'channels_tg_bot_id_key') then
    alter table public.channels add constraint channels_tg_bot_id_key unique (tg_bot_id);
  end if;
end $$;

alter table public.channels drop constraint if exists channels_provider_check;
alter table public.channels
  add constraint channels_provider_check
  check (provider in ('cloud-api', 'instagram', 'site', 'telegram'));

alter table public.channels drop constraint if exists channels_id_do_canal_check;
alter table public.channels
  add constraint channels_id_do_canal_check
  check (
    (provider = 'cloud-api' and phone_number_id is not null and ig_user_id is null and site_chave is null and tg_bot_id is null)
    or (provider = 'instagram' and ig_user_id is not null and phone_number_id is null and site_chave is null and tg_bot_id is null)
    or (provider = 'site' and site_chave is not null and phone_number_id is null and ig_user_id is null and tg_bot_id is null)
    or (provider = 'telegram' and tg_bot_id is not null and phone_number_id is null and ig_user_id is null and site_chave is null)
  );

comment on column public.channels.tg_bot_id is
  'Telegram: id numérico do bot (getMe). Vai no endereço do webhook e acha o canal (0140).';
comment on column public.channels.tg_username is
  'Telegram: o @ do bot, só para a tela (0140).';
