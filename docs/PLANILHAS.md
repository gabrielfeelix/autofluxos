# Planilha como fonte de dado — as três saídas

Muito cliente gere o negócio em planilha, e vai continuar gerindo. Este
documento fecha **como o AutoFluxos lê planilha**, e o que oferecer para cada
tipo de cliente.

---

## O problema, dito uma vez

**Planilha feita para humano não tem esquema.** Uma célula com um nome na coluna
E, linha 11, só significa "aluna matriculada na segunda das 7h" porque uma
pessoa sabe ler o desenho da folha. Não existe regra geral que descubra isso: no
estúdio seguinte o mesmo dado estará em outro lugar, com outro nome, em outro
formato.

Isso **não é limitação nossa**. O nó de Sheets do n8n, do Zapier e do Make lê a
planilha como tabela — linha 1 são cabeçalhos, cada linha seguinte é um
registro. A lista de turma do MGM Pilates jogada neles devolve 190 linhas com
colunas repetidas 14 vezes. Nenhuma ferramenta adivinha layout humano.

Então a pergunta certa não é "como ler qualquer planilha", é **"onde mora a
tradução"**. As três saídas abaixo são três lugares diferentes para ela.

---

## Acesso: como a planilha chega até nós

Vale para as saídas 1 e 2, e é independente de estrutura.

**Hoje — conta de serviço.** O cliente compartilha a planilha com um e-mail
nosso, como compartilharia com um funcionário, e cola o link no painel. Sem tela
de consentimento, sem verificação, sem teto de usuários. É o mesmo gesto que o
[CLAUDE.md](../../CLAUDE.md) da 4YU já descreve para GTM, GA4 e Firebase: *"o
poder vem das concessões feitas na UI de cada produto, com o e-mail dela"*.

**Depois — OAuth verificado.** O cliente clica "conectar Google" e autoriza, que
é a experiência que Zapier e n8n dão. Exige verificação do app pelo Google:
página de política de privacidade, site explicando o produto, vídeo mostrando o
fluxo de consentimento e justificativa de cada escopo. Sem verificar, o escopo
do Sheets é *sensível* e o app fica com aviso de "não verificado" e **teto de
100 usuários, permanente no projeto**.

A verificação **não muda nada de estrutura** — ela resolve acesso. Trocar de
uma para a outra não mexe em fluxo nenhum.

---

## Saída 1 — a planilha é do cliente, e ele não vai abandoná-la

É o caso do MGM Pilates: layout próprio, professores marcando presença na folha
impressa, anos de hábito. Mexer nisso é pedir para perder o cliente.

**A tradução mora na planilha dele, como fórmula.** A gente acrescenta uma aba
de saída que lê as abas dele e apresenta o resultado num formato fixo. Fórmula,
não código: nada para manter, e atualiza sozinha quando ele edita.

### O contrato de leitura

Este é o padrão. Vale para qualquer cliente da saída 1, e é o que a saída 2 já
entrega pronto.

**Uma aba chamada `AutoFluxos`.** Nome reservado — é onde a gente lê, e o
cliente não mexe.

**Intervalos nomeados, um por dia da semana**, sem acento e em minúsculas:
`segunda`, `terca`, `quarta`, `quinta`, `sexta`, `sabado`, `domingo`.

Cada intervalo aponta para **uma célula só**, contendo os horários livres
daquele dia separados por ponto e vírgula:

```
7h00;10h00;15h00
```

Vazio significa "não há vaga nesse dia" — e o fluxo já trata isso pela saída
`vazio` da pergunta dinâmica.

**Por que intervalo nomeado e não endereço de célula:** a API do Sheets aceita
nome de intervalo no lugar do endereço, então o bloco de API pode montar a URL
com `{{dia}}` e uma chamada só resolve qualquer dia. Com endereço fixo seriam
sete chamadas ou uma corrente de condições.

### Como o fluxo usa

1. Uma **Pergunta** com as opções dos dias (rótulo bonito: "Segunda", "Terça").
2. Cada opção sai para um **Guardar** que grava `dia` com o nome sem acento
   (`terca`). É para isso que a ramificação por opção existe.
