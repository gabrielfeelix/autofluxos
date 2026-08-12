-- 0009 — o cadastro de quem contrata a 4YU.
--
-- Até aqui `clients` guardava o nome e o que a automação precisa para rodar.
-- Quem responde pelo cliente, o telefone dessa pessoa e o que foi combinado
-- viviam na cabeça de quem vendeu — e some quando duas pessoas atendem.
--
-- **Isto não contradiz a regra do ARQUITETURA sobre dado de negócio.** O que
-- não mora aqui é o registro do negócio *do cliente*: o lead dele, a turma
-- dele, a matrícula da aluna dele. Quem contrata a 4YU é cliente nosso, e o
-- cadastro dele é a nossa base por definição — não existe outro sistema de
-- onde buscá-lo.
--
-- Tudo entra como texto com default vazio, e não nulo: cliente cadastrado às
-- pressas numa reunião tem só o nome, e a tela precisa mostrar "não preenchido"
-- sem carregar `null` por toda a base de código. `''` e `null` significariam a
-- mesma coisa aqui, e duas maneiras de dizer a mesma coisa é uma a mais.

alter table public.clients
  add column if not exists responsavel text not null default '',
  add column if not exists telefone    text not null default '',
  add column if not exists email       text not null default '',
  add column if not exists observacoes text not null default '';

comment on column public.clients.responsavel is
  'Quem responde por este cliente do nosso lado da conversa. Ex.: Daniel, dono do estúdio.';
comment on column public.clients.telefone is
  'Telefone de quem responde. NÃO é o número do WhatsApp que o bot atende — esse mora em `channels`.';
comment on column public.clients.observacoes is
  'O que foi combinado e não cabe em campo: escopo, prazo, o que já foi cobrado.';
