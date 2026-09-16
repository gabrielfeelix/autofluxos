# Banco de produção compartilhado — leitura obrigatória

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
3. **O nome da próxima migration vem do disco, não de plano antigo** — e nem
   deste parágrafo. Rode `ls supabase/migrations/ | tail -1`.

   **Este parágrafo não diz mais qual é o número, de propósito.** Ele já esteve
   errado três vezes: dizia `0029` quando o disco tinha `0038`, `0044` quando o
   disco tinha `0046`, e `0047` quando o disco já tinha `0055`. Um documento que
   afirma o número compete com o diretório e perde toda vez, porque ninguém
   lembra de atualizar os dois — e, pior, ele é convincente o bastante para
   alguém confiar nele em vez de olhar. A regra é olhar o diretório, inclusive
   quando um documento afirma um número. Os nomes `0008_limites` e
   `0009_retencao` escritos no plano de endurecimento são exemplos antigos e
   colidem com migrations que já existem — e a tabela do §4 do PLANO-SISTEMA
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
   fecha.** `public` está exposto na Data API — o `db_schema` do PostgREST é
   `public,graphql_public,app_verandi` —, então "exposto" aqui nunca foi
   teórico.

   Este parágrafo já teve duas versões erradas, e as duas custam caro se forem
   lidas hoje:

   - a primeira afirmava que não havia `grant` para `anon`/`authenticated`.
     Era falso: 13 dos 42 objetos de `public` tinham os 7 privilégios
     concedidos aos dois papéis, herdados do default do projeto Supabase;
   - a segunda registrou o fato certo e parou na decisão errada — disse que
     revogar em massa "é mudança global e não foi feita", e que bastava
     **nunca criar política sem tratar como exposição pública**. Isso vale
     para tabela e **não vale para função**: função não é protegida por RLS, e
     nenhuma política a alcança.

   O que a `0041` fez, e o que passa a valer:

   - `anon` e `authenticated` não alcançam mais nenhuma tabela, view, sequence
     ou função de `public`;
   - o default do papel `postgres` no schema foi alterado, então **objeto novo
     nasce fechado** — não depende mais de alguém lembrar de revogar;
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
   então isso não nos alcança — mas objeto criado pela infraestrutura do
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
  em transação contra a produção — o suficiente para o que ela faz, segundo a
  regra da seção de Docker abaixo. A `0047` é a primeira conferida pelos **dois** testes: o
  replay do zero em Docker (que prova a ordem) e o ensaio em transação contra a
  produção (que prova o estado herdado). O Docker voltou a funcionar quando a
  integração WSL foi ligada para o Ubuntu — sem ela, o CLI do Supabase sobe os
  containers e falha no health check com "The command 'docker' could not be
  found in this WSL 2 distro". A `0042`
  foi replayada em Docker antes, e conferida depois na produção:
  `af_auditoria` devolve `service_role → INSERT, SELECT` e nada mais;
- **a `0042` conserta um efeito colateral da `0041`**: o `grant all on all
  tables in schema public to service_role` do passo 2 alcançou
  `public.af_auditoria` e devolveu `update`, `delete` e `truncate` à chave da
  aplicação, desfazendo o append-only que a `0021` tinha garantido. Quem
  escrever outro grant amplo em `public` reabre de novo — o comentário da
  tabela avisa, e o revoke da `0042` precisa ser reexecutado depois;
- aplicação em produção pela Management API do Supabase;
- **a `0055` foi aplicada em 15/set/2026**, com autorização explícita do dono e
  conferida pelos dois testes: replay ordenado em Docker (as `0043`–`0055`
  aplicadas em sequência sobre o stack local, que já tinha até a `0042`) e
  verificação objeto a objeto **na** produção. Bucket `autofluxos-recebidos`
  com `public = false`, teto de 16 MB e 18 mime types; coluna
  `public.messages.arquivo` em `jsonb` anulável; índice parcial
  `messages_arquivo_idx`; `app_verandi.migrations_aplicadas` intacta com 32
  linhas; e `autofluxos-acervo` seguindo público, como deve.

  **O que só a produção mostrou, e o Docker não podia:** lá existem **16
  policies** em `storage.objects` — todas da Verandi — enquanto o stack local
  tem zero. Foram conferidas uma a uma: as quatro de `INSERT` guardam a regra em
  `with_check` e não em `qual` (por isso aparecem como "sem qual" numa consulta
  ingênua), e **todas as 16 filtram por `bucket_id`**. Nenhuma alcança
  `autofluxos-recebidos`, e com RLS ligado e nenhuma policy casando, `anon` e
  `authenticated` não leem nem escrevem nada nele. Provado no Docker com
  `set local role`: `service_role` enxerga o objeto, `anon` e `authenticated`
  enxergam zero. **Quem criar policy nova em `storage.objects` sem filtrar
  bucket abre este bucket junto** — é o mesmo tipo de armadilha que a `0042`
  documentou para os `grant` amplos em `public`;
