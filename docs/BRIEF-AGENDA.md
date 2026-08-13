# Brief — sistema de agenda para estúdio

Documento para quem vai **construir o sistema**, que é outro projeto e outro
repositório. Aqui está a situação, o que já se sabe do domínio, e onde ele
encosta no AutoFluxos.

---

## A situação

A 4YU vende automação de WhatsApp (AutoFluxos). O primeiro cliente de verdade é
o **MGM Pilates**, estúdio do Daniel na Av. Paulista, trazido pelo Eduardo. O
bot precisa responder "quais horários estão livres na quarta?" — e a resposta
mora numa planilha.

[PLANILHAS.md](PLANILHAS.md) fecha três saídas para clientes que vivem em
planilha. **Este documento é a terceira:** parar de depender de planilha e
oferecer a gestão de horários como produto.

Valor: resolve de vez o problema de estrutura, e vira receita recorrente por
cliente em vez de uma automação vendida uma vez.

---

## O que este sistema NÃO é

Escopo negativo primeiro, porque é o que mais economiza trabalho:

- **Não é financeiro.** Sem cobrança, sem mensalidade, sem boleto, sem
  conciliação. Vencimento de plano entra como *data*, para avisar; cobrar não.
- **Não é aplicativo do aluno.** Não agora. O aluno fala por WhatsApp, e o
  WhatsApp é o app dele. Fazer app significa iOS também, loja, revisão,
  atualização — e nada disso entrega o que o estúdio precisa hoje.
- **Não é plataforma de conteúdo.** Sem vídeo, sem trilha, sem feed. O sistema
  de referência tem isso porque foi pensado com app; aqui não faz sentido —
  não existe lugar onde o aluno acessaria.
- **Não é o AutoFluxos.** São dois produtos. A conversa entre eles é por API,
  detalhada no fim.

O que ele **é**: gestão de agenda e de alunos, para o estúdio operar.

---

## O que já existe para reaproveitar

O Gabriel construiu um sistema para o CT de boxe do Argel Riboli, em
**`D:\Sistema-ct-boxe`** (`/mnt/d/Sistema-ct-boxe` no WSL). Monorepo pnpm com
Next.js na web, React Native/Expo no app, e um pacote compartilhado. Banco no
Supabase.

O modelo de dados dele já resolveu boa parte das perguntas:

```
alunos · aulas · presencas · professores · planos · series_aulas
avaliacoes · contratos · pagamentos · notificacoes · candidatos
trilhas_videos · posts · post_comentarios · aluno_documentos
```

**Aproveitar:** `alunos`, `aulas`, `presencas`, `professores`, `planos`,
`series_aulas`, `avaliacoes`, `candidatos` (que é o lead).

**Deixar de fora:** `trilhas_videos`, `posts`, `post_comentarios` (conteúdo,
que era para o app), `pagamentos` e `contratos` (financeiro, fora do escopo).

É **referência de domínio, não base de código.** O layout e a organização se
refazem com o cuidado que o AutoFluxos tem hoje. O que se aproveita é o trabalho
de descobrir quais entidades existem e como se relacionam, que costuma ser a
parte cara.

---

## O que a planilha do MGM ensina

Levantado do arquivo real (agosto/26). Vale mais que qualquer suposição, porque
é como um estúdio de verdade opera hoje.

**O formato.** Uma aba por dia da semana. 14 horários por dia, das 7h às 20h.
Cada horário é um bloco com professor, 2 a 4 vagas numeradas, e as datas do mês
como colunas de presença. Arquivo novo a cada mês.

**Os números.** 70 turmas por semana, 232 vagas, 132 ocupadas — **57% de
ocupação** — mais 47 pessoas fora da numeração das vagas.

**A regra que muda tudo: matrícula é fixa e semanal.** A aluna é "da segunda das
7h" e ocupa aquela vaga toda semana. Ninguém agenda aula solta. Quem "agenda" é
aluna nova, ou é **reposição** — encaixe avulso num horário com folga. Modelar
como reserva por sessão erraria o domínio inteiro.

**As colunas por aluna:** matrícula, nome, telefone, **vencimento do plano** e
**próxima avaliação postural**. As duas últimas dizem que o sistema precisa de
data com aviso, não só de agenda.

