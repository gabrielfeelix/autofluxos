# Proposta: o CRM que nasce do propósito do robô

> Escrita em 19/set/2026. **Substitui a `PROPOSTA-19-SET-RELACIONAMENTO.md`**,
> que respondeu a pergunta errada: ela otimizou por enxugar escopo, e o pedido
> era outro.
>
> **As palavras do dono:** *"o RD é extremamente competente no que se propõe a
> fazer, e eu quero que a nossa plataforma seja extremamente eficiente. O
> objetivo é chatbot, só que para que é o chatbot? Para uma automação. E para
> onde vai cair? Para um CRM. Para funis. Aí a gente vai moldando o CRM com base
> no que ele quer o chatbot. O produto vai ser um chatbot-first, e não um CRM com
> chatbot."*
>
> **E o medo dele, que a pesquisa provou ser o medo certo:** *"meu medo é só o
> onboarding ser limitador demais."*
>
> Pesquisa feita em quatro frentes, com doc oficial e API dos concorrentes. Onde
> não foi possível verificar, está escrito que não foi.

---

## 1. A descoberta que reposiciona o produto

Eu entrei na pesquisa achando que o trabalho era **alcançar** RD, HubSpot e
Pipedrive na competência de CRM. A evidência diz outra coisa.

**Ninguém pergunta para que você quer o sistema, e ninguém entrega o funil
pronto por isso.**

| Produto | O que a conta nova recebe | Fonte |
|---|---|---|
| **Pipedrive** | 1 funil, 5 etapas fixas, sempre igual | doc de suporte |
| **HubSpot** | 1 funil de 7 etapas, "criar do zero" ou "clonar existente" | doc de suporte |
| **RD Station** | API de criar funil aceita **só nome e ordem**; todo funil nasce com as mesmas etapas padrão | referência de API |
| **Agendor** | 1 funil padrão; personalizar só nos planos pagos | Central de Ajuda |
| **Ploomes** | 1 funil; nicho resolvido por **consultor de implantação** | Central de Conhecimento |

E não é omissão: **a Pipedrive recusou o pedido por escrito** no fórum de
desenvolvedores, dizendo que funis "deveriam ser bem diferentes entre si" e que o
certo é filtrar dentro de um funil. É uma aposta declarada, e é contra a tese do
dono.

O que os dois maiores construíram de biblioteca ficou em **automação**, nunca em
funil: 13 automações prontas no RD, 13 Salesbots no Kommo, 36 na Pipedrive.
**Em nenhuma das 62 o ramo do cliente aparece.** São todas de mecânica
operacional: follow-up sem resposta, alerta de SLA, janela de 24h da Meta
fechando, encerrar conversa parada.

Dois produtos maduros que não conversam entre si chegaram no mesmo número e no
mesmo eixo. Isso é sinal forte: **a biblioteca que se sustenta é por problema,
não por vertical.**

### 1.1 As três exceções, e o que cada uma ensina

**Kommo: pergunta o propósito, não o ramo.** O onboarding bifurca em cinco
caminhos, e nenhum é um setor: atender mensagens · migrar base · captar do site ·
lidar com anúncios · organizar time de vendas. Cada um define qual canal conectar
primeiro e qual é a métrica de sucesso inicial.

É quase literalmente a pergunta do dono. E a doc deles explica o porquê: *"um
plano simples ajuda a evitar etapas desnecessárias, campos duplicados e
automações que não combinam com seu processo real"*. **Eles tratam excesso de
configuração inicial como dívida, não como valor entregue.** É o antídoto para a
gaiola: perguntar pouco.

**Zoho Bigin: escolhe o modelo no cadastro, e muda o vocabulário.** 29 modelos,
11 por ramo e 18 por caso de uso, escolhidos no signup, com o slogan "esqueça
setups longos". E o que muda é fundo: no modelo de Educação os módulos se chamam
**Alunos, Cursos, Pais**. Renomear o tipo de registro é campo de formulário de
primeira classe.

