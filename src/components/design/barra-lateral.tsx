'use client'

import Link from 'next/link'
import { useRef, type ReactNode } from 'react'
import { BotaoDeTema, definirPreferencia, usePreferencia } from '@/components/design/tema'

type Item = { chave: string; rotulo: string; href: string; icone: ReactNode; acesa: boolean; contador?: ReactNode }

export function BarraLateral({ marca, identidadeNoCelular, voltar, itens, rodape, presenca, conta, carregando = false }: {
  marca: ReactNode
  identidadeNoCelular: ReactNode
  voltar: ReactNode | null
  itens: Item[]
  rodape: ReactNode
  presenca?: string
  /**
   * O nome da conta em que se está trabalhando.
   *
   * **O rodapé diz em que conta você está, e não que existe um rodapé.** Ele
   * dizia "Conta e perfil" para todo mundo: um rótulo que descreve o botão e
   * não responde a única pergunta que se faz olhando para ali, que é "estou
   * na conta certa?". Quem atende três contas trocava de uma para outra sem
   * nenhum sinal na tela, e o nome só aparecia depois de abrir o painel.
   *
   * Sem nome (a tela de carregamento, por exemplo) o rótulo antigo volta: é
   * melhor que um espaço vazio onde deveria estar um nome.
   */
  conta?: string
  carregando?: boolean
}) {
  const recolhida = usePreferencia('barra')
  const painel = useRef<HTMLDialogElement>(null)
  const disponivel = presenca === 'disponivel'
  const nomeNoBotao = conta ?? 'Conta e perfil'
  const rotuloConta = `${conta ? `Conta: ${conta}` : 'Conta e perfil'}${presenca ? ` · ${disponivel ? 'Disponível' : 'Ausente'}` : ''}`
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
      <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full border border-line text-muted">
        <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg>
        {presenca && <span className={`absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-panel ${disponivel ? 'bg-emerald-500' : 'bg-dim'}`} />}
      </span>
      {!mobile && !recolhida && <span className="min-w-0"><span className="block truncate text-xs font-semibold">{nomeNoBotao}</span><span className="block text-[11px] text-dim">{presenca ? (disponivel ? 'Disponível' : 'Ausente') : 'Preferências e acesso'}</span></span>}
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
      <nav aria-label="Seções do cliente" className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2 md:min-h-0 md:flex-1 md:flex-col md:overflow-y-auto md:border-0 md:p-0">
        {itens.filter((item) => item.chave === 'inicio').map(link)}
        {[{ nome: 'Dia a dia', chaves: ['inbox', 'atividades', 'leads', 'quadros'] }, { nome: 'Automação', chaves: ['fluxos', 'transmissoes'] }].map((grupo) => (
          <div key={grupo.nome} className="contents md:block">
            <p className={`mt-5 mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-dim ${recolhida ? 'hidden' : 'hidden md:block'}`}>{grupo.nome}</p>
            {itens.filter((item) => grupo.chaves.includes(item.chave)).map(link)}
          </div>
        ))}
        <div className="contents md:mt-auto md:block md:pt-5">{itens.filter((item) => item.chave === 'ajustes').map(link)}</div>
      </nav>
      <div className="mt-3 hidden border-t border-line pt-3 md:block">
        {contaButton()}
        <div className={recolhida ? 'flex flex-col items-center' : 'mt-2 flex items-center justify-between'}>
          <BotaoDeTema recolhida={recolhida} />
          <button type="button" onClick={() => definirPreferencia('barra', !recolhida)} aria-label={recolhida ? 'Expandir a barra lateral' : 'Recolher a barra lateral'} title={recolhida ? 'Expandir a barra lateral' : 'Recolher a barra lateral'} aria-expanded={!recolhida} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface">{recolhida ? '›' : '‹'}</button>
        </div>
      </div>
      <dialog ref={painel} aria-labelledby="titulo-conta" onClick={(event) => { if (event.target === event.currentTarget) painel.current?.close() }} className="fixed inset-0 m-auto w-[min(360px,calc(100%-32px))] rounded-2xl border border-line bg-panel p-5 text-ink shadow-xl backdrop:bg-black/30">
        <header className="mb-4 flex items-center justify-between"><h2 id="titulo-conta" className="text-base font-bold">Conta e perfil</h2><button type="button" aria-label="Fechar conta e perfil" onClick={() => painel.current?.close()} className="size-9 rounded-lg text-muted hover:bg-surface">×</button></header>
        {rodape}
        <div className="mt-4 border-t border-line pt-3 md:hidden"><BotaoDeTema recolhida={false} /></div>
      </dialog>
    </aside>
  )
}
