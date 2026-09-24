'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Anotacao } from '@/core/anotacoes'
import { diaEHora } from '@/core/datas'

/**
 * Anotações da equipe como histórico (tarefa 5.9).
 *
 * Eram **uma** nota por contato, sobrescrita a cada salvar: "prefere de manhã"
 * sumia quando alguém escrevia "quer o plano anual". Agora cada anotação é uma
 * entrada com autor e hora, e nada se apaga.
 *
 * A entrada ("+ Anotar") e a lista moram em lugares diferentes da tela (a barra
 * de ações da conversa e a coluna do contato), por isso dividem o estado por
 * contexto. **Anotar não recarrega a página**: a nota entra na lista na hora,
 * marcada "guardando", e o servidor grava por trás. Se falhar, ela fica na
 * lista com o erro e o "Tentar de novo", sem sumir com o que foi escrito.
 */

type Entrada = Anotacao & { estado: 'gravada' | 'guardando' | 'erro'; erro?: string }

type Anotar = (texto: string) => Promise<{ ok: true; anotacao: Anotacao } | { ok: false; erro: string }>

const Contexto = createContext<{
  entradas: Entrada[]
  /** Devolve o id local, para quem anotou acompanhar se ela gravou. */
  anotar: (texto: string) => string
  /** Quantas anotações foram feitas nesta tela. A aba de anotações segue esse número. */
  anotadas: number
  tentarDeNovo: (id: string) => void
  antiga: string
} | null>(null)

export function ProvedorDeAnotacoes({
  iniciais,
  antiga,
  autor,
  anotar: gravar,
  children,
}: {
  iniciais: Anotacao[]
  /**
   * A nota única de antes (`contacts.notas`). Ela aparece como a entrada mais
   * antiga, sem data, em vez de ser copiada para o diário: copiar inventaria
   * um autor e uma hora que ninguém sabe.
   */
  antiga: string
  /** Quem está anotando, para a entrada provisória já sair com o nome certo. */
  autor: string | null
  anotar: Anotar
  children: ReactNode
}) {
  const [entradas, setEntradas] = useState<Entrada[]>(() =>
    iniciais.map((anotacao) => ({ ...anotacao, estado: 'gravada' as const })),
  )

  const mandar = async (id: string, texto: string) => {
    let resposta: Awaited<ReturnType<Anotar>>
    try {
      resposta = await gravar(texto)
    } catch {
      resposta = { ok: false, erro: 'sem conexão com o servidor' }
    }
    setEntradas((atuais) =>
      atuais.map((entrada) =>
        entrada.id !== id
          ? entrada
          : resposta.ok
            ? { ...resposta.anotacao, estado: 'gravada' }
            : { ...entrada, estado: 'erro', erro: resposta.erro },
      ),
    )
  }

  const [anotadas, setAnotadas] = useState(0)

  const anotar = (texto: string) => {
    const id = `local-${crypto.randomUUID()}`
    setAnotadas((n) => n + 1)
    setEntradas((atuais) => [
      { id, texto, autor, criadoEm: new Date().toISOString(), estado: 'guardando' },
      ...atuais,
    ])
    void mandar(id, texto)
    return id
  }

  const tentarDeNovo = (id: string) => {
    const entrada = entradas.find((item) => item.id === id)
    if (!entrada) return
    setEntradas((atuais) =>
      atuais.map((item) => (item.id === id ? { ...item, estado: 'guardando', erro: undefined } : item)),
    )
    void mandar(id, entrada.texto)
  }

  return (
    <Contexto.Provider value={{ entradas, anotar, anotadas, tentarDeNovo, antiga: antiga.trim() }}>
      {children}
    </Contexto.Provider>
  )
}

function useAnotacoes() {
  const contexto = useContext(Contexto)
  if (!contexto) throw new Error('ProvedorDeAnotacoes ausente')
  return contexto
}

/** Quantas anotações o contato tem, para o ícone da barra acender. */
/**
 * Quantas anotações foram feitas nesta tela, ou 0 fora de um provedor. Quem
 * precisa reagir a uma anotação nova (a aba do Inbox) observa este número.
 */
export function useAnotadas(): number {
  return useContext(Contexto)?.anotadas ?? 0
}

export function useTemAnotacao(): boolean {
  const contexto = useContext(Contexto)
  return Boolean(contexto && (contexto.entradas.length > 0 || contexto.antiga !== ''))
}

/**
 * A caixa de escrever. Só a entrada: o histórico mora na lista.
 *
 * Depois de anotar ela limpa e fecha; a nota já está na lista ao lado.
 */
