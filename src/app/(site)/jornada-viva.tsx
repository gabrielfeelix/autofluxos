'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import x from './site.module.css'

/*
 * A jornada da home como um player: as etapas avançam sozinhas, o fio
 * acompanha, e o palco embaixo mostra a tela do produto naquela etapa.
 * Clicar numa etapa pula para ela e para o avanço. Fora da tela ou com
 * movimento reduzido, não anda. Os dados vêm de `SecaoJornada`.
 */
export type Etapa = { titulo: string; texto: string; href: string }

const TEMPO_POR_ETAPA = 3400

export function JornadaViva({ etapas }: { etapas: Etapa[] }) {
  const [ativa, setAtiva] = useState(0)
  const [parado, setParado] = useState(false)
  const [visivel, setVisivel] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = raiz.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const o = new IntersectionObserver(([e]) => setVisivel(e!.isIntersecting), { threshold: 0.35 })
    o.observe(el)
    return () => o.disconnect()
  }, [])

  useEffect(() => {
    if (!visivel || parado) return
    const r = window.setTimeout(() => setAtiva((a) => (a + 1) % etapas.length), TEMPO_POR_ETAPA)
    return () => window.clearTimeout(r)
  }, [ativa, visivel, parado, etapas.length])

  // No celular a faixa das etapas rola de lado: acompanha a etapa ativa sem mexer na página.
  useEffect(() => {
    const lista = raiz.current?.querySelector('ol')
    const item = lista?.children[ativa] as HTMLElement | undefined
    if (!lista || !item || lista.scrollWidth <= lista.clientWidth) return
    lista.scrollTo({ left: item.offsetLeft - (lista.clientWidth - item.offsetWidth) / 2, behavior: 'smooth' })
  }, [ativa])

  const etapa = etapas[ativa]!
  return (
    <div ref={raiz} className={x.jornadaViva} style={{ '--progresso': ativa / (etapas.length - 1) } as CSSProperties}>
      <ol className={x.jornada} role="tablist" aria-label="Etapas">
        {etapas.map((e, i) => (
          <li key={e.titulo}>
            <button
              type="button"
              role="tab"
              aria-selected={i === ativa}
              aria-controls="palco-da-jornada"
              className={x.jornadaBotao}
              data-feita={i <= ativa || undefined}
              onClick={() => {
                setAtiva(i)
                setParado(true)
              }}
            >
              <span className={x.jornadaNo}>{String(i + 1).padStart(2, '0')}</span>
              <strong>{e.titulo}</strong>
            </button>
          </li>
        ))}
      </ol>

      <div className={x.jornadaPalco} id="palco-da-jornada" role="tabpanel">
        <div className={x.jornadaPalcoTexto} key={`t${ativa}`}>
          <small>Etapa {String(ativa + 1).padStart(2, '0')}</small>
          <h3>{etapa.titulo}</h3>
          <p>{etapa.texto}</p>
          <Link href={etapa.href} className={x.jornadaLink}>
            Ver como funciona
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M2.5 6h7M6.5 3l3 3-3 3" />
            </svg>
          </Link>
        </div>
        <div className={x.jornadaTela} key={`m${ativa}`} aria-hidden>
          {TELAS[ativa]}
        </div>
      </div>
    </div>
  )
}

/* ───────────── a tela de cada etapa, desenhada em HTML como as do bento ───────────── */

function Janela({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className={x.jtJanela}>
      <div className={x.fichaBarra}>
        <i />
        <i />
        <i />
        <span>{titulo}</span>
      </div>
      <div className={x.jtCorpo}>{children}</div>
    </div>
  )
}

const Visto = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
)

