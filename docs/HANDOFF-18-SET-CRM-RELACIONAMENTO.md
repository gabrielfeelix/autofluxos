# Handoff: de aquisição para relacionamento


> Escrito em 18/set/2026, no fim de uma sessão que ficou cara demais para
> continuar. Quem ler isto assume o trabalho do zero de contexto: está tudo aqui.
>
> **A pergunta do dono, literal:** *"CRM significa customer relationship
> management. Isso significa que é um sistema de relacionamento com o cliente. A
> gente tem isso de fato? Eu sei que a gente está usando o AutoFluxos como
> aquisição. Mas e o relacionamento?"*
>
> A resposta curta é **não temos**, e a parte difícil não é a que parece. Leia a
> seção 2 antes de qualquer coisa.

---

## 1. O que está pronto e no ar (não refaça)

Tudo abaixo foi entregue em 18/set/2026, está em `main`, testado e em produção
(`autofluxos.4yu.com.br`). **2003 testes passando.**

### 1.1 Correções e ajustes pedidos por um amigo do dono (revisão de UX)

| Commit | O quê |
|---|---|
| `d6dfa48` | **Bug real:** `moverCartao` não gravava o evento `mudou-de-etapa`. A tabela existia desde a 0058, a frase existia, e ninguém emitia. A aba de histórico prometia por escrito e respondia "Nada registrado ainda". Corrigido com dois testes (grava com os dois nomes; voltar para a mesma etapa **não** vira evento). |
| `452a447` | "Funis" → "Funil de vendas" (menu + 2 títulos + 3 textos). Rota `/quadros` mantida. |
| `54cf68a` | "Tudo do Essencial"/"Tudo da Operação" subiram para a 1ª linha do card e ganharam negrito. |
| `29910cd` | Ficha do contato: botão de copiar telefone e link `wa.me`. Antes só tinha `tel:`, que no desktop não faz nada. |
| `c618d60` | Cor por etapa no funil (migration `0069`, paleta fechada de 8 nomes, não hex). |
| `44bfbd2` | Capitalização: 15 rótulos de ação + `ex:` → `ex.:`. |

### 1.2 Relacionamento, o que foi construído (migration `0070`)

| Commit | O quê |
|---|---|
| `83abcc5` | `core/relacionamento.ts`: níveis (ouro/prata/bronze/sem_compra), recência, `oQueFazer()`. Migration `0070`. |
| `cfa750d` | `server/repos/relacionamento.ts`: leitura em lote sem N+1, `clientesSumidos()`. |
| `8b3ff4a` | `server/passada-de-retomada.ts`: régua de retomada no cron diário. |
| `9d2bfbc` | Coluna "Cliente" na lista de contatos + filtro por nível. |
| `d51dffc` | Nível na ficha + tela de ajuste das faixas (Configurações → Dados do negócio). |
| `a9acf52` | Formulário para montar a régua de retomada. |
| `a477a24` | Bloco "Clientes sumindo" no painel. |
| `addc5a2` | `docs/RELACIONAMENTO.md`. **Leia este doc**, ele tem o porquê de cada decisão. |

**As três decisões que já estão tomadas e não devem ser revertidas sem conversa:**

1. **Nível é faixa em reais escolhida pelo dono, não quintil.** O RFM clássico
   corta a base em cinco partes iguais, e isso quebra em base pequena: num
   estúdio com trinta alunas o quintil de cima pode ser quem gastou R$ 300 no
   ano. O dono olha "Ouro", discorda, e para de confiar na tela. Quintil também
   move o chão sozinho (entra um cliente grande, todo mundo cai de faixa).
   **Atenção:** o dono pediu agora "uma matriz RFM de verdade". A seção 4.2 mostra
   como atender isso sem reintroduzir o defeito.
2. **Recência é medida pela conversa, não pela compra.** Quem comprou há um mês e
   sumiu depois está indo embora; medir pela compra esconde isso até a renovação.
3. **Quem nunca comprou é `sem_compra`, não bronze.** Misturar o cliente pequeno
   e o desconhecido são duas conversas diferentes.

---

## 2. O diagnóstico, para ler antes de escrever qualquer código

### 2.1 O produto é de aquisição, e a interface prova isso

- **O menu inteiro é aquisição:** Painel · Inbox · Contatos · Funil de vendas ·
  Automações · Transmissões · Configurações.
- **Os três filtros da tela de Contatos** são `abriu com mídia`,
  `foi para pessoa`, `não respondeu`. Os três são sobre o *primeiro* contato.
