# Handoff: 21/out/2026, como vender o AutoFluxos (prospecção ativa)

Para o agente que vai pesquisar e propor **como a 4YU consegue clientes para o
AutoFluxos**. É pesquisa e estratégia, não código. Nenhum envio de mensagem a
ninguém sem autorização explícita do Gabriel.

## A missão

O Gabriel quer prospectar clientes do AutoFluxos e tem vontade de **mandar
mensagem pela API oficial do WhatsApp** para empresas que nunca falaram com a
4YU. Ele sabe que tem risco. O seu trabalho:

1. Descobrir, **com dados e fonte**, o que é permitido, o que dá ban, quanto
   custa e o que funciona de verdade em prospecção B2B no Brasil.
2. Entender o **Garimpo** (CRM de prospecção da 4YUmkt) a fundo: motor,
   esteira, custos, o que já existe e o que ele resolve.
3. Entregar um plano de prospecção que a 4YU possa executar **sem pôr número
   nenhum em risco**, dizendo onde o Garimpo e o próprio AutoFluxos entram.

**Regra de ouro: garanta o que for afirmar.** Todo número (preço, limite, taxa
de resposta, taxa de bloqueio) vem com link de fonte, data da fonte e se é
oficial (Meta/WhatsApp) ou de terceiro. O que não conseguir confirmar, diga que
não confirmou. O Gabriel decide com base nisso; número inventado aqui vira
número errado num número de cliente.

## O que já se sabe (conferido em 19 a 21/out/2026)

Use como ponto de partida e **reconfirme**: preço e política da Meta mudam.

- **Política do WhatsApp Business:** só se pode iniciar conversa com quem deu o
  número e aceitou ser contatado (opt-in). Empresa achada no Google Maps não deu
  opt-in. Fonte a reler: https://business.whatsapp.com/policy
- **Preço (BRL, conta brasileira, desde 1/out/2026):**
  - Mensagem de **serviço** (resposta dentro de 24h da última mensagem do
    cliente): 1.000 grátis por número por mês; depois **R$ 0,035** cada (fontes:
    O Tempo e Forbes Brasil, out/2026; página da Meta cita 0,68 ¢ para
    utilidade/autenticação no Brasil).
  - **Marketing** (modelo, inclusive o primeiro contato): cobrado desde a
    primeira, **~R$ 0,33 a 0,35** por mensagem entregue. **Não confirmado em
    fonte oficial**: a tabela da Meta só mostra o valor na página interativa
    https://whatsappbusiness.com/pt-br/products/platform-pricing/ (escolher
    Brasil, BRL, Marketing). Confirme lá.
  - Resposta do cliente é sempre grátis; se ele responde ao modelo, abre janela
    de 24h e o resto vira serviço.
  - Doc oficial: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- **Risco de ban:** contato frio gera bloqueio e denúncia; a nota de qualidade
  do número cai, o limite de envio diminui, e a conta pode ser restringida.
  Quantifique isso com fonte (limites por tier, como a Meta mede qualidade, o
  que acontece em cada nível).
- **Lição recente (PCYES, 19/out):** sem forma de pagamento na conta, ao passar
  de 1.000 mensagens no mês a Meta bloqueou todo envio por ~15 horas, em
  silêncio. Qualquer plano de disparo precisa contar com cartão cadastrado e
  monitoramento.
- **Conclusões da conversa com o Gabriel (21/out), para você testar, não
  aceitar de graça:**
  - Disparo automático de modelo para quem não deu opt-in é a parte "pirata":
    não vende como produto e arrisca o número.
  - Achar e qualificar empresas (dado público de CNPJ, Google, site) é
    legítimo; existem produtos brasileiros sérios nisso (ex.: Econodata,
    Speedio). A LGPD admite contato B2B por interesse legítimo com opção de
    sair. Confirme com fonte jurídica.
  - Canais candidatos ao primeiro contato: telefone, e-mail frio B2B, visita,
    WhatsApp manual um a um do celular do vendedor (pouco volume, mensagem
    personalizada), e anúncio de clique para o WhatsApp (o lead escolhe falar;
    janela de 72h grátis). Depois que o lead responde, o AutoFluxos assume.
  - Ideia em aberto: o Garimpo faria sentido para clientes que vendem para
    empresas (ex.: Oderço, distribuidora, prospectando revendas por região).

