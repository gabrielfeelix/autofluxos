-- ---------------------------------------------------------------------------
-- 0071 — finalidade do processo, ocorrência recorrente e venda com registro
--        próprio
-- ---------------------------------------------------------------------------
--
-- O que esta migration separa, e por quê
-- ---------------------------------------------------------------------------
--
-- Até a 0070, `quadro_cartoes.situacao = 'ganha'` queria dizer duas coisas ao
-- mesmo tempo: "este trabalho terminou bem" e "esta pessoa comprou". Os modelos
-- de funil marcam como ganho a etapa final do Atendimento ("Resolvido"), da
-- Captação ("Qualificado") e da Agenda ("Compareceu") — nenhuma delas é compra.
-- Como `repos/crm.ts` e `repos/relacionamento.ts` derivam compra de cartão
-- ganho, a clínica que respondeu dez dúvidas aparecia com dez compras e uma
-- receita que ninguém faturou.
--
-- Medido contra este banco, não suposto:
-- `src/server/repos/venda-nao-e-atendimento.test.ts` provou os dois aceites
-- falhando (A11 e A12) antes desta migration existir.
--
-- Três mudanças, todas **aditivas**:
--
--   1. `quadros.finalidade`  — comercial ou operacional (RB-03)
--   2. `quadro_cartoes` ganha identidade de ocorrência, e a unicidade
--      permanente por contato vira unicidade do **evento de criação** (RB-02)
--   3. `vendas` e `venda_itens` — a compra com registro próprio (RB-05, RB-29)
--
-- O que NÃO acontece aqui
-- ---------------------------------------------------------------------------
--
-- Nenhuma coluna é apagada e nenhum dado é reinterpretado. `quadro_cartoes`
-- mantém `valor`, `fechado_em` e `situacao` exatamente como estão, porque há
-- leitores vivos deles e porque converter ganho antigo em venda seria decidir
-- por suposição o que a RB-32 manda mandar para revisão humana. A conversão do
-- legado é ação de gestor, com prévia, na F5.
--
-- Roda em `public`, qualificado, sem tocar `app_verandi`. Ver
-- docs/BANCO-COMPARTILHADO.md.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. A finalidade do processo
-- ---------------------------------------------------------------------------

alter table public.quadros
  add column if not exists finalidade text not null default 'operacional';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'quadros_finalidade_check'
  ) then
    alter table public.quadros
      add constraint quadros_finalidade_check
      check (finalidade in ('operacional', 'comercial'));
  end if;
end $$;

comment on column public.quadros.finalidade is
  'Para que serve o processo. `operacional` (padrão) acompanha um trabalho e concluir não registra venda; `comercial` negocia e o ganho exige venda. Todo quadro existente nasce operacional de propósito: o desconhecido não pode virar receita (RB-03, RB-06).';

-- **Todo quadro que já existe fica operacional.** É a escolha conservadora e
-- ela é deliberada: marcar os antigos como comerciais transformaria, de uma
-- vez, todo "Resolvido" acumulado em compra — exatamente o defeito que esta
-- migration existe para acabar. Quem vende de verdade marca o funil como
-- comercial numa ação explícita, que a F5 entrega na tela.
--
-- O `default` acima já cobre as linhas existentes; o update abaixo é só para
-- deixar o estado explícito em bases onde a coluna já existisse anulável.
update public.quadros set finalidade = 'operacional' where finalidade is null;