- **O estágio do ciclo de vida existe no banco desde a 0058**
  (`novo → qualificado → negociando → cliente → perdido → inativo`) e **não
  aparece em nenhuma tela como filtro ou visão**. Não dá para pedir "meus
  clientes".
- **A régua de retomada que construí está enterrada** em Automações → aba
  Sequências. Quem procura relacionamento não olha em "Automações".

### 2.2 O cano está seco, e isto é mais importante que qualquer tela

Consulta feita na **produção** em 18/set/2026:

```
contatos por estágio:     novo = 37        (nenhum em qualquer outro estágio)
cartões por situação:     aberta = 29      (nenhum ganho, nenhum perdido)
cartões com valor:        0 de 29
sequências cadastradas:   nenhuma
contas:                   6
```

**O que isso significa:** o funil está sendo usado como lista de nomes, não como
funil. Ninguém fecha cartão, ninguém anota valor. E como o estágio só sai de
`novo` quando um cartão é **ganho**, ninguém nunca vira `cliente`.

**Consequência direta para quem for construir a seção Clientes:** ela vai nascer
vazia. Toda a régua, todo o nível, todo o "clientes sumindo" depende de
`quadro_cartoes.situacao = 'ganha'` com `valor` preenchido, e isso não está
acontecendo em nenhuma das 6 contas.

**Portanto, a primeira pergunta não é "que tela falta", é "por que ninguém marca
a venda?".** Três hipóteses, e vale descobrir qual é antes de escrever código:

1. As contas ainda são piloto e o uso real não começou (mais provável);
2. Marcar "ganhou" está difícil ou escondido demais na interface;
3. O time não vê valor em marcar, porque nada acontece depois de marcar.

Se for (2) ou (3), **a seção Clientes mais bonita do mundo continua vazia**. A
hipótese (3) tem uma implicação de produto interessante: dar consequência ao
"ganhou", que é exatamente o que a seção Clientes faz, pode ser justamente o que
faz o time passar a marcar. Isso é argumento para construir, não contra; só não se deve construir
achando que o dado vai aparecer sozinho.

**Ação sugerida:** confirmar com o dono/cliente antes de começar. É uma pergunta,
não uma semana de trabalho.

---

## 3. A proposta: a seção **Clientes**

Uma seção no menu principal, irmã de "Funil de vendas", lendo o estágio que já
existe no banco.

| | Funil de vendas (existe) | **Clientes** (proposto) |
|---|---|---|
| Responde | "quem estou tentando fechar" | "quem já é meu, e como está" |
| Unidade | cartão / negociação | **pessoa** |
| Visões | etapas do funil | Ativos · Esfriando · Sumidos · Inativos |
| Ação | mover, ganhar, perder | falar, retomar, subir de nível |
| Fim | a venda | **não tem fim**, é contínuo |

### 3.1 O que vai dentro (detalhado)

**a) Lista de clientes, agrupada por saúde do relacionamento.**
Não é outra tabela de contatos: é a mesma gente, filtrada por
`estagio = 'cliente'`, agrupada pela recência que já existe em
`core/relacionamento.ts`. Cada linha mostra nível, total gasto, nº de compras,
dias desde a última conversa e a frase de `oQueFazer()`.

**b) Filtro por estágio na lista de Contatos.**
O estágio existe e nunca apareceu. Uma fileira de filtros (Todos · Novos ·
Qualificados · Negociando · Clientes · Inativos), usando o mesmo padrão de
querystring que o filtro de nível já usa (`src/app/clientes/[clienteId]/leads/page.tsx`).
É barato e resolve metade da queixa sozinho.

**c) A régua de relacionamento visível aqui dentro.**
Hoje ela existe (`cliente_sumido`, migration 0070) e está escondida em
Automações. Deve aparecer em Clientes, com um atalho "montar régua de retomada"
e o número de quem está inscrito.

**d) Retenção no painel.**
"X clientes · Y em risco · Z voltaram este mês". Hoje o painel só conta
aquisição (conversas novas, fechamentos do mês).

**e) Ficha do cliente com o histórico de relacionamento.**
A ficha já tem linha do tempo (`eventos_do_contato`) e o selo de nível. Falta
mostrar a jornada inteira: quando virou cliente, quantas compras, quanto tempo
entre elas, quando foi a última conversa.

### 3.2 Como isso atende "diferentes empresas, diferentes demandas"

O dono foi explícito: *"algumas vão querer só para aquisição, outras vão querer
para relacionamento"*. A seção Clientes resolve isso sem configuração: quem só
faz aquisição nunca tem ninguém em `estagio = 'cliente'`, e a seção fica quieta
(ou mostra o convite de primeira vez). Quem faz relacionamento passa a ter uma
casa para isso. **Não criar opção de ligar/desligar**, porque o dado já decide.

