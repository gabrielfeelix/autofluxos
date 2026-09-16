# Handoff — Fase 1: templates da Meta e disparo em massa

15/set/2026. Continua de `111df78`.

Leia antes: `docs/PLANO-15-SET-ENRIQUECER.md` (as 7 fases e as decisões) e
`docs/CONCORRENTES-15-SET.md` (por que cada coisa entrou).

---

## Onde parei

**A fase 1 está fechada em código.** Os nove itens da lista original foram
feitos, com teste, typecheck e build limpos. Nada foi aplicado em produção.

| # | Item | Onde ficou |
|---|---|---|
| 1 | `enviarTemplate` no canal | `channels/types.ts`, `channels/cloud-api.ts` |
| 2 | Criar/sincronizar na Meta | `channels/templates-api.ts`, `core/templates.ts` |
| 3 | Webhook de status do modelo | `server/receber-status-de-template.ts` |
| 4 | Reconciliação periódica | `server/reconciliar-templates.ts` |
| 5 | Repositórios | `server/repos/templates.ts`, `server/repos/transmissoes.ts` |
| 6 | Motor de disparo | `core/disparo.ts`, `server/disparar-transmissao.ts` |
| 7 | Webhook de status da mensagem | `server/receber-status-de-template.ts` |
| 8 | Telas | `app/clientes/[clienteId]/transmissoes/`, `components/transmissoes/` |
| 9 | Teto de `atraso_minutos` | `0061_passo_com_modelo.sql` + `core/sequencias.ts` |

**O que falta, e é o que importa agora: nada disso tocou um WhatsApp de
verdade.** Ver "O que ninguém provou ainda", abaixo.

### Duas coisas que o handoff anterior errava

- **Campos deprecados (item 4 das armadilhas) já estavam limpos.**
  `messaging_limit_tier` e `max_daily_conversation_per_phone` não aparecem em
  lugar nenhum do código. Não havia o que consertar.
- **A `0059` tinha um bug, e não foi pego por teste nenhum.** Ela redefinia
  `public.tocar_atualizado_em()` com `create or replace` **sem** `security
  invoker` nem `set search_path = ''`, que a 0001 tinha posto. Não daria erro:
  apagaria a proteção em silêncio, para todas as tabelas que usam esse gatilho,
  num banco de produção compartilhado com a Verandi. Consertado — a migration
  agora só **usa** a função que já existe.

### Decisões que valem saber antes de mexer

- **`retida` nunca soma com "entregue"**, em lugar nenhum: nem no banco, nem no
  motor, nem na tela. É a armadilha central da fase inteira.
- **Duas classes de erro param a transmissão toda** em vez de insistir: template
  morto (132015/132007) e payload errado (132000/132012). Ver `decidir()`.
- **O ritmo começa em 20/s** — o teto da coexistência, não o do número comum. E
  20 não é meta a perseguir: o throughput conta entrada e saída na mesma cota,
  então disparar no máximo derruba o atendimento que está acontecendo.
- **A tela nova é `/transmissoes`**, e não uma aba de Automações: aquela já tem
  uma aba "Templates" que é outra coisa (desenhos de fluxo). O link para a nova
  mora no cabeçalho de Campanhas.
- **O passo de sequência acima de 24h exige modelo**, e o `check` da 0061 faz
  valer. Sem isso, o teto de 30 dias seria uma promessa que o executor não
  cumpre — ele bateria na janela fechada e encerraria como `bloqueada`.

---

## O que ninguém provou ainda

**Nenhuma linha deste código falou com a Meta.** Tudo passou por teste, tipo e
build; nada passou por um número real. É a mesma pendência de
`HANDOFF-15-SET-MIDIA-RECEBIDA.md`, e vale a mesma regra: console dizer
"publicado" não é evidência.

Na ordem em que dá para provar, do mais barato ao mais caro:

1. **Aplicar `0059` e `0061`** — precisa de autorização explícita do usuário e
   de ler `docs/BANCO-COMPARTILHADO.md` antes. Nada abaixo roda sem isso.
