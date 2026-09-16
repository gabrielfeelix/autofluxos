# Handoff — o que falta das transmissões, e a distribuição de leads

16/set/2026. Continua de `cf56315`.

Leia antes: `docs/HANDOFF-15-SET-TEMPLATES.md` (as armadilhas da Meta, que
continuam valendo inteiras) e `docs/BANCO-COMPARTILHADO.md` (obrigatório antes
de qualquer migration).

---

## Onde a fase 1 parou

**Está em produção e funcionando**, migrations `0059` e `0061` aplicadas em
15/set com autorização do dono. O que existe:

| Peça | Arquivo | Estado |
|---|---|---|
| Envio de template | `channels/cloud-api.ts` | pronto |
| Criar/listar/apagar na Meta | `channels/templates-api.ts` | pronto |
| Biblioteca pré-aprovada da Meta | `channels/templates-api.ts` | pronto |
| Webhooks (modelo + mensagem) | `server/receber-status-de-template.ts` | ligado no webhook |
| Reconciliação | `server/reconciliar-templates.ts` | ligada no cron diário |
| Repositórios | `server/repos/templates.ts`, `transmissoes.ts` | pronto |
| Motor de disparo | `server/disparar-transmissao.ts` | **pronto e órfão** |
| Tela de modelos | `components/transmissoes/` | pronta, com galeria |
| Passo de sequência > 24h | `0061` + `server/sequencias-passo.ts` | pronto |

1092 testes passando. Tela em **Transmissões**, no menu lateral.

### O que NÃO existe, e é o primeiro trabalho

**Duas peças, e sem elas "transmissão em massa" não existe para o usuário:**

1. **Não há tela de criar transmissão.** `acaoCriarTransmissao` existe, está
   testada e **nenhum componente a chama**. Confira com
   `grep -rln acaoCriarTransmissao src/components src/app` — hoje devolve vazio.
2. **Ninguém chama o motor de disparo.** `dispararTransmissao` está pronto e
   testado, e nenhuma rota, cron ou webhook o aciona. Mesmo que a transmissão
   fosse criada, ficaria em `agendada` para sempre.

O caminho de **modelo** fecha inteiro; o de **disparo** não fecha.

---

## Trabalho 1: fechar a transmissão

### 1a. A tela de nova transmissão

Precisa escolher: modelo aprovado, público, e quando. A ação já existe e já
confere o teto de 24h **antes** de enfileirar — `podeTransmitir()` devolve
`recado` quando a campanha não cabe num dia, e a tela tem que mostrar isso
**antes do clique**, não depois.

Onde os valores das variáveis entram: `valoresPara()` em
`server/disparar-transmissao.ts` resolve `{nome}` a partir do contato. Os
outros campos (`{data}`, `{valor}`) vêm de `transmissoes.parametros`, que é
`{ "1": "...", "2": "..." }` — e a tela precisa perguntá-los, um por variável
do modelo. Ver `CAMPOS` em `core/modelos-prontos.ts`.

**A tela não pode pedir `{{1}}` a ninguém.** Esse foi o erro da primeira versão
da tela de modelos, e o dono reclamou com razão: é jargão de API. Use os
rótulos em português de `CAMPOS`.

### 1b. O gancho do motor

Siga o desenho de `server/enviar-agendadas.ts`, que resolveu o mesmo problema:
a Vercel no Hobby dá cron **uma vez por dia**, então o motor pega carona em
três lugares — webhook do WhatsApp, pulso do Inbox, e o cron como piso. As duas
primeiras caronas já existem no arquivo do webhook; é acrescentar a chamada.

**Cuidado com o orçamento de tempo.** `dispararTransmissao` já devolve depois de
`POR_PASSADA` (200) de propósito: a função da Vercel morre no `maxDuration`. Não
tente rodar a transmissão inteira numa chamada.

### 1c. Provar com a Meta — nada disso tocou um WhatsApp

**Nenhuma linha deste código falou com a Meta.** Tudo passou por teste, tipo e
build; nada passou por número real. Ordem de provar, do mais barato ao mais caro:

1. **Criar um modelo** pela tela e ver a Meta responder. Prova
   `componentesParaMeta()`: `example` no formato certo, componente vazio
   ausente, categoria que ela devolve.
2. **Ver o webhook chegar** — o modelo mudar de "Em análise" para "Aprovado"
   sozinho **é** o webhook funcionando.
3. **Mandar para UM número.** Separa "o payload está certo" de "o payload passa
   no teste".
4. **Só então uma lista pequena**, com o `statuses` chegando e os números da
   tela mexendo.

Vale forçar `held_for_quality_assessment` (template novo em portfólio novo é o
caso mais provável): é o único jeito de ver se a tela realmente diz "a Meta está
avaliando" em vez de "enviado".

---

## Trabalho 2: distribuição de leads

**Pedido do dono em 15/set, ainda sem uma linha de código.** A pergunta dele:
"tenho quatro vendedores, um lead entra, os quatro respondem e disputam o
cliente — como funciona?"

### O que existe hoje, e por que não resolve

- `contacts.atribuido_a` existe, e o Inbox filtra por "sem dono / de fulano";
- papéis por conta existem (`owner`, `admin`, `member`);
- **mas ninguém atribui sozinho**, e **papel não controla nada no Inbox**: todos
  veem tudo e podem responder tudo, inclusive conversa de outro.

O cenário que o dono descreveu acontece hoje, exatamente assim.

### O que o mercado faz (pesquisado em 15/set)

Quatro modelos de distribuição, e **rodízio puro é o mais fraco**:

