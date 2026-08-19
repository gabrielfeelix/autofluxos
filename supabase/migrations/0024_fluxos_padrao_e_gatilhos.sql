-- 0024 — os fluxos padrão do número e os gatilhos por palavra-chave.
--
-- Frente A6 (docs/PLANO-SISTEMA.md §3.7 e §3.8). Hoje um número executa **um**
-- fluxo, e tudo que não cabe nele vira handoff: áudio vira handoff, primeira
-- conversa é igual à décima, e "quero cancelar" só chega a alguém depois de
-- passar pela triagem inteira.
--
-- Nada aqui muda comportamento sozinho. Todas as colunas nascem nulas e nulo
-- significa **exatamente o que acontece hoje** — mesma postura da 0022: uma
-- migration que emudece o produto no instante em que roda é pior do que a
-- ausência dela, porque o sintoma ("o bot parou") não aponta para a causa.

-- ---------------------------------------------------------------------------
-- 1. Os papéis do número
-- ---------------------------------------------------------------------------

-- **`flow_id` continua sendo o principal, e o principal é a resposta padrão.**
--
-- Os quatro papéis do desenho (boas-vindas, resposta padrão, mídia recebida,
-- pós-atendimento) viram três colunas e não quatro de propósito: "resposta
-- padrão" é o fluxo que roda quando nada mais casa, e isso é literalmente o que
-- `flow_id` sempre foi. Criar uma coluna nova para o mesmo papel deixaria duas
-- colunas disputando a mesma pergunta, e a tela teria que explicar qual ganha.
--
-- `on delete set null` como no `flow_id`: apagar um fluxo não pode apagar o
-- número. Quem impede de fato o apagão é a aplicação, que recusa apagar fluxo
-- ligado a qualquer um dos quatro papéis — a chave estrangeira aqui é a rede
-- embaixo, não a regra.

-- A primeira conversa deste contato neste número. Depois dela, o principal.
-- Existe porque a primeira mensagem é a única em que dá para se apresentar sem
-- soar repetitivo, e hoje ela é atendida pelo mesmo fluxo da décima.
alter table public.channels
  add column if not exists flow_boas_vindas_id uuid references public.flows (id) on delete set null;

-- O que fazer quando chega áudio, foto, figurinha ou PDF.
--
-- **É esta coluna que aposenta a Regra B** (`core/engine/executar.ts`): hoje
-- mídia recebida vira handoff *sempre*, o que era o certo enquanto o cliente
-- não tinha como dizer outra coisa. Com um fluxo aqui ele diz — e figurinha de
-- "obrigado" para de acordar gente às 3h da manhã. Nulo mantém a Regra B.
alter table public.channels
  add column if not exists flow_midia_id uuid references public.flows (id) on delete set null;

-- Roda quando uma pessoa clica em "Já atendi".
--
-- É o único dos quatro que **não** é disparado por mensagem de ninguém: o
-- gatilho é o atendente encerrando. Por isso ele é o único que precisa da
-- janela de 24h conferida antes de falar (ver `acaoEncerrarAtendimento`) — os
-- outros três sempre respondem a uma mensagem que acabou de chegar.
alter table public.channels
  add column if not exists flow_pos_atendimento_id uuid references public.flows (id) on delete set null;

comment on column public.channels.flow_id is
  'O fluxo principal — a resposta padrão do número, o que roda quando nada mais casa.';
comment on column public.channels.flow_boas_vindas_id is
  'Primeira conversa deste contato neste número. Nulo = usa o principal.';
comment on column public.channels.flow_midia_id is
  'Entrada de áudio/imagem/documento. Nulo = Regra B (vai para uma pessoa).';
comment on column public.channels.flow_pos_atendimento_id is
  'Roda quando alguém encerra o atendimento. Nulo = não roda nada.';

-- A tela de fluxos pergunta "este fluxo está ligado a algum número?" e o
-- apagar pergunta o mesmo antes de recusar. Com quatro colunas isso vira quatro
-- varreduras em `channels` por fluxo listado.
create index if not exists channels_flow_boas_vindas_idx
  on public.channels (flow_boas_vindas_id) where flow_boas_vindas_id is not null;
