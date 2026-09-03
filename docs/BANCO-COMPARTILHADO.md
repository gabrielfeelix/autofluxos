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
3. **O nome da próxima migration vem do disco, não de plano antigo.** Hoje o
   AutoFluxos termina em `0041`; a próxima é `0042`. Este parágrafo já esteve
   errado — dizia `0029` quando o disco tinha `0038` —, e é exatamente por isso
   que a regra é olhar o diretório, inclusive quando um documento afirma um
   número. Os nomes `0008_limites` e
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
- `0001` a `0040` aplicadas em produção (`0039` e `0040` em 03/set/2026, com
  autorização explícita do dono); `0041` escrita e ainda não aplicada;
- aplicação em produção pela Management API do Supabase;
- nunca deve executar o aplicador da Verandi nem registrar versão em
  `app_verandi.migrations_aplicadas`.

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
