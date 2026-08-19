-- 0033 — `mover_cartao` passa a devolver conjunto, e não linha.
--
-- Correção da 0032, e a armadilha vale escrita porque ela não é óbvia e não
-- aparece em teste de tipo nenhum:
--
-- **Função que devolve um tipo composto não devolve `null` pelo PostgREST.**
-- Quando o `update` não casa nada, o plpgsql devolve um composto nulo, e o
-- PostgREST o serializa como um objeto com **todos os campos em `null`**:
--
--     {"id":null,"quadro_id":null,"coluna_id":null,"contact_id":null,...}
--
-- Do lado do JavaScript isso é um objeto, e portanto **verdadeiro**. O
-- `return data ? { ok: true } : ...` do repositório respondia "movi" para toda
-- tentativa que a função tinha recusado — inclusive as duas que ela existe para
-- recusar: cartão de outra conta, e etapa de outro quadro. Foram os testes de
-- isolamento que pegaram, e é exatamente para isso que eles existem.
--
-- `returns setof` resolve na fonte: nada casou vira `[]`, que é falso de um
-- jeito que não depende de ninguém lembrar desta linha. Consertar só no
-- TypeScript deixaria a armadilha armada para o próximo que chamasse a função.
--
-- Trocar o tipo de retorno exige `drop` — `create or replace` recusa. Como a
-- assinatura de parâmetros é a mesma, o `drop` é seguro: nada além do
-- `repos/quadros.ts` chama esta função.

drop function if exists public.mover_cartao(uuid, uuid, uuid);

create function public.mover_cartao(
  p_cartao_id uuid,
  p_coluna_id uuid,
  p_client_id uuid
)
returns setof public.quadro_cartoes
language sql
security invoker
set search_path = ''
as $$
  -- A etapa de destino precisa ser **do mesmo quadro** do cartão. O id chega da
  -- tela, e sem esta conferência arrastar para o id de uma coluna de outro
  -- quadro moveria o cartão para fora do próprio funil.
  --
  -- O relógio da etapa **só reinicia quando a etapa muda de verdade**: arrastar
  -- o cartão de volta para onde ele já estava é engano de mão, e zerar a espera
  -- por causa dele apagaria justamente o número que denuncia o esquecimento.
  update public.quadro_cartoes c
     set coluna_id = p_coluna_id,
         entrou_na_coluna_em =
           case when c.coluna_id = p_coluna_id then c.entrou_na_coluna_em else now() end
   where c.id = p_cartao_id
     and c.client_id = p_client_id
     and exists (
       select 1 from public.quadro_colunas k
        where k.id = p_coluna_id and k.quadro_id = c.quadro_id
     )
  returning c.*;
$$;

revoke execute on function public.mover_cartao(uuid, uuid, uuid) from anon, authenticated;

notify pgrst, 'reload schema';
