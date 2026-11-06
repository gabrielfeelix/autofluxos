'use client'

import { useMemo, useRef, useState } from 'react'
import { descrever } from '@/core/flow/descrever'
import { regrasDaCondicao, type Fluxo, type No } from '@/core/flow/schema'
import { VARIAVEIS_NATIVAS } from '@/core/contatos/vars-iniciais'
import { Popover } from './popover'

/**
 * "Variáveis" no cabeçalho do editor (06/nov/2026, pedido do Eduardo).
 *
 * O desenho cria variáveis espalhadas: a pergunta guarda `aluno`, o Guardar
 * grava `plano`, a IA salva `resumo`. Quem volta ao fluxo dias depois não
 * lembra de onde veio cada uma, e o canvas não diz. O painel responde as três
 * perguntas de quem vai usar uma variável: **qual bloco cria**, **onde já é
 * usada** e **que valores ela pode ter**.
 *
 * Fica atrás de um botão, e não fixo na tela: com trinta variáveis, uma lista
 * sempre aberta cobriria o desenho. Por isso também a busca, que aparece a
 * partir de oito.
 */
export function BotaoDeVariaveis({
  fluxo,
  origens,
  valores,
  respostasPorVariavel,
  variaveisDaConta,
  aoFocar,
}: {
  fluxo: Fluxo
  /** Variável → ids dos blocos que a criam (`variaveisDoFluxo`). */
  origens: Record<string, string[]>
  valores: Record<string, string[]>
  respostasPorVariavel: Record<string, number>
  variaveisDaConta: string[]
  aoFocar: (noId: string) => void
}) {
  const botao = useRef<HTMLButtonElement>(null)
  const [aberto, setAberto] = useState(false)
  const [largura, setLargura] = useState(380)
  const [busca, setBusca] = useState('')
  const [copiada, setCopiada] = useState<string | null>(null)

  const porId = useMemo(() => new Map(fluxo.nodes.map((n) => [n.id, n as No])), [fluxo.nodes])
  const criadas = useMemo(() => Object.keys(origens).sort((a, b) => a.localeCompare(b, 'pt-BR')), [origens])
  const daConta = useMemo(
    () => variaveisDaConta.filter((v) => !origens[v]).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [variaveisDaConta, origens],
  )

  /** Os blocos que citam a variável: `{{nome}}` no texto ou a regra da condição. */
  const usos = useMemo(() => {
    const mapa: Record<string, string[]> = {}
    for (const no of fluxo.nodes as No[]) {
      const texto = JSON.stringify(no.data)
      const daCondicao =
        no.type === 'condicao' ? regrasDaCondicao(no.data).flatMap((r) => (r.tipo === 'variavel' ? [r.variavel] : [])) : []
      for (const nome of [...criadas, ...daConta]) {
        if (texto.includes(`{{${nome}}}`) || daCondicao.includes(nome)) (mapa[nome] ??= []).push(no.id)
      }
    }
    return mapa
  }, [fluxo.nodes, criadas, daConta])

  const termo = busca.trim().toLowerCase()
  const filtrar = (lista: readonly string[]) => (termo ? lista.filter((v) => v.toLowerCase().includes(termo)) : lista)
  const total = criadas.length

  const copiar = (nome: string) => {
    void navigator.clipboard?.writeText(`{{${nome}}}`).then(() => {
      setCopiada(nome)
      window.setTimeout(() => setCopiada((atual) => (atual === nome ? null : atual)), 1500)
    })
  }

  const focar = (noId: string) => {
    setAberto(false)
    aoFocar(noId)
  }

  return (
    <>
      <button
        ref={botao}
        type="button"
        onClick={() => {
          setLargura(Math.min(380, window.innerWidth - 24))
          setAberto((a) => !a)
        }}
        aria-expanded={aberto}
        title="As variáveis deste fluxo: onde nascem e onde são usadas"
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-strong px-2.5 py-1.5 text-xs text-muted transition hover:border-primary/50 hover:bg-primary/[0.08] hover:text-primary 2xl:py-1"
      >
        <span aria-hidden className="font-mono text-[11px]">{'{x}'}</span>
        <span className="sr-only 2xl:not-sr-only">Variáveis</span>
        {total > 0 && <span className="tabular-nums text-[11px] text-dim">{total}</span>}
      </button>

      <Popover aberto={aberto} gatilho={botao} largura={largura} altura={520} aoFechar={() => setAberto(false)}>
        <div className="flex max-h-[min(520px,75vh)] flex-col">
          <div className="border-b border-strong px-4 pt-3.5 pb-3">
            <p className="text-[13px] font-semibold text-ink">Variáveis deste fluxo</p>
            <p className="mt-0.5 text-[11.5px] leading-4 text-dim">
              Clique no bloco para ir até ele. Clique no nome para copiar e colar numa mensagem.
            </p>
            {total + daConta.length >= 8 && (
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar variável"
                aria-label="Buscar variável"
                className="app-field mt-2.5 w-full px-3 py-2 text-[12.5px]"
              />
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            {total === 0 ? (
              <p className="px-2 py-3 text-[12px] leading-5 text-dim">
                Nenhuma variável criada ainda. Ela nasce quando uma Pergunta guarda a resposta, quando
                o bloco Guardar registra algo ou quando a IA salva um resumo.
              </p>
            ) : (
              <ul className="space-y-1">
                {filtrar(criadas).map((nome) => {
                  const respostas = respostasPorVariavel[nome] ?? 0
                  const usadaEm = (usos[nome] ?? []).filter((id) => !(origens[nome] ?? []).includes(id))
                  const possiveis = valores[nome] ?? []
                  return (
                    <li key={nome} className="rounded-[10px] px-2 py-2 hover:bg-surface-strong/60">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => copiar(nome)}
                          title={`Copiar {{${nome}}}`}
                          className="min-w-0 truncate rounded-md bg-primary/[0.08] px-1.5 py-0.5 font-mono text-[12px] text-primary hover:bg-primary/[0.14]"
                        >
                          {copiada === nome ? 'copiado' : `{{${nome}}}`}
                        </button>
                        {respostas > 0 && (
                          <span className="shrink-0 text-[11px] text-dim tabular-nums">
                            {respostas} {respostas === 1 ? 'resposta' : 'respostas'}
                          </span>
                        )}
                      </div>

                      {(origens[nome] ?? []).map((id) => {
                        const no = porId.get(id)
                        if (!no) return null
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => focar(id)}
                            className="mt-1 flex w-full items-baseline gap-1.5 text-left text-[11.5px] leading-4"
                          >
                            <span className="shrink-0 text-dim">Criada em</span>
                            <span className="min-w-0 truncate text-soft underline-offset-2 hover:text-primary hover:underline">
                              {descrever(no)}
                            </span>
                          </button>
                        )
                      })}

                      {usadaEm.length > 0 && (
                        <p className="mt-0.5 text-[11.5px] leading-4 text-dim">
                          Usada em{' '}
                          {usadaEm.map((id, i) => {
                            const no = porId.get(id)
                            if (!no) return null
                            return (
                              <span key={id}>
                                {i > 0 && ', '}
                                <button
                                  type="button"
                                  onClick={() => focar(id)}
                                  className="text-soft underline-offset-2 hover:text-primary hover:underline"
                                >
                                  {descrever(no)}
                                </button>
                              </span>
                            )
                          })}
                        </p>
                      )}
                      {usadaEm.length === 0 && (
                        <p className="mt-0.5 text-[11.5px] leading-4 text-dim">Ainda não é usada em nenhum bloco.</p>
                      )}

                      {possiveis.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {possiveis.slice(0, 6).map((v) => (
                            <span key={v} className="rounded-md border border-strong px-1.5 py-0.5 text-[10.5px] text-muted">
                              {v}
                            </span>
                          ))}
                          {possiveis.length > 6 && (
                            <span className="px-1 py-0.5 text-[10.5px] text-dim">+{possiveis.length - 6}</span>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            {filtrar(daConta).length > 0 && (
              <section className="mt-3 border-t border-strong px-2 pt-3">
                <p className="text-[11px] font-bold tracking-[0.05em] text-muted uppercase">De outras automações</p>
                <p className="mt-0.5 text-[11.5px] leading-4 text-dim">
                  Ficam guardadas no contato e podem ser lidas aqui.
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {filtrar(daConta).map((nome) => (
                    <button
                      key={nome}
                      type="button"
                      onClick={() => copiar(nome)}
                      className="rounded-md border border-strong px-1.5 py-0.5 font-mono text-[11px] text-muted hover:border-primary/50 hover:text-primary"
                    >
                      {copiada === nome ? 'copiado' : `{{${nome}}}`}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {filtrar(['nome', 'telefone']).length > 0 && (
              <section className="mt-3 border-t border-strong px-2 pt-3 pb-1">
                <p className="text-[11px] font-bold tracking-[0.05em] text-muted uppercase">Sempre disponíveis</p>
                <p className="mt-0.5 text-[11.5px] leading-4 text-dim">
                  Vêm do contato e da data, sem nenhum bloco criar.
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {filtrar(VARIAVEIS_NATIVAS).map((nome) => (
                    <button
                      key={nome}
                      type="button"
                      onClick={() => copiar(nome)}
                      className="rounded-md border border-strong px-1.5 py-0.5 font-mono text-[11px] text-muted hover:border-primary/50 hover:text-primary"
                    >
                      {copiada === nome ? 'copiado' : `{{${nome}}}`}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </Popover>
    </>
  )
}
