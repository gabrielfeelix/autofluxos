-- ---------------------------------------------------------------------------
-- 0080 — a venda e o fechamento valem juntos, e o cancelamento também
-- ---------------------------------------------------------------------------
--
-- O que estava faltando, e por que precisa ser do banco
-- ---------------------------------------------------------------------------
--
-- A 0071 criou `vendas` e a 0072 criou `concluir_processo`. As duas funcionam,
-- e **entre elas não há nada**: quem registra uma venda hoje teria que chamar
-- as duas em fila, e uma queda no meio deixa um dos dois estados errados.
--
-- Os dois sentidos da falha, e nenhum é aceitável:
--
--   - conclui e não grava a venda: oportunidade **ganha sem venda válida**, que
--     é exatamente o que a RB-31 proíbe no fim ("não deixar oportunidade ganha
--     sem venda válida");
--   - grava a venda e não conclui: venda apontando para um cartão aberto, e o
--     índice `vendas_uma_valida_por_cartao_idx` passa a recusar a tentativa
--     seguinte sem que ninguém entenda por quê.
--
-- O PostgREST não tem transação entre requisições. Coordenar isso em TypeScript
-- seria fingir que tem, que é o defeito de novo com outra aparência — a mesma
-- conclusão que a 0072 já tinha registrado.
--
-- Duas funções:
--
--   1. `registrar_venda_e_concluir` — venda + conclusão, atômicas (RB-30)
--   2. `cancelar_venda_e_resolver`  — cancelamento + situação, atômicos (RB-31)
--
-- O que elas NÃO fazem
-- ---------------------------------------------------------------------------
--
-- **Nada aqui fala de pagamento.** Venda registrada quer dizer que a empresa
-- confirmou a compra, e não que ela foi paga (RB-29). Não existe coluna de
-- pago, nem default que sugira isso: acompanhar pagamento é outra origem, com
-- conciliação própria, e um booleano `pago` aqui viraria um número que o
-- financeiro não reconhece.
--
-- **Cancelar não apaga.** O registro fica, com motivo e data, e sai dos
-- indicadores (RB-31). Apagar tornaria impossível explicar por que o total do
-- mês mudou.
--
-- Roda em `public`, qualificado, sem tocar `app_verandi`. Ver
-- docs/BANCO-COMPARTILHADO.md.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. A revisão auditável de uma venda (RB-31)
-- ---------------------------------------------------------------------------
--
-- Corrigir valor, data ou itens **mantém trilha**. A trilha é esta tabela, e
-- não um `updated_at`: o que se precisa saber depois é o que era antes, quem
-- mudou e por quê, e uma coluna de data não responde nenhuma das três.

create table if not exists public.revisoes_de_venda (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  venda_id uuid not null references public.vendas (id) on delete cascade,

  -- 'corrigida', 'cancelada' ou 'reativada'.
  tipo text not null,
  -- O estado anterior, inteiro, como jsonb. Guardar o "antes" completo custa
  -- pouco e evita a pergunta que sempre aparece seis meses depois e que uma
  -- lista de campos alterados não responde.
  antes jsonb not null,
  motivo text,
  autor text,

  criado_em timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'revisoes_de_venda_tipo_check') then
    alter table public.revisoes_de_venda
      add constraint revisoes_de_venda_tipo_check
      check (tipo in ('corrigida', 'cancelada', 'reativada'));
  end if;
end $$;

create index if not exists revisoes_de_venda_da_venda_idx
  on public.revisoes_de_venda (venda_id, criado_em desc);

comment on table public.revisoes_de_venda is
  'A trilha de auditoria de uma venda (RB-31). Guarda o estado anterior inteiro, e nunca apaga.';

alter table public.revisoes_de_venda enable row level security;
revoke all on public.revisoes_de_venda from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Registrar a venda e concluir a oportunidade, juntas
-- ---------------------------------------------------------------------------
--
-- Os nomes de saída levam `o_` pela razão da 0072: `returns table` declara
-- parâmetros OUT que competem com as colunas consultadas, e o Postgres recusa
-- com 42702 em vez de escolher. Já mordeu na 0033, na 0072 e na 0076.

create or replace function public.registrar_venda_e_concluir(
  p_client_id uuid,
  p_cartao_id uuid,
  p_data_da_venda date,
  p_valor_total numeric,
  p_nota text,
  p_autor text,
  p_chave text,
  p_itens jsonb
)
returns table (
  o_venda_id uuid,
  o_contact_id uuid,
  o_cartao_id uuid,
  o_data_da_venda date,
  o_valor_total numeric,
  o_situacao text,
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
  v_venda public.vendas;
  v_item jsonb;
begin
  -- Caminho idempotente **antes** de qualquer escrita, como na 0072: se esta
  -- operação já passou por aqui, devolve o que existe e não toca em nada. É o
  -- duplo clique e o retry depois da resposta perdida (RB-30, A13).
  if p_chave is not null then
    select * into v_venda
      from public.vendas
     where client_id = p_client_id and chave_da_operacao = p_chave;
    if found then
      return query select v_venda.id, v_venda.contact_id, v_venda.cartao_id,
             v_venda.data_da_venda, v_venda.valor_total, v_venda.situacao, true;
      return;
    end if;
  end if;

  -- A trava da linha ordena as requisições concorrentes: a segunda espera a
  -- primeira terminar e encontra o cartão já fechado.
  select * into v_cartao
    from public.quadro_cartoes
   where id = p_cartao_id and client_id = p_client_id
     for update;

  if not found then
    return;  -- cartão de outra conta, ou apagado. Conjunto vazio = recusa.
  end if;

  if v_cartao.situacao <> 'aberta' then
    -- Já fechado. Se há venda válida, devolve ela: é o retry reconhecendo a
    -- própria operação. Se não há, é recusa: ganhar de novo um cartão que já
    -- foi ganho não pode criar uma segunda compra válida (RB-31).
    select * into v_venda
      from public.vendas
     where cartao_id = p_cartao_id and situacao = 'valida';
    if found then
      return query select v_venda.id, v_venda.contact_id, v_venda.cartao_id,
             v_venda.data_da_venda, v_venda.valor_total, v_venda.situacao, true;
    end if;
    return;
  end if;

  select * into v_quadro from public.quadros where id = v_cartao.quadro_id;
  select * into v_coluna from public.quadro_colunas where id = v_cartao.coluna_id;

  -- A venda primeiro: se o índice de uma-válida-por-cartão recusar, nada foi
  -- concluído ainda e a transação inteira cai sem deixar estado pela metade.
  insert into public.vendas (
    client_id, contact_id, cartao_id, data_da_venda, valor_total, nota, chave_da_operacao
  )
  values (
    p_client_id, v_cartao.contact_id, p_cartao_id, p_data_da_venda,
    p_valor_total, nullif(btrim(coalesce(p_nota, '')), ''), p_chave
  )
  returning * into v_venda;

  if p_itens is not null and jsonb_typeof(p_itens) = 'array' then
    for v_item in select * from jsonb_array_elements(p_itens)
    loop
      insert into public.venda_itens (
        venda_id, produto_id, descricao, quantidade, valor_unitario
      )
      values (
        v_venda.id,
        nullif(v_item->>'produtoId', '')::uuid,
        btrim(v_item->>'descricao'),
        (v_item->>'quantidade')::numeric,
        (v_item->>'valorUnitario')::numeric
      );
    end loop;
  end if;

  -- A conclusão, na mesma transação. `valor` do cartão recebe o total da venda
  -- para as telas antigas continuarem lendo: elas não sabem de `vendas` ainda.
  update public.quadro_cartoes
     set situacao = 'ganha',
         valor = p_valor_total,
         motivo = null,
         fechado_em = now()
   where id = p_cartao_id
     and client_id = p_client_id
     and situacao = 'aberta';

  if not found then
    raise exception 'o cartão mudou de estado durante o registro' using errcode = '40001';
  end if;

  insert into public.conclusoes_de_processo (
    client_id, contact_id, cartao_id, quadro_id, quadro_nome, quadro_finalidade,
    coluna_id, coluna_nome, situacao, motivo, continuidade, chave_da_operacao
  )
  values (
    p_client_id, v_cartao.contact_id, p_cartao_id,
    v_cartao.quadro_id, v_quadro.nome, v_quadro.finalidade,
    v_cartao.coluna_id, v_coluna.nome,
    'ganha', null,
    case when v_quadro.seguinte_id is null then 'nao_se_aplica' else 'pendente' end,
    p_chave
  )
  on conflict do nothing;

  insert into public.eventos_do_contato (client_id, contato_id, tipo, dados, autor)
  values (
    p_client_id,
    v_cartao.contact_id,
    'ganhou',
    jsonb_strip_nulls(jsonb_build_object(
      'cartaoId', p_cartao_id,
      'vendaId', v_venda.id,
      'quadroId', v_cartao.quadro_id,
      'quadroNome', v_quadro.nome,
      'valor', p_valor_total
    )),
    p_autor
  );

  return query select v_venda.id, v_venda.contact_id, v_venda.cartao_id,
         v_venda.data_da_venda, v_venda.valor_total, v_venda.situacao, false;
end;
$$;

comment on function public.registrar_venda_e_concluir is
  'Venda e conclusão da oportunidade numa transação (RB-30). Idempotente pela chave da operação.';

revoke all on function public.registrar_venda_e_concluir(
  uuid, uuid, date, numeric, text, text, text, jsonb
) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Cancelar a venda e resolver a oportunidade, juntos
-- ---------------------------------------------------------------------------
--
-- A RB-31 é explícita: "cancelar venda e alterar situação ocorrem juntos; não
-- deixar oportunidade ganha sem venda válida". Quem cancela **precisa** dizer
-- o destino do cartão: reabrir, ou marcar como perdido com motivo. Não há
-- terceiro caminho, e por isso `p_destino` não tem default.

create or replace function public.cancelar_venda_e_resolver(
  p_client_id uuid,
  p_venda_id uuid,
  p_motivo text,
  p_destino text,
  p_motivo_da_perda text,
  p_autor text
)
returns table (
  o_venda_id uuid,
  o_cartao_id uuid,
  o_situacao_do_cartao text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_venda public.vendas;
  v_antes jsonb;
begin
  if p_destino not in ('reabrir', 'perdida') then
    raise exception 'destino inválido: %', p_destino using errcode = '22023';
  end if;

  if btrim(coalesce(p_motivo, '')) = '' then
    raise exception 'diga por que a venda está sendo cancelada' using errcode = '22023';
  end if;

  select * into v_venda
    from public.vendas
   where id = p_venda_id and client_id = p_client_id
     for update;

  if not found then
    return;  -- venda de outra conta, ou apagada.
  end if;

  -- Já cancelada: devolve o estado atual sem escrever de novo. É o duplo
  -- clique, e ele não pode empilhar duas revisões do mesmo cancelamento.
  if v_venda.situacao = 'cancelada' then
    return query select v_venda.id, v_venda.cartao_id,
           (select situacao from public.quadro_cartoes where id = v_venda.cartao_id);
    return;
  end if;

  -- O "antes" inteiro, para a trilha. Guardado antes do update, obviamente.
  v_antes := jsonb_build_object(
    'dataDaVenda', v_venda.data_da_venda,
    'valorTotal', v_venda.valor_total,
    'situacao', v_venda.situacao,
    'nota', v_venda.nota
  );

  update public.vendas
     set situacao = 'cancelada',
         cancelada_em = now(),
         motivo_do_cancelamento = btrim(p_motivo),
         atualizado_em = now()
   where id = p_venda_id;

  insert into public.revisoes_de_venda (client_id, venda_id, tipo, antes, motivo, autor)
  values (p_client_id, p_venda_id, 'cancelada', v_antes, btrim(p_motivo), p_autor);

  -- A situação do cartão, na mesma transação. É o que impede a oportunidade
  -- ganha de ficar sem venda válida.
  if p_destino = 'reabrir' then
    update public.quadro_cartoes
       set situacao = 'aberta', motivo = null, fechado_em = null
     where id = v_venda.cartao_id and client_id = p_client_id;

    -- A conclusão de origem deixa de valer: ela dizia "ganha", e não é mais.
    delete from public.conclusoes_de_processo
     where cartao_id = v_venda.cartao_id and client_id = p_client_id;
  else
    update public.quadro_cartoes
       set situacao = 'perdida',
           motivo = nullif(btrim(coalesce(p_motivo_da_perda, '')), ''),
           fechado_em = now()
     where id = v_venda.cartao_id and client_id = p_client_id;

    update public.conclusoes_de_processo
       set situacao = 'perdida', motivo = nullif(btrim(coalesce(p_motivo_da_perda, '')), '')
     where cartao_id = v_venda.cartao_id and client_id = p_client_id;
  end if;

  insert into public.eventos_do_contato (client_id, contato_id, tipo, dados, autor)
  values (
    p_client_id,
    v_venda.contact_id,
    'venda-cancelada',
    jsonb_strip_nulls(jsonb_build_object(
      'vendaId', p_venda_id,
      'cartaoId', v_venda.cartao_id,
      'motivo', btrim(p_motivo),
      'destino', p_destino
    )),
    p_autor
  );

  return query select v_venda.id, v_venda.cartao_id,
         (select situacao from public.quadro_cartoes where id = v_venda.cartao_id);
end;
$$;

comment on function public.cancelar_venda_e_resolver is
  'Cancela a venda e resolve a situação da oportunidade numa transação (RB-31). Não apaga o registro.';

revoke all on function public.cancelar_venda_e_resolver(
  uuid, uuid, text, text, text, text
) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. O check de `eventos_do_contato.tipo` NAO e tocado, e isso e a decisao
-- ---------------------------------------------------------------------------
--
-- A primeira versao desta migration trocava `eventos_do_contato_tipo_check`
-- por uma lista fechada de tipos, para "caber" o `venda-cancelada`. Conferido
-- no banco, o check existente e outro:
--
--     CHECK ((length(TRIM(BOTH FROM tipo)) > 0))
--
-- Ou seja: qualquer texto nao vazio ja passa, e `venda-cancelada` nao precisa
-- de permissao nenhuma. Trocar por uma lista teria **introduzido** uma trava
-- que nao existia, e qualquer tipo de evento que eu esquecesse de enumerar
-- passaria a ser recusado em producao, num caminho que ninguem testa: o
-- insert de evento roda em toda mensagem que chega.
--
-- Fica registrado porque o erro estava escrito e so o banco o desmentiu. Quem
-- for fechar esse check um dia precisa levantar a lista real de `distinct
-- tipo` na producao antes, e nao deduzi-la do `switch` de core/crm.ts.
