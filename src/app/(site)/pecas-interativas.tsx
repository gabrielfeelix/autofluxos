'use client'

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
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
type Pedido = { numero: string; itens: [string, string][]; total: string }

type Fala = {
  de: 'cliente' | 'bot' | 'equipe'
  texto?: string
  produto?: { foto: string; nome: string; preco: string }
  audio?: { duracao: string; transcricao: string }
  /** Link de pagamento (a página `/pagar/`), mandado pela atendente. */
  link?: Pedido
  /** O aviso automático quando o pagamento cai: ninguém da equipe digita. */
  confirmado?: Pedido & { entrega: string }
}

// Fone R$ 249,90 + frete R$ 18,90, os mesmos valores da prévia da loja (`previa-whatsapp.tsx`).
const PEDIDO: Pedido = { numero: 'Pedido 1042', itens: [['Fone Over-ear preto', 'R$ 249,90'], ['Entrega no sábado', 'R$ 18,90']], total: 'R$ 268,80' }

const ROTEIRO: Fala[] = [
  { de: 'cliente', texto: 'Oi! Vocês entregam no sábado?' },
  {
    de: 'bot',
    texto: 'Entregamos sim, das 9h às 14h. Este é o mais pedido da semana:',
    produto: { foto: '/fotos-do-site/fone.webp', nome: 'Fone Over-ear Bluetooth', preco: 'R$ 249,90' },
  },
  { de: 'cliente', audio: { duracao: '0:07', transcricao: 'Quero esse em preto, mas queria tirar uma dúvida do tamanho com alguém.' } },
  { de: 'equipe', texto: 'Oi, Marina! Aqui é a Júlia. Ele ajusta na cabeça, serve em todo mundo. Separo o preto?' },
  { de: 'cliente', texto: 'Pode separar! Como eu pago?' },
  { de: 'equipe', texto: 'Separado! Este é o link, aceita Pix ou cartão:', link: PEDIDO },
  { de: 'cliente', texto: 'Pronto, paguei no Pix' },
  { de: 'bot', confirmado: { ...PEDIDO, entrega: 'Sábado, das 9h às 14h' } },
]

const HORAS_DA_CONVERSA = ['10:41', '10:41', '10:42', '10:43', '10:43', '10:44', '10:45', '10:45']
// Quando a Júlia entra: a fala da equipe que vem logo depois do áudio.
const ENTRADA_DA_EQUIPE = 3

function Visto() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  )
}

const ONDA_DO_AUDIO = [35, 60, 85, 50, 95, 65, 40, 75, 90, 55, 35, 70, 85, 45, 30, 60, 80, 50, 35, 25]

function Onda() {
  return (
    <span className={x.onda} aria-hidden>
      {ONDA_DO_AUDIO.map((h, i) => (
        <i key={i} style={{ height: `${h}%` }} />
      ))}
    </span>
  )
}

function Tocar() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5Z" />
    </svg>
  )
}

/** O que a conversa mostra no Inbox: o áudio chega com a transcrição embaixo. */
function NoInbox({ f, pago }: { f: Fala; pago: boolean }) {
  return (
    <div className={x.janelaBalao} data-rico={f.produto || f.audio || f.link || f.confirmado ? '' : undefined}>
      {f.texto && <p>{f.texto}</p>}
      {f.produto && (
        <span className={x.janelaProduto}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={f.produto.foto} alt="" width={56} height={56} />
          <span>
            <strong>{f.produto.nome}</strong>
            <small>{f.produto.preco} · cartão enviado pelo chatbot</small>
          </span>
        </span>
      )}
      {f.audio && (
        <>
          <span className={x.janelaAudio}>
            <i>
              <Tocar />
            </i>
            <Onda />
            <small>{f.audio.duracao}</small>
          </span>
          <span className={x.janelaTranscricao}>
            <small>Transcrição</small>
            {f.audio.transcricao}
          </span>
        </>
      )}
      {f.link && (
        <span className={x.janelaLink}>
          <span className={x.janelaLinkTopo}>
            <small>Link de pagamento</small>
            <em data-pago={pago || undefined}>
              {pago ? (
                <>
                  <Visto /> Pago às 10:45
                </>
              ) : (
                'Aguardando pagamento'
              )}
            </em>
          </span>
          <span className={x.janelaLinkPedido}>
            <strong>{f.link.numero}</strong>
            <b>{f.link.total}</b>
          </span>
          <small className={x.janelaLinkUrl}>autofluxos.4yu.com.br/pagar/…</small>
        </span>
      )}
      {f.confirmado && (
        <span className={x.janelaConfirmado}>
          <span className={x.confirmadoTopo}>
            <i>
              <Visto />
            </i>
            <strong>Pedido confirmado</strong>
          </span>
          <span className={x.janelaPix}>
            <span>
              {f.confirmado.numero}
              <b>Pago no Pix</b>
            </span>
            <span>
              Entrega
              <b>{f.confirmado.entrega}</b>
            </span>
            <span data-total>
              Total
              <b>{f.confirmado.total}</b>
            </span>
          </span>
        </span>
      )}
    </div>
  )
}

