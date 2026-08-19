# Handoff — 18/ago/2026

Para quem pegar este projeto agora, humano ou agente. Leia isto inteiro, depois
[PLANO-SISTEMA.md](PLANO-SISTEMA.md), e só então código. As decisões de produto
que não estão aqui estão lá; as que estão aqui não se renegociam sem o dono.

---

## 1. O resumo em dez linhas

O AutoFluxos é automação de atendimento no WhatsApp: fluxo desenhado num editor
visual, motor puro que executa, e handoff para uma pessoa quando o bot não dá
conta. Está em produção em `autofluxos.4yu.com.br` (Vercel), com Supabase
**compartilhado com outro produto** (Verandi).

A Etapa A do [PLANO-SISTEMA.md](PLANO-SISTEMA.md) vai de A1 a A7. **A1 a A5
estão no ar.** Faltam A6 e A7, e as duas esbarram em coisas que só o dono
resolve — ver [PENDENCIAS-DO-DONO.md](PENDENCIAS-DO-DONO.md).

`npm test` → **488 passando, 8 pulados** (os 8 dependem de `IA_TESTE_REAL` e
`API_TESTE_REAL`, por desenho). `typecheck`, `lint` e `build` limpos.
**Migrations aplicadas: até a `0022`. A próxima a escrever é a `0024`** — a
`0023` existe, está escrita e **não foi aplicada**.

---

## 2. O que existe hoje, rota a rota

### Portas de entrada

| Rota | O que é | Quem alcança |
|---|---|---|
| `/login` | senha única do time (`PAINEL_SENHA`), a porta principal hoje | todo mundo |
| `/entrar` | login por usuário (Better Auth) | todo mundo |
| `/criar-conta` | primeira execução **e** cadastro feito por administrador | senha única ou administrador |
| `/api/auth/[...all]` | a porta do Better Auth | todo mundo |

### Painel do operador 4YU

| Rota | O que é |
|---|---|
| `/` | lista de todos os clientes, ordenada por quem espera atendimento |
| `/contas` | seletor de companhia de quem tem mais de uma |
| `/admin/contas` | contas e quem entra em cada uma; ligar pessoa a conta |
| `/admin/usuarios` | quem existe, papel, sessões, **entrar como**, suspender |
| `/admin/auditoria` | o registro append-only |

### Painel do cliente

Barra lateral com cinco itens — **Painel · Inbox · Contatos · Automações ·
Configurações**. Não há mais abas no topo.

| Rota | Item da barra | O que é |
|---|---|---|
| `/clientes/[id]` | Painel | está sendo atendido agora? funil do mês, ficha do cliente |
| `/clientes/[id]/inbox` | Inbox | fila paginada, rail `Atribuído`, busca, conversa, resposta, painel do contato |
| `/clientes/[id]/leads` | Contatos | lista com filtro, busca, paginação e CSV |
| `/clientes/[id]/leads/[contatoId]` | Contatos | ficha do contato |
| `/clientes/[id]/leads/importar` | Contatos | importação por planilha, com conciliação |
| `/clientes/[id]/fluxos` | Automações | lista de fluxos |
| `/clientes/[id]/fluxos/[fluxoId]` | — | **o editor**, tela cheia, sem a moldura |
| `/clientes/[id]/ajustes` | Configurações | índice, com o estado de cada peça |
| `/clientes/[id]/ajustes/horario` | Configurações | horário de atendimento |
| `/clientes/[id]/ajustes/respostas-rapidas` | Configurações | respostas prontas do Inbox |
| `/clientes/[id]/contexto` | Configurações | contexto do negócio (o escopo da IA) |
| `/clientes/[id]/numero` | Configurações | números do WhatsApp e qual fluxo cada um executa |
| `/clientes/[id]/conexoes` | Configurações | credenciais dos blocos de API |
| `/clientes/[id]/acervo` | Configurações | arquivos que os fluxos enviam |

### Rotas de serviço

| Rota | Quem chama | Como se protege |
|---|---|---|
| `/api/webhook/whatsapp` | a Meta | assinatura `META_APP_SECRET` |
| `/api/manutencao/retencao` | cron da Vercel | `CRON_SECRET`, falha fechada sem ele |
| `/api/simular` | o editor | sessão + dono do `fluxoId` |
| `/api/clientes/[id]/inbox/alertas` | polling do painel | sessão + membro da conta |
| `/api/clientes/[id]/leads/csv` | botão de exportar | sessão + membro da conta |

