# Plano de endurecimento — do MVP que funciona ao sistema que aguenta

**Objetivo:** fechar as portas abertas, matar os bugs que só aparecem com
tráfego real, e dar ao projeto o mínimo que separa "funciona na minha máquina"
de "funciona sem alguém olhando".

**Como ler:** são **nove blocos**, em ordem de execução. Cada bloco entrega
software funcionando sozinho e pode parar ali. As decisões técnicas já estão
tomadas aqui — quando um bloco entrar em execução, ele vira um plano de tarefas
com passos de 2 a 5 minutos, escrito na hora, com o código de cada passo.

**Fora do plano, de propósito:** qualquer coisa paga. Backup com PITR do
Supabase é o caso — ficou de fora. (Se um dia incomodar, o caminho grátis é um
`pg_dump` agendado guardando artefato **privado**; nunca no repositório, que é
público.)

---

## As regras que este plano não quebra

São as mesmas do [ESTADO.md](ESTADO.md), repetidas porque todo bloco abaixo
esbarra em pelo menos uma:

1. `src/core/` não faz rede, não importa Next, WhatsApp nem banco.
2. O motor nunca vê segredo.
3. Recusa de tela é conveniência; a que vale é a do servidor.
4. Nada pode estourar dentro do `after()` do webhook — falha vira handoff.
5. n8n/Zapier/Make não são resposta. Faltou peça, constrói a peça.

---

## Ordem, e por que é esta

```
1. CI  ✅              protege todos os outros
2. Corrida de sessão      bug real esperando tráfego
3. Portas abertas         limite, teto de corpo, noindex
4. Escrita cruzada        barato, e é pré-requisito de papéis
5. Rollback de versão     rede de segurança pra publicar sem medo
6. Observabilidade        pra saber que algo quebrou antes do cliente ligar
7. Sessão do painel       expira, revoga, e é única
8. Leads que aguentam     paginação, busca, CSV, apagar (LGPD)
9. Mobile e acessibilidade
```

O CI vem primeiro porque tudo depois dele fica mais barato de conferir. A
corrida de sessão vem antes das portas abertas porque é o único item da lista
que **já está errado hoje** — os outros são riscos, esse é um defeito.

Papéis de usuário (a tarefa nº1 do ESTADO) **não** está aqui: ela é grande o
bastante para ter plano próprio, e os blocos 4 e 7 existem justamente para ela
começar com menos dívida.

---

## Bloco 1 — CI ✅ FEITO

> **Duas correções ao que estava escrito aqui**, descobertas ao executar:
>
> 1. **`next lint` não existe mais.** Foi removido no Next 16 em favor do CLI
>    do ESLint. O script é `eslint .`, e a configuração é *flat config*
>    (`eslint.config.mjs`), não `.eslintrc`.
> 2. **`eslint-config-next` não traz as regras base do ESLint.** Sem
>    `js.configs.recommended`, o `// eslint-disable-next-line no-control-regex`
>    que já existia em `interpolar.ts` era um comentário morto — a regra nunca
>    rodou. Com as regras base ligadas ele passa a valer, e a base ficou limpa
>    na primeira passada (só um aviso, no `postcss.config.mjs`, corrigido).
>
> Isso é o motivo de os blocos seguintes serem detalhados na hora de executar,
> e não agora: plano escrito com antecedência erra nos detalhes que só a
> execução mostra.


**Por que primeiro:** hoje nada roda `npm test`, `npm run typecheck` nem
`npm run build` antes de subir. Todo bloco seguinte deste plano fica mais
seguro com isso no lugar, e é o mais barato da lista.

**Decisão tomada — os testes de banco pulam sozinhos no CI.** `repos.test.ts`,
`leads.test.ts` e `receber-mensagem.test.ts` já usam
`describe.skipIf(!temCredencial)`: sem `SUPABASE_URL` no ambiente, eles se
pulam e sobram os ~150 testes puros (motor, validador, interpolação, rede,
janela, prompt, auth). **Não vamos colocar a chave secreta do Supabase como
secret do GitHub** — o repositório é público, e um workflow mal escrito num PR
de fora leria o segredo. CI roda o que é puro; o que fala com banco roda na
máquina antes do push.

