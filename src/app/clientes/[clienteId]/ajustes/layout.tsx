import type { ReactNode } from 'react'
import { MenuDeAjustes } from '@/components/design/menu-de-ajustes'
import { liberaSecao } from '@/components/design/secoes-do-cliente'
import { acessoCompleto } from '@/server/permissoes'

/**
 * O menu de Configurações fica aqui pelo mesmo motivo da barra da conta: trocar
 * de uma tela de Configurações para outra é o caminho mais percorrido da seção,
 * e o menu que a pessoa acabou de clicar não pode sumir e voltar.
 *
 * Quem não pode abrir Configurações não vê o menu: a página mostra o motivo
 * sozinha, pela `ClienteShell`.
 */
export default async function LayoutDeAjustes({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ clienteId: string }>
}) {
  const { clienteId } = await params
  const acesso = await acessoCompleto(clienteId)
  if (!liberaSecao(acesso.regras, 'ajustes')) return children

  /*
   * Duas rolagens, uma por coluna: o menu das configurações fica parado
   * enquanto a tela ao lado rola, e rola sozinho se um dia não couber. Antes
   * os dois eram filhos da mesma rolagem do miolo e subiam juntos.
   */
  return (
    <div className="flex min-h-full flex-col md:h-full md:flex-row">
      <MenuDeAjustes clienteId={clienteId} />
      <div className="min-w-0 flex-1 md:h-full md:overflow-y-auto">{children}</div>
    </div>
  )
}
