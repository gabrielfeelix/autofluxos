-- 0022 — a cadeia de atendimento: horário, presença e atribuição.
--
-- Frente A4 (docs/PLANO-SISTEMA.md §3.10.1), que o plano chama de **elo mais
-- fraco do produto**. A pergunta que a motivou foi do dono: *"como que o
-- atendente vai virar atendente?"* — e a resposta honesta é que hoje ninguém
-- vira. A sessão vai para `humano`, o bot cala, e a conversa fica esperando
-- qualquer pessoa. Falta saber **quem** assumiu, **se tem alguém** e **se é
-- hora** de alguém estar lá.
--
-- Três colunas e duas na view. Nenhuma delas muda comportamento sozinha: o
-- código lê tudo com padrão seguro, e conta sem nada configurado continua se
-- comportando exatamente como se comporta hoje.

-- ---------------------------------------------------------------------------
-- 1. Horário de atendimento da conta
-- ---------------------------------------------------------------------------

-- **Nulo significa "atende sempre", e não "nunca atende".**
--
-- É a diferença entre "ninguém configurou ainda" e "configuraram para não
-- atender". Toda conta que já existe nasce com nulo aqui; tratar isso como
-- fechado faria o produto inteiro emudecer no instante em que esta migration
-- rodasse — e o sintoma seria "o bot parou de responder", sem ninguém ligar a
-- causa a uma coluna nova.
--
-- O formato é `{"fuso": "America/Sao_Paulo", "dias": [[], [{"de":"08:00",
-- "ate":"12:00"}, ...], ...]}`, com `dias` indexado por dia da semana (0 =
-- domingo, como em `Date.getDay()`), e **mais de uma faixa por dia** porque
-- almoço fechado é o caso comum de estúdio e consultório.
--
-- Fuso como nome da IANA e não como deslocamento em horas: deslocamento erra
-- duas vezes por ano, no horário de verão, e erra calado.
--
-- Por que `jsonb` e não uma tabela `horarios(conta, dia, de, ate)`: o dado é
-- lido inteiro, sempre junto, e nunca consultado por pedaço — ninguém vai
-- perguntar "quais contas abrem às terças". Tabela aqui seria três joins para
-- montar de volta o objeto que a aplicação já queria.
alter table public.clients
  add column if not exists horario_atendimento jsonb;

comment on column public.clients.horario_atendimento is
  'Expediente do atendimento humano. Nulo = atende sempre (é o padrão de quem nunca configurou).';

-- ---------------------------------------------------------------------------
-- 2. Presença de quem atende
-- ---------------------------------------------------------------------------

-- `disponivel` / `ausente`. É o que o Inbox usa para saber a quem atribuir e
-- para mostrar quem está online — sem isso, atribuir vira sorteio entre gente
-- que pode estar de férias.
--
-- Mora em `af_usuarios` (nossa, criada na 0019) e não em `auth.users`, que é
-- global ao projeto compartilhado com a Verandi.
alter table public.af_usuarios
  add column if not exists "presenca" text not null default 'disponivel';

-- Lista fechada no banco, e não só no código: é coluna que vira decisão de
-- roteamento, e um valor torto aqui faria o Inbox esconder gente sem erro
-- nenhum aparecer.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'af_usuarios_presenca_valida'
  ) then
    alter table public.af_usuarios
      add constraint af_usuarios_presenca_valida
      check ("presenca" in ('disponivel', 'ausente'));
  end if;
end $$;

comment on column public.af_usuarios."presenca" is
  'disponivel | ausente. Quem o Inbox oferece para assumir uma conversa.';

-- ---------------------------------------------------------------------------
-- 3. Quem assumiu a conversa
-- ---------------------------------------------------------------------------

