-- ---------------------------------------------------------------------------
-- 0081 — a agenda humana: lembrete não é envio
-- ---------------------------------------------------------------------------
--
-- A regra que decide o desenho desta tabela (RB-33)
-- ---------------------------------------------------------------------------
--
-- **Criar atividade não agenda WhatsApp.** É a frase inteira da RB-33, e ela
-- precisa ser verdade no schema, não só na tela.
--
-- A tentação é óbvia e errada: já existe `mensagens_agendadas` (0057), com
-- `quando`, `estado` e uma fila que roda. Reaproveitá-la para "lembrar de
-- ligar para a Ana quinta-feira" pareceria economia de uma tabela, e custaria
-- uma mensagem enviada ao cliente por engano: a passada de
-- `mensagens_agendadas` **envia**, e ela não tem como saber que aquela linha
-- era um bilhete para o vendedor ler.
--
-- Por isso `atividades` é tabela própria, **nenhuma fila a lê**, e não há
-- coluna de texto de mensagem, destinatário ou canal. Uma atividade não tem
-- como virar envio porque não existe caminho de código que a envie.
--
-- As três coisas que a tela confunde hoje, e que ficam separadas
-- ---------------------------------------------------------------------------
--
--   1. **lembrete humano**  -> esta tabela. Alguém faz alguma coisa.
--   2. **adiar a conversa**  -> `contacts.adiada_ate` (já existe). A conversa
--      sai da fila do atendimento até aquela hora.
--   3. **mensagem agendada** -> `mensagens_agendadas` (0057). O sistema manda
--      texto para o cliente.
--
-- Adiar a conversa também **não** conclui atividade, e vice-versa: são eixos
-- diferentes, e juntá-los faria "adiei para amanhã" apagar o lembrete de
-- ligar hoje.
--
-- O vínculo: contato obrigatório, oportunidade opcional
-- ---------------------------------------------------------------------------
--
-- `contact_id` é `not null` e `cartao_id` é anulável, de propósito: "atividade
-- ligada apenas ao contato funciona sem ativar o CRM" é requisito explícito da
-- T5.3. Quem usa só o Inbox precisa poder anotar "retornar a ligação" sem
-- criar funil, etapa e oportunidade antes.
--
-- Aditiva: uma tabela nova, nada existente alterado. Roda em `public`,
-- qualificado, sem tocar `app_verandi`. Ver docs/BANCO-COMPARTILHADO.md.

set search_path = public, extensions;

create table if not exists public.atividades (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,

  -- Sempre há contato. A atividade é sobre alguém.
  contact_id uuid not null references public.contacts (id) on delete cascade,
  -- A oportunidade, quando houver. Nulo = atividade solta do contato, que é o
  -- caso de quem não ativou o CRM.
  cartao_id uuid references public.quadro_cartoes (id) on delete set null,

  tipo text not null default 'tarefa',
  titulo text not null,
  nota text,

  -- Quando é para fazer. Anulável: "algum dia" é resposta legítima, e forçar
  -- uma data faria todo mundo escolher hoje e a agenda nascer vencida.
  prazo timestamptz,

  responsavel uuid references public.af_usuarios (id) on delete set null,

  -- 'aberta', 'concluida' ou 'cancelada'. Cancelada guarda o motivo (RB-28).
  situacao text not null default 'aberta',
  concluida_em timestamptz,
  motivo_do_cancelamento text,

  criada_por text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'atividades_titulo_check') then
    alter table public.atividades
      add constraint atividades_titulo_check check (length(trim(titulo)) > 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'atividades_tipo_check') then
    alter table public.atividades
      add constraint atividades_tipo_check
      check (tipo in ('tarefa', 'ligacao', 'reuniao', 'visita', 'proposta'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'atividades_situacao_check') then
    alter table public.atividades
      add constraint atividades_situacao_check
      check (situacao in ('aberta', 'concluida', 'cancelada'));
  end if;

  -- O estado e suas datas não podem discordar: concluída sem data seria uma
  -- linha que diz "feita" e não sabe quando, e aberta com data de conclusão
  -- seria a mesma contradição ao contrário. É a mesma forma do
  -- `vendas_cancelamento_coerente` da 0071.
  if not exists (select 1 from pg_constraint where conname = 'atividades_situacao_coerente') then
    alter table public.atividades
      add constraint atividades_situacao_coerente check (
        (situacao = 'aberta' and concluida_em is null and motivo_do_cancelamento is null)
        or (situacao = 'concluida' and concluida_em is not null)
        or (situacao = 'cancelada' and concluida_em is not null)
      );
  end if;
end $$;

-- A agenda de uma pessoa: "o que eu tenho para hoje". É a consulta que a tela
-- faz o tempo todo, e o índice parcial mantém as concluídas fora dela.
create index if not exists atividades_agenda_idx
  on public.atividades (client_id, responsavel, prazo)
  where situacao = 'aberta';

-- A próxima ação de um contato, e as abertas de uma oportunidade ao fechar.
create index if not exists atividades_do_contato_idx
  on public.atividades (contact_id, situacao, prazo);

create index if not exists atividades_do_cartao_idx
  on public.atividades (cartao_id)
  where cartao_id is not null;

comment on table public.atividades is
  'A agenda humana (RB-33). Lembrete NAO e envio: nenhuma fila le esta tabela, e nao ha texto, '
  'destinatario nem canal aqui. Mensagem para o cliente e mensagens_agendadas (0057); adiar a '
  'conversa e contacts.adiada_ate. Os tres sao coisas diferentes.';

comment on column public.atividades.cartao_id is
  'A oportunidade, quando houver. Nulo = atividade do contato, que funciona sem o CRM ativado.';

comment on column public.atividades.prazo is
  'Nulo e "algum dia", e e resposta legitima: exigir data faria todo mundo escolher hoje.';

alter table public.atividades enable row level security;
revoke all on public.atividades from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- O PostgREST precisa enxergar a tabela nova
-- ---------------------------------------------------------------------------
--
-- `public` e schema exposto na Data API e o servidor fala com ela pelo
-- PostgREST: sem recarregar o cache, `from('atividades')` responde 404 ate a
-- proxima reinicializacao. O cache e o mesmo dos dois produtos, entao quem
-- aplicar isto em producao confere a Verandi depois, como a 0057 e a 0060
-- ja registraram.

notify pgrst, 'reload schema';