- **a `0056` foi aplicada em 15/set/2026**, com autorização explícita do dono.
  Ela só amplia a lista de `allowed_mime_types` do `autofluxos-acervo` para
  incluir `audio/mp4` e `audio/aac` — o formato que o navegador grava quando
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
  exponha — recarregar o cache seria arriscar a API da Verandi para nada.

  **Ela não mexe no `public` do bucket**, que segue sendo o risco em aberto
  registrado no handoff de 15/set: a mídia que sai vai para URL pública e
  permanente, e a regra da `0017` ("documento pessoal não entra") continua sem
  ninguém que a faça cumprir. Fechar isso é outra migration, e depende de o
  envio por `id` estar provado em campo — ver
  `docs/HANDOFF-15-SET-VOZ-E-ENVIO-POR-ID.md`;
- **a `0057` foi aplicada em 15/set/2026**, com autorização explícita do dono.
  Ela cria `public.mensagens_agendadas` (a fila de mensagens marcadas para
  depois) e adiciona `public.messages.transcricao`. É aditiva: tabela nova e
  coluna anulável, sem tocar em dado existente.

  Conferida pelos **dois** testes. Replay do zero em Docker — `npx supabase db
  reset` aplicou `0001`–`0057` em ordem, sem erro. Ensaio em transação contra a
  produção (`begin; <a migration sem o notify>; rollback;`), que voltou limpo:
  nem a tabela nem a coluna sobraram depois do rollback.

  Estado conferido na produção depois de aplicar: a tabela com as 12 colunas
  desenhadas, **RLS ligada e zero policies**, 3 índices (a chave primária mais
  os dois do plano), `messages.transcricao` presente, e os `grant` só para
  `postgres` e `service_role` — `anon` e `authenticated` **não aparecem**, o que
  confirma que o default fechado da `0041` continua valendo para objeto novo.
  Do outro lado: `app_verandi.migrations_aplicadas` com as mesmas **32** linhas
  e as **16** policies de `storage.objects` intactas.

  **Ela tem `notify pgrst`, ao contrário da `0056`, e isso é a decisão.** A
  `0057` cria tabela em `public`, que é schema exposto na Data API, e o servidor
  fala com ela pelo PostgREST: sem recarregar o cache,
  `from('mensagens_agendadas')` responde 404 até a próxima reinicialização. O
  cache é o mesmo dos dois produtos e o reload é breve — é o mesmo movimento que
  a `0052` fez.

  **O que ela deixa em aberto, escrito para ninguém descobrir depois:** a coluna
  `transcricao` guarda o que um modelo de fala devolveu, e hoje esse modelo é o
  Gemini com a **chave da 4YU no free tier**, que treina com o que passa por
  ela. A regra de `server/ia/modelo.ts` vale aqui com mais força, porque voz
  identifica pessoa: por isso a transcrição **nunca é automática** — só acontece
  quando alguém do atendimento clica. Quando `clients.ia_chave_ref` sair do
  papel, `server/transcrever-audio.ts` passa a usar a chave paga do cliente;