---

## 3. O que cada frente da Etapa A entregou

### A1 — login, contas e papéis

- **Better Auth 1.7** em `src/server/auth.ts`, com os plugins `admin`
  (impersonação) e `organization` (contas e membros).
- **`clients` É a organização.** Não existe tabela `organization`: o plugin
  aponta para `clients` via `modelName`, porque toda chave estrangeira do
  sistema já aponta para lá.
- **`src/server/sessao.ts` é a fronteira de autorização.** Toda tela, rota de
  API e Server Action passa por `exigirUsuario`, `exigirAdminDaPlataforma`,
  `exigirAcessoAoCliente` ou `conferirAcessoAoCliente`.
- **"Entrar como"**: sessão de uma hora marcada com `impersonatedBy`,
  registrada na auditoria, com faixa âmbar em toda tela que ela alcança —
  inclusive o editor, que não usa moldura e a chama explicitamente.
- **Auditoria append-only** (`af_auditoria`): `service_role` só tem `insert` e
  `select`.

### A2 — sidebar e as duas visões

A moldura do cliente virou barra lateral; a área do administrador ganhou
`layout.tsx` próprio, onde `exigirAdminDaPlataforma()` roda uma vez e toda rota
abaixo herda a conferência.

**Os itens da barra são os que têm tela.** Campanhas e Integrações estão no
desenho da §2.1 do plano e são Etapa B: item de menu para tela que não existe é
promessa que a interface faz e o produto não cumpre.

### A3 — bloco de mensagem em pilha

O bloco era `data: { texto }` e virou uma pilha de até dez pedaços: **texto**
(com `*negrito*`, `_itálico_`, `~riscado~`, crases e emoji), **arquivo**,
**atraso**, **guardar** e **desligar o bot** (AutoOff).

**A regra que não pode ser quebrada: ler os dois formatos, escrever um só.**
`src/core/flow/mensagem.ts` é o único lugar que conhece o formato antigo. Ver
§4.3.

Ficou de fora a janela de 24h dentro do bloco (`Dentro de` / `Fora de`): ela só
faz sentido com modelo aprovado pela Meta, que é trava externa.

### A4 — a cadeia de atendimento

- **Horário de atendimento** por conta (`core/horario.ts`, puro e sem rede),
  com fuso IANA e mais de uma faixa por dia. Fora do expediente o handoff diz
  que está fechado e **quando volta**, em vez de prometer um atendente.
- **Assumir / liberar / passar** a conversa. A responsabilidade mora no
  **contato** (`contacts.atribuido_a`).
- **Presença** (`af_usuarios.presenca`), no rodapé da barra lateral.
- **Relógio da janela de 24h** na fila, só em quem espera uma pessoa.
- **O aviso de fila toca em qualquer tela do painel**, não só com o Inbox
  aberto.

### A5 — Inbox de verdade

Fila paginada de 50 (era tudo), rail `Atribuído` horizontal com contagem, busca
por nome e telefone, e anotação da equipe no painel lateral do contato.

---

## 4. As sete regras que não se negociam

### 4.1 O banco é compartilhado com outro produto

AutoFluxos vive em `public`; a **Verandi** vive em `app_verandi`, no **mesmo
projeto Supabase**. `auth.users`, Storage, extensões, Data API, cotas e backup
são **globais**. Leia [BANCO-COMPARTILHADO.md](BANCO-COMPARTILHADO.md) inteiro
antes de qualquer migration. **Nunca** rode `supabase db push` ou `db reset`.

**Nada é aplicado em produção sem autorização explícita do dono**, uma
migration por vez, pela Management API:

```bash
set -a && . /home/gabfelix/dev/4yu-apps/.secrets/4yu.env && set +a
Q=$(python3 -c "import json;print(json.dumps({'query':open('supabase/migrations/00XX_nome.sql').read()}))")
curl -s -X POST "https://api.supabase.com/v1/projects/$AUTOFLUXOS_SUPABASE_PROJECT_REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" -d "$Q"
```

Depois de aplicar, **confira as duas coisas**: que as colunas existem, e que
`app_verandi` continua com o mesmo número de tabelas.

### 4.2 A view `leads` só aceita coluna nova **no fim**

`create or replace view` não reordena nem remove: recusa qualquer outra
diferença com `cannot change name of view column`. A ordem verdadeira é a da
última migration que mexeu nela — hoje a `0022`, e a `0023` (escrita) já segue
essa ordem.

