# Plano — IA estágio 2: a IA que consulta o sistema do cliente

Escrito em 28/ago/2026. Substitui a suposição de que "a IA ainda não busca em
base de dados" por um diagnóstico com linha de código, e transforma o que falta
em rodadas com ordem e trava.

> **Fronteira desta rodada.** Outro agente está construindo, em paralelo, a aba
> **Templates** em Automações, o modal de criação (manual × template) e o bug do
> dropdown "Começar de". Este plano **não encosta** em
> `src/app/clientes/[clienteId]/fluxos/page.tsx`, em `src/exemplos/`, nem em
> `src/core/presets.ts`. O catálogo de ferramentas nasce em arquivo novo
> (`src/core/ferramentas.ts`) exatamente por isso — e por um motivo de projeto,
> descrito em §3.2.

---

## §1. O diagnóstico

### 1.1 O que já funciona, e que não se deve reconstruir

O sistema **já lê e escreve em base de dados de terceiro**, hoje, em produção.
Quem faz isso é o **fluxo desenhado à mão**:

- nó `http` ([`core/flow/schema.ts:574`](../src/core/flow/schema.ts)) — `GET`,
  `POST`, `DELETE`, cabeçalhos, corpo interpolado, mapeamento de resposta com
  lista (`livres[].hora`), rótulo, `unicos`, `quantos`, formato;
- 13 presets da Verandi em [`core/presets.ts`](../src/core/presets.ts) —
  horários, dias, catálogo, marcar, desmarcar, minha agenda, fila de espera,
  cadastrar, quem é;
- credencial em Conexão, valor no Supabase Vault, `conexaoId` no fluxo, resolução
  no servidor **depois** do motor ([`docs/CONEXOES.md`](CONEXOES.md));
- IP fixado contra rebinding de DNS antes de qualquer credencial sair.

Nada disso precisa ser refeito. É a fundação sobre a qual o estágio 2 assenta.

### 1.2 O que não funciona: a IA é cega e muda

| Onde | O que diz hoje |
|---|---|
| [`server/ia/types.ts:14-30`](../src/server/ia/types.ts) | `PedidoDeIa` = `contextoNegocio` (texto), `instrucao`, `pergunta`, `historico`. Nenhuma ferramenta. |
| [`server/ia/types.ts:38`](../src/server/ia/types.ts) | `Resposta` = `texto` \| `nao_sei`. Não existe "quero consultar X". |
| [`server/efeitos/resolver.ts:281`](../src/server/efeitos/resolver.ts) | Uma chamada, uma resposta. Sem laço. |
| [`core/flow/schema.ts:413`](../src/core/flow/schema.ts) | `noIaSchema.data` = `instrucao`, `salvarEm`. Nada mais. |

A IA é um **redator de escopo fechado** em cima de um blob de texto
(`clients.contexto_negocio`). Ela não sabe se tem vaga terça às 7h. Perguntaram?
`NAO_SEI` → handoff.

**Então o estágio 2 não é construir integração. É dar as mãos à IA.**

---

## §2. O que a pesquisa externa mudou no plano

Cinco achados que alteraram decisões concretas. Sem eles, três das escolhas
abaixo seriam outras — e duas seriam erradas.

### 2.1 A política da Meta favorece este desenho, e não o contrário

Desde **15/jan/2026** a WhatsApp Business Platform proíbe *general-purpose AI
chatbot*: LLM, domínio aberto, não restrito a um processo de negócio. Contas
novas registradas a partir de 15/out/2025 já entraram sob a regra. Bot de IA para
**tarefa estruturada de negócio** — atendimento, pedido, agendamento — continua
permitido e é explicitamente incentivado.

**Consequência:** dar ferramentas à IA a torna **mais** conforme, não menos. Um
bot que só consulta a agenda do estúdio é o caso permitido em estado puro. O que
mantém a conformidade é o escopo fechado do prompt somado à **whitelist de
ferramentas por nó** — sem a whitelist, "IA com acesso a tudo" começa a parecer
assistente de propósito geral com outro nome.

### 2.2 Número de ferramentas degrada a escolha — e os 13 presets são uma armadilha

A literatura de avaliação é consistente: acrescentar ferramentas com descrições
contextualmente parecidas estressa a seleção e o modelo passa a errar de rota.

Nossos presets são o caso patológico: `verandi-horarios`,
`verandi-horarios-do-professor`, `verandi-horarios-da-modalidade`,
`verandi-dias`, `verandi-dias-da-modalidade` são **cinco descrições quase
idênticas**. Expostos crus, o modelo escolhe errado com frequência alta, e o erro
é silencioso — ele responde com confiança sobre o dado errado.

