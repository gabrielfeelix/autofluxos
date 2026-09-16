-- 0061 — o passo de sequência que atravessa a janela fechada
--
-- Banco de produção **compartilhado com a Verandi** (ver
-- docs/BANCO-COMPARTILHADO.md). AutoFluxos mora em `public`, Verandi em
-- `app_verandi`. Nada aqui cita o schema deles, e todo objeto é qualificado.
--
-- ---------------------------------------------------------------------------
-- O teto de 1440 cai, e o que ele guardava
-- ---------------------------------------------------------------------------
--
-- A 0031 escreveu: "Quando os modelos aprovados da Meta existirem (Etapa C), o
-- teto sobe; até lá ele é honesto." A 0059 criou os modelos. Isto é a Etapa C.
--
-- **Mas subir o número sozinho não entregaria nada.** O executor
-- (`server/sequencias-passo.ts`) abre um *fluxo*, e fluxo manda texto livre —
-- que a Meta recusa fora das 24h. Um passo de 3 dias com o teto solto e mais
-- nada viraria exatamente o que a 0031 queria evitar: o cliente desenha "3 dias
-- depois", o executor confere a janela, encontra fechada, e encerra a inscrição
-- como `bloqueada`. Zero mensagem entregue, e o desenho parecendo certo.
--
-- Por isso o teto e o modelo entram **na mesma migration**: um sem o outro é
-- uma promessa que o código não cumpre.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. O passo pode carregar um modelo aprovado
-- ---------------------------------------------------------------------------
--
-- `restrict` e não `cascade`, como em `transmissoes.template_id`: apagar um
-- modelo que uma sequência usa apagaria o passo em silêncio, e o cliente
-- descobriria pelo lembrete que parou de chegar.
--
-- Nulo continua sendo o caso comum: passo dentro das 24h não precisa de modelo
-- nenhum, e exigir um seria cobrar aprovação da Meta para mandar a segunda
-- mensagem de uma conversa que está acontecendo agora.

alter table public.sequencia_passos
  add column if not exists template_id uuid
    references public.templates (id) on delete restrict;

-- ---------------------------------------------------------------------------
-- 2. O teto sobe para 30 dias — e o modelo passa a ser obrigatório além de 24h
-- ---------------------------------------------------------------------------
--
-- 30 dias (43.200 minutos) e não "sem teto": uma sequência de seis meses é
-- quase sempre engano de digitação, e um agendamento que fica seis meses na
-- fila é seis meses de chance de o número, o fluxo ou o cliente não existirem
-- mais.
--
-- O `check` composto é o que impede a promessa vazia: **passo além de 1440
-- minutos exige `template_id`**. Sem isso, a tela poderia oferecer "3 dias" e o
-- executor bateria na janela fechada — que é o buraco que esta migration existe
-- para fechar. O banco recusa o desenho impossível na hora de salvar, em vez de
-- deixá-lo falhar na entrega, dias depois, longe de quem o desenhou.

alter table public.sequencia_passos
  drop constraint if exists sequencia_passos_atraso_minutos_check;

alter table public.sequencia_passos
  add constraint sequencia_passos_atraso_valido
    check (
      atraso_minutos between 1 and 43200
      and (atraso_minutos <= 1440 or template_id is not null)
    );

comment on column public.sequencia_passos.template_id is
  'O modelo aprovado que este passo manda. Obrigatório acima de 1440 minutos: '
  'fora da janela de 24h o WhatsApp só entrega modelo aprovado.';
