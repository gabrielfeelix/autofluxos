'use client'

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import s from './faixa-do-problema.module.css'

/*
 * A pilha da faixa escura (seção 3 do `docs/PLANO-LP-V2.md`). A mesma pergunta
 * chega o dia inteiro, cada vez mais depressa, e no meio dela um pedido de
 * orçamento das 11h03 fica soterrado. Quando a pilha termina, o orçamento
 * acende: é o problema inteiro numa tela, sem precisar de número.
 *
 * Os nomes são inventados. A mensagem nova entra no topo, como na lista de
 * conversas do celular, e empurra as outras para baixo.
 */

type Mensagem = { nome: string; hora: string; texto: string; orcamento?: boolean; foraDoHorario?: boolean }

const DIA: Mensagem[] = [
  { nome: 'Carla', hora: '8h12', texto: 'Que horas vocês abrem?' },
  { nome: 'Rafael', hora: '8h47', texto: 'Que horas vocês abrem?' },
  { nome: 'Bruna', hora: '9h40', texto: 'Bom dia! Vocês abrem que horas?' },
  { nome: 'Eduardo', hora: '11h03', texto: 'Preciso de um orçamento para 40 unidades. Consegue me passar hoje?', orcamento: true },
  { nome: 'Patrícia', hora: '11h26', texto: 'Que horas vocês abrem?' },
  { nome: 'Lucas', hora: '12h27', texto: 'Que horas vocês abrem?' },
  { nome: 'Vanessa', hora: '14h05', texto: 'Abrem que horas amanhã?' },
  { nome: 'Thiago', hora: '16h48', texto: 'Que horas vocês abrem?' },
  { nome: 'Renata', hora: '19h20', texto: 'Que horas vocês abrem?', foraDoHorario: true },
  { nome: 'Diego', hora: '21h06', texto: 'Que horas vocês abrem?', foraDoHorario: true },
]

// Matizes frias e apagadas, para os avatares não competirem com o âmbar do orçamento.
const MATIZ = [212, 190, 250, 170, 228, 280]

// A primeira demora, as seguintes vêm cada vez mais perto: é a pilha que cresce
// mais rápido do que alguém consegue responder.
const intervalo = (i: number) => Math.max(1150 - i * 120, 420)
const ACENDE_MS = 900

export function PerguntaRepetida() {
  const raiz = useRef<HTMLDivElement>(null)
  const [visivel, setVisivel] = useState(false)
  const [chegaram, setChegaram] = useState(0)
  const [acendeu, setAcendeu] = useState(false)
  const calmo = useMovimentoReduzido()

  useEffect(() => {
    const el = raiz.current
    if (!el) return
    const observador = new IntersectionObserver(([e]) => setVisivel(e!.isIntersecting), { threshold: 0.4 })
    observador.observe(el)
    return () => observador.disconnect()
  }, [])

  // Roda uma vez só e retoma de onde parou: sair da tela pausa, voltar continua.
  useEffect(() => {
    if (!visivel || calmo || acendeu) return
    const relogio =
      chegaram < DIA.length
        ? window.setTimeout(() => setChegaram((n) => n + 1), chegaram === 0 ? 350 : intervalo(chegaram))
        : window.setTimeout(() => setAcendeu(true), ACENDE_MS)
    return () => window.clearTimeout(relogio)
  }, [visivel, calmo, chegaram, acendeu])

  const n = calmo ? DIA.length : chegaram
  const vezes = DIA.slice(0, n).filter((m) => !m.orcamento).length
  const pilha = DIA.slice(0, n).reverse()

  return (
    <div ref={raiz} className={s.pilha} aria-hidden>
      <div className={s.pilhaTopo}>
        <span className={s.pilhaCanal}>
          <i />
          WhatsApp · hoje
        </span>
        <span className={s.contador}>
          <b key={vezes}>{vezes}</b> {vezes === 1 ? 'vez' : 'vezes'} a mesma pergunta
        </span>
      </div>

      <ul className={s.lista}>
        {pilha.map((m) => (
          <li
            key={m.hora}
            className={s.item}
            data-orcamento={m.orcamento ? '' : undefined}
            data-esquecido={m.orcamento && (calmo || acendeu) ? '' : undefined}
          >
            <div className={s.itemDentro}>
              <span className={s.avatar} style={{ '--matiz': MATIZ[m.nome.length % MATIZ.length] } as CSSProperties}>
                {m.nome[0]}
              </span>
              <div className={s.corpo}>
                <div className={s.linha1}>
                  <strong>{m.nome}</strong>
                  {m.foraDoHorario && <span className={s.selo}>fora do horário</span>}
                  <time>{m.hora}</time>
                </div>
                <p>{m.texto}</p>
                {m.orcamento && <span className={s.semResposta}>Sem resposta desde 11h03</span>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function useMovimentoReduzido(): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const consulta = window.matchMedia('(prefers-reduced-motion: reduce)')
      consulta.addEventListener('change', avisar)
      return () => consulta.removeEventListener('change', avisar)
    },
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  )
}
