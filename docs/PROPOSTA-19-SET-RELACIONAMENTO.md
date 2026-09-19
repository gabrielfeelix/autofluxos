# Proposta: a camada de relacionamento

> **SUBSTITUÍDA em 19/set/2026 por `PROPOSTA-19-SET-CHATBOT-FIRST.md`.**
>
> Esta proposta respondeu a pergunta errada. Ela tratou relacionamento como uma
> camada a acrescentar, e otimizou por enxugar escopo. O pedido do dono era
> outro: que a plataforma seja **extremamente eficiente** naquilo que os grandes
> CRMs fazem bem, e que o produto seja **chatbot-first**, com o propósito do robô
> moldando o formato do CRM.
>
> O que continua válido daqui: o diagnóstico do cano seco (seção 0), o
> dimensionamento de e-mail (1.5) e as decisões técnicas da seção 4. O que mudou:
> o enquadramento inteiro, e a ordem do trabalho.

> Escrita em 19/set/2026, respondendo ao pedido de pesquisa da seção 4 do
> `HANDOFF-18-SET-CRM-RELACIONAMENTO.md`. É uma proposta: escopo, telas, e o que
> fica de fora com o motivo. Nada aqui foi construído ainda.
>
> **A pergunta do dono que originou tudo:** *"CRM significa customer relationship
> management. A gente tem isso de fato?"*
>
> **A resposta, depois da pesquisa:** temos o motor, não temos a casa. E o que
> falta é menos do que parecia, porque três peças que pareciam faltar já existem
> no banco desde setembro.

---

## 0. O que mudou desde o handoff

Duas coisas, e as duas encurtam o trabalho.

**O cano seco tem explicação.** O dono confirmou em 19/set: as 6 contas são
**piloto, o uso real não começou**. Não é interface escondida nem falta de
consequência. Isso importa porque muda a ordem: não se deve gastar esforço
"consertando" o caminho de marcar ganho antes de existir uso que prove que ele
está quebrado. A seção Clientes nasce vazia por motivo esperado.

**Três peças já existem e ninguém precisa construir:**

| Peça | Onde | Consequência |
|---|---|---|
| Funil de pós-venda | `quadros.seguinte_id` (0058) | "ganhar aqui abre cartão lá" já funciona. O funil de clientes do Kommo é **configuração**, não código |
| Estágio do ciclo de vida | `contacts.estagio` (0058) | `novo → qualificado → negociando → cliente → perdido → inativo`, com transições testadas em `core/crm.ts` |
| Nível, recência, régua | `core/relacionamento.ts` + 0070 | o motor inteiro, com testes |

O que falta é **tornar visível** e **deixar agir em lote**.

---

## 1. O que a pesquisa respondeu

Pesquisa completa dos cinco pontos que o dono pediu. As fontes estão na seção 9.

### 1.1 O que é relacionamento num CRM, de verdade

Quatro verbos, e cada um tem um gatilho:

| Verbo | O que é | O que dispara |
|---|---|---|
| **Retenção** | impedir a saída silenciosa | recência estourou o ciclo normal daquele cliente |
| **Nutrição** | manter presença sem vender | tempo desde o último contato útil |
| **Reativação** | trazer de volta quem já saiu | recência alta, mas histórico bom |
| **Expansão** | aumentar o valor de quem ficou | comprou X e nunca comprou Y |

O modelo canônico do mercado brasileiro é o funil de pós-venda do RD Station:
**Adoção → Retenção → Expansão → Advocacy**. Vale como vocabulário, porque o dono
já ouviu falar.

**Uma ressalva que a pesquisa trouxe e que vale registrar:** a frase "reter custa
5x menos que adquirir", que aparece em todo material de fornecedor, é folclore. O
rastro morre num relatório de 2010 sem validação. Não vamos usar esse número em
lugar nenhum, nem no site.

O que de fato sustenta a camada para um estúdio de 180 alunos é mais chato e mais
verdadeiro: **a base é pequena o bastante para caber numa cabeça e grande o
bastante para não caber**. Em 40 clientes o dono lembra de todos. Em 180, não. E
a saída em serviço recorrente é silenciosa: ninguém cancela, a pessoa só para de
aparecer, e sem régua o dono descobre três meses depois.

### 1.2 O que o cliente faz no dia a dia

A rotina real, por frequência:

- **Diário:** responder conversa (90% do tempo), **anotar observação na ficha**,
  mover cartão quando algo mudou de verdade.