-- **Mora no contato, e não no handoff nem na sessão**, e a escolha tem
-- consequência: o handoff é o *evento* de alguém entrar na fila, e a sessão é
-- uma execução do fluxo — as duas acabam. A responsabilidade por uma pessoa
-- não acaba junto: quem atendeu ontem é quem a pessoa espera reencontrar
-- amanhã. É também o que faz "Meus chats" ser uma lista de gente, e não uma
-- lista de eventos.
--
-- `on delete set null` e não `cascade`: apagar um usuário **não pode** apagar
-- contato de cliente. A conversa fica sem dono, que é exatamente o estado
-- verdadeiro.
alter table public.contacts
  add column if not exists atribuido_a uuid references public.af_usuarios (id) on delete set null;

-- "Meus chats" é a consulta que esta coluna existe para servir, e ela é por
-- cliente. Parcial porque conversa atribuída é minoria — o índice fica pequeno
-- e não pesa em toda escrita de contato.
create index if not exists contacts_atribuido_idx
  on public.contacts (client_id, atribuido_a)
  where atribuido_a is not null;

comment on column public.contacts.atribuido_a is
  'Quem é responsável por atender este contato agora. Nulo = ninguém assumiu.';

-- ---------------------------------------------------------------------------
-- 4. A view de leads passa a carregar o relógio e o responsável
-- ---------------------------------------------------------------------------

-- **`ultima_entrada_em` é o que faz a fila mostrar quanto tempo resta.**
--
-- A janela de 24 horas do WhatsApp conta da **última mensagem que a pessoa
-- mandou**, e a view só tinha `ultima_em`, que é a última mensagem de qualquer
-- lado. Com o bot respondendo depois, `ultima_em` é a hora da resposta dele — e
-- a conta da janela sairia errada para mais, que é o pior lado do erro: a tela
-- diria que dá tempo quando já não dá.
--
-- Hoje esse relógio só existe na conversa aberta, porque `contextoDeResposta`
-- busca por contato. Na fila, ele não existia — e a fila é onde alguém decide o
-- que atender primeiro. §3.10.1: *"a fila precisa mostrar quanto tempo resta,
-- não só que alguém espera"*.
--
-- **As colunas novas vão no fim, e a ordem das antigas é copiada da view que
-- está no ar.** `create or replace view` não reordena nem remove coluna: ele só
-- aceita acrescentar no fim, e recusa qualquer outra diferença com
-- `cannot change name of view column`. Esta ordem veio da 0018, que é a última
-- que mexeu aqui.
create or replace view public.leads
with (security_invoker = true) as
select
  c.id             as contact_id,
  c.client_id,
  c.wa_id,
  c.nome,
  c.campos,
  c.criado_em,
  ultima.ts        as ultima_em,
  ultima.direcao   as ultima_direcao,
  ultima.texto     as ultimo_texto,
  aberto.motivo    as handoff_motivo,
  aberto.criado_em as handoff_em,
  ultima.entregue  as ultima_entregue,
  c.automacao_ativa,
  c.nome_real,
  c.notas,
  entrada.ts       as ultima_entrada_em,
  c.atribuido_a
from public.contacts c
left join lateral (
  select m.ts, m.direcao, m.texto, m.entregue
  from public.messages m
  where m.contact_id = c.id
  order by m.ts desc
  limit 1
) ultima on true
left join lateral (
  select h.motivo, h.criado_em
  from public.handoffs h
  join public.sessions s on s.id = h.session_id
  where s.contact_id = c.id
    and h.resolvido_em is null
  order by h.criado_em desc
  limit 1
) aberto on true
left join lateral (
  select m.ts
  from public.messages m
  where m.contact_id = c.id
    and m.direcao = 'entrada'
  order by m.ts desc
  limit 1
) entrada on true;

revoke all on public.leads from anon, authenticated;

-- O `left join lateral` de entrada varre as mensagens do contato filtrando por
-- direção. Sem índice, isso é varredura por linha da fila — e a fila carrega
-- cinquenta contatos de uma vez.
create index if not exists messages_contato_entrada_idx
  on public.messages (contact_id, ts desc)
  where direcao = 'entrada';

notify pgrst, 'reload schema';
