-- 0128: a tabela de preços de 05/out/2026 (docs/PLANO-PRECOS-05-OUT.md).
--
-- Atendente passa a contar: cada plano inclui uma equipe e cobra por pessoa a
-- mais. O teto de IA vira número do plano, e o de transmissão também. O
-- Essencial ganha IA, transcrição e transmissões. O anual passa a sair por
-- 247, 497 e 997 por mês (ainda cerca de 17% a menos). "Operação" passa a se
-- chamar "Profissional" (o id `operacao` fica: `clients.plano` aponta para ele).
--
-- `clients.teste_ate`: o teste grátis de 14 dias. Preenchido, a conta usa o
-- plano do teste até a data; vencido, fica só leitura até escolher plano.
--
-- Só `public`. Não toca `app_verandi`, Auth, Storage nem extensão. Aditiva:
-- colunas novas com default, e os únicos dados escritos são as três linhas de
-- plano que a 4YU publica. Tabelas já fechadas para `anon`/`authenticated`
-- desde a 0041; coluna nova herda o grant da tabela.

set search_path = public, extensions;

alter table public.planos
  add column if not exists atendentes integer not null default 3 check (atendentes >= 1),
  add column if not exists preco_atendente_extra numeric(10, 2) not null default 0 check (preco_atendente_extra >= 0),
  add column if not exists teto_ia integer not null default 1500 check (teto_ia >= 0),
  add column if not exists teto_transmissoes integer check (teto_transmissoes >= 0);

comment on column public.planos.atendentes is
  'Atendentes que o preço inclui. Acima disso, cada pessoa custa preco_atendente_extra por mês.';
comment on column public.planos.teto_ia is
  'Respostas de IA (somando transcrição) em 30 dias com a chave da 4YU. Chave própria não tem teto.';
comment on column public.planos.teto_transmissoes is
  'Envios de transmissão por mês. Nulo = sem teto.';

update public.planos set
  nome = 'Essencial',
  preco_anual = 2964,
  numeros = 1,
  recursos = '["crm","ia","transcricao","transmissoes"]'::jsonb,
  atendentes = 3,
  preco_atendente_extra = 69,
  teto_ia = 1500,
  teto_transmissoes = 2000,
  resumo = 'Para organizar o atendimento e parar de repetir horário e preço.',
  itens = '["Até 1.000 conversas por mês","3 atendentes inclusos","1 número de WhatsApp e chat do site","Robôs ilimitados, com modelos prontos do seu ramo","IA respondendo e transcrevendo áudio","CRM com funil, etiquetas e atividades","Transmissões: 2.000 envios por mês"]'::jsonb,
  atualizado_em = now()
where id = 'essencial';

update public.planos set
  nome = 'Profissional',
  preco_anual = 5964,
  numeros = 2,
  recursos = '["crm","ia","transcricao","transmissoes","integracoes","varios_numeros","api"]'::jsonb,
  atendentes = 10,
  preco_atendente_extra = 59,
  teto_ia = 3000,
  teto_transmissoes = null,
  resumo = 'Para vender pelo WhatsApp com a equipe inteira no mesmo lugar.',
  itens = '["Tudo do Essencial","Até 3.000 conversas por mês","10 atendentes inclusos","2 números de WhatsApp","IA que consulta catálogo, marca horário e aprende com a equipe","Sequências e transmissões sem limite","Origem de cada cliente por anúncio","Distribuição automática e análise de vendas","Integrações prontas e API"]'::jsonb,
  atualizado_em = now()
where id = 'operacao';

update public.planos set
  nome = 'Escala',
  preco_anual = 11964,
  numeros = 5,
  recursos = '["crm","ia","transcricao","transmissoes","integracoes","varios_numeros","chave_propria","webhook","api"]'::jsonb,
  atendentes = 25,
  preco_atendente_extra = 49,
  teto_ia = 6000,
  teto_transmissoes = null,
  resumo = 'Para equipe grande, mais de um número e loja virtual.',
  itens = '["Tudo do Profissional","Até 8.000 conversas por mês","25 atendentes inclusos","Até 5 números de WhatsApp","Loja conectada: frete, pedido e cupom no chat","Sua própria chave de IA, sem teto de respostas","Webhooks, equipes e permissões por pessoa","Suporte prioritário"]'::jsonb,
  atualizado_em = now()
where id = 'escala';

alter table public.clients
  add column if not exists teste_ate date;

comment on column public.clients.teste_ate is
  'Fim do teste grátis. Até a data, a conta usa o plano do teste; depois, só leitura até escolher plano.';