- **Semanal:** olhar quem sumiu, disparar reativação, registrar fechamento.
- **Mensal:** proposta, fechar/perder com motivo, olhar o quadro geral.

E o que eles **não** fazem, por mais que o software ofereça: não preenchem campo
que não usam no mesmo dia, não constroem segmento com editor de filtros, não leem
relatório com mais de um gráfico, e **não cadastram contato à mão**.

A observação livre bate campo estruturado em negócio pequeno, sempre. Já temos
`contacts.notas` e o evento `nota` na linha do tempo, e isso é mais importante do
que parecia.

**A implicação de produto, e é a frase que manda nesta proposta:** a camada de
relacionamento tem que produzir **uma lista de nomes com um motivo ao lado**, não
um painel. "Ana, 47 dias sem aparecer, costumava vir 2x por semana" é acionável.
"Segmento Em risco: 23 contatos" não é.

Isso valida o `oQueFazer()` que já existe em `core/relacionamento.ts`, e diz que
ele deve ser o centro da tela, não um detalhe da linha.

### 1.3 Segmentação: os eixos que existem

Além de RFM, os eixos usados na prática, ordenados pelo que serve ao nosso caso:

| Eixo | Serve aqui? | Por quê |
|---|---|---|
| **Engajamento** (recência de conversa) | **Altíssimo** | é o único eixo **grátis e sempre atualizado**: já temos a conversa, ninguém digita nada |
| **Ciclo de vida** | **Altíssimo** | já existe em `contacts.estagio` e nunca apareceu na tela |
| **Valor** | Médio | só existe se houver compra registrada |
| **Produto comprado** | Alto para expansão | hoje só temos `titulo` livre. Ver seção 5 |
| **Comportamental** | Alto | depende do cliente registrar compra |
| **Origem** | Baixo | contato que nasce do WhatsApp raramente tem origem confiável |
| **Demográfico** | Baixo | caro de coletar, pouco acionável neste porte |

**A distinção que vale copiar do HubSpot: dinâmico para estado, estático para
campanha.**

- **Estado do cliente é dinâmico.** "Sumidos", "Ativos", "Em risco" recalculam
  sozinhos, senão viram lixo em uma semana.
- **Público de campanha é estático.** Quem recebeu a transmissão do dia 12 tem
  que continuar sendo esse conjunto, senão o denominador muda e o resultado deixa
  de existir.

Isso corrige um erro conceitual comum: usar lista dinâmica para medir campanha.

### 1.4 RFM: a tensão, resolvida

O dono pediu "uma matriz RFM de verdade". A pesquisa diz, com números, que a
decisão anterior estava certa, e que a matriz clássica **não se aplica à nossa
base**.

**Como funciona o RFM de verdade:** ordena por recência e corta em 5 quintis;
dentro de cada quintil ordena por frequência e corta em 5; dentro de cada um
desses 25 ordena por valor e corta em 5. São **125 células**, colapsadas depois em
uns 10 segmentos nomeados (Campeões, Leais, Em risco, Não posso perder,
Hibernando, Perdidos...).

**Por que não cabe aqui:**

| Fonte | Diz |
|---|---|
| MCP Analytics | mínimo prático de **500 clientes com histórico de compra** e 2 a 3 compras por cliente |
| Darkroom | a escala 1 a 5 só fica estável com **200.000+ clientes**; arquivos menores devem cair para 1 a 3 |
| Darkroom | "dez é o teto prático de segmentos, porque cada um precisa de dono, fluxo e métrica" |

Faça a conta com uma base realista de 180 clientes: **125 células dividem 1,4
cliente por célula**. Mesmo colapsando em 10 segmentos, a fronteira entre "Em
risco" e "Hibernando" depende de em qual quintil caiu o 19º cliente naquela
semana. Na semana seguinte ele troca de segmento sem nada ter acontecido no mundo
real, porque quintil é posição relativa: um cliente que aparece empurra outro para
baixo. **O dono perde a confiança no sistema na primeira vez que vir isso.**

Com os nossos números de hoje (37 contatos, zero compras) a matriz inteira nasce
numa célula só.

**A proposta, então, diverge do pedido literal do dono, e o motivo está acima:**

- **Não construir a matriz R×F×M com quintis.** Nem agora, nem como "visão
  analítica". A seção 4.2 do handoff sugeria que as duas podiam conviver, com a
  matriz numa tela de análise. A pesquisa mostra que não é questão de onde
  colocar: com base pequena o número está errado em qualquer tela.
