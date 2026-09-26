# Ideias da conversa de 26/set/2026

Fonte: a conversa de 26/set entre o número da 4YU (Eduardo) e o Gabriel no
Inbox da conta 4YU, lida inteira: 117 mensagens, 23 imagens e 8 áudios
(transcritos à parte, fora do repositório). Onde a ideia vinha de 25/set, o
trecho de lá também foi lido. Nada de print, telefone ou valor de cliente
entra aqui: só a ideia, com as palavras deste documento.

A manhã foi suporte da troca de provedor do MGM (a linha de crédito do
parceiro antigo presa na conta do WhatsApp). Não é ideia de produto e o MGM
não se toca daqui; o caso já está registrado na memória do projeto.

## Resumo

| # | Ideia | Quem | Validada? | Situação |
|---|---|---|---|---|
| 1 | Logo some na barra recolhida da administração | Eduardo (print) | sim, é falha | **feito** |
| 2 | No contato, tirar a etiqueta é desanexar; apagar só em Configurações | Eduardo perguntou, Gabriel decidiu | sim, os dois | **feito** |
| 3 | Mais uma IA grátis: Cloudflare | Eduardo | Eduardo pediu o teste | **pronto no código**, falta a chave |
| 4 | Plano mensal **e anual**, com valores | Eduardo | sim, Gabriel concordou | **feito** (0110 em produção) |
| 5 | Marcar ganho e perda na negociação | Eduardo (print do RD) | já existe | nada a fazer |
| 6 | Barra de etapas na negociação, nomes por funil | Eduardo (print do RD) | Gabriel: só na negociação | já existe |
| 7 | Condições que avançam a etapa sozinhas | Eduardo | Gabriel: faz sentido na negociação | parte existe; resto é médio |
| 8 | "Tarefa" ou "Atividade"; botão "personalizado" | Eduardo | não, Gabriel em dúvida | recomendação abaixo |
| 9 | Reunião com link do Meet criado sozinho | Eduardo perguntou | não | grande, depois |
| 10 | Cobrar por usuário | Eduardo (pesquisa) | não, Gabriel em dúvida | recomendação: não |
| 11 | Trocar de "produto" dentro do AutoFluxos | Gabriel (áudio) | não | **para o agente das frentes** |
| 12 | Tela Etiquetas "não é padrão de sistema" | Gabriel | sim, Gabriel | **feito**: foi para Configurações |
| 13 | Tema claro e escuro para o cliente | Eduardo | resolvido na conversa | já existe |
| 14 | Recolher a barra pela logo | Eduardo | resolvido na conversa | já existe |

## As ideias

### 1. Logo some na barra recolhida da administração

- **O que é:** com a barra lateral recolhida, a administração ficava sem logo
  no topo, nos dois temas. O Eduardo circulou o canto vazio no print.
- **Faz sentido:** é falha. A barra recolhida esconde todo `span` que é o
  último filho (para sobrar só o símbolo), e a marca da administração inteira
  era um `span`: sumia tudo.
- **Feito:** commit `aa8bbb5`. O invólucro virou `div`; recolhida, sobra o
  símbolo, igual à área da organização. Conferido no navegador reproduzindo a
  mesma regra de CSS antes e depois.
- **Tamanho:** mínimo.

### 2. No contato, tirar a etiqueta é desanexar

- **O que é:** o Eduardo perguntou se faz sentido apagar etiqueta em dois
  lugares (na ficha do contato e na tela Etiquetas). O Gabriel respondeu que na
  ficha o certo é **tirar a etiqueta daquela pessoa**, nunca apagar a etiqueta
  do sistema. O Eduardo concordou.
- **O que já existia:** o comportamento já era esse (clicar na etiqueta acesa
  tira dela), mas nada na tela dizia isso, e o Gabriel mesmo estranhou o print.
- **Feito:** commit `aedfba2`. Etiqueta aplicada mostra `×`, a não aplicada
  mostra `+` com borda tracejada, e o rótulo diz "Tirar deste contato (a
  etiqueta continua existindo)". Vale para todos os lugares que usam o seletor:
  ficha do contato, painel do funil e Inbox.