/** O mesmo no WhatsApp Business do celular, no visual do app. */
function NoCelular({ f, hora }: { f: Fala; hora: string }) {
  const lado = f.de === 'cliente' ? 'ela' : 'nos'
  return (
    <div className={x.aparelhoBalao} data-de={lado} data-rico={f.produto || f.link || f.confirmado ? '' : undefined}>
      {f.produto && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={x.aparelhoFoto} src={f.produto.foto} alt="" width={240} height={120} />
          <strong className={x.aparelhoProduto}>
            {f.produto.nome}
            <b>{f.produto.preco}</b>
          </strong>
        </>
      )}
      {f.link && (
        <span className={x.aparelhoPrevia}>
          <small>autofluxos.4yu.com.br</small>
          <strong>
            {f.link.numero} · {f.link.total}
          </strong>
          <span>Pague com Pix ou cartão</span>
        </span>
      )}
      {f.texto && <span>{f.texto}</span>}
      {f.link && <em className={x.aparelhoAcao}>Pagar agora</em>}
      {f.audio && (
        <span className={x.aparelhoAudio}>
          <Tocar />
          <Onda />
          <small>{f.audio.duracao}</small>
        </span>
      )}
      {f.confirmado && (
        <span className={x.aparelhoPix}>
          <span className={x.confirmadoTopo}>
            <i>
              <Visto />
            </i>
            <strong>Pedido confirmado!</strong>
          </span>
          <span>
            {f.confirmado.numero}
            <b>Pago no Pix</b>
          </span>
          <span>
            Entrega
            <b>Sábado, 9h às 14h</b>
          </span>
          <span data-total>
            Total
            <b>{f.confirmado.total}</b>
          </span>
          <em>Acompanhar pedido</em>
        </span>
      )}
      <time>{hora}</time>
    </div>
  )
}

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
    // Rápido como conversa de verdade: a primeira entra logo, as seguintes a cada ~1 s.
    const r = window.setTimeout(() => setN(fim ? 0 : n + 1), fim ? 2800 : n === 0 ? 300 : 1050)
    return () => window.clearTimeout(r)
  }, [n, calmo, visivel])

  const falas = ROTEIRO.slice(0, calmo ? ROTEIRO.length : n)
  const transferiu = falas.length > ENTRADA_DA_EQUIPE
  const pago = falas.some((f) => f.confirmado)

  return (
    <div ref={raiz} className={x.doisLados} aria-label="A mesma conversa no celular do dono e no Inbox">
      <div className={x.janela}>
        <div className={x.janelaBarra}>
          <i />
          <i />
          <i />
          <span>autofluxos.4yu.com.br/inbox</span>
        </div>
        <div className={x.janelaTopo}>
          <span className={x.janelaAvatar}>MC</span>
          <span>
            <strong>Marina Costa</strong>
            <small>WhatsApp · +55 44 9••••-4412</small>
          </span>
          <em>{transferiu ? 'Atendida por Júlia' : 'Chatbot atendendo'}</em>
        </div>
        <div className={x.janelaCorpo}>
          <p className={x.janelaAviso}>Hoje</p>
          {falas.map((f, i) => (
            <div key={i} className={x.janelaLinha} data-de={f.de}>
              {i === ENTRADA_DA_EQUIPE && <p className={x.janelaAviso}>Júlia entrou na conversa</p>}
              <NoInbox f={f} pago={pago} />
              <small>
                {f.confirmado ? 'Automático, pagamento aprovado · ' : f.de === 'bot' ? 'Chatbot · ' : f.de === 'equipe' ? 'Júlia, pelo celular · ' : ''}
                {HORAS_DA_CONVERSA[i]}
              </small>
            </div>
          ))}
        </div>
      </div>

      <div className={x.aparelho}>
        <div className={x.aparelhoTela}>
          <div className={x.aparelhoStatus}>
            <span>9:41</span>
            <i className={x.ilha} />
            <span>5G</span>
          </div>
          <div className={x.aparelhoTopo}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="m15 18-6-6 6-6" />
            </svg>
            <span className={x.aparelhoAvatar}>M</span>
            <span>
              <strong>Marina Costa</strong>
              <small>WhatsApp Business</small>
            </span>
          </div>
          <div className={x.aparelhoCorpo}>
            <p className={x.aparelhoData}>Hoje</p>
            {falas.map((f, i) => (
              <NoCelular key={i} f={f} hora={HORAS_DA_CONVERSA[i]!} />
            ))}
          </div>
          <div className={x.aparelhoCampo} aria-hidden>
            <span>Mensagem</span>
            <i>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#ffffff" aria-hidden>
                <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-2.1A7 7 0 0 0 19 12Z" />
              </svg>
            </i>
          </div>
        </div>
      </div>

      <p className={x.sincronia}>O mesmo número nos dois lados. Cada mensagem aparece no celular e no Inbox ao mesmo tempo.</p>
    </div>
  )
}

