# Handoff 27/out/2026: pesquisa pós-compra da PCYES, o que falta

Leia antes: `docs/HANDOFF-26-OUT-NPS-PCYES.md` (contexto e decisões),
`docs/PCYES-MAGENTO-PERMISSOES.md` (o que o token da loja alcança) e
`docs/RUNBOOK-WHATSAPP-PORTFOLIO-ERRADO.md` (a queda de 26/out e o conserto).

## Onde está

**Funciona de ponta a ponta quando o evento chega.** O evento
`pedido.processando` (webhook de entrada ou chamada a `tratarEvento`) cria o
contato, manda o template e abre a conversa do fluxo parada na 1ª pergunta.

- Gatilho da PCYES (`gatilhos_de_evento` af9468b4-969a-4168-945c-f25aee97dac1),
  configuração em `gatilhos_de_evento.modelo`: modelos `["pesquisa_pos_compra_v4"]`,
  `imagem` = `https://autofluxos.4yu.com.br/pesquisas/pcyes-pedido-confirmado.jpg`,
  variáveis `nome, pedido`, `umaVezPor: pedido`, `campoDeAceite: aceita_whatsapp`,
  `criarContato: true`, `telefonesDeTeste: ["5544998775978"]`.
  Código: `src/core/evento-com-modelo.ts`, `src/server/evento-com-modelo.ts`.
- Template `pesquisa_pos_compra_v4` (UTILITY, aprovado): mascote no cabeçalho,
  botões "Foi ótima / Foi ok / Tive um problema". v1, v2, v3 foram excluídos.
  Template com imagem exige `config.imagem`; sem ela o envio é recusado
  (commit 9e8b4961). O Inbox mostra imagem e botões do modelo (390a4e3f).
- Fluxo "Pesquisa pós-compra" (4c0eb7ce-c658-4ca9-ba81-ce8075e836eb),
  **versão 9 publicada, ainda não testada**. Textos aprovados pelo Gabriel um a
  um; caminho negativo põe a etiqueta "Pesquisa: problema"; o fim depende de
  `frete = "Bom preço e opções"`. Pontos: nó HTTP para
  `/api/loja/pontos/<clienteId>` (`src/server/pontos-da-loja.ts`), 250 pontos,
  uma vez por pedido, alerta se falhar.
- Mirasvit: `POST /rest/V1/rewards/transaction` funciona com o token da loja.
  Cliente Magento do Gabriel = 182, do Rodrigo = 139.
- WhatsApp da PCYES voltou ao Grupo Oderço em 27/out 08:46; histórico do
  período fora do ar foi pedido (sync de histórico, commit 3b6a980c).

## O que falta (na ordem)

1. **Testar a versão 9** pelo número do Gabriel (`tratarEvento` com
   `pedido: "TESTE-4"`, `customer_id: 182`), passando pelos caminhos ruins e
   bons. Conferir: textos, etiqueta, `pedidos_com_pontos`, saldo no Mirasvit
   (`GET /rest/V1/rewards/balances/182`). O teste do Rodrigo (`TESTE-RODRIGO-2`)
   está numa versão antiga do fluxo.
2. **Cron de pedidos (o pedido do Gabriel)**: rota protegida por segredo, no
   padrão de `/api/manutencao/*`, que lê `GET /rest/V1/orders` com
   `status=processing` e `updated_at` desde a última rodada (guardar marcador
   com folga), e para cada pedido chama `tratarEvento` com
   `{ pedido: increment_id, nome: firstname, customer_id, aceita_whatsapp }`.
   O telefone vem de `billing_address.telephone`. A uma vez por pedido já é
   garantida pelo gatilho (`umaVezPor`). A Vercel Hobby só agenda cron diário:
   usar agendador externo (cron-job.org) a cada 5 min e registrar a decisão em
   `docs/DECISIONS.md`. **Enquanto o aceite não existir no site, só o número de
   teste recebe**; o cron pode ir ao ar assim.
3. **Webhook de entrada da PCYES não existe ainda** (o Gui vai mandar o aviso
   direto). O Gabriel cria em Automações > Eventos e passa o segredo ao Gui.
   Quando o Gui ligar, decidir se o cron fica como reserva ou sai.
4. **Aceite no site (card do Yuri)**: atributo `aceita_whatsapp` no cadastro.
   Ver `PENDENCIAS-DO-GABRIEL.md`. O token já lê cliente.
5. **Revisar o que sobrou**: tela de Eventos não tem campo para `imagem` (foi
   gravada direto no banco); pasta de backup
   `4yu-apps/.secrets/backup-pcyes-2026-10-27/` deve ser apagada depois que o
   histórico voltar; portfólio "PCYES FAN" ficou vazio (não apagar sem o Gabriel).

## Regras que pegam aqui

- **Texto que o cliente final lê (fluxo, template): propor e só publicar com o
  ok explícito do Gabriel.** Ele afina cada palavra. Sem duplo sentido, sem
  gíria forçada, sem "obrigado" com gênero ("agradecemos"), sem repetir a
  mesma frase de acolhimento em etapas seguidas.
- Commit **só por pathspec** (`git commit -- arquivo`): outra sessão trabalha
  na mesma pasta e já levamos arquivo alheio por engano.
- Banco compartilhado com a Verandi (`docs/BANCO-COMPARTILHADO.md`); nada em
  produção sem autorização. tsc limpo, testes só dos arquivos mexidos, push
  com o helper do `GITHUB_TOKEN`, deploy READY conferido.
- Gabriel quer caminho que ele mesmo executa, curto, sem "espera o suporte".
- Nenhum travessão longo em arquivo.
