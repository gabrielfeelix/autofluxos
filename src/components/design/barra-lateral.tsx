'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { BotaoDeTema, definirPreferencia, usePreferencia } from '@/components/design/tema'
import { Avatar } from '@/components/design/avatar'
import { usePerfil } from '@/components/conta/voce'
import { abaDoCaminho } from './aba-do-caminho'

type Item = { chave: string; rotulo: string; href: string; icone: ReactNode; acesa?: boolean; contador?: ReactNode }

export function BarraLateral({ base, itens: itensRecebidos, marca, identidadeNoCelular, voltar, rodape, presenca, conta, contaNoTopo, carregando = false }: {
  /**
   * O começo do endereço da conta (`/clientes/<id>`). Com ele, o item aceso sai
   * do caminho, e a barra, que mora no layout, acompanha a navegação sem ser
   * desenhada de novo. Sem ele (o esqueleto), vale o `acesa` de cada item.
   */
  base?: string
  marca: ReactNode
  identidadeNoCelular: ReactNode
  voltar: ReactNode | null
  itens: Item[]
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
  const abaAcesa = base ? abaDoCaminho(caminho, base) : null
  const itens = base ? itensRecebidos.map((item) => ({ ...item, acesa: item.chave === abaAcesa })) : itensRecebidos
  const recolhida = usePreferencia('barra')
  const painel = useRef<HTMLDialogElement>(null)
  const secoes = useRef<HTMLElement>(null)
  const [maisADireita, setMaisADireita] = useState(false)
  const chaveAcesa = itens.find((item) => item.acesa)?.chave
  /*
   * No celular a barra de seções é uma faixa que rola de lado (5.8). Sem isto,
   * quem abre Automações ou Configurações vê "Painel · Inbox · Atividades · Co"
   * e o item aceso fica fora da tela. Rola até ele ao abrir, e o esmaecido da
   * borda direita avisa que há mais itens.
   */
  useEffect(() => {
    const faixa = secoes.current
    if (!faixa) return
    const conferir = () => setMaisADireita(faixa.scrollWidth - faixa.clientWidth - faixa.scrollLeft > 4)
    const acesa = faixa.querySelector<HTMLElement>('[aria-current="page"]')
    if (acesa && faixa.scrollWidth > faixa.clientWidth) {
      faixa.scrollLeft = Math.max(0, acesa.offsetLeft - (faixa.clientWidth - acesa.offsetWidth) / 2)
    }
    conferir()
    faixa.addEventListener('scroll', conferir, { passive: true })
    window.addEventListener('resize', conferir)
    return () => {
      faixa.removeEventListener('scroll', conferir)
      window.removeEventListener('resize', conferir)
    }
  }, [chaveAcesa])
  const disponivel = presenca === 'disponivel'
  const perfil = usePerfil()
  const nomeNoBotao = perfil?.nome ?? 'Você'
  const rotuloConta = `Você: ${nomeNoBotao}${conta ? `, na conta ${conta}` : ''}${presenca ? ` · ${disponivel ? 'Disponível' : 'Ausente'}` : ''}`
  const link = (item: Item) => (
    <Link key={item.chave} href={item.href} aria-disabled={carregando || undefined} tabIndex={carregando ? -1 : undefined} onClick={(event) => { if (carregando) event.preventDefault() }} aria-current={item.acesa ? 'page' : undefined} aria-label={item.rotulo} title={item.rotulo}
      className={`relative flex shrink-0 items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-[13px] font-semibold transition ${recolhida ? 'md:size-10 md:justify-center md:px-0' : ''} ${item.acesa ? 'bg-primary-weak text-primary' : 'text-muted hover:bg-surface hover:text-ink'}`}>
      <span aria-hidden className={item.acesa ? 'text-primary' : 'text-dim'}>{item.icone}</span>
      <span className={recolhida ? 'md:hidden' : ''}>{item.rotulo}</span>
      {item.contador && <span className={recolhida ? 'ml-auto md:absolute md:-right-1 md:-top-1' : 'ml-auto'}>{item.contador}</span>}
    </Link>
  )
  const contaButton = (mobile = false) => (
    <button type="button" disabled={carregando} onClick={() => painel.current?.showModal()} aria-label={rotuloConta} title={rotuloConta}
      className={`flex items-center gap-2 rounded-[10px] p-2 text-left hover:bg-surface ${mobile ? 'md:hidden' : 'w-full'} ${recolhida && !mobile ? 'justify-center' : ''}`}>
      <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full text-muted">
        {perfil ? <Avatar nome={perfil.nome} imagem={perfil.imagem} tamanho={32} /> : <span className="flex size-8 items-center justify-center rounded-full border border-line"><svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg></span>}
        {presenca && <span className={`absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-panel ${disponivel ? 'bg-emerald-500' : 'bg-dim'}`} />}
      </span>
      {!mobile && !recolhida && <span className="min-w-0"><span className="block truncate text-xs font-semibold">{nomeNoBotao}</span><span className="block text-[11px] text-dim">{presenca ? (disponivel ? 'Disponível' : 'Ausente') : 'Perfil e preferências'}</span></span>}
    </button>
  )
  return (
    <aside className={`flex shrink-0 flex-col border-line bg-panel md:border-r md:py-4 ${recolhida ? 'md:w-[68px] md:px-2.5' : 'md:w-[226px] md:px-3.5'}`}>
      <div className={`flex items-center gap-2 border-b border-line px-4 py-2 md:mb-5 md:border-0 md:py-0 ${recolhida ? 'md:justify-center md:px-0' : 'md:px-2'}`}>
        <span className={recolhida ? 'md:[&_span:last-child]:hidden' : ''}>{marca}</span>
        <span className="ml-auto flex items-center gap-2 md:hidden">{identidadeNoCelular}</span>
        {contaButton(true)}
      </div>
      {!recolhida && voltar}
      {!recolhida && contaNoTopo && <div className="mb-3 hidden md:block">{contaNoTopo}</div>}
      <div className="relative md:contents">
      <nav ref={secoes} aria-label="Seções do cliente" className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2 md:min-h-0 md:flex-1 md:flex-col md:overflow-y-auto md:border-0 md:p-0">
        {itens.filter((item) => item.chave === 'inicio').map(link)}
        {[{ nome: 'Dia a dia', chaves: ['inbox', 'atividades', 'leads', 'quadros', 'relatorios'] }, { nome: 'Automação', chaves: ['fluxos', 'transmissoes'] }].filter((grupo) => itens.some((item) => grupo.chaves.includes(item.chave))).map((grupo) => (
          <div key={grupo.nome} className="contents md:block">
            <p className={`mt-5 mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-dim ${recolhida ? 'hidden' : 'hidden md:block'}`}>{grupo.nome}</p>
            {itens.filter((item) => grupo.chaves.includes(item.chave)).map(link)}
          </div>
        ))}
        <div className="contents md:mt-auto md:block md:pt-5">{itens.filter((item) => item.chave === 'ajustes').map(link)}</div>
      </nav>
      {maisADireita && <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-panel to-transparent md:hidden" />}
      </div>
      <div className="mt-3 hidden border-t border-line pt-3 md:block">
        {contaButton()}
        <div className={recolhida ? 'flex flex-col items-center' : 'mt-2 flex items-center justify-between'}>
          <BotaoDeTema recolhida={recolhida} />
          <button type="button" onClick={() => definirPreferencia('barra', !recolhida)} aria-label={recolhida ? 'Expandir a barra lateral' : 'Recolher a barra lateral'} title={recolhida ? 'Expandir a barra lateral' : 'Recolher a barra lateral'} aria-expanded={!recolhida} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface">{recolhida ? '›' : '‹'}</button>
        </div>
      </div>
      <dialog ref={painel} aria-labelledby="titulo-conta" onClick={(event) => { if (event.target === event.currentTarget) painel.current?.close() }} className="fixed inset-0 m-auto w-[min(360px,calc(100%-32px))] rounded-2xl border border-line bg-panel p-5 text-ink shadow-xl backdrop:bg-black/30">
        <header className="mb-4 flex items-center justify-between"><h2 id="titulo-conta" className="text-base font-bold">Você</h2><button type="button" aria-label="Fechar Você" onClick={() => painel.current?.close()} className="size-9 rounded-lg text-muted hover:bg-surface">×</button></header>
        {rodape}
      </dialog>
    </aside>
  )
}
