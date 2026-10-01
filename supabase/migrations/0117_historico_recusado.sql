-- A recusa do histórico passa a ficar gravada.
--
-- Quem conecta o número pelo WhatsApp Business escolhe, no celular, se
-- compartilha as conversas antigas. Quando recusa, a Meta manda um `history`
-- com o erro 2593109, e o webhook descartava em silêncio: a tela ficava em
-- "importação parada em 0%" e ninguém sabia se tinha sido escolha ou falha
-- (PCYES, 30/set/2026). Com a data gravada, a tela diz o que aconteceu.

set search_path = public, extensions;

alter table public.channels
  add column if not exists historico_recusado_em timestamptz;

comment on column public.channels.historico_recusado_em is
  'Quando a Meta avisou que o histórico não foi compartilhado na conexão (erro 2593109). Nulo = não recusou.';
