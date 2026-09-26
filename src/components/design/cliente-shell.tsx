import type { ReactNode } from 'react'
import { acessoCompleto } from '@/server/permissoes'
import { pode } from '@/core/permissoes'
import type { Cliente } from '@/server/repos/clientes'
import { crmVisivel, nichoDaConta } from '@/server/repos/recursos'
import { atrasoDeRevisao } from '@/server/atraso-de-revisao'
import { type AbaDoCliente, liberaSecao, rotuloDaSecao } from './secoes-do-cliente'
import { FunilDesligado, SemAcesso } from './sem-acesso'

/**
 * O miolo das telas do cliente, e a conferência de quem pode ver a seção.
 *
 * **A barra lateral não mora mais aqui.** Ela foi para
 * `app/clientes/[clienteId]/layout.tsx` (`BarraDoCliente` + `MolduraDoCliente`),
 * porque aqui ela era desenhada de novo a cada página e piscava em todo clique.
 * O nome e a assinatura ficaram, para as telas não mudarem.
 *
 * **A conferência continua aqui, e não no layout.** Layout não roda de novo na
 * navegação, e a documentação do Next é clara: conferir acesso só nele deixa a
 * página seguinte passar sem pergunta. Esta função roda em toda página. O
 * editor de fluxo, que não usa este miolo, chama a mesma conferência por conta
 * própria.
 *
 * `acessoCompleto` faz `exigirAcessoAoCliente` por dentro e traz as regras de
 * capacidade, que decidem a tela de sem acesso (E7).
 */

export type { AbaDoCliente } from './secoes-do-cliente'

export async function ClienteShell({
  cliente,
  ativa,
  children,
}: {
  cliente: Cliente
  ativa: AbaDoCliente
  children: ReactNode
}) {
  await atrasoDeRevisao()
  const acesso = await acessoCompleto(cliente.id)
  /*
   * O CRM é opcional (§4.2), e quem responde é `crmVisivel`: ele considera o
   * interruptor da conta **e** a existência de funil, para não esconder da noite
   * para o dia a tela de quem já usa quadros.
   */
  // Vendas é o resultado dos negócios: some e desliga junto com eles.
  const dependeDoCrm = ativa === 'quadros' || ativa === 'vendas'
  const mostraCrm = dependeDoCrm ? await crmVisivel(cliente.id) : true

  /*
   * A rota direta de uma seção que a pessoa não pode usar mostra o motivo, e
   * não a tela (E7). Funil com o CRM desligado é outra resposta (E8): não é
   * falta de acesso, é escolha da conta.
   */
  const liberada = liberaSecao(acesso.regras, ativa)
  // O nome da seção Comércio depende do ramo; as outras não pagam a consulta.
  const nicho = !liberada && ativa === 'loja' ? await nichoDaConta(cliente.id) : null
  const conteudo = !liberada ? (
    <SemAcesso clienteId={cliente.id} oQue={rotuloDaSecao(ativa, nicho)} />
  ) : dependeDoCrm && !mostraCrm ? (
    <FunilDesligado
      clienteId={cliente.id}
      podeLigar={pode(acesso.regras, 'configurar_operacao', 'todos')}
    />
  ) : (
    children
  )

  /*
   * A moldura **não** escreve título de página. Quem diz onde você está é o
   * item aceso na barra; quem dá nome à página é a página.
   */
  return <div className="app-page-enter flex min-h-full flex-col md:h-full">{conteudo}</div>
}
