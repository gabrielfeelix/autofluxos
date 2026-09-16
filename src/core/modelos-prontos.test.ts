import { describe, expect, it } from 'vitest'
import {
  CAMPOS,
  MODELOS_PRONTOS,
  camposDoCorpoDaMeta,
  camposUsados,
  exemplosPara,
  nomeAutomatico,
  paraFormatoDaMeta,
  previa,
} from './modelos-prontos'
import { numeracaoContinua, validarTemplate, variaveisDe, temErro } from './templates'

describe('os campos que a pessoa insere', () => {
  it('acha os campos na ordem em que aparecem', () => {
    expect(camposUsados('Oi {nome}, dia {data} às {hora}')).toEqual(['nome', 'data', 'hora'])
  })

  it('não repete campo usado duas vezes', () => {
    // "Oi {nome}... até logo {nome}" é UM campo usado duas vezes.
    expect(camposUsados('Oi {nome}, até logo {nome}')).toEqual(['nome'])
  })

  it('devolve vazio quando não há campo nenhum', () => {
    expect(camposUsados('Sua consulta foi confirmada.')).toEqual([])
  })
})

describe('a tradução para o jargão da Meta', () => {
  /*
   * A ordem é a de APARIÇÃO porque é assim que a Meta numera. Numerar por
   * outra regra faria o nome da pessoa aparecer no lugar da data.
   */
  it('numera na ordem em que os campos aparecem no texto', () => {
    const r = paraFormatoDaMeta('Oi {nome}, dia {data}')
    expect(r.corpo).toBe('Oi {{1}}, dia {{2}}')
    expect(r.campos).toEqual(['nome', 'data'])
  })

  it('dá o mesmo número às duas aparições do mesmo campo', () => {
    const r = paraFormatoDaMeta('Oi {nome}, até logo {nome}')
    expect(r.corpo).toBe('Oi {{1}}, até logo {{1}}')
    expect(r.campos).toEqual(['nome'])
  })

  it('não mexe em texto sem campo', () => {
    const r = paraFormatoDaMeta('Sua consulta foi confirmada.')
    expect(r.corpo).toBe('Sua consulta foi confirmada.')
    expect(r.campos).toEqual([])
  })

  it('os exemplos saem na mesma ordem dos campos', () => {
    expect(exemplosPara(['data', 'nome'])).toEqual(['15/10', 'Maria'])
  })

  it('não deixa campo desconhecido sem exemplo, a Meta recusa vazio', () => {
    expect(exemplosPara(['inventado'])).toEqual(['exemplo'])
  })
})

describe('a prévia', () => {
  it('mostra o texto como o cliente vai ler', () => {
    // É o que faz a pessoa perceber que faltou vírgula, ou que ficou seco.
    expect(previa('Oi {nome}, dia {data} às {hora}')).toBe('Oi Maria, dia 15/10 às 14h')
  })

  it('não deixa marcador aparecendo na prévia', () => {
    for (const modelo of MODELOS_PRONTOS) {
      expect(previa(modelo.corpo)).not.toMatch(/[{}]/)
    }
  })
})

describe('o nome automático', () => {
  it('sai do título, no formato que a Meta aceita', () => {
    const nome = nomeAutomatico('Lembrete de consulta', new Date('2026-09-16T14:30:00'))
    expect(nome).toBe('lembrete_de_consulta_202609161430')
  })

  it('tira acento e pontuação', () => {
    const nome = nomeAutomatico('Confirmação, já!', new Date('2026-09-16T14:30:00'))
    expect(nome).toMatch(/^confirmacao_ja_\d+$/)
  })

  it('nunca devolve nome vazio, que a Meta recusa', () => {
    expect(nomeAutomatico('!!!')).toMatch(/^modelo_\d+$/)
  })
})

/*
 * O teste que mais importa: cada modelo da galeria tem que passar pelo
 * validador que fala com a Meta. Um modelo pronto que é recusado é pior que
 * nenhum, a pessoa escolheu justamente para não ter esse trabalho.
 */
