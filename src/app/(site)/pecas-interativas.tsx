'use client'

import { TituloComCanal } from './titulo-com-canal'
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import Link from 'next/link'
import { IlustracaoDoRamo } from './ilustracoes-dos-ramos'
import { NICHOS_DO_SITE } from './nichos-do-site'
import { CONVERSAS, PreviaWhatsApp, type ChaveDaConversa } from './previa-whatsapp'
import x from './site.module.css'
import { FotoDaPessoa, MiniFoto } from './pessoas-do-site'

export function useMovimentoReduzido(): boolean {
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
// 9 s: a conversa chega uma mensagem por vez (0,9 s cada) e ainda sobra tempo de ler o fim.
export function PreviaQueTroca({ chaves, intervalo = 9000 }: { chaves: ChaveDaConversa[]; intervalo?: number }) {
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
/*
 * As mensagens seguem o molde das que a PCYES manda de verdade (consultadas em
 * `messages` em 29/out/2026): foto do produto em cima, título em negrito com
 * emoji, etapas com ✅ 🔵 ⚪, o pedido com o total e um botão de ação. A loja e
 * os dados aqui são fictícios.
 */
type Fala = {
  de: 'cliente' | 'bot' | 'equipe'
  /** Com a marcação do WhatsApp: *negrito* e quebra de linha. */
  texto?: string
  foto?: string
  botao?: string
  audio?: { duracao: string; transcricao: string }
  /** Link de pagamento: no Inbox mostra se já foi pago. */
  link?: boolean
  /** Pesquisa de satisfação de 0 a 10, enviada como lista. */
  nps?: boolean
  /** Rótulo do Inbox para o que saiu sem ninguém digitar. */
  automatico?: string
}

const FOTO = '/fotos-do-site/fone.webp'

// Fone R$ 249,90 + frete R$ 18,90, os mesmos valores da prévia da loja (`previa-whatsapp.tsx`).
const ROTEIRO: Fala[] = [
  { de: 'cliente', texto: 'Oi! Vocês entregam no sábado?' },
  {
    de: 'bot',
    foto: FOTO,
    texto: 'Entregamos sim, das 9h às 14h 🚚\nEste é o mais pedido da semana:\n\n*Fone Over-ear Bluetooth*\nR$ 249,90, em estoque',
    botao: 'Ver produto',
  },
  { de: 'cliente', audio: { duracao: '0:07', transcricao: 'Quero esse em preto, mas queria tirar uma dúvida do tamanho com alguém.' } },
  { de: 'equipe', texto: 'Oi, Marina! Aqui é a Júlia 👋 Ele ajusta na cabeça e serve em todo mundo. Separo o preto?' },
  // A Marina é a mesma do Inbox de cima, que pergunta se dá pra parcelar: aqui ela parcela (observação do Edu, 29/out).
  { de: 'cliente', texto: 'Pode separar! Dá pra parcelar?' },
  {
    de: 'equipe',
    link: true,
    texto: 'Dá sim! 🧾 *Pedido #1042* · R$ 268,80\nEm até 3x sem juros no cartão\n1x Fone Over-ear preto\nEntrega sábado, das 9h às 14h',
    botao: 'Pagar com Pix ou cartão',
  },
  { de: 'cliente', texto: 'Pronto, paguei no cartão em 3x' },
  {
    de: 'bot',
    automatico: 'Automático, pagamento aprovado',
    foto: FOTO,
    texto:
      '🎉 *Pedido confirmado!*\nPrevisão de entrega: *sábado, 9h às 14h*\n\n✅ Pagamento aprovado\n🔵 *Separando o pedido*\n⚪ Saiu para entrega\n⚪ Entregue\n\n*Pedido #1042* · R$ 268,80',
    botao: 'Acompanhar pedido',
  },
  { de: 'bot', automatico: 'Automático, pesquisa pós-venda', nps: true, texto: 'Marina, de 0 a 10, quanto você indicaria a Ponto Som para um amigo? 🎧' },
  { de: 'cliente', texto: '10' },
]

const HORAS_DA_CONVERSA = ['10:41', '10:41', '10:42', '10:43', '10:43', '10:44', '10:45', '10:45', '10:46', '10:47']
// Quando a Júlia entra: a fala da equipe que vem logo depois do áudio.
const ENTRADA_DA_EQUIPE = 3

/** A marcação do WhatsApp: `*negrito*` e quebras de linha. */
function Formatado({ texto }: { texto: string }) {
  return (
    <>
      {texto.split('\n').map((linha, i) => (
        <span key={i} className={x.linhaFormatada}>
          {linha === ''
            ? '\u00a0'
            : linha.split(/(\*[^*]+\*)/).map((pedaco, j) =>
                pedaco.startsWith('*') && pedaco.endsWith('*') && pedaco.length > 2 ? <b key={j}>{pedaco.slice(1, -1)}</b> : pedaco,
              )}
        </span>
      ))}
    </>
  )
}

function Visto() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  )
}

