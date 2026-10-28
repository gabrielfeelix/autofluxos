'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { CONVERSAS, PreviaWhatsApp, type ChaveDaConversa } from './previa-whatsapp'
import x from './site.module.css'

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

/**
 * A prévia do WhatsApp que passa de um negócio para o outro sozinha. É o visual
 * do hero: em vez de dizer "funciona em qualquer ramo", mostra. Pausa fora da
 * tela; sem movimento, fica na primeira.
 */
export function PreviaQueTroca({ chaves, intervalo = 7000 }: { chaves: ChaveDaConversa[]; intervalo?: number }) {
  const [i, setI] = useState(0)
  const [visivel, setVisivel] = useState(true)
  const raiz = useRef<HTMLDivElement>(null)
  const calmo = useMovimentoReduzido()

  useEffect(() => {
    const el = raiz.current
    if (!el) return
    const o = new IntersectionObserver(([e]) => setVisivel(e!.isIntersecting))
    o.observe(el)
    return () => o.disconnect()
  }, [])

  useEffect(() => {
    if (calmo || !visivel || chaves.length < 2) return
    const r = window.setTimeout(() => setI((n) => (n + 1) % chaves.length), intervalo)
    return () => window.clearTimeout(r)
  }, [i, calmo, visivel, chaves.length, intervalo])

  return (
    <div ref={raiz} className={x.previaTroca}>
      <PreviaWhatsApp key={i} conversa={CONVERSAS[chaves[i]!]} />
      {chaves.length > 1 && (
        <div className={x.pontos} role="tablist" aria-label="Exemplos">
          {chaves.map((c, n) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={n === i}
              aria-label={CONVERSAS[c].negocio}
              onClick={() => setI(n)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/*
 * Os dois lados da mesma conversa (seção 1 do `docs/PLANO-LP-V2.md`): nenhum
 * concorrente mostra a coexistência. A mesma conversa aparece no WhatsApp
 * Business do celular do dono e no Inbox, ao mesmo tempo; no fim a atendente
 * responde **pelo celular** e a resposta surge no Inbox.
 */
type Fala = { de: 'cliente' | 'bot' | 'equipe'; texto: string; marca?: string }

const ROTEIRO: Fala[] = [
  { de: 'cliente', texto: 'Oi! Vocês entregam no sábado?' },
  { de: 'bot', texto: 'Entregamos sim, das 9h às 14h. Quer que eu monte o pedido?', marca: 'Chatbot' },
  { de: 'cliente', texto: 'Prefiro falar com alguém' },
  { de: 'equipe', texto: 'Oi, Marina! Aqui é a Júlia. Te ajudo agora.', marca: 'Respondido pelo celular' },
]

export function DoisLados() {
  const [n, setN] = useState(0)
  const [visivel, setVisivel] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const calmo = useMovimentoReduzido()

  useEffect(() => {
    const el = raiz.current
    if (!el) return
    const o = new IntersectionObserver(([e]) => setVisivel(e!.isIntersecting), { threshold: 0.4 })
    o.observe(el)
    return () => o.disconnect()
  }, [])

  useEffect(() => {
    if (calmo || !visivel) return
    const fim = n >= ROTEIRO.length
    const r = window.setTimeout(() => setN(fim ? 0 : n + 1), fim ? 3200 : n === 0 ? 500 : 1500)
    return () => window.clearTimeout(r)
  }, [n, calmo, visivel])

  const falas = ROTEIRO.slice(0, calmo ? ROTEIRO.length : n)
  const transferiu = falas.length >= 3

  return (
    <div ref={raiz} className={x.doisLados} aria-label="A mesma conversa no celular e no Inbox">
      <div className={x.celular}>
        <div className={x.celularTopo}>
          <span className={x.celularAvatar}>M</span>
          <span>
            <strong>Marina</strong>
            <small>WhatsApp Business, no celular</small>
          </span>
        </div>
        <div className={x.celularCorpo}>
          {falas.map((f, i) => (
            <p key={i} className={x.celularBalao} data-de={f.de === 'cliente' ? 'ela' : 'nos'}>
              {f.texto}
            </p>
          ))}
        </div>
      </div>

      <div className={x.fioEntre} aria-hidden>
        <span />
        <small>mesmo número</small>
      </div>

      <div className={x.inbox}>
        <div className={x.inboxTopo}>
          <strong>Inbox</strong>
          <span data-estado={transferiu ? 'equipe' : 'bot'}>{transferiu ? 'Com a equipe' : 'Com o chatbot'}</span>
        </div>
        <div className={x.inboxCorpo}>
          {falas.map((f, i) => (
            <div key={i} className={x.inboxLinha} data-de={f.de}>
              {i === 2 && <p className={x.inboxAviso}>Transferida para a equipe com o histórico</p>}
              <p className={x.inboxBalao}>{f.texto}</p>
              {f.marca && <small>{f.marca}</small>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/*
 * Calculadora do custo da Meta (seção 7b do plano v2). Valores da calculadora
 * oficial da Meta para o Brasil, conferidos em 21/out/2026 (memória
 * `meta-cobra-mensagem-de-servico`): serviço R$ 0,035 por mensagem depois de
 * 1.000 grátis por número no mês; marketing R$ 0,3217 desde a primeira.
 * Conferir de novo na tabela oficial antes de ir para o `main`.
 */
const SERVICO = 0.035
const MARKETING = 0.3217
const GRATIS_POR_NUMERO = 1000

const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function CalculadoraMeta() {
  const [servico, setServico] = useState(3000)
  const [marketing, setMarketing] = useState(500)
  const [numeros, setNumeros] = useState(1)

  const pagas = Math.max(0, servico - GRATIS_POR_NUMERO * numeros)
  const custoServico = pagas * SERVICO
  const custoMarketing = marketing * MARKETING
  const total = custoServico + custoMarketing

  return (
    <div className={x.calculadora}>
      <div className={x.controles}>
        <Controle
          rotulo="Mensagens de atendimento por mês"
          ajuda="Respostas do chatbot e da equipe dentro da conversa."
          valor={servico}
          max={30000}
          passo={500}
          aoMudar={setServico}
        />
        <Controle
          rotulo="Mensagens de campanha por mês"
          ajuda="Transmissões e promoções com modelo de marketing."
          valor={marketing}
          max={10000}
          passo={100}
          aoMudar={setMarketing}
        />
        <Controle rotulo="Números de WhatsApp" ajuda="Cada número tem a sua franquia de 1.000 grátis." valor={numeros} min={1} max={5} passo={1} aoMudar={setNumeros} />
      </div>

      <div className={x.resultado} aria-live="polite">
        <p className={x.resultadoRotulo}>Você paga à Meta, por mês</p>
        <p className={x.resultadoValor}>{reais(total)}</p>
        <dl className={x.conta}>
          <div>
            <dt>Atendimento</dt>
            <dd>
              {pagas.toLocaleString('pt-BR')} pagas × R$ 0,035 = <b>{reais(custoServico)}</b>
            </dd>
          </div>
          <div>
            <dt>Grátis</dt>
            <dd>{Math.min(servico, GRATIS_POR_NUMERO * numeros).toLocaleString('pt-BR')} mensagens de atendimento</dd>
          </div>
          <div>
            <dt>Campanhas</dt>
            <dd>
              {marketing.toLocaleString('pt-BR')} × R$ 0,3217 = <b>{reais(custoMarketing)}</b>
            </dd>
          </div>
        </dl>
        <p className={x.resultadoNota}>
          Pago direto à Meta, no cartão da sua conta do WhatsApp, sem acréscimo nosso. Conversa que começa por anúncio
          Click-to-WhatsApp fica grátis por até 7 dias.
        </p>
      </div>
    </div>
  )
}

function Controle({
  rotulo,
  ajuda,
  valor,
  min = 0,
  max,
  passo,
  aoMudar,
}: {
  rotulo: string
  ajuda: string
  valor: number
  min?: number
  max: number
  passo: number
  aoMudar: (v: number) => void
}) {
  return (
    <label className={x.controle}>
      <span className={x.controleTopo}>
        <strong>{rotulo}</strong>
        <b>{valor.toLocaleString('pt-BR')}</b>
      </span>
      <input type="range" min={min} max={max} step={passo} value={valor} onChange={(e) => aoMudar(Number(e.target.value))} />
      <small>{ajuda}</small>
    </label>
  )
}
