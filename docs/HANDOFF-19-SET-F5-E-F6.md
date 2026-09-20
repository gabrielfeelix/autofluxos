# Handoff: F5 e F6 completas, e a produção em dia

> Escrito em 20/set/2026, ao fim da sessão que executou as cinco tarefas da F5 e
> da F6.
>
> **Estado:** F0 a F6 completas e em `origin/main` (último commit `beb0ee9`).
> Banco local e **produção** na **0083**. A próxima migration é a **0084**:
> confira com `ls supabase/migrations/ | tail -1` e **não copie numeração de
> plano nenhum, inclusive deste arquivo**.
>
> **As migrations `0071` a `0083` foram aplicadas em produção nesta sessão**,
> uma por vez, com os dois testes antes e releitura objeto a objeto depois. Ver
> o §5 e o registro em `docs/BANCO-COMPARTILHADO.md`.

## 1. Comece por aqui

```bash
cd /home/gabfelix/dev/4yu-apps/autofluxos
git fetch && git log --oneline -6      # deve terminar em beb0ee9

npx supabase start                     # Docker

npm run test:unit                  # 2029 passam, 14 pulados
npm run test:integration:local     # 444 passam
npm run typecheck                  # limpo
npm run build                      # limpo
npm run lint                       # 8 problemas, 3 errors ANTERIORES
```

Os 3 lint errors continuam sendo os mesmos de sempre, em arquivos não tocados
(`inbox/page.tsx`, `clientes/[clienteId]/page.tsx`, `components/inbox/fila.tsx`).

**O Docker não estava ligado quando esta sessão começou**, ao contrário do que o
handoff anterior dizia. A distro `docker-desktop` do WSL estava `Stopped`, e
`npx supabase start` falhava com "The command 'docker' could not be found in
this WSL 2 distro": o mesmo sintoma que o `BANCO-COMPARTILHADO.md` registra.
Subir o Docker Desktop resolveu.

## 2. O que esta sessão entregou

Cinco tarefas, cinco migrations, cinco commits, todos em `origin/main`.

| Tarefa | Commit | Migration |
|---|---|---|
| T5.1 catálogo e temperatura da oportunidade | `76a2b0c` | 0079 |
| T5.2 venda atômica e o arrasto que se desfaz | `4a2c64e` | 0080 |
| T5.3 agenda humana | `86c53d2` | 0081 |
| T6.1 uma consulta para todas as superfícies | `9469625` | 0082 |
| T6.2 segmentos, prévia e revalidação no envio | `beb0ee9` | 0083 |

### T5.1: a temperatura deixou de ser do contato (0079)

`contacts.temperatura` (0068) tem `default 'morno'`, que sempre quis dizer
"ninguém opinou". A avaliação passou a ser **por oportunidade**
(`quadro_cartoes.temperatura`), anulável e **sem default**.

**Nada foi copiado.** Na produção, depois de aplicar: os 29 cartões com
`temperatura is null` e os 37 contatos seguindo `'morno'`. Copiar teria virado
opinião humana sobre 29 negociações que ninguém avaliou.

O catálogo (`produtos`) é mínimo: nome e ativo/arquivado. Arquivar é coluna e
não `delete`, porque a FK de `venda_itens` é `set null`: apagar não derrubaria
a venda, apagaria o vínculo que a segmentação por produto usa.

**O nome único é índice parcial, só entre os ativos.** Arquivar libera o nome de
volta; desarquivar em cima de um nome tomado é recusado com frase que diz o que
fazer. Só o Postgres prova isso, e o teste de integração prova.

### T5.2: a venda e o fechamento numa transação (0080)

A 0071 criou `vendas` e a 0072 criou `concluir_processo`, e **entre as duas não
havia nada**. `registrar_venda_e_concluir` fecha isso, e
`cancelar_venda_e_resolver` faz o mesmo para o cancelamento (RB-31).

