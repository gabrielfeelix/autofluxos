import { describe, expect, it } from 'vitest'
import { dadosPadrao } from './editor'
import { noSchema } from '@/core/flow/schema'

/**
 * O bloco que nasce no navegador tem que ter os campos que o painel lê.
 *
 * **Esta suíte existe por um bug que chegou em produção.** O bloco de IA ganhou
 * `ferramentas` no schema, o Zod preenche com `[]` ao salvar, e a fábrica do
 * editor continuou devolvendo `{ instrucao }`. Entre arrastar o bloco e salvar
 * o rascunho, `no.data.ferramentas` era `undefined` — e `undefined.some()` no
 * meio do render derrubava o editor inteiro para uma tela de erro.
 *
 * Nada acusava: typecheck passa (`data` é `Record<string, unknown>`), build
 * passa, e os testes de motor sempre leem grafo que já veio do banco parseado.
 */
describe('dadosPadrao produz bloco que o schema aceita como está', () => {
  const TIPOS = [
    'mensagem',
    'midia',
    'pergunta',
    'condicao',
    'salvar-campo',
    'ia',
    'handoff',
    'http',
    'etapa',
    'ir-fluxo',
    'voltar',
  ] as const

  it.each(TIPOS)('%s', (tipo) => {
    const bruto = {
      id: 'x',
      type: tipo,
      position: { x: 0, y: 0 },
      data: dadosPadrao(tipo as never),
    }

    const parseado = noSchema.parse(bruto)

    /*
     * Comparar o `data` cru com o `data` depois do Zod é o que pega o campo
     * esquecido. Se o schema teve que preencher alguma coisa, a fábrica está
     * devolvendo um bloco diferente do que o resto do editor espera ler.
     */
    for (const campo of Object.keys(parseado.data as Record<string, unknown>)) {
      const doZod = (parseado.data as Record<string, unknown>)[campo]
      const daFabrica = bruto.data[campo]

      // Campo opcional que o Zod não preencheu também não precisa estar na
      // fábrica: o que não pode é o Zod ter inventado um valor que o navegador
      // não tem.
      if (doZod === undefined) continue
      expect(daFabrica, `"${campo}" falta em dadosPadrao('${tipo}')`).not.toBeUndefined()
    }
  })
})
