# Banco de produção compartilhado: leitura obrigatória

> **Pare antes de mexer no banco.** Desde 14/ago/2026, AutoFluxos e Verandi
> usam o mesmo projeto Supabase de produção. São produtos diferentes e não
> compartilham tabelas de domínio, mas compartilham o projeto, o Postgres, o
> Auth, o Storage, as extensões, a Data API, cotas e o destino de backup.

Este documento é a fonte de verdade do lado do AutoFluxos. Deve ser lido antes
de qualquer alteração em migration, Supabase, autenticação, RLS, Storage,
extensão, função SQL, view ou configuração da Data API.

## O mapa atual

| Produto | Onde moram os dados | Autenticação atual | Isolamento interno |
|---|---|---|---|
| **AutoFluxos** | schema `public` | senha única do painel; banco acessado no servidor com `service_role`/chave secreta | RLS ligada e sem políticas; só o servidor acessa |
| **Verandi** | schema `app_verandi` | Supabase Auth | `conta_id` + RLS com políticas por usuário e papel |

São dois isolamentos diferentes:

- **schema separa produto de produto**: Verandi não cria tabela de domínio em
  `public`, e AutoFluxos não cria nada em `app_verandi`;
- **RLS separa conta de conta**: isso já existe na Verandi. No AutoFluxos, as
  políticas entram apenas quando o login por usuário for construído.

O AutoFluxos ainda mora em `public`. Não existe hoje um schema
`app_autofluxos`; qualquer plano de separação que mande apenas derrubá-lo está
incompleto até o produto ser migrado para esse schema ou até existir um plano de
extração explícito para os objetos de `public`.

## Regras que não podem ser quebradas

1. **Nunca rode `supabase db push`, `supabase db reset` ou outro comando de
   reconciliação contra produção.** O histórico global do projeto não representa
   sozinho os dois repositórios. O AutoFluxos aplica SQL pela Management API; a
   Verandi usa o aplicador próprio dela.
2. **Toda migration do AutoFluxos qualifica seus objetos com `public.`.** Não
   dependa do `search_path` do projeto e nunca cite `app_verandi` numa migration
   deste repositório.
3. **O nome da próxima migration vem do disco, não de plano antigo**, e nem
   deste parágrafo. Rode `ls supabase/migrations/ | tail -1`.

   **Este parágrafo não diz mais qual é o número, de propósito.** Ele já esteve
   errado três vezes: dizia `0029` quando o disco tinha `0038`, `0044` quando o
   disco tinha `0046`, e `0047` quando o disco já tinha `0055`. Um documento que
   afirma o número compete com o diretório e perde toda vez, porque ninguém
   lembra de atualizar os dois, e, pior, ele é convincente o bastante para
   alguém confiar nele em vez de olhar. A regra é olhar o diretório, inclusive
   quando um documento afirma um número. Os nomes `0008_limites` e
   `0009_retencao` escritos no plano de endurecimento são exemplos antigos e
   colidem com migrations que já existem, e a tabela do §4 do PLANO-SISTEMA
   divergiu inteira do disco a partir da `0024`, porque a ordem de execução foi
   A6 → A7 → B2 → B1 → B4 → B3 → B5. O disco ganha, sempre.
4. **Mudança global exige avaliar os dois produtos antes.** Isso inclui
   `auth.users`, cadastro e SMTP do Auth, URLs de redirect, Storage e suas
   políticas, extensões, schemas expostos pela Data API, configuração do
   PostgREST, região, rede, limites e backup.
5. **`service_role` não é fronteira entre produtos.** Ela ignora RLS e é a mesma
   infraestrutura de produção. Configurar o cliente para o schema certo evita
   acidentes, mas uma aplicação comprometida com essa chave ainda pode alcançar
   o outro schema. Nunca aceite schema, tabela ou SQL vindos de usuário.
6. **RLS e `GRANT` são camadas diferentes, e desde a `0041` o `GRANT` é a que
   fecha.** `public` está exposto na Data API, e o `db_schema` do PostgREST é
   `public,graphql_public,app_verandi`, então "exposto" aqui nunca foi
   teórico.

   Este parágrafo já teve duas versões erradas, e as duas custam caro se forem
   lidas hoje:

   - a primeira afirmava que não havia `grant` para `anon`/`authenticated`.
     Era falso: 13 dos 42 objetos de `public` tinham os 7 privilégios
     concedidos aos dois papéis, herdados do default do projeto Supabase;
   - a segunda registrou o fato certo e parou na decisão errada: disse que
     revogar em massa "é mudança global e não foi feita", e que bastava
     **nunca criar política sem tratar como exposição pública**. Isso vale
     para tabela e **não vale para função**: função não é protegida por RLS, e
     nenhuma política a alcança.

   O que a `0041` fez, e o que passa a valer:

   - `anon` e `authenticated` não alcançam mais nenhuma tabela, view, sequence
     ou função de `public`;
   - o default do papel `postgres` no schema foi alterado, então **objeto novo
     nasce fechado**, e não depende mais de alguém lembrar de revogar;
   - `service_role` recebeu de volta, explicitamente, tudo o que o revoke
     tirou. Parte do que ele tinha vinha herdada de `PUBLIC`.

   **`revoke ... from anon, authenticated` sozinho não fecha função.** O
   Postgres concede `EXECUTE` a `PUBLIC` implicitamente na criação, e os dois
   papéis herdam de lá o que se revoga deles. A `0026` revogou `pegar_tarefas`
   dos dois e a função seguiu executável pelos dois por meses. A forma certa
   inclui `public` na lista, como a `0040` fez. Migration nova em `public` já
   nasce fechada pelo default; migration que cria função em qualquer outro
   schema continua precisando escrever
   `revoke all on function ... from public, anon, authenticated`.

   O default do papel `supabase_admin` continua concedendo tudo em `public`, e
   `postgres` não é membro dele. Objeto criado por nós nasce como `postgres`,
   então isso não nos alcança, mas objeto criado pela infraestrutura do
   Supabase dentro de `public` pode nascer aberto. Confira depois de qualquer
   coisa que o painel crie sozinho.
7. **Função `security definer` precisa de `search_path` fixo e permissões
   mínimas.** View que encosta em dado protegido precisa de
   `security_invoker = true`. RPC sensível deve revogar `public`, `anon` e
   `authenticated`, concedendo só a role necessária.
8. **Segredo nunca entra no repositório, migration, log ou documento.** URL e
   chaves vêm do ambiente/cofre. O repositório é público.
9. **Não trate o banco compartilhado como integração entre os produtos.** A
   Verandi expõe API/eventos; o AutoFluxos consome essa fronteira. Uma consulta
   cruzada entre schemas criaria acoplamento e impediria separar os produtos.

## Migrations: quem controla o quê

### AutoFluxos

- arquivos em `supabase/migrations/`;
- objetos de domínio em `public`;
- `0001` a `0048` aplicadas em produção (`0039` a `0042` em 03/set/2026, a
  `0046` em 12/set/2026 e as `0047`/`0048` em 13/set/2026, todas com autorização
  explícita do dono). A `0048` é aditiva (duas colunas anuláveis em
  `public.channels`, sem toque em dado existente) e foi conferida só pelo ensaio
  em transação contra a produção, o suficiente para o que ela faz, segundo a
  regra da seção de Docker abaixo. A `0047` é a primeira conferida pelos **dois** testes: o
  replay do zero em Docker (que prova a ordem) e o ensaio em transação contra a
  produção (que prova o estado herdado). O Docker voltou a funcionar quando a
  integração WSL foi ligada para o Ubuntu. Sem ela, o CLI do Supabase sobe os
  containers e falha no health check com "The command 'docker' could not be
  found in this WSL 2 distro". A `0042`
  foi replayada em Docker antes, e conferida depois na produção:
  `af_auditoria` devolve `service_role → INSERT, SELECT` e nada mais;
- **a `0042` conserta um efeito colateral da `0041`**: o `grant all on all
  tables in schema public to service_role` do passo 2 alcançou
  `public.af_auditoria` e devolveu `update`, `delete` e `truncate` à chave da
  aplicação, desfazendo o append-only que a `0021` tinha garantido. Quem
  escrever outro grant amplo em `public` reabre de novo, e o comentário da
  tabela avisa, e o revoke da `0042` precisa ser reexecutado depois;
- aplicação em produção pela Management API do Supabase;
- **a `0094`, a `0095`, a `0096` e a `0097` foram aplicadas em 23/set/2026**
  (plano de UX), com autorização explícita do dono, pela Management API, em
  ordem. Conferidas pelo ensaio em transação contra a produção (as quatro
  juntas, sem o `notify`, com `rollback`): limpo, e a releitura depois do
  rollback voltou a zero. As quatro são aditivas. A **`0094`** cria o bucket
  `autofluxos-avatares` (público, 2 MB, jpeg/png/webp); **Storage é global**,
  e os buckets existentes (`assinatura-recibo`, `foto-*`, `logos` da Verandi e
  `autofluxos-acervo`, `autofluxos-recebidos`) não foram tocados. A **`0095`**
  e a **`0097`** acrescentam colunas anuláveis (`webhooks_de_entrada.recusada_em`;
  `connections.testada_em` e `teste_ok`), sem default e sem reescrever dado:
  nenhuma conexão ficou marcada. A **`0096`** cria
  `public.progresso_das_transmissoes(uuid[])`, só leitura, `EXECUTE` só para
  `service_role` (e o dono `postgres`). A `0097` ganhou o `notify pgrst` antes
  de ser aplicada (ela só existia no local), porque o código lê as colunas
  novas pela Data API. Releitura objeto a objeto depois de aplicar: bucket,
  três colunas com tipo e nulidade, grants da função. **Data API conferida em
  23/set/2026**, nos dois produtos, sem precisar de novo reload:
  `GET connections?select=id,testada_em,teste_ok` com a chave secreta deu 200;
  `POST rpc/progresso_das_transmissoes` com `{"p_ids":[]}` deu 401 (`42501`)
  com a chave pública e 200 (`[]`) com a secreta; `GET conta` com
  `Accept-Profile: app_verandi` deu 200.
