# Nichos

> Visão do Gabriel, registrada em 25/set/2026 e ampliada em 26/set/2026.
> **Direção e primeira leva decididas em 26/set** (ver "Decisões"). Nada
> disso está construído ainda. Substitui o antigo `FRENTES-POR-SEGMENTO.md`.

## A ideia em uma frase

O AutoFluxos deixa de ser um construtor em branco (tipo Botconversa, onde o
cliente monta tudo) e passa a ser **direcionado pelo ramo do cliente**: a
pizzaria abre a conta e já encontra cardápio, bot de pedido e funil prontos;
só preenche os dados dela.

## O que muda por nicho

| O quê | Exemplo: restaurante | Exemplo: e-commerce |
|---|---|---|
| Nome e itens da barra lateral | "Comércio" vira **Cardápio** | "Comércio" fica **Produtos** |
| Modelos prontos (fluxo, funil, IA) | pedido, cardápio em foto/PDF, horário | busca, frete, status do pedido, carrinho |
| Integrações sugeridas | (a definir: iFood? cardápio próprio) | Magento, Shopify |
| Canal principal | WhatsApp | widget no site + WhatsApp |
| Página no site 4yu | `/autofluxos/restaurantes` | `/autofluxos/e-commerce` |

## Como construir sem virar cinco sistemas

**O código é um só e neutro; o nicho é um pacote de configuração.** O banco
continua dizendo "produto", e a tela diz Cardápio, Produtos ou Catálogo
conforme o nicho da conta.

Aqui o pacote do nicho define:

1. vocabulário da tela (Cardápio x Produtos x Catálogo);
2. quais seções aparecem na barra lateral e em que ordem;
3. quais fluxos, funis e instruções de IA a conta recebe prontos;
4. os valores iniciais que já existem hoje: `clients.objetivo`
   (`atender`, `automatizar`, `vender`), `crm_ativo` e `loja_ativa`.

O nicho mora **na conta**, escolhido no onboarding, nunca na ficha do contato.
Ele não substitui o objetivo: uma pizzaria pode querer só atender, outra quer
vender. O nicho sugere o objetivo, o dono pode trocar.

Regra de trabalho que vale desde já: ao construir algo, anotar a qual nicho
serve e **não amarrar regra de um nicho no núcleo comum**. Hoje o núcleo já
mistura dois: `src/server/ia/prompt.ts` liga o bloco de venda quando há
`loja_buscar`, e agenda e loja convivem em `src/core/ferramentas.ts`.

## Nichos candidatos

| Nicho | Cliente real | O que já existe | O que falta de mais óbvio |
|---|---|---|---|
| E-commerce (site) | PCYES (Magento) | busca, card, frete, pedido, manuais, cores | pouco: é o mais pronto |
| Restaurante / delivery | nenhum | catálogo manual, envio de foto e PDF | cardápio por categoria, sabores e adicionais (meia a meia), pedido com endereço e taxa, horário de funcionamento |
| Comércio de rua | nenhum | respostas rápidas, IA com base de conhecimento | "vocês têm X?", horário, localização, preço rápido |
| Distribuidor / atacado | nenhum | nada específico | tabela de preço por cliente, pedido mínimo, recompra |
| Saúde (clínica, farmácia, exames) | nenhum | envio de PDF | entrega de exame, CPF por formulário, LGPD dura |
| Serviço com agenda (aulas, estética, clínica) | MGM Pilates | agenda por integração | ver "Nicho com agenda" abaixo |

### Nicho com agenda

O AutoFluxos não vira sistema de gestão. Se o negócio já tem sistema próprio,
o bot usa o dele por integração. Se não tem, o bot funciona com as
informações básicas que o dono cadastrar (horário, serviços, preços), sem
banco de dados de clientes nem agenda.

### Saúde: o que já se sabe

Referência que o Gabriel recebeu como paciente (25/set, "Eliz", assistente de
uma clínica de imagem): abertura com nome e aviso "nunca solicitamos
pagamentos", botão que abre formulário do WhatsApp pedindo o CPF, exame
entregue como **PDF anexado com a explicação na legenda**, e pesquisa de
satisfação (NPS 0 a 10) também em formulário.