### 4.3 Versão publicada é imutável, inclusive para nós

`flow_versions` guarda o grafo e a sessão fica presa à versão em que começou.
Uma conversa aberta às 14h continua rodando o grafo de 14h. Se um schema deixar
de dar parse no que foi publicado antes, **toda conversa em andamento morre no
meio**, e não há como saber quantas são.

O caminho é sempre **ler os dois formatos e normalizar na leitura**. Nenhuma
migration reescreve `flow_versions.grafo`. Três testes prendem isso hoje:
`core/flow/mensagem.test.ts`, o `describe('o bloco de mensagem em pilha')` em
`core/engine/executar.test.ts`, e o teste do webhook que publica a abertura no
formato antigo.

### 4.4 Quem autoriza é `server/sessao.ts`, não o `proxy.ts`

O proxy decide se a requisição **segue**; a conferência do login por usuário lá
é só de **presença do cookie** — não vai ao banco e não decide nada sozinha.

Não é preguiça: a documentação do Next avisa que Server Action é um POST na
rota onde ela é usada, e um refactor que a mova de rota a tira do matcher sem
ninguém perceber. **`src/server/acoes.test.ts` lê o texto de `acoes.ts` e
recusa ação nova que esqueça a conferência.** Trinta e três ações — trinta e
uma com `clienteId`, que chamam `exigirAcessoAoCliente`, e duas que criam
cliente, que chamam `exigirOperadorDa4YU` — é exatamente onde a trigésima
quarta fica de fora.

### 4.5 A sessão de usuário tem precedência sobre a senha única

Quem entra como pessoa vê o que aquela pessoa vê. O administrador da 4YU
continua alcançando qualquer conta **enquanto a senha única existir** — é a
linha em `exigirAcessoAoCliente` que estreita para "só impersonando" no dia em
que ela sair. Quem não pode recebe **404**, e não 403.

### 4.6 `auth.ts` exporta função, não constante

`autenticacao()` constrói a instância na primeira chamada. Voltar a
`export const auth = betterAuth(...)` **derruba o CI**: o pool estoura sem
`DATABASE_URL`, e o `npm run build` do CI roda sem variável de banco nenhuma, de
propósito — este repositório é público e não guarda segredo. O mesmo vale para a
rota `[...all]`, que chama `autenticacao()` dentro de cada método em vez de usar
`toNextJsHandler`.

E `nextCookies()` tem que ser o **último** plugin: sem ele, `signInEmail` numa
Server Action autentica e não deixa sessão no navegador.

### 4.7 A auditoria não pode ser editada pela aplicação

`service_role` tem só `insert` e `select` em `af_auditoria`. Não escreva função
de apagar; não existe permissão.

---

## 5. O banco, tabela a tabela

| Tabela | O que é |
|---|---|
| `clients` | a conta. Ganhou `slug` (único, com gatilho), `metadata` e `horario_atendimento` |
| `flows`, `flow_versions` | o desenho e as versões publicadas (imutáveis por gatilho) |
| `channels` | número do WhatsApp × fluxo |
| `contacts` | quem conversa. Ganhou `atribuido_a` |
| `sessions`, `messages`, `handoffs` | o estado de execução e o histórico |
| `connections` | credenciais dos blocos de API |
| `af_usuarios` | usuários (Better Auth), com `presenca`. **Não** é `auth.users` |
| `af_sessoes` | sessões, com `impersonatedBy` e `activeOrganizationId` |
| `af_contas` | credenciais — guarda **hash** de senha |
| `af_verificacoes` | tokens de verificação |
| `af_membros` | usuário × conta × papel (`owner`/`admin`/`member`) |
| `af_convites` | a tabela existe; o convite não, porque depende de SMTP |
| `af_auditoria` | quem fez o quê. Append-only |
| view `leads` | contato + última mensagem + handoff aberto + `ultima_entrada_em` + `atribuido_a` |
| view `metricas_sessoes`, `resumo_clientes` | agregações do painel |

**As tabelas do login ficam fora da Data API de propósito** (`revoke all` para
`anon` e `authenticated` na 0019): `af_contas` guarda hash de senha e
`af_sessoes` guarda token. Por isso `src/server/repos/usuarios.ts` e
`src/server/sessao.ts` falam Postgres direto pelo pool do Better Auth
(`bancoDoLogin()`), e são a exceção da casa — todo o resto usa `supabase-js`.