- **a `0099` e a `0100` foram aplicadas em 24/set/2026** (plano da
  administração, A6 e A7), com autorização explícita do dono, que valeu só
  para as duas, pela Management API, nessa ordem. Antes, conferido na produção
  que a `0098` já estava lá (`contacts.bsuid`, `contacts.username` e o índice
  `contacts_client_bsuid_key` presentes; ela não tinha registro aqui) e que
  nada apareceu no diretório depois da `0100`.

  A **`0099`** cria `public.planos` (os três planos de `core/planos.ts`, com os
  mesmos valores) e `clients.suspensa_em` (anulável, sem default). A **`0100`**
  cria `public.funcoes` (Proprietário, Administrador, Gestor, Atendente) e
  `af_membros.funcao_id` (anulável, FK `on delete set null`), e classifica os
  membros sem mudar o acesso de ninguém.

  **Ensaio em transação contra a produção, as duas juntas e sem o `notify`**,
  com a política efetiva de cada membro (exceção, senão função, senão papel)
  medida antes e depois dentro da transação: **56** capacidades (7 membros × 8)
  antes, **56** depois, **56** iguais, **zero** diferentes. Os 7 membros da
  produção são `owner` e viraram Proprietário; nenhuma exceção precisou ser
  criada. Depois do `rollback`, nenhuma das duas tabelas nem das duas colunas
  sobrou. No local tinham sido 168 capacidades iguais (21 membros com `member`
  e exceções).

  Releitura objeto a objeto depois de aplicar: `planos` com 3 linhas e
  `funcoes` com 4, as duas com RLS ligada e zero políticas; as duas colunas
  anuláveis sem default; `has_table_privilege` falso nos quatro privilégios
  para `anon` e `authenticated` e verdadeiro para `service_role`; grants só
  de `postgres` e `service_role`; 7 membros em `proprietario`, **0** linhas
  em `membro_capacidades`, **0** organizações suspensas. Medidos antes e
  depois: `app_verandi.migrations_aplicadas` com **35** linhas, **42**
  tabelas e **16** policies de `storage.objects`, iguais; `public` de **80**
  para **82** tabelas e `clients` de **32** para **33** colunas, as únicas
  diferenças esperadas; **6** contas e **45** contatos intactos.

  **As duas têm `notify pgrst`, e o reload foi conferido nos dois produtos:**
  `planos`, `funcoes`, `clients?select=suspensa_em` e
  `af_membros?select=funcao_id` respondem **200** para a chave secreta e
  **401** para a publicável, e `app_verandi.conta` continua em **200**.

  **Aqui o código foi publicado antes da migration, e de propósito:** ele lê
  as colunas novas por `to_jsonb` e cai em `core/planos.ts` e nos papéis
  quando as tabelas não existem, então não havia intervalo em que a tela cai.
- **a `0101` foi aplicada em 24/set/2026** (F2 do plano de navegação e CRM),
  com autorização explícita do dono, pela Management API. Aditiva: uma coluna
  anulável, `quadro_cartoes.previsao_de_fechamento date`, sem default. Ensaio
  em transação antes (coluna 1 dentro, 0 depois do `rollback`). Depois de
  aplicar: tipo `date`, anulável, sem default; **33** cartões intactos, **0**
  com previsão; `public` com **82** tabelas e
  `app_verandi.migrations_aplicadas` com **35**, iguais a antes. Data API:
  `quadro_cartoes?select=previsao_de_fechamento` **200** com a chave secreta e
  `app_verandi.conta` **200**.
- **a `0102` foi aplicada em 24/set/2026** (seções 8, 8.1 e A8 do plano da
  administração), com a autorização escrita do dono em
  `docs/HANDOFF-24-SET-ADMINISTRACAO.md`, pela Management API. Cria
  `planos.preco_excedente` (0,40 / 0,30 / 0,20), cinco colunas anuláveis em
  `clients` (`plano_agendado`, `plano_agendado_para`, `preco_contratado`,
  `preco_agendado`, `preco_agendado_para`) e `public.avisos_de_plano`; troca os
  `check` de ids fixos (`planos_id_check`, `clients_plano_check`) por formato
  (`planos_id_formato`) e chave estrangeira (`clients_plano_fkey` `on delete
  restrict`, `clients_plano_agendado_fkey` `on delete set null`). Único dado
  reescrito: `preco_contratado` preenchido com o preço do plano (6 de 6 contas,
  todas no Essencial, R$ 297).

  Ensaio em transação antes, com o `notify` fora: dentro, os três excedentes,
  6 contas com preço, `clients` com 38 colunas e as duas FKs; depois do
  `rollback`, `clients` de volta a 33 colunas e `avisos_de_plano` ausente.
  Releitura depois de aplicar: `avisos_de_plano` com RLS ligada e 0 políticas,
  `has_table_privilege` falso para `anon`/`authenticated` e verdadeiro para
  `service_role`; `pg_tables` de `public` de 71 para 72; **6** contas e **45**
  contatos intactos; `app_verandi.migrations_aplicadas` **35**, 40 tabelas em
  `app_verandi` e **16** policies de `storage.objects`, iguais a antes. Data
  API: `avisos_de_plano`, `clients?select=plano_agendado,preco_contratado` e
  `planos?select=preco_excedente` **200** com a chave secreta e **401** com a
  publicável; `app_verandi.conta` **200**.

  A migration entrou **antes** do código que lê as colunas novas (regra da
  `0071`); o código publicado até aqui não lê nenhuma delas.
- **a `0103` foi aplicada em 24/set/2026** (F4 do plano de navegação e CRM,
  Loja), com autorização explícita do dono, pela Management API. Aditiva:
  `lojas_integradas.plataforma` passa a aceitar `nuvemshop` e `woocommerce`
  (drop e recria do check; a tabela tinha **0** linhas),
  `lojas_integradas.id_na_plataforma` (texto anulável, índice único parcial
  por plataforma), tabela `public.pedidos_de_loja` (o "Quero esta") e
  `clients.loja_ativa` (booleano anulável, **sem default**: `null` é a regra de
  antes, e nenhuma conta mudou de menu).

  Verandi conferida antes: **35** migrations aplicadas (última `0064`),
  repositório sem alteração local. Ensaio em transação antes, sem o `notify`:
  dentro, `clients` com 39 colunas, `lojas_integradas` com 14, a tabela nova
  com RLS e `has_table_privilege` falso para `anon`/`authenticated`; depois do
  `rollback`, a tabela ausente e `clients` de volta a 38. Releitura depois de
  aplicar: `loja_ativa` boolean anulável sem default, **0** contas com
  escolha; `id_na_plataforma` e o índice presentes; `pedidos_de_loja` com RLS
  ligada, **0** políticas, só `service_role` alcança; `pg_tables` de `public`
  de 72 para 73; **6** contas e **46** contatos intactos;
  `app_verandi.migrations_aplicadas` **35**, 40 tabelas em `app_verandi` e
  **16** policies de `storage.objects`, iguais a antes. Data API depois do
  `notify`: `pedidos_de_loja`, `clients?select=loja_ativa` e
  `lojas_integradas?select=id_na_plataforma` **200** com a chave secreta e
  **401** com a publicável; `app_verandi.conta` **200**.

  **Aqui o deploy veio antes da migration, e o intervalo foi medido:** o
  código de `dd08e98` lê as colunas novas com recuo (`lojaVisivel` cai na regra
  antiga, a lista de pedidos vira vazia, a Nuvemshop vira `null`), então no
  intervalo só o "Quero esta" e o interruptor de Loja recusavam, com mensagem,
  e nenhuma tela caiu.
- **a `0104` foi aplicada em 25/set/2026** (franquia de mensagens de serviço da
  Meta, que passa a ser cobrada em 1/out/2026), com autorização explícita do
  dono, pela Management API. Aditiva: só a tabela `public.consumo_da_meta`
  (cópia diária do `pricing_analytics` de cada WABA), RLS ligada, sem grant
  para `anon`/`authenticated`. Ensaio em transação antes (tabela criada e
  ausente depois do `rollback`); primeira cópia rodada logo depois: 3 WABAs,
  7 pontos, nenhuma falha.
