-- 0038 — o que a IA pode gravar sozinha, e o registro do que ela gravou.
--
-- A IA passou a chamar o sistema do cliente (`src/core/ferramentas.ts`). Ler é
-- reversível; marcar e desmarcar não são, e essa diferença precisa de duas
-- coisas que não existiam: alguém dizendo quanto de autonomia cada cliente
-- aceita, e um registro do que foi feito.
--
-- **A política é por cliente e por ferramenta, e não por fluxo.** Quem responde
-- por uma vaga prometida é o negócio, não o desenho — e o mesmo desenho
-- instalado em dois estúdios pode ter respostas diferentes para "o robô pode
-- marcar sozinho?". Guardar no grafo congelaria a resposta na publicação, e ela
-- muda por conversa com o dono, não por deploy.
--
-- **Só o que foge do padrão vira linha.** O padrão é `confirmar` para gravação
-- e `automatico` para leitura, e ele mora no código
-- (`src/server/ia/politica.ts`). Uma tabela pré-preenchida para todo cliente
-- seria um lugar a mais para o padrão divergir de si mesmo, e o primeiro
-- cliente cadastrado antes desta migration ficaria sem linha nenhuma — com o
-- padrão no código, ele já nasce protegido.
--
-- **Leitura não entra aqui.** Não existe cliente que queira aprovar "quais
-- horários tem quinta", e oferecer a escolha seria oferecer uma tela para
-- manter, testar e explicar de graça. O `check` recusa no banco, e não só na
-- tela: política de leitura gravada por engano seria uma trava que ninguém
-- pediu, difícil de perceber e fácil de culpar a IA por ela.
--
-- **O log existe por obrigação, e não por curiosidade.** O art. 20 da LGPD dá ao
-- titular o direito de pedir revisão de decisão automatizada e obriga o
-- controlador a informar os critérios usados. Sem registro de qual consulta foi
-- chamada, com quais argumentos e o que decidiu, não há como cumprir isso — e a
-- hora de descobrir que não há seria a hora do pedido.
--
-- Os dois `on delete cascade` são de propósito: apagar um cliente apaga o que é
-- dele. Guardar log órfão de cliente apagado é guardar dado pessoal sem base
-- legal para guardar, que é o oposto do que este arquivo tenta fazer.
--
-- Nada aqui encosta em `app_verandi`. Ver docs/BANCO-COMPARTILHADO.md.
set search_path = public, extensions;

create table if not exists public.client_tool_policies (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  -- Nome da ferramenta em `src/core/ferramentas.ts`. Texto, e não enum do
  -- banco: o catálogo é código e cresce sem migration. Nome que sumiu do
  -- catálogo vira linha inerte, que é melhor que uma migration por ferramenta.
  ferramenta text not null,
  politica text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (client_id, ferramenta)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'client_tool_policies_politica_check'
  ) then
    alter table public.client_tool_policies
      add constraint client_tool_policies_politica_check
      check (politica in ('automatico', 'confirmar', 'humano'));
  end if;
end $$;

comment on table public.client_tool_policies is
  'Quanta autonomia a IA tem para gravar no sistema deste cliente, por ferramenta. Só o que foge do padrão do código (confirmar para escrita, automatico para leitura). Ver src/server/ia/politica.ts.';

comment on column public.client_tool_policies.politica is
  'automatico = a IA grava sozinha; confirmar = pergunta à pessoa antes; humano = para e espera alguém do time aprovar.';

create table if not exists public.ia_chamadas (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  -- Sem `references` para contato e fluxo de propósito: o log é evidência do
  -- que aconteceu, e continuar existindo depois de o contato ser apagado é
  -- justamente o que se espera dele. O vínculo com o cliente é que manda,
  -- porque é ele que responde pelo tratamento.
  contato_id uuid,
  fluxo_id uuid,
  ferramenta text not null,
  -- Os argumentos **como foram efetivamente usados**, depois da conferência e
  -- da injeção do servidor. Registrar o que o modelo pediu esconderia a coisa
  -- mais importante: o que de fato saiu para a API do cliente.
  argumentos jsonb not null default '{}'::jsonb,
  -- Quem decidiu. É esta coluna que responde "isso foi unicamente automatizado?"
  decidido_por text not null,
  -- O que a pessoa leu antes de dizer sim, quando houve confirmação.
  resumo text,
  ok boolean not null,
  -- Curto de propósito: motivo de falha, nunca corpo de resposta. Guardar o que
  -- a API devolveu seria fazer uma segunda cópia do dado do cliente aqui.
  detalhe text,
  criado_em timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ia_chamadas_decidido_por_check'
  ) then
    alter table public.ia_chamadas
      add constraint ia_chamadas_decidido_por_check
      check (decidido_por in ('ia', 'pessoa_confirmou', 'pessoa_recusou', 'recusado_pela_trava'));
  end if;
end $$;

comment on table public.ia_chamadas is
  'Toda consulta que a IA fez no sistema de um cliente, e quem decidiu. Existe para cumprir o art. 20 da LGPD: informar os critérios de uma decisão automatizada exige ter registrado quais foram.';

comment on column public.ia_chamadas.decidido_por is
  'ia = a IA agiu sozinha; pessoa_confirmou / pessoa_recusou = quem conversa respondeu à pergunta de confirmação; recusado_pela_trava = a conferência barrou antes de sair (id inventado, ferramenta não autorizada, identidade faltando).';

-- Duas consultas existem: "o que aconteceu nesta conversa?" e "o que a IA fez
-- neste cliente ultimamente?". Um índice serve as duas, com o cliente na
-- frente porque toda leitura é escopada nele.
create index if not exists ia_chamadas_cliente_data_idx
  on public.ia_chamadas (client_id, criado_em desc);

create index if not exists ia_chamadas_contato_idx
  on public.ia_chamadas (contato_id, criado_em desc)
  where contato_id is not null;

-- RLS ligada e **sem policy**: só a `service_role` alcança, que é a chave que
-- vive apenas no servidor. É o mesmo desenho das outras tabelas daqui — nada
-- disto é lido pelo navegador, e uma policy permissiva escrita "por enquanto"
-- é o tipo de coisa que ninguém revisa depois.
alter table public.client_tool_policies enable row level security;
alter table public.ia_chamadas enable row level security;

-- A gravação que a IA pediu e que espera um sim.
--
-- Precisa de coluna porque a sessão é gravada campo a campo, e não como um JSON
-- inteiro: sem ela, `iaPendente` sumiria entre a pergunta e a resposta, e a
-- confirmação nunca chegaria a valer. Foi assim que quase passou.
--
-- `jsonb` e não três colunas: o conteúdo é nome de ferramenta, argumentos já
-- conferidos e a frase que a pessoa leu — um objeto que só faz sentido inteiro,
-- e que nenhuma consulta filtra por dentro.
--
-- Não tem segredo dentro, e isso é conferido em `sessaoSchema`: a credencial
-- continua sendo lida no servidor, uma vez, na hora de disparar.
alter table public.sessions
  add column if not exists ia_pendente jsonb;

comment on column public.sessions.ia_pendente is
  'A gravação que a IA pediu e que espera a pessoa confirmar. Null na maior parte do tempo. Ver src/core/confirmacao.ts.';
