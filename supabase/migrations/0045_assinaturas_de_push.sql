-- 0045 — o aviso alcança quem não está com o painel aberto
--
-- **O elo mais fraco do produto**, nas palavras do PLANO-SISTEMA §3.10.1:
-- `NotificacoesDaFila` consulta a cada 30s e avisa quem está com a tela
-- aberta. Fora disso o bot passa a conversa para uma pessoa, ninguém percebe, e
-- o cliente descobre pelo lead reclamando.
--
-- Push do navegador resolve exatamente esse caso — o telefone no bolso, o
-- painel fechado — e para funcionar precisa guardar uma coisa: para onde
-- mandar. É o que esta tabela é.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Para onde o push vai
-- ---------------------------------------------------------------------------
--
-- **A assinatura é do navegador, não da pessoa.** Quem abre o painel no
-- celular e no computador tem duas, e as duas devem tocar: o aviso serve para
-- alcançar em qualquer aparelho que esteja à mão. Daí a chave ser o `endpoint`
-- e não o usuário.
--
-- `endpoint` é uma URL no servidor de push do fabricante do navegador (Google,
-- Mozilla, Apple) e é ela que identifica o aparelho. `p256dh` e `auth` são as
-- chaves com que **o navegador** decifra o conteúdo: o corpo da notificação
-- viaja cifrado ponta a ponta, e o servidor do fabricante não o lê. É por isso
-- que a coluna existe aqui e não é segredo nosso — sem ela, ninguém consegue
-- decifrar coisa alguma, inclusive nós.
--
-- **Não guardamos conteúdo de conversa aqui.** Ver `core/aviso-de-handoff.ts`:
-- o texto do aviso leva nome e motivo, nunca a mensagem do lead.
create table if not exists public.assinaturas_de_push (
  id         uuid primary key default gen_random_uuid(),

  -- A conta em que a pessoa vai atender. O aviso é por conta: quem participa
  -- de duas assina duas vezes, e uma conversa de uma nunca vaza para a outra.
  client_id  uuid not null references public.clients (id) on delete cascade,

  -- O usuário do login. Sem FK: `af_usuarios` é tabela do Better Auth, e a
  -- regra do BANCO-COMPARTILHADO é não amarrar objeto nosso ao esquema que o
  -- plugin gerencia — uma migração dele não pode derrubar esta tabela.
  usuario_id text not null,

  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,

  criada_em  timestamptz not null default now(),

  -- Quando o servidor de push disse que este endereço morreu (404/410). A
  -- linha é apagada nesse caso; a coluna existe para o dia em que a limpeza
  -- virar preguiçosa em vez de imediata.
  falhou_em  timestamptz
);

-- Reassinar no mesmo navegador devolve o mesmo `endpoint`. Sem esta restrição,
-- cada visita ao painel acrescentaria uma linha e a pessoa receberia o mesmo
-- aviso N vezes — o caminho mais curto para alguém desligar a permissão.
create unique index if not exists assinaturas_de_push_endpoint_idx
  on public.assinaturas_de_push (endpoint);

-- O caminho de leitura é sempre "quem avisar nesta conta".
create index if not exists assinaturas_de_push_conta_idx
  on public.assinaturas_de_push (client_id);

-- ---------------------------------------------------------------------------
-- Fechado, como tudo que nasceu depois da 0041
-- ---------------------------------------------------------------------------
--
-- Só a `service_role` encosta. O caminho de escrita é uma Server Action que já
-- confere a sessão; `anon` e `authenticated` não têm o que fazer aqui, e
-- `revoke` explícito continua porque lista do que entra é melhor que lembrança
-- do que ficou de fora.
alter table public.assinaturas_de_push enable row level security;

revoke all on public.assinaturas_de_push from anon, authenticated;

comment on table public.assinaturas_de_push is
  'Para onde mandar push de handoff. Uma linha por navegador (o endpoint é a chave), não por pessoa: celular e computador devem tocar os dois. p256dh/auth são as chaves com que o navegador decifra — o corpo viaja cifrado e o servidor do fabricante não o lê. Ver 0045.';

notify pgrst, 'reload schema';
