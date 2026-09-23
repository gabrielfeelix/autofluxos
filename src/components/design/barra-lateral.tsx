'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRef, type ReactNode } from 'react'
import { BotaoDeTema, definirPreferencia, usePreferencia } from '@/components/design/tema'
import { Avatar } from '@/components/design/avatar'
import { usePerfil } from '@/components/conta/voce'
import { abaDoCaminho } from './aba-do-caminho'
import { BarraDoCelular } from './barra-do-celular'

type Item = { chave: string; rotulo: string; href: string; icone: ReactNode; acesa?: boolean; contador?: ReactNode }

export function BarraLateral({ base, itens: itensRecebidos, marca, voltar, voltarHref, rodape, presenca, conta, contaNoTopo, carregando = false }: {
  /**
   * O começo do endereço da conta (`/clientes/<id>`). Com ele, o item aceso sai
   * do caminho, e a barra, que mora no layout, acompanha a navegação sem ser
   * desenhada de novo. Sem ele (o esqueleto), vale o `acesa` de cada item.
   */
  base?: string
  marca: ReactNode
  voltar: ReactNode | null
  /** O mesmo "Todos os clientes" de `voltar`, para a gaveta do celular. */
  voltarHref?: string
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
  const disponivel = presenca === 'disponivel'
  const perfil = usePerfil()
  const nomeNoBotao = perfil?.nome ?? 'Você'
  const rotuloConta = `Você: ${nomeNoBotao}${conta ? `, na conta ${conta}` : ''}${presenca ? ` · ${disponivel ? 'Disponível' : 'Ausente'}` : ''}`
  const link = (item: Item) => (
    <Link key={item.chave} href={item.href} aria-disabled={carregando || undefined} tabIndex={carregando ? -1 : undefined} onClick={(event) => { if (carregando) event.preventDefault() }} aria-current={item.acesa ? 'page' : undefined} aria-label={item.rotulo} title={item.rotulo}
      className={`relative flex shrink-0 items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-[13px] font-semibold transition ${recolhida ? 'size-10 justify-center px-0' : ''} ${item.acesa ? 'bg-primary-weak text-primary' : 'text-muted hover:bg-surface hover:text-ink'}`}>
      <span aria-hidden className={item.acesa ? 'text-primary' : 'text-dim'}>{item.icone}</span>
      <span className={recolhida ? 'hidden' : ''}>{item.rotulo}</span>
      {item.contador && <span className={recolhida ? 'absolute -right-1 -top-1' : 'ml-auto'}>{item.contador}</span>}
    </Link>
  )
  const contaButton = () => (
    <button type="button" disabled={carregando} onClick={() => painel.current?.showModal()} aria-label={rotuloConta} title={rotuloConta}
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
    <BarraDoCelular base={base} itens={itens} contaNoTopo={contaNoTopo} voltarHref={voltarHref} presenca={presenca} carregando={carregando} aoAbrirVoce={() => painel.current?.showModal()} />
    <aside className={`hidden shrink-0 flex-col border-r border-line bg-panel py-4 md:flex ${recolhida ? 'w-[68px] px-2.5' : 'w-[226px] px-3.5'}`}>
      <div className={`mb-5 flex items-center gap-2 ${recolhida ? 'justify-center' : 'px-2'}`}>
        <span className={recolhida ? '[&_span:last-child]:hidden' : ''}>{marca}</span>
      </div>
      {!recolhida && voltar}
      {!recolhida && contaNoTopo && <div className="mb-3">{contaNoTopo}</div>}
      <nav aria-label="Seções do cliente" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {itens.filter((item) => item.chave === 'inicio').map(link)}
        {[{ nome: 'Dia a dia', chaves: ['inbox', 'atividades', 'leads', 'quadros', 'relatorios'] }, { nome: 'Automação', chaves: ['fluxos', 'transmissoes'] }].filter((grupo) => itens.some((item) => grupo.chaves.includes(item.chave))).map((grupo) => (
          <div key={grupo.nome}>
            <p className={`mt-5 mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-dim ${recolhida ? 'hidden' : ''}`}>{grupo.nome}</p>
            {itens.filter((item) => grupo.chaves.includes(item.chave)).map(link)}
          </div>
        ))}
        <div className="mt-auto pt-5">{itens.filter((item) => item.chave === 'ajustes').map(link)}</div>
      </nav>
      <div className="mt-3 border-t border-line pt-3">
        {contaButton()}
        <div className={recolhida ? 'flex flex-col items-center' : 'mt-2 flex items-center justify-between'}>
          <BotaoDeTema recolhida={recolhida} />
          <button type="button" onClick={() => definirPreferencia('barra', !recolhida)} aria-label={recolhida ? 'Expandir a barra lateral' : 'Recolher a barra lateral'} title={recolhida ? 'Expandir a barra lateral' : 'Recolher a barra lateral'} aria-expanded={!recolhida} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface">{recolhida ? '›' : '‹'}</button>
        </div>
      </div>
    </aside>
    <dialog ref={painel} aria-labelledby="titulo-conta" onClick={(event) => { if (event.target === event.currentTarget) painel.current?.close() }} className="fixed inset-0 m-auto w-[min(360px,calc(100%-32px))] rounded-2xl border border-line bg-panel p-5 text-ink shadow-xl backdrop:bg-black/30">
      <header className="mb-4 flex items-center justify-between"><h2 id="titulo-conta" className="text-base font-bold">Você</h2><button type="button" aria-label="Fechar Você" onClick={() => painel.current?.close()} className="size-9 rounded-lg text-muted hover:bg-surface">×</button></header>
      {rodape}
    </dialog>
    </>
  )
}
