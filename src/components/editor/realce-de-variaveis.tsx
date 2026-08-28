'use client'

import { fatiarVariaveis } from '@/core/engine/interpolar'

/**
 * O realce de variável **fora do campo de texto** — no card do desenho e na
 * prévia do hover.
 *
 * Por que existe: a mesma citação aparecia azul dentro do painel e como texto
 * cru no card, e é no desenho que se confere o fluxo inteiro. Pior, `{nome}` de
 * uma chave só — que sai literal na conversa — não tinha marca em lugar nenhum
 * fora do campo. Quem passa o olho no desenho não via o erro.
 *
 * **O tamanho não pode crescer.** O card tem largura fixa e `line-clamp-3`:
 * badge com padding grande empurra a linha, come uma das três que existem e o
 * texto do bloco some. Por isso a marca é cor e fundo, com raio pequeno e nada
 * de padding vertical.
 */

export const DICA_CHAVE_SIMPLES =
  'Variável precisa de duas chaves — {{nome}}. Com uma só, sai escrito assim mesmo na conversa.'

/** O texto com a citação certa em azul e a chave simples em vermelho. */
export function RealceDeVariaveis({ texto }: { texto: string }) {
  return (
    <>
      {fatiarVariaveis(texto).map((pedaco, i) => {
        if (pedaco.tipo === 'texto') return <span key={i}>{pedaco.texto}</span>

        if (pedaco.tipo === 'chave-simples') {
          return (
            <span
              key={i}
              title={DICA_CHAVE_SIMPLES}
              className="rounded-[3px] bg-rose-400/20 text-rose-300"
            >
              {pedaco.texto}
            </span>
          )
        }

        return (
          <span key={i} className="rounded-[3px] bg-accent/15 text-accent">
            {pedaco.texto}
          </span>
        )
      })}
    </>
  )
}
