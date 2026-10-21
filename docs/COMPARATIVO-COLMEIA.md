# AutoFluxos contra Colmeia

Pesquisa de 21/out/2026. Fontes: site da Colmeia, documentação da Meta e o
código deste repositório. Nada foi implementado: é proposta para aprovação.

## Recomendação

**Construir primeiro o bloco "Cobrar" (Pix e link de pagamento por gateway).**

1. É o único item da lista que os dois clientes reais usariam no mês seguinte:
   a MGM cobra mensalidade e aula avulsa, a PCYES fecha pedido na conversa e
   hoje manda o cliente para o site pagar.
2. O pedido já é montado e somado no servidor (FUNCIONALIDADES.md:296); falta só
   a cobrança de verdade. O pagamento atual é demonstração (FUNCIONALIDADES.md:304).
3. Foi o buraco de mercado já apontado em `docs/CONCORRENTES-22-SET-PROFUNDIDADE.md:22-40`:
   os concorrentes brasileiros pedem para o dono montar requisição REST na mão.
4. Não depende da Meta para funcionar. A versão "nativa" do WhatsApp (mensagem
   `order_details` com Pix) vem por cima depois, usando o mesmo gateway.

Junto, por ser barato e proteger o número: **opt-out por "SAIR" e registro de
opt-in**. A Colmeia também não mostra isso no site, mas a Meta exige.

## Quem é a Colmeia

