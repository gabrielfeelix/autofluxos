'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CANAIS } from './canais-do-site'
import { IlustracaoDoRamo } from './ilustracoes-dos-ramos'
import { ITENS_DE_INTEGRACAO, type Grupo } from './integracoes-do-site'
import { NICHOS_DO_SITE } from './nichos-do-site'
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
 * clique fora.
 *
 * **No celular** vira uma folha de tela cheia por baixo da barra, como no
 * Linear e na Stripe: a barra fica no lugar e o botão de menu vira o X, sem um
 * segundo topo dentro da folha. As partes andam numa sanfona (uma aberta por
 * vez), para a primeira vista caber numa tela, e Entrar e Testar grátis ficam
 * presos no pé. A folha vai para dentro do `<header>` e não do `.cabecalhoInterno`:
 * o `backdrop-filter` da ilha prenderia um `fixed` dentro dela.
 */

type Chave = 'produto' | 'segmentos' | 'integracoes'
type Gaveta = 'produto' | 'canais' | 'segmentos'

// Tempo da saída da folha; o CSS (`saiFolha`) usa o mesmo.
const SAIDA_DA_FOLHA = 180

const ITENS: { chave: Chave; rotulo: string }[] = [
  { chave: 'produto', rotulo: 'Produto' },
  { chave: 'segmentos', rotulo: 'Segmentos' },
  { chave: 'integracoes', rotulo: 'Integrações' },
]

const PRODUTO = [
  { titulo: 'Fluxos e chatbot', texto: 'Blocos que você arrasta, liga e testa na hora.', href: '/produto/fluxos', icone: <IconeFluxo /> },
  { titulo: 'IA que lê o seu negócio', texto: 'Responde pelo catálogo e pelas regras. Sem resposta, chama a equipe.', href: '/produto/ia', icone: <IconeIA /> },
  { titulo: 'Inbox da equipe', texto: 'Todas as conversas numa fila, com a ficha do cliente ao lado.', href: '/produto/inbox', icone: <IconeInbox /> },
  { titulo: 'Contatos e funil', texto: 'Etiquetas, etapas e negócios de cada cliente.', href: '/produto/contatos-e-funil', icone: <IconeContatos /> },
  { titulo: 'Transmissões', texto: 'Campanhas com modelo aprovado pela Meta e retorno por contato.', href: '/produto/transmissoes', icone: <IconeTransmissao /> },
  { titulo: 'Relatórios', texto: 'Atendimento, vendas e custo do WhatsApp num painel.', href: '/produto/relatorios', icone: <IconeRelatorio /> },
]

const FUNCIONA_COM = [
  { nome: 'Magento', src: '/marcas-de-loja/magento.svg' },
  { nome: 'Nuvemshop', src: '/marcas-de-loja/nuvemshop.png' },
  { nome: 'Asaas', src: '/logos/marcas/asaas.png' },
  { nome: 'Mercado Pago', src: '/logos/marcas/mercadopago.svg' },
  { nome: 'Goomer', src: '/marcas-de-cardapio/goomer.png' },
]


// Os nichos do site (`nichos-do-site.ts`): a linha com o mouse mostra a
// primeira conversa daquele nicho no cartão ao lado.
const SEGMENTOS = NICHOS_DO_SITE.map((n) => ({
  titulo: n.nome,
  slug: n.slug,
  texto: n.quem,
  href: `/segmentos/${n.slug}`,
  cor: n.cor,
  conversa: CONVERSAS[n.conversas[0]!],
}))

