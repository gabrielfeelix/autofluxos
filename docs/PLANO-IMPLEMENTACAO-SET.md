# Plano de implementação — a janela da análise da Meta

Escrito em **06/set/2026**, depois do [LEVANTAMENTO-06-SET.md](LEVANTAMENTO-06-SET.md),
que cruzou os 21 documentos com o código e achou o produto muito mais completo do
que os planos diziam. Este plano cobre **só o que falta e não depende da Meta**.

**Ordem: 1 → 2 → 3 → 4 → 5 → 6.** Cada rodada entrega software funcionando e pode
parar ali. As decisões técnicas estão tomadas aqui; quem executa escreve os passos.

> **A trava que vale para todas.** O revisor da Meta pode abrir o produto a
> qualquer momento, seguindo o passo a passo enviado na justificativa das
> permissões: entrar com `revisor.meta@4yu.com.br`, abrir Clientes → Estúdio de
> exemplo, conectar, abrir o Inbox. **Nenhuma rodada muda rota, nome de menu ou o
> caminho dessas telas.** Tudo abaixo é aditivo.

---

## Rodada 1 — o cartão entra sozinho no quadro

**Por quê:** é a queixa literal do dono — *"o lead não vai automático, tem que
clicar e puxar"*. E ele está certo: `porNoQuadro` (`repos/quadros.ts:335`) só é
chamado por `acoes.ts`, ou seja, pela tela. O `porContatoNaEtapa` do webhook
**move** quem já é cartão; não cria. Contato que ninguém adicionou à mão não
existe no quadro.

### A decisão que precisa ser tomada primeiro

Um cliente pode ter **N quadros** (`quadros_conta_idx` em `client_id`, sem
unique). Então "entrar sozinho" precisa responder: **em qual?**

Três saídas, e a recomendação:

| Opção | Como | Problema |
|---|---|---|
| Todos os quadros | O contato vira cartão em cada um | Quem tem 3 quadros ganha 3 cartões que não pediu |
| **Um quadro marcado como padrão** ✅ | Coluna `padrao boolean` em `quadros`, no máximo um por cliente | Exige migration e uma caixa na tela |
| O primeiro criado | `listarQuadros` já ordena por `criado_em` | Implícito demais: ninguém entende por que é aquele |

**Recomendado: quadro padrão explícito.** É o único que a pessoa consegue prever
e mudar. Um cliente sem quadro padrão marcado continua como hoje — nada entra
sozinho, e isso é o comportamento correto para quem não quer a automação.

### Migration `0043_quadro_padrao.sql`

```sql
alter table public.quadros
  add column if not exists padrao boolean not null default false;

-- No máximo um padrão por conta. Índice parcial: várias linhas com `false`
-- convivem, e só a marcada colide.
create unique index if not exists quadros_padrao_unico_idx
  on public.quadros (client_id) where padrao;
```

**Antes de aplicar:** ler [BANCO-COMPARTILHADO.md](BANCO-COMPARTILHADO.md),
conferir que a última migration ainda é `0042` **pelo diretório**, testar em
Docker, e **não aplicar em produção sem autorização explícita do dono**.

### O código

1. **`repos/quadros.ts`**: `acharQuadroPadrao(clienteId)` e
   `definirQuadroPadrao(clienteId, quadroId | null)`. Marcar um desmarca o outro
   na mesma transação.
2. **`receber-mensagem.ts:205`**, logo depois de `acharOuCriarContato`: se o
   contato **acabou de ser criado** e existe quadro padrão, `porNoQuadro`. Só
   para contato novo — contato que já existe e voltou a escrever não deve pular
   para a primeira etapa, isso apagaria o progresso dele no funil.
3. **Falhar aqui não pode derrubar a mensagem.** Mesmo tratamento do
   `mover_etapa`: `try/catch`, `alertar()`, e a conversa segue. Um quadro mal
   configurado nunca pode fazer alguém não ser atendido.
4. **Tela**: uma caixa "usar este quadro para novos contatos" no cabeçalho do
   quadro, em `components/quadros/quadro.tsx`.