- **O que entrega o que ele quer de fato:** ele pediu matriz porque quer *ver a
  base inteira segmentada de uma vez*. Isso se entrega com os eixos que temos,
  que são estáveis e explicáveis: **estágio × recência**, com o nível em faixa de
  reais como terceira dimensão na linha.
- **A frequência não vira eixo**, e isso já estava decidido: com recompra baixa
  quase todo mundo cai em "1 compra" e o eixo não separa ninguém.
- **Quando revisitar:** se uma conta passar de **500 clientes com histórico real
  de compra**, o RFM canônico começa a informar. Antes disso é teatro estatístico.
  Fica escrito aqui para não se perder.

Uma melhoria que a pesquisa sugere e que vale adotar quando houver dado:
**recência normalizada pelo ciclo do próprio cliente**, não pela base. Quem vinha
3x por semana e sumiu há 10 dias é mais urgente que quem vem 1x por mês e sumiu há
25. Funciona com N=1 e não oscila. Fica para a fase 3 (seção 4), porque depende de
histórico de conversa que as contas piloto ainda não têm.

### 1.5 E-mail: o dimensionamento honesto

**Recomendação: não agora, e o motivo não é o preço.**

O custo de servidor é irrelevante: 200 clientes × 4 e-mails/mês = 800 envios, o
que cabe no plano grátis do Resend (3.000/mês) com folga, para várias contas
somadas. Pago seria US$ 20 por 50.000.

O custo real é engenharia e encargo permanente:

| Item | Esforço |
|---|---|
| Integração de envio + templates | 1 a 2 semanas |
| Webhook de bounce/complaint + supressão | ~1 semana, **não é opcional** |
| Descadastro com link assinado + registro LGPD | ~1 semana |
| Gestão do domínio de envio | decisão arquitetural, abaixo |
| Suporte de "não chegou o e-mail" | **permanente, e é o item subestimado** |

**A decisão arquitetural que define o custo:** enviar do nosso domínio ou do
domínio do cliente. Do nosso, configura-se SPF/DKIM/DMARC uma vez e funciona para
todos, mas o e-mail chega como vindo de nós e **um cliente que dispara lixo queima
a reputação de todos os outros**. Do domínio do cliente, cada conta precisa de
onboarding de DNS, e **dono de estúdio de pilates não edita registro TXT**: é um
funil de onboarding com desistência alta e um canal de suporte técnico que não
queremos.

Some a isso que desde 2024 Google, Yahoo e Microsoft exigem SPF, DKIM e DMARC, que
domínio novo precisa de warm-up de 3 a 5 semanas, e que a LGPD exige registro das
operações (art. 37) além de descadastro funcional mesmo sob legítimo interesse.

**E há o argumento decisivo:** o contato nasce no WhatsApp, e `contacts` **não tem
campo de e-mail**. Muitos contatos não terão e-mail nenhum. Estaríamos gastando 4
a 6 semanas para atingir um canal secundário num público que lê WhatsApp em
minutos.

**O que a comparação de canal mostra, e isso sim é acionável hoje:**

| Categoria de mensagem no WhatsApp | Custo no Brasil |
|---|---|
| Service (dentro da janela de 24h) | **zero** |
| Utility | R$ 0,04 a R$ 0,05 |
| Marketing | R$ 0,31 a R$ 0,38 |

Uma régua de retomada classificada como **Utility custa 1/8** de uma classificada
como Marketing. Isso é decisão de produto com efeito direto na margem, e é muito
mais barato de endereçar que e-mail. Entra na fase 3.

**Nota que liga com uma pendência existente:** e-mail de relacionamento é decisão
diferente do **SMTP transacional**, que já está travando três coisas há semanas
(convite, recuperação de senha, aviso de handoff: ver `PENDENCIAS-DO-DONO.md` §4)
e que é **compartilhado com a Verandi**. Se for para mexer em e-mail, o transacional
vem primeiro: é mais barato, desbloqueia o que já está pronto, e não tem risco de
reputação de marketing.

### 1.6 Como fazem os grandes, e onde está nossa brecha

