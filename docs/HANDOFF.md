# Handoff — 18/ago/2026

Para quem pegar este projeto agora. Leia isto, depois
[PLANO-SISTEMA.md](PLANO-SISTEMA.md), e só então código.

---

## 1. Onde exatamente paramos

**Etapa A: A1 a A5 estão no ar.** Login por usuário, sidebar e área de
administração, bloco de mensagem em pilha, cadeia de atendimento e Inbox de
fila. Falta a **A6** (fluxos padrão e gatilhos), a **A7** (configurações
reunidas) e as pontas que dependem de você — todas em
[PENDENCIAS-DO-DONO.md](PENDENCIAS-DO-DONO.md).

O painel continua funcionando com a **senha única** (`PAINEL_SENHA` + cookie
assinado em `lib/painel-auth.ts`), e o login por usuário está de pé mas
**dormindo**: não existe nenhum usuário cadastrado. Os dois sistemas convivem
de propósito.

`npm test` → **488 passando, 8 pulados**. `typecheck`, `lint` e `build` limpos.
Os 8 pulados dependem de `IA_TESTE_REAL` e `API_TESTE_REAL` — é por desenho.

### O que cada frente entregou

| Frente | O que existe agora |
|---|---|
| **A1** | `/api/auth/[...all]`, `/entrar`, `/criar-conta`, `/contas`, `/admin/{contas,usuarios,auditoria}`, "entrar como" com faixa âmbar, e a conferência de acesso em toda tela, rota de API e Server Action |
| **A2** | Sidebar do cliente (Painel · Inbox · Contatos · Automações · Configurações) e a área do administrador. Fim das abas no topo |
| **A3** | Bloco de mensagem em pilha: texto formatado, arquivo, atraso, guardar, desligar o bot. Lê o formato antigo e escreve só o novo |
| **A4** | Horário de atendimento (o handoff sabe que horas são), assumir/liberar/passar conversa, presença, relógio da janela de 24h na fila, aviso de fila em toda tela do painel |
| **A5** | Fila paginada, rail `Atribuído` com contagem, anotação da equipe no painel lateral |

### O que existe de verdade no banco

| Tabela | O que é |
|---|---|
| `af_usuarios` | usuários (Better Auth), com `presenca`. **Não** é `auth.users`, que é global e da Verandi |
| `af_sessoes` | sessões, com `impersonatedBy` e `activeOrganizationId` |
| `af_contas` | credenciais — guarda **hash** de senha |
| `af_verificacoes` | tokens de verificação |
| `af_membros` | usuário × conta × papel (`owner`/`admin`/`member`) |
| `af_convites` | convites pendentes (a tabela existe; o convite não, porque depende de SMTP) |
| `af_auditoria` | quem fez o quê. **Append-only** |
| `clients` | ganhou `slug`, `metadata` e `horario_atendimento` |
| `contacts` | ganhou `atribuido_a` |
| view `leads` | ganhou `ultima_entrada_em` e `atribuido_a` |

**Migrations aplicadas: até a `0022`.** A `0023` está escrita e **não
aplicada** — ela destrava as não lidas e o tipo da mídia na prévia da fila.
Ver [PENDENCIAS-DO-DONO.md](PENDENCIAS-DO-DONO.md) §7.

**Não existe nenhum usuário em produção ainda.** A tabela está vazia; ver §4.

## 2. As coisas que você precisa saber antes de tocar em qualquer coisa

### 2.1 O banco é compartilhado com outro produto

AutoFluxos vive em `public`; a **Verandi** vive em `app_verandi`, no **mesmo
projeto Supabase**. `auth.users`, Storage, extensões, Data API, cotas e backup
são **globais**. Leia [BANCO-COMPARTILHADO.md](BANCO-COMPARTILHADO.md) inteiro
antes de qualquer migration. Nunca rode `supabase db push`.

Como aplicamos SQL em produção: **Management API**, uma migration por vez.

```bash
set -a && . /home/gabfelix/dev/4yu-apps/.secrets/4yu.env && set +a
Q=$(python3 -c "import json;print(json.dumps({'query':open('supabase/migrations/00XX_nome.sql').read()}))")
curl -s -X POST "https://api.supabase.com/v1/projects/$AUTOFLUXOS_SUPABASE_PROJECT_REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" -d "$Q"
```

**A próxima migration é a `0022`.** Confira o diretório, não confie nesta frase.

