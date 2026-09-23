'use client'

import { useCallback, useRef, useState, useTransition, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AvisoFlutuante } from '@/components/design/aviso-flutuante'
import { acaoReordenarFluxos } from '@/server/acoes'

type Arrasto = {
  id: string
  /** Onde a linha entra se soltar agora: índice na lista **sem** ela. */
  alvo: number
  /** O cartão que flutua sob o ponteiro. */
  x: number
  y: number
  largura: number
}

/**
 * As linhas de uma pasta, reordenáveis pela alça de pontinhos à esquerda.
 *
 * Substitui o "Subir na lista" e o "Descer na lista" do menu `⋯`.
 *
 * **A lista não se mexe durante o arrasto.** A linha "sai" da lista (fica
 * apagada no lugar dela e um cartão com o nome flutua sob o ponteiro), e uma
 * linha azul entre as linhas mostra onde ela entra se soltar agora. A ordem só
 * muda, e só é gravada, ao soltar. Reordenar ao vivo fazia a lista pular a
 * cada movimento, e o Gabriel pediu o marcador.
 *
 * Ponteiro, e não o arrastar nativo do HTML: o nativo não funciona no toque. O
 * arrasto escuta a janela (não a alça) para o `pointerup` chegar mesmo fora
 * dela. A alça também é botão: com o foco nela, as setas movem a linha.
 *
 * Com a lista filtrada a alça some (`arrastavel` falso): arrastar entre linhas
 * que não estão lado a lado na ordem de verdade não teria um resultado claro.
 */
