-- 0152, o evento que começa pelo modelo
-- (docs/HANDOFF-26-OUT-PESQUISA-POS-COMPRA-PRODUTO.md, recurso 1).
--
-- Uma coluna anulável em `public.gatilhos_de_evento`, sem default: gatilho sem
-- configuração segue o caminho de sempre. A forma do JSON é a de
-- `ModeloDoEvento` em `src/core/evento-com-modelo.ts`, conferida lá.
--
-- E duas linhas de dado da PCYES (cliente 64dbc3a9), para a regra que era fixa
-- no código (`src/server/pesquisa-pos-compra.ts`, até 939aacb3) virar a
-- configuração do gatilho dela sem mudar de comportamento:
--   - o gatilho `pedido.processando` ganha a configuração (modelos v4 > v2 >
--     v1, o v3 foi abandonado; nome e pedido nas lacunas; aceite em
--     `aceita_whatsapp`; uma vez por pedido; o número de teste do Gabriel);
--   - o modelo `pesquisa_pos_compra_v4` ganha a URL da imagem do cabeçalho,
--     que antes vinha fixa no código.
-- Os dois `update` só tocam linha ainda sem o dado: rodar de novo não muda nada.
-- Nada da Verandi é tocado.

set search_path = public, extensions;

alter table public.gatilhos_de_evento add column if not exists modelo jsonb;

comment on column public.gatilhos_de_evento.modelo is
  'Começar pelo modelo: o evento manda um modelo aprovado que é a primeira pergunta do fluxo. Forma em src/core/evento-com-modelo.ts. Nulo: caminho comum do evento.';

update public.gatilhos_de_evento
   set modelo = '{
     "modelos": ["pesquisa_pos_compra_v4", "pesquisa_pos_compra_v2", "pesquisa_pos_compra"],
     "variaveis": ["nome", "pedido"],
     "criarContato": true,
     "campoDeAceite": "aceita_whatsapp",
     "umaVezPor": "pedido",
     "telefonesDeTeste": ["5544998775978"]
   }'::jsonb
 where id = 'af9468b4-969a-4168-945c-f25aee97dac1'
   and client_id = '64dbc3a9-1f77-4892-9770-e3e4be9e14cd'
   and modelo is null;

update public.templates
   set componentes = jsonb_set(componentes, '{cabecalho,url}',
         '"https://autofluxos.4yu.com.br/pesquisas/pcyes-pedido-confirmado.jpg"')
 where cliente_id = '64dbc3a9-1f77-4892-9770-e3e4be9e14cd'
   and nome in ('pesquisa_pos_compra_v4', 'pesquisa_pos_compra_v3')
   and componentes->'cabecalho'->>'tipo' = 'imagem'
   and componentes->'cabecalho'->>'url' is null;
