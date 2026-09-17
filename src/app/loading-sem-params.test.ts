import { readFileSync } from 'node:fs'
import { globSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * `loading.tsx` não recebe `params`.
 *
 * A documentação do Next é literal: "Loading UI components do not accept any
 * parameters". Um `loading.tsx` que declara `params` e faz `await params`
 * recebe `undefined`, e a desestruturação estoura **só em produção**, onde o
 * React esconde a mensagem atrás do erro #441.
 *
 * Foi exatamente o que derrubou a tela de Configurações, e o custo de descobrir
 * foi puxar log de produção para achar o digest. Este teste é mais barato.
 */
describe('todo loading.tsx', () => {
  it('não lê params, porque o Next não passa params para ele', () => {
    const arquivos = globSync('src/app/**/loading.tsx')
    expect(arquivos.length).toBeGreaterThan(0)

    /*
     * Comentário pode citar `params` à vontade, e este repositório cita: o que
     * não pode é o código usar. Por isso os comentários saem antes da conferência.
     */
    const culpados = arquivos.filter((caminho) => {
      const semComentario = readFileSync(caminho, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
      return /\bparams\b/.test(semComentario)
    })

    expect(culpados).toEqual([])
  })
})
