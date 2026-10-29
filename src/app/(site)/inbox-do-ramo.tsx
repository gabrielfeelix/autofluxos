'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useMovimentoReduzido } from './pecas-interativas'
import { TituloComCanal } from './titulo-com-canal'
import r from './inbox-do-ramo.module.css'
import s from './pagina-inicial.module.css'

/*
 * O Inbox fazendo o trabalho do ramo, com os botões que existem de verdade:
 * na loja, a barra do campo de resposta (`components/lead/responder.tsx`:
 * produto, pedido, cobrar e cupom); nas aulas, o cartão "Na Verandi" da ficha
 * (`components/lead/aluno-da-verandi.tsx` e `marcar-aula-na-verandi.tsx`).
 * Frete não aparece: no Inbox não há botão de frete, quem calcula é a IA.
 *
 * Cada etapa é uma sequência curta (o botão é tocado, o menu abre, a escolha,
 * o envio). Anda sozinha 1 s depois de aparecer; o clique numa etapa para o
 * automático e toca só aquela. Sem movimento, fica no fim, tudo enviado.
 */

// A primeira fase é a da pergunta da cliente: tempo de ler antes de a equipe tocar no botão.
const TEMPOS = [1400, 1500, 1000, 2200]
const ULTIMA_FASE = TEMPOS.length - 1

function useRoteiro(etapas: number) {
  const [etapa, setEtapa] = useState(0)
  const [fase, setFase] = useState(0)
  const [parado, setParado] = useState(false)
  const [visivel, setVisivel] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const calmo = useMovimentoReduzido()

  useEffect(() => {
    const el = raiz.current
    if (!el || calmo) return
    const o = new IntersectionObserver(([e]) => setVisivel(e!.isIntersecting), { threshold: 0.3 })
    o.observe(el)
    return () => o.disconnect()
  }, [calmo])

  useEffect(() => {
    if (!visivel) return
    if (fase === ULTIMA_FASE && parado) return
    const t = window.setTimeout(() => {
      if (fase < ULTIMA_FASE) setFase(fase + 1)
      else {
        setFase(0)
        setEtapa((etapa + 1) % etapas)
      }
    }, TEMPOS[fase])
    return () => window.clearTimeout(t)
  }, [etapa, fase, visivel, parado, etapas])

  const escolher = (i: number) => {
    setParado(true)
    setEtapa(i)
    setFase(0)
  }
  // Sem movimento: a última etapa, já enviada.
  return calmo && !parado ? { etapa: etapas - 1, fase: ULTIMA_FASE, escolher, raiz } : { etapa, fase, escolher, raiz }
}

function Janela({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className={r.janela}>
      <div className={r.barra}>
        <i />
        <i />
        <i />
        <span>autofluxos.4yu.com.br/inbox</span>
      </div>
      <div className={r.topo}>
        <span className={r.avatar}>MC</span>
        <span>
          <strong>Marina Costa</strong>
          <small>
            <TituloComCanal texto={titulo} tamanho={12} />
          </small>
        </span>
        <em>Atendida por Ana</em>
      </div>
      {children}
    </div>
  )
}

function Etapas({ rotulos, etapa, escolher }: { rotulos: string[]; etapa: number; escolher: (i: number) => void }) {
  return (
    <div className={r.etapas} role="tablist" aria-label="Etapas">
      {rotulos.map((rotulo, i) => (
        <button key={rotulo} type="button" role="tab" aria-selected={i === etapa} data-feito={i < etapa || undefined} onClick={() => escolher(i)}>
          {rotulo}
        </button>
      ))}
    </div>
  )
}

const Visto = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
)

/* ═══════════ loja: produto, cupom, cobrança e pedido sem sair da conversa ═══════════ */

const FERRAMENTAS = [
  { chave: 'produto', rotulo: 'Mandar produto', d: 'M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Zm0 0 9 4.5m0 0 9-4.5M12 12v9' },
  { chave: 'cupom', rotulo: 'Mandar cupom', d: 'M3 8.5V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.5a2.5 2.5 0 0 0 0 5V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3.5a2.5 2.5 0 0 0 0-5ZM14 5v14' },
  { chave: 'cobrar', rotulo: 'Cobrar', d: 'M12 3v18M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 1.6 2.6 4.5 3.3 4.5 1.6 4.5 3.4-2 3.3-4.5 3.3-4.5-1.4-4.5-3.3' },
  { chave: 'pedido', rotulo: 'Status do pedido', d: 'M3 6h11v10H3zM14 9.5h4l3 3.5V16h-7M7 19a1.8 1.8 0 1 0 0-.1M17.5 19a1.8 1.8 0 1 0 0-.1' },
] as const