- **a `0058` foi aplicada em 15/set/2026**, com autorização explícita do dono.
  Ela é o funil do CRM: três colunas em `public.contacts` (`estagio`,
  `estagio_mudou_em`, `ultima_mensagem_em`), `seguinte_id` em `public.quadros`,
  duas colunas em `public.quadro_colunas`, seis em `public.quadro_cartoes`, e as
  tabelas novas `public.motivos_de_perda` e `public.eventos_do_contato`.

  **É aditiva, mas mexe em tabela que já tem dado** — e por isso o replay em
  Docker não era opcional aqui, ao contrário da `0048`. Feitos os dois: replay
  do zero (`0001`–`0058` em ordem, sem erro) e ensaio em transação contra a
  produção, que voltou limpo.

  O que a produção mostrou depois de aplicar: as 3 + 2 + 6 colunas presentes, as
  2 tabelas criadas, e **o dado existente intacto** — 27 contatos, todos caindo
  em `estagio = 'novo'` pelo default, e os 5 cartões seguindo `situacao =
  'aberta'`. Grants das tabelas novas só para `postgres` e `service_role`. Do
  outro lado: `app_verandi.migrations_aplicadas` com as mesmas **32** linhas e as
  **16** policies de `storage.objects` intactas.

  **A ordem importou e quase custou caro.** Os commits de CRM que dependem desta
  migration foram escritos antes de ela existir em produção, e
  `receber-mensagem.ts` passou a chamar `anotar` e `aplicarFato` no caminho de
  **toda mensagem que chega**. Publicar o código antes de aplicar o SQL faria o
  webhook estourar em cada mensagem — o bot mudo, sem erro visível na tela de
  ninguém. Migration primeiro, deploy depois, sempre que o código novo escrever
  em objeto novo;
- **a `0060` foi aplicada em 15/set/2026**, com autorização explícita do dono.
  Ela é a pesquisa de satisfação: cria `public.avaliacoes` e a view
  `public.metricas_de_satisfacao`. A `0059` (templates) **não** estava aplicada
  quando esta foi — as duas nasceram em chats paralelos, e o disco já tinha a
  `0059` quando esta foi numerada. Aditiva: tabela e view novas, nenhuma coluna
  existente alterada, nenhuma linha reescrita.

  **A produção ficou com um buraco na numeração, e isso é deliberado — mas
  precisa ser sabido.** Aplicadas: `0001`–`0058` e `0060`. A `0059` segue
  **pendente**, e foi conferido na produção que `templates` e `transmissoes` não
  existem lá. Aplicar fora de ordem só é seguro porque a `0060` é
  autocontida: ela não lê, não altera e não referencia nada que a `0059` cria.
  Quem for aplicar a `0059` **não precisa de nada desta**, e o replay em Docker
  continua provando a ordem do zero porque no disco as duas estão na sequência
  certa. O que não vale é supor que "a última aplicada" é o maior número do
  diretório — na produção, hoje, não é.

  Conferida pelos **dois** testes. Replay do zero em Docker (`npx supabase db
  reset` aplicou `0001`–`0060` em ordem, sem erro), onde também foram provados
  os dois `check` — nota 11 e `origem` inventada recusadas — e a régua do NPS
  nas bordas: 10 e 9 caem em promotor, 8 e 7 em neutro, 6 e 0 em detrator. É a
  borda do 7 que engana, e é por isso que ela é testada. Depois, ensaio em
  transação contra a produção (`begin; <a migration sem o notify>; rollback;`),
  que voltou limpo: nem a tabela nem a view sobraram.

  Estado conferido na produção depois de aplicar: tabela com as 9 colunas,
  **RLS ligada e zero policies**, 3 índices (a chave primária mais os dois do
  plano), a view presente com `security_invoker = true`, e os `grant` só para
  `postgres` e `service_role` — `anon` e `authenticated` **não aparecem**. Do
  outro lado: `app_verandi.migrations_aplicadas` com as mesmas **32** linhas e
  as **16** policies de `storage.objects` intactas.

  **Ela tem `notify pgrst`, e o reload foi conferido nos dois produtos** — que é
  o teste que faltava nos registros anteriores. `avaliacoes` pela Data API
  responde **200** para `service_role` e **401** para `anon` (sem 404, então não
  há restart pendente), e o schema `app_verandi` continua respondendo **200**
  pelo mesmo PostgREST. O cache é compartilhado: recarregá-lo sem conferir o
  outro lado é apostar a API da Verandi num movimento nosso.

  **O código que escreve nesta tabela ainda não está publicado**, e aqui a ordem
  é a inversa do aviso da `0058`: a migration foi primeiro, e o bloco `nps` só
  chega à produção no próximo deploy. Enquanto isso a tabela fica vazia — o que
  é seguro, porque nada no caminho de mensagem que já está no ar a procura;
