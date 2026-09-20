-- 0075: quem entra no funil sozinho passa a ser escolha declarada.
--
-- ---------------------------------------------------------------------------
-- O que a regra fazia, e por que ela tinha que sair
-- ---------------------------------------------------------------------------
--
-- `acharQuadroPadrao` (0043) responde assim: quadro marcado, se houver; senão o
-- **mais antigo da conta**; senão `null`. A escolha do mais antigo foi feita por
-- um bom motivo, registrado lá: com cinco quadros em produção e nenhum marcado,
-- lead nenhum entrava em quadro nenhum, e por fora isso era indistinguível de
-- recurso quebrado.
--
-- Só que o remédio adivinha. "O primeiro que a pessoa criou" não é o mesmo que
-- "onde os leads devem cair", e as duas coisas divergem no dia em que alguém
-- cria um quadro de teste antes do quadro de verdade, ou arquiva o antigo. O
-- contato passa a entrar num funil que ninguém escolheu, e quem descobre é a
-- equipe, procurando o lead no lugar errado.
--
-- É a RB-12 da proposta de 19/set: "Nenhum fallback pode selecionar o quadro
-- mais antigo. Configuração inicial de empresa nova é não criar".
--
-- ---------------------------------------------------------------------------
-- Três valores, e não um booleano
-- ---------------------------------------------------------------------------
--
--   * `quadro_marcado` — entra no quadro que a conta marcou. Sem marcação, não
--     entra em nenhum, e a tela diz isso em vez de escolher sozinha;
--   * `nao_criar` — não entra em nada. É o default para **conta nova**, como a
--     RB-12 manda;
--   * `mais_antigo` — o comportamento de hoje, preservado nominalmente.
--
-- **O terceiro valor existe justamente para não mudar nada agora.** Retirar o
-- fallback de todas as contas existentes moveria, calado, o destino dos leads de
-- quem depende dele: quem tem um quadro só e nunca marcou nada continuaria
-- recebendo lead hoje e pararia amanhã, sem ninguém tocar em nada. Então a
-- migration escreve `mais_antigo` em **quem já existe** e deixa `nao_criar` como
-- default para quem nascer depois. A proposta chama isso de "converter
-- comportamento atual em opção revisável para empresas legadas", e é literalmente
-- o que o `update` abaixo faz.
--
-- Quem quiser sair do legado troca na tela, vendo o que vai mudar. Ninguém perde
-- automação por uma migration.

set search_path = public, extensions;

alter table public.clients
  add column if not exists entrada_no_funil text not null default 'nao_criar';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clients_entrada_no_funil_check'
  ) then
    alter table public.clients
      add constraint clients_entrada_no_funil_check
      check (entrada_no_funil in ('nao_criar', 'quadro_marcado', 'mais_antigo'));
  end if;
end $$;

comment on column public.clients.entrada_no_funil is
  'O que acontece com contato novo: nao_criar (default de conta nova, RB-12), quadro_marcado (o quadro com padrao = true) ou mais_antigo (o fallback legado da 0043, mantido como opcao revisavel). A lista espelha src/core/regras-de-entrada.ts.';

/*
 * A conversão do legado. `criado_em` é o corte porque toda conta que existe
 * neste instante vinha operando com o fallback ligado: preservá-lo é preservar o
 * comportamento que ela já tem, e é o oposto de uma decisão silenciosa.
 *
 * Conta criada depois desta migration nasce em `nao_criar` pelo default, e a
 * tela de quadros é quem oferece a escolha.
 */
update public.clients
   set entrada_no_funil = 'mais_antigo'
 where entrada_no_funil = 'nao_criar';

-- `clients` vive em `public`, exposto na Data API, e o servidor lê a coluna nova
-- pelo PostgREST. Sem o reload, `select entrada_no_funil` responde 404 até a
-- próxima reinicialização. O cache é o mesmo dos dois produtos: quem aplicar em
-- produção confere a Verandi depois.
notify pgrst, 'reload schema';
