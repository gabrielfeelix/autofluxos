# Plano: nichos e demonstração

> 26/set/2026. Visão e decisões em `docs/NICHOS.md`; este arquivo diz **como**
> construir. Primeira leva: restaurante, e-commerce, comércio de rua.
> Migration: a próxima é a que o diretório disser (`ls supabase/migrations |
> tail -1`), nunca a numeração escrita aqui.

## 0. O ponto de partida (medido no código em 26/set)

| Peça | Onde | Estado |
|---|---|---|
| Barra lateral | `src/components/design/secoes-do-cliente.tsx` (`SECOES`, `secoesVisiveis`) | rótulos fixos; some seção por `crmVisivel`, `lojaVisivel` e permissão |
| Objetivo da conta | `src/core/objetivo-da-conta.ts`, `clients.objetivo` | `atender`, `automatizar`, `vender`; decide o que o onboarding cobra |
| Onboarding | `components/onboarding/assistente.tsx`, `core/onboarding.ts` | pergunta "o que organizar primeiro"; não pergunta o ramo |
| Criar conta | `server/repos/clientes.ts` `criarCliente(nome)` | insere só o nome; `acaoCriarExemplo` já cria conta com fluxo pronto |
| Catálogo próprio | tabela `produtos` | nome, preço, sku, descrição, link, foto. **Sem categoria**, sem adicionais |
| IA na loja | `core/ferramentas.ts` (`loja_buscar`, `loja_mostrar`...) | funciona com o catálogo próprio, sem Magento |
| PDF pela IA | `loja.downloads` | só Magento com módulo de drivers; **sem PDF de cardápio** |
| Nó de IA no fluxo | `core/flow/schema.ts`, `executar.ts:368` | responde **uma vez** e segue; não existe "conversar com a IA" |
| Nó de mídia | `core/flow/schema.ts:235` | manda imagem ou PDF fixo por URL: serve para o cardápio em PDF |
| Limite de IA | nenhum por conta ou contato | só cota do Google e log em `ia_chamadas` |
| Número de demo | canal `fa673a09...` na conta PCYES | +55 44 7400-7438, "4YU Tech", Cloud API, ativo, 7 contatos de teste |

## 1. UX: o que a pessoa vive

### 1.1 Onboarding: primeira pergunta é o ramo

Hoje a primeira pergunta é "o que você quer organizar". Passa a ser:

**"Qual é o seu negócio?"** em cartões grandes, um toque:

- Restaurante, lanchonete, delivery
- Loja virtual (site)
- Loja física, comércio
- Outro

Depois do ramo, a pergunta de objetivo continua, **já marcada** com a sugestão
do ramo (restaurante e loja: vender; comércio: atender). O dono pode trocar.

Última tela: **"Preparamos isso para você"**, com a lista do que vai ser
criado, cada item com caixa marcada:

- Restaurante: cardápio de exemplo, bot de pedido (botões), atendente com IA,
  funil de pedidos, respostas rápidas (horário, taxa de entrega, endereço).
- Loja virtual: bot de busca de produto, carrinho abandonado, status do
  pedido, funil comercial.
- Comércio: bot "vocês têm?", horário e localização, funil de atendimento.

Um botão: **Preparar minha conta**. Nada é criado sem esse clique, e tudo que
nasce vem como rascunho que o dono vê antes de ir ao ar.

"Outro" cai no caminho de hoje, sem pacote. Nenhum cliente atual muda.

### 1.2 Barra lateral por ramo

Mesmas seções e mesma ordem; muda o nome e o que aparece dentro de
"Comércio".

| Seção | Geral (hoje) | Restaurante | Loja virtual | Comércio |
|---|---|---|---|---|
| Comércio | Comércio | **Cardápio** | **Loja** | **Produtos** |
| item 1 | Produtos | Pratos | Produtos | Produtos e serviços |
| item 2 | Integrações | Cardápio em PDF | Integrações | (some) |
| item 3 | | Integrações (iFood, depois) | | |

Regra de UX: **a ordem das seções não muda entre ramos**, para o vendedor e o
suporte explicarem o sistema do mesmo jeito. Mas o nome muda, e **o que não
faz sentido para o ramo some** (ver 1.6).

### 1.3 Início por ramo

Os "primeiros passos" do Início passam a vir do pacote do ramo. Restaurante:

1. Conecte o WhatsApp
2. Cadastre 5 pratos com foto
3. Suba o cardápio em PDF ou imagem
4. Escreva horário e taxa de entrega
5. Teste o bot pelo seu celular

