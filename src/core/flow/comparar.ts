import { descrever } from './descrever'
import type { Fluxo, No } from './schema'

/**
 * O que muda entre dois desenhos, bloco a bloco (A12).
 *
 * Compara **por id de bloco**, que é o que sobrevive a salvar, publicar e
 * voltar de versão. Posição não conta: arrastar um bloco não muda o que a
 * conversa faz, e listar "Mensagem alterada" por um arrasto faria a pessoa
 * procurar uma diferença que não existe. Ligação conta à parte, porque religar
 * muda o caminho sem mudar bloco nenhum.
 */
export type Comparacao = {
  acrescentados: string[]
  removidos: string[]
  alterados: string[]
  /** As ligações (setas) ou o bloco de início mudaram. */
  caminhoMudou: boolean
}

function conteudo(no: No): string {
  return JSON.stringify({ type: no.type, data: no.data })
}

function caminho(fluxo: Fluxo): string {
  const setas = fluxo.edges
    .map((e) => `${e.source}>${e.sourceHandle ?? ''}>${e.target}`)
    .sort()
  return JSON.stringify({ inicio: fluxo.inicio, setas })
}

/** `a` é o ponto de partida, `b` o que ficaria. "Acrescentado" = está em `b` e não em `a`. */
export function compararGrafos(a: Fluxo, b: Fluxo): Comparacao {
  const deA = new Map(a.nodes.map((no) => [no.id, no]))
  const deB = new Map(b.nodes.map((no) => [no.id, no]))

  return {
    acrescentados: b.nodes.filter((no) => !deA.has(no.id)).map((no) => no.id),
    removidos: a.nodes.filter((no) => !deB.has(no.id)).map((no) => no.id),
    alterados: b.nodes
      .filter((no) => {
        const antes = deA.get(no.id)
        return antes !== undefined && conteudo(antes) !== conteudo(no)
      })
      .map((no) => no.id),
    caminhoMudou: caminho(a) !== caminho(b),
  }
}

export function semDiferenca(c: Comparacao): boolean {
  return (
    c.acrescentados.length + c.removidos.length + c.alterados.length === 0 && !c.caminhoMudou
  )
}

/**
 * As linhas do resumo de "voltar para esta versão": `a` é o rascunho atual e
 * `b` a versão. Cada bloco com o nome que a lista de problemas usa.
 */
export function resumoDaComparacao(c: Comparacao, a: Fluxo, b: Fluxo): string[] {
  const nome = (fluxo: Fluxo, id: string) => {
    const no = fluxo.nodes.find((n) => n.id === id)
    return no ? descrever(no) : id
  }
  return [
    ...c.acrescentados.map((id) => `Volta: ${nome(b, id)}`),
    ...c.removidos.map((id) => `Sai: ${nome(a, id)}`),
    ...c.alterados.map((id) => `Muda: ${nome(b, id)}`),
    ...(c.caminhoMudou ? ['As ligações entre os blocos mudam'] : []),
  ]
}