function IconeLink() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  )
}

function IconeLista() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
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

/**
 * O que a conversa mostra no Inbox: o áudio chega com a transcrição, o link
 * diz se já foi pago e a pesquisa mostra a nota que voltou.
 */
function NoInbox({ f, pago, nota }: { f: Fala; pago: boolean; nota: number | null }) {
  return (
    <div className={x.janelaBalao} data-rico={f.foto || f.audio || f.link || f.nps ? '' : undefined}>
      {f.foto ? (
        <span className={x.janelaCard}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={f.foto} alt="" width={84} height={84} />
          <span>{f.texto && <Formatado texto={f.texto} />}</span>
        </span>
      ) : (
        f.texto && (
          <span className={x.janelaTexto}>
            <Formatado texto={f.texto} />
          </span>
        )
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
      {f.nps && (
        <span className={x.janelaNps} aria-hidden>
          {Array.from({ length: 11 }, (_, i) => (
            <i key={i} data-nota={nota === i || undefined}>
              {i}
            </i>
          ))}
        </span>
      )}
      {f.botao && (
        <span className={x.janelaBotao}>
          <IconeLink /> {f.botao}
          {f.link && (
            <em data-pago={pago || undefined}>
              {pago ? (
                <>
                  <Visto /> Pago às 10:45
                </>
              ) : (
                'Aguardando pagamento'
              )}
            </em>
          )}
        </span>
      )}
    </div>
  )
}

/** O mesmo no WhatsApp Business do celular, no visual do app. */
function NoCelular({ f, hora }: { f: Fala; hora: string }) {
  const lado = f.de === 'cliente' ? 'ela' : 'nos'
  return (
    <div className={x.aparelhoBalao} data-de={lado} data-rico={f.foto || f.botao || f.nps ? '' : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {f.foto && <img className={x.aparelhoFoto} src={f.foto} alt="" width={240} height={120} />}
      {f.texto && (
        <span className={x.aparelhoTexto}>
          <Formatado texto={f.texto} />
        </span>
      )}
      {f.audio && (
        <span className={x.aparelhoAudio}>
          <Tocar />
          <Onda />
          <small>{f.audio.duracao}</small>
        </span>
      )}
      <time>{hora}</time>
      {f.botao && (
        <em className={x.aparelhoAcao}>
          <IconeLink /> {f.botao}
        </em>
      )}
      {f.nps && (
        <em className={x.aparelhoAcao}>
          <IconeLista /> Escolher nota
        </em>
      )}
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
    const r = window.setTimeout(() => setN(fim ? 0 : n + 1), fim ? 2200 : n === 0 ? 300 : 1400)
    return () => window.clearTimeout(r)
  }, [n, calmo, visivel])

  const falas = ROTEIRO.slice(0, calmo ? ROTEIRO.length : n)
  const transferiu = falas.length > ENTRADA_DA_EQUIPE
  const pago = falas.some((f) => f.automatico?.includes('pagamento'))
  const respostaDoNps = falas.findIndex((f) => f.nps)
  const nota = respostaDoNps >= 0 && falas[respostaDoNps + 1] ? Number(falas[respostaDoNps + 1]!.texto) : null

  return (
    <div ref={raiz} className={x.doisLados} aria-label="A mesma conversa no celular do dono e no Inbox">
      <div className={x.janela}>
        <div className={x.janelaBarra}>
          <i />
          <i />
          <i />
          <span>autofluxos.4yu.com.br/inbox</span>
        </div>
        <div className={x.janelaGrade}>
        <div className={x.janelaConversa}>
        <div className={x.janelaTopo}>
          <span className={x.janelaAvatar}>
            <FotoDaPessoa nome="Marina Costa" />
          </span>
          <span>
            <strong>Marina Costa</strong>
            <small>
              <TituloComCanal texto="WhatsApp · +55 44 9••••-4412" tamanho={12} />
            </small>
          </span>
          <em>{transferiu ? 'Atendida por Júlia' : 'Chatbot atendendo'}</em>
        </div>
        <div className={x.janelaCorpo}>
          <p className={x.janelaAviso}>Hoje</p>
          {falas.map((f, i) => (
            <div key={i} className={x.janelaLinha} data-de={f.de}>
              {i === ENTRADA_DA_EQUIPE && <p className={x.janelaAviso}>Júlia entrou na conversa</p>}
              <NoInbox f={f} pago={pago} nota={nota} />
              <small>
                {f.automatico ? `${f.automatico} · ` : f.de === 'bot' ? 'Chatbot · ' : f.de === 'equipe' ? 'Júlia, pelo celular · ' : ''}
                {HORAS_DA_CONVERSA[i]}
              </small>
            </div>
          ))}
        </div>
        {/* O campo de resposta com a barra do Inbox: anexo, emoji, produto, cobrança, cupom, formatação. */}
        <div className={x.janelaCampo} aria-hidden>
          <span>Responder Marina pelo WhatsApp...</span>
          <span className={x.janelaFerramentas}>
            {['M21.4 11.1 12.2 20.3a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5', 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8.5 14.5s1.3 1.8 3.5 1.8 3.5-1.8 3.5-1.8M9 9.5h.01M15 9.5h.01', 'M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Zm0 0 9 4.5m0 0 9-4.5M12 12v9', 'M12 3v18M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 1.6 2.6 4.5 3.3 4.5 1.6 4.5 3.4-2 3.3-4.5 3.3-4.5-1.4-4.5-3.3', 'M3 8.5V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.5a2.5 2.5 0 0 0 0 5V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3.5a2.5 2.5 0 0 0 0-5ZM14 5v14'].map((d) => (
              <svg key={d} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={d} />
              </svg>
            ))}
            <b>B</b>
            <i>I</i>
          </span>
        </div>
        </div>
        {/* A ficha do contato, como a coluna da direita do Inbox. */}
        <aside className={x.janelaFicha} aria-hidden>
          <span className={x.janelaFichaFoto}>
            <FotoDaPessoa nome="Marina Costa" />
          </span>
          <strong>Marina Costa</strong>
          <small>+55 44 9••••-4412</small>
          <span className={x.janelaFichaBloco} data-tom={transferiu ? 'equipe' : 'bot'}>
            <b>{transferiu ? 'Em atendimento' : 'Com o chatbot'}</b>
            {transferiu ? 'Júlia, pelo celular' : 'Fluxo de vendas'}
            {transferiu && <em>Finalizar atendimento</em>}
          </span>
          <dl>
            <div>
              <dt>Responsável</dt>
              <dd>
                {transferiu && <MiniFoto nome="Júlia Andrade" tamanho={16} />}
                {transferiu ? 'Júlia' : 'Chatbot'}
              </dd>
            </div>
            <div>
              <dt>Origem</dt>
              <dd>Anúncio · Instagram</dd>
            </div>
            <div>
              <dt>Falou por último</dt>
              <dd>agora</dd>
            </div>
          </dl>
          <small className={x.janelaFichaTitulo}>No funil</small>
          <span className={x.janelaFunil}>
            <small>Vendas</small>
            <b>{pago ? 'Ganho · R$ 268,80' : 'Proposta · R$ 268,80'}</b>
          </span>
          <small className={x.janelaFichaTitulo}>O que o fluxo coletou</small>
          <dl>
            <div>
              <dt>Interesse</dt>
              <dd>Fone bluetooth</dd>
            </div>
            <div>
              <dt>Cor</dt>
              <dd>Preto</dd>
            </div>
          </dl>
          <small className={x.janelaFichaTitulo}>Etiquetas</small>
          <span className={x.janelaEtiquetas}>
            <i>fone</i>
            <i>{pago ? 'comprou' : 'interessada'}</i>
          </span>
        </aside>
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
            <span className={x.aparelhoAvatar}>
              <FotoDaPessoa nome="Marina Costa" />
            </span>
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
 * A vitrine dos ramos na home: abas à esquerda, palco à direita com a foto do
 * ramo, o que vem pronto e a conversa do WhatsApp daquele ramo. Troca sozinha
 * a cada `TEMPO_POR_RAMO` enquanto está na tela; para no hover, no foco e com
 * movimento reduzido. A barra da aba ativa é o relógio dessa troca.
 */
const TEMPO_POR_RAMO = 8000

export function VitrineDeNichos() {
  const [ativo, setAtivo] = useState(0)
  const [parado, setParado] = useState(false)
  const [visivel, setVisivel] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const calmo = useMovimentoReduzido()
  const correndo = visivel && !parado && !calmo

  useEffect(() => {
    const el = raiz.current
    if (!el) return
    const o = new IntersectionObserver(([e]) => setVisivel(e!.isIntersecting), { threshold: 0.3 })
    o.observe(el)
    return () => o.disconnect()
  }, [])

  useEffect(() => {
    if (!correndo) return
    const r = window.setTimeout(() => setAtivo((a) => (a + 1) % NICHOS_DO_SITE.length), TEMPO_POR_RAMO)
    return () => window.clearTimeout(r)
  }, [ativo, correndo])

  const nicho = NICHOS_DO_SITE[ativo]!
  return (
    <div
      ref={raiz}
      className={x.vitrine}
      style={{ '--cor': nicho.cor, '--tempo': `${TEMPO_POR_RAMO}ms` } as CSSProperties}
      data-correndo={correndo || undefined}
      onPointerEnter={() => setParado(true)}
      onPointerLeave={() => setParado(false)}
      onFocus={() => setParado(true)}
      onBlur={() => setParado(false)}
    >
      <p className={x.vitrineDica}>Escolha o seu ramo</p>
      <div className={x.vitrineAbas} role="tablist" aria-label="Ramos">
        {NICHOS_DO_SITE.map((n, i) => (
          <button
            key={n.slug}
            type="button"
            role="tab"
            id={`aba-${n.slug}`}
            aria-selected={i === ativo}
            aria-controls="palco-dos-ramos"
            className={x.vitrineAba}
            style={{ '--cor': n.cor } as CSSProperties}
            onClick={() => setAtivo(i)}
          >
            <span className={x.vitrineCirculo}>
              <svg className={x.vitrineAnel} viewBox="0 0 140 140" aria-hidden>
                <circle cx="70" cy="70" r="68" pathLength={100} key={`${ativo}-${correndo}`} />
              </svg>
              <IlustracaoDoRamo slug={n.slug} />
            </span>
            <strong>{n.nome}</strong>
            <em>{n.quem}</em>
          </button>
        ))}
      </div>

      <div className={x.vitrinePalco} id="palco-dos-ramos" role="tabpanel" aria-labelledby={`aba-${nicho.slug}`}>
        <div className={x.vitrineTexto} key={nicho.slug}>
          <p className={x.vitrineQuem}>Para {nicho.nome.toLowerCase()}</p>
          <h3>{nicho.titulo}</h3>
          <p className={x.vitrineSub}>{nicho.subtitulo}</p>
          <dl className={x.vitrineNoApp}>
            {nicho.noApp.map((item, i) => (
              <div key={item.titulo} style={{ '--i': i } as CSSProperties}>
                <dt>{item.titulo}</dt>
                <dd>{item.texto}</dd>
              </div>
            ))}
          </dl>
          <Link href={`/segmentos/${nicho.slug}`} className={x.vitrineBotao}>
            Ver tudo para {nicho.nome.toLowerCase()}
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M2.5 6h7M6.5 3l3 3-3 3" />
            </svg>
          </Link>
        </div>

        <div className={x.vitrineCena}>
          <div className={x.vitrineApp} key={`app-${nicho.slug}`}>
            <div className={x.fichaBarra}>
              <i />
              <i />
              <i />
              <span>Automações · {nicho.nome}</span>
            </div>
            <div className={x.vitrineAppTopo}>
              <strong>Fluxos prontos</strong>
              <small>{nicho.modelos.slice(0, 4).length} publicados</small>
            </div>
            <ul>
              {nicho.modelos.slice(0, 4).map((m, i) => (
                <li key={m} style={{ '--i': i } as CSSProperties}>
                  <span className={x.vitrineAppFios} aria-hidden>
                    <i />
                    <i />
                  </span>
                  <span>{m}</span>
                  <b className={x.vitrineChave} aria-label="Ligado" />
                </li>
              ))}
            </ul>
          </div>
          <div className={x.vitrineConversa} key={`conversa-${nicho.slug}`}>
            <PreviaWhatsApp conversa={CONVERSAS[nicho.conversas[0]!]} />
          </div>
        </div>
      </div>
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
