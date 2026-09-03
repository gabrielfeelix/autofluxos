-- 0039 — o aviso de falha para de depender de uma variável que ninguém criou.
--
-- `alertar()` nasceu como um POST num webhook de Discord vindo do ambiente, e
-- `ALERTA_WEBHOOK_URL` nunca foi preenchida. O resultado é o pior de dois
-- mundos: existe um mecanismo de aviso, ele é chamado nos seis lugares certos,
-- e **ele não avisa ninguém**. Falha no processamento do webhook, recusa da
-- Cloud API e cofre que não devolve credencial morrem num `console.error` que
-- vive doze horas no log da Vercel e some.
--
-- A correção não é criar o webhook: é tirar o aviso da dependência de uma
-- credencial que só uma pessoa consegue criar. O alerta passa a ser **gravado
-- aqui, sempre**, e o webhook vira o extra que ele deveria ter sido desde o
-- início — quando a variável existir, o Discord toca também.
--
-- **Por que uma tabela e não o Sentry.** O argumento do `alertar.ts` continua
-- valendo (mais um cadastro, mais um SDK, mais um lugar para manter), e ganhou
-- um segundo: o banco já está aqui, já tem retenção, e uma tabela de seis
-- colunas não precisa de nenhuma chave nova para funcionar no primeiro deploy.
--
-- **Sem `client_id`.** Nem todo alerta tem cliente: falha na passada do
-- agendador e erro ao ler o cofre são da plataforma. O que houver de cliente
-- ou contato viaja em `contexto`, que é o que quem chama já monta hoje. Uma
-- chave estrangeira obrigatória forçaria inventar cliente para o alerta que não
-- tem — e um `on delete cascade` apagaria justamente o registro da falha que
-- talvez explique por que o cliente foi apagado.
--
-- **`detalhe` é texto, e não jsonb.** O que chega em `alertar()` é o que o
-- `catch` pegou, e `catch` pega qualquer coisa: `Error` com stack, string,
-- objeto de resposta HTTP. O `descrever()` do TypeScript já achata isso numa
-- linha legível; guardar como jsonb obrigaria a inventar forma para o que não
-- tem forma nenhuma.
--
-- **Retenção.** A limpeza de `/api/manutencao/retencao` apaga o que passou de
-- 90 dias. Alerta velho não é histórico que alguém consulta — é dado de
-- operação que pode carregar id de contato dentro do `contexto`, e guardar isso
-- para sempre seria guardar dado pessoal sem motivo, no arquivo que existe
-- justamente para não deixar isso acontecer.
--
-- Nada aqui encosta em `app_verandi`. Ver docs/BANCO-COMPARTILHADO.md.
set search_path = public, extensions;

create table if not exists public.alertas (
  id uuid primary key default gen_random_uuid(),
  -- A frase curta que quem chama escreveu: "a Cloud API recusou a entrega".
  -- É por ela que se agrupa na tela, então ela é o nome do problema, não a
  -- descrição da ocorrência.
  titulo text not null,
  -- O `descrever()` do `alertar.ts`: stack do Error, a string, ou o JSON do
  -- que veio. Pode ser longo; é o que se lê para entender.
  detalhe text not null,
  -- `{cliente: ..., contato: ..., fluxo: ...}` — o que quem chamou julgou útil.
  contexto jsonb not null default '{}'::jsonb,
  -- `production`, `preview`, `development`, `local`. Sem isto, um alerta de
  -- preview assusta como se fosse de produção.
  ambiente text not null default 'desconhecido',
  criado_em timestamptz not null default now(),
  -- Quando alguém marcou como visto na tela do administrador. Nulo = novo.
  -- Guardar o instante, e não um booleano, responde "há quanto tempo isso está
  -- aberto?" sem uma segunda coluna.
  visto_em timestamptz
);

-- A tela do administrador lê sempre "os mais recentes primeiro", e o contador
-- de não vistos filtra por `visto_em is null`. O índice parcial serve o
-- contador sem carregar o histórico inteiro.
create index if not exists alertas_recentes_idx on public.alertas (criado_em desc);
create index if not exists alertas_abertos_idx on public.alertas (criado_em desc)
  where visto_em is null;

comment on table public.alertas is
  'Falhas que alguém precisa ver. Gravadas sempre; ALERTA_WEBHOOK_URL, quando existir, é aviso adicional. Ver src/server/alertar.ts.';
comment on column public.alertas.contexto is
  'Pode conter id de contato. É por isso que a retenção de 90 dias existe.';

-- O padrão do produto: RLS ligada e sem política nenhuma. Só o servidor, com a
-- chave secreta, alcança. Ver 0001_init.sql e docs/BANCO-COMPARTILHADO.md §6.
alter table public.alertas enable row level security;
