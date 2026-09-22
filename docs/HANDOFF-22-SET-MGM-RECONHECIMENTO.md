# Handoff 22/set/2026 — MGM: retomada do bot, reconhecimento por telefone, menu de dias

Para quem for continuar nos fluxos da MGM. Começa pela última seção, que é o
que ficou aberto.

## Os ids que você vai precisar

| O quê | Valor |
|---|---|
| Cliente MGM Pilates | `5de5a891-790f-4c14-b60b-ce0a573fe1c7` |
| Credencial da Verandi (`VERANDI-OFICIAL`) | `a9f8ce40-4a00-4f82-af1b-ee0811afa2db` |
| Fluxo Atendimento | `ae9f663f-933d-4953-bbb9-aefed2360b57` (v10 no ar) |
| Fluxo Agendamento | `7d05c074-b07f-4d06-855b-ba7430412138` (v7 no ar) |
| Fluxo Reagendamento | `45a9db71-d702-4f4f-8510-d0687145fb0e` (v6, **não revisado**) |
| Fluxo Não Comparecimento | `969a8fa0-7071-40d5-b70d-fc74e6d728f0` (v4, **não revisado**) |
| Versões anteriores, para voltar | Atendimento v9 `a1d52dc3-877a-48b2-aac7-821c6ecd4b22` · Agendamento v6 `5f5a37d7-7416-446a-85e3-6b5ea965245e` |

Voltar uma publicação é apontar `flows.versao_publicada_id` para a versão
antiga. `flow_versions` é imutável, então nada se perde.

## Como se mexe em fluxo de produção aqui

O runbook do repositório aponta para outra máquina e não funciona nesta. O que
funciona é a Management API do Supabase com o ref literal:

```bash
set -a && . /home/gabrielbarbosa/dev/gabriel/4yu-apps/.secrets/4yu.env && set +a
# POST https://api.supabase.com/v1/projects/xxxynoshwirupkdzwxbj/database/query
# header: Authorization: Bearer $SUPABASE_ACCESS_TOKEN   body: {"query": "..."}
```

**Gravar em `flows.rascunho` e publicar é escrita em banco compartilhado com a
Verandi.** O classificador do modo automático recusa por padrão com
`Modify Shared Resources`; o Gabriel liberou nesta sessão, e essa liberação não
vale para a próxima. Peça antes de tentar.

**Publicar é a RPC, nunca um insert à mão:**

```sql
select versao, id from public.publicar_fluxo('<fluxo-id>'::uuid, '<grafo>'::jsonb);
```

Ela cria a versão com o número certo e move `versao_publicada_id` numa
transação. Insert manual em `flow_versions` pula isso e deixa fluxo publicado
apontando para lugar nenhum.

**Sempre validar antes de gravar.** Um arquivo `.mts` temporário na raiz, rodado
com `npx tsx`, usando o validador do próprio produto:

```ts
import { fluxoSchema } from './src/core/flow/schema'
import { validar } from './src/core/flow/validar'
import { validarPublicacao } from './src/core/validar-publicacao'
// fluxoSchema.safeParse(grafo)
// validar(grafo, { iaHabilitada: true, conexoes: ['a9f8ce40-...'], temContextoDeNegocio: true })
// validarPublicacao(grafo, { temEntrada: true })
```

Foi assim que apareceu `ROTULO_LONGO` num botão de 26 caracteres antes de ele
chegar no WhatsApp de alguém. A Cloud API corta em 20.

## O que a Verandi já responde, e o fluxo usa

Documentação em `verandi/docs/API.md`. O que importa aqui:

| Rota | Devolve |
|---|---|
| `GET /pessoas?telefone=` | `total`, `pessoas[0].{pessoaId,nome,telefone,ativa}`. Não achar é **200 com lista vazia**, nunca 404 |
| `GET /pessoas/:id` | `situacao`, `horariosFixos`, `proximas[]` (com `participacaoId`), `reposicoesAbertas[]`, `regraDeCancelamento` |
| `GET /disponibilidade?de=&ate=[&servico=][&experimental=1]` | `livres[]` e `cheios[]`, intervalo de até 90 dias |
| `GET /catalogo` | `servicos`, `servicosExperimentais`, `profissionais`, `funcionamento`, `vocabulario` |

`situacao` tem cinco valores e nenhum deles é "licença":
`ativa · inativa · plano vencido · plano vencendo · faltando`
([verandi/src/core/pessoas/situacao.ts](../../verandi/src/core/pessoas/situacao.ts)).
Quem está de licença e quem cancelou aparecem os dois como `ativa: false`. Por
isso nenhum texto pode supor o motivo de alguém ter parado.

**Só Pilates aparelho aceita experimental.** Conferido em
`app_verandi.servico`: dos 9 serviços ativos, é o único com
`aceita_experimental = true`. O menu de uma opção no Agendamento está **certo**,
e o Gabriel decidiu que ele continua aparecendo mesmo assim, para a pessoa
escolher. Não "otimize" isso.

## O que foi feito nesta rodada

### 1. A conversa parada volta ao bot sozinha

Migration `0090`, aplicada em produção. Registro completo em
[BANCO-COMPARTILHADO.md](BANCO-COMPARTILHADO.md) e o desenho em
[PLANO-RETOMADA-DO-BOT.md](PLANO-RETOMADA-DO-BOT.md).

Sessão em `humano` calava o bot naquele contato **para sempre**. Havia quatro
conversas presas em produção, a mais velha de dezenove dias. Hoje:
Configurações → Atendimento → "Conversa parada", com interruptor, prazo
(personalizável em minutos ou horas) e o texto que o bot diz ao voltar.
**Ligado na MGM em 2 horas**, e as quatro presas foram destravadas pela
primeira passada.

