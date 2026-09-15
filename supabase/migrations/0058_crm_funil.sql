-- 0058 — o quadro vira funil: estágio do contato, negociação no cartão,
--        funis encadeados e a linha do tempo.
--
-- A decisão inteira está em `docs/MODELO-CRM.md`, e o resumo dela é um só:
-- **existe um registro de pessoa, o contato, e o que se multiplica é o cartão**.
-- Ninguém "vira" outro cadastro ao comprar; muda o estágio e nasce um cartão.
--
-- Tudo aqui é aditivo — nenhuma coluna existente muda de tipo, nenhuma linha é
-- reescrita, e todo default preenche o passado com o valor que já era verdade.
-- É o que permite aplicar num banco dividido com a Verandi sem janela de parada
-- (ver docs/BANCO-COMPARTILHADO.md). Nada aqui cita `app_verandi`, e todo
-- objeto é qualificado com `public.`.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. O estágio do contato
-- ---------------------------------------------------------------------------
--
-- Um valor só, sempre presente, e **consequência e não formulário**: quem o
-- muda é o que aconteceu — a primeira mensagem, o fluxo que qualificou, o
-- cartão que foi ganho. O ajuste na mão existe, mas é exceção.
--
-- `text` com `check`, e não `enum`: acrescentar valor a um enum no Postgres é
-- migration nova e trava de catálogo, e esta lista ainda vai crescer. Quem
-- conhece os valores de verdade é `core/crm.ts`, que recusa o que não conhece.
--
-- Por que `perdido` e `inativo` são estágios diferentes: perder um desconhecido
-- e perder alguém que já comprou são fatos distintos, e o relatório que junta os
-- dois não responde nada. Quem já foi cliente nunca volta para `perdido`.

alter table public.contacts
  add column if not exists estagio text not null default 'novo'
    check (estagio in ('novo', 'qualificado', 'negociando', 'cliente', 'perdido', 'inativo')),
  add column if not exists estagio_mudou_em timestamptz,
  -- Quando essa pessoa falou com a gente pela última vez.
  --
  -- Denormalizado de propósito. A pergunta que o quadro existe para responder é
  -- "de quem estou devendo resposta", e respondê-la com `max(criado_em)` de
  -- `messages` por cartão seria uma subconsulta por retângulo na tela.
  add column if not exists ultima_mensagem_em timestamptz;

comment on column public.contacts.estagio is
  'Ciclo de vida: novo, qualificado, negociando, cliente, perdido, inativo. Muda sozinho a partir dos fatos; ver core/crm.ts.';

-- Ordenar o quadro por "quem esperou mais" é a leitura principal da tela.
create index if not exists contacts_ultima_mensagem_idx
  on public.contacts (client_id, ultima_mensagem_em desc nulls last);

create index if not exists contacts_estagio_idx
  on public.contacts (client_id, estagio);

-- ---------------------------------------------------------------------------
-- 2. Funis encadeados
-- ---------------------------------------------------------------------------
--
-- O SDR qualifica no quadro dele e entrega; o vendedor fecha no dele; o
-- pós-venda oferece a renovação no terceiro. Uma coluna resolve os três casos:
-- **ganhar aqui abre cartão lá**.
--
-- Encadeamento livre em vez de "tipo de quadro" com regra dentro, porque quem
-- vende de um jeito só não configura nada e nunca lê a palavra "SDR", e quem
-- tem três times encadeia três quadros sem a gente prever a combinação.
--
-- `set null` ao apagar: perder o quadro seguinte quebra a cadeia, e quebrar a
-- cadeia é melhor que apagar em cascata o funil de outro time.
--
-- O `check` barra só o ciclo de tamanho um, que é o erro de clique. Ciclo maior
-- (A→B→A) é barrado em `core/crm.ts`, antes de gravar: resolvê-lo aqui exigiria
-- gatilho recursivo para uma configuração que muda uma vez por ano.

alter table public.quadros
  add column if not exists seguinte_id uuid references public.quadros (id) on delete set null;

do $$
begin
  alter table public.quadros
    add constraint quadros_seguinte_nao_e_ele_mesmo
    check (seguinte_id is null or seguinte_id <> id);
exception
  when duplicate_object then null;
end $$;

comment on column public.quadros.seguinte_id is
  'Para onde o contato vai quando o cartão é ganho aqui. Null = fim da cadeia.';

-- ---------------------------------------------------------------------------
-- 3. As etapas ganham papel e paciência
-- ---------------------------------------------------------------------------
--
-- `tipo` marca as duas etapas que não são "mais uma coluna": cair em `ganho`
-- fecha a negociação e faz o contato virar cliente; cair em `perdido` pede
-- motivo. Sem isso, "Fechado" é um nome de coluna que só o humano entende, e o
-- sistema não pode fazer nada a partir dele.
--
-- `limite_de_dias` é por etapa porque a paciência é por etapa: três dias parado
-- em "Aguardando pagamento" é rotina, três dias em "Primeiro contato" é um lead
-- perdido. Null = usa o padrão do produto.

alter table public.quadro_colunas
  add column if not exists tipo text not null default 'normal'
    check (tipo in ('normal', 'ganho', 'perdido')),
  add column if not exists limite_de_dias integer
    check (limite_de_dias is null or (limite_de_dias > 0 and limite_de_dias <= 365));