---

## 4. A pesquisa que o dono pediu (faça antes de propor o escopo final)

O dono pediu explicitamente, e nesta ordem de raciocínio:

1. **O que é um CRM, de verdade?** Qual a proposta, quais as vantagens, o que ele
   faz a nível de tratativa de relacionamento com cliente.
2. **O que o cliente faz dentro de um CRM?** Funil de nutrição, retenção,
   relacionamento, observações, propostas, fechamentos, compras. Qual é a relação
   entre o CRM e o cliente no dia a dia.
3. **Segmentação de verdade:** vários tipos de segmento, não só um. Incluindo
   **matriz RFM de verdade** (ver 4.2 abaixo: há uma tensão a resolver).
4. **Automação de e-mail.** O dono sabe que ainda não temos e-mail e que vai
   precisar de um terceiro (Resend, SendGrid, Postmark…). Quer saber como
   funciona e o que exigiria. **Não implementar agora**, apenas propor.
5. **Como fazem os grandes:** RD Station, HubSpot, Pipedrive, Kommo. Ler artigos,
   blogs e a documentação deles. A ideia do produto é ser **um chatbot que também
   é um CRM**, e atingir esse espectro.

**As palavras do dono, para não se perder na tradução:** ele falou em *"tratar o
cliente na segmentação, nas etapas, convidar ele novamente, conversar, entrar em
contato, entrar com um e-mail, impactar ele, colocar observações, considerações,
temperaturas"*. Ou seja, o CRM que ele quer não é só uma lista segmentada: é o
ciclo inteiro de **agir sobre** a pessoa e **registrar** o que se sabe dela.

O que disso já existe no produto, e a pesquisa deve considerar como base:

| O que ele citou | Estado hoje |
|---|---|
| Temperatura (frio/morno/quente) | **Existe**, migration 0068, `contacts.temperatura`, visível na ficha |
| Observações e notas | **Existe**, `contacts.notas` + evento `nota` na linha do tempo |
| Etiquetas | **Existe**, por contato, com filtro na lista |
| Etapas | **Existe** no funil, e o estágio do ciclo de vida existe no dado sem tela |
| Convidar de novo / retomar | **Existe** como régua `cliente_sumido` (0070), escondida em Automações |
| Campos personalizados | **Existe**, mas nascem do fluxo, não de um cadastro de campos |
| E-mail | **Não existe** (ver 4.3) |
| Propostas / produtos vendidos | **Não existe**: só `titulo` livre e `valor` no cartão. Ver a seção 8.1 |

**O objetivo da pesquisa é uma proposta**, não um relatório. O dono quer deixar o
sistema "mais interessante", ou seja, mais completo como CRM de relacionamento,
sem virar um RD Station pior.

### 4.1 O contrapeso que não pode ser esquecido

`docs/MODELO-CRM.md` (15/set/2026) decidiu **não copiar o RD**, e a razão
continua válida: o RD exige cadastro duplo (Lead + Negociação) e um formulário de
sete campos antes de qualquer conversa existir. **Nosso usuário não cadastra
nada: a pessoa chega conversando.** Qualquer proposta que reintroduza "cadastre
antes de usar" está errada, por mais que o RD faça assim.

A pesquisa deve buscar **o que os grandes acertam no relacionamento**, e trazer
isso para um produto onde o registro nasce sozinho do WhatsApp.

### 4.2 A tensão sobre RFM: resolva isto explicitamente

O dono pediu "uma matriz RFM de verdade". A sessão anterior implementou
deliberadamente **faixas em reais em vez de quintis**, e o motivo está em
`docs/RELACIONAMENTO.md` (base pequena → quintil mente).

**As duas coisas podem conviver, e essa é provavelmente a resposta certa:**

- **Faixa absoluta** continua sendo o *nível* do cliente (ouro/prata/bronze),
  que é o que o dono defende numa frase e o que aparece na lista.
- **Matriz RFM completa** entra como *visão analítica*: a grade R×F×M com os
  segmentos clássicos (Campeões, Leais, Em risco, Hibernando, Perdidos…), numa
  tela própria de análise, onde a comparação relativa faz sentido porque a
  pessoa está olhando a base inteira de uma vez.

Ou seja: faixa para **agir** no dia a dia, matriz para **enxergar** a base. A
pesquisa deve confirmar ou refutar esse desenho, e propor os segmentos nomeados.