Quem varre é `src/server/passada-de-retomada-do-bot.ts`, de carona no webhook e
no cron diário. Varredura e não tarefa agendada porque são cinco portas que
levam uma sessão a `humano`, e esquecer de agendar em uma seria outro defeito
mudo.

### 2. Atendimento v10: reconhece pelo telefone

A entrada virou `reconhecer-entrada`, um `GET /pessoas?telefone={{telefone}}`
com **`aoFalhar: 'seguir'`**. Isso é deliberado: com `humano`, a Verandi fora do
ar mandaria todo "oi" da conta para uma pessoa.

Quatro caminhos:

| Quem | O que recebe |
|---|---|
| desconhecido | a saudação de sempre e o menu geral |
| ativo com reposição aberta | "Oi, {nome}! Você tem N aula(s) para repor" |
| ativo sem reposição | "Oi, {nome}! Que bom te ver por aqui" |
| inativo | saudação neutra e `menu-inativo` |

`menu-inativo`: Voltar às aulas · Meu contrato · Outro assunto · Chamar a
recepção. As duas primeiras são handoffs **com motivo diferente**, para a
recepção abrir o Inbox já sabendo o que a pessoa quer.

`ficha-do-aluno` (`GET /pessoas/:id`) roda só no ramo de quem é ativo e traz
`situacao`, a contagem de reposições e a próxima aula. **`situacao` vai só para
o `motivo` do handoff, nunca para a mensagem**: a conta manda não falar de
vencimento de plano com o aluno.

### 3. Agendamento v7: ninguém digita data

O nó `qual-dia` ("me manda a data, por exemplo 21/08/2026") **foi apagado**. O
Gabriel foi explícito: *"nunca deixando o aluno sair digitando a data que
quiser"*.

`quando` → Esta semana · Semana que vem · Mais pra frente, cada uma consultando
a disponibilidade real e devolvendo **só dias com vaga**, via `livres[].data`
com `unicos`. Período sem vaga cai em `semana-cheia`, que oferece outro período
em vez de chamar uma pessoa.

### 4. Código que nasceu disso

- **formato `dia_semana`** (`edfde33`): `2026-09-22` vira `terça 22/09`. Sem
  `Date`, fórmula de Sakamoto, porque data sem fuso vira UTC e no Brasil volta o
  dia anterior;
- **variável `daqui_30_dias`** (`78c96e3`): fecha a faixa "mais pra frente". 30 e
  não 90 porque a lista de opções é cortada em `LIMITE_LISTA` (10), então janela
  maior não mostraria mais dias.

### 5. Contexto de negócio reescrito

5.331 caracteres. O que mudou de verdade:

- **endereço corrigido**: Avenida Paulista **352**, andar 5, conjunto 55, CEP
  01310-905. Estava "3525, CEP 01310-100", que é outro lugar. A prova é o cartão
  CNPJ, em `verandi/docs/HANDOFF-18-SET-NAVEGACAO.md`;
- **valor liberado na faixa**: pode dizer "a partir de R$ 450" e a lógica de
  desconto por frequência e período. Fechar plano, percentual e forma de
  pagamento continuam com a equipe. A regra anterior proibia qualquer valor, e o
  Gabriel mudou isso nesta sessão;
- as **9 modalidades**, e a regra de que só Pilates aparelho é experimental;
- ex-aluno e aluno de licença aparecem iguais, então nunca supor o motivo.

## O que ficou aberto

**1. O R$ 450 não foi conferido por ninguém.** Veio do nó que já estava no ar e
agora está também no contexto da IA, liberado para ser dito a cliente. É o único
número desta rodada sem documento por trás. Pergunte ao Gabriel antes de
construir qualquer coisa em cima dele.

**2. Reagendamento (v6) e Não Comparecimento (v4) não foram revisados** com a
mesma lupa. Os dois já reconhecem por telefone (`inicio: 'reconhecer'`), mas
nenhum deles ganhou menu de dias, tratamento de inativo, nem revisão de texto. O
Não Comparecimento tem histórico ruim: em 21/set o rascunho dele **cancelava
criando aula** (ver `HANDOFF-21-SET-MGM-E-EXPEDIENTE.md`). Confira o que está
publicado antes de confiar no rascunho.

**3. O prazo da retomada não aparece no Inbox.** "Volta ao bot em 1h20" ao lado
do estado da conversa é o que tornaria a regra visível para quem atende. Seção
"O que ficou de fora" do `PLANO-RETOMADA-DO-BOT.md`.

**4. O campo do bloco de handoff ainda é lista fechada**, sem "Personalizar",
enquanto a tela de Configurações já tem. E há uma decisão pendente do Gabriel,
proposta e não respondida: trocar aquele dropdown por um check único
"esta conversa nunca volta ao bot sozinha", já que prazo por fluxo ninguém
pediu.

**5. `auditar-mgm.mts` está solto na raiz**, sem commit, de uma sessão anterior.
Ou vira ferramenta de verdade em `scripts/`, ou some.

## Como o Gabriel trabalha

Ele não é desenvolvedor e não quer lista de opções: quer a decisão tomada,
implementada, e a pendência em uma linha. Corta explicação longa. Link de painel
externo sempre clicável. Terminou, commita e dá push na `main` sem perguntar.
Validação por `tsc` e `build`, nunca a suíte inteira. Não usar subagente para
implementar neste projeto. Nada de travessão em arquivo nenhum.

O que **exige** perguntar mesmo assim: aplicar migration, publicar fluxo e
qualquer escrita em conversa viva. A MGM é cliente pagante.
