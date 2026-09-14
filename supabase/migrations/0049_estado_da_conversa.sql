-- 0049 — em que pé está a conversa.
--
-- ---------------------------------------------------------------------------
-- O eixo que faltava
-- ---------------------------------------------------------------------------
--
-- O Inbox sabia responder "de quem é esta conversa?" (o rail Todos / Sem dono
-- / Meus) e não sabia responder **"em que pé ela está?"**. Sem o segundo eixo
-- toda conversa fica na fila para sempre: a que terminou ontem e a que espera
-- retorno na terça ocupam a mesma linha, com o mesmo peso, e em três meses a
-- fila é uma lista onde ninguém acha nada.
--
-- É o mesmo buraco que o Front descreveu ao reorganizar o inbox deles em
-- Open / Later / Done, com a justificativa publicada de que "conversas
-- esperando não ficam mais escondidas em Arquivadas". Adotamos os três
-- estados com os nomes que este produto usa.
--
-- ---------------------------------------------------------------------------
-- Por que duas colunas e não uma
-- ---------------------------------------------------------------------------
--
-- `estado` diz em qual das três seções a conversa aparece. `adiada_ate` diz
-- **quando** ela volta — e existe separada porque o retorno é automático: não
-- há processo que "mova" nada, a fila simplesmente pergunta se o prazo passou.
-- Guardar só o estado exigiria alguém rodando de tempos em tempos para
-- devolver conversa à fila, e esse alguém é exatamente o tipo de peça que
-- falha em silêncio num domingo.
--
-- ---------------------------------------------------------------------------
-- A regra que não é opcional: quem responde, reabre
-- ---------------------------------------------------------------------------
--
-- Front e Help Scout fazem o mesmo, e por um motivo que só aparece no uso: uma
-- conversa adiada para terça em que o cliente escreve na segunda **não é mais
-- uma conversa adiada**. Ela virou uma pessoa esperando resposta, e deixá-la
-- fora da fila até terça é perder o cliente por organização.
--
-- Por isso o webhook desfaz o adiamento ao gravar entrada. A regra mora no
-- gatilho, junto da escrita, e não no código do webhook: entrada de mensagem
-- chega por mais de um caminho (`messages`, `history`, `smb_message_echoes`) e
-- a regra tem que valer para todos sem depender de cada um lembrar dela.

-- ---------------------------------------------------------------------------
-- 1. As colunas
-- ---------------------------------------------------------------------------

-- `aberta` é o default de propósito: todo contato que já existe estava, de
-- fato, aberto — é o único valor que não reescreve história.
alter table public.contacts
  add column if not exists estado text not null default 'aberta',
  add column if not exists adiada_ate timestamptz,
  add column if not exists adiada_nota text,
  add column if not exists resolvida_em timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contacts_estado_valido'
  ) then
    alter table public.contacts
      add constraint contacts_estado_valido
      check (estado in ('aberta', 'adiada', 'resolvida'));
  end if;
end $$;

comment on column public.contacts.estado is
  'aberta | adiada | resolvida. O eixo "em que pé está", separado de atribuido_a, que é o "de quem é".';
comment on column public.contacts.adiada_ate is
  'Quando a conversa volta para a fila. A volta é por comparação de data, não por processo agendado.';
comment on column public.contacts.adiada_nota is
  'O porquê do adiamento, escrito por quem adiou. É o que faz o retorno ter contexto em vez de virar um reaparecimento sem explicação.';

-- A fila filtra por estado dentro de um cliente, e a ordenação continua sendo
-- a última mensagem. Índice composto para as duas coisas de uma vez.
create index if not exists contacts_estado_idx
  on public.contacts (client_id, estado);

-- Só as adiadas, que é a única busca por prazo que existe.
create index if not exists contacts_adiadas_idx
  on public.contacts (adiada_ate)
  where estado = 'adiada';

-- ---------------------------------------------------------------------------
-- 2. Mensagem que entra reabre a conversa
-- ---------------------------------------------------------------------------

-- Vale para adiada **e** resolvida: quem escreve de novo depois de resolvido
-- tem um assunto novo, e ele não pode nascer fora da fila.
--
-- Só `direcao = 'entrada'`: a nossa própria resposta não reabre nada, senão
-- responder uma conversa resolvida a traria de volta para sempre.
--
-- `historico` (0047) é a carga de conversa antiga da coexistência — seis meses
-- chegando de uma vez reabririam tudo que já foi fechado.
create or replace function public.reabrir_ao_receber()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.direcao <> 'entrada' or coalesce(new.historico, false) then
    return new;
  end if;

  update public.contacts
     set estado = 'aberta',
         adiada_ate = null,
         adiada_nota = null,
         resolvida_em = null
   where id = new.contact_id
     and estado <> 'aberta';

  return new;
end $$;

drop trigger if exists reabrir_ao_receber on public.messages;
create trigger reabrir_ao_receber
  after insert on public.messages
  for each row
  execute function public.reabrir_ao_receber();

-- ---------------------------------------------------------------------------
-- 3. A view enxerga o estado
-- ---------------------------------------------------------------------------
--
-- `security_invoker = true` continua sendo o que impede a view de furar a RLS
-- das tabelas de baixo — ver 0004. Repetido aqui porque `create or replace`
-- não herda a opção.
--
-- `estado_efetivo` é o que a tela deve ler: uma conversa adiada cujo prazo já
-- passou **é** uma conversa aberta, e quem pergunta não deveria precisar
-- lembrar de comparar a data. Guardar o estado cru junto (`estado`) mantém
-- possível saber que ela voltou de um adiamento.
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
  c.atribuido_a,
  ultima.tipo      as ultimo_tipo,
  c.estado,
  c.adiada_ate,
  c.adiada_nota,
  c.resolvida_em,
  case
    when c.estado = 'adiada' and c.adiada_ate is not null and c.adiada_ate <= now()
      then 'aberta'
    else c.estado
  end              as estado_efetivo
from public.contacts c
left join lateral (
  select m.ts, m.direcao, m.texto, m.entregue, m.payload->>'type' as tipo
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