/*
 * Os três números medidos da home, cada um com a peça que o explica. Medição
 * e consulta no comentário de `SecaoNumeros`, `secoes-do-site.tsx`: 90 dias até 28/out/2026.
 *
 * Sem JavaScript, o HTML já chega no estado final (barras cheias, 74%). O
 * efeito marca `data-vivo="espera"` ao montar, zerando tudo, e `"sim"` quando
 * a seção entra na tela; o CSS anima a passagem de um para o outro.
 */
const TEMPO_DO_CHATBOT = 4
const TEMPO_DA_EQUIPE = 106
// Horários ilustrativos, não medidos: cinco no horário comercial e um fora, na proporção medida de 1 em 6.
const CHEGADAS = [9.4, 10.8, 13.6, 15.1, 16.7, 21.4]

export function NumerosMedidos({ atraso = 0 }: { atraso?: number }) {
  const raiz = useRef<HTMLDivElement>(null)
  const conta = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = raiz.current
    const numero = conta.current
    if (!el || !numero || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    el.dataset.vivo = 'espera'
    numero.textContent = '0%'
    let quadro = 0
    let espera = 0
    const o = new IntersectionObserver(
      ([e]) => {
        if (!e!.isIntersecting) return
        o.disconnect()
        espera = window.setTimeout(() => {
          el.dataset.vivo = 'sim'
          const inicio = performance.now()
          const passo = (agora: number) => {
            const p = Math.min((agora - inicio) / 1200, 1)
            numero.textContent = `${Math.round(74 * (1 - Math.pow(1 - p, 3)))}%`
            if (p < 1) quadro = requestAnimationFrame(passo)
          }
          quadro = requestAnimationFrame(passo)
        }, atraso)
      },
      { threshold: 0.35 },
    )
    o.observe(el)
    return () => {
      o.disconnect()
      window.clearTimeout(espera)
      cancelAnimationFrame(quadro)
    }
  }, [atraso])

  return (
    <div ref={raiz} className={x.numerosGrade}>
      <div className={x.numero}>
        <strong ref={conta}>74%</strong>
        <span>das conversas terminam sem precisar da equipe</span>
        <div className={x.marcas} aria-hidden>
          {Array.from({ length: 50 }, (_, i) => (
            <i key={i} data-cheia={i < 37 || undefined} style={{ '--i': i } as CSSProperties} />
          ))}
        </div>
        <p className={x.numeroLegenda}>
          <b /> Resolvidas pelo chatbot e pela IA
        </p>
      </div>

      <div className={x.numero}>
        <strong>4 s</strong>
        <span>para o chatbot responder, na mediana</span>
        <div className={x.tempos}>
          <div>
            <small>Chatbot</small>
            <i>
              <b style={{ '--w': `${(TEMPO_DO_CHATBOT / TEMPO_DA_EQUIPE) * 100}%` } as CSSProperties} />
            </i>
            <em>4 s</em>
          </div>
          <div data-lenta>
            <small>Equipe</small>
            <i>
              <b style={{ '--w': '100%' } as CSSProperties} />
            </i>
            <em>1 min 46 s</em>
          </div>
        </div>
      </div>

      <div className={x.numero}>
        <strong>1 em 6</strong>
        <span>mensagens chega fora do horário comercial</span>
        <div className={x.dia} aria-hidden>
          <div className={x.diaTrilho}>
            <span className={x.diaExpediente} />
            {CHEGADAS.map((h, i) => (
              <i
                key={h}
                data-fora={h < 8 || h >= 18 || undefined}
                style={{ '--x': `${(h / 24) * 100}%`, '--i': i } as CSSProperties}
              />
            ))}
          </div>
          <div className={x.diaHoras}>
            <small style={{ '--x': '0%' } as CSSProperties}>0h</small>
            <small style={{ '--x': `${(8 / 24) * 100}%` } as CSSProperties}>8h</small>
            <small style={{ '--x': `${(18 / 24) * 100}%` } as CSSProperties}>18h</small>
            <small style={{ '--x': '100%' } as CSSProperties}>24h</small>
          </div>
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
