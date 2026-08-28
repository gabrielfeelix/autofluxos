import { describe, expect, it } from 'vitest'
import { chavesSimplesCitadas, fatiarVariaveis, variaveisCitadas } from './interpolar'

describe('fatiarVariaveis — o realce do editor', () => {
  it('separa literal de citação', () => {
    expect(fatiarVariaveis('Legal, {{nome}}. Para quando?')).toEqual([
      { tipo: 'texto', texto: 'Legal, ' },
      { tipo: 'variavel', texto: '{{nome}}', nome: 'nome' },
      { tipo: 'texto', texto: '. Para quando?' },
    ])
  })

  it('texto sem variável vira um pedaço só, e vazio vira nenhum', () => {
    expect(fatiarVariaveis('oi')).toEqual([{ tipo: 'texto', texto: 'oi' }])
    expect(fatiarVariaveis('')).toEqual([])
  })

  it('remonta exatamente o original — o realce não pode comer caractere', () => {
    // É a garantia que impede o espelho de descolar do campo: se a soma dos
    // pedaços não for o texto, o cursor cai numa coluna e a cor em outra.
    for (const texto of [
      '{{a}}{{b}}',
      'só texto',
      '{{ nome }} com espaço',
      'chave solta { e }} e {{1invalida}}',
      '\n{{nome}}\n\n',
    ]) {
      expect(fatiarVariaveis(texto).map((p) => p.texto).join('')).toBe(texto)
    }
  })

  it('reconhece exatamente o que o motor reconhece', () => {
    // Se o realce pintasse mais coisa que `interpolar`, a pessoa confiaria na
    // cor e a conversa mandaria o literal.
    const texto = 'a {{ok}} b {{1ruim}} c {{ tambem_ok }} d'
    const pintadas = fatiarVariaveis(texto)
      .filter((p) => p.tipo === 'variavel')
      .map((p) => (p.tipo === 'variavel' ? p.nome : ''))
    expect(pintadas).toEqual(variaveisCitadas(texto))
  })
})

describe('chavesSimplesCitadas — o engano de uma chave só', () => {
  it('acha a chave simples', () => {
    expect(chavesSimplesCitadas('dia {dias_reposicao} às {horario}')).toEqual([
      'dias_reposicao',
      'horario',
    ])
  })

  it('ignora a citação certa', () => {
    expect(chavesSimplesCitadas('Olá, {{nome}}! Tudo bem?')).toEqual([])
  })

  it('não lê o miolo de uma citação certa como chave simples', () => {
    expect(chavesSimplesCitadas('{{nome}} {{sobrenome}}')).toEqual([])
  })

  it('cala sobre {{1abc}}, que já tem aviso próprio', () => {
    expect(chavesSimplesCitadas('{{1abc}}')).toEqual([])
  })

  it('não acusa chave sem nome dentro', () => {
    expect(chavesSimplesCitadas('function f() {} e {} e { }')).toEqual([])
  })

  it('não repete a mesma chave', () => {
    expect(chavesSimplesCitadas('{dia} e depois {dia}')).toEqual(['dia'])
  })
})