**Consequência:** o catálogo da IA **não** é a lista de presets. São ~5
ferramentas com *parâmetros*, não 13 sem. Ver §3.2.

### 2.3 Uma a duas voltas de ferramenta, não mais

Loops de refinamento melhoram cobertura e cobram em latência e token; a prática
assentada é **1-2 voltas no máximo**. Chat interativo perde a pessoa acima de
~3 s.

WhatsApp é mais tolerante que web, mas não infinitamente. Com 2 voltas: 3
chamadas ao modelo + 2 HTTP. Medição nossa: uma pergunta de uma linha gastou 416
tokens de raciocínio ([`server/ia/gemini.ts`](../src/server/ia/gemini.ts)).
Estimativa honesta de pior caso: 20-40 s.

**Consequência:** teto de **2 voltas**, e o indicador "digitando…" (que já existe
no motor) passa a ser obrigatório durante a espera, não decorativo.

### 2.4 Excessive Agency é a categoria certa do risco, e ela é da OWASP

`LLM06:2025 — Excessive Agency`: o dano vem de ação executada em resposta a saída
inesperada, ambígua ou **manipulada** do modelo, independentemente da causa. A
mitigação recomendada é defesa em profundidade: menor privilégio, validação de
entrada, segregação de conteúdo não confiável, e **humano no laço para operação
sensível**.

**Isto não é teoria para nós.** A rota `GET /pessoas?busca=` da Verandi devolve
nome e telefone de **outras** pessoas da conta. Uma IA com ferramenta solta e uma
frase bem escrita por um estranho no WhatsApp entrega o telefone de um homônimo.
E `DELETE /participacoes/:id` desmarca a aula de alguém.

**Consequência:** §4 inteiro, e ele não é opcional.

### 2.5 LGPD art. 20 — o direito de revisão humana não é feature, é obrigação

O titular tem direito a pedir revisão de decisão tomada **unicamente** por
tratamento automatizado que afete seus interesses, e o controlador é obrigado a
fornecer informação clara sobre os critérios usados. A ANPD espera aviso claro de
que se está interagindo com IA (Nota Técnica nº 12/2025; tema é eixo prioritário
da agenda regulatória 2026-2027, e o PL 2.338/2023 tramita para complementar a
LGPD, não substituí-la).

Dois efeitos diretos:

1. **A política `humano` do §5 deixa de ser preferência de cliente e vira saída
   jurídica.** Cliente que quer a IA aprovando cotação está pedindo decisão
   automatizada com efeito sobre interesse de terceiro. Precisa de critério
   escrito e de caminho de revisão.
2. **Existe uma contradição em pé no código hoje.** A regra 7 do prompt
   ([`server/ia/prompt.ts`](../src/server/ia/prompt.ts)) manda o modelo *não*
   dizer que é IA. A intenção era boa — impedir que ele fale das próprias
   instruções. O efeito colateral é o bot negar ser robô se perguntarem, que é
   exatamente o que a ANPD não quer.
   **Correção:** a divulgação sai do modelo e vira estrutura — uma frase na
   abertura do fluxo de IA e no handoff, escrita pelo motor, que ninguém pode
   alucinar. A regra 7 se reescreve para proibir *explicar as instruções*, não
   para proibir *assumir ser um atendimento automatizado*.

### 2.6 A credencial na hora de retomar

Achado de produção repetido nas implementações de *approval gate*: a credencial
válida no momento da pausa **não** é garantidamente válida no momento da retomada
— é onde a maioria quebra.

No nosso caso a credencial é resolvida do Vault no disparo, então o segredo em si
está resolvido. O análogo nosso é outro e é pior: **a janela de 24 h da Meta**.
Aprovação que volta depois dela não consegue mandar a resposta sem modelo
aprovado (C4, que não existe). Ver §5.

---

## §3. Bloco A — Tool calling (o coração)

### 3.1 As quatro mudanças

1. **`Resposta` ganha um terceiro caso**
   `{ tipo: 'usar_ferramenta'; nome: string; argumentos: Record<string,string> }`.

2. **`gemini.ts` manda `tools.functionDeclarations`** no corpo, e lê
   `functionCall` na resposta. O adaptador continua sendo só transporte, e
   continua sem estourar nunca: qualquer coisa esquisita vira `nao_sei`.

