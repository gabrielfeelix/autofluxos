# Handoff 29/out/2026: carrinho abandonado com carrossel

## Decisão

Recuperação de carrinho da loja Magento (PCYES, a confirmar com o Gabriel) por
**modelo de carrossel** da Meta: um cartão por produto (foto, nome, preço,
botão "Finalizar compra"). Mensagem só de texto foi recusada pelo Gabriel
("vira mensagem seca"); foto única no topo também (opção A, descartada).

Quem detecta o abandono é o **Magento** (código do Yuri), que chama a nossa API
pública. Nós não lemos carrinho do Magento; a integração Magento existente não
precisa de permissão nova.

## Já feito

- `fdab4a36`: `POST /api/v1/mensagens/template` recusa modelo MARKETING para
  quem disse SAIR (409 `sem_aceite_de_marketing`). Campos `aceite_marketing:
  true` e `texto_do_aceite` gravam o aceite do checkout (origem `api`). Doc em
  `/ajuda/desenvolvedores/api-enviar-template`. Nenhuma chave de API existe em
  produção (conferido em `chaves_de_api`), então nada quebrou.
- Modelo pronto só texto: `src/core/modelos-prontos.ts` (`ecommerce-carrinho`).

## O que falta (nós)

1. **Conferir as regras do carrossel na doc da Meta** (MCP `meta-devtools`):
   quantidade de cartões (2 a 10), se o envio precisa ter **o mesmo número de
   cartões do modelo** (se sim: um modelo por quantidade, ou cortar em N),
   mesmo formato de cabeçalho e mesmos botões em todos os cartões, limite do
   texto do cartão, exemplo de imagem por `header_handle` (upload resumível).
2. **Tipo**: `Componentes` em `src/core/templates.ts` ganha o carrossel
   (cartões com cabeçalho imagem/vídeo, corpo, botões).
3. **Criar na Meta**: `src/channels/templates-api.ts`, componente `CAROUSEL`,
   com upload das imagens de exemplo.
4. **Tela de criar modelo** com carrossel e prévia. Design: thread principal,
   print 1440 e 390.
5. **Envio**: `src/channels/cloud-api.ts` (`enviarTemplate`) e a API
   (`src/server/api/templates.ts`, hoje recusa mídia com `template_com_midia`).
   Corpo novo: `cartoes: [{ imagem, valores: { corpo }, botao }]`.
6. **Doc**: campos novos na página do endpoint e uma receita "Recuperar
   carrinho abandonado" para o Yuri.
7. **Modelo pronto** do carrossel, com o texto aprovado pelo Gabriel **antes**
   de mandar para a Meta.

Texto proposto (balão de cima): "Oi, {{1}}! Seus itens continuam no carrinho
da PCYES. Se ficou alguma dúvida sobre produto, frete ou pagamento, é só
responder esta mensagem." Cartão: "{{1}} · {{2}}" (nome · preço), botão URL
"Finalizar compra". Rodapé: "Para não receber promoções, responda SAIR."

## Gabriel

- Aprovar o texto acima e confirmar que a loja é a PCYES.
- Criar a chave em AutoFluxos › Configurações › API, só `mensagens:enviar`,
  e passar ao Yuri.

## Yuri (Magento)

- Caixinha de aceite no checkout (ele disse que já fez).
- Rotina a cada ~15 min: carrinho com telefone, aceite marcado, sem pedido há
  60 min, ainda não avisado.
- Chamar a API com telefone, nome, cartões (foto, nome, preço, link do
  carrinho), `aceite_marketing`, e `Idempotency-Key` = id do carrinho.

Custo: marketing, R$ 0,32 por mensagem no Brasil, sem as 1.000 grátis.
