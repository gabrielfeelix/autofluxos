'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { GLIFO_INSTAGRAM, GLIFO_TELEGRAM, GLIFO_WHATSAPP } from '@/components/design/glifos-oficiais'
import { CONVERSAS, PreviaWhatsApp } from './previa-whatsapp'
import m from './menu-do-topo.module.css'

/*
 * O menu do topo com painéis flutuantes (pedido do Gabriel, 28/out/2026, a
 * partir do Zipchat e do Agendor). Três referências, três formas:
 *
 * - **Produto** é o painel "AI platform" do Zipchat: lista com ícone, uma
 *   coluna cinza de recursos, um cartão de chamada e o rodapé "Funciona com".
 * - **Canais** são os cartões por canal do Zipchat, cada um com três fatos.
 * - **Segmentos** é o menu do Agendor: duas colunas, título e uma linha.
 *
 * **Um painel só, que muda de forma.** Passar de um item para o outro não fecha
 * e reabre: a moldura fica e acompanha a altura do conteúdo novo, como no menu
 * da Stripe. É o que faz a navegação parecer uma peça, e não três janelas.
 *
 * Abre no mouse e no teclado (Enter ou espaço no botão), fecha com Esc, com o
 * mouse saindo (com uma folga, para a diagonal até o painel não fechar) e com
 * clique fora. No celular vira uma folha de tela cheia (no `body`, porque o
 * `backdrop-filter` do cabeçalho prenderia um `fixed` dentro dele), com as
 * mesmas três partes, fechar no topo e Entrar e Ver planos no pé.
 */

type Chave = 'produto' | 'canais' | 'segmentos'

const ITENS: { chave: Chave; rotulo: string }[] = [
  { chave: 'produto', rotulo: 'Produto' },
  { chave: 'canais', rotulo: 'Canais' },
  { chave: 'segmentos', rotulo: 'Segmentos' },
]

const PRODUTO = [
  { titulo: 'Fluxos e chatbot', texto: 'Blocos que você arrasta, liga e testa na hora.', href: '#fluxo', icone: <IconeFluxo /> },
  { titulo: 'IA que lê o seu negócio', texto: 'Responde pelo catálogo e pelas regras. Sem resposta, chama a equipe.', href: '#segmentos', icone: <IconeIA /> },
  { titulo: 'Inbox da equipe', texto: 'Todas as conversas numa fila, com a ficha do cliente ao lado.', href: '#como', icone: <IconeInbox /> },
  { titulo: 'Contatos e funil', texto: 'Etiquetas, etapas e negócios de cada cliente.', href: '#como', icone: <IconeContatos /> },
  { titulo: 'Transmissões', texto: 'Campanhas com modelo aprovado pela Meta e retorno por contato.', href: '#precos', icone: <IconeTransmissao /> },
]

const RECURSOS = [
  'Áudio transcrito no Inbox',
  'Pedido e Pix dentro da conversa',
  'Agenda com lembrete e confirmação',
  'De qual anúncio veio cada venda',
  'Respostas prontas para a equipe',
  'Relatórios de atendimento e vendas',
]

const FUNCIONA_COM = [
  { nome: 'Magento', src: '/marcas-de-loja/magento.svg' },
  { nome: 'Nuvemshop', src: '/marcas-de-loja/nuvemshop.png' },
  { nome: 'Asaas', src: '/logos/marcas/asaas.png' },
  { nome: 'Mercado Pago', src: '/logos/marcas/mercadopago.svg' },
  { nome: 'Goomer', src: '/marcas-de-cardapio/goomer.png' },
]

