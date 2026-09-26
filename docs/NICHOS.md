# Nichos

> Visão do Gabriel, registrada em 25/set/2026 e ampliada em 26/set/2026.
> **A direção está decidida; a lista de nichos e a ordem, não.** Nada disso
> está construído ainda. Substitui o antigo `FRENTES-POR-SEGMENTO.md`.

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

A regra que a Verandi já usa e que funciona: **o código é um só e neutro; o
nicho é um pacote de configuração.** Lá, o banco diz "pessoa" e a tela diz
Aluno, Cliente ou Paciente conforme a conta (`verandi/src/core/vocabulario/`).

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
| Aulas / estética | MGM Pilates | agenda via Verandi | é território da Verandi: decidir a fronteira |

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

Proposta:

1. Uma **conta de demonstração por nicho** (começando pela pizzaria), com
   cardápio, fotos, PDF e os dois fluxos (botões e IA). É o mesmo pacote que o
   cliente real vai receber, então a demo testa o produto.
2. Uma página pública `4yu.com.br/demo`, onde a pessoa escolhe o ramo e
   conversa pelo widget do canal Site. O QR do flyer pode já cair no ramo
   (`/demo/pizzaria`).
3. **Recomendado junto:** um botão "testar no meu WhatsApp" (link `wa.me`
   para um número de demonstração). Ver o bot no próprio WhatsApp convence
   mais que numa página. Conversa iniciada pelo cliente não é cobrada pela
   Meta, então o custo é baixo; o que custa é a IA, e ela já tem limite.

## Ordem sugerida

1. **Fechar a lista** de nichos da primeira leva (sugestão: restaurante,
   e-commerce, comércio de rua).
2. **Demo da pizzaria**: conta demo, fluxo de cardápio, página e QR. É o que
   destrava a venda na rua, e obriga a construir o pacote do restaurante.
3. **Nicho na conta**: pergunta no onboarding, vocabulário e barra lateral por
   nicho, modelos entregues prontos.
4. **Páginas por nicho no site** da 4yu, apontando para a demo.
5. **Funções que só um nicho usa** (pedido de restaurante, tabela de atacado,
   entrega de exame), uma por vez, conforme cliente real aparecer.

## Em aberto (decisão do Gabriel)

- Quais nichos entram primeiro.
- Aulas, estética e clínicas com agenda: ficam na Verandi, no AutoFluxos, ou
  nos dois (a Verandi agenda, o AutoFluxos conversa)?
- A demo é só página, só WhatsApp, ou os dois?
- Restaurante vai integrar com iFood/cardápio digital existente ou ter
  cardápio próprio no AutoFluxos?
