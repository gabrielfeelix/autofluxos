-- 0074: a entrada passa a ter tipo, e só o clique abre a janela de 72h.
--
-- ---------------------------------------------------------------------------
-- O defeito, medido
-- ---------------------------------------------------------------------------
--
-- `public.passagens` (0050) guarda uma linha por chegada e **não tem coluna de
-- tipo**. A view da 0065 deriva `porta_de_entrada_em` de *qualquer* linha de lá,
-- e `channels/janela.ts` usa esse campo para abrir **72h de texto livre**.
--
-- Só que duas coisas bem diferentes escrevem nessa tabela:
--
--   * `atribuirOrigem`, em `receber-mensagem.ts`, quando a Meta manda o objeto
--     `referral` junto da mensagem. É o clique em Click to WhatsApp: a pessoa
--     caiu na conversa e escreveu. **Esta** é a chegada que a Meta credita com
--     a janela gratuita de entrada;
--   * `registrarAnuncio`, em `receber-lead-do-formulario.ts`, quando um lead do
--     formulário nativo (Lead Ads) entra. A pessoa preencheu um formulário
--     dentro do Facebook e **nunca escreveu para o número**.
--
-- Resultado: o formulário abria 72h de texto livre. Quem respondesse confiando
-- nisso escrevia, enviava e recebia `(#131047) Re-engagement message`. É a
-- RB-09 da proposta de 19/set: "formulário não é conversa... não abre janela de
-- conversa do WhatsApp por si só".
--
-- O teste que prova está em `src/server/repos/porta-de-entrada.test.ts`, escrito
-- na F0 exatamente para registrar o defeito antes de corrigi-lo.
--
-- ---------------------------------------------------------------------------
-- Por que coluna, e não deduzir do título
-- ---------------------------------------------------------------------------
--
-- Hoje as linhas de formulário têm `titulo` começando com `'Formulário'`, e dá
-- para separá-las com um `like`. Não vale: o título é **o que a pessoa leu no
-- criativo**, texto livre vindo da Meta, e um anúncio chamado "Formulário de
-- matrícula" viraria formulário por acidente. Regra de janela de envio não pode
-- depender de como alguém nomeou uma campanha.
--
-- ---------------------------------------------------------------------------
-- A retroatividade, e o que ela decide
-- ---------------------------------------------------------------------------
--
-- O default é `'anuncio_whatsapp'`, e as linhas antigas de formulário são
-- reescritas pelo `update` abaixo, pelo único sinal que existe no dado
-- histórico: o `titulo`. É a mesma heurística recusada acima para o futuro, e
-- aqui ela é aceitável porque é uma passada única sobre dado que já existe, e
-- porque **errar para o lado do formulário fecha a janela**, nunca abre. Uma
-- linha de anúncio mal classificada como formulário faz a tela oferecer modelo
-- aprovado a quem poderia ter texto livre: caro, visível e reversível. O
-- contrário é a mensagem recusada pela Meta depois de digitada.
--
-- Da 0075 em diante quem grava o tipo é o código, e não há heurística nenhuma.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- O tipo
-- ---------------------------------------------------------------------------

alter table public.passagens
  add column if not exists tipo text not null default 'anuncio_whatsapp';

/*
 * `check` e não enum: acrescentar valor a um enum do Postgres exige
 * `alter type`, que não roda dentro de transação em versões antigas e trava o
 * ensaio em transação que este repositório usa como prova antes de aplicar em
 * produção. `check` é drop e recria, como a 0034 e a 0070 já fizeram.
 *
 * A lista é a mesma de `src/core/regras-de-entrada.ts`. Quem acrescentar um
 * tipo lá precisa vir aqui: é de propósito que sejam dois lugares, porque o
 * banco recusar o valor é a última rede quando o código erra.
 */
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'passagens_tipo_check'
  ) then
    alter table public.passagens
      add constraint passagens_tipo_check check (tipo in (
        'anuncio_whatsapp',
        'botao_pagina',
        'formulario',
        'mensagem',
        'importacao',
        'submissao_manual'
      ));
  end if;
