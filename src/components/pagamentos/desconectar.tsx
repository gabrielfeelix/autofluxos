'use client'

import { useRouter } from 'next/navigation'
import { NOME_DO_GATEWAY, type Gateway } from '@/channels/pagamento'
import { useConfirmar } from '@/components/design/confirmar'
import { acaoDesconectarPagamento } from '@/server/acoes-pagamentos'

/**
 * Desconectar pede confirmação: não apaga cobrança nenhuma, mas a partir dali
 * nenhuma nova sai, e um fluxo no meio de uma venda para de cobrar.
 */
export function DesconectarPagamento({ clienteId, gateway }: { clienteId: string; gateway: Gateway }) {
  const router = useRouter()
  const { confirmar, dialogo } = useConfirmar()
  const nome = NOME_DO_GATEWAY[gateway]
  return (
    <>
      <button
        type="button"
        className="botao-secundario botao-sm"
        onClick={() =>
          confirmar({
            titulo: `Desconectar o ${nome}?`,
            descricao:
              'As cobranças feitas continuam aqui. Novas cobranças deixam de sair até você conectar de novo.',
            rotulo: 'Desconectar',
            tom: 'perigo',
            aoConfirmar: async () => {
              const r = await acaoDesconectarPagamento(clienteId, gateway)
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
