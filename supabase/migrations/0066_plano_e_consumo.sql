-- 0066, o plano da conta e a medição do que ela consome.
--
-- Responde aos itens 2 e 3 do `docs/HANDOFF-16-SET-PLANOS-E-ASSINATURA.md`, e a
-- decisão de preço que os explica está em `docs/PLANO-16-SET-PRODUTO-E-PRECO.md`.
--
-- As decisões que esta migration materializa, para quem ler só o SQL:
--
-- 1. **Medir vem antes de cobrar, e medir sem travar vem antes de travar.**
--    Nada aqui bloqueia coisa nenhuma. A coluna `plano` nasce preenchida com o
--    plano de entrada em toda linha e ninguém a lê para negar atendimento. Um
--    mês de número real dirá se as faixas fazem sentido; travar junto com a
--    primeira medição faz o primeiro erro de contagem virar cliente sem atender.
--
-- 2. **Conversa é interação bidirecional**, e é a definição que o mercado já
--    padronizou (Wati, Respond.io, SleekFlow escrevem a mesma). Disparo enviado
--    e não respondido **não conta**. A razão é prática: se o disparo contasse, a
--    conta do cliente explodiria no mês de campanha, que é justamente quando ele
--    mais precisa da ferramenta.
--
-- 3. **A view mede, e não cobra.** Ela conta contato único com entrada e saída
--    no mês. Quem transformar isso em fatura decide depois o que fazer com mês
--    parcial, conta nova e devolução, e nenhuma dessas perguntas tem resposta
--    dentro de uma view.
--
-- Aditiva: uma coluna nova com default válido em toda linha, e duas views novas.
-- Nenhuma coluna existente muda, nada é reescrito, nenhuma linha é apagada, e
-- nada aqui cita `app_verandi`. Todo objeto é qualificado com `public.`
-- (ver docs/BANCO-COMPARTILHADO.md).

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. Em que plano a conta está
-- ---------------------------------------------------------------------------
--
-- `add column ... default` não reescreve a tabela desde o Postgres 11: o valor
-- fica no catálogo e as linhas existentes só o materializam quando forem
-- atualizadas por outro motivo. É o que torna seguro fazer isto numa tabela com
-- dado de produção, e é o mesmo caminho da `0064`.
--
-- Texto e não número: `'essencial'` sobrevive a uma faixa nova no meio da
-- tabela, e `2` vira mentira no dia em que a ordem mudar. Os mesmos três nomes
-- vivem em `src/core/planos.ts`, que é o único lugar onde preço existe.

alter table public.clients
  add column if not exists plano text not null default 'essencial';

-- O `check` entra separado, depois da coluna, quando toda linha já tem o default
-- válido: validar agora custa uma varredura de nada e deixa a restrição
-- confiável desde o primeiro dia. Mesmo movimento da `0064`.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clients_plano_check'
  ) then
    alter table public.clients
      add constraint clients_plano_check
      check (plano in ('essencial', 'operacao', 'escala'));
  end if;
end
$$;

comment on column public.clients.plano is
  'Em que faixa a conta está. Os nomes e os preços moram em src/core/planos.ts. Nada no sistema nega atendimento por causa deste valor.';

-- ---------------------------------------------------------------------------
-- 2. Onde o gateway vai morar, quando existir
-- ---------------------------------------------------------------------------
--
-- Três colunas anuláveis, e nenhuma delas guarda segredo. A credencial do
-- gateway vai para o Supabase Vault por `server/cofre.ts`, no desenho de
-- `repos/chave-de-ia.ts`: referência no banco, valor no cofre, e nenhuma função
-- devolve o valor para a tela.
--
-- Nascem aqui, e não numa migration futura, porque são anuláveis e custam zero:
-- a alternativa é uma segunda migration contra a mesma tabela de produção no dia
-- em que o gateway for contratado, e mexer duas vezes em `clients` é dois riscos
-- onde cabia um. Ficam nulas até lá, e nulo quer dizer "esta conta nunca passou
-- por gateway nenhum".
--
-- Sem `check` no estado: nenhum gateway foi escolhido ainda, e inventar aqui o
-- vocabulário de estado de um produto que ninguém contratou é escrever uma
-- restrição que a primeira integração real vai ter que derrubar.

alter table public.clients
  add column if not exists assinatura_cliente_ref text;

alter table public.clients
  add column if not exists assinatura_ref text;

alter table public.clients
  add column if not exists assinatura_estado text;

comment on column public.clients.assinatura_cliente_ref is
  'Quem é esta conta dentro do gateway de pagamento. Nulo = nunca passou por gateway. Não guarda segredo: credencial vai para o Vault.';

comment on column public.clients.assinatura_ref is
  'Qual assinatura paga esta conta, dentro do gateway. Nulo enquanto não houver cobrança.';

comment on column public.clients.assinatura_estado is
  'Como o gateway diz que a assinatura está. Sem check de propósito: nenhum gateway foi escolhido, e o vocabulário é dele.';

