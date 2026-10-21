# Prospecção do AutoFluxos: como a 4YU consegue clientes novos

Pesquisa de 21/out/2026, feita a partir de `docs/HANDOFF-21-OUT-VENDER-AUTOFLUXOS.md`.
Todas as fontes foram acessadas em 21/out/2026. Legenda das fontes:
**[OFICIAL]** é a Meta, o Google, a lei ou a página do próprio fornecedor;
**[TERCEIRO]** é blog, imprensa, benchmark ou fórum. Conta feita por mim aparece
como **[CONTA]**, com a premissa escrita do lado.

---

## Recomendação

**Não fazer:**

1. **Não mandar modelo pela API do WhatsApp para empresa que nunca deu opt-in.**
   A política proíbe sem exceção para B2B, e a punição máxima é a Meta proibir
   "você e sua organização" de usar qualquer produto do WhatsApp. Para a 4YU,
   que vende um produto que só existe em cima da API do WhatsApp, isso não é
   perder um número: é perder a empresa. Não há volume de prospecção que pague
   esse risco.
2. **Não usar automação não oficial** (disparador de WhatsApp Web, extensão que
   envia, API por QR Code tipo Z-API). Os Termos do WhatsApp proíbem envio em
   massa automatizado e a Meta derrubou 131 extensões em out/2025.
3. **Não vender "disparo para lista fria" como recurso do AutoFluxos.** Quem
   vende isso no Brasil (Umbler, Whaticket por QR, Z-API) vende o risco junto.
   O argumento de venda do AutoFluxos é o contrário: API oficial, número que não
   cai.

**Fazer, nesta ordem:**

1. **O Garimpo acha e qualifica; um humano faz o primeiro contato** por ligação,
   visita, e-mail B2B ou WhatsApp manual um a um do celular do vendedor, em
   volume baixo (até 15 por dia), cada mensagem escrita para aquela empresa, com
   opção de sair.
2. **Anúncio de clique para o WhatsApp** apontando para o número da 4YU no
   AutoFluxos. O lead escolhe falar, a conversa abre uma janela grátis de até
   7 dias, e o fluxo "qualificar (SDR)" que já existe faz a triagem. É o próprio
   produto vendendo o produto.
3. **Página `4yu.com.br/autofluxos`** com formulário que colhe opt-in. Hoje ela
   não existe (o site tem `/crm`, `/rodape`, `/deixei-aqui`, `/quanto-cobro`).
4. **Caso da MGM como vitrine para estúdios** (pilates, academias, clínicas),
   que é onde o AutoFluxos já tem fluxo pronto e cliente pagante.
5. **Programa de indicação para contadores e agências**, com comissão
   recorrente. É como quase todos os concorrentes brasileiros crescem.

**Quanto custa o mês 1:** cerca de **R$ 1.100 a R$ 1.600**, quase tudo anúncio
(R$ 1.000 a R$ 1.500). Garimpo e WhatsApp ficam na cota grátis no volume
proposto. Detalhe na seção 5.

**Antes de qualquer campanha**, o AutoFluxos precisa de duas coisas que não tem
hoje: registrar o opt-in de cada contato e tirar da lista quem responde "SAIR".
E a conta do WhatsApp da 4YU precisa de cartão cadastrado (lição da PCYES em
19/out).

---

## 1. O que a política do WhatsApp permite e proíbe

### A regra

- [OFICIAL] Política de Mensagens do WhatsApp Business, atualizada em
  23/set/2026, https://whatsappbusiness.com/pt-br/policy/ : "You may only
  contact people on WhatsApp if: (a) they have given you their mobile phone
  number or username" e "(b) you have received opt-in permission from the
  recipient confirming that they wish to receive subsequent messages". O texto
  fala sempre em "pessoas", sem regra diferente para empresa.
- Mesma página: "Você é a única pessoa responsável por determinar o método de
  adesão"; pedidos de bloqueio ou saída devem ser respeitados "dentro e fora do
  WhatsApp"; "não confunda, surpreenda, engane, defraude ou envie spam".
- Mesma página, sanções: "Poderemos restringir ou remover seu acesso ao
  WhatsApp Business, ou limitar o envio de mensagens da sua conta" e "we may
  prohibit you and your organization from all future use of WhatsApp products
  and services".
