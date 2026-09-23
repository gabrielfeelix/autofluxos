'use client'

import { useRef, useState } from 'react'

export type PessoaDoSeletor = { id: string; nome: string }

/** Minúsculas e sem acento, para "joao" achar "João". */
function normal(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/**
 * Escolher uma pessoa da equipe num modal com busca (plano de UX, tarefa 1.7).
 *
 * A lista inteira dentro de um menu funcionava com 5 pessoas e vira rolagem
 * sem fim com 300. Aqui a busca vem primeiro, com o foco nela, e a lista rola
 * dentro do modal. As opções fixas ("Ninguém", "Todos os responsáveis") ficam
 * sempre no topo, fora da busca, porque não são nomes.
 *
 * Quem chama monta o seletor só quando quer abri-lo; fechar desmonta.
 */
export function SeletorDePessoa({
  titulo,
  pessoas,
  fixas = [],
  atual,
  aoEscolher,
  aoFechar,
}: {
  titulo: string
  pessoas: PessoaDoSeletor[]
  /** Opções que não são pessoas, sempre visíveis no topo. */
  fixas?: PessoaDoSeletor[]
  /** Id da opção escolhida hoje (`''` para a fixa de id vazio). */
  atual: string | null
  aoEscolher: (id: string) => void
  aoFechar: () => void
}) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const abriu = useRef(false)
  const [busca, setBusca] = useState('')

  const termo = normal(busca.trim())
  const achadas = termo === '' ? pessoas : pessoas.filter((p) => normal(p.nome).includes(termo))

  function escolher(id: string) {
    aoEscolher(id)
    dialogo.current?.close()
  }

  const opcao = (p: PessoaDoSeletor, fixa: boolean) => {
    const escolhida = (atual ?? '') === p.id
    return (
      <li key={`${fixa ? 'fixa' : 'pessoa'}-${p.id}`}>
        <button
          type="button"
          aria-pressed={escolhida}
          onClick={() => escolher(p.id)}
          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] hover:bg-surface focus-visible:bg-surface ${
            fixa ? 'text-muted' : 'text-ink'
          } ${escolhida ? 'font-semibold' : ''}`}
        >
          <span className="min-w-0 flex-1 truncate">{p.nome}</span>
          {escolhida && <span className="text-primary">✓</span>}
        </button>
      </li>
    )
  }

  return (
    <dialog
      ref={(no) => {
        dialogo.current = no
        if (no && !abriu.current) {
          abriu.current = true
          no.showModal()
        }
      }}
      aria-labelledby="titulo-seletor-de-pessoa"
      onClose={aoFechar}
      onClick={(evento) => {
        if (evento.target === dialogo.current) dialogo.current?.close()
      }}
      className="app-dialog m-auto w-[400px] max-w-[calc(100vw-32px)] rounded-[18px] border border-line bg-panel p-5 text-ink shadow-[0_40px_100px_rgba(19,25,34,0.132)]"
    >
      <h2 id="titulo-seletor-de-pessoa" className="text-[16px] font-bold">
        {titulo}
      </h2>
      <input
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.currentTarget.value)}
        onKeyDown={(e) => {
          // Enter com um resultado só escolhe esse: é o atalho de quem digitou o nome.
          if (e.key === 'Enter') {
            e.preventDefault()
            if (achadas.length === 1) escolher(achadas[0]!.id)
          }
        }}
        placeholder="Buscar pelo nome"
        aria-label="Buscar pessoa pelo nome"
        autoFocus
        className="app-field mt-3 w-full px-3 py-2.5 text-[13px]"
      />
      <ul aria-label="Pessoas" className="mt-2 max-h-[min(360px,55vh)] overflow-y-auto">
        {fixas.map((p) => opcao(p, true))}
        {fixas.length > 0 && <li aria-hidden className="my-1 border-t border-line" />}
        {achadas.map((p) => opcao(p, false))}
        {achadas.length === 0 && <li className="px-3 py-2 text-[12.5px] text-dim">Ninguém com esse nome.</li>}
      </ul>
      <div className="mt-3 flex justify-end">
        <button type="button" onClick={() => dialogo.current?.close()} className="app-secondary-button px-4 py-2 text-[12.5px]">
          Voltar
        </button>
      </div>
    </dialog>
  )
}