-- ---------------------------------------------------------------------------
-- 2. A ocorrência: o mesmo contato pode voltar ao mesmo processo
-- ---------------------------------------------------------------------------
--
-- `quadro_cartoes_unico_idx (quadro_id, contact_id)`, da 0032, garante um
-- cartão por pessoa em cada quadro. Ele resolve um problema real — dois
-- cliques em "pôr no quadro" não podem criar a mesma pessoa em duas etapas —
-- mas resolve proibindo recorrência para sempre: a segunda compra do mesmo
-- cliente no mesmo funil não tem onde existir (A12).
--
-- O que precisava ser único era o **evento de criação**, não a existência do
-- vínculo. A troca: unicidade passa a valer só entre os cartões **abertos**.
-- Fechado (ganho, perdido, concluído, cancelado) sai do caminho e o contato
-- pode abrir outra ocorrência.
--
-- O índice parcial preserva a proteção original inteira: enquanto houver um
-- cartão aberto daquela pessoa naquele quadro, o segundo continua recusado com
-- 23505, e `porNoQuadro` continua idempotente como era.

drop index if exists public.quadro_cartoes_unico_idx;

create unique index if not exists quadro_cartoes_aberto_unico_idx
  on public.quadro_cartoes (quadro_id, contact_id)
  where situacao = 'aberta';

comment on index public.quadro_cartoes_aberto_unico_idx is
  'Um cartão ABERTO por contato em cada quadro. Substitui a unicidade permanente da 0032: fechado libera nova ocorrência, que é como recompra e retorno existem (RB-02, A12).';

-- A chave de idempotência da criação.
--
-- Com a unicidade afrouxada, o retry de um webhook poderia criar duas
-- ocorrências onde havia uma intenção só. Esta coluna carrega a chave do evento
-- que originou o cartão; quando ela existe, é única por quadro.
alter table public.quadro_cartoes
  add column if not exists chave_de_criacao text;

create unique index if not exists quadro_cartoes_chave_criacao_idx
  on public.quadro_cartoes (quadro_id, chave_de_criacao)
  where chave_de_criacao is not null;

comment on column public.quadro_cartoes.chave_de_criacao is
  'Chave idempotente do evento que criou a ocorrência (id do webhook, da conclusão de origem, da ação). Nula em criação manual. Reentrega do mesmo evento não cria segunda ocorrência (RB-10, RB-25).';

-- ---------------------------------------------------------------------------
-- 3. A venda
-- ---------------------------------------------------------------------------