- **Tamanho:** mínimo.

### 3. Mais uma IA grátis: Cloudflare

- **O que é:** em 25/set a cota grátis da IA acabou no meio do teste do
  atendimento da PCYES. O Eduardo pesquisou provedores grátis (Groq, Mistral,
  Cloudflare, OpenRouter). O Groq já entrou; hoje o Gabriel contou que Mistral
  e Cerebras recusaram cartão brasileiro, e o Eduardo pediu para testar o
  Cloudflare.
- **Faz sentido:** sim. Cada provedor tem sua cota, e a fila soma as cotas. O
  bot dos pagantes parar por cota é o pior lugar para faltar IA.
- **Feito:** commit `49de3ed`. O Cloudflare entrou na fila (depois do Groq e do
  Cerebras, antes do Mistral), com o mesmo modelo do Groq. Só entra se as duas
  variáveis existirem no ambiente.
- **Falta (Gabriel ou Eduardo):** criar a conta no Cloudflare, gerar um token
  de Workers AI, pôr `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` no `.env`,
  rodar a suíte de escopo com `IA_PROVEDOR=cloudflare IA_TESTE_REAL=1` e, se
  passar, pôr as duas na Vercel.
- **Tamanho:** pequeno (feito); o teste real depende da chave.

### 4. Plano mensal e anual, com valores

- **O que é:** o Eduardo disse que o site e a assinatura deveriam mostrar o
  preço mensal e o anual. O Gabriel concordou.
- **Faz sentido:** sim, e é o item que mais mexe em renda: o anual traz o
  dinheiro de um ano de uma vez e segura o cliente. É padrão de mercado.
- **O que já existe:** só preço mensal. Desde a migration 0102 o plano mora no
  banco (a administração cria plano), e `src/core/planos.ts` segue sendo a
  única fonte que o site e o sistema leem.
- **Feito:** o Gabriel autorizou a migration e deixou o desconto comigo. A
  `0110` criou `planos.preco_anual`, preenchida com "pague 10 meses, leve 12"
  (17% a menos), aplicada em produção em 26/set e conferida (Verandi intacta).
  O site e a tela de plano mostram "ou R$ X/mês no anual"; a administração
  edita o valor em Planos (vazio = sem anual). Commit `4355783`.
- **Falta, se quiserem:** registrar por organização se ela paga no mensal ou no
  anual. Hoje o anual é preço anunciado; quem contrata anual tem o valor
  ajustado à mão em "preço contratado".

### 5. Marcar ganho e perda na negociação

- **O que é:** o Eduardo mandou o print do RD com "Marcar perda" e "Marcar
  venda" e achou que seria bom ter.
- **O que já existe:** a página do negócio (CRM > Negócios > um negócio) já tem
  "Marcar como ganho" e "Marcar como perdido", com motivo de perda. O Gabriel
  disse isso na hora, e o Eduardo achou e concluiu que no lugar atual está
  melhor.
- **Nada a fazer.**

### 6. Barra de etapas na negociação, com nomes por funil

- **O que é:** o Eduardo circulou a barra de etapas no topo da negociação do RD.
  O Gabriel perguntou: e se o contato estiver em quatro funis? Concluíram
  juntos que a barra é da **negociação**, não do contato, e cada funil tem os
  seus nomes de etapa.
- **O que já existe:** exatamente isso. A página do negócio mostra as etapas do
  funil daquele negócio como degraus clicáveis, com o progresso aceso.
- **Nada a fazer.**

### 7. Condições que avançam a etapa sozinhas

- **O que é:** uma aba de condições no funil: quando o negócio cumpre os
  requisitos (um campo preenchido, um arquivo recebido, a pessoa responder com
  certa palavra), ele passa sozinho para a próxima etapa. Do Eduardo; o Gabriel
  achou que faz sentido no nível da negociação.
