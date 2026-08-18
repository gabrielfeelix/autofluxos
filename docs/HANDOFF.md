# Handoff — 18/ago/2026

Para quem pegar este projeto agora. Leia isto, depois
[PLANO-SISTEMA.md](PLANO-SISTEMA.md), e só então código.

---

## 1. Onde exatamente paramos

**Etapa A1 (login, contas, papéis) — fundação de banco pronta, nenhuma tela
existe ainda.** As migrations `0019`, `0020` e `0021` estão **aplicadas em
produção**. `src/server/auth.ts` está configurado e testado contra o banco real.
**Nenhuma rota, nenhuma página e nenhum componente usa isso ainda.**

O painel continua funcionando exatamente como antes, com a **senha única**
(`PAINEL_SENHA` + cookie assinado em `lib/painel-auth.ts`). Os dois sistemas de
sessão convivem de propósito: o novo não foi ligado a nada, então não há como
ele quebrar o que está no ar.

`npm test` → **386 passando, 8 pulados**. `typecheck`, `lint` e `build` limpos.
Os 8 pulados dependem de `IA_TESTE_REAL` e `API_TESTE_REAL` — é por desenho.

### O que existe de verdade no banco agora

| Tabela | O que é |
|---|---|
| `af_usuarios` | usuários (Better Auth). **Não** é `auth.users`, que é global e da Verandi |
| `af_sessoes` | sessões, com `impersonatedBy` e `activeOrganizationId` |
| `af_contas` | credenciais — guarda **hash** de senha |
| `af_verificacoes` | tokens de verificação |
| `af_membros` | usuário × conta × papel (`owner`/`admin`/`member`) |
| `af_convites` | convites pendentes |
| `af_auditoria` | quem fez o quê. **Append-only** |
| `clients` | ganhou `slug` (único, NOT NULL, com gatilho) e `metadata` |

---

## 2. As sete coisas que você precisa saber antes de tocar em qualquer coisa

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
`default gen_random_uuid()` na chave, ou o insert chega com `id` nulo. Isso
custou uma rodada.

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

### 2.6 Versão publicada é imutável, inclusive para nós

`flow_versions` guarda o grafo e a sessão fica presa à versão em que começou.
Mudar o formato de um bloco **mata toda conversa em andamento**. O caminho é
sempre ler os dois formatos e normalizar na leitura — nunca reescrever
`flow_versions.grafo`. Isso vai importar muito na frente **A3**.

### 2.7 A auditoria não pode ser editada pela aplicação

`service_role` tem só `insert` e `select` em `af_auditoria`. Não escreva
função de apagar; não existe permissão. Na primeira escrita da `0021` sobrou
`truncate`, que tornava tudo decorativo — `revoke all` e conceder só o que
entra.

---

## 3. Ambiente

### Variáveis

| Variável | `.env` local | Vercel | Observação |
|---|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | ✅ | ✅ | |
| `META_APP_SECRET`, `WHATSAPP_TOKEN`, `WHATSAPP_VERIFY_TOKEN` | ✅ | ✅ | |
| `GEMINI_API_KEY` | ✅ | ✅ | entrou em 17/ago — **nunca tinha existido em produção**, então o bloco de IA jamais funcionou lá |
| `PAINEL_SENHA` | ✅ | ✅ | senha única, ainda em uso |
| `PAINEL_SEGREDO` | ✅ | ✅ | trocar encerra todas as sessões |
| `CRON_SECRET` | ✅ | ✅ | sem ela a retenção responde 503 |
| `DATABASE_URL` | ✅ | ✅ | pooler **6543**, não 5432 |
| `BETTER_AUTH_SECRET` | ✅ | ✅ | |
| `ALERTA_WEBHOOK_URL` | ❌ | ❌ | **a única que falta.** Precisa de URL de Discord/Slack que só o dono cria. Sem ela `alertar()` é no-op e falha de entrega não avisa ninguém |

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