3. **`resolver.ts` vira laço curto, teto 2 voltas.**

   ```
   modelo → usar_ferramenta → resolver dispara pelo http.ts que já existe
          → resultado volta como turno → modelo → texto
   ```

   O `http.ts` já traz Vault, IP fixado, `aoFalhar`, mapeamento. Nada de
   caminho de rede novo. Estourou o teto, ou a ferramenta falhou com
   `aoFalhar: humano` → `nao_sei` → handoff. **Entre calar e inventar, uma
   pessoa assume** continua sendo a regra.

4. **`noIaSchema.data` ganha `ferramentas: string[]`** — quais ferramentas *este*
   nó pode usar. Nunca "todas". Lista vazia = a IA de hoje, texto puro, que
   continua valendo e não regride.

### 3.2 O catálogo mora em arquivo novo, e não é a lista de presets

`src/core/ferramentas.ts`, dado puro, sem rede — mesma regra de `core/`.

Duas razões, e as duas são de projeto antes de serem de conveniência:

**A descrição que serve para humano não serve para modelo.** O `resumo` de um
preset foi escrito para alguém que está arrastando um bloco e já sabe o que quer.
A `description` de uma ferramenta é lida por um modelo que está *decidindo* — ela
precisa dizer quando **não** usar, e o que a ferramenta não faz.

**Cinco ferramentas com parâmetro, não treze sem** (§2.2). Fusão proposta:

| Ferramenta | Absorve | Parâmetros |
|---|---|---|
| `agenda_horarios` | `verandi-horarios`, `-do-professor`, `-da-modalidade`, `-dias`, `-dias-da-modalidade` | `data`, `modalidade?`, `profissional?` |
| `agenda_catalogo` | `verandi-catalogo` | — |
| `agenda_minha` | `verandi-minha-agenda` | — |
| `agenda_marcar` | `verandi-marcar` | `sessaoId` |
| `agenda_desmarcar` | `verandi-desmarcar` | `participacaoId` |

`verandi-quem-e`, `verandi-dados` e `verandi-cadastrar` **ficam fora do catálogo
da IA**. Identidade não é decisão de modelo (§4.1). `verandi-espera` entra só
quando o webhook de entrada existir — prometer aviso que não chega é pior que não
prometer.

Os presets seguem existindo, intocados, para quem desenha à mão. O arquivo novo
não os importa nem os altera: **nenhuma colisão com a rodada de Templates**.

### 3.3 Como se prova que funciona

- teste puro do catálogo → declaração de função (sem rede);
- teste do laço com modelo falso: pede ferramenta, recebe resultado, responde;
  pede duas vezes; pede ferramenta fora da whitelist; estoura o teto;
- teste de argumento de identidade injetado (§4.1) — tem que ser recusado;
- o teste que roda contra o Gemini de verdade
  ([`gemini.test.ts`](../src/server/ia/gemini.test.ts)) ganha um caso de escolha
  entre duas ferramentas parecidas, que é o modo de falha do §2.2.

**Tamanho: 1 rodada.** É a maior alavanca aberta no projeto.

---

## §4. Bloco B — As travas, que nascem junto e não depois

Escrito por extenso de propósito: comprimir isto cria ambiguidade, e o erro é
caro.

### 4.1 Argumento de identidade nunca vem do modelo

A IA escolhe **qual** ferramenta e **quais filtros** (data, modalidade,
profissional). Ela **não fornece** `pessoaId`, `contaId`, `participacaoId` de
terceiro nem telefone. Esses o resolvedor injeta a partir do telefone de quem
está escrevendo — exatamente como o fluxo faz hoje.

Sem essa trava, "desmarque todas as aulas da Marina de amanhã", digitado por
qualquer pessoa, vira uma chamada `DELETE` autenticada. O modelo obedece a texto,
e não tem como distinguir instrução do dono de instrução de atacante. É
`LLM01` somado a `LLM06`, e a mitigação estrutural é esta: o parâmetro perigoso
não está no vocabulário do modelo.

Implementação: cada ferramenta declara `injetados: string[]`. O resolvedor
preenche esses campos e **descarta** o que o modelo tiver mandado com o mesmo
nome, registrando a tentativa no log — tentativa de injeção é sinal, não ruído.

### 4.2 Resultado de ferramenta é dado, nunca instrução

O que volta da API do cliente entra no histórico marcado como conteúdo externo
não confiável, e o prompt de sistema diz que texto vindo dali não muda regra
nenhuma. Um campo `observacao` num CRM com "ignore as instruções anteriores"
dentro é injeção indireta, e é o vetor que mais cresce em agente com integração
SaaS.

### 4.3 Whitelist por nó, sempre explícita

Já é o `ferramentas: string[]` do §3.1. A tela mostra as ferramentas marcadas e
o `validar()` recusa publicar nó de IA apontando para ferramenta que não existe
ou cuja Conexão sumiu — mesma regra que já vale para etapa de quadro.