**Decisão tomada — ESLint entra, e com `eslint-config-next`.** O código já tem
`// eslint-disable-next-line no-control-regex` e regras de `react-hooks`
citadas em comentário: o projeto sempre supôs ESLint e nunca o teve.

**Arquivos:**
- Criar: `.github/workflows/ci.yml`
- Criar: `eslint.config.mjs`
- Modificar: `package.json` (script `lint`, devDeps `eslint` e `eslint-config-next`)

**Pronto quando:** um push em `main` e um PR rodam typecheck + lint + testes
puros + build, e o resultado aparece no GitHub. Um `tsc` quebrado barra o merge.

**Tamanho:** meia hora.

### Tarefas detalhadas

- [ ] **1.1 — Instalar o ESLint**

```bash
npm i -D eslint eslint-config-next
```

- [ ] **1.2 — Criar `eslint.config.mjs`**

```js
import next from 'eslint-config-next'

/**
 * O mínimo que pega o que a revisão humana não pega: dependência faltando em
 * hook, `<a>` onde devia ser `<Link>`, import de servidor em componente de
 * cliente. Sem regra de estilo — o formato do código aqui é consistente
 * porque foi escrito com cuidado, e brigar com isso via lint só dá ruído.
 */
export default [
  ...next,
  { ignores: ['.next/**', 'node_modules/**', 'tsconfig.tsbuildinfo'] },
]
```

- [ ] **1.3 — Adicionar o script**

Em `package.json`, dentro de `scripts`:

```json
"lint": "eslint ."
```

(`next lint` foi removido no Next 16.)

- [ ] **1.4 — Rodar e ver o que está sujo**

Run: `npm run lint`
Esperado: passa, ou aponta um punhado de avisos. **Corrigir o que apontar
antes de seguir** — CI que nasce vermelho é CI que todo mundo aprende a
ignorar. Se alguma regra for barulho de verdade, desligue-a no
`eslint.config.mjs` com um comentário dizendo por quê.

- [ ] **1.5 — Criar `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  conferir:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm

      - run: npm ci

      - name: Tipos
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      # Sem SUPABASE_URL no ambiente, os testes que falam com o banco se pulam
      # sozinhos (describe.skipIf) e sobram os puros. É de propósito: o repo é
      # público, e chave secreta em secret do GitHub vira chave lida por um PR
      # de fora.
      - name: Testes
        run: npm test

      - name: Build
        run: npm run build
```

- [ ] **1.6 — Conferir que os testes puros passam sem banco**

Run: `env -u SUPABASE_URL -u SUPABASE_SECRET_KEY npm test`
Esperado: PASS, com os arquivos de banco marcados como pulados.

- [ ] **1.7 — Commit e conferir no GitHub**

```bash
git add .github eslint.config.mjs package.json package-lock.json
git commit -m "ci: typecheck, lint, testes e build a cada push"
git push
gh run watch
```

---

## Bloco 2 — Corrida de sessão

**O defeito:** duas mensagens da mesma pessoa chegam quase juntas, viram dois
`after()` concorrentes, os dois leem a mesma sessão, os dois gravam. A última
escrita ganha e a conversa pula um passo. O mesmo vale para `guardarCampo`, que
sobrescreve o objeto de campos inteiro. Alguém digitando rápido no WhatsApp
reproduz isso — não é hipótese, é o comportamento normal de quem manda "oi" e
"tudo bem?" em seguida.

**Decisão tomada — trava por contato numa tabela, não `pg_advisory_lock`.** O
advisory lock de sessão é preso à conexão, e o Supabase serve por *pooler*: a
conexão que pega a trava não é necessariamente a que a solta. Uma tabela de
travas com prazo é chata e funciona.

**Decisão tomada — quem não pega a trava espera, não desiste.** A mensagem já
foi deduplicada em `registrarEntrada`; desistir significa a pessoa nunca receber
resposta. Espera com recuo até ~20s (cabe no `maxDuration` de 60s), e só então
desiste registrando handoff.

**Decisão tomada — a trava tem prazo curto e é renovada, não eterna.** Função
que morre no meio não pode deixar um contato mudo para sempre.

**Arquivos:**
- Criar: `supabase/migrations/0007_travas.sql`
- Criar: `src/server/repos/travas.ts`
- Modificar: `src/server/receber-mensagem.ts` (envolver `tratarUma`)
- Modificar: `src/server/efeitos/resolver.ts` (`MAX_EFEITOS` estourado vira handoff)
- Teste: `src/server/receber-mensagem.test.ts`

