-- API pública, fase 3: webhooks de saída (docs/HANDOFF-02-OUT-API-PUBLICA.md).
--
-- O AutoFluxos avisa o sistema do cliente quando algo acontece: contato
-- criado, etapa do funil mudou, oportunidade ganha ou perdida. Cada aviso é
-- uma linha em `entregas_de_webhook`, enviada com assinatura HMAC e repetida
-- com espera crescente quando o destino falha.
--
-- O segredo da assinatura mora no Vault (`segredo_id`), como as credenciais
-- do bloco Chama um sistema: ele precisa ser lido de volta a cada envio, ao
-- contrário da chave de API, que só é conferida.
--
-- Aditiva: duas tabelas novas. Só o servidor lê e escreve (RLS ligada, sem
-- políticas), como o resto de `public`. Nada da Verandi é tocado.

set search_path = public, extensions;

create table if not exists public.webhooks_de_saida (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients (id) on delete cascade,
  url             text not null check (url ~ '^https://' and char_length(url) <= 2000),
  eventos         text[] not null check (cardinality(eventos) > 0),
  -- Id do segredo no Vault (vault.secrets). O valor nunca fica nesta tabela.
  segredo_id      uuid not null,
  ativo           boolean not null default true,
  -- Zera a cada entrega boa. Em 20 seguidas o webhook pausa sozinho.
  falhas_seguidas integer not null default 0,
  pausado_em      timestamptz,
  criado_por      uuid references public.af_usuarios (id) on delete set null,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

comment on table public.webhooks_de_saida is
  'Endereços do cliente que recebem eventos do AutoFluxos (POST assinado com HMAC). Segredo no Vault.';

create index if not exists webhooks_de_saida_cliente_idx
  on public.webhooks_de_saida (client_id)
  where ativo;

alter table public.webhooks_de_saida enable row level security;
grant select, insert, update, delete on public.webhooks_de_saida to service_role;

create table if not exists public.entregas_de_webhook (
  id                 uuid primary key default gen_random_uuid(),
  webhook_id         uuid not null references public.webhooks_de_saida (id) on delete cascade,
  client_id          uuid not null references public.clients (id) on delete cascade,
  evento             text not null,
  -- O corpo exato que vai no POST, montado na emissão: a repetição manda o
  -- mesmo evento, e não o estado do contato na hora da nova tentativa.
  corpo              jsonb not null,
  tentativas         integer not null default 0,
  proxima_em         timestamptz not null default now(),
  status             text not null default 'pendente'
                     check (status in ('pendente', 'entregue', 'falhou')),
  ultimo_status_http integer,
  -- Começo da resposta ou o motivo da falha, até 300 caracteres.
  resposta           text check (resposta is null or char_length(resposta) <= 300),
  -- Quem está enviando agora, para duas passadas não mandarem a mesma.
  travada_ate        timestamptz,
  entregue_em        timestamptz,
  criado_em          timestamptz not null default now()
);

comment on table public.entregas_de_webhook is
  'Cada evento enviado (ou por enviar) a um webhook de saída, com tentativas e a última resposta.';

create index if not exists entregas_de_webhook_fila_idx
  on public.entregas_de_webhook (proxima_em)
  where status = 'pendente';

create index if not exists entregas_de_webhook_lista_idx
  on public.entregas_de_webhook (webhook_id, criado_em desc);

alter table public.entregas_de_webhook enable row level security;
grant select, insert, update, delete on public.entregas_de_webhook to service_role;

-- Pega até p_limite entregas vencidas e trava cada uma por 60 s. Duas passadas
-- ao mesmo tempo (carona do webhook, pulso do Inbox, cron) não pegam a mesma
-- linha: `for update skip locked` pula o que a outra já segurou.
create or replace function public.pegar_entregas_de_webhook(p_limite integer, p_ids uuid[] default null)
returns setof public.entregas_de_webhook
language sql
security invoker
set search_path = public
as $$
  update public.entregas_de_webhook e
     set travada_ate = now() + interval '60 seconds'
   where e.id in (
     select id
       from public.entregas_de_webhook
      where status = 'pendente'
        and proxima_em <= now()
        and (travada_ate is null or travada_ate < now())
        and (p_ids is null or id = any (p_ids))
      order by proxima_em
      limit greatest(1, least(p_limite, 100))
      for update skip locked
   )
  returning e.*;
$$;

revoke all on function public.pegar_entregas_de_webhook(integer, uuid[]) from public, anon, authenticated;
grant execute on function public.pegar_entregas_de_webhook(integer, uuid[]) to service_role;

notify pgrst, 'reload schema';