-- ---------------------------------------------------------------------------
-- 3. Quantas conversas, por conta e por mês
-- ---------------------------------------------------------------------------
--
-- **A definição é a decisão desta migration.** Conversa é contato único que
-- trocou mensagem nos **dois** sentidos dentro do mês. Não é mensagem, não é
-- sessão, e não é contato.
--
-- Por que não mensagem: mensagem é o que o cliente menos controla, e a conta
-- dele dobraria porque o lead mandou "ok" três vezes.
--
-- Por que não sessão: `metricas_sessoes` já conta sessão, e sessão é execução de
-- fluxo. Uma conversa inteira atendida por gente, sem fluxo nenhum rodando, não
-- gera sessão e consome suporte igual.
--
-- Por que exige os dois sentidos: é o que impede o mês de campanha de explodir.
-- Disparo enviado e não respondido não é conversa, é tentativa.
--
-- `historico = false` porque mensagem importada da coexistência é conversa
-- antiga chegando de uma vez: contá-la cobraria do cliente, no mês em que ele
-- conectou o número, por meses de conversa que aconteceram antes de ele existir
-- aqui. É a mesma razão pela qual a `0047` criou a coluna.
--
-- O mês é o de São Paulo, como em toda métrica deste repositório
-- (`0011_metricas.sql`), e a chave é o primeiro dia do mês.

create or replace view public.consumo_de_conversas
with (security_invoker = true) as
with trocas as (
  select
    c.client_id,
    m.contact_id,
    date_trunc('month', m.ts at time zone 'America/Sao_Paulo')::date as mes,
    -- `bool_or` em vez de dois `count`: a pergunta é "houve?", não "quantas?", e
    -- o planejador resolve isto sem materializar a contagem.
    bool_or(m.direcao = 'entrada') as teve_entrada,
    bool_or(m.direcao = 'saida') as teve_saida
  from public.messages m
  join public.contacts c on c.id = m.contact_id
  where m.historico = false
  group by c.client_id, m.contact_id, mes
)
select
  client_id,
  mes,
  count(*)::bigint as conversas
from trocas
where teve_entrada and teve_saida
group by client_id, mes;

comment on view public.consumo_de_conversas is
  'Conversas por conta e mês de São Paulo, na definição da cobrança: contato único com entrada e saída no mesmo mês. Disparo não respondido não conta.';

-- O índice que esta view procura. `messages_contact_idx` já cobre
-- `(contact_id, ts desc)`, mas a varredura aqui é por mês sobre a tabela
-- inteira, e o que falta é alcançar a direção sem voltar à heap.
create index if not exists messages_consumo_idx
  on public.messages (contact_id, ts)
  include (direcao)
  where historico = false;

-- ---------------------------------------------------------------------------
-- 4. Quanto de storage, por conta
-- ---------------------------------------------------------------------------
--
-- Só o bucket dos recebidos, e isso é uma limitação conhecida, escrita aqui para
-- ninguém descobrir sozinho: o acervo (`autofluxos-acervo`) não tem tabela
-- espelho, mora só em `storage.objects`, e a pasta é o `clienteId`
-- (`repos/acervo.ts`). Somá-lo daqui significaria uma view de `public` lendo
-- `storage`, que é schema global aos dois produtos, e o custo disso é maior do
-- que a pergunta que ele responde hoje. Quem precisar do total soma os dois no
-- TypeScript.
--
-- Sem filtro de `historico`, ao contrário da view de conversas, e de propósito:
-- arquivo importado ocupa disco igual. Aqui a pergunta é ocupação, não cobrança.

create or replace view public.consumo_de_arquivos
with (security_invoker = true) as
select
  c.client_id,
  date_trunc('month', m.ts at time zone 'America/Sao_Paulo')::date as mes,
  count(*)::bigint as arquivos,
  coalesce(sum((m.arquivo ->> 'bytes')::bigint), 0)::bigint as bytes
from public.messages m
join public.contacts c on c.id = m.contact_id
where m.arquivo is not null
  and m.arquivo ? 'bytes'
group by c.client_id, mes;

comment on view public.consumo_de_arquivos is
  'Arquivos recebidos e bytes por conta e mês. Só o bucket autofluxos-recebidos: o acervo mora em storage.objects e não tem tabela espelho.';

-- ---------------------------------------------------------------------------
-- 5. Fechar o que acabou de nascer
-- ---------------------------------------------------------------------------
--
-- O default fechado da `0041` já faz objeto novo em `public` nascer sem grant
-- para `anon` e `authenticated`. O revoke explícito é cinto e suspensório, e é o
-- que a `0065` fez pela mesma razão: `create or replace view` não redefine
-- grants como um `drop`/`create` faria, então uma view recriada no futuro herda
-- o que tinha.

revoke all on public.consumo_de_conversas from anon, authenticated;
revoke all on public.consumo_de_arquivos from anon, authenticated;

-- `clients` ganhou coluna e as duas views vivem em `public`, que é schema
-- exposto na Data API. Sem recarregar o cache, `select('plano')` responde 400 e
-- `from('consumo_de_conversas')` responde 404 até a próxima reinicialização. O
-- cache é o mesmo dos dois produtos, por isso o reload é breve e de propósito.
notify pgrst, 'reload schema';
