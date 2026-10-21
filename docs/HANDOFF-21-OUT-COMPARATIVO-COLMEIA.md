# Handoff: 21/out/2026, AutoFluxos contra Colmeia (features)

Para o agente que vai cuidar das features do AutoFluxos. Primeira tarefa:
comparar com a Colmeia e dizer o que já fazemos, o que eles fazem e nós não, e
o que vale construir primeiro. É pesquisa e proposta; **nada de implementar
antes do Gabriel aprovar a lista**.

## A missão

O Gabriel achou a Colmeia (https://colmeia.cx/integracoes/) e gostou muito.
Pelo que ele viu:

- recebem pagamento dentro do chat;
- usam o catálogo do WhatsApp;
- usam WhatsApp Flows;
- são omnichannel: WhatsApp, e-mail, SMS, RCS, webchat e outros.

Ele quer saber:

1. O que nós já fazemos que eles também fazem.
2. O que eles fazem e nós não fazemos.
3. O que falta e vale a pena construir, em ordem, com esforço estimado.

## O que se sabe da Colmeia

- Site: https://colmeia.cx (comece por `/integracoes/` e pelas páginas de
  produto e preço).
- [TERCEIRO] CB Insights: fundada em 2011 em Uberlândia (MG), faz criação de
  chatbot, atendimento humano e integração por API:
  https://www.cbinsights.com/company/colmeia
- Confirme tudo no site deles. Anote, para cada recurso, o link da página e se
  é recurso do produto ou só integração com terceiros.

## O que o AutoFluxos já tem (ponto de partida, reconfirmar no código)

O inventário é `docs/FUNCIONALIDADES.md`, lido do código em 05/out/2026. Ele
pode estar desatualizado: confira no código antes de afirmar.

- **WhatsApp Cloud API oficial**, com Embedded Signup e coexistência com o app
  do celular (FUNCIONALIDADES:33-39).
- **Chat do site (webchat)**: widget `public/chat/v1.js`, formulário,
  `src/channels/site.ts` (FUNCIONALIDADES:46-51).
- **Instagram**: só liga contas da 4YU até o App Review da Meta
  (FUNCIONALIDADES:44). **Telegram**: só o adaptador de envio.
- **Fluxos visuais** (15 blocos), **IA** com ferramentas, **sequências**,
  **modelos da Meta e transmissões**, **CRM** com funis, etiquetas e
  segmentos (FUNCIONALIDADES:131-282).
- **Comércio**: catálogo, Magento e Nuvemshop (FUNCIONALIDADES:283-305).
  **Pagamento é só demonstração, sem gateway real** (FUNCIONALIDADES:304).
- **Anúncios da Meta** (clique para WhatsApp com atribuição) e **Lead Ads**
  (FUNCIONALIDADES:308-313). **API pública v1** (FUNCIONALIDADES:324-346).
- **Não existe** (FUNCIONALIDADES:447-465): gateway de pagamento, frete,
  e-mail marketing, métricas de clique em transmissão, Conversions API,
  mesclar contatos, exportar relatórios.
- Achado da pesquisa de prospecção (`docs/PROSPECCAO-AUTOFLUXOS.md`): não há
  **opt-out por palavra** ("SAIR") nem **registro de opt-in** por contato.
- `docs/CONCORRENTES-22-SET-PROFUNDIDADE.md` (linhas 22-40) já apontava
  "pagamento no chat sem configurar API na mão" como o buraco do mercado.

## Perguntas que o comparativo precisa responder

1. **Pagamento no chat**: como a Colmeia faz (Pix, cartão, link, gateway
   próprio ou de terceiro)? O que a Meta oferece oficialmente no Brasil para
   empresa receber pagamento dentro do WhatsApp? Confirme na documentação da
   Meta, com link e data.
2. **Catálogo do WhatsApp**: o nosso "catálogo" usa o catálogo oficial da Meta
   (Commerce Manager, mensagens de produto) ou é só nosso? O que falta para
   usar o oficial?
3. **WhatsApp Flows** (formulários nativos dentro do WhatsApp): eles usam? Nós
   não temos. Quanto custa construir?
4. **Canais**: e-mail, SMS e RCS. Quais fazem sentido para os nossos clientes
   (pequeno negócio e empresa com time de vendas) e quanto custa operar cada
   um?
5. **O que nós temos e eles não**: argumento de venda. Ex.: coexistência com o
   app do celular, atribuição de anúncio com nome, integração com a Verandi.

## Entrega

- `docs/COMPARATIVO-COLMEIA.md` com:
  - matriz de recursos: Colmeia / AutoFluxos (tem, parcial, não tem), com a
    fonte de cada linha (link ou arquivo:linha);
  - top 5 lacunas, ordenadas por valor para os clientes reais (PCYES é loja
    com e-commerce; MGM é estúdio com agenda), com esforço estimado e
    dependência da Meta;
  - seção "não confirmado".
- Recomendação clara no topo: o que construir primeiro e por quê.
- Commit e push na hora (credencial no `4yu-apps/CLAUDE.md`).

## Regras deste repositório

- Antes de mexer em banco, migration, Auth ou Storage: ler inteiro
  `docs/BANCO-COMPARTILHADO.md` e o `AGENTS.md`. O banco de produção é
  dividido com a Verandi.
- Nada em produção sem autorização explícita do Gabriel.
- O Gabriel é designer, não dev: pt-BR, curto, decisão tomada com
  recomendação. **Travessão proibido** em todo texto e arquivo. Link clicável
  sempre que citar página externa.

## Contexto paralelo (não é desta tarefa)

- O nome do produto está em revisão: `docs/NAMING.md`. Não renomeie nada.
- Plano comercial: `docs/PROSPECCAO-AUTOFLUXOS.md`.
