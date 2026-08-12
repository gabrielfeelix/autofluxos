-- 0005 — a IA é do fluxo, não do cliente.
--
-- `clients.ia_habilitada` (0001) partia de um pressuposto errado: que "cliente
-- com IA" e "cliente sem IA" fossem dois tipos de pessoa. Não são. O mesmo
-- cliente pode ter uma triagem simples de horário e uma automação de dúvidas
-- com IA — e o que se vende, se cobra e se entrega é **a automação**, não o
-- CNPJ. Amarrar no cliente obrigaria a criar dois clientes para o mesmo negócio.
--
-- A capacidade fica numa coluna, e não dentro do `rascunho` (jsonb): o desenho
-- é o que a conversa faz, isto é o que o contrato permite. Se entrasse no
-- grafo, publicar congelaria o contrato dentro de uma versão imutável — e
-- vender IA depois exigiria republicar o fluxo inteiro.
--
-- `clients.ia_habilitada` continua existindo e para de ser lida pelo código.
-- Não apago aqui de propósito: coluna some quando alguém confirma que ninguém
-- mais depende dela, não no mesmo passo em que o substituto nasce.

alter table public.flows
  add column if not exists ia_habilitada boolean not null default false;

comment on column public.flows.ia_habilitada is
  'Etapa 2 contratada para ESTA automação. O validador recusa publicar fluxo com nó de IA sem isto.';
