'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * Uma largura de painel lembrada no navegador de quem usa.
 *
 * **Fica no navegador, e não na conta.** É preferência de tela, do mesmo tipo
 * que o zoom do desenho: guardar no banco faria a escolha de uma pessoa mudar a
 * tela de outra da mesma equipe, que é o oposto do que ela pediu.
 *
 * `useSyncExternalStore` e não `useState` + efeito, e a diferença não é estilo.
 * O `localStorage` é uma fonte de verdade **fora** do React, e ler dele num
 * efeito significa desenhar o padrão, depois corrigir — a barra pisca de 232
 * para 160 na frente de quem abriu. Com `getServerSnapshot` separado, o
 * servidor desenha o padrão e o navegador desenha o guardado já no primeiro
 * quadro, sem erro de hidratação e sem piscada.
 *
 * O nome começa com `use` num arquivo escrito em português pela mesma razão que
 * o schema do fluxo tem chaves em inglês: **é palavra de protocolo, não de
 * idioma.** O React reconhece hook pelo prefixo, e as regras do lint recusam o
 * resto — a fronteira é dele, como lá era do React Flow.
 */

/**
 * O que fazer com o que estava guardado.
 *
 * Separado do hook para ser testável sem React, e porque as três respostas
 * erradas aqui são silenciosas: `null` de quem nunca escolheu, `NaN` de um valor
 * corrompido à mão, e um número absurdo de uma versão anterior com outros
 * limites. Todas devolvem uma largura utilizável, e nenhuma derruba a tela.
 */
export function larguraValida(
  bruto: string | null,
  limites: { padrao: number; minima: number; maxima: number },
): number {
  if (bruto === null) return limites.padrao
  const guardada = Number(bruto)
  if (!Number.isFinite(guardada) || guardada <= 0) return limites.padrao
  return Math.round(Math.min(limites.maxima, Math.max(limites.minima, guardada)))
}

/**
 * Lê do navegador, e devolve `null` quando ele recusa.
 *
 * Janela anônima, armazenamento bloqueado por política e cookies de terceiros
 * desligados fazem `localStorage` **lançar** em vez de devolver vazio. Sem este
 * `try`, a barra de blocos derrubaria o editor inteiro por causa de um número
 * lembrado — e o sintoma seria tela branca para quem só queria desenhar.
 */
function lerDoArmazenamento(chave: string): string | null {
  try {
    return localStorage.getItem(chave)
  } catch {
    return null
  }
}

const ouvintes = new Set<() => void>()

function assinar(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte)
  // Outra aba do mesmo editor também mexe na largura, e `storage` é o único
  // evento que avisa sobre isso.
  window.addEventListener('storage', ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
    window.removeEventListener('storage', ouvinte)
  }
}

export function useLarguraGuardada(
  chave: string,
  padrao: number,
  minima: number,
  maxima: number,
): [number, (largura: number) => void] {
  /*
   * `getSnapshot` devolve número, e não objeto: o React compara por
   * identidade, e um objeto novo a cada leitura poria o componente em laço
   * infinito de render.
   */
  const ler = useCallback(
    () => larguraValida(lerDoArmazenamento(chave), { padrao, minima, maxima }),
    [chave, padrao, minima, maxima],
  )

  const largura = useSyncExternalStore(assinar, ler, () => padrao)

  const mudar = useCallback(
    (nova: number) => {
      try {
        localStorage.setItem(chave, String(Math.round(nova)))
      } catch {
        /* mesma razão de cima */
      }
      // Avisa quem está nesta aba: o evento `storage` só chega nas outras.
      for (const ouvinte of ouvintes) ouvinte()
    },
    [chave],
  )

  return [largura, mudar]
}
