# Plano — Configurações, Canais e Integrações

Resposta ao `docs/HANDOFF-CONFIGURACOES.md`. A decisão está tomada e
justificada; não há lista de opções para o dono escolher.

Tudo que este documento afirma sobre o código foi conferido no repositório em
15/set/2026, e o que foi conferido está dito com arquivo e linha.

---

## 1. As seis perguntas, respondidas

### 1.1 Integrações é seção de Configurações — não item de primeiro nível

**Decisão: seção dentro de Configurações.**

O primeiro nível da barra lateral é trabalho diário: Inbox, Contatos, Quadros,
Automações. Integração é trabalho de uma vez só — liga o WhatsApp, liga a conta
de anúncios, e não se volta lá por semanas. Item de menu permanente para tarefa
episódica gasta a única coisa que a barra lateral tem de escasso, que é a
posição fixa na tela de quem usa o produto oito horas por dia.

É também o que o mercado faz quando o número de integrações é pequeno: o
Intercom põe *Channels* e *Integrations* dentro de Settings, o HubSpot põe
*Integrations → Connected apps* e *Inbox & Help Desk → Inboxes* dentro de
Settings, e o Chatwoot põe *Inboxes*, *Integrations* e *Applications* dentro de
Settings. Quem promove Integrações a primeiro nível é marketplace com centenas
de apps (Slack, Shopify), onde a integração é produto. Aqui são quatro coisas.

**Isto contraria o `docs/PLANO-SISTEMA.md` §2.1**, que lista Integrações como
o sétimo item da barra lateral, de Etapa B — e o comentário no topo de
`src/components/design/cliente-shell.tsx:20-25` repete essa expectativa. A
contradição é deliberada: aquele desenho é anterior à existência das quatro
telas de conexão, e hoje dá para ver que elas somam uma seção, não uma área.
O comentário do `cliente-shell.tsx` é corrigido junto com esta mudança.

### 1.2 Onde termina Canal e começa Integração

**Canal é por onde a conversa entra e sai. Integração é todo o resto com que o
sistema fala.**

O teste é objetivo e não depende de opinião: *aquilo produz uma conversa no
Inbox?* Se produz, é Canal. Se não produz, é Integração.

| Hoje | Vira | Porque |
|---|---|---|
| Número do WhatsApp | **Canal** | é o Inbox |
| Instagram direct | **Canal** | é o Inbox |
| Anúncios (Meta Ads + páginas) | **Integração** | traz *lead*, não conversa |
| Credenciais (chaves de terceiros) | **Integração** | é o fluxo falando com o sistema do cliente |

Essa é a mesma linha que o Intercom traça entre *Channels* e *Integrations*, e
que o HubSpot traça entre *Inboxes* e *Connected apps*. Ela importa aqui mais
do que lá, porque canal caído neste produto significa cliente sem atendimento,
enquanto integração caída significa automação incompleta. São urgências
diferentes e não devem morar na mesma lista.

A distinção que o handoff chamou de "metade do trabalho" — chave de API do
cliente não é a 4YU falando com uma plataforma — resolve-se pelo mesmo teste:
não produz conversa, então é Integração. Mas ganha nome próprio (§2.2), porque
misturá-la com "ligar o Instagram" foi exatamente o que criou o problema.

### 1.3 O ciclo de vida de uma conexão

Cinco estados, os mesmos para canal e para integração, e a tela precisa saber
dizer em qual está:

```
não ligado → ligando → ligado → precisa reconectar → desligado
```

- **não ligado**: nunca foi conectado. A tela mostra o botão de conectar e nada
  mais.
- **ligado**: mostra *o que* está ligado (número, @ da conta, nome da página) e
  *desde quando*.
- **precisa reconectar**: token expirado, permissão revogada, número derrubado
  pela Meta. É o estado que hoje não existe, e é o que gera chamado.
- **desligado**: a pessoa desligou. Precisa dizer, na hora de desligar, o que
  acontece com o que já entrou — e a resposta neste produto é: **as conversas e
  os contatos ficam**; o que para é o recebimento. Isso não pode ser adivinhado
  na hora do clique.

### 1.4 Como se mostra que uma conexão quebrou

**Nos dois lugares, com papéis diferentes.**

- Na Integração/Canal: o estado completo e o botão de reconectar.
- No Inbox: uma faixa, e só para **canal**. Integração quebrada não interrompe
  atendimento; canal quebrado interrompe, e quem está no Inbox é quem percebe
  primeiro que "ninguém mandou mensagem hoje".

Hoje não há de onde tirar esse estado: não existe coluna de saúde em
`channels` — a tabela onde moram tanto o número do WhatsApp quanto a conta do
Instagram — e os repositórios só sabem se a linha existe
(`src/server/repos/conversas.ts:987`, `src/server/repos/canais-instagram.ts:41`).
Por isso a saúde de verdade é Etapa 3 deste plano e **exige migration** — a
única parte que exige.

