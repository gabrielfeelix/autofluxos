'use client'

import { useEffect, useRef, useState } from 'react'
import { acaoRenomearFluxo } from '@/server/acoes'
import { LIMITE_NOME_DO_FLUXO } from '@/core/flow/limites'

/**
 * O nome da automação, editável onde ele aparece.
 *
 * **Renomear não existia**, e o pedido chegou nessas palavras: "não consigo
 * editar o nome dos fluxos". O nome era escolhido uma vez, no modal de criação,
 * e depois virava permanente — quem batizou de "Fluxo - teste" às pressas
 * ficava com isso no cabeçalho para sempre.
 *
 * **Edita no lugar, e não numa tela à parte.** É a mesma decisão das etiquetas:
 * renomear é conserto de um caractere errado, e mandar alguém para outra tela
 * para trocar uma letra é caro o suficiente para a pessoa desistir e conviver
 * com o nome torto.
 *
 * O que ele **não** toca: rascunho e versões publicadas. Nome é rótulo de
 * gaveta, não parte do desenho — conversa em andamento não sente nada.
 */
export function NomeDoFluxo({
  clienteId,
  fluxoId,
  nome,
  variante = 'titulo',
}: {
  clienteId: string
  fluxoId: string
  nome: string
  /** `titulo` é o cabeçalho do editor; `linha` é o lápis da lista. */
  variante?: 'titulo' | 'linha'
}) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(nome)
  const [salvo, setSalvo] = useState(nome)
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, setRodando] = useState(false)
  const campo = useRef<HTMLInputElement>(null)

  /*
   * O nome pode chegar novo do servidor — outra aba renomeou, ou o
   * `revalidatePath` da própria ação voltou. Ajustar durante o render, e não
   * num efeito: efeito que chama `setState` no corpo pinta a tela uma vez com
   * o valor velho antes de corrigir, e é a receita de render em cascata que o
   * próprio React desaconselha.
   *
   * Enquanto alguém está digitando, o que veio do servidor é ignorado no campo:
   * sobrescrever texto no meio da digitação é pior do que ficar um pouco atrás.
   */
  const [ultimoDoServidor, setUltimoDoServidor] = useState(nome)
  if (nome !== ultimoDoServidor) {
    setUltimoDoServidor(nome)
    setSalvo(nome)
    if (!editando) setValor(nome)
  }

  useEffect(() => {
    if (editando) campo.current?.select()
  }, [editando])

  async function confirmar() {
    const limpo = valor.trim()
    if (limpo === salvo) {
      setEditando(false)
      setErro(null)
      return
    }

    setRodando(true)
    const r = await acaoRenomearFluxo(clienteId, fluxoId, limpo)
    setRodando(false)

    if (!r.ok) {
      setErro(r.erro ?? 'não deu para renomear')
      return
    }
    setSalvo(r.nome ?? limpo)
    setValor(r.nome ?? limpo)
    setErro(null)
    setEditando(false)
  }

  function cancelar() {
    setValor(salvo)
    setErro(null)
    setEditando(false)
  }

  if (!editando) {
    return variante === 'titulo' ? (
      <button
        type="button"
        onClick={() => setEditando(true)}
        title="Renomear esta automação"
        className="group flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-left transition hover:bg-white/[0.05]"
      >
        <span className="text-sm font-bold tracking-[-0.01em]">{salvo}</span>
        <span aria-hidden className="text-[11px] text-dim opacity-0 transition group-hover:opacity-100">
          ✎
        </span>
        <span className="sr-only">Renomear</span>
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setEditando(true)}
        title={`Renomear "${salvo}"`}
        /*
          `pointer-events-auto` porque a linha da lista desliga o clique do
          conteúdo para ele atravessar até o link que cobre a linha. Quem é
          interativo devolve o clique para si mesmo — senão o lápis abriria a
          automação em vez de renomear.
        */
        className="pointer-events-auto flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] text-dim opacity-0 transition group-hover/linha:opacity-100 hover:bg-white/[0.08] hover:text-accent focus-visible:opacity-100"
      >
        <span aria-hidden>✎</span>
        <span className="sr-only">Renomear {salvo}</span>
      </button>
    )
  }

  return (
    <span
      className={
        variante === 'titulo'
          ? 'block'
          : 'pointer-events-auto inline-flex flex-col items-start gap-1'
      }
    >
      <input
        ref={campo}
        value={valor}
        disabled={rodando}
        aria-label="Nome da automação"
        onChange={(e) => setValor(e.target.value)}
        onBlur={() => void confirmar()}
        onKeyDown={(e) => {
          // Enter confirma e Esc desiste. Sem o Esc, quem abriu sem querer só
          // sai apagando o que digitou e torcendo para lembrar o nome antigo.
          if (e.key === 'Enter') {
            e.preventDefault()
            void confirmar()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            cancelar()
          }
        }}
        className={`app-field px-2 py-1 text-[13px] font-bold ${
          variante === 'titulo' ? 'w-[280px]' : 'w-[200px]'
        } ${erro ? 'border-rose-400/40' : ''}`}
      />
      {erro ? (
        <span role="alert" className="mt-0.5 block text-[10px] leading-4 text-rose-300">
          {erro}
        </span>
      ) : (
        <span className="mt-0.5 block text-[10px] text-dim">
          Enter salva · Esc desiste · até {LIMITE_NOME_DO_FLUXO} caracteres
        </span>
      )}
    </span>
  )
}