Empresa de Uberlândia, parceira oficial da Meta (BSP), focada em banco,
financeira, seguradora e faculdade: Banco Mercantil, Digio, Rodobens,
ConCrédito, Uniube ([casos](https://colmeia.cx/casos-de-transformacao-digital/)).
**Preço não é público**: só "agende uma demonstração", com formulário que
começa em 5.000 atendimentos por mês ([integrações](https://colmeia.cx/integracoes/)).

Não é concorrente direta: vende projeto para empresa grande. O AutoFluxos vende
assinatura de R$ 297 a R$ 1.197 para pequeno negócio (FUNCIONALIDADES.md:390-394).
Serve como referência do que o mercado grande já espera.

## Matriz de recursos

Legenda: **tem**, **parcial**, **não tem**, **?** (não confirmado).

| Recurso | Colmeia | Fonte Colmeia | AutoFluxos | Fonte AutoFluxos |
|---|---|---|---|---|
| WhatsApp API oficial | tem (BSP) | [integrações](https://colmeia.cx/integracoes/) | tem | FUNCIONALIDADES.md:33-39 |
| Coexistência com o app do celular | ? | não citada | tem | `src/server/receber-coexistencia.ts` |
| Webchat no site | tem | [home](https://colmeia.cx) | tem, com ligação de voz | FUNCIONALIDADES.md:46-51, `src/server/chamadas.ts` |
| Instagram Direct | tem | [Smartflow](https://colmeia.cx/smart-flow) | parcial (só contas da 4YU até o App Review) | FUNCIONALIDADES.md:44 |
| Messenger | tem | [Smartflow](https://colmeia.cx/smart-flow) | não tem | `src/core/canais.ts` |
| Telegram | tem | [Smartflow](https://colmeia.cx/smart-flow) | parcial (só envio, `disponivel: false`) | `src/core/canais.ts:117-134` |
| E-mail como canal | tem | [home](https://colmeia.cx) | não tem (só e-mail do sistema: senha, aviso) | `src/server/email.ts` |
| SMS | tem | [home](https://colmeia.cx) | não tem | |
| RCS | tem | [home](https://colmeia.cx) | não tem | |
| Pagamento no chat | tem: Pix, boleto, Mercado Pago, PicPay, PagBank, NuPay, PayPal | [integrações](https://colmeia.cx/integracoes/), [home](https://colmeia.cx) | parcial (demonstração, sem gateway) | FUNCIONALIDADES.md:304 |
| Catálogo oficial do WhatsApp | tem (citado, sem detalhe) | [integrações](https://colmeia.cx/integracoes/) | não tem: catálogo é só nosso, cards são botão de link (`cta_url`) | `src/channels/cloud-api.ts:650-688` |
| WhatsApp Flows | tem (citado, sem exemplo) | [Smartflow](https://colmeia.cx/smart-flow) | não tem | busca no código sem resultado |
| Fluxo visual de chatbot | tem | [Smartflow](https://colmeia.cx/smart-flow) | tem (15 blocos) | FUNCIONALIDADES.md:131 |
| IA generativa com ferramentas | tem (ChatGPT, Gemini, DeepSeek, LLaMA; multiagente) | [Omnisense](https://colmeia.cx/omnisense), [Polimata](https://colmeia.cx/polimata) | tem (17 ferramentas) | FUNCIONALIDADES.md:183-215 |
| Fila, transferência, distribuição | tem, com rebalanceamento automático | [Customer Care](https://colmeia.cx/customer-care) | tem | FUNCIONALIDADES.md:68, 354-371 |
| CRM com funil | tem (embutido) | [integrações](https://colmeia.cx/integracoes/) | tem (funis, etiquetas, segmentos) | FUNCIONALIDADES.md:236-272 |
| Disparo em massa | tem, omnichannel, com cadência | [Campaign](https://colmeia.cx/colmeia-campaign-omnichannel) | tem, só WhatsApp, sem métrica de clique | FUNCIONALIDADES.md:227-229, 463 |
| Conversions API da Meta | tem | [integrações](https://colmeia.cx/integracoes/) | não tem | FUNCIONALIDADES.md:455 |
| Atribuição de anúncio com nome da campanha | ? | não citada | tem | FUNCIONALIDADES.md:310 |
| Lead Ads do Facebook | ? | não citada | tem | FUNCIONALIDADES.md:312 |
| Loja integrada (frete, cupom, rastreio) | ? (diz "ERPs, gateways") | [integração inteligente](https://colmeia.cx/integracao-inteligente/) | tem (Magento completo, Nuvemshop leitura) | FUNCIONALIDADES.md:289-292 |
| Agenda (Verandi) | não | | tem (presets e webhook de entrada) | `src/server/receber-evento.ts` |
| Relatórios e BI externo | tem (Power BI, Tableau, Looker, data warehouse) | [Analytics](https://colmeia.cx/colmeia-analytics-business-intelligence) | parcial (relatórios na tela, sem exportar) | FUNCIONALIDADES.md:462 |
| API pública | tem | [integrações](https://colmeia.cx/integracoes/) | tem (v1) | FUNCIONALIDADES.md:324 |
| Opt-out por "SAIR" e registro de opt-in | ? | não citado | não tem | `docs/PROSPECCAO-AUTOFLUXOS.md:55` |
| Preço público e contratação sozinho | não | | tem | FUNCIONALIDADES.md:390-394 |

## O que temos e eles não mostram (argumento de venda)

- **Coexistência**: o dono continua usando o WhatsApp do celular. Para pequeno
  negócio é o que decide a compra.
- **Anúncio com nome**: a conversa chega dizendo de qual campanha e anúncio veio,
  e o relatório mostra de onde vêm as vendas.
- **Agenda pronta (Verandi)**: estúdio e clínica marcam, remarcam e entram na
  fila de espera pela conversa.
- **Loja de verdade**: frete, cupom e rastreio do Magento dentro do chat.
- **Preço na página e começa no mesmo dia.** A Colmeia é venda consultiva.

## Top 5 lacunas, em ordem

Esforço em dias de trabalho do agente, sem contar espera da Meta.

| # | Lacuna | PCYES (loja) | MGM (estúdio) | Esforço | Depende da Meta? |
|---|---|---|---|---|---|
| 1 | **Bloco "Cobrar"**: Pix e link de pagamento por um gateway (Mercado Pago ou Asaas), webhook que marca pago e segue o fluxo | fecha pedido sem mandar ao site | mensalidade, aula avulsa, cobrança atrasada | 5 a 8 dias | não |
| 2 | **Opt-out "SAIR" e opt-in por contato** | protege o número nas transmissões | idem | 2 dias | não, mas a política exige |
| 3 | **WhatsApp Flows** em modelos prontos (agendar horário, cadastro, pesquisa), sem editor visual de Flow no começo | baixo | alto: escolher dia e horário num formulário nativo, ligado à Verandi | 6 a 10 dias | sim: publicar o Flow e subir a chave pública do número |
| 4 | **Conversions API**: devolver "lead" e "compra" para a Meta usando o `ctwa_clid` que já gravamos | anúncio otimiza para venda | anúncio otimiza para matrícula | 3 dias | sim: conta de anúncios e conjunto de dados (pixel) |
| 5 | **Catálogo oficial do WhatsApp**: sincronizar nosso catálogo e o da Nuvemshop com a Meta, mandar mensagem de produto e multiproduto, receber o carrinho | alto (a PCYES é Magento: precisaria sincronizar dele também) | baixo | 6 a 10 dias | sim: catálogo no Commerce Manager ligado ao número |

Depois do item 1 estar em uso: **Payments BR da Meta** (mensagem `order_details`
com Pix dinâmico, cartão e boleto, o cliente paga sem sair do WhatsApp). A Meta
documenta para o Brasil
([Payments BR](https://developers.facebook.com/documentation/business-messaging/whatsapp/payments/payments-br/overview.md));
a conciliação é nossa com o gateway pelo `reference_id`, então reaproveita o
gateway do item 1. Estimativa: 4 a 6 dias.

## Canais: e-mail, SMS e RCS

**Não construir agora.** O cliente do AutoFluxos vive no WhatsApp; os outros
canais servem para empresa grande com régua de cobrança, que é o público da
Colmeia.

| Canal | Custo de operar | Veredito |
|---|---|---|
| E-mail | Brevo grátis até 300/dia ([preços](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans)); Amazon SES US$ 0,10 por mil ([preços](https://aws.amazon.com/ses/pricing/)). Já temos Brevo e domínio de envio (`src/server/email.ts`) | o mais barato de ligar. Fazer só como **passo de fluxo** ("mandar e-mail"), não como caixa de entrada. 2 a 3 dias, quando um cliente pedir |
| SMS | Twilio cerca de US$ 0,06 por segmento mais taxa de operadora ([preços](https://www.twilio.com/en-us/sms/pricing/br)) | caro perto do WhatsApp de serviço (R$ 0,035, `docs/HANDOFF-06-OUT.md:17`). Não |
| RCS | existe no Brasil via Google e operadoras ([Olhar Digital](https://olhardigital.com.br/noticia/google-claro-oi-tim-e-vivo-anunciam-lancamento-do-rbm-no-brasil/105511)), só por agregador como a [Zenvia](https://zenvia.com/rcs/), com verificação de marca e preço sob proposta | não. Volume de pequeno negócio não paga o agregador |

## Não confirmado

- Como a Colmeia cobra: link do gateway ou Payments BR nativo da Meta. O site
  diz só "Pix, boleto ou Mercado Pago direto na conversa".
- Se a Colmeia usa o catálogo oficial com carrinho e para quê usa Flows: o site
  cita os nomes sem exemplo.
- Se a Colmeia tem coexistência, atribuição de anúncio com nome e opt-out.
- Preço da Colmeia.
- Payments BR da Meta: elegibilidade, se é beta ou aberto, quais gateways são
  aceitos. A documentação não diz.
- Preço do WhatsApp Flows (se a mensagem que abre o Flow é cobrada como
  modelo ou serviço). A documentação da Meta não diz.
- Preço atual de SMS na Zenvia e de RCS no Brasil.
- Os trechos do site da Colmeia vieram de leitura automática das páginas;
  antes de usar em material de venda, conferir no site.