const PRODUTOS = [
  { nome: 'Fone Over-ear Bluetooth', preco: 'R$ 249,90', estoque: '7 em estoque', foto: '/fotos-do-site/fone.webp' },
  { nome: 'Fone In-ear Sport', preco: 'R$ 129,90', estoque: '12 em estoque' },
  { nome: 'Fone Gamer com microfone', preco: 'R$ 289,90', estoque: '3 em estoque' },
]

export function InboxQueVende() {
  const { etapa, fase, escolher, raiz } = useRoteiro(FERRAMENTAS.length)
  const enviado = (e: number) => e < etapa || (e === etapa && fase === ULTIMA_FASE)
  // Cada envio responde a uma pergunta: ela chega no começo da etapa, antes do menu abrir.
  const perguntou = (e: number) => e <= etapa
  const nova = (e: number) => (e === etapa && fase === 0) || undefined
  const aberto = fase === 1 || fase === 2
  const escolhendo = fase === 2

  return (
    <div ref={raiz} className={r.peca}>
      <Janela titulo="WhatsApp · +55 41 9••••-2208">
        <div className={r.conversa} aria-hidden>
          <span className={r.fala} data-de="cliente">
            Oi! Vocês têm fone bluetooth até uns R$ 300?
          </span>
          {enviado(0) && (
            <>
              <span className={`${r.fala} ${r.cartao}`} data-de="equipe" data-novo={etapa === 0 || undefined}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/fotos-do-site/fone.webp" alt="" width={240} height={110} />
                <b>Fone Over-ear Bluetooth</b>
                R$ 249,90 · preto, 7 em estoque
                <em>Ver produto</em>
              </span>
            </>
          )}
          {perguntou(1) && (
            <span className={r.fala} data-de="cliente" data-novo={nova(1)}>
              Esse preto! Tem algum desconto?
            </span>
          )}
          {enviado(1) && (
            <span className={`${r.fala} ${r.cupom}`} data-de="equipe" data-novo={etapa === 1 || undefined}>
              <small>Cupom</small>
              <b>BEMVINDO10</b>
              10% de desconto na primeira compra
            </span>
          )}
          {perguntou(2) && (
            <span className={r.fala} data-de="cliente" data-novo={nova(2)}>
              Ótimo, quero esse! Como eu pago?
            </span>
          )}
          {enviado(2) && (
            <span className={`${r.fala} ${r.cobranca}`} data-de="equipe" data-novo={etapa === 2 || undefined}>
              <b>Pedido · R$ 224,91</b>
              1x Fone Over-ear preto · entrega
              <em>Pagar com Pix ou cartão</em>
              <span className={r.pago}>
                <Visto /> Pago
              </span>
            </span>
          )}
          {perguntou(3) && (
            <span className={r.fala} data-de="cliente" data-novo={nova(3)}>
              Paguei! Quando chega?
            </span>
          )}
          {enviado(3) && (
            <span className={`${r.fala} ${r.rastreio}`} data-de="equipe" data-novo={etapa === 3 || undefined}>
              <b>Pedido #1042</b>
              <span>✅ Confirmado</span>
              <span>✅ Separado</span>
              <span>🔵 Enviado</span>
              <span>⚪ Entregue</span>
              <em>Rastrear entrega</em>
            </span>
          )}
        </div>

        <div className={r.campo}>
          {aberto && <Menu etapa={etapa} escolhendo={escolhendo} />}
          <div className={r.ferramentas}>
            {FERRAMENTAS.map((f, i) => (
              <span key={f.chave} className={r.ferramenta} data-ativa={i === etapa && fase < ULTIMA_FASE ? '' : undefined} title={f.rotulo}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={f.d} />
                </svg>
                {i === etapa && fase === 0 && <small className={r.dica}>{f.rotulo}</small>}
              </span>
            ))}
          </div>
          <span className={r.escreva}>Escreva para Marina...</span>
        </div>
      </Janela>
      <Etapas rotulos={FERRAMENTAS.map((f) => f.rotulo)} etapa={etapa} escolher={escolher} />
    </div>
  )
}

