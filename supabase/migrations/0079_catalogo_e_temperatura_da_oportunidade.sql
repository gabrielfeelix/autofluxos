-- ---------------------------------------------------------------------------
-- 0079 — catálogo mínimo e a temperatura da oportunidade
-- ---------------------------------------------------------------------------
--
-- Duas coisas, e as duas são da T5.1.
--
-- 1. O catálogo mínimo (`produtos`)
-- ---------------------------------------------------------------------------
--
-- Produto/serviço, nome, ativo/arquivado. Nada mais. Sem estoque, sem imposto,
-- sem ERP, e a recusa é de propósito: o que o produto precisa é conseguir
-- dizer "interessado no Plano XYZ" e "comprou o Plano XYZ" para segmentar
-- depois, e isso não exige cadastro fiscal.
--
-- `venda_itens` (0071) já guarda `descricao` e `valor_unitario` **da época**,
-- e continua guardando. O `produto_id` é vínculo, não fonte: renomear o
-- produto não pode reescrever o histórico, que é a mesma decisão da
-- `conclusoes_de_processo` (0072) e do `titulo` congelado em `passagens`.
--
-- Por isso arquivar é coluna e não `delete`: a FK de `venda_itens.produto_id`
-- é `on delete set null`, então apagar não derrubaria a venda, mas apagaria o
-- vínculo que a segmentação por produto usa. Arquivar impede uso novo e
-- preserva leitura (RB-24).
--
-- 2. A temperatura vira da oportunidade, e a do contato vira legado
-- ---------------------------------------------------------------------------
--
-- A 0068 pôs `contacts.temperatura` com default `'morno'`. O default é a
-- decisão que esta migration preserva e isola: `morno` ali quer dizer "ninguém
-- opinou", e a própria 0068 documentou que derivar temperatura de tempo parado
-- seria "inventar um número e apresentá-lo como opinião de alguém".
--
-- Então **nada é copiado**. `quadro_cartoes.temperatura` nasce `null`, que quer
-- dizer "não avaliada", e não `morno`. Copiar o `morno` automático de 35
-- contatos para as negociações deles transformaria um default em avaliação
-- humana, que é exatamente o erro que a 0068 evitou.
--
-- `contacts.temperatura` **não é apagada**: há leitores vivos (`repos/crm.ts`,
-- `temperatura-do-contato.tsx`), e derrubar a coluna exigiria que todos eles
-- mudassem no mesmo deploy. Ela passa a ser informação legada, e o comentário
-- da coluna diz isso para quem ler o schema daqui a seis meses.
--
-- Aditiva: uma tabela nova, duas colunas anuláveis, nenhuma linha reescrita.
-- Roda em `public`, qualificado, sem tocar `app_verandi`. Ver
-- docs/BANCO-COMPARTILHADO.md.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. O catálogo mínimo
-- ---------------------------------------------------------------------------

create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,

  nome text not null,
  -- `produto` ou `servico`. A distinção é do vocabulário de quem vende, e
  -- aparece na tela; o sistema trata os dois igual.
  especie text not null default 'produto',

  -- Arquivado impede uso novo e preserva o histórico (RB-24). Não é `delete`.
  arquivado_em timestamptz,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'produtos_nome_check') then
    alter table public.produtos
      add constraint produtos_nome_check check (length(trim(nome)) > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'produtos_especie_check') then
    alter table public.produtos
      add constraint produtos_especie_check check (especie in ('produto', 'servico'));
  end if;
end $$;

-- Nome único por conta, ignorando caixa e espaço nas pontas, e **só entre os
-- ativos**: arquivar "Plano Ouro" e cadastrar um "Plano Ouro" novo é legítimo,
-- e o histórico do antigo continua apontando para a linha arquivada.
create unique index if not exists produtos_nome_ativo_unico_idx
  on public.produtos (client_id, lower(trim(nome)))
  where arquivado_em is null;

create index if not exists produtos_da_conta_idx
  on public.produtos (client_id, arquivado_em);

comment on table public.produtos is
  'Catálogo mínimo: nome e ativo/arquivado. Sem estoque, imposto ou ERP (T5.1). '
  'Itens de venda guardam nome e valor da época; este cadastro é vínculo, não fonte do histórico.';

comment on column public.produtos.arquivado_em is
  'Arquivado impede uso novo e preserva leitura (RB-24). Apagar quebraria o vínculo que a segmentação por produto usa.';

-- ---------------------------------------------------------------------------
-- 2. O vínculo de interesse da oportunidade
-- ---------------------------------------------------------------------------
--
-- `on delete set null`: arquivar é o caminho normal, mas se alguém apagar um
-- produto a oportunidade não pode sumir junto. Perde-se o vínculo, não o
-- negócio.

alter table public.quadro_cartoes
  add column if not exists produto_id uuid references public.produtos (id) on delete set null;

create index if not exists quadro_cartoes_produto_idx
  on public.quadro_cartoes (produto_id)
  where produto_id is not null;

comment on column public.quadro_cartoes.produto_id is
  'O interesse desta oportunidade, quando conhecido. Nulo é "não informado", não "nenhum".';

-- ---------------------------------------------------------------------------
-- 3. A temperatura da oportunidade
-- ---------------------------------------------------------------------------
--
-- Anulável e **sem default**, ao contrário da 0068. Aqui `null` é "ninguém
-- avaliou ainda", e é informação: a prévia de um segmento "oportunidade fria"
-- precisa poder dizer que não avaliada não é fria.

alter table public.quadro_cartoes
  add column if not exists temperatura text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'quadro_cartoes_temperatura_check'
  ) then
    alter table public.quadro_cartoes
      add constraint quadro_cartoes_temperatura_check
      check (temperatura is null or temperatura in ('frio', 'morno', 'quente'));
  end if;
end $$;

create index if not exists quadro_cartoes_temperatura_idx
  on public.quadro_cartoes (client_id, temperatura)
  where temperatura is not null;

comment on column public.quadro_cartoes.temperatura is
  'A avaliação humana desta negociação. Nulo é "não avaliada" e nunca foi preenchido em massa: '
  'copiar o default ''morno'' de contacts viraria opinião de alguém que ninguém deu (ver 0068).';

comment on column public.contacts.temperatura is
  'LEGADO desde a 0079. A avaliação passou a ser por oportunidade (quadro_cartoes.temperatura). '
  'Mantida porque há leitores vivos; o default ''morno'' aqui sempre significou "ninguém opinou".';

-- ---------------------------------------------------------------------------
-- 4. Fechamento de acesso
-- ---------------------------------------------------------------------------
--
-- Objeto novo nasce fechado pelo default da 0041, e o revoke explícito fica
-- aqui porque é a linha que alguém lê ao auditar. Ver
-- docs/BANCO-COMPARTILHADO.md §6.

alter table public.produtos enable row level security;
revoke all on public.produtos from public, anon, authenticated;