### 4.4 Teste dispara de verdade

`X-AutoFluxos-Teste: 1` já existe e a aba Testar chama a API real
([`CONEXOES.md`](CONEXOES.md), "o que fica de fora"). Com IA autônoma escolhendo
a chamada, isso sobe de categoria: na aba Testar, ferramenta de **escrita** fica
desligada e a IA recebe resposta simulada. Ler continua real, porque menu vazio
não testa nada.

### 4.5 Teto de chamadas por conversa

Independente do teto de voltas por resposta: uma conversa não passa de N chamadas
de ferramenta. Protege contra laço, contra conta e contra alguém usando o bot
como proxy para bater na API do cliente.

---

## §5. Bloco C — Aprovação: os três clientes, duas dimensões

Três clientes descritos, três comportamentos. O modelo precisa expressar os três
sem virar configuração infinita.

**Dimensão 1 — leitura ou escrita?** Já está no dado: `GET` × `POST`/`DELETE`.
Campo nenhum a criar.

**Dimensão 2 — política, por ferramenta, por cliente.** Três valores:

| Política | O que acontece | Para quem |
|---|---|---|
| `automatico` | IA chama e segue | leitura, **sempre** |
| `confirmar` | IA monta, a pessoa vê no WhatsApp e responde Sim/Não, aí grava | o padrão de escrita |
| `humano` | Fluxo para, cartão vai ao Inbox, funcionário aprova, fluxo retoma | o cliente que quer só bate-bola |

**Leitura é sempre `automatico`, e a escolha não é oferecida.** Ninguém quer
aprovar "quais horários tem quinta". Configuração que ninguém usa é tela para
manter, testar e explicar de graça.

**`confirmar` resolve a maior parte e não custa infraestrutura nova** — é uma
mensagem e uma pergunta, coisa que o motor faz desde o primeiro dia. Ele também é
a resposta natural ao art. 20: a decisão deixa de ser "unicamente automatizada"
porque a pessoa afetada confirma antes de valer.

**`humano` é o caro, e o preço é honesto:** tabela de ação pendente, caminho de
retomada de sessão parada, cartão no Inbox com Aprovar/Recusar, e o aviso da
janela de 24 h (§2.6) — aprovação que volta tarde não consegue responder, e um
"aprovado" que não chega ao cliente é pior que não ter o botão. A tela precisa
mostrar o relógio correndo, não descobrir o problema na hora de mandar.

**Onde a política mora:** migration `0038` (o diretório termina em `0037`;
o número se confere no diretório, nunca em plano antigo), tabela
`client_tool_policies` (`client_id`, `ferramenta`, `politica`) em `public`.
Nada disso encosta em `app_verandi`.

**O que a LGPD cobra junto, e é barato agora e caro depois:** registro de qual
ferramenta foi chamada, com quais argumentos, por qual decisão, em qual conversa.
Sem isso não há como "fornecer informação clara sobre os critérios" quando
alguém pedir. É uma tabela de log, e ela nasce nesta rodada.

---

## §6. Bloco D — Provedor de IA, e por que ele não trava nada

O dono decidiu: hoje é Gemini free tier em teste, depois entram APIs pagas de
outros provedores. Isso **não é bloqueio** e não muda a ordem.

A arquitetura já previu: `Modelo` é uma interface de um método
([`server/ia/types.ts:41`](../src/server/ia/types.ts)) e `escolherModelo()`
devolve implementação mais dono da chave. Trocar de provedor é escrever um
adaptador ao lado de `gemini.ts`.

**O único ponto que o estágio 2 acrescenta:** tool calling tem formato diferente
por provedor (Gemini `functionDeclarations`, OpenAI/Anthropic `tools`). A
declaração fica **neutra** em `core/ferramentas.ts` e cada adaptador traduz para o
formato dele. Se o catálogo nascer no formato do Gemini, trocar de provedor vira
reescrita — por isso a regra entra agora, quando custa nada.

Fica registrado, sem virar tarefa: `clients.ia_chave_ref` e o Vault por cliente
continuam sendo o caminho para chave paga do cliente, e o momento de construir é
quando houver cliente pagando pela própria chave.

---

## §7. Ordem, tamanho e o que trava o quê