**O que entra junto, porque é o mesmo arquivo e o mesmo risco:**
- `MAX_EFEITOS` estourando em silêncio → passa a virar handoff com motivo.
- Mensagem enviada e não registrada (a função morre entre `enviarTexto` e
  `registrarSaida`): `messages` ganha `entregue boolean not null default true`,
  a linha nasce `false` antes do envio e vira `true` depois. A tela do lead
  marca as `false` como "envio não confirmado" em vez de mentir que chegou.

**Pronto quando:** um teste dispara duas mensagens do mesmo contato em paralelo
e a conversa avança **um passo por mensagem, na ordem** — hoje ele falha.

**Tamanho:** meio dia.

---

## Bloco 3 — As portas abertas

Três coisas independentes, no mesmo bloco porque as três são "alguém de fora
consegue nos custar dinheiro ou acesso".

**3a — Limite de tentativas.** Não existe nada hoje. `/login` aceita tentativa
infinita, e com senha única isso é força bruta viável. `/api/simular` chama o
Gemini e a internet **com a nossa chave**, sem teto.

> **Decisão tomada — o contador mora no Postgres que já temos, não no Upstash.**
> Rate limit em memória não vale nada em serverless (cada instância tem o seu).
> Upstash/Vercel KV têm plano grátis, mas é mais um cadastro, mais uma chave no
> cofre e mais um lugar que pode cair. Uma tabela com uma função `SQL` resolve:
> `consumir_limite(chave text, teto int, janela_segundos int) returns boolean`,
> atômica num `insert ... on conflict do update`.

**3b — Teto de corpo no `/api/simular`.** Aceita fluxo de qualquer tamanho e
roda até `MAX_EFEITOS` chamadas HTTP de 10s. Um fluxo forjado com dez nós de API
são 60s de função e requisições saindo do nosso IP para onde quem chamou quiser.
Entra: recusa acima de 256 KB de corpo, e acima de 200 nós no fluxo.

**3c — `noindex` no painel.** `/login` é público e indexável hoje.

**Arquivos:**
- Criar: `supabase/migrations/0008_limites.sql`
- Criar: `src/server/limite.ts`
- Criar: `public/robots.txt`
- Modificar: `src/server/auth-actions.ts`, `src/app/api/simular/route.ts`,
  `src/app/layout.tsx`
- Teste: `src/server/limite.test.ts`

**Pronto quando:** a sexta tentativa de login do mesmo IP em cinco minutos é
recusada com "muitas tentativas, espere"; um corpo de 300 KB no `/api/simular`
volta 413; e `curl -s https://autofluxos.4yu.com.br/robots.txt` proíbe tudo.

**Tamanho:** meio dia.

---

## Bloco 4 — Escrita cruzada entre clientes

**O buraco:** `acaoSalvarRascunho`, `acaoPublicar` e `acaoAlternarIa` recebem
`fluxoId` e **não provam que o fluxo é do cliente**. No repo, `salvarRascunho` e
`definirIa` fazem `.eq('id', ...)` e pronto. `apagarFluxo` e as conexões já
fazem o par `(id, cliente)`; essas três não.

Hoje é inofensivo — a senha única já dá acesso a tudo. No dia do login do
cliente, vira escrita de um cliente no fluxo de outro. É barato agora e caro
depois, e por isso não espera papéis de usuário: espera **destrava** papéis de
usuário.

**Arquivos:**
- Modificar: `src/server/repos/fluxos.ts` (`salvarRascunho`, `definirIa`,
  `publicar` passam a exigir `clienteId`)
- Modificar: `src/server/acoes.ts` (as três ações)
- Modificar: `src/components/editor/editor.tsx` (já tem `clienteId` em mãos)
- Teste: `src/server/repos/repos.test.ts`

**Pronto quando:** existe um teste "não salva o rascunho de um cliente pelo id
de outro", igual ao que já existe para apagar.

**Tamanho:** duas horas.

---

## Bloco 5 — Rollback de versão

**Por que agora:** publicar é a ação mais consequente do produto — o desenho
passa a atender gente de verdade. Hoje, publicado errado, o único caminho é
redesenhar e publicar de novo, com o desenho ruim no ar enquanto isso.