**Cuidado ao propor RFM com quintis:** com 37 contatos e zero compras (ver 2.2),
a matriz nasce toda num quadrante só. A proposta precisa dizer **a partir de que
volume** a matriz passa a informar, e o que mostrar antes disso.

### 4.3 Sobre e-mail: o estado real

- **Não existe nenhum envio de e-mail no projeto.** Nada de Resend, SendGrid,
  nodemailer, SMTP.
- **`contacts` não tem campo de e-mail.** O `email` da migration 0009 é da
  **empresa cliente** (`clients`), não do contato. Confirmado.
- Implementar e-mail é escolher provedor, configurar domínio, SPF/DKIM, tratar
  bounce e descadastro. É um produto, não um campo.
- A proposta deve dimensionar isso honestamente e deixar a decisão para o dono.

---

## 5. Restrições que você precisa respeitar

### 5.1 Banco de produção compartilhado

**Leia `docs/BANCO-COMPARTILHADO.md` por inteiro antes de tocar no banco.**

- AutoFluxos vive em `public`; **Verandi vive em `app_verandi`**: mesmo projeto
  Supabase de produção.
- Nunca criar/alterar objeto da Verandi a partir deste repo.
- Nunca `supabase db push` nem `db reset` contra produção.
- **A próxima migration é a `0071`**: mas confira com
  `ls supabase/migrations/ | tail -1`, porque o diretório é a única fonte de
  verdade (já houve doc dizendo 0030 quando a última era 0042).
- **Nada é aplicado em produção sem autorização explícita do dono.**
- O procedimento que funcionou nas 0069 e 0070: ensaio em transação com
  `rollback` primeiro (provando os checks), aplicar depois, conferir objeto a
  objeto, e confirmar que `app_verandi` continua com **389 colunas**.
- Os testes rodam **contra o banco de produção real** (`.env`). Por isso todo
  teste cria a própria conta com prefixo `zz-` e apaga no `afterAll`.

### 5.2 Convenções do repositório

- **Sem travessão** em tela, comentário, commit ou doc. Use dois pontos.
- **Nada de `git stash` nem `reset`**: há sessões paralelas no mesmo repo, e o
  stash leva o trabalho da outra junto. (Eu errei nisso uma vez nesta sessão.)
- `git fetch` antes de começar: o `main` local fica para trás.
- Preço mora só em `src/core/planos.ts`.
- Comentários explicam **por que**, não o quê. Olhe qualquer arquivo em
  `src/core/` para calibrar o tom.
- Commits em português, com o porquê no corpo.

### 5.3 Fatos técnicos que vão te poupar tempo

- **Um cartão por pessoa em cada quadro** (`quadro_cartoes_unico_idx`). A segunda
  compra do mesmo cliente **não** é outro cartão no mesmo funil: é um cartão no
  funil seguinte (funis encadeados, 0058).
- **`contacts` não tem `ultima_entrada_em`**: essa é da view `leads`. Na tabela
  é `ultima_mensagem_em`.
- **`flows` guarda o desenho em `rascunho`**, não em `dados`.
- **`numeric` chega como string** do supabase-js. Somar sem `Number()`
  concatena: `"200" + "350.50"`.
- A Vercel no plano Hobby dispara **cron uma vez por dia**. Quem dá resolução de
  minuto é a carona no webhook e no pulso do Inbox (`enviar-agendadas.ts`). A
  régua de retomada roda **só no cron**, de propósito: a unidade dela é o dia.
- Deploy é automático pelo push no `main`. Conferir com
  `npx vercel ls --token "$VERCEL_TOKEN" --scope 4-yu`.
  O MCP da Vercel **não** tem acesso ao time `4-yu`; use a CLI com o token de
  `/home/gabfelix/dev/4yu-apps/.secrets/4yu.env`.
- **3 erros de lint preexistentes** em `inbox/page.tsx`, `clientes/page.tsx` e
  `inbox/fila.tsx`. Não são seus; não tente consertar de passagem.

### 5.4 Data no calendário: pendência aberta

**A partir de 1º/out/2026** a Meta passa a cobrar mensagens de serviço depois de
**1.000 unidades grátis por número por mês**. Régua de retomada consome essa
franquia sem ninguém olhar. **Medir isso está aberto** e é a mesma conta que
`consumo_de_conversas` (0066) já faz para a franquia do plano.

Também vale lembrar: quem está calado há 60 dias está **por definição** fora da
janela de 24h, então todo primeiro passo de régua de retomada **exige modelo
aprovado** pela Meta.

---

## 6. Ordem sugerida de trabalho

