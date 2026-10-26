# Handoff 26/out/2026: transformar a pesquisa pós-compra da PCYES em produto

## O pedido do Gabriel

"Se um cliente quisesse HOJE fazer tudo o que fizemos para a PCYES, ele
conseguiria criar nativamente pela plataforma?" Não consegue. Sua tarefa:

1. **Primeiro, pesquisar** como o mercado resolve isso, para conferir se o
   plano abaixo não está pensando errado. Olhar ferramentas de WhatsApp para
   e-commerce que disparam mensagem/pesquisa por status de pedido (ex.: WATI,
   Interakt, Zoko, Gallabox, Respond.io, Blip, Zenvia, Kommo, Klaviyo com
   WhatsApp, Shopify Flow, Yampi, Reportei/Opinion Box para NPS) e como
   resolvem: gatilho da loja, template ligado a fluxo, opt-in, recompensa,
   relatório. Usar WebSearch `extended` quando o `standard` vier raso.
2. **Se o plano se sustentar**, construir. Se a pesquisa mostrar um caminho
   melhor, escrever a proposta em `docs/` e perguntar ao Gabriel antes de
   construir. Ele não é dev: quer a decisão tomada e explicada curta.

## O que existe hoje (tudo no `main`)

A pesquisa da PCYES funciona de ponta a ponta, mas com regra fixa no código.
Leia `docs/HANDOFF-26-OUT-NPS-PCYES.md` para o contexto completo.

- `src/server/pesquisa-pos-compra.ts`: o evento `pedido.processando` (webhook
  de entrada) cria o contato se não existir, manda o template e abre a sessão
  do fluxo **parada na primeira pergunta** (`noAtual`), uma vez por pedido
  (campo `pedidos_pesquisados`). **Fixo no código**: nome do evento, lista de
  templates (`pesquisa_pos_compra_v3`, `_v2`, `pesquisa_pos_compra`), variáveis
  do template (nome, pedido), imagem (`public/pesquisas/pcyes-pedido-confirmado.jpg`),
  campo de aceite (`dados.aceita_whatsapp`) e o número de teste do Gabriel.
- `src/server/receber-evento.ts`: desvia `pedido.processando` para o módulo
  acima.
- `src/server/receber-mensagem.ts` `paraEntrada`: botão de template
  (`type: 'button'`) agora entra como texto e casa com a pergunta pelo rótulo.
  Antes caía como mídia e ia para uma pessoa (genérico, já vale para todos).
- `src/server/pontos-da-loja.ts` + `src/app/api/loja/pontos/[clienteId]`:
  credita PC Points no Mirasvit (`POST /rest/V1/rewards/transaction`) para um
  par pedido + customer_id com pesquisa aberta, uma vez por pedido, teto 1000,
  alerta se falhar. O fluxo chama essa rota por um nó HTTP com a URL da PCYES
  escrita nele. Liberada no `src/proxy.ts`.
- `src/channels/templates-api.ts` `subirExemploDeMidia` + `src/core/templates.ts`
  (`Exemplos.cabecalhoMidia`) + `src/channels/cloud-api.ts`
  (`valores.cabecalhoImagem`): template com imagem no cabeçalho, criação e
  envio. **A tela de templates ainda não tem upload de imagem.**
- `validarTemplate` barra emoji em botão (a Meta recusa; ★ passa).
- Fluxo "Pesquisa pós-compra" da PCYES (`4c0eb7ce-c658-4ca9-ba81-ce8075e836eb`)
  ligado ao gatilho de evento `af9468b4-...`. Tela Respostas já tem resumo e
  filtro por resposta (feito hoje por outro agente).
- Permissões do Magento da PCYES: `docs/PCYES-MAGENTO-PERMISSOES.md`.

## O plano a validar (4 recursos genéricos, nesta ordem)

1. **Evento que manda template**, configurável em Automações > Eventos:
   evento + fluxo + template aprovado + de onde sai cada variável
   (`{{dados.nome}}`) + imagem do cabeçalho + "criar contato se não existir"
   (exige campo de aceite) + chave de "uma vez por" + número de teste. Ao
   salvar, conferir que a primeira pergunta do fluxo tem os mesmos botões do
   template. Substitui a regra fixa de `pesquisa-pos-compra.ts` (a PCYES
   migra para a configuração sem mudar de comportamento).
2. **Gatilho nativo da loja**, sem o cliente precisar de desenvolvedor:
   "pedido mudou para Processando/Enviado/Entregue", por consulta periódica
   com o token que a conta já conecta (Magento: `GET /rest/V1/orders` por
   `updated_at`; Nuvemshop: ver `src/loja/nuvemshop.ts`). É o diferencial
   para e-commerce. Atenção: a Vercel Hobby só agenda cron diário
   (`vercel.json`); decidir o agendador (cron-job.org, GitHub Actions) e
   registrar em `docs/DECISIONS.md`.
3. **Bloco "Dar pontos"** no editor, ligado ao programa de fidelidade da loja
   (Mirasvit primeiro), no lugar do nó HTTP com URL fixa.
4. **Upload de imagem na tela de templates**, usando `subirExemploDeMidia`.

## Regras deste projeto que pegam aqui

- Banco compartilhado com a Verandi: ler `docs/BANCO-COMPARTILHADO.md` antes
  de qualquer migration; próxima numeração pelo diretório; nunca
  `supabase db push`. Nada em produção sem autorização do Gabriel.
- Next.js desta versão tem mudanças: ler `node_modules/next/dist/docs/`.
- UI: print local 1440 e 390 antes de entregar; tom profissional de SaaS B2B
  na tela; texto para o cliente final no tom da marca, sem duplo sentido nem
  gíria forçada.
- Nenhum travessão longo em arquivo. `npx tsc --noEmit -p .` limpo e testes
  só dos arquivos mexidos. Commit e push na hora com o helper do
  `GITHUB_TOKEN` (ver `docs/HANDOFF-26-OUT-RESPOSTAS-FILTRO-E-RESUMO.md`),
  deploy READY conferido. Feature nova em
  `docs/vantagens/VANTAGENS-AUTOFLUXOS.md`.
- O WSL cai com processo pesado: um build ou teste grande por vez.
