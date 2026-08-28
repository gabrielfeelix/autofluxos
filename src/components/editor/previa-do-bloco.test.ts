import { describe, expect, it } from 'vitest'
import { noSchema } from '@/core/flow/schema'
import { detalhesDoBloco } from './previa-do-bloco'

const p = { x: 0, y: 0 }
const bloco = (cru: unknown) => noSchema.parse(cru)

describe('detalhesDoBloco — o que o card não cabe mostrar', () => {
  it('lista todas as opções da pergunta, e não só as três primeiras', () => {
    const no = bloco({
      id: 'q',
      type: 'pergunta',
      position: p,
      data: {
        texto: 'Qual serviço?',
        salvarEm: 'servico',
        opcoes: [
          { id: 'a', rotulo: 'Banho' },
          { id: 'b', rotulo: 'Banho e tosa' },
          { id: 'c', rotulo: 'Tosa higiênica' },
          { id: 'd', rotulo: 'Hidratação' },
        ],
      },
    })

    const opcoes = detalhesDoBloco(no).find((d) => d.rotulo.startsWith('Opções'))
    expect(opcoes?.rotulo).toBe('Opções (4)')
    expect(opcoes?.valor).toContain('Hidratação')
  })

  it('mostra o valor técnico de cada opção quando ele existe', () => {
    const no = bloco({
      id: 'q',
      type: 'pergunta',
      position: p,
      data: {
        texto: 'Que tipo de vídeo?',
        salvarEm: 'tipo',
        salvarValorEm: 'tipo_id',
        opcoes: [
          { id: 'a', rotulo: 'Vídeo institucional', valor: 'institucional' },
          { id: 'b', rotulo: 'Social media', valor: 'social' },
        ],
      },
    })

    expect(detalhesDoBloco(no).find((d) => d.rotulo.startsWith('Opções'))?.valor).toContain(
      'Vídeo institucional  →  institucional',
    )
  })

  it('mostra a lista dinâmica pelo nome da variável que a alimenta', () => {
    const no = bloco({
      id: 'q',
      type: 'pergunta',
      position: p,
      data: { texto: 'Que horário?', opcoes: [], opcoesDe: 'horas', valoresDe: 'ids' },
    })

    const linhas = detalhesDoBloco(no)
    expect(linhas.find((d) => d.rotulo === 'Opções')?.valor).toBe('a lista de {{horas}}')
    expect(linhas.find((d) => d.rotulo === 'Valor de cada')?.valor).toBe('{{ids}}')
  })

  it('avisa quando a chamada não guarda nada da resposta', () => {
    const no = bloco({
      id: 'api',
      type: 'http',
      position: p,
      data: { metodo: 'GET', url: 'https://exemplo.com/x', cabecalhos: [], corpo: '', mapear: [] },
    })

    const guarda = detalhesDoBloco(no).find((d) => d.rotulo === 'Guarda')
    expect(guarda?.tom).toBe('aviso')
    expect(guarda?.valor).toContain('descartada')
  })

  it('mostra cada mapeamento da chamada, com o caminho de onde ele vem', () => {
    const no = bloco({
      id: 'api',
      type: 'http',
      position: p,
      data: {
        metodo: 'GET',
        url: 'https://exemplo.com/agenda',
        cabecalhos: [],
        corpo: '',
        mapear: [
          { variavel: 'horas', caminho: 'livres[].hora' },
          { variavel: 'quantas', caminho: 'livres[]', quantos: true },
        ],
      },
    })

    const guarda = detalhesDoBloco(no).find((d) => d.rotulo.startsWith('Guarda ('))
    expect(guarda?.valor).toContain('{{horas}}  ←  livres[].hora')
    expect(guarda?.valor).toContain('(quantos itens)')
  })

  it('escreve a condição como frase, e não como campo de formulário', () => {
    const no = bloco({
      id: 'c',
      type: 'condicao',
      position: p,
      data: { variavel: 'quantas', operador: 'igual', valor: '0' },
    })

    expect(detalhesDoBloco(no)[0]?.valor).toBe('{{quantas}} é igual a "0"')
  })

  it('não inventa valor para operador que não usa valor', () => {
    const no = bloco({
      id: 'c',
      type: 'condicao',
      position: p,
      data: { variavel: 'nome', operador: 'vazio', valor: '' },
    })

    expect(detalhesDoBloco(no)[0]?.valor).toBe('{{nome}} está vazia')
  })
})