const TELAS: ReactNode[] = [
  // 01 Chega: o contato novo com a origem anotada.
  <Janela key="1" titulo="Contatos · novo">
    <div className={x.jtLinhas}>
      {[
        ['Anúncio', 'Promoção de outubro', true],
        ['Instagram', 'Direct', false],
        ['Site', 'Chat da página de preços', false],
      ].map(([canal, detalhe, novo], i) => (
        <div key={String(canal)} className={x.jtLinha} data-destaque={novo || undefined} style={{ '--i': i } as CSSProperties}>
          <span className={x.jtAvatar}>{['MC', 'AL', 'RS'][i]}</span>
          <span>
            <strong>{['Marina Costa', 'André Lima', 'Rafael Souza'][i]}</strong>
            <small>
              Veio de: {String(canal)} · {String(detalhe)}
            </small>
          </span>
        </div>
      ))}
    </div>
  </Janela>,

  // 02 O chatbot atende: o card do produto na conversa.
  <Janela key="2" titulo="WhatsApp · Marina Costa">
    <div className={x.jtConversa}>
      <p className={x.jtBalao} data-de="cliente">
        Tem esse fone na cor preta?
      </p>
      <div className={x.jtCard}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/fotos-do-site/fone.webp" alt="" width={240} height={110} />
        <strong>Fone Over-ear Bluetooth</strong>
        <small>R$ 249,90 · em estoque</small>
        <em>Ver produto</em>
      </div>
    </div>
  </Janela>,

  // 03 O setor assume: a fila por setor.
  <Janela key="3" titulo="Inbox · filas">
    <div className={x.jtLinhas}>
      {[
        ['MC', 'Marina Costa', 'Quero falar do tamanho', 'Vendas', 'Ana'],
        ['AL', 'André Lima', 'A air fryer parou de esquentar', 'Suporte', 'Bruno'],
        ['RS', 'Rafael Souza', 'Segue o comprovante', 'Financeiro', 'Carla'],
      ].map(([sigla, nome, texto, setor, quem], i) => (
        <div key={sigla} className={x.jtLinha} data-destaque={i === 0 || undefined} style={{ '--i': i } as CSSProperties}>
          <span className={x.jtAvatar}>{sigla}</span>
          <span>
            <strong>{nome}</strong>
            <small>{texto}</small>
          </span>
          <span className={x.jtSetor}>
            {setor}
            <small>{quem}</small>
          </span>
        </div>
      ))}
    </div>
  </Janela>,

  // 04 Vira negócio: o cartão anda no funil.
  <Janela key="4" titulo="Negociações · Comercial">
    <div className={x.jtFunil}>
      {['Novo', 'Proposta', 'Ganho'].map((coluna, i) => (
        <div key={coluna} className={x.jtColuna}>
          <small>{coluna}</small>
          {i === 0 && <span className={x.jtCartaoFantasma}>André Lima</span>}
          {i === 1 && (
            <span className={x.jtCartao}>
              <strong>Marina Costa</strong>
              <small>R$ 268,80 · Ana</small>
              <em>Mandar o link hoje</em>
            </span>
          )}
          {i === 2 && <span className={x.jtCartaoFantasma}>Rafael Souza</span>}
        </div>
      ))}
    </div>
  </Janela>,

  // 05 Paga no chat: o link vira pago.
  <Janela key="5" titulo="WhatsApp · Marina Costa">
    <div className={x.jtConversa}>
      <div className={x.jtPagamento}>
        <small>Link de pagamento</small>
        <strong>Pedido #1042</strong>
        <b>R$ 268,80</b>
        <span className={x.jtPago}>
          <Visto /> Pago no Pix às 10:45
        </span>
      </div>
      <p className={x.jtBalao} data-de="cliente">
        Pronto, paguei!
      </p>
    </div>
  </Janela>,

  // 06 Recebe: as etapas do pedido avisadas.
  <Janela key="6" titulo="WhatsApp · aviso automático">
    <div className={x.jtEtapas}>
      <strong>🚚 Seu pedido está a caminho</strong>
      {[
        ['✅', 'Pagamento aprovado'],
        ['✅', 'Pedido separado'],
        ['🔵', 'Saiu para entrega'],
        ['⚪', 'Entregue'],
      ].map(([sinal, texto], i) => (
        <span key={texto} style={{ '--i': i } as CSSProperties}>
          {sinal} {texto}
        </span>
      ))}
      <em>Rastrear entrega</em>
    </div>
  </Janela>,

  // 07 Volta: a nota e a recompra.
  <Janela key="7" titulo="Pós-venda · Marina Costa">
    <div className={x.jtVolta}>
      <small>De 0 a 10, quanto você indicaria a loja?</small>
      <span className={x.jtNps}>
        {Array.from({ length: 11 }, (_, i) => (
          <i key={i} data-nota={i === 10 || undefined}>
            {i}
          </i>
        ))}
      </span>
      <span className={x.jtRecompra}>
        <Visto /> Mensagem de recompra agendada para daqui a 30 dias
      </span>
    </div>
  </Janela>,
]