3. Um bloco de **API** em `GET` para:
   `https://sheets.googleapis.com/v4/spreadsheets/{ID}/values/{{dia}}`
4. `mapear`: `values.0.0` → `horarios`.
5. Uma **Pergunta** com `opcoesDe = horarios`. Os horários viram botões.

Nada disso é peça nova: é o nó de API e a pergunta dinâmica que já existem.

### Como montar a aba de saída

O caminho é sempre o mesmo, e é isso que quem for produzir precisa saber:

1. **Ache o que marca uma vaga ocupada.** No MGM é nome preenchido na coluna do
   nome, dentro de um bloco que começa numa linha onde a coluna A diz `Vagas`.
2. **Conte vagas e ocupadas por horário.** `CONT.VALORES` no intervalo do bloco.
3. **Marque o horário como livre** quando ocupadas < vagas — e como indisponível
   quando a célula do nome contém a marca de horário fechado.
4. **Junte os livres numa célula** com
   `=TEXTOJUNTAR(";";1;FILTRO(horarios; livres))`.
5. **Nomeie o intervalo** dessa célula com o dia.

**Antes de montar, combine as convenções com o cliente.** Na planilha do MGM,
"horário fechado" é texto livre digitado na célula do nome, e num dos casos está
com erro de digitação (`horario fechhhorario fechadoado`). Fórmula não adivinha:
tem que virar uma palavra fixa, sempre igual. Combinar isso é metade do
trabalho, e é conversa com o cliente, não planilha.

### O que já se sabe da planilha do MGM

Levantado do arquivo real, e serve de referência para o esforço:

- Uma aba por dia da semana; sábado existe e está vazia.
- 14 horários por dia, das 7h às 20h.
- Cada horário é um bloco com professor, 2 a 4 vagas numeradas, e as datas do
  mês como colunas de presença.
- 70 turmas, 232 vagas, 132 ocupadas (**57%**), mais 47 encaixes fora da
  numeração (reposição, personal, reserva).
- Matrícula fixa semanal: a aluna é "da segunda das 7h". Ninguém agenda aula
  solta — quem agenda é aluna nova, ou é **reposição**.

---

## As convenções do MGM, ditas pelo estúdio

Levantado com o Edu em 19/08/2026. **É metade do trabalho da saída 1**: sem
combinar isso, fórmula nenhuma acerta, porque o que está escrito na planilha é
texto livre digitado por quem estava na recepção.

### As siglas da presença

| Sigla | Quer dizer |
|---|---|
| `P` | presente |
| `F` | falta |
| `FAR` | falta avisada com direito a reposição |
| `LIC` | licença |
| `REP` | reposição — na frente vem a data da aula que está repondo |
| `EXP` | aula experimental |
| `XX` ou `X` | não teria aula nesse dia |

`P ANT 19h/18h` é presença **antecipada**: a pessoa é da turma das 19h e fez a
aula das 18h naquele dia. A anotação fica no horário dela, com o horário em que
apareceu ao lado.

### As regras que decidem se a vaga está livre

1. **Aviso de falta:** até 2h antes da aula dá direito a reagendar reposição.
   Menos que isso, não dá.
2. **Personal, domicílio e fáscia são agenda paralela** — vão nas linhas de
   baixo do bloco e **não ocupam vaga da turma**. É por isso que contar "nomes
   no bloco" erra: só as linhas numeradas valem.
3. **`RESERVA` é vaga guardada** para alguém interessado em se matricular
   naquele horário. Para efeito de "tem vaga?", **ocupa**.
4. **Plano vencido continua ocupando.** O estúdio mantém a pessoa na turma até
   ela renovar; quem não renova é excluído da folha.
5. **Quem marca presença é a recepção**, e na ausência dela alguma professora.
   Ou seja: a planilha é preenchida à mão, por mais de uma pessoa — daí os
   `horario fechhhorario fechadoado` da vida.

### O que ainda não fecha, e precisa de decisão do estúdio

- **Uma palavra fixa para "horário fechado".** Hoje é texto livre na célula do
  nome, com erro de digitação em pelo menos um caso. Fórmula não adivinha:
  tem que ser sempre a mesma palavra, sempre no mesmo lugar.
