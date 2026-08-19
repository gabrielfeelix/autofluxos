-- 0025 — etiquetas manuais, e a conta de não lidas que a 0023 deixou pela metade.
--
-- Duas coisas na mesma migration porque as duas servem a mesma tela — a lista de
-- contatos e a fila do Inbox — e separá-las produziria duas aplicações em
-- produção no mesmo dia, cada uma com o mesmo risco de coordenação.
--
-- A7 (docs/PLANO-SISTEMA.md §3.12.1) e o resto da A5 (§3.6).

-- ---------------------------------------------------------------------------
-- 1. Etiquetas manuais
-- ---------------------------------------------------------------------------

-- **As derivadas continuam derivadas.** `abriu_com_midia`, `foi_para_pessoa` e
-- `nao_respondeu` saem do histórico em `repos/leads.ts` e **não** viram linha
-- aqui: no instante em que virassem, elas passariam a precisar de
-- sincronização, e a primeira resposta de um lead deixaria a etiqueta
-- `nao_respondeu` mentindo até alguém rodar um recálculo que ninguém escreveu.
--
-- Estas são as outras: as que uma pessoa cria e aplica porque quer, e que
-- nenhum histórico sabe deduzir — "cliente antigo", "orçamento enviado",
-- "não insistir".
create table if not exists public.etiquetas (
  id        uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  nome      text not null check (length(trim(nome)) > 0),
  -- Nome de cor, e não hexadecimal: a paleta é do produto, e deixar o cliente
  -- escolher `#fff` sobre fundo branco é deixá-lo criar uma etiqueta invisível.
  -- A lista fechada no banco é o que impede um valor torto virar classe CSS que
  -- não existe — e etiqueta sem cor nenhuma some da tela sem erro nenhum.
  cor       text not null default 'cinza'
            check (cor in ('cinza', 'azul', 'verde', 'ambar', 'rosa', 'roxo')),
  criado_em timestamptz not null default now()
);

create index if not exists etiquetas_conta_idx on public.etiquetas (client_id);

-- Duas etiquetas com o mesmo nome na mesma conta são duas linhas idênticas na
-- tela, e metade dos contatos em cada uma. `lower(trim(...))` porque "VIP" e
-- "vip" são a mesma etiqueta para quem digita.
create unique index if not exists etiquetas_nome_unico_idx
  on public.etiquetas (client_id, lower(trim(nome)));

comment on table public.etiquetas is
  'Etiquetas que uma pessoa cria e aplica. As derivadas do histórico não moram aqui.';

alter table public.etiquetas enable row level security;
revoke all on public.etiquetas from anon, authenticated;

-- A ligação. Sem `client_id` próprio de propósito: ele já está nas duas pontas,
-- e uma terceira cópia é a que fica errada quando alguém escreve só duas.
create table if not exists public.contato_etiquetas (
  contato_id  uuid not null references public.contacts (id)  on delete cascade,
  etiqueta_id uuid not null references public.etiquetas (id) on delete cascade,
  criado_em   timestamptz not null default now(),
  primary key (contato_id, etiqueta_id)
);

-- A chave primária já serve "as etiquetas deste contato". Este índice serve a
-- pergunta contrária — "quem tem esta etiqueta" —, que é a do filtro da lista
-- de contatos e a da contagem do rail.
create index if not exists contato_etiquetas_etiqueta_idx
  on public.contato_etiquetas (etiqueta_id);

alter table public.contato_etiquetas enable row level security;
revoke all on public.contato_etiquetas from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Quantas não lidas cada conversa tem, para uma pessoa
-- ---------------------------------------------------------------------------

-- A 0023 criou `af_leituras` e nada a lê. Isto é a metade que faltava.
--
-- **Por que uma função e não uma consulta no `repos/`.** O corte é por contato:
-- cada um tem o seu `lida_em`, e "entradas mais novas que o meu `lida_em`" com
-- cinquenta contatos numa página vira ou cinquenta consultas, ou uma consulta
-- que traz todas as mensagens de todos eles para a aplicação contar. As duas
-- são erradas pelo mesmo motivo — o banco sabe fazer isso num `group by`.
--
-- **O piso é a criação do usuário, e não o começo dos tempos.** Sem linha em
-- `af_leituras` a leitura nunca aconteceu, e a resposta literal seria "tudo que
-- já entrou está por ler" — o que faria a primeira pessoa da equipe abrir o
-- Inbox e encontrar todas as conversas em vermelho, inclusive as de meses antes
-- de ela existir. Não dá para deixar de ler o que chegou antes de você. O
-- `coalesce` para `"createdAt"` é essa frase em SQL.
create or replace function public.nao_lidas_por_contato(
  p_usuario_id uuid,
  p_contatos   uuid[]
)
returns table (contato_id uuid, total bigint)
language sql
security invoker
set search_path = ''
as $$
  select m.contact_id, count(*)
    from public.messages m
    join public.af_usuarios u on u.id = p_usuario_id
    left join public.af_leituras l
      on l.usuario_id = p_usuario_id and l.contato_id = m.contact_id
   where m.contact_id = any (p_contatos)
     and m.direcao = 'entrada'
     and m.ts > coalesce(l.lida_em, u."createdAt")
   group by m.contact_id;
$$;

-- Como todo o resto: quem chama é o servidor com a chave secreta.
revoke execute on function public.nao_lidas_por_contato(uuid, uuid[]) from anon, authenticated;

notify pgrst, 'reload schema';
