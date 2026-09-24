'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useEffect, useRef, useState, type FocusEvent, type MouseEvent, type ReactNode } from 'react'
import { BotaoDeTema, definirPreferencia, usePreferencia } from '@/components/design/tema'
import { Avatar } from '@/components/design/avatar'
import { usePerfil } from '@/components/conta/voce'
import { acesoDoCaminho, type Aceso } from './aba-do-caminho'
import { BarraDoCelular } from './barra-do-celular'
import { abaDaAdministracao, GRUPOS_DA_ADMINISTRACAO, EMBAIXO_DA_ADMINISTRACAO } from './secoes-da-administracao'

type Item = { chave: string; rotulo: string; href: string; icone: ReactNode; acesa?: boolean; contador?: ReactNode }

/** Um subitem pronto para desenhar: `href` já absoluto, contagem já resolvida (ou em `Suspense`). */
export type SubitemDaBarra = { id: string; rotulo: string; href: string; contador?: ReactNode }

/**
 * Uma seção da barra do cliente (plano de navegação de 24/set). `ponto` é o
 * aviso de que há número lá dentro, para quando a seção está fechada ou a barra
 * está recolhida e os números não aparecem.
 */
export type SecaoDaBarra = {
  chave: string
  rotulo: string
  icone: ReactNode
  solta?: boolean
  itens: SubitemDaBarra[]
  ponto?: ReactNode
}

/**
 * A barra é **uma só** para as duas áreas: o app da organização e a
 * administração da plataforma. A administração passa `itens` e se agrupa por
 * `GRUPOS_DA_ADMINISTRACAO`; a organização passa `secoes`, com subitens em
 * sanfona. A diferença vem por dado (`area`, `secoes`), e não por função: a
 * barra é componente de cliente e a moldura que a desenha é de servidor, e
 * função não atravessa essa fronteira.
 */
