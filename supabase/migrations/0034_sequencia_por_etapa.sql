-- 0034 — chegar numa etapa do quadro inscreve numa sequência.
--
-- O terceiro evento da 0031, e ele fecha a C1b: o bloco de fluxo move o cartão
-- sozinho, e mover o cartão pode disparar o acompanhamento. Sem isto, quadro e
-- sequência ficariam sendo duas automações que não se falam — e o cliente real
-- pede exatamente a junção das duas: *"entrou em Aula agendada e não
-- compareceu → lembrete algumas horas depois"*.
--
-- **Por que é evento e não gambiarra com etiqueta.** Dava para exigir que o
-- fluxo aplicasse uma etiqueta junto da etapa, e usar o evento que já existe.
-- Isso obrigaria toda conta a manter duas coisas em sincronia à mão — e no dia
-- em que alguém movesse o cartão pela tela sem aplicar a etiqueta, o
-- acompanhamento simplesmente não aconteceria, sem erro nenhum para investigar.
--
-- Nenhuma tabela nova: o evento é texto, como sempre, e a coluna que falta é
-- **qual etapa** dispara.

alter table public.sequencias
  add column if not exists coluna_id uuid references public.quadro_colunas (id) on delete restrict;

comment on column public.sequencias.coluna_id is
  'A etapa que dispara, quando o evento é `etapa_alcancada`. `restrict` porque sequência sem condição é sequência quebrada.';

create index if not exists sequencias_coluna_idx
  on public.sequencias (coluna_id) where coluna_id is not null;

-- ---------------------------------------------------------------------------
-- As duas restrições que crescem
-- ---------------------------------------------------------------------------
--
-- O `check` de `evento` era uma lista de dois. Trocar a lista exige derrubar e
-- recriar — não há `alter constraint` para isso no Postgres.

alter table public.sequencias drop constraint if exists sequencias_evento_check;
alter table public.sequencias
  add constraint sequencias_evento_check
  check (evento in ('atendimento_encerrado', 'etiqueta_aplicada', 'etapa_alcancada'));

-- E a coerência: evento de etapa sem etapa é uma sequência que nunca dispara e
-- que a tela mostraria como ativa. Mesma razão da que já existe para etiqueta.
alter table public.sequencias drop constraint if exists sequencias_etapa_coerente;
alter table public.sequencias
  add constraint sequencias_etapa_coerente
  check ((evento = 'etapa_alcancada') = (coluna_id is not null));

notify pgrst, 'reload schema';