**monday: o alerta contra a versão fraca.** Comparei três modelos de indústria
deles (construção, finanças, mídia). Os quatro quadros centrais são idênticos, as
**5 automações são as mesmas nos três, palavra por palavra**, e os **12 widgets
de dashboard também**. Muda um quadro de vocabulário colado por cima.

A lição: **multiplicar modelo é barato, multiplicar comportamento não é.** Nem o
monday paga esse custo. Prometer só o que dá para manter.

### 1.2 O vão que ninguém atravessou

O RD **tem** um gerador de funil por segmento, que entrega "etapas pensadas para o
segmento da sua empresa". Ele fica **fora do produto**, atrás de formulário de
e-mail corporativo, e entrega um **documento** para a pessoa digitar tudo à mão no
CRM depois.

Eles sabem que funil por segmento vende. Usam para captar lead, não para
configurar a conta do cliente.

**Esse vão entre "eu sei qual funil você precisa" e "eu montei ele para você" é a
posição do AutoFluxos.** Não é paridade a perseguir: é território que os líderes
deixaram vago, alguns de propósito e com a aposta contrária documentada.

---

## 2. A descoberta que encurta o trabalho: metade já está construída

O produto já tem os dois catálogos que a tese precisa, e eles **nunca se
encontram**.

**Cinco modelos de funil** (`src/core/quadros-modelos.ts`), cada um com etapas,
prazo por etapa e tipo ganho/perdido:

| Modelo | Etapas |
|---|---|
| Atendimento | Novo · Em conversa · Resolvido |
| Comercial | Novo · Contato feito · Proposta enviada · Negociação · Ganho · Perdido |
| Captação (SDR) | Novo · Tentando contato · Qualificando · Qualificado · Descartado |
| Agenda e avaliação | Novo · Avaliação · Agendado · Compareceu · Não apareceu |
| Pós-venda e recompra | Entregue · Acompanhamento · Oferta enviada · Recomprou · Sem retorno |

**Doze fluxos de robô prontos** (`src/exemplos/modelos.ts`), incluindo
`qualificar-sdr`, `agendamento`, `menu-atendimento`, `pesquisa-nps`,
`carrinho-abandonado`, `cobranca-amigavel`.

Repare no par: existe o robô `qualificar-sdr` **e** o funil `captacao`. É
exatamente o exemplo que o dono deu. Os dois existem e nada os liga.

**O que falta:** `criarCliente()` insere só o nome
(`server/repos/clientes.ts:144`). O `/primeiro-acesso` pede nome da empresa,
telefone e contexto, e manda a pessoa ligar o WhatsApp. **O propósito nunca é
perguntado, e `MODELOS_DE_QUADRO` só aparece quando alguém cria um quadro à mão.**

Uma validação que vale registrar: os nossos modelos já estão **acima** do padrão
de mercado num critério objetivo. Boa prática diz que etapa deve ser fato
verificável, não estado mental do vendedor. O padrão do HubSpot tem "Decision
maker bought-in" e o do Salesforce tem "Perception Analysis": os dois são opinião.
"Compareceu", "Recomprou", "Qualificado" são fatos. **Isso não é ponto a
melhorar, é vantagem a preservar.**

---

## 3. A gaiola é de banco, não de tela

Aqui a pesquisa deu razão ao medo do dono por um motivo técnico que não era
óbvio.

**No Pipedrive, apagar uma etapa apaga os negócios que estão nela.** Frase
literal da doc: *"Deleting a stage will also delete the deals in that stage."* E
sobre mover negócio entre funis: *"Moving deals across pipelines can affect
reporting accuracy."*

No líder de usabilidade da categoria, **mudar de ideia sobre o funil destrói
dado**. O HubSpot é menos destrutivo (bloqueia apagar etapa com registro dentro),
mas a doc não diz o que acontece com o histórico ao renomear, e o silêncio é
suspeito. A Pipedrive é explícita em outro artigo: o relatório de duração **não
conta tempo em etapas apagadas**. O histórico da etapa que sumiu, sumiu.

