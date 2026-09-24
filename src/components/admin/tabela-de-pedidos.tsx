'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { AvisoFlutuante } from '@/components/design/aviso-flutuante'
import { RolagemDaTabela } from '@/components/lead/rolagem-da-tabela'
import { acaoAdminRecusarPedido, acaoAdminTrocarPlano } from '@/server/acoes-admin'
import { horaExata, quando } from '@/lib/quando'
import { CLASSE_DO_CABECALHO, COLUNA_FIXA, FUNDO_DA_FIXA, FUNDO_DA_LINHA, Selo } from './partes'

export type PedidoNaTabela = {
  id: string
  quando: string
  organizacaoId: string
  organizacaoNome: string
  quemPediu: string
  de: string
  para: string
  situacao: 'aberto' | 'atendido' | 'recusado'
  respondidoPor: string | null
}

/** Os pedidos de troca de plano. Atender troca o plano e fecha o pedido; os dois são otimistas. */
export function TabelaDePedidos({ pedidos: iniciais, nomes }: { pedidos: PedidoNaTabela[]; nomes: Record<string, string> }) {
  const [pedidos, setPedidos] = useState(iniciais)
  const [aviso, setAviso] = useState<string | null>(null)
  const [, comecar] = useTransition()
  const nome = (id: string) => nomes[id] ?? id

  const responder = (pedido: PedidoNaTabela, atender: boolean) => {
    const antes = pedidos
    setPedidos((lista) => lista.map((item) => (item.id === pedido.id ? { ...item, situacao: atender ? 'atendido' : 'recusado', respondidoPor: 'você' } : item)))
    comecar(async () => {
      try {
        const r = atender ? await acaoAdminTrocarPlano(pedido.organizacaoId, pedido.para, pedido.id) : await acaoAdminRecusarPedido(pedido.id)
        if (!r.ok) {
          setPedidos(antes)
          setAviso(r.erro ?? 'não deu para responder o pedido')
        }
      } catch {
        setPedidos(antes)
        setAviso('sem conexão com o servidor')
      }
    })
  }

  return (
    <div className="app-card flex min-h-0 flex-1 flex-col overflow-hidden">
      <RolagemDaTabela>
        <table className="w-full min-w-[880px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className={`${CLASSE_DO_CABECALHO} ${COLUNA_FIXA} z-[3] bg-panel`}>Organização</th>
              <th scope="col" className={CLASSE_DO_CABECALHO}>Troca pedida</th>
              <th scope="col" className={CLASSE_DO_CABECALHO}>Quem pediu</th>
              <th scope="col" className={CLASSE_DO_CABECALHO}>Quando</th>
              <th scope="col" className={CLASSE_DO_CABECALHO}>Situação</th>
              <th scope="col" className="w-[190px] px-2 py-3">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((pedido) => (
              <tr key={pedido.id} className={`group border-b border-line last:border-0 ${FUNDO_DA_LINHA}`}>
                <td className={`${COLUNA_FIXA} ${FUNDO_DA_FIXA} px-4 py-3`}>
                  <Link href={`/admin/organizacoes/${pedido.organizacaoId}/plano`} className="block truncate text-[13px] font-bold hover:text-primary">
                    {pedido.organizacaoNome}
                  </Link>
                </td>
                <td className="px-4 py-3 text-[12.5px] whitespace-nowrap">
                  <span className="text-muted">{nome(pedido.de)}</span> <span aria-hidden className="text-dim">→</span> <strong className="font-semibold">{nome(pedido.para)}</strong>
                </td>
                <td className="max-w-[220px] truncate px-4 py-3 text-[12.5px] text-muted">{pedido.quemPediu || 'alguém'}</td>
                <td className="px-4 py-3 text-[12px] whitespace-nowrap text-muted">
                  <span title={horaExata(pedido.quando)}>{quando(pedido.quando)}</span>
                </td>
                <td className="px-4 py-3">
                  {pedido.situacao === 'aberto' ? <Selo tom="aviso">Esperando resposta</Selo> : pedido.situacao === 'atendido' ? <Selo tom="ok">Atendido</Selo> : <Selo>Recusado</Selo>}
                  {pedido.respondidoPor && <span className="mt-0.5 block truncate text-[10.5px] text-dim">por {pedido.respondidoPor}</span>}
                </td>
                <td className="px-3 py-2.5">
                  {pedido.situacao === 'aberto' && (
                    <span className="flex justify-end gap-1.5">
                      <button type="button" onClick={() => responder(pedido, false)} className="rounded-[8px] px-2.5 py-1.5 text-[12px] font-semibold text-muted transition hover:bg-surface hover:text-perigo">
                        Recusar
                      </button>
                      <button type="button" onClick={() => responder(pedido, true)} className="app-primary-button px-3 py-1.5 text-[12px] whitespace-nowrap">
                        Atender
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </RolagemDaTabela>
      {aviso && (
        <AvisoFlutuante tom="erro" aoSumir={() => setAviso(null)}>
          {aviso}
        </AvisoFlutuante>
      )}
    </div>
  )
}