- **a `0084` e a `0085` foram aplicadas em 20/set/2026**, na execução da F7, com
  autorização explícita do dono (pedida para a `0084` e estendida por ele às
  seguintes da F7/F8). As duas conferidas pelos **dois** testes: replay do zero em
  Docker (`0001`–`0085` em ordem, sem erro) e ensaio em transação contra a
  produção, os dois limpos.

  A **`0084`** acrescenta `clients.objetivo` (default `atender`, com check de
  três valores) e `clients.crm_ativo` (default **`true`**). O default `true` é a
  decisão: o natural para recurso opcional seria `false`, e aqui esconderia no
  deploy a tela de funil das 6 contas que usam quadros hoje. Conta nova não
  herda, porque quem cria passa o objetivo e `nasceComCrm` grava `false` para
  quem não escolheu "vender". O ensaio provou isso antes de aplicar: dentro da
  transação as 6 contas caíram em `atender`/`true`, que é como elas já se
  comportam.

  A **`0085`** acrescenta `sequencia_inscricoes.cartao_id` (anulável, `on delete
  set null`), o índice parcial `sequencia_inscricoes_cartao_idx`, e uma
  assinatura nova de `sair_das_sequencias` com três argumentos. **A de dois
  argumentos continua existindo e delega para a de três**, e isso não é sobra: o
  código publicado chama a de dois, e entre a migration e o deploy as duas
  precisam funcionar.

  **O índice único não foi tocado**, e o cabeçalho da migration registra por quê:
  trocar `(sequencia, contato)` por `(sequencia, contato, cartao)` deixaria de
  barrar a duplicata do caso comum, porque em Postgres `unique` não considera dois
  nulos iguais, e o efeito visível seria duas mensagens da mesma sequência no
  mesmo dia para o mesmo número.

  Releitura objeto a objeto depois de aplicar: as duas colunas de `clients` com o
  default pretendido e as 6 contas nelas; `cartao_id` anulável com a FK; **as
  duas assinaturas** da função com `proconfig = {search_path=""}`; o índice novo e
  os 5 antigos intactos. Grants e `EXECUTE` só para `postgres` e `service_role`,
  e **`anon`/`authenticated` conferidos por `has_function_privilege`** e não por
  `information_schema`: é a lição da `0026`, em que o revoke dos dois papéis não
  fechou a função porque o `EXECUTE` vinha de `PUBLIC`.

  **As duas têm `notify pgrst`, e o reload foi conferido nos dois produtos.**
  `clients?select=objetivo,crm_ativo` e `sequencia_inscricoes?select=cartao_id`
  respondem **200** para `service_role` e **401** para `anon` (sem 400, então o
  cache pegou as colunas), o `rpc/sair_das_sequencias` de 3 argumentos responde
  **200**, e `app_verandi.conta` continua respondendo **200** pelo mesmo
  PostgREST.

  Medidos antes e depois das duas: `app_verandi.migrations_aplicadas` com as
  mesmas **32** linhas, **42** tabelas e as **16** policies de `storage.objects`;
  e o dado nosso intacto, **37 contatos** e **29 cartões**. A produção tinha
  **zero inscrições** de sequência, então a `0085` não tinha dado para migrar.

  **A migration entrou antes do push nas duas**, e não depois: o código da T7.1 lê
  `objetivo`/`crm_ativo` e o da T7.3 lê `cartao_id`, então o intervalo entre `git
  push` e o SQL seria a tela caindo, como caiu com a `0071`. A produção está,
  hoje, com `0001`–`0085` inteiras;
- **a `0086` foi aplicada em 21/set/2026**, na execução da T8.2, com autorização
  explícita do dono pedida naquela sessão: a autorização anterior cobria as
  migrations da F7 que já tinham entrado, e não se estendia a esta. Conferida
  pelos **dois** testes: replay do zero em Docker (`0001`–`0086` em ordem, sem
  erro) e ensaio em transação contra a produção, os dois limpos.

  Ela acrescenta `public.handoffs.origem` (`text`, **anulável, sem default e sem
  backfill**, com `check` de `null or in ('prevista','falha')`) e a view
  `public.metricas_de_desfecho`.

  **O nulo é a decisão.** Um default escreveria classificação inventada em cima
  de registro histórico, e nulo quer dizer "gravado antes de o produto saber
  distinguir". Quem lê trata como `falha`, e o porquê está em
  `src/core/desfecho-da-conversa.ts`: chamar de `prevista` inflaria "está tudo
  funcionando" com o que pode ter sido defeito, e esconder defeito de produção é
  o erro caro; contar como falha, no pior caso, gasta o tempo de quem investiga.

  **O ensaio acertou o resultado exato**: dentro da transação a view respondeu
  `bot 5 · falha 9 · aberta 1`, e depois de aplicar de verdade respondeu o mesmo.
  Somam as 15 sessões da produção, e `handoffs where origem is not null` continua
  em **0**: nenhum registro antigo foi reclassificado.

  Releitura objeto a objeto depois: a coluna anulável sem default, o check
  presente, a view com `security_invoker=true`, e **`anon`/`authenticated` fora
  dos grants dela**. Dado nosso intacto: 37 contatos, 29 cartões, 8 handoffs, 15
  sessões.

  **Uma observação que não é falha:** `service_role` recebeu os 7 privilégios na
  view, e não só o `SELECT` que a migration escreve. É o `grant all on all tables
  in schema public to service_role` da `0041` alcançando objeto novo, o mesmo
  efeito que a `0042` documenta para a `af_auditoria`. Quem auditar grants vai
  ver o descompasso entre o que a migration pede e o que o banco mostra.

  **Tem `notify pgrst`, e o reload foi conferido nos dois produtos:**
  `metricas_de_desfecho?select=desfecho` e `handoffs?select=origem` respondem
  **200** para `service_role` e **401** para `anon` (sem 400, então o cache pegou
  os objetos novos), e `app_verandi.conta` continua respondendo **200** pelo
  mesmo PostgREST. `app_verandi.migrations_aplicadas` com as mesmas **32**
  linhas, **42** tabelas e **16** policies de `storage.objects`, antes e depois.

  **A migration entrou antes do push**, e não depois: o código da T8.2 lê os dois
  objetos novos, então o intervalo seria a tela de início caindo, como caiu com a
  `0071`. A produção está, hoje, com `0001`–`0086` inteiras;
- **a `0089` foi aplicada em 20/set/2026**, com autorização explícita do dono
  pedida nesta sessão: a autorização da `0088` valeu só para ela. Conferida
  pelos **dois** testes: replay do zero em Docker (`0001`–`0089` em ordem, sem
  erro) e ensaio em transação contra a produção, os dois limpos.

  Ela acrescenta `clients.onboarding` (`jsonb` anulável) e a função
  `public.preparar_onboarding(uuid, jsonb, text, text, jsonb, jsonb)`, que
  prepara a conta a partir das respostas do assistente.

  **`null` em `onboarding` é o que preserva quem já usa o produto**: as 10
  contas existentes continuam nulas e nenhuma é empurrada para o assistente.

  A função é `security invoker` com `search_path = ''`, toma `for update` na
  linha da empresa (repetir a conclusão não duplica funil nem fluxo) e valida
  todas as entradas contra listas fechadas. O `revoke` inclui `public` na lista,
  como o §6 deste documento exige: sem isso `anon` e `authenticated` herdariam
  `EXECUTE` de `PUBLIC` e o revoke deles não adiantaria nada.

  Releitura objeto a objeto depois de aplicar: coluna `jsonb` anulável com as 10
  contas em `null`, função com `search_path=""`, `has_function_privilege`
  respondendo `false` para `anon` e `authenticated` e `true` para
  `service_role`, e `crm_ativo` intacto nas 10 contas.

  **Data API dos dois produtos depois do `notify pgrst`**: `public.clients` e
  `public.atividades` em 200 com a coluna nova já visível, e `app_verandi.conta`,
  `.contrato`, `.avaliacao` e `.cobranca` em 200.

- **a `0090` foi aplicada em 22/set/2026**, com autorização explícita do dono
  pedida nesta sessão ("sim aplica e pode dar deploy"). Conferida pelo ensaio em
  transação contra a produção, limpo, que é o suficiente para o que ela faz:
  aditiva pura, sem toque em dado existente e sem função nenhuma.

  Ela acrescenta três colunas a `public.clients` (`retomar_bot_ativo` booleano
  `not null default false`, `retomar_bot_minutos` inteiro `not null default 120`,
  `retomar_bot_mensagem` texto anulável) e o índice parcial `sessions_humano_idx`
  sobre `public.sessions (atualizado_em) where status = 'humano'`.

  **Por que `ativo` nasce `false`**: o que ela liga acontece em conversa viva, e
  aplicar a migration não pode mudar o comportamento de nenhuma conta no dia em
  que roda. Conferido depois de aplicar: `count(*) where retomar_bot_ativo` em
  **zero**. Quem liga é o dono, na tela.

  **Por que o interruptor é separado do prazo**: com uma coluna só, `null` seria
  "desligado" e desligar jogaria fora o prazo escolhido. Religar devolveria campo
  vazio, e isso faz qualquer um evitar mexer no interruptor.

  Releitura objeto a objeto depois de aplicar: as três colunas com tipo, default
  e nulidade corretos, `sessions_humano_idx` presente em `pg_indexes`, e nenhuma
  coluna de mesmo nome em `app_verandi`.

  **Medidos antes e depois**, os dois iguais: `app_verandi` com **40** tabelas e
  `app_verandi.migrations_aplicadas` com **34** linhas, `public` com **68**
  tabelas. `public.clients` foi de **29** para **32** colunas, que é a única
  diferença esperada.

