'use client'

import { useState, useTransition } from 'react'
import { acaoReordenarFluxos } from '@/server/acoes'

/**
 * Subir e descer uma automação na lista.
 *
 * **Dois botões, e não arrastar** — a mesma decisão que `MoverFluxo` já tinha
 * tomado, pelo mesmo motivo: a lista pagina, tem seção por pasta e vive dentro
 * de um acordeão. Arrastar aí é um alvo pequeno, e no celular não existe. Dois
 * botões funcionam com teclado, com leitor de tela e com o polegar.
 *
 * A ação recebe **a lista inteira** na ordem nova, e não "este subiu um": a
 * tela já sabe o resultado do clique, e mandar a lista fecha a porta para as
 * duas metades discordarem sobre qual era a posição anterior.
 */
export function OrdenarFluxo({
  clienteId,
  fluxoId,
  idsDoGrupo,
}: {
  clienteId: string
  fluxoId: string
  /** Os ids do grupo, na ordem em que estão na tela agora. */
  idsDoGrupo: string[]
}) {
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  const posicao = idsDoGrupo.indexOf(fluxoId)
  const primeiro = posicao <= 0
  const ultimo = posicao === idsDoGrupo.length - 1

  function mover(direcao: -1 | 1) {
    const destino = posicao + direcao
    if (posicao < 0 || destino < 0 || destino >= idsDoGrupo.length) return

    /*
     * A troca sai do array em vez de indexar os dois lados: com
     * `noUncheckedIndexedAccess`, `nova[destino]` é `string | undefined` para o
     * TypeScript, e o destino já foi conferido acima.
     */
    const nova = idsDoGrupo.filter((id) => id !== fluxoId)
    nova.splice(destino, 0, fluxoId)

    setErro(null)
    comecar(async () => {
      const r = await acaoReordenarFluxos(clienteId, nova)
      if (!r.ok) setErro(r.erro ?? 'não deu para reordenar')
    })
  }

  const botao =
    'grid h-5 w-5 place-items-center rounded text-dim transition ' +
    'hover:bg-white/10 hover:text-soft disabled:opacity-25 disabled:hover:bg-transparent'

  return (
    <span className="inline-flex flex-col items-center gap-px">
      <button
        type="button"
        aria-label="Subir na lista"
        title="Subir na lista"
        className={botao}
        disabled={rodando || primeiro}
        onClick={() => mover(-1)}
      >
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden="true">
          <path d="M6 3l4 5H2z" fill="currentColor" />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Descer na lista"
        title="Descer na lista"
        className={botao}
        disabled={rodando || ultimo}
        onClick={() => mover(1)}
      >
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden="true">
          <path d="M6 9L2 4h8z" fill="currentColor" />
        </svg>
      </button>
      {erro && (
        <span role="alert" className="text-[10.5px] text-rose-300">
          {erro}
        </span>
      )}
    </span>
  )
}