1. **Perguntar** ao dono sobre a seção 2.2 (por que ninguém marca a venda). É uma
   pergunta, e muda o que construir primeiro.
2. **Pesquisar** o que a seção 4 pede e voltar com uma **proposta escrita** :
   escopo, telas, e o que fica de fora com o motivo.
3. **Executar** depois de a proposta ser aceita. Commit por etapa, build, push.

O dono trabalha assim: plano de várias fases, tocar até o fim, commit + push por
etapa, sem pedir permissão no meio. Mas **esta** proposta ele quer ver antes.

---

## 7. Onde está cada coisa

```
docs/RELACIONAMENTO.md        as decisões de nível/recência/régua: LEIA
docs/MODELO-CRM.md            por que não copiamos o RD: LEIA
docs/BANCO-COMPARTILHADO.md   as regras do banco dividido com a Verandi: LEIA
docs/ESTADO.md                o estado geral do produto

core/relacionamento.ts        níveis, recências, oQueFazer(): puro e testado
core/crm.ts                   estágios, resumoDoCliente(), lerValor()
core/sequencias.ts            eventos da régua, limites de passo
core/quadros.ts               etapas, cartões, filtros do funil

server/repos/relacionamento.ts   leitura em lote e clientesSumidos()
server/repos/crm.ts              aplicarFato(): o único caminho do estágio
server/passada-de-retomada.ts    o cron da régua

components/lead-crm/selo-do-cliente.tsx   o par nível+recência
components/cliente/faixas-de-nivel.tsx    o ajuste do dono
app/clientes/[clienteId]/leads/page.tsx   a lista, e o padrão de filtro por URL
```

Migrations relevantes: `0032` (quadros) · `0058` (CRM: estágio, negociação,
linha do tempo) · `0031`/`0034` (sequências) · `0068` (temperatura) ·
`0069` (cor da etapa) · `0070` (relacionamento).

---

## 8. Pendências que o dono já levantou (não são novas, e não se perdem)

Estas vieram de conversas anteriores e continuam abertas. A proposta da seção 4
deve dizer se e quando cada uma entra.

### 8.1 Vender sem saber o que vendeu (prioridade alta, decisão já tomada)

Palavras do dono: *"não faz sentido um CRM que eu não consigo saber o que eu
vendi, qual o valor do que eu vendi"*. Ele quer poder **cadastrar produto,
serviço e assinatura**, e saber qual assinatura foi vendida.

Hoje o cartão tem só `titulo` (texto livre) e `valor`. O `docs/MODELO-CRM.md`
recusou catálogo por escrito, para não cobrar do cliente o imposto de cadastrar
antes de vender. **Essa recusa vale como padrão, não como teto**, e o dono já
decidiu que quer o cadastro. Caminhos levantados, nenhum escolhido: catálogo
próprio ou vínculo com o sistema do cliente.

Cuidado: isso tensiona com a fronteira do dado (estado de execução é nosso, dado
de negócio fica no sistema do cliente). Resolver a tensão faz parte da proposta.

**Observação que liga com a seção 2.2:** hoje **nenhum dos 29 cartões tem valor
preenchido**. Se o cliente não anota nem o valor livre, um catálogo pode não ser
o que destrava. Vale investigar junto.

### 8.2 Nicho (em aberto, é conversa)

O dono disse que nicho *"não existe no sistema, mas deveria. No onboarding"*, e
em seguida relativizou sobre campo fixo. **Não está decidido.** A direção é:
se entrar, entra coletado no onboarding da conta, não como campo da ficha de cada
contato.

### 8.3 Vários telefones por contato (custo alto, caso raro)

Pedido junto com o nicho. Esbarra na premissa `waid = pessoa`, que sustenta o
WhatsApp inteiro. Avaliar com cuidado antes de prometer.

### 8.4 Medir a franquia de mensagens de serviço da Meta

Ver 5.4. É a mesma conta que `consumo_de_conversas` (0066) já faz para a franquia
do plano, e vira urgente em 1º/out/2026.

### 8.5 Descoberta: o que existe e ninguém acha

Diagnóstico de uma revisão anterior que continua valendo. Um avaliador atento
(amigo do dono, que conhece CRM) pediu cinco coisas que **já existiam**: motivo
de perda obrigatório, filtro de perdidas, modal ao criar etapa, "Tudo do
Essencial" nos planos, e registro do responsável. Se ele não achou, o cliente não
acha.

Isso provavelmente custa mais caro que metade das funcionalidades novas, e a
proposta da seção 4 deveria reservar espaço para resolver descoberta, não só
para construir tela nova.
