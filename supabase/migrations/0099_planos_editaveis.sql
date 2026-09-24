-- 0099: planos editáveis e suspensão de organização (A6 do plano da
-- administração de 24/09).
--
-- Até aqui os planos moravam fixos em `src/core/planos.ts`. Esta tabela deixa
-- a administração editar nome, preço, limite de conversas, números e o que
-- cada plano libera. Os ids continuam os três de sempre, porque
-- `clients.plano` guarda o id: a tabela edita os planos, não inventa plano
-- novo. O código lê daqui e, sem a tabela, cai em `core/planos.ts`
-- (`server/repos/planos.ts`), então ele sobe antes desta migration.
--
-- `clients.suspensa_em` é a suspensão da organização pela administração:
-- anulável, sem default, sem reescrever dado. Nulo = ativa. O código lê por
-- `to_jsonb(c) ->> 'suspensa_em'` e tolera a coluna ausente.
--
-- Só `public`. Não toca `app_verandi`, Auth, Storage nem dado existente (as
-- três linhas de plano são inseridas com os valores que já valem no código).
-- Objeto novo em `public` nasce fechado para `anon`/`authenticated` pelo
-- default da 0041; o grant de `service_role` é escrito por clareza.

set search_path = public, extensions;

create table if not exists public.planos (
  id text primary key check (id in ('essencial', 'operacao', 'escala')),
  nome text not null check (length(trim(nome)) between 1 and 60),
  preco integer not null check (preco >= 0),
  conversas integer not null check (conversas >= 0),
  numeros integer not null default 1 check (numeros >= 1),
  resumo text not null default '',
  itens jsonb not null default '[]'::jsonb check (jsonb_typeof(itens) = 'array'),
  recursos jsonb not null default '[]'::jsonb check (jsonb_typeof(recursos) = 'array'),
  ativo boolean not null default true,
  ordem integer not null default 0,
  atualizado_em timestamptz not null default now()
);

comment on table public.planos is
  'Os planos do AutoFluxos, editáveis pela administração. clients.plano guarda o id. Sem esta tabela o código usa src/core/planos.ts.';

alter table public.planos enable row level security;

revoke all on table public.planos from public, anon, authenticated;
grant select, insert, update, delete on table public.planos to service_role;

insert into public.planos (id, nome, preco, conversas, numeros, resumo, itens, recursos, ordem) values
  ('essencial', 'Essencial', 297, 1000, 1,
   'Para quem atende sozinho e quer parar de repetir horário e preço.',
   '["Até 1.000 conversas por mês","Atendentes ilimitados","1 número de WhatsApp","Fluxos, Inbox e CRM completos","Etiquetas, respostas rápidas e horário de atendimento","Suporte por WhatsApp"]'::jsonb,
   '["crm"]'::jsonb, 0),
  ('operacao', 'Operação', 597, 3000, 1,
   'Para quem já tem gente atendendo junto e perde conversa no meio.',
   '["Tudo do Essencial","Até 3.000 conversas por mês","Atendentes ilimitados","Respostas com IA","Transcrição de áudio","Transmissões e modelos da Meta","Conexão com seus sistemas"]'::jsonb,
   '["crm","ia","transcricao","transmissoes","integracoes"]'::jsonb, 1),
  ('escala', 'Escala', 1197, 8000, 5,
   'Para operação com mais de um número, volume alto e dado sensível.',
   '["Tudo da Operação","Até 8.000 conversas por mês","Atendentes ilimitados","Múltiplos números e unidades","Sua própria chave de IA, e a conversa não vai para treino","Webhook de entrada e auditoria","Acompanhamento dedicado"]'::jsonb,
   '["crm","ia","transcricao","transmissoes","integracoes","varios_numeros","chave_propria","webhook"]'::jsonb, 2)
on conflict (id) do nothing;

alter table public.clients
  add column if not exists suspensa_em timestamptz;

comment on column public.clients.suspensa_em is
  'Quando a administração suspendeu a organização. Nulo = ativa. Suspensa, só o Suporte 4YU entra.';

notify pgrst, 'reload schema';