---

## 6. Ambiente

| Variável | `.env` | Vercel | Observação |
|---|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | ✅ | ✅ | |
| `META_APP_SECRET`, `WHATSAPP_TOKEN`, `WHATSAPP_VERIFY_TOKEN` | ✅ | ✅ | |
| `GEMINI_API_KEY` | ✅ | ✅ | entrou em 17/ago — antes disso o bloco de IA nunca funcionou em produção |
| `PAINEL_SENHA` | ✅ | ✅ | senha única. **Sem ela em produção, o login por usuário vira a única porta** |
| `PAINEL_SEGREDO` | ✅ | ✅ | trocar encerra todas as sessões do painel |
| `CRON_SECRET` | ✅ | ✅ | sem ela a retenção responde 503 |
| `DATABASE_URL` | ✅ | ✅ | pooler **6543**, não 5432 |
| `BETTER_AUTH_SECRET` | ✅ | ✅ | |
| `BETTER_AUTH_URL` | ❌ | ❌ | opcional; preenchida errado quebra o login |
| `ALERTA_WEBHOOK_URL` | ❌ | ❌ | **falta**. Sem ela `alertar()` é no-op |

Valores em `4yu-apps/.secrets/4yu.env`, prefixo `AUTOFLUXOS_`. **Nunca** copie
segredo para dentro do repo — ele é público.

Conexão direta: `postgresql://postgres.<ref>:<senha>@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`.
Porta **6543** (transaction pooler). Em modo transação o Supavisor **não
suporta prepared statements**.

---

## 7. O que falta, em ordem

### 7.1 A6 — fluxos padrão e gatilhos · **precisa de migration**

O que o plano pede (§3.7 e §3.8):

- **Os quatro fluxos padrão** por número: boas-vindas, resposta padrão, fluxo
  para **mídia recebida**, pós-atendimento. Hoje é um número → um fluxo
  (`channels.flow_id`).
- **Gatilhos por palavra-chave**: frase → fluxo, com operador (`é`, `contém`),
  contagem de execuções e liga/desliga. Hoje só existem as palavras de escape
  fixas no motor (`PALAVRAS_ESCAPE` em `core/engine/executar.ts`).

**É esta frente que destrava a última pendência da A4**: hoje mídia recebida
vira handoff sempre (`Regra B`, em `executar.ts`), e o plano diz que isso
deixou de fazer sentido quando existe um fluxo padrão para mídia — o cliente
deve poder dizer o que fazer com um áudio em vez de acordar alguém.

Sugestão de forma, para quem for escrever: colunas de fluxo padrão em
`channels` (uma por papel) e uma tabela `gatilhos(conta, frase, operador,
fluxo, ativo, execucoes)`. O casamento da frase acontece **antes** do fluxo
padrão, na entrada do webhook.

### 7.2 A7 — configurações reunidas · **parcialmente feito**

A maior parte já existe e está ligada no índice de `/ajustes` (perfil do
negócio na tela do Painel, número, horário, respostas rápidas, acervo, contexto
da IA, credenciais). Falta:

- **Etiquetas manuais** — precisa de migration (`etiquetas` +
  `contato_etiquetas`). As derivadas continuam derivadas; **não** viram linha.
- **Equipe** — a tela existiria para listar membros e convidar. Sem convite por
  e-mail (SMTP) ela seria uma lista vazia com um botão que não funciona.

### 7.3 Depois da Etapa A

**Etapa B**: agendador (destrava sequências e timeout de pergunta), contatos
completo (etiquetas, rail de filtros, criar à mão, ações em lote), painel
completo (série diária, desempenho pessoal, métricas de tempo), campanhas,
pastas e compartilhamento de fluxo, integrações com preset (RD Station
primeiro).

**Etapa C**: Quadros (Kanban), central de notificações, casca (idioma, ajuda),
modelos da Meta e Transmissão (**trava externa**), faturamento e registros.

Ordem e critério em [PLANO-SISTEMA.md §5](PLANO-SISTEMA.md).

### 7.4 O que espera o dono

Dez itens em [PENDENCIAS-DO-DONO.md](PENDENCIAS-DO-DONO.md). Os três que mais
travam:

1. **Criar o primeiro administrador.** Não existe **nenhum** usuário em
   produção; todo o login está de pé e dormindo.