- **Telefone falta em ~30% das alunas** — o estúdio identifica por outras
  planilhas. Para o bot, contato sem telefone é contato que ele não alcança.

### O que a planilha precisa ganhar

- **Uma célula de data**, e ela não é enfeite: é o que deixa o bot saber de
  quando é o que ele está lendo. Sem isso, planilha desatualizada responde com a
  mesma confiança que planilha de hoje — e o erro só aparece com a aluna já no
  estúdio.
- **Fundo branco fora do layout.** O quadriculado padrão do Sheets faz a folha
  parecer rascunho; ela é entregue ao cliente e é impressa pelas professoras.

## Saída 2 — o modelo da 4YU

Para cliente novo, ou para quem topar trocar. **Zero configuração:** ele copia o
modelo, compartilha, cola o link, funciona. É o caminho que escala, e é o que a
gente divulga.

O modelo já nasce com a aba `AutoFluxos` e os intervalos nomeados prontos,
puxando das abas de trabalho. O cliente nunca ouve falar de fórmula.

### O que o modelo precisa resolver

**É mensal, não semanal.** A planilha do MGM tem segunda a sábado e acabou —
não existe "mês", então todo mês vira arquivo novo e o histórico se perde em
arquivos soltos. O modelo tem **uma aba por mês**, com todos os dias, agrupados
por semana. Meses seguintes já vêm criados, então dá para agendar com
antecedência.

**Capacidade varia por horário.** Um horário tem 3 vagas, o outro tem 5. O
modelo não pode ter número fixo.

**Professor varia, e às vezes é mais de um.** Tem horário com um professor, tem
com dois, tem estúdio com um professor só. Precisa dar para acrescentar linhas
de professor sem quebrar as fórmulas — o que empurra para a aba de trabalho ser
**uma linha por vaga**, não um bloco desenhado.

**Identidade do cliente.** Espaço para a logo e o nome do estúdio no topo, para
a planilha parecer dele. É barato e muda a percepção do que ele comprou.

**Continua imprimível.** O professor marca presença no papel. Se o modelo não
imprimir bonito, ele não é adotado — por melhor que seja.

---

## Saída 3 — sistema de gestão nosso

O cliente para de usar planilha. A gente entrega a gestão de horários como
produto, ele paga mensalidade, e a automação lê direto do nosso banco — sem
tradução nenhuma no meio.

É a saída mais cara de construir e a mais valiosa: vira receita recorrente por
cliente, e resolve de vez o problema de estrutura.

**Não contradiz a fronteira do [ARQUITETURA.md](ARQUITETURA.md).** Lá está
escrito que dado de negócio do cliente não mora no AutoFluxos. Continua valendo:
isto seria um **produto à parte**, com banco próprio, que o AutoFluxos consome
pelo nó de API como consumiria qualquer sistema de cliente. O que a regra proíbe
é enfiar turma e matrícula dentro do AutoFluxos.

### Já existe código para reaproveitar

O Gabriel construiu um sistema de gestão para o CT de boxe do Argel Riboli.
Está em **`D:\Sistema-ct-boxe`** (`/mnt/d/Sistema-ct-boxe` pelo WSL), monorepo
com Next.js na web, React Native no app e um pacote compartilhado.

O modelo de dados dele é quase exatamente o que um estúdio de pilates precisa:

```
alunos · aulas · presencas · pagamentos · planos · professores
series_aulas · avaliacoes · contratos · notificacoes · candidatos
```

Serve como **referência de domínio**, não para copiar e colar: o layout e a
organização seriam refeitos com o cuidado que o AutoFluxos tem hoje. Mas o
trabalho de descobrir *quais entidades existem e como se relacionam* já foi
feito uma vez, e isso costuma ser a parte cara.

---

## Como escolher, na conversa de venda

| Se o cliente… | Saída |
|---|---|
| já tem planilha e não abandona | 1 — aba de saída na planilha dele |
| está começando, ou topa trocar | 2 — modelo da 4YU |
| quer parar de cuidar de planilha e paga por isso | 3 — gestão como produto |

As três leem pelo mesmo contrato do lado do fluxo. Trocar de uma para outra não
exige redesenhar automação: muda de onde vem `horarios`, não o que o bot faz
com ele.
