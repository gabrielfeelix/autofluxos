'use client'

import { Fragment, useState, useTransition } from 'react'
import { AvisoFlutuante } from '@/components/design/aviso-flutuante'
import { RolagemDaTabela } from '@/components/lead/rolagem-da-tabela'
import { acaoVerAlerta } from '@/server/acoes-alertas'
import { horaExata, quando } from '@/lib/quando'
import { CLASSE_DO_CABECALHO, FUNDO_DA_LINHA, Selo } from './partes'

export type AlertaNaTabela = {
  id: string
  titulo: string
  detalhe: string
  contexto: [string, string][]
  ambiente: string
  criadoEm: string
  visto: boolean
}

/**
 * Os alertas em tabela. "Marcar como visto" esmaece a linha na hora; o
 * detalhe (um stack que quase ninguém abre) abre embaixo da linha, e não num
 * modal, para dar para selecionar e copiar sem perder a lista de vista.
 */
export function TabelaDeAlertas({ alertas: iniciais }: { alertas: AlertaNaTabela[] }) {
  const [alertas, setAlertas] = useState(iniciais)
  const [aberto, setAberto] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [, comecar] = useTransition()
  const abertos = alertas.filter((alerta) => !alerta.visto).length

  const ver = (id?: string) => {
    const anterior = alertas
    setAlertas((lista) => lista.map((alerta) => (!id || alerta.id === id ? { ...alerta, visto: true } : alerta)))
    comecar(async () => {
      try {
        const r = await acaoVerAlerta(id)
        if (!r.ok) {
          setAlertas(anterior)
          setAviso(r.erro ?? 'não deu para marcar')
        }
      } catch {
        setAlertas(anterior)
        setAviso('sem conexão com o servidor')
      }
    })
  }

  return (
    <>
      {abertos > 0 && (
        <div className="mb-3 flex justify-end">
          <button type="button" onClick={() => ver()} className="app-secondary-button px-3.5 py-2 text-[12.5px]">
            Marcar {abertos} como {abertos === 1 ? 'visto' : 'vistos'}
          </button>
        </div>
      )}
      <div className="app-card flex min-h-0 flex-1 flex-col overflow-hidden">
        <RolagemDaTabela>
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={`${CLASSE_DO_CABECALHO} w-[44%]`}>Alerta</th>
                <th scope="col" className={CLASSE_DO_CABECALHO}>Contexto</th>
                <th scope="col" className={CLASSE_DO_CABECALHO}>Quando</th>
                <th scope="col" className="w-[200px] px-2 py-3">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {alertas.map((alerta) => (
                <Fragment key={alerta.id}>
                  <tr className={`border-b border-line align-top ${FUNDO_DA_LINHA} ${alerta.visto ? 'text-muted' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="flex items-start gap-2 text-[13px] font-semibold">
                        <span aria-label={alerta.visto ? 'visto' : 'não visto'} className={`mt-1.5 size-[7px] shrink-0 rounded-full ${alerta.visto ? 'bg-line' : 'bg-amber-400'}`} />
                        <span className={alerta.visto ? 'text-muted' : 'text-ink'}>{alerta.titulo}</span>
                        {alerta.ambiente !== 'production' && <Selo>{alerta.ambiente}</Selo>}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {alerta.contexto.length === 0 ? (
                        <span className="text-[12px] text-dim">sem contexto</span>
                      ) : (
                        <dl className="flex flex-wrap gap-x-3 gap-y-1">
                          {alerta.contexto.slice(0, 3).map(([chave, valor]) => (
                            <div key={chave} className="flex max-w-[260px] gap-1 text-[11.5px]">
                              <dt className="shrink-0 text-dim">{chave}:</dt>
                              <dd className="truncate font-mono text-muted">{valor}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[12px] whitespace-nowrap text-muted">
                      <time dateTime={alerta.criadoEm} title={horaExata(alerta.criadoEm)}>
                        {quando(alerta.criadoEm)}
                      </time>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          aria-expanded={aberto === alerta.id}
                          onClick={() => setAberto((atual) => (atual === alerta.id ? null : alerta.id))}
                          className="rounded-[8px] px-2.5 py-1.5 text-[12px] font-semibold text-muted transition hover:bg-surface hover:text-ink"
                        >
                          {aberto === alerta.id ? 'Esconder' : 'Detalhe'}
                        </button>
                        {!alerta.visto && (
                          <button type="button" onClick={() => ver(alerta.id)} className="app-secondary-button px-2.5 py-1.5 text-[12px] whitespace-nowrap">
                            Marcar como visto
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {aberto === alerta.id && (
                    <tr className="border-b border-line bg-surface/40">
                      <td colSpan={4} className="px-4 py-3">
                        {alerta.contexto.length > 3 && (
                          <dl className="mb-2 flex flex-wrap gap-x-3.5 gap-y-1">
                            {alerta.contexto.map(([chave, valor]) => (
                              <div key={chave} className="flex gap-1.5 text-[11.5px]">
                                <dt className="text-dim">{chave}:</dt>
                                <dd className="font-mono text-muted">{valor}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                        <pre className="max-h-[280px] overflow-auto rounded-[9px] border border-line bg-panel p-3 font-mono text-[11px] leading-5 whitespace-pre-wrap text-muted">{alerta.detalhe}</pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </RolagemDaTabela>
      </div>
      {aviso && (
        <AvisoFlutuante tom="erro" aoSumir={() => setAviso(null)}>
          {aviso}
        </AvisoFlutuante>
      )}
    </>
  )
}