O monday confessa o mesmo limite por outro caminho: nos modelos que continuam
sincronizando, **estrutura propaga e comportamento não**. Coluna, visão e
permissão propagam; automação só vale para contas novas. Não é falta de esforço:
mexer em automação já instalada é operação destrutiva na conta de outra pessoa.

**Conclusão: reversibilidade é propriedade do modelo de dados, não da tela de
onboarding.** É barata agora e caríssima depois que houver dado dentro. Por isso
ela entra na fase 1 desta proposta, antes de qualquer tela nova.

---

## 4. A proposta

### 4.1 Uma pergunta no primeiro acesso

Depois do nome da empresa, em `/primeiro-acesso`:

> **Para que você quer o robô?**
> Atender e tirar dúvidas · Agendar horário · Qualificar e passar para vendedor ·
> Vender e acompanhar · Pós-venda e recompra
>
> *Dá para mudar depois, e dá para ter mais de um.*

**Uma pergunta obrigatória, e no máximo três.** A régua da literatura de
onboarding é dura e clara: *"se a resposta não muda a experiência do usuário,
corte a pergunta"*, com 3 a 5 no máximo e 3 como alvo. A NN/g acrescenta um
limite estrutural: progressive disclosure admite **no máximo dois níveis**, e um
wizard de seis telas já viola o padrão antes de começar.

As outras duas candidatas, ambas defensáveis:

- **"Quem vai atender: só você ou um time?"** Binária, não "quantas pessoas".
  Com "só você", atribuição, rodízio e responsável **somem da tela inteira**;
  com "um time", aparecem. É a forma de perguntar sobre equipe sem cobrar
  vocabulário nem envelhecer: o segundo usuário entrando é o gatilho natural
  para revisitar.
- **"Como você chama o que vende?"** Uma palavra: consulta, orçamento, plano,
  pedido. É a lição do Bigin (vocabulário do domínio vale mais que quadro
  extra), é barata de errar, e o conserto é um rename, que é seguro por
  construção.

**A primeira pergunta é a que paga sozinha o próprio custo**, porque muda três
coisas de uma vez, todas visíveis no minuto seguinte:

1. o **quadro** nasce com as etapas certas (`etapasDoModelo`, que já existe);
2. o **fluxo de robô** sugerido vem do catálogo casado (`qualificar-sdr` para
   quem escolheu SDR, `agendamento` para quem escolheu agendar);
3. o **painel** destaca a métrica daquele propósito.

Hoje nada disso acontece, apesar de os dois catálogos existirem.

### 4.2 O que NÃO perguntar, e por quê

O dono levantou tamanho de time e papéis (SDR, consultor). A recomendação é
**não perguntar**, e os três motivos são fortes:

- **O dado já é observável.** Quantas pessoas a conta tem é `af_membros`. Conta
  de uma pessoa não precisa declarar que é de uma pessoa. Perguntar o que o
  sistema já sabe é antipadrão nomeado na literatura.
- **A estrutura muda mais rápido que a resposta.** O estúdio contrata a segunda
  recepcionista em março e a resposta de janeiro passa a mentir.
- **A consequência certa é reativa.** Quando o segundo usuário entrar, aí sim:
  *"agora vocês são dois, quer distribuir as conversas automaticamente?"*. É a
  pergunta feita no momento em que ela importa, e não custa nada a quem está
  sozinho.

E há um motivo a mais para não perguntar sobre SDR e closer: **`core/rodizio.ts`
já resolve o eixo de time melhor do que a pergunta sugeriria.** Ele faz
distribuição **balanceada por carga** (não rodízio por ordem fixa), com presença,
teto de conversas simultâneas, e a regra de que gestor fica fora por padrão
porque "em conta pequena o dono também vende". Quem tem SDR e closer de verdade
encadeia dois quadros com `seguinte_id`, que já existe. Quem não tem nunca lê a
palavra SDR.

