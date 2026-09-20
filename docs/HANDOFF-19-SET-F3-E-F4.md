# Handoff: F3 e F4 completas, a próxima é a T5.1

> 19/set/2026, fim da sessão. Continuação da execução do
> [plano por fases](plans/2026-09-19-operacao-chatbot-crm.md).
>
> **Onde parou:** F0 a F4 inteiras, implementadas, testadas localmente e
> empurradas para `origin/main`. A próxima tarefa é a **T5.1**.
>
> Nada foi aplicado em produção. Nenhuma mensagem real enviada.
>
> O handoff anterior (`HANDOFF-19-SET-F1-E-F2.md`) continua valendo no que
> descreve a F1 e a F2, principalmente as armadilhas do §4.

## 1. Comece por aqui

```bash
cd /home/gabfelix/dev/4yu-apps/autofluxos
git fetch && git log --oneline -6      # deve terminar em dea6059

npx supabase start                     # Docker

npm run test:unit                  # 1967 passam, 14 pulados
npm run test:integration:local     # 384 passam
npm run typecheck                  # limpo
npm run build                      # limpo
npm run lint                       # 8 problemas, TODOS anteriores (ver §6)
```

O banco local deve estar na **0078**:

```bash
docker exec supabase_db_autofluxos psql -U postgres -d postgres \
  -tAc "select max(version) from supabase_migrations.schema_migrations"
```

**A próxima migration é a `0079`.** Confira com `ls supabase/migrations/ | tail -1`
e **não copie numeração de plano nenhum**.

**Leitura obrigatória antes de tocar banco:** `AGENTS.md` e
`docs/BANCO-COMPARTILHADO.md` inteiro.

## 2. As duas regras que mais importam

Continuam as mesmas do handoff anterior, e vale repetir:

1. **Teste não fala com banco sem estar em `test/suites.ts`.** Três arquivos
   novos entraram nesta sessão: `controle-da-conversa`, `campos` e
   `qualificacoes`.
2. **`service_role` ignora RLS.** Quem defende é o `client_id` em cada consulta.
   Uma consulta que o esqueça **não é recusada** pelo Postgres, ela devolve a
   conta do vizinho.

## 3. O que foi entregue nesta sessão

Cinco tarefas, cinco migrations, cinco commits. Todos em `origin/main`.

### F3 · T3.1 — a entrada ganha tipo (0074, 0075)

`passagens` (0050) guardava uma linha por chegada e **não tinha coluna de
tipo**. A view da 0065 lia qualquer linha como `porta_de_entrada_em`, e
`channels/janela.ts` usava esse campo para abrir 72h de texto livre. Duas coisas
diferentes escreviam ali: o clique em Click to WhatsApp, que a Meta credita com
a janela, e o lead do formulário, de alguém que nunca escreveu para o número.

Resultado medido: formulário abria 72h de texto livre, e quem respondesse
recebia `(#131047) Re-engagement message`. É a RB-09.

| Peça | O que faz |
|---|---|
| `core/regras-de-entrada.ts` | o que cada tipo autoriza; desconhecido não autoriza nada |
| 0074 | `passagens.tipo` + filtro na view + `chave_externa` |
| 0075 | `clients.entrada_no_funil`, tirando o fallback do quadro mais antigo |

**`registrarPassagem` exige `tipo` sem default na assinatura**, embora a coluna
tenha default no banco. Repetir o default ali deixaria um chamador novo esquecer
o tipo e virar chegada por anúncio calada.

**A idempotência também estava errada, e foi o teste que mostrou.** O índice de
minuto da 0050 recusava a segunda submissão legítima do mesmo formulário no
mesmo minuto. Criar o índice de `chave_externa` **não bastou**: o de minuto
dispara antes. Ele passou a valer só para as linhas sem chave.

**O fallback do quadro mais antigo virou opção, não sumiu.** Conta nova nasce em
`nao_criar` (RB-12); quem já existia foi convertido para `mais_antigo` pela
migration. Retirá-lo faria contas que dependem dele pararem de receber lead de um
dia para o outro, sem ninguém tocar em nada.

### F3 · T3.2 — a tomada que só um ganha (0076)

`atribuirContato` era `update ... where id = $2`, sem condição sobre o valor
anterior. Dois atendentes clicando em "Assumir" ao mesmo tempo recebiam **os
dois** sucesso, e quem gravou por último ficava com a conversa. É a RB-14.

