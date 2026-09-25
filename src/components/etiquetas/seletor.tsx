'use client'

import { useState, useSyncExternalStore } from 'react'
import { CLASSE_DA_COR, type CorDeEtiqueta } from '@/core/etiquetas'
import { acaoCriarEtiqueta, acaoMarcarEtiqueta } from '@/server/acoes'
import { agirNaConversa, mudarConversa, useConversa } from '@/components/inbox/conversa-local'

export type EtiquetaEscolhivel = { id: string; nome: string; cor: CorDeEtiqueta }

/*
 * As etiquetas criadas por esta aba, de dentro de um seletor.
 *
 * O seletor mora num painel que desmonta ao fechar, e a lista vinha só das
 * props do servidor: sem o `revalidatePath` (ver `gestoSemRecarregar`), a
 * etiqueta recém-criada sumia ao reabrir. Aqui ela fica até o próximo
 * carregamento trazer a lista do banco.
 */
let criadas: EtiquetaEscolhivel[] = []
const assinantes = new Set<() => void>()
const assinar = (assinante: () => void) => {
  assinantes.add(assinante)
  return () => {
    assinantes.delete(assinante)
  }
}
function trocarCriadas(novas: EtiquetaEscolhivel[]) {
  criadas = novas
  assinantes.forEach((assinante) => assinante())
}

/** As do servidor mais as criadas aqui, sem repetir. */
export function useEtiquetasDisponiveis(doServidor: EtiquetaEscolhivel[]): EtiquetaEscolhivel[] {
  const aqui = useSyncExternalStore(
    assinar,
    () => criadas,
    () => criadas,
  )
  const ids = new Set(doServidor.map((e) => e.id))
  return [...doServidor, ...aqui.filter((e) => !ids.has(e.id))]
}

/**
 * Aplicar e tirar etiquetas de um contato, clicando.
 *
 * **Todas as etiquetas da conta aparecem, as aplicadas acesas.** A alternativa, um botão "adicionar" que abre uma lista, esconde justamente a informação
 * que a tela existe para dar: quais **não** estão aplicadas. Com poucas
 * etiquetas, que é o caso real, mostrar tudo custa menos que um clique a mais.
 *
 * O estado é otimista porque a ação é uma escrita minúscula e o custo de errar
 * é uma ficha acesa por um segundo. Esperar o servidor faria cada clique
 * parecer que não funcionou.
 */
