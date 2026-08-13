# Brief — Agenda, o SaaS de agendamento da 4YU

Passagem de bastão para quem vai **construir o sistema**, que é outro projeto e
outro repositório. Aqui está o que o produto é, o que já se sabe, o que precisa
ser pesquisado, e onde ele encosta no AutoFluxos.

---

## O que é

Um **SaaS de agendamento**, multi-inquilino, para qualquer negócio que marque
horário. Não é software de estúdio de pilates. Não é software de academia.

Os clientes previstos são de áreas diferentes e com agendas de formatos
diferentes:

- estúdio de pilates — turma com várias vagas, aluno fixo no mesmo horário toda
  semana
- personal trainer sem espaço próprio — atendimento individual, horário
  combinado, local variável
- barbearia, salão — horário avulso, serviços de durações diferentes, escolha do
  profissional
- clínica, consultório — horário avulso, retorno, encaixe
- professor particular, aula de idioma — recorrente ou avulso

**A regra que decide tudo:**

> Isto é **agendamento**, ou é **este cliente**?

Se for do cliente, vira configuração — nunca coluna nova, nunca `if` no código.
É a mesma disciplina do [ARQUITETURA.md](ARQUITETURA.md) do AutoFluxos, e existe
pelo mesmo motivo: no dia em que precisar mexer no código para encaixar um
cliente, o produto virou consultoria com passo extra.

**O risco concreto deste projeto** é modelar em cima do primeiro caso. O MGM
Pilates é a evidência disponível, não o alvo. "Turma", "aluno" e "professor" são
o vocabulário *dele*; o produto precisa de nomes que sirvam para o barbeiro e o
consultório também.

---

## As duas formas de agenda que já sabemos existir

O modelo tem que aguentar as duas sem gambiarra, e provavelmente é a decisão
mais importante do projeto:

**Vaga recorrente.** A pessoa ocupa o mesmo horário toda semana, por tempo
indeterminado. Ninguém remarca nada — a presença é que é registrada. Quando ela
falta, aparece a **reposição**: encaixe avulso em outro horário. É o caso do
pilates, do professor particular, da aula de idioma.

**Horário avulso.** Cada atendimento é marcado individualmente, escolhendo
serviço, profissional e horário. É o caso do barbeiro, da clínica, do personal.

Suspeita a validar: as duas podem ser a mesma coisa se o "horário recorrente"
for uma assinatura que *gera* atendimentos. Ou podem ser conceitos distintos que
só compartilham a grade. **Essa escolha é do agente que construir**, e vale
pesquisá-la antes de escrever a primeira migration.

Capacidade também generaliza: turma de pilates com 4 vagas e atendimento
individual são o mesmo objeto com capacidade 4 e 1.

---

## O que NÃO é

Escopo negativo primeiro, porque é o que mais economiza trabalho:

- **Não é financeiro.** Sem cobrança, mensalidade, boleto ou conciliação.
  Vencimento de plano pode entrar como *data*, para avisar; cobrar não.
- **Não é aplicativo de quem é atendido.** O cliente final fala por WhatsApp, e
  o WhatsApp é o app dele. Isso derruba login público, recuperação de senha e
  tela de aluno.
- **Não é plataforma de conteúdo.** Sem vídeo, trilha ou feed.
- **Não é o AutoFluxos.** São dois produtos, e conversam por API.

O que ele **é**: a agenda e o cadastro de quem é atendido, para o negócio operar.

---

## Evidência disponível

### 1. Um sistema já construído, para referência de domínio

`D:\Sistema-ct-boxe` (`/mnt/d/Sistema-ct-boxe` no WSL). Monorepo pnpm, Next.js
na web, React Native/Expo no app, Supabase no banco. Feito para um CT de boxe.

Entidades que ele tem: `alunos`, `aulas`, `presencas`, `professores`, `planos`,
`series_aulas`, `avaliacoes`, `candidatos`, `contratos`, `pagamentos`,
`notificacoes`, `trilhas_videos`, `posts`, `aluno_documentos`.

**Referência de domínio, não base de código, e não modelo do produto.** Ele é
tão específico de um negócio quanto a planilha do pilates — só que em código.
Serve para ver quais perguntas aparecem, não para copiar o formato. Conteúdo e
financeiro ficam de fora por escopo.

### 2. A planilha de um cliente real, para ver como se opera hoje

Lista de turma do MGM Pilates, agosto/26, analisada célula a célula. **É um
caso, não o padrão** — mas é dado real de um negócio que funciona, e mostra
problemas que aparecem em qualquer agenda:

**Escala:** 70 horários por semana, 232 vagas, 132 ocupadas (57%), mais 47
pessoas fora da grade (encaixe, avulso, reserva).

**O estado vira prosa quando não tem campo.** As marcas usadas na presença:
`P` (140), `FAR` (30), `LIC` (17), `XX`/`X` (25), `F` (13), `REP`+data (6),
`P ANT 19H` e `18H` (5), `F EXP` (2). E escritos junto do nome: `PERSONAL`,
`RESERVA`, `REPOSIÇÃO`, `Gestante`, `Fascia`, `Domicílio`.

