'use client'

import { useState, useTransition } from 'react'
import { AvisoFlutuante } from '@/components/design/aviso-flutuante'
import { acaoAdminRecusarPedido, acaoAdminTrocarPlano } from '@/server/acoes-admin'
import { horaExata, quando } from '@/lib/quando'
import { Selo } from './partes'

export type PlanoNaTela = { id: string; nome: string; preco: number; conversas: number; numeros: number; resumo: string }
export type PedidoNaTela = { id: string; quando: string; quemPediu: string; de: string; para: string; situacao: 'aberto' | 'atendido' | 'recusado' }

/**
 * O plano de uma organização, pela administração: qual é, quanto foi usado, a
 * troca (otimista) e os pedidos que a organização fez.
 */
export function PlanoDaOrganizacao({
  organizacaoId,
  atual: inicial,
  planos,
  conversas,
  pedidos: pedidosIniciais,
}: {
  organizacaoId: string
  atual: string
  planos: PlanoNaTela[]
  conversas: number
  pedidos: PedidoNaTela[]
}) {
  const [atual, setAtual] = useState(inicial)
  const [pedidos, setPedidos] = useState(pedidosIniciais)
  const [aviso, setAviso] = useState<string | null>(null)
  const [, comecar] = useTransition()
  const plano = planos.find((item) => item.id === atual) ?? planos[0]!
  const fracao = plano.conversas > 0 ? conversas / plano.conversas : 0
  const nome = (id: string) => planos.find((item) => item.id === id)?.nome ?? id

  const trocar = (para: string, pedidoId?: string) => {
    const antes = { atual, pedidos }
    setAtual(para)
    if (pedidoId) setPedidos((lista) => lista.map((pedido) => (pedido.id === pedidoId ? { ...pedido, situacao: 'atendido' } : pedido)))
    comecar(async () => {
      try {
        const r = await acaoAdminTrocarPlano(organizacaoId, para, pedidoId)
        if (!r.ok) {
          setAtual(antes.atual)
          setPedidos(antes.pedidos)
          setAviso(r.erro ?? 'não deu para trocar o plano')
        }
      } catch {
        setAtual(antes.atual)
        setPedidos(antes.pedidos)
        setAviso('sem conexão com o servidor')
      }
    })
  }

  const recusar = (pedidoId: string) => {
    const antes = pedidos
    setPedidos((lista) => lista.map((pedido) => (pedido.id === pedidoId ? { ...pedido, situacao: 'recusado' } : pedido)))
    comecar(async () => {
      const r = await acaoAdminRecusarPedido(pedidoId).catch(() => ({ ok: false, erro: 'sem conexão com o servidor' }))
      if (!r.ok) {
        setPedidos(antes)
        setAviso(r.erro ?? 'não deu para recusar')
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="app-card px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[14px] font-bold">
            Uso do mês no {plano.nome}
          </h2>
          <span className={`text-[13px] font-semibold tabular-nums ${fracao > 1 ? 'text-perigo' : fracao >= 0.8 ? 'text-aviso' : 'text-muted'}`}>
            {conversas.toLocaleString('pt-BR')} de {plano.conversas.toLocaleString('pt-BR')} conversas ({Math.round(fracao * 100)}%)
          </span>
        </div>
        <span className="mt-2.5 block h-2 overflow-hidden rounded-full bg-surface">
          <span className={`block h-full rounded-full ${fracao > 1 ? 'bg-perigo' : fracao >= 0.8 ? 'bg-aviso' : 'bg-primary'}`} style={{ width: `${Math.min(100, Math.round(fracao * 100))}%` }} />
        </span>
      </section>

      <section aria-labelledby="titulo-planos">
        <h2 id="titulo-planos" className="mb-3 text-[15px] font-bold">
          Trocar o plano
        </h2>
        <ul className="grid gap-3 md:grid-cols-3">
          {planos.map((item) => {
            const eh = item.id === atual
            return (
              <li key={item.id}>
                <article className={`app-card flex h-full flex-col gap-2 p-4 ${eh ? 'ring-2 ring-primary/60' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[15px] font-bold">{item.nome}</h3>
                    {eh && <Selo tom="destaque">Plano atual</Selo>}
                  </div>
                  <p className="text-[22px] font-bold tracking-[-0.02em] tabular-nums">
                    R$ {item.preco.toLocaleString('pt-BR')}
                    <span className="text-[12px] font-semibold text-dim"> por mês</span>
                  </p>
                  <p className="text-[12.5px] text-muted">
                    {item.conversas.toLocaleString('pt-BR')} conversas · {item.numeros} {item.numeros === 1 ? 'número' : 'números'}
                  </p>
                  <p className="text-[12px] leading-5 text-dim">{item.resumo}</p>
                  <div className="mt-auto pt-2">
                    {eh ? (
                      <p className="text-[12px] text-dim">É o plano desta organização</p>
                    ) : (
                      <button type="button" onClick={() => trocar(item.id)} className="app-secondary-button w-full px-3 py-2 text-[12.5px]">
                        Mudar para {item.nome}
                      </button>
                    )}
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="titulo-pedidos" className="app-card overflow-hidden">
        <header className="border-b border-line px-5 py-3.5">
          <h2 id="titulo-pedidos" className="text-[14px] font-bold">
            Pedidos de troca desta organização
          </h2>
        </header>
        {pedidos.length === 0 ? (
          <p className="px-5 py-5 text-[13px] text-muted">A organização nunca pediu troca de plano.</p>
        ) : (
          <ul className="divide-y divide-line">
            {pedidos.map((pedido) => (
              <li key={pedido.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="min-w-0 flex-1 text-[12.5px]">
                  <strong className="font-semibold">{pedido.quemPediu || 'alguém'}</strong>{' '}
                  <span className="text-muted">
                    pediu {nome(pedido.de)} → <strong className="text-ink">{nome(pedido.para)}</strong>
                  </span>
                  <span className="ml-2 text-[11px] text-dim" title={horaExata(pedido.quando)}>
                    {quando(pedido.quando)}
                  </span>
                </span>
                {pedido.situacao === 'aberto' ? (
                  <span className="flex gap-1.5">
                    <button type="button" onClick={() => recusar(pedido.id)} className="rounded-[8px] px-2.5 py-1.5 text-[12px] font-semibold text-muted transition hover:bg-surface hover:text-perigo">
                      Recusar
                    </button>
                    <button type="button" onClick={() => trocar(pedido.para, pedido.id)} className="app-primary-button px-3 py-1.5 text-[12px]">
                      Atender
                    </button>
                  </span>
                ) : (
                  <Selo tom={pedido.situacao === 'atendido' ? 'ok' : 'neutro'}>{pedido.situacao === 'atendido' ? 'Atendido' : 'Recusado'}</Selo>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {aviso && (
        <AvisoFlutuante tom="erro" aoSumir={() => setAviso(null)}>
          {aviso}
        </AvisoFlutuante>
      )}
    </div>
  )
}
