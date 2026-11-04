-- 0164, o Google Agenda como agenda da IA (docs/HANDOFF-04-NOV-GOOGLE-E-META.md, item 4).
--
-- `agendas_conectadas.plataforma` aceitava só os cinco sistemas de 0158. O
-- Google Agenda entra como o sexto: o refresh token vai para `connections`
-- (cofre), como a chave dos outros, e os ajustes (expediente, e-mail da
-- conta) no `jsonb`.
--
-- Só a troca de um `check`. Nenhuma linha muda, nada da Verandi é tocado.

set search_path = public, extensions;

alter table public.agendas_conectadas drop constraint if exists agendas_conectadas_plataforma_check;
alter table public.agendas_conectadas
  add constraint agendas_conectadas_plataforma_check
  check (plataforma in ('feegow', 'clinica_nas_nuvens', 'trinks', 'agendapro', 'evo', 'google_agenda'));