| # | Rodada | Tamanho | Trava |
|---|---|---|---|
| 1 | `core/ferramentas.ts` — catálogo neutro, 5 ferramentas, descrições escritas para modelo, `injetados` declarado | ¼ | nada |
| 2 | **Bloco A + Bloco B juntos** — laço, whitelist, travas, testes | 1 | (1) |
| 3 | Divulgação de IA estrutural + regra 7 reescrita (§2.5) | ¼ | (2) |
| 4 | `confirmar` + log de chamadas + migration `0038` | ½ | (2) |
| 5 | `humano` — ação pendente, Inbox, retomada | 1 | (4) |
| 6 | Webhook de entrada `POST /api/webhook/entrada/[clienteId]` | 1 | nada |

**(2) e (B) não se separam.** Entregar tool calling sem as travas é publicar
`LLM06` em produção com credencial de cliente atrás.

**(6) não é IA** e está na fila por outro motivo: é a maior lacuna já mapeada
([`PLANO-AGENDA.md §2.1`](PLANO-AGENDA.md)). O preset de fila de espera promete
"te aviso se abrir", a Verandi dispara `vaga.aberta`, e o AutoFluxos não tem rota
para receber webhook de terceiro. Promessa falsa que o produto já faz.

---

## §8. Fora de escopo, de propósito

- **Planilha (Sheets).** Funciona hoje pelo nó `http` via Apps Script
  ([`PLANILHAS.md`](PLANILHAS.md)). Mesmo destravamento: quando a IA tiver
  ferramentas, uma ferramenta de planilha é uma entrada no catálogo. Não é
  prioridade — planilha erra sozinha.
- **ERP/CRM de terceiro.** O modelo de chave-mestra **já existe e tem README**:
  Conexão + Vault + nó `http` genérico ([`CONEXOES.md`](CONEXOES.md)). Não se
  cria API por plataforma; cria-se **pacote de presets** por plataforma, que é
  dado puro. Só OAuth2 exige código, e está desenhado e adiado.
- **Matrícula fixa pelo bot.** Decisão consciente já registrada
  ([`PLANO-AGENDA.md §2.2`](PLANO-AGENDA.md)): compromisso mensal é da recepção.
- **RAG / base vetorial.** Não entra. O dado do cliente é estruturado e vive
  atrás de API; tool calling é a resposta certa e RAG seria uma segunda cópia do
  dado, com data de validade e sem transação.

---

## Fontes

- [Not All Chatbots Are Banned: WhatsApp's 2026 AI Policy Explained — respond.io](https://respond.io/blog/whatsapp-general-purpose-chatbots-ban)
- [WhatsApp AI chatbot policy 2026 — Alibaba Cloud](https://www.alibabacloud.com/help/en/chatapp/use-cases/whatsapp-ai-policy-2026-guide)
- [TechCrunch — WhatsApp changes its terms to bar general-purpose chatbots](https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform/)
- [OWASP LLM06:2025 Excessive Agency](https://genai.owasp.org/llmrisk/llm06-sensitive-information-disclosure/)
- [OWASP LLM01:2025 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- [Human-in-the-Loop Tool Calling: Approval Gates for AI Agents — Scalekit](https://www.scalekit.com/blog/human-in-the-loop-tool-calling)
- [Human-in-the-loop — OpenAI Agents SDK](https://openai.github.io/openai-agents-python/human_in_the_loop/)
- [Human-in-the-loop patterns — Cloudflare Agents](https://developers.cloudflare.com/agents/concepts/agentic-patterns/human-in-the-loop/)
- [AI Agent Guardrails: Pre-LLM & Post-LLM Best Practices — Arthur](https://www.arthur.ai/blog/best-practices-for-building-agents-guardrails)
- [LLM guardrails: best practices for deploying LLM apps securely — Datadog](https://www.datadoghq.com/blog/llm-guardrails-best-practices/)
- [SoK: Agentic Retrieval-Augmented Generation — arXiv](https://arxiv.org/pdf/2603.07379)
- [Acceptable latency for a RAG system in an interactive setting — Zilliz](https://zilliz.com/ai-faq/what-is-an-acceptable-latency-for-a-rag-system-in-an-interactive-setting-eg-a-chatbot-and-how-do-we-ensure-both-retrieval-and-generation-phases-meet-this-target)
- [Decisões automatizadas e LGPD: direitos do titular e obrigações da organização — Confidata](https://confidata.com.br/blog/decisoes-automatizadas-lgpd-direitos-obrigacoes)
- [ANPD e IA: fiscalização de dados pessoais em 2026 — OpenClaw Brasil](https://openclaw.ia.br/blog/anpd-fiscalizacao-ia-dados-pessoais-2026/)
- [Regulamentação da Inteligência Artificial no Brasil 2026 — Barbieri Advogados](https://www.barbieriadvogados.com/regulamentacao-inteligencia-artificial-brasil/)