export function ListaOrdenavel({
  clienteId,
  itens,
  arrastavel,
  classeDaLinha,
}: {
  clienteId: string
  itens: { id: string; nome: string; conteudo: ReactNode }[]
  arrastavel: boolean
  classeDaLinha: string
}) {
  const idsDaProp = itens.map((item) => item.id).join(',')
  const [ordem, setOrdem] = useState<string[]>(() => itens.map((item) => item.id))
  const [base, setBase] = useState(idsDaProp)
  const [arrasto, setArrasto] = useState<Arrasto | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [, comecar] = useTransition()
  const linhas = useRef(new Map<string, HTMLLIElement>())
  // Espelho do arrasto para os ouvintes da janela, que não veem estado novo.
  const arrastoAgora = useRef<Arrasto | null>(null)
  const sumir = useCallback(() => setErro(null), [])

  // O servidor mandou outra lista (gravou, ou alguém mudou): ela vale.
  if (base !== idsDaProp) {
    setBase(idsDaProp)
    setOrdem(itens.map((item) => item.id))
  }

  const porId = new Map(itens.map((item) => [item.id, item]))

  function gravar(nova: string[], anterior: string[]) {
    if (nova.join(',') === anterior.join(',')) return
    setOrdem(nova)
    comecar(async () => {
      const r = await acaoReordenarFluxos(clienteId, nova)
      if (!r.ok) {
        setOrdem(anterior)
        setErro(r.erro ?? 'não deu para reordenar')
      }
    })
  }

  function atualizar(proximo: Arrasto | null) {
    arrastoAgora.current = proximo
    setArrasto(proximo)
  }

  function comecarArrasto(evento: React.PointerEvent, id: string) {
    if (evento.button !== 0) return
    evento.preventDefault()
    const anterior = ordem
    const outros = anterior.filter((outro) => outro !== id)
    const linha = linhas.current.get(id)?.getBoundingClientRect()
    const deslocamento = linha ? evento.clientY - linha.top : 0
    const x = linha?.left ?? evento.clientX

    /** Quantas linhas (fora a arrastada) ficam acima do ponteiro. */
    const alvoEm = (y: number) => {
      let alvo = 0
      for (const outro of outros) {
        const caixa = linhas.current.get(outro)?.getBoundingClientRect()
        if (caixa && y > caixa.top + caixa.height / 2) alvo++
      }
      return alvo
    }

    atualizar({ id, alvo: anterior.indexOf(id), x, y: evento.clientY - deslocamento, largura: linha?.width ?? 320 })

    const mover = (e: PointerEvent) => {
      const atual = arrastoAgora.current
      if (!atual) return
      atualizar({ ...atual, alvo: alvoEm(e.clientY), y: e.clientY - deslocamento })
    }
    const terminar = (soltou: boolean) => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', aoSoltar)
      window.removeEventListener('pointercancel', aoCancelar)
      const final = arrastoAgora.current
      atualizar(null)
      if (!soltou || !final) return
      const nova = [...outros]
      nova.splice(final.alvo, 0, id)
      gravar(nova, anterior)
    }
    const aoSoltar = () => terminar(true)
    const aoCancelar = () => terminar(false)
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', aoSoltar)
    window.addEventListener('pointercancel', aoCancelar)
  }

  function porTeclado(evento: React.KeyboardEvent, id: string) {
    if (evento.key !== 'ArrowUp' && evento.key !== 'ArrowDown') return
    evento.preventDefault()
    const posicao = ordem.indexOf(id)
    const destino = posicao + (evento.key === 'ArrowUp' ? -1 : 1)
    if (destino < 0 || destino >= ordem.length) return
    const nova = ordem.filter((outro) => outro !== id)
    nova.splice(destino, 0, id)
    gravar(nova, ordem)
  }

  /*
    Onde desenhar a linha azul. `alvo` conta a lista sem a arrastada; soltar no
    mesmo lugar de onde saiu não muda nada, e aí não há linha.
  */
  const outrosAgora = arrasto ? ordem.filter((id) => id !== arrasto.id) : []
  const semMudanca = arrasto !== null && arrasto.alvo === ordem.indexOf(arrasto.id)
  const linhaAntesDe = arrasto && !semMudanca ? (outrosAgora[arrasto.alvo] ?? null) : null
  const linhaNoFim = arrasto !== null && !semMudanca && arrasto.alvo === outrosAgora.length
  const ultimo = outrosAgora[outrosAgora.length - 1]

  return (
    <>
      {ordem.map((id) => {
        const item = porId.get(id)
        if (!item) return null
        const saiu = arrasto?.id === id
        return (
          <li
            key={id}
            ref={(el) => {
              if (el) linhas.current.set(id, el)
              else linhas.current.delete(id)
            }}
            className={`${classeDaLinha} ${saiu ? 'opacity-35' : ''}`}
          >
            {linhaAntesDe === id && <Marcador lado="topo" />}
            {linhaNoFim && ultimo === id && <Marcador lado="base" />}
            {/* `z-[1]`: o link que cobre a linha vem depois no DOM e
                pintaria por cima da alça, engolindo o toque. */}
            {arrastavel && (
              <button
                type="button"
                aria-label={`Mover ${item.nome}. Use as setas para cima e para baixo.`}
                title="Arraste para mudar a ordem"
                onPointerDown={(evento) => comecarArrasto(evento, id)}
                onKeyDown={(evento) => porTeclado(evento, id)}
                className={`relative z-[1] -ml-1.5 grid h-7 w-5 shrink-0 touch-none place-items-center rounded text-dim transition hover:bg-surface-strong hover:text-soft md:-ml-2.5 ${
                  saiu ? 'cursor-grabbing' : 'cursor-grab'
                }`}
              >
                <Pontinhos />
              </button>
            )}
            {item.conteudo}
          </li>
        )
      })}

      {arrasto &&
        createPortal(
          <div
            aria-hidden
            style={{ left: arrasto.x, top: arrasto.y, width: arrasto.largura }}
            className="pointer-events-none fixed z-[60] flex cursor-grabbing items-center gap-3 rounded-[10px] border border-primary/40 bg-panel px-4 py-3.5 shadow-2xl"
          >
            <span className="text-dim">
              <Pontinhos />
            </span>
            <strong className="truncate text-[13.5px] font-semibold">{porId.get(arrasto.id)?.nome}</strong>
          </div>,
          document.body,
        )}

      <span role="status" className="sr-only">
        {erro ?? ''}
      </span>
      {erro && (
        <AvisoFlutuante tom="erro" aoSumir={sumir}>
          {erro}
        </AvisoFlutuante>
      )}
    </>
  )
}

/** A linha azul entre duas linhas: onde a arrastada entra se soltar. */
function Marcador({ lado }: { lado: 'topo' | 'base' }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-x-3 z-[2] h-[3px] rounded-full bg-primary ${
        lado === 'topo' ? '-top-[2px]' : '-bottom-[2px]'
      }`}
    >
      <span className="absolute -top-[3px] -left-1 size-[9px] rounded-full border-2 border-primary bg-panel" />
    </span>
  )
}

function Pontinhos() {
  return (
    <svg aria-hidden viewBox="0 0 10 16" className="h-4 w-2.5" fill="currentColor">
      <circle cx="2.5" cy="3" r="1.3" />
      <circle cx="7.5" cy="3" r="1.3" />
      <circle cx="2.5" cy="8" r="1.3" />
      <circle cx="7.5" cy="8" r="1.3" />
      <circle cx="2.5" cy="13" r="1.3" />
      <circle cx="7.5" cy="13" r="1.3" />
    </svg>
  )
}