**O vocabulário existe, mas não está escrito.** As marcas de presença usadas:

| Marca | Quantas | O que parece ser |
|---|---|---|
| `P` | 140 | presente |
| `FAR` | 30 | falta |
| `LIC` | 17 | licença (afastamento longo) |
| `XX` / `X` | 25 | sem aula / horário não existiu |
| `F` | 13 | falta (outra grafia?) |
| `REP` + data | 6 | reposição, com a data de origem |
| `P ANT 19H`, `18H` | 5 | veio, mas em outro horário |
| `F EXP` | 2 | faltou à experimental |

E anotações escritas dentro da célula do nome: `PERSONAL` (6), `RESERVA` (4),
`REPOSIÇÃO` (2), `Gestante`, `Fascia`, `Domicílio`.

**Isso é requisito, não bagunça.** Cada marca dessas é um estado que o estúdio
precisa registrar e hoje não tem onde. O sistema tem que ter esses estados como
campo, com nome, senão a pessoa volta a escrever prosa na célula.

**Qualidade do dado, para quem for importar:** 77% têm matrícula, 70% têm
telefone, e o formato dominante do telefone não tem DDD (`9.8109-1840`, 95 de
125). A mesma pessoa aparece escrita de dois jeitos entre meses (`PERSIO` e
`PÉRSIO FAULIM DE MENEZES`). Importar exige decidir o que fazer com o que não
casa — e **relatar**, não adivinhar.

---

## O que o mercado já resolveu

Levantado de Tecnofit, Clínica Ágil, Vedius e SuperSaaS, que atendem esse
segmento no Brasil. O que aparece em todos:

- **Agendamento por matrícula e por sessão**, com inclusão automática do aluno
  nos horários fixos.
- **Controle de vagas e taxa de ocupação** — o número que diz se vale abrir
  turma nova.
- **Presença, falta e reposição** como fluxo, não como anotação.
- **Lista de espera** com aviso automático quando abre vaga em horário cheio.
- **Lembrete automático** antes da aula, para reduzir falta.
- **Abrir turma nova no mesmo horário** quando um horário vive lotado.

Os três primeiros são o mínimo para substituir a planilha. Lista de espera e
lembrete são exatamente o que o bot do AutoFluxos faz melhor que qualquer app —
e é aí que os dois produtos se somam.

---

## O dia a dia que o sistema precisa atender

Ordenado por frequência, que é o que decide o que fica na tela inicial:

1. **Marcar presença da turma.** Todo dia, várias vezes. Hoje é papel impresso.
   Se o sistema não for rápido nisso, ele não substitui a folha.
2. **Encaixar uma reposição.** Achar horário com folga e pôr a aluna lá, uma
   vez, sem mexer na matrícula fixa dela.
3. **Ver quem falta / quem sumiu.** Aluna com faltas seguidas é aluna saindo.
4. **Matricular aluna nova** num horário com vaga.
5. **Trocar uma aluna de horário** em definitivo.
6. **Ver plano vencendo** e avaliação postural a fazer.
7. **Abrir, fechar ou remanejar horário** — professor de férias, feriado.
8. **Imprimir a lista da turma.** Enquanto a marcação for no papel, isso é
   requisito, não conveniência.

---

## Como o aluno confirma

**Por WhatsApp, e é isso que diferencia o produto.**

Nesse segmento o aluno não instala app de estúdio. Ele já conversa com o estúdio
por WhatsApp — o doc do Eduardo mostra o fluxo inteiro assim. O sistema é a tela
de **quem trabalha no estúdio**; o aluno nunca vê o sistema.

Então a divisão fica:

- **Aluno:** WhatsApp, atendido pelo AutoFluxos.
- **Estúdio:** web, neste sistema.
- **App:** fora do escopo agora. Se um dia entrar, entra para o professor
  marcar presença no tablet, não para o aluno.

Isso simplifica muito: **não precisa de login de aluno, nem de recuperação de
senha, nem de tela pública.** O que o aluno faria num app, o bot faz na conversa.

---

## Entidades propostas

Ponto de partida, para o agente refinar:

