# Segurança — auditoria OWASP Top 10, com evidência

Escrita em **06/set/2026**, rodada 6 do [PLANO-IMPLEMENTACAO-SET.md](PLANO-IMPLEMENTACAO-SET.md).

Ela existe para responder o medo declarado pelo dono — *"ficar fácil de ser
hackeado e as pessoas perderem dinheiro"* — e para transformar *"acho que está
seguro"* em documento que um cliente pode ler.

**A regra desta auditoria:** todo veredito cita **arquivo e linha**, ou uma
consulta feita no banco. Opinião sem endereço não entra. Onde há lacuna, ela
aparece como lacuna — o documento que só elogia não serve para decidir nada, e
foi exatamente assim que o `PLANO-ENDURECIMENTO` descobriu, na `0041`, que a
documentação mentia sobre 13 de 42 objetos.

**O que esta auditoria não é:** não é teste de invasão, não houve tentativa de
exploração, e ela olha o código deste repositório — não a infraestrutura da
Vercel, do Supabase ou da Meta.

---

## Placar

| # | Item | Veredito |
|---|---|---|
| A01 | Broken Access Control | **Passa, com uma porta larga conhecida** |
| A02 | Cryptographic Failures | **Passa** |
| A03 | Injection | **Passa** |
| A04 | Insecure Design | **Lacuna: rate limit só nas portas públicas** |
| A05 | Security Misconfiguration | **Passa, com CSP parcial e sem HSTS** |
| A06 | Vulnerable and Outdated Components | **Passa** (`npm audit`: 0) |
| A07 | Identification and Authentication Failures | **Passa, sem MFA e sem log de login** |
| A08 | Software and Data Integrity Failures | **Passa** |
| A09 | Security Logging and Monitoring Failures | **Lacuna: verbos documentados que ninguém grava** |
| A10 | Server-Side Request Forgery | **Passa, e é a defesa mais bem feita da base** |

Os itens de lacuna viram backlog no fim, com gatilho. Nenhum foi consertado
durante a auditoria — consertar no meio de auditar é como corrigir a prova
enquanto se copia a resposta.

---

## O que foi medido no banco, e não lido em documento

Esta seção é resultado de consulta ao Postgres de produção em 06/set/2026, não
de leitura de migration. É a lição da `0041`: o documento e o banco divergem, e
quem ganha é o banco.

```
TOTAL DE TABELAS EM public: 39
SEM RLS: (nenhuma)
COM GRANT PARA anon/authenticated: (nenhuma)
```

- **39 de 39 tabelas com RLS ligada.** Zero exceções.
- **Zero grants para `anon`/`authenticated`** — em tabelas *e* nas 6 views
  (`leads`, `resumo_clientes`, `metricas_sessoes`, `metricas_por_pessoa`,
  `metricas_de_tempo`, `metricas_diarias`).
- **`af_auditoria` continua append-only**: `service_role` tem `INSERT` e
  `SELECT`, e nada mais. É a correção da `0042` sobrevivendo.
- **As 8 funções `SECURITY DEFINER` têm `search_path` fixado e nenhuma está
  exposta a `anon`/`authenticated`**:

  | Função | `search_path` |
  |---|---|
  | `apagar_segredo`, `criar_segredo`, `ler_segredo`, `trocar_segredo`, `limpar_segredo_da_conexao` | `""` |
  | `apagar_token_do_canal` | `public, extensions, vault` |
  | `consumir_limite`, `preencher_slug_do_cliente` | `public, pg_temp` |

  `search_path` não fixado numa função `definer` é o caminho clássico de
  escalada: quem controla o caminho de busca escolhe qual `tabela` a função
  enxerga. Nenhuma está nessa situação.

---

## A01 — Broken Access Control

**Veredito: passa, com uma porta larga conhecida e decidida pelo dono.**

### O que sustenta

