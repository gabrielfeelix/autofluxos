-- 0070 — o nível do cliente, a recência, e a régua que dispara por eles.
--
-- Três coisas que o CRM não respondia e que são a mesma pergunta em momentos
-- diferentes: **quanto essa pessoa vale, se ela ainda está aqui, e o que fazer
-- quando ela começa a sumir.**
--
-- ---------------------------------------------------------------------------
-- 1. Faixa em reais, e não quintil
-- ---------------------------------------------------------------------------
--
-- O RFM clássico ordena a base e corta em cinco partes iguais. É o padrão do
-- varejo e não serve aqui: num estúdio com trinta alunas, o quintil de cima é
-- topo de trinta — pode ser quem gastou trezentos reais no ano. O dono olha
-- "Ouro", discorda, e para de confiar no resto da tela.
--
-- Quintil também move o chão sozinho: entra um cliente grande e todo mundo cai
-- de faixa sem ter feito nada.
--
-- Por isso a faixa é **em reais e escolhida pelo dono**, com um padrão que
-- funciona para quem nunca abrir a tela. Quem conhece os níveis de verdade é
-- `core/relacionamento.ts`; aqui ficam só os dois números.
--
-- Colunas na `clients` e não tabela nova: são dois números por conta, e tabela
-- de duas colunas com uma linha por cliente é junção paga em toda leitura.

alter table public.clients
  add column if not exists nivel_ouro  numeric(12, 2) not null default 5000
    check (nivel_ouro >= 0),
  add column if not exists nivel_prata numeric(12, 2) not null default 1000
    check (nivel_prata >= 0),
  -- Ouro abaixo de prata é uma tela que mente, e o banco recusa antes de a
  -- tela precisar explicar. Mesma decisão de `sequencias_etiqueta_coerente`.
  add constraint clients_niveis_coerentes check (nivel_ouro > nivel_prata);

comment on column public.clients.nivel_ouro is
  'A partir de quanto o cliente é ouro, em reais. Faixa absoluta, não quintil: ver core/relacionamento.ts.';

-- ---------------------------------------------------------------------------
-- 2. A régua dispara por relacionamento
-- ---------------------------------------------------------------------------
--
-- A sequência já sabia disparar por etiqueta, por etapa e por fim de
-- atendimento (0031, 0034) — tudo **ato deliberado de alguém**. Falta o
-- disparo que ninguém faz: o tempo passando.
--
-- `cliente_sumido` é o evento que fecha o pós-venda: quem comprou, parou de
-- falar, e ninguém percebeu. É o caso que o dono descreve como "meu cliente
-- some e eu só descubro na hora da renovação".
--
-- `dias_sem_conversa` é a condição, e é do evento e não do passo: "sumido" é
-- uma definição da conta ("para mim, sumido é 60 dias"), não de cada mensagem.
--
-- O `check` de `evento` era uma lista de três, e trocar a lista exige derrubar
-- e recriar — não há `alter constraint` para isso no Postgres (mesma nota da
-- 0034).

alter table public.sequencias
  add column if not exists dias_sem_conversa integer
    check (dias_sem_conversa is null or dias_sem_conversa between 7 and 365),
  -- Só este nível entra na régua. Null = qualquer um.
  add column if not exists nivel_alvo text
    check (nivel_alvo is null or nivel_alvo in ('ouro', 'prata', 'bronze', 'sem_compra'));

alter table public.sequencias drop constraint if exists sequencias_evento_check;
alter table public.sequencias
  add constraint sequencias_evento_check
  check (evento in ('atendimento_encerrado', 'etiqueta_aplicada', 'etapa_alcancada', 'cliente_sumido'));

-- Evento de sumiço sem o "quantos dias" é sequência que nunca dispara e que a
-- tela mostraria como ativa. Mesma razão das duas coerências que já existem.
alter table public.sequencias drop constraint if exists sequencias_sumido_coerente;
alter table public.sequencias
  add constraint sequencias_sumido_coerente
  check ((evento = 'cliente_sumido') = (dias_sem_conversa is not null));

comment on column public.sequencias.dias_sem_conversa is
  'Quantos dias calado para entrar na régua de retomada. Só vale para o evento cliente_sumido.';

-- ---------------------------------------------------------------------------
-- 3. Quem já foi chamado de volta
-- ---------------------------------------------------------------------------
--
-- Sem isto a régua de sumiço reinscreve a mesma pessoa em toda passada do cron:
-- ela continua sumida no dia seguinte, e continuaria casando com a condição
-- para sempre. Seria o bug mais caro possível — mensagem repetida todo dia no
-- WhatsApp de um cliente antigo, que é como se perde um número e não um lead.
--
-- Na inscrição e não em coluna do contato porque a pergunta é por régua: duas
-- sequências de retomada diferentes podem alcançar a mesma pessoa.

alter table public.sequencia_inscricoes
  add column if not exists por_sumico_em timestamptz;

comment on column public.sequencia_inscricoes.por_sumico_em is
  'Quando esta pessoa entrou por sumiço. Impede a régua de reinscrever a mesma pessoa todo dia.';

-- A leitura é "esta pessoa já entrou nesta régua de retomada ultimamente?".
create index if not exists sequencia_inscricoes_sumico_idx
  on public.sequencia_inscricoes (sequencia_id, contact_id, por_sumico_em desc)
  where por_sumico_em is not null;

-- As colunas novas entram em tabelas que o PostgREST já serve, e o cache é o
-- mesmo dos dois produtos (ver docs/BANCO-COMPARTILHADO.md).
notify pgrst, 'reload schema';