create table if not exists public.vendas (
  id uuid primary key default gen_random_uuid(),

  client_id uuid not null references public.clients (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,

  /**
   * A oportunidade que foi ganha.
   *
   * `restrict`, e não `cascade`: apagar um cartão não pode apagar a venda em
   * silêncio. Venda é fato comercial e some por cancelamento auditado, nunca
   * por efeito colateral de outra tela.
   */
  cartao_id uuid not null references public.quadro_cartoes (id) on delete restrict,

  /**
   * A data da compra, informada por quem registrou.
   *
   * Separada de `criado_em` de propósito: o vendedor fecha na sexta e registra
   * na segunda, e é a data da compra que manda na recência e no "sem comprar
   * há X dias" (RB-35).
   */
  data_da_venda date not null,

  /**
   * O total conhecido. **`null` é "não informado", e nunca zero.**
   *
   * `numeric`, não `float`: dinheiro em ponto flutuante soma errado no
   * fechamento do mês. Mesma escolha de `quadro_cartoes.valor`.
   */
  valor_total numeric(12, 2),

  -- A primeira versão opera em BRL. A coluna existe para que somar moedas
  -- diferentes seja uma decisão futura explícita, e não um acidente.
  moeda text not null default 'BRL',

  situacao text not null default 'valida',

  -- Cancelamento: o registro continua legível, com motivo e autor (RB-31).
  cancelada_em timestamptz,
  motivo_do_cancelamento text,

  nota text,

  /** Quem registrou. `null` = automação ou registro migrado. */
  autor uuid references public.af_usuarios (id) on delete set null,

  /**
   * A chave da operação que criou esta venda.
   *
   * É o que faz duplo clique e retry de rede devolverem a **mesma** venda em
   * vez de duas (RB-30, A13). Única por cliente quando presente.
   */
  chave_da_operacao text,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'vendas_situacao_check') then
    alter table public.vendas
      add constraint vendas_situacao_check check (situacao in ('valida', 'cancelada'));
  end if;

  -- Valor ausente é permitido; negativo não.
  if not exists (select 1 from pg_constraint where conname = 'vendas_valor_check') then
    alter table public.vendas
      add constraint vendas_valor_check check (valor_total is null or valor_total >= 0);
  end if;

  -- Cancelada precisa dizer quando e por quê. Sem isso o indicador muda e
  -- ninguém consegue explicar a diferença depois.
  if not exists (select 1 from pg_constraint where conname = 'vendas_cancelamento_coerente') then
    alter table public.vendas
      add constraint vendas_cancelamento_coerente check (
        (situacao = 'valida'    and cancelada_em is null and motivo_do_cancelamento is null)
        or
        (situacao = 'cancelada' and cancelada_em is not null)
      );
  end if;
end $$;

-- **No máximo uma venda válida por oportunidade** (RB-05).
--
-- Parcial: a cancelada sai do índice, então corrigir um registro errado e
-- lançar o certo continua possível. Reabrir e ganhar de novo reutiliza a
-- identidade, sem criar duas compras válidas para a mesma negociação.
create unique index if not exists vendas_uma_valida_por_cartao_idx
  on public.vendas (cartao_id)
  where situacao = 'valida';

create unique index if not exists vendas_chave_da_operacao_idx
  on public.vendas (client_id, chave_da_operacao)
  where chave_da_operacao is not null;

create index if not exists vendas_do_contato_idx
  on public.vendas (contact_id, data_da_venda desc)
  where situacao = 'valida';

create index if not exists vendas_da_conta_idx
  on public.vendas (client_id, data_da_venda desc)
  where situacao = 'valida';

comment on table public.vendas is
  'A compra confirmada pela empresa. Não é recebimento: pagamento fica fora (RB-29). Cancelar não apaga, tira dos indicadores com motivo (RB-31).';

-- ---------------------------------------------------------------------------
-- 3.1 Os itens
-- ---------------------------------------------------------------------------

create table if not exists public.venda_itens (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references public.vendas (id) on delete cascade,

  /** O catálogo, quando houver. Venda descrita só em texto não tem produto. */
  produto_id uuid,

  /**
   * O nome **da época**.
   *
   * Guardado aqui, e não buscado no catálogo na leitura: renomear o produto não
   * pode reescrever o histórico de quem já comprou.
   */
  descricao text not null,

  -- Os dois anuláveis pelo mesmo motivo do total: não informado não é zero,
  -- e não é 1.
  quantidade numeric(12, 3),
  valor_unitario numeric(12, 2),

  criado_em timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'venda_itens_descricao_check') then
    alter table public.venda_itens
      add constraint venda_itens_descricao_check check (length(trim(descricao)) > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'venda_itens_quantidade_check') then
    alter table public.venda_itens
      add constraint venda_itens_quantidade_check check (quantidade is null or quantidade > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'venda_itens_valor_check') then
    alter table public.venda_itens
      add constraint venda_itens_valor_check check (valor_unitario is null or valor_unitario >= 0);
  end if;
end $$;

create index if not exists venda_itens_da_venda_idx on public.venda_itens (venda_id);

comment on table public.venda_itens is
  'O que foi vendido, com nome e valor da época. Quantidade e valor nulos são "não informado" (RB-06).';

-- ---------------------------------------------------------------------------
-- 4. Fechamento de acesso
-- ---------------------------------------------------------------------------
--
-- `public` está exposto na Data API e o projeto é dividido com a Verandi. Desde
-- a 0041 objeto novo nasce fechado pelo default do papel `postgres`, mas o
-- revoke explícito fica aqui porque ele é a linha que alguém lê ao auditar, e
-- porque não custa nada. Ver docs/BANCO-COMPARTILHADO.md §6.

alter table public.vendas enable row level security;
revoke all on public.vendas from public, anon, authenticated;

alter table public.venda_itens enable row level security;
revoke all on public.venda_itens from public, anon, authenticated;