2. **Autorizar a migration `0023`** (não lidas + tipo da mídia na prévia).
3. **`ALERTA_WEBHOOK_URL`**, sem a qual falha de entrega não avisa ninguém.

---

## 8. Como trabalhar aqui

### O ciclo

```bash
npm test          # 488 passando, 8 pulados
npm run typecheck
npm run lint
npm run build     # roda também sem DATABASE_URL, e tem que continuar rodando
```

Commit por etapa validada, push, e a Vercel faz o deploy sozinha do `main`.
Conferir o deploy pela API (`VERCEL_TOKEN` no cofre) e **provar em produção**,
não só no build.

### Testes

Boa parte da suíte fala com o **Supabase de produção**. Eles limpam o que
criam com prefixo `zz-`; execução que quebra no meio deixa lixo. `af_auditoria`
é a exceção — append-only, então `auditoria.test.ts` deixa linhas de
`gente@exemplo.test` lá para sempre, e `/admin/auditoria` já nasce com elas.

**Cerca de 1 execução em 8 falha um teste, sem padrão identificado.** Não é o
teto de 5s (subiu para 30s), não é colisão de telefone (o sorteio é por
execução), e os testes de retenção passam `clienteId`. Rodar de novo passa.
Está escrito para não virar de novo "roda de novo que passa" sem ninguém olhar.

### Armadilhas que já custaram caro

- **Interpolar dentro de estrutura sem escapar.** O que a pessoa digita no
  WhatsApp entra em URL, corpo JSON e cabeçalho. Use `core/engine/interpolar.ts`.
- **Exceção solta no `after()` do webhook.** A mensagem já foi deduplicada; se
  a sessão não for salva, a pessoa fica sem resposta e a Meta não reenvia.
- **Identidade vinda do corpo da requisição.** Desenho pode vir de fora;
  identidade sai do banco. Foi o furo do `/api/simular`, corrigido.
- **Tela de autorização que o Next prerenderiza.** `/admin/page.tsx` só
  redireciona, e sem `force-dynamic` o Next resolvia no build: a moldura rodava
  sem sessão, e o que ficava gravado era um redirecionamento para a raiz.
- **Altura calculada em `calc(100vh - N)`.** Erra em silêncio quando o
  cabeçalho muda: a lista some por baixo e nada quebra para avisar. Use flex.
- **Estado vazio que responde pela pergunta errada.** "Nenhuma conversa" depois
  de uma busca sem resultado mente e ainda some com o campo de busca.
- **Duas funções que discordam sobre a mesma regra.** `proximaAbertura`
  anunciava faixa que `atendimentoAberto` nunca honraria.
- **Duas coisas com o mesmo sintoma escondem uma à outra.** "Falha que some ao
  rodar de novo" foi atribuída ao relógio do WSL2 por semanas — era o teto de
  5s do Vitest **e** telefone de teste derivado de `Date.now()`.

### O `.npmrc` com `legacy-peer-deps` é obrigatório

`better-auth` declara `@sveltejs/kit` como peer opcional e o npm arrasta a
cadeia do Svelte, que exige `vite@8` contra o `vite@7` do Vitest. Sem o
`.npmrc`, **o build quebra no deploy**.

### O CLI do Better Auth mente

`@better-auth/cli` é publicado à parte e fica para trás do runtime. Use
`node scripts/schema-do-auth.mjs`, que lê o runtime instalado.

---

## 9. O que o dono decidiu, e que não se renegocia sem ele

1. **A conta é do cliente e ele faz tudo nela** — cria, edita, publica, apaga.
   Nós somos administradores de contas, não donos dos fluxos.
2. **Sidebar à esquerda, não abas no topo.** Foi explícito e enfático.
3. **Etapa A só com o obrigatório.** Cada tela nova é superfície, e superfície
   custa manutenção para sempre. Vale para item de menu também: a barra só
   lista o que tem tela.
4. **Nada de conectar número por QR.** Perder o número do cliente é o pior
   fracasso possível para uma agência. Só Cloud API oficial.
5. **Nada de iPaaS embutido.** Integração é preset de bloco `http`, com
   RD Station primeiro.
6. **Mandar o cliente usar n8n/Zapier/Make não é resposta aceitável.** Faltou
   peça? Constrói a peça.
7. **Não temos dado de dinheiro.** Inventar por multiplicação vira mentira no
   relatório do cliente; o caminho honesto é ler valor fechado do CRM na
   Etapa B.
