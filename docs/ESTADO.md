# Onde paramos — 11/ago/2026

Documento de retomada. Quem chegar aqui sem ter acompanhado a construção
consegue continuar lendo só isto e o [ARQUITETURA.md](ARQUITETURA.md).

---

## PRÓXIMO AGENTE: comece por aqui

**O lado da Meta está travado por limite de tempo e não é para ser perseguido.**
Não peça ao Gabriel para clicar, verificar ou conferir nada no painel da Meta —
o bloqueio é por tempo, não por configuração. Se ele mesmo trouxer o assunto,
retome pela seção "O que está travado".

**O passo 7 está feito.** A Etapa 1 está construída inteira. O que sobra é a
verificação do número, que é da Meta, não nossa.

### O que existe agora (passo 7)

- View `leads` no banco (migration `0004`), juntando `contacts` + a última
  mensagem + o handoff aberto. A agregação é do Postgres de propósito: fazer
  isso no TypeScript exigiria puxar todas as mensagens de todo mundo para
  ordenar por "última mensagem".
- `src/server/repos/leads.ts` — `listarLeads`, `acharLead`, `lerConversa`.
- `/clientes/[clienteId]/leads` — a tabela, com **as colunas saindo dos dados**
  (`contacts.campos` é `jsonb` e as chaves mudam por fluxo; nada chumbado).
- `/clientes/[clienteId]/leads/[contatoId]` — os campos coletados e a conversa
  inteira, entrada de um lado, saída do outro.
- 7 testes novos em `src/server/repos/leads.test.ts`, contra o Supabase real.

Duas coisas que valem saber antes de mexer:

1. **A view é `security_invoker = true`.** Sem isso ela rodaria com os direitos
   de quem a criou e passaria por cima da RLS — a chave `publishable`, que vai
   para o navegador, leria a conversa de todo mundo. Está provado: com a chave
   `publishable` a view responde `401 permission denied`.
2. **`acharLead` filtra por cliente também**, não só pelo id do contato. A URL é
   adivinhável.

### O que fazer em seguida

1. **Gabriel testar o editor** de verdade — arrastar bloco, ligar setinha,
   conversar na aba Testar. É a única parte que nunca foi verificada com
   navegador.
2. **Verificação de empresa na Meta** (Portfólio - 4YU está "não verificada").
   Demora e não trava hoje, mas trava cliente real depois.
3. **Etapa 2 (IA) — o módulo existe.** `server/ia/`: prompt de escopo fechado
   (puro, com teste), adaptador do Gemini, e `conduzir.ts` que resolve o
   `chamar_ia` do motor. Ligado no simulador e no WhatsApp. A flag é
   `flows.ia_habilitada` (0005) — **por automação, não por cliente**.

   O que falta: chave paga por cliente (`clients.ia_chave_ref` → Vault). Hoje
   roda com uma chave da 4YU, boa para demonstração e **não** para conversa de
   cliente final — o free tier do Google treina modelo com o que passa.

   **Cota medida:** free tier é por modelo e por dia; `gemini-flash-latest` dá
   **20/dia**. Trocar em `GEMINI_MODELO` usa outra cota. Os testes que chamam o
   Gemini de verdade só rodam com `IA_TESTE_REAL=1`, justamente para não gastar
   a cota que sustenta uma demonstração.
4. Se um dia a lista de leads crescer: paginar `listarLeads` e um filtro de
   "só quem espera atendimento". Hoje seria enfeite.

### Regras do projeto que não podem ser quebradas

- **`src/core/` não sabe o nome de nenhum cliente** e não importa nada de Next,
  do WhatsApp ou do banco. Se uma feature parece exigir isso, ela é
  configuração, não código.
- **Zod garante a estrutura; `validar()` garante o sentido.** Não devolva regra
  de qualidade para o schema — o editor quebra a cada tecla.
- **Segredo nunca entra no repo.** Ele é público. Tudo em
  `4yu-apps/.secrets/4yu.env`, prefixo `AUTOFLUXOS_`.
- **RLS está ligada e sem política de propósito.** Todo acesso é servidor, com a
  chave `secret`. Não crie política — nem view sem `security_invoker` — para
  "facilitar".
- Antes de dizer que algo funciona, **rode**: `npm test`, `npx tsc --noEmit`,
  `npm run build`.
- **`notFound()` tem que acontecer antes de qualquer `<Suspense>`.** Depois que
  o Next começa a enviar a página, o status já foi: "não encontrado" viraria
  200. Por isso as telas buscam o dono primeiro e só então transmitem o resto.
  Nunca crie um `loading.tsx` acima de uma tela que chama `notFound()` — ele é
  exatamente essa fronteira, e desfaz isso em silêncio.

### Comandos

```bash
npm run dev                 # http://localhost:3000
npm test                    # 64 testes (os de banco pulam sem .env)
```