**O caminho é curto, e é por isso que este bloco é pequeno:** as versões já são
imutáveis (`flow_versions`, com gatilho que recusa alteração), `listarVersoes`
já existe no repo — e **nenhuma tela usa** — e `publicar()` já aceita um grafo
qualquer. Voltar para a v2 é publicar o grafo da v2, o que gera a v5. O
histórico nunca reescreve, só cresce.

**Decisão tomada — voltar publica de novo, não "aponta de volta".** Apontar
`versao_publicada_id` para uma versão antiga deixaria buracos na numeração e
tornaria "o que está no ar" uma pergunta com duas respostas.

**Arquivos:**
- Criar: `src/components/editor/versoes.tsx`
- Modificar: `src/server/acoes.ts` (`acaoVoltarParaVersao`)
- Modificar: `src/server/repos/fluxos.ts` (`acharVersao` já serve)
- Modificar: `src/app/clientes/[clienteId]/fluxos/[fluxoId]/page.tsx`
- Teste: `src/server/repos/repos.test.ts`

**Pronto quando:** o editor lista as versões publicadas com data, e "voltar para
esta" põe o desenho antigo no ar como versão nova — com a confirmação em texto
que o publicar normal já dá.

**Tamanho:** meio dia.

---

## Bloco 6 — Observabilidade

**O buraco:** `console.error` na Vercel e mais nada. Uma exceção dentro do
`after()` do webhook — justamente a que deixa o cliente sem resposta — é
invisível até alguém reclamar.

**Decisão tomada — aviso por webhook, não Sentry.** O plano grátis do Sentry
existe, mas é mais um cadastro, mais um SDK no bundle e mais um lugar para
manter. O que resolve 90% aqui é uma função `alertar()` que faz POST num
webhook de Discord vindo do ambiente (`ALERTA_WEBHOOK_URL`), com no-op quando a
variável não existe — então dev e CI não disparam nada. Se um dia o volume
justificar, Sentry entra por cima disso sem reescrever nada.

**Onde ela é chamada, e só aí:** falha no `after()` do webhook, falha de entrega
na Cloud API, e erro ao ler credencial do cofre. Três lugares. Alerta que toca
para tudo é alerta que ninguém lê.

**Arquivos:**
- Criar: `src/server/alertar.ts`
- Modificar: `src/app/api/webhook/whatsapp/route.ts`,
  `src/server/receber-mensagem.ts`, `src/server/efeitos/resolver.ts`
- Modificar: `.env.example`
- Teste: `src/server/alertar.test.ts`

**Pronto quando:** derrubar o `WHATSAPP_TOKEN` de propósito e mandar uma
mensagem faz chegar um aviso, com o motivo, sem ninguém estar olhando a Vercel.

**Tamanho:** duas horas.

---

## Bloco 7 — Sessão do painel de verdade

**O buraco:** o cookie é `SHA-256(senha)`. Sem nonce, sem carimbo de tempo, sem
registro no servidor. Não expira (o `maxAge` de 12h é só o navegador), não dá
para revogar um acesso, e cookie copiado vale para sempre.

**Decisão tomada — cookie assinado, não sessão em banco.** A tentação é uma
tabela `painel_sessions`, mas quem confere a sessão é o `proxy.ts`, que roda
antes da renderização e não é lugar de ir ao banco a cada requisição. Um cookie
`HMAC(segredo, id|expira) . id . expira`, verificado com Web Crypto, dá o que
falta sem nenhuma consulta: **é único por sessão** (id aleatório), **expira de
verdade** (o servidor confere), e **revoga todo mundo** ao trocar o segredo.

Revogar *uma* sessão específica continua exigindo banco — e isso é problema de
papéis de usuário, quando existir mais de uma pessoa. Fica escrito, não fica
feito.

**Arquivos:**
- Modificar: `src/lib/painel-auth.ts` (assinar/verificar)
- Modificar: `src/proxy.ts`, `src/server/auth-actions.ts`
- Modificar: `.env.example` (`PAINEL_SEGREDO`, separado de `PAINEL_SENHA`)
- Teste: `src/lib/painel-auth.test.ts`

**Pronto quando:** um cookie com `expira` no passado é recusado; um cookie com o
HMAC mexido é recusado; trocar `PAINEL_SEGREDO` derruba todas as sessões.

**Tamanho:** meio dia.