const CANAIS = [
  {
    nome: 'WhatsApp',
    cor: '#25d366',
    glifo: GLIFO_WHATSAPP,
    linha: 'No número que já está no seu cartão.',
    fatos: ['Continua no app do celular', 'Áudio vira texto no Inbox', 'Transmissões com modelo aprovado'],
  },
  {
    nome: 'Instagram',
    cor: '#e4405f',
    glifo: GLIFO_INSTAGRAM,
    linha: 'Direct e menções em story.',
    fatos: ['Foto, áudio e vídeo', 'Respostas com botões', 'Na mesma fila do WhatsApp'],
  },
  {
    nome: 'Chat do site',
    cor: '#6366f1',
    linha: 'Uma linha de código e o chat está na página.',
    fatos: ['Cor, saudação e mascote seus', 'Formulário de contato', 'Ligação de voz do visitante'],
  },
  {
    nome: 'Telegram',
    cor: '#26a5e4',
    glifo: GLIFO_TELEGRAM,
    linha: 'Conecta com o token do BotFather.',
    fatos: ['O mesmo fluxo dos outros canais', 'Conversa particular com o bot', 'Na mesma fila da equipe'],
  },
]

// Na mesma ordem de `CONVERSAS` (`previa-whatsapp.tsx`): a linha com o mouse
// mostra a conversa daquele segmento no cartão ao lado.
const SEGMENTOS = [
  {
    titulo: 'Lojas virtuais',
    texto: 'Estoque, frete e pedido respondidos na conversa.',
  },
  {
    titulo: 'Saúde e clínicas',
    texto: 'Agenda, confirmação e lembrete de consulta.',
  },
  {
    titulo: 'Estúdios e academias',
    texto: 'Aula experimental, horários e aluno que sumiu.',
  },
  {
    titulo: 'Restaurantes e delivery',
    texto: 'Cardápio com botões e pedido com Pix.',
  },
  {
    titulo: 'Serviços com hora marcada',
    texto: 'Orçamento, visita e reagendamento.',
  },
  {
    titulo: 'Pós-venda',
    texto: 'Status do pedido, rastreio e pesquisa de satisfação.',
  },
]