## O que ler

**Garimpo (obrigatório, para entender o motor):** `4yu-apps/CRM/`, no ar em
https://crm.4yumkt.com.br. Último commit em 06/ago/2026 (`fd0183e`).

- `CRM/README.md`: visão, fluxo de 8 etapas, máquina de estados do lead, os
  dois ICPs (tráfego e automação), stack e custo (< R$ 30/mês).
- `CRM/esteira/` (Python): descoberta (Google Places), enriquecimento (CNPJ,
  site, Instagram, Meta Ad Library), score, rascunho por IA.
- `CRM/extension/`: Chrome MV3 que **só lê** o WhatsApp Web e marca status
  (nunca envia); `NOTAS-WHATSAPP.md` explica o porquê do risco.
- `CRM/front/`, `CRM/supabase/`: CRM e banco (projeto Supabase **próprio**, não
  o compartilhado do AutoFluxos/Verandi).
- `CRM/docs/`: `roadmap-21-features.md`, `oportunidades-pesquisa-2026-06-25.md`,
  `phase8-multiuser-plan.md`, `plano-crm-gestao-2026-08-06.md`,
  `enriquecimento-pesquisa-e-plano-2026-06-23.md`.
- `CRM/PLANEJAMENTO.md`, `PLANO-DE-EXECUCAO.md`, `PROXIMOS-PASSOS.md`,
  `HANDOFF.md`, `GUIA-COPY-HUMANA.md` (tom das mensagens).

Responda: como a descoberta e o score funcionam, quanto custa por lead, qual a
qualidade do dado (telefone é de WhatsApp? é do decisor?), e o que falta para
servir de motor de prospecção do próprio AutoFluxos.

**AutoFluxos (para saber o que se está vendendo):**
`autofluxos/docs/FUNCIONALIDADES.md`, `autofluxos/docs/ESTADO.md`,
`autofluxos/docs/EXPANSAO.md`, `autofluxos/docs/CONCORRENTES-22-SET-PROFUNDIDADE.md`.
Clientes reais: PCYES (loja de periféricos) e MGM Pilates (estúdio). O
AutoFluxos já tem modelos de mensagem, transmissões, campanhas e fluxos com IA;
a 4YU tem conta própria nele ("4YU") com número de WhatsApp.

## Perguntas que o relatório precisa responder

1. O que exatamente a política do WhatsApp permite e proíbe para primeiro
   contato B2B? Existe forma legítima de coletar opt-in antes (formulário, site,
   anúncio, QR, e-mail)?
2. O que acontece, em números, com um número que manda modelo frio: taxa de
   bloqueio típica, limites por tier, quanto tempo até restrição. Relatos reais
   (fóruns, GitHub, comunidades de BSP), separando padrão de anedota.
3. Custo real de cada canal por lead e por reunião marcada (WhatsApp modelo,
   anúncio de clique para WhatsApp, e-mail frio, telefone, LinkedIn).
4. Como concorrentes do AutoFluxos (BSPs e plataformas de chatbot no Brasil)
   conseguem clientes, e se oferecem "prospecção" e como.
5. Um plano de 30 dias para a 4YU conseguir os primeiros clientes novos,
   com volume, canal, meta e custo, usando o Garimpo onde fizer sentido.
6. Vale vender o Garimpo como recurso para clientes B2B (tipo Oderço)? Com que
   canal de contato, para não virar disparo frio?

## Entrega

- Um documento em `autofluxos/docs/` (ex.: `PROSPECCAO-AUTOFLUXOS.md`) com as
  respostas, cada afirmação com fonte e data, e uma seção "não confirmado".
- Recomendação clara no topo: o que fazer, o que não fazer, quanto custa.
- Não envie mensagem, não crie modelo na Meta, não mexa em conta de cliente.

## Como trabalhar com o Gabriel

- pt-BR, curto, decisão tomada e recomendação, não lista de opções. Ele não é
  dev e é designer.
- **Travessão proibido** em todo texto e arquivo.
- Link clicável sempre que citar painel ou página externa.
- Commit e push do documento na hora, com o `GITHUB_TOKEN` do cofre via
  credential helper inline (ver `4yu-apps/CLAUDE.md`).
- Pesquisa pesada pode ir para subagente; traga para o Gabriel só a conclusão
  com fontes.