create index if not exists channels_flow_midia_idx
  on public.channels (flow_midia_id) where flow_midia_id is not null;
create index if not exists channels_flow_pos_atendimento_idx
  on public.channels (flow_pos_atendimento_id) where flow_pos_atendimento_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Gatilhos por palavra-chave
-- ---------------------------------------------------------------------------

-- Frase → fluxo. É o que faz "cancelar" chegar no fluxo de cancelamento sem
-- passar pela triagem, e é a única forma de o cliente ampliar o escape que hoje
-- é uma lista fixa dentro do motor (`PALAVRAS_ESCAPE`).
--
-- **Mora na conta e não no número.** Um cliente com dois números quer as mesmas
-- palavras nos dois; quem tem dois quer, na prática, o mesmo atendimento em
-- dois lugares. Amarrar ao número obrigaria a cadastrar tudo em dobro e faria a
-- lista divergir sozinha no dia em que alguém cadastrasse só num deles.
--
-- O fluxo referenciado é `on delete cascade`: gatilho que aponta para fluxo
-- apagado não tem o que executar, e mantê-lo como linha morta faria a tela
-- listar uma regra que não faz nada. Diferente do número, onde apagar a ligação
-- deixaria um número mudo — aqui não sobra nada mudo, só some a regra.
create table if not exists public.gatilhos (
  id        uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  frase     text not null check (length(trim(frase)) > 0),
  -- `igual` e `contem`, o mesmo vocabulário do bloco de condição do editor. Um
  -- terceiro operador aqui e o cliente teria que aprender duas linguagens para
  -- dizer a mesma coisa em duas telas.
  operador  text not null default 'contem' check (operador in ('igual', 'contem')),
  flow_id   uuid not null references public.flows (id) on delete cascade,
  ativo     boolean not null default true,
  -- Quantas vezes esta frase começou uma conversa. É a coluna que responde
  -- "vale a pena manter este gatilho?" — e sem ela a tela lista regras sem
  -- ninguém nunca saber quais estão puxando gente de verdade.
  execucoes integer not null default 0,
  criado_em timestamptz not null default now()
);

-- A consulta do webhook: os gatilhos ativos desta conta, em toda mensagem de
-- texto que chega sem conversa em andamento. Parcial porque gatilho desligado
-- não entra em decisão nenhuma.
create index if not exists gatilhos_conta_idx
  on public.gatilhos (client_id) where ativo;

-- Duas linhas com a mesma frase e o mesmo operador na mesma conta são uma
-- ambiguidade que a tela não tem como mostrar: as duas apareceriam iguais e uma
-- delas nunca dispararia. `lower(trim(...))` porque é assim que a comparação
-- acontece no código — casar aqui com um critério mais frouxo do que o do
-- motor deixaria passar duplicata que na prática é duplicata.
create unique index if not exists gatilhos_frase_unica_idx
  on public.gatilhos (client_id, lower(trim(frase)), operador);

comment on table public.gatilhos is
  'Frase → fluxo, por conta. O casamento acontece antes do fluxo padrão do número.';

alter table public.gatilhos enable row level security;
revoke all on public.gatilhos from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Contar o disparo sem corrida
-- ---------------------------------------------------------------------------

-- `execucoes + 1` lido pela aplicação e escrito de volta perde disparo sempre
-- que duas mensagens casarem o mesmo gatilho no mesmo instante — e é justamente
-- o gatilho popular que tem duas mensagens no mesmo instante. Somar dentro do
-- banco é a única versão que não erra.
--
-- Devolve o total já somado para a tela não precisar reler a linha.
create or replace function public.contar_disparo_do_gatilho(p_gatilho_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  total integer;
begin
  update public.gatilhos
     set execucoes = execucoes + 1
   where id = p_gatilho_id
  returning execucoes into total;

  return total;
end;
$$;

-- Como toda escrita por aqui: quem chama é o servidor com a chave secreta.
revoke execute on function public.contar_disparo_do_gatilho(uuid) from anon, authenticated;

notify pgrst, 'reload schema';
