-- 0139, três recursos da transmissão: texto comum para quem está na janela,
-- ritmo por hora e clique no link (docs/PLANO-9-DA-COLMEIA.md, itens 1, 2 e 4).
--
-- Só colunas novas, todas anuláveis ou com padrão, em duas tabelas do
-- AutoFluxos. Nenhum dado existente muda de sentido:
--
-- * `texto_livre_na_janela` nasce `false` nas linhas que já existem. Uma
--   transmissão que estiver no meio do envio quando isto for aplicado
--   termina do jeito que começou, como modelo. A tela liga a opção nas novas.
-- * `por_hora` nulo é o comportamento de hoje: tudo de uma vez, no ritmo
--   seguro do motor.
-- * `enviada_como` e `clicada_em` nulos nas linhas antigas querem dizer "não
--   se sabe", e a tela as conta como modelo e sem clique.
--
-- Só em `public`. Nada da Verandi é tocado, nenhuma função criada.

alter table public.transmissoes
  add column if not exists texto_livre_na_janela boolean not null default false,
  add column if not exists por_hora integer;

alter table public.transmissoes
  drop constraint if exists transmissoes_por_hora_positivo;
alter table public.transmissoes
  add constraint transmissoes_por_hora_positivo check (por_hora is null or por_hora between 1 and 100000);

comment on column public.transmissoes.texto_livre_na_janela is
  'Quem escreveu nas últimas 24h recebe o texto do modelo como mensagem comum, que custa a tarifa de serviço e não a de marketing (0139).';
comment on column public.transmissoes.por_hora is
  'Teto de envios por hora, só dentro do horário de atendimento da conta. Nulo: tudo de uma vez (0139).';

alter table public.transmissao_destinatarios
  add column if not exists enviada_como text,
  add column if not exists clicada_em timestamptz;

alter table public.transmissao_destinatarios
  drop constraint if exists transmissao_destinatarios_enviada_como_valida;
alter table public.transmissao_destinatarios
  add constraint transmissao_destinatarios_enviada_como_valida check (enviada_como is null or enviada_como in ('modelo', 'texto'));

comment on column public.transmissao_destinatarios.enviada_como is
  'Como saiu: modelo aprovado ou mensagem comum dentro da janela de 24h. Nulo nas linhas anteriores à 0139.';
comment on column public.transmissao_destinatarios.clicada_em is
  'Primeiro clique no link da transmissão, pelo redirecionamento assinado (0139).';