### 1.5 Conta, espaço de trabalho e canal

O produto já tem os três níveis, e eles já estão certos:

- **Plataforma** (`/admin/*`): a 4YU olhando todas as contas.
- **Conta do cliente** (`/clientes/[clienteId]`): o espaço de trabalho. Equipe,
  canais e configuração vivem aqui.
- **Canal**: dentro da conta.

Não há nada a mudar de estrutura. O que falta é a configuração **pessoal** (a
do usuário que está logado, não a da conta) — que hoje não tem tela e sai pelo
menu do rodapé da barra lateral. Fica registrado como dívida, fora deste plano.

### 1.6 Quantos níveis a navegação aguenta

**Uma coluna, com cabeçalho de grupo. Não duas colunas.**

Dez linhas planas é o tamanho em que a lista deixa de ser lida e passa a ser
varrida. Grupo com cabeçalho resolve isso sem custo nenhum de navegação: a
página continua sendo **uma**, e continua mostrando o estado de cada linha —
que é a coisa boa do índice de hoje e que este plano preserva
(`src/app/clientes/[clienteId]/ajustes/page.tsx:19-25`).

Duas colunas com menu à esquerda é o padrão do Intercom e do HubSpot, e é caro
pelo motivo certo: só compensa acima de uns 25 destinos, quando o índice de uma
página vira rolagem. Com quatro grupos e onze linhas, a segunda coluna seria
moldura ocupando espaço sem responder nada.

---

## 2. O mapa novo, rota por rota

### 2.1 Tudo de Configurações passa a morar sob `/ajustes/`

Hoje seis das dez telas de configuração estão na raiz da conta (`/contexto`,
`/anuncios`, `/conexoes`, `/acervo`, `/numero`, `/instagram`) e quatro estão sob
`/ajustes/`. Não há regra: é histórico. O endereço passa a dizer onde a pessoa
está, o que importa porque **o dono manda print com a URL na barra**.

| Hoje | Vira | Título da tela |
|---|---|---|
| `/numero` | `/ajustes/whatsapp` | WhatsApp |
| `/instagram` | `/ajustes/instagram` | Instagram |
| `/contexto` | `/ajustes/contexto` | Contexto do negócio |
| `/ajustes/horario` | *fica* | Horário de atendimento |
| `/ajustes/respostas-rapidas` | *fica* | Respostas rápidas |
| `/ajustes/etiquetas` | *fica* | Etiquetas |
| `/acervo` | `/ajustes/acervo` | Acervo |
| `/anuncios` | `/ajustes/anuncios` | Anúncios |
| `/conexoes` | `/ajustes/chaves` | **Chaves de API** |
| `/ajustes/equipe` | *fica* | Equipe |

**Nada some.** Nenhuma tela é apagada e nenhuma funcionalidade é retirada.

Sem segmento intermediário (`/ajustes/canais/whatsapp`) de propósito: o grupo é
visual, no índice. Pôr o grupo na URL obrigaria a mexer nela de novo toda vez
que um item trocasse de grupo, e URL que muda duas vezes é pior do que URL
imperfeita.

### 2.2 O que cada nome passa a significar

- **Chaves de API** (era "Credenciais", na rota `/conexoes`). A rota e o título
  discordavam — `conexoes/page.tsx:87` renderiza `<h1>Credenciais</h1>` — e o
  pior dos dois era a rota: "conexão" é a palavra que o mercado usa para
  *conectar canal*, que é justamente a outra coisa. O nome novo diz o que a
  tela guarda: chave que os blocos de Serviços externos usam para falar com o
  sistema **do cliente**. Quem nunca viu uma chave de API não vai lá por
  engano, e é isso que se quer.
- **WhatsApp** (era "Número do WhatsApp", na rota `/numero`). A tela não é só o
  número: é o canal inteiro — qual número atende, que fluxo ele executa, e o
  endereço do painel da Meta. "Número" descreve um campo, não a tela.
- **Canais** (grupo novo): WhatsApp e Instagram.
- **Integrações** (grupo novo): Anúncios e Chaves de API.
- **Atendimento** (grupo novo): Contexto do negócio, Horário, Respostas
  rápidas, Etiquetas, Acervo. É como o atendimento funciona.
- **Conta** (grupo novo): Equipe — e, quando a frente da homepage liberar, os
  dados do negócio (§4).

A palavra "conexões" sai da interface e das rotas. **Continua no código e no
banco** (`listarConexoes`, tabela `connections`, `src/server/repos/conexoes.ts`)
— ver §3.

### 2.3 A ordem dos grupos

Canais → Atendimento → Integrações → Conta.