Estado vazio de cada tela fala do ramo: "Nenhum prato ainda. O bot mostra aqui
a foto e o preço quando o cliente pedir o cardápio."

### 1.4 Trocar de ramo depois

Em `Configurações > Recursos`, um campo "Tipo de negócio". Trocar muda nomes
e primeiros passos. **Não apaga nada** e não instala nada sozinho: oferece o
pacote novo com a mesma tela do 1.1.

### 1.6 O sistema inteiro muda pelo ramo (pedido do Gabriel, 26/set)

Não é só a seção Comércio. Quem escolheu "restaurante" tem que sentir que o
sistema foi feito para restaurante em **todas** as telas; quem troca para
"loja virtual" vê outra linguagem e outro menu. O pacote do ramo passa a
cobrir:

| Onde | O que muda | Exemplo restaurante |
|---|---|---|
| Barra lateral inteira | nome e presença de **qualquer** subitem, não só Comércio | Vendas vira Pedidos; sem aba de e-commerce |
| Galeria de modelos (fluxos e funis) | mostra primeiro, ou só, os do ramo | cardápio, pedido, horário; não carrinho abandonado |
| Configurações | os campos do negócio são os do ramo | horário, taxa e área de entrega, formas de pagamento |
| Contexto do negócio (o que a IA sabe) | vem com um roteiro do ramo para preencher | "tem opção vegetariana? faz meia a meia?" |
| Início e estados vazios | primeiros passos e textos do ramo | "Cadastre 5 pratos com foto" |
| Relatórios e funil | nomes das etapas e dos números | Novo pedido, Em preparo, Saiu para entrega |

**Perguntas extras no onboarding**, por ramo, cada uma liga ou não um pedaço
do pacote. Restaurante: faz entrega? aceita reserva? está no iFood? tem
cardápio em PDF? Quem responde "faz entrega" ganha o fluxo de pedido com
endereço e taxa; quem responde "aceita reserva" ganha o fluxo de reserva. As
respostas ficam guardadas na conta e podem ser mudadas em Configurações, o
que oferece de novo os fluxos correspondentes.

Regras que continuam valendo: o ramo **não** muda permissão nem cobrança; o
que some do menu continua existindo (link direto funciona e o dado não se
perde); e todo "some ou aparece" sai do pacote em `core/nichos.ts`.

### 1.5 A demo, pelo lado do dono da pizzaria

1. Aponta a câmera no QR do flyer. Abre o WhatsApp com "Quero testar:
   pizzaria" já escrito. Ele só aperta enviar.
2. O bot responde como a **Pizzaria Exemplo**: "Oi! Quer ver como seu cliente
   seria atendido? Escolha: Com botões / Com IA".
3. **Botões:** menu (Cardápio, Promoções, Fazer pedido, Horário, Falar com
   atendente). Cardápio manda a imagem do cardápio e o PDF; cada categoria
   mostra os pratos em cartão com foto e preço; pedido junta os itens,
   pergunta endereço e fecha com resumo.
4. **IA:** conversa livre. "Tem pizza sem lactose?", "manda foto da
   calabresa", "quanto fica duas grandes e uma coca?".
5. A qualquer momento: "Quero isso na minha pizzaria" leva a um atendente
   (o Gabriel), com o resumo de quem é.
6. QR do flyer de loja ou comércio: texto diferente, mesmo número, cai direto
   no ramo certo. Sem texto nenhum, o bot pergunta o ramo antes.

## 2. UI: como fica na tela

- **Um design só.** O ramo não troca cor, fonte nem layout. Troca palavra,
  ícone da seção, exemplos e ilustração de estado vazio. Motivo: um tema por
  ramo multiplica o trabalho de toda tela nova e não vende nada que a palavra
  certa já não venda.
- **Ícones da seção Comércio:** restaurante usa prato/talheres; loja virtual,
  sacola; comércio, vitrine.
- **Cardápio em grade:** para restaurante, a tela de produtos abre em grade
  com foto, agrupada por categoria, com arrastar para ordenar categoria e
  prato. A tabela atual continua como segunda visão ("Lista"). Os outros
  ramos continuam abrindo na tabela.
- **Cartão do onboarding:** ícone grande, nome do ramo, uma linha de exemplo
  ("pizzaria, hamburgueria, marmitaria"). Sem texto longo.
- **"Preparamos isso para você":** lista com caixas, cada item com um
  "ver" que abre o rascunho do fluxo ou do cardápio de exemplo.
- **Cardápio em PDF:** um bloco de envio de arquivo com prévia da primeira
  página e o texto "o bot manda este arquivo quando pedirem o cardápio".

