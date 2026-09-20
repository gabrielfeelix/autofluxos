-- ---------------------------------------------------------------------------
-- 0084 — o objetivo da conta, e o CRM como recurso que se liga
-- ---------------------------------------------------------------------------
--
-- O defeito medido
-- ---------------------------------------------------------------------------
--
-- Os "primeiros passos" da tela inicial (`app/clientes/[clienteId]/page.tsx`,
-- `passosDaConta`) cobravam cinco coisas de toda conta, e a quinta era
-- "Organizar no funil". Quem abriu a conta para atender no WhatsApp com a
-- própria equipe terminava o que queria e a tela seguia dizendo que faltava um
-- passo, para sempre. Barra que nunca fecha ensina a ignorar a barra, e a partir
-- daí também se ignora o aviso de canal desligado.
--
-- O §4.2 da proposta é explícito: "empresa nova começa com
-- chatbot/inbox/contatos; CRM fica disponível em Configurações → Recursos, com
-- explicação e botão Ativar CRM para gestores".
--
-- O que esta migration acrescenta, e o que ela deliberadamente não faz
-- ---------------------------------------------------------------------------
--
-- Duas colunas em `public.clients`, as duas com default:
--
--   * `objetivo`   — para que a empresa contratou. Decide o que o onboarding
--                    cobra. Lista fechada no check, como `distribuicao` (0064).
--   * `crm_ativo`  — o CRM aparece no menu desta conta?
--
-- **`crm_ativo` nasce `true`, e isso é a decisão mais importante daqui.**
--
-- O default natural de um recurso opcional seria `false`, e aqui ele estaria
-- errado: as 6 contas que já existem usam quadros hoje, e nascer `false`
-- esconderia, no deploy, a tela que alguém usa todo dia, sem ninguém ter
-- pedido. É o §4.2 outra vez: "empresa atual que usa quadros mantém CRM visível
-- na migração".
--
-- Conta nova não herda esse `true` por acidente: quem cria conta passa o
-- objetivo, e `nasceComCrm` (core/objetivo-da-conta.ts) grava `false` para
-- quem não escolheu "vender". O default cobre o que já existe, não o que vem.
--
-- E `mostraCrm` ainda considera `temQuadro`, de propósito: cinto e suspensório
-- para a conta que, por qualquer caminho, chegar a `false` com quadro montado.
--
-- **Nenhum dado é reescrito.** `add column ... default` não reescreve a tabela
-- desde o Postgres 11: o valor fica no catálogo. As 6 contas acordam com
-- `objetivo = 'atender'` e `crm_ativo = true`, que é exatamente como elas se
-- comportam hoje.
--
-- Por que `objetivo` tem default e não é anulável
-- ---------------------------------------------------------------------------
--
-- Anulável diria "ninguém respondeu", que é informação verdadeira e que este
-- produto normalmente preserva (RB-06). Aqui ela não paga: quem não respondeu
-- precisa de *algum* conjunto de passos na tela, e o nulo obrigaria cada leitor
-- a escolher um padrão por conta própria. O padrão é `atender` porque é o único
-- que não cobra nada além do canal: falhar para o lado de cobrar menos é o
-- certo quando o custo do erro é uma tela que mente sobre estar incompleta.
--
-- Aditiva: duas colunas com default em `public.clients`, nenhuma tabela nova,
-- nenhuma linha reescrita. Roda em `public`, qualificado, sem tocar
-- `app_verandi`. Ver docs/BANCO-COMPARTILHADO.md.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- O objetivo
-- ---------------------------------------------------------------------------

alter table public.clients
  add column if not exists objetivo text not null default 'atender';

-- O check vem **depois** da coluna, quando toda linha já tem o default válido.
-- É a ordem que a 0064 registrou para `clients.distribuicao`, e o motivo é o
-- mesmo: check criado junto de coluna nova sobre tabela com dado é a única
-- forma de a migration falhar por algo que ela mesma acabou de garantir.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clients_objetivo_check'
  ) then
    alter table public.clients
      add constraint clients_objetivo_check
      check (objetivo in ('atender', 'automatizar', 'vender'));
  end if;
end $$;

comment on column public.clients.objetivo is
  'Para que a empresa contratou: atender, automatizar ou vender. Decide quais '
  'passos o onboarding cobra. Ver core/objetivo-da-conta.ts.';

-- ---------------------------------------------------------------------------
-- O CRM como recurso
-- ---------------------------------------------------------------------------

alter table public.clients
  add column if not exists crm_ativo boolean not null default true;

comment on column public.clients.crm_ativo is
  'O CRM aparece no menu desta conta? Default true para NAO esconder a tela de '
  'quem ja usa quadros (proposta 4.2). Conta nova recebe o valor de '
  'nasceComCrm(objetivo). Desligar e preferencia de interface: nao apaga dado, '
  'nao suspende integracao e nao revoga acesso.';

-- ---------------------------------------------------------------------------
-- O cache do PostgREST
-- ---------------------------------------------------------------------------
--
-- `public` é schema exposto na Data API e o servidor lê `clients` pelo
-- PostgREST: sem recarregar, `select('objetivo, crm_ativo')` responde 400 até a
-- próxima reinicialização. O cache é o mesmo dos dois produtos, e o reload é
-- breve: o que o runbook proíbe é mexer em *Exposed schemas* pela UI, não
-- recarregar. Conferir a Verandi depois, como manda o BANCO-COMPARTILHADO.

notify pgrst, 'reload schema';