**O teste de corrida foi verificado nos dois sentidos**: com a idempotência e o
`for update` removidos da função, três testes falham.

**RB-23 estava quebrada e foi corrigida:** arrastar para etapa de conclusão
movia o cartão otimista e abria o modal, e cancelar só fechava o modal: o
cartão ficava parado na etapa de ganho, visualmente concluído, sem conclusão
nenhuma no servidor. `aoArrastarPara` (core, testada) guarda de onde o cartão
saiu, e cancelar move de volta.

**O check de `eventos_do_contato.tipo` não foi tocado, e a migration registra
por quê.** A primeira versão ia trocá-lo por uma lista fechada de tipos; o banco
mostrou que o check real é só `length(trim(tipo)) > 0`. Fechar a lista teria
**introduzido** uma trava que não existia, num caminho que roda em toda mensagem
que chega.

### T5.3: lembrete não é envio (0081)

A tentação era reaproveitar `mensagens_agendadas` (0057), que já tem `quando`,
`estado` e uma fila que roda. Custaria uma mensagem enviada ao cliente por
engano: aquela fila **envia**, e não sabe que a linha era um bilhete interno.

`atividades` é tabela própria, **nenhuma fila a lê**, e não há coluna de texto,
destinatário ou canal. O teste prova pelo que **não** acontece: criar atividade
não escreve em `mensagens_agendadas` nem mexe em `contacts.adiada_ate`.

**Sem prazo não é vencida.** Tratar `null` como "vencida desde sempre" encheria
a agenda de vermelho no primeiro dia e ensinaria todo mundo a ignorá-lo.

### T6.1: uma consulta, três superfícies (0082)

O defeito medido tinha duas metades: a tela filtrava por faixa com
`leads.filter(...)` **sobre a página já carregada** (contagem "3 de 50" é 3
daquela página), e o CSV **nem conhecia** o parâmetro: quem filtrava por Ouro e
exportava recebia a base inteira, num arquivo que sai por e-mail.

Agora as duas chamam `contatosDoNivel` → `consultarContatos`, que aplica a
condição no Postgres **antes** de paginar. A view `contatos_comerciais` dá ao
contato os números de venda dele; sem ela, ordenar por valor gasto seria
impossível de paginar.

**Um defeito silencioso que o teste pegou, e que vale guardar:** uma condição de
oportunidade **sozinha** caía num `switch` sem caso correspondente e
**simplesmente não filtrava**: a consulta devolvia a base inteira, sem erro,
com cara de resultado. Foi a fixture de 60 contatos (acima da página de 50) que
o expôs. `SO_DA_OCORRENCIA` separa os campos que só existem dentro da ocorrência
daqueles que também são do contato.

### T6.2: o segmento, a prévia e a revalidação (0083)

RB-38, os três objetos: visão salva (pessoal) ≠ segmento (regra dinâmica) ≠
lista materializada do envio (congelada). `transmissoes.segmento_id` é
**procedência**, nunca fonte do público. O teste prova que editar a regra depois
de confirmar **não** aumenta o lote.

RB-39: a prévia devolve **três** números (correspondentes, elegíveis, excluídos
por motivo) mais amostra de nomes. E a elegibilidade é conferida **de novo em
`tentarUm`**, no instante do envio: verificado nos dois sentidos.

## 3. O que ficou de fora, e por quê

- **Os testes `test/e2e/*.spec.ts` não existem, e Playwright continua não sendo
  dependência.** A T5.3 pede `operacao-comercial.spec.ts` e a T6.2 pede
  `segmentacao.spec.ts`. Instalar Playwright é decisão com custo próprio
  (dependência, navegadores no CI, tempo de execução), e o plano a deixa em
  aberto. **O que cobre esse buraco hoje** são os testes de integração contra o
  Postgres de verdade, que provam as regras onde elas moram; o que falta é a
  jornada pelo navegador.