| Produto | O que acerta | O que não serve |
|---|---|---|
| **RD Station** | funil de pós-venda como objeto de primeira classe, com etapas nomeadas em português | pensado para quem tem alguém dedicado a operar; contato entra por formulário |
| **HubSpot** | dinâmico vs estático exposto ao usuário; **saída automática da lista quando houve interação** | a automação que queremos é justamente a que ele cobra caro (sem Workflows no Free nem no Starter) |
| **Pipedrive** | segmentar por **engajamento de comunicação**, não só por compra | Campaigns é addon pago; produto centrado em negócio, não em cliente. Pós-venda é gambiarra |
| **Kommo** | o mais próximo da nossa premissa: inbox multicanal, bot, alerta de lead parado | **fortemente de aquisição**. Não há noção nativa de "este cliente está esfriando": ele dá as ferramentas e manda o dono montar |

Os quatro convergem em três coisas: separar o funil de relacionamento do de
vendas, usar segmento dinâmico como motor da automação, e usar recência de
interação como gatilho principal.

**E os quatro têm a mesma fraqueza estrutural, que é a nossa oportunidade: todos
dependem de alguém alimentar o sistema.** Campo preenchido, negócio movido, status
de inscrição marcado, contato importado. Num negócio de 180 clientes com o dono
dando aula, isso não acontece: o software fica vazio e a culpa cai no software.

**Num produto onde o registro nasce da conversa, o eixo de segmentação mais
confiável é grátis e sempre atualizado: recência e reciprocidade de conversa.**
Sabemos quem falou, quando, quem respondeu e quem só recebeu, sem ninguém digitar.
Nenhum dos quatro tem esse dado limpo.

O que eles têm melhor que nós é **compra registrada**. É o único campo pelo qual
vale insistir, e vale insistir em exatamente um.

---

## 2. A proposta em uma frase

**Uma seção Clientes que mostra uma lista de nomes com o motivo ao lado, montada
sobre estágio × recência, com a régua de retomada morando ao lado dela.**

Não é um módulo novo: é dar casa e visibilidade a um motor que já existe.

---

## 3. O que construir, em três fases

Cada fase entrega valor sozinha e termina com commit, build e push.

### Fase 1: tornar visível o que já existe (barato, alto retorno)

Nada de banco. É a fase que resolve metade da queixa.

**1.1 Filtro por estágio na lista de Contatos.**
O estágio existe desde a 0058 e nunca apareceu. Uma fileira de filtros
(Todos · Novos · Qualificados · Negociando · **Clientes** · Perdidos · Inativos),
no mesmo padrão de querystring do filtro de nível.

**Atenção técnica, e é o achado que muda o custo:** o filtro de nível de hoje
(`leads/page.tsx:210`) roda `leads.filter(...)` **sobre a página já carregada**,
depois da paginação. Para nível isso é tolerável porque é um refinamento visual.
Para estágio **não é**: "meus clientes" tem que trazer todos os clientes, não os
clientes da página 1. Então o filtro de estágio vai no `select` do Postgres, que é
barato porque `contacts.estagio` é coluna indexada.

**1.2 A régua de retomada sai de baixo da terra.**
Hoje `cliente_sumido` aparece em **exatamente um lugar** na interface inteira:
dentro do formulário de sequências, em Automações. Quem procura relacionamento
nunca vai lá. Ela passa a aparecer na seção Clientes, com atalho para montar e o
número de quem está inscrito.

**1.3 Retenção no painel.**
"X clientes · Y em risco · Z voltaram este mês". Hoje o painel só conta aquisição.
O bloco "Clientes sumindo" já existe e fica onde está.

### Fase 2: a seção Clientes (o corpo da proposta)

Uma seção no menu, irmã de "Funil de vendas". **Migration `0071`** (confirmada
como a próxima: `ls supabase/migrations/ | tail -1` deu `0070`).

**2.1 A tela.**

