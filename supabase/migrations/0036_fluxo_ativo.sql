-- 0036 — ligar e desligar uma automação sem apagar nem despublicar.
--
-- Faltava o gesto do meio. Até aqui existiam dois extremos: publicar (passa a
-- atender gente de verdade) e apagar (leva o desenho e o histórico junto). Quem
-- só queria **parar por uns dias** — a campanha acabou, o fluxo velho vai ser
-- substituído, o cliente pediu para segurar — não tinha o que clicar, e o
-- caminho que sobrava era despublicar deletando ou desligar o número inteiro.
--
-- `default true` porque toda automação que já existe está valendo hoje: uma
-- coluna que nascesse `false` desligaria em silêncio o que está atendendo agora,
-- que é o pior efeito colateral possível para uma migração de coluna.
--
-- `not null` porque "desligado" e "não respondido" não podem ser o mesmo estado:
-- o motor lê isto para decidir se abre a conversa, e nulo ali viraria um `if`
-- que alguém escreve errado no ano que vem.
--
-- Desligado quer dizer: **não abre conversa nova**. Conversa que já está
-- andando termina, porque cortar no meio da pergunta deixa a pessoa falando
-- sozinha no WhatsApp — e quem desligou queria parar de captar, não abandonar
-- quem estava no meio.
set search_path = public, extensions;

alter table public.flows
  add column if not exists ativo boolean not null default true;

comment on column public.flows.ativo is
  'Desligado (false) não abre conversa nova: gatilho, campanha, boas-vindas, mídia e o papel principal pulam este fluxo. Conversa em andamento continua até o fim.';