describe('todo modelo pronto é aceito pelo nosso validador', () => {
  for (const modelo of MODELOS_PRONTOS) {
    it(`"${modelo.titulo}" passa sem erro`, () => {
      const { corpo } = paraFormatoDaMeta(modelo.corpo)
      const nome = nomeAutomatico(modelo.titulo)
      const reparos = validarTemplate(nome, { corpo }, modelo.categoria)

      expect(temErro(reparos)).toBe(false)
    })

    it(`"${modelo.titulo}" numera as variáveis sem pular`, () => {
      const { corpo } = paraFormatoDaMeta(modelo.corpo)
      expect(numeracaoContinua(variaveisDe(corpo))).toBe(true)
    })

    it(`"${modelo.titulo}" tem exemplo para cada variável`, () => {
      // Sem exemplo a Meta recusa por INVALID_FORMAT, horas depois.
      const { corpo, campos } = paraFormatoDaMeta(modelo.corpo)
      expect(exemplosPara(campos)).toHaveLength(variaveisDe(corpo).length)
    })

    it(`"${modelo.titulo}" só usa campos que existem`, () => {
      for (const id of camposUsados(modelo.corpo)) {
        expect(CAMPOS.map((c) => c.id)).toContain(id)
      }
    })
  }

  it('nenhum começa ou termina com variável, que a Meta costuma recusar', () => {
    for (const modelo of MODELOS_PRONTOS) {
      const { corpo } = paraFormatoDaMeta(modelo.corpo)
      expect(corpo).not.toMatch(/^\s*\{\{\d+\}\}/)
      expect(corpo).not.toMatch(/\{\{\d+\}\}\s*$/)
    }
  })

  it('os ids não se repetem', () => {
    const ids = MODELOS_PRONTOS.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('camposDoCorpoDaMeta, de volta do jargão da Meta', () => {
  it('reconhece o nome no primeiro buraco depois de um cumprimento', () => {
    const campos = camposDoCorpoDaMeta('Oi {{1}}, tudo bem?')
    expect(campos[0]?.id).toBe('nome')
    // O nome é automático, e é isso que faz a tela NÃO perguntá-lo.
    expect(campos[0]?.automatico).toBe(true)
  })

  it('acha data e horário pelas palavras coladas no buraco', () => {
    const campos = camposDoCorpoDaMeta('Oi {{1}}, sua consulta é dia {{2}} às {{3}}.')
    expect(campos.map((c) => c?.id)).toEqual(['nome', 'data', 'hora'])
  })

  it('acha o valor', () => {
    const campos = camposDoCorpoDaMeta('Olá {{1}}, o total ficou em {{2}}.')
    expect(campos[1]?.id).toBe('valor')
  })

  it('devolve null quando não dá para saber, em vez de inventar', () => {
    /*
     * O ponto do teste: sem pista, a tela pergunta de um jeito genérico em
     * português. Adivinhar errado aqui poria a data no lugar do código.
     */
    const campos = camposDoCorpoDaMeta('Aviso importante: {{1}}.')
    expect(campos).toEqual([null])
  })

  it('corpo sem variável nenhuma devolve lista vazia', () => {
    expect(camposDoCorpoDaMeta('Estamos fechados amanhã.')).toEqual([])
  })

  it('a ida e a volta batem nos modelos prontos', () => {
    /*
     * A prova que interessa: todo modelo da galeria tem que voltar do formato
     * da Meta com os mesmos campos que entraram. Se a heurística errar num
     * modelo nosso, a tela de transmissão pergunta a coisa errada.
     */
    for (const modelo of MODELOS_PRONTOS) {
      const { corpo, campos } = paraFormatoDaMeta(modelo.corpo)
      const devolta = camposDoCorpoDaMeta(corpo)
      expect(devolta.map((c) => c?.id)).toEqual(campos)
    }
  })
})