end $$;

comment on column public.passagens.tipo is
  'De onde a entrada veio. Só anuncio_whatsapp e botao_pagina abrem a janela gratuita de 72h (RB-09): formulario e importacao nao sao conversa. A lista espelha src/core/regras-de-entrada.ts.';

/*
 * A passada única sobre o histórico. Ver o bloco "A retroatividade" acima para
 * por que a heurística de título é aceitável aqui e proibida no código novo.
 */
update public.passagens
   set tipo = 'formulario'
 where tipo = 'anuncio_whatsapp'
   and titulo like 'Formulário%';

/*
 * O índice que a view vai usar. O `passagens_do_contato_idx` da 0050 é
 * `(contact_id, criado_em desc)` e não sabe filtrar por tipo: o lateral join
 * novo teria que ler as linhas do contato e descartar as de formulário. Índice
 * parcial porque a pergunta é sempre a mesma — "qual foi a última chegada que
 * abre a porta" — e as linhas que não abrem não precisam entrar nele.
 */
create index if not exists passagens_porta_de_entrada_idx
  on public.passagens (contact_id, criado_em desc)
  where tipo in ('anuncio_whatsapp', 'botao_pagina');

-- ---------------------------------------------------------------------------
-- A chave idempotente da entrada (RB-10)
-- ---------------------------------------------------------------------------

/*
 * A 0050 deduplica por `(contact_id, ad_id, minuto)`. Isso protege o retry do
 * webhook e **quebra a RB-10 no caso legítimo**: duas submissões reais do mesmo
 * formulário no mesmo minuto são duas entradas, cada uma com seu `leadgen_id`,
 * e o índice de minuto joga a segunda fora.
 *
 * `chave_externa` é o ID do evento na origem, quando existe. O índice é único e
 * **parcial**: só as linhas que têm chave entram, então as que não têm continuam
 * governadas pelo índice de minuto da 0050, que é o melhor disponível para elas.
 *
 * `client_id` na chave e não só a chave: `leadgen_id` é único na Meta, mas
 * `service_role` ignora RLS e quem isola conta é a consulta. Um índice global
 * deixaria a chegada de uma conta recusar a de outra.
 */
alter table public.passagens
  add column if not exists chave_externa text;

comment on column public.passagens.chave_externa is
  'ID do evento na origem (leadgen_id, wamid), quando existe. Torna a reentrega idempotente sem confundir duas submissoes reais no mesmo minuto (RB-10).';

create unique index if not exists passagens_chave_externa_idx
  on public.passagens (client_id, chave_externa)
  where chave_externa is not null;

/*
 * E o índice de minuto da 0050 precisa sair do caminho de quem tem chave.
 *
 * **Criar o índice novo não basta, e foi o teste que mostrou.** O
 * `passagens_sem_repeticao_idx` é `(contact_id, ad_id, minuto)` e recusa a
 * segunda submissão legítima antes de a chave externa ser sequer consultada:
 * duas submissões reais do mesmo formulário, no mesmo minuto, com `leadgen_id`
 * diferentes, viravam uma só linha. A segunda pessoa que preenchesse o
 * formulário naquele minuto simplesmente não existiria.
 *
 * Então ele passa a valer **só para as linhas sem chave**, que são as que
 * dependem do tempo por não terem nada melhor: a chegada por anúncio sem
 * `ctwa_clid` (anúncio de Status) e as linhas antigas. Para quem tem chave, quem
 * decide é o índice acima, que é a regra certa da RB-10.
 *
 * Índice parcial não se altera: é drop e create, e os dois cabem na mesma
 * transação.
 */
drop index if exists public.passagens_sem_repeticao_idx;

create unique index if not exists passagens_sem_repeticao_idx
  on public.passagens (contact_id, ad_id, minuto)
  where chave_externa is null;

