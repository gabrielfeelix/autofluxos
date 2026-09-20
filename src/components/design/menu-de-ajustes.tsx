'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GRUPOS, type TelaDeAjustes } from './itens-de-ajustes'
export type { TelaDeAjustes } from './itens-de-ajustes'

const normalizar = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const sinonimos: Partial<Record<TelaDeAjustes, string>> = { contexto: 'contexto negocio inteligencia artificial bot', acervo: 'acervo fotos videos pdf documentos', recursos: 'recursos onboarding crm objetivo assistente', negocio: 'cadastro cnpj empresa', anuncios: 'leads meta facebook anuncios' }

export function MenuDeAjustes({ clienteId, ativa }: { clienteId?: string; ativa: TelaDeAjustes }) {
  const [busca, setBusca] = useState('')
  const router = useRouter()
  const endereco = (chave: TelaDeAjustes) => `/clientes/${clienteId}/ajustes${chave === 'inicio' ? '' : `/${chave}`}`
  const grupos = GRUPOS.map((grupo) => ({ ...grupo, itens: grupo.itens.filter((item) => normalizar(`${grupo.titulo ?? ''} ${item.rotulo} ${sinonimos[item.chave] ?? ''}`).includes(normalizar(busca.trim()))) })).filter((grupo) => grupo.itens.length)
  return <nav aria-label="Configurações" className="shrink-0 border-b border-line p-4 md:w-[228px] md:border-b-0 md:border-r md:px-4 md:py-6">
    <label htmlFor="buscar-configuracao" className="mb-2 block text-xs font-semibold text-muted">Buscar configuração</label>
    <input id="buscar-configuracao" type="search" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Nome ou assunto…" className="mb-3 w-full rounded-lg border border-line bg-panel px-3 py-2 text-xs outline-none focus:border-primary" />
    <label className="block md:hidden"><span className="sr-only">Seção de configurações</span><select disabled={!clienteId} value={ativa} onChange={(event) => router.push(endereco(event.target.value as TelaDeAjustes))} className="w-full rounded-lg border border-line bg-panel p-2.5 text-sm">
      <option value={ativa}>{GRUPOS.flatMap((grupo) => grupo.itens).find((item) => item.chave === ativa)?.rotulo}</option>
      {grupos.map((grupo) => <optgroup key={grupo.titulo ?? 'geral'} label={grupo.titulo ?? 'Geral'}>{grupo.itens.filter((item) => item.chave !== ativa).map((item) => <option key={item.chave} value={item.chave}>{item.rotulo}</option>)}</optgroup>)}
    </select></label>
    {grupos.length === 0 && <p role="status" className="py-3 text-xs text-dim">Nenhuma configuração encontrada.</p>}
    <div className="hidden md:block">{grupos.map((grupo) => <div key={grupo.titulo ?? 'geral'}>
      {grupo.titulo && <p className="mt-5 mb-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-dim">{grupo.titulo}</p>}
      {grupo.itens.map((item) => {
        const classe = `block rounded-lg px-2.5 py-2 text-[12.5px] ${item.chave === ativa ? 'bg-primary-weak font-semibold text-primary' : 'text-muted hover:bg-surface hover:text-ink'}`
        return clienteId ? <Link key={item.chave} href={endereco(item.chave)} aria-current={item.chave === ativa ? 'page' : undefined} className={classe}>{item.rotulo}</Link> : <span key={item.chave} className={classe}>{item.rotulo}</span>
      })}
    </div>)}</div>
  </nav>
}
