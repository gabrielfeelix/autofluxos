-- 0040 — a conexão do Instagram, guardada como o WhatsApp deveria ter sido.
--
-- A `0037` já deixou `flows.canal` aceitar `instagram`, e `src/core/canais.ts`
-- já descreve os limites dele. O que faltava é onde mora a **conta**: qual
-- perfil do Instagram pertence a qual cliente, e com que token falar por ele.
--
-- ---------------------------------------------------------------------------
-- Por que a coluna do token é nova, e por que o WhatsApp não a usa ainda
-- ---------------------------------------------------------------------------
--
-- O token do WhatsApp é **um só, da 4YU**, e vive em `WHATSAPP_TOKEN` no
-- ambiente: hoje todo cliente é atendido pelo nosso número. O Instagram não
-- pode funcionar assim nem em teoria — o token do Instagram Login é **por
-- conta conectada**, emitido no OAuth que o dono do perfil autoriza, e expira
-- em 60 dias. Guardar isso no ambiente significaria uma variável por cliente.
--
-- Então entra `token_ref`, apontando para o Vault, exatamente como
-- `connections.secret_ref` faz desde a `0006`. O valor nunca toca esta tabela;
-- quem precisa dele chama `public.ler_segredo()`, que só a `service_role`
-- executa. Quando o WhatsApp virar Tech Provider e cada cliente trouxer o
-- próprio número, ele passa a usar a mesma coluna e o ambiente deixa de ter
-- token — a coluna já nasce com esse futuro em mente, e é por isso que ela não
-- se chama `ig_token_ref`.
--
-- ---------------------------------------------------------------------------
-- `phone_number_id` deixa de ser obrigatório, e ganha um irmão
-- ---------------------------------------------------------------------------
--
-- Conta do Instagram não tem número de telefone: tem um id de conta
-- profissional (o `IGSID` da Meta). Reaproveitar `phone_number_id` para
-- guardá-lo economizaria uma coluna e custaria a leitura de todo mundo que
-- abrisse a tabela depois — um id de Instagram numa coluna chamada "telefone" é
-- a classe de economia que se paga por anos.
--
-- Então `phone_number_id` passa a aceitar nulo, entra `ig_user_id`, e um
-- `check` garante que cada linha tem **exatamente** o id do canal que ela diz
-- ser. Sem o `check`, uma linha de Instagram sem `ig_user_id` seria aceita pelo
-- banco e só quebraria na hora de entregar a mensagem — no meio de uma
-- conversa, e não no cadastro.
--
-- O `unique` de `ig_user_id` é o mesmo que já existe em `phone_number_id`, e
-- pelo mesmo motivo: é por ele que o webhook descobre de quem é a mensagem que
-- acabou de chegar. Dois clientes com a mesma conta significaria mensagem
-- entregue ao cliente errado.
--
-- ---------------------------------------------------------------------------
-- `token_expira_em` existe porque o token do Instagram morre sozinho
-- ---------------------------------------------------------------------------
--
-- O token de longa duração vale 60 dias e é renovável enquanto estiver vivo;
-- passou disso, só reconectando pelo OAuth — o que exige o dono do perfil na
-- frente da tela. Sem a data guardada, a primeira notícia do vencimento seria
-- um cliente relatando que o Instagram parou de responder. Com ela, a tela
-- avisa antes e a renovação cabe numa tarefa do agendador.
--
-- Nada aqui encosta em `app_verandi`. Ver docs/BANCO-COMPARTILHADO.md.
set search_path = public, extensions;

alter table public.channels
  alter column phone_number_id drop not null;

alter table public.channels
  add column if not exists ig_user_id text,
  -- Aponta para `vault.secrets`. O valor NUNCA é gravado aqui.
  add column if not exists token_ref uuid,
  add column if not exists token_expira_em timestamptz,
  -- O @ do perfil, só para a tela ter o que mostrar. Não é identificador: o
  -- dono pode trocar o @ a qualquer momento sem que a conta mude.
  add column if not exists ig_username text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'channels_ig_user_id_key') then
    alter table public.channels add constraint channels_ig_user_id_key unique (ig_user_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'channels_provider_check') then
    alter table public.channels
      add constraint channels_provider_check
      check (provider in ('cloud-api', 'instagram'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'channels_id_do_canal_check') then
    alter table public.channels
      add constraint channels_id_do_canal_check
      check (
        (provider = 'cloud-api' and phone_number_id is not null and ig_user_id is null)
        or (provider = 'instagram' and ig_user_id is not null and phone_number_id is null)
      );
  end if;
end $$;

comment on column public.channels.ig_user_id is
  'Id da conta profissional do Instagram (IGSID). É por ele que o webhook descobre de quem é a mensagem.';
comment on column public.channels.token_ref is
  'Aponta para vault.secrets. Leia com public.ler_segredo(). O WhatsApp ainda usa WHATSAPP_TOKEN do ambiente; esta coluna é o caminho para ele também.';
comment on column public.channels.token_expira_em is
  'O token de longa duração do Instagram vale 60 dias. Nulo = não expira (é o caso do WhatsApp hoje).';

-- Apagar o canal precisa apagar o segredo junto, senão o Vault acumula token
-- órfão que ninguém sabe de quem era. É o mesmo gatilho que a `0006` criou
-- para `connections`, e a razão é a mesma: segredo sem dono é segredo que
-- ninguém revoga.
create or replace function public.apagar_token_do_canal()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
begin
  if old.token_ref is not null then
    delete from vault.secrets where id = old.token_ref;
  end if;
  return old;
end;
$$;

revoke all on function public.apagar_token_do_canal() from public, anon, authenticated;

drop trigger if exists channels_apagar_token on public.channels;
create trigger channels_apagar_token
  after delete on public.channels
  for each row execute function public.apagar_token_do_canal();
