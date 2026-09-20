-- 0088. O que cada tipo de atividade pede de diferente.
--
-- ---------------------------------------------------------------------------
-- Por que estas colunas
-- ---------------------------------------------------------------------------
--
-- A `0081` criou `atividades` com cinco tipos — tarefa, ligação, reunião,
-- visita e proposta — e nenhum campo que mudasse entre eles. Na tela o seletor
-- de tipo era decorativo: escolher "reunião" dava exatamente o mesmo formulário
-- de "tarefa", e o link da chamada acabava no meio do título ou em lugar nenhum.
--
-- Duas colunas, anuláveis, e o que cada uma responde:
--
--   - `onde`: **onde a coisa acontece**. O link da reunião, o endereço da
--     visita, o telefone alternativo da ligação. Um campo só, e não `link` mais
--     `endereco`, porque nenhuma atividade tem os dois e duas colunas fariam
--     toda linha carregar uma vazia. O nome diz o papel, não o formato.
--   - `hora_marcada`: se o `prazo` tem hora combinada ou é só um dia.
--
-- ---------------------------------------------------------------------------
-- Por que `hora_marcada` e não olhar a hora do `prazo`
-- ---------------------------------------------------------------------------
--
-- `prazo` é `timestamptz` e **sempre** tem hora: a `0081` grava meia-noite
-- quando só há data (`prazoDoDia` monta `T12:00:00Z`). Não dá para distinguir
-- "reunião às 12h" de "proposta para o dia 22" olhando o valor, e um cliente
-- vendo "sua visita é às 12:00" quando ninguém marcou hora é pior que não
-- mostrar hora nenhuma. O booleano guarda a intenção, que o instante perdeu.
--
-- ---------------------------------------------------------------------------
-- Segurança e escopo
-- ---------------------------------------------------------------------------
--
-- Aditiva: duas colunas anuláveis numa tabela do AutoFluxos. Nenhuma linha
-- existente muda, nada é reescrito, e o código antigo continua funcionando sem
-- elas. Tudo qualificado com `public.`; `app_verandi` não é tocado nem citado
-- como alvo. Ver docs/BANCO-COMPARTILHADO.md.
--
-- Objeto novo em `public` nasce fechado desde a `0041` (o default do papel
-- `postgres` foi alterado), e coluna herda a tabela: não há `grant` a fazer.

set search_path = public, extensions;

alter table public.atividades
  add column if not exists onde text,
  add column if not exists hora_marcada boolean not null default false;

-- Um limite generoso para link de reunião, que é o texto mais longo que cai
-- aqui. Sem isso, o campo aceita um documento inteiro colado por engano.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'atividades_onde_check') then
    alter table public.atividades
      add constraint atividades_onde_check
      check (onde is null or length(onde) <= 500);
  end if;
end $$;

comment on column public.atividades.onde is
  'Onde a atividade acontece: link da reunião, endereço da visita, telefone da ligação. Nulo quando não se aplica, como na tarefa.';

comment on column public.atividades.hora_marcada is
  'true quando o prazo tem hora combinada. O prazo é timestamptz e sempre carrega uma hora, então só este campo distingue "às 14h" de "algum momento do dia 22".';