export function SeletorDeEtiquetas({
  clienteId,
  contatoId,
  disponiveis,
  aplicadas,
}: {
  clienteId: string
  contatoId: string
  disponiveis: EtiquetaEscolhivel[]
  aplicadas: string[]
}) {
  /*
   * A marcação mora em `inbox/conversa-local.ts`, por contato: o ícone do
   * cabeçalho e a seção "Etiquetas do contato" leem de lá, e reabrir o painel
   * mostra o que se acabou de marcar, e não o que o servidor desenhou antes.
   */
  const { etiquetas: marcadas } = useConversa(contatoId, { etiquetas: aplicadas })
  const lista = useEtiquetasDisponiveis(disponiveis)
  const [erro, setErro] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)
  const [nova, setNova] = useState('')

  const alternar = (etiquetaId: string) => {
    const aplicar = !marcadas.includes(etiquetaId)
    setErro(null)
    void agirNaConversa(
      contatoId,
      { etiquetas: aplicadas },
      { etiquetas: aplicar ? [...marcadas, etiquetaId] : marcadas.filter((id) => id !== etiquetaId) },
      () => acaoMarcarEtiqueta(clienteId, etiquetaId, [contatoId], aplicar, false),
    ).then((falhou) => falhou && setErro(falhou))
  }

  const criar = async () => {
    const nome = nova.trim()
    if (nome === '') return

    const provisorio = `novo-${Date.now()}`
    const otimista = { id: provisorio, nome, cor: 'cinza' as CorDeEtiqueta }

    setErro(null)
    trocarCriadas([...criadas, otimista])
    const desmarcar = mudarConversa(contatoId, { etiquetas: aplicadas }, { etiquetas: [...marcadas, provisorio] })
    setNova('')
    setCriando(false)

    const dados = new FormData()
    dados.set('nome', nome)
    dados.set('cor', 'cinza')

    const r = await acaoCriarEtiqueta(clienteId, {}, dados).catch(() => ({ erro: 'sem conexão com o servidor', etiqueta: undefined }))

    if (r.erro || !r.etiqueta) {
      trocarCriadas(criadas.filter((e) => e.id !== provisorio))
      desmarcar()
      setErro(r.erro ?? 'não deu para criar a etiqueta')
      return
    }

    const criada = r.etiqueta
    trocarCriadas(criadas.map((e) => (e.id === provisorio ? criada : e)))
    desmarcar()
    const comReal = [...marcadas.filter((id) => id !== provisorio), criada.id]
    const falhou = await agirNaConversa(contatoId, { etiquetas: aplicadas }, { etiquetas: comReal }, () =>
      acaoMarcarEtiqueta(clienteId, criada.id, [contatoId], true, false),
    )
    if (falhou) setErro(falhou)
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {lista.map((etiqueta) => {
          const acesa = marcadas.includes(etiqueta.id)
          return (
            <button
              key={etiqueta.id}
              type="button"
              aria-pressed={acesa}
              onClick={() => alternar(etiqueta.id)}
              className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold transition ${
                acesa
                  ? CLASSE_DA_COR[etiqueta.cor]
                  : 'border-line bg-transparent text-dim hover:border-strong hover:text-muted'
              }`}
            >
              {etiqueta.nome}
            </button>
          )
        })}
      </div>

      {criando ? (
        <div className="mt-2 flex gap-1.5">
          <input
            autoFocus
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void criar()
              if (e.key === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
                setNova('')
                setCriando(false)
              }
            }}
            placeholder="Nome da etiqueta"
            aria-label="Nome da nova etiqueta"
            className="app-field min-w-0 flex-1 px-2.5 py-1.5 text-[11px]"
          />
          <button
            type="button"
            onClick={() => void criar()}
            className="app-secondary-button shrink-0 px-2.5 py-1.5 text-[11px]"
          >
            Criar
          </button>
        </div>
      ) : (
        <button
          type="button"
          data-foco
          onClick={() => setCriando(true)}
          className="mt-2 w-full rounded-[8px] border border-dashed border-strong px-2.5 py-2 text-[11px] text-dim transition hover:border-primary/40 hover:text-primary"
        >
          + Etiqueta
        </button>
      )}

      {erro && (
        <p role="alert" className="mt-1.5 text-[10.5px] leading-4 text-perigo">
          {erro}
        </p>
      )}
    </div>
  )
}

/**
 * As etiquetas aplicadas, só leitura, como a coluna do contato mostra.
 *
 * Lê o mesmo store do seletor: marcar no cabeçalho aparece aqui no clique,
 * sem esperar o servidor redesenhar a coluna.
 */
export function EtiquetasAplicadas({
  contatoId,
  aplicadas,
  disponiveis,
  vazio,
}: {
  contatoId: string
  aplicadas: string[]
  disponiveis: EtiquetaEscolhivel[]
  vazio: string
}) {
  const { etiquetas } = useConversa(contatoId, { etiquetas: aplicadas })
  const lista = useEtiquetasDisponiveis(disponiveis)
  const nomes = etiquetas
    .map((id) => lista.find((etiqueta) => etiqueta.id === id))
    .filter((etiqueta): etiqueta is EtiquetaEscolhivel => Boolean(etiqueta))

  if (nomes.length === 0) return <p className="text-[12px] text-dim">{vazio}</p>
  return (
    <span className="flex flex-wrap gap-1">
      {nomes.map((etiqueta) => (
        <span
          key={etiqueta.id}
          className="rounded-full border border-line bg-surface px-2 py-0.5 text-[11.5px] font-semibold text-soft"
        >
          {etiqueta.nome}
        </span>
      ))}
    </span>
  )
}