- **a `0092` foi aplicada em 23/set/2026**, com autorização explícita do dono
  pedida nesta sessão ("sim autorizo"). Conferida pelo ensaio em transação
  contra a produção, limpo, que basta para o que ela faz: tabela nova, sem
  toque em tabela ou dado existente, sem função.

  Ela cria `public.lojas_integradas`, a loja on-line de cada conta para o bot
  consultar catálogo ao vivo (plano `docs/superpowers/plans/2026-09-23-magento-cross-sell.md`).
  **`ativa` nasce `false`**: aplicar não liga nada em conta nenhuma. As colunas
  do token de administrador (`conexao_id`, `estoque_exato`, `estoque_id`)
  nasceram aqui, desligadas, pelo motivo da `0066`.

  O ensaio provou as travas dentro da transação: endereço `http://` recusado,
  segunda loja `magento` na mesma conta recusada, e `estoque_exato = 'msi'` sem
  `conexao_id` recusado pelo `lojas_estoque_exige_token`. Depois do rollback, a
  tabela não existia.

  Releitura objeto a objeto depois de aplicar: 13 colunas, 7 checks, RLS ligada
  e zero políticas, `has_table_privilege` falso para `anon` e `authenticated`,
  zero linhas. Medidos antes e depois: `app_verandi.migrations_aplicadas` com
  **35** linhas, **42** tabelas e **16** policies de `storage.objects`, iguais;
  `public` de **79** para **80** tabelas, a única diferença esperada; **6**
  contas e **44** contatos intactos.

  **Tem `notify pgrst`, e o reload foi conferido nos dois produtos:**
  `lojas_integradas` responde **200** para a chave secreta e **401** para a
  publicável, e `app_verandi.conta` continua em **200**.

  **A migration entrou antes do código que a lê**, pela regra da `0071`: até
  aqui só a regra pura e o adaptador estão publicados, e nada consulta a tabela.

- **a `0093` foi aplicada em 23/set/2026**, com autorização explícita do dono
  pedida nesta sessão ("Sim, autorizo"). Conferida pelos **dois** testes:
  replay do zero em Docker (`0001`–`0093`, sem erro) e ensaio em transação
  contra a produção, limpo.

  Ela acrescenta a `public.produtos` quatro colunas anuláveis sem default
  (`sku`, `descricao`, `link`, `foto`), os checks de tamanho e de `https://`
  em `link` e `foto`, e o índice único parcial `produtos_sku_ativo_unico_idx`
  em `(client_id, lower(trim(sku)))` entre ativos com sku. É o catálogo
  aguentando o card do produto (plano
  `docs/superpowers/plans/2026-09-23-catalogo-de-produtos.md`).

  No Docker foram provadas as travas: `' ab-12'` depois de `'AB-12'` recusado,
  `http://` recusado em link e foto, arquivar libera o sku, vários itens sem
  sku convivem. Na produção havia **zero** produtos, então nenhum dado a
  migrar.

  Releitura depois de aplicar: as 4 colunas `text` anuláveis, os 4 checks, o
  índice novo e os 3 antigos, `has_table_privilege` falso para `anon` e
  `authenticated`. Medidos antes e depois: `app_verandi.migrations_aplicadas`
  com **35** linhas, **42** tabelas e **16** policies de `storage.objects`,
  iguais; `public` com **80** tabelas; `produtos` de **8** para **12**
  colunas, a única diferença esperada; **6** contas e **44** contatos intactos.
  **Tem `notify pgrst`**: `produtos?select=sku,descricao,link,foto` responde
  **200** para a chave secreta e **401** para a publicável, e
  `app_verandi.conta` continua em **200**.

- **a `0088` foi aplicada em 20/set/2026**, com autorização explícita do dono
  pedida nesta sessão. Conferida pelos **dois** testes: replay do zero em Docker
  (`0001`–`0088` em ordem, sem erro) e ensaio em transação contra a produção,
  os dois limpos.

  Ela é aditiva: duas colunas anuláveis em `public.atividades`, `onde` (texto,
  com check de 500 caracteres) e `hora_marcada` (booleano, default `false`).
  Nenhuma linha existente muda, nenhuma função é criada ou recriada.

  **Por que `hora_marcada` existe**, e não se deduz do `prazo`: `prazo` é
  `timestamptz` e sempre carrega uma hora, porque a `0081` grava meio-dia UTC
  quando só há data. Sem o booleano não há como distinguir "reunião às 14h" de
  "proposta para o dia 22", e a tela mostraria 12:00 para toda atividade sem
  hora combinada.

  Releitura objeto a objeto depois de aplicar: as duas colunas com tipo e
  default corretos, `atividades_onde_check` ativa, `anon` e `authenticated`
  **sem privilégio nenhum** na tabela (só `postgres` e `service_role`, como o
  default fechado da `0041` garante), `count(*)` da tabela em zero, e nenhuma
  coluna de mesmo nome em `app_verandi`.

- **a `0087` foi aplicada em 22/set/2026**, na execução da T9.1 (F9), com
  autorização explícita do dono pedida naquela sessão: a autorização da `0086`
  valeu só para ela. Conferida pelos **dois** testes: replay do zero em Docker
  (`0001`–`0087` em ordem, sem erro) e ensaio em transação contra a produção,
  os dois limpos.

  Ela só **revoga** privilégio: `revoke execute ... from public, anon,
  authenticated` em `concluir_processo`, `resolver_continuidade` (0072) e
  `reabrir_ao_receber` (0049). Nenhuma função é recriada, nenhuma tabela é
  tocada, nenhum dado se move.

  **O defeito que ela conserta é a armadilha da `0026` se repetindo**, e é a
  terceira vez que ela morde neste projeto. A auditoria de isolamento da T9.1
  mediu na produção: três das 31 funções de `public` respondiam verdadeiro para
  `has_function_privilege('anon', ..., 'EXECUTE')`. A causa está no §6 deste
  documento: `revoke ... from anon, authenticated` **não fecha função**, porque
  o Postgres concede `EXECUTE` a `PUBLIC` na criação e os dois papéis herdam de
  lá. A ACL provava, com o `=X/postgres` inicial. A `0072` escreveu o revoke sem
  `public` na lista; a `0049` não escreveu revoke nenhum.

  **Nenhum dado vazou, e o alcance foi medido e não suposto**, para ninguém ler
  isto depois e concluir que houve incidente: `resolver_continuidade` chamada
  por `anon` pela Data API respondia **401** `permission denied for table
  conclusoes_de_processo`, ou seja, a função entrava e o `grant` de tabela da
  `0041` barrava na linha seguinte. `concluir_processo` é `security invoker` e
  cairia no mesmo lugar. `reabrir_ao_receber` é a única `security definer` das
  três, e seria a grave porque ignoraria aquele grant, mas ela retorna
  `trigger`, e o Postgres recusa chamada direta de função de gatilho. O risco
  era **profundidade perdida, não porta aberta**.

  Releitura objeto a objeto depois de aplicar: **zero** funções de `public`
  executáveis por `anon`/`authenticated`; a ACL das três reduzida a
  `postgres=X/postgres | service_role=X/postgres`, sem o `=X/postgres` de
  `PUBLIC`; `service_role` ainda executando as duas chamadas pelo código; e
  **zero** tabelas ou views de `public` alcançáveis pelos dois papéis. Dado
  nosso intacto: **37 contatos, 29 cartões, 8 handoffs, 15 sessões, 6 contas**.

  **O gatilho foi provado na produção, e não só em Docker.** A pergunta que
  precisava de resposta antes era se revogar o `EXECUTE` de `reabrir_ao_receber`
  quebraria o gatilho. Não quebra, porque o Postgres executa função de gatilho
  com os privilégios do dono da tabela e não com os de quem fez o `insert`. Num
  `begin/rollback` contra a produção, um contato `resolvida` que recebe mensagem
  volta a `aberta`, e a transação desfeita não deixou sobra (6 contas antes e
  depois). A guarda contra regressão é
  `src/server/isolamento-do-schema.test.ts`, que conta no catálogo em vez de
  listar nomes: uma lista só pegaria a função que alguém lembrasse de
  acrescentar nela, e o problema é exatamente a que ninguém lembra.

  **Ela não tem `notify pgrst`, e isso é a decisão**, pelo motivo da `0056`: o
  cache do PostgREST é o mesmo dos dois produtos, e nenhum objeto exposto na
  Data API mudou. Recarregar seria arriscar a API da Verandi para nada.

  `app_verandi.migrations_aplicadas` com as mesmas **32** linhas, **42** tabelas
  e **16** policies de `storage.objects`, antes e depois. **A Verandi não foi
  tocada.**

  **Aqui o código foi empurrado antes da migration, e é a exceção que confirma a
  regra da `0071`:** um revoke não muda contrato e nenhum código lê objeto novo,
  então não existe o intervalo em que a tela cai. A produção está, hoje, com
  `0001`–`0087` inteiras;
