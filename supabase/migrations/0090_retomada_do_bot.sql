-- A conversa volta ao bot sozinha depois do atendimento humano parado
-- ============================================================================
--
-- O defeito que isto conserta estava escrito em PLANO-16-SET-PRODUTO-E-PRECO,
-- seção 5, e continuou valendo por seis dias: *"nada tira uma conversa do
-- estado `humano` sozinho. O consultor atende, esquece de fechar, e aquele
-- contato fica com o bot mudo para sempre, sem erro nenhum para investigar."*
--
-- Em 22/set/2026 eram quatro sessões presas em produção, duas delas da MGM,
-- paradas desde 03 e 04/set. O sintoma que chegou até aqui foi "mandei mensagem
-- para o número da MGM e a automação não respondeu".
--
-- ----------------------------------------------------------------------------
-- Por que o interruptor é separado do prazo
-- ----------------------------------------------------------------------------
--
-- `retomar_bot_ativo` e `retomar_bot_minutos` poderiam ser uma coluna só, com
-- `null` significando desligado. Não são, e a razão é a tela: desligar e voltar
-- a ligar não pode apagar o prazo que a pessoa escolheu. Com uma coluna só,
-- desligar joga fora "2 horas" e religar devolve um campo vazio para preencher
-- de novo, o que faz qualquer um evitar mexer no interruptor.
--
-- ----------------------------------------------------------------------------
-- Por que nasce DESLIGADA, mesmo sendo o conserto
-- ----------------------------------------------------------------------------
--
-- `retomar_bot_ativo` é `false` por padrão. Isto muda o que acontece em
-- **conversa viva de produção**, e uma migration não pode mudar o comportamento
-- de nenhuma conta no dia em que roda. Quem liga é o dono da conta, na tela, com
-- o texto de retomada na frente dele.
--
-- 120 minutos é o padrão do prazo porque é o que foi conversado ("se o humano
-- demorar 2h pra responder"), e porque ele só passa a valer quando alguém ligar.
--
-- ----------------------------------------------------------------------------
-- O que esta migration NÃO faz
-- ----------------------------------------------------------------------------
--
-- Não destrava nenhuma sessão que já está presa. Conserto de dado é escrita em
-- conversa viva e vai separado, com autorização explícita, como manda o
-- AGENTS.md. Ligado o interruptor, a primeira passada pega as presas sozinha.
--
-- Não toca em `sessions`, `messages` nem em nada da Verandi
-- (`docs/BANCO-COMPARTILHADO.md`): são duas colunas novas em `public.clients`,
-- ambas com default, então nenhuma linha existente muda de valor.

set search_path = public, extensions;

alter table public.clients
  add column if not exists retomar_bot_ativo    boolean not null default false,
  add column if not exists retomar_bot_minutos  integer not null default 120,
  add column if not exists retomar_bot_mensagem text;

comment on column public.clients.retomar_bot_ativo is
  'A conversa parada em atendimento humano volta ao bot sozinha? Nasce false: ligar é decisão do dono, na tela.';

comment on column public.clients.retomar_bot_minutos is
  'Minutos sem a equipe falar até a conversa voltar ao bot. Teto de 1440, que é a janela do WhatsApp.';

comment on column public.clients.retomar_bot_mensagem is
  'O que o bot diz ao reassumir. NULL usa o texto padrão de core/retomada.ts.';

-- O varredor pergunta "quais sessões estão em atendimento humano?" a cada
-- passada. Sem índice isso é varredura da tabela inteira de sessões, e ela só
-- cresce. Parcial porque `humano` é a minoria das linhas e é a única que
-- interessa: o índice fica pequeno e continua pequeno.
create index if not exists sessions_humano_idx
  on public.sessions (atualizado_em)
  where status = 'humano';