/** O menu que abre acima da barra, com os textos das telas reais. */
function Menu({ etapa, escolhendo }: { etapa: number; escolhendo: boolean }) {
  if (etapa === 0)
    return (
      <div className={r.menu} data-lado="0">
        <span className={r.busca}>
          fone<i className={r.caret} />
        </span>
        {PRODUTOS.map((p, i) => (
          <span key={p.nome} className={r.opcao} data-escolhida={escolhendo && i === 0 ? '' : undefined}>
            {p.foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.foto} alt="" width={36} height={36} />
            ) : (
              <i className={r.semFoto} />
            )}
            <span>
              <b>{p.nome}</b>
              {p.preco} · {p.estoque}
            </span>
          </span>
        ))}
      </div>
    )
  if (etapa === 1)
    return (
      <div className={r.menu} data-lado="1">
        <small className={r.menuTitulo}>Cupons da loja</small>
        {[
          ['BEMVINDO10', '10% na primeira compra'],
          ['FRETEGRATIS', 'Frete grátis acima de R$ 199'],
          ['VOLTA15', '15% para quem já comprou'],
        ].map(([codigo, regra], i) => (
          <span key={codigo} className={r.opcao} data-escolhida={escolhendo && i === 0 ? '' : undefined}>
            <span>
              <b>{codigo}</b>
              {regra}
            </span>
          </span>
        ))}
      </div>
    )
  if (etapa === 2)
    return (
      <div className={r.menu} data-lado="2">
        <small className={r.menuTitulo}>Cobrar nesta conversa</small>
        <span className={r.abas}>
          <b>Do catálogo</b>
          <span>Valor livre</span>
        </span>
        <span className={r.linhaConta}>
          1x Fone Over-ear preto <b>R$ 249,90</b>
        </span>
        <span className={r.linhaConta}>
          Cupom BEMVINDO10 <b>– R$ 24,99</b>
        </span>
        <span className={r.linhaConta} data-total>
          Total <b>R$ 224,91</b>
        </span>
        <span className={r.abas}>
          <span>Retirada</span>
          <b>Entrega</b>
        </span>
        <span className={r.botaoAzul} data-escolhida={escolhendo ? '' : undefined}>
          Enviar cobrança
        </span>
      </div>
    )
  return (
    <div className={r.menu} data-lado="3">
      <small className={r.menuTitulo}>Pedidos desta pessoa</small>
      <span className={r.opcao} data-escolhida={escolhendo ? '' : undefined}>
        <span>
          <b>#1042 · R$ 224,91</b>
          Pago · enviado hoje
        </span>
      </span>
      <span className={r.botaoAzul}>Enviar status na conversa</span>
    </div>
  )
}

/* ═══════════ aulas: a reposição marcada na Verandi pela ficha do Inbox ═══════════ */

const DIAS = [
  ['qua', '29/10'],
  ['qui', '30/10'],
  ['sex', '31/10'],
  ['sáb', '01/11'],
]
const HORAS = ['07:00', '12:00', '18:00', '19:00']

