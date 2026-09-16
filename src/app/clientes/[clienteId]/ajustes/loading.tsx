import { EsqueletoDoCliente } from '@/components/design/esqueleto-do-cliente'
import { EsqueletoDeTexto } from '@/components/design/esqueleto'
import { MenuDeAjustes } from '@/components/design/menu-de-ajustes'

/**
 * As Configurações enquanto vêm — **as duas barras já desenhadas**.
 *
 * Este `loading.tsx` cobre as treze telas de `ajustes/*`, e é por isso que o
 * `MenuDeAjustes` entra aqui de verdade e não em cinza: trocar entre elas é o
 * caminho mais percorrido da seção, e a barra da seção é justamente o que a
 * pessoa acabou de clicar. Ele não faz consulta nenhuma — só precisa do id.
 *
 * `ativa="inicio"` no menu porque daqui não dá para saber qual das treze está
 * vindo: `loading.tsx` não recebe o caminho. O item certo acende quando a tela
 * chega, e o menu já está no lugar — o que ele não faz é piscar de largura.
 */
export default async function Carregando({
  params,
}: {
  params: Promise<{ clienteId: string }>
}) {
  const { clienteId } = await params

  return (
    <EsqueletoDoCliente ativa="ajustes">
      <div className="flex min-h-full flex-col md:flex-row">
        <MenuDeAjustes clienteId={clienteId} ativa="inicio" />
        <div className="min-w-0 flex-1 px-4 pt-[26px] pb-[42px] md:px-[42px]">
          <EsqueletoDeTexto linhas={6} />
        </div>
      </div>
    </EsqueletoDoCliente>
  )
}
