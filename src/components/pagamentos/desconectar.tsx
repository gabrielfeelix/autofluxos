'use client'

import { useRouter } from 'next/navigation'
import { useConfirmar } from '@/components/design/confirmar'
import { acaoDesconectarMercadoPago } from '@/server/acoes-pagamentos'

/**
 * Desconectar pede confirmação: não apaga cobrança nenhuma, mas a partir dali
 * nenhuma nova sai, e um fluxo no meio de uma venda para de cobrar.
 */
export function DesconectarMercadoPago({ clienteId }: { clienteId: string }) {
  const router = useRouter()
  const { confirmar, dialogo } = useConfirmar()
  return (
    <>
      <button
        type="button"
        className="botao-secundario botao-sm"
        onClick={() =>
          confirmar({
            titulo: 'Desconectar o Mercado Pago?',
            descricao:
              'As cobranças feitas continuam aqui. Novas cobranças deixam de sair até você conectar de novo.',
            rotulo: 'Desconectar',
            tom: 'perigo',
            aoConfirmar: async () => {
              const r = await acaoDesconectarMercadoPago(clienteId)
              if (r.ok) router.refresh()
              return r
            },
          })
        }
      >
        Desconectar
      </button>
      {dialogo}
    </>
  )
}
