'use client'

import { useState, useTransition } from 'react'
import { acaoTranscreverAudio } from '@/server/acoes-transcricao'

/**
 * O botão de transcrever, embaixo do player de áudio.
 *
 * ---------------------------------------------------------------------------
 * Por que um botão e não automático
 * ---------------------------------------------------------------------------
 *
 * Dois motivos, e os dois importam.
 *
 * **Custo.** Transcrever é uma chamada a modelo. Automático, cada rolagem de
 * uma conversa com trinta áudios seria trinta chamadas, e a conta chegaria sem
 * ninguém ter pedido nada.
 *
 * **Privacidade.** Enquanto a chave é a da 4YU no free tier, o Google treina
 * modelo com o que passa por ela. Voz identifica pessoa. O clique é de quem
 * atende e sabe o que está mandando para fora; automático tiraria essa decisão
 * de quem a estava tomando. Está escrito em `server/transcrever-audio.ts`, e a
 * dica do botão diz a versão curta.
 *
 * Transcrito uma vez, fica guardado: o botão some e o texto vem junto da
 * conversa nas próximas aberturas.
 */
export function Transcricao({
  clienteId,
  contatoId,
  mensagemId,
  inicial,
}: {
  clienteId: string
  contatoId: string
  mensagemId: string
  /** O que já está guardado no banco. `null` = ninguém pediu ainda. */
  inicial: string | null
}) {
  const [texto, setTexto] = useState(inicial)
  const [erro, setErro] = useState<string | null>(null)
  const [indo, comecar] = useTransition()

  if (texto) {
    return (
      <span className="mt-1 block border-l-2 border-line pl-2 font-texto text-[13px] leading-[1.45] text-muted italic">
        {texto}
      </span>
    )
  }

  return (
    <span className="mt-0.5 block">
      <button
        type="button"
        disabled={indo}
        title="O áudio é enviado ao Gemini para virar texto"
        onClick={() => {
          setErro(null)
          comecar(async () => {
            const r = await acaoTranscreverAudio(clienteId, contatoId, mensagemId)
            if (!r.ok) {
              setErro(r.erro ?? 'não deu para transcrever')
              return
            }
            setTexto(r.texto ?? '')
          })
        }}
        className="rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-semibold text-soft transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
      >
        {indo ? 'transcrevendo…' : 'transcrever'}
      </button>

      {erro && (
        <span role="alert" className="ml-1.5 text-[11px] text-perigo">
          {erro}
        </span>
      )}
    </span>
  )
}
