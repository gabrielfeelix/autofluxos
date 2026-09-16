# Pendências abertas pelo dono em 16/set

Continua de `2f5c3d6`, que fechou o caminho da transmissão (tela + gancho do
motor) e corrigiu a criação de modelo da biblioteca com botão.

Leia antes: `docs/HANDOFF-16-SET-TRANSMISSOES-E-DISTRIBUICAO.md`, que segue
valendo inteiro para o **Trabalho 2 (distribuição de leads)**, ainda sem uma
linha de código.

---

## Regras que o dono repetiu, e valem para tudo daqui

1. **Travessão é proibido no sistema.** Não em texto de tela, não em comentário,
   não em nome de teste. Em 16/set eles foram removidos de todos os arquivos
   tocados; o resto do repositório ainda tem, e cada arquivo que você abrir
   deve sair sem.
2. **Nada de jargão de API na tela.** `{{1}}` já saiu; o inglês da Meta também.
3. **Campo que some sem explicar é pior que campo desabilitado.**

---

## 1. A mensagem das 24h está mentindo

`src/components/lead/responder.tsx:107` diz:

> "retomar exige um modelo aprovado pela Meta, que este produto ainda não manda."

**Isso deixou de ser verdade em `2f5c3d6`.** O produto manda modelo aprovado, e
a frase que aparece justamente quando a pessoa mais precisa disso manda ela
embora.

O que o dono pediu, em duas partes:

- **quando houver modelo aprovado**: a tela deixa escolher qual usar para
  retomar a conversa, ali mesmo, sem sair para Transmissões;
- **quando não houver nenhum** (o caso das 34h sem modelo pronto): a tela dá a
  saída, com um caminho para criar o modelo. Hoje ela é um beco.

Vale reusar a lista de aprovados que `acaoListarTemplates` já devolve, e o envio
já existe em `canal.enviarTemplate`. É tela, não motor.

---

## 2. Inbox: o microfone some quando não devia

Digitou, desistiu, apagou tudo e tirou o clique do campo: o microfone **não
volta**. Ele some ao primeiro clique e não reaparece.

O certo: campo vazio e sem foco volta ao estado inicial, com o microfone.

Print em 16/set: o campo mostra "Responder Daniel pelo WhatsApp..." e só o
clipe, o emoji e o enviar.

---

## 3. Inbox: a última mensagem diz "atendimento" em vez de quem falou

Na lista de conversas aparece:

```
Daniel Mutti
atendimento: Beleza
```

Deveria dizer **quem** falou, com o nome da pessoa:

```
Daniel Mutti
Gabriel Felix: Beleza
```

E o nome em cor um pouco diferente do texto da mensagem (o dono sugeriu azul ou
verde, a testar) para separar quem falou do que foi dito.

O autor já é gravado: ver `autorDaPessoa` em `core/autor-da-mensagem.ts`, que é
o mesmo caminho que `enviarAgendadas` usa para assinar.

---

## 4. Nada disto tocou a Meta ainda

Continua valendo inteiro o item **1c** do handoff anterior: nenhuma linha do
caminho de transmissão falou com um número real. A ordem de provar, do mais
barato ao mais caro, está lá, e o primeiro passo agora é diferente do que era:

**criar um modelo da biblioteca que tenha botão.** É o caso que quebrava com
"give the same number of button inputs to match the library buttons", e é o que
prova de uma vez o `library_template_button_inputs` e a tela que pergunta o
destino do botão.

Depois: webhook mudando o status sozinho, um envio para um número só, e só então
uma lista pequena.

---

## 5. Chats em paralelo custaram trabalho em 16/set

O outro chat commitou e rodou `git reset`, e isso **descartou as edições não
commitadas** de dez arquivos deste trabalho. Elas foram refeitas, mas a lição
custou uma volta inteira:

- `git fetch` e `git status` antes de começar não bastam;
- **commite cedo.** Arquivo novo (untracked) sobrevive a um `reset`; edição em
  arquivo existente, não;
- antes de `git add`, confira o que está no índice: o outro chat deixou
  `contas-admin.tsx`, `barra-lateral.tsx` e outros staged, e um `git commit -a`
  teria levado junto o trabalho pela metade de outra pessoa.

---

## 6. Inbox: as ações que o WhatsApp tem e nós não

Pedido do dono em 16/set, olhando o WhatsApp Web lado a lado com o nosso Inbox.
Nada disto foi começado. A ordem abaixo é a de valor por esforço, do melhor
para o pior, e não a ordem em que o dono citou.

### 6.1 Fixar conversa, **por atendente**

O gesto do alfinete, como no WhatsApp. Três ou quatro conversas grudadas no topo
da fila, acima de qualquer ordenação.

