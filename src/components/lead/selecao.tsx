'use client'

import { createContext, useContext, useMemo, useState, useTransition, type ReactNode } from 'react'
import { CLASSE_DA_COR, type CorDeEtiqueta } from '@/core/etiquetas'
import { acaoApagarContatos, acaoMarcarEtiqueta, acaoPorNoQuadro } from '@/server/acoes'

export type EtiquetaDaBarra = { id: string; nome: string; cor: CorDeEtiqueta }
export type QuadroDaBarra = { id: string; nome: string }

type Contexto = {
  marcados: string[]
  alternar: (id: string) => void
  definir: (ids: string[]) => void
  ocupado: boolean
}

const SelecaoContexto = createContext<Contexto | null>(null)

/**
 * Seleção múltipla numa tabela renderizada no servidor.
 *
 * **A tabela continua sendo do servidor**, e só a caixinha e a barra são de
 * cliente. É de propósito: as datas da lista são formatadas com fuso fixo e
 * hora relativa ("há 2 min"), e formatá-las no navegador traria a divergência
 * clássica entre o HTML e a hidratação. O provedor envolve as linhas do
 * servidor e cada `CaixaDeSelecao` lá dentro lê o contexto daqui.
 *
 * A barra só aparece com alguma coisa marcada. Barra permanente vazia ocupa a
 * área onde a próxima linha da tabela deveria estar e não informa nada.
 */
