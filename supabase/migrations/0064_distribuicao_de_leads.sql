-- 0064, a distribuição de leads: quem recebe o próximo, e quem pode responder.
--
-- Responde ao pedido do dono de 15/set: "tenho quatro vendedores, um lead entra,
-- os quatro respondem e disputam o cliente". Hoje isso acontece exatamente
-- assim, porque `contacts.atribuido_a` existe como registro e não como regra:
-- ninguém preenche sozinho, e papel de usuário não controla nada no Inbox.
--
-- As decisões que esta migration materializa estão em `docs/PLANO-DISTRIBUICAO.md`.
-- As duas que importam para quem ler só o SQL:
--
-- 1. **A carteira não precisa de coluna.** "Quem já atendeu atende de novo" cai
--    de graça de `atribuido_a` morar no contato e não na sessão: quem tem dono
--    não entra na distribuição, e pronto. Não há tabela de histórico aqui
--    porque não há pergunta que ela responda hoje.
-- 2. **Tudo nasce desligado.** `distribuicao` começa em `manual` e
--    `exige_assumir` em `false`, que é o comportamento de hoje. Migration
--    aditiva que liga coisa sozinha é a que ninguém perdoa: a conta acordaria
--    distribuindo conversa sem ninguém ter pedido.
--
-- Aditiva: nenhuma coluna existente muda, nada é reescrito, e nada aqui cita
-- `app_verandi`. Todo objeto é qualificado com `public.`
-- (ver docs/BANCO-COMPARTILHADO.md).

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. Como cada conta distribui
-- ---------------------------------------------------------------------------
--
-- `add column ... default` não reescreve a tabela desde o Postgres 11: o valor
-- fica no catálogo e as linhas existentes só o materializam quando forem
-- atualizadas por outro motivo. É o que torna seguro fazer isto numa tabela com
-- dado de produção.
--
-- `balanceado` e não `rodizio`: ordem fixa ignora carga, e o vendedor com onze
-- conversas abertas receberia a décima segunda porque "era a vez dele". O nome
-- da coluna admite outros modos depois sem virar mentira.

alter table public.clients
  add column if not exists distribuicao text not null default 'manual';

alter table public.clients
  add column if not exists exige_assumir boolean not null default false;

-- O `check` entra separado e com `not valid` ausente de propósito: a coluna
-- acabou de nascer com default válido em toda linha, então validar agora custa
-- uma varredura de nada e deixa a restrição confiável desde o primeiro dia.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clients_distribuicao_check'
  ) then
    alter table public.clients
      add constraint clients_distribuicao_check
      check (distribuicao in ('manual', 'balanceado'));
  end if;
end
$$;

comment on column public.clients.distribuicao is
  'manual = ninguém recebe sozinho. balanceado = o lead sem dono vai para quem tem menos conversa aberta.';

comment on column public.clients.exige_assumir is
  'true = responder exige ser o dono da conversa. Ver e responder passam a ser coisas diferentes.';

-- ---------------------------------------------------------------------------
-- 2. Como cada pessoa participa, nesta conta
-- ---------------------------------------------------------------------------
--
-- Tabela própria, e não colunas em `af_membros`, por uma razão prática: aquela
-- tabela é do better-auth, e coluna nossa dentro dela é coluna que uma migration
-- da biblioteca pode derrubar sem saber que existia.
--
-- **Linha ausente é o padrão, e não um erro.** Quem nunca foi configurado segue
-- a regra do papel: `member` entra no rodízio, `owner` e `admin` não, porque
-- gestor acompanha e não atende. Isso mora no TypeScript
-- (`core/rodizio.ts`), onde a regra pode mudar por conversa com o dono em vez de
-- por migration contra o banco que a Verandi divide.
--
-- Sem chave estrangeira para `af_usuarios`: a tabela do login é lida por conexão
-- Postgres direta e esta aqui vive na Data API, e amarrar as duas faria toda
-- limpeza de usuário passar a depender da ordem certa entre dois caminhos que
-- nunca se falam. Linha órfã aqui é inofensiva: ninguém que não está na equipe
-- aparece na lista de candidatos.

create table if not exists public.af_atendentes (
  cliente_id       uuid not null references public.clients (id) on delete cascade,
  usuario_id       uuid not null,

  -- Recebe lead novo automaticamente.
  entra_no_rodizio boolean not null default true,

  -- Máximo de conversas abertas ao mesmo tempo. `0` é sem teto, e é o padrão:
  -- teto inventado por nós seria um número que ninguém mediu, barrando
  -- distribuição sem ninguém entender por quê.
  teto_simultaneo  integer not null default 0 check (teto_simultaneo >= 0),

  atualizado_em    timestamptz not null default now(),

  primary key (cliente_id, usuario_id)
);

comment on table public.af_atendentes is
  'Como cada pessoa participa da distribuição, por conta. Linha ausente vale como padrão do papel.';

alter table public.af_atendentes enable row level security;
revoke all on public.af_atendentes from anon, authenticated;

-- `clients` e a tabela nova vivem em `public`, que é schema exposto na Data API.
-- Sem recarregar o cache, a coluna nova não existe para o PostgREST e
-- `select('distribuicao')` responde 400 até a próxima reinicialização. O cache é
-- o mesmo dos dois produtos, por isso o reload é breve e de propósito.
notify pgrst, 'reload schema';
