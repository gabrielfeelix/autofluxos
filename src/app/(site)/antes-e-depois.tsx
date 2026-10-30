'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import a from './antes.module.css'

/*
 * Antes e depois como cena, não como texto: os seis improvisos de hoje
 * aparecem jogados na mesa, tortos e apagados; com a chave em "Com o
 * Dialogon" cada um gira, se alinha na grade e vira a tela do produto.
 * A chave alterna sozinha enquanto a seção está na tela e para quando a
 * pessoa clica. Cada "depois" existe no produto (ver `SecaoImprovisos`).
 */

type Item = { hoje: ReactNode; agora: ReactNode; baguncado: [string, string, string] }

const ITENS: Item[] = [
  {
    baguncado: ['2%', '6%', '-9deg'],
    hoje: (
      <>
        <span className={a.celular}>
          <i />
        </span>
        <p>Um celular passando de mão em mão</p>
      </>
    ),
    agora: (
      <>
        <span className={a.avatares}>
          <i>AN</i>
          <i>BR</i>
          <i>CA</i>
          <b>+2</b>
        </span>
        <p>
          <b>A equipe no mesmo número</b>
          cada um com o próprio acesso
        </p>
      </>
    ),
  },
  {
    baguncado: ['35%', '0%', '6deg'],
    hoje: (
      <>
        <span className={a.planilha}>
          {Array.from({ length: 12 }, (_, i) => (
            <i key={i} />
          ))}
        </span>
        <p>Planilha de leads e caderno</p>
      </>
    ),
    agora: (
      <>
        <span className={a.kanban}>
          <i>
            <b />
            <b />
          </i>
          <i>
            <b />
          </i>
          <i>
            <b data-ganho />
          </i>
        </span>
        <p>
          <b>Funil de vendas</b>
          etapa, valor e próxima ação
        </p>
      </>
    ),
  },
  {
    baguncado: ['66%', '9%', '-5deg'],
    hoje: (
      <>
        <span className={a.grupo}>
          <i>Alguém atende a Marina?</i>
          <i data-eu>???</i>
        </span>
        <p>Grupo da equipe para avisar quem atende</p>
      </>
    ),
    agora: (
      <>
        <span className={a.abas}>
          <i data-ativa>
            Vendas <b>3</b>
          </i>
          <i>
            Suporte <b>1</b>
          </i>
          <i>
            Financeiro <b>2</b>
          </i>
        </span>
        <p>
          <b>Fila por setor</b>
          com o histórico junto
        </p>
      </>
    ),
  },
  {
    baguncado: ['6%', '54%', '7deg'],
    hoje: (
      <>
        <span className={a.comprovante}>
          <i />
          <i />
          <i />
        </span>
        <p>Print do comprovante no meio da conversa</p>
      </>
    ),
    agora: (
      <>
        <span className={a.pago}>
          <b>✓</b> Pago · R$ 268,80
        </span>
        <p>
          <b>Pagamento confirmado sozinho</b>
          pelo banco, na conversa
        </p>
      </>
    ),
  },
  {
    baguncado: ['39%', '58%', '-7deg'],
    hoje: (
      <>
        <span className={a.disparo}>
          <i>Lista de transmissão</i>
          <i data-alerta>256 contatos · sem retorno</i>
        </span>
        <p>Ferramenta de disparo à parte</p>
      </>
    ),
    agora: (
      <>
        <span className={a.campanha}>
          <i style={{ '--w': '92%' } as CSSProperties}>Entregues</i>
          <i style={{ '--w': '62%' } as CSSProperties}>Lidas</i>
          <i style={{ '--w': '18%' } as CSSProperties}>Responderam</i>
        </span>
        <p>
          <b>Transmissões com retorno</b>
          contato por contato
        </p>
      </>
    ),
  },
  {
    baguncado: ['66.5%', '55%', '8deg'],
    hoje: (
      <>
        <span className={a.cobranca}>
          <i>Cadê meu pedido?</i>
          <i>Já saiu??</i>
          <i>Oi???</i>
        </span>
        <p>&quot;Cadê meu pedido?&quot; respondido à mão</p>
      </>
    ),
    agora: (
      <>
        <span className={a.rastreio}>
          <i data-ok>✅ Pago</i>
          <i data-ok>✅ Separado</i>
          <i data-agora>🚚 Saiu para entrega</i>
        </span>
        <p>
          <b>Rastreio avisado sozinho</b>
          a cada etapa, no WhatsApp
        </p>
      </>
    ),
  },
]

// Onde cada cartão fica quando arrumado: grade de 3x2.
const ARRUMADO: [string, string][] = [
  ['0%', '0%'],
  ['34.33%', '0%'],
  ['68.66%', '0%'],
  ['0%', '52%'],
  ['34.33%', '52%'],
  ['68.66%', '52%'],
]

export function AntesEDepois() {
  const [agora, setAgora] = useState(false)
  const [parado, setParado] = useState(false)
  const [visivel, setVisivel] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const primeira = useRef(true)

  useEffect(() => {
    const el = raiz.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const o = new IntersectionObserver(([e]) => setVisivel(e!.isIntersecting), { threshold: 0.3 })
    o.observe(el)
    return () => o.disconnect()
  }, [])

  useEffect(() => {
    if (!visivel || parado) return
    // Na primeira vez a bagunça fica só 1 s: quem chega na seção já vê a operação se arrumar.
    const espera = agora ? 5200 : primeira.current ? 1000 : 2400
    const r = window.setTimeout(() => {
      primeira.current = false
      setAgora((v) => !v)
    }, espera)
    return () => window.clearTimeout(r)
  }, [agora, visivel, parado])

  const escolher = (valor: boolean) => {
    setAgora(valor)
    setParado(true)
  }

  return (
    <div ref={raiz} className={a.cena} data-estado={agora ? 'agora' : 'hoje'}>
      <div className={a.chave} role="tablist" aria-label="Antes e depois">
        <span className={a.chaveFundo} aria-hidden />
        <button type="button" role="tab" aria-selected={!agora} onClick={() => escolher(false)}>
          Hoje
        </button>
        <button type="button" role="tab" aria-selected={agora} onClick={() => escolher(true)}>
          Com o Dialogon
        </button>
      </div>

      <div className={a.mesa}>
        {ITENS.map((item, i) => (
          <div
            key={i}
            className={a.cartao}
            style={
              {
                '--hx': item.baguncado[0],
                '--hy': item.baguncado[1],
                '--hr': item.baguncado[2],
                '--ax': ARRUMADO[i]![0],
                '--ay': ARRUMADO[i]![1],
                '--i': i,
              } as CSSProperties
            }
          >
            <div className={a.faceHoje} aria-hidden={agora}>
              {item.hoje}
            </div>
            <div className={a.faceAgora} aria-hidden={!agora}>
              {item.agora}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