Atenção: dado de saúde é **dado sensível** na LGPD (art. 11). Esse fluxo manda
senha de portal em texto na conversa, e isso não é para copiar.

## A demonstração para vender na rua

A cena: 16h, pizzaria vazia. O vendedor entrega um flyer com QR code. O dono
aponta a câmera e **conversa com um bot de pizzaria de verdade**: pede o
cardápio, recebe a imagem do cardápio, pergunta de um prato, recebe a foto,
monta um pedido. E pode ver a mesma coisa em dois modos: **chatbot** (botões)
e **IA** (conversa livre).

### Como fazer, com o que já existe

Duas peças prontas servem de base:

- **Vitrine de fluxo** (`src/app/f/[token]/page.tsx`): qualquer pessoa, sem
  login, conversa com um fluxo publicado, com IA e limite de uso. Falha para a
  pizzaria: não tem conta por trás, então não enxerga cardápio nem fotos.
- **Canal Site** (`public/chat/v1.js`): conversa sem WhatsApp, com conta real,
  então catálogo, IA e mídia funcionam. Só aceita os domínios cadastrados.

Decidido: **WhatsApp primeiro, página depois.**

1. Um **número de demonstração** no WhatsApp. O QR do flyer abre a conversa
   (link `wa.me` com texto pronto). O bot pergunta o ramo (pizzaria, loja,
   comércio) e, dentro dele, se a pessoa quer ver com botões ou com IA.
2. Por trás, uma **conta de demonstração** com cardápio, fotos, PDF e os
   fluxos do nicho. É o mesmo pacote que o cliente real vai receber, então a
   demo também testa o produto.
3. **Depois**, a página `4yu.com.br/demo` com o widget do canal Site, para
   anúncio e site, onde abrir o WhatsApp é um passo a mais.

Por que WhatsApp primeiro: é onde os clientes da pizzaria já estão, então o
dono vê exatamente o que o cliente dele vai ver; não precisa construir página;
e o menu de escolha do ramo já é um fluxo nosso. Conversa iniciada pelo
cliente não é cobrada pela Meta; o que custa é a IA, e ela já tem limite.

## Restaurante: cardápio próprio ou iFood

O dono escolhe. Nem todo restaurante está no iFood, então o **cardápio
próprio** no AutoFluxos vem primeiro; o iFood entra como opção.

O iFood tem API pública para parceiros (Merchant API), e o módulo de
catálogo organiza cardápio em categoria, item e complemento, que é o que o bot
precisa ler. Custo de entrada: o integrador desenvolve, marca uma validação
com o iFood em loja de teste, é homologado, e cada restaurante aceita a
permissão no portal do parceiro. Referência:
https://developer.ifood.com.br/pt-BR/docs/guides/modules/catalog/workflow

## Concorrente: Agendor

O Agendor (CRM B2B) tem páginas por segmento (indústria, distribuidora,
transportadora, máquinas), mas **o produto é o mesmo** para todos: muda só o
argumento de venda. Não há tela, funil pronto nem demo por segmento
(https://www.agendor.com.br/solucoes, lido em 26/set). A nossa ideia vai além:
o sistema muda de verdade por nicho.

## Ordem

1. **Demo da pizzaria**: número e conta demo, fluxo de cardápio, QR. É o que
   destrava a venda na rua, e obriga a construir o pacote do restaurante.
2. **Nicho na conta**: pergunta no onboarding, vocabulário e barra lateral por
   nicho, modelos entregues prontos.
3. **Páginas por nicho no site** da 4yu, apontando para a demo.
4. **Funções que só um nicho usa** (pedido de restaurante, tabela de atacado,
   entrega de exame), uma por vez, conforme cliente real aparecer.

## Decisões (26/set)

- Primeira leva: **restaurante, e-commerce, comércio de rua**.
- Nicho com agenda: usa o sistema do cliente por integração; sem sistema,
  bot com informações básicas.
- Demo: WhatsApp primeiro, página depois.
- Restaurante: cardápio próprio primeiro; iFood como opção do dono.

## Número da demo

- Número da demo: +55 44 7400-7438 (número de teste do Gabriel). Desde 26/set está na conta própria "4YU Tech Demonstração", não mais na PCYES. Como funciona, ids e como voltar: `docs/DEMO.md`.