```
estudios          multi-cliente desde o começo — o segundo estúdio não pode
                  exigir reescrever

professores       nome, contato, cor na agenda
alunos            nome, telefone (E.164), matrícula, observações de saúde,
                  vencimento do plano, próxima avaliação postural
planos            frequência semanal contratada (1x, 2x, 3x…)

turmas            estudio, dia da semana, hora, professor, capacidade,
                  modalidade (pilates, personal, fisio), ativa
matriculas        aluno ↔ turma — a vaga fixa semanal. É o coração.
ocorrencias       aluno, turma, data, tipo: presente | falta | falta_avisada |
                  licenca | reposicao | horario_trocado | sem_aula
                  (+ referência à data de origem, quando for reposição)

espera            aluno, turma — fila para quando abrir vaga
leads             quem chegou pelo WhatsApp e ainda não é aluno
```

Duas decisões que valem discutir antes de codar:

**`ocorrencias` como tabela única, com tipo**, em vez de `presencas` +
`reposicoes` + `faltas` separadas. O vocabulário da planilha mostra que os
estados se misturam ("veio, mas em outro horário"), e tabela separada por estado
vira migração toda vez que aparece um estado novo.

**`capacidade` na turma, não no estúdio.** A planilha tem horários com 2, 3 e 4
vagas no mesmo dia.

---

## A fronteira com o AutoFluxos

**São dois sistemas. A conversa é por API, com autenticação, e nenhum dos dois
importa código do outro.** Isso não é preferência: o
[ARQUITETURA.md](ARQUITETURA.md) do AutoFluxos proíbe dado de negócio do cliente
morar dentro dele, e vale igual aqui — a agenda é o sistema do estúdio, o
AutoFluxos é a automação que conversa com ele.

**O AutoFluxos não precisa de código novo para consumir isto.** Ele já tem nó de
API com credencial no cofre (Conexões). O que este sistema precisa entregar é um
token e alguns endereços.

Superfície mínima para o bot funcionar:

```
GET  /disponibilidade?dia=quarta
     → { "livres": "7h00;10h00;15h00" }

     O formato com ponto e vírgula é o que a pergunta dinâmica do AutoFluxos
     espera direto, sem tradução no meio. Ver PLANILHAS.md.

GET  /aluno?telefone=5511999990000
     → { "encontrado": true, "nome": "...", "turma": "segunda 7h00" }
     → { "encontrado": false }

     Vai responder `false` com frequência: no dado do MGM, 30% não têm
     telefone. Não reconhecer é caminho normal, não erro.

POST /reposicao
     { "telefone": "...", "dia": "quarta", "hora": "10h00" }
     → { "ok": true, "professor": "Carol" }
     → { "ok": false, "motivo": "esse horário encheu" }

     Confere a vaga **na hora de gravar**, não só na hora de mostrar: entre
     mostrar e clicar, alguém pode ter ocupado.

GET  /turmas
     → catálogo, para telas e conferência
```

Autenticação por token estático no cabeçalho — é o que o cofre do AutoFluxos
guarda hoje (`bearer`, `cabeçalho` ou `query`).

---

## Acessos

- **Administrador do estúdio** (Daniel): tudo.
- **Professor:** a agenda dele, os alunos dele, marcar presença. Não vê o
  estúdio inteiro.
- **4YU:** acesso de suporte, para configurar e diagnosticar.

Multi-estúdio desde o primeiro dia no modelo de dados, mesmo com um cliente só —
adicionar `estudio_id` depois custa migração em toda tabela e toda consulta.

---

## Perguntas em aberto, para validar com o Daniel

Não são detalhes de código; mudam o modelo:

1. **Reposição tem regra?** Quantas por mês, precisa avisar com antecedência,
   vale para qualquer plano? A planilha mostra que acontece muito e a regra não
   está escrita em lugar nenhum.
2. **O que exatamente significam `FAR`, `F`, `LIC`, `XX`?** Foi inferido da
   frequência, não confirmado.
3. **Personal e Domicílio ocupam vaga de turma** ou são agenda paralela?
4. **Aluna com plano vencido continua ocupando a vaga?**
5. **Quem marca presença** — o professor, na hora, ou alguém depois, pela folha?
   Isso decide se a tela é de celular ou de computador.