## 3. Governança: quem decide o quê, e o que protege o sistema

### 3.1 O pacote de ramo mora no código

Cada ramo é um objeto em `src/core/nichos.ts`, versionado no git, revisado
como código. Não é tabela editável em produção. Motivo: pacote de ramo muda o
que **toda conta nova** recebe; mudança assim tem que passar por revisão e
teste, igual preço (`core/planos.ts` segue a mesma regra).

### 3.2 O que o pacote pode e não pode fazer

- Pode: nomes de tela, ícone, primeiros passos, objetivo sugerido, lista de
  modelos a oferecer, texto inicial do "Sobre a empresa".
- **Não pode:** ligar ou desligar permissão, mudar regra de cobrança, apagar
  dado, ou criar regra de negócio no núcleo. Permissão depende da função da
  pessoa, não do ramo (já é a regra da PROPOSTA-19-SET §1.1).
- Ramo nunca vira `if (nicho === 'restaurante')` espalhado pelo código. Todo
  comportamento por ramo sai do objeto do pacote. Um teste varre `src/` e
  falha se achar comparação direta com nome de ramo fora de `core/nichos.ts`.

### 3.3 Quem troca o ramo

- Dono e administrador da conta (capacidade `configurar_empresa`), em
  Configurações.
- Admin da plataforma, pelo painel `/admin/organizacoes/[id]`.
- Toda troca grava em auditoria (quem, de qual, para qual).

### 3.4 Modelos instalados são do cliente

O pacote **copia** fluxo, funil e produtos de exemplo para a conta. A partir
daí são dele: editar o pacote no código não altera conta que já existe. Isso
evita que uma melhoria no modelo quebre o bot de alguém em produção.

### 3.5 A conta de demonstração

- Conta própria, **"4YU Demonstração"**, separada da PCYES. Nenhum dado de
  cliente real dentro dela.
- Quem conversa com a demo vira contato dessa conta: é um **lead nosso**.
  O funil da conta demo é o nosso funil de venda na rua.
- Aviso na primeira mensagem: "Isto é uma demonstração da 4YU. Pedidos aqui
  não são reais."
- IA com limite por contato por dia (ver 4.6), para um curioso ou um robô não
  queimar a cota.

### 3.6 Banco compartilhado

Tudo em `public`, conforme `docs/BANCO-COMPARTILHADO.md`. O arquivo do
cardápio usa Storage, que é global aos dois produtos: antes de criar bucket,
ler a seção de Storage do documento e usar prefixo do AutoFluxos. Nenhuma
migration vai à produção sem autorização.

### 3.7 Fora da primeira leva, de propósito

Saúde fica fora até ter cliente e um desenho de LGPD (dado sensível, art. 11).
Distribuidor fica fora até ter cliente.

## 4. Programação

### 4.1 Núcleo do ramo (puro, sem banco)

`src/core/nichos.ts`:

```ts
export const NICHOS = ['restaurante', 'ecommerce', 'comercio'] as const
export type Nicho = (typeof NICHOS)[number]

export type PacoteDoNicho = {
  nome: string                  // "Restaurante, lanchonete, delivery"
  exemplos: string              // "pizzaria, hamburgueria, marmitaria"
  objetivoSugerido: Objetivo
  rotulos: Partial<Record<IdDaSecao | IdDaAba, string>>
  abasOcultas: IdDaAba[]
  primeirosPassos: PassoDoInicio[]
  modelosDeFluxo: string[]      // ids de src/exemplos/modelos.ts
  modeloDeFunil: string         // id de core/quadros-modelos.ts
  contextoInicial: string       // rascunho do "Sobre a empresa"
}
export function pacoteDo(nicho: Nicho | null): PacoteDoNicho | null
```

Testes ao lado (`nichos.test.ts`): todo id de modelo citado existe; todo
rótulo aponta para seção que existe; `null` devolve o comportamento de hoje.

### 4.2 Banco

Uma migration: `clients.nicho text null` com `check` nos três valores. Nula
é "geral": nenhuma conta atual muda.

Uma migration de catálogo: `produtos.categoria text null` e
`produtos.ordem int null`. Adicionais e meia a meia **não** entram agora (ver
4.8).

Uma migration de arquivo da conta: `materiais` (`client_id`, `tipo`
`cardapio`, `url`, `nome_arquivo`, `atualizado_em`), com RLS igual às outras
tabelas da conta.

### 4.3 Barra lateral e Início

- `secoesVisiveis` ganha `pacote?: PacoteDoNicho | null` e aplica
  `rotulos` e `abasOcultas`. `rotuloDaSecao` e `abasVisiveis` usam o mesmo.
