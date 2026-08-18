import { describe, expect, it } from 'vitest'
import { partesDaMensagem, parteNova, textoDaMensagem } from './mensagem'
import { noMensagemSchema, type NoMensagem } from './schema'

/**
 * O bloco de mensagem tem **dois** formatos gravados no banco, e vai ter para
 * sempre.
 *
 * `flow_versions` é imutável e a sessão fica presa à versão em que começou: uma
 * conversa aberta às 14h continua rodando o grafo de 14h. No dia em que este
 * arquivo deixar de ler o formato antigo, toda conversa em andamento sobre uma
 * versão publicada antes da A3 morre no meio — e não há como saber quantas são.
 */
function bloco(data: unknown): NoMensagem {
  return noMensagemSchema.parse({ id: 'b1', type: 'mensagem', position: { x: 0, y: 0 }, data })
}

describe('ler os dois formatos', () => {
  it('o formato antigo vira um pedaço de texto', () => {
    expect(partesDaMensagem(bloco({ texto: 'Oi!' }))).toEqual([{ tipo: 'texto', texto: 'Oi!' }])
  })

  it('o atraso antigo vem **antes** do texto', () => {
    // Ele sempre significou "espere, depois mande". Invertido, a espera
    // aconteceria com a mensagem já entregue — outro comportamento.
    expect(partesDaMensagem(bloco({ texto: 'Oi!', atraso: 2 }))).toEqual([
      { tipo: 'atraso', segundos: 2 },
      { tipo: 'texto', texto: 'Oi!' },
    ])
  })

  it('atraso zero não vira pedaço nenhum', () => {
    expect(partesDaMensagem(bloco({ texto: 'Oi!', atraso: 0 }))).toEqual([
      { tipo: 'texto', texto: 'Oi!' },
    ])
  })

  it('bloco antigo sem texto nenhum ainda dá parse, e vira um texto vazio', () => {
    // Um grafo publicado pode ter qualquer coisa lá dentro. Estourar aqui seria
    // derrubar a conversa em vez de entregar uma mensagem vazia que o validador
    // já recusaria hoje.
    expect(partesDaMensagem(bloco({}))).toEqual([{ tipo: 'texto', texto: '' }])
  })

  it('o formato novo passa direto', () => {
    const partes = [
      { tipo: 'texto', texto: 'Segue a foto' },
      { tipo: 'midia', midia: 'imagem', url: 'https://e.test/a.png' },
    ]
    expect(partesDaMensagem(bloco({ partes }))).toEqual(partes)
  })

  it('`partes` vazio ganha do `texto` antigo que sobrou ao lado', () => {
    // Quem apagou todos os pedaços no editor não quer o texto de antes de
    // volta. `partes` presente é a declaração de que o bloco está no formato
    // novo, mesmo sem nenhum pedaço.
    expect(partesDaMensagem(bloco({ texto: 'sobra', partes: [] }))).toEqual([])
  })
})

describe('o texto que identifica o bloco', () => {
  it('junta os pedaços de texto', () => {
    const no = bloco({
      partes: [
        { tipo: 'texto', texto: 'Primeira' },
        { tipo: 'atraso', segundos: 1 },
        { tipo: 'texto', texto: 'Segunda' },
      ],
    })
    expect(textoDaMensagem(no)).toBe('Primeira\nSegunda')
  })

  it('pilha sem texto devolve vazio, e quem chama decide o que dizer', () => {
    const no = bloco({ partes: [{ tipo: 'midia', midia: 'audio', url: 'https://e.test/a.ogg' }] })
    expect(textoDaMensagem(no)).toBe('')
  })
})

describe('pedaço novo', () => {
  it('nasce válido para o schema — senão o editor grava lixo', () => {
    for (const tipo of ['texto', 'midia', 'atraso', 'salvar', 'auto-off'] as const) {
      expect(() => bloco({ partes: [parteNova(tipo)] })).not.toThrow()
    }
  })

  it('o atraso nasce com um segundo, não com zero', () => {
    // Zero é o mesmo que não ter atraso, e um pedaço que não faz nada até
    // alguém mexer nele parece defeito.
    expect(parteNova('atraso')).toEqual({ tipo: 'atraso', segundos: 1 })
  })
})