- **O que já existe:** uma parte. Um fluxo com gatilho de palavra-chave e o
  bloco "Etapa do funil" já move o negócio quando a pessoa responde a palavra.
  Falta a regra que mora **na etapa** e olha campo e arquivo.
- **Faz sentido:** sim, mas não agora. Ninguém fecha negócio pelo funil hoje
  (0 ganhos na produção), então regra de avanço automático ainda não tem o que
  automatizar. Vale voltar quando os pagantes usarem o funil de verdade.
- **Tamanho:** médio a grande (regra por etapa, avaliação a cada evento, tela).

### 8. "Tarefa" ou "Atividade"; botão "personalizado"

- **O que é:** o Eduardo apontou que "tarefa" é mais comum (o RD usa) e marcou
  um espaço depois de "Proposta" nos tipos de atividade. O Gabriel lembrou por
  que escolheu "atividade": é o guarda-chuva (tarefa, ligação, reunião, visita,
  proposta), e cada tipo abre um formulário diferente. Ficou em dúvida sobre o
  que um "personalizado" abriria.
- **Recomendação:** manter "Atividade" como nome do conjunto e não criar
  "personalizado": o tipo "Tarefa" já é o genérico, só título e data. Um
  "personalizado" seria um segundo "Tarefa".
- **Não validada:** fica para o Gabriel decidir.

### 9. Reunião com link do Meet criado sozinho

- **O que é:** o Eduardo perguntou se já dá para agendar reunião gerando o link
  do Meet. O Gabriel: não, hoje cola o link à mão.
- **O que já existe:** a atividade do tipo Reunião tem "Link ou lugar" e hora.
- **Faz sentido:** sim para vender (quem faz reunião de venda espera isso), mas
  exige ligar a agenda do Google de cada conta, com a aprovação do Google para
  o acesso. É grande e não é o que os pagantes de hoje pedem.
- **Tamanho:** grande. Depois.

### 10. Cobrar por usuário

- **O que é:** o Eduardo pesquisou quatro CRMs: o usuário a mais custa perto do
  preço de um segundo plano. O Gabriel ficou em dúvida entre usuários à vontade
  ou por usuário.
- **O que já existe:** a decisão escrita em `src/core/planos.ts`: atendente é
  ilimitado nos três planos, porque o produto existe para o cliente precisar de
  menos gente atendendo, e cobrar por atendente é cobrar pela métrica que o
  produto promete reduzir.
- **Recomendação:** manter ilimitado. É argumento de venda contra esses mesmos
  CRMs ("aqui a equipe inteira entra sem pagar a mais").

### 11. Trocar de "produto" dentro do AutoFluxos

- **O que é:** o Gabriel, por áudio, a partir do print do seletor de produtos do
  RD: em vez de copiar o RD inteiro, cada frente vira um "produto" do próprio
  AutoFluxos (restaurante, catálogo, e-commerce...), e quem tem mais de um
  troca entre eles. O restaurante só vê as abas dele (cardápio, pedidos, cor).
  Ajuda o cliente a entender o que comprou. O Eduardo perguntou se o que for de
  agenda iria para a Verandi.
- **Não validada.** Ver "Para o agente das frentes".

### 12. Texto da tela Etiquetas

- **O que é:** o Eduardo mandou o print da tela Etiquetas e o Gabriel respondeu
  "esse aí eu não queria botar, não é padrão de sistema". Não ficou claro se é
  o parágrafo longo de explicação no topo ou outra coisa da tela.
- **Decidido pelo Gabriel depois:** na ficha do contato só se desanexa;
  apagar etiqueta de verdade é nas configurações. A tela saiu de CRM >
  Etiquetas e virou Configurações > Etiquetas (o endereço antigo redireciona).
  Commit `410f2bd`.

### 13 e 14. Tema e barra (resolvidos na conversa)

- O Eduardo perguntou se o cliente pode escolher tema claro ou escuro e achou
  sozinho: está no menu do usuário.
- O Eduardo não achava como abrir a barra recolhida; o Gabriel explicou que é
  passar o mouse na logo, como na Brevo. Já existe.

### Da véspera (25/set), citado hoje