| Modelo | Regra |
|---|---|
| Rodízio (round-robin) | ordem fixa, um para cada; ignora carga |
| Balanceado | vai para quem tem menos conversa aberta |
| **Carteira** | quem já atendeu o cliente atende de novo |
| Por região/produto | quando território ou especialidade pesam |

**A carteira ganha das outras quando há conflito**, e isso é a decisão mais
importante: só lead **novo** entra no rodízio. Sem isso, o cliente é atendido
por um estranho a cada contato.

Urgência: estudo do MIT/InsideSales — responder em **5 minutos** deixa 21×
mais provável qualificar o lead do que em 30. Distribuição manual não entrega
isso.

**Disponibilidade**: o padrão é o atendente ter estado
(`disponivel`/`pausa`/`offline`) e **teto de conversas simultâneas**. Quem está
em pausa sai do rodízio mas **continua com as conversas dele** — senão pausa
vira abandono.

**Visibilidade** (modelo do RD, configurável por usuário):

- **Restrita** — vê só o que é dele;
- **Equipe** — vê o da equipe dele;
- **Geral** — vê tudo (o gestor).

**Ver e responder são coisas diferentes.** O padrão é todos verem o histórico
(senão ninguém cobre férias), mas só o dono responder — com um botão de
"assumir" que registra quem tomou.

### As respostas às perguntas do dono

- **Um usuário só?** Tudo dele, sem rodízio. A regra só liga com dois ou mais.
- **Gestor + vendedor?** O gestor **não** entra no rodízio por padrão — ele
  acompanha, não atende. Entra se marcar que quer.
- **Quem está fora do rodízio vê os chats?** Vê, se o papel permitir, mas o
  botão de responder pede "assumir" antes. É o que impede dois vendedores
  digitando ao mesmo tempo.

### Entidades que faltam

`atribuido_a` já é o dono. Falta:

- estado do atendente: `disponivel` / `pausa` / `offline`;
- teto de conversas simultâneas, por atendente;
- flag "entra no rodízio";
- registro de quem recebeu por último, para o rodízio saber a vez;
- nível de visibilidade por usuário (restrita/equipe/geral);
- a **carteira**: dado que um contato já tem dono anterior, e por quanto tempo
  isso vale.

**Isto substitui o item "Permissionamento" listado como pendência** no
`PLANO-15-SET-ENRIQUECER.md` — é o mesmo assunto, agora com desenho.

**Antes de codar, escreva o plano.** É o tipo de coisa que, começada errada,
custa caro para desfazer: a carteira e a visibilidade mudam consulta em quase
toda tela do Inbox.

---

## O que não pode ser esquecido

### Do lado da Meta (vale inteiro, veja o handoff de 15/set)

1. **`retida` não é `aceita`.** A Meta responde 200 com
   `held_for_quality_assessment` e **descarta** a mensagem se o veredito for
   ruim (chega depois como `failed` 132015). Nunca some `retida` com "entregue"
   — nem no banco, nem no motor, nem na tela.
2. **Cinco classes de erro incompatíveis.** `condutaPara()` já resolve; não
   invente política. Duas param a transmissão inteira: template morto
   (132015/132007) e payload errado (132000/132012).
3. **131049 espera 24h de verdade**, não backoff: repetir antes **suspende o
   destinatário por mais 24h**.
4. **Ritmo começa em 20/s** — teto da coexistência, que é nosso caminho
   principal. E não é meta a perseguir: throughput conta entrada e saída na
   mesma cota, então disparar no máximo derruba o atendimento que está
   acontecendo agora.
5. **`rejection_info` é ouro.** Guardar inteiro e mostrar literal: é a diferença
   entre "recusado" e "recusado porque falta exemplo na variável 2".

### Do lado do banco

- **Produção compartilhada com a Verandi.** `db push` e `db reset` são
  **proibidos**; aplica-se pela Management API.
- **Descubra a próxima migration pelo disco** (`ls supabase/migrations/ | tail -1`),
  nunca por documento — inclusive este.
- **Replay em Docker não é opcional** quando a migration mexe em tabela com
  dado. Em 15/set ele pegou duas bombas na `0059` que aplicariam sem erro: um
  `check` com `{1,512}` (o Postgres recusa repetição acima de **255**, e o erro
  só aparece no primeiro `insert`) e quatro tabelas nascendo **sem RLS**.
- **Não aplique nada sem autorização explícita do dono.**

### Do lado da tela

O dono foi direto sobre isso em 15/set, e vale para tudo o que vier:

- **Texto de cabeçalho: uma linha.** Não três parágrafos explicando antes de a
  pessoa ter feito nada.
- **Nada de jargão de API na tela.** `{{1}}` foi removido justamente por isso.
- **Campo que some sem explicar é pior que campo desabilitado.** O botão
  "+ Campanha" sumia quando não havia fluxo, e a tela ficava sem saída nenhuma.
- **Use os componentes da casa**: `app-field px-[13px] py-[11px] text-[13.5px]`,
  e `Dropdown` em vez de `<select>` nativo.

---

## Chats em paralelo

Em 16/set havia outro chat mexendo em `components/design/cliente-shell.tsx`,
extraindo o menu para `secoes-do-cliente.tsx`. **Rode `git fetch` e confira
`git status` antes de começar** — o `main` local fica para trás rápido.

---

## Comandos

```bash
npx vitest run src/core src/channels          # os puros, sem banco
npx tsc --noEmit | grep -v "^\.next/"
npx next build
ls supabase/migrations/ | tail -1             # a próxima migration
```

Deploy **não é automático no push**: o CI só confere. Publique com
`npx vercel --prod --token "$VERCEL_TOKEN" --yes`, com o `.env` do
`4yu-apps/.secrets/` carregado.