export function MenuDoTopo({ classeItem, hrefEntrar }: { classeItem?: string; hrefEntrar: string }) {
  const [aberto, setAberto] = useState<Chave | null>(null)
  // O último aberto continua desenhado enquanto o painel some, senão a moldura
  // esvazia antes de terminar de apagar.
  const [ultimo, setUltimo] = useState<Chave>('produto')
  const [folha, setFolha] = useState(false)
  const [saindo, setSaindo] = useState(false)
  const [gaveta, setGaveta] = useState<Gaveta | null>(null)
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
        fecharFolha()
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
  function fecharFolha() {
    setSaindo(true)
    window.setTimeout(() => {
      setFolha(false)
      setSaindo(false)
      setGaveta(null)
    }, SAIDA_DA_FOLHA)
  }
  const escolheu = () => {
    setAberto(null)
    if (folha) fecharFolha()
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
        <a className={classeItem} href="/precos" onPointerEnter={sair}>
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
          {ultimo === 'segmentos' && <PainelSegmentos />}
          {ultimo === 'integracoes' && <PainelIntegracoes />}
        </div>
      </div>

      <button
        type="button"
        className={m.abrirFolha}
        aria-expanded={folha && !saindo}
        aria-controls="folha-do-topo"
        aria-label={folha && !saindo ? 'Fechar menu' : 'Abrir menu'}
        onClick={() => (folha ? fecharFolha() : setFolha(true))}
      >
        <i />
        <i />
      </button>

      {folha &&
        createPortal(
          <nav
            id="folha-do-topo"
            className={m.folha}
            aria-label="Menu"
            data-saindo={saindo || undefined}
            onClick={(e) => (e.target as HTMLElement).closest('a') && escolheu()}
          >
            <ul className={m.folhaLista}>
              <ItemDaSanfona chave="produto" rotulo="Produto" i={0} aberta={gaveta} alternar={setGaveta}>
                {PRODUTO.map((p) => (
                  <a key={p.titulo} href={p.href} className={m.linhaFolha}>
                    <span className={m.icone}>{p.icone}</span>
                    <span>
                      <strong>{p.titulo}</strong>
                      <small>{p.texto}</small>
                    </span>
                  </a>
                ))}
                <a href="/produto" className={m.folhaVerTudo}>
                  Ver o produto inteiro <IconeDireita />
                </a>
              </ItemDaSanfona>

              <ItemDaSanfona chave="canais" rotulo="Canais" i={1} aberta={gaveta} alternar={setGaveta}>
                <div className={m.canaisFolha}>
                  {CANAIS.map((c) => (
                    <a key={c.nome} href={`/canais/${c.slug}`} style={{ '--cor': c.cor } as CSSProperties}>
                      <MarcaDoCanal glifo={c.glifo} />
                      {c.nome}
                    </a>
                  ))}
                </div>
              </ItemDaSanfona>

              <ItemDaSanfona chave="segmentos" rotulo="Segmentos" i={2} aberta={gaveta} alternar={setGaveta}>
                {SEGMENTOS.map((sg) => (
                  <a key={sg.titulo} href={sg.href} className={m.linhaFolha} style={{ '--cor': sg.cor } as CSSProperties}>
                    <span className={m.pontoDoRamo} aria-hidden />
                    <span>
                      <strong>{sg.titulo}</strong>
                      <small>{sg.texto}</small>
                    </span>
                  </a>
                ))}
              </ItemDaSanfona>

              {[
                { rotulo: 'Integrações', href: '/integracoes' },
                { rotulo: 'Preços', href: '/precos' },
                { rotulo: 'Dúvidas', href: '/precos#duvidas' },
              ].map((l, i) => (
                <li key={l.href} style={{ '--i': i + 3 } as CSSProperties}>
                  <a href={l.href} className={m.folhaItem}>
                    {l.rotulo}
                    <span className={m.folhaSeta}>
                      <IconeDireita />
                    </span>
                  </a>
                </li>
              ))}
            </ul>

            <div className={m.folhaAcoes}>
              <a href={hrefEntrar} className={m.folhaEntrar}>
                Entrar
              </a>
              <a href="/precos" className={m.folhaPlanos}>
                Testar grátis
              </a>
            </div>
          </nav>,
          raiz.current?.closest('header') ?? document.body,
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

      <div className={m.ladoProduto}>
        <div className={m.canaisDoProduto}>
          <p className={m.legenda}>Canais, numa fila só</p>
          {CANAIS.map((c) => (
            <a key={c.slug} href={`/canais/${c.slug}`} className={m.linhaCanal} style={{ '--cor': c.cor } as CSSProperties}>
              <span>
                <MarcaDoCanal glifo={c.glifo} />
              </span>
              {c.nome}
            </a>
          ))}
          <Link href="/produto" className={m.mais}>
            Ver o produto inteiro <IconeDireita />
          </Link>
        </div>

        <a href="/precos" className={m.chamada}>
          <strong>Comece pelo seu WhatsApp</strong>
          <span>Montamos o primeiro fluxo com você, no número que você já usa.</span>
          <em>Ver planos</em>
        </a>
      </div>

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
        <a href="/integracoes" className={m.mais}>
          Todas as integrações <IconeDireita />
        </a>
      </div>
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
            href={s.href}
            className={m.cartaoSegmento}
            style={{ '--cor': s.cor } as CSSProperties}
            data-atual={n === i ? '' : undefined}
            onPointerEnter={() => setI(n)}
            onFocus={() => setI(n)}
          >
            <span className={m.circuloSegmento}>
              <IlustracaoDoRamo slug={s.slug} />
            </span>
            <span>
              <strong>{s.titulo}</strong>
              <small>{s.texto}</small>
            </span>
            <span className={m.setaSegmento} aria-hidden>
              <IconeDireita />
            </span>
          </a>
        ))}
      </div>
      <div className={m.previa} aria-hidden>
        <p className={m.legenda}>Como fica no WhatsApp do cliente</p>
        <PreviaWhatsApp key={i} conversa={SEGMENTOS[i]!.conversa} />
      </div>
      <div className={m.rodape}>
        <Link href="/#nichos" className={m.mais}>
          Ver todos os segmentos <IconeDireita />
        </Link>
      </div>
    </div>
  )
}