### 2.2 `clients` É a conta do Better Auth

Não existe tabela `organization`. O plugin aponta para `clients` via
`modelName`, porque **toda** chave estrangeira do sistema (`flows`, `contacts`,
`channels`, `connections`, `messages`) já aponta para lá. Duas tabelas para o
mesmo conceito divergem — foi o defeito que a `0018` consertou no nome do
contato, e não vamos recriá-lo.

### 2.3 `generateId: 'uuid'` significa "o banco gera"

Não significa "gere um uuid no código". Toda tabela do auth precisa de
`default gen_random_uuid()` na chave, ou o insert chega com `id` nulo.

### 2.4 O CLI do Better Auth mente

`@better-auth/cli` é publicado à parte e **fica para trás do runtime** — em
17/ago o CLI mais novo era `1.5.0-beta.13` com o runtime em `1.7.0`, e o schema
gerado não tinha a coluna `issuer`. **Use `node scripts/schema-do-auth.mjs`**,
que lê o runtime instalado. Ao atualizar a biblioteca, rode e compare.

### 2.5 O `.npmrc` com `legacy-peer-deps` é obrigatório

`better-auth` declara `@sveltejs/kit` como peer opcional e o npm arrasta a
cadeia do Svelte, que exige `vite@8` contra o `vite@7` do Vitest. Sem o
`.npmrc`, **o build quebra no deploy**. O custo: peer conflito real deixa de
aparecer na instalação.

### 2.6 `auth.ts` exporta função, não constante — e não dá para "simplificar"

`autenticacao()` constrói a instância na primeira chamada. Voltar a
`export const auth = betterAuth(...)` derruba o CI: o pool estoura sem
`DATABASE_URL`, e **o `npm run build` do CI roda sem variável de banco nenhuma**,
de propósito — este repositório é público e não guarda segredo
(`.github/workflows/ci.yml`). O mesmo vale para a rota `[...all]`, que chama
`autenticacao()` dentro de cada método em vez de usar `toNextJsHandler`.

### 2.7 `nextCookies()` tem que ser o último plugin

É o gancho que repassa o `Set-Cookie` dos endpoints para o `cookies()` do Next.
Sem ele, `signInEmail` chamado de dentro de uma Server Action autentica e **não
deixa sessão nenhuma no navegador**: a pessoa acerta a senha, a ação responde
200, e a tela seguinte a manda de volta para o login. Último porque o cookie que
interessa é o do fim da cadeia — a impersonação troca o cookie de sessão dentro
do gancho dela.

### 2.8 Quem autoriza é `server/sessao.ts`, não o `proxy.ts`

O proxy decide se a requisição segue, e a conferência do login por usuário lá é
só de **presença do cookie**: não vai ao banco e não decide nada sozinha. Um
cookie forjado passa por ele e morre no `getSession` da tela seguinte.

Isso não é preguiça — a documentação do Next avisa que Server Action é um POST
na rota onde ela é usada, e um refactor que a mova de rota a tira do matcher sem
ninguém perceber. **Toda tela e toda ação confere de novo**, por
`exigirUsuario`, `exigirAdminDaPlataforma` ou `exigirAcessoAoCliente`.

### 2.9 A sessão de usuário tem precedência sobre a senha única

Quem entra como pessoa vê o que aquela pessoa vê — não o painel inteiro. Sem
isso o login seria decoração por cima do acesso total que já existe.

O administrador da 4YU continua alcançando qualquer conta **enquanto a senha
única existir**; é a linha em `exigirAcessoAoCliente` que estreita para "só
impersonando" no dia em que ela sair. Quem não pode recebe **404**, e não 403:
confirmar que a conta existe já é contar de um cliente para quem não é dele.

### 2.10 Versão publicada é imutável, inclusive para nós

`flow_versions` guarda o grafo e a sessão fica presa à versão em que começou.
Mudar o formato de um bloco **mata toda conversa em andamento**. O caminho é
sempre ler os dois formatos e normalizar na leitura — nunca reescrever
`flow_versions.grafo`. Isso vai importar muito na frente **A3**.

### 2.11 A auditoria não pode ser editada pela aplicação

`service_role` tem só `insert` e `select` em `af_auditoria`. Não escreva função
de apagar; não existe permissão. Na primeira escrita da `0021` sobrou
`truncate`, que tornava tudo decorativo — `revoke all` e conceder só o que entra.