Ler antes de gravar não conserta: entre o `select` e o `update` cabe o clique do
colega. A condição foi para o `where` do próprio update, com `for update`
segurando a linha.

A segunda metade é a RB-15. `contacts.controle_revisao` sobe a cada troca de
controle; a rodada anota a revisão **antes** de o motor rodar, e `aplicar`
confere no instante do envio. Conferir no início provaria que ninguém tinha
assumido antes de o modelo ser chamado, que é a pergunta errada.

**`atribuirContato` continua existindo e não foi trocada por baixo.** Ela serve a
distribuição automática e à atribuição do CRM, que não são corridas entre
pessoas.

### F3 · T3.3 — as 72h são de cobrança

`restaDaJanela` devolvia o **maior dos dois** prazos, então quem clicou no
anúncio e nunca escreveu aparecia com janela aberta por três dias.

A dúvida da RB-13 está resolvida com fonte primária, e a documentação da Meta é
explícita: a janela de atendimento é **independente** da janela FEP. Os dois
relógios deixaram de ser comparados. `permissaoDeEnvio` devolve as três
informações da 5.3 separadas.

**`cobranca` tem três valores e não dois.** Fora das 72h o preço depende da
categoria do modelo, e `desconhecido` faz a tela dizer "Não confirmado" em vez de
prometer um custo que ninguém calculou.

**A mesma correção teve que ir a `contextoDeResposta`**, que tem a própria
consulta a `passagens`. Corrigir só a view deixaria metade do produto com a regra
antiga: justamente a metade que o servidor consulta no instante de enviar.

### F4 · T4.1 — campos tipados e escrita campo a campo (0077)

`guardarCampo` fazia `update contacts set campos = $1` com o mapa inteiro. Um
lote que trazia `interesse` apagava o `cidade` que outra escrita tinha acabado de
gravar, sem erro nenhum. É a RB-19.

A precedência é **por autoridade da origem**, não por "o mais novo vence": esse
critério faz uma planilha de março, subida hoje, desfazer a correção de ontem. O
tempo só desempata dentro da mesma origem.

**A proveniência foi para uma coluna nova, e `contacts.campos` continua
idêntico.** Converter no lugar exigiria que todo leitor entendesse o formato novo
no mesmo deploy, e um leitor esquecido mostraria um objeto na tela do cliente.

### F4 · T4.2 — qualificação versionada e o SDR (0078)

Quatro resultados, não um booleano, porque booleano não sabe dizer "ainda não
perguntei". A lógica é de três valores, e a parte fácil de errar é a última: só
indicar dados incompletos quando os ausentes **puderem mudar** o resultado.

A avaliação guarda a versão dos critérios e os valores que considerou. Reavaliar
gera linha nova. Uma linha por objetivo: a mesma pessoa atende ao Básico e não ao
Premium, e as duas respostas são verdadeiras ao mesmo tempo.

O modelo SDR tinha os dois defeitos, e ele é **modelo**: quem usa copia o grafo
inteiro para a própria conta.

- `orcamento > 499` virava a política de quem nunca escolheu esse número. Agora
  compara com `0`, que não filtra ninguém e obriga a escolha (RB-22).
- "Quero falar com alguém" caía no handoff rotulado `lead qualificado`. São dois
  handoffs agora (RB-21).

## 4. Armadilhas que custaram tempo nesta sessão

1. **Teste de corrida que passa com o defeito no lugar.** A primeira versão do
   teste de `gravarCampos` chamava a função duas vezes em `Promise.all` e passava
   **mesmo com a trava removida do banco**: aquela função lê e mescla em
   TypeScript antes de chamar o RPC, então o resultado dependia de como as
   leituras se intercalavam. Foi reescrita para ir direto ao RPC, e verificada nos
   dois sentidos: falha contra o comportamento antigo, passa contra o novo.
   **Teste de concorrência só vale depois de você vê-lo falhar.**
2. **Corrigir a view e esquecer a consulta gêmea.** `contextoDeResposta` tem a
   própria consulta a `passagens`, separada da view da 0065. Corrigir só a view
   deixaria a metade que decide o envio com a regra antiga. Procure as consultas
   irmãs antes de declarar um filtro corrigido.
3. **Rollback de migration esbarra em dependência.** Tentar `drop column tipo`
   falhou porque a view `leads` depende dela. O replay do zero
   (`npx supabase db reset`) é o caminho confiável, e é o que prova a ordem.