2. **Criar um template de verdade** e ver a Meta responder. É o que prova
   `componentesParaMeta()` inteiro: `example` no formato certo, componente vazio
   ausente, categoria que ela devolve.
3. **Ver o webhook chegar.** Aprovado costuma levar minutos. Se não chegar,
   a reconciliação diária é o cinto — e ela também nunca rodou.
4. **Mandar para UM número** antes de qualquer lista. É o que separa "o payload
   está certo" de "o payload passa no teste".
5. **Só então uma lista pequena**, com o `statuses` chegando e a tela mostrando
   os números mexendo.

Um teste de mesa que vale a pena: forçar `held_for_quality_assessment`. Template
novo em portfólio novo é o caso mais provável de produzi-lo naturalmente — e é o
único jeito de ver se a tela realmente diz "a Meta está avaliando".

---

## O que não pode ser esquecido

### 1. `retida` não é `aceita`

A Meta responde **HTTP 200** e devolve `message_status` com três valores:
`accepted`, `held_for_quality_assessment`, `paused`. O segundo significa que ela
**segurou** a mensagem para avaliar — acontece com template novo, template sem
nota verde, e (desde 2026) portfólio novo com pouco histórico
(`business-portfolio-pacing`).

Se o veredito for ruim: o template vira `PAUSED` e **cada mensagem retida é
descartada**, chegando depois no webhook `messages` como `status: failed`,
`code: 132015`.

**Quem trata 200 como sucesso mostra "campanha enviada" e nada saiu.**

Use `lerStatusDeEnvio()` de `core/templates.ts` e grave o estado real. A tela
tem que saber dizer "a Meta está avaliando", não "enviado".

Confirmado atual: doc atualizada em 21/mai/2026.

### 2. As cinco classes de erro são incompatíveis

`condutaPara(codigo)` em `core/templates.ts` já resolve. Não invente política
própria:

- `130429`, `80007`, `131057` → **repetir** com backoff e jitter
- `131026` → **desistir** deste contato, marcar inválido, nunca repetir
- `131049`, `131056` → **esperar 24h**. Repetir antes **suspende o destinatário
  por mais 24h** — a tentativa extra piora
- `132000`, `132012`, `132001`, `132005` → **bug nosso** no payload, retry só
  repete o erro
- `132015`, `132007` → **template morreu**, não adianta tentar outro contato

### 3. Limites

- Escada: **250 → 2.000 → 10.000 → 100.000 → ilimitado**, destinatários únicos
  em 24h, **por portfólio** (mudou em out/2025, era por número)
- Só conta conversa **iniciada pela empresa**. Responder quem chamou é ilimitado
- Sobe em 6h se a qualidade estiver alta **e** o cliente tiver usado **50% do
  limite nos últimos 7 dias**. Quem dispara pouco fica preso em 250
- Throughput: 80 mps padrão, **20 mps em coexistência** — que é nosso caminho
  principal
- Fila com ritmo **por `phone_number_id`**, não global. Começar em 20–40 mps:
  throughput conta entrada + saída, e o inbound compete
- Checar o teto de 24h **antes** de enfileirar. Campanha de 5.000 com tier 2.000
  fatia em 3 dias

### 4. Campos deprecados — já conferido, nada a fazer

- `messaging_limit_tier` → virou `whatsapp_business_manager_messaging_limit`
- `max_daily_conversation_per_phone` → virou
  `max_daily_conversations_per_business` (v24.0; o prazo de fev/2026 já passou)

**Nenhum dos dois aparece no código.** Conferido em 15/set/2026 com `grep` em
`src/` inteiro. Fica escrito porque a próxima pessoa que ler a doc da Meta vai
ter a mesma dúvida.

### 5. Um template por WABA

Não existe biblioteca compartilhada: o mesmo template lógico para 40 clientes
são 40 criações, 40 aprovações e 40 ids diferentes. A chave em `templates` é
`(cliente_id, nome, idioma)`; `waba_template_id` é o que a Meta devolveu.

Limite de **100 criações por WABA por hora** — provisionamento de cliente novo
tem que ser assíncrono.