export function EntradaDeAnotacao({ limite, aoAnotar }: { limite: number; aoAnotar?: () => void }) {
  const { anotar, entradas } = useAnotacoes()
  const [aberta, setAberta] = useState(false)
  const [texto, setTexto] = useState('')
  const [ultima, setUltima] = useState<string | null>(null)

  /*
   * O retorno de quem anotou, no mesmo lugar em que anotou: "Salvando…" e
   * depois "Anotação salva". A anotação também aparece na lista, mas a lista
   * pode estar em outra aba ou fora da tela, e sem sinal aqui a pessoa não
   * sabe se o clique pegou.
   *
   * A local troca de id quando grava (`local-…` vira o id do banco), então
   * sumir da lista com o id local e sem erro é o sinal de que gravou.
   */
  const acompanhada = ultima ? entradas.find((entrada) => entrada.id === ultima) : undefined
  const situacao: 'salvando' | 'salva' | 'erro' | null = !ultima
    ? null
    : !acompanhada
      ? 'salva'
      : acompanhada.estado === 'erro'
        ? 'erro'
        : 'salvando'

  useEffect(() => {
    if (situacao !== 'salva') return
    const tempo = setTimeout(() => setUltima(null), 2500)
    return () => clearTimeout(tempo)
  }, [situacao])

  const aviso = situacao && (
    <p
      role="status"
      className={`mt-1.5 text-[12px] font-semibold ${
        situacao === 'erro' ? 'text-perigo' : situacao === 'salva' ? 'text-ok' : 'text-dim'
      }`}
    >
      {situacao === 'salvando'
        ? 'Salvando…'
        : situacao === 'salva'
          ? '✓ Anotação salva'
          : 'Não salvou. Tente de novo em Anotações.'}
    </p>
  )

  if (!aberta) {
    return (
      <>
      <button
        type="button"
        onClick={() => setAberta(true)}
        className="mt-2 w-full rounded-[8px] border border-dashed border-strong px-2.5 py-2 text-[12px] text-dim transition hover:border-primary/40 hover:text-primary"
      >
        + Anotar
      </button>
      {aviso}
      </>
    )
  }

  const enviar = () => {
    const limpo = texto.trim()
    if (limpo === '') return
    setUltima(anotar(limpo))
    setTexto('')
    setAberta(false)
    aoAnotar?.()
  }

  return (
    <form
      className="mt-2 flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        enviar()
      }}
    >
      <textarea
        autoFocus
        value={texto}
        maxLength={limite}
        onChange={(event) => setTexto(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            enviar()
          }
        }}
        rows={3}
        placeholder="Exemplo: já ligou duas vezes, prefere de manhã."
        aria-label="Nova anotação"
        className="app-field resize-y px-2.5 py-2 text-[12.5px] leading-5"
      />
      <span className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setTexto('')
            setAberta(false)
          }}
          className="rounded-lg px-2.5 py-1.5 text-[12px] text-dim hover:text-soft"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={texto.trim() === ''}
          className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
        >
          Anotar
        </button>
      </span>
    </form>
  )
}

/** O histórico, da mais nova para a mais antiga, com autor e hora. */
export function ListaDeAnotacoes({ vazio = 'Sem anotação.' }: { vazio?: string }) {
  const { entradas, tentarDeNovo, antiga } = useAnotacoes()

  if (entradas.length === 0 && antiga === '') {
    return <p className="text-[12px] text-dim">{vazio}</p>
  }

  return (
    <ol className="flex flex-col gap-2" aria-label="Anotações da equipe">
      {entradas.map((entrada) => (
        <li
          key={entrada.id}
          className={`rounded-[10px] border px-2.5 py-2 ${
            entrada.estado === 'erro' ? 'border-perigo/40 bg-perigo/5' : 'border-line bg-surface'
          }`}
        >
          <p className="text-[12.5px] leading-5 whitespace-pre-line text-soft">{entrada.texto}</p>
          <p className="mt-1 text-[11px] text-dim">
            {entrada.autor ?? 'Alguém da equipe'} · {diaEHora(entrada.criadoEm)}
            {entrada.estado === 'guardando' && <span className="ml-1">· guardando…</span>}
          </p>
          {entrada.estado === 'erro' && (
            <p role="alert" className="mt-1 flex flex-wrap items-center gap-x-2 text-[11.5px] text-perigo">
              Não ficou guardada: {entrada.erro}.
              <button type="button" onClick={() => tentarDeNovo(entrada.id)} className="font-semibold underline">
                Tentar de novo
              </button>
            </p>
          )}
        </li>
      ))}
      {antiga !== '' && (
        <li className="rounded-[10px] border border-dashed border-line px-2.5 py-2">
          <p className="text-[12.5px] leading-5 whitespace-pre-line text-soft">{antiga}</p>
          <p className="mt-1 text-[11px] text-dim">Anotação de antes do histórico, sem data</p>
        </li>
      )}
    </ol>
  )
}

/**
 * O cartão da ficha: a mesma lista do Inbox, com a entrada embaixo do título.
 *
 * Substitui o "Anotação" de uma nota só, que se editava por cima. A ficha e o
 * Inbox leem as mesmas anotações, então o que se escreve num aparece no outro.
 */
export function CartaoDeAnotacoes({
  iniciais,
  antiga,
  autor,
  anotar,
  limite,
  titulo,
}: {
  iniciais: Anotacao[]
  antiga: string
  autor: string | null
  anotar: Anotar
  limite: number
  titulo: ReactNode
}) {
  return (
    <ProvedorDeAnotacoes iniciais={iniciais} antiga={antiga} autor={autor} anotar={anotar}>
      <section className="app-card p-4">
        <header className="mb-1">{titulo}</header>
        <div className="mb-3">
          <EntradaDeAnotacao limite={limite} />
        </div>
        <ListaDeAnotacoes vazio="Ninguém anotou nada sobre esta pessoa ainda." />
      </section>
    </ProvedorDeAnotacoes>
  )
}