**Nicho também não entra** (pendência §8.2 do handoff): ele não muda nada que o
propósito já não mude. O estúdio de pilates e a clínica escolhem "agendar" e
querem a mesma coisa. O precedente de mercado é fraco: só a Moskit pergunta nicho
no cadastro, e nem deixa acessar depois.

### 4.3 Como não virar gaiola, concretamente

Quatro coisas, três de desenho e uma de banco:

1. **"Dá para mudar depois" escrito ao lado da escolha**, e um "pular" que cai no
   modelo Atendimento, que é o neutro de propósito.
2. **O menu inteiro visível desde o primeiro dia.** Escolher um propósito não
   esconde seção nenhuma.
3. **Criar segundo quadro sempre à mão, com o catálogo completo.** Quem escolheu
   "agendar" e depois quer pós-venda **não muda de modelo**: cria o segundo e
   encadeia. Não existe migração porque não existe escolha excludente. É o
   desenho do Bigin, onde o modelo se aplica a um funil e não à conta.
4. **A blindagem no banco** (migration `0071`), que é o item que o mercado erra.
   Cinco regras, todas tiradas de dano documentado em concorrente:

   1. **Etapa com cartão dentro se arquiva, não se apaga** (`ativa = false`):
      some do quadro e continua resolvendo nome no relatório antigo. É o soft
      delete que a própria API da Pipedrive usa ("marks a stage as deleted"),
      apesar de a tela apagar negócio junto.
   2. **Bloquear o arquivamento enquanto houver referência, e mostrar quais.**
      É a melhor ideia do levantamento inteiro: o HubSpot tem uma coluna
      **"Used in"** que lista o que trava a exclusão antes de a pessoa decidir.
      O oposto de apagar e rezar.
   3. **Nunca mover cartão para um destino escolhido pelo sistema.** Este é o
      antipadrão mais caro que a pesquisa achou, e é do Kommo: se o usuário
      apaga uma etapa sem esvaziar antes, os leads são *"automatically
      transferred to the Initial contact stage"*. Um negócio que estava em
      "Negociação" volta para "Primeiro contato". Não é perder posição: é uma
      **mentira sobre o estado do negócio, gravada em massa e em silêncio**,
      como efeito colateral de uma faxina de configuração. Todo relatório
      depois disso mostra uma regressão que nunca aconteceu. Se precisa mover,
      quem escolhe o destino é o usuário.
   4. **Estados terminais são estrutura:** ganho e perdido se renomeiam, não se
      removem. O Kommo trava assim e o HubSpot depende disso para processar
      receita.
   5. **Renomear é seguro por construção**, porque o cartão guarda `etapa_id` e
      o evento guarda o nome. **Isto já está certo no repo:** `moverCartao`
      grava `{ de, para }` com os nomes das etapas, não os ids
      (`server/repos/quadros.ts:743`). O histórico já sobrevive à renomeação, e
      essa metade da blindagem não precisa ser construída.

   E o corolário que sustenta a promessa: **grave a transição, não só o
   estado.** Com uma linha por movimento, tempo em etapa e conversão por etapa
   são recalculáveis depois de qualquer remodelagem, e "dá para mudar depois"
   deixa de ser microcopy e vira propriedade do banco.

### 4.4 A métrica que vira o painel

**Tempo até a primeira resposta**, com "sem resposta em 24h" ao lado.

É a métrica com a melhor evidência do mercado (MIT/InsideSales, 15 mil leads:
responder em 5 minutos contra 30 muda as chances de contato em ~100x), e é
**gerada pelo sistema sem ninguém preencher nada**. Duas correções de honestidade
que valem carregar: os multiplicadores são do MIT/InsideSales e não da Harvard,
apesar de milhares de artigos dizerem o contrário; e o dado é de 2007 a 2011, era
do formulário e do telefone.

O achado mais acionável não é otimizar de 10 para 5 minutos. É que, na auditoria
da HBR com 2.241 empresas, **23% nunca responderam**.