Existe **Template Library** da Meta (templates pré-aprovados de utility/auth)
que pode encurtar o onboarding: `GET /message_template_library`, e criar com
`library_template_name`. Sem customizar, a aprovação é quase imediata.

### 6. `rejection_info` é ouro

Quando o motivo da recusa é `INVALID_FORMAT`, o webhook traz explicação
detalhada **e recomendação acionável**. É a melhor informação que a Meta dá em
qualquer lugar da plataforma. Guardar em `templates.motivo_recusa` e **mostrar
literalmente na tela** — é a diferença entre "recusado" e "recusado porque falta
valor de exemplo na variável 2".

### 7. Opt-in

Desde nov/2024 pode ser **genérico** (não precisa mencionar WhatsApp), desde que
cumpra a lei. Opt-out precisa ser **por categoria**, não um "parar tudo" só.

A tabela `consentimentos` guarda **o texto exibido**, não um booleano: a LGPD
cobra prova, e booleano não prova o que a pessoa leu.

---

## Antes de aplicar a migration

`docs/BANCO-COMPARTILHADO.md` é obrigatório. Resumo:

- Banco de **produção compartilhado com a Verandi**. AutoFluxos mora em
  `public`, Verandi em `app_verandi`
- **Nunca** `supabase db push` nem `db reset` contra produção
- **Não aplicar sem autorização explícita do usuário**
- A próxima migration se descobre por `ls supabase/migrations/ | tail -1`, não
  por documento

**Atenção:** os dois chats paralelos já entregaram — a `0060` (NPS/avaliações) e
o Telegram estão commitados. Esta fase usou a `0061`. Continue descobrindo a
próxima por `ls supabase/migrations/ | tail -1`, e não por este documento: foi
exatamente assim que a numeração se perdeu antes.

---

## Contexto de produto que decidiu o desenho

Vem do levantamento de concorrentes desta data.

**Cada cliente no portfólio dele da Meta.** Não é escolha — o modelo
On-Behalf-Of foi descontinuado, e o Embedded Signup cria a WABA no portfólio do
cliente. O que continua sendo decisão nossa: nunca misturar número da 4YU com
número de cliente no mesmo portfólio.

**Verificação de empresa não é obrigatória.** Cliente conecta e já manda: 250
conversas iniciadas por dia, respostas ilimitadas. Dá para subir a 2.000 sem
verificar, entregando 2.000 mensagens boas em 30 dias. Verificar serve para o
nome aparecer na conversa, passar de 2 números e selo verde — **é upsell
disparado por limite, não portão de entrada**.

**Somos oficial-only e isso é argumento de venda.** Metade do mercado brasileiro
vende QR code mais barato (Botconversa R$ 189, Nexloo R$ 149) porque não paga a
Meta — e o número pode ser banido sem volta.

---

## Pendências fora desta fase

- **O custo real da Meta por mensagem** — fontes públicas divergem **6× em
  utilidade** e **5× em autenticação**. O único número confiável está em
  Business Manager → WhatsApp Manager → Preços. Conferir antes de qualquer
  tabela de preço.
- **Provar no celular** — mídia recebida, tique azul, reação, citação e gravação
  de áudio passaram por typecheck, teste e build, e **nenhum passou por um
  aparelho real** (`HANDOFF-15-SET-MIDIA-RECEBIDA.md`).
- **Permissionamento** — hoje um consultor apaga fluxo. Não há papel de gestor
  vs. atendente. Entra depois das fases do plano.
- **Teste de coexistência + catálogo** (fase 5) — a Meta lista "business tools
  (catalog, orders, status)" como não suportado em coexistência, que é nosso
  caminho principal. Testar num número real antes de prometer o recurso. Já
  existe número conectado para isso.

---

## Comandos

```bash
npx vitest run src/core/templates.test.ts   # 37 testes
npx tsc --noEmit | grep -v "^\.next/"       # ignore .next (cache velho)
```

Typecheck pode acusar erro de `nps` em `core/flow/blocos.ts` e afins — é o outro
chat trabalhando, não seu.
