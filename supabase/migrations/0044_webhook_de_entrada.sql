-- 0044 — o webhook de entrada, e a promessa que ele conserta
--
-- **Isto não é recurso novo: é uma promessa falsa que já está em produção.** O
-- preset `verandi-espera` diz, com estas palavras, "transforma o 'está lotado'
-- em 'te aviso se abrir'. Quando alguém desmarca, a agenda dispara o aviso". A
-- Verandi dispara. Não existia rota para receber. Quem entrou na fila nunca foi
-- avisado, e o produto não tinha como saber disso.
--
-- Duas tabelas, e a separação é o ponto.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. O segredo de quem pode chamar
-- ---------------------------------------------------------------------------
--
-- **Um segredo por cliente, nunca um global.** Segredo global significa que
-- vazar o de um cliente vaza o de todos — e o pior é que ninguém descobriria
-- por qual cliente vazou. Com um por conta, revogar é uma linha e o estrago
-- para no dono dela.
--
-- O valor mora no **Vault**, como as conexões (0006): a tabela guarda a
-- referência, e o valor sai do cofre uma vez só, no instante de conferir a
-- assinatura. É a mesma regra do `CanalSalvo` não ter campo de token — quem
-- lê a linha não consegue ler o segredo, e isso não depende de disciplina.
create table if not exists public.webhooks_de_entrada (
  id        uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  nome      text not null check (length(trim(nome)) > 0),

  -- A referência no Vault. Nunca o segredo.
  secret_id uuid not null,

  ativo     boolean not null default true,

  -- Quando a última chamada válida chegou. É o que responde "esta integração
  -- ainda está viva?" — e sem isso a tela lista um webhook cadastrado há meses
  -- sem ninguém saber se o outro lado ainda chama.
  ultima_em timestamptz,

  criado_em timestamptz not null default now()
);

create index if not exists webhooks_de_entrada_conta_idx
  on public.webhooks_de_entrada (client_id);

-- ---------------------------------------------------------------------------
-- 2. Qual evento começa qual fluxo
-- ---------------------------------------------------------------------------
--
-- **Tabela própria, e não a `gatilhos` que já existe.** Os dois parecem a
-- mesma coisa e não são: `gatilhos` casa o **texto que a pessoa escreveu**, por
-- `igual`/`contem`, com desempate por especificidade (`casarGatilho`). Aqui o
-- casamento é por **nome exato de evento** vindo de outro sistema — sem
-- normalização, sem `contem`, sem desempate. Enfiar as duas regras na mesma
-- tabela obrigaria toda leitura a perguntar "de que tipo é esta linha?" e faria
-- a tela de Automações oferecer operador que não significa nada para um evento.
--
-- O nome do evento é livre de propósito: quem escolhe é o sistema do outro
-- lado (`vaga.aberta`, `pedido.pago`), e uma lista fixa nossa envelheceria a
-- cada integração nova.
create table if not exists public.gatilhos_de_evento (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients (id) on delete cascade,
  evento     text not null check (length(trim(evento)) > 0 and length(evento) <= 120),

  -- `cascade` como em `gatilhos`: regra que aponta para fluxo apagado não tem
  -- o que executar, e mantê-la como linha morta faria a tela listar uma regra
  -- que não faz nada.
  flow_id    uuid not null references public.flows (id) on delete cascade,

  ativo      boolean not null default true,
  execucoes  integer not null default 0,
  criado_em  timestamptz not null default now()
);

-- Dois fluxos para o mesmo evento é ambiguidade sem desempate possível: ao
-- contrário do texto, não há "mais específico" entre dois nomes iguais.
create unique index if not exists gatilhos_de_evento_unico_idx
  on public.gatilhos_de_evento (client_id, lower(trim(evento)));

-- A consulta da rota: o gatilho ativo desta conta para este evento.
create index if not exists gatilhos_de_evento_conta_idx
  on public.gatilhos_de_evento (client_id, evento) where ativo;

-- Somar dentro do banco, e não `select` seguido de `update` na aplicação: dois
-- eventos no mesmo instante perderiam uma contagem — e é justamente o evento
-- movimentado que chega em rajada. Mesma decisão da 0024.
create or replace function public.contar_disparo_de_evento(p_gatilho uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  total integer;
begin
  update public.gatilhos_de_evento
     set execucoes = execucoes + 1
   where id = p_gatilho
  returning execucoes into total;

  return total;
end;
$$;

revoke execute on function public.contar_disparo_de_evento(uuid) from public, anon, authenticated;
grant execute on function public.contar_disparo_de_evento(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Fechado por padrão
-- ---------------------------------------------------------------------------
--
-- A 0041 fez objeto novo em `public` nascer fechado para `anon`/`authenticated`,
-- mas isso não vale para `service_role` — que precisa mesmo de acesso aqui. O
-- `revoke` explícito continua porque lista do que entra é sempre melhor que
-- lista do que sai (a lição da 0021 e da 0042).
alter table public.webhooks_de_entrada enable row level security;
alter table public.gatilhos_de_evento enable row level security;

revoke all on public.webhooks_de_entrada from anon, authenticated;
revoke all on public.gatilhos_de_evento from anon, authenticated;

comment on table public.webhooks_de_entrada is
  'Quem pode chamar POST /api/webhook/entrada/[clienteId]. Um segredo por cliente, guardado no Vault — a tabela só tem a referência. Segredo global vazaria todos os clientes de uma vez.';

comment on table public.gatilhos_de_evento is
  'Evento de sistema externo -> fluxo. Separada de `gatilhos` de propósito: aquela casa texto de conversa por igual/contem, esta casa nome exato de evento. Ver 0044.';

notify pgrst, 'reload schema';
