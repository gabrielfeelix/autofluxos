# Como o mercado cobra pelo chat

Pesquisa de 21/out/2026, cinco frentes em paralelo: plataformas brasileiras,
plataformas de fora, sistemas de nicho (delivery, estúdio, salão, clínica),
gateways com regulação e nota fiscal, pagamento nativo da Meta com lojas
virtuais. Continua `docs/COMPARATIVO-COLMEIA.md`.

Os trechos vieram de leitura automática das páginas; alguns sites bloquearam
(Blip, ManyChat, EVO). O que é inferência está marcado.

## Recomendação

**Cobrança própria com a conta do dono, sem comissão, começando pelo Mercado
Pago.** É o que o mercado faz, e o pedaço que quase ninguém faz bem para quem
não tem sistema.

1. Dono clica em "conectar Mercado Pago" (login, sem copiar chave). Depois,
   Asaas.
2. Robô ou atendente cria a cobrança, com ou sem itens. Sai como mensagem
   nativa de pedido do WhatsApp com Pix copia e cola, e link como alternativa.
3. Pagou, o gateway avisa, o fluxo segue sozinho.
4. Tela **Cobranças**: pendente, paga, vencida, cancelada.
5. Nota fiscal não é nossa. Quem usa Asaas liga a NFS-e lá dentro (R$ 0,49).
6. Quem já tem sistema que cobra (Tecnofit, Next Fit, Magento) não usa isso:
   para eles, conector, um por vez, quando houver cliente.

Esforço: 10 a 14 dias para Mercado Pago, mensagem nativa e tela; Asaas mais 4
a 6.

## O que o mercado faz, em seis regras