**Toda Server Action que recebe `clienteId` confere pertencimento na primeira
linha.** São ~90 ações em [acoes.ts](../src/server/acoes.ts), e a conferência é
`exigirAcessoAoCliente(clienteId)` — verificada em cada uma. As duas que não
recebem cliente (`acaoCriarCliente`, [acoes.ts:161](../src/server/acoes.ts#L161);
`acaoCriarExemplo`, [:176](../src/server/acoes.ts#L176)) exigem
`exigirOperadorDa4YU()`.

**O par `(cliente, entidade)` viaja junto nas leituras e escritas**, porque a
URL é adivinhável. [leads.ts:614](../src/server/repos/leads.ts#L614) filtra por
`client_id` **e** `contact_id`; [conexoes.ts:128](../src/server/repos/conexoes.ts#L128)
idem. Onde uma lista de ids vem de formulário, ela é filtrada pelo dono antes
de ser usada — [acoes.ts:748](../src/server/acoes.ts#L748) usa `r.validos`, e
nunca a lista crua.

**Escalada de privilégio dentro da conta está fechada:** cadastrar pessoa,
trocar papel e remover membro exigem `podeAdministrarConta`
([acoes.ts:1469](../src/server/acoes.ts#L1469), [:1531](../src/server/acoes.ts#L1531),
[:1558](../src/server/acoes.ts#L1558)). Um `member` não promove a si mesmo.

**O middleware não é a fronteira, e sabe disso.**
[proxy.ts:107](../src/proxy.ts#L107) só confere **presença** do cookie; o
próprio arquivo diz, em [:20](../src/proxy.ts#L20), que "um cookie forjado passa
por aqui e morre no `getSession` da tela seguinte". A autorização real está na
tela e na ação — que é o lugar certo.

### A porta larga

[sessao.ts:269](../src/server/sessao.ts#L269) deixa o **administrador de
plataforma** alcançar qualquer conta sem ser membro dela:

```ts
const papel = await papelNaConta(sessao.usuario.id, contaId)
if (papel !== null) return { sessao, papel }
if (ehAdminDaPlataforma(sessao)) return { sessao, papel: null }
```

E [podeAdministrarConta](../src/server/sessao.ts#L285) devolve `true` para
`papel === null`, ou seja, esse acesso também administra a equipe da conta.

**Isto é decisão registrada, não descuido:** o comentário em
[sessao.ts:236](../src/server/sessao.ts#L236) diz que é "a última porta larga do
sistema, e a decisão de fechá-la é do dono". O que a auditoria acrescenta é a
consequência: **esse caminho não passa por impersonação e, portanto, não deixa
linha de auditoria** — diferente de `acaoEntrarComo`, que registra. Ver
[backlog S3](#backlog).

### Achado menor

`acaoApagarCliente` ([acoes.ts:1955](../src/server/acoes.ts#L1955)) confere
acesso, mas **não** `podeAdministrarConta` — um `member` apaga o cliente
inteiro. O comentário em [:1946](../src/server/acoes.ts#L1946) argumenta que
quem chega ali "já podia apagar tudo item por item", o que é verdade e não é o
mesmo: apagar item a item é reversível pela metade e visível; apagar a conta é
um clique. Ver [backlog S4](#backlog).

`lerConversa(contatoId)` ([leads.ts:637](../src/server/repos/leads.ts#L637))
filtra só por contato, sem cliente. As duas telas que a chamam já conferiram o
par antes, então **não há falha explorável hoje** — mas o acoplamento é por
convenção da tela, e não pela assinatura. Ver [backlog S5](#backlog).

---

## A02 — Cryptographic Failures

**Veredito: passa.**

**Segredo de cliente nunca fica em linha de tabela.** O valor mora no Supabase
Vault e o banco guarda só a referência — a regra está escrita na própria
migration: [0006:38](../supabase/migrations/0006_conexoes.sql#L38) diz *"A
referência no Vault. NUNCA o valor."*, e
[0001:19](../supabase/migrations/0001_init.sql#L19) e
[0040:64](../supabase/migrations/0040_canal_instagram.sql#L64) repetem para
canal e Instagram.

**O tipo impede o erro, não a disciplina.** `CanalSalvo` não tem campo de token;
ler exige uma ida ao cofre por RPC
([conversas.ts:158](../src/server/repos/conversas.ts#L158)). Quem lê a linha não
consegue ler o segredo.

**O apelido do cofre é aleatório**, e não o nome do cliente
([conexoes.ts:87](../src/server/repos/conexoes.ts#L87)) — quem enxergar a lista
de segredos não descobre de quem é cada um.

**Hash de senha é do Better Auth**, e não escrito à mão
([auth.ts:71](../src/server/auth.ts#L71)); a justificativa em
[:13](../src/server/auth.ts#L13) é explícita sobre isso ser onde erro custa
caro. Não há `bcrypt`/`argon`/`scrypt` próprio no repositório.

**Toda comparação de segredo é em tempo constante**, com conferência de
comprimento antes (porque `timingSafeEqual` estoura com tamanhos diferentes):
WhatsApp [route.ts:126](../src/app/api/webhook/whatsapp/route.ts#L126),
Instagram [route.ts:106](../src/app/api/webhook/instagram/route.ts#L106),
webhook de entrada [route.ts:186](../src/app/api/webhook/entrada/[clienteId]/route.ts#L186),
`CRON_SECRET` via [segredo.ts:19](../src/lib/segredo.ts#L19).

**Uma exceção, de baixo impacto:** o GET de verificação do webhook do WhatsApp
compara o token com `===`
([route.ts:44](../src/app/api/webhook/whatsapp/route.ts#L44)). É o handshake que
a Meta faz uma vez, com um token que não é credencial de acesso a dado; o vazamento
por tempo aqui não abre porta. Fica registrado por consistência, não por risco.

---

## A03 — Injection

**Veredito: passa.**

**SQL cru existe em um lugar só e sempre parametrizado.** Todo `.query(` de
`src/server/` — 15 ocorrências — usa `$1`, `$2` com array de parâmetros. A regra
está escrita em [auth.ts:48](../src/server/auth.ts#L48): *"identificador nunca
vem de usuário, valor sempre vai como parâmetro (`$1`)"*. **Nenhuma
interpolação de variável dentro de string SQL foi encontrada.**

**A injeção que este produto realmente tinha para resolver não é SQL, é
PostgREST.** O `or` do PostgREST é uma string em que vírgula, parêntese e `*`
têm significado: um termo com esses caracteres não quebra a consulta — ele
**vira** consulta e passa a escolher linha sozinho. A defesa é
`limparBusca` ([leads.ts:453](../src/server/repos/leads.ts#L453)), e ela é
**allow-list**, não deny-list:

```ts
.replace(/[^\p{L}\p{N}\s@._-]/gu, ' ')
```

Fixada por teste ([leads.test.ts:357](../src/server/repos/leads.test.ts#L357)),
inclusive o caso `limparBusca('nome.ilike.*x*')`.

Onde um id entra num filtro `or`, a forma é conferida antes
([fluxos.ts:361](../src/server/repos/fluxos.ts#L361) com `pareceUuid`).

**XSS: zero `dangerouslySetInnerHTML` em todo `src/`** — a única ocorrência do
termo é um comentário explicando a decisão de não usá-lo
([interpolar.ts:93](../src/core/engine/interpolar.ts#L93)). Também não há
`innerHTML =`, `eval(` nem `new Function(`.

**Achado de manutenção, não de risco:** existe uma **segunda** sanitização, em
[quadros.ts:478](../src/server/repos/quadros.ts#L478), com allow-list diferente
da de `leads.ts` (aceita `+`, recusa `_`, e não trunca comprimento). Duas
verdades sobre a mesma pergunta divergem no dia em que uma for corrigida. Ver
[backlog S6](#backlog).

---

## A04 — Insecure Design

**Veredito: lacuna — o rate limit cobre as portas públicas e nenhuma ação
autenticada.**

### O que existe

Quatro pontos, e todos os quatro são portas de fora:

| Onde | Teto |
|---|---|
| Login ([acoes-conta.ts:88](../src/server/acoes-conta.ts#L88)) | 5 / 5 min |
| Cadastro ([acoes-conta.ts:167](../src/server/acoes-conta.ts#L167)) | 5 / 5 min |
| `/api/simular` ([route.ts:105](../src/app/api/simular/route.ts#L105)) | 60 / min |
| `/api/webhook/entrada` ([route.ts:77](../src/app/api/webhook/entrada/[clienteId]/route.ts#L77)) | 120 / min, **por cliente** |

O limite falha **fechado** ([limite.ts:52](../src/server/limite.ts#L52)): se o
contador não responde, a requisição é recusada.

O webhook de entrada chaveia **por cliente, não por IP**, e isso é deliberado:
vários clientes são servidos pelo mesmo servidor de fora, e chavear por endereço
faria o volume de um calar o outro.

### A lacuna

**[acoes.ts](../src/server/acoes.ts) tem 88 Server Actions exportadas e nenhuma
chamada a `consumirLimite`** — o arquivo sequer importa o módulo. Entre elas:
`acaoResponderLead` (dispara envio pago pelo WhatsApp),
`acaoTrocarValorDaConexao` (mexe em credencial), `acaoSalvarLogo` e
`acaoPrepararEnvioDeArquivo` (upload), `acaoApagarContatos`.

Um membro com sessão válida pode martelar qualquer uma delas. Isto é
exatamente o que o `PLANO-ENDURECIMENTO` previu ao dizer que o bloco 3 fechou as
portas públicas e sobrou o de dentro.

`acaoEntrarComo` ([acoes-conta.ts:349](../src/server/acoes-conta.ts#L349))
também não tem limite.

**Também sem teto de corpo:** `/api/webhook/whatsapp` e
`/api/webhook/instagram` leem `req.text()` sem conferir tamanho. O padrão certo
existe em `/api/simular` e no webhook de entrada, que conferem o
`content-length` **e** os bytes de verdade — porque o cabeçalho é escolhido por
quem chama. (O handoff da noite registra que o plano da rodada 3 afirmava o
contrário: dizia que o webhook do WhatsApp já tinha teto. Não tem.)

Ver [backlog S1 e S2](#backlog).

### O que segura o desenho, apesar disso

Limites de domínio existem e são fartos: `MAX_PASSOS = 100` e
`MAX_TENTATIVAS = 3` no motor ([executar.ts:27](../src/core/engine/executar.ts#L27)),
`MAX_SALTOS`/`MAX_EFEITOS` nos efeitos, tetos de texto, lista e botões no
schema, `LIMITE_DO_ARQUIVO = 16 MB` no acervo, `bodySizeLimit: '4mb'` nas Server
Actions. Um fluxo malfeito não vira laço infinito.

---

## A05 — Security Misconfiguration

**Veredito: passa, com CSP parcial e sem HSTS.**

Cinco cabeçalhos em todas as rotas
([next.config.ts:26](../next.config.ts#L26)): `frame-ancestors 'none'`,
`X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy:
strict-origin-when-cross-origin` e `Permissions-Policy` desligando câmera,
microfone e localização.

**A CSP é parcial de propósito**, e o arquivo assume
([next.config.ts:20](../next.config.ts#L20)): o Next injeta script inline, e uma
política escrita no chute quebraria a hidratação da página inteira.
`frame-ancestors` é a parte afirmável sem risco. CSP completa com nonce é tarefa
própria — [backlog S7](#backlog).

**HSTS não está no código.** A Vercel serve HTTPS e faz redirect, mas o
cabeçalho `Strict-Transport-Security` não é emitido por nós — [backlog S8](#backlog).

**Uma única variável `NEXT_PUBLIC_` existe**, e é pública por definição:
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`. Nenhum segredo tem esse prefixo. Confirmado por
varredura de todas as 23 variáveis de ambiente lidas em `src/`.

**Sem CORS configurado** — nenhum `Access-Control-Allow-Origin` em rota
nenhuma, então vale o same-origin do navegador, que é o certo para um painel.

**`.env*` está no `.gitignore`** com `.env.example` reintroduzido, e o ignore
cobre também `*.pem`, `*-sa.json` e `.secrets/`. Confirmado: `.env.local`, onde
a chave VAPID privada foi escrita nesta sessão, é ignorado pelo git.

---

## A06 — Vulnerable and Outdated Components

**Veredito: passa.**

```
$ npm audit --omit=dev   → found 0 vulnerabilities
$ npm audit              → found 0 vulnerabilities
```

Versões principais: `next ^16.3.0`, `react ^19.2.8`, `better-auth ^1.7.0`,
`@supabase/supabase-js ^2.112.3`, `zod ^3.25.76`, `undici ^8.10.0`,
`web-push ^3.6.7`.

`zod` está na linha 3 enquanto o ecossistema já tem a 4 — não é
vulnerabilidade, é dívida de atualização, e trocar de major num validador que
guarda toda a fronteira de entrada é tarefa com teste, não upgrade de rotina.

---

## A07 — Identification and Authentication Failures

**Veredito: passa, sem MFA e sem registro de login.**

Senha mínima de 10 caracteres
([auth.ts:93](../src/server/auth.ts#L93)) — acima dos 8 usuais. Sessão de 7
dias, renovada a cada 1 ([auth.ts:107](../src/server/auth.ts#L107)).
Impersonação limitada a 1 hora ([auth.ts:127](../src/server/auth.ts#L127)).

**A senha única do MVP saiu de cena, e há teste provando**:
`src/proxy.test.ts:82` — *"a senha única não abre mais nada — a rota /login não
existe"*. `PAINEL_SENHA` não é lida por nenhum código executável.

**Mas `PAINEL_SEGREDO` ainda é lida**, como fallback de assinatura do estado
OAuth do Instagram ([estado.ts:28](../src/server/instagram/estado.ts#L28)):

```ts
const valor = process.env.BETTER_AUTH_SECRET ?? process.env.PAINEL_SEGREDO
```

O `??` faz o segredo aposentado só valer se o novo faltar, e o novo está
configurado em produção. Não é falha ativa; é resíduo que deve morrer antes de
alguém confiar nele — [backlog S9](#backlog).

**Impersonação é auditada dos dois lados** — `entrou_como`
([acoes-conta.ts:361](../src/server/acoes-conta.ts#L361)) e
`saiu_do_entrar_como` ([:388](../src/server/acoes-conta.ts#L388)) —, e os atos
praticados dentro dela carregam `impersonadoPor`, destacado em âmbar na tela de
auditoria ([auditoria/page.tsx:76](../src/app/admin/auditoria/page.tsx#L76)).

**Não há MFA, bloqueio de conta após N falhas, nem política de complexidade.**
Para um painel com poucos operadores e rate limit no login, é proporcional
hoje; deixa de ser quando houver cliente pagante com equipe grande —
[backlog S10](#backlog).

---

## A08 — Software and Data Integrity Failures

**Veredito: passa.**

**A auditoria é append-only no banco, não na aplicação.** `service_role` tem só
`insert` e `select` — conferido na produção nesta auditoria. A migration
[0021:100](../supabase/migrations/0021_auditoria.sql#L100) usa `revoke all`
seguido de grant seletivo, e o comentário explica por quê: a primeira versão
revogou só `update`/`delete` e **`truncate` ficou de pé**, o que tornava o
append-only decorativo.

**E há a prova de que isso não é teoria:** a `0041` rodou um `grant all` amplo
que devolveu `update`, `delete` e `truncate` sobre `af_auditoria`, e a
[0042](../supabase/migrations/0042_auditoria_volta_a_ser_append_only.sql)
existe para desfazer. Quem descobriu foi um **teste que tenta escrever e espera
falhar** ([auditoria.test.ts:73](../src/server/repos/auditoria.test.ts#L73)).
Continua sendo o mecanismo mais valioso desta seção.

**A fragilidade herdada:** o default do schema fechado pela `0041` cobre
`anon`/`authenticated` e **não diz nada sobre `service_role`**. Qualquer `grant
all ... to service_role` futuro reabre a tabela. A proteção depende de
disciplina em migration nova — e o comentário da tabela avisa.

**Assinatura antes de parse, sempre.** O webhook do WhatsApp lê o corpo cru e
confere a assinatura **antes** do `JSON.parse`
([route.ts:56](../src/app/api/webhook/whatsapp/route.ts#L56)), porque a
assinatura é sobre os bytes exatos e um `parse`+`stringify` já não bate. O
webhook de entrada roda as defesas da mais barata para a mais cara — corpo,
limite, assinatura — e o motivo está escrito: conferir assinatura primeiro
obrigaria a ir ao cofre antes de saber se o corpo tem tamanho aceitável, e uma
inundação de lixo viraria uma inundação de leituras do Vault.

**A conversa fica presa na versão em que começou** — garantia de schema, não de
código: `flow_version_id uuid not null references flow_versions(id)`
([0003:41](../supabase/migrations/0003_conversas.sql#L41)). Publicar no meio do
dia não move ninguém para um bloco que não existia quando a pessoa entrou. O
rollback republica em vez de reapontar ponteiro
([acoes.ts:302](../src/server/acoes.ts#L302)): o histórico só cresce.

---

## A09 — Security Logging and Monitoring Failures

**Veredito: lacuna — há verbos documentados que nenhum código grava.**

### O que funciona

`alertar()` ([alertar.ts:54](../src/server/alertar.ts#L54)) grava em três
lugares, e o `console.error` vem **primeiro** — se o banco for justamente o que
está fora, é o único lugar que sobra. Nunca estoura.

A história registrada em [alertar.ts:7](../src/server/alertar.ts#L7) é a lição
que vale citar: a primeira versão era só um webhook do Discord, a variável nunca
foi preenchida, e **durante meses o mecanismo não avisou ninguém**. Hoje grava
sempre no banco, com tela em `/admin/alertas`.

15 pontos gravam auditoria, cobrindo criação de usuário e conta, troca de papel,
remoção de membro, impersonação, revogação de sessão, suspensão e exclusão de
conta. Na exclusão, o registro é gravado **antes** do delete, porque `conta_id`
é `on delete set null`.

### A lacuna, e ela é de credibilidade

**Três verbos estão documentados como canônicos e nenhum código os grava:**

| Verbo | Documentado em | Gravado? |
|---|---|---|
| `publicou_fluxo` | [auditoria.ts:14](../src/server/repos/auditoria.ts#L14), [0021:41](../supabase/migrations/0021_auditoria.sql#L41) | **não** |
| `apagou_contato` | idem | **não** |
| login / falha de login | — | **não** |

`acaoPublicar` ([acoes.ts:285](../src/server/acoes.ts#L285)) não chama
`registrar()`. A pergunta que a `0021` diz existir para responder — *"quem
publicou isso?"* — não tem resposta. Publicar é a ação que muda o que o bot
fala com todos os leads do cliente.

`acaoApagarContato` ([acoes.ts:1977](../src/server/acoes.ts#L1977)) e
`acaoApagarContatos` ([:797](../src/server/acoes.ts#L797)) apagam dado pessoal
de terceiro sem deixar linha. O expurgo automático de retenção também não
grava.

**Login e falha de login não são registrados em lugar nenhum** — nem auditoria,
nem `console`. Só existe o rate limit, que barra mas não conta. Quem quiser
saber se houve tentativa de força bruta contra uma conta não tem onde olhar.

**Os campos `ip` e `agente` existem no schema e nenhuma das 15 chamadas os
preenche** — todas gravam `''`.

**`registrar()` nunca estoura**
([auditoria.ts:45](../src/server/repos/auditoria.ts#L45)): um insert que falha
vira `console.error` e a ação segue. É buraco consciente na prova, e o próprio
arquivo o declara.

Ver [backlog S11 e S12](#backlog).

### Um log que precisa morrer na aprovação

[receber-do-instagram.ts:330](../src/server/receber-do-instagram.ts#L330)
imprime o **corpo cru** do webhook do Instagram no log da Vercel quando nenhuma
mensagem é tratada:

```ts
console.error('[webhook instagram] corpo sem mensagem tratada', JSON.stringify(payload))
```

O `payload` carrega IGSID do remetente e texto de mensagem direta. Isto é o
commit `c5ed171`, deliberado, e o [HANDOFF-06-SET.md §4](HANDOFF-06-SET.md) manda
**não removê-lo** enquanto a Meta analisa — é a única janela para o que ela
manda de verdade. **Registrado aqui como dívida com gatilho explícito: sai no
dia da aprovação** — [backlog S13](#backlog).

---

## A10 — Server-Side Request Forgery

**Veredito: passa, e é a defesa mais bem feita da base.**

O bloco `http` do editor deixa o operador digitar uma URL que o servidor vai
chamar. É a superfície clássica de SSRF, e ela está fechada em
[rede.ts](../src/server/efeitos/rede.ts):

1. **Só HTTPS**, conferido antes de qualquer DNS
   ([rede.ts:65](../src/server/efeitos/rede.ts#L65)).
2. **Resolve o nome e recusa se QUALQUER endereço for interno**
   ([:82](../src/server/efeitos/rede.ts#L82)) — não só o primeiro, porque "um
   nome que resolve para vários é justamente o jeito de esconder o alvo interno
   atrás de um público".
3. **Default deny**: endereço que o código não sabe interpretar volta como
   interno ([:104](../src/server/efeitos/rede.ts#L104)).
4. **A mensagem de erro não revela o IP descoberto**
   ([:85](../src/server/efeitos/rede.ts#L85)) — confirmar "10.0.0.7 existe" é
   mapa de rede interna entregue de graça.

As faixas bloqueadas incluem loopback, as três privadas, CGNAT, multicast, IPv6
(`::1`, `fc00::/7`, `fe80::/10`), IPv4 mapeado em IPv6 — e
**`169.254.0.0/16`, que é o endereço de metadados da nuvem**, o alvo que
transforma SSRF em vazamento de credencial de infraestrutura.

**E o rebinding de DNS está fechado**, que é a parte que quase todo mundo
esquece: o `undici` re-resolve o DNS ao conectar, então aprovar o endereço e
depois chamar a URL não adianta. A conexão é fixada nos endereços já aprovados
por um dispatcher com `lookup` que não resolve nada
([http.ts:268](../src/server/efeitos/http.ts#L268)). O arquivo cita a CVE do
Budibase que ensina isso.

**Redirecionamento é reconferido a cada salto** (máximo 3), e **credencial não
cruza origem** ([http.ts:104](../src/server/efeitos/http.ts#L104)) — um host
público que responde 302 apontando para dentro não leva o token junto.

**Limites da defesa, registrados:** não há allow-list de destino nem bloqueio de
porta, e a URL de `ALERTA_WEBHOOK_URL` não passa por `conferirEndereco` — ela
vem do ambiente, não de usuário. Nenhum dos dois é explorável por cliente.

**Regra irmã, e vale citar:**
[endereco.ts](../src/server/endereco.ts) **nunca monta URL a partir de cabeçalho
da requisição**, porque `Host` é escolhido por quem chama. É a mesma família de
erro do SSRF, vista do outro lado.

---

## LGPD — o direito de sumir

Não é item do OWASP, e entra porque conversa de WhatsApp é dado pessoal de
terceiro: não do cliente, **do cliente do cliente**.

**Apagar existe e é de verdade.** `apagarContato`
([retencao.ts:48](../src/server/repos/retencao.ts#L48)) filtra pelo par
`(contato, cliente)`; o cascade leva sessões, mensagens, handoffs e a trava da
conversa. Não há cópia do histórico em outro lugar.

**A retenção automática roda todo dia às 07:00 UTC** — declarada em
[vercel.json](../vercel.json), servida por
[/api/manutencao/retencao](../src/app/api/manutencao/retencao/route.ts). Padrão
de 12 meses, teto de 500 por execução.

**O critério é o último sinal de vida, não a data de criação**
([retencao.ts:118](../src/server/repos/retencao.ts#L118)) — contar pela criação
apagaria conversa ativa que começou há treze meses, o que é perder cliente, não
cumprir a lei.

**A rota falha fechada:** sem `CRON_SECRET`, responde 503 e **não apaga nada**
([route.ts:29](../src/app/api/manutencao/retencao/route.ts#L29)) — uma rota que
apaga contato não pode ficar aberta porque uma variável não foi preenchida.

**Os alertas também expiram**, porque o contexto de um alerta pode carregar id
de contato — guardá-lo para sempre seria guardar dado pessoal exatamente onde
este mecanismo existe para impedir.

**Lacunas:** os 12 meses são constante global, sem configuração por cliente; o
expurgo não deixa linha de auditoria; e não há verificação de que o cron rodou —
se ele parar, o único sinal seria um alerta que ninguém garante que sai.

> **Nota sobre o bloco 8 do `PLANO-ENDURECIMENTO`.** Ele está **feito**, e por um
> caminho diferente do planejado: o plano mandava usar `pg_cron`, e a
> implementação usa cron da Vercel porque extensão é **global ao projeto
> compartilhado com a Verandi** — ligar uma para uma limpeza anual obrigaria a
> avaliar o outro produto. A decisão está escrita em
> [retencao.ts:7](../src/server/repos/retencao.ts#L7). É mais um caso de plano
> que o código desmentiu com razão.

---

## Backlog

Nada aqui foi consertado durante a auditoria, de propósito. Cada item tem
gatilho — a condição em que ele deixa de ser aceitável.

| # | O quê | Gatilho |
|---|---|---|
| **S1** | Rate limit nas Server Actions autenticadas, começando pelas que gastam dinheiro (`acaoResponderLead`) ou mexem em credencial | Antes do primeiro cliente pagante com equipe |
| **S2** | Teto de corpo em `/api/webhook/whatsapp` e `/api/webhook/instagram`, no padrão de `/api/simular` | Antes do volume real do Instagram |
| **S3** | Fechar ou auditar a porta larga do admin de plataforma ([sessao.ts:269](../src/server/sessao.ts#L269)) — no mínimo, registrar o acesso | Decisão do dono; obrigatório com cliente externo na base |
| **S4** | `acaoApagarCliente` exigir `podeAdministrarConta` | Quando existir conta com `member` que não é do time |
| **S5** | `lerConversa` receber `clienteId` na assinatura | Próxima vez que alguém tocar o arquivo |
| **S6** | Unificar as duas sanitizações de busca (`leads.ts` e `quadros.ts`) | Próxima correção em qualquer uma das duas |
| **S7** | CSP completa com nonce | Quando houver quem teste a hidratação inteira |
| **S8** | HSTS | Junto de S7 |
| **S9** | Matar o fallback `PAINEL_SEGREDO` ([estado.ts:28](../src/server/instagram/estado.ts#L28)) | Quando o Instagram sair do ar de teste |
| **S10** | MFA e bloqueio após N falhas | Cliente pagante com equipe grande |
| **S11** | Gravar `publicou_fluxo` e `apagou_contato` — os verbos já documentados | Antes de prometer trilha de auditoria a cliente |
| **S12** | Registrar login e falha de login; preencher `ip`/`agente` | Junto de S11 |
| **S13** | **Remover o log do corpo cru do Instagram** ([receber-do-instagram.ts:330](../src/server/receber-do-instagram.ts#L330)) | **No dia da aprovação da Meta** |

---

## Como refazer esta auditoria

O que a torna verificável é não depender de memória. Para repetir:

```bash
# O estado real de RLS e grants, que é o que a 0041 provou não bater com o doc
set -a && . /home/gabfelix/dev/4yu-apps/.secrets/4yu.env && set +a
node -e "…"   # a consulta está na seção 'O que foi medido no banco'

npm audit --omit=dev
npm test      # inclui o teste que tenta escrever na auditoria e espera falhar
```

E a regra que vale mais que todas, do handoff: **afirmar que algo funciona só
depois de ver a saída do comando que prova.**