-- ---------------------------------------------------------------------------
-- A view: só o clique conta como porta de entrada
-- ---------------------------------------------------------------------------

/*
 * `create or replace view` acrescentando **nenhuma** coluna: a lista, a ordem,
 * os nomes e os tipos são os mesmos da 0065. O que muda é o `where` de um
 * lateral join, e é isso que fecha a janela indevida.
 */
create or replace view public.leads
with (security_invoker = true) as
select
  c.id             as contact_id,
  c.client_id,
  c.wa_id,
  c.nome,
  c.campos,
  c.criado_em,
  ultima.ts        as ultima_em,
  ultima.direcao   as ultima_direcao,
  ultima.texto     as ultimo_texto,
  aberto.motivo    as handoff_motivo,
  aberto.criado_em as handoff_em,
  ultima.entregue  as ultima_entregue,
  c.automacao_ativa,
  c.nome_real,
  c.notas,
  entrada.ts       as ultima_entrada_em,
  c.atribuido_a,
  ultima.tipo      as ultimo_tipo,
  c.estado,
  c.adiada_ate,
  c.adiada_nota,
  c.resolvida_em,
  case
    when c.estado = 'adiada' and c.adiada_ate is not null and c.adiada_ate <= now()
      then 'aberta'
    else c.estado
  end              as estado_efetivo,
  ultima.autor_tipo as ultimo_autor_tipo,
  ultima.autor_nome as ultimo_autor_nome,
  porta.criado_em  as porta_de_entrada_em
from public.contacts c
left join lateral (
  select
    m.ts,
    m.direcao,
    m.texto,
    m.entregue,
    m.payload->>'type' as tipo,
    m.payload->'autor'->>'tipo' as autor_tipo,
    m.payload->'autor'->>'nome' as autor_nome
  from public.messages m
  where m.contact_id = c.id
  order by m.ts desc
  limit 1
) ultima on true
left join lateral (
  select h.motivo, h.criado_em
  from public.handoffs h
  join public.sessions s on s.id = h.session_id
  where s.contact_id = c.id
    and h.resolvido_em is null
  order by h.criado_em desc
  limit 1
) aberto on true
left join lateral (
  select m.ts
  from public.messages m
  where m.contact_id = c.id
    and m.direcao = 'entrada'
  order by m.ts desc
  limit 1
) entrada on true
/*
 * A última chegada **que abre a porta**, e só ela.
 *
 * O filtro de tipo é a correção desta migration. Sem ele, a linha de formulário
 * que `receber-lead-do-formulario.ts` grava virava 72h de texto livre para quem
 * nunca escreveu, e a conta em `channels/janela.ts` estava certa: o defeito era
 * a procedência do campo.
 *
 * A lista é literal, e não uma consulta a outra tabela, porque é regra de
 * produto e precisa estar legível aqui: quem lê a view tem que ver quais
 * chegadas contam sem abrir outro arquivo. O `check` da coluna garante que não
 * exista valor fora da lista conhecida.
 */
left join lateral (
  select p.criado_em
  from public.passagens p
  where p.contact_id = c.id
    and p.tipo in ('anuncio_whatsapp', 'botao_pagina')
  order by p.criado_em desc
  limit 1
) porta on true;

-- Mesma razão da 0065 e da 0049: recriar a view devolve os grants ao default do
-- schema, e o revoke explícito é o cinto e suspensório.
revoke all on public.leads from anon, authenticated;
grant select on public.leads to service_role;

-- A view e as duas colunas vivem em `public`, que é schema exposto na Data API.
-- Sem recarregar o cache, ler `tipo` ou `chave_externa` pelo PostgREST responde
-- 404 até a próxima reinicialização. O cache é o mesmo dos dois produtos: quem
-- aplicar isto em produção confere a Verandi depois do notify.
notify pgrst, 'reload schema';
