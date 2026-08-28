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

  it('marca a chave simples como erro, no lugar exato dela', () => {
    // O motivo de existir o terceiro tipo: o vermelho tem que cair em cima do
    // pedaço errado, e não numa frase embaixo do campo.
    expect(fatiarVariaveis('Volta dia {dias} para {{nome}}.')).toEqual([
      { tipo: 'texto', texto: 'Volta dia ' },
      { tipo: 'chave-simples', texto: '{dias}', nome: 'dias' },
      { tipo: 'texto', texto: ' para ' },
      { tipo: 'variavel', texto: '{{nome}}', nome: 'nome' },
      { tipo: 'texto', texto: '.' },
    ])
  })

  it('o miolo de uma citação certa não vira chave simples', () => {
    // Sem a máscara, `{{nome}}` seria lido como `{nome}` e todo fluxo correto
    // ficaria vermelho.
    expect(fatiarVariaveis('{{nome}}')).toEqual([
      { tipo: 'variavel', texto: '{{nome}}', nome: 'nome' },
    ])
  })

  it('marca exatamente o que o validador acusa', () => {
    // A regra é uma só: se o realce e o `CHAVE_SIMPLES` discordassem, a cor
    // mentiria para quem está escrevendo.
    for (const texto of [
      'dia {dias_reposicao} às {horario}',
      'Olá, {{nome}}! {sobrenome} aqui',
      '{{1abc}} e {abc}',
      'function f() {} e {} e { }',
      '{ nome } com espaço',
    ]) {
      const doRealce = [
        ...new Set(
          fatiarVariaveis(texto)
            .filter((p) => p.tipo === 'chave-simples')
            .map((p) => (p.tipo === 'chave-simples' ? p.nome : '')),
        ),
      ]
      expect(doRealce).toEqual(chavesSimplesCitadas(texto))
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
