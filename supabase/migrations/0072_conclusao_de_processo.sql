-- ---------------------------------------------------------------------------
-- 0072 — concluir é uma coisa só: estado final, histórico e a intenção de
--        continuar
-- ---------------------------------------------------------------------------
--
-- O defeito que esta migration fecha
-- ---------------------------------------------------------------------------
--
-- `fecharCartao` faz hoje quatro idas ao banco em sequência, e o comentário
-- dela admite: "Não é transação". Entre a segunda e a terceira, qualquer queda
-- — função encerrada pelo teto de tempo da Vercel, deploy no meio, rede — deixa
-- o cartão ganho **sem** o evento no histórico. O contato aparece como cliente
-- e a linha do tempo não explica desde quando.
--
-- Pior: a passagem ao quadro seguinte, quando falha, escreve `console.error` e
-- devolve `null`. O ganho fica registrado, a continuidade não acontece, e não
-- sobra nada no banco dizendo que ela deveria ter acontecido. Log da Vercel
-- expira; a pendência some com ele. A RB-25 pede o contrário — "registrar
-- pendência visível e permitir repetir somente essa ação" — e o A26 é o aceite
-- disso.
--
-- O que passa a existir
-- ---------------------------------------------------------------------------
--
--   1. `conclusoes_de_processo` — a conclusão com identidade própria, chave
--      idempotente e o estado da continuidade (RB-10, RB-25, A26)
--   2. `concluir_processo(...)` — estado final + evento + conclusão numa
--      única transação (RB-24)
--   3. `resolver_continuidade(...)` — a abertura do destino, idempotente pela
--      conclusão de origem
--
-- **A conclusão de origem nunca é desfeita por falha do destino.** As duas
-- funções são transações separadas de propósito: a primeira não pode depender
-- da segunda dar certo. Juntá-las devolveria o defeito original invertido —
-- perder a venda porque o pós-venda não abriu.
--
-- Nada é apagado e nada é reinterpretado. `quadro_cartoes` mantém `situacao`,
-- `valor` e `fechado_em` como estão; `eventos_do_contato` continua com os
-- mesmos tipos. É aditiva inteira.
--
-- Roda em `public`, qualificado, sem tocar `app_verandi`. Ver
-- docs/BANCO-COMPARTILHADO.md.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. A conclusão
-- ---------------------------------------------------------------------------

