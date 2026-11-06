-- 0169, a automação enviada no meio de um atendimento devolve a conversa.
--
-- Aditiva, só em `public`; nada da Verandi é tocado e nenhuma extensão nova.
--
-- "Enviar automação" pelo Inbox (06/nov/2026) encerrava o atendimento e deixava
-- a conversa com o bot para sempre. Quem estava atendendo e só queria que o
-- bot fizesse um pedaço (coletar dados, mandar o pagamento) perdia a conversa.
-- Com a marca, quando o fluxo termina a sessão volta a `humano`, o mesmo
-- estado de quem respondeu pelo Inbox, e o bot fica calado de novo até o
-- "Já atendi". A marca é apagada na volta, para um "Devolver para o bot"
-- posterior não devolver de novo à equipe.

set search_path = public, extensions;

alter table public.sessions
  add column if not exists devolver_a_equipe boolean not null default false;