-- ---------------------------------------------------------------------------
-- 4. O cartão é a negociação
-- ---------------------------------------------------------------------------
--
-- Estas seis colunas são o que separa "um contato numa coluna" de uma
-- oportunidade — e são o que dá LTV, previsão e motivo de perda **sem** catálogo
-- de produto, carrinho ou proposta, que são um produto inteiro e não é o nosso.
--
-- `titulo` é texto livre ("Plano trimestral", "Orçamento cozinha"). Um catálogo
-- obrigaria o cliente a cadastrar antes de vender, que é exatamente o imposto
-- que este CRM não cobra.
--
-- `valor` é `numeric(12,2)` e não `float`: dinheiro em ponto flutuante soma
-- errado no terceiro relatório, e o erro aparece como centavo que ninguém
-- explica.

alter table public.quadro_cartoes
  add column if not exists titulo text,
  add column if not exists valor numeric(12, 2) check (valor is null or valor >= 0),
  add column if not exists responsavel uuid references public.af_usuarios (id) on delete set null,
  add column if not exists situacao text not null default 'aberta'
    check (situacao in ('aberta', 'ganha', 'perdida')),
  -- Só faz sentido em `perdida`, e é obrigatório lá — mas a obrigação mora em
  -- `core/crm.ts`, não num `check` que impediria fechar um cartão antigo sem
  -- motivo cadastrado.
  add column if not exists motivo text,
  add column if not exists fechado_em timestamptz;

comment on column public.quadro_cartoes.situacao is
  'aberta | ganha | perdida. Cartão fechado continua no quadro: é assim que o time vê o próprio resultado no fim do mês.';

-- O quadro lê "os abertos desta etapa" o tempo todo, e a soma no cabeçalho da
-- coluna é dessa mesma leitura. Parcial porque cartão fechado vira maioria com
-- o tempo e não entra em nenhuma dessas contas.
create index if not exists quadro_cartoes_abertos_idx
  on public.quadro_cartoes (quadro_id, coluna_id)
  where situacao = 'aberta';

-- "Quanto este cliente já rendeu" e "quando foi a última compra" — as duas
-- perguntas do pós-venda, respondidas por um índice só.
create index if not exists quadro_cartoes_ganhos_do_contato_idx
  on public.quadro_cartoes (contact_id, fechado_em desc)
  where situacao = 'ganha';

-- ---------------------------------------------------------------------------
-- 5. Motivos de perda
-- ---------------------------------------------------------------------------
--
-- Lista curta e por conta, editável, em vez de texto livre. Texto livre produz
-- "preço", "Preço", "caro", "achou caro" e nenhum agrupamento possível — e
-- agrupar é a única razão de registrar o motivo.

create table if not exists public.motivos_de_perda (
  id        uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  nome      text not null check (length(trim(nome)) > 0 and length(nome) <= 40),
  ordem     integer not null default 0,
  criado_em timestamptz not null default now()
);

create unique index if not exists motivos_de_perda_unico_idx
  on public.motivos_de_perda (client_id, lower(trim(nome)));

create index if not exists motivos_de_perda_conta_idx
  on public.motivos_de_perda (client_id);

alter table public.motivos_de_perda enable row level security;
revoke all on public.motivos_de_perda from anon, authenticated;

comment on table public.motivos_de_perda is
  'Por que se perde nesta conta. Lista fechada para que o relatório possa agrupar.';

-- ---------------------------------------------------------------------------
-- 6. A linha do tempo
-- ---------------------------------------------------------------------------
--
-- É a peça que faz a tela parecer CRM de verdade, e é a que o RD acerta: "o que
-- aconteceu com essa pessoa" numa lista só, em vez de espalhado entre a conversa
-- e a memória de quem atendeu.
--
-- Não substitui `messages`. A conversa continua sendo a conversa; aqui entram os
-- **fatos sobre o relacionamento** — mudou de etapa, alguém assumiu, virou
-- cliente, perdeu e por quê, automação pausada, nota escrita. Mensagem entra
-- como marco resumido, não como cópia do texto.
--
-- `dados jsonb` porque cada tipo carrega uma coisa diferente e criar coluna por
-- tipo faria uma tabela larga de nulos. Quem sabe ler cada tipo é `core/crm.ts`.
--
-- `autor` sem chave estrangeira, como em `mensagens_agendadas`: o autor pode ser
-- o motor ("automação"), e um id obrigatório obrigaria a inventar um usuário
-- falso para o robô.

create table if not exists public.eventos_do_contato (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients (id) on delete cascade,
  contato_id uuid not null references public.contacts (id) on delete cascade,
  tipo       text not null check (length(trim(tipo)) > 0),
  dados      jsonb not null default '{}'::jsonb,
  -- Nome de quem fez, já legível. Guardar o nome e não só o id é o que faz a
  -- linha do tempo continuar dizendo "Ana moveu para Proposta" depois que a Ana
  -- sai da empresa e o usuário é apagado.
  autor      text,
  criado_em  timestamptz not null default now()
);

-- A leitura é sempre "a linha do tempo desta pessoa, do mais novo para o mais
-- velho". É o único índice que esta tabela precisa.
create index if not exists eventos_do_contato_linha_idx
  on public.eventos_do_contato (contato_id, criado_em desc);

alter table public.eventos_do_contato enable row level security;
revoke all on public.eventos_do_contato from anon, authenticated;

comment on table public.eventos_do_contato is
  'Fatos sobre o relacionamento, em ordem. Não é cópia da conversa: é o que aconteceu em volta dela.';

-- As duas tabelas novas vivem em `public`, que é schema exposto na Data API, e o
-- servidor fala com elas pelo PostgREST. Sem recarregar o cache,
-- `from('eventos_do_contato')` responde 404 até a próxima reinicialização — e o
-- cache é o mesmo dos dois produtos, por isso o reload é breve e de propósito.
notify pgrst, 'reload schema';