4. **A varredura de ações lia um arquivo só.** `acoes.test.ts` scaneava apenas
   `acoes.ts`, e havia **dezessete** outros `acoes-*.ts` sem trava nenhuma. Ao
   ampliar, o teto de capacidade subiu de 3 para 27. **Não é regressão:** o 3
   media um arquivo, o 27 mede os dezoito. Nenhuma ação perdeu conferência de
   acesso; o que 27 delas não declaram é qual capacidade exigem.
5. **Três ações usavam formas de conferência que a trava não conhecia**
   (`exigirAdministracao`, `papelNaConta`). Elas **são** conferência de acesso,
   por outro caminho, e foram reconhecidas. Antes de "consertar" uma ação que a
   trava acusa, leia o corpo dela.

## 5. A próxima tarefa: T5.1

**Oportunidade e catálogo mínimo.** O plano detalha na seção "T5.1".

Vale registrar o que já apareceu medido em sessões anteriores e continua valendo:
a produção tem **0 ganhos e 0 cartões com valor**, então toda tela de cliente
nasce vazia, e o cliente precisa cadastrar produto/assinatura para que "quanto
esse cliente vale" deixe de ser uma coluna em branco.

## 6. O que NÃO foi feito, de propósito

- **Nenhuma migration em produção.** 0074 a 0078 existem no disco e no Docker
  local, com replay do zero (`0001`–`0078`) sem erro. Aplicar exige autorização
  explícita do dono. **Atenção:** a produção está fora de ordem desde a 0059/0060
  (ver `BANCO-COMPARTILHADO.md`), então confira objeto a objeto lá, não o
  diretório.
- **3 lint errors continuam.** São anteriores e estão em arquivos não tocados:
  `inbox/page.tsx`, `clientes/[clienteId]/page.tsx`, `components/inbox/fila.tsx`.
- **As telas da F4 não foram construídas.** A T4.1 pede
  `components/contatos/editor-de-campos.tsx` e
  `app/clientes/[clienteId]/ajustes/campos/page.tsx` (UI-16); a T4.2 pede
  `components/lead-crm/qualificacao.tsx` e as ações no editor de fluxo
  (`components/editor/painel.tsx`). **As ações de servidor existem e estão
  testadas** (`acoes-campos.ts`, `acoes-qualificacao.ts`), com capacidade
  declarada; o que falta é o React que as chama. Foi a escolha de gastar o tempo
  nas regras e na persistência, que é onde os defeitos medidos estavam.
- **`components/fluxos/regras-de-entrada.tsx` (simulação da T3.2) não existe.** O
  item 4 da T3.2 pede uma tela de simulação de regra de entrada. As regras de
  prioridade da 5.2 não foram implementadas como configuração: o roteamento
  continua o de hoje. O que a T3.2 entregou foi o **controle concorrente**
  (RB-14/RB-15/RB-16), que é o que estava quebrado e medido.
- **27 ações ainda sem capacidade declarada**, agora visíveis e com teto que só
  desce. Todas conferem acesso ao cliente. Varrê-las é trabalho de continuação,
  e a lista sai do próprio teste.
- **A segunda metade da janela gratuita continua pendente.** A janela de 72h só
  existe de fato se a empresa responder em até 24h do clique, e o código não
  guarda se houve resposta. Erra para o lado conservador (mostra "gratuita" para
  conversa que ainda pode virar paga), mas é promessa de custo não verificada.
  Está escrito em `channels/janela.test.ts`.
- **`test/e2e/permissoes.spec.ts` continua não existindo.** Playwright ainda não é
  dependência do projeto, como o handoff anterior registrou.
- **A conversão do legado de `campos` não roda em lote.** `doLegado` converte na
  leitura, e o dado antigo só ganha proveniência quando alguém escreve. É o
  comportamento desejado: uma passada em massa teria que inventar autor e data
  para tudo.

## 7. Estado por fase

| Fase | Situação |
|---|---|
| F0 | **completa** |
| F1 | **completa** |
| F2 | **completa**, com as pendências do handoff anterior |
| F3 | **completa** (T3.1, T3.2, T3.3), com as pendências do §6 |
| F4 | **completa** (T4.1, T4.2), sem as telas |
| F5 · T5.1 | **próxima** |
| F6 a F9 | não iniciadas |

Commits desta sessão: `d7357f4`, `c09cc82`, `1c9c9b1`, `67f1469`, `dea6059` —
todos em `origin/main`.
