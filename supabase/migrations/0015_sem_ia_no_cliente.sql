-- 0015 — apaga public.clients.ia_habilitada.
--
-- A coluna nasceu em 0001 com um pressuposto errado: que "cliente contratou IA"
-- fosse um fato do cliente. A 0005 mostrou que é um fato da **automação** — o
-- mesmo negócio pode ter uma triagem simples e uma automação com IA — e moveu o
-- contrato para `public.flows.ia_habilitada`, deixando a coluna antiga viva e
-- sem leitor, com a nota de apagar depois de confirmar que ninguém a lê.
--
-- Confirmado nesta data: as únicas leituras de `ia_habilitada` no código são em
-- `public.flows` (repos/fluxos.ts). `repos/clientes.ts` não a seleciona desde a
-- 0005 e registra isso em comentário. Nenhuma view, função ou trigger deste
-- repositório a referencia.
--
-- Escopo: objeto exclusivo do AutoFluxos em `public`. Não toca `app_verandi`,
-- Auth, Storage, extensão nem configuração global. Só é destrutiva para uma
-- coluna que já não tem leitor — o dado que valia migrou na 0005.

alter table public.clients
  drop column if exists ia_habilitada;

-- O PostgREST guarda o desenho do schema em cache. Sem isto, a coluna sumiria
-- do banco e continuaria anunciada na API até o próximo restart do projeto.
notify pgrst, 'reload schema';
