-- 0037 — de que canal é cada automação.
--
-- Até aqui "WhatsApp" era suposição espalhada: o motor fala Cloud API, os
-- limites do editor são os da Meta (3 botões, 10 itens, janela de 24h) e nada
-- na tela dizia isso. A pergunta "e se eu quiser Instagram ou Telegram?" não
-- tinha onde ser respondida — nem sequer para dizer "ainda não".
--
-- A coluna é a resposta, e ela é **da automação**, não do bloco: os canais não
-- são intercambiáveis (o Instagram aceita 13 quick replies, o Telegram não tem
-- janela de 24h), então um fluxo que servisse a todos seria obrigado ao menor
-- denominador de cada um. É a mesma escolha que o ManyChat e o Chatfuel fazem.
--
-- `default 'whatsapp'` porque é o que toda automação existente é — e é o único
-- canal com adaptador de entrega hoje. O `check` deixa os outros dois entrarem
-- no banco desde já: quem ligar o canal escreve o adaptador, não uma migration.
set search_path = public, extensions;

alter table public.flows
  add column if not exists canal text not null default 'whatsapp';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'flows_canal_check'
  ) then
    alter table public.flows
      add constraint flows_canal_check
      check (canal in ('whatsapp', 'instagram', 'telegram'));
  end if;
end $$;

comment on column public.flows.canal is
  'Por onde esta automação conversa. Hoje só `whatsapp` tem adaptador de entrega; os outros existem no check para o dia em que tiverem. Ver src/core/canais.ts.';