---

## 3. Ambiente

### Variáveis

| Variável | `.env` local | Vercel | Observação |
|---|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | ✅ | ✅ | |
| `META_APP_SECRET`, `WHATSAPP_TOKEN`, `WHATSAPP_VERIFY_TOKEN` | ✅ | ✅ | |
| `GEMINI_API_KEY` | ✅ | ✅ | entrou em 17/ago — **nunca tinha existido em produção**, então o bloco de IA jamais funcionou lá |
| `PAINEL_SENHA` | ✅ | ✅ | senha única, ainda em uso. **Sem ela em produção, o login por usuário vira a única porta** — o 503 que existia aqui saiu |
| `PAINEL_SEGREDO` | ✅ | ✅ | trocar encerra todas as sessões do painel |
| `CRON_SECRET` | ✅ | ✅ | sem ela a retenção responde 503 |
| `DATABASE_URL` | ✅ | ✅ | pooler **6543**, não 5432 |
| `BETTER_AUTH_SECRET` | ✅ | ✅ | |
| `BETTER_AUTH_URL` | ❌ | ❌ | **opcional.** Sem ela a origem sai da requisição, o que basta para e-mail e senha na mesma origem; preenchida errado, quebra o login inteiro |
| `ALERTA_WEBHOOK_URL` | ❌ | ❌ | **falta.** Precisa de URL de Discord/Slack que só o dono cria. Sem ela `alertar()` é no-op e falha de entrega não avisa ninguém |

Fonte da verdade dos valores: `4yu-apps/.secrets/4yu.env`, prefixo
`AUTOFLUXOS_`. **Nunca** copie segredo para dentro do repo — ele é público.

### Conexão direta

```
postgresql://postgres.<ref>:<senha>@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
```

Porta **6543** (transaction pooler, próprio para serverless). A 5432 só para
migration. Em modo transação o Supavisor **não suporta prepared statements**.

---

## 4. O próximo passo, em ordem

### 4.1 Criar o primeiro administrador — é o único passo manual

Não fizemos isso por você porque a conta é de uma pessoa de verdade, com o
e-mail e a senha dela, e nem uma coisa nem a outra se inventa. O caminho:

1. Abra `/login` e entre com a `PAINEL_SENHA`.
2. Vá para `/criar-conta`. Como não existe nenhum usuário, ela mostra
   **"Primeiro acesso"** — nome, e-mail e senha de pelo menos 10 caracteres.
3. Quem sai daí é administrador da plataforma, e a tela se fecha sozinha:
   daqui em diante ela exige sessão de administrador.
4. Em `/admin/contas`, ligue cada cliente existente a uma pessoa. Cliente sem
   membro aparece primeiro na lista, e ninguém entra nele com login próprio até
   ganhar dono.

Para cadastrar o dono de um cliente: `/admin/usuarios` → `+ Cadastrar pessoa`,
depois `/admin/contas` → `+ Ligar pessoa` como **dono da conta**. A senha é
combinada fora daqui — convite por e-mail depende de SMTP, que é global ao
projeto compartilhado.

### 4.2 O que falta na Etapa A

1. **A6 — fluxos padrão e gatilhos.** Boas-vindas, resposta padrão, fluxo para
   mídia recebida, pós-atendimento, e palavras-chave por conta. **Precisa de
   migration**, e é ela que também destrava a última pendência da A4: mídia
   recebida virando handoff deixa de fazer sentido quando existe um fluxo
   padrão para mídia.
2. **A7 — configurações reunidas.** A maior parte já existe e está ligada no
   índice de `/ajustes`. Faltam `Etiquetas` (migration) e `Equipe`, que sem
   convite por e-mail seria uma tela mostrando uma lista vazia.
3. **Convite por e-mail.** `af_convites` existe e nada a preenche. Depende de
   SMTP, que é decisão dos dois produtos.
4. **Trocar a senha única pelo login por usuário.** Enquanto as duas convivem,
   nada quebra; o dia da troca é uma linha em `exigirAcessoAoCliente` (parar de
   deixar o administrador passar sem ser membro) e a remoção de `PAINEL_SENHA`.
   Exige o primeiro administrador existir — §4.1.

Depois da Etapa A vem a **B** (agendador, contatos completo, painel completo,
campanhas, pastas de fluxo, integrações com preset). Ordem e critério em
[PLANO-SISTEMA.md §5](PLANO-SISTEMA.md).

