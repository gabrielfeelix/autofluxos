-- Assistente por empresa. Sem alteração de canais, contatos ou objetos globais.
-- NULL preserva empresas existentes: não dispara assistente obrigatório.
alter table public.clients add column if not exists onboarding jsonb;

-- Uma transação e lock por empresa: repetir a conclusão nunca duplica modelos.
-- Apenas o servidor autorizado chama; modelos/grafos vêm do catálogo do código.
create or replace function public.preparar_onboarding(
  p_cliente uuid, p_respostas jsonb, p_acao text,
  p_objetivo text, p_quadro jsonb default null, p_fluxo jsonb default null
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  anterior jsonb;
  resultado jsonb;
  quadro_id uuid;
  fluxo_id uuid;
  etapa jsonb;
  indice integer := 0;
begin
  select onboarding into anterior from public.clients where id = p_cliente for update;
  if not found then raise exception 'Empresa não encontrada'; end if;
  if anterior->>'status' = 'concluido' then return anterior; end if;
  if p_acao is null or p_acao not in ('salvar', 'adiar', 'concluir') then
    raise exception 'Ação inválida';
  end if;
  if p_objetivo is null or p_objetivo not in ('atender', 'automatizar', 'vender')
    or p_respostas is null or jsonb_typeof(p_respostas) <> 'object'
    or coalesce(p_respostas->>'canal', '') not in ('whatsapp', 'instagram')
    or coalesce(p_respostas->>'objetivo', '') not in ('atendimento', 'vendas', 'ambos')
    or coalesce(p_respostas->>'atendimento', '') not in ('equipe', 'hibrido', 'depois')
    or coalesce(p_respostas->>'funil', '') not in ('nenhum', 'comercial', 'agendamento', 'pos-venda')
    or coalesce(p_respostas->>'chatbot', '') not in ('nenhum', 'recado', 'menu-atendimento')
    or coalesce(p_respostas->>'etapa', '') not in ('0', '1', '2', '3') then
    raise exception 'Respostas inválidas';
  end if;
  if p_acao = 'concluir' then
    -- Reutiliza a operação existente, sem sobrescrever nem criar outro modelo.
    if p_quadro is not null and p_respostas->>'objetivo' <> 'atendimento' and p_respostas->>'funil' <> 'nenhum' then
      select id into quadro_id from public.quadros where client_id = p_cliente order by criado_em, id limit 1;
      if quadro_id is null then
        if jsonb_typeof(p_quadro->'etapas') <> 'array' or jsonb_array_length(p_quadro->'etapas') = 0 then
          raise exception 'Modelo sem etapas';
        end if;
        insert into public.quadros (client_id, nome, finalidade)
          values (p_cliente, p_quadro->>'nome', p_quadro->>'finalidade') returning id into quadro_id;
        for etapa in select value from jsonb_array_elements(p_quadro->'etapas') loop
          insert into public.quadro_colunas (quadro_id, nome, ordem, tipo, limite_de_dias)
            values (quadro_id, etapa->>'nome', indice, coalesce(etapa->>'tipo', 'normal'), (etapa->>'dias')::integer);
          indice := indice + 1;
        end loop;
      end if;
    end if;
    if p_fluxo is not null and p_respostas->>'atendimento' = 'hibrido' and p_respostas->>'chatbot' <> 'nenhum' then
      select id into fluxo_id from public.flows where client_id = p_cliente order by criado_em, id limit 1;
      if fluxo_id is null then
        insert into public.flows (client_id, nome, rascunho, canal, ativo)
          values (p_cliente, p_fluxo->>'nome', p_fluxo->'grafo', p_respostas->>'canal', false) returning id into fluxo_id;
      end if;
    end if;
    update public.clients set objetivo = p_objetivo,
      crm_ativo = crm_ativo or quadro_id is not null
      where id = p_cliente;
  end if;
  resultado := jsonb_build_object(
    'status', case p_acao when 'concluir' then 'concluido' when 'adiar' then 'adiado' else 'rascunho' end,
    'respostas', p_respostas, 'quadroId', quadro_id, 'fluxoId', fluxo_id, 'atualizadoEm', now()
  );
  update public.clients set onboarding = resultado where id = p_cliente;
  return resultado;
end;
$$;
revoke all on function public.preparar_onboarding(uuid, jsonb, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.preparar_onboarding(uuid, jsonb, text, text, jsonb, jsonb) to service_role;
notify pgrst, 'reload schema';
