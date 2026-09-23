'use client'

import { useCallback, useRef, useState, useTransition, type ReactNode } from 'react'
import { AvisoFlutuante } from '@/components/design/aviso-flutuante'
import { acaoReordenarFluxos } from '@/server/acoes'

/**
 * As linhas de uma pasta, reordenáveis pela alça de pontinhos à esquerda.
 *
 * Substitui o "Subir na lista" e o "Descer na lista" do menu `⋯`: arrastar
 * mostra a ordem nova enquanto acontece, e a ordem só é gravada ao soltar.
 *
 * **Ponteiro, e não o arrastar nativo do HTML.** O nativo não funciona no toque,
 * e a lista também é usada no celular. A alça também é botão: com o foco nela,
 * as setas para cima e para baixo movem a linha (teclado e leitor de tela).
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
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [, comecar] = useTransition()
  const linhas = useRef(new Map<string, HTMLLIElement>())
  const antes = useRef<string[]>([])
  // O arrasto lê refs, não estado: o primeiro movimento chega antes de o
  // React redesenhar com o estado do toque. `ordemAgora` só vale durante um
  // arrasto (nasce no toque).
  const emArrasto = useRef<string | null>(null)
  const ordemAgora = useRef<string[]>([])
  const trocar = (nova: string[]) => {
    ordemAgora.current = nova
    setOrdem(nova)
  }
  const sumir = useCallback(() => setErro(null), [])

  // O servidor mandou outra lista (gravou, ou alguém mudou): ela vale.
  if (base !== idsDaProp) {
    setBase(idsDaProp)
    setOrdem(itens.map((item) => item.id))
  }

  const porId = new Map(itens.map((item) => [item.id, item]))

  function gravar(nova: string[], anterior: string[]) {
    if (nova.join(',') === anterior.join(',')) return
    comecar(async () => {
      const r = await acaoReordenarFluxos(clienteId, nova)
      if (!r.ok) {
        trocar(anterior)
        setErro(r.erro ?? 'não deu para reordenar')
      }
    })
  }

  function aoMover(evento: PointerEvent, id: string) {
    if (emArrasto.current !== id) return
    const y = evento.clientY
    const atual = ordemAgora.current
    const outros = atual.filter((outro) => outro !== id)
    let indice = 0
    for (const outro of outros) {
      const caixa = linhas.current.get(outro)?.getBoundingClientRect()
      if (caixa && y > caixa.top + caixa.height / 2) indice++
    }
    const nova = [...outros]
    nova.splice(indice, 0, id)
    if (nova.join(',') !== atual.join(',')) trocar(nova)
  }

  /**
   * O arrasto escuta a janela, e não a alça.
   *
   * Trocar a ordem move o `<li>` no DOM, e o navegador solta a captura do
   * ponteiro quando o elemento capturado sai do lugar: o `pointerup` da alça
   * nunca chegava, e a ordem nova nunca era gravada.
   */
  function comecarArrasto(evento: React.PointerEvent, id: string) {
    if (evento.button !== 0) return
    evento.preventDefault()
    antes.current = ordem
    ordemAgora.current = ordem
    emArrasto.current = id
    setArrastando(id)

    const mover = (e: PointerEvent) => aoMover(e, id)
    const terminar = (cancelou: boolean) => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltou)
      window.removeEventListener('pointercancel', cancelado)
      emArrasto.current = null
      setArrastando(null)
      if (cancelou) trocar(antes.current)
      else gravar(ordemAgora.current, antes.current)
    }
    const soltou = () => terminar(false)
    const cancelado = () => terminar(true)
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltou)
    window.addEventListener('pointercancel', cancelado)
  }

  function porTeclado(evento: React.KeyboardEvent, id: string) {
    if (evento.key !== 'ArrowUp' && evento.key !== 'ArrowDown') return
    evento.preventDefault()
    const posicao = ordem.indexOf(id)
    const destino = posicao + (evento.key === 'ArrowUp' ? -1 : 1)
    if (destino < 0 || destino >= ordem.length) return
    const nova = ordem.filter((outro) => outro !== id)
    nova.splice(destino, 0, id)
    const anterior = ordem
    trocar(nova)
    gravar(nova, anterior)
  }

  return (
    <>
      {ordem.map((id) => {
        const item = porId.get(id)
        if (!item) return null
        return (
          <li
            key={id}
            ref={(el) => {
              if (el) linhas.current.set(id, el)
              else linhas.current.delete(id)
            }}
            className={`${classeDaLinha} ${arrastando === id ? 'z-10 bg-surface shadow-lg' : ''}`}
          >
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
                  arrastando === id ? 'cursor-grabbing' : 'cursor-grab'
                }`}
              >
                <svg aria-hidden viewBox="0 0 10 16" className="h-4 w-2.5" fill="currentColor">
                  <circle cx="2.5" cy="3" r="1.3" />
                  <circle cx="7.5" cy="3" r="1.3" />
                  <circle cx="2.5" cy="8" r="1.3" />
                  <circle cx="7.5" cy="8" r="1.3" />
                  <circle cx="2.5" cy="13" r="1.3" />
                  <circle cx="7.5" cy="13" r="1.3" />
                </svg>
              </button>
            )}
            {item.conteudo}
          </li>
        )
      })}

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
