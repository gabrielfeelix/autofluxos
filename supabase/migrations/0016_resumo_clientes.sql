-- 0016 — o resumo que a lista de clientes precisa, agregado no Postgres.
--
-- A tela de clientes é a primeira que abre e hoje ela conta automações. Isso
-- responde "quanta coisa a gente montou" e não responde a única pergunta que faz
-- alguém abrir a tela de manhã: **quem está esperando resposta agora**.
--
-- Os três números precisam sair de uma consulta só, para a lista inteira. O
-- caminho óbvio — chamar `contarEsperandoPessoa` por cliente — é N+1 na porta de
-- entrada do painel, e a fase 3 já pagou esse preço uma vez: as contagens por
-- etiqueta saíram da barra de leads porque cada número obrigava a ler o
-- histórico do cliente inteiro a cada visita.
--
-- Objeto exclusivo do AutoFluxos em `public`. Não toca `app_verandi`, Auth,
-- Storage, extensão nem configuração global.

create or replace view public.resumo_clientes
with (security_invoker = true) as
select
  cl.id as client_id,
  count(ct.id)::bigint as contatos,
  count(ct.id) filter (where aberto.existe is not null)::bigint as esperando_pessoa,
  max(ultima.ts) as ultima_atividade
from public.clients cl
-- `left join` e não `join`: cliente recém-criado tem zero contato e precisa
-- aparecer com zero, não sumir da lista que ele mesmo compõe.
left join public.contacts ct on ct.client_id = cl.id
-- `lateral` com agregação por contato usa `messages_contact_idx (contact_id,
-- ts desc)` e para na primeira linha de cada contato.
left join lateral (
  select max(m.ts) as ts
  from public.messages m
  where m.contact_id = ct.id
) ultima on true
-- Só a existência importa, então `limit 1` em vez de contar: um contato com
-- três handoffs abertos continua sendo uma pessoa esperando, não três.
left join lateral (
  select 1 as existe
  from public.handoffs h
  join public.sessions s on s.id = h.session_id
  where s.contact_id = ct.id
    and h.resolvido_em is null
  limit 1
) aberto on true
group by cl.id;

comment on view public.resumo_clientes is
  'Contatos, quantos esperam atendimento humano e o último movimento, por cliente, para a lista de clientes.';

-- Mesma regra das outras views de domínio: é dado de cliente, e só o servidor
-- com a chave secreta lê. RLS das tabelas de baixo continua valendo porque a
-- view é `security_invoker`.
revoke all on public.resumo_clientes from anon, authenticated;

-- O PostgREST guarda o desenho do schema em cache; sem isto a view só aparece
-- no próximo restart do projeto.
notify pgrst, 'reload schema';
