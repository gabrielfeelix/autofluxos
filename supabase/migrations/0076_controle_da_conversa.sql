-- 0076: a revisão do controle, e a tomada que só um atendente ganha.
--
-- ---------------------------------------------------------------------------
-- O defeito, e por que ele não se conserta em TypeScript
-- ---------------------------------------------------------------------------
--
-- `atribuirContato` é `update contacts set atribuido_a = $1 where id = $2`. Sem
-- condição nenhuma sobre o valor anterior. Quer dizer que dois atendentes
-- clicando em "Assumir" ao mesmo tempo recebem **os dois** sucesso, e quem
-- gravou por último fica com a conversa. O outro vê a tela dizer que assumiu,
-- começa a digitar, e responde numa conversa que é de outra pessoa.
--
-- É a RB-14: "apenas um assume a versão atual; o outro vê quem assumiu... Não
-- aceitar alteração baseada em estado antigo."
--
-- **Ler antes de gravar não resolve**, e é o ponto todo desta migration. Entre
-- o `select` que diz "está livre" e o `update` que grava cabe o clique do
-- colega, e o intervalo não é teórico: são dois pedidos HTTP concorrentes no
-- mesmo instante, que é exatamente o caso que a fila do Inbox produz quando uma
-- conversa nova aparece para a equipe toda ao mesmo tempo.
--
-- A condição tem que estar no `where` do próprio `update`, e é isso que a
-- `assumir_atendimento` abaixo faz.
--
-- ---------------------------------------------------------------------------
-- A revisão, e por que contador e não `updated_at`
-- ---------------------------------------------------------------------------
--
-- A RB-15 exige que uma resposta de IA que termine **depois** de alguém assumir
-- não possa mais enviar: ela foi autorizada por um estado que não existe mais.
-- A prova é a revisão, anotada no início da execução e conferida no instante do
-- envio.
--
-- Um `timestamptz` não serve: duas trocas de controle no mesmo milissegundo
-- dariam o mesmo instante, e a comparação passaria batida. `now()` dentro de uma
-- transação é pior ainda, porque congela no início dela. Contador não tem esse
-- problema: `revisao + 1` é sempre diferente do anterior.

set search_path = public, extensions;

alter table public.contacts
  add column if not exists controle_revisao integer not null default 0;

comment on column public.contacts.controle_revisao is
  'Sobe a cada troca de controle da conversa. Uma execucao anota a revisao no inicio e a confere antes de enviar: se mudou, alguem assumiu no meio e o envio e recusado (RB-15). Contador e nao timestamp, porque duas trocas no mesmo milissegundo teriam o mesmo instante.';

-- ---------------------------------------------------------------------------
-- A tomada atômica
-- ---------------------------------------------------------------------------

/*
 * Os nomes de saída levam `o_`, e não é estilo: `returns table (id uuid, ...)`
 * faz os parâmetros OUT competirem com as colunas das tabelas consultadas, e o
 * Postgres recusa com 42702 `column reference "id" is ambiguous`. Mesma classe
 * da 0033 e da 0072, e está escrito aqui porque já custou tempo duas vezes.
 */
create or replace function public.assumir_atendimento(
  p_client_id  uuid,
  p_contact_id uuid,
  p_usuario_id uuid
)
returns table (
  o_ok            boolean,
  o_motivo        text,
  o_responsavel   uuid,
  o_revisao       integer
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_atual   uuid;
  v_revisao integer;
begin
  /*
   * `for update` trava a linha do contato até o fim da transação. É o que faz
   * o segundo pedido **esperar** em vez de ler o estado antigo: sem ele, os
   * dois leriam "livre" e os dois gravariam.
   *
   * `client_id` no `where` e não só o id: `service_role` ignora RLS, e quem
   * isola conta de conta é a consulta. Sem ele, um id de contato vazado
   * assumiria conversa da conta vizinha.
   */
  select c.atribuido_a, c.controle_revisao
    into v_atual, v_revisao
    from public.contacts c
   where c.id = p_contact_id
     and c.client_id = p_client_id
     for update;

  if not found then
    return query select false, 'nao_encontrado'::text, null::uuid, 0;
    return;
  end if;

  -- Já é dela. Não sobe a revisão: um clique repetido não pode invalidar a
  -- execução em andamento da própria pessoa.
  if v_atual = p_usuario_id then
    return query select false, 'ja_e_sua'::text, v_atual, v_revisao;
    return;
  end if;

  -- Alguém já assumiu. Quem chegou depois não toma por cima: a saída dele é
  -- transferir, que é ação explícita e exige permissão (RB-14).
  if v_atual is not null then
    return query select false, 'ja_assumida'::text, v_atual, v_revisao;
    return;
  end if;

  update public.contacts
     set atribuido_a      = p_usuario_id,
         controle_revisao = controle_revisao + 1
   where id = p_contact_id
     and client_id = p_client_id
     -- A condição que fecha a corrida: só grava se ninguém gravou antes.
     and atribuido_a is null
  returning controle_revisao into v_revisao;

  if not found then
    /*
     * Chegou aqui com a linha travada e ainda assim não gravou: outra
     * transação assumiu entre o `select ... for update` e este `update`. Não
     * deveria acontecer com a trava, e a checagem fica porque o custo é uma
     * comparação e o preço de errar é a conversa com dois donos.
     */
    select c.atribuido_a into v_atual from public.contacts c where c.id = p_contact_id;
    return query select false, 'ja_assumida'::text, v_atual, v_revisao;
    return;
  end if;

  return query select true, 'assumida'::text, p_usuario_id, v_revisao;
end;
$$;

/*
 * Troca de controle que **não** é corrida: transferir, devolver à fila,
 * encerrar, retomar o bot. Todas sobem a revisão, e é isso que invalida a
 * execução que estava no ar (RB-15).
 *
 * Uma função e não quatro: o que muda entre elas é só o responsável novo, e
 * quatro funções com o mesmo corpo seriam quatro lugares para esquecer o
 * `controle_revisao + 1`.
 */
create or replace function public.trocar_controle(
  p_client_id   uuid,
  p_contact_id  uuid,
  p_responsavel uuid
)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_revisao integer;
begin
  update public.contacts
     set atribuido_a      = p_responsavel,
         controle_revisao = controle_revisao + 1
   where id = p_contact_id
     and client_id = p_client_id
  returning controle_revisao into v_revisao;

  -- `null` = o contato não é desta conta. Quem chama distingue isso de zero.
  return v_revisao;
end;
$$;

/*
 * `security definer` sem revoke é função aberta: o Postgres concede `execute` a
 * `PUBLIC` na criação, e `anon`/`authenticated` herdam de lá o que se revoga
 * apenas deles. É a lição da 0026, registrada em BANCO-COMPARTILHADO.md: a
 * `pegar_tarefas` seguiu executável por meses depois de um revoke que não
 * incluía `public`.
 *
 * Objeto novo em `public` já nasce fechado pelo default da 0041, e o revoke
 * explícito é o cinto e suspensório para o dia em que esse default mudar.
 */
revoke all on function public.assumir_atendimento(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.trocar_controle(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.assumir_atendimento(uuid, uuid, uuid) to service_role;
grant execute on function public.trocar_controle(uuid, uuid, uuid) to service_role;

-- `contacts` vive em `public`, exposto na Data API, e o servidor lê a coluna
-- nova e chama as duas funções pelo PostgREST. Sem o reload, elas respondem 404
-- até a próxima reinicialização. O cache é o mesmo dos dois produtos: quem
-- aplicar em produção confere a Verandi depois.
notify pgrst, 'reload schema';
