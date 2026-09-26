# Troca de frente no topo, estilo RD Station

> 26/set/2026. Pesquisa pedida no `docs/HANDOFF-26-SET-NICHOS.md` (4.4).
> Nada construído: são opções para o Gabriel decidir. Preço não se mexe aqui
> (mora só em `src/core/planos.ts`).

## Como a RD faz

- Três produtos: **Marketing**, **CRM** e **Conversas**. Cada um é contratado
  e cobrado à parte, com plano e base de cobrança próprios: Marketing por
  contato, CRM por usuário, Conversas por mensalidade com implantação.
- O login está sendo unificado ("Conta RD"), mas por baixo ainda são contas
  separadas: a integração Marketing e CRM exige o mesmo e-mail nas duas.
- Não há preço de pacote combinado: a integração é argumento de venda, não
  desconto.
- Produto não contratado: o Marketing tem teste de 10 dias; o CRM tem plano
  grátis; o Conversas só com o time de vendas.
- Páginas por segmento (e-commerce, educação, saúde...) levam aos **mesmos
  planos**. O ramo é página de venda, não produto.
- Não deu para confirmar como é o seletor do topo nem o que acontece ao
  clicar num produto não contratado: o artigo de ajuda
  (`ajuda.rdstation.com/s/article/Navbar-360`) só abre logado. Vale um print
  da tela da RD.

## Os concorrentes

Nenhum cobra diferente por ramo. Agendor, Kommo, Botconversa, Zenvia e Blip
têm um produto só, com página de venda por segmento. O que mais se aproxima
do nosso é o Agendor (funis e campos por ramo, a partir do plano Pro) e o
Botconversa (a IA monta tom e perguntas pelo nicho escolhido).

**Conclusão:** a RD separa produtos diferentes; ninguém separa ramos em
produtos pagos à parte.

## Opções para o AutoFluxos

### A. O seletor troca a frente da própria conta

O topo mostra "AutoFluxos · Restaurante" e abre a lista de frentes. Escolher
outra regrava `clients.nicho`: barra, palavras e modelos mudam.

- A favor: não muda banco nem plano; serve para demonstração e para quem
  escolheu errado.
- Contra: não é produto como na RD, é ajuste da conta. Trocar à toa confunde
  ("sumiu meu Cardápio"): precisa confirmar, gravar auditoria e não apagar
  nada.

### B. Uma conta por frente, e o seletor troca de conta

Como o "acesso a múltiplas contas" da RD: o mesmo login vê vários `clients`,
cada um com frente e plano. A frente sem conta aparece com "Conhecer".

- A favor: é o modelo da RD, com plano e cobrança por frente, e isola número,
  contatos e fluxos (dono com pizzaria e loja).
- Contra: a troca de conta já existe no topo, mas vender a frente como
  produto parece cobrar duas vezes pelo mesmo sistema, e nenhum concorrente
  faz isso.

### C. O seletor mostra módulos, e a frente fica fixa

A frente é escolhida no onboarding e trocada só em Configurações. O seletor
lista módulos (Atendimento, CRM, Cardápio ou Loja, Agenda), com o nome da
frente; módulo fora do plano aparece com cadeado e leva ao upgrade.

- A favor: é o que a RD faz de verdade (separa o que é produto diferente) e o
  que os concorrentes fazem com o ramo (configuração). Usa `crm_ativo`,
  `loja_ativa` e `clients.plano`, que já existem.
- Contra: não é "trocar de frente" ao pé da letra; junto com a troca da
  opção A em Configurações, cobre os dois pedidos.

## Recomendação

**C, com a troca de frente da A dentro de Configurações.** É o que o mercado
valida e cabe no que já existe. A B só compensa se aparecer cliente real com
dois negócios de ramos diferentes; e mesmo aí a troca de conta do topo já
serve.

## Fontes (lidas em 26/set/2026)

- https://www.rdstation.com/planos/ (e `/marketing/`, `/crm/`, `/conversas/`)
- https://www.rdstation.com/segmentos/ecommerce/
- https://ajuda.rdstation.com/s/article/Como-integrar-o-RD-Station-Marketing-e-RD-Station-CRM
- https://www.agendor.com.br/planos-precos
- https://www.kommo.com/buy/tariff/
- https://gpt.botconversa.com.br/
- https://www.blip.ai/solucoes/varejo/