**É por pessoa, e não por conta.** O dono foi explícito: cada atendente fixa as
dele, e o colega não vê. Isso muda o modelo de dados: a coluna não vai em
`af_contatos` (que é da conta), e sim numa tabela de ligação
`usuario_id + contato_id`, como `af_leituras` já faz para "não lidas". Reusar o
desenho de leituras é o caminho curto: mesma cardinalidade, mesma pergunta
("o que esta pessoa marcou neste contato?").

**O que a Meta NÃO dá, e por isso não tente:** fixar conversa é estado local do
aparelho. A Cloud API não expõe isso em campo nenhum, nem no webhook nem em
endpoint de leitura. Os três fixados que o dono tem no celular dele não podem
ser espelhados; o que existir aqui é nosso, do zero.

### 6.2 Marcar como não lida

Inverso do que `marcarComoLida` já faz em `server/repos/leituras.ts`. É a mesma
tabela e o mesmo par `usuario_id + contato_id`, e por isso sai quase de graça
junto do 6.1: apagar a linha de leitura (ou empurrar o relógio para trás) devolve
a insígnia.

Vale como gesto de trabalho real: quem abre uma conversa sem poder responder
agora quer deixá-la marcada para voltar.

### 6.3 Marcar todas como lidas

Um botão no topo da fila. Zera a insígnia de tudo que está no recorte atual.

**Cuidado que o dono não citou e importa:** "todas" precisa dizer *todas de
quê*. Se for a fila inteira da conta, some a insígnia de conversas que a pessoa
nem viu no filtro. O certo é agir sobre o recorte à vista (o rail e a busca
atuais) e dizer isso no próprio botão.

### 6.4 Favoritar mensagem

Duas telas, e por isso é o maior dos quatro: o gesto na bolha (estrela) e a
lista de favoritas. Tabela nova, também por pessoa.

Diferente dos três acima, esta não tem nada pronto para reusar.

### 6.5 O que ficou de fora, com o motivo

- **Silenciar notificações**: o dono disse que não precisa.
- **Arquivar conversa**: "talvez, precisamos pensar". Não decidido. Repare que
  nós já temos `estado` (`aberta` / `adiada` / `resolvida`, ver a 0049), e
  "arquivada" pode ser um quarto estado ou pode ser redundante com "resolvida".
  Decidir isso **antes** de escrever qualquer coisa: dois conceitos para a mesma
  ideia é o tipo de coisa que não se separa depois.

### 6.6 O banco é compartilhado

Tudo em 6.1 a 6.4 cria tabela ou coluna, e este projeto divide o Supabase de
produção com a Verandi. Vale `docs/BANCO-COMPARTILHADO.md` por inteiro, e a
migration seguinte sai de `ls supabase/migrations/ | tail -1`, nunca da
numeração citada num plano.

---

## 7. O que entrou em 16/set pela tarde, e o que ficou sem prova

`2438d4e` mexeu em três coisas da mesma família ("a tela não reage ao clique"),
com três causas diferentes:

- **Trocar de conversa no Inbox** não tinha fronteira de espera. A `key` do
  `<Suspense>` era só o filtro, de propósito, para a fila não piscar; o efeito
  colateral era a conversa ficar sem fallback nenhum, segurando a anterior até
  as consultas voltarem. Agora a coluna do meio é `ColunaDaConversa`, com
  `key` no contato.
- **O menu de "Deletar"** em `/admin/contas` abria longe do cursor. A causa não
  era a coordenada: `.app-page-enter` roda `fade-up` com `animation-fill-mode:
  both`, o último quadro fica aplicado, e `transform: none` computa como
  `matrix(1,0,0,1,0,0)`. Identidade, e ainda assim transform, o que basta para
  virar bloco contentor de `position: fixed`. Portal para o `body` resolve.

  **Isto vale para o painel inteiro.** `.app-page-enter` envolve toda tela do
  cliente, então qualquer `position: fixed` renderizado dentro de uma página do
  painel está sujeito ao mesmo deslocamento. Se aparecer outro elemento flutuante
  fora do lugar, a causa provável é esta, e não a conta de coordenadas.
- **A barra lateral** deixou de encolher ao entrar em Configurações
  (`forcarRecolhida` saiu inteiro).

Antes disso, `a7edf1a` criou os sete `loading.tsx` do painel, que não existiam:
sem eles o clique numa aba deixava a tela parada até o servidor responder, e o
esqueleto chegava depois da espera em vez de durante.

**O que ninguém conferiu no navegador:** nenhuma das quatro mudanças foi clicada
no app. Build, lint e typecheck passam, e a estrutura está certa, mas "o
esqueleto aparece no clique" e "o menu nasce sob o cursor" são afirmações sobre
o que a pessoa vê, e isso não foi visto. Confira antes de marcar como fechado.

**Os testes não rodaram no fim.** `src/server/repos/*` estoura por timeout contra
o Supabase quando duas sessões trabalham ao mesmo tempo; o `repos.test.ts` passou
25 de 25 sozinho, o que indica concorrência e não regressão, mas a suíte inteira
ficou sem rodar depois da última mudança.