export function InboxQueAgenda() {
  const { etapa, fase, escolher, raiz } = useRoteiro(4)
  // A sequência inteira é uma linha do tempo: etapa e fase viram um passo só.
  const passo = etapa * TEMPOS.length + fase
  // 0-1 ficha e o toque em "Marcar reposição"; 2-9 o dia, a hora e o toque em
  // "Marcar"; 10-14 marcada e o toque em "Mandar confirmação"; 15 confirmada.
  const marcando = passo >= 2 && passo < 10
  const diaEscolhido = passo >= 5
  const horaEscolhida = passo >= 7
  const marcada = passo >= 10
  const confirmada = passo >= 15

  return (
    <div ref={raiz} className={r.peca}>
      <Janela titulo="WhatsApp · +55 41 9••••-5531">
        <div className={r.comFicha}>
          <div className={r.conversa} aria-hidden>
            <span className={r.fala} data-de="cliente">
              Oi! Perdi a aula de terça, consigo repor essa semana?
            </span>
            <span className={r.fala} data-de="cliente">
              Pode ser no fim da tarde
            </span>
            {confirmada && (
              <span className={`${r.fala} ${r.cupom}`} data-de="equipe" data-novo>
                <small>Reposição marcada</small>
                <b>Sexta, 31/10, às 18:00</b>
                Pilates · Studio Movimento. Te esperamos!
              </span>
            )}
          </div>
          <aside className={r.ficha} aria-hidden>
            <span className={r.fichaTitulo}>Na Verandi</span>
            <span className={r.fichaPlano}>Pilates · 2x por semana</span>
            <small className={r.menuTitulo}>Próximas aulas</small>
            <span className={r.aula}>qui 30/10 · 19:00</span>
            {marcada && (
              <span className={r.aula} data-nova>
                sex 31/10 · 18:00 <em>reposição</em>
              </span>
            )}
            {!marcando && !marcada && (
              <span className={r.botaoAzul} data-escolhida={passo === 1 ? '' : undefined}>
                Marcar reposição
              </span>
            )}
            {marcando && (
              <div className={r.agenda}>
                <span className={r.dias}>
                  {DIAS.map(([dia, data], i) => (
                    <span key={data} data-escolhida={diaEscolhido && i === 2 ? '' : undefined}>
                      <b>{dia}</b>
                      {data}
                    </span>
                  ))}
                </span>
                <span className={r.horas}>
                  {HORAS.map((h, i) => (
                    <span key={h} data-escolhida={horaEscolhida && i === 2 ? '' : undefined}>
                      {h}
                    </span>
                  ))}
                </span>
                <span className={r.botaoAzul} data-apagado={!horaEscolhida || undefined} data-escolhida={passo >= 8 ? '' : undefined}>
                  {horaEscolhida ? 'Marcar sex às 18:00' : 'Escolha um horário'}
                </span>
              </div>
            )}
            {marcada && (
              <span className={r.marcada}>
                <b>
                  <Visto /> Reposição marcada
                </b>
                {confirmada ? (
                  <em>Confirmação enviada na conversa.</em>
                ) : (
                  <span className={r.botaoClaro} data-escolhida={passo >= 13 ? '' : undefined}>
                    Mandar confirmação na conversa
                  </span>
                )}
              </span>
            )}
          </aside>
        </div>
      </Janela>
      <Etapas rotulos={['Abrir a ficha', 'Escolher o horário', 'Marcar na Verandi', 'Confirmar na conversa']} etapa={etapa} escolher={escolher} />
    </div>
  )
}

/* ═══════════ a seção, com a cabeça e o palco da cor do ramo ═══════════ */

const PECAS: Record<string, { olho: string; titulo: string; texto: string; peca: () => ReactNode }> = {
  'loja-virtual': {
    olho: 'No Inbox',
    titulo: 'Produto, cupom e cobrança a um clique da conversa',
    texto: 'A equipe busca o produto pelo nome, manda o card com foto e preço, aplica o cupom e cobra sem sair do chat. Depois, o status do pedido vai na mesma conversa.',
    peca: () => <InboxQueVende />,
  },
  comercio: {
    olho: 'No Inbox',
    titulo: 'Produto, cupom e cobrança a um clique da conversa',
    texto: 'O catálogo da loja dentro do Inbox: o atendente acha o produto, manda o card, aplica o cupom e cobra com retirada ou entrega.',
    peca: () => <InboxQueVende />,
  },
  'aulas-e-horarios': {
    olho: 'No Inbox, com a Verandi',
    titulo: 'A aula marcada pela ficha, sem abrir outra tela',
    texto: 'O aluno pede a reposição no WhatsApp. Na ficha da conversa a equipe vê as próximas aulas, escolhe o dia e a hora com vaga e manda a confirmação.',
    peca: () => <InboxQueAgenda />,
  },
}

/** A seção da página do ramo; nos ramos sem roteiro, nada. */
export function SecaoInboxDoRamo({ slug }: { slug: string }) {
  const p = PECAS[slug]
  if (!p) return null
  return (
    <section className={s.secao}>
      <div className={`${s.faixa} ${s.cabecaSecao}`}>
        <span className={s.olho} data-revela>
          {p.olho}
        </span>
        <h2 className={`${s.tituloSecao} ${s.tituloSecaoCentro}`} data-revela data-como="desfoque" data-atraso="60">
          {p.titulo}
        </h2>
        <p className={`${s.chamada} ${s.chamadaCentro}`} data-revela data-atraso="100">
          {p.texto}
        </p>
      </div>
      <div className={r.palco} data-revela data-como="escala">
        {p.peca()}
      </div>
    </section>
  )
}