**Não precisa publicar na mão.** A Vercel está ligada no GitHub e sobe produção
a cada push na `main`. O comando manual existe (`npx vercel deploy --prod --yes
--token "$VERCEL_TOKEN"`), mas usar os dois gera dois deploys da mesma coisa.

Migration nova vai pela Management API:

```bash
set -a && . /home/gabfelix/dev/4yu-apps/.secrets/4yu.env && set +a
python3 -c "import json;print(json.dumps({'query': open('supabase/migrations/0004_leads.sql').read()}))" > /tmp/q.json
curl -sS -X POST "https://api.supabase.com/v1/projects/$AUTOFLUXOS_SUPABASE_PROJECT_REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H 'Content-Type: application/json' --data @/tmp/q.json
```

### Quando o Gabriel disser que verificou o número

Falta só registrar o PIN de 2 fatores. É uma chamada, com o token que já está
no cofre:

```bash
set -a && . /home/gabfelix/dev/4yu-apps/.secrets/4yu.env && set +a
curl -s -X POST "https://graph.facebook.com/v25.0/$AUTOFLUXOS_WA_PHONE_NUMBER_ID/register" \
  -H "Authorization: Bearer $AUTOFLUXOS_WA_TOKEN" -H 'content-type: application/json' \
  -d '{"messaging_product":"whatsapp","pin":"482913"}'
```

Guarde o PIN escolhido em `.secrets` como `AUTOFLUXOS_WA_PIN` — ele é pedido de
novo se o número for movido. Depois disso, o Gabriel manda "oi" para
**+55 44 7400-7438** e o bot responde: o painel já tem `Cliente 00 — Gabriel`
com o fluxo publicado e o número conectado.

---

## O produto em uma frase

Sistema onde a 4YU desenha fluxos de atendimento no WhatsApp para clientes.
**Não é o bot de um cliente — é a chave mestre** onde o bot de qualquer cliente
cabe sem tocar em código.

Três etapas, cada uma vendável sozinha:

| Etapa | O que é | Estado |
|---|---|---|
| 1 | Automação pura, sem IA — botões, opções, lead na tela | **construída — falta a Meta liberar o número** |
| 2 | Nó de IA, cobrado à parte, com a chave do cliente (BYOK) | não começou |
| 3 | Encaixar a Prelúdio **só configurando**, sem mexer no produto | não começou |

---

## Etapa 1 — o que está pronto

| # | Passo | Estado |
|---|---|---|
| 1 | Motor de fluxo + validador | ✅ |
| 2 | Simulador de conversa | ✅ |
| 3 | Clientes e fluxos no Supabase | ✅ |
| 4 | Editor visual (React Flow) | ✅ |
| 5 | Publicar + versionar | ✅ |
| 6 | Webhook + canal Cloud API | ✅ código pronto, **travado na Meta** |
| 7 | Tela de leads | ✅ |

**64 testes** passando (`npm test`), `tsc` limpo, `next build` limpo. Os testes de
banco e webhook falam com o Supabase de verdade e se pulam sozinhos sem `.env`.

---

## Onde as coisas estão

| O quê | Onde |
|---|---|
| Repositório | https://github.com/gabrielfeelix/autofluxos (**público**) |
| Painel no ar | https://autofluxos.4yu.com.br |
| Vercel | time `4-yu`, projeto `autofluxos`, região `gru1` (São Paulo) |
| Supabase | projeto `autofluxos`, ref `xxxynoshwirupkdzwxbj`, `sa-east-1` |
| App na Meta | `AutoFluxos`, id `1063817842847269`, portfólio `Portfólio - 4YU` (id `1494483661926723`) |
| Segredos | `4yu-apps/.secrets/4yu.env`, prefixo `AUTOFLUXOS_` |
| Token da Hostinger | `~/dev/radar-ofertas/.env`, variável `HOSTINGER_TOKEN` |

**Acesso ao painel:** usuário qualquer (só a senha é conferida), senha em
`AUTOFLUXOS_PAINEL_SENHA`. Ela apareceu uma vez no chat da construção — se
quiser trocar, gere outra e atualize a variável na Vercel.

**DNS:** `4yu.com.br` fica na Hostinger (nameservers `solar`/`lunar.dns-parking.com`).
O subdomínio é um `CNAME autofluxos → cname.vercel-dns.com`, criado pela API
deles. Mesmo padrão do `deixeiaqui` e do `www`.

---

## O que está travado — **uma coisa só**

**O número precisa ser verificado.** Nada além disso.

Estado do número (`+55 44 7400-7438`, phone_number_id `1301107846409860`):

- nome `4YU Tech` — **aprovado sem análise**
- `code_verification_status: NOT_VERIFIED`
- `status: PENDING`

Enviar falha com **`(#133010) Account not registered`** — que é exatamente o
esperado para número não verificado. Testado chamando a Cloud API direto.

Pedir o código muitas vezes derrubou no limite (`You have requested a
verification code too many times`). É por tempo; passa sozinho.

### Onde fica a tela (o caminho exato, para não procurar de novo)

No **Gerenciador de Negócios da Meta**, menu da esquerda:

```
Contas → Contas do WhatsApp → clicar em "4YU Tech" → aba "Phone numbers"
```

Ali aparece o número **com o status**. O botão de verificar fica nos **três
pontinhos (`...`) da linha do número** — ou clicando no próprio número.

### Quando o limite liberar

1. Nessa tela, confirmar que o número listado é o certo antes de gastar
   tentativa.
2. Verificar por **Ligação telefônica**, **uma vez só**, sem pedir reenvio.
3. Depois de verificado, falta registrar com um PIN de 2 fatores —
   `POST /{phone_number_id}/register`. Dá para fazer pela API com o token que já
   está no cofre; não precisa de painel.
4. Mandar "oi" do WhatsApp e ver o bot responder.

### O que já está pronto e testado em produção

- Webhook configurado na Meta e **assinado no campo `messages`**
- Assinatura HMAC validada com a chave real: correta → 200, errada → 401,
  ausente → 401, verificação GET → 200
- **Mensagem de verdade já entrou pelo webhook**, criou contato, criou sessão
  presa na versão publicada e **o motor avançou até a primeira pergunta**. Só o
  envio falhou, pelo número não registrado.
- Em 11/ago às 22:51 e 22:54 entraram mais dois "oi" — um de teste e um do
  número do Gabriel. Os dois viraram contato e **aparecem na tela de leads**,
  cada um com uma mensagem de `entrada` e **nenhuma de `saida`**. É o retrato
  exato do bloqueio: o que chega, chega; o que sai, não sai.
- Painel já tem `Cliente 00 — Gabriel` com o fluxo de triagem **publicado (v1)**
  e o número conectado.

### Segredos já no cofre (`.secrets/4yu.env`, prefixo `AUTOFLUXOS_`)

`META_APP_SECRET`, `WA_TOKEN` (usuário do sistema, permanente),
`WA_PHONE_NUMBER_ID`, `WA_WABA_ID`, `WA_VERIFY_TOKEN`, `PAINEL_SENHA`,
`SUPABASE_*`.

Todas já publicadas na Vercel e em produção.

---


## Contexto de negócio que não está no código

**Cliente 00 é o número de freelance do Gabriel.** O bot roda nele primeiro; a
Prelúdio só entra depois que funcionar. Todo susto acontece com a gente.

**Cliente 01 é a Prelúdio Produtora** (produtora de vídeo em São Paulo,
[preludiovideo.com](https://preludiovideo.com) — *a confirmar se é essa mesma*).
Cliente do sócio do Gabriel. Tráfego pago → WhatsApp → triagem na mão → agenda
ou liga. **Já fecha contrato bom.**

O problema dele é específico: **quem está em dúvida no preço trava e não
avança.** Lead quente converte; morno esfria.

**A pergunta central do projeto continua sem resposta, e é do cliente:**

> A Prelúdio topa o bot falar **faixa de preço**?

A hipótese é que o morno trava por falta de âncora, não por objeção real —
perguntou preço, ouviu "depende", leu como "vai ser caro". Se ela não topar, o
bot resolve outro problema, não o que ele contou. **Vale perguntar antes de
desenhar e antes de vender.**

Faltam também: os arquivos de abordagem dele (viram o desenho do fluxo, o
contexto da IA e a suíte de teste), o ticket médio e o volume de conversas.

**Preço combinado entre os sócios:** R$1.800 de setup (R$900 cada) e ~R$700/mês
de manutenção. **Os custos variáveis têm que ser faturados no cliente** — Meta
cobra ~R$0,20–0,50 por conversa e a IA é BYOK. Com o WABA no nome do cliente
(Embedded Signup), a Meta cobra ele direto e a manutenção fica limpa.

---

## Armadilhas já mapeadas (não repetir a pesquisa)

- **IA de propósito geral está proibida** na Business API desde 15/jan/2026. Bot
  task-oriented é permitido. Por isso o nó de IA é sempre fechado no contexto do
  cliente.
- **Free tier do Gemini treina modelo com os dados**, inclusive revisão humana.
  Não pode ver conversa real. Dev com dado fictício; produção com chave paga do
  cliente.
- **Evolution API está sendo caçada.** Perder o número do cliente é o pior
  fracasso possível para uma agência. Só Cloud API oficial.
- **Coexistence** (app + Cloud API no mesmo número) existe e resolve o handoff:
  o celular do cliente continua sendo o inbox, então não precisamos construir
  um. Exige onboarding por parceiro que suporte "business app number onboarding".
- **Embedded Signup v2 morre em 15/out/2026** — nascer no v4.
- **Limite de blocos:** 3 opções viram botões, até 10 viram lista, acima disso a
  Meta recusa. O validador bloqueia.
- **Supabase free:** 2 projetos ativos no total. Hoje `radar-ofertas` +
  `autofluxos`. Retomar o `Otimiza Gestor` (pausado) estoura o limite. Projeto
  free pausa após 1 semana sem requisição.
