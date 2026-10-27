'use client'

import { useState } from 'react'
import type { StatusDePedido } from '@/core/pedidos'
import { acaoEntregador } from '@/server/acoes-entregador'

/**
 * Os dois toques do motoboy, otimistas: o botão muda na hora e volta se o
 * servidor recusar. Depois de "Entreguei", só a confirmação.
 */
export function BotoesDoEntregador({ token, inicial }: { token: string; inicial: StatusDePedido }) {
  const [status, setStatus] = useState(inicial)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function tocar(passo: 'saiu' | 'entregue') {
    const antes = status
    setStatus(passo)
    setEnviando(true)
    setErro(null)
    const r = await acaoEntregador(token, passo).catch(() => ({ ok: false as const, erro: 'Sem conexão. Tente de novo.' }))
    setEnviando(false)
    if (!r.ok) {
      setStatus(antes)
      setErro(r.erro)
      return
    }
    setStatus(r.status)
  }

  if (status === 'cancelado') {
    return (
      <p className="rounded-[14px] bg-surface-strong px-4 py-3.5 text-center text-[14px] font-semibold text-soft">
        Este pedido foi cancelado. Fale com a loja.
      </p>
    )
  }

  if (status === 'entregue') {
    return (
      <p role="status" className="rounded-[14px] bg-emerald-400/[0.12] px-4 py-4 text-center text-[15px] font-bold text-ok">
        ✓ Entrega registrada. Obrigado!
      </p>
    )
  }

  const saiu = status === 'saiu'
  return (
    <div className="flex flex-col gap-3">
      {saiu ? (
        <p role="status" className="rounded-[14px] bg-primary-weak px-4 py-3 text-center text-[13.5px] font-semibold text-primary">
          Saída registrada. Ao entregar, toque em Entreguei.
        </p>
      ) : (
        <button
          type="button"
          disabled={enviando}
          onClick={() => void tocar('saiu')}
          className="h-14 rounded-[14px] bg-primary text-[16px] font-bold text-white transition active:scale-[0.99] disabled:opacity-70"
        >
          Saí para entregar
        </button>
      )}
      <button
        type="button"
        disabled={enviando}
        onClick={() => void tocar('entregue')}
        className={`h-14 rounded-[14px] text-[16px] font-bold transition active:scale-[0.99] disabled:opacity-70 ${
          saiu ? 'bg-primary text-white' : 'border border-line bg-panel text-ink'
        }`}
      >
        Entreguei
      </button>
      {erro && (
        <p role="alert" className="text-center text-[13px] leading-5 text-perigo">
          {erro}
        </p>
      )}
    </div>
  )
}