- [OFICIAL] Página de envio, https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages :
  "Only send messages to WhatsApp users who have opted into receiving messages
  from your business" e "Avoid sending open-ended welcome or introductory
  messages". Mensagem fria de apresentação é exatamente o que a Meta pede para
  evitar.

**Empresa achada no Google Maps não deu o número para a 4YU nem deu opt-in.
Mandar modelo para ela viola a política. Não existe caminho legítimo de primeiro
contato sem opt-in pela API.**

### Como colher opt-in de forma legítima

- [OFICIAL] https://developers.facebook.com/documentation/business-messaging/whatsapp/getting-opt-in :
  o opt-in "can be general and not specifically for WhatsApp, as long as
  businesses comply with all local laws". Precisa deixar claro que a pessoa
  aceita receber mensagem e dizer o nome da empresa. Métodos citados: SMS,
  site, telefone (URA), presencial ou em papel.
- Na prática, valem para a 4YU:
  - formulário no site com caixa de aceite;
  - anúncio de clique para o WhatsApp (quem clica fala primeiro);
  - link `wa.me` ou QR em material impresso, evento, cartão de visita;
  - pedir na ligação ou na visita: "posso te mandar a proposta no WhatsApp?".
    O "sim" precisa ser anotado no contato (o AutoFluxos ainda não tem campo
    para isso).

### Janela grátis do anúncio: 7 dias, não 72h

- [OFICIAL] https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
  (em vigor desde 1/out/2026): quem chega por anúncio de clique para o WhatsApp
  e recebe resposta em 24h abre uma janela grátis que "may remain open for up to
  7 days"; nela marketing, utilidade, autenticação e serviço saem de graça.
- As 72h que o handoff citava eram do modelo antigo por conversa, já
  depreciado: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/conversation-based-pricing

---

## 2. O que acontece com um número que manda modelo frio

### Como a Meta mede e pune (tudo oficial)

