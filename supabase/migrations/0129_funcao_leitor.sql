-- 0129: a função Leitor (05/out/2026, docs/HANDOFF-05-OUT-PLANOS-V2.md, item 1).
--
-- O sócio ou o financeiro que acompanha: vê Início, contatos, funis e
-- relatórios da organização inteira, com valores, e não escreve nada nem abre
-- a Inbox. Não conta como atendente no plano (`composicaoDaEquipe`).
--
-- Nível 0, abaixo do Atendente. As capacidades dele são só `ler_valores`; a
-- leitura do resto vem do código (`LEITURA_DA_FUNCAO` em src/core/funcoes.ts)
-- e vale só para consulta, nunca para ação.
--
-- Só `public`. Não toca `app_verandi`, Auth, Storage nem extensão. Aditiva:
-- duas checagens alargadas (id e nível) e uma linha nova em `funcoes`.
-- Ninguém ganha nem perde acesso: nenhuma pessoa tem a função ainda.

set search_path = public, extensions;

alter table public.funcoes drop constraint if exists funcoes_id_check;
alter table public.funcoes
  add constraint funcoes_id_check check (id in ('proprietario', 'administrador', 'gestor', 'atendente', 'leitor'));

alter table public.funcoes drop constraint if exists funcoes_nivel_check;
alter table public.funcoes add constraint funcoes_nivel_check check (nivel between 0 and 4);

insert into public.funcoes (id, nome, nivel, descricao, capacidades) values
  ('leitor', 'Leitor', 0, 'Acompanha contatos, funis e relatórios, com valores, sem alterar nada. Não conta como atendente.',
   '{"configurar_empresa":"nenhum","configurar_operacao":"nenhum","atender":"nenhum","criar_oportunidade":"nenhum","registrar_venda":"nenhum","corrigir_venda":"nenhum","ler_valores":"todos","exportar":"nenhum"}')
on conflict (id) do nothing;
