# Pesquisa: cardápio digital e delivery próprio (27/out/2026)

Pergunta do Gabriel: quais plataformas de cardápio/pedido próprio de restaurante
(pizzaria, padaria, doceria) dá para plugar no AutoFluxos para **puxar o
catálogo** (produto, foto, descrição, adicionais) e **puxar o status do pedido**
(saiu para entrega, chegando) para o bot avisar quem pediu.

Fora do escopo, por decisão: marketplaces (iFood, 99Food, Keeta). Lá o cliente
acompanha pelo app, e o iFood nem entrega o telefone real (manda 0800 +
localizador de 8 dígitos). Concorrente direto também fica de fora.

## Mercado

- Abrasel, mar/2025, 2.176 donos: faturamento do delivery por canal é
  marketplace 54%, **WhatsApp 26%**, app/site próprio 12%, telefone 8%. 46% fora
  de marketplace. 39% entregam com **motoboy próprio**, 26% com avulso.
- Quase todo cardápio digital grande **já avisa o status no WhatsApp**, mas a
  maioria por WhatsApp Web ou QR code (não oficial): computador ligado, janela de
  24h, número banido (Anota AI tem 780 reclamações no Reclame Aqui).
- **Goomer é a exceção**: o maior em cadastros (500 mil, ~25 mil pagantes) e só
  abre o WhatsApp Web com texto pronto quando aceita o pedido. Nada de "saiu
  para entrega".
- Dor real (Reclame Aqui): pizzaria que não responde "cadê meu pedido" no pico.

## Plataforma por plataforma

| Plataforma | Catálogo pela API | Status pela API | Telefone real | Credencial | Já avisa o cliente? | Veredito |
|---|---|---|---|---|---|---|
| **Goomer** | Sim (Open Delivery `/merchant`: foto, descrição, adicionais) | Webhook Open Delivery + polling | não confirmado | Parceria: falar com a Goomer | **Não** (só texto pronto manual) | **Alvo nº 1** |
| **Cardápio Web** | Sim, completo (`/catalog`: foto, descrição, complementos, combos) | Webhook `ORDER_STATUS_UPDATED`, 12 status | Sim | App Store deles (e-mail, até 7 dias) ou API Key do lojista | Sim (extensão de WhatsApp Web ou Meta oficial) | Concorrente parcial: só catálogo e "cadê meu pedido" |
| **OlaClick** | `GET /v1/menu` (foto não confirmada) | Webhook `ORDER_UPDATED` | não confirmado | API Key do lojista (planos pagos) ou Hub OAuth | Sim (bot próprio) | Concorrente parcial |
| **Delivery Direto** | Sim, completo | Webhook `ORDER_STATUS_CHANGED` (sem "em preparo") | Sim | Parceiro pede client_id; lojista cria usuário de API | Sim (robô oficial) | Concorrente |
| **Foody Delivery** (motoboy) | n/a | Webhook; status `onGoing` traz posição; `orderTrackerUrl` | não verificado | Token do lojista no painel | Página de rastreio | **Complemento**: a fonte do "está chegando" |
| **Open Delivery** (padrão Abrasel) | `GET /v1/merchant` | Webhook `newEvent` (HMAC) + polling; `DISPATCHED`, `DELIVERED`, ETA e entregador | Pode vir número de central | client_id/secret por loja, emitido pelo cardápio | n/a | Camada única p/ Goomer, Cardápio Web e aderentes |
| Saipos (iFood) | Não p/ terceiros | Só consulta, atraso até D+1, R$ 59,90/loja/mês | Sim | Token pago | Sim (Saipos Bot, QR code) | Concorrente |
| Anota AI (iFood) | API de parceiro | API de parceiro | ? | Formulário | Sim (robô de WhatsApp) | **Concorrente direto** |
| Brendi, Yooga, MeuCardapio.ai | sem API pública | | | | Sim | Concorrentes |
| Consumer, Neemo | API só no sentido contrário / polling fraco | | | | | Depois |
| Kyte, GrandChef, OnChef, Cardápio Fácil, Instadelivery | sem API pública | | | | | Descartar |

Detalhe técnico completo (endpoints, nomes de evento, auth): relatórios dos
agentes de pesquisa de 27/out; os pontos que importam estão na tabela.

## Recomendação

1. **Open Delivery genérico, começando pela Goomer** (contato de parceria). Uma
   implementação cobre Goomer, Cardápio Web OD e os aderentes. Validar antes se
   a plataforma aceita um consumidor que só escuta, sem roubar o
   `acknowledgment` do PDV do lojista.
2. **Foody** como fonte de posição/ETA do motoboy ("está chegando").
3. **Recurso próprio, sem integração**, para os 39% com motoboy próprio e quem
   pede por WhatsApp/telefone sem sistema: link do entregador no AutoFluxos com
   botão "saí" e "entreguei", que dispara o modelo. Ninguém cobre isso.
4. Cardápio Web: só leitura de catálogo, se um cliente pedir.

Custo da Meta: modelo de utilidade ~R$ 0,035 por mensagem fora da janela. Quem
pediu pelo WhatsApp está dentro da janela de 24h, então o aviso dele é grátis.

## Fontes principais

- Abrasel/Mobile Time: https://www.mobiletime.com.br/noticias/14/03/2025/whatsapp-bar-restaurante/
- Goomer, aviso manual: https://ajuda.goomer.com.br/goomergo/painel/pedidos/gestor-de-pedidos/enviar-mensagem-ao-aceitar-pedido
- Goomer Open Delivery: https://partner-api.goomer.app/opendelivery/docs.html
- Cardápio Web API: https://docs.cardapioweb.com/llms.txt
- Cardápio Web, integração Meta: https://ajuda.cardapioweb.com/automacao/food-marketing-campanhas-via-whatsapp/integracao-oficial-com-a-meta
- OlaClick: https://developers.olaclick.app/docs/webhooks
- Delivery Direto: https://developers.deliverydireto.com.br/admin-api/docs/
- Foody: https://help.foodydelivery.com/knowledge-base/foody-delivery-api-v1-2/
- Open Delivery spec: https://github.com/Abrasel-Nacional/opendelivery
- Saipos dados: https://saipos-data-api.readme.io/reference/introducao.md
- Anota AI robô: https://anota.ai/ajuda/atendimento-robo/
- iFood telefone mascarado: https://ajuda.programaconsumer.com.br/duvidas-gerais-sobre-a-integracao-com-o-ifood/
