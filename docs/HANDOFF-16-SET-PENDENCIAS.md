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