create table if not exists public.conclusoes_de_processo (
  id uuid primary key default gen_random_uuid(),

  client_id uuid not null references public.clients (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,

  /**
   * A ocorrência concluída.
   *
   * `restrict` pelo mesmo motivo de `vendas.cartao_id`: apagar um cartão não
   * pode apagar em silêncio o registro de que ele foi concluído.
   */
  cartao_id uuid not null references public.quadro_cartoes (id) on delete restrict,

  /**
   * Onde ela aconteceu, **no momento do fato** (RB-24).
   *
   * Os ids ficam sem chave estrangeira de propósito: a etapa pode ser
   * arquivada e o processo renomeado, e o histórico não pode mudar por causa
   * disso nem impedir o arquivamento. Os nomes viajam junto pela mesma razão —
   * renomear "Qualificado" para "Pronto para venda" não reescreve o que estava
   * escrito na tela de quem concluiu.
   */
  quadro_id uuid not null,
  quadro_nome text not null,
  quadro_finalidade text not null,
  coluna_id uuid not null,
  coluna_nome text not null,

  situacao text not null,
  motivo text,

  /**
   * A chave idempotente da conclusão.
   *
   * É o que faz duplo clique e retry de rede devolverem a **mesma** conclusão
   * em vez de duas (RB-10, A13). Única por conta quando presente; nula na
   * conclusão feita por um caminho que ainda não manda chave.
   */
  chave_da_operacao text,

  /**
   * O estado da continuidade (RB-25, A26).
   *
   *   `nao_se_aplica` — este processo não encadeia, ou a conclusão não abre
   *                     destino (perdeu, por exemplo)
   *   `pendente`      — há destino a abrir e ele ainda não abriu
   *   `feita`         — o cartão de destino existe
   *   `falhou`        — as tentativas acabaram; a pendência fica **visível**
   *
   * `pendente` e `falhou` são exatamente o que o A26 exige que não seja
   * apresentado como entrega completa.
   */
  continuidade text not null default 'nao_se_aplica',
  continuidade_erro text,
  continuidade_tentativas integer not null default 0,

  /** O quadro de destino escolhido na hora da conclusão. */
  destino_quadro_id uuid,
  /** O cartão aberto lá. Preenchido por `resolver_continuidade`. */
  destino_cartao_id uuid references public.quadro_cartoes (id) on delete set null,

  autor text,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'conclusoes_situacao_check') then
    alter table public.conclusoes_de_processo
      add constraint conclusoes_situacao_check check (situacao in ('ganha', 'perdida'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'conclusoes_continuidade_check') then
    alter table public.conclusoes_de_processo
      add constraint conclusoes_continuidade_check
      check (continuidade in ('nao_se_aplica', 'pendente', 'feita', 'falhou'));
  end if;

  -- Continuidade feita tem cartão; sem cartão ela não está feita. A restrição
  -- existe para que "feita" não possa mentir.
  if not exists (select 1 from pg_constraint where conname = 'conclusoes_continuidade_coerente') then
    alter table public.conclusoes_de_processo
      add constraint conclusoes_continuidade_coerente check (
        (continuidade = 'feita' and destino_cartao_id is not null)
        or (continuidade <> 'feita')
      );
  end if;
end $$;

-- **Uma conclusão por operação** (RB-10, A13).
create unique index if not exists conclusoes_chave_da_operacao_idx
  on public.conclusoes_de_processo (client_id, chave_da_operacao)
  where chave_da_operacao is not null;

-- **Uma conclusão por ocorrência.** Reabrir e concluir de novo passa por
-- `reabrirCartao`, que apaga a conclusão anterior; sem isso, reabrir e fechar
-- acumularia conclusões e a continuidade abriria um cartão por vez.
create unique index if not exists conclusoes_uma_por_cartao_idx
  on public.conclusoes_de_processo (cartao_id);

-- A consulta que a tela de pendências faz: o que ficou para trás nesta conta.
create index if not exists conclusoes_pendentes_idx
  on public.conclusoes_de_processo (client_id, criado_em desc)
  where continuidade in ('pendente', 'falhou');

create index if not exists conclusoes_do_contato_idx
  on public.conclusoes_de_processo (contact_id, criado_em desc);

comment on table public.conclusoes_de_processo is
  'O fim de uma ocorrência, com os ids e nomes da época (RB-24) e o estado da continuidade para o processo seguinte (RB-25, A26). Conclusão de origem nunca é desfeita por falha do destino.';

drop trigger if exists conclusoes_tocar_atualizado_em on public.conclusoes_de_processo;
create trigger conclusoes_tocar_atualizado_em
  before update on public.conclusoes_de_processo
  for each row execute function public.tocar_atualizado_em();

alter table public.conclusoes_de_processo enable row level security;
revoke all on public.conclusoes_de_processo from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Concluir: uma transação só
-- ---------------------------------------------------------------------------
--
-- **O ponto inteiro desta função é o `and situacao = 'aberta'` do update.**
--
-- Ele é o que resolve o duplo clique sem depender de trava na tela: a segunda
-- requisição não casa nenhuma linha, cai no caminho idempotente e devolve a
-- conclusão que a primeira criou. Conferir antes com um `select` deixaria a
-- janela entre a leitura e a escrita aberta, que é onde o segundo clique cabe.
--
-- `returns setof` e não composto: ver a 0033 — composto nulo vira objeto de
-- campos nulos no PostgREST, que é verdadeiro no JavaScript.

/**
 * O `repetida` do retorno não é enfeite e não dá para deduzir de fora.
 *
 * A primeira versão desta função devolvia só a conclusão, e o serviço inferia
 * "já existia" comparando `criado_em` com o relógio local. É errado por
 * construção: duas chamadas separadas por 80 ms produzem a mesma diferença que
 * uma chamada só, e o teste do duplo clique pegou isso na primeira execução.
 *
 * Quem sabe se escreveu é quem escreveu. O booleano sai daqui.
 */
create or replace function public.concluir_processo(
  p_client_id uuid,
  p_cartao_id uuid,
  p_situacao text,
  p_valor numeric,
  p_motivo text,
  p_titulo text,
  p_autor text,
  p_chave text
)
--
-- **Os nomes de saída levam `o_`, e a razão vale escrita.**
--
-- `returns table (id uuid, situacao text, ...)` declara parâmetros OUT com
-- esses nomes, e dentro do corpo eles competem com as colunas das tabelas
-- consultadas. O Postgres não escolhe: recusa com **42702**, "column reference
-- \"id\" is ambiguous", e a primeira versão desta função morreu assim em todo
-- teste que chegava a executá-la. É a mesma classe de armadilha da 0033 —
-- silenciosa na leitura, óbvia na execução.
--
-- O prefixo elimina a colisão na fonte, em vez de depender de qualificar cada
-- referência e de lembrar disso na próxima alteração. O PostgREST usa estes
-- nomes nas chaves do JSON, então quem lê é `servicos/concluir-processo.ts`.
returns table (
  o_id uuid, o_contact_id uuid, o_cartao_id uuid,
  o_quadro_id uuid, o_quadro_nome text, o_quadro_finalidade text,
  o_coluna_id uuid, o_coluna_nome text,
  o_situacao text, o_motivo text,
  o_continuidade text, o_continuidade_erro text, o_continuidade_tentativas integer,
  o_destino_quadro_id uuid, o_destino_cartao_id uuid,
  o_criado_em timestamptz,
  o_repetida boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cartao public.quadro_cartoes;
  v_quadro public.quadros;
  v_coluna public.quadro_colunas;
  v_destino uuid;
  v_continuidade text;
  v_conclusao public.conclusoes_de_processo;
  v_titulo text;
begin
  if p_situacao not in ('ganha', 'perdida') then
    raise exception 'situação inválida: %', p_situacao using errcode = '22023';
  end if;

  -- Caminho idempotente, **antes** de qualquer escrita: se esta operação já
  -- passou por aqui, devolve o que existe e não toca em nada.
  if p_chave is not null then
    select * into v_conclusao
      from public.conclusoes_de_processo
     where client_id = p_client_id and chave_da_operacao = p_chave;
    if found then
      return query select v_conclusao.id, v_conclusao.contact_id, v_conclusao.cartao_id,
           v_conclusao.quadro_id, v_conclusao.quadro_nome, v_conclusao.quadro_finalidade,
           v_conclusao.coluna_id, v_conclusao.coluna_nome,
           v_conclusao.situacao, v_conclusao.motivo,
           v_conclusao.continuidade, v_conclusao.continuidade_erro,
           v_conclusao.continuidade_tentativas,
           v_conclusao.destino_quadro_id, v_conclusao.destino_cartao_id,
           v_conclusao.criado_em, true;
      return;
    end if;
  end if;

  -- A trava da linha ordena as requisições concorrentes: a segunda espera a
  -- primeira terminar e então encontra `situacao <> 'aberta'`.
  select * into v_cartao
    from public.quadro_cartoes
   where id = p_cartao_id and client_id = p_client_id
     for update;

  if not found then
    return;  -- cartão de outra conta, ou apagado. Conjunto vazio = recusa.
  end if;

  -- Já concluído: devolve a conclusão que existe, em vez de concluir de novo.
  -- É o duplo clique que chegou sem chave, e o retry depois de uma resposta
  -- perdida — os dois merecem o mesmo "já está feito", não um erro.
  if v_cartao.situacao <> 'aberta' then
    select * into v_conclusao
      from public.conclusoes_de_processo where cartao_id = p_cartao_id;
    if found then
      return query select v_conclusao.id, v_conclusao.contact_id, v_conclusao.cartao_id,
           v_conclusao.quadro_id, v_conclusao.quadro_nome, v_conclusao.quadro_finalidade,
           v_conclusao.coluna_id, v_conclusao.coluna_nome,
           v_conclusao.situacao, v_conclusao.motivo,
           v_conclusao.continuidade, v_conclusao.continuidade_erro,
           v_conclusao.continuidade_tentativas,
           v_conclusao.destino_quadro_id, v_conclusao.destino_cartao_id,
           v_conclusao.criado_em, true;
    end if;
    return;
  end if;

  select * into v_quadro from public.quadros where id = v_cartao.quadro_id;
  select * into v_coluna from public.quadro_colunas where id = v_cartao.coluna_id;

  v_titulo := coalesce(nullif(btrim(coalesce(p_titulo, '')), ''), v_cartao.titulo);

  update public.quadro_cartoes
     set situacao = p_situacao,
         valor = p_valor,
         motivo = case when p_situacao = 'perdida' then p_motivo else null end,
         titulo = v_titulo,
         fechado_em = now()
   where id = p_cartao_id
     and client_id = p_client_id
     and situacao = 'aberta';

  if not found then
    return;  -- outra transação concluiu entre a trava e aqui. Não deveria
             -- acontecer com o `for update` acima; a guarda fica porque ela
             -- custa nada e o contrário custa um estado inconsistente.
  end if;

  -- O evento, **na mesma transação**. É isto que a T1.2 existe para garantir:
  -- não há mais um instante em que o cartão está ganho e a linha do tempo não
  -- sabe. Os ids e nomes da época vão nos dados (RB-24).
  insert into public.eventos_do_contato (client_id, contato_id, tipo, dados, autor)
  values (
    p_client_id,
    v_cartao.contact_id,
    case when p_situacao = 'ganha' then 'ganhou' else 'perdeu' end,
    jsonb_strip_nulls(jsonb_build_object(
      'cartaoId', p_cartao_id,
      'quadroId', v_cartao.quadro_id,
      'quadroNome', v_quadro.nome,
      'colunaId', v_cartao.coluna_id,
      'colunaNome', v_coluna.nome,
      'titulo', v_titulo,
      'valor', p_valor,
      'motivo', case when p_situacao = 'perdida' then p_motivo else null end
    )),
    p_autor
  );

  -- Só ganho encadeia. Perder não abre pós-venda, e o `seguinte_id` do quadro
  -- é quem diz se há destino.
  v_destino := case when p_situacao = 'ganha' then v_quadro.seguinte_id else null end;
  v_continuidade := case when v_destino is null then 'nao_se_aplica' else 'pendente' end;

  insert into public.conclusoes_de_processo (
    client_id, contact_id, cartao_id,
    quadro_id, quadro_nome, quadro_finalidade, coluna_id, coluna_nome,
    situacao, motivo, chave_da_operacao,
    continuidade, destino_quadro_id, autor
  ) values (
    p_client_id, v_cartao.contact_id, p_cartao_id,
    v_cartao.quadro_id, v_quadro.nome, v_quadro.finalidade, v_cartao.coluna_id, v_coluna.nome,
    p_situacao, case when p_situacao = 'perdida' then p_motivo else null end, p_chave,
    v_continuidade, v_destino, p_autor
  )
  returning * into v_conclusao;

  return query select v_conclusao.id, v_conclusao.contact_id, v_conclusao.cartao_id,
           v_conclusao.quadro_id, v_conclusao.quadro_nome, v_conclusao.quadro_finalidade,
           v_conclusao.coluna_id, v_conclusao.coluna_nome,
           v_conclusao.situacao, v_conclusao.motivo,
           v_conclusao.continuidade, v_conclusao.continuidade_erro,
           v_conclusao.continuidade_tentativas,
           v_conclusao.destino_quadro_id, v_conclusao.destino_cartao_id,
           v_conclusao.criado_em, false;
end;
$$;

revoke execute on function public.concluir_processo(uuid, uuid, text, numeric, text, text, text, text)
  from anon, authenticated;

comment on function public.concluir_processo(uuid, uuid, text, numeric, text, text, text, text) is
  'Estado final, evento e conclusão numa transação só. Devolve conjunto vazio quando recusa e a conclusão existente quando a operação se repete (RB-10, RB-24, A13).';

-- ---------------------------------------------------------------------------
-- 3. Resolver a continuidade
-- ---------------------------------------------------------------------------
--
-- Transação **separada** da conclusão, e é a separação que dá o A26: a origem
-- já está gravada quando esta roda, então falhar aqui não desfaz nada.
--
-- A idempotência tem duas camadas, e as duas são necessárias:
--
--   - `chave_de_criacao = 'conclusao:<id>'` no cartão de destino, com o índice
--     único da 0071. Duas execuções da mesma intenção não criam dois cartões
--     nem que cheguem juntas;
--   - o `where continuidade = 'pendente'` do update, que impede uma execução
--     atrasada de sobrescrever um estado já resolvido.

create or replace function public.resolver_continuidade(p_conclusao_id uuid)
returns setof public.conclusoes_de_processo
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_c public.conclusoes_de_processo;
  v_coluna uuid;
  v_cartao uuid;
  v_destino_nome text;
begin
  select * into v_c
    from public.conclusoes_de_processo
   where id = p_conclusao_id
     for update;

  if not found then
    return;
  end if;

  -- Já resolvida: devolve como está. É o retry depois de uma resposta perdida,
  -- e ele precisa ser barato e silencioso.
  if v_c.continuidade <> 'pendente' then
    return next v_c;
    return;
  end if;

  if v_c.destino_quadro_id is null then
    update public.conclusoes_de_processo
       set continuidade = 'nao_se_aplica'
     where id = p_conclusao_id and continuidade = 'pendente'
    returning * into v_c;
    return next v_c;
    return;
  end if;

  select nome into v_destino_nome
    from public.quadros
   where id = v_c.destino_quadro_id and client_id = v_c.client_id;

  select id into v_coluna
    from public.quadro_colunas
   where quadro_id = v_c.destino_quadro_id
   order by ordem, criado_em
   limit 1;

  -- Destino sem etapa, ou apagado entre a conclusão e agora. É pendência de
  -- configuração, não falha técnica: a pessoa precisa ver e resolver.
  if v_coluna is null then
    update public.conclusoes_de_processo
       set continuidade = 'falhou',
           continuidade_erro = 'o processo de destino não existe mais, ou está sem etapas',
           continuidade_tentativas = continuidade_tentativas + 1
     where id = p_conclusao_id and continuidade = 'pendente'
    returning * into v_c;
    return next v_c;
    return;
  end if;

  -- Já aberto lá é alguém que comprou de novo, e o cartão existente é o que
  -- vale — mover de volta para a primeira etapa desfaria o trabalho de quem o
  -- arrastou até o fim. Mesma decisão de `passarParaOSeguinte`, agora com o
  -- resultado gravado em vez de devolvido e esquecido.
  select id into v_cartao
    from public.quadro_cartoes
   where quadro_id = v_c.destino_quadro_id
     and contact_id = v_c.contact_id
     and situacao = 'aberta'
   limit 1;

  if v_cartao is null then
    insert into public.quadro_cartoes (
      client_id, quadro_id, coluna_id, contact_id, responsavel, titulo, chave_de_criacao
    )
    select v_c.client_id, v_c.destino_quadro_id, v_coluna, v_c.contact_id,
           c.responsavel, c.titulo, 'conclusao:' || p_conclusao_id::text
      from public.quadro_cartoes c
     where c.id = v_c.cartao_id
    on conflict (quadro_id, chave_de_criacao) where chave_de_criacao is not null
    do nothing
    returning id into v_cartao;

    -- `do nothing` não devolve linha: a corrida perdeu para outra execução da
    -- mesma intenção. O cartão dela é o certo.
    if v_cartao is null then
      select id into v_cartao
        from public.quadro_cartoes
       where quadro_id = v_c.destino_quadro_id
         and chave_de_criacao = 'conclusao:' || p_conclusao_id::text;
    end if;

    if v_cartao is not null then
      insert into public.eventos_do_contato (client_id, contato_id, tipo, dados, autor)
      values (
        v_c.client_id, v_c.contact_id, 'entrou-no-quadro',
        jsonb_strip_nulls(jsonb_build_object(
          'quadro', v_destino_nome,
          'quadroId', v_c.destino_quadro_id,
          'cartaoId', v_cartao,
          'porConclusao', p_conclusao_id
        )),
        v_c.autor
      );
    end if;
  end if;

  if v_cartao is null then
    update public.conclusoes_de_processo
       set continuidade = 'falhou',
           continuidade_erro = 'não deu para abrir a ocorrência no processo de destino',
           continuidade_tentativas = continuidade_tentativas + 1
     where id = p_conclusao_id and continuidade = 'pendente'
    returning * into v_c;
    return next v_c;
    return;
  end if;

  update public.conclusoes_de_processo
     set continuidade = 'feita',
         continuidade_erro = null,
         destino_cartao_id = v_cartao
   where id = p_conclusao_id and continuidade = 'pendente'
  returning * into v_c;

  return next v_c;
end;
$$;

revoke execute on function public.resolver_continuidade(uuid) from anon, authenticated;

comment on function public.resolver_continuidade(uuid) is
  'Abre a ocorrência no processo de destino, idempotente pela conclusão de origem. Falha vira pendência visível; a conclusão de origem não é desfeita (RB-25, A26).';

notify pgrst, 'reload schema';
