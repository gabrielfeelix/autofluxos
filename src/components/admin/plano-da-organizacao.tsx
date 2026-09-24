'use client'

import { useState, useTransition } from 'react'
import { AvisoFlutuante } from '@/components/design/aviso-flutuante'
import { acaoAdminCancelarDescida, acaoAdminRecusarPedido, acaoAdminTrocarPlano } from '@/server/acoes-admin'
import { diaPorExtenso, excedente, fraseDoExcedente, proximaVirada, reais } from '@/core/contrato-do-plano'
import { ModalDeTroca } from '@/components/plano/modal-de-troca'
import type { RecursoDoPlano } from '@/core/planos'
import { previsaoDaTroca, type UsoDaOrganizacao } from '@/core/troca-de-plano'
import { horaExata, quando } from '@/lib/quando'
import { Selo } from './partes'

export type PlanoNaTela = { id: string; nome: string; preco: number; conversas: number; numeros: number; precoExcedente: number; resumo: string; recursos: RecursoDoPlano[] }
export type DescidaNaTela = { plano: string; para: string }
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
  uso,
  descida: descidaInicial,
  precoContratado,
}: {
  organizacaoId: string
  atual: string
  /** A descida agendada para a virada do mês, se houver. */
  descida: DescidaNaTela | null
  /** O que a organização paga hoje; nulo = o preço do plano. */
  precoContratado: number | null
  planos: PlanoNaTela[]
  conversas: number
  pedidos: PedidoNaTela[]
  /** O uso medido junto da página: o modal calcula o impacto na hora. */
  uso: UsoDaOrganizacao
}) {
  const [atual, setAtual] = useState(inicial)
  const [descida, setDescida] = useState(descidaInicial)
  const [preco, setPreco] = useState(precoContratado)
  const [pedidos, setPedidos] = useState(pedidosIniciais)
  const [aviso, setAviso] = useState<string | null>(null)
  const [, comecar] = useTransition()
  // A troca passa pelo modal de impacto antes (bloqueio, o que sai, motivo).
  const [escolha, setEscolha] = useState<{ para: string; pedidoId?: string } | null>(null)
  const plano = planos.find((item) => item.id === atual) ?? planos[0]!
  const fracao = plano.conversas > 0 ? conversas / plano.conversas : 0
  const nome = (id: string) => planos.find((item) => item.id === id)?.nome ?? id

  const previsao = (para: string) => previsaoDaTroca(plano, planos.find((item) => item.id === para) ?? plano, uso, preco)

  // Subida vale na hora; descida fica agendada para a virada do mês (seção 8).
  const trocar = (para: string, pedidoId: string | undefined, confirmacao: { ciente: boolean; motivo: string }) => {
    setEscolha(null)
    const antes = { atual, pedidos, descida, preco }
    const desce = previsao(para).impacto.sentido === 'desce'
    if (para === atual) setDescida(null)
    else if (desce) setDescida({ plano: para, para: proximaVirada(new Date()) })
    else {
      setAtual(para)
      setDescida(null)
      setPreco(planos.find((item) => item.id === para)?.preco ?? null)
    }
    if (pedidoId) setPedidos((lista) => lista.map((pedido) => (pedido.id === pedidoId ? { ...pedido, situacao: 'atendido' } : pedido)))
    const voltar = (texto: string) => {
      setAtual(antes.atual)
      setDescida(antes.descida)
      setPreco(antes.preco)
      setPedidos(antes.pedidos)
      setAviso(texto)
    }
    comecar(async () => {
      try {
        const r = await acaoAdminTrocarPlano(organizacaoId, para, pedidoId, confirmacao)
        if (!r.ok) voltar(r.erro ?? 'não deu para trocar o plano')
      } catch {
        voltar('sem conexão com o servidor')
      }
    })
  }

  const desfazerDescida = () => {
    const antes = descida
    setDescida(null)
    comecar(async () => {
      const r = await acaoAdminCancelarDescida(organizacaoId).catch(() => ({ ok: false, erro: 'sem conexão com o servidor' }))
      if (!r.ok) {
        setDescida(antes)
        setAviso(r.erro ?? 'não deu para cancelar a descida')
      }
    })
  }

  const conta = fraseDoExcedente(excedente(conversas, plano))

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
        <p className="mt-2 text-[12px] leading-5 text-dim">
          {conta ? `${conta} Estimativa: a cobrança é manual enquanto não há gateway.` : `Acima da faixa, cada conversa custa ${reais(plano.precoExcedente)} na fatura seguinte.`}
        </p>
        <p className="mt-3 border-t border-line pt-3 text-[12.5px] text-muted">
          Paga <strong className="font-semibold text-ink tabular-nums">{reais(preco ?? plano.preco)}</strong> por mês
          {preco !== null && preco !== plano.preco && <span className="text-dim"> (contrato; o {plano.nome} custa {reais(plano.preco)} para organização nova)</span>}
        </p>
      </section>

      {descida && (
        <section className="flex flex-wrap items-center gap-3 rounded-[14px] border border-amber-400/30 bg-amber-400/[0.07] px-5 py-3.5">
          <p className="min-w-0 flex-1 text-[12.5px] leading-5 text-soft">
            <strong className="font-semibold">Descida agendada para o {nome(descida.plano)}</strong> em {diaPorExtenso(descida.para)}. Até lá, tudo continua como está; a organização é avisada 7 dias e 1 dia antes.
          </p>
          <button type="button" onClick={desfazerDescida} className="app-secondary-button px-3.5 py-2 text-[12.5px]">
            Cancelar descida
          </button>
        </section>
      )}

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
                    {eh ? <Selo tom="destaque">Plano atual</Selo> : descida?.plano === item.id ? <Selo tom="aviso">Agendado</Selo> : null}
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
                    ) : descida?.plano === item.id ? (
                      <p className="text-[12px] text-dim">Vale em {diaPorExtenso(descida.para)}</p>
                    ) : (
                      <button type="button" onClick={() => setEscolha({ para: item.id })} className="app-secondary-button w-full px-3 py-2 text-[12.5px]">
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
                    <button type="button" onClick={() => setEscolha({ para: pedido.para, pedidoId: pedido.id })} className="app-primary-button px-3 py-1.5 text-[12px]">
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

      {escolha && (
        <ModalDeTroca
          quem="administracao"
          paraNome={nome(escolha.para)}
          previsao={previsao(escolha.para)}
          aoFechar={() => setEscolha(null)}
          aoConfirmar={(confirmacao) => trocar(escolha.para, escolha.pedidoId, confirmacao)}
        />
      )}
      {aviso && (
        <AvisoFlutuante tom="erro" aoSumir={() => setAviso(null)}>
          {aviso}
        </AvisoFlutuante>
      )}
    </div>
  )
}