/*
 * As integrações por grupo, com a logo oficial de cada uma (`integracoes-do-site.tsx`).
 * Só o que já funciona entra na lista; o que vem depois aparece como contagem.
 */
const GRUPOS_DE_INTEGRACAO: { grupo: Grupo; titulo: string }[] = [
  { grupo: 'lojas', titulo: 'Lojas virtuais' },
  { grupo: 'pagamentos', titulo: 'Pagamentos' },
  { grupo: 'cardapios', titulo: 'Cardápios' },
  { grupo: 'canais', titulo: 'Canais e anúncios' },
]
const PRONTAS = ITENS_DE_INTEGRACAO.filter((i) => !i.emBreve)

function PainelIntegracoes() {
  return (
    <div className={m.integracoes}>
      {GRUPOS_DE_INTEGRACAO.map((g) => {
        const prontas = PRONTAS.filter((i) => i.grupo === g.grupo)
        const emBreve = ITENS_DE_INTEGRACAO.filter((i) => i.grupo === g.grupo && i.emBreve)
        return (
          <div key={g.grupo} className={m.grupoIntegracao}>
            <p className={m.legenda}>{g.titulo}</p>
            <ul>
              {prontas.slice(0, 5).map((i) => (
                <li key={i.nome}>
                  <span className={m.logoIntegracao}>{i.marca}</span>
                  <span>
                    <strong>{i.nome}</strong>
                    <small>{i.detalhe}</small>
                  </span>
                </li>
              ))}
            </ul>
            {prontas.length > 5 && <p className={m.maisIntegracoes}>e mais {prontas.length - 5}</p>}
            {emBreve.length > 0 && (
              <div className={m.emBreve}>
                <p className={m.legenda}>Em breve</p>
                <span>
                  {emBreve.map((i) => (
                    <span key={i.nome} className={m.logoIntegracao} title={i.nome}>
                      {i.marca}
                    </span>
                  ))}
                </span>
              </div>
            )}
          </div>
        )
      })}
      <div className={m.rodape}>
        <a href="/integracoes" className={m.mais}>
          Ver as {PRONTAS.length} integrações <IconeDireita />
        </a>
        <span className={m.legenda}>Não achou a sua? Na página dá para pedir.</span>
      </div>
    </div>
  )
}

/*
 * Uma linha da sanfona do celular. A gaveta abre por `grid-template-rows`
 * (0fr para 1fr), que anima até a altura do conteúdo sem medir nada; fechada,
 * fica `inert` para o Tab não entrar em link escondido.
 */
function ItemDaSanfona({
  chave,
  rotulo,
  i,
  aberta,
  alternar,
  children,
}: {
  chave: Gaveta
  rotulo: string
  i: number
  aberta: Gaveta | null
  alternar: (g: Gaveta | null) => void
  children: ReactNode
}) {
  const esta = aberta === chave
  return (
    <li style={{ '--i': i } as CSSProperties}>
      <button
        type="button"
        className={m.folhaItem}
        aria-expanded={esta}
        aria-controls={`gaveta-${chave}`}
        onClick={() => alternar(esta ? null : chave)}
      >
        {rotulo}
        <span className={m.folhaSeta}>
          <IconeSeta />
        </span>
      </button>
      <div id={`gaveta-${chave}`} className={m.gaveta} data-aberta={esta || undefined} inert={!esta}>
        <div className={m.gavetaMiolo}>{children}</div>
      </div>
    </li>
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

function IconeRelatorio() {
  return (
    <Icone>
      <path d="M4 20h16M7 16v-4M12 16V7M17 16v-6" />
    </Icone>
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
