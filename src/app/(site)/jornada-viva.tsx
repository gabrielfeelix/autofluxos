'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { GLIFO_INSTAGRAM, GLIFO_META } from '@/components/design/glifos-oficiais'
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

function Janela({ titulo, children, largura }: { titulo: string; children: ReactNode; largura?: number }) {
  return (
    <div className={x.jtJanela} style={largura ? { maxWidth: largura } : undefined}>
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

const Glifo = ({ d, cor, tamanho = 16 }: { d: string; cor: string; tamanho?: number }) => (
  <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill={cor} aria-hidden>
    <path d={d} />
  </svg>
)

const IconeSite = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="2.5" y="3.5" width="19" height="14" rx="2.5" />
    <path d="M2.5 7.5h19M8 21h8" />
  </svg>
)

const IconeFormulario = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0866ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="4" y="3" width="16" height="18" rx="2.5" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </svg>
)

const IconeLink = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </svg>
)

/** Um balão do WhatsApp, do lado do cliente (`ela`) ou da empresa (`nos`). */
function Balao({ de, hora, children }: { de: 'ela' | 'nos'; hora: string; children: ReactNode }) {
  return (
    <div className={x.jtWa} data-de={de}>
      {children}
      <time>{hora}</time>
    </div>
  )
}

const TELAS: ReactNode[] = [
  // 01 Captação de leads: quatro origens que desembocam no mesmo contato, com a origem anotada.
  <div key="1" className={x.jtCaptacao}>
    <ul className={x.jtOrigens}>
      {[
        { nome: 'Anúncio no Facebook', marca: <Glifo d={GLIFO_META} cor="#0866ff" /> },
        { nome: 'Direct do Instagram', marca: <Glifo d={GLIFO_INSTAGRAM} cor="#e4405f" /> },
        { nome: 'Chat do site', marca: <IconeSite /> },
        { nome: 'Formulário de cadastro', marca: <IconeFormulario /> },
      ].map((o, i) => (
        <li key={o.nome} style={{ '--i': i } as CSSProperties} data-ativa={i === 0 || undefined}>
          <span>{o.marca}</span>
          {o.nome}
        </li>
      ))}
    </ul>
    <svg className={x.jtFiosCaptacao} viewBox="0 0 60 200" preserveAspectRatio="none" aria-hidden>
      <path d="M0 25C30 25 30 100 60 100M0 75C30 75 30 100 60 100M0 125C30 125 30 100 60 100M0 175C30 175 30 100 60 100" />
    </svg>
    <Janela titulo="Contatos · lead novo" largura={230}>
      <div className={x.jtLead}>
        <span className={x.jtAvatarGrande}>MC</span>
        <strong>Marina Costa</strong>
        <small>(44) 9••••-4412</small>
        <dl>
          <div>
            <dt>Origem</dt>
            <dd>
              <Glifo d={GLIFO_META} cor="#0866ff" tamanho={12} /> Promoção de outubro
            </dd>
          </div>
          <div>
            <dt>Etapa</dt>
            <dd>Novo lead</dd>
          </div>
          <div>
            <dt>Interesse</dt>
            <dd>Fone de ouvido</dd>
          </div>
        </dl>
      </div>
    </Janela>
  </div>,

  // 02 Atendimento automático: a IA responde com o produto, em segundos.
  <Janela key="2" titulo="WhatsApp · Marina Costa">
    <div className={x.jtWhats}>
      <Balao de="ela" hora="10:41">
        Tem esse fone na cor preta?
      </Balao>
      <div className={x.jtWa} data-de="nos" data-rico>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/fotos-do-site/fone.webp" alt="" width={240} height={110} />
        <span>
          <b>Fone Over-ear Bluetooth</b>
          <br />
          R$ 249,90 · preto, 7 em estoque
        </span>
        <time>10:41</time>
        <em>
          <IconeLink /> Ver produto
        </em>
      </div>
      <div className={x.jtOpcoes}>
        <span>Comprar agora</span>
        <span>Ver outras cores</span>
      </div>
      <p className={x.jtRodapeIa}>
        <span className={x.jtPontoIa} /> Respondido pela IA em 4 segundos
      </p>
    </div>
  </Janela>,

  // 03 Atendimento da equipe: abas por setor e a conversa que chega com o histórico.
  <Janela key="3" titulo="Inbox · Vendas">
    <div className={x.jtSetores}>
      {[
        ['Vendas', 3],
        ['Suporte', 1],
        ['Financeiro', 2],
      ].map(([setor, n], i) => (
        <span key={String(setor)} data-ativo={i === 0 || undefined}>
          {setor} <b>{n}</b>
        </span>
      ))}
    </div>
    <div className={x.jtTransferencia}>
      <Visto /> Transferida do chatbot para <b>Vendas</b>, com o histórico
    </div>
    <div className={x.jtLinhas}>
      {[
        ['MC', 'Marina Costa', 'Queria tirar uma dúvida do tamanho', 'Ana assumiu', true],
        ['JP', 'Júlia Pereira', 'Dá para parcelar em 6x?', 'espera 2 min', false],
        ['TS', 'Tiago Souza', 'Vocês entregam em Maringá?', 'espera 5 min', false],
      ].map(([sigla, nome, texto, estado, destaque], i) => (
        <div key={String(sigla)} className={x.jtLinha} data-destaque={destaque || undefined} style={{ '--i': i } as CSSProperties}>
          <span className={x.jtAvatar}>{sigla}</span>
          <span>
            <strong>{nome}</strong>
            <small>{texto}</small>
          </span>
          <span className={x.jtEstado} data-espera={!destaque || undefined}>
            {estado}
          </span>
        </div>
      ))}
    </div>
  </Janela>,

  // 04 Funil de vendas: colunas com valor, e o cartão da Marina avançando.
  <Janela key="4" titulo="Negociações · Funil comercial">
    <div className={x.jtFunilTopo}>
      <strong>R$ 12.480</strong>
      <small>em negociação · 18 negócios</small>
    </div>
    <div className={x.jtFunil}>
      {[
        { coluna: 'Novo lead', total: 'R$ 3.120', cartoes: [['André Lima', 'R$ 480']] },
        { coluna: 'Proposta', total: 'R$ 5.940', cartoes: [] },
        { coluna: 'Ganho', total: 'R$ 3.420', cartoes: [['Rafael Souza', 'R$ 890']] },
      ].map((c, i) => (
        <div key={c.coluna} className={x.jtColuna}>
          <small>
            {c.coluna}
            <b>{c.total}</b>
          </small>
          {c.cartoes.map(([nome, valor]) => (
            <span key={nome} className={x.jtCartaoFantasma}>
              {nome}
              <b>{valor}</b>
            </span>
          ))}
          {i === 1 && (
            <span className={x.jtCartao}>
              <span className={x.jtCartaoTopo}>
                <span className={x.jtAvatar}>MC</span>
                <strong>Marina Costa</strong>
              </span>
              <b>R$ 268,80</b>
              <small>Responsável: Ana</small>
              <em>Próxima ação: mandar o link</em>
            </span>
          )}
        </div>
      ))}
    </div>
  </Janela>,

  // 05 Pagamento: o link na conversa e a confirmação do banco.
  <Janela key="5" titulo="WhatsApp · Marina Costa">
    <div className={x.jtWhats}>
      <div className={x.jtWa} data-de="nos" data-rico>
        <span className={x.jtLinkPreview}>
          <small>autofluxos.4yu.com.br/pagar</small>
          <b>Pedido #1042 · R$ 268,80</b>
          Pix ou cartão em até 6x
        </span>
        <span>Segue o link para pagar, Marina.</span>
        <time>10:44</time>
        <em>
          <IconeLink /> Pagar agora
        </em>
      </div>
      <Balao de="ela" hora="10:45">
        Pronto, paguei no Pix!
      </Balao>
      <div className={x.jtConfirmacao}>
        <span className={x.jtConfirmacaoIcone}>
          <Visto />
        </span>
        <span>
          <b>Pagamento aprovado</b>
          <small>Pix confirmado pelo banco · 10:45</small>
        </span>
        <b className={x.jtValor}>R$ 268,80</b>
      </div>
    </div>
  </Janela>,

  // 06 Entrega e rastreio: o aviso que o cliente recebe, com a foto do pedido.
  <Janela key="6" titulo="WhatsApp · aviso automático">
    <div className={x.jtWhats}>
      <div className={x.jtWa} data-de="nos" data-rico>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/fotos-do-site/fone.webp" alt="" width={240} height={90} />
        <span className={x.jtRastreio}>
          <b>🚚 Seu pedido está a caminho</b>
          Previsão de entrega: <b>sábado, 9h às 14h</b>
          {[
            ['✅', 'Pagamento aprovado', '10:45'],
            ['✅', 'Pedido separado', '14:20'],
            ['🔵', 'Saiu para entrega', 'agora'],
            ['⚪', 'Entregue', ''],
          ].map(([sinal, texto, hora], i) => (
            <i key={texto} style={{ '--i': i } as CSSProperties} data-atual={hora === 'agora' || undefined}>
              {sinal} {texto}
              <small>{hora}</small>
            </i>
          ))}
        </span>
        <time>14:32</time>
        <em>
          <IconeLink /> Rastrear entrega
        </em>
      </div>
    </div>
  </Janela>,

  // 07 Avaliação e recompra: a nota que volta, o comentário e o lembrete agendado.
  <Janela key="7" titulo="Pós-venda · Marina Costa">
    <div className={x.jtVolta}>
      <div className={x.jtNpsCaixa}>
        <small>De 0 a 10, quanto você indicaria a Ponto Som?</small>
        <span className={x.jtNps}>
          {Array.from({ length: 11 }, (_, i) => (
            <i key={i} data-nota={i === 10 || undefined}>
              {i}
            </i>
          ))}
        </span>
        <span className={x.jtComentario}>
          <span className={x.jtEstrelas} aria-hidden>
            ★★★★★
          </span>
          &quot;Chegou antes do prazo. Recomendo!&quot;
        </span>
      </div>
      <div className={x.jtAgenda}>
        <span className={x.jtAgendaIcone}>30</span>
        <span>
          <b>Lembrete de recompra agendado</b>
          <small>Daqui a 30 dias, com uma oferta para a próxima compra</small>
        </span>
      </div>
    </div>
  </Janela>,
]