---

## 5. Armadilhas que já custaram caro nesta base

Além das de [ESTADO.md](ESTADO.md), que continuam valendo:

- **Interpolar dentro de estrutura sem escapar.** O que a pessoa digita no
  WhatsApp entra em URL, corpo JSON e cabeçalho. Use `core/engine/interpolar.ts`.
- **Exceção solta no `after()` do webhook.** A mensagem já foi deduplicada; se
  a sessão não for salva, a pessoa fica sem resposta e a Meta não reenvia.
- **Identidade vinda do corpo da requisição.** Desenho pode vir de fora;
  identidade sai do banco.
- **Tela de autorização que o Next prerenderiza.** `/admin/page.tsx` só
  redireciona, e sem `force-dynamic` o Next a resolvia no build: a moldura rodava
  sem sessão nenhuma, `exigirAdminDaPlataforma` falhava, e o que ficava gravado
  era um redirecionamento para a raiz — servido depois a quem *é* administrador.
- **Duas coisas com o mesmo sintoma escondem uma à outra.** "Falha que some ao
  rodar de novo" foi atribuída ao relógio do WSL2 por semanas — era o teto de 5s
  do Vitest contra banco remoto **e** telefone de teste derivado de `Date.now()`.
- **Testes rodam contra o Supabase de produção.** Eles limpam o que criam, mas
  uma execução que quebra no meio deixa lixo. Se a lista de clientes tiver
  `zz-`, é isso.
- **E a auditoria é a exceção que eles não limpam.** `af_auditoria` é
  append-only, então `auditoria.test.ts` deixa as linhas dele lá para sempre — a
  tela `/admin/auditoria` já nasce com dezenas de `publicou_fluxo` de
  `gente@exemplo.test`. Não são um incidente; são a suíte. Apagar exigiria dono
  da tabela, que é justamente o que o append-only existe para impedir.

### A intermitência que continua sem diagnóstico

Cerca de **1 execução em 8** da suíte falha um teste, sem padrão identificado.
**Não é** o teto de 5s (subiu para 30s em `vitest.config.ts`), **não é** colisão
de telefone (o sorteio agora é por execução), e os testes de retenção passam
`clienteId`, então não varrem o banco de outra suíte em paralelo. Rodar de novo
passa. Está escrito para não virar de novo "roda de novo que passa" sem
ninguém olhar.

---

## 6. O que o dono decidiu, e que não se renegocia sem ele

1. **A conta é do cliente e ele faz tudo nela** — cria, edita, publica, apaga.
   Nós somos administradores de contas, não donos dos fluxos.
2. **Sidebar à esquerda, não abas no topo.** Foi explícito e enfático. Feito.
3. **Etapa A só com o obrigatório.** Cada tela nova é superfície, e superfície
   custa manutenção para sempre. Kanban, notificações, idioma, ajuda e
   comunidade ficaram para a Etapa C. Vale para item de menu também: a barra
   lateral só lista o que tem tela.
4. **Nada de conectar número por QR.** Perder o número do cliente é o pior
   fracasso possível para uma agência. Só Cloud API oficial.
5. **Nada de iPaaS embutido.** Integração é preset de bloco `http`, com
   RD Station primeiro.
6. **Mandar o cliente usar n8n/Zapier/Make não é resposta aceitável.** Faltou
   peça? Constrói a peça.

---

## 7. Perguntas em aberto para o dono

A lista completa, com o que cada uma trava e o passo a passo, mora em
[PENDENCIAS-DO-DONO.md](PENDENCIAS-DO-DONO.md). O resumo:

- **O primeiro administrador** — nome, e-mail e senha. É o §4.1, e é o que
  destrava tudo que foi construído nesta rodada.
- `ALERTA_WEBHOOK_URL` — precisa da URL do Discord/Slack.
- **A mídia nunca foi provada no WhatsApp real.** O bloco é testado ponta a
  ponta com o canal mock, mas nenhuma foto saiu pela Cloud API de verdade. São
  cinco minutos com o Cliente 00.
- O painel do cliente ("eu entro e vejo meus lucros") está **em espera** a
  pedido dele, aguardando mais prints. Não temos dado de dinheiro; o caminho
  honesto é ler valor fechado do CRM na Etapa B.