E é aqui que a entrada por conversa ganha de qualquer CRM tradicional: **se o
sistema registra mensagem, a última mensagem é carimbo de tempo verdadeiro e
gratuito**. Prefira sempre métrica ancorada em mensagem à ancorada em etapa,
porque em PME o cartão é arrastado para "ganho" no dia do pagamento e passa três
semanas em "proposta" depois de morto: tempo médio por etapa mede disciplina de
arrastar cartão, não processo comercial.

### 4.5 A camada de relacionamento, reposicionada

O que a proposta anterior chamava de "seção Clientes" continua valendo, mas agora
como **um dos propósitos**, não como o assunto principal: quem escolhe "pós-venda
e recompra" recebe aquele funil, aquele robô e aquele painel.

O motor já existe (nível, recência, régua de retomada, migration 0070). O que
falta é o mesmo fio: ligá-lo ao propósito escolhido, e tirar a régua de retomada
de dentro de Automações, onde ela aparece em **exatamente um lugar** hoje.

---

## 5. As decisões técnicas que a pesquisa fechou

| Decisão | Veredito | Por quê |
|---|---|---|
| **Matriz RFM com quintis** | **Não construir** | A Omniconvert publica a régua: escala 1 a 5 só a partir de **200 mil clientes**; 1 a 3 abaixo de 30 mil. A Klaviyo **exige 500 clientes com pedido** para ligar preditivo. Base de 200 contatos está três ordens de grandeza abaixo do piso. Não é adaptar o método, é usá-lo fora de qualquer faixa recomendada |
| **Faixa em reais (0070)** | **Confirmada** | É a variante certa para o porte, e defensável numa frase |
| **Recência pela conversa** | **Confirmada**, com evolução | Trocar o corte fixo de 90 dias pelo **ciclo mediano do próprio negócio** quando houver histórico: quem vem a cada 15 dias e sumiu há 40 está em risco; quem vem a cada 6 meses, não. Usar mediana, não média |
| **Forecast ponderado** | **Não construir** | O Salesforce **abandonou a ponderação** e usa categoria discreta. Com 20 negócios a 50%, fecha um número inteiro, plausivelmente 6 ou 14. Somar os abertos por etapa e chamar de "em aberto", não de "previsão" |
| **Campo obrigatório por etapa** | **Só vale no banco** | É teatro de UI nos três: Pipedrive não bloqueia via API/import, HubSpot é contornável por admin e workflow, Salesforce admite que não dá. Como aqui quem escreve é o próprio motor, o check do Postgres é garantia de verdade |
| **Funis encadeados** | **Vantagem confirmada** | Ninguém tem nativo, e a Pipedrive **documenta o erro oposto**: mover negócio entre funis quebra o relatório. Criar cartão novo no funil seguinte (`seguinte_id`) preserva o histórico dos dois |
| **Lead scoring de 100 pontos** | **Não construir** | O preditivo do HubSpot exige volume grande de convertidos e não convertidos. Se o modelo deles precisa disso, peso inventado à mão sobre 40 clientes não fica confiável por ser manual |
| **WIP limit** | **Não construir** | Ninguém faz, e a ausência é consistente entre produtos |
| **Probabilidade por etapa** | **Não construir** | Pipedrive nasce em 100% até alguém mexer; no HubSpot, editar à mão **desliga a atualização automática para sempre**, sem aviso |

---

## 6. Ordem de execução

**Fase 1: a costura e a blindagem.** É quase só fiação, e é o que entrega a tese.
- a pergunta em `/primeiro-acesso`, ligando `MODELOS_DE_QUADRO` a
  `src/exemplos/modelos.ts`;
- migration `0071`: arquivar etapa em vez de apagar, e nome da etapa no evento;
- a régua de retomada saindo de dentro de Automações.

**Fase 2: o painel por propósito.** Tempo até a primeira resposta, sem resposta em
24h, e o bloco que muda conforme o propósito escolhido.