**1. A conta do gateway é sempre do lojista.** Ninguém recebe e repassa.
Mercado Pago por login (OAuth), Asaas por chave ou subconta, Stripe Connect.
Vale para Zenvia, Kommo, Digisac, RD Conversas, Umbler, SendPulse, SocialHub,
Wati, Interakt, Zoko, SleekFlow, Yellow.ai, Gallabox.
- [Zenvia + Mercado Pago](https://support.zenvia.com/kb/en/article/466148/mercado-pago-integration-zcc): login com a conta do cliente.
- [Kommo + Mercado Pago](https://support.kommo.com/docs/connect-mercado-pago-to-kommo.md): Client ID e Secret do cliente.
- [Digisac + Asaas](https://digisac.com.br/solucoes/integracoes/asaas): token do cliente.

**2. A plataforma ganha na mensalidade, não no dinheiro que passa.** Nenhuma
brasileira cobra porcentagem. Fora, só a SleekFlow
([taxa por transação + 3,4%](https://sleekflow.io/en-us/blog/omnichannel-payment));
a AiSensy zerou em 1/jul/2026.

**3. Tocar no dinheiro ficou mais caro.** A Resolução BCB 494/2025 acabou com a
dispensa por volume: quem recebe e repassa precisa de autorização do Banco
Central antes de operar, com custo de adequação estimado em R$ 500 mil a R$ 2
milhões ([análise](https://capitalaberto.com.br/regulacao/legislacao-mercados/2025/12/mudancas-estruturais-no-regime-de-autorizacao-de-instituicoes-de-pagamento-as-resolucoes-494-e-495-do-banco-central)).
Inferência: plataforma que só chama a API do gateway, com o dinheiro indo
direto ao dono, fica fora. Antes de cobrar porcentagem por transação, parecer
de advogado de pagamentos.

**4. Onde mora o pedido depende de o negócio ter sistema.**

| Negócio | Onde mora | Como o chat cobra | Exemplos |
|---|---|---|---|
| Loja virtual | na loja | cria carrinho ou pedido na loja e manda o link do checkout; a loja cobra e avisa por webhook | [Shopify draft order](https://help.shopify.com/en/manual/orders/create-orders/send-draft), [Nuvemshop](https://www.nuvemshop.com.br/canais/whatsapp), [Gorgias](https://docs.gorgias.com/en-US/shopify-actions-461552) |
| Sistema de nicho com pagamento | no sistema | o próprio sistema cobra; o chat só avisa | Tecnofit (conta digital), [Next Fit Pay](https://ajuda.nextfit.com.br), Trinks (Stone), Anota AI, Goomer |
| Cobrança já no Asaas | no Asaas | robô consulta e manda 2ª via ou Pix | [Digisac](https://digisac.com.br/solucoes/integracoes/asaas), RD Conversas, Umbler |
| Sem sistema | na plataforma de chat, quando ela tem tela; senão em lugar nenhum | link avulso, ou cobrança com tela própria | [Interakt](https://interakt.shop/resource-center/whatsapp-pay-with-interakt/) (painel de pedidos), [SocialHub](https://www.socialhub.pro/blog/cobranca-pix-whatsapp-dentro-da-conversa/), [SendPulse](https://sendpulse.com/br/blog/whatsapp-pay) |

A maioria das brasileiras para no link avulso ou na consulta ao Asaas. Tela de
cobrança com status que volta sozinho só SocialHub e SendPulse descrevem.

**5. Nota fiscal: nenhuma plataforma de chat emite.** Fica com o lojista, a
loja ou o ERP (Tiny, Bling). Os sistemas de nicho emitem por parceiro:
Tecnofit via e-Notas (R$ 59/mês + R$ 0,10), Next Fit via PlugNotas. As APIs de
nota (Focus, eNotas, PlugNotas) exigem certificado A1 do lojista, atrito
grande para pequeno negócio. O Asaas emite NFS-e embutida
([R$ 0,49](https://asaas.com/nota-fiscal)).

**6. O Pix nativo do WhatsApp está chegando, pelo topo.** A Meta oferece no
Brasil a mensagem de pedido (`order_details`) com Pix copia e cola, link,
boleto e, por convite, cartão
([Payments BR](https://developers.facebook.com/documentation/business-messaging/whatsapp/payments/payments-br/orders)).
Não cobra pelo pagamento, só pela mensagem. Exige um gateway que gere o Pix e
avise o pagamento; a Meta não concilia. Quem usa: VTEX (recuperação de carrinho
até 3,6x, [notícia](https://www.letsmoney.com.br/noticias/vtex-pix-whatsapp-conversao-3-6x/)),
Nuvemshop (Nuvem Chat), Sem Parar, e entre as plataformas de chat brasileiras
só a Blip. Nas pequenas, ninguém.

## Gateways: qual suportar

| Gateway | Como liga a conta do dono | Pix / link / recorrência / boleto | Taxa do dono | Nota |
|---|---|---|---|---|
| [Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/security/oauth) | login (OAuth), um clique | sim / sim / sim / sim | Pix 0,99% | não emite |
| [Asaas](https://docs.asaas.com/docs/criacao-de-subcontas) | chave de API ou subconta criada por nós | sim / sim / sim / sim | Pix R$ 1,99 | NFS-e R$ 0,49 |
| [Woovi](https://woovi.com/pricing) | subconta | só Pix | 0,80% ou R$ 0,85 | não |
| [Efí](https://sejaefi.com.br/tarifas) | só entre contas Efí | sim / sim / Pix Automático / sim | Pix 1,19% | não |
| [Stripe](https://docs.stripe.com/payments/pix) | Connect | Pix só por convite, sem recorrência no Brasil | cartão 3,99% + R$ 0,39 | não |

Mercado Pago primeiro: conectar é um login, e o dono de pequeno negócio quase
sempre já tem conta. Asaas em seguida: é o mais integrado pelas plataformas
brasileiras (Digisac, RD, Umbler, BotConversa) e por software de pilates, e
resolve a nota. Os outros só se um cliente pedir.

## O que isso muda no plano

- Confirma a camada 1 do `COMPARATIVO-COLMEIA.md`: conta do dono, sem tocar no
  dinheiro, tela própria de cobranças.
- Junta a cobrança à mensagem nativa da Meta desde o começo: o Pix já vem do
  gateway, e a mensagem de pedido é só o formato. Nenhuma plataforma pequena
  faz isso no Brasil.
- Com Asaas, ganhar de brinde o que Digisac e Umbler vendem: consultar
  cobrança que já existe e mandar 2ª via.
- Estúdio com Tecnofit ou Next Fit não é público da cobrança própria: eles já
  cobram, e as APIs desses sistemas são só de leitura, pagas ou sem aviso de
  pagamento.

## Loja pequena

Dois casos diferentes.

**Com loja virtual (Nuvemshop, Loja Integrada, Shopify).** O pedido mora na
loja, como em qualquer loja virtual: o robô monta o carrinho e cria o pedido
lá, a loja cobra, baixa estoque e avisa. Na Nuvemshop já temos login e leitura
(FUNCIONALIDADES.md:291); falta escrever o pedido. Atenção: a Nuvemshop tem o
próprio [Nuvem Chat](https://www.nuvemshop.com.br/solucoes/nuvem-chat), com
Pix no chat, competindo pelo mesmo lojista.

**Sem loja virtual (vende pelo Instagram e pelo WhatsApp).** É a maioria, e
ninguém guarda o pedido dela: hoje é caderno e print de Pix. Aqui a cobrança
sozinha não basta, porque loja tem item, entrega e estoque. Precisa de
**pedido leve**, por cima da cobrança:

| Peça | Hoje | Falta |
|---|---|---|
| Produtos | catálogo próprio com planilha (FUNCIONALIDADES.md:285-287) | estoque simples e variação (tamanho, cor) |
| Montar o pedido | IA monta e soma no servidor (FUNCIONALIDADES.md:296) | gravar o pedido |
| Entrega | nada fora do Magento | retirada ou entrega com taxa por bairro ou fixa |
| Pagamento | demonstração | a cobrança deste documento |
| Acompanhar | nada | tela **Pedidos**: novo, pago, separando, enviado, entregue, cancelado; cliente avisado a cada passo |

Pedido e cobrança são o mesmo objeto: a cobrança é o centro, o pedido é uma
cobrança com itens e entrega. Assim a tela de estúdio e a de loja não viram
dois produtos.

Esforço: 6 a 8 dias depois da cobrança. Nota fiscal continua fora (inferência,
a confirmar com contador: MEI não é obrigado a emitir nota para pessoa física).

Ordem: cobrança primeiro (serve estúdio, serviço e loja), pedido leve depois,
conector de loja virtual quando um cliente pedir.

## Não confirmado

- Se a mensagem de pedido da Meta exige catálogo ligado ao número (a Meta diz
  que `catalog_id` é opcional; um parceiro diz que exige).
- Se o Mercado Pago permite taxa da plataforma em Pix (a documentação de split
  só mostra cartão). Irrelevante enquanto não cobrarmos porcentagem.
- Se o limite de 10 subcontas do Asaas em "avaliação regulatória" ainda vale.
- Preço atual de vários sistemas de nicho (páginas de preço fora do ar).
- Como a Nuvemshop e a VTEX implementam o Pix no chat por baixo.