A frente **A1** continua. Falta a parte visível:

1. **Rota do Better Auth** — `app/api/auth/[...all]/route.ts` com o handler.
   Atenção: `src/server/auth.ts` chama `pool()` no topo do módulo e **estoura
   sem `DATABASE_URL`**. Hoje nada o importa, por isso o build passa.
2. **Telas de entrar / criar conta**, e a primeira conta de verdade.
3. **Sidebar do cliente** (7 itens — `Quadros` só na Etapa C) e **área do
   administrador**. Fim das abas no topo: é o pedido explícito do dono.
4. **"Entrar como"** + a faixa fixa no topo avisando de quem é a conta.
5. **A varredura de isolamento** — hoje todo repositório assume "quem está
   logado pode tudo em qualquer cliente". Precisa provar **de qual conta** a
   pessoa é. Inclui o furo conhecido: `/api/simular` aceita fluxo inventado +
   `fluxoId` de qualquer cliente e manda a credencial dele para a URL do corpo.
   Inofensivo hoje porque a senha única já dá acesso a tudo; **escalada de
   privilégio no minuto em que o cliente logar.**
6. Só então trocar a senha única pelo login por usuário. Enquanto os dois
   convivem, nada quebra.

Depois disso: **A3** (bloco de mensagem em pilha) e **A4** (a cadeia de
atendimento). A A4 é a mais importante e a menos óbvia — leia
[PLANO-SISTEMA.md §3.10.1](PLANO-SISTEMA.md).

---

## 5. Armadilhas que já custaram caro nesta base

Além das de [ESTADO.md](ESTADO.md), que continuam valendo:

- **Interpolar dentro de estrutura sem escapar.** O que a pessoa digita no
  WhatsApp entra em URL, corpo JSON e cabeçalho. Use `core/engine/interpolar.ts`.
- **Exceção solta no `after()` do webhook.** A mensagem já foi deduplicada; se
  a sessão não for salva, a pessoa fica sem resposta e a Meta não reenvia.
- **Identidade vinda do corpo da requisição.** Desenho pode vir de fora;
  identidade sai do banco.
- **Duas coisas com o mesmo sintoma escondem uma à outra.** "Falha que some ao
  rodar de novo" foi atribuída ao relógio do WSL2 por semanas — era o teto de 5s
  do Vitest contra banco remoto **e** telefone de teste derivado de `Date.now()`.
- **Testes rodam contra o Supabase de produção.** Eles limpam o que criam, mas
  uma execução que quebra no meio deixa lixo — oito clientes `zz-*` órfãos foram
  apagados em 17/ago. Se a lista de clientes tiver `zz-`, é isso.

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
2. **Sidebar à esquerda, não abas no topo.** Foi explícito e enfático.
3. **Etapa A só com o obrigatório.** Cada tela nova é superfície, e superfície
   custa manutenção para sempre. Kanban, notificações, idioma, ajuda e
   comunidade ficaram para a Etapa C.
4. **Nada de conectar número por QR.** Perder o número do cliente é o pior
   fracasso possível para uma agência. Só Cloud API oficial.
5. **Nada de iPaaS embutido.** Integração é preset de bloco `http`, com
   RD Station primeiro.
6. **Mandar o cliente usar n8n/Zapier/Make não é resposta aceitável.** Faltou
   peça? Constrói a peça.

---

## 7. Perguntas em aberto para o dono

- `ALERTA_WEBHOOK_URL` — precisa da URL do Discord/Slack.
- **A mídia nunca foi provada no WhatsApp real.** O bloco é testado ponta a
  ponta com o canal mock, mas nenhuma foto saiu pela Cloud API de verdade. São
  cinco minutos com o Cliente 00.
- O painel do cliente ("eu entro e vejo meus lucros") está **em espera** a
  pedido dele, aguardando mais prints. Não temos dado de dinheiro; o caminho
  honesto é ler valor fechado do CRM na Etapa B.
