# Handoff 26/out/2026: pesquisa pós-compra da PCYES (NPS com PC Points)

## O que é

Quando um pedido da PCYES vira **Processando** no Magento, o cliente recebe
pelo WhatsApp um template que já é a 1ª pergunta. Mais duas perguntas na
conversa e, ao terminar, **250 PC Points** entram na conta dele no Mirasvit.
Uma vez por pedido. Uma etapa só (não há pesquisa de entrega).

Conta PCYES: `client_id 64dbc3a9-1f77-4892-9770-e3e4be9e14cd`, Magento em
`https://www.pcyes.com.br`, token já conectado na conta (`lojaDaConta` +
`lerCredencial`, conexão "Magento PCYES produção (somente leitura)").

**Testar só com o Gabriel**: telefone 44998775978, cliente Magento 182
(gab.feelix@gmail.com). DDD 44 é dele. Nada sai para cliente real até o
aceite de WhatsApp existir no site (ver Pendências, card do Yuri).

## Roteiro aprovado pelo Gabriel (texto final)

**Template (utilidade, sem falar de pontos: prêmio no template vira marketing,
~9x mais caro):**
> Olá, {{1}}! Seu pedido #{{2}} na PCYES foi confirmado e já está em separação.
> Como foi sua experiência de compra no site?
>
> [Foi ótima] [Foi ok] [Tive um problema]

**Na conversa (mensagens de sessão, grátis):**
1. "Tive um problema": *"Poxa! O que aconteceu?"* (texto livre). Os outros
   dois seguem direto.
2. *"Obrigado! Mais duas perguntas rápidas e você ganha **250 PC Points** 🎮"*
3. *"Como foi pagar? Encontrou a forma de pagamento que queria?"*
   [Foi fácil] [Tive dificuldade]. Dificuldade: *"O que dificultou?"*
4. *"E o frete: o que achou do preço e das opções de envio na hora de
   comprar?"* [Bom preço e opções] [Achei caro] [Poucas opções]. As duas
   ruins: *"O que faltou? Ex.: transportadora, prazo menor, retirada"*
5. Credita os pontos e manda *"Pronto! 250 PC Points já estão na sua conta 🎉
   Dá pra usar na próxima compra."*

Cada resposta com `salvarEm` próprio (experiencia, pagamento, frete e os
comentários): é o que a tela Respostas usa para o filtro e o resumo (outro
agente está fazendo, `docs/HANDOFF-26-OUT-RESPOSTAS-FILTRO-E-RESUMO.md`).

## O que já foi provado (26/out/2026)

- **Ler pedido**: `GET /rest/V1/orders` com o token responde status, telefone
  (`billing_address.telephone`), nome, pagamento e frete. Status usados pela
  loja: `processing`, `delivered`, `canceled`, `closed`, `holded`.
- **Ler cliente**: `GET /rest/V1/customers/{id}` responde (liberado hoje).
- **Creditar pontos**: `POST /rest/V1/rewards/transaction` com
  `{"transaction":{"customer_id":182,"amount":1,"comment":"..."}}` criou o
  lançamento 288 e o saldo foi de 0 para 1. `amount` é em pontos.
  `GET /rest/V1/rewards/balances/{customerId}` lê o saldo. As rotas no plural
  para escrita não existem (404).
- **Webhook genérico no Magento: não existe**, e nenhuma permissão cria um.
  `GET /rest/V1/modules` lista 514 módulos; o do ActiveCampaign só sincroniza
  com o ActiveCampaign. Por isso o plano A pergunta ao Magento.

## Arquitetura decidida

**Plano A, sem depender da PCYES: perguntar ao Magento a cada 5 minutos.** A
permissão já existe (Vendas > Meus Pedidos > Visualizar, ver
`docs/PCYES-MAGENTO-PERMISSOES.md`). A rotina busca
`GET /rest/V1/orders` com `status=processing` e `updated_at` desde a última
rodada (guardar o marcador com folga de alguns minutos), e para cada pedido
novo dispara a pesquisa. Atraso de até 5 min é aceitável para pesquisa.

