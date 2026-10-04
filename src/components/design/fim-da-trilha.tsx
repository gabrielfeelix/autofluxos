'use client'

import { useEffect, useSyncExternalStore } from 'react'

/**
 * O fim da trilha do cabeçalho, dito pela página.
 *
 * O cabeçalho ("CRM › Negócios") mora no layout e só sabe a seção, lida do
 * endereço. Dentro de um negócio isso não diz onde se está: em 03/10/2026 o
 * Eduardo marcou o cabeçalho igual na lista e no negócio e pediu
 * "CRM › Negócios › <o negócio>". O nome do funil e o título do negócio só a
 * página sabe, e layout no Next não recebe nada dos filhos, então a página
 * publica aqui e o cabeçalho lê.
 *
 * É uma loja de módulo, e não contexto, porque cabeçalho e página são irmãos
 * no layout: não há ancestral comum que não seja o layout inteiro. Uma tela
 * só fala por vez, e sair dela limpa o que ela disse.
 */

export type PedacoDaTrilha = { rotulo: string; href?: string }

const VAZIO: PedacoDaTrilha[] = []
let atual: PedacoDaTrilha[] = VAZIO
const ouvintes = new Set<() => void>()

function publicar(caminho: PedacoDaTrilha[]) {
  atual = caminho
  ouvintes.forEach((avisar) => avisar())
}

function assinar(avisar: () => void) {
  ouvintes.add(avisar)
  return () => {
    ouvintes.delete(avisar)
  }
}

/** O que a página atual publicou; vazio no servidor e em toda tela que não fala. */
export function useFimDaTrilha(): PedacoDaTrilha[] {
  return useSyncExternalStore(
    assinar,
    () => atual,
    () => VAZIO,
  )
}

/**
 * Posta na página: `<FimDaTrilha caminho={[{ rotulo: 'Comercial', href }, { rotulo: 'Negócio de Ana' }]} />`.
 * Não desenha nada; o último pedaço é a página atual e não precisa de link.
 */
export function FimDaTrilha({ caminho }: { caminho: PedacoDaTrilha[] }) {
  // A chave em texto deixa o efeito rodar só quando o caminho muda de fato,
  // e não a cada render com um array novo de mesmo conteúdo.
  const chave = JSON.stringify(caminho)
  useEffect(() => {
    publicar(JSON.parse(chave) as PedacoDaTrilha[])
    return () => publicar(VAZIO)
  }, [chave])
  return null
}