export function SelecaoDeContatos({
  clienteId,
  etiquetas,
  quadros,
  children,
}: {
  clienteId: string
  etiquetas: EtiquetaDaBarra[]
  /** Os quadros da conta (C1). Vazio = a conta ainda não tem funil desenhado. */
  quadros: QuadroDaBarra[]
  children: ReactNode
}) {
  const [marcados, setMarcados] = useState<string[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, comecar] = useTransition()

  const valor = useMemo<Contexto>(
    () => ({
      marcados,
      alternar: (id) =>
        setMarcados((atuais) =>
          atuais.includes(id) ? atuais.filter((outro) => outro !== id) : [...atuais, id],
        ),
      definir: setMarcados,
      ocupado,
    }),
    [marcados, ocupado],
  )

  const etiquetar = (etiquetaId: string, aplicar: boolean) => {
    setErro(null)
    setAviso(null)
    comecar(async () => {
      const r = await acaoMarcarEtiqueta(clienteId, etiquetaId, marcados, aplicar)
      if (!r.ok) setErro(r.erro ?? 'não deu para etiquetar')
      else {
        const nome = etiquetas.find((e) => e.id === etiquetaId)?.nome ?? 'a etiqueta'
        setAviso(`${aplicar ? 'Apliquei' : 'Tirei'} “${nome}” em ${marcados.length} contato(s).`)
        setMarcados([])
      }
    })
  }

  /**
   * Põe os selecionados na **primeira etapa** do quadro (C1).
   *
   * É o caminho real de encher um funil: depois de uma importação, trinta leads
   * entram de uma vez. Quem já estava no quadro não volta para a primeira etapa
   * — o aviso diz quantos entraram de verdade, e não quantos foram clicados,
   * porque a diferença entre os dois números é exatamente a informação útil.
   */
  const porNoQuadro = (quadroId: string) => {
    setErro(null)
    setAviso(null)
    comecar(async () => {
      try {
        const r = await acaoPorNoQuadro(clienteId, quadroId, marcados)
        if (!r.ok) {
          setErro(r.erro ?? 'não deu para pôr no quadro')
          return
        }
        const nome = quadros.find((q) => q.id === quadroId)?.nome ?? 'o quadro'
        const postos = r.postos ?? 0
        setAviso(
          postos === marcados.length
            ? `Pus ${postos} contato(s) em “${nome}”.`
            : `Pus ${postos} em “${nome}” — ${marcados.length - postos} já estavam lá e não foram movidos.`,
        )
        setMarcados([])
      } catch {
        setErro('não deu para pôr no quadro agora')
      }
    })
  }

  const apagar = () => {
    setErro(null)
    setAviso(null)
    if (
      !confirm(
        `Apagar ${marcados.length} contato(s)? Some a conversa inteira de cada um, e não dá para desfazer.`,
      )
    ) {
      return
    }
    comecar(async () => {
      const r = await acaoApagarContatos(clienteId, marcados)
      if (!r.ok) setErro(r.erro ?? 'não deu para apagar')
      else {
        setAviso(`Apaguei ${r.apagados ?? 0} contato(s).`)
        setMarcados([])
      }
    })
  }

  return (
    <SelecaoContexto.Provider value={valor}>
      {(marcados.length > 0 || aviso || erro) && (
        <div className="mb-3 rounded-[12px] border border-white/[0.09] bg-white/[0.035] px-4 py-3">
          {marcados.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <strong className="text-[12.5px] font-bold">
                {marcados.length} {marcados.length === 1 ? 'selecionado' : 'selecionados'}
              </strong>
              <button
                type="button"
                onClick={() => setMarcados([])}
                className="text-[11.5px] font-semibold text-accent hover:underline"
              >
                limpar
              </button>

              <span className="mx-1 h-4 w-px bg-white/10" aria-hidden />

              {etiquetas.length === 0 ? (
                <span className="text-[11.5px] text-dim">
                  Crie etiquetas em Configurações para usá-las aqui.
                </span>
              ) : (
                etiquetas.map((etiqueta) => (
                  <span key={etiqueta.id} className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => etiquetar(etiqueta.id, true)}
                      title={`Aplicar “${etiqueta.nome}” nos selecionados`}
                      className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold transition disabled:opacity-50 ${CLASSE_DA_COR[etiqueta.cor]}`}
                    >
                      + {etiqueta.nome}
                    </button>
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => etiquetar(etiqueta.id, false)}
                      title={`Tirar “${etiqueta.nome}” dos selecionados`}
                      aria-label={`Tirar ${etiqueta.nome} dos selecionados`}
                      className="rounded-full border border-white/[0.08] px-1.5 py-0.5 text-[10.5px] font-bold text-dim transition hover:border-white/20 hover:text-muted disabled:opacity-50"
                    >
                      −
                    </button>
                  </span>
                ))
              )}

              {quadros.length > 0 && (
                <>
                  <span className="mx-1 h-4 w-px bg-white/10" aria-hidden />
                  {quadros.map((quadro) => (
                    <button
                      key={quadro.id}
                      type="button"
                      disabled={ocupado}
                      onClick={() => porNoQuadro(quadro.id)}
                      title={`Põe os selecionados na primeira etapa de “${quadro.nome}”. Quem já está lá não é movido.`}
                      className="rounded-full border border-white/[0.09] bg-white/[0.03] px-2.5 py-0.5 text-[10.5px] font-semibold text-muted transition hover:border-accent/40 hover:text-accent disabled:opacity-50"
                    >
                      → {quadro.nome}
                    </button>
                  ))}
                </>
              )}

              <button
                type="button"
                disabled={ocupado}
                onClick={apagar}
                className="ml-auto rounded-lg border border-white/[0.09] px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:border-rose-400/40 hover:bg-rose-400/[0.09] hover:text-rose-300 disabled:opacity-50"
              >
                {ocupado ? '…' : 'Apagar'}
              </button>
            </div>
          )}

          {aviso && (
            <p role="status" className="mt-1 text-[11.5px] font-semibold text-emerald-300">
              {aviso}
            </p>
          )}
          {erro && (
            <p role="alert" className="mt-1 text-[11.5px] font-semibold text-rose-300">
              {erro}
            </p>
          )}
        </div>
      )}

      {children}
    </SelecaoContexto.Provider>
  )
}

function useSelecao(): Contexto {
  const contexto = useContext(SelecaoContexto)
  if (!contexto) throw new Error('CaixaDeSelecao fora de SelecaoDeContatos')
  return contexto
}

export function CaixaDeSelecao({ id, rotulo }: { id: string; rotulo: string }) {
  const { marcados, alternar, ocupado } = useSelecao()

  return (
    <input
      type="checkbox"
      checked={marcados.includes(id)}
      disabled={ocupado}
      onChange={() => alternar(id)}
      aria-label={`Selecionar ${rotulo}`}
      className="size-3.5 accent-[#a78bfa]"
    />
  )
}

/**
 * A caixinha do cabeçalho marca **esta página**, e não a base inteira.
 *
 * Um "marcar tudo" que alcançasse as outras páginas é o botão que apaga cinco
 * mil contatos achando que apagou cinquenta. O que a tela mostra é o que a
 * seleção pega.
 */
export function CaixaDeTodos({ ids }: { ids: string[] }) {
  const { marcados, definir, ocupado } = useSelecao()
  const todos = ids.length > 0 && ids.every((id) => marcados.includes(id))

  return (
    <input
      type="checkbox"
      checked={todos}
      disabled={ocupado}
      onChange={() => definir(todos ? [] : ids)}
      aria-label="Selecionar os contatos desta página"
      className="size-3.5 accent-[#a78bfa]"
    />
  )
}
