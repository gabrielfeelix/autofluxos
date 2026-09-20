-- ---------------------------------------------------------------------------
-- 0085 — a inscrição sabe de qual negociação ela é
-- ---------------------------------------------------------------------------
--
-- O defeito medido, e está numa função no banco
-- ---------------------------------------------------------------------------
--
-- `public.sair_das_sequencias` (0031) é isto, inteira:
--
--     update public.sequencia_inscricoes
--        set estado = 'saiu', motivo = p_motivo, atualizado_em = now()
--      where contact_id = p_contato_id
--        and estado = 'ativa'
--
-- Sem `cartao_id` na tabela, **não havia como escrever outra coisa**: a inscrição
-- é do contato, ponto. Então um evento de uma negociação tira a pessoa de todas.
--
-- A RB-47 nomeia exatamente esse caso: "a empresa configura saída ao responder,
-- comprar ou mudar de etapa, sempre no vínculo pertinente. **Compra em outra
-- negociação não encerra automaticamente toda sequência do contato.**"
--
-- O cenário que custa dinheiro, e ele não é hipotético num CRM com vários funis:
-- a cliente fecha a mensalidade do pilates (uma oportunidade, no funil
-- comercial) e é retirada, no mesmo instante, do acompanhamento de pós-venda que
-- ia oferecer a avaliação física dela (outra oportunidade, outro funil). Ninguém
-- percebe: a sequência não falhou, ela "saiu com motivo".
--
-- O que esta migration acrescenta
-- ---------------------------------------------------------------------------
--
-- Uma coluna **anulável** em `public.sequencia_inscricoes`:
--
--   `cartao_id uuid references public.quadro_cartoes(id) on delete set null`
--
-- **Anulável é o desenho, e não uma concessão.** Inscrição sem cartão é o caso
-- comum e legítimo: a régua de retomada por sumiço (0070), a sequência por
-- etiqueta e a de pós-atendimento são **do contato**, e não de negociação
-- nenhuma. Obrigar um cartão inventaria uma oportunidade por acompanhamento, e
-- aí o funil de todo mundo encheria de cartão que ninguém abriu (é o mesmo erro
-- que a 0079 foi escrita para não cometer com a temperatura).
--
-- Nulo, então, quer dizer **"é do contato"**, e não "faltou preencher". A
-- diferença aparece na saída: evento de negociação não encerra inscrição de
-- contato, e evento de contato (respondeu, sumiu) encerra as duas.
--
-- `on delete set null`, e não `cascade`: apagar um cartão não pode apagar o
-- histórico do acompanhamento que rodou por causa dele. A inscrição vira "do
-- contato", que é a leitura honesta depois de a negociação deixar de existir.
--
-- O índice único NÃO muda, e é a decisão mais delicada daqui
-- ---------------------------------------------------------------------------
--
-- Hoje existe:
--
--   sequencia_inscricoes_unica_idx unique (sequencia_id, contact_id)
--     where estado = 'ativa'
--
-- A tentação é trocar por `(sequencia_id, contact_id, cartao_id)`, para a mesma
-- pessoa poder estar na mesma sequência por duas negociações. **Não vamos
-- trocar**, e o motivo é o WhatsApp:
--
--   1. em Postgres, `unique` **não** considera duas linhas com `cartao_id` nulo
--      como iguais, então a versão com três colunas deixaria de barrar a
--      inscrição duplicada do caso comum (nulo), que é justamente o que o índice
--      existe para barrar. Seria preciso um segundo índice parcial para o nulo,
--      e dois índices dizendo regras diferentes sobre a mesma tabela é como se
--      perde o controle de uma regra;
--   2. mesmo resolvido isso, o efeito visível seria **duas mensagens** da mesma
--      sequência chegando ao mesmo número no mesmo dia, uma por negociação. A
--      pessoa do outro lado não tem funil: ela tem uma conversa.
--
-- Então a regra segue: **uma inscrição ativa por sequência e por pessoa.** O
-- `cartao_id` diz de qual negociação aquela inscrição nasceu, e serve para a
-- **saída** ser precisa, que é o defeito medido. Deixar a mesma pessoa em duas
-- inscrições da mesma sequência é outra decisão, de produto, e depende de a
-- transmissão saber juntar mensagem: ver o handoff.
--
-- A função passa a receber o contexto
-- ---------------------------------------------------------------------------
--
-- `sair_das_sequencias` ganha um terceiro argumento, `p_cartao_id`:
--
--   * **nulo** = evento do contato (respondeu, sumiu, foi atendido). Encerra
--     tudo que está ativo, como hoje. Este é o comportamento antigo, preservado
--     inteiro: quem voltou a falar não precisa ser lembrado de falar, e isso
--     vale para qualquer acompanhamento;
--   * **preenchido** = evento daquela negociação (vendeu, perdeu, mudou de
--     etapa). Encerra a inscrição **daquele cartão** e as **do contato**
--     (`cartao_id is null`), e deixa em paz as de outras negociações.
--
-- Por que a inscrição de contato também sai quando a venda é de um cartão: uma
-- régua de recompra é do contato, e quem acabou de comprar não pode receber
-- "faz tempo que você não compra". A que fica é a que fala de **outra**
-- negociação, e é a que o defeito estava matando.
--
-- **É `create or replace` com assinatura nova**, então a antiga de dois
-- argumentos continua existindo. Isso é deliberado e não sobra: é o que faz o
-- código publicado hoje continuar funcionando entre esta migration e o deploy
-- (migration primeiro, deploy depois). A de dois argumentos passa a delegar para
-- a de três com nulo, para não haver duas cópias da regra.
--
-- Aditiva: uma coluna anulável, um índice parcial novo, e uma função nova ao
-- lado da existente. Nenhuma linha reescrita. Roda em `public`, qualificado, sem
-- tocar `app_verandi`. Ver docs/BANCO-COMPARTILHADO.md.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- A coluna
-- ---------------------------------------------------------------------------