- **as `0071` a `0083` foram aplicadas em 20/set/2026**, uma por vez, pela
  Management API, com autorização explícita do dono para a execução da F5/F6.
  São treze: `0071` (finalidade e vendas), `0072` (conclusão de processo),
  `0073` (equipes), `0074`/`0075` (tipo e política de entrada), `0076`
  (controle da conversa), `0077` (campos tipados), `0078` (qualificação),
  `0079` (catálogo e temperatura da oportunidade), `0080` (venda atômica),
  `0081` (atividades), `0082` (`contatos_comerciais`) e `0083` (segmentos).

  **O handoff dizia que só faltavam a `0074`–`0078`, e ele estava errado.**
  Conferido objeto a objeto antes de aplicar: `vendas`, `venda_itens`,
  `conclusoes_de_processo` e `equipes` **não existiam** na produção, e
  `quadros.finalidade` também não. Ou seja, a `0071`, a `0072` e a `0073`
  estavam pendentes desde o dia em que foram escritas. É a terceira vez que um
  documento afirma um número de migration e perde para o banco, e vale a mesma
  regra do §3: **o estado da produção se descobre consultando a produção**, e
  nunca lendo um handoff, inclusive este parágrafo.

  **O que a omissão custou, e é o registro mais importante daqui.** O código da
  T5.2 (`listarQuadros` lendo `quadros.finalidade`) foi para a Vercel pelo push
  em `main` antes de a `0071` existir lá. Resultado: a tela `/clientes/[id]`
  estourou em produção com React #441, e o log mostrou
  `column quadros.finalidade does not exist`. É exatamente a inversão que a
  `0058` já tinha documentado: **migration primeiro, deploy depois**, sempre que
  o código novo lê ou escreve objeto novo. Neste repositório o push É o deploy,
  então o intervalo entre as duas coisas não é opcional: ele é o tempo entre
  `git push` e a migration entrar.

  Cada uma foi conferida pelos **dois** testes: replay do zero em Docker
  (`0001`–`0083` em ordem, sem erro) e ensaio em transação contra a produção
  (`begin; <a migration sem o notify>; rollback;`), os treze limpos. Depois,
  releitura objeto a objeto.

  Estado conferido na produção depois de aplicar: as 10 tabelas novas
  (`vendas`, `venda_itens`, `conclusoes_de_processo`, `equipes`,
  `equipe_membros`, `campos_definidos`, `criterios_de_qualificacao`,
  `produtos`, `revisoes_de_venda`, `atividades`, `segmentos`), a view
  `contatos_comerciais` com `security_invoker = true`, as 3 funções novas
  (`concluir_processo`, `registrar_venda_e_concluir`,
  `cancelar_venda_e_resolver`) e as colunas de `passagens`, `clients`,
  `contacts`, `quadro_cartoes` e `transmissoes`. Grants só para `postgres` e
  `service_role`; `anon` e `authenticated` não aparecem em nenhuma.

  **O dado existente ficou intacto, e a `0079` é a prova de que valeu conferir:**
  37 contatos e 29 cartões antes e depois; os 29 cartões com
  `temperatura is null` ("não avaliada") e os 37 contatos seguindo com o
  `'morno'` legado da `0068`. Copiar aquele default para as negociações teria
  transformado um "ninguém opinou" em avaliação humana de 29 negociações, e é o
  erro que a migration foi escrita para não cometer.

  **Três delas têm `notify pgrst`** (`0081`, `0082`, `0083`), e o reload foi
  conferido **nos dois produtos**: `atividades`, `segmentos`, `produtos` e
  `contatos_comerciais` respondem **200** para `service_role` e **401** para
  `anon` (sem 404, então não há restart pendente), e `app_verandi.conta`
  continua respondendo **200** pelo mesmo PostgREST. Do outro lado, medido
  antes e depois: `app_verandi.migrations_aplicadas` com as mesmas **32**
  linhas, **42** tabelas e as **16** policies de `storage.objects`.

  **A `0059` deixou de estar pendente**, e o buraco da numeração fechou: a
  produção tem `templates` com 3 linhas e `transmissoes`, então o que o registro
  da `0060` descrevia como pendente foi aplicado em algum momento entre 15/set e
  20/set. A produção está, hoje, com `0001`–`0083` inteiras;
- **a `0055` foi aplicada em 15/set/2026**, com autorização explícita do dono e
  conferida pelos dois testes: replay ordenado em Docker (as `0043`–`0055`
  aplicadas em sequência sobre o stack local, que já tinha até a `0042`) e
  verificação objeto a objeto **na** produção. Bucket `autofluxos-recebidos`
  com `public = false`, teto de 16 MB e 18 mime types; coluna
  `public.messages.arquivo` em `jsonb` anulável; índice parcial
  `messages_arquivo_idx`; `app_verandi.migrations_aplicadas` intacta com 32
  linhas; e `autofluxos-acervo` seguindo público, como deve.

  **O que só a produção mostrou, e o Docker não podia:** lá existem **16
  policies** em `storage.objects`, todas da Verandi, enquanto o stack local
  tem zero. Foram conferidas uma a uma: as quatro de `INSERT` guardam a regra em
  `with_check` e não em `qual` (por isso aparecem como "sem qual" numa consulta
  ingênua), e **todas as 16 filtram por `bucket_id`**. Nenhuma alcança
  `autofluxos-recebidos`, e com RLS ligado e nenhuma policy casando, `anon` e
  `authenticated` não leem nem escrevem nada nele. Provado no Docker com
  `set local role`: `service_role` enxerga o objeto, `anon` e `authenticated`
  enxergam zero. **Quem criar policy nova em `storage.objects` sem filtrar
  bucket abre este bucket junto**, e é o mesmo tipo de armadilha que a `0042`
  documentou para os `grant` amplos em `public`;
- **a `0056` foi aplicada em 15/set/2026**, com autorização explícita do dono.
  Ela só amplia a lista de `allowed_mime_types` do `autofluxos-acervo` para
  incluir `audio/mp4` e `audio/aac`, o formato que o navegador grava quando
  quem atende manda um áudio pela caixa de resposta. Conferida pelos dois
  testes: replay em Docker (as `0043`–`0056` aplicadas em sequência sobre o
  stack local) e verificação na produção depois. Estado final lá: acervo com
  **9 mime types**, `audio/mp4` e `audio/aac` presentes, `public = true` e teto
  de 16 MB **inalterados**; `autofluxos-recebidos` seguindo privado com 18 mime
  types; os quatro buckets da Verandi (`assinatura-recibo`, `foto-avaliacao`,
  `foto-pessoa`, `foto-profissional`) e o `logos` intocados;
  `app_verandi.migrations_aplicadas` com as mesmas 32 linhas; e as **16
  policies** de `storage.objects` intactas.

  **Ela não tem `notify pgrst`, e isso é a decisão.** O cache do PostgREST é o
  mesmo dos dois produtos, e a `0056` não muda schema nenhum que a Data API
  exponha, e recarregar o cache seria arriscar a API da Verandi para nada.

  **Ela não mexe no `public` do bucket**, que segue sendo o risco em aberto
  registrado no handoff de 15/set: a mídia que sai vai para URL pública e
  permanente, e a regra da `0017` ("documento pessoal não entra") continua sem
  ninguém que a faça cumprir. Fechar isso é outra migration, e depende de o
  envio por `id` estar provado em campo, ver
  `docs/HANDOFF-15-SET-VOZ-E-ENVIO-POR-ID.md`;
- **a `0057` foi aplicada em 15/set/2026**, com autorização explícita do dono.
  Ela cria `public.mensagens_agendadas` (a fila de mensagens marcadas para
  depois) e adiciona `public.messages.transcricao`. É aditiva: tabela nova e
  coluna anulável, sem tocar em dado existente.

  Conferida pelos **dois** testes. Replay do zero em Docker, com `npx supabase db
  reset` aplicou `0001`–`0057` em ordem, sem erro. Ensaio em transação contra a
  produção (`begin; <a migration sem o notify>; rollback;`), que voltou limpo:
  nem a tabela nem a coluna sobraram depois do rollback.

  Estado conferido na produção depois de aplicar: a tabela com as 12 colunas
  desenhadas, **RLS ligada e zero policies**, 3 índices (a chave primária mais
  os dois do plano), `messages.transcricao` presente, e os `grant` só para
  `postgres` e `service_role`, e `anon` e `authenticated` **não aparecem**, o que
  confirma que o default fechado da `0041` continua valendo para objeto novo.
  Do outro lado: `app_verandi.migrations_aplicadas` com as mesmas **32** linhas
  e as **16** policies de `storage.objects` intactas.

  **Ela tem `notify pgrst`, ao contrário da `0056`, e isso é a decisão.** A
  `0057` cria tabela em `public`, que é schema exposto na Data API, e o servidor
  fala com ela pelo PostgREST: sem recarregar o cache,
  `from('mensagens_agendadas')` responde 404 até a próxima reinicialização. O
  cache é o mesmo dos dois produtos e o reload é breve, que é o mesmo movimento que
  a `0052` fez.

  **O que ela deixa em aberto, escrito para ninguém descobrir depois:** a coluna
  `transcricao` guarda o que um modelo de fala devolveu, e hoje esse modelo é o
  Gemini com a **chave da 4YU no free tier**, que treina com o que passa por
  ela. A regra de `server/ia/modelo.ts` vale aqui com mais força, porque voz
  identifica pessoa: por isso a transcrição **nunca é automática**, e só acontece
  quando alguém do atendimento clica. Quando `clients.ia_chave_ref` sair do
  papel, `server/transcrever-audio.ts` passa a usar a chave paga do cliente;
- **a `0058` foi aplicada em 15/set/2026**, com autorização explícita do dono.
  Ela é o funil do CRM: três colunas em `public.contacts` (`estagio`,
  `estagio_mudou_em`, `ultima_mensagem_em`), `seguinte_id` em `public.quadros`,
  duas colunas em `public.quadro_colunas`, seis em `public.quadro_cartoes`, e as
  tabelas novas `public.motivos_de_perda` e `public.eventos_do_contato`.

  **É aditiva, mas mexe em tabela que já tem dado**, e por isso o replay em
  Docker não era opcional aqui, ao contrário da `0048`. Feitos os dois: replay
  do zero (`0001`–`0058` em ordem, sem erro) e ensaio em transação contra a
  produção, que voltou limpo.

  O que a produção mostrou depois de aplicar: as 3 + 2 + 6 colunas presentes, as
  2 tabelas criadas, e **o dado existente intacto**: 27 contatos, todos caindo
  em `estagio = 'novo'` pelo default, e os 5 cartões seguindo `situacao =
  'aberta'`. Grants das tabelas novas só para `postgres` e `service_role`. Do
  outro lado: `app_verandi.migrations_aplicadas` com as mesmas **32** linhas e as
  **16** policies de `storage.objects` intactas.

  **A ordem importou e quase custou caro.** Os commits de CRM que dependem desta
  migration foram escritos antes de ela existir em produção, e
  `receber-mensagem.ts` passou a chamar `anotar` e `aplicarFato` no caminho de
  **toda mensagem que chega**. Publicar o código antes de aplicar o SQL faria o
  webhook estourar em cada mensagem: o bot mudo, sem erro visível na tela de
  ninguém. Migration primeiro, deploy depois, sempre que o código novo escrever
  em objeto novo;
