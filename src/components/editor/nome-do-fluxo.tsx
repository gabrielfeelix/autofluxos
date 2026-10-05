'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { acaoRenomearFluxo } from '@/server/acoes'
import { LIMITE_NOME_DO_FLUXO } from '@/core/flow/limites'
import { Modal } from '@/components/design/modal'
import { RotuloCampo } from '@/components/design/modal-formulario'

/**
 * O nome da automação, editável onde ele aparece.
 *
 * **Renomear não existia**, e o pedido chegou nessas palavras: "não consigo
 * editar o nome dos fluxos". O nome era escolhido uma vez, no modal de criação,
 * e depois virava permanente, quem batizou de "Fluxo - teste" às pressas
 * ficava com isso no cabeçalho para sempre.
 *
 * **Edita no lugar, e não numa tela à parte.** É a mesma decisão das etiquetas:
 * renomear é conserto de um caractere errado, e mandar alguém para outra tela
 * para trocar uma letra é caro o suficiente para a pessoa desistir e conviver
 * com o nome torto.
 *
 * O que ele **não** toca: rascunho e versões publicadas. Nome é rótulo de
 * gaveta, não parte do desenho, conversa em andamento não sente nada.
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
  /**
   * `titulo` é o cabeçalho do editor, que edita no lugar. `linha` é a lista:
   * mostra o nome e o lápis, e o lápis abre um modal.
   */
  variante?: 'titulo' | 'linha'
}) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(nome)
  const [salvo, setSalvo] = useState(nome)
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, setRodando] = useState(false)
  const campo = useRef<HTMLInputElement>(null)

  /*
   * O nome pode chegar novo do servidor, outra aba renomeou, ou o
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
        className="group flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-left transition hover:bg-surface-strong"
      >
        <span className="text-sm font-bold tracking-[-0.01em]">{salvo}</span>
        <span
          aria-hidden
          className="text-[11px] text-dim opacity-0 transition group-hover:opacity-100"
        >
          ✎
        </span>
        <span className="sr-only">Renomear</span>
      </button>
    ) : (
      <ListaComLapis salvo={salvo} aoAbrir={() => setEditando(true)} />
    )
  }

  /*
   * Na lista, modal, e não campo na linha. O campo abria ao lado do nome, que
   * continuava ali: dois "Meu pedido" lado a lado, um deles editável, e a
   * linha pulando de altura. O pedido do Gabriel (05/out) foi esse: "podia
   * abrir um modal de renomear".
   */
  if (variante === 'linha') {
    return (
      <>
        <ListaComLapis salvo={salvo} aoAbrir={() => setEditando(true)} />
        {/*
          Por portal: a linha desliga o clique dos filhos (`pointer-events-none`)
          e está dentro de um `<strong>`, e o modal herdaria os dois.
        */}
        {createPortal(
          <Modal
            aberto
            aoFechar={cancelar}
            titulo="Renomear automação"
            descricao="Só o nome muda. O desenho e o que está publicado continuam iguais."
          >
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void confirmar()
              }}
            >
              <label className="block">
                <RotuloCampo>Nome da automação</RotuloCampo>
                <input
                  ref={campo}
                  value={valor}
                  disabled={rodando}
                  required
                  maxLength={LIMITE_NOME_DO_FLUXO}
                  onChange={(e) => setValor(e.target.value)}
                  className={`app-field w-full px-[13px] py-[11px] text-[13.5px] ${erro ? 'border-rose-400/40' : ''}`}
                />
              </label>
              {erro && (
                <p role="alert" className="mt-2 text-[12px] leading-5 text-perigo">
                  {erro}
                </p>
              )}
              <div className="mt-5 flex items-center justify-end gap-2">
                <button type="button" onClick={cancelar} className="botao-secundario botao-md">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={rodando || !valor.trim()}
                  className="botao-primario botao-md"
                >
                  {rodando ? 'Salvando…' : 'Salvar nome'}
                </button>
              </div>
            </form>
          </Modal>,
          document.body,
        )}
      </>
    )
  }

  /*
   * No cabeçalho do editor: campo e Salvar **na mesma linha**, na altura do
   * nome. A legenda "Enter salva · Esc desiste" embaixo aumentava a altura do
   * cabeçalho e cortava o campo na borda da tela. Enter e Esc continuam
   * valendo, só não ocupam espaço. O erro flutua embaixo, sem empurrar nada.
   */
  return (
    <span className="relative flex items-center gap-1.5">
      <input
        ref={campo}
        value={valor}
        disabled={rodando}
        maxLength={LIMITE_NOME_DO_FLUXO}
        aria-label="Nome da automação"
        onChange={(e) => setValor(e.target.value)}
        onBlur={() => void confirmar()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void confirmar()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            cancelar()
          }
        }}
        className={`app-field h-6 w-[240px] px-2 text-[13px] font-bold ${erro ? 'border-rose-400/40' : ''}`}
      />
      <button
        type="button"
        // Sem isto o clique tira o foco do campo antes, e o `onBlur` salva
        // primeiro: o botão some no meio do próprio clique.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => void confirmar()}
        disabled={rodando || !valor.trim()}
        className="botao-primario h-6 shrink-0 rounded-md px-2.5 text-[11.5px]"
      >
        {rodando ? 'Salvando…' : 'Salvar'}
      </button>
      {erro && (
        <span
          role="alert"
          className="absolute top-full left-0 z-30 mt-1 rounded-md border border-rose-400/30 bg-panel px-2 py-1 text-[11px] whitespace-nowrap text-perigo shadow-md"
        >
          {erro}
        </span>
      )}
    </span>
  )
}

/**
 * O nome na linha da lista, com o lápis ao lado.
 *
 * O nome mora aqui, e não na página, para mudar na hora em que o modal salva:
 * a lista é renderizada no servidor e só veria o nome novo no próximo
 * carregamento.
 */
function ListaComLapis({ salvo, aoAbrir }: { salvo: string; aoAbrir: () => void }) {
  return (
    <>
      <span className="truncate">{salvo}</span>
      <button
        type="button"
        onClick={aoAbrir}
        title={`Renomear "${salvo}"`}
        /*
          `pointer-events-auto` porque a linha da lista desliga o clique do
          conteúdo para ele atravessar até o link que cobre a linha. Quem é
          interativo devolve o clique para si mesmo, senão o lápis abriria a
          automação em vez de renomear.
        */
        className="pointer-events-auto flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] text-dim opacity-0 transition group-hover/linha:opacity-100 hover:bg-surface-strong hover:text-primary focus-visible:opacity-100"
      >
        <span aria-hidden>✎</span>
        <span className="sr-only">Renomear {salvo}</span>
      </button>
    </>
  )
}