- **As telas da F4 continuam não existindo** (`editor-de-campos.tsx`,
  `ajustes/campos/page.tsx`, `lead-crm/qualificacao.tsx`). A F6 não precisou
  delas: a segmentação por campo tipado ficou de fora do conjunto inicial de
  `CAMPOS`, que cobre contato, venda e oportunidade. Acrescentá-los é trabalho
  de continuação e mexe só em `core/segmentos.ts` e na compilação.

- **A seleção em lote não passou pela consulta nova.** A RB-37 nomeia "seleção
  em lote" junto de lista, contagem e exportação. Lista, contagem e CSV foram
  unificadas; a seleção em lote da tela continua operando sobre a página
  carregada. Na prática ela **já** opera sobre o resultado correto, porque a
  página agora é a página certa: mas "selecionar todos os 340 do filtro" ainda
  não existe como gesto.

- **`contatosDoNivel` devolve ids, com teto de 5.000.** É a ponte entre a
  consulta nova e a `paginarLeads` antiga. O caminho definitivo é a consulta de
  leads ler direto de `contatos_comerciais`; o teto está declarado no arquivo e
  a produção tem 37 contatos.

- **Não existe opt-out/bloqueio no schema.** A elegibilidade confere número,
  janela e modelo. Quando houver descadastro, ele entra em
  `servicos/elegibilidade.ts` como mais um `MotivoDaExclusao`, e a prévia o
  mostra sem mudança de contrato.

- **A segunda metade da janela gratuita continua pendente**, como nos dois
  handoffs anteriores: a 72h só existe se a empresa responder em 24h do clique,
  e o código não guarda se houve resposta.

- **27 ações ainda não declaram capacidade.** As ações novas desta sessão
  (`acoes-produtos`, `acoes-vendas`, `acoes-atividades`, `acoes-segmentos`)
  todas declaram.

## 4. Armadilhas que custaram tempo nesta sessão

1. **Código no ar antes da migration, e foi incidente de produção.** Ver o §5.
   É a lição da `0058` repetida, e neste repositório ela é mais afiada porque
   **o push é o deploy**.

2. **O handoff anterior errou sobre o estado da produção**, e o erro não era
   pequeno: dizia que faltavam a `0074`–`0078`, e faltavam **a `0071` em
   diante**. Conferir objeto a objeto na produção antes de aplicar é o que
   transformou isso em dez minutos de consulta em vez de uma migration aplicada
   sobre uma base que não tinha o que ela pressupunha.

3. **Filtro que não filtra é pior que filtro que recusa.** A condição de
   oportunidade sozinha devolvia a base inteira sem erro. Fixture **acima do
   tamanho da página** é o que mostra esse tipo de defeito; com 5 contatos de
   teste, ele passaria.

4. **`messages` usa `ts`, e não `criado_em`.** A tabela nasceu antes do
   vocabulário em português do resto do schema, e não tem `client_id`. Fixture
   que monta janela de 24h precisa saber disso.

5. **`templates.nome` exige `^[a-z0-9_]+$`** (é a regra da própria Meta). Marca
   de teste com traço não passa.

6. **`vi.clearAllMocks()` zera o retorno padrão do mock.** O mock novo precisa
   ser re-armado no `beforeEach`, senão a função devolve `undefined` e o
   caminho feliz não roda.

7. **Componente de cliente não importa de módulo `server-only`.** Hoje o build
   aceita quando só tipo e constante atravessam, e quebra na primeira linha com
   banco. `FRASE_DO_MOTIVO` foi para `core/`.

## 5. A produção: o que foi aplicado, quando, e o que a releitura mostrou

**Aplicadas em 20/set/2026 as migrations `0071` a `0083`**, treze, uma por vez,
pela Management API, com autorização explícita do dono para esta execução.

### O incidente que abriu este capítulo

Entre o push da T5.2 e a aplicação das migrations, **a produção quebrou**. O
dono mandou o print: "Alguma coisa quebrou aqui", código `1739245414`, React
#441 no console.

