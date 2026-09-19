# Nível, recência e a régua de retomada

> Decisão de 18/set/2026, a partir da revisão de um CRM concorrente (RD Station)
> e de pesquisa sobre RFM. Este documento manda no vocabulário: se o código
> disser "segmento" e a tela disser outra coisa, é aqui que se decide quem está
> errado. Complementa `docs/MODELO-CRM.md`, que decidiu o funil.

## A decisão em uma frase

**Nível é faixa em reais escolhida pelo dono; recência é medida pela conversa, e
não pela compra. As duas juntas respondem a única pergunta que gera trabalho:
quem era bom cliente e está sumindo.**

## Por que não RFM com quintis

O método clássico (Recência, Frequência, Valor) ordena a base e corta em cinco
partes iguais: os 20% que mais gastam viram nota 5. É o padrão do varejo e **não
serve para o nosso cliente**, por duas razões que aparecem já na primeira conta:

1. **A nota é relativa à base.** Num estúdio com trinta alunas, o topo é topo de
   trinta — pode ser quem gastou trezentos reais no ano. O dono olha "Ouro",
   discorda, e a partir daí não confia em mais nada da tela.
2. **O chão se move sozinho.** Entra um cliente grande e todo mundo cai de faixa
   sem ter feito nada. Explicar isso a quem vende pilates custa mais do que a
   segmentação vale.

A recomendação para base pequena é justamente a que adotamos: **faixa absoluta,
em reais, decidida pelo negócio**. É o que se defende numa frase — "ouro é quem
já me deu R$ 5.000" — e é um ajuste que o dono faz uma vez.

O padrão (`ouro: 5000`, `prata: 1000`) é palpite honesto, tirado do ticket dos
primeiros clientes, e está marcado como tal em `core/relacionamento.ts`.

## Três eixos, e não um score

Um score único (555, 321) esconde exatamente o caso que importa: **5 em valor e 1
em recência vira "médio" e some no meio da lista**. Por isso a tela mostra sempre
o par — "Ouro · sumido há 4 meses" —, nunca um número só.

| Nível | Quem está aqui |
|---|---|
| `ouro` | total ≥ faixa de ouro da conta |
| `prata` | total ≥ faixa de prata |
| `bronze` | comprou alguma coisa, abaixo da prata |
| `sem_compra` | **nunca comprou** — e não é bronze |

`sem_compra` é separado de propósito: juntar o cliente pequeno e o desconhecido
na mesma faixa mistura duas conversas completamente diferentes.

| Recência | Dias sem **a pessoa** falar |
|---|---|
| `ativo` | menos de 30 |
| `esfriando` | 30 a 89 |
| `sumido` | 90 a 179 |
| `perdido` | 180 ou mais |
| `sem_contato` | nunca falou |

**A recência é da conversa, não da compra**, e essa é a escolha que sustenta a
tela: quem comprou há um mês e sumiu depois está indo embora, e medir pela compra
faria esse caso parecer saudável até a renovação — que é quando já não dá para
fazer nada.

## A régua de retomada

A sequência já disparava por etiqueta, por etapa e por fim de atendimento (0031,
0034) — todos **ato deliberado de alguém**. `cliente_sumido` é o disparo que
ninguém faz: o tempo passando.

Três regras que o desenho carrega, e o porquê de cada uma:

1. **Só alcança quem já comprou.** Correr atrás de desconhecido que sumiu enche a
   fila de trabalho que ninguém faz.
2. **Ignora quem comprou e nunca trocou mensagem.** É contato importado ou
   lançado à mão; a régua seria a primeira mensagem que ele recebe da conta, e
   chegaria dizendo "faz tempo que a gente não se fala".
3. **Uma pessoa entra uma vez a cada 120 dias** (`por_sumico_em`). Sem isso, a
   passada diária reinscreveria a mesma pessoa todo dia — uma mensagem por dia
   no WhatsApp de um cliente antigo. É como se perde um número, não um lead.

Roda **só no cron diário**, sem carona no webhook nem no pulso do Inbox: a
unidade aqui é o dia, e "sumido há 60 dias" não vira urgente às 14h32.

### O que ela vai custar, e por quê

Quem está calado há sessenta dias está, **por definição**, fora da janela de 24
horas da Meta — então todo primeiro passo de régua de retomada precisa de modelo
aprovado. A tela avisa isso no formulário, antes de a pessoa montar a régua.

E há uma data no calendário: **a partir de 1º/out/2026 a Meta passa a cobrar as
mensagens de serviço depois de 1.000 unidades grátis por número por mês**. Régua
de retomada é o tipo de automação que consome essa franquia sem ninguém olhar, e
o item de medir isso está aberto (ver "O que ficou de fora").

## O que ficou de fora, e por quê

- **E-mail.** Não existe nenhum envio de e-mail no projeto, e `contacts` não tem
  campo de e-mail — o `email` da 0009 é da **empresa** cliente, não do contato.
  Fazer régua por e-mail é escolher um provedor, cuidar de domínio, SPF/DKIM,
  bounce e descadastro: é um produto, não um campo. E o canal deste produto é o
  WhatsApp, onde a mensagem é lida em minutos. Entra quando houver cliente
  pedindo, e aí entra inteiro.
- **Segmento salvo.** O filtro por nível existe na lista de contatos e afina a
  página carregada. Salvar um segmento ("ouro sumido") exigiria o cálculo no
  Postgres — uma view com `group by` sobre os cartões ganhos, refeita a cada
  leitura. Vale quando alguém quiser **agir** sobre o segmento em lote.
- **Medir a franquia de 1.000 mensagens de serviço da Meta.** Ver acima. É a
  mesma conta que `consumo_de_conversas` (0066) já faz para a franquia do plano.
- **Frequência como eixo próprio.** `compras` é lido e mostrado, mas não vira
  faixa: com recompra baixa, quase todo mundo cairia em "1 compra" e o eixo não
  separaria ninguém.

## Onde está cada coisa

```
core/relacionamento.ts        níveis, recências, `oQueFazer` — puro, testável
core/sequencias.ts            o evento `cliente_sumido` e a faixa de dias
server/repos/relacionamento.ts  leitura em lote (sem N+1) e `clientesSumidos`
server/passada-de-retomada.ts   o cron diário, e a trava anti-repetição
components/lead-crm/selo-do-cliente.tsx   o par nível+recência na tabela
components/cliente/faixas-de-nivel.tsx    o ajuste do dono
```

Migration: `0070_relacionamento.sql`, aplicada em 18/set/2026.