- **Agendador**: a Vercel no Hobby só roda cron uma vez por dia
  (`vercel.json`). Use um agendador gratuito de fora chamando uma rota nossa
  protegida por segredo (padrão das rotas `/api/manutencao/*`): cron-job.org
  ou GitHub Actions (`schedule`, mínimo 5 min, pode atrasar). Preferir
  cron-job.org pela pontualidade; documentar onde ficou.
- **Plano B, opcional**: módulo do Gui avisando o nosso webhook de entrada
  (mensagem pronta mais abaixo). Só se o atraso incomodar.

O que falta do nosso lado:

1. **Contato novo a partir do pedido.** Quem compra no site quase nunca falou
   com a PCYES no WhatsApp. O caminho de evento hoje não cria contato
   (`src/server/receber-evento.ts` ~65, decisão contra contato fantasma). A
   rotina cria o contato com nome e telefone do pedido, só quando houver
   aceite; registrar a decisão em `docs/DECISIONS.md`.
2. **Uma vez por pedido**: guardar o número do pedido já pesquisado (em
   `contacts.campos` ou tabela própria; tabela exige migration, ler
   `docs/BANCO-COMPARTILHADO.md`).
3. **Template**: criar pelo nosso módulo de templates (`src/core/templates.ts`)
   na WABA da PCYES, utilidade, 3 botões de resposta rápida.
4. **Botão do template abre o fluxo da pesquisa.** Hoje a resposta de botão de
   template chega como texto (`receber-mensagem.ts` ~3092). Garantir que o
   toque cai na 1ª pergunta do fluxo e é gravado como resposta dela.
5. **Fluxo da pesquisa** na conta PCYES (pode criar e publicar, o roteiro está
   aprovado). Publicar sempre pelo `publicar()` de `src/server/repos/fluxos.ts`.
6. **Crédito dos pontos**: no fim do fluxo, 250 pontos para o `customer_id` do
   pedido, comentário "Pesquisa de satisfação do pedido #<n>". Arquivo novo
   (não em `loja/magento-admin.ts`, que por regra só lê), com trava de uma vez
   por pedido.
7. **Até o aceite existir**, a rotina só manda para o número de teste do
   Gabriel (44998775978). Ligar para todos é decisão dele depois do card do
   Yuri.

## Mensagem para o Gui (plano B, só se precisar)

> Gui, o que precisamos é pequeno: um módulo que, quando o status de um pedido
> **muda para processing**, faça um POST para
> `https://autofluxos.4yu.com.br/api/webhook/entrada/64dbc3a9-1f77-4892-9770-e3e4be9e14cd`
> com o JSON
> `{"evento":"pedido.processando","telefone":"<telefone do pedido>","dados":{"pedido":"<increment_id>","nome":"<primeiro nome>","customer_id":<id>,"email":"<email>"}}`
> e o cabeçalho `x-autofluxos-assinatura: sha256=<HMAC-SHA256 do corpo, em hex>`
> com um segredo que eu te passo. Só na mudança para processing, fora da
> requisição do checkout (fila ou cron), com nova tentativa se não voltar 200.

O segredo nasce em Automações > Webhooks de entrada na conta PCYES; nunca
colar o valor em doc, commit ou chat.

## Regras deste projeto que pegam aqui

Banco compartilhado com a Verandi (`docs/BANCO-COMPARTILHADO.md`), nunca
`supabase db push`. Próxima migration pelo diretório. tsc limpo e testes só
dos arquivos mexidos. Commit e push na hora (helper do `GITHUB_TOKEN`, ver
`docs/HANDOFF-26-OUT-RESPOSTAS-FILTRO-E-RESUMO.md`), deploy READY conferido.
Nenhum travessão longo em arquivo. Feature nova em
`docs/vantagens/VANTAGENS-AUTOFLUXOS.md`.
