# Handoff — 06/set/2026, depois das rodadas 1, 2 e 3

Para quem pegar daqui, humano ou agente. Este documento continua o
[HANDOFF-06-SET.md](HANDOFF-06-SET.md), que **continua valendo por inteiro** —
principalmente o §4 (o que não fazer enquanto a Meta analisa) e o §7
(armadilhas). Leia os dois.

---

## 1. Comece por aqui, nesta ordem

1. **`git fetch` antes de qualquer coisa.** Há sessões paralelas neste
   repositório; em 06/set de manhã o `main` local estava 35 commits atrás.
2. Este documento.
3. [PLANO-IMPLEMENTACAO-SET.md](PLANO-IMPLEMENTACAO-SET.md) — as rodadas 4, 5 e
   6, que é o que falta. As três primeiras estão marcadas ✅ com o que mudou em
   relação ao que o plano previa.
4. [HANDOFF-06-SET.md](HANDOFF-06-SET.md) — o estado geral e as travas da Meta.
5. Só então código.

---

## 2. O que ficou pronto nesta sessão

Três rodadas, três commits, tudo em produção e com prova fora do console.

| Commit | O quê | Migration |
|---|---|---|
| `7b54a6d` | Contato novo entra sozinho no quadro padrão | `0043` **aplicada** |
| `57c23d0` | O fluxo aplica etiqueta e escreve anotação | — |
| `650117b` | Webhook de entrada (`POST /api/webhook/entrada/[clienteId]`) | `0044` **aplicada** |

**Deploy de produção:** `650117b`, READY, em `autofluxos.4yu.com.br`.

**Suíte:** 1249 passando, 14 puladas. Typecheck, lint e build verdes.

### 2.1 As duas migrations foram aplicadas em produção

Com autorização explícita do dono, e conferidas **no banco** — não no console:

- **`0043`**: coluna `quadros.padrao` + índice único parcial
  `quadros_padrao_unico_idx (client_id) where padrao`. Todas as contas
  existentes ficaram em `false`: **ninguém ganhou automação sem marcar a caixa**.
- **`0044`**: `webhooks_de_entrada` e `gatilhos_de_evento`, as duas com RLS
  ligada e **sem grant nenhum** para `anon`/`authenticated`, mais a função
  `contar_disparo_de_evento`.

A próxima migration é a **`0045`** — mas confira pelo diretório, sempre.

---

## 3. O que aprendi que os planos diziam errado

Isto é a parte que economiza tempo de verdade. **Documento não é fonte de
verdade sobre o código** — a lição do handoff da manhã se repetiu três vezes.

1. **O webhook do WhatsApp NÃO tem teto de corpo.** O plano da rodada 3 dizia
   "como o webhook do WhatsApp já faz (413 acima do limite)". Não faz. Quem tem
   teto é `/api/simular`, e o padrão de lá é o certo: confere o `content-length`
   **e** os bytes de verdade, porque o cabeçalho é escolhido por quem chama.
2. **Evento não cabe na tabela `gatilhos`.** O plano mandava reusá-la.
   `gatilhos` casa **texto de conversa** por `igual`/`contem`, com desempate por
   especificidade (`casarGatilho`). Evento casa **nome exato** vindo de outro
   sistema. Na mesma tabela, toda leitura teria que perguntar "de que tipo é
   esta linha?" e a tela ofereceria operador sem sentido para um evento. Ficou
   em `gatilhos_de_evento`.
3. **O `switch` de `TipoNo` é exaustivo em TREZE lugares**, não nos quatro que o
   plano da rodada 2 listava: `executar`, `schema`, `blocos` (4 mapas),
   `validar` (3 pontos), `descrever`, `compartilhar`, `editor`, `painel`,
   `previa-do-bloco`, `conteudo-fluxos`, e a página pública `/f/[token]`. O
   typecheck aponta cada um — isso é a rede funcionando, não atrito. Bloco novo
   sem tratamento em qualquer deles é tela quebrada em produção.
4. **`acharOuCriarContato` não sabia dizer se criou ou achou.** O `upsert` do
   PostgREST devolve a linha e não diz qual foi, e `criado_em == atualizado_em`
   só responde por acidente de não haver gatilho nessa tabela hoje. Agora ela
   insere com `ignoreDuplicates` primeiro e devolve `criadoAgora` — atômico.
   **Sem essa distinção, cada mensagem jogaria o contato de volta para a
   primeira etapa do quadro**, apagando o funil de quem a equipe já arrastou até
   o fim.

---

## 4. Decisões tomadas nesta sessão (não as refaça)

1. **Qual quadro recebe o contato novo** — quadro padrão explícito, marcado numa
   caixa no cabeçalho do quadro, no máximo um por conta, **opt-in**. Era a
   decisão nº 1 da lista do dono; está fechada.
2. **Etiquetar pelo fluxo faz o que etiquetar pela mão faz** — inclusive
   `sairPelaEtiqueta` **e** `inscreverNoEvento`. O plano citava só o segundo; o
   caminho manual (`acoes.ts:649`) faz os dois, e o ponto da rodada era
   justamente não haver dois comportamentos com o mesmo nome.
