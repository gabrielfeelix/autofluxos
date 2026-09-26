# Revisão tela a tela, por frente

> 26/set/2026. Pedido do Gabriel no `docs/HANDOFF-26-SET-NICHOS.md` (4.2).
> Inventário de **toda rota** em `src/app/clientes/[clienteId]/`, com a
> decisão por frente. Visão em `docs/NICHOS.md`; como construir em
> `docs/PLANO-NICHOS.md`.

## Como ler

- **Geral** é a conta sem frente (`clients.nicho` nulo): o sistema de hoje,
  sem nenhuma mudança. É o que a MGM e a PCYES veem até alguém gravar a frente
  delas.
- Célula vazia: igual ao Geral.
- **some**: sai do menu. A rota direta continua abrindo e o dado não se perde.
- Toda decisão desta tabela mora em `src/core/nichos.ts` (o pacote). Nenhuma
  tela compara o nome da frente (há teste).
- ✅ feito e no ar · ⏳ decidido, falta construir · ❔ decisão do Gabriel

## Barra lateral

A ordem das seções nunca muda. Início, Conversas, Automações e Configurações
são iguais em toda frente (há teste): é por elas que o suporte explica o
sistema.

| Lugar | Geral | Aulas | Loja virtual | Restaurante | Comércio | |
|---|---|---|---|---|---|---|
| CRM › Contatos | Contatos | **Alunos** | **Clientes** | **Clientes** | **Clientes** | ✅ |
| CRM › Negócios | Negócios | **Matrículas** | | **Pedidos** | | ✅ |
| Segmentos, Etiquetas, Atividades | | | | | | |
| Comércio (seção) | Comércio | **Planos** | **Loja** | **Cardápio** | **Produtos** | ✅ |
| Comércio › Produtos | Produtos | **Planos e modalidades** | | **Pratos** | **Produtos e serviços** | ✅ |
| Comércio › Integrações | Integrações | some | | | some | ✅ |
| Análise › Vendas | Vendas | | | | | ❔ |

Aulas ganhou a seção **Planos** (Gabriel, 26/set): estúdio vende planos,
pacotes e modalidades, e cadastrados no catálogo a IA responde com o dado
certo. Na MGM serve menos, porque a Verandi já tem isso; nas próximas contas
de aula, serve.

Por que "Alunos" e "Matrículas": são as palavras que os fluxos publicados da
MGM já usam (contado em 26/set: "aula" 128 vezes, "aluno" 99, "matrícula" 10,
"cliente" nenhuma). A MGM atende também fisioterapia e massagem, mas o público
que ela mesma chama de aluno é o de sempre.

❔ Análise › Vendas: "Pedidos" no restaurante repetiria o nome de CRM ›
Pedidos. Ficou "Vendas" em todas até o Gabriel decidir.

## Telas

| Rota | Tela | Aulas | Loja virtual | Restaurante | Comércio | |
|---|---|---|---|---|---|---|
| `/` | Início | primeiros passos da frente | idem | "Cadastre 5 pratos com foto" (PLANO 1.3) | idem | ⏳ etapa 7 |
| `/inbox`, `/favoritas` | Conversas | | | | | igual |
| `/conversas/respostas-rapidas` | Respostas rápidas | sugestões: horário, experimental, reposição | frete, troca, prazo | horário, taxa, endereço | horário, endereço | ⏳ |
| `/conversas/canais/*` | Canais | | | | | igual |
| `/leads` | Contatos | título **Alunos** | título **Clientes** | idem | idem | ✅ título · ⏳ estado vazio |
| `/leads/[contatoId]` | Ficha do contato | | | | | igual |
| `/leads/segmentos`, `/leads/etiquetas`, `/leads/importar` | | | | | | igual |
| `/quadros` | Negócios | título **Matrículas**, funil "Agenda e avaliação" | funil Comercial | título **Pedidos**, funil Pedidos | funil Atendimento | ✅ |
| `/quadros/atividades`, `/atividades` | Atividades | | | | | igual |
| `/negocios/[cartaoId]` | Negócio | | | | | ⏳ título "Matrícula"/"Pedido" |
| `/fluxos` | Automações | só modelos da frente + de qualquer negócio | idem | idem | idem | ✅ |
| `/fluxos/[fluxoId]` | Editor | | | | | igual |
| `/transmissoes`, `/respostas` | | | | | | igual |
| `/loja`, `/loja/magento`, `/loja/nuvemshop` | Integrações da loja | some do menu | | | some do menu | ✅ |
| `/loja/catalogo` | Produtos | **Planos e modalidades**: planos, pacotes e modalidades que a IA consulta | lista | **Pratos**, grade com foto, cardápio em arquivo | **Produtos e serviços** | ✅ |
| `/relatorios` | Atendimento | | | | | igual |
| `/relatorios/vendas` | Vendas | | | | | ❔ ver acima |
| `/ajustes` | Configurações | | | | | igual |
| `/ajustes/negocio` | Dados da organização | | | | | igual |
| `/ajustes/contexto` | Conhecimento da IA | vira a **Ficha do assistente** com as perguntas da frente | idem | idem | idem | ⏳ 4.6 |
| `/ajustes/horario`, `/ajustes/retomada` | Horário e retomada | | | | | igual |
| `/ajustes/acervo` | Arquivos e mídias | | | | | igual |
| `/ajustes/recursos` | Objetivo e recursos | campo "Tipo de negócio" (PLANO 1.4) | idem | idem | idem | ⏳ |
| `/ajustes/equipe`, `/ajustes/plano`, `/ajustes/chaves`, `/ajustes/anuncios`, `/ajustes/integracoes` | | | | | | igual |
| `/configurar` | Onboarding | primeira pergunta é a frente | idem | idem | idem | ⏳ etapa 7 |

## Galeria de modelos

Decisão do Gabriel (26/set): conta com frente vê **só os modelos da frente**,
mais os que servem a qualquer negócio. Conta sem frente vê tudo. A busca
procura só no que a conta vê. ✅

| Frente | Modelos de fluxo | Funil |
|---|---|---|
| Aulas | agendamento, reagendamento, não comparecimento, lembrete de aula, aluno que parou de vir | Agenda e avaliação |
| Loja virtual | carrinho abandonado, cadê meu pedido, lembrete de pagamento | Comercial |
| Restaurante | cardápio com botões, atendente com IA, horário e como chegar | Pedidos |
| Comércio | vocês têm?, horário e como chegar | Atendimento |
| Qualquer negócio | qualificar e passar para alguém, recebi seu recado, menu de dúvidas, pesquisa de satisfação | Atendimento |

Os cinco modelos de aulas são os mesmos que a MGM já usa, e todos precisam da
integração com o sistema de agenda do cliente. A frente não instala nada na
MGM: a galeria só oferece.

## O que ficou para as próximas etapas

1. Estado vazio de Contatos e do catálogo com a palavra da frente.
2. Título do negócio aberto ("Matrícula", "Pedido").
3. Sugestões de respostas rápidas por frente.
4. Primeiros passos do Início por frente (etapa 7).
5. Campo "Tipo de negócio" em Objetivo e recursos (PLANO 1.4) e no admin
   (etapa 9), com auditoria.
