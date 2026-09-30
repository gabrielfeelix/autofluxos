'use client'

import { useState, useTransition } from 'react'
import { acaoReenviarMensagem } from '@/server/acoes'

/**
 * "envio não confirmado" com o botão de tentar de novo ao lado.
 *
 * Otimista no sentido que importa: o rótulo troca na hora para "enviando…" e,
 * dando certo, para "enviado", sem esperar a transcrição buscar de novo. O erro
 * aparece ali mesmo, embaixo da bolha, que é onde quem atende está olhando.
 */
export function EnvioNaoConfirmado({
  clienteId,
  contatoId,
  mensagemId,
}: {
  clienteId: string
  contatoId: string
  mensagemId: string
}) {
  const [estado, setEstado] = useState<'parado' | 'enviado'>('parado')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, iniciar] = useTransition()

  if (estado === 'enviado') {
    return <span className="ml-2 text-[11px] font-semibold text-ok">enviado</span>
  }

  return (
    <>
      <span className="ml-2 text-[11px] font-semibold text-soft">envio não confirmado</span>
      <button
        type="button"
        disabled={enviando}
        onClick={() =>
          iniciar(async () => {
            setErro(null)
            const r = await acaoReenviarMensagem(clienteId, contatoId, mensagemId)
            if (r.ok) setEstado('enviado')
            else setErro(r.erro ?? 'não deu para enviar')
          })
        }
        className="ml-2 rounded-md border border-current/30 px-1.5 py-0.5 text-[11px] font-semibold underline-offset-2 hover:underline disabled:opacity-60"
      >
        {enviando ? 'enviando…' : 'Tentar de novo'}
      </button>
      {erro && <span className="mt-1 block text-[11px] text-aviso">{erro}</span>}
    </>
  )
}