### Como provar

- Teste: contato novo com quadro padrão → vira cartão na primeira etapa.
- Teste: contato **existente** que escreve de novo → **não** muda de etapa.
- Teste: sem quadro padrão → nada acontece, e a mensagem é processada igual.
- Teste: `porNoQuadro` estourando → a mensagem chega mesmo assim, e há alerta.

---

## Rodada 2 — o fluxo aplica etiqueta e escreve nota

**Por quê:** é o que o dono descreveu como *"um funcionário mexendo: vai
colocando tags, vai escrevendo observações"*. Hoje o `switch` de ações tem dez
casos e **nenhum** faz isso — etiqueta e nota só existem como clique humano no
Inbox.

O molde está pronto: `mover_etapa` é exatamente a mesma forma.

### Motor (`core/`)

Duas ações novas em `core/engine/types.ts`, ao lado de `mover_etapa`:

```ts
| { tipo: 'aplicar_etiqueta'; etiquetaId: string }
| { tipo: 'escrever_nota'; texto: string }
```

Dois nós novos em `core/flow/schema.ts`, no molde de `noEtapaSchema`:

```ts
export const noEtiquetaSchema = z.object({
  ...base,
  type: z.literal('etiqueta'),
  data: z.object({ etiquetaId: z.string().default('') }),
})

export const noNotaSchema = z.object({
  ...base,
  type: z.literal('nota'),
  data: z.object({ texto: z.string().default('') }),
})
```

E as entradas correspondentes em `core/flow/blocos.ts` (nome, ícone, cor,
descrição) e no `z.discriminatedUnion` do fim do schema.

**A regra que `noEtapaSchema` já ensina:** sem etiqueta escolhida o bloco não faz
nada e a conversa segue. O `validar()` recusa publicar assim; a defesa no motor é
para o grafo que já estava no ar quando a etiqueta foi apagada.

**O texto da nota interpola variáveis** — `interpolar(no.data.texto, s.vars)`,
como `salvar-campo` faz. É o que permite *"pediu {{servico}} para {{dia}}"*.

### Servidor (`receber-mensagem.ts`)

Dois `case` novos, ao lado do `mover_etapa`:

- `aplicar_etiqueta` → `marcarContatos` (`repos/etiquetas.ts:211`) e, **junto**,
  `inscreverNoEvento(..., 'etiqueta_aplicada', etiquetaId)`. Esse evento já
  existe e já dispara sequência (`acoes.ts:649`) — a ação nova precisa disparar
  igual, senão etiquetar pelo fluxo e etiquetar pela mão passam a ter efeitos
  diferentes, que é o tipo de inconsistência que ninguém descobre até doer.
- `escrever_nota` → acrescenta ao campo de notas do contato. **Acrescenta, não
  substitui**: a nota da equipe não pode ser apagada pelo bot. Cabeçalho com
  data e a origem (o bot), para quem lê saber quem escreveu.

**Nenhum dos dois pode derrubar a conversa.** Etiqueta apagada vira log e segue.

### Como provar

- Teste do motor: nó com etiqueta produz a ação; nó vazio não produz e segue.
- Teste do motor: texto da nota interpola variável.
- Teste de servidor: aplicar pelo fluxo inscreve na sequência, igual à mão.
- Teste de servidor: nota acrescenta e preserva o que a equipe escreveu.
- Teste: etiqueta inexistente → alerta, conversa segue.

---

## Rodada 3 — webhook de entrada

**Por quê:** é o único item desta lista que conserta uma **promessa falsa já em
produção**. O preset `verandi-espera` (`core/presets.ts:582`) diz, com estas
palavras: *"Transforma o 'está lotado' em 'te aviso se abrir'. Quando alguém
desmarca, a agenda dispara o aviso."* A Verandi dispara. **Não existe rota para
receber.** Quem entrou na fila nunca é avisado.

`ls src/app/api/webhook/` devolve `instagram` e `whatsapp`. Só.

### A rota

