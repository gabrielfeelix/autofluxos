-- 0050 — o nome que o gestor deu à campanha.
--
-- ---------------------------------------------------------------------------
-- O que a Meta não manda
-- ---------------------------------------------------------------------------
--
-- O `referral` do CTWA chega com `source_id` (o `ad_id`, dezesseis dígitos) e
-- `headline` (o título escrito no criativo). O **nome da campanha** — aquele
-- que o gestor de tráfego digitou no Gerenciador de Anúncios, "Institucional |
-- Retargeting | Set26" — não vem em webhook nenhum. Ele existe só atrás de uma
-- segunda chamada, ao nó `Ad` da Marketing API, com um token de Ads.
--
-- É por isso que quase ninguém mostra: a Wati e a Zenvia param no id, a Ploomes
-- diz por escrito que "não há informação nativa da campanha específica", a RD
-- manda usar Zapier. Entre os CRMs brasileiros só o PipeRun resolve.
--
-- ---------------------------------------------------------------------------
-- Por que uma tabela, e não três colunas em `contacts`
-- ---------------------------------------------------------------------------
--
-- Porque o nome **não pertence ao contato** — pertence ao anúncio. Duzentas
-- pessoas que vieram da mesma campanha têm um nome só entre elas, e guardá-lo
-- em cada linha de `contacts` significaria duzentas cópias para atualizar no
-- dia em que a campanha for renomeada, e duzentas chamadas à Meta para
-- descobrir a mesma coisa. O limite da Meta é proporcional ao volume de leads
-- da Página — isto é, mais apertado justamente para a conta que está começando.
--
-- Uma linha por `ad_id` também é o que faz o Lead Ads reaproveitar isto de
-- graça quando chegar: lá o campo se chama `ad_id` e é o mesmo número.
--
-- ---------------------------------------------------------------------------
-- O cache pode mentir, e é de propósito
-- ---------------------------------------------------------------------------
--
-- `contacts.campos->>'origem_anuncio'` continua sendo a verdade do que
-- aconteceu: aquela conversa veio daquele `ad_id`, e isso não muda nunca. Esta
-- tabela é **só o nome de agora**. Campanha renomeada em outubro não reescreve
-- o histórico de agosto — ela troca o rótulo que a tela exibe, que é
-- exatamente o comportamento que se espera de um rótulo.
--
-- E quando o token cair (a Meta vence o de usuário em 60 dias, e a permissão
-- pode ser revogada no Business Manager sem ninguém avisar), a tela volta a
-- mostrar o `headline`, que está no contato desde a primeira mensagem. Sem
-- nome é pior; vazio seria inaceitável.
--
-- ---------------------------------------------------------------------------
-- Por conta, e não global
-- ---------------------------------------------------------------------------
--
-- O mesmo `ad_id` nunca aparece em duas contas — anúncio pertence a uma conta
-- de anúncios só. Mesmo assim a linha é chaveada por `client_id` junto, porque
-- **isolamento não se deduz, se escreve**: sem ele, uma conta que resolvesse um
-- id de outra leria o nome da campanha de um negócio que não é dela. Custa uma
-- coluna e fecha a porta.

set search_path = public, extensions;

create table if not exists public.anuncios (
  -- O id da Meta. É a chave natural: `source_id` do CTWA e `ad_id` do Lead Ads
  -- são o mesmo número, então os dois caminhos caem na mesma linha.
  ad_id       text not null,
  client_id   uuid not null references public.clients (id) on delete cascade,

  -- Os três níveis, porque respondem perguntas diferentes: o anúncio diz qual
  -- criativo, o conjunto diz qual público, a campanha diz qual objetivo.
  -- Vazios (e não nulos) porque "a Meta respondeu e o campo veio em branco" e
  -- "ainda não perguntei" já se distinguem pela existência da linha.
  anuncio     text not null default '',
  conjunto    text not null default '',
  campanha    text not null default '',

  -- Quando o nome foi lido da Meta. É o que decide se vale perguntar de novo —
  -- ver VALIDADE_DO_NOME_EM_HORAS em `src/core/anuncios.ts`.
  resolvido_em timestamptz not null default now(),

  criado_em   timestamptz not null default now(),

  primary key (client_id, ad_id)
);

comment on table public.anuncios is
  'Nome de campanha/conjunto/anúncio resolvido na Marketing API, por ad_id. É cache: a verdade do que aconteceu continua em contacts.campos->>origem_anuncio. Renomear campanha troca o rótulo, não o histórico.';

comment on column public.anuncios.resolvido_em is
  'Quando a Meta respondeu. Nome vencido continua sendo mostrado — só decide quando perguntar de novo, para a tela não piscar de volta ao headline.';

-- Quem está velho, por conta.
--
-- O uso real é "desta lista de ids, quais preciso perguntar de novo" — uma
-- leitura por conta filtrando por data. Sem este índice ela varre a tabela
-- inteira, que cresce com o número de anúncios de todos os clientes juntos.
create index if not exists anuncios_frescor_idx
  on public.anuncios (client_id, resolvido_em desc);

-- RLS ligada sem política, como todo o resto (0041).
--
-- A chave publishable não lê nada: todo acesso passa pelo servidor, que já
-- confere o dono em `exigirAcessoAoCliente`. Ligar sem política é o que torna
-- isso verdade no banco, e não só no código.
alter table public.anuncios enable row level security;

notify pgrst, 'reload schema';
