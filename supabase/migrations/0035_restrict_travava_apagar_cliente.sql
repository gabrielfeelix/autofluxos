-- 0035 — o `restrict` das sequências e dos quadros travava apagar o cliente.
--
-- Correção da 0031 e da 0032, e o erro vale escrito porque ele é sedutor: em
-- cada um daqueles arquivos, `on delete restrict` era a escolha certa **para o
-- gesto que se estava protegendo** — ninguém deve apagar um fluxo que é passo
-- de sequência, nem uma etapa com gente dentro, por acidente.
--
-- O que passou batido é que a mesma chave é atravessada por um segundo caminho:
--
--     delete from clients
--       └─ cascade → flows
--            └─ RESTRICT ← sequencia_passos.flow_id     ✗ trava tudo
--
-- Ou seja, **apagar um cliente que tenha uma sequência com passo falhava**, com
-- uma violação de chave estrangeira crua na cara de quem clicou. O Postgres não
-- tem como expressar "recuse o gesto direto, mas ceda quando o pai está sendo
-- apagado" — `restrict` vale para os dois, e um deles era o errado.
--
-- Foi descoberto limpando clientes de teste, não em produção. O caminho de
-- descoberta importa: nenhum teste cobria "apagar cliente **depois** de criar
-- sequência", porque cada suíte limpa o que ela mesma criou e nenhuma tinha as
-- duas coisas juntas.
--
-- ---------------------------------------------------------------------------
-- A correção: `cascade` no banco, recusa no código
-- ---------------------------------------------------------------------------
--
-- É o padrão que o resto da casa já usa — `campanhas.flow_id` é `cascade` desde
-- a 0027, e quem recusa apagar um fluxo em uso é `apagarFluxo`, com uma frase
-- que diz onde ir desligar. A recusa boa sempre foi a do código; a do banco era
-- cinto por cima de suspensório, e o cinto prendeu a perna.
--
-- **As guardas do código continuam sendo a defesa de verdade**, e elas já
-- existem, todas com teste:
--
--   `apagarFluxo`   → recusa fluxo que é passo de sequência, e nomeia quais
--   `apagarEtiqueta`→ recusa etiqueta que dispara sequência, e nomeia quais
--   `apagarEtapa`   → recusa etapa com cartão dentro, e diz quantos são
--
-- O que se perde é a proteção contra alguém escrevendo `delete` na mão no
-- painel do Supabase. Isso é aceitável: quem faz isso está fora de todas as
-- guardas de qualquer jeito, e não é por uma chave estrangeira que ele vai
-- parar.

alter table public.sequencia_passos
  drop constraint if exists sequencia_passos_flow_id_fkey,
  add constraint sequencia_passos_flow_id_fkey
    foreign key (flow_id) references public.flows (id) on delete cascade;

alter table public.sequencias
  drop constraint if exists sequencias_etiqueta_id_fkey,
  add constraint sequencias_etiqueta_id_fkey
    foreign key (etiqueta_id) references public.etiquetas (id) on delete cascade;

alter table public.sequencias
  drop constraint if exists sequencias_coluna_id_fkey,
  add constraint sequencias_coluna_id_fkey
    foreign key (coluna_id) references public.quadro_colunas (id) on delete cascade;

alter table public.quadro_cartoes
  drop constraint if exists quadro_cartoes_coluna_id_fkey,
  add constraint quadro_cartoes_coluna_id_fkey
    foreign key (coluna_id) references public.quadro_colunas (id) on delete cascade;

comment on constraint sequencia_passos_flow_id_fkey on public.sequencia_passos is
  'cascade, e a recusa de apagar fluxo em uso mora em `apagarFluxo`. Ver 0035.';
comment on constraint quadro_cartoes_coluna_id_fkey on public.quadro_cartoes is
  'cascade, e a recusa de apagar etapa com gente dentro mora em `apagarEtapa`. Ver 0035.';

notify pgrst, 'reload schema';