- **a `0060` foi aplicada em 15/set/2026**, com autorização explícita do dono.
  Ela é a pesquisa de satisfação: cria `public.avaliacoes` e a view
  `public.metricas_de_satisfacao`. A `0059` (templates) **não** estava aplicada
  quando esta foi, porque as duas nasceram em chats paralelos, e o disco já tinha a
  `0059` quando esta foi numerada. Aditiva: tabela e view novas, nenhuma coluna
  existente alterada, nenhuma linha reescrita.

  **A produção ficou com um buraco na numeração, e isso é deliberado, mas
  precisa ser sabido.** Aplicadas: `0001`–`0058` e `0060`. A `0059` segue
  **pendente**, e foi conferido na produção que `templates` e `transmissoes` não
  existem lá. Aplicar fora de ordem só é seguro porque a `0060` é
  autocontida: ela não lê, não altera e não referencia nada que a `0059` cria.
  Quem for aplicar a `0059` **não precisa de nada desta**, e o replay em Docker
  continua provando a ordem do zero porque no disco as duas estão na sequência
  certa. O que não vale é supor que "a última aplicada" é o maior número do
  diretório. Na produção, hoje, não é.

  Conferida pelos **dois** testes. Replay do zero em Docker (`npx supabase db
  reset` aplicou `0001`–`0060` em ordem, sem erro), onde também foram provados
  os dois `check`, com nota 11 e `origem` inventada recusadas, e a régua do NPS
  nas bordas: 10 e 9 caem em promotor, 8 e 7 em neutro, 6 e 0 em detrator. É a
  borda do 7 que engana, e é por isso que ela é testada. Depois, ensaio em
  transação contra a produção (`begin; <a migration sem o notify>; rollback;`),
  que voltou limpo: nem a tabela nem a view sobraram.

  Estado conferido na produção depois de aplicar: tabela com as 9 colunas,
  **RLS ligada e zero policies**, 3 índices (a chave primária mais os dois do
  plano), a view presente com `security_invoker = true`, e os `grant` só para
  `postgres` e `service_role`, e `anon` e `authenticated` **não aparecem**. Do
  outro lado: `app_verandi.migrations_aplicadas` com as mesmas **32** linhas e
  as **16** policies de `storage.objects` intactas.

  **Ela tem `notify pgrst`, e o reload foi conferido nos dois produtos**, que é
  o teste que faltava nos registros anteriores. `avaliacoes` pela Data API
  responde **200** para `service_role` e **401** para `anon` (sem 404, então não
  há restart pendente), e o schema `app_verandi` continua respondendo **200**
  pelo mesmo PostgREST. O cache é compartilhado: recarregá-lo sem conferir o
  outro lado é apostar a API da Verandi num movimento nosso.

  **O código que escreve nesta tabela ainda não está publicado**, e aqui a ordem
  é a inversa do aviso da `0058`: a migration foi primeiro, e o bloco `nps` só
  chega à produção no próximo deploy. Enquanto isso a tabela fica vazia, o que
  é seguro, porque nada no caminho de mensagem que já está no ar a procura;
- **a `0065` foi aplicada em 16/set/2026**, com autorização explícita do dono.
  Ela só faz `create or replace view public.leads` acrescentando **uma** coluna
  ao fim: `porta_de_entrada_em`, a última chegada por anúncio daquele contato,
  vinda de um lateral join em `public.passagens`. É o que o produto precisa para
  saber que quem chega por Click to WhatsApp tem janela de 72h, e gratuita, em
  vez das 24h pagas que ele assumia para todo mundo.

  **Nenhuma tabela, nenhuma coluna, nenhuma escrita nova.** O dado já era
  gravado pela `0050`, em `passagens`, no momento exato em que a Meta manda o
  `referral` no webhook. Uma coluna `porta_de_entrada_em` em `contacts` seria
  cópia do `criado_em` de lá, com todo o risco de divergir. O lateral join usa
  `passagens_do_contato_idx (contact_id, criado_em desc)`, que a `0050` já
  criou.

  Conferida só pelo ensaio em transação contra a produção, e não pelo replay em
  Docker: **o Docker segue indisponível nesta máquina** (integração do WSL
  desligada), e pela regra da seção de Docker abaixo o ensaio basta para uma
  view recriada sem toque em dado. Foram dois ensaios. O primeiro provou que a
  view passa a ter 26 colunas dentro da transação e volta a 25 depois do
  `rollback`, sem `porta_de_entrada_em` sobrando. O segundo provou que ela
  devolve o dado: 53 leads, 4 com chegada por anúncio, sobre as 5 linhas de
  `passagens` (uma pessoa passou duas vezes, e o join pega só a última, como
  desenhado).

  Estado conferido na produção depois de aplicar: 26 colunas,
  `porta_de_entrada_em` em `timestamp with time zone`, 53 leads com 4
  preenchidos. Os grants da view só para `postgres` e `service_role`; **`anon` e
  `authenticated` não aparecem**, que é o que importa aqui, porque
  `create or replace view` não redefine grants como um `drop`/`create` faria, e
  o revoke da migration é o cinto e suspensório. Do outro lado:
  `app_verandi.migrations_aplicadas` com as mesmas **32** linhas e as **16**
  policies de `storage.objects` intactas.

  **Ela tem `notify pgrst`, e isso é a decisão.** A view vive em `public`, que é
  schema exposto na Data API, e sem recarregar o cache o PostgREST recusaria a
  leitura da coluna nova. O cache é o mesmo dos dois produtos, mas um
  `reload schema` é o movimento barato: o que o runbook proíbe é mexer em
  *Exposed schemas* pela UI, não recarregar.

  **O código que lê esta coluna ainda não está publicado**, mesma ordem da
  `0058-nps` acima: migration primeiro, deploy depois. Enquanto isso a coluna
  fica lá sem ninguém ler, e o que está no ar não a procura;
- **a `0070` foi aplicada em 18/set/2026**, com autorização explícita do dono.
  Cinco colunas anuláveis ou com default, em três tabelas: `clients.nivel_ouro` e
  `clients.nivel_prata` (`numeric`, default 5000/1000, com o check
  `clients_niveis_coerentes` garantindo ouro > prata);
  `sequencias.dias_sem_conversa` e `sequencias.nivel_alvo`; e
  `sequencia_inscricoes.por_sumico_em`. Mais a troca do
  `sequencias_evento_check` para aceitar `cliente_sumido`: `check` não tem
  `alter`, então é drop e recria, como já foi na 0034.

  **Por que faixa em reais e não quintil:** o RFM clássico corta a base em cinco
  partes iguais, e isso quebra em base pequena: num estúdio com trinta alunas o
  quintil de cima é topo de trinta, e pode ser quem gastou trezentos reais no
  ano. Quintil também move o chão sozinho: entra um cliente grande e todo mundo
  cai de faixa sem ter feito nada.

  **`por_sumico_em` é a coluna que impede o pior erro possível:** quem está
  sumido hoje continua sumido amanhã, e sem ela a passada diária reinscreveria a
  mesma pessoa todo dia: uma mensagem por dia no WhatsApp de um cliente antigo.

  Conferida pelo ensaio em transação antes (recusa ouro < prata, recusa evento de
  sumiço sem dias, aceita o evento novo) e na produção depois: as cinco colunas,
  os três checks, e `app_verandi` intacta com as mesmas 389 colunas;
- **a `0069` foi aplicada em 18/set/2026**, com autorização explícita do dono.
  Ela acrescenta uma coluna anulável a `public.quadro_colunas`: `cor` (`text`,
  com `check` fechando a paleta em oito nomes). Nenhuma tabela nova, nenhuma
  coluna alterada, nenhuma escrita em dado existente: toda etapa que já existia
  continua com `cor is null`, que é "sem cor", e nada muda de aparência até
  alguém escolher um tom.

  **Nome de cor e não `#rrggbb`, de propósito:** o produto tem tema claro e
  escuro, e um hex escolhido no escuro vira texto ilegível no claro: quem
  escolheu não vai testar os dois. Guardando o nome, quem decide o tom é o CSS,
  que já sabe em que tema está.

  Conferida pelo ensaio em transação contra a produção antes de aplicar (aceita
  `azul`, recusa `#ff0000`, aceita `null`) e depois na produção: coluna `text`
  anulável, `quadro_colunas_cor_check` presente, e `app_verandi` intacta com as
  mesmas 389 colunas antes e depois;