Cada um desses é um estado que o negócio precisa registrar e não tem onde.
**A lição generaliza:** se o sistema não tiver o estado como campo, a pessoa
escreve prosa — e o dado morre.

**Qualidade do dado, para quem for importar de planilha:** 77% com identificador,
70% com telefone, formato de telefone sem DDD na maioria, e a mesma pessoa
escrita de dois jeitos entre meses. Importador precisa **relatar o que não
casou**, nunca adivinhar.

---

## O que pesquisar antes de modelar

Tarefa de quem for construir. Não modele a partir deste documento — ele só diz
onde olhar.

1. **Como os concorrentes modelam recorrência.** Tecnofit, Clínica Ágil, Vedius,
   SuperSaaS no Brasil; Calendly, Cal.com, Acuity, Simply Book, Booksy fora.
   Cal.com é código aberto — o modelo de dados dele está lá para ler.
2. **Quais features aparecem em todos.** Já se sabe que aparecem: controle de
   vagas e ocupação, presença/falta/reposição, **lista de espera com aviso
   quando abre vaga**, lembrete antes do horário. Confirmar e completar.
3. **Fuso, feriado e exceção.** Semana cheia, feriado, profissional de férias,
   horário que não existe naquela semana. É onde agenda costuma quebrar.
4. **Como cada segmento chama as coisas.** "Turma/aluno/professor" no pilates,
   "cliente/profissional/serviço" no salão, "paciente" na clínica. Decidir o
   vocabulário interno neutro e onde a tradução acontece.
5. **Onde termina a agenda e começa o CRM.** Histórico, observação, tag,
   retorno. Traçar a linha explicitamente.

---

## Multi-inquilino e segmentação

Multi-inquilino **desde a primeira migration**, com um cliente só em produção.
Acrescentar o identificador do inquilino depois custa migração em toda tabela e
revisão de toda consulta.

Ideia registrada, **fora do escopo agora**: no cadastro, perguntar o ramo e a
forma de agenda para já entregar o sistema pré-configurado. Vale desenhar o
modelo de forma que isso caiba depois — não vale construir agora.

---

## Papéis

- **Dono da conta:** tudo.
- **Profissional:** a agenda dele, as pessoas dele, registrar atendimento. Não
  vê a operação inteira.
- **Recepção / secretaria:** marca e remarca para todos, não mexe em
  configuração.
- **4YU:** acesso de suporte, para configurar e diagnosticar.

O terceiro papel existe porque em salão e clínica quem marca não é quem atende.
No pilates é a mesma pessoa — e é exatamente o tipo de diferença que tem que ser
papel, não sistema diferente.

---

## A fronteira com o AutoFluxos

**São dois sistemas separados, conversando por API com autenticação. Nenhum
importa código do outro, e nenhum lê o banco do outro.**

O AutoFluxos é a camada de automação: ele conversa no WhatsApp e chama sistemas
de fora pelo bloco de API, com a credencial guardada no cofre dele. A Agenda é
um desses sistemas — do ponto de vista do AutoFluxos, não é diferente de um CRM
do cliente.

**Consequência prática: o AutoFluxos não precisa de código novo.** O que a
Agenda precisa entregar é um token e alguns endereços.

### Superfície mínima para o bot funcionar

```
GET  /disponibilidade?dia=quarta[&servico=...][&profissional=...]
     → { "livres": "7h00;10h00;15h00" }
```

O formato separado por ponto e vírgula não é capricho: é o que o bloco de
pergunta dinâmica do AutoFluxos consome direto, sem tradução no meio. Ver
[PLANILHAS.md](PLANILHAS.md).

```
GET  /pessoa?telefone=5511999990000
     → { "encontrado": true, "nome": "...", "recorrencia": "segunda 7h00" }
     → { "encontrado": false }
```

Vai responder `false` com frequência — no dado real, 30% não têm telefone
cadastrado. **Não reconhecer é caminho normal, não erro**, e o bot já trata
assim.

```
POST /agendamento
     { "telefone": "...", "dia": "quarta", "hora": "10h00", "tipo": "reposicao" }
     → { "ok": true, "profissional": "Carol" }
     → { "ok": false, "motivo": "esse horário encheu" }
```

Confere a vaga **na hora de gravar**, não só na hora de mostrar: entre mostrar e
clicar, alguém pode ter ocupado.

```
GET  /catalogo
     → serviços, profissionais e grade, para telas e conferência
```

Autenticação por token estático em cabeçalho — é o que o cofre do AutoFluxos
guarda hoje (`bearer`, `cabeçalho` ou `query`).

### No outro sentido

Vale desenhar desde já: a Agenda vai querer **avisar** (lembrete de horário,
vaga que abriu na lista de espera). Quem fala com o cliente final é o AutoFluxos.
Então a Agenda precisa poder disparar um evento para fora — webhook de saída,
com assinatura — em vez de mandar WhatsApp por conta própria.

Duas regras que evitam retrabalho:

1. **A Agenda nunca fala com a Meta.** Quem tem o número, a janela de 24h e os
   modelos aprovados é o AutoFluxos.
2. **O AutoFluxos nunca guarda turma, matrícula ou presença.** Ele lê e escreve
   pela API, e o dado mora na Agenda.