alter table public.sequencia_inscricoes
  add column if not exists cartao_id uuid
    references public.quadro_cartoes(id) on delete set null;

comment on column public.sequencia_inscricoes.cartao_id is
  'De qual negociacao esta inscricao nasceu. NULO = a inscricao e do contato '
  '(regua por sumico, etiqueta, pos-atendimento), e nao falta de preenchimento. '
  'Serve para a SAIDA ser precisa: venda numa oportunidade nao encerra o '
  'acompanhamento de outra (RB-47). Ver core/politica-de-acompanhamento.ts.';

-- O índice serve à saída por negociação, que é a consulta nova: "as inscrições
-- ativas deste cartão". Parcial em `ativa` porque é só sobre essas que se decide
-- algo, e é o mesmo recorte dos outros índices desta tabela.
create index if not exists sequencia_inscricoes_cartao_idx
  on public.sequencia_inscricoes (cartao_id)
  where cartao_id is not null and estado = 'ativa';

-- ---------------------------------------------------------------------------
-- A saída com contexto
-- ---------------------------------------------------------------------------

create or replace function public.sair_das_sequencias(
  p_contato_id uuid,
  p_motivo text,
  p_cartao_id uuid
)
returns setof uuid
language sql
set search_path = ''
as $$
  update public.sequencia_inscricoes
     set estado = 'saiu',
         motivo = p_motivo,
         atualizado_em = now()
   where contact_id = p_contato_id
     and estado = 'ativa'
     and (
       -- Evento do contato: alcança tudo, como sempre alcançou.
       p_cartao_id is null
       -- Evento de negociação: a dela, mais as que são do contato. As de OUTRAS
       -- negociações ficam de pé, e é o defeito que esta migration corrige.
       or cartao_id is null
       or cartao_id = p_cartao_id
     )
  returning id;
$$;

comment on function public.sair_das_sequencias(uuid, text, uuid) is
  'Encerra inscricoes ativas de um contato. p_cartao_id nulo = evento do contato '
  '(alcanca tudo). Preenchido = evento daquela negociacao: alcanca a dela e as '
  'do contato, e NAO as de outras negociacoes (RB-47).';

/*
 * A de dois argumentos continua existindo, e passa a delegar.
 *
 * **Não é sobra.** O código publicado hoje chama a de dois, e entre esta
 * migration e o deploy as duas precisam funcionar: é a ordem que a 0058 e a 0071
 * ensinaram (migration primeiro, deploy depois). Delegar em vez de repetir o
 * `update` impede as duas de divergirem, que é como uma regra se perde.
 */
create or replace function public.sair_das_sequencias(p_contato_id uuid, p_motivo text)
returns setof uuid
language sql
set search_path = ''
as $$
  select public.sair_das_sequencias(p_contato_id, p_motivo, null::uuid);
$$;

-- ---------------------------------------------------------------------------
-- As permissões
-- ---------------------------------------------------------------------------
--
-- `revoke ... from anon, authenticated` **sozinho não fecha função**: o Postgres
-- concede `EXECUTE` a `PUBLIC` implicitamente na criação, e os dois papéis
-- herdam de lá o que se revoga deles. A 0026 revogou `pegar_tarefas` dos dois e a
-- função seguiu executável pelos dois por meses. `public` entra na lista, como a
-- 0040 fez.

revoke all on function public.sair_das_sequencias(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.sair_das_sequencias(uuid, text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- O cache do PostgREST
-- ---------------------------------------------------------------------------
--
-- A coluna nova e a assinatura nova da função precisam do reload: sem ele,
-- `rpc('sair_das_sequencias', {p_cartao_id: ...})` responde 404 e
-- `select('cartao_id')` responde 400 até a próxima reinicialização. O cache é o
-- mesmo dos dois produtos: conferir a Verandi depois.

notify pgrst, 'reload schema';