---

## Bloco 8 — Leads que aguentam volume, e o direito de sumir

Quatro coisas na mesma tela:

**8a — Paginação.** `listarLeads` traz tudo, sempre. Cinquenta leads é uma tela
lenta; quinhentos é uma tela que não abre.

**8b — Busca** por nome e telefone. Hoje não existe, e achar um lead é rolar.

**8c — Exportar CSV.** Pedido óbvio de agência, hoje impossível.

**8d — Apagar contato, e retenção automática (LGPD).** Nada apaga contato,
mensagem ou lead, nunca. Conversa de WhatsApp é dado pessoal de terceiro — não
do cliente, **do cliente do cliente**. Falta um botão de apagar e uma política.

> **Decisão tomada — a retenção roda no banco, com `pg_cron`.** O Supabase free
> tem a extensão. Cron na Vercel gastaria uma função por dia para fazer um
> `delete` que o Postgres faz melhor sozinho. Padrão: apaga mensagem com mais de
> 12 meses; contato sem mensagem nenhuma há 12 meses vai junto. O número é
> configurável na migration e está escrito lá, não no código.

**Arquivos:**
- Criar: `supabase/migrations/0009_retencao.sql`
- Criar: `src/app/clientes/[clienteId]/leads/exportar/route.ts`
- Modificar: `src/server/repos/leads.ts` (paginação + busca),
  `src/app/clientes/[clienteId]/leads/page.tsx`, `src/server/acoes.ts`
- Teste: `src/server/repos/leads.test.ts`

**Pronto quando:** a tela abre em página de 50, a busca por telefone acha, o
CSV baixa com os campos coletados, e existe um teste provando que a retenção
apaga o que passou do prazo e **não** apaga o que não passou.

**Tamanho:** um dia.

---

## Bloco 9 — Mobile e acessibilidade

**Mobile:** o painel é desktop-only — `grid-cols-2` fixo, aside de 356px,
editor de tela cheia. Ver um lead no celular é caso real (o handoff acontece na
rua) e hoje não funciona. **Escopo honesto: as telas de leitura viram
responsivas** (clientes, cliente, leads, lead) e o **editor continua desktop** —
desenhar fluxo arrastando bloco no celular não é um problema que vale resolver
agora, e fingir que resolve é pior.

**Acessibilidade:** não foi auditada. O que já sei: `confirm()` nativo no
`BotaoPerigo`, foco não gerenciado ao abrir e fechar `<dialog>`, contraste nunca
medido, e o editor inteiro é ponteiro-e-arrasto sem alternativa por teclado.
Entra uma passada com a skill `accessibility` e o conserto do que ela achar de
nível A e AA nas telas de leitura.

**Pronto quando:** as quatro telas de leitura funcionam em 390px de largura sem
rolagem horizontal, e a auditoria não acusa violação de nível A.

**Tamanho:** um dia.

---

## O que fica de fora, e por quê

| O quê | Por quê |
|---|---|
| **Backup com PITR** | Pago. Pedido para ficar fora. |
| **Papéis de usuário** | Grande demais; plano próprio. Os blocos 4 e 7 existem para ela começar com menos dívida. |
| **Templates da Meta** | Depende da verificação da empresa sair, que não é código. Fila nº2 do ESTADO. |
| **Log de auditoria com autor** | Sem identidade não há autor para registrar. Vai junto com papéis de usuário. |
| **CSP completa com nonce** | O Next injeta script inline; fazer isso direito exige mexer no `layout.tsx` e testar hidratação. Vale, mas depois — `frame-ancestors` já cobre o ataque que existia. |
| **Reentrega com fila** | Falha de envio já vira handoff, que é correto e visível. Fila com recuo é melhoria, não conserto — e merece um cliente com volume antes. |
| **Apagar cliente** | Cabe no bloco 8, mas a confirmação precisa ser mais forte que um `confirm()` (digitar o nome). Fica na fila do ESTADO até lá. |

---

## Se for fazer só três coisas

Bloco 1 (CI), bloco 2 (corrida de sessão) e bloco 3 (portas abertas). O primeiro
protege tudo, o segundo é o único defeito que já existe hoje, e o terceiro fecha
o que alguém de fora consegue explorar. Os outros seis são o que separa bom de
profissional — mas esses três são o que separa profissional de arriscado.
