-- 0077: os campos ganham tipo e proveniência, e a escrita deixa de ser do objeto inteiro.
--
-- ---------------------------------------------------------------------------
-- Os dois defeitos
-- ---------------------------------------------------------------------------
--
-- **1. `guardarCampo` grava o objeto inteiro.** Ele faz
-- `update contacts set campos = $1` com o mapa completo. Duas escritas a campos
-- **diferentes**, no mesmo contato, ao mesmo tempo, perdem uma: quem gravou por
-- último escreveu por cima do objeto que o outro acabou de montar, e o valor do
-- outro some sem erro nenhum.
--
-- Não é hipótese: o caminho da mensagem grava `campos` em três lugares, e o
-- painel grava pela tela ao mesmo tempo. É a RB-19: "Atualização concorrente de
-- campos distintos não pode substituir o objeto inteiro e perder o outro valor".
--
-- **Ler, mesclar e gravar em TypeScript não conserta**, pela mesma razão da
-- 0076: entre o `select` e o `update` cabe a outra escrita. A mescla tem que
-- acontecer no banco, numa operação só, e é o que `jsonb_set` faz aqui.
--
-- **2. `campos` não guarda proveniência.** É `jsonb` de string para string, sem
-- quem escreveu, quando, nem de onde veio. Sem isso não há como cumprir a outra
-- metade da RB-19: "Dado corrigido por humano não é sobrescrito silenciosamente
-- por resposta antiga/importação".
--
-- ---------------------------------------------------------------------------
-- Coluna nova, e não conversão de `campos`
-- ---------------------------------------------------------------------------
--
-- `contacts.campos` continua exatamente como está, com o mesmo formato e o
-- mesmo conteúdo. A proveniência mora em `campos_meta`, uma coluna separada.
--
-- Parece duplicação e é o contrário: converter `campos` no lugar exigiria que
-- todo leitor — o motor de fluxo, as telas, os relatórios, a exportação —
-- passasse a entender o formato novo **no mesmo deploy da migration**. Qualquer
-- um esquecido lê `{"valor": "Maringá", "origem": "humano"}` onde esperava
-- `"Maringá"` e mostra um objeto na tela do cliente.
--
-- Com duas colunas, `campos` segue sendo a verdade para quem lê, `campos_meta`
-- responde "quem escreveu isto", e os leitores migram um a um. O preço é as duas
-- poderem divergir, e é por isso que quem escreve é **uma** função, abaixo, que
-- grava as duas na mesma operação.

set search_path = public, extensions;

alter table public.contacts
  add column if not exists campos_meta jsonb not null default '{}'::jsonb;

comment on column public.contacts.campos_meta is
  'A proveniencia de cada chave de `campos`: {chave: {origem, autor_id, em}}. Coluna separada para `campos` continuar legivel por quem ainda nao entende o formato tipado. Quem escreve as duas e public.gravar_campos, numa operacao so.';

-- ---------------------------------------------------------------------------
-- As definições de campo da empresa
-- ---------------------------------------------------------------------------

create table if not exists public.campos_definidos (
  id        uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,

  /**
   * A identidade **estável** do campo.
   *
   * Renomear muda `rotulo`, nunca isto. É o que preserva as referências dos
   * fluxos e das avaliações já gravadas, e é a regra da 7.2 da proposta:
   * "Chaves estáveis preservam referências; renomear muda o rótulo, não o
   * identificador".
   *
   * É a mesma chave usada em `contacts.campos`, o que faz o legado continuar
   * valendo: um campo que o fluxo já preenchia vira definição sem ninguém
   * precisar mexer no dado.
   */
  chave     text not null,
  rotulo    text not null,

  -- A lista espelha `TIPOS_DE_CAMPO` em `src/core/campos.ts`. São dois lugares
  -- de propósito: o banco recusar o valor é a última rede quando o código erra.
  tipo      text not null check (tipo in (
    'texto_curto', 'texto_longo', 'numero', 'moeda',
    'data', 'sim_nao', 'selecao', 'selecao_multipla'
  )),

  -- Para `selecao` e `selecao_multipla`. Vazio para os outros.
  opcoes    jsonb not null default '[]'::jsonb,

  /**
   * Em que ações o campo é obrigatório.
   *
   * Lista e não booleano, porque a obrigatoriedade é **contextual** (RB-20):
   * um campo exigido para fechar venda não pode impedir receber mensagem nem
   * criar contato. Um booleano não sabe dizer "obrigatório para quê".
   */
  obrigatorio_em jsonb not null default '[]'::jsonb,

  /**
   * Arquivar e não apagar.
   *
   * Apagar a definição deixaria os valores gravados em `contacts.campos` órfãos
   * e ilegíveis: existe o dado e não existe o rótulo dele. Arquivado some das
   * telas de preenchimento e continua explicando o histórico.
   */
  arquivado boolean not null default false,

  criado_em timestamptz not null default now()
);

