# Levantamento completo — o que existe, o que falta, o que decidir

Escrito em **06/set/2026**, lendo os 21 documentos de `docs/` **e** o código, em
paralelo, e cruzando um contra o outro. Ele existe porque a pergunta do dono foi
literal: *"achou as análises do BotConversa? viu tudo que seria legal
implementarmos?"* — e a resposta honesta na hora era não.

**A conclusão que muda o planejamento:** o produto está **muito** mais completo
do que os documentos dizem. Quase todo plano escrito entre 13 e 28/ago foi
executado sem que os documentos fossem atualizados. Planejar pela leitura dos
planos leva a reconstruir o que já existe — foi o que aconteceu comigo com os
quadros.

---

## 1. A regra que este levantamento confirma pela terceira vez

> **Documento não é fonte de verdade sobre o código.**

Já estava escrita no [HANDOFF.md §0.4.1](HANDOFF.md), a partir de dois casos
(`renovarToken()` e as migrations). Este levantamento acrescenta oito:

| O que o documento diz | O que o código diz |
|---|---|
| `PLANO-MESTRE` Fase 4 pendente (login/papéis) | **Feito** — Better Auth com `organization` e `admin`, migration `0020` |
| `PLANO-MESTRE` Fase 5 pendente (respostas rápidas, automação on/off) | **Feito** — `repos/respostas-rapidas.ts`, migration `0036` |
| `PLANO-MESTRE` Fase 11 "o produto não faz mídia" | **Feito** — bloco `midia`, acervo, migration `0017` |
| `PLANO-MESTRE` §Ausências: formatação de mensagem | **Feito** — `components/editor/formatar.ts` |
| `PLANO-IA-ESTAGIO-2` inteiro pendente (28/ago) | **Feito** — `core/ferramentas.ts`, `usar_ferramenta`, `politica.ts`, `repos/ia-chamadas.ts` |
| `PLANO-SISTEMA` A3 "bloco em pilha" a fazer | **Feito** — `partes` no schema, com a migração segura que o próprio plano exigia |
| `ESTADO.md` prioridade 1: papéis; furo do `/api/simular` | **Feito** — `conferirAcessoAoCliente` em `simular/route.ts:136` |
| `AGENTS.md`: "a próxima migration é `0030`" | **Errado por 13** — a última é `0042`, a próxima é `0043` |

O último é o mais perigoso: seguir o `AGENTS.md` cria colisão de numeração.
**Corrigir isso é a primeira tarefa da lista.**

---

## 2. O que o produto tem hoje

Levantado do código, não da documentação.

**Números:** 42 migrations · 18 telas do cliente + 5 do admin · 11 blocos no
editor · 10 ações no motor · 81 server actions · 3 canais (1 disponível).

### 2.1 Telas

**Cliente:** Painel (funil, tempos, desempenho, série diária) · Inbox · Contatos
· Ficha do contato · Importar CSV · Quadros · Fluxos · Editor · Acervo ·
Conexões · Contexto da IA · Instagram · Número · Ajustes (equipe, etiquetas,
horário, respostas rápidas).

**Admin:** Contas · Usuários (com "entrar como") · Auditoria · Alertas.

### 2.2 Os recursos que os documentos listam como pendentes e já existem

Sequências (3 eventos de entrada, migrations `0031`/`0034`) · Campanhas (`0027`)
· Gatilhos por palavra-chave (`0024`) · Agendador com claim atômico (`0026`) ·
Timeout de pergunta · Importação CSV com conciliação de telefone · Exportação
CSV · Atribuição de conversa · Não-lidas · "Meus chats" · Busca · Paginação ·
Presença · Horário de atendimento · Etiquetas manuais (`0025`) · Notas ·
Acervo de mídia (`0017`) · 14 modelos de fluxo · Presets (RD Station, Sheets, 10
da Verandi) · IA com tool calling, políticas e log · Compartilhar fluxo por link
(`0030`) · Pastas (`0029`) · Métricas de tempo (`0028`) · Formatação de texto ·
Inserir variável por clique · SSE no Inbox · Quadros com drag-and-drop (`0032`).

### 2.3 Onde procurar e não achar

Duas coisas **existem** mas não têm rota própria — vivem dentro de `/fluxos`:
**sequências** e **campanhas**. Quem procura `/sequencias` conclui que não
existe. Vale um link ou uma aba nomeada.

---

## 3. O que realmente falta

Conferido por busca no código, não por leitura de plano.

### 3.1 Travado pela Meta — não é código nosso

| O quê | Por quê |
|---|---|
| **Modelos aprovados (HSM)** | Única forma de reabrir conversa fora da janela de 24h. Hoje o produto **detecta e avisa**, mas não manda |
| **Transmissão** | Depende dos modelos. E precisa da contagem do público **antes** do botão |
| **Instagram no ar** | Adaptador, webhook, tela e renovação de token **prontos**. Só falta o Advanced Access |

### 3.2 Não travado por ninguém — dá para fazer hoje

| # | O quê | Por que importa | Tamanho |
|---|---|---|---|
| 1 | **`AGENTS.md` com a numeração errada** | Risco de colisão de migration em produção compartilhada | minutos |
| 2 | **Cartão não entra sozinho no quadro** | É a queixa direta do dono: "tem que clicar e puxar". `porNoQuadro` só é chamado pela tela | ½ rodada |
| 3 | **Fluxo não aplica etiqueta nem escreve nota** | As 10 ações do motor não incluem nenhuma das duas. É o que faz o bot "parecer um funcionário mexendo" | ½ rodada |
| 4 | **Webhook de entrada** (`POST /api/webhook/entrada/[clienteId]`) | **Promessa falsa em produção**: o preset de fila de espera diz "te aviso se abrir", a Verandi dispara `vaga.aberta`, e não há rota para receber | 1 rodada |
| 5 | **Subfluxo com volta** | Existe `ir-fluxo` (pulo sem volta). A decisão nº 1 do PLANO-MESTRE nunca foi fechada | 1–2 rodadas |
| 6 | **Aviso de handoff fora do Inbox** | `NotificacoesDaFila` só avisa quem está com a tela aberta. Fora disso o handoff acontece e ninguém vê. Push + e-mail resolve, custo zero | 1 rodada |
| 7 | **Central de notificações** | Etapa C2. O push do item 6 resolve o urgente | — |