- **Esqueci a senha por e-mail:** o Eduardo errou a senha de novo hoje. O
  fluxo já está desenhado e o Gabriel planejou para o fim de semana; falta
  escolher por onde sai o e-mail (Brevo ou o do Supabase, que é pago). Enquanto
  isso, o admin troca a senha em Usuários.
- **O nome:** o chefe do Gabriel achou que AutoFluxos lembra automóvel, e existe
  uma empresa de automóveis com esse nome. Anotado, sem decisão.

## Para o agente das frentes

Ideia que cai nas frentes e não foi implementada aqui:

- **Trocar de produto por frente (item 11).** O Gabriel quer que cada frente
  seja um "produto" do AutoFluxos com nome próprio, e que a conta com mais de
  uma troque entre elas num seletor no topo, como o RD faz entre os produtos
  dele (nunca entre produtos da 4YU: a Verandi é outro produto e não entra).
  Cada frente mostra só as abas dela. Não foi validado com o Eduardo, e o
  próprio Gabriel ainda procura o nome ("auto" alguma coisa). Conversa com a
  pesquisa da troca de frente que já está no `docs/HANDOFF-26-SET-NICHOS.md`.

## Plano de execução, por valor

1. **Feito hoje:** logo da administração (1), etiqueta que desanexa e
   Etiquetas em Configurações (2, 12), fila de IA com Cloudflare (3), plano
   anual (4), e da conversa de 25/set o aviso do chatbot antigo e o relatório
   de produtos (seção abaixo).
2. **Próximo, depende do Gabriel:** pôr a chave do Cloudflare e rodar a suíte
   de escopo (3). É o que evita o bot da PCYES parar por cota.
3. **Depois, quando o funil tiver uso real:** condições de etapa (7).
4. **Mais para frente:** Meet pela agenda do Google (9).
5. **Só decisão, sem código:** nome da atividade (8), cobrança por usuário
   (10), texto da tela Etiquetas (12).

## Da conversa de 25/set

Lida do mesmo jeito (cerca de 590 mensagens, 17 imagens, 18 áudios). Boa parte
foi suporte do MGM, fora daqui. Muita coisa do dia já tinha sido feita em 25 e
26/set: a IA não empurra para atendente o que não tem a ver com a loja, a
frase fixa depois da IA, pedido com vários itens, frete por CEP, parcelamento,
manuais e rastreio por CPF.

Feito agora:

- **Relatório "Produtos no atendimento"** (Gabriel, para a PCYES): produtos
  mais clicados em "Ver produto" e quantos cards o robô e cada atendente
  enviaram, no período e no escopo de quem vê. Na tela Relatórios, porque a de
  Vendas só aparece com negócio no funil. Usa o que já era gravado. Commit
  `2ab821d`.
- **Aviso do chatbot antigo** na tela de conectar o WhatsApp (Gabriel): quem
  vem de outra plataforma desconecta antes, ou a Meta recusa. Commit `80628d3`.

Não feito, com o porquê:

- **Pedido de suporte no meio da venda com IA** (Gabriel): o gatilho de
  palavra-chave já troca de fluxo; falta a IA reconhecer "quebrou" e sair por
  uma saída "suporte". É médio (saída nova no bloco de IA, motor, prompt e
  editor), e antes vale conferir se o gatilho da PCYES já resolve.
- **Carrinho pronto com link de pagar** (Gabriel): o carrinho de visitante do
  Magento não abre por link sem módulo na loja. Grande e depende da PCYES.
- **Arquivos da empresa como conhecimento da IA** (Eduardo, "cérebro"): médio
  a grande; hoje o conhecimento é texto, e só o cardápio vira arquivo.
- **Prospectar pelo número de teste** e **preço de 800**: decisão de negócio.
  Mensagem fria exige modelo de marketing aprovado e mexe na nota do número.

Para o agente das frentes: segmentar o sistema por ramo (farmácia, ensino,
serviços, distribuição, e-commerce; o Eduardo gostou da farmácia), prompt e
regras próprios por frente, e a PCYES como demonstração.