O digest casou com a linha do log da Vercel:

```
Error: não deu para listar os quadros: column quadros.finalidade does not exist
  digest: '1739245414', rota: '/clientes/[clienteId]'
```

A causa foi minha: a T5.2 fez `listarQuadros` ler `quadros.finalidade`, que
existe desde a `0071` **no disco e no Docker local**, e não existia na produção.
O push em `main` é o deploy, então o código novo chegou lá antes do SQL.

**A correção foi aplicar a `0071`**, e o site voltou: a consulta exata que
estourava passou a devolver `finalidade`, e não houve erro novo no log depois
disso.

### Estado conferido antes de aplicar

A produção tinha `0001`–`0070` mais a `0060`, e **a `0059` já não estava
pendente** (`templates` com 3 linhas): o buraco de numeração que o registro da
`0060` descrevia foi fechado entre 15/set e 20/set.

Baseline da Verandi, medido antes de tocar em qualquer coisa: **32** migrations,
**42** tabelas, **16** policies de `storage.objects`. Dado nosso: 37 contatos,
29 cartões, 7 quadros.

### O procedimento, para cada uma das treze

1. **replay do zero em Docker** (`npx supabase db reset`, `0001`–`0083` em
   ordem, sem erro): prova a ordem;
2. **ensaio em transação contra a produção** (`begin; <a migration sem o
   notify>; rollback;`): prova o estado herdado. Os treze voltaram limpos;
3. aplicação;
4. **releitura objeto a objeto na produção.**

O `notify pgrst` é retirado do ensaio de propósito: recarregar o cache dos dois
produtos por causa de uma transação que vai ser desfeita seria arriscar a API da
Verandi para nada.

### O que a releitura mostrou

- as **10 tabelas novas** criadas, a view `contatos_comerciais` com
  `security_invoker = true`, e as 3 funções novas presentes;
- **grants só para `postgres` e `service_role`**; `anon` e `authenticated` não
  aparecem em nenhuma;
- **o dado existente intacto**: 37 contatos e 29 cartões antes e depois;
- **a decisão da `0079` provada no dado real**: os 29 cartões com
  `temperatura is null`, e os 37 contatos seguindo com o `'morno'` legado;
- **`contatos_comerciais` responde com o nulo preservado**: 37 contatos, 0 com
  valor conhecido, 37 sem compra: que é a verdade daquela base, e não um zero
  inventado.

### O reload do PostgREST, nos dois produtos

Três migrations têm `notify pgrst` (`0081`, `0082`, `0083`). Conferido depois:
`atividades`, `segmentos`, `produtos` e `contatos_comerciais` respondem **200**
para `service_role` e **401** para `anon`: sem 404, então não há restart
pendente. E `app_verandi.conta` continua respondendo **200** pelo mesmo
PostgREST.

Do outro lado, medido depois: `app_verandi.migrations_aplicadas` com as mesmas
**32** linhas, **42** tabelas, **16** policies. **A Verandi não foi tocada.**

## 6. Estado por fase

| Fase | Situação |
|---|---|
| F0 a F4 | **completas** (F4 sem as telas) |
| F5 · T5.1, T5.2, T5.3 | **completas** |
| F6 · T6.1, T6.2 | **completas**, sem os e2e |
| F7 a F9 | não iniciadas |

A próxima é a **F7** (modelos, navegação e configuração guiada).

## 7. A regra que esta sessão comprou caro

**Migration primeiro, deploy depois.** Já estava escrita no
`BANCO-COMPARTILHADO.md`, no registro da `0058`, e mesmo assim a produção caiu
pelo mesmo motivo.

Neste repositório não existe um passo de deploy separado para esquecer: `git
push` em `main` **é** o deploy. Então a ordem tem que ser deliberada: aplicar o
SQL **antes** de empurrar o código que o lê, e não depois, por mais que os
testes locais passem todos.