- **a `0068` foi aplicada em 17/set/2026**, com autorização explícita do dono.
  Ela acrescenta uma coluna a `public.contacts`: `temperatura` (`text not null
  default 'morno'`, com `check` de `frio`/`morno`/`quente`), mais o índice
  `contacts_temperatura_idx (client_id, temperatura)`. Nenhuma tabela nova,
  nenhuma coluna alterada, nenhuma escrita em dado existente.

  **Por que uma coluna e não o `estagio` que já existe:** o estágio é
  consequência, anda sozinho pelos fatos, e mexer nele na mão é exceção.
  Temperatura é o oposto, e não tem como ser medida: é o quanto quem atendeu
  acredita naquela venda. Duas pessoas na mesma etapa, com a mesma última
  mensagem, podem ser uma quase fechada e uma que só pediu preço por educação.
  Derivá-la de tempo parado seria inventar um número e apresentá-lo como opinião
  de alguém. Quem não opinou fica em `morno`.

  Conferida pelo **ensaio em transação** (`begin; ...; rollback;`) antes de
  aplicar, e por conferência objeto a objeto na produção depois: a coluna existe
  com o default e o `check` pretendidos, o índice existe, os grants trazem só
  `postgres` e `service_role` (`anon` e `authenticated` não aparecem, como a
  `0041` garante para objeto novo), as 35 linhas existentes leem `morno`, e
  `app_verandi` segue com 42 tabelas, medidas antes e depois.

  **Não precisou recarregar o PostgREST**: o cache pegou a coluna sozinho, e o
  teste que prova isso é o `crm.test.ts`, que lê `temperatura` pela Data API e
  passou logo depois de aplicar. `?? 'morno'` na leitura protegia o intervalo
  entre deploy e migration, e continua lá pelo mesmo motivo;
- **a `0067` foi aplicada em 16/set/2026**, com autorização explícita do dono.
  Ela acrescenta duas colunas anuláveis a `public.mensagens_agendadas`:
  `template_id` (uuid) e `template_valores` (jsonb). É o que permite a uma
  mensagem agendada sair por modelo aprovado quando a janela de 24h estiver
  fechada na hora do envio, em vez de falhar.

  **Nulo é o comportamento anterior**, e nenhuma linha muda de sentido: agendada
  sem modelo continua sendo texto livre que depende da janela.

  **`template_id` não tem chave estrangeira para `public.templates`, e é
  decisão.** Um modelo apagado não pode apagar a mensagem que alguém marcou nem
  impedir o envio de ser tentado e falhar com motivo legível. O envio confere o
  modelo no instante de usar, como `acaoRetomarComModelo` já faz, porque a Meta
  pausa modelo por qualidade sem avisar e um `references` não protegeria disso.

  `template_valores` é `jsonb` e não `text[]` porque o modelo pode ganhar
  variável de cabeçalho e de botão depois, e um array de texto obrigaria outra
  migration para caber.

  Conferida pelo ensaio em transação contra a produção (o Docker segue
  indisponível nesta máquina), que voltou limpo, e objeto a objeto depois: as
  duas colunas presentes e anuláveis, `grant` só para `postgres` e
  `service_role`. A tabela tinha **zero linhas** na produção quando foi aplicada,
  então não havia dado para migrar. Do outro lado: `app_verandi` com as mesmas
  **32** migrations, **42** tabelas e as **16** policies de `storage.objects`.

  **Tem `notify pgrst`, e o reload foi conferido nos dois produtos.**
  `mensagens_agendadas?select=template_id,template_valores` responde **200** para
  `service_role` e **401** para `anon` (sem 400, então o cache pegou as colunas
  novas), e `app_verandi.conta` continua respondendo **200** pelo mesmo
  PostgREST.

  **Migration primeiro, deploy depois**, pela razão da `0058`: o código novo
  escreve `template_id` no `insert` de agendar, e publicar antes do SQL faria
  toda tentativa de agendar estourar.

- **a `0066` foi aplicada em 16/set/2026**, com autorização explícita do dono.
  Ela é o plano da conta e a medição do consumo: `clients.plano` (default
  `essencial`), três colunas anuláveis para o gateway que ainda não existe
  (`assinatura_cliente_ref`, `assinatura_ref`, `assinatura_estado`), e as views
  `public.consumo_de_conversas` e `public.consumo_de_arquivos`.

  **A definição de conversa é a decisão desta migration**, e não uma escolha de
  SQL: contato único com entrada **e** saída no mesmo mês. Disparo enviado e não
  respondido não conta, que é o que impede o mês de campanha de explodir a conta
  do cliente justamente quando ele mais precisa da ferramenta. `historico = false`
  fica de fora pelo motivo da `0047`: conversa importada da coexistência é
  conversa antiga chegando de uma vez, e cobrá-la seria cobrar por meses
  anteriores à conexão do número.

  **Nada trava nada, e é deliberado.** Medir vem antes de cobrar, e medir sem
  travar vem antes de travar: se a trava nascesse junto da primeira medição, o
  primeiro erro de contagem viraria cliente sem atender. Nenhum código lê `plano`
  para negar atendimento.

  As colunas do gateway nascem aqui, anuláveis e vazias, em vez de numa migration
  futura: a alternativa é mexer duas vezes em `clients` de produção, e isso é dois
  riscos onde cabia um. Segredo nenhum mora nelas, a credencial vai para o Vault
  por `server/cofre.ts`. `assinatura_estado` fica **sem `check`** de propósito:
  nenhum gateway foi escolhido, e o vocabulário de estado é dele.

  Conferida só pelo ensaio em transação (`begin; <a migration sem o notify>;
  rollback;`), e não pelo replay em Docker, que **segue indisponível nesta
  máquina** (integração do WSL desligada). Pela regra da seção de Docker abaixo o
  ensaio basta aqui: `add column ... default` não reescreve a tabela desde o
  Postgres 11 e o resto são views novas, então o risco é o dado existente, e o
  ensaio rodou contra ele. O rollback voltou limpo: nem colunas, nem views, nem o
  check, nem o índice sobraram.

  **O que só a produção mostrou, e vale para quem for mexer na medição:** das 33
  contatos com mensagem, **23 são bidirecionais e 1 é só saída**. Ou seja, a
  regra do disparo não é hipótese de documento, ela já exclui gente no dado de
  hoje. Quem trocar a definição por "contato com mensagem" passa a cobrar esse um.

  Estado conferido na produção depois de aplicar: as 4 colunas com a nulidade e o
  default desenhados, as **6 contas** em `essencial` (zero com valor inesperado),
  `clients_plano_check` presente, `messages_consumo_idx` criado, as duas views com
  `security_invoker = true` e `grant` só para `postgres` e `service_role`
  (`anon` e `authenticated` **não aparecem**). As views devolvem dado real: 23
  conversas em 2 contas e 121 arquivos somando 23 MB no mês. Do outro lado:
  `app_verandi.migrations_aplicadas` com as mesmas **32** linhas, 42 tabelas e as
  **16** policies de `storage.objects` intactas.

  **Ela tem `notify pgrst`, e o reload foi conferido nos dois produtos.**
  `consumo_de_conversas`, `consumo_de_arquivos` e `clients?select=plano` respondem
  **200** para `service_role` e **401** para `anon` (sem 404, então não há restart
  pendente), e `app_verandi.conta` continua respondendo **200** pelo mesmo
  PostgREST. O cache é compartilhado: recarregá-lo sem conferir o outro lado é
  apostar a API da Verandi num movimento nosso.

  **O código que lê estes objetos ainda não está publicado**, mesma ordem da
  `0060` e da `0065`: migration primeiro, deploy depois. Enquanto isso as colunas
  ficam com o default e as views ficam sem ninguém lendo, e o que está no ar não
  as procura.

- **a `0064` foi aplicada em 16/set/2026**, com autorização explícita do dono.
  Ela cria `public.af_atendentes` e acrescenta duas colunas a `public.clients`:
  `distribuicao` (`manual` por padrão) e `exige_assumir` (`false` por padrão).

  **É a primeira desta sequência que encosta em tabela com dado de produção**, e
  por isso vale registrar o que a torna segura: `add column ... default` não
  reescreve a tabela desde o Postgres 11, o valor fica no catálogo, e o `check`
  de `distribuicao` foi adicionado depois da coluna, quando toda linha já tinha
  o default válido.

  Conferida pelo ensaio em transação antes de aplicar, com as contagens contra o
  dado real: as duas colunas existem, as **9 contas** ficaram em `manual` e
  `false` (zero com valor inesperado), `af_atendentes` nasce com RLS ligada e
  grants só de `postgres` e `service_role`, o `clients_distribuicao_check`
  existe, e `app_verandi` segue com 42 tabelas. Tudo reconferido na produção
  depois de aplicar.

  **O Docker não estava disponível nesta máquina** (integração do WSL
  desligada), então o replay do zero não rodou. Para esta migration o ensaio em
  transação cobre o que importa, porque o risco dela é o dado existente e não a
  ordem das migrations, e o ensaio rodou contra o dado existente. Quem for
  aplicar a próxima migration não aditiva precisa do Docker de volta.

  Nada aqui liga nada sozinho: a conta acorda exatamente como estava, e a
  distribuição só passa a agir quando alguém a escolher na tela da equipe.

- **a `0063` foi aplicada em 16/set/2026**, com autorização explícita do dono.
  Ela cria duas tabelas novas, `public.af_fixadas` e `public.af_favoritas`, e o
  alfinete e a estrela do Inbox, por atendente. Não toca em tabela existente,
  não move dado e não altera coluna nenhuma.

  Conferida pelo **ensaio em transação** (`begin; ...; rollback;` pela
  Management API) antes de aplicar, e por conferência objeto a objeto depois: as
  duas existem com três colunas cada, `relrowsecurity` verdadeiro, **zero
  políticas** (de propósito: todo acesso é pelo servidor com a chave secreta) e
  os grants trazem só `postgres` e `service_role`. `app_verandi` segue com 42
  tabelas, medidas antes e depois.

  **O que o ensaio provou e vale lembrar:** RLS ligada com zero políticas é o
  estado seguro deste projeto desde a 0001, e não um esquecimento. Quem olhar
  `pg_policies` procurando a política destas tabelas não vai achar, e está
  certo assim.

