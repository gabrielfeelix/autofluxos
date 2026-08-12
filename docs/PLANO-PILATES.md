# Plano — atender o MGM Pilates (Daniel)

**Objetivo:** sair do zero até o estúdio ser atendido pelo AutoFluxos, incluindo
reposição de aula. Cliente do Eduardo; quem opera o painel é o Eduardo.

**O que já existe:** os módulos 1 a 4 do doc dele (menu, aula experimental, já
sou aluno, institucional) são mensagem, botão, variável e handoff — o produto
faz hoje, sem código novo. Só o módulo 5 precisa de peça.

**A planilha não vira fonte da verdade.** 30% das alunas não têm telefone nela,
o formato dominante não tem DDD, o mesmo nome muda entre meses e é arquivo novo
por mês. Ela entra uma vez, por importação, e depois o dado é nosso.

---

## Ordem

```
0. Fluxo institucional        já dá serviço, sem código
1. Agenda de turmas           o dado
2. Opções dinâmicas           o buraco do motor
3. Efeito consultar-agenda    liga motor e dado
4. Reconhecer quem escreveu
5. Gravar a reposição
6. Tela do Daniel
```

Do 0 ao 1 dá para faturar. Do 2 ao 5 é o módulo 5 do doc. O 6 é o que torna
operável sem nós no meio.

---

## Bloco 0 — Fluxo institucional

Desenhar os módulos 1 a 4 no editor. "Reagendar" cai em handoff para o Daniel
até o bloco 5 existir.

**Código:** nenhum. **Pronto quando:** o bot responde localização, valores e
serviços, e todo lead cai na tela. **Tamanho:** horas.

---

## Bloco 1 — Agenda de turmas

**Decisão — quatro tabelas, e turma é semanal fixa.** A planilha mostra matrícula
fixa (a aluna é da "Segunda 7h"), não reserva por aula. Modelar como reserva
avulsa erraria o domínio.

```
turmas      cliente_id, dia_semana, hora, professor, capacidade, ativa
alunos      cliente_id, nome, telefone, matricula, venc_plano
matriculas  aluno_id, turma_id            -- a vaga fixa
presencas   aluno_id, turma_id, data, marca, tipo(fixa|reposicao)
```

**Decisão — o importador é script, não produto.** Roda uma vez. Lê as 5 abas,
supõe DDD 11 no telefone sem DDD, e **relata** o que não conseguiu casar em vez
de adivinhar. Nome com prosa (`(Pers. Nath)`, `- RESERVA`) vira observação, não
vira campo.

**Arquivos:** `supabase/migrations/0009_agenda.sql`, `src/server/repos/agenda.ts`,
`scripts/importar-turmas.ts`

**Pronto quando:** as 70 turmas e as ~130 matrículas estão no banco, e o relatório
do importador lista nominalmente o que ficou de fora.

**Tamanho:** um dia.

---

## Bloco 2 — Opções dinâmicas no motor

**O buraco:** `opcaoSchema` é `{id, rotulo}` fixo no desenho, e `validar()` exige
uma aresta por opção (`sourceHandle === opcao.id`). Não há como mostrar "os
horários livres de quarta" — eles não existem quando alguém desenha o fluxo.

**Decisão — uma saída só, e a escolha vira variável.** O nó novo (`escolha`) tem
**uma** aresta de saída; a opção clicada é gravada numa variável. Isso evita o
problema de rotear para arestas que não foram desenhadas, e é o que o caso pede:
todos os horários seguem para o mesmo passo de confirmação.

**Decisão — as opções moram na sessão, não em `vars`.** `vars` é
`Record<string,string>` de propósito. Enfiar JSON numa string ali seria mentir
sobre o tipo. A sessão ganha um campo próprio, serializável igual ao resto.

**Arquivos:** `src/core/flow/schema.ts`, `src/core/flow/validar.ts`,
`src/core/engine/executar.ts`, `src/core/engine/types.ts`,
`src/components/editor/nos.tsx`, `painel.tsx`

**Pronto quando:** um teste do motor mostra 3 opções vindas da sessão, casa o
clique e segue pela única saída com a escolha na variável.

**Tamanho:** um dia.

---

## Bloco 3 — Efeito `consultar-agenda`

**Decisão — efeito nativo, não nó de API apontando pra gente.** Chamar nossa
própria API por HTTP exigiria credencial, sairia para a internet e voltaria, e a
recusa de endereço interno de `efeitos/rede.ts` barraria — corretamente. O
resolvedor já atende `chamar_ia` e `chamar_http`; ganha o terceiro.

Devolve os horários livres do dia pedido, já como opções, respeitando
`LIMITE_BOTOES`/`LIMITE_LISTA`.

**Arquivos:** `src/server/efeitos/resolver.ts`, `src/core/engine/executar.ts`,
`src/core/flow/schema.ts` (nó `agenda`)

**Pronto quando:** no simulador, pedir "quarta" traz os horários que a planilha
mostra livres naquele dia.

**Tamanho:** meio dia.

---

## Bloco 4 — Reconhecer quem escreveu

O bot conhece um telefone e mais nada. Casa com `alunos.telefone` normalizado.

**Decisão — não reconhecer é caminho normal, não erro.** Vai acontecer com ~30%
no dia um. O bot pergunta o nome, segue o fluxo, e o Daniel vincula depois. Bot
que insiste em identificar quem ele não tem como identificar vira loop.

**Arquivos:** `src/server/receber-mensagem.ts`, `src/server/repos/agenda.ts`

**Pronto quando:** aluna conhecida é chamada pelo nome e vê a turma dela;
desconhecida segue sem travar e aparece para vincular.

**Tamanho:** meio dia.

---

## Bloco 5 — Gravar a reposição

Escreve em `presencas` com `tipo=reposicao` e manda a confirmação do doc (data,
hora, professor, "chegue 10 minutos antes, meia antiderrapante").

**Decisão — a vaga é conferida de novo na hora de gravar.** Entre mostrar e
clicar, alguém pode ter ocupado. Recusa de tela é conveniência; a que vale é a
do servidor — mesma regra §3 do ESTADO.

**Regra de reposição (a validar com o Daniel):** por ora, sem teto e sem prazo
mínimo. Está aqui escrito como suposição justamente para ser corrigido depois —
mudar um número é barato, descobrir tarde que existia regra é caro.

**Arquivos:** `src/server/efeitos/resolver.ts`, `src/server/repos/agenda.ts`

**Pronto quando:** duas reposições simultâneas na última vaga — uma entra, a
outra recebe "esse horário acabou de encher".

**Tamanho:** meio dia.

---

## Bloco 6 — Tela do Daniel

Turmas da semana com ocupação, reposições do dia, vincular aluna sem telefone, e
**exportar a lista de presença** do jeito que ele já usa. Sem isso, o estúdio
volta para a planilha no primeiro dia difícil.

**Tamanho:** um dia.

---

## Fora deste plano

| O quê | Por quê |
|---|---|
| Acesso da cliente ao painel | Eduardo opera. Papéis de usuário é a maior tarefa do backlog e não bloqueia esta entrega. |
| Escrever de volta na planilha | Dois donos da verdade é o jeito garantido de ter duas verdades. Exportação resolve. |
| Cobrança e plano | Vencimento entra como campo; cobrar não. |
| Retomada fora da janela de 24h | Depende de template aprovado da Meta (fila nº2 do ESTADO). |
