'use client'

import { useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AcaoDaFicha } from '@/components/lead-crm/acoes-da-ficha'

/**
 * O modo de edição da ficha do contato: um "Editar" no topo abre os campos no
 * próprio lugar (nome, origem, negociações, dados da pessoa) e uma barra
 * flutuante grava tudo de uma vez ou descarta.
 *
 * Substitui o modal de três campos: editar dentro da página mostra cada dado
 * onde ele mora, e a pessoa vê o que está mudando ao lado do resto da ficha.
 *
 * **Cada parte registra o próprio salvar** (`useAoSalvar`). O provedor não
 * conhece os campos, só chama quem se registrou, em ordem, e junta os erros.
 * Descartar (ou salvar com sucesso) sobe a `versao`: as partes usam ela como
 * `key` e voltam ao valor do servidor sem precisar limpar estado à mão.
 */

/** Grava o que esta parte mudou. Devolve a frase de erro, ou `null` se gravou (ou não havia nada). */
type Salvar = () => Promise<string | null>

type Edicao = {
  editando: boolean
  versao: number
  registrar: (id: string, salvar: Salvar | null) => void
}

const Contexto = createContext<Edicao | null>(null)

type Controle = {
  editando: boolean
  salvando: boolean
  erro: string | null
  iniciar: () => void
  descartar: () => void
  salvar: () => void
}

const Controles = createContext<Controle | null>(null)

export function ProvedorDeEdicao({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [editando, setEditando] = useState(false)
  const [versao, setVersao] = useState(0)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, comecar] = useTransition()
  const salvadores = useRef(new Map<string, Salvar>())

  const edicao: Edicao = {
    editando,
    versao,
    registrar: (id, salvar) => {
      if (salvar) salvadores.current.set(id, salvar)
      else salvadores.current.delete(id)
    },
  }

  const controle: Controle = {
    editando,
    salvando,
    erro,
    iniciar: () => {
      setErro(null)
      setEditando(true)
    },
    descartar: () => {
      setErro(null)
      setEditando(false)
      setVersao((v) => v + 1)
    },
    salvar: () => {
      setErro(null)
      comecar(async () => {
        const erros: string[] = []
        for (const salvar of salvadores.current.values()) {
          try {
            const falhou = await salvar()
            if (falhou) erros.push(falhou)
          } catch {
            erros.push('sem conexão com o servidor')
          }
        }
        router.refresh()
        if (erros.length > 0) {
          // O que gravou fica gravado; a ficha segue aberta para corrigir o resto.
          setErro(erros.join(' · '))
          return
        }
        setEditando(false)
        setVersao((v) => v + 1)
      })
    },
  }

  return (
    <Contexto.Provider value={edicao}>
      <Controles.Provider value={controle}>{children}</Controles.Provider>
    </Contexto.Provider>
  )
}

export function useEdicao(): { editando: boolean; versao: number } {
  const edicao = useContext(Contexto)
  return { editando: edicao?.editando ?? false, versao: edicao?.versao ?? 0 }
}

/**
 * Registra o salvar desta parte enquanto a ficha está em edição. O `salvar`
 * mais recente vale (ele fecha sobre o estado atual dos campos).
 */
export function useAoSalvar(id: string, salvar: Salvar) {
  const edicao = useContext(Contexto)
  const atual = useRef(salvar)
  useEffect(() => {
    atual.current = salvar
  })
  const editando = edicao?.editando ?? false
  const registrar = edicao?.registrar
  useEffect(() => {
    if (!registrar || !editando) return
    registrar(id, () => atual.current())
    return () => registrar(id, null)
  }, [id, editando, registrar])
}

/** O "Editar" do topo da ficha. Em edição, some: quem manda é a barra. */
export function BotaoDeEditar() {
  const controle = useContext(Controles)
  if (!controle || controle.editando) return null
  return (
    <AcaoDaFicha
      rotulo="Editar"
      titulo="Editar o contato: nome, origem, negociações e dados"
      aoClicar={controle.iniciar}
      icone={
        <>
          <path d="M4.5 19.5h4l10-10a2.1 2.1 0 0 0-3-3l-10 10v3Z" />
          <path d="m13.5 7.5 3 3" />
        </>
      }
    />
  )
}

/**
 * A barra que flutua embaixo enquanto a ficha está em edição.
 *
 * **Vai para o `body` por portal.** Dentro da ficha, um ancestral com
 * `transform` vira o bloco de referência do `fixed`, e a barra ficava parada
 * no meio da página em vez de acompanhar o rodapé da tela.
 */
export function BarraDeEdicao() {
  const controle = useContext(Controles)
  if (!controle?.editando || typeof document === 'undefined') return null
  return (
    <>
    {/* A altura da barra, no fim da página: sem ela o último campo ficava escondido atrás. */}
    <div aria-hidden className="h-28" />
    {createPortal(
    <div className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4 max-md:bottom-[84px]">
      <div
        role="region"
        aria-label="Edição do contato"
        className="flex w-full max-w-[640px] flex-wrap items-center gap-x-4 gap-y-2 rounded-[16px] border border-line bg-panel px-4 py-3 text-ink shadow-[0_12px_40px_rgba(19,25,34,0.28)]"
      >
        <span className="min-w-[220px] flex-1">
          <strong className="block text-[13px]">Editando o contato</strong>
          {controle.erro ? (
            <span role="alert" className="block text-[11.5px] font-semibold text-perigo">
              {controle.erro}
            </span>
          ) : (
            <span className="block text-[11.5px] text-dim">
              Os dados da pessoa ficam na aba Dados e origem. Nada muda até salvar.
            </span>
          )}
        </span>
        <span className="flex gap-2 max-sm:w-full max-sm:[&>*]:flex-1">
          <button type="button" onClick={controle.descartar} disabled={controle.salvando} className="botao-secundario botao-md">
            Descartar
          </button>
          <button type="button" onClick={controle.salvar} disabled={controle.salvando} className="botao-primario botao-md">
            {controle.salvando ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </span>
      </div>
    </div>,
    document.body,
    )}
    </>
  )
}