- **a `0062` foi aplicada em 16/set/2026**, com autorização explícita do dono.
  Ela recria `public.leads` para expor duas colunas novas ao fim da lista,
  `ultimo_autor_tipo` e `ultimo_autor_nome`, lidas do `payload` da última
  mensagem no lateral join que a view já fazia. Não toca em tabela, não move
  dado e não altera coluna existente.

  Conferida pelo **ensaio em transação** (`begin; ...; rollback;` pela
  Management API), que é o teste adequado a uma migration aditiva segundo a
  seção de Docker abaixo, e por conferência objeto a objeto na produção depois:
  as duas colunas existem, os grants trazem só `postgres` e `service_role`
  (`anon` e `authenticated` não aparecem, como a `0041` garante para objeto
  novo), e `app_verandi` segue com 42 tabelas.

  **O que só a produção mostrou:** das 568 saídas gravadas, apenas 72 têm autor
  no `payload`. As outras 496 são o eco da coexistência, quando alguém responde
  pelo celular em vez do painel: elas chegam pelo webhook sem passar por
  `registrarSaida` e não têm autor nenhum. Quem for mexer na tela da fila
  precisa saber disso antes de tratar "sem autor" como caso raro, porque hoje
  ele é a maioria.

- **as `0059` e `0061` foram aplicadas em 15/set/2026**, com autorização
  explícita do dono, e **nessa ordem**, porque a `0061` adiciona
  `sequencia_passos.template_id` referenciando `public.templates`, que só existe
  depois da `0059`. Com isso a produção tem `0001`–`0061` e o buraco da
  numeração fechou.

  **O replay em Docker pegou duas bombas que a produção não teria perdoado**, e
  as duas justificam sozinhas o custo de rodar o teste:

  1. `check (nome ~ '^[a-z0-9_]{1,512}$')` em `templates`. **O Postgres recusa
     repetição acima de 255** (`invalid repetition count(s)`), mas o
     `create table` passa e a tabela nasce com o check aparentemente correto. O
     erro só aparece no primeiro `insert`, quer dizer: aplicar tudo, ver tudo
     verde, e o primeiro cliente que criasse um modelo levaria um erro de regex
     vindo do banco. Trocado por `length(nome) between 1 and 512`.
  2. **As quatro tabelas nasciam sem RLS.** Eram as únicas quatro sem RLS no
     schema inteiro. Corrigido para o padrão da `0058`/`0060`: RLS ligada, zero
     políticas, `revoke` de `anon` e `authenticated`.

  A `0059` também redefinia `public.tocar_atualizado_em()` com `create or
  replace` **sem** `security invoker` nem `set search_path = ''`. Não daria erro:
  apagaria em silêncio a proteção que a `0001` pôs, para todas as tabelas que
  usam esse gatilho de uma vez. Consertado antes de aplicar, e a migration agora
  só **usa** a função existente. Conferido depois na produção: `prosecdef = f` e
  `proconfig = {search_path=""}`, intactos.

  Conferidas pelos **dois** testes. Replay do zero em Docker (`0001`–`0061` em
  ordem, sem erro), onde também foram provados os quatro casos do `check` da
  `0061`: 4320min sem modelo **recusa**, 4320min com modelo **aceita**, 60min sem
  modelo **aceita**, e 43201min (acima de 30 dias) **recusa mesmo com modelo**.
  Depois, ensaio em transação contra a produção (`begin; <as duas migrations sem
  o notify>; rollback;`), que voltou limpo: nem as tabelas nem a coluna
  sobraram.

  Estado conferido na produção depois de aplicar: as 4 tabelas com **RLS ligada
  e zero policies**, `grant` só para `postgres` e `service_role` (`anon` e
  `authenticated` **não aparecem**), o check `sequencia_passos_atraso_valido` com
  a regra composta, e **um `insert` real em `templates` funcionando**, que é
  onde a bomba do regex teria explodido. Dado existente intacto: 31 contatos.
  Do outro lado: `app_verandi.migrations_aplicadas` com as mesmas **32** linhas e
  as **16** policies de `storage.objects` intactas.

  **As duas têm `notify pgrst`, e o reload foi conferido nos dois produtos.**
  `templates` e `transmissoes` pela Data API respondem **200** para
  `service_role` e **401** para `anon` (sem 404, então não há restart pendente),
  `sequencia_passos?select=template_id` responde 200, e `app_verandi` continua
  respondendo **200** pelo mesmo PostgREST.

  **O código já estava publicado quando estas foram aplicadas**, o inverso do
  aviso da `0058`, e sem o mesmo risco: nada no caminho de mensagem que já
  estava no ar procura estas tabelas. O que ficou quebrado no intervalo foi só a
  tela `/transmissoes` e a reconciliação diária, que conta a falha e não derruba
  o resto da manutenção;
- nunca deve executar o aplicador da Verandi nem registrar versão em
  `app_verandi.migrations_aplicadas`.

### Testar migration antes de produção, em Docker

O projeto de produção é dividido com a Verandi e **não tem backup**. Antes de
aplicar qualquer migration lá, replay local:

```bash
npx supabase start     # sobe o stack e aplica supabase/migrations em ordem
npx supabase db reset  # replay do zero, para conferir uma migration nova
npx supabase stop
```

O `supabase/config.toml` deste repositório existe **só** para isso, com portas
`5643x` para não colidir com o stack local da Verandi (`5642x`). Ele não está
ligado a projeto remoto nenhum, e `link`/`db push` continuam proibidos.

**Quando não há Docker**, e foi o caso em 12/set/2026, numa WSL2 sem
integração ligada, o substituto é o ensaio em transação: mandar
`begin; <a migration>; rollback;` pela Management API. Ele prova mais que o
Docker numa coisa e menos em outra. Mais: roda contra o estado real da
produção, com os anos de `grant` acumulados que um banco novo não tem. Menos:
não prova a ordem das migrations desde o zero, porque não replaya nada. Serve
para migration aditiva conferida objeto a objeto depois; não serve para trocar
o replay quando a migration mexe em dado que já existe.

O que o local prova: que a migration roda, na ordem, e que o estado final de
`grant` é o pretendido. Foi assim que a `0042` foi conferida, com `set role
service_role` tentando `update`, `delete` e `truncate` em `af_auditoria` e
levando `permission denied` nos três. O que ele **não** prova: o estado herdado
da produção, que tem anos de `grant` acumulado que um banco novo não tem. Para
isso, a conferência é uma consulta na produção depois de aplicar.

### Verandi

- arquivos `0030_vr_...` em diante no repositório `verandi`;
- objetos de domínio em `app_verandi`;
- cada migration começa com
  `set search_path = app_verandi, extensions`, sem `public`;
- aplicação por `node scripts/aplica-em-producao.mjs`;
- controle próprio em `app_verandi.migrations_aplicadas`;
- nunca usa `supabase db push` em produção.

A numeração diferente ajudava a leitura humana e **deixou de ajudar**: a
Verandi começa em `0030_vr_` e o AutoFluxos chegou na `0029`. Os números vão se
cruzar no próximo. O prefixo `vr_` continua distinguindo, e o que sempre valeu
segue valendo: nenhum repositório aplica as migrations do outro, e o arquivo de
um nunca é lido a partir do outro. Se a confusão aparecer na prática, o caminho
é o AutoFluxos ganhar prefixo próprio, e nunca renumerar o que já foi aplicado.

## O que o schema não separa

- **`auth.users`:** usuários são globais ao projeto. Quando o AutoFluxos ganhar
  login individual, precisa de vínculo próprio entre usuário e cliente; existir
  no Auth não significa pertencer ao AutoFluxos.
- **Storage:** buckets e `storage.objects` ficam fora dos schemas de domínio.
  Nome de bucket e de política precisa identificar o produto, e o roteiro de
  remoção precisa limpá-los explicitamente.
- **Extensões:** são compartilhadas. Não remover extensão porque “este produto
  não usa” sem conferir o outro.
- **Data API/PostgREST:** schemas expostos e reload de cache afetam os dois.
- **Operação:** CPU, conexões, tamanho, cotas, indisponibilidade, backup e
  restauração têm o mesmo raio de impacto.
- **Desastre:** no plano gratuito não há PITR. Um erro destrutivo pode atingir
  os dois produtos e restaurar significa restaurar o projeto inteiro.

## Checklist antes de qualquer alteração de banco

- [ ] Li este documento e o estado atual do outro produto.
- [ ] Confirmei `git status` e preservei trabalho local.
- [ ] Descobri a última migration pelo diretório, não por um plano antigo.
- [ ] Listei cada objeto criado ou alterado e o schema de destino.
- [ ] Confirmei que não há consulta ou chave estrangeira cruzando produtos.
- [ ] Avaliei se Auth, Storage, extensão ou Data API serão afetados globalmente.
- [ ] Defini `GRANT`, RLS, políticas, `search_path` e permissões de funções.
- [ ] Testei localmente e revisei o SQL antes de pedir autorização para produção.
- [ ] Usei somente o aplicador do produto dono da migration.
- [ ] Verifiquei os dois produtos depois da aplicação.

## Quando separar os projetos

O compartilhamento é uma decisão temporária de custo. Ele deixa de ser aceitável
quando houver cliente pagante, exigência de backup/isolamento, volume que faça um
produto afetar o outro ou necessidade de credenciais administrativas realmente
separadas.

Na separação, não basta copiar tabelas. É preciso tratar `auth.users`, Storage,
extensões, configurações da Data API, secrets e os objetos do AutoFluxos que
hoje ainda estão em `public`.