- `barra-do-cliente.tsx` lê `clients.nicho` junto com `crmVisivel` e
  `lojaVisivel` (mesma ida ao banco em `recursosDaConta`).
- `secoes-do-cliente.tsx` continua sem banco, para o `loading.tsx` seguir
  funcionando (ver memória sobre `loading.tsx`).

### 4.4 Onboarding e instalação do pacote

- `core/onboarding.ts`: passo novo "ramo" antes do objetivo.
- `server/acoes-onboarding.ts`: `acaoPrepararConta` recebe `nicho` e a lista
  marcada; grava o ramo e chama `instalarPacote`.
- `server/pacotes.ts` `instalarPacote(clienteId, nicho, itens)`: cria fluxos
  pelos modelos (mesmo caminho de `acaoCriarFluxo`, como rascunho), cria o
  funil (`criarQuadro(..., modeloId)`), cria produtos de exemplo e grava o
  contexto inicial se estiver vazio. **Idempotente**: rodar duas vezes não
  duplica (marca o que já instalou pelo id do modelo).

### 4.5 Modelos novos

Em `src/exemplos/modelos.ts`, etiqueta nova "Restaurante":

- `cardapio-botoes`: menu, cardápio (nó mídia com a imagem e o PDF),
  categorias (pergunta em lista), pratos (cartões do catálogo), pedido
  (pergunta itens, endereço, resumo, handoff para a cozinha/atendente).
- `atendente-ia-restaurante`: nó de IA contínua (4.6) com `loja_buscar`,
  `loja_mostrar` e envio do cardápio.
- Comércio: `voces-tem` (IA contínua com busca no catálogo) e
  `horario-e-local`.
- Loja virtual: reaproveita `carrinho-abandonado`, `status-do-pedido` e o
  que a PCYES já usa.

Funil `pedidos` em `core/quadros-modelos.ts`: Novo pedido, Em preparo, Saiu
para entrega, Entregue.

### 4.6 Duas peças de motor que a demo exige

1. **IA contínua.** O nó `ia` ganha `conversar: { maxTurnos, sairCom? }`.
   Com isso ligado, o nó segura a conversa: cada mensagem do cliente volta ao
   mesmo nó até (a) a IA pedir handoff, (b) o cliente escolher sair
   ("menu"), ou (c) bater `maxTurnos`. Implementação no `executar.ts`, como
   estado da sessão, **sem** aresta de volta: não mexe na proteção contra laço
   do `validar.ts` nem no `MAX_SALTOS`.
2. **Limite de IA por contato.** `ia_chamadas` já registra cada chamada.
   Antes de chamar o modelo, contar as do contato nas últimas 24 h e, acima do
   limite da conta (`clients.ia_limite_contato_dia`, nulo = sem limite),
   responder com a mensagem de limite e oferecer atendente.

### 4.7 Cardápio em PDF e imagem

- Tela de envio no Cardápio grava em `materiais`.
- Ferramenta nova `enviar_cardapio` em `core/ferramentas.ts`, que manda o
  arquivo pelo mesmo caminho dos cartões (`comCards`), sem passar o arquivo
  pelo modelo. Serve a IA; o fluxo de botões usa o nó `midia` direto.
- `loja_buscar` e `loja_mostrar` aceitam `categoria` (o catálogo próprio passa
  a filtrar por ela).

### 4.8 Deixado para depois, de propósito

- Adicionais, sabores e meia a meia: exigem modelo de variação no produto.
  Na demo, a IA entende "meia calabresa meia mussarela" no texto do pedido;
  a estrutura vem quando houver restaurante pagando.
- iFood: módulo de catálogo da Merchant API, com homologação do iFood
  (`docs/NICHOS.md`). Entra depois do cardápio próprio.
- Pagamento no chat.
- Página `4yu.com.br/demo` com o widget do canal Site.

### 4.9 Conta de demonstração e o número

Decidido em 26/set: **o número fica na conta PCYES** (é conta de teste do
Gabriel, não a da PCYES de verdade). Não há conta nova nem canal movido.

1. A demo roda na conta PCYES, no canal `fa673a09-e90d-4a86-ac21-d75ee5fdca26`.
2. **Conflito a resolver na etapa 6:** essa conta tem Magento ligado, e
   `lojaAtivaDaConta` escolhe Magento antes do catálogo próprio. Do jeito que
   está, a IA da pizzaria buscaria na loja Magento. Saída prevista: o nó de IA
   ganha a escolha da fonte (`loja` ou `catalogo`), sem mudar o padrão de
   quem não escolhe.
