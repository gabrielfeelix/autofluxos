-- 0027 — campanhas: a porta de entrada extra no mesmo número.
--
-- B4 (docs/PLANO-SISTEMA.md §3.3). O anúncio Click-to-WhatsApp abre a conversa
-- com uma frase já digitada; quem chega por ela cai num fluxo específico em vez
-- do padrão do número.
--
-- Metade disso já existe desde a 0009: o webhook grava `origem`,
-- `origem_anuncio` e `origem_titulo` do `referral` que a Meta manda. O que
-- falta é a frase virar **roteamento**, e o contato ficar ligado à campanha que
-- o trouxe.

create table if not exists public.campanhas (
  id        uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  nome      text not null check (length(trim(nome)) > 0),

  /**
   * A frase que o anúncio pré-preenche.
   *
   * **Guardada como a pessoa escreveu, e comparada normalizada.** O produto de
   * onde o desenho veio pede ao usuário que não termine a frase com ponto,
   * exclamação ou interrogação, porque o WhatsApp às vezes os remove — e isso é
   * empurrar um detalhe da plataforma para quem está anunciando. Aqui a
   * normalização é nossa (ver `core/campanhas.ts`): tira acento, caixa, espaço
   * repetido e pontuação do fim, dos dois lados da comparação.
   */
  frase     text not null check (length(trim(frase)) > 0),

  flow_id   uuid not null references public.flows (id) on delete cascade,
  ativa     boolean not null default true,
  -- Quantas conversas esta campanha abriu. É o número que responde se o
  -- anúncio está trazendo gente — e sem ele a tela lista campanhas sem ninguém
  -- nunca saber quais valeram o dinheiro.
  execucoes integer not null default 0,
  criado_em timestamptz not null default now()
);

create index if not exists campanhas_conta_idx on public.campanhas (client_id) where ativa;

-- Duas campanhas com a mesma frase na mesma conta são uma ambiguidade que a
-- tela não tem como mostrar: as duas apareceriam iguais e uma nunca dispararia.
create unique index if not exists campanhas_frase_unica_idx
  on public.campanhas (client_id, lower(trim(frase)));

comment on table public.campanhas is
  'Frase de anúncio → fluxo. Casa antes do gatilho, e só com a mensagem inteira.';

alter table public.campanhas enable row level security;
revoke all on public.campanhas from anon, authenticated;

-- ---------------------------------------------------------------------------
-- De qual campanha este contato veio
-- ---------------------------------------------------------------------------

-- **`on delete set null`, e não `cascade`.** Apagar uma campanha não pode
-- apagar os leads que ela trouxe — eles são o resultado dela, e o único motivo
-- de alguém apagar uma campanha encerrada é limpar a lista.
--
-- A atribuição é de **primeiro toque**: só é escrita quando ainda está vazia,
-- como já acontece com `campos.origem` desde a 0009. Sobrescrever faria a
-- pessoa que voltou por um segundo anúncio trocar de dono, e o relatório do
-- primeiro perderia o lead que ele pagou para trazer.
alter table public.contacts
  add column if not exists campanha_id uuid references public.campanhas (id) on delete set null;

create index if not exists contacts_campanha_idx
  on public.contacts (campanha_id) where campanha_id is not null;

comment on column public.contacts.campanha_id is
  'A campanha que trouxe este contato. Primeiro toque: nunca é sobrescrita.';

-- ---------------------------------------------------------------------------
-- Contar o disparo sem corrida
-- ---------------------------------------------------------------------------

-- Mesmo motivo do gatilho (0024): ler e escrever de volta perde disparo
-- exatamente na campanha popular, que é a única cuja contagem alguém olha.
create or replace function public.contar_disparo_da_campanha(p_campanha_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  total integer;
begin
  update public.campanhas
     set execucoes = execucoes + 1
   where id = p_campanha_id
  returning execucoes into total;

  return total;
end;
$$;

revoke execute on function public.contar_disparo_da_campanha(uuid) from anon, authenticated;

notify pgrst, 'reload schema';