- **as `0059` e `0061` foram aplicadas em 15/set/2026**, com autorização
  explícita do dono, e **nessa ordem** — a `0061` adiciona
  `sequencia_passos.template_id` referenciando `public.templates`, que só existe
  depois da `0059`. Com isso a produção tem `0001`–`0061` e o buraco da
  numeração fechou.

  **O replay em Docker pegou duas bombas que a produção não teria perdoado**, e
  as duas justificam sozinhas o custo de rodar o teste:

  1. `check (nome ~ '^[a-z0-9_]{1,512}$')` em `templates`. **O Postgres recusa
     repetição acima de 255** (`invalid repetition count(s)`), mas o
     `create table` passa e a tabela nasce com o check aparentemente correto. O
     erro só aparece no primeiro `insert` — quer dizer: aplicar tudo, ver tudo
     verde, e o primeiro cliente que criasse um modelo levaria um erro de regex
     vindo do banco. Trocado por `length(nome) between 1 and 512`.
  2. **As quatro tabelas nasciam sem RLS.** Eram as únicas quatro sem RLS no
     schema inteiro. Corrigido para o padrão da `0058`/`0060`: RLS ligada, zero
     políticas, `revoke` de `anon` e `authenticated`.

  A `0059` também redefinia `public.tocar_atualizado_em()` com `create or
  replace` **sem** `security invoker` nem `set search_path = ''`. Não daria erro:
  apagaria em silêncio a proteção que a `0001` pôs, para todas as tabelas que
  usam esse gatilho de uma vez. Consertado antes de aplicar — a migration agora
  só **usa** a função existente. Conferido depois na produção: `prosecdef = f` e
  `proconfig = {search_path=""}`, intactos.

  Conferidas pelos **dois** testes. Replay do zero em Docker (`0001`–`0061` em
  ordem, sem erro), onde também foram provados os quatro casos do `check` da
  `0061`: 4320min sem modelo **recusa**, 4320min com modelo **aceita**, 60min sem
  modelo **aceita**, e 43201min (acima de 30 dias) **recusa mesmo com modelo**.
  Depois, ensaio em transação contra a produção (`begin; <as duas migrations sem
  o notify>; rollback;`), que voltou limpo — nem as tabelas nem a coluna
  sobraram.

  Estado conferido na produção depois de aplicar: as 4 tabelas com **RLS ligada
  e zero policies**, `grant` só para `postgres` e `service_role` (`anon` e
  `authenticated` **não aparecem**), o check `sequencia_passos_atraso_valido` com
  a regra composta, e **um `insert` real em `templates` funcionando** — que é
  onde a bomba do regex teria explodido. Dado existente intacto: 31 contatos.
  Do outro lado: `app_verandi.migrations_aplicadas` com as mesmas **32** linhas e
  as **16** policies de `storage.objects` intactas.

  **As duas têm `notify pgrst`, e o reload foi conferido nos dois produtos.**
  `templates` e `transmissoes` pela Data API respondem **200** para
  `service_role` e **401** para `anon` (sem 404, então não há restart pendente),
  `sequencia_passos?select=template_id` responde 200, e `app_verandi` continua
  respondendo **200** pelo mesmo PostgREST.

  **O código já estava publicado quando estas foram aplicadas** — o inverso do
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

**Quando não há Docker** — foi o caso em 12/set/2026, numa WSL2 sem
integração ligada —, o substituto é o ensaio em transação: mandar
`begin; <a migration>; rollback;` pela Management API. Ele prova mais que o
Docker numa coisa e menos em outra. Mais: roda contra o estado real da
produção, com os anos de `grant` acumulados que um banco novo não tem. Menos:
não prova a ordem das migrations desde o zero, porque não replaya nada. Serve
para migration aditiva conferida objeto a objeto depois; não serve para trocar
o replay quando a migration mexe em dado que já existe.

O que o local prova: que a migration roda, na ordem, e que o estado final de
`grant` é o pretendido — foi assim que a `0042` foi conferida, com `set role
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
é o AutoFluxos ganhar prefixo próprio — nunca renumerar o que já foi aplicado.

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