3. Montar o cardápio da Pizzaria Exemplo: umas 15 pizzas, bebidas e
   sobremesas, com foto e preço; imagem e PDF do cardápio.
4. Fluxo de entrada: lê o texto do QR ("Quero testar: pizzaria") por
   gatilho de palavra-chave e pula para o ramo; sem texto, pergunta o ramo.
5. Publicar, ligar a IA (ação de admin da plataforma), testar do celular.
6. QR: `https://wa.me/554474007438?text=Quero%20testar%3A%20pizzaria`.

Um ramo por vez no catálogo da demo: quando loja e comércio entrarem, cada
ramo usa sua categoria e a IA recebe `categoria` fixa no nó (4.7).

## 5. Ordem de execução

Cada etapa termina com teste passando, commit e push. Etapas com migration
param antes do push para pedir autorização (o push é o deploy).

| # | Etapa | Toca produção? |
|---|---|---|
| 1 | `core/nichos.ts` + testes; barra lateral lendo o pacote (**feito 26/set**; primeiros passos do Início ficam para a 7) | não (sem nicho, nada muda) |
| 2 | Migration `0106`: `clients.nicho`, `produtos.categoria/ordem`, `materiais`, `ia_limite_contato_dia` (**aplicada 26/set**) | sim, autorizada |
| 3 | Motor: IA contínua e limite por contato (**feito 26/set**; `sairCom` ficou de fora, as palavras de saída são lista fixa no motor; o limite conta respostas gravadas em `ia_chamadas` com `ferramenta = 'resposta'`, só em conta com limite, e não tem tela) | não |
| 4 | Cardápio: categoria, grade com foto, envio de PDF, `enviar_cardapio` (**feito 26/set**; o arquivo sobe para o bucket que já existia, `autofluxos-acervo`, na pasta da conta, sem bucket nem política nova; ordenar é por botões de subir e descer, arrastar ficou de fora; a prévia da primeira página do PDF ficou de fora, a tela mostra o nome e um link para abrir; o aviso do editor sobre loja desligada ainda cita `enviar_cardapio` junto das consultas de loja) | não |
| 5 | Modelos do restaurante e funil de pedidos (**feito 26/set**; `cardapio-botoes`, `atendente-ia-restaurante`, `voces-tem`, `horario-e-local` e o funil `pedidos`, com "Cancelado" como etapa de perda; o pacote ganhou `modelosDeFluxo`, `modeloDeFunil` e `tituloDosModelos`, e as galerias de fluxo e de funil mostram o ramo primeiro e o resto recolhido. Ficou de fora: o cardápio com botões manda o arquivo e os pratos por blocos de IA restritos, então **três dos quatro modelos pedem a IA ligada** (etiqueta "Precisa de IA"); o bloco de etapa e a etiqueta "Novo pedido" não vêm no modelo, porque apontam para ids da conta: o pedido chega com motivo "Novo pedido" e nota no contato, e ligar ao funil é da instalação do pacote (7); o atendente com IA fecha o pedido pedindo "menu" e "Enviar pedido", sem palavra de saída nova no motor; as partes do cardápio nos botões são fixas de pizzaria e o dono edita; sem desenho próprio na galeria, os quatro usam o genérico) | não |
| 6 | Conta demo, mover o número, cardápio da Pizzaria Exemplo, QR | **sim, pedir autorização** |
| 7 | Onboarding por ramo, perguntas extras do ramo e instalação do pacote | não (a resposta das perguntas extras pode pedir coluna: se pedir, autorização) |
| 7.1 | O sistema inteiro pelo ramo (1.6): inventário de telas, barra inteira, galeria, Configurações, Início, relatórios | não |
| 8 | Pacotes de loja virtual e comércio, e seus ramos na demo | não |
| 9 | Painel admin: ver e trocar ramo, auditoria | não |

A demo (6) vem antes do onboarding (7) de propósito: é o que destrava venda, e
montar a demo à mão mostra o que o pacote precisa instalar.

## 6. Como saber que deu certo

- Conta sem ramo: barra lateral e Início idênticos aos de hoje (teste de
  `secoes-do-cliente` com `pacote: null`).
- Do celular de alguém fora da empresa: QR, "Quero testar: pizzaria", modo
  botões até o resumo do pedido, modo IA pedindo foto da calabresa. A foto e
  o PDF chegam.
- Conferir no banco que a conversa ficou na conta demo, não na PCYES.
- Conta nova de restaurante criada pelo onboarding sai com cardápio de
  exemplo, dois fluxos em rascunho e funil de pedidos, e rodar o preparo de
  novo não duplica nada.