### 3.3 A lacuna que nenhum documento planeja: **cobrança**

**Não existe nada.** Zero tabela de assinatura, zero limite por plano, zero
gateway. "Plano" no código é plano de IA, não comercial.

Isto não é uma fase esquecida — é que ninguém escreveu. E **não trava enquanto
não houver cliente pagante**, o que hoje depende da Meta. Mas é o único item
desta lista que separa "produto que funciona" de "negócio que fatura".

O que decidir antes de escolher gateway está em
[PLANO-ESPERA.md §5](PLANO-ESPERA.md).

---

## 4. As análises do BotConversa — o que elas pediam

Duas análises existem: [EXPANSAO.md](EXPANSAO.md) (31 telas, 13/ago) e
[PLANO-PRODUTO.md](PLANO-PRODUTO.md) (13 prints comentados pelo dono, 17/ago).

**Quase tudo que elas pediam foi feito.** O que sobrou:

| Pedido | Estado |
|---|---|
| Coluna `Conexões` na lista de fluxos | Falta — depende de subfluxo existir |
| `CTR %` por fluxo | Falta — precisa registrar clique por opção |
| Criar contato à mão | Falta |
| Seleção múltipla com ações em lote nos Contatos | Falta |
| Rail de filtros nos Contatos | Falta |
| `✓✓` de leitura | Falta — temos entregue, não lido |
| Testar como lead existente | Falta |
| Bloco Inicial explícito no editor | Falta |
| Auto-organizar canvas | Falta |
| Tela cheia e minimapa | Falta |
| Cartão de contato como pedaço da mensagem | Falta (decisão: só se o schema já estiver aberto) |

### 4.1 O que foi recusado de propósito — não reabrir sem motivo novo

| Recusado | Motivo registrado |
|---|---|
| **Conectar número por QR** | *"Perder o número do cliente é o pior fracasso possível para uma agência."* Só Cloud API oficial |
| **iPaaS embutido (Albato)** | O print mostra o preço: duas automações vazias e 5.000 ações pagas sem uso |
| **Randomizador (A/B)** | Volume não justifica |
| **Eventos personalizados** | *"Métrica sem pergunta é dado morto"* |
| **Reiniciar automação** | Gambiarra deles para sessão presa; a nossa não tem o problema |
| **Modelos como item de menu** | Vai para dentro de Configurações, se for |
| **RAG / base vetorial** | O dado é estruturado atrás de API; RAG seria segunda cópia com validade |

E a regra transversal: **não crescer a lateral por acumulação.** Eles têm 11
itens de menu; nós temos 6. Cada coisa nova precisa achar casa em `Fluxos`,
`Inbox`, `Contatos` ou `Ajustes` **antes** de virar item de menu.

---

## 5. Decisões que continuam abertas, e são do dono

1. **Subfluxo volta ao chamador?** A recomendação registrada é **não**. Decide a
   implementação do item 3.2.5.
2. **Cobrança**: o que é cobrado, e por qual gateway (§3.3).
3. **LLM padrão**: hoje Gemini free tier. O palpite documentado é Gemini Flash
   pago, e nunca virou decisão.
4. **Faixa de preço pelo bot** (Prelúdio) — decide o desenho do fluxo do
   cliente 01.

---

## 6. O que eu recomendo fazer nesta janela

Ordem, considerando que a Meta leva de 3 a 5 semanas e que a análise pode voltar
a qualquer momento:

| # | O quê | Por quê aqui |
|---|---|---|
| 1 | Corrigir `AGENTS.md` | Minutos, e evita colisão de migration |
| 2 | Cartão entra sozinho no quadro | É a queixa concreta do dono |
| 3 | Etiqueta e nota automáticas pelo fluxo | Barato, e é o que faz o bot parecer gente |
| 4 | Webhook de entrada | Fecha uma promessa falsa que já está em produção |
| 5 | Painel direito do Inbox ([PLANO-ESPERA §3](PLANO-ESPERA.md)) | Aditivo e reversível — seguro durante a análise |
| 6 | Aviso de handoff por push/e-mail | O elo mais fraco da cadeia de atendimento |
| 7 | Auditoria OWASP escrita | Responde o medo declarado; 7 dos 9 blocos já estão fechados |

**Fora desta janela, de propósito:** qualquer mudança de rota ou de nome de menu,
enquanto o revisor da Meta puder abrir o produto seguindo o passo a passo que
enviamos.

---

## 7. O que fazer com os documentos

Sete contradições entre planos foram encontradas (numeração de migration, mídia,
papel do cliente, Kanban, respostas rápidas, formatação, campos manuais). Todas
têm a mesma causa: **plano escrito, plano executado, documento não atualizado.**

A correção barata é marcar no topo de cada plano antigo o que foi superado, em
vez de reescrever tudo. Os candidatos, por ordem de dano:

1. `AGENTS.md` — numeração errada (**corrigir, não anotar**)
2. `PLANO-MESTRE.md` — fases 4, 5 e 11 e a seção de ausências
3. `ESTADO.md` — a lista de prioridades inteira
4. `BRIEF-UI.md` — "cliente é somente leitura" foi revertido pelo PLANO-SISTEMA