`POST /api/webhook/entrada/[clienteId]` — nova, e é superfície pública, então
nasce com as quatro defesas do produto:

1. **Segredo por cliente**, não global. Uma Conexão do tipo "webhook de entrada"
   guarda o segredo no cofre; a chamada traz assinatura HMAC do corpo e a rota
   confere **em tempo constante**. Segredo global significaria que vazar o de um
   cliente vaza o de todos.
2. **Teto de corpo**, como o webhook do WhatsApp já faz (413 acima do limite).
3. **Limite por cliente**, no contador atômico que já existe (migration `0014`).
4. **Nada estoura dentro do `after()`** — a regra 4 do [ESTADO.md](ESTADO.md).
   Falha vira alerta, e a resposta é 200 para quem chamou não ficar reenviando.

### O que o evento faz

O corpo traz `{ evento, telefone, dados }`. A rota acha o contato pelo telefone
(normalizado por `core/contatos/telefone.ts`, que já resolve o nono dígito) e
**começa um fluxo** — o mesmo caminho de uma mensagem recebida, sem mensagem.

Qual fluxo: **um gatilho por evento**, na tabela de gatilhos que já existe
(migration `0024`). `vaga.aberta` → fluxo X. Isso evita inventar um mecanismo
novo de roteamento e reaproveita a tela de Automações.

**A trava da janela de 24h vale aqui e é fácil de esquecer:** se a última
mensagem daquele contato tem mais de 24h, o aviso **não pode sair como texto
livre** — a Meta recusa. Sem modelo aprovado (que só existe depois do app
review), o comportamento honesto é **registrar e não prometer**: gravar o evento,
não mandar nada, e deixar visível no Inbox. Prometer aviso que não chega é
exatamente o problema que esta rodada existe para consertar; substituí-lo por
outro seria pior.

### Como provar

- Teste: assinatura errada → 401, e nada acontece.
- Teste: assinatura certa → o fluxo do gatilho começa.
- Teste: contato fora da janela de 24h → grava, não envia, aparece no Inbox.
- Teste: telefone que não existe → 200, alerta, sem criar contato do nada.
- Teste: corpo grande → 413.

---

## Rodada 4 — o painel direito do Inbox para de parecer técnico

**Por quê:** queixa do dono — *"muita informação técnica na direita, código,
número esquisito, e eu nunca vou usar aquilo"*. A causa é uma linha,
`inbox/page.tsx:831`:

```ts
const campos = Object.entries(lead.campos)
```

Todo campo coletado, sem limite, e a chave renderizada crua em `font-mono` (~895)
— **o nome da variável do fluxo**, que é identificador técnico que o cliente
nunca escolheu ver. Um fluxo com 20 perguntas produz 20 blocos.

### A correção

1. **Rótulo em vez de chave.** O bloco de pergunta sabe o texto que perguntou;
   guardar o rótulo junto do campo e mostrar *"Qual seu objetivo?"* em vez de
   `objetivo_aluno`. Onde não houver rótulo (campo antigo), formatar a chave:
   `_` → espaço, primeira maiúscula. **Nunca `font-mono` cru.**
2. **Teto de 4 campos + "ver mais".** O resto continua na Ficha, que já existe e
   já tem link ao lado.
3. **Anotação da equipe sobe** para antes dos campos. É o que mais se usa e hoje
   está no fim, depois do despejo.

**É aditivo e reversível** — esconder não apaga —, e por isso é a única rodada
que toca uma tela do caminho do revisor sem risco.

### Como provar

Passada de Playwright: contato com 20 campos mostra 4 e o botão; abrir mostra
todos; nenhum `font-mono` com nome de variável na tela.

---

## Rodada 5 — o handoff avisa quem não está com o Inbox aberto

**Por quê:** o `PLANO-SISTEMA` §3.10.1 chama isto de *"o elo mais fraco do
produto"*, e continua verdade: `NotificacoesDaFila` consulta a cada 30s e só
avisa **quem está com o Inbox aberto**. Fora disso o bot transfere para humano e
ninguém percebe. O cliente descobre pelo lead reclamando.