3. **A anotação acrescenta, nunca substitui**, com cabeçalho de data e origem. E
   o texto dela **não vai para o link público** de compartilhar: é o único campo
   escrito para consumo interno.
4. **Fora da janela de 24h, o evento é gravado e não enviado.** Sem modelo
   aprovado (travado pela Meta), prometer o aviso seria o defeito da rodada 3
   trocado de lugar.
5. **Telefone desconhecido não vira contato.** Um sistema externo com número
   errado encheria a base de leads-fantasma que nunca falaram com ninguém. Vira
   alerta. E telefone sem DDD não casa com nada em vez de chutar.

---

## 5. O que falta: rodadas 4, 5 e 6

Detalhe e critério de prova em
[PLANO-IMPLEMENTACAO-SET.md](PLANO-IMPLEMENTACAO-SET.md). **Nenhuma tem decisão
do dono pendente.**

| # | O quê | Tamanho |
|---|---|---|
| 4 | **Painel direito do Inbox** — `inbox/page.tsx:831` faz `Object.entries(lead.campos)` e despeja tudo com a chave crua em `font-mono`. Rótulo em vez de chave, teto de 4 campos + "ver mais", anotação sobe | Pequena |
| 5 | **Aviso de handoff** — hoje só avisa quem está com o Inbox aberto. Web Push (VAPID) + e-mail pelo SMTP que o Better Auth já tem | Média; exige chaves novas no `.secrets` e na Vercel |
| 6 | **Auditoria OWASP escrita** — `docs/SEGURANCA.md`, com evidência (arquivo e linha) por item | Média, sem código |

**A rodada 4 é a única que toca uma tela do caminho do revisor da Meta.** É
aditiva e reversível (esconder não apaga), mas leia o §4 do
[HANDOFF-06-SET.md](HANDOFF-06-SET.md) antes.

**Para a rodada 6, dois insumos novos desta sessão:**
- a rota `/api/webhook/entrada/[clienteId]` entra na auditoria já nascida — as
  quatro defesas dela estão documentadas no cabeçalho do arquivo;
- `src/server/endereco.ts` é novo e tem uma regra que vale citar: **nunca monta
  URL a partir de cabeçalho da requisição**, porque `Host` é escolhido por quem
  chama.

---

## 6. Coisas desta sessão que vão morder quem não souber

- **Os testes rodam contra o Supabase de PRODUÇÃO.** Não existe banco de teste.
  Teste novo que escreve tem que limpar o que criou (`afterAll` apagando o
  cliente, que leva o resto por `cascade`).
- **Docker não está disponível nesta máquina**, então o replay local de
  migration (`npx supabase start`) não roda. As duas migrations desta sessão
  foram aplicadas direto pela `DATABASE_URL`, dentro de transação, e conferidas
  por consulta depois.
- **`JWT issued at future` é transitório.** Apareceu duas vezes derrubando uma
  suíte inteira e sumiu ao reexecutar. É defasagem de relógio contra o Supabase,
  não código. Não vá caçar bug por causa dele.
- **O `Lead` tem `contatoId`, não `id`**, e a tabela de inscrição usa
  `contact_id`, não `contato_id`. As duas me custaram execuções de teste.
- **`acharLead(clienteId, contatoId)` quer o id do contato, não o telefone.**
- **O conector MCP da Vercel não está autorizado no escopo `4-yu`** (403). Para
  conferir deploy, use a API com o `VERCEL_TOKEN` do `.secrets`:
  ```bash
  set -a && . /home/gabfelix/dev/4yu-apps/.secrets/4yu.env && set +a
  curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
    "https://api.vercel.com/v6/deployments?projectId=prj_17XxHvJ1vOAQ6j4mQSauCPA1BJXO&teamId=team_hmVHyYO1YFO9fuAtpG9Ym2hm&limit=1&target=production"
  ```
- **Ao provar a rota com `curl`, não minta no `content-length`.** Mandar
  `content-length: 999999` com corpo pequeno dá **500**, e não 413: a conexão
  fica esperando bytes que não chegam e a plataforma erra antes do nosso código.
  Com corpo grande de verdade, o 413 sai certo. Isso não é defeito.

---

## 7. Como se prova que uma rodada terminou

Sem exceção, e nesta ordem:

```
npm test && npm run typecheck && npm run lint && npm run build && git diff --check
```

Depois: commit por rodada, **atualizar o documento de origem** (o plano e o
handoff), e — para qualquer coisa que vá ao ar — **provar fora do console**.

O webhook desta sessão foi provado assim: assinatura válida devolveu `200` e
gravou `ultima_em`; segredo errado devolveu `401`; assinatura de tamanho errado
devolveu `401` e não 500; corpo de 70 KB devolveu `413`. Conta de teste criada e
apagada no mesmo script.

**A regra que vale mais que todas:** afirmar que algo funciona só depois de ver a
saída do comando que prova.
