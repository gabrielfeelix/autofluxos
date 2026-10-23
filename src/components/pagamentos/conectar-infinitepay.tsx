'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { acaoConectarInfinitePay } from '@/server/acoes-pagamentos'

/**
 * A InfiniteTag do dono. Não é segredo, e por isso o campo é de texto: é o
 * mesmo `$` que ele passa para receber um Pix. A InfinitePay não tem chave
 * nem login para parceiro; a tag é tudo o que a API pede.
 */
export function ConectarInfinitePay({ clienteId, trocar = false }: { clienteId: string; trocar?: boolean }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [tag, setTag] = useState('')
  const [erro, setErro] = useState('')
  const [pendente, comecar] = useTransition()

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className={trocar ? 'botao-secundario botao-sm' : 'botao-primario botao-sm'}>
        {trocar ? 'Trocar a InfiniteTag' : 'Conectar com a InfiniteTag'}
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
          const r = await acaoConectarInfinitePay(clienteId, tag)
          if (!r.ok) {
            setErro(r.erro ?? 'Não foi possível conectar.')
            return
          }
          setTag('')
          setAberto(false)
          router.refresh()
        })
      }}
    >
      <input
        name="tag"
        autoComplete="off"
        autoFocus
        required
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        placeholder="Exemplo: $studiomgm"
        aria-label="InfiniteTag da empresa"
        className="app-field w-full px-3 py-2 text-[12.5px]"
      />
      <p className="text-[11px] leading-4 text-dim">
        No app da InfinitePay, a InfiniteTag aparece no seu perfil, com $ na frente. Confira: é para ela que o dinheiro vai.
      </p>
      {erro && (
        <p role="alert" className="text-[11.5px] text-perigo">
          {erro}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pendente || tag.trim() === ''} className="botao-primario botao-sm">
          {pendente ? 'Conectando...' : 'Conectar'}
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
