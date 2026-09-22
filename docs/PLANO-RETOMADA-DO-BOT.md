# A conversa parada em atendimento humano volta ao bot (0090)

Escrito em 22/set/2026, no dia em que quatro conversas de produção apareceram
mudas há semanas sem ninguém ter percebido. **Implementado nesta mesma rodada**,
então este arquivo é o registro do que existe, e não uma proposta.

## O caso que originou

Mensagem para o número da MGM em 22/set às 14:10, nenhuma resposta. Webhook OK,
assinatura OK, fluxo publicado OK, mensagem gravada no banco.

A sessão `ff11d5b1-392f-498b-bfc1-06d3e81d4fff` estava em `status = 'humano'`
desde **04/set às 12:07**, dezoito dias antes. `avancarConversa`
([receber-mensagem.ts:730](../src/server/receber-mensagem.ts#L730)) vincula a
mensagem à sessão e retorna, sem executar nada. Por desenho.

Quatro sessões presas no mesmo banco, duas da MGM (Gabriel e Eduardo Yamamoto),
paradas desde 03 e 04/set.

Estava previsto e não feito: `PLANO-16-SET-PRODUTO-E-PRECO.md` seção 5 e
`HANDOFF-16-SET-PLANOS-E-ASSINATURA.md` descrevem o mesmo defeito com as mesmas
palavras ("a falha mais silenciosa que existe hoje: não dá erro nenhum") e
deixam o conserto para depois.

**O que existia e confundiu a conversa:** `timeoutMinutos` nos blocos de
pergunta e de NPS ([schema.ts:361](../src/core/flow/schema.ts#L361)). É timeout
por minutos, sim, mas mede **o cliente não respondendo ao bot**. Nada media a
equipe.

## As cinco portas de entrada do `humano`

Isto decidiu o desenho inteiro:

| # | Onde | Quem desenhou |
|---|---|---|
| 1 | bloco `handoff` do fluxo ([executar.ts:922](../src/core/engine/executar.ts#L922)) | quem montou o fluxo |
| 2 | transferência por falha do motor: caminho sem saída, IA sem resposta, fora do horário ([executar.ts:1184](../src/core/engine/executar.ts#L1184)) | ninguém |
| 3 | conversa travada, a trava do contato não liberou ([receber-mensagem.ts:590](../src/server/receber-mensagem.ts#L590)) | ninguém |
| 4 | equipe respondeu pelo Inbox ([acoes.ts:2176](../src/server/acoes.ts#L2176)) | ninguém |
| 5 | equipe mandou mídia pelo Inbox ([acoes-midia-do-inbox.ts:145](../src/server/acoes-midia-do-inbox.ts#L145)) | ninguém |

Só a porta 1 tem bloco onde escrever, e as outras quatro são a maior parte do
volume real. Daí as duas decisões que seguem.

**Dois níveis de configuração.** Conta (obrigatória, cobre as cinco portas) e
bloco (opcional, vence a conta naquele caminho).

**Varredura, e não tarefa agendada.** Agendar exigiria um `agendar` em cada uma
das cinco portas, e esquecer uma delas seria um defeito mudo, que é a categoria
de problema que este trabalho conserta. A varredura lê estado, e estado não tem
porta para esquecer. De brinde, ela conserta o passado: as conversas já presas
entram na primeira passada, sem migração de dado.

## A regra, uma linha por vez

1. Prazo em minutos: o do bloco que parou a conversa, ou o da conta.
2. **O interruptor da conta vence tudo.** Desligado, nada volta, nem com prazo
   escrito num bloco.
3. O prazo conta da **última mensagem da equipe**. Sem nenhuma, conta de quando
   a sessão virou `humano`.
4. Toda mensagem da equipe reinicia o prazo, inclusive a mandada do celular pela
   coexistência. Quem está atendendo agora nunca é interrompido.
5. Mensagem do contato **não** reinicia. Ela é o sintoma: pessoa escrevendo e
   ninguém respondendo é o que o prazo existe para resolver.
6. Vencido: manda a mensagem de retomada, leva a sessão para `encerrada`, anota
   no diário do contato.
7. A próxima mensagem do contato abre conversa nova pelo caminho normal.
8. `automacao_ativa = false` (o "Pausar o bot nesta conversa") cancela tudo.
   Escolha explícita não se desfaz por relógio.
9. Fora da janela de 24h a mensagem não é enviada e a sessão é encerrada do
   mesmo jeito. Ver "Casos de borda".

### A mensagem

Texto padrão, editável na conta e no bloco
([core/retomada.ts](../src/core/retomada.ts)):

> Por aqui o atendimento seguiu sozinho, e voltei a te atender. A equipe já foi
> avisada e pode entrar na conversa a qualquer momento.

Ela precisa dizer as duas coisas: que o bot voltou, e que a pessoa não foi
esquecida. Sem a segunda, a retomada lê como desistência do atendimento.

## Onde se liga e se desliga

**Configurações → Atendimento → "Conversa parada"**
([ajustes/retomada](../src/app/clientes/[clienteId]/ajustes/retomada/page.tsx),
[retomada-do-bot.tsx](../src/components/cliente/retomada-do-bot.tsx)).

A tela conta o defeito antes de oferecer o conserto, em dois parágrafos, porque
quem chega ali não sabe que o bot pode emudecer para sempre num contato.
Interruptor, prazo em lista fechada (30 min a 24h, padrão 2h), e o texto.

**No bloco "Transferir para humano"**, campo "Se ninguém responder"
([painel.tsx](../src/components/editor/painel.tsx)): "usar o padrão da conta"
(que **mostra o valor vigente**, ou avisa que a conta está desligada), "nunca
voltar", ou um prazo. O texto próprio só aparece quando o bloco escolheu prazo
próprio: quem herda o prazo herda a frase.

Com a conta desligada, o campo do bloco mostra o aviso em âmbar de que nada
volta sozinho, com link para ligar.

**Prévia do bloco**: "Volta ao bot: em 120 min sem resposta da equipe", só
quando o bloco escolheu.

## O que foi escrito

| Arquivo | O quê |
|---|---|
| [core/retomada.ts](../src/core/retomada.ts) | a regra pura: qual prazo vale, já venceu, qual texto sai |
| [core/retomada.test.ts](../src/core/retomada.test.ts) | 11 testes, incluindo "a equipe falou há pouco" e o teto de 24h |
| [core/flow/schema.ts](../src/core/flow/schema.ts) | `retomarEmMinutos` (número, `'nunca'` ou ausente) e `mensagemDeRetomada` no handoff |
| [0090_retomada_do_bot.sql](../supabase/migrations/0090_retomada_do_bot.sql) | `clients.retomar_bot_{ativo,minutos,mensagem}` e o índice parcial `sessions_humano_idx` |
| [repos/clientes.ts](../src/server/repos/clientes.ts) | `retomadaDoCliente`, `atualizarRetomada`, e a config no `Cliente` |
| [repos/conversas.ts](../src/server/repos/conversas.ts) | `sessoesEmAtendimentoParado`, `ultimaFalaDaEquipe` |
| [passada-de-retomada-do-bot.ts](../src/server/passada-de-retomada-do-bot.ts) | a varredura |
| [webhook/whatsapp/route.ts](../src/app/api/webhook/whatsapp/route.ts) | a carona, ao lado de `rodarTarefas` e `enviarAgendadas` |
| [manutencao/tarefas/route.ts](../src/app/api/manutencao/tarefas/route.ts) | o piso diário |

**A migration não foi aplicada em produção.** Precisa de autorização explícita
(`AGENTS.md`), e o banco é compartilhado com a Verandi.

## Por que nasce desligada

`retomar_bot_ativo` é `false` por padrão, inclusive para conta nova. O que ela
muda acontece em **conversa viva**, e ninguém deve descobrir esse comportamento
pelo cliente reclamando. Liga quem é dono da conta, na tela, com o texto de
retomada na frente.

Consequência prática, e ela é boa: aplicar a migration não muda nada em
lugar nenhum. O comportamento só começa quando alguém decidir.

## Casos de borda, e a decisão de cada um

**Janela de 24h fechada.** A Meta recusa texto livre (`#131047`). A sessão é
encerrada mesmo assim: o valor está em o bot poder responder à **próxima**
mensagem dela, e é essa mensagem que reabre a janela. Esperar a janela seria
manter o defeito. O diário registra que o aviso não saiu.

**A equipe falou logo antes do prazo.** A varredura recalcula da fala dela e
espera o que falta. Nunca encerra atendimento em curso.

**A ordem do envio.** Envia, confirma, e só então encerra. Se o envio morrer no
meio, a conversa fica como estava e a próxima passada tenta de novo. Encerrar
primeiro deixaria conversa devolvida sem ninguém avisado, sem segunda chance.

**Quem conta como "equipe".** Toda saída que **não** é do bot, e não só a que
tem autor de pessoa gravado: o dono respondendo pelo celular chega pela
coexistência sem autor nenhum, e é a equipe tanto quanto quem responde pelo
painel. Tratá-la como "não foi a equipe" faria o prazo vencer no meio de um
atendimento acontecendo, que é o único erro grave possível aqui.

**Quando a varredura roda.** Cron da Vercel uma vez por dia (`vercel.json`) mais
a carona no webhook, como `rodarTarefas` e `enviarAgendadas`. A carona é da
**conta inteira**: qualquer mensagem de qualquer contato faz a passada daquela
conta acontecer. Conta com movimento cumpre o prazo com minutos de atraso; conta
parada cumpre na madrugada seguinte. Não pendurar no pulso do Inbox: aquela rota
é chamada a cada poucos segundos por cada aba aberta.

## O que ficou de fora

**As quatro sessões já travadas continuam travadas.** Conserto de dado é escrita
em conversa viva e vai separado, com autorização explícita. Ligado o interruptor
depois da migration, a primeira passada as pega sozinha.

**Nada mudou em `abrirFluxoParaContato`.** A trava da RB-48 segue intacta:
sequência e campanha nunca atropelam atendimento vivo. Este trabalho não
atropela nada, ele decide quando o atendimento **deixou** de estar vivo.

**O prazo correndo não aparece no Inbox.** "Volta ao bot em 1h20" ao lado do
estado da conversa seria onde a regra vira visível para quem atende. Vale uma
rodada própria.
