'use client'

import { useState } from 'react'
import { acaoCriarModeloDeCobranca } from '@/server/acoes-mensalidades'

/**
 * O botão que cria o modelo de lembrete de cobrança na Meta (0145). Depois do
 * toque, a tela já diz "em análise": a aprovação chega pelo webhook de status
 * e a próxima visita mostra aprovado.
 */
export function CriarModeloDeLembrete({ clienteId, deNovo = false }: { clienteId: string; deNovo?: boolean }) {
  const [estado, setEstado] = useState<'parado' | 'enviando' | 'enviado'>('parado')
  const [erro, setErro] = useState<string | null>(null)

  if (estado === 'enviado') return <p className="text-[12px] font-semibold text-ok">Enviado para a Meta. A aprovação costuma levar minutos.</p>

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        disabled={estado === 'enviando'}
        onClick={async () => {
          setEstado('enviando')
          setErro(null)
          try {
            const r = await acaoCriarModeloDeCobranca(clienteId)
            if (r.ok) setEstado('enviado')
            else {
              setErro(r.erro ?? 'A Meta não aceitou agora.')
              setEstado('parado')
            }
          } catch {
            setErro('Não foi possível enviar agora.')
            setEstado('parado')
          }
        }}
        className="botao-primario botao-sm w-fit"
      >
        {estado === 'enviando' ? 'Enviando…' : deNovo ? 'Enviar de novo' : 'Criar modelo de lembrete'}
      </button>
      {erro && (
        <p role="alert" className="text-[12px] leading-5 text-perigo">
          {erro}
        </p>
      )}
    </div>
  )
}