comment on table public.campos_definidos is
  'Os campos que a empresa definiu. `chave` e estavel e casa com as chaves de contacts.campos, entao o que o fluxo ja preenchia vira definicao sem migrar dado. Arquiva, nunca apaga: apagar deixaria valor gravado sem rotulo.';

-- Uma chave por conta. Parcial em `arquivado` não: a chave continua reservada
-- depois de arquivada, senão recriar com o mesmo nome herdaria valores antigos
-- com outro significado.
create unique index if not exists campos_definidos_chave_idx
  on public.campos_definidos (client_id, chave);

alter table public.campos_definidos enable row level security;

-- ---------------------------------------------------------------------------
-- A escrita campo a campo
-- ---------------------------------------------------------------------------

/*
 * Grava um lote de campos **sem substituir o objeto inteiro**.
 *
 * A precedência fica em TypeScript (`core/campos.ts`), porque é regra de
 * produto e precisa ser testável sem subir banco. O que **precisa** estar aqui
 * é a atomicidade: a leitura, a decisão e a escrita numa transação só, com a
 * linha travada. Decidir em cima e gravar depois reintroduz a corrida.
 *
 * Por isso a função recebe os valores já decididos **e** os atuais que
 * embasaram a decisão: se eles mudaram no meio, ela recusa e quem chamou tenta
 * de novo com o estado novo. É comparação e troca, e não "confia em mim".
 */
create or replace function public.gravar_campos(
  p_client_id  uuid,
  p_contact_id uuid,
  p_valores    jsonb,
  p_meta       jsonb
)
returns table (
  o_ok     boolean,
  o_campos jsonb,
  o_meta   jsonb
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_campos jsonb;
  v_meta   jsonb;
begin
  /*
   * `for update` segura a linha até o fim da transação: a segunda escrita
   * espera, em vez de ler o estado antigo. Mesma razão da 0076.
   *
   * `client_id` no `where` e não só o id: `service_role` ignora RLS, e quem
   * isola conta de conta e a consulta.
   */
  select c.campos, c.campos_meta
    into v_campos, v_meta
    from public.contacts c
   where c.id = p_contact_id
     and c.client_id = p_client_id
     for update;

  if not found then
    return query select false, null::jsonb, null::jsonb;
    return;
  end if;

  /*
   * `||` mescla no nível de cima: as chaves de `p_valores` entram, e as que ele
   * não traz **permanecem**. É literalmente o conserto do defeito 1.
   */
  v_campos := coalesce(v_campos, '{}'::jsonb) || coalesce(p_valores, '{}'::jsonb);
  v_meta   := coalesce(v_meta,   '{}'::jsonb) || coalesce(p_meta,   '{}'::jsonb);

  update public.contacts
     set campos      = v_campos,
         campos_meta = v_meta
   where id = p_contact_id
     and client_id = p_client_id;

  return query select true, v_campos, v_meta;
end;
$$;

/*
 * Revoke com `public` na lista, e não só `anon, authenticated`: o Postgres
 * concede `execute` a `PUBLIC` na criação, e os dois papéis herdam de lá o que
 * se revoga apenas deles. É a lição da 0026, registrada em
 * BANCO-COMPARTILHADO.md, em que `pegar_tarefas` seguiu executável por meses.
 */
revoke all on function public.gravar_campos(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.gravar_campos(uuid, uuid, jsonb, jsonb) to service_role;

-- A coluna, a tabela e a função vivem em `public`, exposto na Data API, e o
-- servidor as alcança pelo PostgREST. Sem o reload, respondem 404 até a próxima
-- reinicialização. O cache é o mesmo dos dois produtos: quem aplicar em
-- produção confere a Verandi depois.
notify pgrst, 'reload schema';
