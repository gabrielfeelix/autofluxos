import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fluxoSchema } from './schema'
import { variaveisDoFluxo } from './variaveis'

/*
 * Esta função morava em `components/editor/editor.tsx`, que é `'use client'`.
 * Quando a página do editor — componente de servidor — passou a chamá-la, o
 * Next transformou o import num *client reference* e a chamada estourou no
 * servidor: React #441, com a mensagem escondida em produção.
 *
 * **Nem o typecheck nem o build pegam isso.** Os dois passaram limpos com a
 * tela quebrada. Por isso o teste confere o arquivo: é a única barreira que
 * existe entre esse erro e alguém abrindo Automações.
 */
describe('onde esta função pode morar', () => {
  it('não está num módulo de cliente — servidor e editor chamam os dois', () => {
    const fonte = readFileSync(new URL('./variaveis.ts', import.meta.url), 'utf8')
    // A diretiva só vale na **primeira** linha de código do arquivo; procurar a
    // palavra solta acusaria este próprio comentário e o do módulo.
    const primeira = fonte.split('\n').find((l) => l.trim() !== '') ?? ''
    expect(primeira.trim()).not.toBe("'use client'")
  })
})

const p = { x: 0, y: 0 }

describe('variaveisDoFluxo', () => {
  const fluxo = fluxoSchema.parse({
    inicio: 'a',
    nodes: [
      {
        id: 'a', type: 'pergunta', position: p,
        data: {
          texto: 'Qual horário?', salvarEm: 'horario', opcoes: [],
          opcoesDe: 'horarios', valoresDe: 'horarios_id', salvarValorEm: 'sessao_id',
        },
      },
      {
        id: 'b', type: 'http', position: p,
        data: { metodo: 'GET', url: 'https://x', mapear: [{ variavel: 'horarios', caminho: 'l[].h' }] },
      },
      { id: 'c', type: 'salvar-campo', position: p, data: { campo: 'plano', valor: 'x' } },
    ],
    edges: [{ id: 'e1', source: 'a', target: 'b' }, { id: 'e2', source: 'b', target: 'c' }],
  })

  it('junta o que cada tipo de bloco guarda', () => {
    expect(variaveisDoFluxo(fluxo).nomes).toEqual(['horario', 'horarios', 'plano', 'sessao_id'])
  })

  it('o valor da opção escolhida conta como variável — é a que chama a API depois', () => {
    expect(variaveisDoFluxo(fluxo).origens.sessao_id).toEqual(['a'])
  })
})