| O quê | Regra | Fonte |
|---|---|---|
| Limite de envio | Desde 7/out/2025 o limite é do **portfólio** inteiro, dividido entre todos os números dele. Começa em 250 destinatários novos por 24h, depois 2.000, 10 mil, 100 mil e ilimitado. Para chegar a 2.000: empresa verificada, ou 2.000 mensagens entregues em 30 dias com modelos de boa qualidade | [messaging-limits](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits), [mudanças](https://developers.facebook.com/documentation/business-messaging/whatsapp/upcoming-messaging-limits-changes) |
| Qualidade do número | Calculada sobre os últimos 7 dias, pesando mais o recente: "blocks, reports, mutes, archives, and reasons users provide when they block you". Pode mudar "even within minutes" | [send-messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages) |
| Qualidade do modelo | Verde, amarelo ou vermelho, por feedback negativo "or low read-rates" | [template-quality](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-quality) |
| Modelo pausado | No vermelho: 1ª vez pausa 3h, 2ª vez 6h, 3ª vez desativado (erro `132016`). Modelos ruins repetidos "may eventually" atingir o número | [template-pausing](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-pausing) |
| Modelo novo retido | Marketing novo pode ficar retido para avaliação; com sinal ruim, as mensagens são descartadas (`132015`) | [template-pacing](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-pacing) |
| Limite por destinatário | A Meta segura marketing para quem lê pouco (`131049`, "healthy ecosystem engagement") | [per-user-limits](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/marketing-templates/per-user-limits) |
| Punição por spam | Aviso; depois bloqueio de modelos por 1 ou 3 dias; depois de todo envio por 5, 7 ou 30 dias; depois conta travada até apelação; depois "permanently disabled". "Not all spam violations might be appealed" | [policy-enforcement](https://developers.facebook.com/documentation/business-messaging/whatsapp/policy-enforcement) |
| Erro de spam | `131048`: "too many previous messages were blocked or flagged as spam" | [error-codes](https://developers.facebook.com/documentation/business-messaging/whatsapp/support/error-codes) |

Mudança importante: desde 7/out/2025 o estado "Flagged" acabou e a nota baixa
**não reduz mais o limite**. O castigo agora vem por pausa de modelo, retenção
de mensagem e punição por política, que é pior: em vez de mandar menos, para de
mandar.

### Taxa de bloqueio e tempo até a restrição

- **A Meta não publica número de corte** (quantos bloqueios derrubam o número).
- [TERCEIRO] Fornecedores repetem que lista fria ou raspada é a causa nº 1 de
  banimento: [codewords.ai](https://www.codewords.ai/blog/why-your-whatsapp-bot-keeps-getting-banned),
  [firstsales.io, 30/jun/2026](https://firstsales.io/blog/whatsapp-cold-outreach-b2b/),
  [WATI](https://support.wati.io/en/articles/15846639-how-to-appeal-a-sending-spam-restriction-for-your-whatsapp-business-account).
  É padrão (várias fontes dizem o mesmo), mas nenhuma traz dado primário. O
  "derruba em dias" do firstsales não tem fonte. Os cortes de "<1%" ou "<2%" de
  bloqueio que circulam não têm metodologia.
- [TERCEIRO] Opinion Box 2023 (consumidor, não empresa), via
  [Consumidor Moderno](https://consumidormoderno.com.br/2023/06/13/empresas-lgpd-whatsapp-fiscalizacao/):
  78% já receberam mensagem de empresa sem contato prévio, 56% se incomodam e
  **17% bloqueiam**. Se só uma parte desses 17% se repetir em empresas, já é
  muito acima de qualquer corte que os fornecedores citam.

### Conta do custo, se mesmo assim alguém quisesse tentar

[CONTA] Marketing no Brasil custa R$ 0,3217 por mensagem entregue (seção 3).
1.000 modelos frios custam R$ 321,70 e, com o portfólio novo em 250 por dia,
levam 4 dias para sair. Taxa de resposta de WhatsApp frio B2B no Brasil:
**nenhum estudo publicado**. Ou seja, o custo é certo, o retorno é desconhecido
e o risco é a empresa.

### Pagamento

- [OFICIAL] Página de preços: sem forma de pagamento, a Meta entrega as
  mensagens de serviço da cota grátis e para depois dela. Página de suporte para
  provedores
  (https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/support):
  sem pagamento, "the client will be unable to send template messages". Erro
  `131042`.
- [TERCEIRO] DataCrazy: depois de corrigir o pagamento, a liberação pode levar
  "até 72 horas":
  https://help.datacrazy.io/en/articles/10670778-error-131042-payment-in-the-whatsapp-cloud-api

---

## 3. Preço do WhatsApp no Brasil (desde 1/out/2026)

[OFICIAL] Valores da calculadora oficial
(https://whatsappbusiness.com/products/platform-pricing/, consultados pela API
que alimenta a página) e da página de preços para desenvolvedores:

| Categoria | USD | BRL | Cota grátis |
|---|---|---|---|
| Marketing | 0,0625 | **0,3217** | nenhuma |
| Utilidade | 0,0068 | 0,035 | nenhuma (cai por volume acima de 250 mil/mês) |
| Autenticação | 0,0068 | 0,035 | nenhuma |
| Serviço | 0,0068 | 0,035 | **1.000 por número por mês** |
| Qualquer uma dentro da janela de anúncio | 0 | 0 | até 7 dias |

- O handoff dizia "~R$ 0,33 a 0,35" para marketing. O oficial é **R$ 0,3217**.
  Os R$ 0,33 que aparecem na imprensa parecem ser de outro produto: a cobrança
  da lista de transmissão do **app** WhatsApp Business ([TERCEIRO] Diário do
  Nordeste, só li o resumo da busca:
  https://diariodonordeste.verdesmares.com.br/ultima-hora/tecnologia/whatsapp-comeca-a-cobrar-por-envio-de-mensagens-em-listas-de-transmissao-1.3700450).
- [TERCEIRO] Imprensa confirma serviço a R$ 0,035 e 1.000 grátis:
  [Forbes Brasil, 02/out/2026](https://forbes.com.br/forbes-tech/2026/10/entenda-o-que-muda-para-as-empresas-com-a-cobranca-no-whatsapp-business/),
  [O Tempo, 01/out/2026](https://www.otempo.com.br/economia/2026/10/1/whatsapp-business-muda-cobranca-de-empreendedores-por-mensagens-entenda-quem-sera-afetado)
  (este cita "cerca de R$ 0,04 com impostos").
- [OFICIAL] Faturamento em reais liberado aos poucos desde jul/2026; conta fora
  de BRL precisa migrar até 30/jun/2027.

---

## 4. LGPD e outras regras para contato frio B2B

- [OFICIAL] LGPD, https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm :
  legítimo interesse (art. 7º, IX e art. 10) é a base usada para prospecção.
  Dado público (art. 7º, §3º) ainda exige finalidade e boa-fé. Dado só da
  empresa não é protegido pela LGPD (art. 1º protege pessoa natural); **nome e
  celular do sócio são dado pessoal**, e em MEI empresa e pessoa se confundem.
  Oposição pelo titular no art. 18, §2º. Multa de até 2% do faturamento,
  limitada a R$ 50 milhões por infração (art. 52).
- [OFICIAL] Guia de Legítimo Interesse da ANPD, 02/02/2024,
  https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_legitimo_interesse.pdf :
  a "legítima expectativa" depende de relação prévia e da fonte do dado;
  recomenda o teste de balanceamento (LIA) e pede canal fácil para sair. O guia
  **não trata prospecção fria B2B diretamente**.
- [TERCEIRO] **"Não Me Ligue" de São Paulo** (Lei 13.226/2008, ampliada pela
  17.334/2021) passou a cobrir SMS e WhatsApp, DDD 11 a 19:
  [Teletime, 12/mar/2021](https://teletime.com.br/12/03/2021/lei-estadual-inclui-sms-e-whatsapp-em-cadastro-nao-me-ligue-do-procon-sp/).
  Afeta a MGM e qualquer prospect em SP.
- [TERCEIRO] O "Não Me Perturbe" é só de telecom e bancos, não se aplica à 4YU:
  [Teletime, 2021](https://teletime.com.br/29/06/2021/baigorri-defende-que-mais-setores-entrem-na-iniciativa-nao-me-pertube/).
- [TERCEIRO] Prefixo 0303 (Anatel, Ato 10.413/2021) é obrigatório para
  telemarketing ativo:
  [Tecnoblog](https://tecnoblog.net/noticias/prefixo-0303-agora-vale-para-todas-as-ligacoes-de-telemarketing/).
- E-mail: não achei lei brasileira específica; existe a autorregulação CAPEM
  (2009), voluntária.

**Como aplicar:** contato no telefone e e-mail **da empresa** (não no celular
pessoal do sócio), dizer quem é a 4YU e de onde veio o contato, oferecer saída
na primeira mensagem, e guardar quem pediu para sair. Escrever um LIA de uma
página antes de começar.

---

## 5. Custo de cada canal

Quase não existe benchmark brasileiro. Os números abaixo são globais quando não
diz o contrário, e servem para ordem de grandeza, não para prometer resultado.

| Canal | Dado | Custo por reunião [CONTA] | Fonte |
|---|---|---|---|
| Anúncio de clique para o WhatsApp | R$ 8 a 25 por conversa iniciada em serviços locais (sem metodologia publicada) | R$ 40 a 250, supondo que 10% a 20% das conversas viram demonstração (premissa não confirmada) | [TERCEIRO] [Trafius](https://trafius.com.br/blog/campanha-de-mensagens-no-whatsapp-fluxo-e-metricas), [Spurnow](https://www.spurnow.com/en/blogs/click-to-whatsapp-ads-benchmarks) |
| E-mail frio B2B | Resposta média 3,43% (Instantly, 2025); mediana 1,5% (Woodpecker, 56 mil campanhas) | Com 300 e-mails no mês: 5 a 10 respostas, 1 a 2 reuniões. Ferramenta: US$ 47/mês ou nada, se for à mão | [OFICIAL-vendedor] [Instantly](https://instantly.ai/blog/ai-sales-agent-benchmarks-2026-the-complete-performance-report/), [TERCEIRO] [Woodpecker](https://woodpecker.co/blog/cold-email-statistics/) |
| Ligação | Conversa em 9,9% das discagens; reunião em 4,6% das conversas; cerca de 370 discagens por reunião (175 mil discagens, 2025, sem Brasil na amostra) | Só tempo do vendedor | [TERCEIRO] [Belkins, 26/jun/2026](https://belkins.io/blog/cold-calling-benchmarks) |
| LinkedIn | Aceite 28,5%, resposta 10,4% após conectar | Pouco útil: dono de estúdio ou loja não vive no LinkedIn | [TERCEIRO] [SalesRobot](https://www.salesrobot.co/blogs/linkedin-connection-acceptance-rate) |
| WhatsApp manual um a um | Nenhum dado de B2B frio | Só tempo | não há |
| Visita | Nenhum dado para SaaS de pequena empresa; SaaStr cita "3x mais conversão presencial" (Toast, Slice) sem números | Tempo e deslocamento | [TERCEIRO] [SaaStr](https://www.saastr.com/in-person-sales-generate-3x-higher-conversions-per-the-cros-of-toast-splunk-brex-and-slice) |
| Modelo frio pela API | R$ 0,3217 por mensagem entregue; resposta desconhecida | Não calculável; risco da empresa | seção 2 e 3 |

Contexto que favorece o AutoFluxos: [OFICIAL] Sebrae 2026, WhatsApp é o
principal canal de venda de 82% dos MEI e pequenas empresas
([Agência Sebrae](https://agenciasebrae.com.br/dados/whatsapp-se-consolida-nas-vendas-on-line-enquanto-facebook-e-lojas-proprias-perdem-folego/));
Sebrae 2025, mais de 80% dos negócios de serviço atendem por WhatsApp e só
cerca de 6% usam CRM
([Agência Sebrae](https://agenciasebrae.com.br/cultura-empreendedora/whatsapp-e-o-principal-meio-de-comunicacao-para-80-dos-negocios-de-servico/)).
O mesmo dado diz que e-mail rende menos para esse público: o e-mail que consta
na Receita costuma estar velho ou ser do contador.

E-mail frio **não sai do `4yu.com.br`**: é o domínio da caixa `contato@`
(regra em `4yu-apps/CLAUDE.md`). Usar domínio separado só para prospecção, com
SPF, DKIM e DMARC, e no máximo algumas dezenas por dia por caixa. Regra do
Google para remetentes, em vigor desde 01/02/2024: spam abaixo de 0,3%
([OFICIAL] https://support.google.com/a/answer/81126).

---

## 6. Como os concorrentes conseguem clientes

[OFICIAL] salvo indicação, páginas de preço e parceiros de cada um:

| Empresa | Entrada | Como adquire cliente | Disparo e opt-in |
|---|---|---|---|
| [Kommo](https://www.kommo.com/br/parceiros/torne-se-parceiro/) | US$ 20/usuário/mês | 14 dias grátis sem cartão; mais de 5.000 parceiros; comissão 35% a 50% recorrente | Transmissão do plano Avançado para cima |
| [BotConversa](https://botconversa.com.br/) | R$ 189 (anual); R$ 199 com API oficial | Garantia de 30 dias; afiliados "até 30% recorrente" ([TERCEIRO] Reclame Aqui relata pagamento só da 1ª venda) | Plano de entrada sem API oficial |
| [Digisac](https://digisac.com.br/contato/business-partners) | R$ 197 | Teste grátis; parceiros com comissão única ou recorrente | |
| [Huggy](https://www.huggy.io/pt-br/pricing) | R$ 0 (1 usuário) | Freemium e parceiros | |
| [Umbler Talk](https://www.umbler.com/br/talk) | R$ 199,80 (2 atendentes) | Teste grátis; clube de agências | "enviar quantas mensagens desejar para toda sua lista", sem falar em opt-in |
| [Whaticket](https://whaticket.com/pt/precos/) | R$ 270 | 14 dias grátis; parceiros | Conexão por QR (não oficial); avisa que massa "pode levar a bloqueios" |
| [Z-API](https://z-api.io/) | R$ 99,99/instância | 2 dias grátis; programa de parceiros | API não oficial, "sem fila de aprovação" |
| [Zenvia](https://zenvia.com/precos/) | R$ 0 + R$ 100 de pacote + R$ 649 de ativação | Franquias, parceiros, time de vendas | "Mensagens em Massa" |
| [RD Station Conversas](https://www.rdstation.com/planos/conversas/) | R$ 989 (anual) + R$ 1.999 de ativação | Time de vendas, agências, afiliados, conteúdo | API oficial, disparo em massa |
| [Blip](https://www.blip.ai/planos/) | por contrato | Parceiros credenciados | "Basta ter o opt-in... conforme a LGPD" |
| [Octadesk](https://www.octadesk.com/precos) | R$ 2.499 | Time de vendas | API oficial, disparo em massa |

Padrão: **teste grátis + programa de parceiros com comissão recorrente**. Os
grandes têm time de vendas. **Nenhum vende "prospecção fria pela API oficial"**;
quem promete lista inteira sem falar de opt-in usa conexão não oficial.
Anúncios e SEO dos concorrentes **não foram verificados**.

Para comparação, o AutoFluxos custa R$ 297, 597 e 1.197 por mês, com 14 dias
grátis no Profissional ativados pelo admin (`docs/FUNCIONALIDADES.md:386-404`).

---

## 7. O Garimpo como motor de prospecção

Repositório `4yu-apps/CRM/`, no ar em https://crm.4yumkt.com.br, último commit
`fd0183e` (06/ago/2026). Projeto Supabase próprio (`uqwnpuonrbupsqstetww`).

### Como funciona

- **Descoberta:** Google Places Text Search (New) com busca em texto
  "nicho em cidade, UF", até 3 páginas de 20 resultados por termo, máximo de
  150 buscas por execução, uma execução por dia às 11h UTC
  (`CRM/esteira/src/garimpo_esteira/discovery.py:174-191`, `config.py:111-112`).
- **Enriquecimento:** CNPJ por BrasilAPI e ReceitaWS (telefone, e-mail, sócios,
  abertura, situação, porte); site (WhatsApp por `wa.me`, e-mail, redes, pixel,
  chatbot, formulário, agendamento); Instagram; Biblioteca de Anúncios da Meta
  (`CRM/esteira/src/garimpo_esteira/sources/`).
- **Score:** 0 a 100, corte em 50. A lente "automação" é a que serve ao
  AutoFluxos: pontua volume de avaliações (até 30), nota (até 12), ramo de
  agendamento (18), sem site (12), sem chatbot (12), formulário (4) e telefone
  (7). Descarta empresa inativa na Receita e sem telefone
  (`CRM/esteira/src/garimpo_esteira/scoring.py:249-304`). Os pesos nunca foram
  conferidos contra venda real.
- **Rascunho:** Gemini 2.5 Flash na cota grátis, duas mensagens curtas (abertura
  sem oferta; oferta só se responder), tom do `CRM/GUIA-COPY-HUMANA.md`.
- **Envio:** sempre humano. A extensão do Chrome lê o WhatsApp Web e atualiza o
  status; não envia (`CRM/extension/NOTAS-WHATSAPP.md`). Atenção: ela pré-preenche
  o texto na conversa, o que o README não diz.

### Custo por lead

- [OFICIAL] Google Places, desde mar/2025, cota grátis por tipo de chamada. A
  busca com telefone e site é do tipo Enterprise: **1.000 chamadas grátis por
  mês**, depois US$ 35 por mil
  (https://developers.google.com/maps/billing-and-pricing/pricing).
- [CONTA] Cada chamada traz até 20 empresas. 1.000 chamadas cobrem até 20 mil
  empresas por mês, muito acima do que um vendedor consegue contatar. **No
  volume deste plano o custo por lead é R$ 0.** Enriquecimento e IA também estão
  na cota grátis. O "< R$ 30/mês" do README é meta declarada, não medida.

### Qualidade do dado

| Pergunta | Resposta |
|---|---|
| O telefone é de WhatsApp? | **Não se sabe.** Não há verificação. Só é marcado WhatsApp quando o site tem link `wa.me` (`sources/website.py:388`). O score trata qualquer telefone como "tem WhatsApp" (`scoring.py:88`) |
| Fixo ou celular? | O tipo é gravado (`sources/biz_signals.py:28-43`), mas o score não usa |
| É do decisor? | Quase nunca: é o número do Google Maps, de recepção ou balcão. Nome do sócio só aparece quando o CNPJ é achado |
| Acha o CNPJ? | Pouco: o Maps não dá CNPJ, e a base local da Receita estava vazia (`CRM/README.md:222-226`) |
| Quantos leads tem? | Cerca de 2.034 em 25/jun/2026 (`CRM/docs/plano-reprocessar-leads-2026-06-25.md:4-6`). Taxa de resposta e de fechamento não estão em doc nenhum |

Os tokens da Meta usados no enriquecimento venciam por volta de 24/ago/2026
(`CRM/esteira/README.md:85`); provavelmente estão vencidos. Não conferi se o
cron diário ainda roda.

### O que falta para servir à 4YU vender o AutoFluxos

1. **Lista de nichos do AutoFluxos** na esteira: estúdios de pilates, academias,
   clínicas de estética, odontologia, pet shops, lojas com e-commerce. A lente
   "automação" já serve; falta o nicho.
2. **Priorizar celular** usando o tipo que já é gravado. Celular de pequeno
   negócio quase sempre é WhatsApp Business; fixo não é.
3. **Sinal "atende por WhatsApp"** (link `wa.me` no site, botão no Instagram).
   Quem já atende por WhatsApp sente a dor que o AutoFluxos resolve.
4. **Campo de opt-in e de saída**: hoje só existe `opt_out`
   (`CRM/supabase/migrations/20260619120002_tables.sql:45-46`).
5. **Ligação com o AutoFluxos:** quando o lead fecha, criar a conta ou o teste
   grátis. Não existe nada disso.
6. Renovar os tokens da Meta e confirmar que o cron roda.

Nada disso exige multiusuário. A 4YU usa como único usuário.

---

## 8. Plano de 30 dias

Meta: **2 a 3 clientes novos pagantes**, a partir de 10 a 15 demonstrações.
[CONTA] Premissas, todas não medidas: 20% das demonstrações viram cliente
(estúdio com dor clara e caso parecido para mostrar); 10% a 20% das conversas
de anúncio viram demonstração; 5% a 10% dos contatos humanos viram demonstração.

### Semana 1: preparar (nenhum contato ainda)

| Tarefa | Quem | Custo |
|---|---|---|
| Cartão de crédito na conta do WhatsApp da 4YU | Gabriel, no [Business Manager](https://business.facebook.com/billing_hub/payment_settings) | R$ 0 |
| Opt-out por palavra ("SAIR", "PARAR") e campo de opt-in no contato, no AutoFluxos | agente | R$ 0 |
| Página `4yu.com.br/autofluxos` com o caso da MGM, preço, botão de WhatsApp e formulário com aceite | agente, com Gabriel no visual | R$ 0 |
| Fluxo "qualificar (SDR)" ligado ao número da 4YU: pergunta ramo, quantos atendentes, volume de mensagens, e oferece demonstração | agente | R$ 0 |
| Garimpo: nichos do AutoFluxos, priorizar celular, renovar tokens, rodar a esteira para a cidade da 4YU e para SP capital (onde está a MGM) | agente | R$ 0 |
| LIA de uma página e texto padrão de primeira abordagem com saída | agente | R$ 0 |
| Domínio separado para e-mail frio, com SPF, DKIM e DMARC | Gabriel compra no [Registro.br](https://registro.br/); agente configura | cerca de R$ 40/ano (não conferido) |

### Semanas 2 a 4: contato

| Canal | Volume | Meta | Custo |
|---|---|---|---|
| Anúncio de clique para o WhatsApp, público dono de pequeno negócio de serviço, criativo com o caso da MGM | R$ 50 a 70 por dia, 20 dias | 50 a 150 conversas, 5 a 15 demonstrações | R$ 1.000 a 1.500 |
| Ligação para o fixo ou celular da empresa, roteiro curto, pedindo para mandar a proposta no WhatsApp (o "sim" vira opt-in anotado) | 20 por dia | 3 a 5 demonstrações | tempo |
| WhatsApp manual do celular do vendedor, para os com celular e score alto | **até 15 por dia**, cada um escrito para a empresa, com saída | 2 a 4 demonstrações | tempo |
| Visita a estúdios e clínicas perto da 4YU, mostrando o AutoFluxos no celular | 2 por semana | 1 a 3 demonstrações | deslocamento |
| E-mail B2B para quem tem e-mail no site (não o da Receita) | até 20 por dia | 1 a 2 demonstrações | R$ 0 a US$ 47 |
| Pedir indicação à MGM e à PCYES; convidar 3 contadores ou agências para indicar com comissão recorrente | 5 conversas | 1 parceiro ativo | comissão só se fechar |

**Total do mês: cerca de R$ 1.100 a R$ 1.600.** Mensagens do WhatsApp nesse
plano ficam na janela grátis do anúncio (até 7 dias) ou na cota de 1.000
mensagens de serviço do número.

### O que medir toda semana

Conversas por canal, demonstrações, clientes, custo por conversa do anúncio,
quantos pediram para sair e a qualidade do número da 4YU no
[WhatsApp Manager](https://business.facebook.com/wa/manage/phone-numbers/).
Na 4ª semana, cortar o canal que não marcou nenhuma demonstração e pôr o tempo
ou o dinheiro no que marcou mais.

---

## 9. Vale vender o Garimpo para clientes B2B, como a Oderço?

**Agora, como serviço; como produto, ainda não.**

- **Como produto, não.** O Garimpo é de um usuário só. Ter várias empresas
  exige reescrever a segurança do banco, que o próprio plano chama de "o passo
  de risco" (`CRM/docs/phase8-multiuser-plan.md:7-13,21-37`). Para uma
  distribuidora também falta: lente "revenda" (porte, ramo, mix), em vez de
  carência de marketing; região por raio no mapa; base da Receita carregada
  para ter ramo e porte; texto de proposta de revenda. A cota grátis do Google
  e do Gemini não aguenta vários clientes.
- **Como serviço, sim, para validar.** A 4YU roda o Garimpo para a Oderço
  (por exemplo, lojas de informática e eletrônicos por região), entrega a lista
  qualificada e o roteiro, e cobra por lista ou por mês. Se a Oderço renovar,
  aí vale construir o multiusuário.
- **Canal de contato da lista:** o representante da Oderço por telefone, visita
  e e-mail, e WhatsApp manual um a um. Só entra no AutoFluxos da Oderço quem
  respondeu ou disse que aceita receber. **Nunca transmissão do AutoFluxos para
  a lista do Garimpo**: seria o disparo frio que este documento desaconselha,
  agora com o número do cliente.

---

## Não confirmado

- Quantos bloqueios derrubam um número, e em quanto tempo. A Meta não publica;
  não achei relato em primeira mão (Reddit, GitHub), só blog de fornecedor.
- Taxa de resposta de WhatsApp frio B2B no Brasil: nenhum estudo publicado.
- Custo por conversa de anúncio de clique para o WhatsApp: só fontes sem
  metodologia (R$ 8 a 25). Taxa de conversa que vira demonstração: premissa.
- Benchmark brasileiro de e-mail e de ligação fria: não existe público.
- Se o botão de ação da Página do Facebook ainda abre a janela grátis; o texto
  atual da Meta só cita o anúncio.
- Por que a PCYES ficou cerca de 15h bloqueada depois de passar de 1.000
  mensagens; a Meta não dá prazo de liberação.
- Se o portfólio da 4YU na Meta guarda algum número de cliente. Como o limite
  e a punição são do portfólio, isso decide se um erro da 4YU pode atingir
  cliente. Conferir no
  [WhatsApp Manager](https://business.facebook.com/wa/manage/phone-numbers/).
- Se o prefixo 0303 vale para um vendedor ligando do celular em volume baixo.
- Se linha de empresa pode ser cadastrada no "Não Me Ligue" de SP.
- Orientação da ANPD específica sobre prospecção B2B e sobre dado de sócio.
- Os R$ 0,33 das listas de transmissão do app: só li o resumo da busca.
- Preço do domínio `.com.br` no Registro.br.
- Quanto a PCYES e a MGM pagam: não está nos docs.
- Se o cron da esteira do Garimpo ainda roda e se os tokens da Meta venceram.
