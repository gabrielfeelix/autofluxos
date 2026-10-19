-- 0135, o fluxo de volta: "voltar" dentro de uma automação chamada por outra
-- volta para a automação de origem, e não para o começo da chamada.
--
-- O bloco "ir para automação" troca a versão da sessão pela do destino, e a
-- sessão esquecia de onde veio. Quem dizia "voltar" no meio do Agendamento da
-- MGM recebia a primeira pergunta do Agendamento de novo: o Amilcar recebeu
-- "Só confirmando: o telefone" três vezes em 15/out/2026 e desistiu.
--
-- A coluna guarda o fluxo de onde o primeiro salto saiu. Ela é preenchida e
-- limpa pelo servidor ao trocar a versão da sessão (`trocarVersaoDaSessao`),
-- e o motor só a lê. Anulável e sem default: sessão nenhuma muda de
-- comportamento até saltar de novo.
--
-- Aditiva e só em `public`. Nada da Verandi é tocado.

alter table public.sessions
  add column if not exists fluxo_de_volta uuid references public.flows(id) on delete set null;

comment on column public.sessions.fluxo_de_volta is
  'Fluxo de onde saiu o primeiro "ir para automação" desta sessão; "voltar" retorna a ele (0135).';