**Fase 3: a seção Clientes**, para quem escolheu pós-venda, com a view de compras
por contato (a leitura de hoje soma em TypeScript sobre a página carregada, então
ordenar por valor mostraria o topo da página e não o topo da base).

Restrições de sempre: nada em produção sem autorização; `app_verandi` intocado e
conferido em 389 colunas; sem `stash` nem `reset`; sem travessão; commits em
português com o porquê no corpo.

---

## 7. O que ficou sem verificar

Honestidade sobre os limites desta pesquisa:

- **Os questionários de cadastro** de Pipedrive, HubSpot e monday não têm doc
  oficial. Só análise de terceiros. O que **está** documentado é que, perguntando
  ou não, isso não muda o funil que a conta recebe.
- **Os nomes exatos dos modelos de funil do Kommo** não são publicados em lugar
  nenhum, o que já é um dado sobre o tamanho da coisa.
- **9 dos 13 modelos de automação do RD** só constam na central de ajuda, que
  bloqueia leitura automatizada.
- **Soluções verticais do Zoho CRM**: as páginas do marketplace não renderizaram.
- **Nada foi conferido contra a produção**: os conectores de banco estão sem
  autorização nesta sessão.

---

## 8. Onde a proposta toca o código

```
app/primeiro-acesso/page.tsx          a pergunta
server/acoes-conta.ts                 criar a conta já com quadro e fluxo
core/quadros-modelos.ts               os 5 modelos: já existem, ganham propósito
exemplos/modelos.ts                   os 12 fluxos: casar com o modelo de funil
server/repos/quadros.ts               criarQuadro já aceita modeloId
supabase/migrations/0071_*.sql        arquivar etapa, nome da etapa no evento
core/rodizio.ts                       intocado: já resolve o eixo de time
```

---

## 9. Fontes

**Que ninguém tem biblioteca de funil:**
[Pipedrive recusando por escrito](https://devcommunity.pipedrive.com/t/create-template-of-a-pipeline/1795) ·
[Pipedrive, criar pipeline](https://support.pipedrive.com/en/article/how-can-i-customize-my-pipeline-stages) ·
[HubSpot, pipelines](https://knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines) ·
[RD, API de criar funil](https://developers.rdstation.com/reference/crm-v2-create-pipeline)

**Quem faz diferente:**
[Kommo, os 5 caminhos do onboarding](https://support.kommo.com/docs/choose-your-setup-path) ·
[Kommo, por que plano simples](https://support.kommo.com/docs/kommo-setup) ·
[Bigin, modelo no signup](https://www.bigin.com/small-business-express/bigin-templates.html) ·
[monday, managed templates](https://support.monday.com/hc/en-us/articles/18229256953234-Managed-templates-on-monday-com)

**A gaiola de dado:**
[Pipedrive: apagar etapa apaga negócio](https://support.pipedrive.com/en/article/how-can-i-customize-my-pipeline-stages) ·
[Pipedrive: mover entre funis quebra relatório](https://support.pipedrive.com/en/article/how-can-i-move-a-deal-to-another-pipeline)

**RFM e base pequena:**
[Omniconvert, escala por tamanho de base](https://www.omniconvert.com/blog/rfm-analysis/) ·
[Klaviyo, mínimo de 500 clientes](https://help.klaviyo.com/hc/en-us/articles/360020919731)

**Onboarding:**
[Appcues, corte a pergunta que não muda nada](https://www.appcues.com/blog/user-onboarding-surveys) ·
[NN/g, progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/)

**Tempo de resposta:**
[MIT/InsideSales](https://www.onecavo.com/wp-content/uploads/2015/11/MIT-InsideSales.com_Lead-Response-Management.pdf) ·
[HBR, 2.241 empresas](https://hbr.org/2011/03/the-short-life-of-online-sales-leads)

**Campo obrigatório é teatro de UI:**
[Pipedrive](https://support.pipedrive.com/en/article/required-fields) ·
[HubSpot](https://knowledge.hubspot.com/object-settings/set-up-pipeline-rules)
