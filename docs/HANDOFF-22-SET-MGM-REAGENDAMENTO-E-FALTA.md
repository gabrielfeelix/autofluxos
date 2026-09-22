# Handoff 22/set/2026 (tarde): MGM, reagendamento, não comparecimento, e a data que já passou

Continuação de [HANDOFF-22-SET-MGM-RECONHECIMENTO.md](HANDOFF-22-SET-MGM-RECONHECIMENTO.md),
que deixou os dois fluxos abaixo explicitamente **não revisados**. Agora estão.
Como se mexe em fluxo de produção aqui continua escrito lá, e não se repete.

## O que está no ar

| Fluxo | Versão | Versão anterior, para voltar |
|---|---|---|
| Reagendamento `45a9db71-d702-4f4f-8510-d0687145fb0e` | **7** (`91af1324-afaa-47b7-82ad-159f053bf31f`) | v6 `b2d40ed8-58df-4aad-9002-879848ee6f9d` |
| Não Comparecimento `969a8fa0-7071-40d5-b70d-fc74e6d728f0` | **5** (`f785b8d8-55a2-49f0-a0b1-9e1727b3071a`) | v4 `d199c2f6-ef63-42b1-8003-1ba3486d1dc0` |

Publicados pela RPC `publicar_fluxo`, com `flows.rascunho` gravado antes para o
editor mostrar o que está no ar. **A RPC e o `update` do rascunho não podem ir no
mesmo comando**: os dois escrevem a mesma linha de `flows` e o Postgres recusa
com `27000: tuple to be updated was already modified`. São dois comandos.

Os grafos não nascem mais de JSON escrito à mão: estão em
[scripts/fluxos/](../scripts/fluxos/), rodam com `npx tsx` e validam com o
validador do próprio produto antes de imprimir. `auditar.mts` é o antigo
`auditar-mgm.mts` que vivia solto na raiz.

## O print que abriu a rodada

O Gabriel mandou `30/06/2026` numa conversa de setembro e ouviu *"Desculpe, pode
escrever novamente citando dia / mês / ano"*. O formato estava certo; o
calendário é que não. Ela reescreveria a mesma data até as três tentativas
acabarem.

Duas causas, as duas fechadas:

1. **`conferirResposta` recusava sem dizer por quê** (`6278f72`). Agora devolve
   `motivo: 'formato' | 'passou'`, e a frase de data passada **não** é
   sobrescrita pela "mensagem quando não entender" do bloco. Aquele campo ensina
   formato, e formato não era o problema. É a única mensagem do sistema que
   ganha da do cliente, e o comentário no código diz por quê.
2. **O bloco de digitar data ainda existia no Reagendamento.** O Agendamento v7
   já não tem (o print é de antes dele subir). Agora nenhum dos dois tem.

## Reagendamento v7

O que mudou, e o cenário que forçou cada um:

- **menu de dias no lugar da data digitada**, igual ao Agendamento v7;
- **quem tem 2+ reposições escolhe qual repor.** Antes ia direto para a recepção.
  Pior: `reposicoesAbertas[].servicoId` virava `a;b` na URL da disponibilidade,
  então com duas reposições de modalidades diferentes a busca voltava vazia sem
  ninguém entender. Hoje a escolha define um id só, e o serviço vem de
  `GET /participacoes/:id`;
- **quem não tem reposição nenhuma** deixou de ser beco com um botão de recepção:
  oferece marcar aula e emenda no Agendamento por bloco `ir-fluxo`;
- **409 no `POST /participacoes`** (o horário foi preenchido entre listar e
  marcar) volta a escolher em vez de chamar uma pessoa. A reposição continua
  guardada, então não há nada a consertar à mão;
- **período sem vaga** oferece outro período.

## Não Comparecimento v5

O achado que justificava a rodada sozinho: **aula que já passou mandava mensagem
vazia**. `avisoParaConfirmar` vem `null` quando a aula passou, o bloco
`confirma-fora-do-prazo` tinha só `{{aviso_do_prazo}}` no texto, e o WhatsApp
recebia uma bolha em branco com dois botões. Confirmando, o `DELETE` responde
409 e a conversa cai para uma pessoa. `podeCancelar` já estava mapeado e nunca
era lido.

- `pode_cancelar` agora desvia **antes**, com frase que explica;
- fora do prazo, a frase do estúdio continua sendo a preferida, e um bloco de
  condição escolhe um texto nosso quando ela vier vazia. Mensagem sem conteúdo
  não sai mais deste fluxo por caminho nenhum;
- **quem avisou no prazo recebe a oferta de já remarcar**, emendando no
  Reagendamento. Antes a conversa acabava e remarcar era começar tudo de novo;
- quem não tem aula marcada deixou de ser beco.

## Código que nasceu disso

**`{campo:formato}` no rótulo de menu** (`d3c352b`). O menu de aulas mostrava
`2026-09-18 07:00 · Pilates apa`, cortado em 20 caracteres pelo WhatsApp: a data
que o banco usa, no lugar da que a aluna usa. O campo `formato` do mapeamento
não alcança ali, ele vale para o valor inteiro, e com modelo de rótulo o valor
inteiro já é a linha montada. Agora `{data:dia_semana} {hora:hora}` produz
`sexta 18/09 07:00`. Formato desconhecido devolve o texto cru.

**`GET /participacoes/:id` devolve `servicoId`** (Verandi `f85d271`, no ar). Sem
ele não há como filtrar a disponibilidade da reposição escolhida.

## O R$ 450 tinha documento, sim

A pendência 1 do handoff anterior está fechada. Os valores vivem em
`app_verandi.plano`, e o plano `001 Mensal 1x semana` de Pilates aparelho é
R$ 450,00. O que estava errado era a simplificação: o contexto de negócio dizia
"os planos começam em R$ 450" e quem perguntasse o preço de **uma aula** ouviria
450, quando a avulsa é R$ 100.

O contexto foi reescrito nessa seção, com os números da tabela: mensal 1x/2x/3x
(450 · 735 · 1.040), o valor por mês nos planos longos (405 · 360 · 337), a
avulsa (100) e a faixa das sessões das outras modalidades (105 a 300). Fechar
plano, percentual e forma de pagamento continuam com a equipe.

**Se um preço mudar na Verandi, este texto não muda sozinho.** Ele é cópia, e é
a única cópia; quem mexer em `app_verandi.plano` precisa lembrar dele.

## O que continua aberto

1. **O prazo da retomada não aparece no Inbox**, item 3 do handoff anterior.
2. **O campo do bloco de handoff ainda é lista fechada**, item 4, com a decisão
   do Gabriel pendente: trocar o dropdown por um check único.
3. **O rascunho do Atendimento não bate com o publicado**, e não é divergência de
   conteúdo: conferido nó a nó, só muda `desvio: null` carimbado pelo zod ao
   abrir no editor, e posição de bloco. Não republique só por causa disso.