Agrupada por saúde do relacionamento, que é a pergunta semanal real ("quem eu não
vejo há tempo demais"):

```
Sumindo (3)      <- primeiro, é o que gera trabalho
  Ana Paula   Ouro · 47 dias sem falar
              "Cliente ouro sem falar com você há 47 dias. Vale uma ligação antes de virar perda."

Esfriando (8)
Ativos (24)
Inativos (11)    <- recolhido por padrão
```

O `oQueFazer()` é o centro da linha, não um detalhe: é o que a pesquisa diz que
separa ferramenta de relatório.

**2.2 O que precisa de banco, e por quê.**

A seção ordena por valor gasto e agrupa por recência **sobre a base inteira**.
Hoje isso é impossível: `server/repos/relacionamento.ts` soma os cartões ganhos em
TypeScript a partir de um lote de ids, e o nível nunca existe no Postgres. Ordenar
assim mostraria o topo da página, não o topo da base.

Então a `0071` cria a **view** que faz o `group by` sobre os cartões ganhos por
contato (total, número de compras, última compra). É exatamente a pendência
"segmento salvo" que o `RELACIONAMENTO.md` deixou aberta, e a razão que ele deu
para adiar ("vale quando alguém quiser agir sobre o segmento em lote") é
precisamente o que esta seção faz.

O nível continua sendo calculado com as faixas em reais da conta: a view entrega
os números, `core/relacionamento.ts` continua sendo o único lugar que decide o que
é ouro.

**2.3 Agir em lote.**
Selecionar da lista e mandar transmissão, que já existe. É o que transforma a
lista em ferramenta: hoje o dono veria quem sumiu e teria que abrir um por um.

**2.4 A ficha ganha a jornada.**
Quando virou cliente, quantas compras, tempo entre elas, última conversa. A linha
do tempo já existe; falta o resumo em cima.

### Fase 3: as decisões que dependem de uso real

Só faz sentido depois que as contas piloto virarem uso.

- **Recência normalizada pelo ciclo do cliente** (seção 1.4): depende de histórico.
- **Classificar a régua como Utility e não Marketing**: economia de 8x por
  mensagem, e vale medir antes.
- **Medir a franquia de 1.000 mensagens de serviço da Meta**, que passa a valer em
  **1º/out/2026**. É a mesma conta que `consumo_de_conversas` (0066) já faz.
  Ver `RELACIONAMENTO.md` e §8.4 do handoff. **Esta tem data, as outras não.**

---

## 4. O que fica de fora, e o motivo

| O que | Por que não |
|---|---|
| **Matriz RFM com quintis** | 125 células sobre base pequena dão 1,4 cliente por célula; a classificação muda sozinha toda semana e o dono para de confiar na tela. Revisitar a partir de 500 clientes com compra |
| **E-mail** | 4 a 6 semanas mais encargo permanente de bounce, DNS, descadastro e suporte, para um canal secundário. E `contacts` não tem campo de e-mail. O **SMTP transacional** vem antes, e é outra conversa |
| **Catálogo de produtos** | decisão do dono, mas ver a seção 5: há um jeito mais barato de responder "o que eu vendi" |
| **Score único (555)** | esconde exatamente o caso que importa: 5 em valor e 1 em recência vira "médio" e some na lista. Já decidido na 0070, e a pesquisa confirma |
| **Frequência como eixo** | com recompra baixa quase todo mundo cai em "1 compra" |
| **Editor de segmento com filtros booleanos** | a pesquisa é explícita: esse público não constrói segmento. Os agrupamentos vêm prontos |
| **Ligar/desligar a seção** | quem só faz aquisição nunca tem ninguém em `estagio = 'cliente'` e a seção fica quieta sozinha. O dado já decide |

---

## 5. As pendências do dono, respondidas

### 5.1 Vender sem saber o que vendeu (§8.1)

O dono quer cadastrar produto, serviço e assinatura. O `MODELO-CRM.md` recusou
catálogo por escrito, e a recusa vale como padrão, não como teto.

**A proposta: um passo intermediário antes do catálogo.**

Hoje **nenhum dos 29 cartões tem nem o valor livre preenchido**. Construir
catálogo agora seria cobrar um cadastro de quem ainda não preenche um número. O
caminho barato é fazer o `titulo` do cartão **sugerir os títulos já usados naquela
conta**: na terceira venda de "Plano trimestral" o campo oferece "Plano
trimestral", e o dono passa a ter agrupamento por produto sem ter cadastrado nada.
Catálogo que nasce do uso, não de um formulário.

Isso responde "o que eu vendi e quanto" com uma fração do custo, e **preserva a
fronteira do dado**: continua sendo estado de execução nosso, não cadastro de
negócio do cliente. Se depois o uso mostrar que falta estrutura de verdade
(assinatura com recorrência, por exemplo), aí o catálogo entra sabendo qual é o
problema.

### 5.2 Nicho no onboarding (§8.2)

Segue em aberto, e a proposta não o inclui. A pesquisa não trouxe nada que mude a
recomendação anterior: se entrar, entra coletado no onboarding da conta, não como
campo da ficha de cada contato. **Não tratar como decidido.**

### 5.3 Vários telefones por contato (§8.3)

Fora do escopo. Esbarra na premissa `waid = pessoa` que sustenta o WhatsApp
inteiro, e é caso raro.

### 5.4 Descoberta: o que existe e ninguém acha (§8.5)

O handoff pedia para reservar espaço para isso, e a proposta reserva: **a fase 1
inteira é trabalho de descoberta**, não de funcionalidade nova. Filtro de estágio
e régua visível são features que já existem no banco e não existem na tela.

Confirmei que motivo de perda obrigatório e responsável realmente funcionam
(`components/quadros/fechar-cartao.tsx`). O problema é mesmo de descoberta.

---

## 6. A decisão que a proposta pede ao dono

Uma só, e é a da seção 1.4: **não construir a matriz RFM que você pediu**, e
entregar no lugar estágio × recência com nível em reais.

O motivo em uma frase: a matriz precisa de 500 clientes com compra para começar a
informar, e com base pequena ela classifica a mesma pessoa de um jeito por semana
sem nada ter acontecido. O que você quer ver (a base inteira segmentada de uma vez)
a seção Clientes entrega; o que não vale entregar é o número instável por trás.

Se você preferir a matriz mesmo assim, ela é construível: fica registrado que o
custo é a confiança na tela, e que o sintoma aparece só quando a base crescer.

---

## 7. Ordem de execução, se aprovada

1. **Fase 1** inteira: filtro de estágio, régua visível, retenção no painel.
   Sem banco, commit por etapa.
2. **Fase 2**: migration `0071` (ensaio em transação com `rollback` primeiro, como
   nas 0069 e 0070), repo, tela, ação em lote, ficha.
3. **Fase 3**: só depois de uso real, exceto a franquia da Meta, que tem data.

Restrições respeitadas em todas: nada aplicado em produção sem autorização
explícita; `app_verandi` intocado e conferido em 389 colunas; sem `stash` nem
`reset`; sem travessão; commits em português com o porquê no corpo.

---

## 8. Onde a proposta toca o código

```
components/design/secoes-do-cliente.tsx   o menu: entra "Clientes"
app/clientes/[clienteId]/leads/page.tsx   filtro de estágio (no Postgres, não em memória)
app/clientes/[clienteId]/clientes/        a seção nova
server/repos/relacionamento.ts            leitura sobre a view da 0071
core/relacionamento.ts                    intocado: continua mandando no que é ouro
supabase/migrations/0071_*.sql            a view de compras por contato
```

---

## 9. Fontes

**RFM e base pequena:** [Darkroom](https://www.darkroomagency.com/observatory/rfm-analysis) ·
[MCP Analytics](https://mcpanalytics.ai/articles/analytics__customer__segmentation__rfm_scoring) ·
[Hughes / dbmarketing](http://www.dbmarketing.com/articles/Art182.htm) ·
[Putler](https://www.putler.com/rfm-analysis/) · [Omniconvert](https://www.omniconvert.com/blog/rfm-score/)

**Segmentação:** [HubSpot: ativo vs estático](https://knowledge.hubspot.com/segments/create-active-or-static-lists) ·
[Saras Analytics](https://www.sarasanalytics.com/blog/customer-segmentation-models) ·
[Braze](https://www.braze.com/resources/articles/guide-to-behavioral-segmentation)

**LTV:** [Buy Till You Die](https://en.wikipedia.org/wiki/Buy_Till_you_Die) ·
[Ipsos, Loyalty Myth 8](https://www.ipsos.com/sites/default/files/publication/2003-08/Ipsos_Loyalty_Myth_8_Excerpt.pdf)
(sobre o mito do 5x)

**E-mail:** [Red Sift, autenticação 2026](https://redsift.com/guides/how-email-authentication-requirements-are-changing-business-communications-in-2026) ·
[MailReach, warm-up](https://www.mailreach.co/blog/how-to-warm-up-email-domain) ·
[LGPD e e-mail marketing](https://www.ecommercebrasil.com.br/artigos/rumo-a-lgpd-e-alem-bases-legais-para-o-e-mail-marketing)

**Concorrentes:** [RD Station, pós-venda](https://www.rdstation.com/blog/vendas/pos-vendas/) ·
[Pipedrive, segmentação](https://www.pipedrive.com/en/products/email-marketing-software/segmentation) ·
[Kommo WhatsApp](https://www.kommo.com/whatsapp/) ·
[Limitações do HubSpot Free](https://www.mo.agency/blog/what-are-the-limitations-of-hubspots-free-crm)

**WhatsApp:** [Preços Brasil](https://whautomate.com/whatsapp-business-api-pricing-brazil) ·
[Política de mensagens](https://business.whatsapp.com/policy)