### O caminho: push do navegador + e-mail

Os três caminhos possíveis estão avaliados no `PLANO-SISTEMA`. **Push + e-mail** é
o recomendado: custo zero, não depende da Meta, e é o padrão da indústria.
WhatsApp para o atendente exige modelo aprovado (travado) e é cobrado por
conversa.

1. **Push**: Web Push com VAPID. As chaves vão para `.secrets/4yu.env` e a Vercel
   — **nunca no repositório**, que é público.
2. **E-mail**: o Better Auth já tem SMTP configurado para verificação; reusar.
3. **Quem recebe**: os membros da conta com papel de atendimento, respeitando
   presença (`Disponível`) e o **horário de atendimento**, que já existe. Avisar
   às 3h da manhã é a forma mais rápida de fazer alguém desligar o aviso.
4. **Melhor-esforço**: falhar ao avisar **não desfaz o handoff**. Vira alerta.

### Como provar

- Teste: handoff com ninguém online → push enviado e e-mail enviado.
- Teste: fora do horário de atendimento → não manda push.
- Teste: envio falhando → o handoff continua registrado, e há alerta.

---

## Rodada 6 — auditoria OWASP escrita

**Por quê:** responde o medo declarado pelo dono — *"ficar fácil de ser hackeado
e as pessoas perderem dinheiro"* — e transforma "acho que está seguro" em
documento. Sete dos nove blocos do
[PLANO-ENDURECIMENTO.md](PLANO-ENDURECIMENTO.md) estão fechados; falta o
documento que prova isso a um cliente que perguntar.

Uma passada explícita pelo **OWASP Top 10**, com veredito e **evidência** de cada
item (arquivo e linha, não opinião), num `docs/SEGURANCA.md`. Onde houver
lacuna, ela vira item de backlog com gatilho — não conserto no meio da auditoria.

Os quatro pontos que já se sabe que merecem olhar:

1. **Rate limit nas ações autenticadas.** O bloco 3 fechou as portas públicas; um
   membro com sessão válida ainda pode martelar server action.
2. **RLS objeto a objeto, conferido no banco.** A `0041` provou que o documento
   mentia sobre grants em 13 dos 42 objetos. Conferir de novo, no banco.
3. **A rota nova da rodada 3** entra na auditoria já nascida.
4. **Bloco 8 do endurecimento** — apagar contato (LGPD) é **lei**, não recurso.

---

## O que fica de fora desta janela, e por quê

| Fora | Motivo |
|---|---|
| Modelos aprovados (HSM), transmissão, Instagram no ar | Travados pela Meta |
| Subfluxo com volta | A decisão nº 1 do `PLANO-MESTRE` nunca foi fechada. Decidir antes de codar |
| Cobrança e assinatura | Não trava enquanto não houver cliente pagante, e a modelagem é decisão do dono ([PLANO-ESPERA §5](PLANO-ESPERA.md)) |
| Central de notificações | O push da rodada 5 resolve o urgente |
| Qualquer mudança de rota ou nome de menu | O revisor da Meta pode abrir o produto a qualquer momento |

---

## A regra de execução, que não muda

Para cada rodada, o que o [PLANO-MESTRE.md](PLANO-MESTRE.md) já manda:

1. `git fetch` **antes de começar** — há sessões paralelas neste repositório, e o
   `main` local fica para trás. Em 06/set ele estava 35 commits atrás.
2. Ler a documentação do Next em `node_modules/next/dist/docs/` antes de mexer em
   API ou convenção do framework.
3. Banco: checklist do `BANCO-COMPARTILHADO`, SQL revisado, testado em Docker.
   **Produção só com autorização explícita do dono.**
4. Fatias pequenas, com o teste de falha junto da funcionalidade.
5. `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`,
   `git diff --check` — todos verdes antes do commit.
6. Commit por rodada, e **atualizar o documento de origem** para que item pronto
   não continue parecendo pendente. É a dívida que gerou este plano.