export function BarraLateral({ base, area = 'cliente', itens: itensRecebidos = [], secoes, aceso: acesoRecebido, recolhidaInicial = false, eu, marca, voltar, voltarHref, voltarRotulo, rodape, presenca, conta, contaNoTopo, carregando = false }: {
  /** Qual das duas barras: a da organização ou a da administração. */
  area?: 'cliente' | 'administracao'
  /** O texto do link de volta na gaveta do celular. */
  voltarRotulo?: string
  /**
   * O começo do endereço da conta (`/clientes/<id>`). Com ele, o item aceso sai
   * do caminho, e a barra, que mora no layout, acompanha a navegação sem ser
   * desenhada de novo. Sem ele (o esqueleto), vale o `acesa` de cada item.
   */
  base?: string
  marca: ReactNode
  voltar: ReactNode | null
  /** O mesmo "‹ Administração" de `voltar`, para a gaveta do celular. */
  voltarHref?: string
  /** Os itens planos da administração. */
  itens?: Item[]
  /** As seções da organização, com subitens. */
  secoes?: SecaoDaBarra[]
  /** O item aceso quando não há `base` para descobrir pelo caminho (o esqueleto). */
  aceso?: Aceso
  /** O id de quem olha, para "Minhas conversas" acender também com `?de=<id>`. */
  eu?: string
  /** O que o cookie diz, lido no servidor, para a hidratação não piscar. */
  recolhidaInicial?: boolean
  rodape: ReactNode
  presenca?: string
  /**
   * O nome da conta em que se está trabalhando, para o rótulo acessível.
   *
   * A conta **subiu para o topo** (`contaNoTopo`, logo abaixo da marca) e o
   * rodapé passou a mostrar a pessoa (tarefa 7.5): o rodapé dizia o nome da
   * empresa e nunca quem estava usando. A pergunta "estou na conta certa?"
   * continua respondida sem abrir nada, só em outro lugar.
   */
  conta?: string
  /** A linha da conta no topo da barra, no computador. */
  contaNoTopo?: ReactNode
  carregando?: boolean
}) {
  const caminho = usePathname()
  const busca = useSearchParams()
  const abaAcesa = base && area === 'administracao' ? abaDaAdministracao(caminho) : null
  const aceso = base && area === 'cliente' ? acesoDoCaminho(caminho, base, busca, eu) : (acesoRecebido ?? null)
  const itens = base ? itensRecebidos.map((item) => ({ ...item, acesa: item.chave === abaAcesa })) : itensRecebidos
  const recolhida = usePreferencia('barra', recolhidaInicial)
  const painel = useRef<HTMLDialogElement>(null)
  const disponivel = presenca === 'disponivel'
  const perfil = usePerfil()
  const dica = useDica()
  const nomeNoBotao = perfil?.nome ?? 'Você'
  const rotuloConta = `Você: ${nomeNoBotao}${conta ? `, na organização ${conta}` : ''}${presenca ? ` · ${disponivel ? 'Disponível' : 'Ausente'}` : ''}`
  const link = (item: Item) => (
    <Link key={item.chave} href={item.href} aria-disabled={carregando || undefined} tabIndex={carregando ? -1 : undefined} onClick={(event) => { if (carregando) event.preventDefault() }} aria-current={item.acesa ? 'page' : undefined} aria-label={item.rotulo} {...(recolhida ? dica.gatilho(item.rotulo) : {})}
      className={`relative flex shrink-0 items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-[13px] font-semibold transition ${recolhida ? 'size-10 justify-center px-0' : ''} ${item.acesa ? 'bg-primary-weak text-primary' : 'text-muted hover:bg-surface hover:text-ink'}`}>
      <span aria-hidden className={item.acesa ? 'text-primary' : 'text-dim'}>{item.icone}</span>
      <span className={recolhida ? 'hidden' : ''}>{item.rotulo}</span>
      {item.contador && <span className={recolhida ? 'absolute -right-1 -top-1' : 'ml-auto'}>{item.contador}</span>}
    </Link>
  )
  const contaButton = () => (
    <button type="button" disabled={carregando} onClick={() => painel.current?.showModal()} aria-label={rotuloConta} {...(recolhida ? dica.gatilho(nomeNoBotao) : {})}
      className={`flex items-center gap-2 rounded-[10px] p-2 text-left hover:bg-surface w-full ${recolhida ? 'justify-center' : ''}`}>
      <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full text-muted">
        {perfil ? <Avatar nome={perfil.nome} imagem={perfil.imagem} tamanho={32} /> : <span className="flex size-8 items-center justify-center rounded-full border border-line"><svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg></span>}
        {presenca && <span className={`absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-panel ${disponivel ? 'bg-emerald-500' : 'bg-dim'}`} />}
      </span>
      {!recolhida && <span className="min-w-0"><span className="block truncate text-xs font-semibold">{nomeNoBotao}</span><span className="block text-[11px] text-dim">{presenca ? (disponivel ? 'Disponível' : 'Ausente') : 'Perfil e preferências'}</span></span>}
    </button>
  )
  return (
    <>
    {/*
      No celular a barra lateral não aparece: o topo, a gaveta e a barra de
      baixo moram em `BarraDoCelular`. A faixa de abas que rolava de lado (5.8)
      saiu junto: cinco atalhos fixos e uma gaveta cabem em qualquer largura.
    */}
    <BarraDoCelular base={area === 'cliente' ? base : undefined} secoes={secoes} aceso={aceso} embaixo={area === 'administracao' ? EMBAIXO_DA_ADMINISTRACAO : undefined} voltarRotulo={voltarRotulo} rotuloDaNavegacao={area === 'administracao' ? 'Administração' : undefined} itens={itens} contaNoTopo={contaNoTopo} voltarHref={voltarHref} presenca={presenca} carregando={carregando} aoAbrirVoce={() => painel.current?.showModal()} />
    <aside className={`hidden shrink-0 flex-col border-r border-line bg-panel py-4 md:flex ${recolhida ? 'w-[68px] px-2.5' : 'w-[226px] px-3.5'}`}>
      {recolhida ? (
        // Recolhida, a logo é o botão de abrir: passando o mouse, o símbolo
        // dá lugar ao ícone de expandir, como na Brevo.
        <button type="button" onClick={() => { dica.esconder(); definirPreferencia('barra', false) }} aria-label="Expandir a barra lateral" aria-expanded={false} {...dica.gatilho('Expandir menu')}
          className="group relative mx-auto mb-5 flex size-10 shrink-0 items-center justify-center rounded-[10px] transition hover:bg-surface">
          <span className="transition-opacity duration-150 group-hover:opacity-0 group-focus-visible:opacity-0 [&_span:last-child]:hidden">{marca}</span>
          <span aria-hidden className="absolute inset-0 flex items-center justify-center text-muted opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"><IconeDoPainel abrir /></span>
        </button>
      ) : (
        <div className="mb-5 flex items-center justify-between gap-2 pl-2">
          <span className="min-w-0">{marca}</span>
          <button type="button" onClick={() => definirPreferencia('barra', true)} aria-label="Recolher a barra lateral" aria-expanded title="Recolher menu"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-dim transition hover:bg-surface hover:text-ink"><IconeDoPainel /></button>
        </div>
      )}
      {!recolhida && voltar}
      {!recolhida && contaNoTopo && <div className="mb-3">{contaNoTopo}</div>}
      <nav aria-label={area === 'administracao' ? 'Administração' : 'Seções do cliente'} className="sem-barra flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {secoes ? (
          <NavegacaoPorSecoes secoes={secoes} aceso={aceso} recolhida={recolhida} carregando={carregando} dica={dica} />
        ) : (
          <>
            {itens.filter((item) => item.chave === 'inicio').map(link)}
            {GRUPOS_DA_ADMINISTRACAO.filter((grupo) => itens.some((item) => grupo.chaves.includes(item.chave))).map((grupo) => (
              <div key={grupo.nome}>
                <p className={`mt-5 mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-dim ${recolhida ? 'hidden' : ''}`}>{grupo.nome}</p>
                {itens.filter((item) => grupo.chaves.includes(item.chave)).map(link)}
              </div>
            ))}
          </>
        )}
      </nav>
      {/* Na organização, perfil e tema moram no cabeçalho (`cabecalho.tsx`). */}
      {area === 'administracao' && <div className="mt-3 border-t border-line pt-3">
        {contaButton()}
        <div className={recolhida ? 'flex flex-col items-center' : 'mt-2'}>
          <BotaoDeTema recolhida={recolhida} />
        </div>
      </div>}
    </aside>
    {dica.elemento}
    <dialog ref={painel} aria-labelledby="titulo-conta" onClick={(event) => { if (event.target === event.currentTarget) painel.current?.close() }} className="fixed inset-0 m-auto w-[min(360px,calc(100%-32px))] rounded-2xl border border-line bg-panel p-5 text-ink shadow-xl backdrop:bg-black/30">
      <header className="mb-4 flex items-center justify-between"><h2 id="titulo-conta" className="text-base font-bold">Você</h2><button type="button" aria-label="Fechar Você" onClick={() => painel.current?.close()} className="size-9 rounded-lg text-muted hover:bg-surface">×</button></header>
      {rodape}
    </dialog>
    </>
  )
}

