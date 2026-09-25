-- 0105: o chat no site do cliente, como terceiro tipo de canal.
--
-- Um balão de conversa que o lojista cola no site dele (um `<script>` servido
-- pelo AutoFluxos) e que cai no mesmo Inbox, com os mesmos fluxos, funis e IA
-- do WhatsApp. Não passa pela Meta: não há número, não há conta, não há token.
--
-- ---------------------------------------------------------------------------
-- O que a linha de canal guarda
-- ---------------------------------------------------------------------------
--
-- `site_chave` é a identificação pública do canal. Ela vai dentro do trecho que
-- o lojista cola no HTML, então qualquer visitante a lê, e isso é de propósito:
-- ela diz **de qual conta** é o balão, não autoriza nada. Quem protege é a lista
-- de domínios em `site_config` (o navegador manda `Origin`, e a API recusa
-- origem fora da lista) e o limite por IP e por visitante.
--
-- `unique` pelo mesmo motivo de `phone_number_id` e `ig_user_id`: é por ela que
-- a API descobre de quem é a mensagem que chegou.
--
-- `site_config` é jsonb e não cinco colunas porque é aparência e lista de
-- domínios, lida inteira pela tela e pela API, nunca filtrada no SQL. Coluna
-- por campo seria migration a cada ajuste de cor.
--
-- ---------------------------------------------------------------------------
-- O contato do site não precisa de coluna nova
-- ---------------------------------------------------------------------------
--
-- `contacts.wa_id` já guarda o IGSID no Instagram e o BSUID no WhatsApp: é "o
-- endereço de quem escreve neste canal". O visitante do site entra como
-- `site:<hash>`, onde o hash sai de um segredo que só o navegador dele tem. O
-- `unique (client_id, wa_id)` da 0003 continua valendo, e o prefixo impede que
-- um visitante seja confundido com um telefone.
--
-- Só `public`. Não toca `app_verandi`, Auth, Storage nem dado existente: as
-- duas restrições são trocadas por versões que aceitam tudo o que as antigas
-- aceitavam, mais o `site`. Ver docs/BANCO-COMPARTILHADO.md.
set search_path = public, extensions;

alter table public.channels
  add column if not exists site_chave text,
  add column if not exists site_config jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'channels_site_chave_key') then
    alter table public.channels add constraint channels_site_chave_key unique (site_chave);
  end if;
end $$;

alter table public.channels drop constraint if exists channels_provider_check;
alter table public.channels
  add constraint channels_provider_check
  check (provider in ('cloud-api', 'instagram', 'site'));

alter table public.channels drop constraint if exists channels_id_do_canal_check;
alter table public.channels
  add constraint channels_id_do_canal_check
  check (
    (provider = 'cloud-api' and phone_number_id is not null and ig_user_id is null and site_chave is null)
    or (provider = 'instagram' and ig_user_id is not null and phone_number_id is null and site_chave is null)
    or (provider = 'site' and site_chave is not null and phone_number_id is null and ig_user_id is null)
  );

comment on column public.channels.site_chave is
  'Identificação pública do chat do site, a que vai no trecho colado no HTML. Não é segredo: quem protege é a lista de domínios de site_config.';
comment on column public.channels.site_config is
  'Chat do site: { dominios: string[], cor, titulo, saudacao, pedirContato }. Lido inteiro pela tela e pela API.';