export function MenuDoTopo({ classeItem, hrefEntrar }: { classeItem?: string; hrefEntrar: string }) {
  const [aberto, setAberto] = useState<Chave | null>(null)
  // O último aberto continua desenhado enquanto o painel some, senão a moldura
  // esvazia antes de terminar de apagar.
  const [ultimo, setUltimo] = useState<Chave>('produto')
  const [folha, setFolha] = useState(false)
  const [altura, setAltura] = useState<number>()
  const raiz = useRef<HTMLDivElement>(null)
  const conteudo = useRef<HTMLDivElement>(null)
  const fechar = useRef<number>(0)

  // A moldura acompanha a altura do conteúdo aberto.
  useEffect(() => {
    const el = conteudo.current
    if (!el) return
    const medir = () => setAltura(el.offsetHeight)
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(el)
    return () => observador.disconnect()
  }, [ultimo])

  // A folha cobre a tela: a página de trás não rola junto.
  useEffect(() => {
    if (!folha) return
    const raizDoc = document.documentElement
    raizDoc.style.overflow = 'hidden'
    return () => {
      raizDoc.style.overflow = ''
    }
  }, [folha])

  useEffect(() => {
    if (!aberto && !folha) return
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAberto(null)
        setFolha(false)
      }
    }
    const fora = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(null)
    }
    window.addEventListener('keydown', tecla)
    window.addEventListener('pointerdown', fora)
    return () => {
      window.removeEventListener('keydown', tecla)
      window.removeEventListener('pointerdown', fora)
    }
  }, [aberto, folha])

  const entrar = (chave: Chave) => {
    window.clearTimeout(fechar.current)
    setAberto(chave)
    setUltimo(chave)
  }
  const sair = () => {
    window.clearTimeout(fechar.current)
    fechar.current = window.setTimeout(() => setAberto(null), 160)
  }
  const escolheu = () => {
    setAberto(null)
    setFolha(false)
  }

  return (
    <div ref={raiz} className={m.raiz} onPointerLeave={sair} onPointerEnter={() => window.clearTimeout(fechar.current)}>
      <nav className={m.menu} aria-label="Principal">
        {ITENS.map((item) => (
          <button
            key={item.chave}
            type="button"
            className={`${classeItem} ${m.gatilho}`}
            aria-expanded={aberto === item.chave}
            aria-controls="painel-do-topo"
            data-ativo={aberto === item.chave ? '' : undefined}
            onPointerEnter={(e) => e.pointerType === 'mouse' && entrar(item.chave)}
            onClick={() => {
              setUltimo(item.chave)
              setAberto((a) => (a === item.chave ? null : item.chave))
            }}
          >
            {item.rotulo}
            <IconeSeta />
          </button>
        ))}
        <a className={classeItem} href="#integracoes" onPointerEnter={sair}>
          Integrações
        </a>
        <a className={classeItem} href="#precos" onPointerEnter={sair}>
          Preços
        </a>
      </nav>

      <div
        id="painel-do-topo"
        className={m.painel}
        data-aberto={aberto ? '' : undefined}
        style={{ height: altura }}
        onClick={(e) => (e.target as HTMLElement).closest('a') && escolheu()}
      >
        <div ref={conteudo} key={ultimo} className={m.conteudo}>
          {ultimo === 'produto' && <PainelProduto />}
          {ultimo === 'canais' && <PainelCanais />}
          {ultimo === 'segmentos' && <PainelSegmentos />}
        </div>
      </div>

      <button
        type="button"
        className={m.abrirFolha}
        aria-expanded={folha}
        aria-controls="folha-do-topo"
        aria-label={folha ? 'Fechar menu' : 'Abrir menu'}
        onClick={() => setFolha((f) => !f)}
      >
        <i />
        <i />
      </button>

      {folha &&
        createPortal(
          <div
            id="folha-do-topo"
            className={m.folha}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            onClick={(e) => (e.target as HTMLElement).closest('a') && escolheu()}
          >
            <div className={m.folhaTopo}>
              <a href="#" className={m.folhaMarca}>
                <span>
                  <IconeFluxo />
                </span>
                AutoFluxos
              </a>
              <button type="button" className={m.fecharFolha} aria-label="Fechar menu" onClick={() => setFolha(false)} autoFocus>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden {...traco} strokeWidth={2}>
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <div className={m.folhaCorpo}>
              <Grupo titulo="Produto">
                {PRODUTO.map((p) => (
                  <a key={p.titulo} href={p.href} className={m.linhaFolha}>
                    <span className={m.icone}>{p.icone}</span>
                    <span>
                      <strong>{p.titulo}</strong>
                      <small>{p.texto}</small>
                    </span>
                  </a>
                ))}
              </Grupo>

              <Grupo titulo="Canais">
                <div className={m.canaisFolha}>
                  {CANAIS.map((c) => (
                    <a key={c.nome} href="#fluxo" style={{ '--cor': c.cor } as CSSProperties}>
                      <MarcaDoCanal glifo={c.glifo} />
                      {c.nome}
                    </a>
                  ))}
                </div>
              </Grupo>

              <Grupo titulo="Segmentos">
                {SEGMENTOS.map((s) => (
                  <a key={s.titulo} href="#segmentos" className={m.linhaFolha}>
                    <span>
                      <strong>{s.titulo}</strong>
                      <small>{s.texto}</small>
                    </span>
                  </a>
                ))}
              </Grupo>

              <div className={m.folhaLinks}>
                <a href="#integracoes">Integrações</a>
                <a href="#precos">Preços</a>
                <a href="#duvidas">Dúvidas</a>
              </div>
            </div>

            <div className={m.folhaAcoes}>
              <a href={hrefEntrar} className={m.folhaEntrar}>
                Entrar
              </a>
              <a href="#precos" className={m.folhaPlanos}>
                Ver planos
              </a>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

function PainelProduto() {
  return (
    <div className={m.produto}>
      <div className={m.lista}>
        {PRODUTO.map((p) => (
          <a key={p.titulo} href={p.href} className={m.linhaProduto}>
            <span className={m.icone}>{p.icone}</span>
            <span>
              <strong>{p.titulo}</strong>
              <small>{p.texto}</small>
            </span>
          </a>
        ))}
      </div>

      <div className={m.recursos}>
        <p className={m.legenda}>Também no produto</p>
        <ul>
          {RECURSOS.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <a href="#como" className={m.mais}>
          Como funciona <IconeDireita />
        </a>
      </div>

      <a href="#precos" className={m.chamada}>
        <strong>Comece pelo seu WhatsApp</strong>
        <span>Montamos o primeiro fluxo com você, no número que você já usa.</span>
        <em>Ver planos</em>
      </a>

      <div className={m.rodape}>
        <span className={m.legenda}>Funciona com</span>
        <span className={m.logos}>
          {FUNCIONA_COM.map((l) => (
            <span key={l.nome}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={l.src} alt="" width={18} height={18} />
              {l.nome}
            </span>
          ))}
        </span>
        <a href="#integracoes" className={m.mais}>
          Todas as integrações <IconeDireita />
        </a>
      </div>
    </div>
  )
}

function PainelCanais() {
  return (
    <div className={m.canais}>
      {CANAIS.map((c) => (
        <a key={c.nome} href="#fluxo" className={m.cartaoCanal} style={{ '--cor': c.cor } as CSSProperties}>
          <span className={m.marcaCanal}>
            <MarcaDoCanal glifo={c.glifo} />
          </span>
          <strong>{c.nome}</strong>
          <small>{c.linha}</small>
          <ul>
            {c.fatos.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </a>
      ))}
    </div>
  )
}

function PainelSegmentos() {
  const [i, setI] = useState(0)
  return (
    <div className={m.segmentos}>
      <div className={m.gradeSegmentos}>
        {SEGMENTOS.map((s, n) => (
          <a
            key={s.titulo}
            href="#segmentos"
            className={m.linhaSegmento}
            data-atual={n === i ? '' : undefined}
            onPointerEnter={() => setI(n)}
            onFocus={() => setI(n)}
          >
            <strong>{s.titulo}</strong>
            <small>{s.texto}</small>
          </a>
        ))}
      </div>
      <div className={m.previa} aria-hidden>
        <p className={m.legenda}>Como fica no WhatsApp do cliente</p>
        <PreviaWhatsApp key={i} conversa={CONVERSAS[i]!} />
      </div>
      <div className={m.rodape}>
        <a href="#segmentos" className={m.mais}>
          Ver os segmentos em ação <IconeDireita />
        </a>
      </div>
    </div>
  )
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className={m.grupo}>
      <p className={m.legenda}>{titulo}</p>
      {children}
    </div>
  )
}

function MarcaDoCanal({ glifo }: { glifo?: string }) {
  if (!glifo)
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="2.5" y="3.5" width="19" height="14" rx="2.5" />
        <path d="M2.5 7.5h19M8 21h8" />
      </svg>
    )
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d={glifo} />
    </svg>
  )
}

const traco = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

function Icone({ children }: { children: ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden {...traco}>
      {children}
    </svg>
  )
}

function IconeFluxo() {
  return (
    <Icone>
      <rect x="3" y="4" width="7" height="5" rx="1.5" />
      <rect x="14" y="15" width="7" height="5" rx="1.5" />
      <path d="M10 6.5h2.5a2 2 0 0 1 2 2v6.5" />
    </Icone>
  )
}

function IconeIA() {
  return (
    <Icone>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4 4v-4h-.5A1.5 1.5 0 0 1 4 14.5Z" />
      <path d="M12 7.5v5M9.5 10h5" />
    </Icone>
  )
}

function IconeInbox() {
  return (
    <Icone>
      <path d="M4 13.5 6.5 5h11l2.5 8.5V19H4Z" />
      <path d="M4 13.5h4.5l1 2h5l1-2H20" />
    </Icone>
  )
}

function IconeContatos() {
  return (
    <Icone>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M3 19.5c.6-3 3-4.5 6-4.5s5.4 1.5 6 4.5M16 5a3.5 3.5 0 0 1 0 7M18 15c1.6.6 2.6 2 3 4.5" />
    </Icone>
  )
}

function IconeTransmissao() {
  return (
    <Icone>
      <path d="M4 10v4h3l6 4V6L7 10Z" />
      <path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11" />
    </Icone>
  )
}

function IconeSeta() {
  return (
    <svg className={m.seta} width="10" height="10" viewBox="0 0 12 12" aria-hidden {...traco} strokeWidth={1.6}>
      <path d="m3 4.5 3 3 3-3" />
    </svg>
  )
}

function IconeDireita() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden {...traco} strokeWidth={1.6}>
      <path d="M2.5 6h7M6.5 3l3 3-3 3" />
    </svg>
  )
}
