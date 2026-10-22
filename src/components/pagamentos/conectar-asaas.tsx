'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { acaoConectarAsaas } from '@/server/acoes-pagamentos'

/**
 * A chave de API do Asaas, colada pelo dono. O Asaas não tem login como o
 * Mercado Pago: a chave é criada lá, em Integrações, e entra aqui uma vez.
 *
 * O campo abre só depois do clique: um campo de senha aberto no cartão, sem
 * ninguém ter pedido, parece que a tela está cobrando uma credencial.
 * A chave entra e não sai: depois de salva, a tela só mostra de quem é a conta.
 */
export function ConectarAsaas({ clienteId, trocar = false }: { clienteId: string; trocar?: boolean }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [chave, setChave] = useState('')
  const [erro, setErro] = useState('')
  const [pendente, comecar] = useTransition()

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={trocar ? 'botao-secundario botao-sm' : 'botao-primario botao-sm'}
      >
        {trocar ? 'Trocar a chave' : 'Conectar com chave de API'}
      </button>
    )
  }

  return (
    <form
      className="flex w-full flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        comecar(async () => {
          setErro('')
          const r = await acaoConectarAsaas(clienteId, chave)
          if (!r.ok) {
            setErro(r.erro ?? 'Não foi possível conectar.')
            return
          }
          setChave('')
          setAberto(false)
          router.refresh()
        })
      }}
    >
      <input
        name="chave"
        type="password"
        autoComplete="off"
        autoFocus
        required
        value={chave}
        onChange={(e) => setChave(e.target.value)}
        placeholder="$aact_prod_..."
        aria-label="Chave de API do Asaas"
        className="app-field w-full px-3 py-2 text-[12.5px]"
      />
      <p className="text-[11px] leading-4 text-dim">
        No Asaas: Integrações, Chaves de API, Gerar chave. Depois de salva, ela não volta para a tela.
      </p>
      {erro && (
        <p role="alert" className="text-[11.5px] text-perigo">
          {erro}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pendente || chave.trim() === ''} className="botao-primario botao-sm">
          {pendente ? 'Conferindo a chave...' : 'Conectar'}
        </button>
        <button
          type="button"
          onClick={() => {
            setAberto(false)
            setErro('')
          }}
          className="botao-secundario botao-sm"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