É a ordem em que uma conta nova precisa das coisas: sem canal não existe
produto; o atendimento é o que se ajusta toda semana; integração é episódica;
Conta é administração. "Apagar o cliente" continua isolado no fim, longe de
tudo, pelo motivo que o comentário de lá já explica.

---

## 3. O que é renomeação de tela e o que exige banco

**Nada nas Etapas 1 e 2 toca o banco.** São arquivos movidos, textos trocados e
redirecionamentos. Nenhuma migration, nenhuma coluna, nenhum dado.

O nome `conexoes` permanece no banco (tabela `connections`) e nos repositórios.
Renomear tabela em produção compartilhada com a Verandi
(`docs/BANCO-COMPARTILHADO.md`) para arrumar uma palavra que só aparecia na
barra de endereço é risco sem retorno. A regra que fica escrita: **o nome do
banco é interno, o nome da tela é público, e eles têm o direito de divergir** —
desde que o comentário do repositório diga que divergem, o que passa a dizer.

**A Etapa 3 exige migration** (estado de saúde da conexão), e ela não será
escrita nem aplicada sem autorização explícita do dono, com o número
descoberto por `ls supabase/migrations | tail -1` na hora.

---

## 4. Configuração que está fora de Configurações

`FichaDoCliente` (`src/components/cliente/ficha.tsx`) — cadastro e logo do
cliente — mora no Painel (`src/app/clientes/[clienteId]/page.tsx`).

**Decisão: é configuração de conta e o lugar dela é Configurações → Conta, como
"Dados do negócio".** Nome, logo e dados cadastrais não são coisa que se olha
todo dia; ocupam o topo da primeira tela, que é o espaço mais caro do produto.

**Não é implementado agora**: o mesmo componente é o assunto da frente da
homepage (`docs/HANDOFF-HOMEPAGE.md`), e duas frentes editando o mesmo arquivo
é conflito garantido. Entra quando aquela frente fechar, ou quando o dono
disser qual das duas passa primeiro.

---

## 5. Redirecionamentos

Toda rota que muda de endereço continua respondendo. São seis, em
`next.config.ts`, com `permanent: true`:

```
/clientes/:clienteId/numero      → /clientes/:clienteId/ajustes/whatsapp
/clientes/:clienteId/instagram   → /clientes/:clienteId/ajustes/instagram
/clientes/:clienteId/contexto    → /clientes/:clienteId/ajustes/contexto
/clientes/:clienteId/acervo      → /clientes/:clienteId/ajustes/acervo
/clientes/:clienteId/anuncios    → /clientes/:clienteId/ajustes/anuncios
/clientes/:clienteId/conexoes    → /clientes/:clienteId/ajustes/chaves
```

`permanent: true` (308) e não 307 porque o endereço antigo não volta — e 308
preserva o método, o que importa porque essas telas recebem `POST` de Server
Action.

**O que precisa mudar junto, e falha calado se não mudar:** os retornos de
OAuth da Meta redirecionam para essas rotas por string
(`src/app/api/whatsapp/retorno/route.ts:68`,
`src/app/api/instagram/retorno/route.ts:34`,
`src/app/api/anuncios/retorno/route.ts:30`,
`src/server/acoes-whatsapp.ts:21`, `src/server/acoes-instagram.ts:24`), e os
`revalidatePath` de `src/server/acoes.ts`, `acoes-lead-ads.ts` e
`acoes-instagram.ts` apontam para o caminho antigo. `revalidatePath` com
caminho que não existe mais **não dá erro**: só deixa de invalidar, e a tela
mostra dado velho depois de salvar. É o tipo de defeito que só aparece em
produção, e por isso está listado aqui em vez de confiado à memória.

---

## 6. As etapas, na ordem em que vão ao ar

Deploys pequenos, porque o dono acompanha em produção por print.

**Etapa 1 — o índice agrupado e as rotas arrumadas.** Move as seis telas,
renomeia duas, agrupa o índice em quatro cabeçalhos, escreve os seis
redirecionamentos, corrige os `revalidatePath` e os retornos de OAuth, e
atualiza o comentário do `cliente-shell.tsx`. Sem banco.

**Etapa 2 — a tela de Integrações como resposta única.** `/ajustes/integracoes`
passa a responder "o que está ligado nesta conta" numa página só, listando
WhatsApp, Instagram, Anúncios e Chaves com o estado de cada um e o caminho para
a tela de detalhe. O índice de Configurações passa a ter uma linha por grupo em
vez de quatro linhas de conexão. Sem banco.

**Etapa 3 — saúde de verdade.** Coluna de estado em `channels`, gravada quando a Meta devolve 401/permissão revogada, e a
faixa no Inbox quando o canal está caído. **Exige migration e autorização.**

**Etapa 4 — Dados do negócio saem do Painel.** Depende da frente da homepage
(§4).