/**
 * As seções da organização, em sanfona (plano de navegação, seção 3).
 *
 * **Só a seção atual fica aberta**, e quem decide qual é o endereço: clicar no
 * nome de outra seção leva ao primeiro subitem dela, e a navegação abre a
 * seção. Não há estado de "aberta" guardado em lugar nenhum, então a barra do
 * esqueleto e a de verdade não têm como discordar.
 *
 * Os números ficam nos subitens da seção aberta. Fechada, ou com a barra
 * recolhida, a seção mostra só um ponto: o suficiente para alguém abrir.
 *
 * Configurações vai para o pé da barra, separada do trabalho do dia.
 */
function NavegacaoPorSecoes({ secoes, aceso, recolhida, carregando, dica }: { secoes: SecaoDaBarra[]; aceso: Aceso | null; recolhida: boolean; carregando: boolean; dica: Dica }) {
  const bloquear = carregando
    ? { 'aria-disabled': true, tabIndex: -1, onClick: (evento: MouseEvent) => evento.preventDefault() }
    : {}
  const caminho = usePathname()
  const [flutuante, setFlutuante] = useState<{ chave: string; topo: number; esquerda: number } | null>(null)
  const painel = useRef<HTMLDivElement>(null)

  // Navegou, recolheu a barra ou expandiu: o painel flutuante sai.
  useEffect(() => setFlutuante(null), [caminho, recolhida])
  useEffect(() => {
    if (!flutuante) return
    const fora = (evento: PointerEvent) => {
      const alvo = evento.target as HTMLElement
      if (painel.current?.contains(alvo) || alvo.closest(`[data-secao="${flutuante.chave}"]`)) return
      setFlutuante(null)
    }
    const tecla = (evento: KeyboardEvent) => { if (evento.key === 'Escape') setFlutuante(null) }
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('pointerdown', fora)
      document.removeEventListener('keydown', tecla)
    }
  }, [flutuante])

  const classeDoTopo = (secao: SecaoDaBarra, aberta: boolean, destaque = false) =>
    `relative flex shrink-0 items-center gap-2.5 rounded-[10px] text-[13px] font-semibold transition ${recolhida ? 'mx-auto size-10 justify-center' : 'px-2.5 py-2'} ${
      aberta && (secao.solta || recolhida) ? 'bg-primary-weak text-primary' : aberta ? 'text-ink' : destaque ? 'bg-surface text-ink' : 'text-muted hover:bg-surface hover:text-ink'
    }`
  const secaoFlutuante = flutuante ? secoes.find((secao) => secao.chave === flutuante.chave) : undefined

  const desenhar = (secao: SecaoDaBarra) => {
    const aberta = aceso?.secao === secao.chave
    const primeiro = secao.itens[0]
    const comSubitens = !secao.solta && !recolhida
    const conteudo = (
      <>
        <span aria-hidden className={aberta ? 'text-primary' : 'text-dim'}>{secao.icone}</span>
        {!recolhida && <span className="flex-1">{secao.rotulo}</span>}
        {secao.ponto && (recolhida || !aberta) && (
          <span className={recolhida ? 'absolute top-1.5 right-1.5' : 'flex'}>{secao.ponto}</span>
        )}
      </>
    )
    // Recolhida, a seção com subitens não navega no clique: abre ao lado um
    // painel com eles, como a Brevo faz. A solta segue sendo um link.
    const abreAoLado = recolhida && !secao.solta
    const ladoAberto = flutuante?.chave === secao.chave
    return (
      <div key={secao.chave} className={secao.chave === 'ajustes' ? 'mt-auto pt-4' : ''}>
        {abreAoLado ? (
          <button
            type="button"
            data-secao={secao.chave}
            disabled={carregando}
            aria-label={secao.rotulo}
            aria-haspopup="menu"
            aria-expanded={ladoAberto}
            {...(ladoAberto ? {} : dica.gatilho(secao.rotulo))}
            onClick={(evento) => {
              dica.esconder()
              if (ladoAberto) return setFlutuante(null)
              const caixa = evento.currentTarget.getBoundingClientRect()
              setFlutuante({ chave: secao.chave, topo: caixa.top - 8, esquerda: caixa.right + 12 })
            }}
            className={classeDoTopo(secao, aberta, ladoAberto)}
          >
            {conteudo}
          </button>
        ) : (
          <Link
            href={primeiro?.href ?? '#'}
            {...bloquear}
            aria-current={secao.solta && aberta ? 'page' : undefined}
            aria-expanded={comSubitens ? aberta : undefined}
            aria-label={secao.rotulo}
            {...(recolhida ? dica.gatilho(secao.rotulo) : {})}
            className={classeDoTopo(secao, aberta)}
          >
            {conteudo}
          </Link>
        )}
        {comSubitens && (
          // A sanfona anima pela linha da grade (0fr para 1fr): altura
          // automática não se anima, e medir em JavaScript faria a barra
          // esperar o React para abrir.
          <div className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${aberta ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
            <ul className="ml-[18px] min-h-0 overflow-hidden border-l border-line pl-2" inert={!aberta}>
              {secao.itens.map((item, posicao) => {
                const itemAceso = aberta && aceso?.item === item.id
                return (
                  <li key={item.id} className={posicao === 0 ? 'pt-0.5' : posicao === secao.itens.length - 1 ? 'pb-1.5' : ''}>
                    <Link
                      href={item.href}
                      {...bloquear}
                      aria-current={itemAceso ? 'page' : undefined}
                      className={`flex items-center gap-2 rounded-lg px-2.5 py-[7px] text-[12.5px] transition ${
                        itemAceso ? 'bg-primary-weak font-semibold text-primary' : 'font-medium text-muted hover:bg-surface hover:text-ink'
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">{item.rotulo}</span>
                      {item.contador}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    )
  }
  return (
    <>
      {secoes.map(desenhar)}
      {flutuante && secaoFlutuante && createPortal(
        <div
          ref={(elemento) => {
            painel.current = elemento
            // Perto do pé da tela (Configurações), o painel sobe para caber.
            if (!elemento) return
            const sobra = window.innerHeight - 12 - elemento.offsetHeight
            if (flutuante.topo > sobra) elemento.style.top = `${Math.max(12, sobra)}px`
          }}
          role="menu"
          aria-label={secaoFlutuante.rotulo}
          style={{ top: flutuante.topo, left: flutuante.esquerda }}
          className="app-lado-entra fixed z-50 max-h-[calc(100dvh-24px)] w-[252px] overflow-y-auto rounded-2xl border border-line bg-panel p-2 text-ink shadow-[0_18px_40px_-12px_rgb(15_23_42/0.28)]"
        >
          <div>
            <p className="flex items-center gap-2 px-3 pt-1.5 pb-2 text-[13px] font-semibold">
              <span className="flex-1">{secaoFlutuante.rotulo}</span>
              {secaoFlutuante.ponto}
            </p>
            <ul className="flex flex-col gap-0.5">
              {secaoFlutuante.itens.map((item) => {
                const itemAceso = aceso?.secao === secaoFlutuante.chave && aceso.item === item.id
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      role="menuitem"
                      aria-current={itemAceso ? 'page' : undefined}
                      onClick={() => setFlutuante(null)}
                      className={`flex items-center gap-2 rounded-[10px] py-2 pr-3 pl-5 text-[13px] transition ${
                        itemAceso ? 'bg-primary-weak font-semibold text-primary' : 'font-medium text-muted hover:bg-surface hover:text-ink'
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">{item.rotulo}</span>
                      {item.contador}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

type Dica = {
  gatilho: (texto: string) => {
    onMouseEnter: (evento: MouseEvent<HTMLElement>) => void
    onMouseLeave: () => void
    onFocus: (evento: FocusEvent<HTMLElement>) => void
    onBlur: () => void
  }
  esconder: () => void
  elemento: ReactNode
}

/**
 * O nome do item ao lado dele, com a barra recolhida: um balão azul, na cor da
 * marca, no lugar do `title` do navegador, que demora e sai cinza.
 *
 * Vai para o `body` porque a lista da barra rola (`overflow-y-auto`) e cortaria
 * qualquer coisa que saísse dela.
 */
function useDica(): Dica {
  const [dica, setDica] = useState<{ texto: string; topo: number; esquerda: number } | null>(null)
  const mostrar = (alvo: HTMLElement, texto: string) => {
    const caixa = alvo.getBoundingClientRect()
    setDica({ texto, topo: caixa.top + caixa.height / 2, esquerda: caixa.right + 10 })
  }
  const esconder = () => setDica(null)
  return {
    gatilho: (texto) => ({
      onMouseEnter: (evento) => mostrar(evento.currentTarget, texto),
      onMouseLeave: esconder,
      onFocus: (evento) => {
        if (evento.currentTarget.matches(':focus-visible')) mostrar(evento.currentTarget, texto)
      },
      onBlur: esconder,
    }),
    esconder,
    elemento:
      dica &&
      createPortal(
        <div
          role="tooltip"
          style={{ top: dica.topo, left: dica.esquerda }}
          className="pointer-events-none fixed z-50 -translate-y-1/2"
        >
          <div className="app-dica-entra relative rounded-lg bg-primary px-2.5 py-1.5 text-[12px] font-semibold whitespace-nowrap text-white shadow-[0_8px_20px_-8px_var(--primary)]">
            <span aria-hidden className="absolute top-1/2 -left-[3px] size-2 -translate-y-1/2 rotate-45 rounded-[1.5px] bg-primary" />
            <span className="relative">{dica.texto}</span>
          </div>
        </div>,
        document.body,
      ),
  }
}

/** O painel lateral com a seta: fechar (‹) com a barra aberta, abrir (›) recolhida. */
function IconeDoPainel({ abrir = false }: { abrir?: boolean }) {
  return (
    <svg aria-hidden width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3.5" width="18" height="17" rx="3" />
      <path d="M9 3.5v17" />
      <path d={abrir ? 'm13.5 9.5 2.5 2.5-2.5 2.5' : 'm16 9.5-2.5 2.5 2.5 2.5'} />
    </svg>
  )
}
